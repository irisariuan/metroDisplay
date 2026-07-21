"use client";
import { LINES } from "@/lib/metro-data";
import type { LineId } from "@/types/metro";
import { LineChip } from "@/components/display/LineChip";

interface LineButtonProps {
	lineId: LineId;
	active: boolean;
	onClick: () => void;
}

export function LineButton({ lineId, active, onClick }: LineButtonProps) {
	const L = LINES[lineId];
	return (
		<button
			onClick={onClick}
			className="lc-btn inline-flex items-center gap-2"
			style={{
				background: active
					? `rgb(from ${L.color} r g b / 0.9)`
					: "var(--paper)",
				color: active ? "white" : "var(--ink)",
				boxShadow: active
					? "var(--shadow-hard-s)"
					: "2px 2px 0 rgba(0,0,0,.25)",
			}}
		>
			<LineChip lineId={lineId} size={22} />
			{L.ja}
		</button>
	);
}
