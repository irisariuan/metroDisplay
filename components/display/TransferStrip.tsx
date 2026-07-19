"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { Route, Lang } from "@/types/metro";
import { LineChip } from "./LineChip";

interface TransferStripProps {
	route: Route;
	pos: number;
	lang: Lang;
	expanded?: boolean;
}

// ——— transfer strip: connecting lines at the current station
export function TransferStrip({
	route,
	pos,
	lang,
	expanded = false,
}: TransferStripProps) {
	const st = route.stations[pos];
	const viewportRef = React.useRef<HTMLDivElement>(null);
	const contentRef = React.useRef<HTMLDivElement>(null);
	const [shouldMarquee, setShouldMarquee] = React.useState(false);

	const transferKey = `${lang}:${st.xf.map((lid) => `${lid}-${lang === "ja" ? LINES[lid].ja : LINES[lid].en}`).join("|")}`;
	React.useLayoutEffect(() => {
		let frame = 0;
		let observer: ResizeObserver | undefined;
		const measure = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				// Read the refs at measurement time. The measured copy is replaced
				// when marquee mode changes, so capturing the initial node leaves the
				// width observer comparing against a detached element.
				const viewport = viewportRef.current;
				const content = contentRef.current;
				if (!viewport || !content) return;
				const contentWidth = Math.max(
					content.scrollWidth,
					content.getBoundingClientRect().width,
				);
				const viewportWidth = viewport.getBoundingClientRect().width;
				setShouldMarquee(contentWidth > viewportWidth + 2);
			});
		};

		measure();
		void document.fonts?.ready.then(measure);
		if (typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(measure);
			if (viewportRef.current) observer.observe(viewportRef.current);
			if (contentRef.current) observer.observe(contentRef.current);
		}
		window.addEventListener("resize", measure);
		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [expanded, transferKey]);

	if (!st.xf || !st.xf.length) return null;

	const content = (key: string, measure = false) => (
		<div
			key={key}
			ref={measure ? contentRef : undefined}
			className="inline-flex w-max items-center gap-3"
		>
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
			data-transfer-marquee={shouldMarquee || undefined}
			className="flex items-center w-full min-w-0 gap-3"
			style={{
				animation: "swipeIn .4s var(--ease-out) both",
				justifyContent: expanded ? "center" : undefined,
			}}
		>
			<span className="flex-none font-mono text-label tracking-[0.12em] text-muted">
				{lang === "ja" ? "乗換" : "TRANSFER"}
			</span>
			<div
				ref={viewportRef}
				className="min-w-0 overflow-hidden"
				style={
					expanded
						? {
								flex: "0 1 auto",
								maxWidth: "calc(100% - 100px)",
							}
						: { flex: "1 1 0%" }
				}
			>
				{shouldMarquee ? (
					<div className="inline-flex items-center w-max animate-xfmove will-change-transform">
						<div className="flex-none pr-8">
							{content("first", true)}
						</div>
						<div className="flex-none pr-8">{content("repeat")}</div>
					</div>
				) : (
					content("static", true)
				)}
			</div>
		</div>
	);
}
