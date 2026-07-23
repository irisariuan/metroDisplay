"use client";

import React from "react";
import {
	announcement,
	departureNextStationAnnouncement,
	trainStartAnnouncement,
	upcomingMajorStations,
} from "@/lib/announcement";
import {
	announcementAudioSequence,
	departureNextStationAudioSequence,
	departureToneKey,
	trainStartAnnouncementAudioSequence,
} from "@/lib/announcementAudio";
import type { Lang, LineId, Route } from "@/types/metro";
import type {
	AnnouncementAudioHandle,
	AnnouncementQueue,
	AutoAudioSequence,
} from "./AnnouncementAudio";
import { journeyEventFor, type Journey } from "./simulatorJourney";
import { resolveLowerMarquee } from "./lowerMarquee";
import { useMarqueeQueue, type MarqueeStep } from "./useMarqueeQueue";
import type { LanguageMode, StationNameMode } from "./simulatorControlState";

// How long the departure intro and the "next stop is …" each hold in the lower
// marquee when auto playback is off (audio would otherwise pace them). After the
// next-stop hold the queue finishes, so ads and notices take the marquee back.
const DEPARTURE_INTRO_HOLD_MS = 5000;
const NEXT_STATION_HOLD_MS = 5000;

/**
 * Which kind of announcement is audible right now, or null when silent:
 * - `tone` — the departure chime
 * - `departure` — the train-start route intro (この電車は…)
 * - `next` — the "next stop is …" spoken on leaving a station
 * - `station` — the arrival / almost-arrive announcement (まもなく…)
 */
export type AnnouncementAudioType = "tone" | "departure" | "next" | "station";

interface UseSimulatorAnnouncementsOptions {
	route: Route;
	lineId: LineId;
	serviceId: string;
	serviceStartIndex: number;
	serviceEndIndex: number;
	serviceStopIndices: readonly number[];
	serviceJa: string;
	serviceEn: string;
	journey: Journey;
	travelDirection: number;
	passingNext: boolean;
	lang: Lang;
	langMode: LanguageMode;
	autoLanguageModes: StationNameMode[];
	nextMarqueeMessageVisible: boolean;
	nextMarqueeThreshold: number;
	remainingMarqueeItems: string[];
	departureMajorStationCount: number;
	announcementAudioEnabled: boolean;
	announceStationNumberJa: boolean;
	announceStationNumberEn: boolean;
	announcementVolume: number;
	announcementAudioOverrides: Record<string, string>;
}

