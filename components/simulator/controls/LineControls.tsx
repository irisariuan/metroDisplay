"use client";

import {
	LINES,
	type SimulatorPreset,
	type SimulatorPresetId,
} from "@/lib/metro-data";
import { LineButton } from "@/components/simulator/LineButton";
import { LineEditor } from "@/components/simulator/LineEditor";
import type {
	EditableRoute,
	EditableStationField,
	LineEditorField,
	LineId,
	RouteDestinationField,
} from "@/types/metro";

interface LineControlsProps {
	presets: SimulatorPreset[];
	presetId: SimulatorPresetId;
	lineId: LineId;
	route: EditableRoute;
	showEditor: boolean;
	onAddLine: () => void;
	onToggleEditor: () => void;
	onPickLine: (lineId: LineId) => void;
	onPickPreset: (presetId: SimulatorPresetId) => void;
	onAddPreset: () => void;
	onSetPresetLabel: (label: string) => void;
	onTogglePresetLine: (lineId: LineId) => void;
	setLineField: (field: LineEditorField, value: string) => void;
	setStationField: (
		index: number,
		field: EditableStationField,
		value: string | number,
	) => void;
	toggleSide: (index: number) => void;
	toggleMajorStation: (index: number) => void;
	toggleXfer: (index: number, lineId: LineId) => void;
	addStation: () => void;
	removeStation: (index: number) => void;
	moveStation: (index: number, direction: number) => void;
	setDest: (field: RouteDestinationField, value: string) => void;
	toggleCircular: () => void;
}

export function LineControls({
	presets,
	presetId,
	lineId,
	route,
	showEditor,
	onAddLine,
	onToggleEditor,
	onPickLine,
	onPickPreset,
	onAddPreset,
	onSetPresetLabel,
	onTogglePresetLine,
	setLineField,
	setStationField,
	toggleSide,
	toggleMajorStation,
	toggleXfer,
	addStation,
	removeStation,
	moveStation,
	setDest,
	toggleCircular,
}: LineControlsProps) {
	const activePreset = presets.find(
		(preset) => preset.id === presetId,
	);
	const visibleLineIds = activePreset
		? activePreset.lineIds
		: (Object.keys(LINES) as LineId[]);
	const customPreset = Boolean(activePreset && !["shuika", "yamanote"].includes(activePreset.id));

	return (
		<>
			<div>
				<div className="mb-2 font-mono text-sm tracking-widest text-muted">
					PRESET · プリセット
				</div>
				<div className="flex flex-wrap gap-2.5">
					{presets.map((preset) => (
						<button
							key={preset.id}
							type="button"
							className="lc-btn"
							aria-pressed={presetId === preset.id}
							onClick={() => onPickPreset(preset.id)}
							style={{
								background:
									presetId === preset.id
										? "var(--acid)"
										: "var(--paper)",
								color: "var(--ink)",
								fontSize: 12,
							}}
						>
							{preset.label}
						</button>
					))}
					<button
						type="button"
						className="lc-btn"
						onClick={onAddPreset}
						style={{ background: "var(--ink)", color: "var(--paper)", fontSize: 12 }}
					>
						+ ADD PRESET
					</button>
				</div>
			</div>
			{customPreset && activePreset ? (
				<div className="rounded-lg border-2 border-ink bg-paper-2 p-2.5">
					<div className="mb-2 font-mono text-[11px] font-bold tracking-widest text-muted">
						CUSTOM PRESET
					</div>
					<input
						value={activePreset.label}
						onChange={(event) => onSetPresetLabel(event.target.value)}
						aria-label="Preset name"
						className="mb-2 w-full rounded-[5px] border-2 border-ink bg-paper px-2 py-1 font-mono text-sm font-bold text-ink"
					/>
					<div className="flex flex-wrap gap-1.5">
						{(Object.keys(LINES) as LineId[]).map((id) => {
							const selected = activePreset.lineIds.includes(id);
							return (
								<button
									key={id}
									type="button"
									className="lc-btn"
									aria-pressed={selected}
									onClick={() => onTogglePresetLine(id)}
									style={{
										background: selected ? LINES[id].color : "var(--paper)",
										color: selected ? LINES[id].textOnColor : "var(--ink)",
										fontSize: 11,
									}}
								>
									{LINES[id].code}
								</button>
							);
						})}
					</div>
				</div>
			) : null}
			<div>
				<div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
					<div className="font-mono text-sm tracking-widest text-muted">
						LINE · 路線
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							className="lc-btn"
							onClick={onAddLine}
							style={{
								background: "var(--acid)",
								color: "var(--ink)",
								fontSize: 12,
							}}
						>
							+ ADD LINE
						</button>
						<button
							className="lc-btn"
							onClick={onToggleEditor}
							style={{
								background: showEditor
									? "var(--acid)"
									: "var(--paper)",
								color: "var(--ink)",
								fontSize: 12,
							}}
						>
							{showEditor ? "✕ CLOSE EDITOR" : "✎ EDIT LINE"}
						</button>
					</div>
				</div>
				<div className="flex flex-wrap gap-2.5">
					{visibleLineIds.map((id) => (
						<LineButton
							key={id}
							lineId={id}
							active={id === lineId}
							onClick={() => onPickLine(id)}
						/>
					))}
				</div>
			</div>
			{showEditor ? (
				<LineEditor
					route={route}
					lineId={lineId}
					setLineField={setLineField}
					setStationField={setStationField}
					toggleSide={toggleSide}
					toggleMajorStation={toggleMajorStation}
					toggleXfer={toggleXfer}
					addStation={addStation}
					removeStation={removeStation}
					moveStation={moveStation}
					setDest={setDest}
					toggleCircular={toggleCircular}
				/>
			) : null}
		</>
	);
}
