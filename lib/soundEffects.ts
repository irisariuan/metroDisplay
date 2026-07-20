/**
 * Non-speech clips: chimes, beeps and door sounds. Unlike station melodies
 * these are shared across the whole network, so they are keyed by id alone.
 */
export interface SoundEffect {
	id: string;
	label: string;
	/** Shown in the control surface so the operator knows what will play. */
	description: string;
	/** Sent to the sound-generation model by scripts/generate-sound-effects. */
	prompt: string;
	durationSeconds: number;
}

export const SOUND_EFFECTS: SoundEffect[] = [
	{
		id: "door-open",
		label: "DOOR OPEN",
		description: "Soft two-note chime as the doors slide open.",
		prompt:
			"A soft, clean two-note electronic chime marking train doors opening. Bright bell-like tone, no speech, no ambience, no reverb tail.",
		durationSeconds: 2,
	},
	{
		id: "door-close",
		label: "DOOR CLOSE",
		description: "Repeating warning chime before the doors close.",
		prompt:
			"A repeating urgent electronic warning chime used before subway train doors close. Steady even pulses, no speech, no ambience.",
		durationSeconds: 3,
	},
	{
		id: "attention-chime",
		label: "ATTENTION",
		description: "Two-tone chime that precedes an onboard announcement.",
		prompt:
			"A calm descending two-tone public address chime announcing that a message follows. Clean synthesised bell, no speech, no ambience.",
		durationSeconds: 2,
	},
	{
		id: "boarding-beep",
		label: "BOARDING",
		description: "Locator beep at the doorway while boarding is open.",
		prompt:
			"A short melody placed at a train doorway to guide boarding passengers. Steady bell-like tone, no speech, no ambience.",
		durationSeconds: 3,
	},
];

/** Queue key for a shared, non-speech effect clip. */
export const soundEffectKey = (id: string) => `effect.${id}`;

export const DOOR_OPEN_EFFECT_KEY = soundEffectKey("door-open");