export function useSimulatorAnnouncements({
	route,
	lineId,
	serviceId,
	serviceStartIndex,
	serviceEndIndex,
	serviceStopIndices,
	serviceJa,
	serviceEn,
	journey,
	travelDirection,
	passingNext,
	lang,
	langMode,
	autoLanguageModes,
	nextMarqueeMessageVisible,
	nextMarqueeThreshold,
	remainingMarqueeItems,
	departureMajorStationCount,
	announcementAudioEnabled,
	announceStationNumberJa,
	announceStationNumberEn,
	announcementVolume,
	announcementAudioOverrides,
}: UseSimulatorAnnouncementsOptions) {
	const audioRef = React.useRef<AnnouncementAudioHandle>(null);
	let langs: Lang[];

	if (langMode === "auto") {
		langs =
			autoLanguageModes.length >= 2 && autoLanguageModes.includes("en")
				? ["ja", "en"]
				: autoLanguageModes.includes("en")
					? ["en"]
					: ["ja"];
	} else {
		langs = [langMode === "en" ? "en" : "ja"];
	}
	const [currentAudioType, setCurrentAudioType] =
		React.useState<AnnouncementAudioType | null>(null);
	const includesStationNumber = React.useCallback(
		(announcementLang: Lang) =>
			announcementLang === "ja"
				? announceStationNumberJa
				: announceStationNumberEn,
		[announceStationNumberEn, announceStationNumberJa],
	);
	// Reports a sequence starting/ending as the active audio type. The clear only
	// fires when this type is still current, so a later sequence that already
	// took over is never wiped by a trailing "finished" from an earlier one.
	const trackAudioType = React.useCallback(
		(type: AnnouncementAudioType) => (playing: boolean) =>
			setCurrentAudioType((prev) =>
				playing ? type : prev === type ? null : prev,
			),
		[],
	);
	const departurePlaybackIdRef = React.useRef(0);
	const serviceDestinationIndex =
		travelDirection > 0 ? serviceEndIndex : serviceStartIndex;
	const departureStartIndex =
		travelDirection > 0 ? serviceStartIndex : serviceEndIndex;
	const journeyEvent = React.useMemo(
		() => journeyEventFor(journey, nextMarqueeThreshold / 100),
		[journey, nextMarqueeThreshold],
	);
	// Before the first leg the train is simply placed at a station (from === null).
	// This suppresses announcement *audio* (see autoSequences) so choosing a line
	// is silent. Linear routes show their visual train-start message; circular
	// routes show the current-station arrival message because they have no origin.
	const isInitialEntry = journey.from === null;
	// Straight lines show the train-start announcement while waiting at their first
	// station — including at initial placement, with audio still held by
	// isInitialEntry. Loop lines have no origin terminus (you enter mid-loop), so
	// they get none here; their direction rides the major-stop departures below.
	const isAtDepartureStartStation =
		!route.circular &&
		journeyEvent?.type === "arrived" &&
		journeyEvent.stationIndex === departureStartIndex;
	const isDepartingStartStation =
		!route.circular &&
		journeyEvent?.type === "departed" &&
		journeyEvent.stationIndex === departureStartIndex;
	// Major stops trigger a departure announcement on every line, circular too.
	const isDepartingMajorStation =
		journeyEvent?.type === "departed" &&
		Boolean(route.stations[journeyEvent.stationIndex]?.major);
	const departureOriginIndex =
		isDepartingMajorStation || isDepartingStartStation
			? (journeyEvent?.stationIndex ?? journey.pos)
			: journey.pos;
	const departureMajorStations = React.useMemo(
		() =>
			upcomingMajorStations(route, {
				fromIndex: departureOriginIndex,
				direction: travelDirection,
				count: departureMajorStationCount,
				serviceStopIndices,
				circular: route.circular,
			}),
		[
			departureMajorStationCount,
			departureOriginIndex,
			route,
			serviceStopIndices,
			travelDirection,
		],
	);
	const isDepartureAnnouncementStage =
		isDepartingStartStation || isDepartingMajorStation;
	const departureToneSequence = React.useMemo(
		() =>
			journeyEvent?.type === "departed"
				? [departureToneKey(route.stations[journeyEvent.stationIndex])]
				: [],
		[journeyEvent, route],
	);
	// "Next stop is …", spoken when departing any station (not just start/major
	// ones). Suppressed when the next station is passed without stopping, since
	// the approach then announces that it does not stop there.
	const nextStationDepartureSequence = React.useMemo(
		() =>
			journeyEvent?.type === "departed" && !passingNext
				? langs.flatMap((announcementLang) =>
						departureNextStationAudioSequence(
							route,
							journeyEvent.targetIndex,
							announcementLang,
							includesStationNumber(announcementLang),
						),
					)
				: [],
		[journeyEvent, langs, passingNext, route, includesStationNumber],
	);
	// Ticker copy for the "next stop is …" departure announcement. journey.pos is
	// the station being approached while this plays, so it names the next stop.
	const nextStationDepartureItems = React.useMemo(
		() =>
			langs.map((announcementLang) =>
				departureNextStationAnnouncement(
					route,
					journey.pos,
					announcementLang,
				),
			),
		[journey.pos, langs, route],
	);
	// Audio-on visibility: the departure intro rides its audio window, plus the
	// at-rest dwell at the start station (audio-independent).
	const showDepartureMessages =
		isAtDepartureStartStation || currentAudioType === "departure";
	// The intro's copy is also built for the audio-off departure queue, which
	// plays it at every start/major departure whether or not audio is on-screen.
	const departureIntroVisible =
		showDepartureMessages ||
		(!announcementAudioEnabled && isDepartureAnnouncementStage);
	const departureService = React.useMemo(
		() => ({ serviceJa, serviceEn }),
		[serviceEn, serviceJa],
	);
	const departureAnnouncementItems = React.useMemo(() => {
		if (!departureIntroVisible) return [];

		return langs.map((announcementLang) =>
			trainStartAnnouncement(
				route,
				{
					terminalIndex: serviceDestinationIndex,
					...departureService,
					majorStations: departureMajorStations,
				},
				announcementLang,
			),
		);
	}, [
		departureMajorStations,
		departureService,
		route,
		serviceDestinationIndex,
		departureIntroVisible,
		langs,
	]);
	const serviceInfo = React.useMemo(
		() => ({
			ja: serviceJa,
			en: serviceEn,
			passing: passingNext,
			terminalIndex: serviceDestinationIndex,
		}),
		[passingNext, serviceDestinationIndex, serviceEn, serviceJa],
	);
	const stationAnnouncementItems = React.useMemo(
		() =>
			langs.map((announcementLang) =>
				announcement(
					route,
					journey.pos,
					journey.phase,
					announcementLang,
					serviceInfo,
				),
			),
		[langs, journey.phase, journey.pos, route, serviceInfo],
	);
	const stationSequence = React.useMemo(
		() =>
			langs.flatMap((announcementLang, index) =>
				announcementAudioSequence({
					route,
					pos: journey.pos,
					phase: journey.phase,
					lang: announcementLang,
					passing: passingNext,
					terminalIndex: serviceDestinationIndex,
					includeStationNumber:
						includesStationNumber(announcementLang),
					// The doors open once, so only the leading language chimes.
					doorEffect: index === 0,
				}),
			),
		[
			langs,
			journey.phase,
			journey.pos,
			passingNext,
			route,
			serviceDestinationIndex,
			includesStationNumber,
		],
	);
	const departureSequence = React.useMemo(
		() =>
			langs.flatMap((announcementLang) =>
				trainStartAnnouncementAudioSequence({
					route,
					lang: announcementLang,
					terminalIndex: serviceDestinationIndex,
					...departureService,
					majorStations: departureMajorStations,
				}),
			),
		[
			langs,
			departureMajorStations,
			departureService,
			route,
			serviceDestinationIndex,
		],
	);
	const stationAnnouncementVisible =
		(!isInitialEntry || route.circular) &&
		(nextMarqueeMessageVisible || !remainingMarqueeItems.length);
	const autoSequences = React.useMemo<AutoAudioSequence[]>(() => {
		if (!announcementAudioEnabled || !journeyEvent || isInitialEntry)
			return [];

		const eventId = `${lineId}:${serviceId}:${journeyEvent.id}:${travelDirection}`;
		switch (journeyEvent.type) {
			case "arrived":
				return isAtDepartureStartStation || !stationAnnouncementVisible
					? []
					: [
							{
								id: `announcement:${eventId}`,
								keys: stationSequence,
								onPlaybackChange: trackAudioType("station"),
							},
						];
			case "departed":
				return [
					{
						id: `tone:${eventId}`,
						keys: departureToneSequence,
						priority: true,
						onPlaybackChange: trackAudioType("tone"),
					},
					...(isDepartureAnnouncementStage
						? [
								{
									id: `departure:${eventId}`,
									keys: departureSequence,
									onPlaybackChange:
										trackAudioType("departure"),
								},
							]
						: []),
					...(nextStationDepartureSequence.length
						? [
								{
									id: `next:${eventId}`,
									keys: nextStationDepartureSequence,
									onPlaybackChange: trackAudioType("next"),
								},
							]
						: []),
				];
			case "almost-arrive":
				return stationAnnouncementVisible
					? [
							{
								id: `announcement:${eventId}`,
								keys: stationSequence,
								onPlaybackChange: trackAudioType("station"),
							},
						]
					: [];
		}
	}, [
		announcementAudioEnabled,
		departureSequence,
		departureToneSequence,
		isAtDepartureStartStation,
		isDepartureAnnouncementStage,
		isInitialEntry,
		journeyEvent,
		lineId,
		nextStationDepartureSequence,
		serviceId,
		stationAnnouncementVisible,
		stationSequence,
		trackAudioType,
		travelDirection,
	]);
	// With auto playback off there is no audio queue to pace the departure window,
	// so a marquee queue plays the same messages in sequence: the intro (at a
	// start/major departure) held briefly, then the "next stop is …". The key is
	// the departure event, so each new departure restarts the sequence.
	const departureQueueKey =
		!announcementAudioEnabled &&
		journeyEvent?.type === "departed" &&
		!passingNext
			? journeyEvent.id
			: null;
	const departureQueueSteps = React.useMemo<MarqueeStep[]>(() => {
		const steps: MarqueeStep[] = [];
		if (isDepartureAnnouncementStage)
			steps.push({
				items: departureAnnouncementItems,
				holdMs: DEPARTURE_INTRO_HOLD_MS,
			});
		steps.push({
			items: nextStationDepartureItems,
			holdMs: NEXT_STATION_HOLD_MS,
		});
		return steps;
	}, [
		departureAnnouncementItems,
		isDepartureAnnouncementStage,
		nextStationDepartureItems,
	]);
	const departureQueueItems = useMarqueeQueue(
		departureQueueKey,
		departureQueueSteps,
	);
	// Lower-marquee contents, highest priority first. When auto playback is on the
	// departure intro and next-stop ride their audio windows; when off, the timed
	// departure queue plays them in sequence. Arrival and custom content are
	// audio-agnostic and unchanged.
	const tickerItems = resolveLowerMarquee([
		{
			id: "departure",
			active: showDepartureMessages,
			items: departureAnnouncementItems,
		},
		{
			id: "next",
			active: currentAudioType === "next",
			items: nextStationDepartureItems,
		},
		{
			id: "departure-queue",
			active: departureQueueKey != null,
			items: departureQueueItems,
		},
		{
			id: "station",
			active: stationAnnouncementVisible,
			items: stationAnnouncementItems,
		},
		{
			id: "content",
			active: true,
			items: remainingMarqueeItems,
		},
	]);

	const departureSequenceFor = React.useCallback(
		(announcementLang: Lang) =>
			trainStartAnnouncementAudioSequence({
				route,
				lang: announcementLang,
				terminalIndex: serviceDestinationIndex,
				...departureService,
				majorStations: departureMajorStations,
			}),
		[
			departureMajorStations,
			departureService,
			route,
			serviceDestinationIndex,
		],
	);
	const playDepartureAnnouncement = React.useCallback(
		async (announcementLang: Lang) => {
			const playbackId = ++departurePlaybackIdRef.current;
			setCurrentAudioType("departure");
			await audioRef.current?.playKeys(
				departureSequenceFor(announcementLang),
			);
			if (departurePlaybackIdRef.current === playbackId)
				setCurrentAudioType((prev) =>
					prev === "departure" ? null : prev,
				);
		},
		[departureSequenceFor],
	);
	const [manifestClipKeys, setManifestClipKeys] = React.useState<
		ReadonlySet<string>
	>(() => new Set());
	const handleClipKeysChange = React.useCallback(
		(keys: string[]) => setManifestClipKeys(new Set(keys)),
		[],
	);
	/** A clip is playable once the manifest lists it or an upload overrides it. */
	const isAudioClipAvailable = React.useCallback(
		(key: string) =>
			Boolean(announcementAudioOverrides[key]) ||
			manifestClipKeys.has(key),
		[announcementAudioOverrides, manifestClipKeys],
	);
	const [audioQueue, setAudioQueue] = React.useState<AnnouncementQueue>({
		current: null,
		pending: [],
	});
	const stopAnnouncementAudio = React.useCallback(() => {
		departurePlaybackIdRef.current += 1;
		setCurrentAudioType(null);
		audioRef.current?.stop();
	}, []);
	const playCurrentAnnouncement = React.useCallback(
		(announcementLang: Lang) => {
			if (isDepartureAnnouncementStage) {
				void playDepartureAnnouncement(announcementLang);
				return;
			}
			const sequence = announcementAudioSequence({
				route,
				pos: journey.pos,
				phase: journey.phase,
				lang: announcementLang,
				passing: passingNext,
				terminalIndex: serviceDestinationIndex,
				includeStationNumber:
					includesStationNumber(announcementLang),
				doorEffect: true,
			});
			void audioRef.current?.playKeys(sequence);
		},
		[
			isDepartureAnnouncementStage,
			journey.phase,
			journey.pos,
			passingNext,
			playDepartureAnnouncement,
			route,
			serviceDestinationIndex,
			includesStationNumber,
		],
	);

	return {
		audioRef,
		audioProps: {
			autoSequences,
			overrides: announcementAudioOverrides,
			volume: announcementVolume,
			onClipKeysChange: handleClipKeysChange,
			onQueueChange: setAudioQueue,
		},
		isAudioClipAvailable,
		// The static set of clips the manifest exposes (upload overrides aside).
		// Surfaced so the split-mode control device can mirror clip availability
		// without mounting the audio element itself.
		manifestClipKeys: React.useMemo(
			() => Array.from(manifestClipKeys),
			[manifestClipKeys],
		),
		audioQueue,
		tickerItems,
		playAnnouncementKeys: (keys: string[]) =>
			void audioRef.current?.playKeys(keys),
		playCurrentAnnouncement,
		playDepartureAnnouncement,
		stopAnnouncementAudio,
		currentAudioType,
	};
}
