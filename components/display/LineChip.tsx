"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import type { LineId } from "@/types/metro";

interface LineChipProps {
	lineId: LineId;
	/** Chip edge length when expanded. */
	size?: number;
	/** false → collapse to a colour-only mini dot (no code); true → full chip. */
	expanded?: boolean;
	/** Dot edge length when collapsed. */
	miniSize?: number;
}

// ——— line chip: a full chip (line colour + code) that can collapse into a
// colour-only mini dot. Both states share one element, so switching between
// them — e.g. a transfer dot growing into a full chip on arrival — animates
// smoothly (size, corner radius, border and the code all transition).
export function LineChip({
	lineId,
	size = 26,
	expanded = true,
	miniSize = 10,
}: LineChipProps) {
	const L = LINES[lineId];
	const labelRef = React.useRef<HTMLSpanElement>(null);
	const baseFontSize = size * 0.44;
	const [fontSize, setFontSize] = React.useState(baseFontSize);

	// Fit the code to the FULL chip width (not the animated width) so the label
	// keeps a steady size while the chip grows or shrinks.
	React.useLayoutEffect(() => {
		const label = labelRef.current;
		if (!label) return undefined;
		let cancelled = false;

		const fitLabel = () => {
			if (cancelled) return;
			label.style.fontSize = `${baseFontSize}px`;
			const availableWidth = Math.max(0, size - 6);
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
		return () => {
			cancelled = true;
		};
	}, [L.code, baseFontSize, size]);

	const dimension = expanded ? size : miniSize;
	return (
		<span
			title={L.en}
			className="inline-flex items-center justify-center flex-none overflow-hidden font-mono font-bold"
			style={{
				width: dimension,
				height: dimension,
				background: L.color,
				color: L.textOnColor,
				borderRadius: expanded ? 6 : 3,
				borderWidth: expanded ? 2 : 0,
				borderStyle: "solid",
				borderColor: "rgba(0,0,0,0.25)",
				transition:
					"width .4s var(--ease-pop), height .4s var(--ease-pop), border-width .4s var(--ease-pop), border-radius .4s var(--ease-pop)",
			}}
		>
			<span
				ref={labelRef}
				className="block whitespace-nowrap leading-none"
				style={{
					fontSize,
					opacity: expanded ? 1 : 0,
					transition: "opacity .4s var(--ease-pop)",
				}}
			>
				{L.code}
			</span>
		</span>
	);
}
