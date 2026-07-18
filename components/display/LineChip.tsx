"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { LineId } from "@/types/metro";

interface LineChipProps {
	lineId: LineId;
	size?: number;
}

// ——— small line chip (used for transfers + legend)
export function LineChip({ lineId, size = 26 }: LineChipProps) {
	const L = LINES[lineId];
	return (
		<span
			title={L.en}
			className="inline-flex items-center justify-center flex-none rounded-s font-mono font-bold border-[2px] border-[rgba(0,0,0,0.25)]"
			style={{
				width: size,
				height: size,
				background: L.color,
				color: L.textOnColor,
				fontSize: size * 0.44,
			}}
		>
			{L.code}
		</span>
	);
}
