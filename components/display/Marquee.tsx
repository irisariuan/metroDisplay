"use client";
import React from "react";

interface MarqueeProps {
	text: string;
	textStyle?: React.CSSProperties;
	align?: string;
}

// Only shown while scrolling: soften both edges so text dissolves in and out of
// the clip window instead of being sliced off mid-glyph. The fade widths are
// animated custom properties (see maskMq) so the edge the text has scrolled up
// against clears to 0 while the edge still hiding text keeps its fade.
const FADE_MASK =
	"linear-gradient(to right, transparent 0, #000 var(--fade-left), #000 calc(100% - var(--fade-right)), transparent 100%)";

// marquee: scrolls text horizontally only when it overflows its cell, else stays centered
export function Marquee({
	text,
	textStyle,
	align = "center",
}: MarqueeProps) {
	const viewportRef = React.useRef<HTMLDivElement>(null);
	const textRef = React.useRef<HTMLSpanElement>(null);
	const [overflowDistance, setOverflowDistance] = React.useState(0);
	React.useLayoutEffect(() => {
		const viewport = viewportRef.current;
		const content = textRef.current;
		if (!viewport || !content) return undefined;
		const measureNaturalWidth = () => {
			const computed = window.getComputedStyle(content);
			const probe = document.createElement("span");
			probe.style.cssText = [
				"position:fixed",
				"top:-9999px",
				"left:-9999px",
				"visibility:hidden",
				"pointer-events:none",
				"white-space:pre",
				`font:${computed.font}`,
				`letter-spacing:${computed.letterSpacing}`,
				`word-spacing:${computed.wordSpacing}`,
			].join(";");
			probe.textContent = text;
			document.body.appendChild(probe);
			const width = Math.ceil(probe.getBoundingClientRect().width);
			probe.remove();
			return width;
		};
		const measure = () => {
			const naturalWidth = measureNaturalWidth();
			const distance = naturalWidth - viewport.clientWidth;
			setOverflowDistance(distance > 2 ? distance + 12 : 0);
		};
		measure();
		if (typeof ResizeObserver === "undefined") return undefined;
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		observer.observe(content);
		return () => observer.disconnect();
	}, [text]);
	const isOverflowing = overflowDistance > 0;
	return (
		<div
			ref={viewportRef}
			className="overflow-hidden w-full whitespace-nowrap"
			style={{
				textAlign: (isOverflowing
					? "left"
					: align) as React.CSSProperties["textAlign"],
				...(isOverflowing
					? {
							maskImage: FADE_MASK,
							WebkitMaskImage: FADE_MASK,
							// Same duration/delay/easing/direction as the text's
							// `mq` animation so the fades stay in sync; `both`
							// holds the start fades through the 2s lead-in.
							animation:
								"maskMq 5s ease-in-out 2s infinite alternate both",
						}
					: {}),
			}}
		>
			<span
				ref={textRef}
				className="inline-block"
				style={
					{
						...textStyle,
						animation: isOverflowing
							? "mq 5s ease-in-out infinite alternate"
							: "none",
						animationDelay: isOverflowing ? "2s" : "0s",
						"--mq": `-${overflowDistance}px`,
					} as React.CSSProperties
				}
			>
				{text}
			</span>
		</div>
	);
}
