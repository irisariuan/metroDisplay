"use client";

import { LINES } from "@/lib/metro-data";
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
	lineId: LineId;
	route: EditableRoute;
	showEditor: boolean;
	onAddLine: () => void;
	onToggleEditor: () => void;
	onPickLine: (lineId: LineId) => void;
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
	lineId,
	route,
	showEditor,
	onAddLine,
	onToggleEditor,
	onPickLine,
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
	return (
		<>
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
					{Object.keys(LINES).map((id) => (
						<LineButton
							key={id}
							lineId={id as LineId}
							active={id === lineId}
							onClick={() => onPickLine(id as LineId)}
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
