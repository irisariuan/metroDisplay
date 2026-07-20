#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import inquirer from "inquirer";
import { ROUTES } from "../lib/metro-data";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tonesRoot = join(projectRoot, "public/audio/tones");
const manifestPath = join(projectRoot, "public/audio/manifest.json");
const token = process.env.ELEVEN_API_TOKEN;

async function exists(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

const toneFilename = (stationName: string) =>
	`departure-${createHash("sha256").update(stationName).digest("hex").slice(0, 16)}.mp3`;

async function main() {
	const stations = new Map<string, string>();
	for (const route of Object.values(ROUTES))
		for (const station of route.stations)
			stations.set(station.ja, station.en);
	const stationChoices = [...stations.entries()].map(([ja, en]) => ({
		name: `${ja} · ${en}`,
		value: ja,
		checked: true,
	}));
	await mkdir(tonesRoot, { recursive: true });
	let manifest: {
		version: number;
		generatedAt: string;
		clips: Record<string, Record<string, unknown>>;
	} = { version: 3, generatedAt: new Date().toISOString(), clips: {} };
	try {
		const existing = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest = { ...manifest, ...existing, clips: existing.clips ?? {} };
	} catch {
		// The first tone generation creates the shared audio manifest.
	}
	let migrated = false;
	for (const [ja] of stations) {
		const legacyOutput = join(tonesRoot, `${encodeURIComponent(ja)}.mp3`);
		const output = join(tonesRoot, toneFilename(ja));
		if (!(await exists(output)) && (await exists(legacyOutput))) {
			await rename(legacyOutput, output);
			migrated = true;
		}
		if (await exists(output)) {
			manifest.clips[`tone.departure.${ja}`] = {
				key: `tone.departure.${ja}`,
				url: `/audio/tones/${toneFilename(ja)}`,
				category: "departure-tone",
				provider: "elevenlabs",
			};
			migrated = true;
		}
	}
	if (migrated) {
		manifest.generatedAt = new Date().toISOString();
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	}
	const { durationSeconds, selectedStations, onlyMissing } =
		await inquirer.prompt<{
			durationSeconds: number;
			selectedStations: string[];
			onlyMissing: boolean;
		}>([
			{
				type: "number",
				name: "durationSeconds",
				message: "How long should each departure melody be?",
				default: 4,
			},
			{
				type: "checkbox",
				name: "selectedStations",
				message: "Choose stations for departure melodies:",
				choices: stationChoices,
				pageSize: 16,
			},
			{
				type: "confirm",
				name: "onlyMissing",
				message:
					"Generate only missing departure melodies with ElevenLabs?",
				default: true,
			},
		]);
	if (!selectedStations.length) {
		console.log("No stations selected; nothing to generate.");
		return;
	}
	if (!token) throw new Error("ELEVEN_API_TOKEN is missing from .env");
	let generated = 0;
	for (const [ja, en] of stations) {
		if (!selectedStations.includes(ja)) continue;
		const filename = toneFilename(ja);
		const output = join(tonesRoot, filename);
		const key = `tone.departure.${ja}`;
		if (onlyMissing && (await exists(output))) {
			manifest.clips[key] = {
				key,
				url: `/audio/tones/${filename}`,
				category: "departure-tone",
				provider: "elevenlabs",
			};
			console.log(`cached ${ja}`);
			continue;
		}
		console.log(`generating departure melody for ${ja}`);
		const response = await fetch(
			"https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
			{
				method: "POST",
				headers: {
					"xi-api-key": token,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: `A unique, short Japanese railway station departure melody for ${ja} (${en}). Clear bright electronic chime, single instrument, exactly one melodic phrase, no speech, no ambience.`,
					model_id: "eleven_text_to_sound_v2",
					duration_seconds: durationSeconds,
					prompt_influence: 0.75,
				}),
			},
		);
		if (!response.ok)
			throw new Error(
				`ElevenLabs returned ${response.status} for ${ja}: ${await response.text()}`,
			);
		await writeFile(output, Buffer.from(await response.arrayBuffer()));
		manifest.clips[key] = {
			key,
			url: `/audio/tones/${filename}`,
			category: "departure-tone",
			provider: "elevenlabs",
		};
		generated += 1;
	}
	manifest.generatedAt = new Date().toISOString();
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	console.log(
		`${generated} missing departure melody/melodies generated in public/audio/tones.`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
