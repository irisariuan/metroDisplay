/* Control-device side: turn a mirrored snapshot + a send function into the
 * exact { state, dispatch, context } that SimulatorControls consumes.
 *
 * Data fields read straight from the snapshot; every command becomes a message
 * the display applies to the real engine. Reducer actions have their functional
 * updaters resolved against the mirrored state before being sent. */
import type React from "react";
import type { SimulatorControlsContext } from "@/components/simulator/SimulatorControls";
import {
	REMOTE_COMMANDS,
	resolveAction,
	fileToBase64,
	type ControlToDisplay,
	type RemoteCommandName,
	type RemoteSnapshot,
} from "@/components/simulator/remoteProtocol";
import type {
	SimulatorControlAction,
	SimulatorControlState,
} from "@/components/simulator/simulatorControlState";

type Send = (message: ControlToDisplay) => void;

export function buildRemoteContext(
	snapshot: RemoteSnapshot,
	send: Send,
	stopAnnouncementAudio: () => void,
): SimulatorControlsContext {
	const availableClipKeys = new Set(snapshot.availableClipKeys);
	// The control device never holds the uploaded blob URLs; it only needs to
	// know *which* keys are overridden, so mark each with a placeholder.
	const announcementAudioOverrides: Record<string, string> = {};
	for (const key of snapshot.overrideKeys)
		announcementAudioOverrides[key] = "remote";

	const commandFns = Object.fromEntries(
		REMOTE_COMMANDS.map((name: RemoteCommandName) => [
			name,
			(...args: unknown[]) => send({ k: "cmd", name, args }),
		]),
	);

	return {
		...commandFns,
		route: snapshot.route,
		hasCurrentTransfers: snapshot.hasCurrentTransfers,
		transferExpanded: snapshot.transferExpanded,
		currentStation: snapshot.currentStation,
		announcementAudioOverrides,
		presets: snapshot.presets,
		marqueePresets: snapshot.marqueePresets,
		uploadAnnouncementAudio: (key: string, file: File) => {
			void fileToBase64(file).then((dataB64) =>
				send({
					k: "upload",
					key,
					filename: file.name,
					mime: file.type || "audio/mpeg",
					dataB64,
				}),
			);
		},
		stopAnnouncementAudio,
		isAudioClipAvailable: (key: string) => availableClipKeys.has(key),
		audioQueue: snapshot.audioQueue,
	} as SimulatorControlsContext;
}

export function buildRemoteDispatch(
	send: Send,
	getState: () => SimulatorControlState,
): React.Dispatch<SimulatorControlAction> {
	return (action) =>
		send({ k: "action", action: resolveAction(action, getState()) });
}
