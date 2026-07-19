"use client";

import React from "react";
import type { Station } from "@/types/metro";

interface StationNameLabelProps {
	text: string;
	textStyle: React.CSSProperties;
	station: Station;
	showReadings?: boolean;
	readingsColor?: string;
	focused?: boolean;
	maxWidth?: number;
}

const LABEL_GAP = 6;
const BOUNDARY_INSET = 8;
const DEFAULT_MAX_WIDTH = 240;
const MARQUEE_EDGE_PADDING = 4;

interface LabelLayout {
	viewportWidth: number;
	viewportShift: number;
	marqueeDistance: number;
}

const IDLE_LAYOUT: LabelLayout = {
	viewportWidth: 0,
	viewportShift: 0,
	marqueeDistance: 0,
};

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/**
 * A boundary-aware station label.
 *
 * The stationary viewport is restricted to the space between neighbouring
 * station centres, so it can never paint over another station name. The name
 * and optional katakana reading share one moving content group: a fitting
 * group is shifted back inside the route boundary, while an oversized group
 * marquees all the way between its first and last character.
 */
export function StationNameLabel({
	text,
	textStyle,
	station,
	showReadings = false,
	readingsColor = "var(--text-muted)",
	focused = false,
	maxWidth = DEFAULT_MAX_WIDTH,
}: StationNameLabelProps) {
	const viewportRef = React.useRef<HTMLDivElement>(null);
	const contentRef = React.useRef<HTMLDivElement>(null);
	const [layout, setLayout] = React.useState<LabelLayout>(IDLE_LAYOUT);
	const {
		fontFamily,
		fontSize,
		fontStretch,
		fontStyle,
		fontWeight,
		letterSpacing,
		textTransform,
	} = textStyle;

	React.useLayoutEffect(() => {
		const viewport = viewportRef.current;
		const content = contentRef.current;
		const cell = viewport?.closest<HTMLElement>("[data-station-cell]");
		const boundary = viewport?.closest<HTMLElement>(
			"[data-route-label-boundary]",
		);
		if (!viewport || !content || !cell || !boundary) return undefined;

		const row = cell.parentElement;
		const cells = row
			? (Array.from(row.children) as HTMLElement[]).filter((element) =>
					element.hasAttribute("data-station-cell"),
				)
			: [cell];
		const cellIndex = cells.indexOf(cell);
		let cancelled = false;

		const measure = () => {
			if (cancelled) return;
			const boundaryRect = boundary.getBoundingClientRect();
			const cellRect = cell.getBoundingClientRect();
			const previousRect = cells[cellIndex - 1]?.getBoundingClientRect();
			const nextRect = cells[cellIndex + 1]?.getBoundingClientRect();
			const cellCenter = (cellRect.left + cellRect.right) / 2;
			const previousCenter = previousRect
				? (previousRect.left + previousRect.right) / 2
				: undefined;
			const nextCenter = nextRect
				? (nextRect.left + nextRect.right) / 2
				: undefined;

			// Midpoints between adjacent station centres form non-overlapping
			// territories. The route boundary further clips the first/last label.
			const safeLeft = Math.max(
				boundaryRect.left + BOUNDARY_INSET,
				previousCenter === undefined
					? boundaryRect.left + BOUNDARY_INSET
					: (previousCenter + cellCenter) / 2 + LABEL_GAP / 2,
			);
			const safeRight = Math.min(
				boundaryRect.right - BOUNDARY_INSET,
				nextCenter === undefined
					? boundaryRect.right - BOUNDARY_INSET
					: (cellCenter + nextCenter) / 2 - LABEL_GAP / 2,
			);
			const safeWidth = Math.max(1, safeRight - safeLeft);
			const maximumViewportWidth = Math.min(
				Math.max(1, maxWidth),
				safeWidth,
			);
			// Width is transform-independent, so this stays stable while the
			// marquee or entry swipe is running.
			const contentWidth = content.getBoundingClientRect().width;
			const marquee = contentWidth > maximumViewportWidth + 0.5;
			// Marquee mode never inherits a positional shift. Its centered width is
			// reduced when necessary so the stationary clip window remains wholly
			// inside both the route boundary and its neighbour-safe territory.
			const centeredSafeWidth = Math.max(
				1,
				2 * Math.min(cellCenter - safeLeft, safeRight - cellCenter),
			);
			const fittingViewportWidth = Math.min(
				maximumViewportWidth,
				contentWidth + MARQUEE_EDGE_PADDING * 2,
			);
			const viewportWidth = marquee
				? Math.min(maximumViewportWidth, centeredSafeWidth)
				: fittingViewportWidth;
			// A fitting label only shifts when its actual visible box reaches a
			// boundary. The unused max-width allowance must not move short names.
			const fittingViewportCenter = clamp(
				cellCenter,
				safeLeft + viewportWidth / 2,
				safeRight - viewportWidth / 2,
			);
			const viewportShift = marquee
				? 0
				: fittingViewportCenter - cellCenter;
			const marqueeDistance = Math.max(
				0,
				(contentWidth - viewportWidth) / 2,
			);
			const nextLayout = {
				viewportWidth,
				viewportShift,
				marqueeDistance:
					marquee && marqueeDistance > 0.5
						? marqueeDistance
						: 0,
			};

			setLayout((current) =>
				near(current.viewportWidth, nextLayout.viewportWidth) &&
				near(current.viewportShift, nextLayout.viewportShift) &&
				near(current.marqueeDistance, nextLayout.marqueeDistance)
					? current
					: nextLayout,
			);
		};

		let animationFrame = 0;
		const scheduleMeasure = () => {
			if (cancelled || animationFrame) return;
			animationFrame = requestAnimationFrame(() => {
				animationFrame = 0;
				measure();
			});
		};

		measure();
		void document.fonts?.ready.then(scheduleMeasure);
		// The focus style uses a 350ms transition. This final measurement is a
		// fallback for browsers that coalesce intermediate ResizeObserver events.
		const settleId = setTimeout(measure, 420);
		if (typeof ResizeObserver === "undefined") {
			return () => {
				cancelled = true;
				clearTimeout(settleId);
				if (animationFrame) cancelAnimationFrame(animationFrame);
			};
		}

		const observer = new ResizeObserver(scheduleMeasure);
		observer.observe(content);
		observer.observe(cell);
		observer.observe(boundary);
		for (const neighbour of [cells[cellIndex - 1], cells[cellIndex + 1]]) {
			if (neighbour) observer.observe(neighbour);
		}
		return () => {
			cancelled = true;
			clearTimeout(settleId);
			if (animationFrame) cancelAnimationFrame(animationFrame);
			observer.disconnect();
		};
	}, [
		fontFamily,
		fontSize,
		fontStretch,
		fontStyle,
		fontWeight,
		letterSpacing,
		maxWidth,
		showReadings,
		station.kata,
		text,
		textTransform,
	]);

	const marqueeing = layout.marqueeDistance > 0;
	return (
		<div className="w-full">
			{/* Keep label height fixed so the station dot remains on the rail. */}
			<div className="flex h-9 w-full flex-col items-center justify-end mb-px">
				<div
					ref={viewportRef}
					data-station-label
					data-overflowing={marqueeing || undefined}
					className="relative overflow-hidden whitespace-nowrap text-center"
					style={{
						width:
							layout.viewportWidth > 0
								? layout.viewportWidth
								: "100%",
						maxWidth,
						transform: `translateX(${layout.viewportShift}px)`,
						transition:
							"width .35s var(--ease-pop), transform .35s var(--ease-pop)",
						zIndex: focused ? 3 : 1,
					}}
				>
					<div
						className="flex w-full justify-center"
						style={{ animation: "swipeIn .35s var(--ease-out) both" }}
					>
						<div
							ref={contentRef}
							data-station-label-content
							className="inline-flex flex-none flex-col items-center align-bottom"
							style={
								{
									animation: marqueeing
										? "stationLabelMarquee 9s ease-in-out 1.25s infinite"
										: "none",
									"--marquee-start": `${layout.marqueeDistance}px`,
									"--marquee-end": `${-layout.marqueeDistance}px`,
									paddingInline: marqueeing
										? MARQUEE_EDGE_PADDING
										: 0,
								} as React.CSSProperties
							}
						>
							<span
								className="block whitespace-nowrap"
								style={{
									...textStyle,
									transition:
										"font-size .35s var(--ease-pop), color .35s var(--ease-pop)",
								}}
							>
								{text}
							</span>
							{showReadings ? (
								<span
									className="mt-0.5 block h-2.75 whitespace-nowrap font-body text-[10px] font-semibold leading-none tracking-normal"
									style={{ color: readingsColor }}
								>
									{station.kata}
								</span>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
