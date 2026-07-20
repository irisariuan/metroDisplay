#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import inquirer from "inquirer";
import { MARQUEE_CONTENT_PRESETS } from "../lib/constants";
import { LINES, ROUTES } from "../lib/metro-data";
import { ANNOUNCEMENT_FRAMEWORK_OPTIONS } from "../lib/announcementAudio";
import type { Station } from "../types/metro";

type Lang = "ja" | "en";
type Provider = "replicate" | "elevenlabs";
interface Clip {
	key: string;
	text: string;
	speechText: string;
	lang: Lang;
	category: string;
}
interface ManifestClip extends Clip {
	url: string;
	provider: Provider;
}
interface Manifest {
	version: 3;
	generatedAt: string;
	clips: Record<string, ManifestClip>;
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const clipsRoot = join(projectRoot, "public/audio/announcements/clips");
const manifestPath = join(projectRoot, "public/audio/manifest.json");

function collectClips(): Clip[] {
	const clips: Clip[] = ANNOUNCEMENT_FRAMEWORK_OPTIONS.map((clip) => ({
		key: clip.key,
		text: clip.text,
		speechText: clip.speechText ?? clip.text,
		lang: clip.lang,
		category: "framework",
	}));
	const stations = new Map<string, Station>();
	for (const route of Object.values(ROUTES))
		for (const station of route.stations) stations.set(station.ja, station);
	for (const station of stations.values()) {
		clips.push(
			{
				key: `station.ja.${station.ja}`,
				text: station.ja,
				speechText: station.kata || station.hira || station.ja,
				lang: "ja",
				category: "station",
			},
			{
				key: `station.en.${station.ja}`,
				text: station.en,
				speechText: station.en,
				lang: "en",
				category: "station",
			},
		);
	}
	for (const [lineId, line] of Object.entries(LINES)) {
		clips.push(
			{
				key: `line.ja.${lineId}`,
				text: line.ja,
				speechText: line.jaReading ?? line.ja,
				lang: "ja",
				category: "line",
			},
			{
				key: `line.en.${lineId}`,
				text: line.en,
				speechText: line.enReading ?? line.en,
				lang: "en",
				category: "line",
			},
		);
	}
	for (const preset of MARQUEE_CONTENT_PRESETS) {
		preset.items.forEach((item, index) => {
			clips.push(
				{
					key: `content.${preset.id}.ja.${index}`,
					text: `${preset.label} · ${item.ja ?? ""}`,
					speechText: item.jaReading ?? item.ja ?? "",
					lang: "ja",
					category: "content",
				},
				{
					key: `content.${preset.id}.en.${index}`,
					text: `${preset.label} · ${item.en}`,
					speechText: item.enReading ?? item.en,
					lang: "en",
					category: "content",
				},
			);
		});
	}
	return clips.filter((clip) => clip.speechText.trim());
}

interface GenerateSettings {
	speed: number;
	volume: number;
}

async function requestAudio(
	clip: Clip,
	selectedProvider: Provider,
	setting?: Partial<GenerateSettings>,
): Promise<Buffer> {
	if (selectedProvider === "elevenlabs") {
		const token = process.env.ELEVEN_API_TOKEN;
		const voiceId =
			clip.lang === "ja"
				? process.env.ELEVEN_JA_VOICE_ID
				: process.env.ELEVEN_EN_VOICE_ID;
		if (!token || !voiceId)
			throw new Error(
				"ELEVEN_API_TOKEN and ELEVEN_JA_VOICE_ID / ELEVEN_EN_VOICE_ID are required",
			);
		const response = await fetch(
			`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
			{
				method: "POST",
				headers: {
					"xi-api-key": token,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: clip.speechText,
					model_id: "eleven_multilingual_v2",
					language_code: clip.lang,
					voice_settings: {
						speed: setting.speed ?? 0.9,
						similarity_boost: 0.8,
					},
				}),
			},
		);
		if (!response.ok)
			throw new Error(
				`ElevenLabs returned ${response.status}: ${await response.text()}`,
			);
		return Buffer.from(await response.arrayBuffer());
	}
	const token = process.env.REPLICATE_API_TOKEN;
	const voiceId =
		clip.lang === "ja" ? process.env.JA_VOICE_ID : process.env.EN_VOICE_ID;
	if (!token || !voiceId)
		throw new Error(
			"REPLICATE_API_TOKEN and JA_VOICE_ID / EN_VOICE_ID are required",
		);
	const response = await fetch(
		"https://api.replicate.com/v1/models/minimax/speech-2.8-turbo/predictions",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				Prefer: "wait",
			},
			body: JSON.stringify({
				input: {
					text: clip.speechText,
					voice_id: voiceId,
					language_boost: clip.lang === "ja" ? "Japanese" : "English",
					english_normalization: clip.lang === "en",
					speed: setting.speed ?? 0.9,
				},
			}),
		},
	);
	const prediction = await response.json();
	if (!response.ok)
		throw new Error(
			prediction.detail ?? `Replicate returned ${response.status}`,
		);
	const url =
		typeof prediction.output === "string"
			? prediction.output
			: Array.isArray(prediction.output)
				? prediction.output[0]
				: prediction.output?.url;
	if (!url) throw new Error("Replicate did not return an audio URL");
	const audio = await fetch(url);
	if (!audio.ok) throw new Error(`Audio download returned ${audio.status}`);
	return Buffer.from(await audio.arrayBuffer());
}

async function exists(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const allClips = collectClips();
	const stations = new Map<string, Station>();
	for (const route of Object.values(ROUTES))
		for (const station of route.stations) stations.set(station.ja, station);
	const stationChoices = (lang: Lang) =>
		[...stations.values()].map((station) => ({
			name: lang === "ja" ? station.ja : station.en,
			value: `station.${lang}.${station.ja}`,
			checked: true,
		}));
	const clipChoices = (category: Clip["category"], lang: Lang) =>
		allClips
			.filter((clip) => clip.category === category && clip.lang === lang)
			.map((clip) => ({
				name: clip.text,
				value: clip.key,
				checked: true,
			}));
	const { provider, selectedStationJa, selectedStationEn, selectedFrameworkJa, selectedFrameworkEn, selectedLinesJa, selectedLinesEn, selectedContentJa, selectedContentEn, onlyMissing, speed: speedInput } =
		await inquirer.prompt<{
			provider: Provider;
			selectedStationJa: string[];
			selectedStationEn: string[];
			selectedFrameworkJa: string[];
			selectedFrameworkEn: string[];
			selectedLinesJa: string[];
			selectedLinesEn: string[];
			selectedContentJa: string[];
			selectedContentEn: string[];
			onlyMissing: boolean;
			speed: string;
		}>([
			{
				type: "select",
				name: "provider",
				message:
					"Which provider should generate missing announcement clips?",
				choices: [
					{ name: "ElevenLabs", value: "elevenlabs" },
					{ name: "Replicate · MiniMax Speech", value: "replicate" },
				],
			},
			{
				type: "checkbox",
				name: "selectedStationJa",
				message: "Choose Japanese station-name clips:",
				choices: stationChoices("ja"),
				pageSize: 16,
			},
			{
				type: "checkbox",
				name: "selectedStationEn",
				message: "Choose English station-name clips:",
				choices: stationChoices("en"),
				pageSize: 16,
			},
			{
				type: "checkbox",
				name: "selectedFrameworkJa",
				message: "Choose Japanese framework phrases:",
				choices: clipChoices("framework", "ja"),
				pageSize: 16,
			},
			{
				type: "checkbox",
				name: "selectedFrameworkEn",
				message: "Choose English framework phrases:",
				choices: clipChoices("framework", "en"),
				pageSize: 16,
			},
			{
				type: "checkbox",
				name: "selectedLinesJa",
				message: "Choose Japanese line-name clips:",
				choices: clipChoices("line", "ja"),
				pageSize: 16,
			},
			{
				type: "checkbox",
				name: "selectedLinesEn",
				message: "Choose English line-name clips:",
				choices: clipChoices("line", "en"),
				pageSize: 16,
			},
			{
				type: "checkbox",
				name: "selectedContentJa",
				message: "Choose Japanese lower-marquee clips:",
				choices: clipChoices("content", "ja"),
				pageSize: 16,
			},
			{
				type: "checkbox",
				name: "selectedContentEn",
				message: "Choose English lower-marquee clips:",
				choices: clipChoices("content", "en"),
				pageSize: 16,
			},
			{
				type: "confirm",
				name: "onlyMissing",
				message:
					"Generate only missing clips with the selected provider?",
				default: true,
			},
			{
				type: "input",
				name: "speed",
				message:
					"Enter the speed for audio generation (default is 0.9):",
				default: "0.9",
				validate: (input) => {
					const value = parseFloat(input);
					if (isNaN(value) || value <= 0) {
						return "Please enter a valid positive number.";
					}
					return true;
				},
				transformer: (input) => parseFloat(input),
			},
		]);
	const speed = Number(speedInput);

	await mkdir(clipsRoot, { recursive: true });
	let manifest: Manifest = {
		version: 3,
		generatedAt: new Date().toISOString(),
		clips: {},
	};
	try {
		const existing = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest = {
			...manifest,
			...existing,
			version: 3,
			clips: existing.clips ?? {},
		};
	} catch {
		/* first run */
	}
	const selectedClipKeys = new Set([
		...selectedStationJa,
		...selectedStationEn,
		...selectedFrameworkJa,
		...selectedFrameworkEn,
		...selectedLinesJa,
		...selectedLinesEn,
		...selectedContentJa,
		...selectedContentEn,
	]);
	const clips = allClips.filter((clip) => selectedClipKeys.has(clip.key));
	let generated = 0;
	for (const clip of clips) {
		const existing = manifest.clips[clip.key];
		const existingFile = existing?.url
			? join(projectRoot, "public", existing.url)
			: "";
		if (
			onlyMissing &&
			existing &&
			existingFile &&
			(await exists(existingFile))
		) {
			console.log(`cached ${clip.key}`);
			continue;
		}
		console.log(`generating ${clip.key} with ${provider}`);
		const hash = createHash("sha256")
			.update(`${provider}\0${clip.key}\0${clip.speechText}`)
			.digest("hex")
			.slice(0, 16);
		const filename = `${hash}.mp3`;
		await writeFile(
			join(clipsRoot, filename),
			await requestAudio(clip, provider, { speed }),
		);
		manifest.clips[clip.key] = {
			...clip,
			provider,
			url: `/audio/announcements/clips/${filename}`,
		};
		manifest.generatedAt = new Date().toISOString();
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		generated += 1;
	}
	console.log(
		`${generated} missing announcement clip(s) generated with ${provider}.`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
