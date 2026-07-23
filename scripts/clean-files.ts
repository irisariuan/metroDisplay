#!/usr/bin/env bun

/**
 * Audio housekeeping. "Tracked" means the clip is listed in the shared audio
 * manifest; the generators write files and manifest entries together, so a file
 * on disk with no entry is a leftover from an earlier prompt or a renamed key.
 *
 *   1. Clean up untracked audio — delete files the manifest does not reference.
 *   2. Delete tracked audio     — pick clips to remove from both disk and manifest.
 */

import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import inquirer from "inquirer";
import { ROUTES, SIMULATOR_PRESETS } from "../lib/metro-data";
import { searchableCheckbox } from "./lib/searchable-checkbox";

const projectRoot = process.cwd();
const audioRoot = join(projectRoot, "public/audio");
const manifestPath = join(audioRoot, "manifest.json");

interface ManifestClip {
	url: string;
	category?: string;
	[key: string]: unknown;
}
interface Manifest {
	clips: Record<string, ManifestClip>;
	[key: string]: unknown;
}

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a"];

/**
 * Which preset a clip belongs to. Station and line clips trace back through the
 * preset data; framework, content and effect clips are shared by every preset.
 */
const SHARED_TAG = "SHARED";

const stationPresets = new Map<string, string>();
const linePresets = new Map<string, string>();
const presetSearchTerms = new Map<string, string[]>();
for (const preset of SIMULATOR_PRESETS) {
	const tag = preset.id.toUpperCase();
	for (const lineId of preset.lineIds) {
		const terms = [preset.id, preset.label];
		linePresets.set(lineId, tag);
		presetSearchTerms.set(lineId, terms);
		for (const station of ROUTES[lineId]?.stations ?? []) {
			stationPresets.set(station.ja, tag);
			presetSearchTerms.set(station.ja, [
				...terms,
				station.en,
				station.hira,
				station.kata,
			]);
		}
	}
}

function presetTag(key: string): string {
	const [kind, , ...rest] = key.split(".");
	const value = rest.join(".");
	if (kind === "station") return stationPresets.get(value) ?? SHARED_TAG;
	// tone.departure.<station>
	if (kind === "tone") return stationPresets.get(value) ?? SHARED_TAG;
	if (kind === "line") return linePresets.get(value) ?? SHARED_TAG;
	return SHARED_TAG;
}

function readManifest(): Manifest {
	try {
		const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
		return { ...parsed, clips: parsed.clips ?? {} };
	} catch {
		throw new Error(`No readable audio manifest at ${manifestPath}`);
	}
}

function writeManifest(manifest: Manifest) {
	manifest.generatedAt = new Date().toISOString();
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Every audio file under public/audio, as absolute paths. */
function audioFiles(dir: string = audioRoot): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (entry.startsWith(".")) continue;
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) found.push(...audioFiles(path));
		else if (AUDIO_EXTENSIONS.some((ext) => entry.endsWith(ext))) found.push(path);
	}
	return found;
}

/** A manifest url (/audio/tones/x.mp3) as an absolute path on disk. */
const urlToPath = (url: string) => join(projectRoot, "public", url.replace(/^\//, ""));

const show = (path: string) => relative(projectRoot, path);

function humanSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function remove(paths: string[]) {
	let deleted = 0;
	for (const path of paths) {
		try {
			unlinkSync(path);
			console.log(`deleted ${show(path)}`);
			deleted += 1;
		} catch (error) {
			console.error(
				`could not delete ${show(path)}:`,
				error instanceof Error ? error.message : error,
			);
		}
	}
	return deleted;
}

/** 1. Delete every audio file the manifest does not reference. */
async function cleanUntracked() {
	const manifest = readManifest();
	const tracked = new Set(
		Object.values(manifest.clips).map((clip) => urlToPath(clip.url)),
	);
	const untracked = audioFiles().filter((path) => !tracked.has(path));

	if (!untracked.length) {
		console.log("No untracked audio — every file on disk is in the manifest.");
		return;
	}

	const totalBytes = untracked.reduce((sum, p) => sum + statSync(p).size, 0);
	console.log(`\n${untracked.length} untracked file(s), ${humanSize(totalBytes)}:`);
	for (const path of untracked) console.log(`  ${show(path)}`);

	const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
		{
			type: "confirm",
			name: "confirmed",
			message: `Delete these ${untracked.length} untracked file(s)?`,
			default: false,
		},
	]);
	if (!confirmed) {
		console.log("Nothing deleted.");
		return;
	}
	console.log(`\n${remove(untracked)} file(s) deleted.`);
}

