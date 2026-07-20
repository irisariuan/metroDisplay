#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import inquirer from "inquirer";
import { SOUND_EFFECTS, soundEffectKey } from "../lib/soundEffects";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const effectsRoot = join(projectRoot, "public/audio/effects");
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

// The prompt is hashed too, so editing an effect's wording yields a new file
// instead of silently reusing the previously generated sound.
const effectFilename = (id: string, prompt: string) =>
	`${id}-${createHash("sha256").update(prompt).digest("hex").slice(0, 16)}.mp3`;

async function main() {
	await mkdir(effectsRoot, { recursive: true });
	let manifest: {
		version: number;
		generatedAt: string;
		clips: Record<string, Record<string, unknown>>;
	} = { version: 3, generatedAt: new Date().toISOString(), clips: {} };
	try {
		const existing = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest = { ...manifest, ...existing, clips: existing.clips ?? {} };
	} catch {
		// The first generation run creates the shared audio manifest.
	}

	const manifestEntry = (effect: (typeof SOUND_EFFECTS)[number]) => ({
		key: soundEffectKey(effect.id),
		url: `/audio/effects/${effectFilename(effect.id, effect.prompt)}`,
		category: "sound-effect",
		description: effect.description,
		provider: "elevenlabs",
	});

	// Adopt any clips already on disk so the manifest matches reality first.
	let adopted = false;
	for (const effect of SOUND_EFFECTS) {
		const output = join(effectsRoot, effectFilename(effect.id, effect.prompt));
		if (!(await exists(output))) continue;
		manifest.clips[soundEffectKey(effect.id)] = manifestEntry(effect);
		adopted = true;
	}
	if (adopted) {
		manifest.generatedAt = new Date().toISOString();
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	}

	const { selectedEffects, onlyMissing } = await inquirer.prompt<{
		selectedEffects: string[];
		onlyMissing: boolean;
	}>([
		{
			type: "checkbox",
			name: "selectedEffects",
			message: "Choose sound effects to generate:",
			choices: SOUND_EFFECTS.map((effect) => ({
				name: `${effect.label} · ${effect.description}`,
				value: effect.id,
				checked: true,
			})),
			pageSize: 16,
		},
		{
			type: "confirm",
			name: "onlyMissing",
			message: "Generate only missing sound effects with ElevenLabs?",
			default: true,
		},
	]);
	if (!selectedEffects.length) {
		console.log("No effects selected; nothing to generate.");
		return;
	}
	if (!token) throw new Error("ELEVEN_API_TOKEN is missing from .env");

	let generated = 0;
	for (const effect of SOUND_EFFECTS) {
		if (!selectedEffects.includes(effect.id)) continue;
		const filename = effectFilename(effect.id, effect.prompt);
		const output = join(effectsRoot, filename);
		if (onlyMissing && (await exists(output))) {
			manifest.clips[soundEffectKey(effect.id)] = manifestEntry(effect);
			console.log(`cached ${effect.id}`);
			continue;
		}
		console.log(`generating ${effect.id}`);
		const response = await fetch(
			"https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
			{
				method: "POST",
				headers: {
					"xi-api-key": token,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: effect.prompt,
					model_id: "eleven_text_to_sound_v2",
					duration_seconds: effect.durationSeconds,
					prompt_influence: 0.75,
				}),
			},
		);
		if (!response.ok)
			throw new Error(
				`ElevenLabs returned ${response.status} for ${effect.id}: ${await response.text()}`,
			);
		await writeFile(output, Buffer.from(await response.arrayBuffer()));
		manifest.clips[soundEffectKey(effect.id)] = manifestEntry(effect);
		generated += 1;
	}
	manifest.generatedAt = new Date().toISOString();
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	console.log(`${generated} sound effect(s) generated in public/audio/effects.`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
