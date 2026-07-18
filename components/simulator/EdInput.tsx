"use client";
import React from "react";

interface EdInputProps {
	value: string | number;
	onChange: (value: string) => void;
	w?: number | string;
	mono?: boolean;
	type?: string;
	min?: number;
	step?: number;
}

export function EdInput({
	value,
	onChange,
	w,
	mono,
	type = "text",
	min,
	step,
}: EdInputProps) {
	return (
		<input
			type={type}
			min={min}
			step={step}
			value={value}
			onChange={(ev) => onChange(ev.target.value)}
			className="min-w-0 rounded-[6px] border-2 border-ink bg-paper px-2 py-[6px] text-[14px] font-semibold text-ink"
			style={{
				width: w || 120,
				fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
			}}
		/>
	);
}
