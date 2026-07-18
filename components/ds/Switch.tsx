"use client";

import type { ReactNode } from "react";

interface SwitchProps {
	checked: boolean;
	onChange?: (checked: boolean) => void;
	label?: ReactNode;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-2.5 font-body font-semibold">
			<span
				onClick={() => onChange && onChange(!checked)}
				className={[
					"relative inline-block h-6.5 w-11.5 rounded-pill border-[3px] border-ink transition-colors duration-120",
					checked ? "bg-accent" : "bg-paper",
				].join(" ")}
			>
				<span
					className={[
						"absolute top-px h-4.5 w-4.5 rounded-full bg-ink transition-[left] duration-120 ease-pop",
						checked ? "left-5.5" : "left-px",
					].join(" ")}
				/>
			</span>
			{label}
		</label>
	);
}
