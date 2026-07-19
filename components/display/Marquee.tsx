"use client";
import React from "react";

interface MarqueeProps {
	text: string;
	textStyle?: React.CSSProperties;
	align?: string;
}

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
