"use client";
/* Combined surface: display + controls + engine on one page (`/`).
 * The engine lives in useSimulatorEngine so the same logic can also back the
 * split-device `/display` and `/control` surfaces. */
import React from "react";
import { SimulatorDisplay } from "@/components/simulator/SimulatorDisplay";
import { SimulatorControls } from "@/components/simulator/SimulatorControls";
import { AnnouncementAudio } from "@/components/simulator/AnnouncementAudio";
import { useSimulatorEngine } from "@/components/simulator/useSimulatorEngine";

interface MetroSimulatorProps {
	children: React.ReactNode;
}

export function MetroSimulator({ children }: MetroSimulatorProps) {
	const {
		controls,
		dispatch,
		displayProps,
		context,
		audioRef,
		audioProps,
		status,
	} = useSimulatorEngine();

	return (
		<>
			<div className="mb-4.5 flex flex-wrap items-end justify-between gap-4">
				{children}
				<div className="text-right font-mono text-sm tracking-widest text-paper-2 opacity-70">
					<div>
						{status.phase === "at"
							? "STOPPED · ドア開"
							: "RUNNING · 走行中"}
					</div>
					<div>{status.auto ? "AUTO-PLAY" : "MANUAL"}</div>
				</div>
			</div>

			<SimulatorDisplay {...displayProps} />
			<AnnouncementAudio ref={audioRef} {...audioProps} />

			<SimulatorControls
				state={controls}
				dispatch={dispatch}
				context={context}
			/>
		</>
	);
}
