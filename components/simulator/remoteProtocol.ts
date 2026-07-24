/* Wire protocol between the /control device and the authoritative /display.
 *
 * The display runs the real engine (useSimulatorEngine). The control device
 * holds no engine: it renders SimulatorControls from a mirrored snapshot and
 * turns every interaction into a message the display applies to the real state.
 *
 *   control -> display : action | cmd | stop-audio | upload | hello
 *   display -> control : snapshot
 *
 * Reducer `set`/`updateAnnouncement` actions may carry functional updaters
 * (React.SetStateAction). Those can't cross the wire, so the control side
 * resolves them against its mirrored state first (resolveAction). */
import type {
	SimulatorControlAction,
	SimulatorControlState,
} from "@/components/simulator/simulatorControlState";
import type { SimulatorEngine } from "@/components/simulator/useSimulatorEngine";
import type { AnnouncementQueue } from "@/components/simulator/AnnouncementAudio";
import type { CustomMarqueePreset } from "@/components/simulator/simulatorControlState";
import type { SimulatorPreset } from "@/lib/metro-data";
import type { EditableRoute, Station } from "@/types/metro";

/** Context command callbacks that take only JSON-serialisable arguments and so
 * can be invoked remotely by name. Uploads have their own binary-safe message;
 * stop audio has its own message (it takes no arguments). */
export const REMOTE_COMMANDS = [
	"addService",
	"removeService",
	"setServiceField",
	"toggleServiceStop",
	"addLine",
	"pickPreset",
	"addPreset",
	"setPresetLabel",
	"togglePresetLine",
	"pickMarqueePreset",
	"pickLine",
	"setLineField",
	"setStationField",
	"toggleSide",
	"toggleMajorStation",
	"toggleXfer",
	"addStation",
	"removeStation",
	"moveStation",
	"setDest",
	"toggleCircular",
	"advance",
	"clearAlert",
	"playAnnouncementKeys",
	"reorderAnnouncementQueue",
	"removeAnnouncementFromQueue",
	"reorderAnnouncementClip",
	"removeAnnouncementClip",
	"playCurrentAnnouncement",
	"playDepartureAnnouncement",
] as const;

export type RemoteCommandName = (typeof REMOTE_COMMANDS)[number];

export interface RemoteSnapshot {
	state: SimulatorControlState;
	route: EditableRoute;
	hasCurrentTransfers: boolean;
	transferExpanded: boolean;
	currentStation: Station;
	presets: SimulatorPreset[];
	marqueePresets: CustomMarqueePreset[];
	/** announcement audio keys currently overridden by an upload on the display */
	overrideKeys: string[];
	/** clip keys that are playable (manifest ∪ overrides) */
	availableClipKeys: string[];
	audioQueue: AnnouncementQueue;
	status: { phase: string; auto: boolean };
}

export type ControlToDisplay =
	| { k: "hello" }
	| { k: "action"; action: SimulatorControlAction }
	| { k: "cmd"; name: RemoteCommandName; args: unknown[] }
	| { k: "stop-audio" }
	| { k: "upload"; key: string; filename: string; mime: string; dataB64: string };

export type DisplayToControl = { k: "snapshot"; snapshot: RemoteSnapshot };

export type RemoteMessage = ControlToDisplay | DisplayToControl;

/** Build the snapshot the display broadcasts to control devices. */
export function buildSnapshot(engine: SimulatorEngine): RemoteSnapshot {
	const overrideKeys = Object.keys(engine.context.announcementAudioOverrides);
	const availableClipKeys = Array.from(
		new Set([...engine.manifestClipKeys, ...overrideKeys]),
	);
	return {
		state: engine.controls,
		route: engine.context.route as EditableRoute,
		hasCurrentTransfers: engine.context.hasCurrentTransfers,
		transferExpanded: engine.context.transferExpanded,
		currentStation: engine.context.currentStation,
		presets: engine.context.presets,
		marqueePresets: engine.context.marqueePresets,
		overrideKeys,
		availableClipKeys,
		audioQueue: engine.context.audioQueue,
		status: engine.status,
	};
}

/** Resolve any functional updater in an action against the current mirrored
 * state so the action serialises to concrete values. */
export function resolveAction(
	action: SimulatorControlAction,
	state: SimulatorControlState,
): SimulatorControlAction {
	if (action.type === "set" && typeof action.value === "function") {
		const updater = action.value as (previous: unknown) => unknown;
		return {
			...action,
			value: updater(state[action.field]) as never,
		};
	}
	if (
		action.type === "updateAnnouncement" &&
		typeof action.value === "function"
	) {
		const updater = action.value as (previous: unknown) => unknown;
		const current = state.announcements[action.index]?.[action.field];
		return { ...action, value: updater(current) as never };
	}
	return action;
}

/** Apply a control->display message to the live engine. */
export function applyToEngine(
	engine: SimulatorEngine,
	message: ControlToDisplay,
): void {
	switch (message.k) {
		case "action":
			engine.dispatch(message.action);
			return;
		case "cmd": {
			const fn = (engine.context as Record<string, unknown>)[
				message.name
			];
			if (typeof fn === "function")
				(fn as (...args: unknown[]) => void)(...message.args);
			return;
		}
		case "stop-audio":
			engine.context.stopAnnouncementAudio();
			return;
		case "upload": {
			const blob = base64ToBlob(message.dataB64, message.mime);
			const file = new File([blob], message.filename, {
				type: message.mime,
			});
			engine.context.uploadAnnouncementAudio(message.key, file);
			return;
		}
		case "hello":
			// Answered by the caller sending a fresh snapshot.
			return;
	}
}

export async function fileToBase64(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export function base64ToBlob(base64: string, mime: string): Blob {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return new Blob([bytes], { type: mime });
}
