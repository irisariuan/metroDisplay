import type { Lang, LineId, Phase, Route, Station } from "@/types/metro";
import { DOOR_OPEN_EFFECT_KEY, SOUND_EFFECTS } from "@/lib/soundEffects";

export interface AnnouncementFrameworkOption {
	key: string;
	label: string;
	text: string;
	speechText?: string;
	lang: Lang;
}

export interface StationNumberAudioPart {
	key: string;
	label: string;
	text: string;
	speechText: string;
	lang: Lang;
}

const EN_NUMBER_WORDS: Record<number, string> = {
	0: "zero",
	1: "one",
	2: "two",
	3: "three",
	4: "four",
	5: "five",
	6: "six",
	7: "seven",
	8: "eight",
	9: "nine",
	10: "ten",
	11: "eleven",
	12: "twelve",
	13: "thirteen",
	14: "fourteen",
	15: "fifteen",
	16: "sixteen",
	17: "seventeen",
	18: "eighteen",
	19: "nineteen",
	20: "twenty",
	30: "thirty",
	40: "forty",
	50: "fifty",
	60: "sixty",
	70: "seventy",
	80: "eighty",
	90: "ninety",
};

const JA_NUMBER_WORDS: Record<number, string> = {
	0: "ゼロ",
	1: "いち",
	2: "に",
	3: "さん",
	4: "よん",
	5: "ご",
	6: "ろく",
	7: "なな",
	8: "はち",
	9: "きゅう",
	10: "じゅう",
	11: "じゅういち",
	12: "じゅうに",
	13: "じゅうさん",
	14: "じゅうよん",
	15: "じゅうご",
	16: "じゅうろく",
	17: "じゅうなな",
	18: "じゅうはち",
	19: "じゅうきゅう",
	20: "にじゅう",
	30: "さんじゅう",
	40: "よんじゅう",
	50: "ごじゅう",
	60: "ろくじゅう",
	70: "ななじゅう",
	80: "はちじゅう",
	90: "きゅうじゅう",
};

const JA_ROUTE_LETTER_WORDS: Record<string, string> = {
	A: "エー",
	B: "ビー",
	C: "シー",
	D: "ディー",
	E: "イー",
	F: "エフ",
	G: "ジー",
	H: "エイチ",
	I: "アイ",
	J: "ジェー",
	K: "ケー",
	L: "エル",
	M: "エム",
	N: "エヌ",
	O: "オー",
	P: "ピー",
	Q: "キュー",
	R: "アール",
	S: "エス",
	T: "ティー",
	U: "ユー",
	V: "ブイ",
	W: "ダブリュー",
	X: "エックス",
	Y: "ワイ",
	Z: "ゼット",
};

const NUMBER_PART_VALUES = Object.keys(EN_NUMBER_WORDS).map(Number);

/**
 * Reusable numeric recordings. A station code such as CS21 is assembled from
 * one route recording (CS) + twenty + one instead of requiring a bespoke CS21
 * recording or separate recordings for C and S.
 */
export const STATION_NUMBER_AUDIO_PARTS: StationNumberAudioPart[] = (
	["ja", "en"] as const
).flatMap((lang) => [
	...NUMBER_PART_VALUES.map((value) => ({
		key: `station-number.${lang}.number.${value}`,
		label: `${lang.toUpperCase()} · NUMBER ${value}`,
		text: String(value),
		speechText:
			lang === "ja" ? JA_NUMBER_WORDS[value] : EN_NUMBER_WORDS[value],
		lang,
	})),
]);

/** One generated route-code reading replaces separate per-letter recordings. */
export function stationRouteAudioPart(
	lineId: LineId,
	lang: Lang,
): StationNumberAudioPart {
	const characters = lineId.toUpperCase().split("");
	return {
		key: `station-number.${lang}.route.${lineId}`,
		label: `${lang.toUpperCase()} · ROUTE ${lineId}`,
		text: lineId,
		speechText:
			lang === "ja"
				? characters
						.map(
							(character) =>
								JA_ROUTE_LETTER_WORDS[character] ?? character,
						)
						.join(" ")
				: characters.join(" "),
		lang,
	};
}

