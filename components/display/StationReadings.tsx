"use client";
import React from "react";
import type { Station } from "@/types/metro";

interface StationReadingsProps {
	station: Station;
	visible: boolean;
	compact?: boolean;
	color?: string;
	align?: string;
}

// Always reserves its row, preventing the station-name block from jumping when
// the kanji screen adds or removes its katakana reading.
export function StationReadings({
	station,
	visible,
	compact = false,
	color = "var(--text-muted)",
	align = "center",
}: StationReadingsProps) {
	const reading = visible ? station.kata : "";
	return (
		<div
			className={[
				"w-full overflow-hidden whitespace-nowrap leading-none font-body",
				compact
					? "h-[11px] mt-0.5 text-[10px] font-semibold tracking-normal"
					: "h-[23px] mt-2 text-[15px] font-bold tracking-[0.08em]",
			].join(" ")}
			style={{
				textAlign: align as React.CSSProperties["textAlign"],
				color,
			}}
		>
			{reading ? (
				<span
					key={reading}
					className="inline-block"
					style={{ animation: "swipeIn .3s var(--ease-out) both" }}
				>
					{reading}
				</span>
			) : null}
		</div>
	);
}
