import type React from "react";
import {
	MARQUEE_CONTENT_PRESETS,
	SPEED_PRESETS,
} from "@/lib/constants";
import type {
	AnnouncementContent,
	AnnouncementContentType,
	Lang,
	LineId,
} from "@/types/metro";
import { SIMULATOR_PRESETS, type SimulatorPresetId } from "@/lib/metro-data";

export type AlertScope = "marquee" | "lower" | "monitor";
export type TransferDisplayMode = "auto" | "full" | "split";
export type StationNameMode = "kanji" | "hiragana" | "en";
export type LanguageMode = "auto" | StationNameMode;

export interface DisplayAnnouncement extends AnnouncementContent {
	enabled: boolean;
}

export interface CustomMarqueePreset {
	id: string;
	label: string;
	items: DisplayAnnouncement[];
}

export interface SimulatorControlState {
	presetId: SimulatorPresetId;
	marqueePresetId: string;
	lineId: LineId;
	/** active stopping pattern: "local" or a ServiceVariant id on the route */
	serviceId: string;
	auto: boolean;
	travelDirection: number;
	speedKmh: number;
	simulationSpeed: number;
	stationStayMs: number;
	langMode: LanguageMode;
	lang: Lang;
	langMs: number;
	doorNoticeMs: number;
	doorNoticeWaitMs: number;
	pageSize: number;
	autoLanguageModes: StationNameMode[];
	showKatakana: boolean;
	stationNameMode: StationNameMode;
	alertText: string;
	alertSecondText: string;
	alertScope: AlertScope;
	alertActive: boolean;
	alertLeaving: boolean;
	delayNextMarqueeMessage: boolean;
	nextMarqueeThreshold: number;
	announcements: DisplayAnnouncement[];
	showDistanceIndicator: boolean;
	showSpeedIndicator: boolean;
	showStationStayIndicator: boolean;
	pauseAtPageBreak: boolean;
	followDirectionView: boolean;
	showEditor: boolean;
	transferDisplayMode: TransferDisplayMode;
	announcementAudioEnabled: boolean;
	/** When on, automatic announcements interrupt user-triggered audio; when off
	 * they wait behind it in the queue. */
	autoAnnouncementsInterrupt: boolean;
	announceStationNumberJa: boolean;
	announceStationNumberEn: boolean;
	announcementVolume: number;
	departureMajorStationCount: number;
}

type SetControlAction = {
	[K in keyof SimulatorControlState]: {
		type: "set";
		field: K;
		value: React.SetStateAction<SimulatorControlState[K]>;
	};
}[keyof SimulatorControlState];

type UpdateAnnouncementAction = {
	type: "updateAnnouncement";
	index: number;
	field: keyof DisplayAnnouncement;
	value: React.SetStateAction<DisplayAnnouncement[keyof DisplayAnnouncement]>;
};

export type SimulatorControlAction =
	| SetControlAction
	| {
			type: "applyMarqueePlaylist";
			presetId: string;
			items: DisplayAnnouncement[];
		}
	| UpdateAnnouncementAction
	| { type: "removeMarqueeItem"; index: number }
	| { type: "addMarqueeItem" };

const initialPreset = SIMULATOR_PRESETS[0];
const initialMarqueePreset =
	MARQUEE_CONTENT_PRESETS.find((preset) => preset.id === initialPreset?.id) ??
	MARQUEE_CONTENT_PRESETS[0];

export const initialSimulatorControlState: SimulatorControlState = {
	presetId: initialPreset?.id ?? "",
	marqueePresetId: initialMarqueePreset?.id ?? "",
	lineId: initialPreset?.lineId ?? "",
	serviceId: "local",
	auto: true,
	travelDirection: 1,
	speedKmh: SPEED_PRESETS.normal,
	simulationSpeed: 2,
	stationStayMs: 30000,
	langMode: "auto",
	lang: "ja",
	langMs: 10000,
	doorNoticeMs: 10000,
	doorNoticeWaitMs: 10000,
	pageSize: 8,
	autoLanguageModes: ["kanji", "hiragana", "en"],
	showKatakana: true,
	stationNameMode: "kanji",
	alertText: "Service update in progress",
	alertSecondText: "",
	alertScope: "marquee",
	alertActive: false,
	alertLeaving: false,
	delayNextMarqueeMessage: true,
	nextMarqueeThreshold: 70,
	announcements: (initialMarqueePreset?.items ?? []).map((item) => ({
		...item,
		type: item.type as AnnouncementContentType,
		ja: item.ja ?? "",
		enabled: true,
	})),
	showDistanceIndicator: true,
	showSpeedIndicator: true,
	showStationStayIndicator: false,
	pauseAtPageBreak: false,
	followDirectionView: false,
	showEditor: false,
	transferDisplayMode: "auto",
	announcementAudioEnabled: true,
	autoAnnouncementsInterrupt: true,
	announceStationNumberJa: false,
	announceStationNumberEn: false,
	announcementVolume: 0.8,
	departureMajorStationCount: 1,
};

export function setControl<K extends keyof SimulatorControlState>(
	field: K,
	value: React.SetStateAction<SimulatorControlState[K]>,
): SimulatorControlAction {
	return { type: "set", field, value } as SimulatorControlAction;
}

export function simulatorControlReducer(
	state: SimulatorControlState,
	action: SimulatorControlAction,
): SimulatorControlState {
	if (action.type === "set") {
		const value = action.value as React.SetStateAction<unknown>;
		const nextValue =
			typeof value === "function"
				? (value as (previous: unknown) => unknown)(state[action.field])
				: value;
		return { ...state, [action.field]: nextValue } as SimulatorControlState;
	}
	if (action.type === "applyMarqueePlaylist") {
		return {
			...state,
			marqueePresetId: action.presetId,
			announcements: action.items.map((item) => ({ ...item })),
		};
	}
	if (action.type === "updateAnnouncement") {
		return {
			...state,
			announcements: state.announcements.map((item, index) =>
				index === action.index
					? { ...item, [action.field]: action.value }
					: item,
			),
		};
	}
	if (action.type === "removeMarqueeItem") {
		return {
			...state,
			announcements: state.announcements.filter(
				(_, index) => index !== action.index,
			),
		};
	}
	return {
		...state,
		announcements: [
			...state.announcements,
			{
				type: "notice",
				en: "New metro notice",
				ja: "",
				enabled: true,
			},
		],
	};
}