export const ANNOUNCEMENT_FRAMEWORK_OPTIONS: AnnouncementFrameworkOption[] = [
	{
		key: "framework.ja.approach",
		label: "JA · まもなく、",
		text: "まもなく、",
		lang: "ja",
	},
	{
		key: "framework.ja.nextStation",
		label: "JA · つぎは、",
		text: "つぎは、",
		lang: "ja",
	},
	{
		key: "framework.en.nextStation",
		label: "EN · The next stop is",
		text: "The next stop is",
		lang: "en",
	},
	{
		key: "framework.ja.stationEnd",
		label: "JA · に到着いたします。",
		text: "に到着いたします。",
		lang: "ja",
	},
	{
		key: "framework.ja.desu",
		label: "JA · です。",
		text: "です。",
		lang: "ja",
	},
	{
		key: "framework.ja.doorsLeft",
		label: "JA · 左側のドア",
		text: "左側のドアが開きます。",
		lang: "ja",
	},
	{
		key: "framework.ja.doorsRight",
		label: "JA · 右側のドア",
		text: "右側のドアが開きます。",
		lang: "ja",
	},
	{
		key: "framework.ja.terminal",
		label: "JA · 終点",
		text: "この電車の終点です。ご乗車ありがとうございました。",
		lang: "ja",
	},
	{
		key: "framework.ja.transferEnd",
		label: "JA · お乗り換え",
		text: "はお乗り換えです。",
		speechText: "わ お乗り換えです。",
		lang: "ja",
	},
	{
		key: "framework.ja.passingEnd",
		label: "JA · 通過",
		text: "には停まりません。ご注意ください。",
		speechText: "にわ停まりません。ご注意ください。",
		lang: "ja",
	},
	{
		key: "framework.en.approach",
		label: "EN · We will soon arrive at",
		text: "We will soon arrive at",
		lang: "en",
	},
	{
		key: "framework.en.thisIs",
		label: "EN · This is",
		text: "This is",
		lang: "en",
	},
	{
		key: "framework.en.doorsLeft",
		label: "EN · left doors",
		text: "The doors on the left side will open.",
		lang: "en",
	},
	{
		key: "framework.en.doorsRight",
		label: "EN · right doors",
		text: "The doors on the right side will open.",
		lang: "en",
	},
	{
		key: "framework.en.terminal",
		label: "EN · last stop",
		text: "This is the last stop on this train. Thank you for riding.",
		lang: "en",
	},
	{
		key: "framework.en.transferStart",
		label: "EN · Transfer here for",
		text: "Transfer here for the",
		lang: "en",
	},
	{
		key: "framework.en.passingEnd",
		label: "EN · does not stop",
		text: "is not a stop on this train. Please be careful.",
		lang: "en",
	},
	{
		key: "framework.en.start",
		label: "EN · Start of announcement",
		text: "This is a",
		lang: "en",
	},
	{
		key: "framework.en.boundFor",
		label: "EN · bound for",
		text: "train bound for",
		lang: "en",
	},
	{
		key: "framework.ja.start",
		label: "JA · この電車は",
		text: "この電車は",
		lang: "ja",
	},
	{
		key: "framework.ja.boundFor",
		label: "JA · 方面ゆき",
		text: "方面ゆきです。",
		lang: "ja",
	},
	{
		key: "framework.ja.yuki",
		label: "JA · ゆきです",
		text: "ゆきです",
		lang: "ja",
	},
	{
		key: "framework.ja.homen",
		label: "JA · 方面",
		text: "方面",
		lang: "ja",
	},
	{
		key: "framework.ja.service.local",
		label: "JA · 各駅停車",
		text: "各駅停車",
		lang: "ja",
	},
	{
		key: "framework.ja.service.semiExpress",
		label: "JA · 準急",
		text: "準急",
		lang: "ja",
	},
	{
		key: "framework.ja.service.express",
		label: "JA · 急行",
		text: "急行",
		lang: "ja",
	},
	{
		key: "framework.ja.service.superExpress",
		label: "JA · 特急",
		text: "特急",
		lang: "ja",
	},
	{
		key: "framework.ja.service.rapid",
		label: "JA · 快速",
		text: "快速",
		lang: "ja",
	},
	{
		key: "framework.en.service.local",
		label: "EN · Local",
		text: "Local",
		lang: "en",
	},
	{
		key: "framework.en.callingAt",
		label: "EN · Calling at",
		text: "Calling at",
		lang: "en",
	},
	{
		key: "framework.en.majorAnd",
		label: "EN · and",
		text: "and",
		lang: "en",
	},
	{
		key: "framework.en.service.semiExpress",
		label: "EN · Semi-Express",
		text: "Semi-Express",
		lang: "en",
	},
	{
		key: "framework.en.service.express",
		label: "EN · Express",
		text: "Express",
		lang: "en",
	},
	{
		key: "framework.en.service.superExpress",
		label: "EN · Super-Express",
		text: "Super-Express",
		lang: "en",
	},
	{
		key: "framework.en.service.rapid",
		label: "EN · Rapid",
		text: "Rapid",
		lang: "en",
	},
	{
		key: "framework.ja.foot",
		label: "JA · 足元にご注意ください",
		text: "足元にご注意ください。",
		lang: "ja",
	},
	{
		key: "framework.en.foot",
		label: "EN · Please watch your step",
		text: "Please watch your step.",
		lang: "en",
	},
	{
		key: "framework.ja.startThanks",
		label: "JA · ご乗車ありがとうございます",
		text: "本日も、ごじょうしゃくださいまして、まことにありがとうございます。",
		lang: "ja",
	},
	{
		key: "framework.en.startThanks",
		label: "EN · Thank you for riding",
		text: "Thank you for riding with us today.",
		lang: "en",
	},
];

