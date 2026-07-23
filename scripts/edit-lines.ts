#!/usr/bin/env bun

/**
 * edit-lines — an interactive editor for a preset's metro network.
 *
 *   1. Build / rebuild a line     assemble a route by choosing + ordering stops
 *                                 (incl. whether the line is circular)
 *   2. Edit station distances     tweak the gap recorded before each stop
 *   3. Edit a line               rename / recolour / fix reading / toggle circular
 *   4. Edit a station            rename / fix a stop's English, reading or door side
 *   5. Clean up unused entries   drop lines with no route and orphan readings
 *
 * Lines and stations come from TWO sources, UNIONED into one pool — nothing is
 * hardcoded here:
 *   • lib/data/<preset>/  the live network: lines.json, routes.json (station
 *                         order + distances per line) and station-readings.json.
 *                         This is what every edit reads and writes.
 *   • scripts/data/<preset>.json  a catalog of lines + stations (with readings)
 *                         that widens the choices when building. Either source
 *                         may contribute a line/station; lib/data wins overlaps.
 *
 * Run with no flags to choose a preset and open the menu. Build mode is also scriptable:
 *     bun scripts/edit-lines.ts --id NR --name 新線 --color '#ff8800' \
 *        --stations '荒川,森原,中心原'
 *     bun scripts/edit-lines.ts --from-line CS            # rebuild from data
 *     bun scripts/edit-lines.ts --clean                   # cleanup, then exit
 *
 * Flags
 *   --id / --name / --en / --code / --color / --stations / --from-line / --dest
 *                        build a line non-interactively (see build mode above)
 *   --circular           (build) make the line loop back to its first stop
 *   --clean              run the unused-entry cleanup and exit
 *   --preset <id>        preset to read/write (otherwise chosen in the menu)
 *   --source <path>      catalog file (default: scripts/data/<preset>.json)
 *   --out <dir>          dir to read/write (default: lib/data/<preset>)
 *   --dry-run            (build) print the generated entries, write nothing
 *   --yes                skip confirmation prompts
 */

import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
	createPrompt,
	isDownKey,
	isEnterKey,
	isSpaceKey,
	isUpKey,
	useKeypress,
	usePrefix,
	useState,
} from "@inquirer/core";
import inquirer from "inquirer";
import { searchableCheckbox } from "./lib/searchable-checkbox";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const TAB = "\t";

// ── Merged network model (build mode) ────────────────────────────────────────

interface Reading {
	hira: string;
	kata: string;
}
interface NetLine {
	id: string;
	code?: string;
	name: string;
	en?: string;
	color: string;
	textOnColor?: string;
	jaReading?: string;
}
interface Network {
	preset: string;
	lines: NetLine[];
	stations: string[];
	stationsEn: Record<string, string>;
	stationReadings: Record<string, Reading>;
	lineStations: Record<string, string[]>;
	lineCircular: Record<string, boolean>;
}

// ── Raw file shapes (edit mode reads & writes these verbatim) ─────────────────

interface RawLineMeta {
	id: string;
	code?: string;
	ja: string;
	en?: string;
	jaReading?: string;
	color: string;
	textOnColor?: string;
}
interface RawStation {
	ja: string;
	en?: string;
	side?: "L" | "R";
	distance?: number;
	xf?: string[];
	major?: boolean;
	skip?: string[];
}
interface RawRoute {
	line: string;
	destJa: string;
	destEn?: string;
	towardJa?: string;
	towardEn?: string;
	circular?: boolean;
	stations: RawStation[];
}
interface RawFiles {
	linesPath: string;
	routesPath: string;
	readingsPath: string;
	lines: Record<string, RawLineMeta>;
	routes: Record<string, RawRoute>;
	readings: Record<string, Reading>;
}

/** scripts/data/<preset>.json: a catalog of lines + stations with readings. */
interface CatalogLine {
	id: string;
	code?: string;
	name: string;
	en?: string;
	jaReading?: string;
	color: string;
	textOnColor?: string;
}
interface CatalogStation {
	ja: string;
	en?: string;
	hira?: string;
	kata?: string;
}
interface CatalogData {
	lines?: CatalogLine[];
	stations?: CatalogStation[];
}

// ── Output shapes (mirror lib/data/<preset>/*.json) ──────────────────────────

