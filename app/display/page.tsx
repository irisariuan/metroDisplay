"use client";
/* Display device: runs the authoritative engine, renders the in-car board and
 * plays announcement audio. It applies actions/commands arriving from the
 * paired control device and broadcasts a snapshot of state whenever it changes
 * (and on demand when a control device says hello). */
import React from "react";
import { SimulatorDisplay } from "@/components/simulator/SimulatorDisplay";
import { AnnouncementAudio } from "@/components/simulator/AnnouncementAudio";
import { useSimulatorEngine } from "@/components/simulator/useSimulatorEngine";
import { useRoomTransport } from "@/lib/rtc/useRoomTransport";
import { useRoomParam } from "@/components/simulator/split/useRoomParam";
import { ConnectionBanner } from "@/components/simulator/split/ConnectionBanner";
import { PairHint } from "@/components/simulator/split/PairHint";
import {
	applyToEngine,
	buildSnapshot,
	type ControlToDisplay,
	type DisplayToControl,
} from "@/components/simulator/remoteProtocol";

const { useEffect, useRef } = React;

export default function DisplayPage() {
	const room = useRoomParam(true);
	const engine = useSimulatorEngine();
	// Destructured (rather than read as `engine.foo` inline in JSX below) so the
	// hooks linter can type each field precisely instead of conservatively
	// treating the whole aggregate as ref-tainted — see the /control page for
	// the same pattern.
	const { displayProps, audioRef, audioProps } = engine;
	// The message handler needs the latest engine closures but only reads the
	// ref asynchronously (on inbound WS messages), so keeping it in sync via an
	// effect — never writing it during render — is both correct and sufficient.
	const engineRef = useRef(engine);
	const processedStopIdsRef = useRef(new Set<string>());
	useEffect(() => {
		engineRef.current = engine;
	});

	const { snapshot: conn, send, onMessage } = useRoomTransport(room, "host");

	// Apply inbound control messages to the real engine; answer hello with a
	// full snapshot so a freshly-paired control renders immediately.
	useEffect(
		() =>
			onMessage((raw) => {
				const message = raw as ControlToDisplay;
				if (!message || typeof message !== "object") return;
				if (message.k === "hello") {
					send({
						k: "snapshot",
						snapshot: buildSnapshot(engineRef.current),
					} satisfies DisplayToControl);
					return;
				}
				if (message.k === "stop-audio") {
					if (!processedStopIdsRef.current.has(message.commandId)) {
						processedStopIdsRef.current.add(message.commandId);
						applyToEngine(engineRef.current, message);
					}
					send({
						k: "ack",
						commandId: message.commandId,
					} satisfies DisplayToControl);
					return;
				}
				if (
					message.k === "action" ||
					message.k === "cmd" ||
					message.k === "upload"
				)
					applyToEngine(engineRef.current, message);
			}),
		[onMessage, send],
	);

	// Broadcast the snapshot whenever its serialised form actually changes.
	// `json` is the effect dependency that gates re-sends; `engine` (and thus
	// `snapshot`) is a fresh object every render, so it can't be a dependency
	// without defeating the dedupe — reparsing `json` inside the effect gives
	// an equivalent value without that churn.
	const json = JSON.stringify(buildSnapshot(engine));
	useEffect(() => {
		if (conn.status !== "connected") return;
		send({
			k: "snapshot",
			snapshot: JSON.parse(json),
		} satisfies DisplayToControl);
	}, [json, conn.status, send]);

	return (
		<main className="relative z-1 mx-auto max-w-screen px-5.5 pt-6.5 pb-10">
			<ConnectionBanner role="display" room={room} conn={conn} />
			{conn.status !== "connected" && room && <PairHint room={room} />}
			<SimulatorDisplay {...displayProps} />
			<AnnouncementAudio ref={audioRef} {...audioProps} />
		</main>
	);
}
