"use client";

import React from "react";
import {
	announcement,
	trainStartAnnouncement,
	upcomingMajorStations,
} from "@/lib/announcement";
import {
	announcementAudioSequence,
	trainStartAnnouncementAudioSequence,
} from "@/lib/announcementAudio";
import type { Lang, LineId, Route } from "@/types/metro";
import type { AnnouncementAudioHandle } from "./AnnouncementAudio";
import type { Journey } from "./simulatorJourney";
import type { LanguageMode } from "./simulatorControlState";

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
	const suppressCircularStartDeparture =
		Boolean(route.circular) && !route.stations[departureStartIndex]?.major;
	const isInitialEntry =
		journey.from === null && journey.phase === "approach";
	const isAtDepartureStartStation =
		!suppressCircularStartDeparture &&
		journey.pos === departureStartIndex &&
		journey.phase === "at";
	const isDepartingStartStation =
		!suppressCircularStartDeparture &&
		journey.phase === "approach" &&
		journey.from === departureStartIndex;
	const isDepartingMajorStation =
		journey.phase === "approach" &&
		journey.from !== null &&
		Boolean(route.stations[journey.from]?.major);
	const departureOriginIndex =
		isDepartingMajorStation || isDepartingStartStation
			? (journey.from ?? journey.pos)
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
		(isDepartingStartStation || isDepartingMajorStation) &&
		journey.progress < nextMarqueeThreshold / 100;
	const showDepartureMessages =
		isAtDepartureStartStation || departureAnnouncementPlaying;
	const departureService = React.useMemo(
		() => ({ serviceJa, serviceEn }),
		[serviceEn, serviceJa],
	);
	const departureAnnouncementItems = React.useMemo(
		() =>
			showDepartureMessages
				? (["ja", "en"] as const).map((announcementLang) =>
						trainStartAnnouncement(
							route,
							{
								terminalIndex: serviceDestinationIndex,
								...departureService,
								majorStations: departureMajorStations,
							},
							announcementLang,
						),
					)
				: [],
		[
			departureMajorStations,
			departureService,
			route,
			serviceDestinationIndex,
			showDepartureMessages,
		],
	);
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
	const stationSequence = React.useMemo(
		() =>
			announcementAudioSequence({
				route,
				pos: journey.pos,
				phase: journey.phase,
				lang,
				passing: passingNext,
				terminalIndex: serviceDestinationIndex,
			}),
		[
			journey.phase,
			journey.pos,
			lang,
			passingNext,
			route,
			serviceDestinationIndex,
		],
	);
	const departureSequence = React.useMemo(
		() =>
			trainStartAnnouncementAudioSequence({
				route,
				lang,
				terminalIndex: serviceDestinationIndex,
				...departureService,
				majorStations: departureMajorStations,
			}),
		[
			departureMajorStations,
			departureService,
			lang,
			route,
			serviceDestinationIndex,
		],
	);
	const stationAnnouncementVisible =
		nextMarqueeMessageVisible || !remainingMarqueeItems.length;
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
			autoEnabled:
				announcementAudioEnabled &&
				!isInitialEntry &&
				!isAtDepartureStartStation &&
				(stationAnnouncementVisible || isDepartureAnnouncementStage),
			sequence: isDepartureAnnouncementStage
				? departureSequence
				: stationSequence,
			overrides: announcementAudioOverrides,
			volume: announcementVolume,
			statusKey: `${lineId}:${serviceId}:${serviceStartIndex}:${serviceEndIndex}:${journey.pos}:${journey.phase}:${travelDirection}:${passingNext}:${isDepartureAnnouncementStage ? "departure" : "station"}`,
			language: lang,
			onAutoPlaybackChange: isDepartureAnnouncementStage
				? setDepartureAnnouncementPlaying
				: undefined,
		},
		tickerItems,
		playAnnouncementKeys: (keys: string[]) =>
			void audioRef.current?.playKeys(keys),
		playCurrentAnnouncement,
		playDepartureAnnouncement,
		stopAnnouncementAudio,
	};
}
