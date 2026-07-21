"use client";

import React from "react";
import {
	announcement,
	trainStartAnnouncement,
	upcomingMajorStations,
} from "@/lib/announcement";
import {
	announcementAudioSequence,
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
import type { LanguageMode, StationNameMode } from "./simulatorControlState";

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
	announcementVolume,
	announcementAudioOverrides,
}: UseSimulatorAnnouncementsOptions) {
	const audioRef = React.useRef<AnnouncementAudioHandle>(null);
	const [departureAnnouncementPlaying, setDepartureAnnouncementPlaying] =
		React.useState(false);
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
	// is silent — but the visual train-start announcement still shows while the
	// train waits at the first station (see isAtDepartureStartStation).
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
	const showDepartureMessages =
		isAtDepartureStartStation || departureAnnouncementPlaying;
	const departureService = React.useMemo(
		() => ({ serviceJa, serviceEn }),
		[serviceEn, serviceJa],
	);
	const departureAnnouncementItems = React.useMemo(() => {
		if (!showDepartureMessages) return [];
		let langs: Lang[];

		if (langMode === "auto") {
			langs =
				autoLanguageModes.length >= 2 &&
				autoLanguageModes.includes("en")
					? ["ja", "en"]
					: autoLanguageModes.includes("en")
						? ["en"]
						: ["ja"];
		} else {
			langs = [langMode === "en" ? "en" : "ja"];
		}

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
		showDepartureMessages,
		langMode,
		autoLanguageModes,
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
			langMode === "auto"
				? (["ja", "en"] as const).map((announcementLang) =>
						announcement(
							route,
							journey.pos,
							journey.phase,
							announcementLang,
							serviceInfo,
						),
					)
				: [
						announcement(
							route,
							journey.pos,
							journey.phase,
							lang,
							serviceInfo,
						),
					],
		[lang, langMode, journey.phase, journey.pos, route, serviceInfo],
	);
	// Auto mode announces in both languages back to back, mirroring the ticker.
	const announcementLangs = React.useMemo<readonly Lang[]>(
		() => (langMode === "auto" ? (["ja", "en"] as const) : [lang]),
		[lang, langMode],
	);
	const stationSequence = React.useMemo(
		() =>
			announcementLangs.flatMap((announcementLang, index) =>
				announcementAudioSequence({
					route,
					pos: journey.pos,
					phase: journey.phase,
					lang: announcementLang,
					passing: passingNext,
					terminalIndex: serviceDestinationIndex,
					// The doors open once, so only the leading language chimes.
					doorEffect: index === 0,
				}),
			),
		[
			announcementLangs,
			journey.phase,
			journey.pos,
			passingNext,
			route,
			serviceDestinationIndex,
		],
	);
	const departureSequence = React.useMemo(
		() =>
			announcementLangs.flatMap((announcementLang) =>
				trainStartAnnouncementAudioSequence({
					route,
					lang: announcementLang,
					terminalIndex: serviceDestinationIndex,
					...departureService,
					majorStations: departureMajorStations,
				}),
			),
		[
			announcementLangs,
			departureMajorStations,
			departureService,
			route,
			serviceDestinationIndex,
		],
	);
	const stationAnnouncementVisible =
		!isInitialEntry &&
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
							},
						];
			case "departed":
				return [
					{
						id: `tone:${eventId}`,
						keys: departureToneSequence,
						priority: true,
					},
					...(isDepartureAnnouncementStage
						? [
								{
									id: `departure:${eventId}`,
									keys: departureSequence,
									onPlaybackChange:
										setDepartureAnnouncementPlaying,
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
		serviceId,
		stationAnnouncementVisible,
		stationSequence,
		travelDirection,
	]);
	const tickerItems = showDepartureMessages
		? departureAnnouncementItems
		: stationAnnouncementVisible
			? stationAnnouncementItems
			: remainingMarqueeItems;

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
			setDepartureAnnouncementPlaying(true);
			await audioRef.current?.playKeys(
				departureSequenceFor(announcementLang),
			);
			if (departurePlaybackIdRef.current === playbackId)
				setDepartureAnnouncementPlaying(false);
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
		setDepartureAnnouncementPlaying(false);
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
		audioQueue,
		tickerItems,
		playAnnouncementKeys: (keys: string[]) =>
			void audioRef.current?.playKeys(keys),
		playCurrentAnnouncement,
		playDepartureAnnouncement,
		stopAnnouncementAudio,
		departureAnnouncementPlaying,
	};
}
