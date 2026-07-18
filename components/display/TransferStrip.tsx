"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { Route, Lang } from "@/types/metro";
import { LineChip } from "./LineChip";

interface TransferStripProps {
	route: Route;
	pos: number;
	lang: Lang;
}

// ——— transfer strip: connecting lines at the current station
export function TransferStrip({ route, pos, lang }: TransferStripProps) {
	const st = route.stations[pos];
	const viewportRef = React.useRef<HTMLDivElement>(null);
	const contentRef = React.useRef<HTMLDivElement>(null);
	const [overflows, setOverflows] = React.useState(false);

	const transferKey = `${lang}:${st.xf.map((lid) => `${lid}-${lang === "ja" ? LINES[lid].ja : LINES[lid].en}`).join("|")}`;
	React.useLayoutEffect(() => {
		const viewport = viewportRef.current;
		const content = contentRef.current;
		if (!viewport || !content) return undefined;
		const measure = () =>
			setOverflows(content.scrollWidth > viewport.clientWidth + 2);
		measure();
		if (typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(content);
		return () => observer.disconnect();
	}, [transferKey]);

	if (!st.xf || !st.xf.length) return null;

	const content = (key: string) => (
		<div key={key} className="inline-flex items-center gap-3 w-max pr-8">
			{st.xf.map((lid) => (
				<div key={lid} className="flex flex-none items-center gap-1.5">
					<LineChip lineId={lid} size={28} />
					<span className="font-body font-semibold text-[15px] whitespace-nowrap">
						{lang === "ja" ? LINES[lid].ja : LINES[lid].en}
					</span>
				</div>
			))}
		</div>
	);

	return (
		<div
			key={"xf" + transferKey}
			className="flex items-center w-full min-w-0 gap-3"
			style={{ animation: "swipeIn .4s var(--ease-out) both" }}
		>
			<span className="flex-none font-mono text-label tracking-[0.12em] text-muted">
				{lang === "ja" ? "乗換" : "TRANSFER"}
			</span>
			<div ref={viewportRef} className="flex-1 min-w-0 overflow-hidden">
				{overflows ? (
					<div className="inline-flex items-center w-max animate-xfmove will-change-transform">
						<div ref={contentRef}>{content("first")}</div>
						{content("repeat")}
					</div>
				) : (
					<div ref={contentRef}>{content("static")}</div>
				)}
			</div>
		</div>
	);
}
