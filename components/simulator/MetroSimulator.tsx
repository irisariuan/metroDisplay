"use client";
/* Simulator engine + controls + mount */
import React, { useMemo } from "react";
import {
	LINES,
	ROUTES,
	SIMULATOR_PRESETS,
	type SimulatorPreset,
	type SimulatorPresetId,
} from "@/lib/metro-data";
import { MARQUEE_CONTENT_PRESETS } from "@/lib/constants";
import { useClock } from "@/hooks/useClock";
import { SimulatorDisplay } from "@/components/simulator/SimulatorDisplay";
import { SimulatorControls } from "@/components/simulator/SimulatorControls";
import { AnnouncementAudio } from "@/components/simulator/AnnouncementAudio";
import {
	beginJourneyLeg,
	completeJourneyLeg,
	navigateJourney,
	stationedJourney,
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
	type CustomMarqueePreset,
	DisplayAnnouncement,
} from "@/components/simulator/simulatorControlState";
import type {
	LineId,
	Lang,
	AnnouncementContent,
	Route,
	EditableRoute,
	Routes,
	AnnouncementContentType,
} from "@/types/metro";
import { shuffle } from "@/lib/utils";
import { upcomingMajorStations } from "@/lib/announcement";

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
	const [journey, setJourney] = useState<Journey>(stationedJourney(0));
	const [manualTravel, setManualTravel] = useState(false);
	const [presets, setPresets] = useState<SimulatorPreset[]>(() =>
		SIMULATOR_PRESETS.map((preset) => ({
			...preset,
			lineIds: [...preset.lineIds],
			marqueePresetId: preset.id === "yamanote" ? "yamanote" : "shuika",
		})),
	);
	const [marqueePresets, setMarqueePresets] = useState<CustomMarqueePreset[]>(
		[],
	);
	const [routes, setRoutes] = useState<Routes>(() => {
		const cloned = { ...ROUTES };
		Object.values(cloned).forEach((route) => {
			route.circular = !!route.circular;
			route.stations.forEach((station, index: number) => {
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
			: (route.services || []).find((sv) => sv.id === serviceId) || null;
	const serviceStopIndices = React.useMemo(() => {
		if (!activeService) return route.stations.map((_, index) => index);
		return route.stations
			.map((station, index) =>
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
	// Loop lines have no terminus, so the top board's "for" points at the
	// nearest major stop ahead instead of the physical end of the station list.
	// Falls back to the service terminus when no major stop lies ahead.
	const circularBoundFor = route.circular
		? upcomingMajorStations(route, {
				fromIndex: journey.pos,
				direction: travelDirection,
				count: 1,
				serviceStopIndices,
				circular: true,
			})[0]
		: undefined;
	const destinationStation =
		circularBoundFor ?? route.stations[serviceDestinationIndex];
	const displayRoute = {
		...route,
		destJa: destinationStation.ja,
		destEn: destinationStation.en,
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
		if (!item.displayable)
			throw new Error("Cannot label a non-displayable announcement");
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
	const remainingMarqueeItems = useMemo(
		() =>
			shuffle(
				announcements
					.filter(
						(item) =>
							item.enabled && item.en.trim() && item.displayable,
					)
					.map((item) => {
						if (langMode === "auto") {
							return [
								item.ja.trim()
									? labelAnnouncementContent(item, "ja")
									: null,
								labelAnnouncementContent(item, "en"),
							].filter(Boolean);
						}
						// Derive the language from langMode rather than `lang`
						// so an auto-mode ja↔en toggle doesn't re-shuffle the
						// items and restart the lower marquee mid-scroll.
						return [
							labelAnnouncementContent(
								item,
								langMode === "en" ? "en" : "ja",
							),
						];
					}),
			).flat(),
		[announcements, langMode],
	);
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
		autoLanguageModes
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

	function beginAutoLeg(dir: number) {
		setJourney((current) =>
			beginJourneyLeg(current, dir, stateRef.current),
		);
	}

	function navigate(dir: number) {
		setAuto(false);
		setTravelDirection(dir);
		// Manual stepping walks a leg through three held phases, one per press:
		// depart → almost-arrive → arrived. Nothing auto-animates in between.
		setManualTravel(false);
		// The almost-arrive point aligns with the "next station" threshold so its
		// announcement fires; clamped off 0/1 so it stays distinct from the ends.
		const almostFrac = Math.min(
			0.99,
			Math.max(0.02, nextMarqueeThreshold / 100),
		);
		if (journey.phase === "at") {
			// 1) Waiting at a station → depart: begin the leg, held at its start.
			setJourney(navigateJourney(journey, dir, stateRef.current));
			return;
		}
		// Resolve the clicked direction first — pressing the opposite way flips
		// the leg — then advance one phase.
		const leg = navigateJourney(journey, dir, stateRef.current);
		if (leg.phase !== "approach") {
			setJourney(leg);
			return;
		}
		if (leg.progress < almostFrac) {
			// 2) Departed → almost-arrive: hold just short of the station.
			setJourney({ ...leg, progress: almostFrac });
			return;
		}
		// 3) Almost-arrive → arrived: complete the leg, looping so express-skipped
		// stops are stepped over just as an animated arrival would continue past.
		let next: Journey = leg;
		for (let guard = 0; next.phase === "approach" && guard < N; guard += 1) {
			const arrived = completeJourneyLeg(next, dir, stateRef.current);
			if (arrived === next) break;
			next = arrived;
		}
		setJourney(next);
	}

	// Auto travel advances real progress rather than a CSS-only transition, so pause freezes in place.
	useEffect(() => {
		if (journey.phase === "at") {
			if (!auto) return undefined;
			let nextDirection = travelDirection;
			if (
				!route.circular &&
				((journey.pos === serviceEndIndex && travelDirection > 0) ||
					(journey.pos === serviceStartIndex && travelDirection < 0))
			) {
				nextDirection = -travelDirection;
			}
			const id = setTimeout(() => {
				// Keep the destination direction and its arrival copy on the lower
				// marquee for the entire dwell. Only reverse when departure begins.
				if (nextDirection !== travelDirection)
					dispatch(setControl("travelDirection", nextDirection));
				beginAutoLeg(nextDirection);
			}, stationStayMs);
			return () => clearTimeout(id);
		}
		if (!auto && !manualTravel) return undefined;
		const tickMs = 50;
		const id = setInterval(() => {
			setJourney((j) => {
				if (j.phase !== "approach") return j;
				const progress = Math.min(
					1,
					j.progress + tickMs / travelDuration,
				);
				if (
					auto &&
					pauseAtPageBreak &&
					isPageBoundaryLeg &&
					j.progress < 0.5 &&
					progress >= 0.5
				) {
					dispatch(setControl("auto", false));
					return { ...j, progress: 0.499 };
				}
				if (progress === 1) {
					return completeJourneyLeg(
						j,
						travelDirection,
						stateRef.current,
					);
				}
				return { ...j, progress };
			});
		}, tickMs);
		return () => clearInterval(id);
	}, [
		auto,
		manualTravel,
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
		if (journey.phase === "at") setManualTravel(false);
	}, [journey.phase]);

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

	// Keep linear services inside their active segment as enabled stops change.
	// Circular services must still traverse skipped stations outside the first
	// and last enabled stops so the trail can complete before wrapping.
	useEffect(() => {
		if (
			!route.circular &&
			(journey.pos < serviceStartIndex || journey.pos > serviceEndIndex)
		)
			setJourney(stationedJourney(serviceStartIndex));
	}, [journey.pos, route.circular, serviceEndIndex, serviceStartIndex]);

	function pickLine(id: LineId) {
		const activePreset = presets.find(
			(preset) => preset.id === controls.presetId,
		);
		const matchingPreset = activePreset?.lineIds.includes(id)
			? activePreset
			: presets.find((preset) => preset.lineIds.includes(id));
		updateControl("presetId", matchingPreset?.id ?? "custom");
		setLineId(id);
		updateControl("serviceId", "local");
		setTravelDirection(1);
		setJourney(stationedJourney(0));
	}

	function pickPreset(id: SimulatorPresetId) {
		const preset = presets.find((item) => item.id === id);
		if (!preset) return;
		updateControl("presetId", id);
		const customMarqueePreset = marqueePresets.find(
			(item) => item.id === preset.marqueePresetId,
		);
		if (customMarqueePreset) {
			dispatch({
				type: "applyMarqueePlaylist",
				presetId: customMarqueePreset.id,
				items: customMarqueePreset.items,
			});
		} else {
			const builtinMarqueePreset = MARQUEE_CONTENT_PRESETS.find(
				(item) => item.id === preset.marqueePresetId,
			);
			if (builtinMarqueePreset)
				dispatch({
					type: "applyMarqueePlaylist",
					presetId: builtinMarqueePreset.id,
					items: builtinMarqueePreset.items.map((item) => ({
						...item,
						type: item.type as AnnouncementContent["type"],
						ja: item.ja ?? "",
						enabled: true,
					})),
				});
		}
		setLineId(preset.lineId);
		updateControl("serviceId", "local");
		setTravelDirection(1);
		setJourney(stationedJourney(0));
	}

	function addPreset() {
		const id = `preset-${Date.now().toString(36)}`;
		const marqueePresetId = `marquee-${id}`;
		const preset: SimulatorPreset = {
			id,
			label: `NEW PRESET ${presets.filter((item) => item.id.startsWith("preset-")).length + 1}`,
			lineId,
			lineIds: [lineId],
			marqueePresetId,
		};
		const items = controls.announcements.map((item) => ({ ...item }));
		setPresets((current) => [...current, preset]);
		setMarqueePresets((current) => [
			...current,
			{ id: marqueePresetId, label: preset.label, items },
		]);
		updateControl("presetId", id);
		dispatch({
			type: "applyMarqueePlaylist",
			presetId: marqueePresetId,
			items,
		});
	}

	function setPresetLabel(label: string) {
		if (!["shuika", "yamanote"].includes(controls.presetId))
			setPresets((current) => {
				const nextLabel = label || "UNTITLED PRESET";
				const edited = current.find(
					(preset) => preset.id === controls.presetId,
				);
				if (edited)
					setMarqueePresets((items) =>
						items.map((item) =>
							item.id === edited.marqueePresetId
								? { ...item, label: nextLabel }
								: item,
						),
					);
				return current.map((preset) =>
					preset.id === controls.presetId
						? { ...preset, label: nextLabel }
						: preset,
				);
			});
	}

	function togglePresetLine(id: LineId) {
		if (["shuika", "yamanote"].includes(controls.presetId)) return;
		setPresets((current) =>
			current.map((preset) => {
				if (preset.id !== controls.presetId) return preset;
				const included = preset.lineIds.includes(id);
				if (included && preset.lineIds.length === 1) return preset;
				const lineIds = included
					? preset.lineIds.filter((item) => item !== id)
					: [...preset.lineIds, id];
				return {
					...preset,
					lineIds,
					lineId: lineIds.includes(lineId) ? lineId : lineIds[0],
				};
			}),
		);
		const activePreset = presets.find(
			(preset) => preset.id === controls.presetId,
		);
		if (activePreset?.lineId === id && activePreset.lineIds.length > 1) {
			const nextLineId = activePreset.lineIds.find((item) => item !== id);
			if (nextLineId) {
				setLineId(nextLineId);
				updateControl("serviceId", "local");
				setTravelDirection(1);
				setJourney(stationedJourney(0));
			}
		}
	}

	function pickMarqueePreset(id: string) {
		const customPreset = marqueePresets.find((preset) => preset.id === id);
		if (customPreset) {
			dispatch({
				type: "applyMarqueePlaylist",
				presetId: customPreset.id,
				items: customPreset.items,
			});
			return;
		}
		const builtinPreset = MARQUEE_CONTENT_PRESETS.find(
			(preset) => preset.id === id,
		);
		if (!builtinPreset) return;
		dispatch({
			type: "applyMarqueePlaylist",
			presetId: builtinPreset.id,
			items: builtinPreset.items.map(
				(item: Omit<DisplayAnnouncement, "enabled">) => ({
					...item,
					type: item.type as AnnouncementContentType,
					ja: item.ja ?? "",
					enabled: true,
				}),
			),
		});
		setPresets((current) =>
			current.map((preset) =>
				preset.id === controls.presetId
					? { ...preset, marqueePresetId: id }
					: preset,
			),
		);
	}

	useEffect(() => {
		if (!controls.marqueePresetId.startsWith("marquee-")) return;
		setMarqueePresets((current) =>
			current.map((preset) =>
				preset.id === controls.marqueePresetId
					? {
							...preset,
							items: controls.announcements.map((item) => ({
								...item,
							})),
						}
					: preset,
			),
		);
	}, [controls.announcements, controls.marqueePresetId]);

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
			r.services = (r.services || []).filter((sv) => sv.id !== id);
			r.stations.forEach((station) => {
				if (station.skip)
					station.skip = station.skip.filter((x: string) => x !== id);
			});
		});
		if (serviceId === id) updateControl("serviceId", "local");
	};
	const setServiceField = (id: string, field: "ja" | "en", value: string) =>
		editRoute((r) => {
			const sv = (r.services || []).find((x) => x.id === id);
			if (sv) sv[field] = value;
		});
	const toggleServiceStop = (index: number) => {
		if (serviceId === "local") return;
		editRoute((r) => {
			const station = r.stations[index];
			station.skip = station.skip || [];
			const currentlyStops = !station.skip.includes(serviceId);
			const enabledCount = r.stations.filter(
				(candidate) => !candidate.skip?.includes(serviceId),
			).length;
			if (currentlyStops && enabledCount <= 1) return;
			station.skip = station.skip.includes(serviceId)
				? station.skip.filter((x: string) => x !== serviceId)
				: [...station.skip, serviceId];
		});
	};

	// ——— line editing (operates on the selected line's clone)
	function editRoute(mutator: (r: EditableRoute) => void) {
		setRoutes((prev) => {
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
			LINES[lineId].color = value;
			LINES[lineId].textOnColor = brightness > 160 ? "#111" : "#fff";
		} else {
			LINES[lineId][field] = value;
		}
		setLineRevision((revision) => revision + 1);
	};
	const addLine = () => {
		let lineNumber = 1;
		while (LINES[`LN${lineNumber}`]) lineNumber += 1;
		const id = `LN${lineNumber}`;
		const usedCodes = new Set(
			Object.keys(LINES).map((key) => LINES[key].code),
		);
		const code =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZ"
				.split("")
				.find((candidate) => !usedCodes.has(candidate)) ||
			`L${lineNumber}`;
		const colors = ["#0b7a75", "#c23c52", "#5b4bb7", "#b05d14", "#1677a8"];
		LINES[id] = {
			id,
			code,
			ja: `新路線${lineNumber}`,
			en: `New Line ${lineNumber}`,
			color: colors[(lineNumber - 1) % colors.length],
			textOnColor: "#fff",
		};
		setRoutes((previous) => ({
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
		updateControl("presetId", "custom");
		setTravelDirection(1);
		setJourney(stationedJourney(0));
		setShowEditor(true);
	};
	const setStationField = (i: number, f: string, v) =>
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
					nextMarqueeMessageVisible && announcementContents.currentAudioType !== "departure" ? annColor : "var(--paper)"
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
					presets,
					marqueePresets,
					pickPreset,
					addPreset,
					setPresetLabel,
					togglePresetLine,
					pickMarqueePreset,
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
					advance: navigate,
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
					isAudioClipAvailable:
						announcementContents.isAudioClipAvailable,
					audioQueue: announcementContents.audioQueue,
				}}
			/>
		</>
	);
}
