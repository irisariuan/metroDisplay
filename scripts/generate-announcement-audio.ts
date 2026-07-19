#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { DEFAULT_MARQUEE_CONTENT } from "../lib/constants";
import { LINES, ROUTES } from "../lib/metro-data";
import { Station } from "@/types/metro";
import { ANNOUNCEMENT_FRAMEWORK_OPTIONS } from "@/lib/announcementAudio";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(projectRoot, "public/audio/announcements");
const clipsRoot = join(outputRoot, "clips");
const manifestPath = join(outputRoot, "manifest.json");
const voiceIds = { ja: process.env.JA_VOICE_ID, en: process.env.EN_VOICE_ID };
const languageBoosts = { ja: "Japanese", en: "English" };
const concurrency = 4;
const predictionIntervalMs = 1100;
let requestGate = Promise.resolve();
let nextRequestAt = 0;

async function waitForPredictionSlot() {
	const previous = requestGate;
	let release: (value: void | PromiseLike<void>) => void;
	requestGate = new Promise((resolve) => {
		release = resolve;
	});
	await previous;
	const waitMs = Math.max(0, nextRequestAt - Date.now());
	if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
	nextRequestAt = Date.now() + predictionIntervalMs;
	release();
}

function collectClips() {
	const clips = ANNOUNCEMENT_FRAMEWORK_OPTIONS.map((v) => ({
		key: v.key,
		text: v.text,
		speechText: v.speechText ?? v.text,
		lang: v.lang,
		category: "framework",
	}));

	const stations = new Map<string, Station>();
	for (const route of Object.values(ROUTES)) {
		for (const station of route.stations) stations.set(station.ja, station);
	}
	for (const station of stations.values()) {
		clips.push({
			key: `station.ja.${station.ja}`,
			text: station.ja,
			speechText: station.kata || station.hira || station.ja,
			lang: "ja",
			category: "station",
		});
		clips.push({
			key: `station.en.${station.ja}`,
			text: station.en,
			speechText: station.en,
			lang: "en",
			category: "station",
		});
	}

	for (const [lineId, line] of Object.entries(LINES)) {
		clips.push({
			key: `line.ja.${lineId}`,
			text: line.ja,
			speechText: line.jaReading ?? line.ja,
			lang: "ja",
			category: "line",
		});
		clips.push({
			key: `line.en.${lineId}`,
			text: line.en,
			speechText: line.enReading ?? line.en,
			lang: "en",
			category: "line",
		});
	}

	DEFAULT_MARQUEE_CONTENT.forEach((item, contentIndex) => {
		clips.push({
			key: `content.en.${contentIndex}`,
			text: item.en,
			speechText: item.enReading ?? item.en,
			lang: "en",
			category: "content",
		});
		clips.push({
			key: `content.ja.${contentIndex}`,
			text: item.ja,
			speechText: item.jaReading ?? item.ja,
			lang: "ja",
			category: "content",
		});
	});
	return clips;
}

async function requestAudio(
	clip: { speechText: any; lang: string },
	token: string,
) {
	let lastError;
	for (let attempt = 1; attempt <= 8; attempt += 1) {
		try {
			await waitForPredictionSlot();
			console.log(
				`[API] Requesting audio for ${clip.speechText} (attempt ${attempt}, lang ${clip.lang})`,
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
							voice_id: voiceIds[clip.lang],
							language_boost: languageBoosts[clip.lang],
							english_normalization: clip.lang === "en",
						},
					}),
				},
			);
			const prediction = await response.json();
			if (!response.ok)
				throw new Error(
					prediction.detail ??
						prediction.error ??
						`Replicate returned ${response.status}`,
				);
			const output = prediction.output;
			const url =
				typeof output === "string"
					? output
					: Array.isArray(output)
						? output[0]
						: output?.url;
			if (!url) throw new Error("Replicate did not return an audio URL");
			const audioResponse = await fetch(url);
			if (!audioResponse.ok)
				throw new Error(
					`Audio download returned ${audioResponse.status}`,
				);
			return Buffer.from(await audioResponse.arrayBuffer());
		} catch (error) {
			lastError = error;
			if (attempt < 8) {
				const throttled =
					error instanceof Error &&
					/throttled|rate limit/i.test(error.message);
				await new Promise((resolve) =>
					setTimeout(resolve, throttled ? 6500 : attempt * 1500),
				);
			}
		}
	}
	throw lastError;
}

async function main() {
	const token = process.env.REPLICATE_API_TOKEN;
	if (!token) throw new Error("REPLICATE_API_TOKEN is missing from .env");
	await mkdir(clipsRoot, { recursive: true });
	const clips = collectClips();
	let manifest = {
		version: 2,
		voices: voiceIds,
		languageBoosts,
		generatedAt: new Date().toISOString(),
		clips: {},
	};
	try {
		const existing = JSON.parse(await readFile(manifestPath, "utf8"));
		if (
			existing.version === 2 &&
			existing.voices?.ja === voiceIds.ja &&
			existing.voices?.en === voiceIds.en
		)
			manifest = existing;
	} catch {
		// The first run creates the manifest.
	}

	let completed = 0;
	async function generate(clip) {
		const voiceId = voiceIds[clip.lang];
		const languageBoost = languageBoosts[clip.lang];
		const hash = createHash("sha256")
			.update(
				`${voiceId}\0${languageBoost}\0${clip.key}\0${clip.speechText}`,
			)
			.digest("hex")
			.slice(0, 16);
		const filename = `${hash}.mp3`;
		const existing = manifest.clips[clip.key];
		if (existing?.hash === hash) {
			completed += 1;
			console.log(`[${completed}/${clips.length}] cached ${clip.key}`);
			return;
		}
		const audio = await requestAudio(clip, token);
		await writeFile(join(clipsRoot, filename), audio);
		manifest.clips[clip.key] = {
			url: `/audio/announcements/clips/${filename}`,
			text: clip.text,
			speechText: clip.speechText,
			lang: clip.lang,
			category: clip.category,
			voiceId,
			languageBoost,
			hash,
		};
		manifest.generatedAt = new Date().toISOString();
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		completed += 1;
		console.log(`[${completed}/${clips.length}] generated ${clip.key}`);
	}

	let cursor = 0;
	async function worker() {
		while (cursor < clips.length) {
			const clip = clips[cursor];
			cursor += 1;
			await generate(clip);
		}
	}
	await Promise.all(Array.from({ length: concurrency }, () => worker()));

	const activeFiles = new Set(
		Object.values(manifest.clips as Record<string, { url: string }>).map(
			(clip) => clip.url.split("/").at(-1),
		),
	);
	for (const filename of await readdir(clipsRoot)) {
		if (filename.endsWith(".mp3") && !activeFiles.has(filename))
			await unlink(join(clipsRoot, filename));
	}
	console.log(
		`Generated ${clips.length} clips with JA ${voiceIds.ja} and EN ${voiceIds.en}.`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