export const stationAudioKey = (station: Station, lang: Lang) =>
	`station.${lang}.${station.ja}`;

export const lineAudioKey = (lineId: LineId, lang: Lang) =>
	`line.${lang}.${lineId}`;

export const contentAudioKey = (presetId: string, index: number, lang: Lang) =>
	`content.${presetId}.${lang}.${index}`;

export const stationNumberLabel = (route: Route, stationIndex: number) =>
	`${route.line}${String(stationIndex + 1).padStart(2, "0")}`;

function stationNumberValues(stationIndex: number): number[] {
	const value = stationIndex + 1;
	// if (value < 10) return [0, value];
	if (value <= 19) return [value];
	if (value < 100) {
		const tens = Math.floor(value / 10) * 10;
		const ones = value % 10;
		return ones ? [tens, ones] : [tens];
	}
	// Unusually long custom routes remain pronounceable without adding a
	// recording for every possible number.
	return String(value).split("").map(Number);
}

/** Build the reusable clips that pronounce a station code such as CS01. */
export function stationNumberAudioSequence(
	route: Route,
	stationIndex: number,
	lang: Lang,
): string[] {
	return [
		stationRouteAudioPart(route.line, lang).key,
		...stationNumberValues(stationIndex).map(
			(value) => `station-number.${lang}.number.${value}`,
		),
	];
}

/** Queue key and URL for an optional per-station departure melody. */
export const departureToneKey = (station: Station) =>
	`tone.departure.${station.ja}`;

