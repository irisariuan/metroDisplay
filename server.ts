/* Custom Next server that also hosts the pairing relay — on the SAME port.
 *
 * Normal HTTP/HMR traffic goes to Next. WebSocket upgrades whose path starts
 * with `/signal` are handled by the room relay; every other upgrade (Next's dev
 * HMR socket) is handed back to Next via getUpgradeHandler(). One port serves
 * the app and the relay, so a single Cloudflare Tunnel (or any reverse proxy)
 * exposes both with no extra route.
 *
 * The relay stays deliberately dumb: forward each peer's messages to the other
 * members of its room (carrying WebRTC signaling and, when a direct connection
 * can't form, the app data itself). Node 24 runs this TypeScript directly.
 *
 *   node server.ts                          (dev, port 3000)
 *   NODE_ENV=production node server.ts       (serves the production build)
 */
import { createServer } from "node:http";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";

const dev = process.env.NODE_ENV !== "production";
const pI = process.argv.findIndex((v) => v === "--port");
const port =
	Number(pI !== -1 ? process.argv[pI + 1] : process.env.PORT) ?? 3000;

const app = next({ dev, turbopack: dev });
const handle = app.getRequestHandler();

// ——— room relay ————————————————————————————————————————————————
const rooms = new Map<string, Set<WebSocket>>();
const roomOf = new Map<WebSocket, string>();

function roomMembers(room: string): Set<WebSocket> {
	let set = rooms.get(room);
	if (!set) {
		set = new Set();
		rooms.set(room, set);
	}
	return set;
}

function broadcastPeerCount(room: string): void {
	const members = rooms.get(room);
	if (!members) return;
	const message = JSON.stringify({ t: "peers", count: members.size });
	for (const socket of members) socket.send(message);
}

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket, room: string) => {
	roomMembers(room).add(ws);
	broadcastPeerCount(room);

	ws.on("message", (data, isBinary) => {
		const members = rooms.get(room);
		if (!members) return;
		for (const socket of members) {
			if (socket !== ws) socket.send(data, { binary: isBinary });
		}
	});

	ws.on("close", () => {
		const members = rooms.get(room);
		roomOf.delete(ws);
		if (!members) return;
		members.delete(ws);
		if (members.size === 0) rooms.delete(room);
		else broadcastPeerCount(room);
	});
});

// ——— wire the relay into Next's HTTP server ————————————————————
app.prepare().then(() => {
	const upgradeNext = app.getUpgradeHandler();

	const server = createServer((req, res) => {
		if (req.url && req.url.startsWith("/signal/health")) {
			res.writeHead(200);
			res.end("ok");
			return;
		}
		void handle(req, res);
	});

	server.on("upgrade", (req, socket, head) => {
		const url = new URL(req.url ?? "", "http://localhost");
		if (url.pathname.startsWith("/signal")) {
			const room = url.searchParams.get("room");
			if (!room) {
				socket.destroy();
				return;
			}
			wss.handleUpgrade(req, socket, head, (ws) => {
				roomOf.set(ws, room);
				wss.emit("connection", ws, room);
			});
			return;
		}
		// Everything else (Next dev HMR) belongs to Next.
		void upgradeNext(req, socket, head);
	});

	server.listen(port, () => {
		console.log(
			`> ready on http://localhost:${port}  (pairing relay at /signal)`,
		);
	});
});
