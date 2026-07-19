"use client";
import React from "react";
import type { Lang } from "@/types/metro";
import { HALFTONE } from "../display/const";

interface TickerProps {
	items: string[];
	color: string;
	alertMessages?: string[];
	alertLeaving?: boolean;
	stillOnNewContent?: number;
	separateAlertLanguages?: boolean;
	lang?: Lang;
	background?: string;
	borderTop?: string;
}

export function Ticker({
	items,
	color,
	alertMessages,
	alertLeaving = false,
	stillOnNewContent = 1000,
	separateAlertLanguages = false,
	lang = "en",
	background = "var(--ink)",
	borderTop = "3px solid var(--ink)",
}: TickerProps) {
	// An in-marquee alert replaces only the ticker copy; transfer information stays visible.
	const isAlert = !!(alertMessages && alertMessages.length);
	const isJapaneseAlert = lang === "ja" && alertMessages && alertMessages[1];
	const activeAlertMessage = isAlert
		? isJapaneseAlert
			? alertMessages![1]
			: alertMessages![0]
		: null;
	const alertLabel = isJapaneseAlert ? "お知らせ" : "ALERT";
	const seq = isAlert
		? separateAlertLanguages
			? [activeAlertMessage as string]
			: alertMessages!.map(
					(message, index) =>
						`${index ? "お知らせ" : "ALERT"} · ${message}`,
				)
		: items;
	const contentKey = seq.join(" ¦ ");
	const splitAlert = separateAlertLanguages && isAlert;
	const [scrollingKey, setScrollingKey] = React.useState<string | null>(null);

	// New copy is mounted at the start of the ticker and explicitly held there.
	// Using state rather than CSS delay makes the dwell reliable after every remount.
	React.useEffect(() => {
		if (!stillOnNewContent) {
			const id = setTimeout(() => setScrollingKey(contentKey), 0);
			return () => clearTimeout(id);
		}
		const clearId = setTimeout(() => setScrollingKey(null), 0);
		const id = setTimeout(
			() => setScrollingKey(contentKey),
			stillOnNewContent,
		);
		return () => {
			clearTimeout(clearId);
			clearTimeout(id);
		};
	}, [contentKey, stillOnNewContent]);

	// Measure a single announcement group and render enough copies to cover the
	// ticker viewport before the loop returns to its identical next group.
	const groupRef = React.useRef<HTMLSpanElement>(null);
	const contentViewportRef = React.useRef<HTMLDivElement>(null);
	const [groupWidth, setGroupWidth] = React.useState(0);
	const [viewportWidth, setViewportWidth] = React.useState(0);
	const [duration, setDuration] = React.useState(22);
	React.useLayoutEffect(() => {
		const group = groupRef.current;
		const viewport = contentViewportRef.current;
		if (!group || !viewport) return undefined;
		const measure = () => {
			const nextGroupWidth = group.getBoundingClientRect().width;
			const nextViewportWidth = viewport.clientWidth;
			setGroupWidth(nextGroupWidth);
			setViewportWidth(nextViewportWidth);
			const nextDuration = Math.max(8, nextGroupWidth / 72);
			setDuration((current) =>
				Math.abs(current - nextDuration) < 0.1 ? current : nextDuration,
			);
		};
		measure();
		if (typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(measure);
		observer.observe(group);
		observer.observe(viewport);
		return () => observer.disconnect();
	}, [contentKey]);

	// Every ticker loops a whole group. Repeating it through the visible width
	// avoids exposing empty space when a short message starts to move.
	const shouldScroll = groupWidth > 0;
	const repeatCount = shouldScroll
		? Math.max(2, Math.ceil(viewportWidth / groupWidth) + 1)
		: 1;

	const group = (key: string, measure = false) => (
		<span
			key={key}
			ref={measure ? groupRef : undefined}
			className="inline-flex items-center"
		>
			{seq.map((t, i) => (
				<span
					key={i}
					className="flex-none whitespace-nowrap font-body text-[20px] font-semibold leading-none"
					style={{
						paddingRight: 90,
						wordBreak: "keep-all",
						overflowWrap: "normal",
						color,
					}}
				>
					{t}
				</span>
			))}
		</span>
	);

	const trackAnimation =
		!splitAlert && isAlert && alertLeaving
			? "swipeOut .3s var(--ease-out) both"
			: scrollingKey === contentKey
				? shouldScroll
					? `tickmove ${duration}s linear infinite`
					: "none"
				: "swipeIn .35s var(--ease-pop) both";

	const track = (
		<div
			key={contentKey}
			className="inline-flex items-center"
			style={
				{
					animation: trackAnimation,
					willChange: "transform",
					"--tick-distance": `-${groupWidth}px`,
				} as React.CSSProperties
			}
		>
			{Array.from({ length: repeatCount }, (_, index) =>
				group(`group-${index}`, index === 0),
			)}
		</div>
	);

	return (
		<div
			ref={splitAlert ? undefined : contentViewportRef}
			className="relative flex flex-1 min-w-0 items-stretch overflow-hidden whitespace-nowrap text-paper"
			style={{
				background,
				borderTop,
				animation: splitAlert
					? alertLeaving
						? "swipeOut .3s var(--ease-out) both"
						: "swipeIn .35s var(--ease-pop) both"
					: "none",
			}}
		>
			<div
				className="absolute inset-0 opacity-50 pointer-events-none"
				style={{
					backgroundImage: HALFTONE,
					backgroundSize: "11px 11px",
				}}
			/>
			{splitAlert ? (
				<div className="flex w-full min-w-0">
					<div className="flex flex-none items-center border-r-3 border-r-ink bg-ink px-3 font-mono text-sm font-bold tracking-widest text-paper w-28">
						<p
							key={`${alertLabel}-${lang}`}
							className="text-center w-full"
							style={{
								animation: "swipeIn .35s var(--ease-pop) both",
							}}
						>
							{alertLabel}
						</p>
					</div>
					<div
						ref={contentViewportRef}
						className="flex flex-1 min-w-0 items-center overflow-hidden pl-2"
					>
						{track}
					</div>
				</div>
			) : (
				track
			)}
		</div>
	);
}
