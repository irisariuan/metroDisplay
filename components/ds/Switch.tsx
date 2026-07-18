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
					"relative inline-block h-[26px] w-[46px] rounded-pill border-[3px] border-ink transition-colors duration-[120ms]",
					checked ? "bg-accent" : "bg-paper",
				].join(" ")}
			>
				<span
					className={[
						"absolute top-px h-[18px] w-[18px] rounded-full bg-ink transition-[left] duration-[120ms] ease-pop",
						checked ? "left-[22px]" : "left-px",
					].join(" ")}
				/>
			</span>
			{label}
		</label>
	);
}
