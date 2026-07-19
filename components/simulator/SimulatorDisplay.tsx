"use client";

import { TopBoard } from "@/components/display/TopBoard";
import { DoorIndicator } from "@/components/display/DoorIndicator";
import { RouteStrip } from "@/components/display/RouteStrip";
import { AlertOverlay } from "@/components/simulator/AlertOverlay";
import { LowerInfoBar } from "@/components/simulator/LowerInfoBar";
import type { Lang, Phase, Route, Station } from "@/types/metro";

interface SimulatorDisplayProps {
	route: Route & { circular?: boolean };
	serviceJa: string;
	serviceEn: string;
	serviceIsLocal: boolean;
	serviceOrigin?: Station;
	passing: boolean;
	skipStations: number[];
	trailStartIndex?: number;
	trailEndIndex?: number;
	pos: number;
	phase: Phase;
	progress: number;
	from: number | null;
	direction: number;
	lang: Lang;
	clock: React.ReactNode;
	showKatakana: boolean;
	stationNameMode: string;
	doorNoticeMs: number;
	doorNoticeWaitMs: number;
	followDirectionView: boolean;
	pageSize: number;
	remainingDistance: number | null;
	stationStayRemainingMs: number;
	showDistanceIndicator: boolean;
	showStationStayIndicator: boolean;
	showSpeedIndicator: boolean;
	speedKmh: number;
	travelDuration: number;
	monitorAlert: boolean;
	activeAlert: { primary: string; secondary: string } | null;
	alertScope: "marquee" | "lower" | "monitor";
	alertLeaving: boolean;
	tickerItems: string[];
	tickerColor: string;
	hasTransfers: boolean;
	transferExpanded: boolean;
	doorIndicatorVisible: boolean;
	onDoorIndicatorVisibleChange: (visible: boolean) => void;
}

export function SimulatorDisplay({
	route,
	serviceJa,
	serviceEn,
	serviceIsLocal,
	serviceOrigin,
	passing,
	skipStations,
	trailStartIndex,
	trailEndIndex,
	pos,
	phase,
	progress,
	from,
	direction,
	lang,
	clock,
	showKatakana,
	stationNameMode,
	doorNoticeMs,
	doorNoticeWaitMs,
	followDirectionView,
	pageSize,
	remainingDistance,
	stationStayRemainingMs,
	showDistanceIndicator,
	showStationStayIndicator,
	showSpeedIndicator,
	speedKmh,
	travelDuration,
	monitorAlert,
	activeAlert,
	alertScope,
	alertLeaving,
	tickerItems,
	tickerColor,
	hasTransfers,
	transferExpanded,
	doorIndicatorVisible,
	onDoorIndicatorVisibleChange,
}: SimulatorDisplayProps) {
	const alertMessages = activeAlert
		? [activeAlert.primary, activeAlert.secondary].filter(Boolean)
		: undefined;

	return (
		<div className="relative overflow-hidden rounded-3xl border-4 border-ink bg-[#e8e7dd] shadow-hard">
			{monitorAlert ? null : (
				<TopBoard
					route={route}
					serviceJa={serviceJa}
					serviceEn={serviceEn}
					serviceIsLocal={serviceIsLocal}
					serviceOrigin={serviceOrigin}
					passing={passing}
					pos={pos}
					phase={phase}
					lang={lang}
					clock={clock}
					car={6}
					showKatakana={showKatakana}
					stationNameMode={stationNameMode}
					doorSide={
						doorIndicatorVisible || passing
							? undefined
							: route.stations[pos].side
					}
				/>
			)}
			{monitorAlert ? null : (
				<div className="relative isolate bg-paper">
					<DoorIndicator
						side={route.stations[pos].side}
						phase={phase}
						lang={lang}
						noticeMs={doorNoticeMs}
						waitMs={doorNoticeWaitMs}
						onVisibleChange={onDoorIndicatorVisibleChange}
					/>
					<RouteStrip
						route={route}
						skipStations={skipStations}
						trailStartIndex={trailStartIndex}
						trailEndIndex={trailEndIndex}
						pos={pos}
						phase={phase}
						travelProgress={progress}
						fromPos={from ?? undefined}
						direction={direction}
						followDirectionView={followDirectionView}
						pageSize={pageSize}
						remainingDistance={
							showDistanceIndicator
								? (remainingDistance ?? undefined)
								: undefined
						}
						stationStayRemaining={
							showStationStayIndicator
								? stationStayRemainingMs
								: undefined
						}
						speedIndicator={
							showSpeedIndicator ? speedKmh : undefined
						}
						dwellMs={travelDuration}
						lang={lang}
						showKatakana={showKatakana}
						stationNameMode={stationNameMode}
						showDoorSideCue={
							phase === "at" && !doorIndicatorVisible
						}
					/>
				</div>
			)}
			{monitorAlert ? null : (
				<LowerInfoBar
					route={route}
					pos={pos}
					lang={lang}
					hasTransfers={hasTransfers}
					transferExpanded={transferExpanded}
					tickerItems={tickerItems}
					tickerColor={tickerColor}
					alertMessages={
						activeAlert && alertScope === "marquee"
							? alertMessages
							: undefined
					}
					alertLeaving={alertLeaving}
					lowerAlertMessages={
						activeAlert && alertScope === "lower"
							? alertMessages
							: undefined
					}
				/>
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
	);
}
