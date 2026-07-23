/* WebRTC session with trickle ICE, driven by an external signaling channel.
 *
 * This does not talk to any server itself — the caller passes `sendSignal` to
 * ship offer/answer/ICE to the remote peer (in practice, through the room relay)
 * and feeds remote signals back in via `handleSignal`. That keeps the RTC logic
 * transport-agnostic and lets roomTransport own the relay socket. */

export type PeerRole = "host" | "guest";

export type RtcSignal =
	| { kind: "offer"; sdp: RTCSessionDescriptionInit }
	| { kind: "answer"; sdp: RTCSessionDescriptionInit }
	| { kind: "ice"; candidate: RTCIceCandidateInit };

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "stun:stun1.l.google.com:19302" },
];

const CHANNEL_LABEL = "metro-sim";

export interface RtcSessionOptions {
	role: PeerRole;
	sendSignal: (signal: RtcSignal) => void;
	iceServers?: RTCIceServer[];
	onData: (data: unknown) => void;
	onOpen: () => void;
	onClose: () => void;
}

export interface RtcSession {
	/** begin negotiation (host creates the offer; guest waits for one). */
	start(): Promise<void>;
	/** feed a signal received from the remote peer. */
	handleSignal(signal: RtcSignal): Promise<void>;
	/** send app data over the data channel; returns false if not open. */
	send(data: unknown): boolean;
	isOpen(): boolean;
	close(): void;
}

export function createRtcSession(options: RtcSessionOptions): RtcSession {
	const { role, sendSignal, onData, onOpen, onClose } = options;
	const pc = new RTCPeerConnection({
		iceServers: options.iceServers ?? DEFAULT_ICE_SERVERS,
	});
	let channel: RTCDataChannel | null = null;
	let closed = false;

	const bindChannel = (dc: RTCDataChannel) => {
		channel = dc;
		dc.onopen = () => {
			if (!closed) onOpen();
		};
		dc.onclose = () => {
			if (!closed) onClose();
		};
		dc.onmessage = (event) => {
			let parsed: unknown = event.data;
			if (typeof event.data === "string") {
				try {
					parsed = JSON.parse(event.data);
				} catch {
					parsed = event.data;
				}
			}
			onData(parsed);
		};
	};

	if (role === "host") {
		bindChannel(pc.createDataChannel(CHANNEL_LABEL, { ordered: true }));
	} else {
		pc.ondatachannel = (event) => bindChannel(event.channel);
	}

	pc.onicecandidate = (event) => {
		if (event.candidate)
			sendSignal({ kind: "ice", candidate: event.candidate.toJSON() });
	};
	pc.onconnectionstatechange = () => {
		if (
			(pc.connectionState === "failed" ||
				pc.connectionState === "disconnected") &&
			!closed
		)
			onClose();
	};

	return {
		async start() {
			if (role !== "host") return;
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			sendSignal({ kind: "offer", sdp: offer });
		},
		async handleSignal(signal: RtcSignal) {
			if (closed) return;
			if (signal.kind === "offer") {
				await pc.setRemoteDescription(signal.sdp);
				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				sendSignal({ kind: "answer", sdp: answer });
			} else if (signal.kind === "answer") {
				await pc.setRemoteDescription(signal.sdp);
			} else if (signal.kind === "ice") {
				try {
					await pc.addIceCandidate(signal.candidate);
				} catch {
					/* candidate can arrive before remote description; ignore */
				}
			}
		},
		send(data: unknown) {
			if (!channel || channel.readyState !== "open") return false;
			channel.send(
				typeof data === "string" ? data : JSON.stringify(data),
			);
			return true;
		},
		isOpen() {
			return channel?.readyState === "open";
		},
		close() {
			closed = true;
			try {
				channel?.close();
			} catch {
				/* already gone */
			}
			try {
				pc.close();
			} catch {
				/* already gone */
			}
		},
	};
}
