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
	/** Explicit filled trail ranges override the linear fill heuristic. */
	filledRanges?: Array<readonly [number, number]>;
	/** Directional chevrons on the exposed circular-loop connectors. */
	loopConnectorSides?: Array<"left" | "right">;
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
	filledRanges,
	loopConnectorSides = [],
}: DirectionIndicatorsProps) {
	// A remainder page can contain one station but still have a rail stub that
	// continues to the previous/next page. Keep that connector's chevron; only
	// suppress the component when there is no station or no directional segment.
	if (
		count < 1 ||
		(count === 1 &&
			!continueForward &&
			!continueBackward &&
			loopConnectorSides.length === 0)
	)
		return null;
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
				color: (filledRanges
					? filledRanges.some(([start, end]) =>
						position >= Math.min(start, end) && position <= Math.max(start, end),
					)
					: reverseFill
						? position >= trailProgress
						: position <= trailProgress)
					? "#fff"
					: color,
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
	// Multi-page circular routes already use the page-continuation arrows on
	// their internal edge stubs. The circular fallback should only occupy an
	// exposed edge, otherwise two chevrons are painted at the same position.
	const showLeftLoopConnector =
		loopConnectorSides.includes("left") && !continueBackward;
	const showRightLoopConnector =
		loopConnectorSides.includes("right") && !continueForward;
	return (
		<div
			aria-hidden={true}
			className="absolute left-15 right-15 top-22.75 h-3.5 pointer-events-none z-1"
		>
			{betweenStations}
			{showLeftLoopConnector
				? arrow(nodePosition(0) / 2, "loop-connector", 60)
				: null}
			{showRightLoopConnector
				? arrow((nodePosition(count - 1) + 1) / 2, "loop-connector-end", 60)
				: null}
			{continueForward ? arrow((nodePosition(count - 1) + 1) / 2, "next-page", 180) : null}
			{continueBackward ? arrow(nodePosition(0) / 2, "previous-page", 180) : null}
		</div>
	);
}