/** Human-readable name for a queue key, for display in the control surface. */
export function audioKeyLabel(key: string): string {
	const framework = ANNOUNCEMENT_FRAMEWORK_OPTIONS.find(
		(option) => option.key === key,
	);
	if (framework) return framework.label;

	const [kind, qualifier, ...rest] = key.split(".");
	const value = rest.join(".");
	if (kind === "effect") {
		const effect = SOUND_EFFECTS.find((option) => option.id === qualifier);
		return effect ? `SFX · ${effect.label}` : `SFX · ${qualifier}`;
	}
	if (kind === "tone") return `TONE · ${value}`;
	if (kind === "content") {
		const [language = "", index = ""] = rest;
		return `${qualifier.toUpperCase()} · ${language.toUpperCase()} · MSG ${Number(index) + 1}`;
	}
	if (kind === "station-number") {
		const [partKind = "", part = ""] = rest;
		return `${qualifier.toUpperCase()} · ${partKind.toUpperCase()} ${part}`;
	}
	if (value) return `${qualifier.toUpperCase()} · ${value}`;
	return key;
}

interface AnnouncementAudioSequenceOptions {
	route: Route;
	pos: number;
	phase: Phase;
	lang: Lang;
	passing: boolean;
	terminalIndex: number;
	/** Append the door-open chime after the spoken door side, on arrival only. */
	doorEffect?: boolean;
	/** Speak the line code and ordinal after the station name. */
	includeStationNumber?: boolean;
}

interface TrainStartAnnouncementAudioSequenceOptions {
	route: Route;
	lang: Lang;
	terminalIndex: number;
	serviceJa: string;
	serviceEn: string;
	majorStations?: readonly Station[];
}

const SERVICE_AUDIO_KEYS: Record<Lang, Record<string, string>> = {
	ja: {
		各駅停車: "framework.ja.service.local",
		準急: "framework.ja.service.semiExpress",
		急行: "framework.ja.service.express",
		特急: "framework.ja.service.superExpress",
		快速: "framework.ja.service.rapid",
	},
	en: {
		Local: "framework.en.service.local",
		"Semi-Express": "framework.en.service.semiExpress",
		Express: "framework.en.service.express",
		"Super-Express": "framework.en.service.superExpress",
		Rapid: "framework.en.service.rapid",
	},
};

/** Build the composable clips for the departure announcement of a new run. */
export function trainStartAnnouncementAudioSequence({
	route,
	lang,
	terminalIndex,
	serviceJa,
	serviceEn,
	majorStations = [],
}: TrainStartAnnouncementAudioSequenceOptions): string[] {
	const serviceAudioKey =
		SERVICE_AUDIO_KEYS[lang][lang === "ja" ? serviceJa : serviceEn];
	if (route.circular) {
		// Loop lines have no terminus, so they are announced by the major stops
		// ahead as the direction of travel — Japanese as …方面ゆきです。, English as
		// "…bound for A, B and C." No majors → nothing to announce.
		if (!majorStations.length) return [];
		if (lang === "ja") {
			return [
				"framework.ja.startThanks",
				"framework.ja.start",
				lineAudioKey(route.line, "ja"),
				...(serviceAudioKey ? [serviceAudioKey] : []),
				...majorStations.map((station) =>
					stationAudioKey(station, "ja"),
				),
				"framework.ja.boundFor",
			];
		}
		const sequence = [
			"framework.en.startThanks",
			"framework.en.start",
			lineAudioKey(route.line, "en"),
			...(serviceAudioKey ? [serviceAudioKey] : []),
			"framework.en.boundFor",
		];
		majorStations.forEach((station, index) => {
			if (index === majorStations.length - 1 && index > 0)
				sequence.push("framework.en.majorAnd");
			sequence.push(stationAudioKey(station, "en"));
		});
		return sequence;
	}
	const destination = route.stations[terminalIndex];
	// Mirror announcement.ts: natural Japanese names the direction first — the
	// major stops ahead as …方面 — then the terminus last as …ゆきです。 Drop the
	// terminus from that direction list so it is never named twice.
	const viaStations = majorStations.filter(
		(station) => station.ja !== destination.ja,
	);
	const sequence =
		lang === "ja"
			? [
					"framework.ja.startThanks",
					"framework.ja.start",
					lineAudioKey(route.line, "ja"),
					...(serviceAudioKey ? [serviceAudioKey] : []),
					...viaStations.map((station) =>
						stationAudioKey(station, "ja"),
					),
					...(viaStations.length ? ["framework.ja.homen"] : []),
					stationAudioKey(destination, "ja"),
					"framework.ja.yuki"
				]
			: [
					"framework.en.startThanks",
					"framework.en.start",
					lineAudioKey(route.line, "en"),
					...(serviceAudioKey ? [serviceAudioKey] : []),
					"framework.en.boundFor",
					stationAudioKey(destination, "en"),
				];
	if (!majorStations.length || lang === "ja")
		return sequence;
	sequence.push("framework.en.callingAt");
	majorStations.forEach((station, index) => {
		if (index === majorStations.length - 1 && index > 0)
			sequence.push("framework.en.majorAnd");
		sequence.push(stationAudioKey(station, "en"));
	});
	return sequence;
}

