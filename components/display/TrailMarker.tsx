"use client";
import React from "react";

interface TrailMarkerProps {
	frac: number;
	direction?: "forward" | "backward";
	hidden?: boolean;
	moveDur: number;
	instant?: boolean;
}

export function TrailMarker({ frac, direction, hidden, moveDur, instant = false }: TrailMarkerProps) {
	const ref = React.useRef<HTMLDivElement>(null);
	const lastFrac = React.useRef<number | null>(null);
	const startFrac = instant ? frac : (direction === "backward" ? 1 : 0);
	const left = (value: number) => `calc(60px + (100% - 120px) * ${value})`;

	React.useEffect(() => {
		const el = ref.current;
		if (!el) return undefined;
		lastFrac.current = frac;
		if (instant) return undefined;
		const frame = requestAnimationFrame(() => {
			el.style.transition = "left 650ms ease-out, opacity .35s ease";
			el.style.left = left(frac);
		});
		return () => cancelAnimationFrame(frame);
	}, []);

	React.useEffect(() => {
		if (lastFrac.current === frac || hidden) return;
		const el = ref.current;
		if (!el) return;
		el.style.transition = `left ${moveDur}ms linear, opacity .35s ease`;
		el.style.left = left(frac);
		lastFrac.current = frac;
	}, [frac, hidden, moveDur]);

	return (
		<div
			ref={ref}
			className={[
				"absolute top-[66px] -translate-x-1/2 z-[4] transition-opacity duration-[350ms] ease-[ease]",
				hidden ? "opacity-0" : "opacity-100",
			].join(" ")}
			style={{ left: left(startFrac) }}
		>
			<div
				className={[
					"font-display text-[30px] text-ink drop-shadow-[2px_2px_0_rgba(0,0,0,0.25)]",
					hidden ? "" : "animate-bob-fast",
				].join(" ")}
			>
				▼
			</div>
		</div>
	);
}
