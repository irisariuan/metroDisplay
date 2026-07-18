"use client";
import React from "react";
import type { Side, Phase, Lang } from "@/types/metro";

interface DoorIndicatorProps {
	side: Side;
	phase: Phase;
	lang: Lang;
	noticeMs?: number;
	waitMs?: number;
}

// ——— door-open indicator with animated chevrons
export function DoorIndicator({ side, phase, lang, noticeMs = 2400, waitMs = 2400 }: DoorIndicatorProps) {
	const [visible, setVisible] = React.useState(phase === "at");
	const [leaving, setLeaving] = React.useState(false);
	const [pulseVisible, setPulseVisible] = React.useState(true);
	const [notice, setNotice] = React.useState({ side, lang });

	React.useEffect(() => {
		if (phase === "at") {
			setNotice({ side, lang });
			setVisible(true);
			setLeaving(false);
			return undefined;
		}
		if (!visible) return undefined;
		setLeaving(true);
		const id = setTimeout(() => {
			setVisible(false);
			setLeaving(false);
		}, 320);
		return () => clearTimeout(id);
	}, [phase, side, lang, visible]);

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
		setPulseVisible(true);
		cycle();
		return () => {
			clearTimeout(hideId);
			clearTimeout(showId);
		};
	}, [phase, noticeMs, waitMs]);

	if (!visible) return null;
	const left = notice.side === "L";
	const arrows = left ? "‹ ‹ ‹" : "› › ›";
	const txtJa = left ? "左側のドアが開きます" : "右側のドアが開きます";
	const txtEn = left ? "Doors open on the LEFT" : "Doors open on the RIGHT";
	const noticeAnimClass = leaving
		? left
			? "animate-door-notice-left-out"
			: "animate-door-notice-right-out"
		: pulseVisible
			? left
				? "animate-door-notice-left-in"
				: "animate-door-notice-right-in"
			: left
				? "animate-door-notice-left-out"
				: "animate-door-notice-right-out";
	return (
		<div
			className={[
				"absolute top-[14px] z-[5] flex items-center gap-3 bg-magenta text-ink border-[3px] border-ink rounded-pill py-2 px-4 shadow-hard-s pointer-events-none",
				left ? "left-[14px] flex-row" : "right-[14px] flex-row-reverse",
				noticeAnimClass,
			].join(" ")}
		>
			<span className="font-display text-[26px] animate-chev-fast">
				{arrows}
			</span>
			<div className={`leading-[1.05] ${left ? "text-left" : "text-right"}`}>
				<div className="font-body font-bold text-[15px]">
					{txtJa}
				</div>
				<div className="font-mono text-[11px] tracking-[0.08em]">
					{txtEn.toUpperCase()}
				</div>
			</div>
		</div>
	);
}