/** 2. Pick tracked clips and drop them from both disk and manifest. */
async function deleteTracked() {
	const manifest = readManifest();
	const keys = Object.keys(manifest.clips).sort();
	if (!keys.length) {
		console.log("The manifest lists no clips.");
		return;
	}

	const entries = keys.map((key) => {
		const clip = manifest.clips[key];
		let detail = "missing from disk";
		try {
			detail = humanSize(statSync(urlToPath(clip.url)).size);
		} catch {
			// Entry survives in the manifest after its file was removed by hand.
		}
		const tag = presetTag(key);
		return {
			key,
			tag,
			name: `[${tag}] ${key}${clip.category ? ` · ${clip.category}` : ""} (${detail})`,
			searchTerms: [
				tag,
				key,
				clip.category ?? "",
				clip.url,
				...(presetSearchTerms.get(key.split(".").at(-1) ?? "") ?? []),
			],
		};
	});

	const tags = [...new Set(entries.map((entry) => entry.tag))];
	const tally = tags
		.map((tag) => [tag, entries.filter((entry) => entry.tag === tag).length])
		.filter(([, count]) => count)
		.map(([tag, count]) => `${tag} ${count}`)
		.join(", ");
	console.log(`\n${entries.length} tracked clip(s): ${tally}`);

	const selectedKeys = await searchableCheckbox({
		message: "Choose tracked clips to delete:",
		choices: entries.map((entry) => ({
			name: entry.name,
			value: entry.key,
			searchTerms: entry.searchTerms,
		})),
		pageSize: 20,
	});
	if (!selectedKeys.length) {
		console.log("Nothing deleted.");
		return;
	}

	const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
		{
			type: "confirm",
			name: "confirmed",
			message: `Delete ${selectedKeys.length} clip(s) and their manifest entries?`,
			default: false,
		},
	]);
	if (!confirmed) {
		console.log("Nothing deleted.");
		return;
	}

	// Two keys can share a url; only unlink one no longer referenced by any
	// surviving entry, or deleting one clip would break its twin.
	const removing = new Set(selectedKeys);
	const stillUsed = new Set(
		Object.entries(manifest.clips)
			.filter(([key]) => !removing.has(key))
			.map(([, clip]) => clip.url),
	);
	const paths = [
		...new Set(
			selectedKeys
				.map((key) => manifest.clips[key].url)
				.filter((url) => !stillUsed.has(url))
				.map(urlToPath),
		),
	];

	const deleted = remove(paths);
	for (const key of selectedKeys) delete manifest.clips[key];
	writeManifest(manifest);
	console.log(
		`\n${deleted} file(s) deleted, ${selectedKeys.length} manifest entry/entries removed.`,
	);
}

async function main() {
	const { mode } = await inquirer.prompt<{ mode: string }>([
		{
			type: "select",
			name: "mode",
			message: "What would you like to clean?",
			choices: [
				{
					name: "Clean up untracked audio (files missing from the manifest)",
					value: "untracked",
				},
				{
					name: "Delete tracked audio (choose clips to remove)",
					value: "tracked",
				},
			],
		},
	]);
	if (mode === "untracked") await cleanUntracked();
	else await deleteTracked();
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
