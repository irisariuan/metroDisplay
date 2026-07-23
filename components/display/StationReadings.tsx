"use client";
import React from "react";
import type { Station } from "@/types/metro";
import { Marquee } from "./Marquee";

interface StationReadingsProps {
	station: Station;
	visible: boolean;
	compact?: boolean;
	color?: string;
	align?: string;
}

export function StationReadings({
	station,
	visible,
	compact = false,
	color = "var(--text-muted)",
	align = "center",
}: StationReadingsProps) {
	const reading = visible ? station.kata.trim() : "";
	if (!reading) return null;
	return (
		<div
			className={[
				"w-full overflow-hidden leading-none font-body",
				compact
					? "h-2.75 mt-0.5 text-[10px] font-semibold tracking-normal"
					: "h-5.75 mt-2 text-[15px] font-bold tracking-[0.08em]",
			].join(" ")}
			style={{ color }}
		>
			<div
				key={reading}
				style={{ animation: "swipeIn .3s var(--ease-out) both" }}
			>
				<Marquee text={reading} align={align} />
			</div>
		</div>
	);
}
