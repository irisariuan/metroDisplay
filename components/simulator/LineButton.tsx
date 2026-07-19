"use client";
import { LINES } from "@/lib/metro-data";
import type { LineId } from "@/types/metro";

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
				background: active ? L.color : "var(--paper)",
				color: active ? L.textOnColor : "var(--ink)",
				boxShadow: active
					? "var(--shadow-hard-s)"
					: "2px 2px 0 rgba(0,0,0,.25)",
			}}
		>
			<span
				className="rounded-[5px] px-1.5 py-px font-mono text-[12px] font-bold"
				style={{
					background: active ? "rgba(0,0,0,.22)" : L.color,
					color: active ? "#fff" : L.textOnColor,
				}}
			>
				{L.code}
			</span>
			{L.ja}
		</button>
	);
}
