"use client";

import { Button } from "@/components/ds";

interface TrainControlsProps {
	auto: boolean;
	onPrevious: () => void;
	onToggleAuto: () => void;
	onNext: () => void;
}

export function TrainControls({ auto, onPrevious, onToggleAuto, onNext }: TrainControlsProps) {
	return <div className="rounded-xl border-3 border-ink bg-acid p-3 text-ink" style={{ boxShadow: "4px 4px 0 var(--magenta)" }}>
		<div className="mb-2 font-mono text-sm tracking-widest text-muted">TRAIN</div>
		<div className="grid grid-cols-3 items-center gap-1.5">
			<Button variant="ghost" size="s" onClick={onPrevious}>PREV</Button>
			<Button variant={auto ? "primary" : "accent"} size="m" onClick={onToggleAuto}>{auto ? "PAUSE" : "PLAY"}</Button>
			<Button variant="ghost" size="s" onClick={onNext}>NEXT</Button>
		</div>
	</div>;
}
