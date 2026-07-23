"use client";
/* Control device: no engine. It mirrors the display's snapshot and renders the
 * full SimulatorControls surface, turning every interaction into a message the
 * display applies to the real state. */
import React from "react";
import { SimulatorControls } from "@/components/simulator/SimulatorControls";
import { initialSimulatorControlState } from "@/components/simulator/simulatorControlState";
import { useRoomTransport } from "@/lib/rtc/useRoomTransport";
import { useRoomParam } from "@/components/simulator/split/useRoomParam";
import { ConnectionBanner } from "@/components/simulator/split/ConnectionBanner";
import {
	buildRemoteContext,
	buildRemoteDispatch,
} from "@/components/simulator/remoteControlContext";
import type {
	DisplayToControl,
	RemoteSnapshot,
} from "@/components/simulator/remoteProtocol";

const { useCallback, useEffect, useMemo, useRef, useState } = React;

const STOP_RETRY_MS = 400;
let stopCommandSequence = 0;

function createStopCommandId(): string {
	stopCommandSequence += 1;
	const randomPart =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2);
	return `${Date.now().toString(36)}-${stopCommandSequence.toString(36)}-${randomPart}`;
}

function RoomEntry() {
	const [code, setCode] = useState("");
	return (
		<main className="relative z-1 mx-auto max-w-md px-5.5 pt-16">
			<div className="rounded-[10px] border-2 border-ink bg-paper p-6 font-mono text-ink">
				<div className="mb-2 text-sm font-bold tracking-widest">
					CONTROL · 操作端末
				</div>
				<p className="mb-4 text-xs leading-relaxed opacity-70">
					Enter the room code shown on the display device to pair.
				</p>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const room = code.trim().toUpperCase();
						if (room)
							window.location.href = `/control?room=${encodeURIComponent(room)}`;
					}}
					className="flex gap-2"
				>
					<input
						value={code}
						onChange={(event) => setCode(event.target.value)}
						placeholder="ABC123"
						className="min-w-0 flex-1 rounded-[6px] border-2 border-ink bg-paper px-3 py-2 text-lg tracking-[.4em] uppercase outline-none"
						autoFocus
					/>
					<button
						type="submit"
						className="rounded-[6px] border-2 border-ink bg-acid px-4 py-2 text-sm font-bold"
					>
						JOIN
					</button>
				</form>
			</div>
		</main>
	);
}

export default function ControlPage() {
	const room = useRoomParam(false);
	const { snapshot: conn, send, onMessage } = useRoomTransport(room, "guest");
	const [snap, setSnap] = useState<RemoteSnapshot | null>(null);
	const snapRef = useRef<RemoteSnapshot | null>(null);
	const pendingStopsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	useEffect(() => {
		snapRef.current = snap;
	});

	const clearPendingStop = useCallback((commandId: string) => {
		const timer = pendingStopsRef.current.get(commandId);
		if (timer !== undefined) clearTimeout(timer);
		pendingStopsRef.current.delete(commandId);
	}, []);

	const transmitStop = useCallback(
		function retry(commandId: string) {
			send({ k: "stop-audio", commandId });
			const timer = setTimeout(() => retry(commandId), STOP_RETRY_MS);
			pendingStopsRef.current.set(commandId, timer);
		},
		[send],
	);

	const stopAnnouncementAudio = useCallback(() => {
		const commandId = createStopCommandId();
		transmitStop(commandId);
	}, [transmitStop]);

	useEffect(
		() => () => {
			for (const timer of pendingStopsRef.current.values()) clearTimeout(timer);
			pendingStopsRef.current.clear();
		},
		[],
	);

	useEffect(
		() =>
			onMessage((raw) => {
				const message = raw as DisplayToControl;
				if (!message || typeof message !== "object") return;
				if (message.k === "ack") {
					clearPendingStop(message.commandId);
					return;
				}
				if (
					message &&
					message.k === "snapshot"
				)
					setSnap(message.snapshot);
			}),
		[clearPendingStop, onMessage],
	);

	// Announce ourselves each time the link comes up so the display replies with
	// a current snapshot (covers first pairing and reconnects).
	useEffect(() => {
		if (conn.status === "connected") send({ k: "hello" });
	}, [conn.status, send]);

	const dispatch = useMemo(
		() =>
			buildRemoteDispatch(
				send,
				() => snapRef.current?.state ?? initialSimulatorControlState,
			),
		[send],
	);
	const context = useMemo(
		() =>
			snap
				? buildRemoteContext(snap, send, stopAnnouncementAudio)
				: null,
		[snap, send, stopAnnouncementAudio],
	);

	if (!room) return <RoomEntry />;

	return (
		<main className="relative z-1 mx-auto max-w-screen px-5.5 pt-6.5 pb-10">
			<ConnectionBanner role="control" room={room} conn={conn} />
			{snap && context ? (
				<SimulatorControls
					state={snap.state}
					dispatch={dispatch}
					context={context}
				/>
			) : (
				<div className="rounded-[8px] border-2 border-ink bg-paper px-4 py-6 text-center font-mono text-xs tracking-widest text-ink opacity-70">
					{conn.status === "connected"
						? "SYNCING…"
						: "WAITING FOR DISPLAY DEVICE…"}
				</div>
			)}
		</main>
	);
}
