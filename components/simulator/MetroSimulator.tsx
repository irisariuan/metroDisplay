"use client";
/* Simulator engine + controls + mount */
import React from "react";
import { LINES, ROUTES, num } from "@/lib/metro-data";
import { Button, Switch } from "@/components/ds";
import { TopBoard } from "@/components/display/TopBoard";
import { DoorIndicator } from "@/components/display/DoorIndicator";
import { RouteStrip } from "@/components/display/RouteStrip";
import { TransferStrip } from "@/components/display/TransferStrip";
import { SPEED_PRESETS, DEFAULT_MARQUEE_CONTENT } from "@/lib/constants";
import { announcement } from "@/lib/announcement";
import { useClock } from "@/hooks/useClock";
import { Ticker } from "@/components/simulator/Ticker";
import { FullAlertMessage } from "@/components/simulator/FullAlertMessage";
import { AlertOverlay } from "@/components/simulator/AlertOverlay";
import { LineButton } from "@/components/simulator/LineButton";
import { EdInput } from "@/components/simulator/EdInput";
import { LineColorEditor } from "@/components/simulator/LineColorEditor";
import { LineEditor } from "@/components/simulator/LineEditor";
import type { LineId, Lang, Phase } from "@/types/metro";

const { useState, useEffect, useRef } = React;

interface Journey {
	pos: number;
	phase: Phase;
	progress: number;
	from: number | null;
}

