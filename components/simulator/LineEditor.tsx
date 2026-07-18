"use client";
import React from "react";
import { LINES } from "@/lib/metro-data";
import { Switch } from "@/components/ds";
import type { LineId } from "@/types/metro";
import { EdInput } from "./EdInput";
import { LineColorEditor } from "./LineColorEditor";

interface LineEditorProps {
	// `route`/`station` here carry editor-only fields (e.g. `distance`, `circular`)
	// that aren't part of the shared `Route`/`Station` types — kept loose deliberately.
	route: any;
	lineId: LineId;
	setLineField: (field: string, value: string) => void;
	setStationField: (index: number, field: string, value: any) => void;
	toggleSide: (index: number) => void;
	toggleXfer: (index: number, lid: LineId) => void;
	addStation: () => void;
	removeStation: (index: number) => void;
	moveStation: (index: number, dir: number) => void;
	setDest: (field: string, value: string) => void;
	toggleCircular: () => void;
}

interface IconBtnProps {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}

function IconBtn({ label, onClick, disabled }: IconBtnProps) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className="lc-btn bg-paper px-[9px] py-1 text-[13px] text-ink"
		>
			{label}
		</button>
	);
}

export function LineEditor({
	route,
	lineId,
	setLineField,
	setStationField,
	toggleSide,
	toggleXfer,
	addStation,
	removeStation,
	moveStation,
	setDest,
	toggleCircular,
}: LineEditorProps) {
	const L = LINES[lineId];

	return (
		<div className="flex flex-col gap-3 rounded-[14px] border-[3px] border-ink bg-paper-2 p-[14px]">
			{/* header + destination */}
			<div className="flex flex-wrap items-center gap-3">
				<span
					className="inline-flex items-center gap-2 rounded-[8px] px-[10px] py-1 font-body font-bold"
					style={{ background: L.color, color: L.textOnColor }}
				>
					<span className="font-mono">{L.code}</span>
					{lineId}
					{" EDITOR"}
				</span>
				<span className="font-mono text-[11px] tracking-[.1em] text-muted">
					LINE NAME 路線名
				</span>
				<EdInput value={L.ja} onChange={(v) => setLineField("ja", v)} w={130} />
				<EdInput value={L.en} onChange={(v) => setLineField("en", v)} w={180} />
				<span className="font-mono text-[11px] tracking-[.1em] text-muted">
					DEST 行先
				</span>
				<EdInput
					value={route.destJa}
					onChange={(v) => setDest("destJa", v)}
					w={130}
				/>
				<EdInput
					value={route.destEn}
					onChange={(v) => setDest("destEn", v)}
					w={180}
				/>
			</div>

			<LineColorEditor
				color={L.color}
				onChange={(color) => setLineField("color", color)}
			/>

			<div className="flex items-center rounded-[8px] border-2 border-ink bg-acid px-[10px] py-2">
				<Switch
					checked={!!route.circular}
					onChange={toggleCircular}
					label="CIRCULAR LINE · LOOP AT TERMINUS"
				/>
			</div>

			{/* column headers */}
			<div
				className="grid items-center px-2 pb-[2px] font-mono text-[10px] tracking-[.1em] text-muted"
				style={{
					gridTemplateColumns: "24px 105px 145px 105px 105px 74px 70px 1fr 88px",
					gap: 8,
				}}
			>
				<span>#</span>
				<span>日本語</span>
				<span>ENGLISH</span>
				<span>ひらがな</span>
				<span>カタカナ</span>
				<span>DIST KM</span>
				<span>DOOR</span>
				<span>TRANSFERS</span>
				<span></span>
			</div>

			{/* station rows */}
			<div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
				{route.stations.map((st, i) => (
					<div
						key={i}
						className="grid items-center rounded-[8px] border-2 border-ink bg-paper px-2 py-[6px]"
						style={{
							gridTemplateColumns:
								"24px 105px 145px 105px 105px 74px 70px 1fr 88px",
							gap: 8,
						}}
					>
						<span
							className="font-mono text-[12px] font-bold"
							style={{ color: L.color }}
						>
							{L.code + String(i + 1).padStart(2, "0")}
						</span>
						<EdInput
							value={st.ja}
							onChange={(v) => setStationField(i, "ja", v)}
							w="100%"
						/>
						<EdInput
							value={st.en}
							onChange={(v) => setStationField(i, "en", v)}
							w="100%"
						/>
						<EdInput
							value={st.hira || ""}
							onChange={(v) => setStationField(i, "hira", v)}
							w="100%"
						/>
						<EdInput
							value={st.kata || ""}
							onChange={(v) => setStationField(i, "kata", v)}
							w="100%"
						/>
						{i === 0 && !route.circular ? (
							<span className="font-mono text-[12px] text-muted">—</span>
						) : (
							<EdInput
								value={st.distance ?? 1}
								onChange={(v) => setStationField(i, "distance", v)}
								w="100%"
								mono
								type="number"
								min={0}
								step={0.1}
							/>
						)}
						<button
							onClick={() => toggleSide(i)}
							className="lc-btn px-[10px] py-1 text-[12px] text-white"
							style={{
								background: st.side === "L" ? "var(--blue)" : "var(--orange)",
							}}
						>
							{st.side === "L" ? "◀ L" : "R ▶"}
						</button>
						{/* transfers toggles */}
						<div className="flex flex-wrap gap-1">
							{Object.keys(LINES)
								.filter((lid) => lid !== lineId)
								.map((lid) => {
									const on = (st.xf || []).includes(lid as LineId);
									return (
										<button
											key={lid}
											onClick={() => toggleXfer(i, lid as LineId)}
											title={LINES[lid as LineId].en}
											className="h-[26px] w-[26px] cursor-pointer rounded-[6px] font-mono text-[12px] font-bold"
											style={{
												border: `2px solid ${LINES[lid as LineId].color}`,
												background: on ? LINES[lid as LineId].color : "transparent",
												color: on
													? LINES[lid as LineId].textOnColor
													: LINES[lid as LineId].color,
												opacity: on ? 1 : 0.5,
											}}
										>
											{LINES[lid as LineId].code}
										</button>
									);
								})}
						</div>
						{/* row actions */}
						<div className="flex justify-end gap-1">
							<IconBtn label="↑" onClick={() => moveStation(i, -1)} disabled={i === 0} />
							<IconBtn
								label="↓"
								onClick={() => moveStation(i, 1)}
								disabled={i === route.stations.length - 1}
							/>
							<IconBtn
								label="✕"
								onClick={() => removeStation(i)}
								disabled={route.stations.length <= 2}
							/>
						</div>
					</div>
				))}
			</div>

			<div>
				<button
					onClick={addStation}
					className="lc-btn bg-acid text-[13px] text-ink"
				>
					+ ADD STATION
				</button>
			</div>
		</div>
	);
}
