"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { Route, Phase, Lang, Side } from "@/types/metro";
import { Marquee } from "./Marquee";
import { StationReadings } from "./StationReadings";
import { NumPlate } from "./NumPlate";
import { HALFTONE } from "./const";
import { AnimatedVisibility } from "@/components/animation/AnimatedVisibility";

interface TopBoardProps {
	route: Route;
	pos: number;
	phase: Phase;
	lang: Lang;
	clock: React.ReactNode;
	car: React.ReactNode;
	showKatakana?: boolean;
	stationNameMode?: string;
	doorSide?: Side;
	serviceJa?: string;
	serviceEn?: string;
	serviceIsLocal?: boolean;
	/** the train will pass the shown station without stopping */
	passing?: boolean;
}

// ——— top board: toward label + NEXT/NOW + big bilingual station name + clock + car
export function TopBoard({
	route,
	pos,
	phase,
	lang,
	clock,
	car,
	doorSide,
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
	const hasKatakana = stationNameMode === "kanji" && showKatakana;
	return (
		<div className="pt-5.5 px-8.5 bg-ink text-paper border-b-4 border-b-acid flex flex-col">
			<div
				className="absolute inset-0 opacity-50 pointer-events-none"
				style={{
					backgroundImage: HALFTONE,
					backgroundSize: "11px 11px",
				}}
			/>
			<div
				className="relative grid items-center gap-7 overflow-hidden"
				style={{ gridTemplateColumns: "auto auto 1fr auto" }}
			>
				{/* toward + service type */}
				<div className="relative min-w-37.5">
					{/* service type badge: locals wear the line color, express
					    variants flip to acid so they read at a glance */}
					<div
						className="inline-block font-mono font-bold text-label tracking-[0.12em] py-1 px-2.25 rounded-sm"
						style={
							serviceIsLocal
								? { background: L.color, color: L.textOnColor }
								: {
										background: "var(--acid)",
										color: "var(--ink)",
									}
						}
					>
						{lang === "ja" ? serviceJa : serviceEn.toUpperCase()}
					</div>
					<div className="font-body font-bold text-[28px] leading-[1.18] mt-2 text-white whitespace-nowrap">
						{route.destJa}
					</div>
					<div className="font-mono text-label tracking-widest text-acid mt-1">
						{("for " + route.destEn).toUpperCase()}
					</div>
				</div>
				{/* number plate */}
				<div className="relative">
					<NumPlate
						lineId={route.line}
						idx={pos}
						scale={1.15}
						active={true}
					/>
				</div>
				{/* eyebrow + huge name (bilingual flip) — fixed height so the flip never shifts layout */}
				<div className="relative overflow-hidden h-38.5 flex flex-col justify-center">
					<div
						key={"eb" + stationNameMode + isAt}
						className={`font-mono text-[14px] tracking-[0.16em] ${isAt ? "text-acid" : "text-magenta-2"}`}
						style={{
							animation: "swipeIn .4s var(--ease-out) both",
						}}
					>
						{isEnglishName ? eyebrowEn.toUpperCase() : eyebrowJa}
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
			<div className="h-5.5">
				<AnimatedVisibility>
					{doorSide ? (
						<p
							className={[
								"text-acid text-mono uppercase tracking-widest text-xs will-change-transform",
								doorSide === "R"
									? "text-right data-[visibility-state=visible]:animate-door-notice-right-in data-[visibility-state=leaving]:animate-door-notice-right-out"
									: "data-[visibility-state=visible]:animate-door-notice-left-in data-[visibility-state=leaving]:animate-door-notice-left-out",
							].join(" ")}
						>
							Door on the {doorSide === "L" ? "left" : "right"} side
							will open
						</p>
					) : null}
				</AnimatedVisibility>
			</div>
		</div>
	);
}
