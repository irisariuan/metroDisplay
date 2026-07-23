"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { Route, Phase, Lang, Side, Station } from "@/types/metro";
import { Marquee } from "./Marquee";
import { StationReadings } from "./StationReadings";
import { NumPlate } from "./NumPlate";
import { HALFTONE } from "./const";
import { AnimatedVisibility } from "@/components/animation/AnimatedVisibility";
import { upcomingMajorStations } from "@/lib/announcement";

interface TopBoardProps {
	route: Route;
	pos: number;
	phase: Phase;
	lang: Lang;
	direction: number;
	clock: React.ReactNode;
	car: React.ReactNode;
	showKatakana?: boolean;
	stationNameMode?: string;
	doorSide?: Side;
	serviceOrigin?: Station;
	serviceJa?: string;
	serviceEn?: string;
	serviceIsLocal?: boolean;
	/** the train will pass the shown station without stopping */
	passing?: boolean;
}

const DOOR_SIGN_TEXT: Record<Lang, Record<Side, string>> = {
	ja: {
		L: "左側のドアが開きます",
		R: "右側のドアが開きます",
	},
	en: {
		L: "Door on the left side will open",
		R: "Door on the right side will open",
	},
};

const DOOR_SIGN_VARIANTS = (["ja", "en"] as const).flatMap((signLang) =>
	(["L", "R"] as const).map((side) => ({ signLang, side })),
);

