"use client";
import React from "react";

interface LineColorEditorProps {
	color: string;
	onChange: (color: string) => void;
}

export function LineColorEditor({ color, onChange }: LineColorEditorProps) {
	const [draft, setDraft] = React.useState(color);
	const swatches = [
		"#12318f",
		"#22a355",
		"#e4632a",
		"#e0359a",
		"#f2b400",
		"#7d3fb0",
		"#0b7a75",
		"#c23c52",
	];
	const normalise = (value: string) => {
		const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
		if (!match) return null;
		const hex = match[1];
		return (
			"#" +
			(hex.length === 3
				? hex
						.split("")
						.map((digit) => digit + digit)
						.join("")
				: hex
			).toUpperCase()
		);
	};
	const commit = (value: string) => {
		const next = normalise(value);
		if (next) onChange(next);
		return next;
	};

	React.useEffect(() => {
		const id = setTimeout(() => setDraft(color), 0);
		return () => clearTimeout(id);
	}, [color]);

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="font-mono text-[11px] tracking-widest text-muted">
				LINE COLOR
			</span>
			<input
				type="color"
				value={color}
				aria-label="Line color"
				title="Choose line color"
				onChange={(ev) => {
					setDraft(ev.target.value);
					commit(ev.target.value);
				}}
				className="h-8.5 w-10.5 cursor-pointer rounded-md border-2 border-ink bg-paper p-0.5"
			/>
			<input
				value={draft}
				maxLength={7}
				aria-label="Line color hex value"
				onChange={(ev) => {
					const value = ev.target.value;
					setDraft(value);
					commit(value);
				}}
				onBlur={() => {
					if (!commit(draft)) setDraft(color);
				}}
				className="w-23 rounded-md border-2 border-ink bg-paper px-2 py-1.5 font-mono text-[13px] font-bold text-ink"
			/>
			<div className="flex items-center gap-1.25">
				{swatches.map((swatch) => (
					<button
						key={swatch}
						type="button"
						onClick={() => {
							setDraft(swatch);
							onChange(swatch);
						}}
						title={swatch}
						aria-label={`Use ${swatch}`}
						className="h-5.5 w-5.5 cursor-pointer rounded-full p-0"
						style={{
							border: `2px solid ${color === swatch ? "var(--ink)" : "transparent"}`,
							outline: color === swatch ? "2px solid var(--acid)" : "none",
							background: swatch,
						}}
					/>
				))}
			</div>
		</div>
	);
}
