/* 水下地鐵 — Shuika Metro network data (fictional, transcribed from the map reference)
 *
 * The network lives in ./data as plain JSON, split per simulator preset so each
 * one can be edited on its own:
 *   data/presets.json            preset id, label and default line
 *   data/<preset>/lines.json     line branding, keyed by line id
 *   data/<preset>/routes.json    ordered stations per line
 *   data/<preset>/station-readings.json  hiragana/katakana per station name
 *
 * Readings are stored once per preset and merged in here, so every route that
 * shares a station consistently exposes both phonetic Japanese scripts. A
 * preset's line list is derived from its routes, which keeps every selectable
 * line drivable.
 *
 * ⚠ Transcription notes: the Shuika map is dense, so station ORDER, platform
 * SIDE (L/R) and a few line allocations are best-effort.
 *
 * ⚠ The Tokyo interchange lines (everything but YM) carry real branding but
 * PLACEHOLDER routes: each one is synthesised from the Yamanote stations it
 * actually meets, padded with neighbouring stops where a line touches the loop
 * only once. Station order and platform sides there are not real.
 */
import type {
	AnnotatedLineMeta,
	AnnotatedLines,
	EditableStation,
	LineId,
	Route,
	Routes,
	Station,
} from "@/types/metro";
import presetData from "./data/presets.json";
import shuikaLines from "./data/shuika/lines.json";
import shuikaRoutes from "./data/shuika/routes.json";
import shuikaReadings from "./data/shuika/station-readings.json";
import tokyoLines from "./data/tokyo/lines.json";
import tokyoRoutes from "./data/tokyo/routes.json";
import tokyoReadings from "./data/tokyo/station-readings.json";

/** The station shape as stored in routes.json, before readings are merged. */
interface RawStation {
	ja: string;
	en: string;
	side: Station["side"];
	distance?: number;
	xf?: LineId[];
	major?: boolean;
	skip?: string[];
}

interface RawRoute {
	line: LineId;
	destJa: string;
	destEn: string;
	towardJa: string;
	towardEn: string;
	circular?: boolean;
	stations: RawStation[];
}

type StationReadings = Record<string, { hira: string; kata: string }>;

interface PresetData {
	lines: Record<string, AnnotatedLineMeta>;
	routes: Record<string, RawRoute>;
	readings: StationReadings;
}

/** Each preset owns its own slice of the network. */
const PRESET_DATA: Record<string, PresetData> = {
	shuika: {
		lines: shuikaLines as Record<string, AnnotatedLineMeta>,
		routes: shuikaRoutes as Record<string, RawRoute>,
		readings: shuikaReadings as StationReadings,
	},
	yamanote: {
		lines: tokyoLines as Record<string, AnnotatedLineMeta>,
		routes: tokyoRoutes as Record<string, RawRoute>,
		readings: tokyoReadings as StationReadings,
	},
};

function hydrateStation(
	station: RawStation,
	readings: StationReadings,
): EditableStation {
	const reading = readings[station.ja];
	return {
		...station,
		xf: station.xf ?? [],
		hira: reading?.hira || "",
		kata: reading?.kata || "",
	};
}

/**
 * Mark interchanges and both termini as major by default. Explicit choices in
 * routes.json are retained, so a route can opt a station in or out — the JR
 * lines curate their own major-stop list that way.
 */
export function markMajorStations(route: Route): Route {
	const terminalIndex = route.stations.length - 1;
	for (const [index, station] of route.stations.entries()) {
		if (station.major === undefined)
			station.major =
				index === 0 || index === terminalIndex || station.xf.length > 0;
	}
	return route;
}

const LINES: AnnotatedLines = {};
const ROUTES: Routes = {};
for (const preset of Object.values(PRESET_DATA)) {
	Object.assign(LINES, preset.lines);
	for (const [id, route] of Object.entries(preset.routes)) {
		ROUTES[id] = markMajorStations({
			...route,
			stations: route.stations.map((station) =>
				hydrateStation(station, preset.readings),
			),
		});
	}
}

/** The selectable starting points for the simulator's built-in route presets. */
export const SIMULATOR_PRESETS = (
	presetData as { id: string; label: string; lineId: LineId }[]
).map((preset) => ({
	...preset,
	// Derived from the preset's own routes, so every listed line is drivable.
	lineIds: Object.keys(PRESET_DATA[preset.id]?.routes ?? {}) as LineId[],
}));

export interface SimulatorPreset {
	id: string;
	label: string;
	lineId: LineId;
	lineIds: LineId[];
	marqueePresetId: string;
}
export type SimulatorPresetId = string;

// station number label e.g. C05
function num(lineId: LineId, idx: number): string {
	return LINES[lineId].code + String(idx + 1).padStart(2, "0");
}

export { LINES, ROUTES, num };
