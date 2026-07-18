"use client";
import React from "react";
import type { Lang } from "@/types/metro";
import { FullAlertMessage } from "./FullAlertMessage";

interface AlertOverlayProps {
	message: string;
	secondMessage?: string;
	full?: boolean;
	leaving?: boolean;
	lang?: Lang;
}

export function AlertOverlay({
	message,
	secondMessage,
	full = false,
	leaving = false,
	lang = "en",
}: AlertOverlayProps) {
	const displayMessage =
		lang === "ja" && secondMessage ? secondMessage : message;
	const alertLabel = lang === "ja" ? "お知らせ" : "ALERT";
	const serviceLabel =
		lang === "ja" ? "水下地鐵 · 運行情報" : "SHUIKA METRO · SERVICE ALERT";
	const instruction =
		lang === "ja"
			? "係員の案内に従ってください"
			: "PLEASE FOLLOW STAFF INSTRUCTIONS";
	const animation = full
		? leaving
			? "swipeVerticalOut .35s var(--ease-out) both"
			: "swipeVerticalIn .35s var(--ease-pop) both"
		: leaving
			? "swipeOut .3s var(--ease-out) both"
			: "swipeIn .35s var(--ease-pop) both";

	if (!full) {
		return (
			<div
				className="absolute inset-0 z-30 box-border flex items-center justify-center border-none bg-magenta px-5 py-2 text-center font-display text-ink"
				style={{
					fontSize: 26,
					lineHeight: 0.95,
					letterSpacing: ".02em",
					animation,
				}}
			>
				<span
					key={`${lang}-${displayMessage}`}
					className="inline-block"
					style={{ animation: "swipeIn .35s var(--ease-pop) both" }}
				>
					{`${alertLabel} · ${displayMessage}`}
				</span>
			</div>
		);
	}

	return (
		<div
			className="relative overflow-hidden bg-ink text-paper"
			style={{ height: "clamp(520px, 55vw, 720px)", animation }}
		>
			<div className="absolute right-0 top-0 h-full w-[34%] border-l-4 border-l-ink bg-magenta" />
			<div className="absolute bottom-0 left-0 h-3 w-full bg-acid" />
			<div
				className="relative flex h-full flex-col justify-between"
				style={{ padding: "clamp(24px,5vw,64px)" }}
			>
				<div className="font-mono text-[13px] font-bold tracking-[.16em] text-acid">
					{serviceLabel}
				</div>
				<div
					key={`${lang}-${displayMessage}`}
					className="flex min-h-0 w-full flex-1"
					style={{ animation: "swipeIn .35s var(--ease-pop) both" }}
				>
					<FullAlertMessage message={displayMessage} />
				</div>
				<div className="font-mono text-label font-bold tracking-widest text-paper">
					{instruction}
				</div>
			</div>
		</div>
	);
}