// ——— top board: toward label + NEXT/NOW + big bilingual station name + clock + car
export function TopBoard({
	route,
	pos,
	phase,
	lang,
	clock,
	car,
	direction,
	doorSide,
	serviceOrigin,
	showKatakana = false,
	stationNameMode = "kanji",
	serviceJa = "各駅停車",
	serviceEn = "Local",
	serviceIsLocal = true,
	passing = false,
}: TopBoardProps) {
	const L = LINES[route.line];
	const st = route.stations[pos];
	const isAt = phase === "at";
	const isEnglishName = stationNameMode === "en";
	const stationName =
		stationNameMode === "hiragana"
			? st.hira || st.ja
			: isEnglishName
				? st.en
				: st.ja;
	const eyebrowJa = isAt ? "ただいま" : passing ? "通過" : "つぎは";
	const eyebrowEn = isAt ? "Now at" : passing ? "Passing" : "Next";
	// Katakana only rides along under the kanji name. When it isn't shown
	// (English/hiragana mode, or katakana toggled off), the readings row is
	// omitted entirely rather than reserved empty — otherwise the empty row is
	// swept into justify-center and the name reads optically high.
	const hasKatakana =
		stationNameMode === "kanji" && showKatakana && Boolean(st.kata.trim());
	// Loop lines have no origin terminus, so the "from" label points at the last
	// major stop the train passed — search backwards, wrapping around the loop.
	const [lastMajorStation] = upcomingMajorStations(route, {
		direction: -direction,
		fromIndex: pos,
		count: 1,
		circular: route.circular,
	});
	// Falls back to the service origin if the loop has no major stop behind.
	const originStation = route.circular
		? (lastMajorStation ?? serviceOrigin)
		: serviceOrigin;
	return (
		<div className="px-8.5 bg-ink text-paper border-b-4 border-b-acid flex flex-col">
			<div
				className="absolute inset-0 opacity-50 pointer-events-none"
				style={{
					backgroundImage: HALFTONE,
					backgroundSize: "11px 11px",
				}}
			/>
			<div
				className="relative grid items-center gap-7 overflow-hidden"
				style={{ gridTemplateColumns: "auto auto 1fr" }}
			>
				{/* toward + service type — a definite width so the origin and
				    destination lines have a fixed window to marquee within */}
				<div className="overflow-hidden">
					{/* service type badge: locals wear the line color, express
					    variants flip to acid so they read at a glance */}
					<div
						className="inline-block font-mono font-bold text-label tracking-[0.12em] py-1 px-2.25 rounded-sm"
						key={serviceEn}
						style={{
							...(serviceIsLocal
								? { background: L.color, color: L.textOnColor }
								: {
										background: "var(--acid)",
										color: "var(--ink)",
									}),
							transition:
								"background 400ms, color 400ms, width 650ms var(--ease-pop) 100ms",
						}}
					>
						<span
							key={lang + serviceEn}
							style={{
								animation: "swipeIn .4s var(--ease-out) both",
							}}
						>
							{lang === "ja"
								? serviceJa
								: serviceEn.toUpperCase()}
						</span>
					</div>
					{serviceOrigin && (
						<div
							key={originStation.en + serviceOrigin.en}
							className="mt-2 font-mono tracking-widest text-paper-2"
							style={{
								animation: "swipeIn .4s var(--ease-out) both",
							}}
						>
							<div className="text-sm">
								<Marquee
									text={`${originStation.ja}から`}
									align="left"
								/>
							</div>
							<div className="text-[0.6rem]">
								<Marquee
									text={`FROM ${originStation.en}`.toUpperCase()}
									align="left"
								/>
							</div>
						</div>
					)}
					<div
						key={route.destEn}
						style={{
							animation: "swipeIn .4s var(--ease-out) both",
						}}
					>
						<div className="font-body font-bold text-[28px] leading-[1.18] mt-2 text-white">
							<Marquee text={route.destJa} align="left" />
						</div>
						<div className="font-mono text-label tracking-widest text-acid mt-1">
							<Marquee
								text={("for " + route.destEn).toUpperCase()}
								align="left"
							/>
						</div>
					</div>
				</div>
				<div className="overflow-hidden flex items-center justify-center gap-7">
					{/* number plate */}
					<NumPlate
						lineId={route.line}
						idx={pos}
						scale={1.15}
						active={true}
					/>
					{/* eyebrow + huge name (bilingual flip) — fixed height so the flip never shifts layout */}
					<div className="relative overflow-hidden h-38.5 flex flex-col justify-center">
						<div
							key={"eb" + stationNameMode + isAt}
							className={`font-mono text-[14px] tracking-[0.16em] ${isAt ? "text-acid" : "text-magenta-2"}`}
							style={{
								animation: "swipeIn .4s var(--ease-out) both",
							}}
						>
							{isEnglishName
								? eyebrowEn.toUpperCase()
								: eyebrowJa}
						</div>
						<div
							key={stationNameMode + pos}
							className="w-full mt-1"
							style={{
								animation: "swipeIn .45s var(--ease-out) both",
							}}
						>
							<Marquee
								text={stationName}
								align="left"
								textStyle={{
									fontFamily: "var(--font-display)",
									letterSpacing: "-.01em",
									lineHeight: 0.9,
									fontSize: isEnglishName
										? "clamp(38px,5.2vw,76px)"
										: "clamp(52px,7.4vw,100px)",
								}}
							/>
						</div>
						{hasKatakana && (
							<StationReadings
								station={st}
								visible={true}
								align="left"
								color="var(--paper-2)"
							/>
						)}
					</div>
				</div>
				{/* clock + car */}
				<div className="relative text-right">
					<div className="font-mono text-[34px] font-bold text-blue-2">
						{clock}
					</div>
					<div className="inline-flex items-baseline gap-1 mt-1.5">
						<span className="font-display text-[30px] text-acid">
							{String(car)}
						</span>
						<span className="font-mono text-label tracking-widest">
							{lang === "ja" ? "号車" : "CAR"}
						</span>
					</div>
				</div>
			</div>
			<div className="relative h-5.5 overflow-hidden">
				{DOOR_SIGN_VARIANTS.map(({ signLang, side }) => (
					<AnimatedVisibility key={`${signLang}-${side}`}>
						{doorSide === side && lang === signLang ? (
							<p
								lang={signLang === "ja" ? "ja" : "en"}
								className={[
									"absolute inset-x-0 top-0 text-acid text-mono tracking-widest text-xs will-change-transform",
									signLang === "en"
										? "uppercase"
										: "font-bold",
									side === "R"
										? "text-right data-[visibility-state=visible]:animate-door-notice-right-in data-[visibility-state=leaving]:animate-door-notice-right-out"
										: "text-left data-[visibility-state=visible]:animate-door-notice-left-in data-[visibility-state=leaving]:animate-door-notice-left-out",
								].join(" ")}
							>
								{DOOR_SIGN_TEXT[signLang][side]}
							</p>
						) : null}
					</AnimatedVisibility>
				))}
			</div>
		</div>
	);
}