interface LineMeta {
	id: string;
	code: string;
	ja: string;
	en?: string;
	jaReading?: string;
	color: string;
	textOnColor: string;
}
interface RouteStation {
	ja: string;
	en: string;
	side: "L" | "R";
	distance: number;
	xf: string[];
}
interface Route {
	line: string;
	destJa: string;
	destEn: string;
	towardJa: string;
	towardEn: string;
	circular?: boolean;
	stations: RouteStation[];
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf8")) as T;
}
async function writeJson(path: string, obj: unknown): Promise<void> {
	await writeFile(path, `${JSON.stringify(obj, null, TAB)}\n`);
}

/** Choose from the live data presets instead of hard-coding the menu. */
async function pickPreset(): Promise<string> {
	const dataRoot = join(projectRoot, "lib/data");
	const entries = await readdir(dataRoot, { withFileTypes: true });
	const presets = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter(
			(id) =>
				existsSync(join(dataRoot, id, "lines.json")) &&
				existsSync(join(dataRoot, id, "routes.json")),
		)
		.sort();
	if (!presets.length) throw new Error(`No editable presets in ${dataRoot}.`);
	if (presets.length === 1) return presets[0];
	const { preset } = await inquirer.prompt<{ preset: string }>([
		{
			type: "select",
			name: "preset",
			message: "Choose a preset to edit:",
			choices: presets.map((id) => ({ name: id, value: id })),
			default: presets.includes("shuika") ? "shuika" : presets[0],
		},
	]);
	return preset;
}

/** Load the live preset files verbatim for in-place editing. */
async function loadRaw(dir: string): Promise<RawFiles> {
	if (!existsSync(dir)) throw new Error(`No data dir at ${dir}.`);
	const readingsPath = join(dir, "station-readings.json");
	return {
		linesPath: join(dir, "lines.json"),
		routesPath: join(dir, "routes.json"),
		readingsPath,
		lines: await readJson<Record<string, RawLineMeta>>(join(dir, "lines.json")),
		routes: await readJson<Record<string, RawRoute>>(join(dir, "routes.json")),
		readings: existsSync(readingsPath)
			? await readJson<Record<string, Reading>>(readingsPath)
			: {},
	};
}

/**
 * Build the working pool by UNIONING the live preset (lib/data) with the
 * catalog (scripts/data). lib/data is authoritative on any overlap; the catalog
 * fills gaps (line readings) and contributes any lines/stations lib/data lacks.
 */
async function loadNetwork(preset: string, sourcePath: string): Promise<Network> {
	const dir = join(projectRoot, "lib/data", preset);
	const raw = await loadRaw(dir);

	const lineMap = new Map<string, NetLine>();
	for (const m of Object.values(raw.lines))
		lineMap.set(m.id, {
			id: m.id,
			code: m.code,
			name: m.ja,
			en: m.en,
			color: m.color,
			textOnColor: m.textOnColor,
			jaReading: m.jaReading,
		});

	const lineStations: Record<string, string[]> = {};
	const lineCircular: Record<string, boolean> = {};
	const stationsEn: Record<string, string> = {};
	const stationReadings: Record<string, Reading> = { ...raw.readings };
	const pool = new Set<string>(Object.keys(raw.readings));
	for (const [id, route] of Object.entries(raw.routes)) {
		lineStations[id] = route.stations.map((s) => s.ja);
		lineCircular[id] = !!route.circular;
		for (const s of route.stations) {
			pool.add(s.ja);
			if (s.en && !stationsEn[s.ja]) stationsEn[s.ja] = s.en;
		}
	}

	if (existsSync(sourcePath)) {
		const cat = await readJson<CatalogData>(sourcePath);
		for (const l of cat.lines ?? []) {
			const existing = lineMap.get(l.id);
			if (existing) {
				existing.jaReading ??= l.jaReading;
				existing.en ??= l.en;
				existing.code ??= l.code;
			} else {
				lineMap.set(l.id, {
					id: l.id,
					code: l.code,
					name: l.name,
					en: l.en,
					jaReading: l.jaReading,
					color: l.color,
					textOnColor: l.textOnColor,
				});
			}
		}
		for (const s of cat.stations ?? []) {
			pool.add(s.ja);
			if (s.en && !stationsEn[s.ja]) stationsEn[s.ja] = s.en;
			if ((s.hira || s.kata) && !stationReadings[s.ja])
				stationReadings[s.ja] = { hira: s.hira ?? "", kata: s.kata ?? "" };
		}
	}

	return {
		preset,
		lines: [...lineMap.values()],
		stations: [...pool].sort(),
		stationsEn,
		stationReadings,
		lineStations,
		lineCircular,
	};
}