/**
 * "Next stop is …" — spoken on departing any station, naming the station the
 * train is now heading to. Distinct from the arrival announcement (まもなく…).
 */
export function departureNextStationAudioSequence(
	route: Route,
	nextIndex: number,
	lang: Lang,
	includeStationNumber = false,
): string[] {
	const station = route.stations[nextIndex];
	if (!station) return [];
	const key = stationAudioKey(station, lang);
	const numberSequence = includeStationNumber
		? stationNumberAudioSequence(route, nextIndex, lang)
		: [];
	return lang === "ja"
		? ["framework.ja.nextStation", key, ...numberSequence, "framework.ja.desu"]
		: ["framework.en.nextStation", key, ...numberSequence];
}

/** Build a clip sequence matching the text assembled in announcement.ts. */
export function announcementAudioSequence({
	route,
	pos,
	phase,
	lang,
	passing,
	terminalIndex,
	doorEffect = false,
	includeStationNumber = false,
}: AnnouncementAudioSequenceOptions): string[] {
	const station = route.stations[pos];
	const stationKey = stationAudioKey(station, lang);
	const stationNumberSequence = includeStationNumber
		? stationNumberAudioSequence(route, pos, lang)
		: [];
	const sequence: string[] = [];
	// The doors are physically opening, so the chime follows the spoken side
	// once per arrival — the caller suppresses it on the second language.
	const doorsClip = (side: string) =>
		doorEffect && phase === "at" ? [side, DOOR_OPEN_EFFECT_KEY] : [side];

	if (passing && phase === "approach") {
		return [stationKey, `framework.${lang}.passingEnd`];
	}

	if (lang === "ja") {
		if (phase === "approach") sequence.push("framework.ja.approach");
		sequence.push(
			stationKey,
			stationKey,
			...stationNumberSequence,
			phase === "approach"
				? "framework.ja.stationEnd"
				: "framework.ja.desu",
		);
		// if (phase === "approach")
		sequence.push(
			...doorsClip(
				station.side === "L"
					? "framework.ja.doorsLeft"
					: "framework.ja.doorsRight",
			),
		);
		if (phase === "at") {
			sequence.push("framework.ja.foot");
			if (!route.circular && pos === terminalIndex)
				sequence.push("framework.ja.terminal");
		}
		if (station.xf?.length)
			sequence.push(
				...station.xf.map((lineId) => lineAudioKey(lineId, "ja")),
				"framework.ja.transferEnd",
			);
		return sequence;
	}

	sequence.push(
		phase === "approach" ? "framework.en.approach" : "framework.en.thisIs",
		stationKey,
		...stationNumberSequence,
	);
	// if (phase === "approach")
	sequence.push(
		...doorsClip(
			station.side === "L"
				? "framework.en.doorsLeft"
				: "framework.en.doorsRight",
		),
	);
	if (phase === "at") {
		sequence.push("framework.en.foot");
		if (!route.circular && pos === terminalIndex)
			sequence.push("framework.en.terminal");
	}
	if (station.xf?.length)
		sequence.push(
			"framework.en.transferStart",
			...station.xf.map((lineId) => lineAudioKey(lineId, "en")),
		);
	return sequence;
}