export function MetroSimulator() {
	const [lineId, setLineId] = useState<LineId>("CS");
	const [journey, setJourney] = useState<Journey>({
		pos: 0,
		phase: "approach",
		progress: 0,
		from: null,
	});
	const [auto, setAuto] = useState(true);
	const [travelDirection, setTravelDirection] = useState(1); // 1 forward · -1 reverse
	const [speedKmh, setSpeedKmh] = useState<number>(SPEED_PRESETS.normal);
	const [simulationSpeed, setSimulationSpeed] = useState(100);
	const [stationStayMs, setStationStayMs] = useState(10000);
	const [langMode, setLangMode] = useState<"auto" | Lang>("auto"); // auto | ja | en
	const [lang, setLang] = useState<Lang>("ja");
	const [langMs, setLangMs] = useState(10000); // auto language switch interval
	const [doorNoticeMs, setDoorNoticeMs] = useState(10000);
	const [doorNoticeWaitMs, setDoorNoticeWaitMs] = useState(10000);
	const [pageSize, setPageSize] = useState(8);
	const [showHiragana, setShowHiragana] = useState(true);
	const [showKatakana, setShowKatakana] = useState(true);
	const [stationNameMode, setStationNameMode] = useState("kanji");
	const [alertText, setAlertText] = useState("Service update in progress");
	const [alertSecondText, setAlertSecondText] = useState("");
	const [alertScope, setAlertScope] = useState<"marquee" | "lower" | "monitor">(
		"marquee",
	); // marquee | lower | monitor
	const [alertActive, setAlertActive] = useState(false);
	const [alertLeaving, setAlertLeaving] = useState(false);
	const [delayNextMarqueeMessage, setDelayNextMarqueeMessage] = useState(true);
	const [nextMarqueeThreshold, setNextMarqueeThreshold] = useState(70);
	const [marqueeContent, setMarqueeContent] = useState<any[]>(() =>
		DEFAULT_MARQUEE_CONTENT.map((item) => ({ ...item, enabled: true })),
	);
	const [showDistanceIndicator, setShowDistanceIndicator] = useState(true);
	const [showSpeedIndicator, setShowSpeedIndicator] = useState(true);
	const [showStationStayIndicator, setShowStationStayIndicator] =
		useState(false);
	const [pauseAtPageBreak, setPauseAtPageBreak] = useState(false);
	const [followDirectionView, setFollowDirectionView] = useState(false);
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
	const [showEditor, setShowEditor] = useState(false);
	const [stationStayRemainingMs, setStationStayRemainingMs] = useState(0);
	const clock = useClock();

	const route = routes[lineId];
	const N = route.stations.length;
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
			? journey.pos > 0 || route.circular
			: journey.pos < N - 1 || route.circular;
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
		!hasIncomingLeg ||
		journey.progress >= nextMarqueeThreshold / 100;
	const labelMarqueeItem = (item: any, itemLang: Lang) => {
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
	const remainingMarqueeItems = marqueeContent
		.filter((item) => item.enabled && item.en.trim())
		.flatMap((item) => {
			if (langMode === "auto") {
				return [
					item.ja.trim() ? labelMarqueeItem(item, "ja") : null,
					labelMarqueeItem(item, "en"),
				].filter(Boolean);
			}
			return [labelMarqueeItem(item, lang)];
		});
	const stationAnnouncementItems =
		langMode === "auto"
			? [
					announcement(route, journey.pos, journey.phase, "ja"),
					announcement(route, journey.pos, journey.phase, "en"),
				]
			: [announcement(route, journey.pos, journey.phase, lang)];
	const tickerItems =
		nextMarqueeMessageVisible || !remainingMarqueeItems.length
			? stationAnnouncementItems
			: remainingMarqueeItems;
	const stateRef = useRef({ N, circular: route.circular });
	stateRef.current.N = N;
	stateRef.current.circular = !!route.circular;

	function advance(dir: number) {
		setJourney((j) => {
			const { N: n, circular } = stateRef.current;
			if (dir > 0) {
				if (j.phase === "approach")
					return { ...j, phase: "at" as Phase, progress: 1 };
				if (j.pos === n - 1 && !circular) return j;
				return {
					pos: (j.pos + 1) % n,
					phase: "approach" as Phase,
					progress: 0,
					from: j.pos,
				};
			}
			if (j.phase === "approach") {
				if (j.pos === 0 && !circular)
					return { ...j, phase: "at" as Phase, progress: 1 };
				return {
					pos: (j.pos - 1 + n) % n,
					phase: "at" as Phase,
					progress: 1,
					from: j.pos,
				};
			}
			if (j.pos === 0 && !circular) return j;
			return {
				pos: (j.pos - 1 + n) % n,
				phase: "approach" as Phase,
				progress: 0,
				from: j.pos,
			};
		});
	}

	// Auto travel advances real progress rather than a CSS-only transition, so pause freezes in place.
	useEffect(() => {
		if (!auto) return undefined;
		if (journey.phase === "at") {
			let nextDirection = travelDirection;
			if (
				!route.circular &&
				((journey.pos === N - 1 && travelDirection > 0) ||
					(journey.pos === 0 && travelDirection < 0))
			) {
				nextDirection = -travelDirection;
				setTravelDirection(nextDirection);
			}
			const id = setTimeout(() => advance(nextDirection), stationStayMs);
			return () => clearTimeout(id);
		}
		const tickMs = 50;
		const id = setInterval(() => {
			setJourney((j) => {
				if (j.phase !== "approach") return j;
				const progress = Math.min(1, j.progress + tickMs / travelDuration);
				if (
					pauseAtPageBreak &&
					isPageBoundaryLeg &&
					j.progress < 0.5 &&
					progress >= 0.5
				) {
					setAuto(false);
					return { ...j, progress: 0.499 };
				}
				return progress === 1
					? { ...j, phase: "at" as Phase, progress }
					: { ...j, progress };
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
		travelDirection,
		stationStayMs,
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

	// Station names treat phonetic Japanese as one language sequence:
	// kanji + katakana reading → hiragana → English.
	useEffect(() => {
		if (langMode !== "auto") {
			setLang(langMode);
			setStationNameMode(langMode === "en" ? "en" : "kanji");
			return undefined;
		}
		const modes = showHiragana ? ["kanji", "hiragana", "en"] : ["kanji", "en"];
		let modeIndex = 0;
		setLang("ja");
		setStationNameMode(modes[modeIndex]);
		const id = setInterval(() => {
			modeIndex = (modeIndex + 1) % modes.length;
			const nextMode = modes[modeIndex];
			setStationNameMode(nextMode);
			setLang(nextMode === "en" ? "en" : "ja");
		}, langMs);
		return () => clearInterval(id);
	}, [langMode, langMs, showHiragana]);

	// keep the train position valid when stations are added/removed
	useEffect(() => {
		if (journey.pos > N - 1)
			setJourney({
				pos: Math.max(0, N - 1),
				phase: "approach",
				progress: 0,
				from: null,
			});
	}, [N]);

	function pickLine(id: LineId) {
		setLineId(id);
		setTravelDirection(1);
		setJourney({ pos: 0, phase: "approach", progress: 0, from: null });
	}

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
			(LINES as any)[lineId].textOnColor = brightness > 160 ? "#111" : "#fff";
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
				.find((candidate) => !usedCodes.has(candidate)) || `L${lineNumber}`;
		const colors = [
			"#0b7a75",
			"#c23c52",
			"#5b4bb7",
			"#b05d14",
			"#1677a8",
		];
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
			r.stations[i][f] = f === "distance" ? Math.max(0, Number(v) || 0) : v;
		});
	const toggleSide = (i: number) =>
		editRoute((r) => {
			r.stations[i].side = r.stations[i].side === "L" ? "R" : "L";
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
			if (r.stations.length > 2) r.stations.splice(i, 1);
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
	const updateMarqueeContent = (index: number, field: string, value: any) =>
		setMarqueeContent((items) =>
			items.map((item, itemIndex) =>
				itemIndex === index ? { ...item, [field]: value } : item,
			),
		);
	const removeMarqueeContent = (index: number) =>
		setMarqueeContent((items) =>
			items.filter((_, itemIndex) => itemIndex !== index),
		);
	const addMarqueeContent = () =>
		setMarqueeContent((items) => [
			...items,
			{
				type: "notice",
				en: "New metro notice",
				ja: "",
				enabled: true,
			},
		]);

	const annColor = journey.phase === "at" ? "var(--acid)" : "var(--magenta-2)";

	return (
		<div className="relative z-[1] mx-auto max-w-[1240px] px-[22px] pt-[26px] pb-10">
			{/* masthead */}
			<div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
				<div>
					<div className="font-mono text-[12px] tracking-[.22em] text-acid">
						SHUIKA METRO · IN-CAR DISPLAY
					</div>
					<div className="font-display text-[46px] leading-[0.95] text-paper">
						水下地鐵 車内案内
					</div>
				</div>
				<div className="text-right font-mono text-[12px] tracking-[.14em] text-paper-2 opacity-70">
					<div>
						{journey.phase === "at" ? "STOPPED · ドア開" : "RUNNING · 走行中"}
					</div>
					<div>{auto ? "AUTO-PLAY" : "MANUAL"}</div>
				</div>
			</div>

			{/* ——— device / screen */}
			<div className="relative overflow-hidden rounded-[28px] border-[4px] border-ink bg-[#e8e7dd] shadow-hard">
				{monitorAlert ? null : (
					<TopBoard
						route={route}
						pos={journey.pos}
						phase={journey.phase}
						lang={lang}
						clock={clock}
						car={6}
						showKatakana={showKatakana}
						stationNameMode={stationNameMode}
					/>
				)}
				{monitorAlert ? null : (
					<div className="relative bg-paper">
						<DoorIndicator
							side={route.stations[journey.pos].side}
							phase={journey.phase}
							lang={lang}
							noticeMs={doorNoticeMs}
							waitMs={doorNoticeWaitMs}
						/>
						<RouteStrip
							route={route}
							pos={journey.pos}
							phase={journey.phase}
							travelProgress={journey.progress}
							fromPos={journey.from ?? undefined}
							direction={travelDirection}
							followDirectionView={followDirectionView}
							pageSize={pageSize}
							remainingDistance={
								showDistanceIndicator ? (remainingDistance ?? undefined) : undefined
							}
							stationStayRemaining={
								showStationStayIndicator ? stationStayRemainingMs : undefined
							}
							speedIndicator={showSpeedIndicator ? speedKmh : undefined}
							dwellMs={travelDuration}
							lang={lang}
							showKatakana={showKatakana}
							stationNameMode={stationNameMode}
						/>
					</div>
				)}
				{/* bottom info bar: transfers + ticker (fixed height so language never shifts layout) */}
				{monitorAlert ? null : (
					<div className="relative flex h-[76px] items-stretch gap-0 overflow-hidden border-t-[3px] border-t-ink">
						<div className="flex min-w-0 flex-none w-[280px] items-center overflow-hidden border-r-[3px] border-r-ink bg-paper-2 px-[18px] py-2">
							{route.stations[journey.pos].xf &&
							route.stations[journey.pos].xf.length ? (
								<TransferStrip route={route} pos={journey.pos} lang={lang} />
							) : (
								<span
									key={`no-transfer-${journey.pos}-${lang}`}
									className="font-mono text-[12px] tracking-[.12em] text-muted"
									style={{ animation: "swipeIn .35s var(--ease-out) both" }}
								>
									{lang === "ja" ? "乗換なし" : "NO TRANSFER"}
								</span>
							)}
						</div>
						<Ticker
							items={tickerItems}
							color={nextMarqueeMessageVisible ? annColor : "var(--paper)"}
							alertMessages={
								activeAlert && alertScope === "marquee"
									? ([activeAlert.primary, activeAlert.secondary].filter(
											Boolean,
										) as string[])
									: undefined
							}
							alertLeaving={alertLeaving}
						/>
						{/* LOWER is a dedicated, full-width marquee broadcast rather than a
						    message inserted into the ordinary text ticker. */}
						{activeAlert && alertScope === "lower" ? (
							<div className="absolute inset-0 z-20 flex">
								<Ticker
									items={[]}
									color="var(--ink)"
									background="var(--magenta)"
									borderTop="none"
									separateAlertLanguages={true}
									lang={lang}
									alertMessages={
										[activeAlert.primary, activeAlert.secondary].filter(
											Boolean,
										) as string[]
									}
									alertLeaving={alertLeaving}
								/>
							</div>
						) : null}
					</div>
				)}
				{activeAlert && alertScope === "monitor" ? (
					<AlertOverlay
						message={activeAlert.primary}
						secondMessage={activeAlert.secondary}
						full={true}
						leaving={alertLeaving}
						lang={lang}
					/>
				) : null}
			</div>

			{/* ——— controls */}
			<div className="mt-[22px] flex flex-col gap-4 rounded-[18px] border-[3px] border-ink bg-paper p-[18px] shadow-hard-s">
				{/* line picker */}
				<div>
					<div className="mb-2 flex flex-wrap items-center justify-between gap-[10px]">
						<div className="font-mono text-[12px] tracking-[.14em] text-muted">
							LINE · 路線
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								className="lc-btn"
								onClick={addLine}
								style={{ background: "var(--acid)", color: "var(--ink)", fontSize: 12 }}
							>
								+ ADD LINE
							</button>
							<button
								className="lc-btn"
								onClick={() => setShowEditor((v) => !v)}
								style={{
									background: showEditor ? "var(--acid)" : "var(--paper)",
									color: "var(--ink)",
									fontSize: 12,
								}}
							>
								{showEditor ? "✕ CLOSE EDITOR" : "✎ EDIT LINE"}
							</button>
						</div>
					</div>
					<div className="flex flex-wrap gap-[10px]">
						{Object.keys(LINES).map((id) => (
							<LineButton
								key={id}
								lineId={id as LineId}
								active={id === lineId}
								onClick={() => pickLine(id as LineId)}
							/>
						))}
					</div>
				</div>
				{showEditor ? (
					<LineEditor
						route={route}
						lineId={lineId}
						setLineField={setLineField}
						setStationField={setStationField}
						toggleSide={toggleSide}
						toggleXfer={toggleXfer}
						addStation={addStation}
						removeStation={removeStation}
						moveStation={moveStation}
						setDest={setDest}
						toggleCircular={toggleCircular}
					/>
				) : null}
				{/* transport + options */}
				<div className="grid grid-cols-2 items-stretch gap-3">
					{/* transport */}
					<div
						className="rounded-[10px] border-[3px] border-ink bg-acid p-3 text-ink"
						style={{ boxShadow: "4px 4px 0 var(--magenta)" }}
					>
						<div className="mb-2 font-mono text-[12px] tracking-[.14em] text-muted">
							TRAIN
						</div>
						<div className="grid grid-cols-3 items-center gap-[6px]">
							<Button
								variant="ghost"
								size="s"
								onClick={() => {
									setAuto(false);
									setTravelDirection(-1);
									advance(-1);
								}}
							>
								PREV
							</Button>
							<Button
								variant={auto ? "primary" : "accent"}
								size="m"
								onClick={() => setAuto((a) => !a)}
							>
								{auto ? "PAUSE" : "PLAY"}
							</Button>
							<Button
								variant="ghost"
								size="s"
								onClick={() => {
									setAuto(false);
									setTravelDirection(1);
									advance(1);
								}}
							>
								NEXT
							</Button>
						</div>
					</div>
					{/* speed */}
					<div
						className="rounded-[10px] border-[3px] border-ink bg-blue p-3"
						style={{ boxShadow: "4px 4px 0 var(--ink)" }}
					>
						<div className="mb-2 font-mono text-[12px] tracking-[.14em] text-muted">
							SPEED
						</div>
						<div className="grid grid-cols-3 gap-[6px]">
							{Object.entries(SPEED_PRESETS).map(([preset, kmh]) => (
								<button
									key={preset}
									className="lc-btn whitespace-nowrap uppercase"
									onClick={() => setSpeedKmh(kmh)}
									style={{
										background: speedKmh === kmh ? "var(--ink)" : "var(--paper)",
										color: speedKmh === kmh ? "var(--paper)" : "var(--ink)",
										padding: "8px 4px",
										fontSize: 10,
									}}
								>
									{`${kmh} KM/H`}
								</button>
							))}
						</div>
						<div className="mt-[10px] flex items-center gap-2">
							<input
								type="range"
								className="switch-range flex-1 w-full"
								min={10}
								max={140}
								step={5}
								value={speedKmh}
								aria-label="Train speed in kilometres per hour"
								onChange={(ev) => setSpeedKmh(Number(ev.target.value))}
								style={
									{ "--range-fill": `${((speedKmh - 10) / 130) * 100}%` } as React.CSSProperties
								}
							/>
							<output
								className="min-w-[54px] rounded-[6px] border-2 border-ink bg-magenta px-[7px] py-1 text-center font-mono text-[12px] font-bold text-ink"
								style={{ boxShadow: "2px 2px 0 var(--ink)" }}
							>
								{`${speedKmh} KM/H`}
							</output>
						</div>
						<div className="mt-[10px] flex items-center justify-between border-t-[2px] border-t-ink pt-2">
							<span className="font-mono text-[10px] font-bold tracking-[.08em]">
								SIMULATION
							</span>
							<output
								className="min-w-[54px] rounded-[6px] border-2 border-ink bg-magenta px-[7px] py-1 text-center font-mono text-[12px] font-bold text-ink"
								style={{ boxShadow: "2px 2px 0 var(--ink)" }}
							>
								{`${simulationSpeed}X`}
							</output>
						</div>
						<input
							type="range"
							className="switch-range w-full"
							min={1}
							max={100}
							step={1}
							value={simulationSpeed}
							aria-label="Simulation playback speed"
							onChange={(ev) => setSimulationSpeed(Number(ev.target.value))}
							style={
								{ "--range-fill": `${((simulationSpeed - 1) / 99) * 100}%` } as React.CSSProperties
							}
						/>
					</div>
					{/* language */}
					<div
						className="col-span-full rounded-[10px] border-[3px] border-ink bg-violet p-3"
						style={{ boxShadow: "4px 4px 0 var(--ink)" }}
					>
						<div className="mb-2 font-mono text-[12px] tracking-[.14em] text-muted">
							LANGUAGE
						</div>
						<div className="flex gap-2">
							{(
								[
									["auto", "AUTO"],
									["ja", "日本語"],
									["en", "EN"],
								] as const
							).map(([m, lbl]) => (
								<button
									key={m}
									className="lc-btn"
									onClick={() => setLangMode(m)}
									style={{
										background: langMode === m ? "var(--violet)" : "var(--paper)",
										color: langMode === m ? "#fff" : "var(--ink)",
										fontSize: 12,
									}}
								>
									{lbl}
								</button>
							))}
						</div>
						<div
							className="mt-3 border-t-[3px] border-t-ink pt-[10px]"
							style={{
								opacity: langMode === "auto" ? 1 : 0.4,
								pointerEvents: langMode === "auto" ? "auto" : "none",
							}}
						>
							<div className="mb-2 flex items-center justify-between gap-3">
								<div className="font-mono text-[12px] tracking-[.14em] text-paper">
									SWITCH EVERY
								</div>
								<output
									className="min-w-[54px] rounded-[6px] border-2 border-ink bg-magenta px-[7px] py-1 text-center font-mono text-[12px] font-bold text-ink"
									style={{ boxShadow: "2px 2px 0 var(--ink)" }}
								>
									{`${(langMs / 1000).toFixed(0)}S`}
								</output>
							</div>
							<input
								type="range"
								className="switch-range w-full"
								min={1000}
								max={60000}
								step={1000}
								value={langMs}
								aria-label="Language switch interval"
								onChange={(ev) => setLangMs(Number(ev.target.value))}
								style={
									{ "--range-fill": `${(langMs - 1000) / 590}%` } as React.CSSProperties
								}
							/>
							<div className="mt-1 flex w-full justify-between font-mono text-[10px] tracking-[.08em] text-paper">
								<span>1S</span>
								<span>60S</span>
							</div>
						</div>
					</div>
					{/* display settings */}
					<section
						className="col-span-full rounded-[10px] border-[3px] border-ink bg-paper-2 p-3"
						style={{ boxShadow: "4px 4px 0 var(--blue)" }}
					>
						<div className="mb-[10px] font-display text-[28px] leading-[0.85] text-ink">
							DISPLAY SETTINGS
						</div>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<div className="mb-[7px] flex justify-between gap-2 font-mono text-[11px] font-bold tracking-[.1em]">
									<span>STATIONS PER PAGE</span>
									<output
										className="min-w-[54px] rounded-[6px] border-2 border-ink bg-magenta px-[7px] py-1 text-center font-mono text-[12px] font-bold text-ink"
										style={{ boxShadow: "2px 2px 0 var(--ink)" }}
									>
										{pageSize}
									</output>
								</div>
								<input
									type="range"
									className="switch-range"
									min={4}
									max={12}
									step={1}
									value={pageSize}
									aria-label="Maximum stations per page"
									onChange={(ev) => setPageSize(Number(ev.target.value))}
									style={
										{ "--range-fill": `${((pageSize - 4) / 8) * 100}%` } as React.CSSProperties
									}
								/>
								<div className="mt-1 flex w-[220px] justify-between font-mono text-[10px] tracking-[.08em] text-muted">
									<span>4</span>
									<span>12</span>
								</div>
							</div>
							<div className="flex flex-col gap-3">
								<div>
									<div className="mb-[7px] flex justify-between gap-2 font-mono text-[11px] font-bold tracking-[.1em]">
										<span>DOOR POP-UP TIME</span>
										<output
											className="min-w-[54px] rounded-[6px] border-2 border-ink bg-magenta px-[7px] py-1 text-center font-mono text-[12px] font-bold text-ink"
											style={{ boxShadow: "2px 2px 0 var(--ink)" }}
										>
											{`${(doorNoticeMs / 1000).toFixed(0)}S`}
										</output>
									</div>
									<input
										type="range"
										className="switch-range"
										min={1000}
										max={60000}
										step={1000}
										value={doorNoticeMs}
										aria-label="Door pop-up visible duration"
										onChange={(ev) => setDoorNoticeMs(Number(ev.target.value))}
										style={
											{ "--range-fill": `${(doorNoticeMs - 1000) / 590}%` } as React.CSSProperties
										}
									/>
									<div className="mt-1 flex w-[220px] justify-between font-mono text-[10px] tracking-[.08em] text-muted">
										<span>1S</span>
										<span>60S</span>
									</div>
								</div>
								<div className="border-t-[2px] border-t-ink pt-[10px]">
									<div className="mb-[7px] flex justify-between gap-2 font-mono text-[11px] font-bold tracking-[.1em]">
										<span>WAIT BEFORE POP-UP</span>
										<output
											className="rounded-[6px] border-2 border-ink bg-blue px-[7px] py-1 text-center font-mono text-[12px] font-bold text-paper"
											style={{ boxShadow: "2px 2px 0 var(--ink)", minWidth: 54 }}
										>
											{`${(doorNoticeWaitMs / 1000).toFixed(0)}S`}
										</output>
									</div>
									<input
										type="range"
										className="switch-range"
										min={1000}
										max={60000}
										step={1000}
										value={doorNoticeWaitMs}
										aria-label="Seconds to wait before the door pop-up returns"
										onChange={(ev) => setDoorNoticeWaitMs(Number(ev.target.value))}
										style={
											{
												"--range-fill": `${(doorNoticeWaitMs - 1000) / 590}%`,
											} as React.CSSProperties
										}
									/>
									<div className="mt-1 flex w-[220px] justify-between font-mono text-[10px] tracking-[.08em] text-muted">
										<span>1S</span>
										<span>60S</span>
									</div>
								</div>
							</div>
							<div>
								<div className="mb-[7px] flex justify-between gap-2 font-mono text-[11px] font-bold tracking-[.1em]">
									<span>STAY AT STATION</span>
									<output
										className="min-w-[54px] rounded-[6px] border-2 border-ink bg-magenta px-[7px] py-1 text-center font-mono text-[12px] font-bold text-ink"
										style={{ boxShadow: "2px 2px 0 var(--ink)" }}
									>
										{`${(stationStayMs / 1000).toFixed(0)}S`}
									</output>
								</div>
								<input
									type="range"
									className="switch-range"
									min={5000}
									max={600000}
									step={5000}
									value={stationStayMs}
									aria-label="Stay time at station"
									onChange={(ev) => setStationStayMs(Number(ev.target.value))}
									style={
										{
											"--range-fill": `${(stationStayMs - 5000) / 5950}%`,
										} as React.CSSProperties
									}
								/>
								<div className="mt-1 flex w-[220px] justify-between font-mono text-[10px] tracking-[.08em] text-muted">
									<span>5S</span>
									<span>600S</span>
								</div>
							</div>
						</div>
						<div className="mt-[14px] flex flex-wrap gap-[14px] border-t-[3px] border-t-ink pt-[10px]">
							<Switch
								checked={showDistanceIndicator}
								onChange={setShowDistanceIndicator}
								label="KM TO NEXT"
							/>
							<Switch
								checked={showSpeedIndicator}
								onChange={setShowSpeedIndicator}
								label="SPEED"
							/>
							<Switch
								checked={showStationStayIndicator}
								onChange={setShowStationStayIndicator}
								label="REMAINING STAY TIME"
							/>
							<Switch
								checked={showHiragana}
								onChange={setShowHiragana}
								label="INCLUDE HIRAGANA IN AUTO LOOP"
							/>
							<Switch
								checked={showKatakana}
								onChange={setShowKatakana}
								label="SHOW KATAKANA WITH KANJI"
							/>
							<Switch
								checked={followDirectionView}
								onChange={setFollowDirectionView}
								label="FOLLOW DIRECTION VIEW"
							/>
						</div>
					</section>
					{/* lower marquee programming */}
					<section
						className="col-span-full rounded-[10px] border-[3px] border-ink bg-blue p-[14px] text-ink"
						style={{
							boxShadow: "6px 6px 0 var(--ink)",
							backgroundImage:
								"radial-gradient(rgba(14,14,18,.3) 1px, transparent 1.3px)",
							backgroundSize: "9px 9px",
						}}
					>
						<div className="mb-3 inline-block rounded-[0px] border-2 border-ink bg-acid px-[10px] py-[6px] font-display text-[28px] leading-[0.85] text-ink shadow-[3px_3px_0_var(--ink)]">
							LOWER MARQUEE
						</div>
						<div
							className="grid items-start gap-4"
							style={{ gridTemplateColumns: "minmax(230px, 1fr) minmax(260px, 2fr)" }}
						>
							<div
								className="flex flex-col gap-[10px] rounded-[8px] border-[3px] border-ink bg-paper p-3 text-ink"
								style={{ boxShadow: "4px 4px 0 var(--ink)" }}
							>
								<Switch
									checked={delayNextMarqueeMessage}
									onChange={setDelayNextMarqueeMessage}
									label="DELAY NEXT-STATION MESSAGE"
								/>
								<div
									style={{
										opacity: delayNextMarqueeMessage ? 1 : 0.45,
										pointerEvents: delayNextMarqueeMessage ? "auto" : "none",
									}}
								>
									<div className="mb-[7px] flex justify-between gap-2 font-mono text-[11px] font-bold tracking-[.08em]">
										<span>SHOW NEXT AFTER</span>
										<output
											className="rounded-[4px] border-2 border-ink bg-acid px-[6px] py-[3px] font-mono font-bold text-ink"
											style={{ boxShadow: "2px 2px 0 var(--ink)" }}
										>
											{`${nextMarqueeThreshold}% OF LEG`}
										</output>
									</div>
									<input
										type="range"
										className="switch-range w-full"
										min={0}
										max={100}
										step={5}
										value={nextMarqueeThreshold}
										aria-label="Next station marquee threshold"
										onChange={(ev) =>
											setNextMarqueeThreshold(Number(ev.target.value))
										}
										style={
											{ "--range-fill": `${nextMarqueeThreshold}%` } as React.CSSProperties
										}
									/>
									<p className="mt-[7px] font-body text-[12px] leading-[1.3] text-muted">
										Ads and Metro notices hold the ticker until this share of the
										current leg is complete.
									</p>
								</div>
							</div>
							<div
								className="min-w-0 rounded-[8px] border-[3px] border-ink bg-orange p-3 text-ink"
								style={{ boxShadow: "4px 4px 0 var(--ink)" }}
							>
								<div className="mb-[7px] flex items-center justify-between gap-[10px]">
									<span className="font-mono text-[11px] font-bold tracking-[.1em] text-ink">
										CONTENT PLAYLIST · ENGLISH + OPTIONAL JAPANESE
									</span>
									<button
										className="lc-btn"
										onClick={addMarqueeContent}
										style={{
											padding: "5px 9px",
											background: "var(--acid)",
											color: "var(--ink)",
											fontSize: 11,
										}}
									>
										+ ADD ITEM
									</button>
								</div>
								<div className="flex max-h-[260px] flex-col gap-[6px] overflow-y-auto pr-[3px]">
									{marqueeContent.map((item, index) => (
										<div
											key={index}
											className="grid items-center gap-[6px] rounded-[7px] border-2 border-ink bg-paper-2 p-[6px] text-ink"
											style={{
												gridTemplateColumns:
													"auto 70px minmax(170px, 1fr) minmax(170px, 1fr) auto",
												boxShadow: "2px 2px 0 var(--ink)",
											}}
										>
											<Switch
												checked={item.enabled}
												onChange={(enabled: boolean) =>
													updateMarqueeContent(index, "enabled", enabled)
												}
												label=""
											/>
											<select
												value={item.type}
												aria-label="Marquee content type"
												onChange={(ev) =>
													updateMarqueeContent(index, "type", ev.target.value)
												}
												className="w-full rounded-[5px] border-2 border-ink bg-paper p-[6px] font-mono text-[10px] font-bold text-ink"
											>
												<option value="ad">AD</option>
												<option value="notice">NOTICE</option>
											</select>
											<input
												value={item.en}
												placeholder="English message"
												aria-label={`English marquee item ${index + 1}`}
												onChange={(ev) =>
													updateMarqueeContent(index, "en", ev.target.value)
												}
												className="w-full min-w-0 rounded-[5px] border-2 border-ink bg-paper px-2 py-[6px] font-body font-semibold text-ink"
											/>
											<input
												value={item.ja}
												placeholder="日本語（任意）"
												aria-label={`Japanese marquee item ${index + 1}`}
												onChange={(ev) =>
													updateMarqueeContent(index, "ja", ev.target.value)
												}
												className="w-full min-w-0 rounded-[5px] border-2 border-ink bg-paper px-2 py-[6px] font-body font-semibold text-ink"
											/>
											<button
												className="lc-btn"
												onClick={() => removeMarqueeContent(index)}
												title="Remove playlist item"
												aria-label={`Remove marquee item ${index + 1}`}
												style={{
													padding: "4px 9px",
													background: "var(--paper)",
													color: "var(--ink)",
													fontSize: 13,
												}}
											>
												✕
											</button>
										</div>
									))}
								</div>
							</div>
						</div>
					</section>
					{/* running controls */}
					<section
						className="col-span-full rounded-[10px] border-[3px] border-ink bg-acid p-3"
						style={{ boxShadow: "4px 4px 0 var(--ink)" }}
					>
						<div className="mb-[10px] font-display text-[28px] leading-[0.85]">
							RUNNING CONTROLS
						</div>
						<div
							className="grid items-center gap-3"
							style={{ gridTemplateColumns: "minmax(240px, 1fr) repeat(3, auto)" }}
						>
							<div className="flex items-center justify-between gap-2 rounded-[6px] border-2 border-ink bg-paper p-2">
								<span className="font-mono text-[10px] font-bold tracking-[.1em]">
									RUN DIRECTION
								</span>
								<div className="flex gap-[5px]">
									<button
										onClick={() => setTravelDirection(1)}
										className="cursor-pointer rounded-[5px] border-2 border-ink px-[7px] py-[5px] font-mono text-[10px] font-bold"
										style={{
											background: travelDirection > 0 ? "var(--blue)" : "var(--paper)",
											color: travelDirection > 0 ? "#fff" : "var(--ink)",
										}}
									>
										FORWARD ››
									</button>
									<button
										onClick={() => setTravelDirection(-1)}
										className="cursor-pointer rounded-[5px] border-2 border-ink px-[7px] py-[5px] font-mono text-[10px] font-bold"
										style={{
											background: travelDirection < 0 ? "var(--violet)" : "var(--paper)",
											color: travelDirection < 0 ? "#fff" : "var(--ink)",
										}}
									>
										‹‹ REVERSE
									</button>
								</div>
							</div>
							<Switch
								checked={pauseAtPageBreak}
								onChange={setPauseAtPageBreak}
								label="PAUSE AT PAGE BREAK"
							/>
						</div>
					</section>
					{/* alert system — a high-contrast broadcast console */}
					<section
						className="col-span-full overflow-hidden rounded-[12px] border-[3px] border-ink bg-paper"
						style={{ boxShadow: "6px 6px 0 var(--ink)", minWidth: 310 }}
					>
						<div
							className="relative border-b-[3px] border-b-ink bg-magenta p-[12px_14px] text-ink"
							style={{
								backgroundImage:
									"radial-gradient(rgba(14,14,18,.2) 1px, transparent 1.3px)",
								backgroundSize: "9px 9px",
							}}
						>
							<div className="relative flex items-start justify-between gap-3">
								<div>
									<div className="font-mono text-[10px] font-bold tracking-[.16em]">
										ONBOARD CONTROL
									</div>
									<div className="font-display text-[32px] leading-[0.85] tracking-[.02em]">
										BROADCAST
									</div>
								</div>
								<span
									className="border-2 border-ink px-[7px] py-1 font-mono text-[10px] font-bold tracking-[.08em]"
									style={{ background: alertActive ? "var(--acid)" : "var(--paper)" }}
								>
									{alertActive ? "LIVE" : "STANDBY"}
								</span>
							</div>
						</div>
						<div className="flex flex-col gap-[10px] p-3">
							<label className="flex flex-col gap-[5px] font-mono text-[10px] font-bold tracking-[.12em] text-muted">
								PRIMARY MESSAGE
								<input
									value={alertText}
									onChange={(ev) => setAlertText(ev.target.value)}
									placeholder="ALERT MESSAGE"
									aria-label="Primary alert message"
									className="w-full rounded-[6px] border-[3px] border-ink bg-paper-2 px-[10px] py-[9px] font-body font-bold text-ink"
								/>
							</label>
							<label className="flex flex-col gap-[5px] font-mono text-[10px] font-bold tracking-[.12em] text-muted">
								SECOND LANGUAGE · OPTIONAL
								<input
									value={alertSecondText}
									onChange={(ev) => setAlertSecondText(ev.target.value)}
									placeholder="SECOND LANGUAGE MESSAGE"
									aria-label="Second language alert message"
									className="w-full rounded-[6px] border-[3px] border-ink bg-paper-2 px-[10px] py-[9px] font-body font-bold text-ink"
								/>
							</label>
							<div className="font-mono text-[10px] font-bold tracking-[.12em] text-muted">
								DISPLAY TARGET
							</div>
							<div className="grid grid-cols-3 gap-[6px]">
								{(
									[
										["marquee", "TEXT"],
										["lower", "LOWER"],
										["monitor", "SCREEN"],
									] as const
								).map(([scope, label]) => (
									<button
										key={scope}
										onClick={() => setAlertScope(scope)}
										className="cursor-pointer rounded-[6px] border-[3px] border-ink p-[6px] font-mono text-[10px] font-bold tracking-[.08em]"
										style={{
											minHeight: 46,
											background:
												alertScope === scope ? "var(--violet)" : "var(--paper-2)",
											color: alertScope === scope ? "#fff" : "var(--ink)",
											boxShadow: alertScope === scope ? "3px 3px 0 var(--ink)" : "none",
											transition: "transform var(--dur-fast) var(--ease-pop)",
										}}
									>
										{label}
									</button>
								))}
							</div>
							<div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t-[3px] border-t-ink pt-[10px]">
								<button
									className="lc-btn justify-center"
									onClick={() => {
										setAlertLeaving(false);
										setAlertActive(true);
									}}
									disabled={!alertText.trim()}
									style={{ background: "var(--acid)", color: "var(--ink)", fontSize: 12 }}
								>
									{alertActive ? "UPDATE ALERT" : "SEND ALERT"}
								</button>
								<button
									className="lc-btn"
									onClick={clearAlert}
									disabled={!alertActive || alertLeaving}
									style={{ padding: "9px 12px", background: "var(--ink)", color: "var(--paper)", fontSize: 11 }}
								>
									CLEAR
								</button>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
