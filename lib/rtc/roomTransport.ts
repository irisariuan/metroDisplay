/* Unified pairing transport: relay-first, WebRTC-preferred.
 *
 * A device joins a room on the relay. Once two devices are present the room is
 * immediately usable — app messages flow through the relay. In parallel the two
 * peers try to establish a direct WebRTC connection; if that succeeds, app
 * traffic silently upgrades to the peer-to-peer data channel. If WebRTC never
 * connects (restrictive NAT, no reachable STUN), the relay keeps carrying the
 * data — so the split display/control mode works either way.
 *
 * The relay itself never inspects payloads (see scripts/signal-server.ts); this
 * module owns the envelope protocol:
 *   { ch: "sig", signal }  — WebRTC offer/answer/ICE, forwarded to the peer
 *   { ch: "app", data }    — application message on the relay fallback path
 * Server-originated frames arrive as { t: "peers", count }. */
import {
	createRtcSession,
	type PeerRole,
	type RtcSession,
	type RtcSignal,
} from "@/lib/rtc/peer";

export type TransportMode = "p2p" | "relay" | null;
export type TransportStatus =
	| "connecting" // opening the relay socket
	| "waiting" // relay open, waiting for the other device
	| "connected" // both devices present; app messages flow
	| "closed";

export interface TransportSnapshot {
	status: TransportStatus;
	mode: TransportMode;
	peers: number;
}

export interface RoomTransport {
	send(data: unknown): void;
	onMessage(handler: (data: unknown) => void): () => void;
	onStatus(handler: (snapshot: TransportSnapshot) => void): () => void;
	getSnapshot(): TransportSnapshot;
	close(): void;
}

export interface RoomTransportOptions {
	url: string;
	room: string;
	role: PeerRole;
}

export function createRoomTransport({
	url,
	room,
	role,
}: RoomTransportOptions): RoomTransport {
	const messageHandlers = new Set<(data: unknown) => void>();
	const statusHandlers = new Set<(snapshot: TransportSnapshot) => void>();

	let ws: WebSocket | null = null;
	let session: RtcSession | null = null;
	let closed = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	let status: TransportStatus = "connecting";
	let mode: TransportMode = null;
	let peers = 0;

	const emitStatus = () => {
		const snapshot: TransportSnapshot = { status, mode, peers };
		statusHandlers.forEach((handler) => handler(snapshot));
	};
	const setStatus = (next: TransportStatus) => {
		if (status === next) return;
		status = next;
		emitStatus();
	};
	const setMode = (next: TransportMode) => {
		if (mode === next) return;
		mode = next;
		emitStatus();
	};
	const emitMessage = (data: unknown) =>
		messageHandlers.forEach((handler) => handler(data));

	const relaySend = (frame: unknown) => {
		if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
	};

	const teardownSession = () => {
		session?.close();
		session = null;
		if (mode === "p2p") setMode("relay");
	};

	const ensureSession = () => {
		if (session || closed) return;
		session = createRtcSession({
			role,
			sendSignal: (signal) => relaySend({ ch: "sig", signal }),
			onData: emitMessage,
			onOpen: () => setMode("p2p"),
			onClose: () => {
				// Direct link dropped; fall back to the relay while both
				// devices remain in the room.
				if (mode === "p2p") setMode(peers >= 2 ? "relay" : null);
			},
		});
		// Host offers immediately; guest waits for the offer. start() is a
		// no-op for the guest.
		void session.start();
	};

	const handlePeerCount = (count: number) => {
		peers = count;
		if (count >= 2) {
			setStatus("connected");
			if (mode === null) setMode("relay");
			ensureSession();
		} else {
			// Peer left — collapse back to waiting and rebuild the session on
			// the next pairing so a fresh offer is negotiated.
			teardownSession();
			setMode(null);
			setStatus(ws?.readyState === WebSocket.OPEN ? "waiting" : "connecting");
		}
		emitStatus();
	};

	const handleFrame = (raw: string) => {
		let frame: unknown;
		try {
			frame = JSON.parse(raw);
		} catch {
			return;
		}
		if (!frame || typeof frame !== "object") return;
		const record = frame as Record<string, unknown>;
		if (record.t === "peers" && typeof record.count === "number") {
			handlePeerCount(record.count);
			return;
		}
		if (record.ch === "sig") {
			ensureSession();
			void session?.handleSignal(record.signal as RtcSignal);
			return;
		}
		if (record.ch === "app") {
			emitMessage(record.data);
		}
	};

	const connect = () => {
		if (closed) return;
		const socket = new WebSocket(
			`${url}?room=${encodeURIComponent(room)}`,
		);
		ws = socket;
		socket.onopen = () => {
			if (closed) return;
			setStatus(peers >= 2 ? "connected" : "waiting");
		};
		socket.onmessage = (event) => {
			if (typeof event.data === "string") handleFrame(event.data);
		};
		socket.onclose = () => {
			if (closed) return;
			peers = 0;
			teardownSession();
			setMode(null);
			setStatus("connecting");
			// Relay dropped — retry so a briefly-restarted relay reconnects.
			reconnectTimer = setTimeout(connect, 1000);
		};
		socket.onerror = () => {
			socket.close();
		};
	};

	connect();

	return {
		send(data: unknown) {
			// Prefer the direct channel; otherwise relay it.
			if (session?.isOpen()) {
				if (session.send(data)) return;
			}
			relaySend({ ch: "app", data });
		},
		onMessage(handler) {
			messageHandlers.add(handler);
			return () => messageHandlers.delete(handler);
		},
		onStatus(handler) {
			statusHandlers.add(handler);
			return () => statusHandlers.delete(handler);
		},
		getSnapshot() {
			return { status, mode, peers };
		},
		close() {
			closed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			teardownSession();
			messageHandlers.clear();
			try {
				ws?.close();
			} catch {
				/* already gone */
			}
			status = "closed";
			mode = null;
			emitStatus();
			statusHandlers.clear();
		},
	};
}

/** Where the client reaches the relay.
 *
 * The relay is hosted by the app's own server (see server.ts) on the SAME port,
 * so it's always same-origin at `/signal` — `ws://` in dev, `wss://` behind a
 * TLS-terminating proxy such as a Cloudflare Tunnel. A single origin exposes
 * both the app and the relay; no extra port or hostname. Override with
 * NEXT_PUBLIC_SIGNAL_URL (baked at build) only to point at a separate relay. */
export function defaultSignalUrl(): string {
	const configured = process.env.NEXT_PUBLIC_SIGNAL_URL;
	if (configured) return configured;
	if (typeof window === "undefined") return "ws://localhost:3000/signal";
	const secure = window.location.protocol === "https:";
	return `${secure ? "wss" : "ws"}://${window.location.host}/signal`;
}
