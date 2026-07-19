"use client";

import React from "react";

interface BoundaryShiftTextProps {
	text: string;
	textStyle?: React.CSSProperties;
	measurementKey?: React.Key;
}

// Keeps a centered label aligned with its station marker until it would cross
// the route boundary, then applies only the horizontal correction it needs.
export function BoundaryShiftText({
	text,
	textStyle,
	measurementKey,
}: BoundaryShiftTextProps) {
	const viewportRef = React.useRef<HTMLDivElement>(null);
	const textRef = React.useRef<HTMLSpanElement>(null);
	const [shift, setShift] = React.useState(0);

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

			setShift((current) =>
				Math.abs(current - nextShift) < 0.5 ? current : nextShift,
			);
		};

		measure();
		if (typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(content);
		observer.observe(boundary);
		return () => observer.disconnect();
	}, [measurementKey, text]);

	return (
		<div
			ref={viewportRef}
			className="relative w-full whitespace-nowrap text-center"
		>
			<span
				ref={textRef}
				className="inline-block transition-transform duration-350 ease-pop"
				style={{ ...textStyle, transform: `translateX(${shift}px)` }}
			>
				{text}
			</span>
		</div>
	);
}
