"use client";
import React from "react";

interface ProgressRailProps {
	color: string;
	frac: number;
	fillToEnd?: boolean;
	clearToStart?: boolean;
	resetToken?: number;
	onFillEnd: () => void;
	onClearEnd: () => void;
	moveDur: number;
	direction?: "forward" | "backward";
	reverseFill?: boolean;
}

// ——— progress rail subcomponent
// A dedicated component paints its initial width before transitioning to the target.
export function ProgressRail({
	color,
	frac,
	fillToEnd,
	clearToStart,
	resetToken,
	onFillEnd,
	onClearEnd,
	moveDur,
	direction = "forward",
	reverseFill = false,
}: ProgressRailProps) {
	const ref = React.useRef<HTMLDivElement>(null);
	const lastFrac = React.useRef<number | null>(null);

	const startWidth = direction === "backward" ? "calc(100% - 120px)" : "0px";

	// Run after the initial start width has been painted, then move to the target.
	React.useEffect(() => {
		const el = ref.current;
		if (!el) return undefined;
		lastFrac.current = frac;
		const frame = requestAnimationFrame(() => {
			el.style.transition = "width 650ms ease-out";
			el.style.width = "calc((100% - 120px) * " + frac + ")";
		});
		return () => cancelAnimationFrame(frame);
	}, [frac]);

	// A single-page route clears instantly, then redraws to the first station.
	React.useEffect(() => {
		if (!resetToken) return undefined;
		const el = ref.current;
		if (!el) return undefined;
		el.style.transition = "none";
		el.style.width =
			direction === "backward" ? "calc(100% - 120px)" : "0px";
		el.offsetWidth;
		lastFrac.current = frac;
		const frame = requestAnimationFrame(() => {
			el.style.transition = "width 650ms ease-out";
			el.style.width = "calc((100% - 120px) * " + frac + ")";
		});
		return () => cancelAnimationFrame(frame);
	}, [resetToken, frac, direction]);

	// Subsequent train movements within the same page.
	React.useEffect(() => {
		if (lastFrac.current === frac) return;
		if (fillToEnd || clearToStart) return;
		const el = ref.current;
		if (!el) return;
		el.style.transition = "width " + moveDur + "ms linear";
		el.style.width = "calc((100% - 120px) * " + frac + ")";
		lastFrac.current = frac;
	}, [frac, moveDur, fillToEnd, clearToStart]);

	// Complete or clear the trail before handing off to an adjacent page.
	React.useEffect(() => {
		if (!fillToEnd && !clearToStart) return undefined;
		const el = ref.current;
		if (!el) return undefined;
		el.style.transition = "width 480ms ease-out";
		el.style.width = fillToEnd ? "calc(100% - 120px)" : "0px";
		const id = setTimeout(fillToEnd ? onFillEnd : onClearEnd, 500);
		return () => clearTimeout(id);
	}, [fillToEnd, clearToStart, onFillEnd, onClearEnd]);

	return (
		<div
			ref={ref}
			className={`absolute top-23 h-3 rounded-pill ${reverseFill ? "right-15" : "left-15"}`}
			style={{ width: startWidth, background: color }}
		/>
	);
}