/** Split an --stations value on comma / ideographic comma / slash. */
function splitStations(raw: string): string[] {
	return raw
		.split(/[,、/\n]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Confirm a write unless --yes was passed. */
async function confirmWrite(message: string, yes: boolean): Promise<boolean> {
	if (yes) return true;
	const { ok } = await inquirer.prompt<{ ok: boolean }>([
		{ type: "confirm", name: "ok", message, default: true },
	]);
	if (!ok) console.log("Aborted.");
	return ok;
}

// ── Interchange + route assembly (build mode) ────────────────────────────────

function interchangesFor(
	station: string,
	selfId: string,
	lineStations: Record<string, string[]>,
): string[] {
	const xf: string[] = [];
	for (const [lid, stops] of Object.entries(lineStations)) {
		if (lid === selfId) continue;
		if (stops.includes(station)) xf.push(lid);
	}
	return xf;
}

function buildRoute(
	id: string,
	stationNames: string[],
	net: Network,
	destJa?: string,
	circular = false,
): { line: LineMeta; route: Route } {
	const lineStations = { ...net.lineStations, [id]: stationNames };

	const stations: RouteStation[] = stationNames.map((ja, i) => ({
		ja,
		en: net.stationsEn[ja] ?? "",
		side: i % 2 === 0 ? "R" : "L",
		distance: 1,
		xf: interchangesFor(ja, id, lineStations),
	}));

	const last = stationNames[stationNames.length - 1];
	const terminus = destJa || last;
	const terminusEn = net.stationsEn[terminus] ?? "";
	const route: Route = {
		line: id,
		destJa: terminus,
		destEn: terminusEn,
		towardJa: terminus,
		towardEn: terminusEn ? `for ${terminusEn}` : "",
		circular: circular || undefined,
		stations,
	};

	const meta = net.lines.find((l) => l.id === id);
	const line: LineMeta = {
		id,
		code: (meta?.code || id[0] || "").toUpperCase(),
		ja: meta?.name ?? id,
		en: meta?.en || undefined,
		jaReading: meta?.jaReading || undefined,
		color: meta?.color ?? "#888888",
		textOnColor: meta?.textOnColor ?? "#fff",
	};
	return { line, route };
}

async function mergeIntoFile<T>(
	path: string,
	key: string,
	value: T,
): Promise<"created" | "updated"> {
	const obj: Record<string, T> = existsSync(path)
		? await readJson<Record<string, T>>(path)
		: {};
	const existed = key in obj;
	obj[key] = value;
	await writeJson(path, obj);
	return existed ? "updated" : "created";
}

async function mergeReadings(
	path: string,
	route: Route,
	net: Network,
): Promise<number> {
	const obj: Record<string, Reading> = existsSync(path)
		? await readJson<Record<string, Reading>>(path)
		: {};
	let added = 0;
	for (const s of route.stations) {
		const reading = net.stationReadings[s.ja];
		if (!reading || (!reading.hira && !reading.kata)) continue;
		if (!(s.ja in obj)) added++;
		obj[s.ja] = reading;
	}
	await writeJson(path, obj);
	return added;
}

// ── Reorder prompt (arrow keys, no typing) ───────────────────────────────────

/**
 * A "grab" reorder list. ↑/↓ move the cursor; space picks up the row under it;
 * while held, ↑/↓ carry it through the list; space drops it; enter confirms.
 * Only arrows + space are used, so it behaves the same across terminals.
 */
const reorderStations = createPrompt<
	string[],
	{ message: string; items: string[]; label: (name: string) => string }
>((config, done) => {
	const [status, setStatus] = useState<"idle" | "done">("idle");
	const [items, setItems] = useState<string[]>(config.items);
	const [cursor, setCursor] = useState(0);
	const [held, setHeld] = useState(false);
	const prefix = usePrefix({ status });

	useKeypress((key) => {
		if (isEnterKey(key)) {
			if (held) {
				setHeld(false);
				return;
			}
			setStatus("done");
			done(items);
			return;
		}
		if (isSpaceKey(key)) {
			setHeld(!held);
			return;
		}
		if (isUpKey(key) || isDownKey(key)) {
			const dir = isUpKey(key) ? -1 : 1;
			const next = cursor + dir;
			if (next < 0 || next >= items.length) return;
			if (held) {
				const reordered = items.slice();
				[reordered[cursor], reordered[next]] = [
					reordered[next],
					reordered[cursor],
				];
				setItems(reordered);
			}
			setCursor(next);
		}
	});

	if (status === "done")
		return `${prefix} ${config.message} ${items.map(config.label).join(" → ")}`;

	const pageSize = 12;
	const start = Math.max(
		0,
		Math.min(cursor - (pageSize >> 1), Math.max(0, items.length - pageSize)),
	);
	const view = items
		.slice(start, start + pageSize)
		.map((name, i) => {
			const idx = start + i;
			const here = idx === cursor;
			const pointer = here ? (held ? "✥" : "❯") : " ";
			return `  ${pointer} ${String(idx + 1).padStart(2)}. ${config.label(name)}`;
		})
		.join("\n");
	const hint = held
		? "↑/↓ carry · space drop · enter done"
		: "↑/↓ move · space grab to reorder · enter confirm";
	return `${prefix} ${config.message}\n${view}\n  ${hint}`;
});

// ── Typed input: new line / new station (build mode) ─────────────────────────

async function inputNewLine(net: Network): Promise<string> {
	const ans = await inquirer.prompt<{
		id: string;
		name: string;
		en: string;
		jaReading: string;
		code: string;
		color: string;
	}>([
		{
			type: "input",
			name: "id",
			message: "New line id (short key, e.g. NR):",
			validate: (v: string) =>
				!v.trim()
					? "required"
					: net.lines.some((l) => l.id === v.trim())
						? `line ${v.trim()} already exists`
						: true,
		},
		{ type: "input", name: "name", message: "Line name (Japanese):" },
		{ type: "input", name: "en", message: "Line name (English, optional):" },
		{ type: "input", name: "jaReading", message: "Line reading (かな, optional):" },
		{
			type: "input",
			name: "code",
			message: "Roundel code (1 letter):",
			default: (a: { id: string }) => (a.id?.trim()?.[0] ?? "").toUpperCase(),
		},
		{ type: "input", name: "color", message: "Colour (#hex):", default: "#888888" },
	]);
	const id = ans.id.trim();
	net.lines.push({
		id,
		code: ans.code.trim(),
		name: ans.name.trim(),
		en: ans.en.trim() || undefined,
		jaReading: ans.jaReading.trim() || undefined,
		color: ans.color.trim(),
		textOnColor: "#fff",
	});
	return id;
}

async function inputNewStation(net: Network): Promise<string | null> {
	const { ja, en, hira, kata } = await inquirer.prompt<{
		ja: string;
		en: string;
		hira: string;
		kata: string;
	}>([
		{ type: "input", name: "ja", message: "  New station (Japanese):" },
		{ type: "input", name: "en", message: "  English (optional):" },
		{ type: "input", name: "hira", message: "  Reading ひらがな (optional):" },
		{ type: "input", name: "kata", message: "  Reading カタカナ (optional):" },
	]);
	const name = ja.trim();
	if (!name) return null;
	if (!net.stations.includes(name)) net.stations.push(name);
	if (en.trim()) net.stationsEn[name] = en.trim();
	if (hira.trim() || kata.trim())
		net.stationReadings[name] = { hira: hira.trim(), kata: kata.trim() };
	return name;
}

// ── Mode 1: build / rebuild a line ───────────────────────────────────────────

async function buildLineInteractive(net: Network, out: string, yes: boolean) {
	const NEW_LINE = "__new_line__";
	const { pick } = await inquirer.prompt<{ pick: string }>([
		{
			type: "select",
			name: "pick",
			message: "Line to build:",
			choices: [
				...net.lines.map((l) => ({
					name: `${l.id}  ${l.name}${l.en ? ` (${l.en})` : ""} — ${(net.lineStations[l.id] ?? []).length} stops`,
					value: l.id,
				})),
				{ name: "＋ input a new line (not in data)…", value: NEW_LINE },
			],
		},
	]);

	const id = pick === NEW_LINE ? await inputNewLine(net) : pick;
	const seedOrder = pick === NEW_LINE ? [] : (net.lineStations[id] ?? []);

	const label = (ja: string) => {
		const en = net.stationsEn[ja];
		return en ? `${ja} (${en})` : ja;
	};
	const chosen = await chooseStations(net, seedOrder, label);

	const ordered = [
		...seedOrder.filter((s) => chosen.includes(s)),
		...chosen.filter((s) => !seedOrder.includes(s)),
	];
	const stationNames = await reorderStations({
		message: "Arrange the stops:",
		items: ordered,
		label,
	});

	const { circular } = await inquirer.prompt<{ circular: boolean }>([
		{
			type: "confirm",
			name: "circular",
			message: "Circular line (loops back to the first stop)?",
			default: net.lineCircular[id] ?? false,
		},
	]);

	const { line, route } = buildRoute(id, stationNames, net, undefined, circular);
	await finish(line, route, net, out, false, yes);
}

/**
 * Multi-select the stops on the line. The list opens with a "＋ input new
 * station" row — pick it to type a stop the pool doesn't have; it is added
 * (checked) to the top and the list reopens so more can be chosen.
 */
async function chooseStations(
	net: Network,
	seedOrder: string[],
	label: (ja: string) => string,
): Promise<string[]> {
	const ADD = "__add_station__";
	const selected = new Set<string>(seedOrder);
	const fresh: string[] = [];

	for (;;) {
		const order = [...fresh, ...net.stations.filter((ja) => !fresh.includes(ja))];
		const chosen = await searchableCheckbox({
			message: "Pick the stations (search by name or reading):",
			choices: [
				{ name: "＋ input new station…", value: ADD },
				...order.map((ja) => ({
					name: label(ja),
					value: ja,
					searchTerms: [
						ja,
						net.stationsEn[ja] ?? "",
						net.stationReadings[ja]?.hira ?? "",
						net.stationReadings[ja]?.kata ?? "",
						net.preset,
						...Object.entries(net.lineStations)
							.filter(([, stations]) => stations.includes(ja))
							.map(([lineId]) => lineId),
					],
					checked: selected.has(ja),
				})),
			],
			pageSize: 16,
		});
		if (!chosen.includes(ADD) && chosen.length < 2) {
			console.log("Pick at least 2 stations.");
			continue;
		}

		selected.clear();
		for (const v of chosen) if (v !== ADD) selected.add(v);

		if (!chosen.includes(ADD)) return chosen.filter((v) => v !== ADD);

		const added = await inputNewStation(net);
		if (added) {
			if (!fresh.includes(added)) fresh.unshift(added);
			selected.add(added);
		}
	}
}

async function finish(
	line: LineMeta,
	route: Route,
	net: Network,
	out: string,
	dryRun: boolean,
	yes: boolean,
) {
	const noEn = route.stations.filter((s) => !s.en).map((s) => s.ja);
	console.log(
		`\n${line.id}  ${line.ja}${line.en ? ` · ${line.en}` : ""}${line.jaReading ? `  【${line.jaReading}】` : ""}`,
	);
	console.log(`  colour ${line.color}  code ${line.code}${route.circular ? "  ○ circular" : ""}`);
	console.log(`  ${route.stations.length} stops → ${route.destJa}`);
	for (const s of route.stations) {
		const reading = net.stationReadings[s.ja]?.hira;
		console.log(
			`    ${s.side}  ${s.ja}${s.en ? ` (${s.en})` : ""}${reading ? ` ${reading}` : ""}${s.xf.length ? `  ⇄ ${s.xf.join(" ")}` : ""}`,
		);
	}
	if (noEn.length)
		console.log(`  note: no English on ${noEn.length} stop(s): ${noEn.join("、")}`);

	if (dryRun) {
		console.log("\n--dry-run: nothing written.");
		console.log(`\nlines.json entry:\n${JSON.stringify(line, null, TAB)}`);
		console.log(`\nroutes.json entry:\n${JSON.stringify(route, null, TAB)}`);
		return;
	}

	if (
		!(await confirmWrite(
			`Write ${line.id} into ${out}/{lines,routes,station-readings}.json?`,
			yes,
		))
	)
		return;

	const a = await mergeIntoFile(join(out, "lines.json"), line.id, line);
	const b = await mergeIntoFile(join(out, "routes.json"), route.line, route);
	const added = await mergeReadings(join(out, "station-readings.json"), route, net);
	console.log(`\nlines.json           ${a}`);
	console.log(`routes.json          ${b}`);
	console.log(`station-readings.json ${added} new reading(s)`);
	console.log(`\nDone. ${line.id} is now drivable in "${net.preset}".`);
}

// ── Mode 2: edit station distances ───────────────────────────────────────────

async function editDistances(raw: RawFiles, yes: boolean) {
	const ids = Object.keys(raw.routes);
	if (ids.length === 0) return console.log("No routes to edit.");
	const { id } = await inquirer.prompt<{ id: string }>([
		{
			type: "select",
			name: "id",
			message: "Edit distances on which line?",
			choices: ids.map((i) => ({
				name: `${i}  ${raw.lines[i]?.ja ?? ""} — ${raw.routes[i].stations.length} stops`,
				value: i,
			})),
		},
	]);
	const route = raw.routes[id];
	const DONE = -1;
	let touched = false;

	for (;;) {
		const { idx } = await inquirer.prompt<{ idx: number }>([
			{
				type: "select",
				name: "idx",
				message: "Pick a stop to set the distance recorded before it:",
				choices: [
					...route.stations.map((s, i) => ({
						name: `${String(i + 1).padStart(2)}. ${s.ja}   (${s.distance ?? 1})`,
						value: i,
					})),
					{ name: touched ? "✓ save & finish" : "✓ done", value: DONE },
				],
			},
		]);
		if (idx === DONE) break;
		const s = route.stations[idx];
		const { dist } = await inquirer.prompt<{ dist: string }>([
			{
				type: "input",
				name: "dist",
				message: `Distance before ${s.ja}:`,
				default: String(s.distance ?? 1),
				validate: (v: string) =>
					Number.isFinite(Number(v)) && Number(v) > 0
						? true
						: "enter a positive number",
			},
		]);
		s.distance = Number(dist);
		touched = true;
	}

	if (!touched) return console.log("No changes.");
	if (!(await confirmWrite(`Write distances into ${raw.routesPath}?`, yes))) return;
	await writeJson(raw.routesPath, raw.routes);
	console.log(`Saved distances for ${id}.`);
}

// ── Mode 3: edit a line (name / reading / colour) ────────────────────────────

async function editLineMeta(raw: RawFiles, yes: boolean) {
	const ids = Object.keys(raw.lines);
	if (ids.length === 0) return console.log("No lines to edit.");
	const { id } = await inquirer.prompt<{ id: string }>([
		{
			type: "select",
			name: "id",
			message: "Edit which line?",
			choices: ids.map((i) => ({
				name: `${i}  ${raw.lines[i].ja}${raw.lines[i].en ? ` (${raw.lines[i].en})` : ""}`,
				value: i,
			})),
		},
	]);
	const m = raw.lines[id];
	const ans = await inquirer.prompt<{
		ja: string;
		en: string;
		jaReading: string;
		code: string;
		color: string;
	}>([
		{ type: "input", name: "ja", message: "Name (Japanese):", default: m.ja },
		{ type: "input", name: "en", message: "Name (English):", default: m.en ?? "" },
		{
			type: "input",
			name: "jaReading",
			message: "Reading (かな):",
			default: m.jaReading ?? "",
		},
		{ type: "input", name: "code", message: "Roundel code:", default: m.code ?? "" },
		{ type: "input", name: "color", message: "Colour (#hex):", default: m.color },
	]);

	m.ja = ans.ja.trim() || m.ja;
	m.en = ans.en.trim() || undefined;
	m.jaReading = ans.jaReading.trim() || undefined;
	m.code = ans.code.trim() || m.code;
	m.color = ans.color.trim() || m.color;

	// Circular is a route property, so toggle it there when the line has a route.
	const route = raw.routes[id];
	let routeChanged = false;
	if (route) {
		const { circular } = await inquirer.prompt<{ circular: boolean }>([
			{
				type: "confirm",
				name: "circular",
				message: "Circular line (loops back to the first stop)?",
				default: !!route.circular,
			},
		]);
		if (!!route.circular !== circular) {
			if (circular) route.circular = true;
			else delete route.circular;
			routeChanged = true;
		}
	}

	console.log(
		`\n${id}  ${m.ja}${m.en ? ` · ${m.en}` : ""}${m.jaReading ? `  【${m.jaReading}】` : ""}  ${m.color}${route?.circular ? "  ○ circular" : ""}`,
	);
	const target = routeChanged
		? `${raw.linesPath} and ${raw.routesPath}`
		: raw.linesPath;
	if (!(await confirmWrite(`Write ${id} into ${target}?`, yes))) return;
	await writeJson(raw.linesPath, raw.lines);
	if (routeChanged) await writeJson(raw.routesPath, raw.routes);
	console.log(`Saved ${id}.`);
}

// ── Mode 4: edit a station (name / reading / English / door side) ────────────

async function editStation(raw: RawFiles, yes: boolean) {
	const names = new Set<string>(Object.keys(raw.readings));
	for (const route of Object.values(raw.routes))
		for (const s of route.stations) names.add(s.ja);
	if (names.size === 0) return console.log("No stations to edit.");

	const { ja } = await inquirer.prompt<{ ja: string }>([
		{
			type: "select",
			name: "ja",
			message: "Edit which station?",
			choices: [...names].sort().map((n) => ({
				name: `${n}${raw.readings[n]?.hira ? `  ${raw.readings[n].hira}` : ""}`,
				value: n,
			})),
		},
	]);

	let currentEn = "";
	for (const route of Object.values(raw.routes))
		for (const s of route.stations)
			if (s.ja === ja && s.en) currentEn = s.en;
	const reading = raw.readings[ja] ?? { hira: "", kata: "" };

	const ans = await inquirer.prompt<{
		ja: string;
		en: string;
		hira: string;
		kata: string;
	}>([
		{ type: "input", name: "ja", message: "Name (Japanese):", default: ja },
		{ type: "input", name: "en", message: "English:", default: currentEn },
		{ type: "input", name: "hira", message: "Reading ひらがな:", default: reading.hira },
		{ type: "input", name: "kata", message: "Reading カタカナ:", default: reading.kata },
	]);

	const newJa = ans.ja.trim() || ja;
	const renamed = newJa !== ja;
	const en = ans.en.trim();
	const newReading = { hira: ans.hira.trim(), kata: ans.kata.trim() };
	const routeStops = Object.entries(raw.routes).flatMap(([lineId, route]) =>
		route.stations.flatMap((station, index) =>
			station.ja === ja ? [{ lineId, index, station }] : [],
		),
	);
	let doorSideChange = "";
	if (routeStops.length) {
		const NO_CHANGE = "__no_door_side_change__";
		const { stopKey } = await inquirer.prompt<{ stopKey: string }>([
			{
				type: "select",
				name: "stopKey",
				message: "Change door side for which route stop?",
				choices: [
					{ name: "No door-side change", value: NO_CHANGE },
					...routeStops.map(({ lineId, index, station }) => ({
						name: `${lineId} · stop ${String(index + 1).padStart(2, "0")} · ${station.ja} · doors ${station.side === "L" ? "left" : "right"}`,
						value: `${lineId}:${index}`,
					})),
				],
			},
		]);
		if (stopKey !== NO_CHANGE) {
			const [lineId, indexText] = stopKey.split(":");
			const station = raw.routes[lineId]?.stations[Number(indexText)];
			if (station) {
				const { side } = await inquirer.prompt<{ side: "L" | "R" }>([
					{
						type: "select",
						name: "side",
						message: `Doors open on which side at ${lineId} · ${station.ja}?`,
						choices: [
							{ name: "Left", value: "L" },
							{ name: "Right", value: "R" },
						],
						default: station.side ?? "R",
					},
				]);
				station.side = side;
				doorSideChange = `  ·  ${lineId} stop ${Number(indexText) + 1} doors ${side === "L" ? "left" : "right"}`;
			}
		}
	}

	// Propagate a rename + English change through every route that stops here.
	let routeHits = 0;
	for (const route of Object.values(raw.routes)) {
		for (const s of route.stations) {
			if (s.ja !== ja) continue;
			s.ja = newJa;
			if (en) s.en = en;
			routeHits++;
		}
		if (route.destJa === ja) route.destJa = newJa;
	}
	if (renamed) delete raw.readings[ja];
	if (newReading.hira || newReading.kata) raw.readings[newJa] = newReading;

	console.log(
		`\n${ja}${renamed ? ` → ${newJa}` : ""}${en ? ` (${en})` : ""}${newReading.hira ? `  ${newReading.hira}` : ""}  ·  ${routeHits} route stop(s)${doorSideChange}`,
	);
	if (!(await confirmWrite(`Write ${raw.routesPath} and ${raw.readingsPath}?`, yes)))
		return;
	await writeJson(raw.routesPath, raw.routes);
	await writeJson(raw.readingsPath, raw.readings);
	console.log(`Saved ${newJa}.`);
}

// ── Mode 5: clean up unused lines & stations ─────────────────────────────────

async function cleanupUnused(raw: RawFiles, yes: boolean) {
	const usedStations = new Set<string>();
	const referencedLines = new Set<string>();
	for (const route of Object.values(raw.routes))
		for (const s of route.stations) {
			usedStations.add(s.ja);
			for (const x of s.xf ?? []) referencedLines.add(x);
		}

	// A line is unused when nothing routes it and no stop interchanges to it.
	const unusedLines = Object.keys(raw.lines).filter(
		(id) => !raw.routes[id] && !referencedLines.has(id),
	);
	const unusedStations = Object.keys(raw.readings).filter(
		(ja) => !usedStations.has(ja),
	);

	if (unusedLines.length === 0 && unusedStations.length === 0)
		return console.log("Nothing unused — everything is referenced.");

	if (unusedLines.length)
		console.log(
			`Unused lines (${unusedLines.length}): ${unusedLines
				.map((id) => `${id} ${raw.lines[id].ja}`)
				.join(", ")}`,
		);
	if (unusedStations.length)
		console.log(
			`Unused stations (${unusedStations.length}): ${unusedStations.join("、")}`,
		);

	if (!(await confirmWrite("Delete these from lib/data?", yes))) return;

	for (const id of unusedLines) delete raw.lines[id];
	for (const ja of unusedStations) delete raw.readings[ja];
	if (unusedLines.length) await writeJson(raw.linesPath, raw.lines);
	if (unusedStations.length) await writeJson(raw.readingsPath, raw.readings);
	console.log(
		`Removed ${unusedLines.length} line(s) and ${unusedStations.length} station(s).`,
	);
}

// ── Menu ─────────────────────────────────────────────────────────────────────

async function runMenu(
	preset: string,
	sourcePath: string,
	out: string,
	yes: boolean,
) {
	const { action } = await inquirer.prompt<{ action: string }>([
		{
			type: "select",
			name: "action",
			message: `Edit "${preset}" — what would you like to do?`,
			choices: [
				{ name: "Build / rebuild a line", value: "build" },
				{ name: "Edit station distances", value: "distances" },
				{ name: "Edit a line (name / reading / colour)", value: "line" },
				{
					name: "Edit a station (name / reading / English / door side)",
					value: "station",
				},
				{ name: "Clean up unused lines & stations", value: "clean" },
			],
		},
	]);

	if (action === "build") {
		const net = await loadNetwork(preset, sourcePath);
		await buildLineInteractive(net, out, yes);
		return;
	}
	const raw = await loadRaw(out);
	if (action === "distances") await editDistances(raw, yes);
	else if (action === "line") await editLineMeta(raw, yes);
	else if (action === "station") await editStation(raw, yes);
	else if (action === "clean") await cleanupUnused(raw, yes);
}

// ── Entry ────────────────────────────────────────────────────────────────────

async function main() {
	const { values } = parseArgs({
		options: {
			id: { type: "string" },
			name: { type: "string" },
			en: { type: "string" },
			code: { type: "string" },
			color: { type: "string" },
			stations: { type: "string" },
			"from-line": { type: "string" },
			dest: { type: "string" },
			circular: { type: "boolean", default: false },
			clean: { type: "boolean", default: false },
			preset: { type: "string" },
			source: { type: "string" },
			out: { type: "string" },
			"dry-run": { type: "boolean", default: false },
			yes: { type: "boolean", default: false },
		},
	});

	const fromLine = values["from-line"];
	const hasBuildInput = fromLine || values.id || values.stations;
	// Keep command-line builds predictable; interactive editing starts by asking
	// which installed preset the user wants to change.
	const preset =
		values.preset ??
		(!hasBuildInput && !values.clean && !values.out
			? await pickPreset()
			: "shuika");
	const sourcePath = resolve(
		projectRoot,
		values.source ?? `scripts/data/${preset}.json`,
	);
	const out = resolve(projectRoot, values.out ?? join("lib/data", preset));
	const yes = values.yes ?? false;

	if (values.clean) {
		await cleanupUnused(await loadRaw(out), yes);
		return;
	}

	if (!hasBuildInput) {
		await runMenu(preset, sourcePath, out, yes);
		return;
	}

	// Non-interactive build.
	const net = await loadNetwork(preset, sourcePath);
	let id = values.id;
	let stationNames: string[] = values.stations
		? splitStations(values.stations)
		: [];

	if (fromLine) {
		const meta = net.lines.find((l) => l.id === fromLine);
		if (!meta) throw new Error(`No line "${fromLine}" in ${preset} data.`);
		id ??= meta.id;
		if (stationNames.length === 0) stationNames = net.lineStations[fromLine] ?? [];
	}

	if (!id) throw new Error("Missing --id (or --from-line).");
	if (stationNames.length < 2)
		throw new Error("Need at least 2 stations (--stations or --from-line).");

	const existing = net.lines.find((l) => l.id === id);
	const merged: NetLine = {
		id,
		code: values.code ?? existing?.code ?? id[0],
		name: values.name ?? existing?.name ?? id,
		en: values.en ?? existing?.en,
		jaReading: existing?.jaReading,
		color: values.color ?? existing?.color ?? "#888888",
		textOnColor: existing?.textOnColor ?? "#fff",
	};
	net.lines = [...net.lines.filter((l) => l.id !== id), merged];

	const circular = values.circular || net.lineCircular[id] || false;
	const { line, route } = buildRoute(id, stationNames, net, values.dest, circular);
	await finish(line, route, net, out, values["dry-run"] ?? false, yes);
}

main().catch((err) => {
	console.error(`\nError: ${err instanceof Error ? err.message : err}`);
	process.exit(1);
});
