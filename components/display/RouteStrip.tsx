"use client";
import React from "react";
import { LINES, num } from "@/lib/metro-data";
import type { Route, Phase, Lang } from "@/types/metro";
import { ProgressRail } from "./ProgressRail";
import { DirectionIndicators } from "./DirectionIndicators";
import { TrailMarker } from "./TrailMarker";
import { NumPlate } from "./NumPlate";
import { BoundaryShiftText } from "./BoundaryShiftText";
import { StationReadings } from "./StationReadings";

interface RouteStripProps {
	// `circular` isn't in the shared Route type yet, but the runtime data may set it.
	route: Route & { circular?: boolean };
	pos: number;
	phase: Phase;
	travelProgress?: number;
	fromPos?: number;
	followDirectionView?: boolean;
	pageSize?: number;
	remainingDistance?: number;
	stationStayRemaining?: number;
	speedIndicator?: number;
	dwellMs?: number;
	lang?: Lang;
	showKatakana?: boolean;
	stationNameMode?: string;
	direction?: number;
}

// ——— horizontal route strip (Tokyu style) with animated train marker and paged long routes
export function RouteStrip({
	route,
	pos,
	phase,
	travelProgress,
	fromPos,
	followDirectionView = false,
	pageSize = 8,
	remainingDistance,
	stationStayRemaining,
	speedIndicator,
	dwellMs = 2600,
	lang = "ja",
	showKatakana = false,
	stationNameMode = "kanji",
	direction = 1,
}: RouteStripProps) {
	const L = LINES[route.line];
	const isEnglishName = stationNameMode === "en";
	const travelDirection = direction === -1 ? -1 : 1;
	const isReverse = travelDirection < 0;
	const flipView = followDirectionView && isReverse;
	const travelMotionDirection = isReverse ? "backward" : "forward";
	const hasTravelProgress =
		phase === "approach" &&
		typeof travelProgress === "number" &&
		Number.isFinite(travelProgress);
	const approachProgress = hasTravelProgress
		? Math.min(1, Math.max(0, travelProgress as number))
		: null;
	const hasRemainingDistance =
		phase === "approach" &&
		typeof remainingDistance === "number" &&
		Number.isFinite(remainingDistance);
	const distanceValue = Number(
		Math.max(0, remainingDistance || 0).toFixed(1),
	);
	const distanceLabel = hasRemainingDistance
		? lang === "ja"
			? `次駅まで ${distanceValue} KM`
			: `${distanceValue} KM TO NEXT`
		: null;
	const speedLabel =
		typeof speedIndicator === "number" && Number.isFinite(speedIndicator)
			? lang === "ja"
				? `速度 · ${speedIndicator} KM/H`
				: `SPEED · ${speedIndicator} KM/H`
			: null;
	const stayLabel =
		typeof stationStayRemaining === "number" &&
		Number.isFinite(stationStayRemaining) &&
		phase === "at"
			? lang === "ja"
				? `発車まで ${Math.ceil(stationStayRemaining / 1000)}秒`
				: `DEPARTS IN ${Math.ceil(stationStayRemaining / 1000)}S`
			: null;
	const PAGE_SIZE = Math.max(2, Math.floor(Number(pageSize) || 8));
	const pageCount = Math.ceil(route.stations.length / PAGE_SIZE);
	const targetPage = Math.floor(pos / PAGE_SIZE);

	const isCircularForwardWrap =
		pageCount > 1 &&
		route.circular &&
		!isReverse &&
		pos === 0 &&
		fromPos === route.stations.length - 1;
	const isCircularReverseWrap =
		pageCount > 1 &&
		route.circular &&
		isReverse &&
		pos === route.stations.length - 1 &&
		fromPos === 0;
	// Split travel into the first station of a page across both page views:
	// the departing page gets the first half, then the arriving page gets the second.
	const isPageBoundaryTravel =
		hasTravelProgress &&
		(isCircularForwardWrap ||
			isCircularReverseWrap ||
			(isReverse
				? pos < route.stations.length - 1 && (pos + 1) % PAGE_SIZE === 0
				: pos > 0 && pos % PAGE_SIZE === 0));
	const boundaryOldPage = isCircularForwardWrap
		? pageCount - 1
		: isCircularReverseWrap
			? 0
			: targetPage + (isReverse ? 1 : -1);
	const desiredPage =
		isPageBoundaryTravel && (approachProgress as number) < 0.5
			? boundaryOldPage
			: targetPage;
	const singlePageWrap =
		pageCount === 1 && pos === 0 && fromPos === route.stations.length - 1;

	// pageState bundles the displayed page + exit flag + current line so a line
	// switch always resets everything atomically in one setState call.
	const [pageState, setPageState] = React.useState({
		line: route.line,
		pageSize: PAGE_SIZE,
		displayPage: desiredPage,
		exiting: false,
		retreating: false,
		resetToken: 0,
		direction: "forward",
	});

	// Line or page capacity changed → reset the displayed page immediately.
	React.useEffect(() => {
		if (pageState.line !== route.line || pageState.pageSize !== PAGE_SIZE) {
			setTimeout(
				() =>
					setPageState({
						line: route.line,
						pageSize: PAGE_SIZE,
						displayPage: desiredPage,
						exiting: false,
						retreating: false,
						resetToken: 0,
						direction: "forward",
					}),
				0,
			);
		}
	}, [
		desiredPage,
		pageState.line,
		pageState.pageSize,
		route.line,
		PAGE_SIZE,
	]);

	// Cross-page navigation completes or clears the departing trail before handoff.
	React.useEffect(() => {
		if (pageState.line !== route.line) return;

		// A direction change cancels a pending forward completion at the current station.
		// The next leg begins from the trail's current fill rather than jumping to an edge.
		if (isReverse && pageState.exiting) {
			setTimeout(
				() =>
					setPageState((s) => ({
						...s,
						exiting: false,
						retreating: false,
						direction: "backward",
					})),
				0,
			);
			return;
		}

		// A progress-driven arrival at a page's first station owns its handoff:
		// it changes pages at halfway, after the old page has reached its edge.
		if (isPageBoundaryTravel) {
			if (
				pageState.displayPage !== desiredPage ||
				pageState.exiting ||
				pageState.retreating
			) {
				setTimeout(
					() =>
						setPageState((s) => ({
							...s,
							displayPage: desiredPage,
							exiting: false,
							retreating: false,
							direction: "forward",
						})),
					0,
				);
			}
			return;
		}

		const wrapsToFirstPage =
			pageCount > 1 &&
			route.circular &&
			pos === 0 &&
			pageState.displayPage === pageCount - 1;
		const needsForwardHandoff = wrapsToFirstPage || singlePageWrap;
		if (desiredPage < pageState.displayPage && !needsForwardHandoff) {
			if (!pageState.retreating) {
				setTimeout(
					() => setPageState((s) => ({ ...s, retreating: true })),
					0,
				);
			}
			return;
		}
		if (
			(desiredPage > pageState.displayPage || needsForwardHandoff) &&
			!pageState.exiting
		) {
			setTimeout(() => setPageState((s) => ({ ...s, exiting: true })), 0);
		}
	}, [
		desiredPage,
		isPageBoundaryTravel,
		isReverse,
		pos,
		pageCount,
		singlePageWrap,
		pageState.displayPage,
		pageState.exiting,
		pageState.retreating,
		pageState.line,
		route.line,
		route.circular,
	]);

	// Called by ProgressRail once the fill-to-100% transition finishes.
	const handleFillEnd = React.useCallback(() => {
		setPageState((s) => ({
			...s,
			displayPage:
				s.displayPage === pageCount - 1 ? 0 : s.displayPage + 1,
			exiting: false,
			resetToken: pageCount === 1 ? s.resetToken + 1 : s.resetToken,
			direction: "forward",
		}));
	}, [pageCount]);
	const handleClearEnd = React.useCallback(() => {
		setPageState((s) => ({
			...s,
			displayPage: s.displayPage - 1,
			retreating: false,
			direction: "backward",
		}));
	}, []);

	const { displayPage, exiting, retreating, resetToken } = pageState;
	const pageStart = displayPage * PAGE_SIZE;
	const stations = route.stations.slice(pageStart, pageStart + PAGE_SIZE);
	const pageEnd = pageStart + stations.length - 1;

	// Freeze on the departing page's terminal station before a page handoff.
	const displayPos = exiting
		? pageEnd
		: retreating
			? pageStart
			: Math.max(pageStart, Math.min(pos, pageEnd));
	const displayPhase = exiting || retreating ? "at" : phase;
	const pagePos = displayPos - pageStart;
	const nodeLayout = route.circular
		? "center"
		: pageCount === 1
			? "full"
			: pageStart === 0
				? "start"
				: pageEnd === route.stations.length - 1
					? "end"
					: "center";
	const visualNodeLayout = flipView
		? nodeLayout === "start"
			? "end"
			: nodeLayout === "end"
				? "start"
				: nodeLayout
		: nodeLayout;
	const stationFraction = (localIndex: number) => {
		if (nodeLayout === "full") return localIndex / (stations.length - 1);
		if (nodeLayout === "start") return localIndex / stations.length;
		if (nodeLayout === "end") return (localIndex + 1) / stations.length;
		return (localIndex + 0.5) / stations.length;
	};
	// During an approach, travel between the same visual positions used by station nodes.
	const followsTravelProgress = hasTravelProgress && !exiting && !retreating;
	const isBoundaryOldPage =
		isPageBoundaryTravel && displayPage === boundaryOldPage;
	const isBoundaryNewPage =
		isPageBoundaryTravel && displayPage === targetPage;
	let localFrac;
	if (followsTravelProgress && isBoundaryOldPage) {
		const sourceFrac = stationFraction(isReverse ? 0 : stations.length - 1);
		const edgeFrac = isReverse ? 0 : 1;
		localFrac =
			sourceFrac +
			(edgeFrac - sourceFrac) *
				Math.min(1, (approachProgress as number) * 2);
	} else if (followsTravelProgress && isBoundaryNewPage) {
		const targetFrac = stationFraction(pos - pageStart);
		const edgeFrac = isReverse ? 1 : 0;
		localFrac =
			edgeFrac +
			(targetFrac - edgeFrac) *
				Math.max(0, ((approachProgress as number) - 0.5) * 2);
	} else if (followsTravelProgress) {
		let sourceIndex = isReverse
			? (pos + 1) % route.stations.length
			: (pos - 1 + route.stations.length) % route.stations.length;
		if (!route.circular && !isReverse && pos === 0) sourceIndex = 0;
		if (!route.circular && isReverse && pos === route.stations.length - 1)
			sourceIndex = pos;
		const sourceFrac =
			sourceIndex >= pageStart && sourceIndex <= pageEnd
				? stationFraction(sourceIndex - pageStart)
				: isReverse
					? 1
					: 0;
		const targetFrac = stationFraction(pos - pageStart);
		localFrac =
			sourceFrac +
			(targetFrac - sourceFrac) * (approachProgress as number);
	} else {
		localFrac = stationFraction(pagePos);
	}
	localFrac = Math.max(0, Math.min(1, localFrac));
	const moveDur = followsTravelProgress ? 70 : Math.max(500, dwellMs - 150);
	// During a page handoff the triangle follows the completing/clearing trail to the rail edge.
	const markerFrac = exiting ? 1 : retreating ? 0 : localFrac;
	const visualTrailFrac = flipView ? 1 - localFrac : localFrac;
	const visualMarkerFrac = flipView ? 1 - markerFrac : markerFrac;
	const reverseFill = isReverse && !flipView;
	const railFillFrac = reverseFill ? 1 - visualTrailFrac : visualTrailFrac;
	const markerMoveDur = exiting || retreating ? 480 : moveDur;
	const motionDirection = exiting
		? "forward"
		: retreating
			? "backward"
			: travelMotionDirection;
	const showStationReadings = stationNameMode === "kanji" && showKatakana;

	return (
		<div
			className="relative overflow-hidden pt-11.5 px-15 pb-5"
			data-route-label-boundary
		>
			{/* Shown above the labels, alongside the page indicator when present. */}
			{distanceLabel ? (
				<div
					className="absolute top-3 left-15 inline-flex items-center py-1 px-2 border-2 rounded-sm bg-paper font-mono text-[11px] font-bold tracking-[0.08em] leading-none z-3"
					style={{ borderColor: L.color, color: L.color }}
				>
					{distanceLabel}
				</div>
			) : null}
			{speedLabel ? (
				<div
					className={[
						"absolute top-3 inline-flex items-center py-1 px-2 border-2 border-ink rounded-sm bg-acid text-ink font-mono text-[11px] font-bold tracking-[0.08em] leading-none z-3",
						distanceLabel ? "left-51.5" : "left-15",
					].join(" ")}
				>
					{speedLabel}
				</div>
			) : null}
			{stayLabel ? (
				<div
					className={[
						"absolute top-3 inline-flex items-center py-1 px-2 border-2 border-ink rounded-sm bg-orange text-ink font-mono text-[11px] font-bold tracking-[0.08em] leading-none z-3",
						distanceLabel && speedLabel
							? "left-90"
							: distanceLabel || speedLabel
								? "left-51.5"
								: "left-15",
					].join(" ")}
				>
					{stayLabel}
				</div>
			) : null}
			{/* page indicator */}
			{pageCount > 1 ? (
				<div
					className="absolute top-3.5 right-15 flex items-center gap-1.75 font-mono text-[10px] font-bold tracking-widest text-muted"
					aria-label={
						lang === "ja"
							? `${pageCount}ページ中 ${displayPage + 1}ページ`
							: `Page ${displayPage + 1} of ${pageCount}`
					}
				>
					{lang === "ja"
						? `${displayPage + 1}/${pageCount} ページ`
						: `PAGE ${displayPage + 1}/${pageCount}`}
					<span className="flex gap-1">
						{Array.from({ length: pageCount }, (_, i) => (
							<span
								key={i}
								className="w-1.75 h-1.75 rounded-pill"
								style={{
									background:
										i === displayPage ? L.color : "#d8d6cc",
									transition:
										"background .35s ease, transform .35s var(--ease-pop)",
									transform:
										i === displayPage
											? "scale(1.25)"
											: "scale(1)",
								}}
							/>
						))}
					</span>
				</div>
			) : null}
			{/* grey base rail */}
			<div
				key={`rail-${displayPage}`}
				className="absolute left-15 right-15 top-23 h-3 rounded-pill bg-[#d8d6cc]"
				style={{
					animation:
						pageCount > 1
							? "swipeIn .42s var(--ease-out) both"
							: "none",
				}}
			/>
			{/* colored progress rail — separate component so useLayoutEffect fires on each page mount */}
			<ProgressRail
				key={`progress-${displayPage}`}
				color={L.color}
				frac={railFillFrac}
				fillToEnd={exiting}
				clearToStart={retreating}
				resetToken={resetToken}
				onFillEnd={handleFillEnd}
				onClearEnd={handleClearEnd}
				moveDur={moveDur}
				direction={flipView ? "forward" : motionDirection}
				reverseFill={reverseFill}
			/>
			{/* train marker follows the same entry/retraction timing as the trail */}
			<TrailMarker
				key={`marker-${displayPage}-${resetToken}`}
				frac={visualMarkerFrac}
				direction={flipView ? "forward" : motionDirection}
				hidden={displayPhase === "at" && !exiting && !retreating}
				moveDur={markerMoveDur}
			/>
			{/* directional chevrons sit between nodes and mirror with reverse travel.
			    Every page-split stub (a rail segment leading to an adjacent page)
			    carries a chevron in both travel directions: continueForward is the
			    right-edge stub, continueBackward the left-edge stub. Under flipView
			    the visual sides swap, so the page tests swap with them. */}
			<DirectionIndicators
				count={stations.length}
				color={L.color}
				trailProgress={visualTrailFrac}
				reverseFill={reverseFill}
				layout={visualNodeLayout}
				reverse={isReverse && !flipView}
				continueForward={
					flipView ? displayPage > 0 : displayPage < pageCount - 1
				}
				continueBackward={
					flipView ? displayPage < pageCount - 1 : displayPage > 0
				}
			/>
			{/* station nodes */}
			<div
				key={`nodes-${displayPage}`}
				className="relative flex justify-between"
				style={{
					animation:
						pageCount > 1
							? "swipeIn .42s var(--ease-out) both"
							: "none",
				}}
			>
				{(flipView
					? stations.map((st, i) => ({ st, i })).reverse()
					: stations.map((st, i) => ({ st, i }))
				).map(({ st, i }, visualIndex) => {
					const stationIndex = pageStart + i;
					const isPast = isReverse
						? stationIndex > displayPos
						: stationIndex < displayPos;
					const current = stationIndex === displayPos;
					const arrived = current && displayPhase === "at";
					const cellPosition = (visualIndex + 0.5) / stations.length;
					const stationPosition =
						visualNodeLayout === "full" && stations.length > 1
							? visualIndex / (stations.length - 1)
							: visualNodeLayout === "start"
								? visualIndex / stations.length
								: visualNodeLayout === "end"
									? (visualIndex + 1) / stations.length
									: cellPosition;
					const nodeOffset =
						(stationPosition - cellPosition) *
						stations.length *
						100;
					let node: {
						className: string;
						borderColor?: string;
					};
					if (isPast)
						node = {
							className:
								"w-[15px] h-[15px] border-[3px] bg-[#bdbbb0] shadow-none",
							borderColor: L.color,
						};
					else if (arrived)
						node = {
							className:
								"w-[30px] h-7.5 border-[6px] border-ink bg-acid shadow-[0_0_0_5px_rgba(214,255,63,0.55)]",
						};
					else if (current)
						node = {
							className:
								"w-[26px] h-[26px] border-[4px] bg-white shadow-[0_0_0_5px_rgba(214,255,63,0.5)]",
							borderColor: L.color,
						};
					else
						node = {
							className:
								"w-[20px] h-[20px] border-[3px] bg-white shadow-none",
							borderColor: L.color,
						};
					return (
						<div
							key={i}
							className="flex flex-col items-center min-w-0"
							style={{
								width: `${100 / stations.length}%`,
								transform: nodeOffset
									? `translateX(${nodeOffset}%)`
									: "none",
							}}
						>
							{/* station name */}
							<div
								key={`label-${displayPage}-${stationIndex}-${stationNameMode}`}
								className="w-full"
							>
								<div
									// Keep label height + gap at 37px: the station-dot centre then
									// remains on the fixed rail centre (top: 92px) in every script phase.
									className="flex h-9 w-full flex-col items-center justify-end mb-0.25"
								>
									<BoundaryShiftText
										text={
											stationNameMode === "hiragana"
												? st.hira || st.ja
												: isEnglishName
													? st.en
												: st.ja
										}
										measurementKey={
											current ? "focused" : "regular"
										}
										textStyle={{
											fontFamily: "var(--font-body)",
											fontWeight: current ? 700 : 500,
											fontSize: !isEnglishName
												? current
													? 20
													: 15
												: current
													? 17
													: 13,
											color: current
												? "var(--ink)"
												: isPast
													? "#a7a59a"
													: "var(--text-muted)",
											lineHeight: 1,
										}}
									/>
									{showStationReadings && (
										<StationReadings
											station={st}
											visible
											compact={true}
											color={
												current
													? "var(--ink)"
													: isPast
														? "#a7a59a"
														: "var(--text-muted)"
											}
										/>
									)}
								</div>
							</div>
							{/* node dot */}
							<div className="h-7.5 flex items-center justify-center">
								<div
									className={[
										"rounded-pill z-2 transition-all duration-350 ease-pop",
										node.className,
										arrived
											? "animate-now-at-ring"
											: current
												? "animate-next-station-ring"
												: "",
									].join(" ")}
									style={
										node.borderColor
											? { borderColor: node.borderColor }
											: undefined
									}
								/>
							</div>
							{/* station number */}
							<div
								className="mt-2 font-mono text-[11px] font-bold tracking-[0.02em]"
								style={{ color: isPast ? "#b3b1a6" : L.color }}
							>
								{num(route.line, stationIndex)}
							</div>
							{/* transfer mini-dots */}
							<div className="flex gap-0.75 mt-1.25 min-h-3">
								{(st.xf || []).map((lid) => (
									<span
										key={lid}
										className="w-2.5 h-2.5 rounded-[3px]"
										style={{ background: LINES[lid].color }}
									/>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
