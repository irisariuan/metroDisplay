"use client";

import { TopBoard } from "@/components/display/TopBoard";
import { DoorIndicator } from "@/components/display/DoorIndicator";
import { RouteStrip } from "@/components/display/RouteStrip";
import { AlertOverlay } from "@/components/simulator/AlertOverlay";
import { LowerInfoBar } from "@/components/simulator/LowerInfoBar";
import type { Lang, Phase } from "@/types/metro";

interface SimulatorDisplayProps {
	route: any;
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
	onToggleTransferExpanded: () => void;
}

export function SimulatorDisplay({
	route, pos, phase, progress, from, direction, lang, clock, showKatakana,
	stationNameMode, doorNoticeMs, doorNoticeWaitMs, followDirectionView,
	pageSize, remainingDistance, stationStayRemainingMs, showDistanceIndicator,
	showStationStayIndicator, showSpeedIndicator, speedKmh, travelDuration,
	monitorAlert, activeAlert, alertScope, alertLeaving, tickerItems, tickerColor,
	hasTransfers, transferExpanded, onToggleTransferExpanded,
}: SimulatorDisplayProps) {
	const alertMessages = activeAlert
		? [activeAlert.primary, activeAlert.secondary].filter(Boolean)
		: undefined;

	return (
		<div className="relative overflow-hidden rounded-3xl border-4 border-ink bg-[#e8e7dd] shadow-hard">
			{monitorAlert ? null : (
				<TopBoard route={route} pos={pos} phase={phase} lang={lang} clock={clock} car={6} showKatakana={showKatakana} stationNameMode={stationNameMode} />
			)}
			{monitorAlert ? null : (
				<div className="relative bg-paper">
					<DoorIndicator side={route.stations[pos].side} phase={phase} lang={lang} noticeMs={doorNoticeMs} waitMs={doorNoticeWaitMs} />
					<RouteStrip route={route} pos={pos} phase={phase} travelProgress={progress} fromPos={from ?? undefined} direction={direction} followDirectionView={followDirectionView} pageSize={pageSize} remainingDistance={showDistanceIndicator ? (remainingDistance ?? undefined) : undefined} stationStayRemaining={showStationStayIndicator ? stationStayRemainingMs : undefined} speedIndicator={showSpeedIndicator ? speedKmh : undefined} dwellMs={travelDuration} lang={lang} showKatakana={showKatakana} stationNameMode={stationNameMode} />
				</div>
			)}
			{monitorAlert ? null : (
				<LowerInfoBar route={route} pos={pos} lang={lang} hasTransfers={hasTransfers} transferExpanded={transferExpanded} onToggleTransferExpanded={onToggleTransferExpanded} tickerItems={tickerItems} tickerColor={tickerColor} alertMessages={activeAlert && alertScope === "marquee" ? alertMessages : undefined} alertLeaving={alertLeaving} lowerAlertMessages={activeAlert && alertScope === "lower" ? alertMessages : undefined} />
			)}
			{activeAlert && alertScope === "monitor" ? <AlertOverlay message={activeAlert.primary} secondMessage={activeAlert.secondary} full={true} leaving={alertLeaving} lang={lang} /> : null}
		</div>
	);
}
