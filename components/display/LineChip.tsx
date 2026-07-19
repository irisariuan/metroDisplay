"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { LineId } from "@/types/metro";

interface LineChipProps {
	lineId: LineId;
	size?: number;
}

// ——— small line chip (used for transfers + legend)
export function LineChip({ lineId, size = 26 }: LineChipProps) {
	const L = LINES[lineId];
	const chipRef = React.useRef<HTMLSpanElement>(null);
	const labelRef = React.useRef<HTMLSpanElement>(null);
	const baseFontSize = size * 0.44;
	const [fontSize, setFontSize] = React.useState(baseFontSize);

	React.useLayoutEffect(() => {
		const chip = chipRef.current;
		const label = labelRef.current;
		if (!chip || !label) return undefined;
		let cancelled = false;

		const fitLabel = () => {
			if (cancelled) return;
			label.style.fontSize = `${baseFontSize}px`;
			const availableWidth = Math.max(0, chip.clientWidth - 6);
			const naturalWidth = label.getBoundingClientRect().width;
			const nextFontSize =
				naturalWidth > availableWidth && naturalWidth > 0
					? Math.max(1, baseFontSize * (availableWidth / naturalWidth))
					: baseFontSize;
			label.style.fontSize = `${nextFontSize}px`;
			setFontSize((current) =>
				Math.abs(current - nextFontSize) < 0.1 ? current : nextFontSize,
			);
		};

		fitLabel();
		void document.fonts?.ready.then(fitLabel);
		if (typeof ResizeObserver === "undefined") {
			return () => {
				cancelled = true;
			};
		}
		const observer = new ResizeObserver(fitLabel);
		observer.observe(chip);
		return () => {
			cancelled = true;
			observer.disconnect();
		};
	}, [L.code, baseFontSize, size]);

	return (
		<span
			ref={chipRef}
			title={L.en}
			className="inline-flex items-center justify-center flex-none rounded-s font-mono font-bold border-2 border-[rgba(0,0,0,0.25)]"
			style={{
				width: size,
				height: size,
				background: L.color,
				color: L.textOnColor,
			}}
		>
			<span
				ref={labelRef}
				className="block whitespace-nowrap leading-none"
				style={{ fontSize }}
			>
				{L.code}
			</span>
		</span>
	);
}
