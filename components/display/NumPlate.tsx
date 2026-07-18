"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { LineId } from "@/types/metro";

interface NumPlateProps {
	lineId: LineId;
	idx: number;
	scale?: number;
	active?: boolean;
}

// ——— station-number plate (JR style: line-colored border, code over number)
export function NumPlate({ lineId, idx, scale = 1, active }: NumPlateProps) {
	const L = LINES[lineId];
	return (
		<div
			className={[
				"inline-flex flex-col items-center justify-center leading-none font-mono font-bold flex-none transition-all duration-[350ms] ease-pop",
				active ? "shadow-[3px_3px_0_rgba(0,0,0,0.35)]" : "shadow-none",
			].join(" ")}
			style={{
				width: 62 * scale,
				height: 66 * scale,
				borderRadius: 8 * scale,
				border: `${Math.max(2, 3 * scale)}px solid ${L.color}`,
				background: active ? L.color : "#fff",
				color: active ? L.textOnColor : L.color,
			}}
		>
			<span className="tracking-[0.02em]" style={{ fontSize: 15 * scale }}>{L.code}</span>
			<span style={{ fontSize: 24 * scale, marginTop: 2 * scale }}>
				{String(idx + 1).padStart(2, "0")}
			</span>
		</div>
	);
}
