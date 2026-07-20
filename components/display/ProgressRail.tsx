"use client";
import React from "react";

interface ProgressRailProps {
	color: string;
	frac: number;
	fillToEnd?: boolean;
	/** Visual rail fraction fillToEnd completes to; the exit edge. */
	fillTargetFrac?: number;
	clearToStart?: boolean;
	resetToken?: number;
	onFillEnd: () => void;
	onClearEnd: () => void;
	moveDur: number;
	/** The trail origin on this page, as a rail fraction. */
	originFrac?: number;
}

// ——— progress rail subcomponent
// A dedicated component paints its initial width before transitioning to the target.
export function ProgressRail({
	color,
	frac,
	fillToEnd,
	fillTargetFrac = 1,
	clearToStart,
	resetToken,
	onFillEnd,
	onClearEnd,
	moveDur,
	originFrac = 0,
}: ProgressRailProps) {
	const ref = React.useRef<HTMLDivElement>(null);
	const lastFrac = React.useRef<number | null>(null);
	const origin = Math.min(1, Math.max(0, originFrac));
	const lastOrigin = React.useRef<number | null>(null);
	const styleFor = React.useCallback(
		(value: number) =>
			({
				left: `calc(60px + (100% - 120px) * ${Math.min(origin, Math.max(0, Math.min(1, value)))})`,
				width: `calc((100% - 120px) * ${Math.abs(Math.max(0, Math.min(1, value)) - origin)})`,
			}),
		[origin],
	);
	const applyTarget = React.useCallback(
		(el: HTMLDivElement, value: number) => {
			const next = styleFor(value);
			el.style.left = next.left;
			el.style.width = next.width;
		},
		[styleFor],
	);

	// Run once after the initial start width has been painted, then move to
	// the target. Later frac changes belong to the movement effect below.
	const initialized = React.useRef(false);
	React.useEffect(() => {
		if (initialized.current) return undefined;
		const el = ref.current;
		if (!el) return undefined;
		initialized.current = true;
		lastFrac.current = frac;
		lastOrigin.current = origin;
		const frame = requestAnimationFrame(() => {
			el.style.transition = "left 650ms ease-out, width 650ms ease-out";
			applyTarget(el, frac);
		});
		return () => cancelAnimationFrame(frame);
	}, [frac, origin, applyTarget]);

	// A single-page route clears instantly, then redraws to the first station.
	React.useEffect(() => {
		if (!resetToken) return undefined;
		const el = ref.current;
		if (!el) return undefined;
		el.style.transition = "none";
		applyTarget(el, origin);
		el.offsetWidth;
		lastFrac.current = frac;
		lastOrigin.current = origin;
		const frame = requestAnimationFrame(() => {
			el.style.transition = "left 650ms ease-out, width 650ms ease-out";
			applyTarget(el, frac);
		});
		return () => cancelAnimationFrame(frame);
	}, [resetToken, frac, origin, applyTarget]);

	// Subsequent train movements within the same page.
	React.useEffect(() => {
		const originChanged = lastOrigin.current !== origin;
		if (lastFrac.current === frac && !originChanged) return;
		if (fillToEnd || clearToStart) return;
		const el = ref.current;
		if (!el) return;
		// Reversing a paused simulation changes the service-bound trail origin.
		// React applies the new zero-width origin before this effect runs, so the
		// imperative cache must also include the origin. Snap that recalculation
		// into place instead of sweeping the fill across the whole route.
		el.style.transition = originChanged
			? "none"
			: `left ${moveDur}ms linear, width ${moveDur}ms linear`;
		applyTarget(el, frac);
		lastFrac.current = frac;
		lastOrigin.current = origin;
	}, [frac, origin, moveDur, fillToEnd, clearToStart, applyTarget]);

	// Complete or clear the trail before handing off to an adjacent page.
	React.useEffect(() => {
		if (!fillToEnd && !clearToStart) return undefined;
		const el = ref.current;
		if (!el) return undefined;
		el.style.transition = "left 480ms ease-out, width 480ms ease-out";
		applyTarget(el, fillToEnd ? fillTargetFrac : origin);
		lastOrigin.current = origin;
		lastFrac.current = fillToEnd ? fillTargetFrac : origin;
		const id = setTimeout(fillToEnd ? onFillEnd : onClearEnd, 500);
		return () => clearTimeout(id);
	}, [
		fillToEnd,
		fillTargetFrac,
		clearToStart,
		onFillEnd,
		onClearEnd,
		origin,
		applyTarget,
	]);

	return (
		<div
			ref={ref}
			className="absolute left-15 top-23 h-3 rounded-pill"
			style={{
				background: color,
				...styleFor(origin),
			}}
		/>
	);
}
