"use client";
import React from "react";

interface DirectionIndicatorsProps {
	count: number;
	reverse?: boolean;
	color: string;
	trailProgress: number;
	layout?: "center" | "full" | "start" | "end";
	continueForward?: boolean;
	continueBackward?: boolean;
	reverseFill?: boolean;
}

export function DirectionIndicators({
	count,
	reverse,
	color,
	trailProgress,
	layout = "center",
	continueForward = false,
	continueBackward = false,
	reverseFill = false,
}: DirectionIndicatorsProps) {
	if (count < 2) return null;
	const nodePosition = (index: number) =>
		layout === "full"
			? index / (count - 1)
			: layout === "start"
				? index / count
				: layout === "end"
					? (index + 1) / count
					: (index + 0.5) / count;
	const arrow = (position: number, key: React.Key, delay: number) => (
		<span
			key={key}
			className="absolute font-mono text-[10px] font-bold tracking-[-0.2em] leading-none"
			style={{
				left: `${position * 100}%`,
				transform: `translateX(-50%)${reverse ? " scaleX(-1)" : ""}`,
				color: (reverseFill ? position >= trailProgress : position <= trailProgress) ? "#fff" : color,
			}}
		>
			<span className="inline-block animate-chev-fast" style={{ animationDelay: `${delay}ms` }}>
				››
			</span>
		</span>
	);
	const betweenStations = Array.from({ length: count - 1 }, (_, index) =>
		arrow((nodePosition(index) + nodePosition(index + 1)) / 2, index, index * 120),
	);
	return (
		<div
			aria-hidden={true}
			className="absolute left-[60px] right-[60px] top-[91px] h-[14px] pointer-events-none z-[1]"
		>
			{betweenStations}
			{continueForward ? arrow((nodePosition(count - 1) + 1) / 2, "next-page", 180) : null}
			{continueBackward ? arrow(nodePosition(0) / 2, "previous-page", 180) : null}
		</div>
	);
}
