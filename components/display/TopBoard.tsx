"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { Route, Phase, Lang } from "@/types/metro";
import { Marquee } from "./Marquee";
import { StationReadings } from "./StationReadings";
import { NumPlate } from "./NumPlate";

const HALFTONE =
	"radial-gradient(rgba(255,255,255,.13) 1.4px, transparent 1.5px)";

interface TopBoardProps {
	route: Route;
	pos: number;
	phase: Phase;
	lang: Lang;
	clock: React.ReactNode;
	car: React.ReactNode;
	showKatakana?: boolean;
	stationNameMode?: string;
}

// ——— top board: toward label + NEXT/NOW + big bilingual station name + clock + car
export function TopBoard({
	route,
	pos,
	phase,
	lang,
	clock,
	car,
	showKatakana = false,
	stationNameMode = "kanji",
}: TopBoardProps) {
	const L = LINES[route.line];
	const st = route.stations[pos];
	const isAt = phase === "at";
	const isEnglishName = stationNameMode === "en";
	const stationName = stationNameMode === "hiragana" ? st.hira || st.ja : isEnglishName ? st.en : st.ja;
	const eyebrowJa = isAt ? "ただいま" : "つぎは";
	const eyebrowEn = isAt ? "Now at" : "Next";
	return (
		<div
			className="relative grid items-center gap-[28px] py-[22px] px-[34px] bg-ink text-paper border-b-[4px] border-b-acid overflow-hidden"
			style={{ gridTemplateColumns: "auto auto 1fr auto" }}
		>
			<div
				className="absolute inset-0 opacity-50 pointer-events-none"
				style={{
					backgroundImage: HALFTONE,
					backgroundSize: "11px 11px",
				}}
			/>
			{/* toward + service type */}
			<div className="relative min-w-[150px]">
				<div className="inline-block font-mono font-bold text-label tracking-[0.12em] py-1 px-[9px] rounded-[4px]" style={{ background: L.color, color: L.textOnColor }}>
					LOCAL
				</div>
				<div className="font-body font-bold text-[28px] leading-[1.18] mt-2 text-white whitespace-nowrap">
					{route.destJa}
				</div>
				<div className="font-mono text-label tracking-[0.1em] text-acid mt-1">
					{("for " + route.destEn).toUpperCase()}
				</div>
			</div>
			{/* number plate */}
			<div className="relative">
				<NumPlate lineId={route.line} idx={pos} scale={1.15} active={true} />
			</div>
			{/* eyebrow + huge name (bilingual flip) — fixed height so the flip never shifts layout */}
			<div className="relative overflow-hidden h-[154px] flex flex-col justify-center">
				<div
					key={"eb" + stationNameMode + isAt}
					className={`font-mono text-[14px] tracking-[0.16em] ${isAt ? "text-acid" : "text-magenta-2"}`}
					style={{ animation: "swipeIn .4s var(--ease-out) both" }}
				>
					{isEnglishName ? eyebrowEn.toUpperCase() : eyebrowJa}
				</div>
				<div
					key={stationNameMode + pos}
					className="w-full mt-1"
					style={{ animation: "swipeIn .45s var(--ease-out) both" }}
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
				<StationReadings
					station={st}
					visible={stationNameMode === "kanji" && showKatakana}
					align="left"
					color="var(--paper-2)"
				/>
			</div>
			{/* clock + car */}
			<div className="relative text-right">
				<div className="font-mono text-[34px] font-bold text-blue-2">
					{clock}
				</div>
				<div className="inline-flex items-baseline gap-1 mt-[6px]">
					<span className="font-display text-[30px] text-acid">
						{String(car)}
					</span>
					<span className="font-mono text-label tracking-[0.1em]">
						{lang === "ja" ? "号車" : "CAR"}
					</span>
				</div>
			</div>
		</div>
	);
}
