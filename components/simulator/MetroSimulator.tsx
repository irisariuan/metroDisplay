"use client";
/* Simulator engine + controls + mount */
import React from "react";
import { LINES, ROUTES } from "@/lib/metro-data";
import { useClock } from "@/hooks/useClock";
import { SimulatorDisplay } from "@/components/simulator/SimulatorDisplay";
import { SimulatorControls } from "@/components/simulator/SimulatorControls";
import { AnnouncementAudio } from "@/components/simulator/AnnouncementAudio";
import {
	advanceJourney,
	type Journey,
	type JourneyBounds,
} from "@/components/simulator/simulatorJourney";
import { useSimulatorAnnouncements } from "@/components/simulator/useSimulatorAnnouncements";
import {
	initialSimulatorControlState,
	simulatorControlReducer,
	setControl,
	type SimulatorControlState,
	type StationNameMode,
} from "@/components/simulator/simulatorControlState";
import type { LineId, Lang, Phase, AnnouncementContent } from "@/types/metro";

const { useState, useEffect, useRef } = React;

interface MetroSimulatorProps {
	children: React.ReactNode;
}

export function MetroSimulator({ children }: MetroSimulatorProps) {
	const [controls, dispatch] = React.useReducer(
		simulatorControlReducer,
		initialSimulatorControlState,
	);
	const {
		lineId,
		serviceId,
		auto,
		travelDirection,
		speedKmh,
		simulationSpeed,
		stationStayMs,
		langMode,
		lang,
		langMs,
		doorNoticeMs,
		doorNoticeWaitMs,
		pageSize,
		autoLanguageModes,
		showKatakana,
		stationNameMode,
		alertText,
		alertSecondText,
		alertScope,
		alertActive,
		alertLeaving,
		delayNextMarqueeMessage,
		nextMarqueeThreshold,
		announcements,
		showDistanceIndicator,
		showSpeedIndicator,
		showStationStayIndicator,
		pauseAtPageBreak,
		followDirectionView,
		showEditor,
		transferDisplayMode,
		announcementAudioEnabled,
		announcementVolume,
		departureMajorStationCount,
	} = controls;
	const [announcementAudioOverrides, setAnnouncementAudioOverrides] =
		useState<Record<string, string>>({});
	const uploadAnnouncementAudio = (key: string, file: File) => {
		setAnnouncementAudioOverrides((current) => {
			const previous = current[key];
			if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
			return { ...current, [key]: URL.createObjectURL(file) };
		});
	};
	const updateControl = <K extends keyof SimulatorControlState>(
		field: K,
		value: React.SetStateAction<SimulatorControlState[K]>,
	) => dispatch(setControl(field, value));
	const setLineId = (value: React.SetStateAction<LineId>) =>
		updateControl("lineId", value);
	const setAuto = (value: React.SetStateAction<boolean>) =>
		updateControl("auto", value);
	const setTravelDirection = (value: React.SetStateAction<number>) =>
		updateControl("travelDirection", value);
	const setAlertActive = (value: React.SetStateAction<boolean>) =>
		updateControl("alertActive", value);
	const setAlertLeaving = (value: React.SetStateAction<boolean>) =>
		updateControl("alertLeaving", value);
	const setShowEditor = (value: React.SetStateAction<boolean>) =>
		updateControl("showEditor", value);
	const [journey, setJourney] = useState<Journey>({
		pos: 0,
		phase: "approach",
		progress: 0,
		from: null,
	});
	const [routes, setRoutes] = useState<any>(() => {
		const cloned = JSON.parse(JSON.stringify(ROUTES));
		Object.values(cloned).forEach((route: any) => {
			route.circular = !!route.circular;
			route.stations.forEach((station: any, index: number) => {
				if (!Number.isFinite(Number(station.distance))) {
					station.distance = index === 0 ? 0 : 2;
				}
			});
		});
		return cloned;
	});
	const [, setLineRevision] = useState(0);
	const [stationStayRemainingMs, setStationStayRemainingMs] = useState(0);
	const [arrivalTransferExpanded, setArrivalTransferExpanded] =
		useState(false);
	const [doorIndicatorVisible, setDoorIndicatorVisible] = useState(false);
	const clock = useClock();

	const route = routes[lineId];
	const N = route.stations.length;
	// ——— express service: its first and last enabled stops bound the run.
	const activeService =
		serviceId === "local"
			? null
			: (route.services || []).find((sv: any) => sv.id === serviceId) ||
				null;
	const serviceStopIndices = React.useMemo(() => {
		if (!activeService) return route.stations.map((_, index) => index);
		return route.stations
			.map((station: any, index: number) =>
				station.skip?.includes(activeService.id) ? -1 : index,
			)
			.filter((index: number) => index >= 0);
	}, [route, activeService]);
	const serviceStartIndex = serviceStopIndices[0] ?? 0;
	const serviceEndIndex = serviceStopIndices.at(-1) ?? N - 1;
	const skipStations = React.useMemo(
		() =>
			activeService
				? route.stations
						.map((_, index) =>
							serviceStopIndices.includes(index) ? -1 : index,
						)
						.filter((index) => index >= 0)
				: [],
		[activeService, route.stations, serviceStopIndices],
	);
	const serviceJa = activeService ? activeService.ja : "各駅停車";
	const serviceEn = activeService ? activeService.en : "Local";
	const serviceDestinationIndex =
		travelDirection > 0 ? serviceEndIndex : serviceStartIndex;
	const serviceOriginIndex =
		travelDirection > 0 ? serviceStartIndex : serviceEndIndex;
	const displayRoute = {
		...route,
		destJa: route.stations[serviceDestinationIndex].ja,
		destEn: route.stations[serviceDestinationIndex].en,
	};
	const serviceOrigin = activeService
		? route.stations[serviceOriginIndex]
		: undefined;
	const passingNext =
		journey.phase === "approach" && skipStations.includes(journey.pos);
	const hasCurrentTransfers = !!route.stations[journey.pos]?.xf?.length;
	const transferExpanded =
		hasCurrentTransfers &&
		(transferDisplayMode === "full" ||
			(transferDisplayMode === "auto" && arrivalTransferExpanded));
	const activeAlert =
		alertActive && alertText.trim()
			? {
					primary: alertText.trim(),
					secondary: alertSecondText.trim(),
				}
			: null;
	const monitorAlert = !!activeAlert && alertScope === "monitor";
	const clearAlert = () => {
		if (!alertActive || alertLeaving) return;
		setAlertLeaving(true);
		setTimeout(() => {
			setAlertActive(false);
			setAlertLeaving(false);
		}, 300);
	};
	const legStationIndex =
		travelDirection > 0 ? journey.pos : (journey.pos + 1) % N;
	const hasIncomingLeg =
		travelDirection > 0
			? journey.pos > serviceStartIndex || route.circular
			: journey.pos < serviceEndIndex || route.circular;
	const legDistance = hasIncomingLeg
		? Number(route.stations[legStationIndex].distance) || 0
		: 0;
	const remainingDistance =
		journey.phase === "approach" && hasIncomingLeg
			? Math.max(0, legDistance * (1 - journey.progress))
			: null;
	const travelHours = hasIncomingLeg ? legDistance / speedKmh : 0;
	const travelDuration = hasIncomingLeg
		? Math.max(300, (travelHours * 60 * 60 * 1000) / simulationSpeed)
		: 300;
	const isPageBoundaryLeg =
		(journey.pos > 0 && journey.pos % pageSize === 0) ||
		(route.circular && journey.pos === 0 && journey.from === N - 1);
	const nextMarqueeMessageVisible =
		journey.phase !== "approach" ||
		!delayNextMarqueeMessage ||
		journey.progress >= nextMarqueeThreshold / 100;
	const labelAnnouncementContent = (
		item: AnnouncementContent,
		itemLang: Lang,
	) => {
		if (!item.displayable) throw new Error("Cannot label a non-displayable announcement");
		const label =
			item.type === "ad"
				? itemLang === "ja"
					? "広告"
					: "AD"
				: itemLang === "ja"
					? "お知らせ"
					: "METRO NOTICE";
		return `${label} · ${itemLang === "ja" ? item.ja || item.en : item.en}`;
	};
	const remainingMarqueeItems = announcements
		.filter((item) => item.enabled && item.en.trim() && item.displayable)
		.flatMap((item) => {
			if (langMode === "auto") {
				return [
					item.ja.trim()
						? labelAnnouncementContent(item, "ja")
						: null,
					labelAnnouncementContent(item, "en"),
				].filter(Boolean);
			}
			return [labelAnnouncementContent(item, lang)];
		});
	const announcementContents = useSimulatorAnnouncements({
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
	});
	const stateRef = useRef<JourneyBounds>({
		stationCount: N,
		circular: route.circular,
		skippedStations: new Set<number>(),
		startIndex: 0,
		endIndex: N - 1,
	});
	React.useEffect(() => {
		stateRef.current.stationCount = N;
		stateRef.current.circular = !!route.circular;
		stateRef.current.skippedStations = new Set(skipStations);
		stateRef.current.startIndex = serviceStartIndex;
		stateRef.current.endIndex = serviceEndIndex;
	}, [N, route.circular, serviceEndIndex, serviceStartIndex, skipStations]);

	function advance(dir: number) {
		setJourney((current) => advanceJourney(current, dir, stateRef.current));
	}

	// Auto travel advances real progress rather than a CSS-only transition, so pause freezes in place.
	useEffect(() => {
		if (!auto) return undefined;
		if (journey.phase === "at") {
			let nextDirection = travelDirection;
			if (
				!route.circular &&
				((journey.pos === serviceEndIndex && travelDirection > 0) ||
					(journey.pos === serviceStartIndex && travelDirection < 0))
			) {
				nextDirection = -travelDirection;
				dispatch(setControl("travelDirection", nextDirection));
			}
			const id = setTimeout(() => advance(nextDirection), stationStayMs);
			return () => clearTimeout(id);
		}
		const tickMs = 50;
		const id = setInterval(() => {
			setJourney((j) => {
				if (j.phase !== "approach") return j;
				const progress = Math.min(
					1,
					j.progress + tickMs / travelDuration,
				);
				if (
					pauseAtPageBreak &&
					isPageBoundaryLeg &&
					j.progress < 0.5 &&
					progress >= 0.5
				) {
					dispatch(setControl("auto", false));
					return { ...j, progress: 0.499 };
				}
				if (progress === 1) {
					// pass through skipped stations without dwelling
					const {
						stationCount,
						circular,
						skippedStations,
						startIndex,
						endIndex,
					} = stateRef.current;
					const canContinue =
						travelDirection > 0
							? j.pos < endIndex || circular
							: j.pos > startIndex || circular;
					if (skippedStations.has(j.pos) && canContinue)
						return {
							pos:
								travelDirection > 0
									? (j.pos + 1) % stationCount
									: (j.pos - 1 + stationCount) % stationCount,
							phase: "approach" as Phase,
							progress: 0,
							from: j.pos,
						};
					return { ...j, phase: "at" as Phase, progress };
				}
				return { ...j, progress };
			});
		}, tickMs);
		return () => clearInterval(id);
	}, [
		auto,
		speedKmh,
		simulationSpeed,
		lineId,
		journey.phase,
		journey.pos,
		travelDuration,
		isPageBoundaryLeg,
		pauseAtPageBreak,
		N,
		route.circular,
		serviceEndIndex,
		serviceStartIndex,
		travelDirection,
		stationStayMs,
		dispatch,
	]);

	useEffect(() => {
		if (journey.phase !== "at") {
			setStationStayRemainingMs(0);
			return undefined;
		}
		const startedAt = Date.now();
		const tick = () =>
			setStationStayRemainingMs(
				Math.max(0, stationStayMs - (Date.now() - startedAt)),
			);
		tick();
		const id = setInterval(tick, 100);
		return () => clearInterval(id);
	}, [journey.phase, journey.pos, stationStayMs]);

	// Give transfer information the full lower display for the first few
	// seconds after arrival, then return that space to the ordinary ticker.
	useEffect(() => {
		if (journey.phase !== "at" || !hasCurrentTransfers) {
			setArrivalTransferExpanded(false);
			return undefined;
		}
		setArrivalTransferExpanded(true);
		const id = setTimeout(() => setArrivalTransferExpanded(false), 4000);
		return () => clearTimeout(id);
	}, [journey.phase, journey.pos, hasCurrentTransfers]);

	useEffect(() => {
		dispatch(setControl("transferDisplayMode", "auto"));
	}, [dispatch, journey.pos, lineId]);

	// Loop through precisely the station-name modes enabled in the language UI.
	useEffect(() => {
		if (langMode !== "auto") {
			dispatch(setControl("lang", langMode === "en" ? "en" : "ja"));
			dispatch(setControl("stationNameMode", langMode));
			return undefined;
		}
		const modes: StationNameMode[] =
			autoLanguageModes.length > 0 ? autoLanguageModes : ["kanji"];
		let modeIndex = 0;
		dispatch(setControl("lang", "ja"));
		dispatch(setControl("stationNameMode", modes[modeIndex]));
		const id = setInterval(() => {
			modeIndex = (modeIndex + 1) % modes.length;
			const nextMode = modes[modeIndex];
			dispatch(setControl("stationNameMode", nextMode));
			dispatch(setControl("lang", nextMode === "en" ? "en" : "ja"));
		}, langMs);
		return () => clearInterval(id);
	}, [autoLanguageModes, dispatch, langMode, langMs]);

	// Keep the train inside the active service segment as enabled stops change.
	useEffect(() => {
		if (journey.pos < serviceStartIndex || journey.pos > serviceEndIndex)
			setJourney({
				pos: serviceStartIndex,
				phase: "approach",
				progress: 0,
				from: null,
			});
	}, [journey.pos, serviceEndIndex, serviceStartIndex]);

	function pickLine(id: LineId) {
		setLineId(id);
		updateControl("serviceId", "local");
		setTravelDirection(1);
		setJourney({ pos: 0, phase: "approach", progress: 0, from: null });
	}

	// ——— express service editing (variants live on the route, skip flags on stations)
	const SERVICE_PRESETS = [
		["準急", "Semi-Express"],
		["急行", "Express"],
		["特急", "Super-Express"],
		["快速", "Rapid"],
	];
	const addService = () => {
		const id = `sv-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
		editRoute((r) => {
			r.services = r.services || [];
			const preset =
				SERVICE_PRESETS[r.services.length % SERVICE_PRESETS.length];
			r.services.push({
				id,
				ja: preset[0],
				en: preset[1],
			});
		});
		updateControl("serviceId", id);
	};
	const removeService = (id: string) => {
		editRoute((r) => {
			r.services = (r.services || []).filter((sv: any) => sv.id !== id);
			r.stations.forEach((station: any) => {
				if (station.skip)
					station.skip = station.skip.filter((x: string) => x !== id);
			});
		});
		if (serviceId === id) updateControl("serviceId", "local");
	};
	const setServiceField = (id: string, field: "ja" | "en", value: string) =>
		editRoute((r) => {
			const sv = (r.services || []).find((x: any) => x.id === id);
			if (sv) sv[field] = value;
		});
	const toggleServiceStop = (index: number) => {
		if (serviceId === "local") return;
		editRoute((r) => {
			const station = r.stations[index];
			station.skip = station.skip || [];
			const currentlyStops = !station.skip.includes(serviceId);
			const enabledCount = r.stations.filter(
				(candidate: any) => !candidate.skip?.includes(serviceId),
			).length;
			if (currentlyStops && enabledCount <= 1) return;
			station.skip = station.skip.includes(serviceId)
				? station.skip.filter((x: string) => x !== serviceId)
				: [...station.skip, serviceId];
		});
	};

	// ——— line editing (operates on the selected line's clone)
	function editRoute(mutator: (r: any) => void) {
		setRoutes((prev: any) => {
			const next = { ...prev };
			const r = JSON.parse(JSON.stringify(prev[lineId]));
			mutator(r);
			next[lineId] = r;
			return next;
		});
	}
	const setLineField = (field: string, value: string) => {
		if (field === "color") {
			const hex = value.slice(1);
			const red = parseInt(hex.slice(0, 2), 16);
			const green = parseInt(hex.slice(2, 4), 16);
			const blue = parseInt(hex.slice(4, 6), 16);
			// Keep line codes and controls legible against the selected brand color.
			const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
			(LINES as any)[lineId].color = value;
			(LINES as any)[lineId].textOnColor =
				brightness > 160 ? "#111" : "#fff";
		} else {
			(LINES as any)[lineId][field] = value;
		}
		setLineRevision((revision) => revision + 1);
	};
	const addLine = () => {
		let lineNumber = 1;
		while ((LINES as any)[`LN${lineNumber}`]) lineNumber += 1;
		const id = `LN${lineNumber}`;
		const usedCodes = new Set(
			Object.keys(LINES).map((key) => (LINES as any)[key].code),
		);
		const code =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZ"
				.split("")
				.find((candidate) => !usedCodes.has(candidate)) ||
			`L${lineNumber}`;
		const colors = ["#0b7a75", "#c23c52", "#5b4bb7", "#b05d14", "#1677a8"];
		(LINES as any)[id] = {
			id,
			code,
			ja: `新路線${lineNumber}`,
			en: `New Line ${lineNumber}`,
			color: colors[(lineNumber - 1) % colors.length],
			textOnColor: "#fff",
		};
		setRoutes((previous: any) => ({
			...previous,
			[id]: {
				line: id,
				destJa: "終着駅",
				destEn: "Terminus",
				towardJa: "終着駅方面",
				towardEn: "for Terminus",
				circular: false,
				stations: [
					{
						ja: "始発駅",
						en: "Origin Station",
						hira: "しはつえき",
						kata: "シハツエキ",
						side: "L",
						xf: [],
						distance: 2,
					},
					{
						ja: "終着駅",
						en: "Terminus",
						hira: "しゅうちゃくえき",
						kata: "シュウチャクエキ",
						side: "R",
						xf: [],
						distance: 2,
					},
				],
			},
		}));
		setLineId(id as LineId);
		setTravelDirection(1);
		setJourney({ pos: 0, phase: "approach", progress: 0, from: null });
		setShowEditor(true);
	};
	const setStationField = (i: number, f: string, v: any) =>
		editRoute((r) => {
			r.stations[i][f] =
				f === "distance" ? Math.max(0, Number(v) || 0) : v;
		});
	const toggleSide = (i: number) =>
		editRoute((r) => {
			r.stations[i].side = r.stations[i].side === "L" ? "R" : "L";
		});
	const toggleMajorStation = (i: number) =>
		editRoute((r) => {
			r.stations[i].major = !r.stations[i].major;
		});
	const toggleXfer = (i: number, lid: LineId) =>
		editRoute((r) => {
			const s = r.stations[i];
			s.xf = s.xf || [];
			s.xf = s.xf.includes(lid)
				? s.xf.filter((x: LineId) => x !== lid)
				: [...s.xf, lid];
		});
	const addStation = () =>
		editRoute((r) => {
			r.stations.push({
				ja: "新駅",
				en: "New Station",
				hira: "しんえき",
				kata: "シンエキ",
				side: "R",
				xf: [],
				distance: 2,
			});
		});
	const removeStation = (i: number) =>
		editRoute((r) => {
			if (r.stations.length <= 2) return;
			r.stations.splice(i, 1);
		});
	const moveStation = (i: number, dir: number) =>
		editRoute((r) => {
			const j = i + dir;
			if (j < 0 || j >= r.stations.length) return;
			const t = r.stations[i];
			r.stations[i] = r.stations[j];
			r.stations[j] = t;
		});
	const setDest = (f: string, v: string) =>
		editRoute((r) => {
			r[f] = v;
		});
	const toggleCircular = () =>
		editRoute((r) => {
			r.circular = !r.circular;
			if (r.circular && !(Number(r.stations[0].distance) > 0))
				r.stations[0].distance = 2;
		});
	const annColor =
		journey.phase === "at" ? "var(--acid)" : "var(--magenta-2)";

	return (
		<>
			<div className="mb-4.5 flex flex-wrap items-end justify-between gap-4">
				{children}
				<div className="text-right font-mono text-sm tracking-widest text-paper-2 opacity-70">
					<div>
						{journey.phase === "at"
							? "STOPPED · ドア開"
							: "RUNNING · 走行中"}
					</div>
					<div>{auto ? "AUTO-PLAY" : "MANUAL"}</div>
				</div>
			</div>

			<SimulatorDisplay
				route={displayRoute}
				serviceJa={serviceJa}
				serviceEn={serviceEn}
				serviceIsLocal={!activeService}
				serviceOrigin={serviceOrigin}
				passing={passingNext}
				skipStations={skipStations}
				trailStartIndex={activeService ? serviceStartIndex : 0}
				trailEndIndex={activeService ? serviceEndIndex : N - 1}
				pos={journey.pos}
				phase={journey.phase}
				progress={journey.progress}
				from={journey.from}
				direction={travelDirection}
				lang={lang}
				clock={clock}
				showKatakana={showKatakana}
				stationNameMode={stationNameMode}
				doorNoticeMs={doorNoticeMs}
				doorNoticeWaitMs={doorNoticeWaitMs}
				followDirectionView={followDirectionView}
				pageSize={pageSize}
				remainingDistance={remainingDistance}
				stationStayRemainingMs={stationStayRemainingMs}
				showDistanceIndicator={showDistanceIndicator}
				showStationStayIndicator={showStationStayIndicator}
				showSpeedIndicator={showSpeedIndicator}
				speedKmh={speedKmh}
				travelDuration={travelDuration}
				monitorAlert={monitorAlert}
				activeAlert={activeAlert}
				alertScope={alertScope}
				alertLeaving={alertLeaving}
				tickerItems={announcementContents.tickerItems}
				tickerColor={
					nextMarqueeMessageVisible ? annColor : "var(--paper)"
				}
				hasTransfers={hasCurrentTransfers}
				transferExpanded={transferExpanded}
				doorIndicatorVisible={doorIndicatorVisible}
				onDoorIndicatorVisibleChange={setDoorIndicatorVisible}
			/>
			<AnnouncementAudio
				ref={announcementContents.audioRef}
				{...announcementContents.audioProps}
			/>

			<SimulatorControls
				state={controls}
				dispatch={dispatch}
				context={{
					route,
					hasCurrentTransfers,
					transferExpanded,
					currentStation: route.stations[journey.pos],
					announcementAudioOverrides,
					addService,
					removeService,
					setServiceField,
					toggleServiceStop,
					addLine,
					pickLine,
					setLineField,
					setStationField,
					toggleSide,
					toggleMajorStation,
					toggleXfer,
					addStation,
					removeStation,
					moveStation,
					setDest,
					toggleCircular,
					advance,
					clearAlert,
					uploadAnnouncementAudio,
					playAnnouncementKeys:
						announcementContents.playAnnouncementKeys,
					playCurrentAnnouncement:
						announcementContents.playCurrentAnnouncement,
					playDepartureAnnouncement:
						announcementContents.playDepartureAnnouncement,
					stopAnnouncementAudio:
						announcementContents.stopAnnouncementAudio,
				}}
			/>
		</>
	);
}
