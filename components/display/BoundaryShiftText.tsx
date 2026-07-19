"use client";

import React from "react";

interface BoundaryShiftTextProps {
	text: string;
	textStyle?: React.CSSProperties;
	measurementKey?: React.Key;
}

// Keeps a label centered until it needs a boundary correction. If that
// correction (or the label's natural width) would intrude on another station,
// the label is clipped to its own cell and scrolls inside that cell instead.
export function BoundaryShiftText({
	text,
	textStyle,
	measurementKey,
}: BoundaryShiftTextProps) {
	const viewportRef = React.useRef<HTMLDivElement>(null);
	const textRef = React.useRef<HTMLSpanElement>(null);
	const [shift, setShift] = React.useState(0);
	const [marqueeDistance, setMarqueeDistance] = React.useState(0);

	React.useLayoutEffect(() => {
		const viewport = viewportRef.current;
		const content = textRef.current;
		const boundary = viewport?.closest<HTMLElement>(
			"[data-route-label-boundary]",
		);
		if (!viewport || !content || !boundary) return undefined;

		const measure = () => {
			const viewportRect = viewport.getBoundingClientRect();
			const contentRect = content.getBoundingClientRect();
			const boundaryRect = boundary.getBoundingClientRect();
			const boundaryLeft = boundaryRect.left + 8;
			const boundaryRight = boundaryRect.right - 8;
			// offsetLeft is layout-space and is not affected by the animated
			// transform, unlike getBoundingClientRect().
			const unshiftedLeft = viewportRect.left + content.offsetLeft;
			const unshiftedRight = unshiftedLeft + contentRect.width;
			let nextShift = 0;

			if (contentRect.width > boundaryRight - boundaryLeft) {
				nextShift = boundaryLeft - unshiftedLeft;
			} else if (unshiftedLeft < boundaryLeft) {
				nextShift = boundaryLeft - unshiftedLeft;
			} else if (unshiftedRight > boundaryRight) {
				nextShift = boundaryRight - unshiftedRight;
			}

			const projectedLeft = unshiftedLeft + nextShift;
			const projectedRight = unshiftedRight + nextShift;
			const exceedsCell =
				projectedLeft < viewportRect.left + 2 ||
				projectedRight > viewportRect.right - 2;
			const shouldMarquee = contentRect.width > viewportRect.width + 2;

			// Do not let a boundary correction push a short label into a
			// neighbouring cell. Long labels use the same contained viewport as
			// a marquee, so neither case can overlap another station name.
			if (shouldMarquee || exceedsCell) nextShift = 0;
			setShift((current) =>
				Math.abs(current - nextShift) < 0.5 ? current : nextShift,
			);
			const nextMarqueeDistance = shouldMarquee
				? contentRect.width - viewportRect.width + 12
				: 0;
			setMarqueeDistance((current) =>
				Math.abs(current - nextMarqueeDistance) < 0.5
					? current
					: nextMarqueeDistance,
			);
		};

		measure();
		// The route label can enter with a horizontal swipe. Measure again once
		// that transform has settled so its boundary correction uses final bounds.
		const settleId = setTimeout(measure, 380);
		if (typeof ResizeObserver === "undefined")
			return () => clearTimeout(settleId);
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(content);
		observer.observe(boundary);
		return () => {
			clearTimeout(settleId);
			observer.disconnect();
		};
	}, [measurementKey, text]);

	return (
		<div
			ref={viewportRef}
			className="relative w-full overflow-hidden whitespace-nowrap"
			style={{ textAlign: marqueeDistance > 0 ? "left" : "center" }}
		>
			<span
				ref={textRef}
				className="inline-block transition-transform duration-350 ease-pop"
				style={
					{
						...textStyle,
						transform: `translateX(${shift}px)`,
						animation:
							marqueeDistance > 0
								? "mq 5s ease-in-out 2s infinite alternate"
								: "none",
						"--boundary-shift": `${shift}px`,
						"--mq": `-${marqueeDistance}px`,
					} as React.CSSProperties
				}
			>
				{text}
			</span>
		</div>
	);
}
