"use client";
import React from "react";

interface MarqueeProps {
	text: string;
	textStyle?: React.CSSProperties;
	align?: string;
}

// marquee: scrolls text horizontally only when it overflows its cell, else stays centered
export function Marquee({ text, textStyle, align = "center" }: MarqueeProps) {
	const ref = React.useRef<HTMLDivElement>(null);
	const [over, setOver] = React.useState(0);
	React.useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const d = el.scrollWidth - el.clientWidth;
		setOver(d > 2 ? d + 12 : 0);
	}, [text]);
	return (
		<div
			ref={ref}
			className="overflow-hidden w-full whitespace-nowrap"
			style={{ textAlign: align as React.CSSProperties["textAlign"] }}
		>
			<span
				key={text}
				className="inline-block"
				style={
					{
						...textStyle,
						animation: over
							? "mq 5s ease-in-out infinite alternate"
							: "none",
						animationDelay: over ? "2s" : "0s",
						"--mq": `-${over}px`,
					} as React.CSSProperties
				}
			>
				{text}
			</span>
		</div>
	);
}
