"use client";
import React from "react";
import type { Side, Phase, Lang } from "@/types/metro";
import { AnimatedVisibility } from "@/components/animation/AnimatedVisibility";

interface DoorIndicatorProps {
	side: Side;
	phase: Phase;
	lang: Lang;
	noticeMs?: number;
	waitMs?: number;
	onVisibleChange?: (visible: boolean) => void;
}

// ——— door-open indicator with animated chevrons
export function DoorIndicator({
	side,
	phase,
	lang,
	noticeMs = 2400,
	waitMs = 2400,
	onVisibleChange,
}: DoorIndicatorProps) {
	const [active, setActive] = React.useState(phase === "at");
	const [pulseVisible, setPulseVisible] = React.useState(true);
	const [notice, setNotice] = React.useState({ side, lang });

	React.useEffect(() => {
		if (phase === "at") {
			const id = setTimeout(() => {
				setNotice({ side, lang });
				setActive(true);
			}, 0);
			return () => clearTimeout(id);
		}
		const id = setTimeout(() => setActive(false), 0);
		return () => clearTimeout(id);
	}, [phase, side, lang]);

	// Pop-up and wait durations are separate so the door notice can stay visible
	// briefly without immediately reappearing after it has cleared.
	React.useEffect(() => {
		if (phase !== "at") return undefined;
		let hideId: ReturnType<typeof setTimeout>;
		let showId: ReturnType<typeof setTimeout>;
		const cycle = () => {
			hideId = setTimeout(() => {
				setPulseVisible(false);
				showId = setTimeout(() => {
					setPulseVisible(true);
					cycle();
				}, waitMs);
			}, noticeMs);
		};
		showId = setTimeout(() => setPulseVisible(true), 0);
		cycle();
		return () => {
			clearTimeout(hideId);
			clearTimeout(showId);
		};
	}, [phase, noticeMs, waitMs]);

	React.useEffect(() => {
		onVisibleChange?.(active && pulseVisible);
	}, [active, onVisibleChange, pulseVisible]);

	const left = notice.side === "L";
	const arrows = left ? "‹ ‹ ‹" : "› › ›";
	const txtJa = left ? "左側のドアが開きます" : "右側のドアが開きます";
	const txtEn = left ? "Doors open on the LEFT" : "Doors open on the RIGHT";
	return (
		<AnimatedVisibility>
			{active && pulseVisible ? (
				<div
					className={[
						"absolute top-3.5 z-40 flex items-center gap-3 rounded-pill border-[3px] border-ink bg-magenta px-4 py-2 text-ink shadow-hard-s pointer-events-none will-change-transform",
						left
							? "left-3.5 flex-row origin-left data-[visibility-state=visible]:animate-door-notice-left-in data-[visibility-state=leaving]:animate-door-notice-left-out"
							: "right-3.5 flex-row-reverse origin-right data-[visibility-state=visible]:animate-door-notice-right-in data-[visibility-state=leaving]:animate-door-notice-right-out",
					].join(" ")}
				>
					<span className="font-display text-[26px] animate-chev-fast">
						{arrows}
					</span>
					<div
						className={`leading-[1.05] ${left ? "text-left" : "text-right"}`}
					>
						<div className="font-body font-bold text-[15px]">
							{txtJa}
						</div>
						<div className="font-mono text-[11px] tracking-[0.08em]">
							{txtEn.toUpperCase()}
						</div>
					</div>
				</div>
			) : null}
		</AnimatedVisibility>
	);
}
