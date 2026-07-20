import soundEffectData from "@/lib/data/sound-effects.json";

/** Non-speech clips: chimes, beeps and door sounds. */
export interface SoundEffect {
	id: string;
	label: string;
	description: string;
	/** Sent to the sound-generation model by the sound-effects script. */
	prompt: string;
	durationSeconds: number;
}

export interface SoundEffectPreset {
	id: string;
	label: string;
	effectIds: string[];
}

export const SOUND_EFFECTS = soundEffectData.effects as SoundEffect[];
export const SOUND_EFFECT_PRESETS =
	soundEffectData.presets as SoundEffectPreset[];
export const DEFAULT_SOUND_EFFECT_PRESET_ID = soundEffectData.defaultPresetId;

const knownEffectIds = new Set(SOUND_EFFECTS.map((effect) => effect.id));
for (const preset of SOUND_EFFECT_PRESETS) {
	for (const effectId of preset.effectIds) {
		if (!knownEffectIds.has(effectId))
			throw new Error(
				`Sound-effect preset ${preset.id} references unknown effect ${effectId}`,
			);
	}
}

/** Queue key for a shared, non-speech effect clip. */
export const soundEffectKey = (id: string) => `effect.${id}`;

export const DOOR_OPEN_EFFECT_KEY = soundEffectKey("door-open");
