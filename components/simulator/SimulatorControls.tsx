"use client";

import React from "react";
import { Switch } from "@/components/ds";
import { SPEED_PRESETS } from "@/lib/constants";
import { LineControls } from "@/components/simulator/controls/LineControls";
import { TrainControls } from "@/components/simulator/controls/TrainControls";
import {
	setControl,
	type MarqueeContentItem,
	type SimulatorControlAction,
	type SimulatorControlState,
} from "@/components/simulator/simulatorControlState";
import type { LineId } from "@/types/metro";
import type { Route } from "@/types/metro";

interface SimulatorControlsProps {
	state: SimulatorControlState;
	dispatch: React.Dispatch<SimulatorControlAction>;
	context: {
		route: Route & { circular?: boolean };
		hasCurrentTransfers: boolean;
		transferExpanded: boolean;
		addLine: () => void;
		pickLine: (lineId: LineId) => void;
		setLineField: (field: string, value: string) => void;
		setStationField: (index: number, field: string, value: unknown) => void;
		toggleSide: (index: number) => void;
		toggleXfer: (index: number, lineId: LineId) => void;
		addStation: () => void;
		removeStation: (index: number) => void;
		moveStation: (index: number, direction: number) => void;
		setDest: (field: string, value: string) => void;
		toggleCircular: () => void;
		advance: (direction: number) => void;
		clearAlert: () => void;
	};
}

// The simulator engine owns state; this component owns its complete control surface.
export function SimulatorControls({
	state,
	dispatch,
	context,
}: SimulatorControlsProps) {
	const {
		lineId, showEditor, auto, travelDirection, speedKmh, simulationSpeed,
		langMode, langMs, pageSize, doorNoticeMs, doorNoticeWaitMs, stationStayMs,
		showDistanceIndicator, showSpeedIndicator, showStationStayIndicator,
		showHiragana, showKatakana, followDirectionView, delayNextMarqueeMessage,
		nextMarqueeThreshold, marqueeContent, pauseAtPageBreak, alertActive,
		alertText, alertSecondText, alertScope, alertLeaving,
	} = state;
	const {
		route, hasCurrentTransfers, transferExpanded,
		addLine, pickLine, setLineField, setStationField, toggleSide, toggleXfer,
		addStation, removeStation, moveStation, setDest, toggleCircular, advance,
		clearAlert,
	} = context;
	const set = <K extends keyof SimulatorControlState>(
		field: K,
		value: React.SetStateAction<SimulatorControlState[K]>,
	) => dispatch(setControl(field, value));
	const setShowEditor = (value: React.SetStateAction<boolean>) => set("showEditor", value);
	const setAuto = (value: React.SetStateAction<boolean>) => set("auto", value);
	const setTravelDirection = (value: React.SetStateAction<number>) => set("travelDirection", value);
	const setSpeedKmh = (value: React.SetStateAction<number>) => set("speedKmh", value);
	const setSimulationSpeed = (value: React.SetStateAction<number>) => set("simulationSpeed", value);
	const setLangMode = (value: React.SetStateAction<SimulatorControlState["langMode"]>) => set("langMode", value);
	const setLangMs = (value: React.SetStateAction<number>) => set("langMs", value);
	const setPageSize = (value: React.SetStateAction<number>) => set("pageSize", value);
	const setDoorNoticeMs = (value: React.SetStateAction<number>) => set("doorNoticeMs", value);
	const setDoorNoticeWaitMs = (value: React.SetStateAction<number>) => set("doorNoticeWaitMs", value);
	const setStationStayMs = (value: React.SetStateAction<number>) => set("stationStayMs", value);
	const setTransferDisplayMode = (value: React.SetStateAction<SimulatorControlState["transferDisplayMode"]>) => set("transferDisplayMode", value);
	const setShowDistanceIndicator = (value: React.SetStateAction<boolean>) => set("showDistanceIndicator", value);
	const setShowSpeedIndicator = (value: React.SetStateAction<boolean>) => set("showSpeedIndicator", value);
	const setShowStationStayIndicator = (value: React.SetStateAction<boolean>) => set("showStationStayIndicator", value);
	const setShowHiragana = (value: React.SetStateAction<boolean>) => set("showHiragana", value);
	const setShowKatakana = (value: React.SetStateAction<boolean>) => set("showKatakana", value);
	const setFollowDirectionView = (value: React.SetStateAction<boolean>) => set("followDirectionView", value);
	const setDelayNextMarqueeMessage = (value: React.SetStateAction<boolean>) => set("delayNextMarqueeMessage", value);
	const setNextMarqueeThreshold = (value: React.SetStateAction<number>) => set("nextMarqueeThreshold", value);
	const setPauseAtPageBreak = (value: React.SetStateAction<boolean>) => set("pauseAtPageBreak", value);
	const setAlertText = (value: React.SetStateAction<string>) => set("alertText", value);
	const setAlertSecondText = (value: React.SetStateAction<string>) => set("alertSecondText", value);
	const setAlertScope = (value: React.SetStateAction<SimulatorControlState["alertScope"]>) => set("alertScope", value);

	return (
			<div className="mt-5.5 flex flex-col gap-4 rounded-3xl border-3 border-ink bg-paper p-4.5 shadow-hard-s">
				<LineControls
					lineId={lineId}
					route={route}
					showEditor={showEditor}
					onAddLine={addLine}
					onToggleEditor={() => setShowEditor((value) => !value)}
					onPickLine={pickLine}
					setLineField={setLineField}
					setStationField={setStationField}
					toggleSide={toggleSide}
					toggleXfer={toggleXfer}
					addStation={addStation}
					removeStation={removeStation}
					moveStation={moveStation}
					setDest={setDest}
					toggleCircular={toggleCircular}
				/>
				{/* transport + options */}
				<div className="grid grid-cols-2 items-stretch gap-3">
					<TrainControls
						auto={auto}
						onPrevious={() => {
							setAuto(false);
							setTravelDirection(-1);
							advance(-1);
						}}
						onToggleAuto={() => setAuto((value) => !value)}
						onNext={() => {
							setAuto(false);
							setTravelDirection(1);
							advance(1);
						}}
					/>
					{/* speed */}
					<div
						className="rounded-xl border-3 border-ink bg-blue p-3"
						style={{ boxShadow: "4px 4px 0 var(--ink)" }}
					>
						<div className="mb-2 font-mono text-sm tracking-widest text-muted">
							SPEED
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{Object.entries(SPEED_PRESETS).map(
								([preset, kmh]) => (
									<button
										key={preset}
										className="lc-btn whitespace-nowrap uppercase"
										onClick={() => setSpeedKmh(kmh)}
										style={{
											background:
												speedKmh === kmh
													? "var(--ink)"
													: "var(--paper)",
											color:
												speedKmh === kmh
													? "var(--paper)"
													: "var(--ink)",
											padding: "8px 4px",
											fontSize: 10,
										}}
									>
										{`${kmh} KM/H`}
									</button>
								),
							)}
						</div>
						<div className="mt-2.5 flex items-center gap-2">
							<input
								type="range"
								className="switch-range flex-1 w-full"
								min={10}
								max={140}
								step={5}
								value={speedKmh}
								aria-label="Train speed in kilometres per hour"
								onChange={(ev) =>
									setSpeedKmh(Number(ev.target.value))
								}
								style={
									{
										"--range-fill": `${((speedKmh - 10) / 130) * 100}%`,
									} as React.CSSProperties
								}
							/>
							<output
								className="min-w-13.5 rounded-md border-2 border-ink bg-magenta px-1.75 py-1 text-center font-mono text-sm font-bold text-ink"
								style={{ boxShadow: "2px 2px 0 var(--ink)" }}
							>
								{`${speedKmh} KM/H`}
							</output>
						</div>
						<div className="mt-2.5 flex items-center justify-between border-t-2 border-t-ink pt-2">
							<span className="font-mono text-[10px] font-bold tracking-[.08em]">
								SIMULATION
							</span>
							<output
								className="min-w-13.5 rounded-md border-2 border-ink bg-magenta px-1.75 py-1 text-center font-mono text-sm font-bold text-ink"
								style={{ boxShadow: "2px 2px 0 var(--ink)" }}
							>
								{`${simulationSpeed}X`}
							</output>
						</div>
						<input
							type="range"
							className="switch-range w-full"
							min={1}
							max={100}
							step={1}
							value={simulationSpeed}
							aria-label="Simulation playback speed"
							onChange={(ev) =>
								setSimulationSpeed(Number(ev.target.value))
							}
							style={
								{
									"--range-fill": `${((simulationSpeed - 1) / 99) * 100}%`,
								} as React.CSSProperties
							}
						/>
					</div>
					{/* language */}
					<div
						className="col-span-full rounded-xl border-3 border-ink bg-violet p-3"
						style={{ boxShadow: "4px 4px 0 var(--ink)" }}
					>
						<div className="mb-2 font-mono text-sm tracking-widest text-muted">
							LANGUAGE
						</div>
						<div className="flex gap-2">
							{(
								[
									["auto", "AUTO"],
									["ja", "日本語"],
									["en", "EN"],
								] as const
							).map(([m, lbl]) => (
								<button
									key={m}
									className="lc-btn"
									onClick={() => setLangMode(m)}
									style={{
										background:
											langMode === m
												? "var(--violet)"
												: "var(--paper)",
										color:
											langMode === m
												? "#fff"
												: "var(--ink)",
										fontSize: 12,
									}}
								>
									{lbl}
								</button>
							))}
						</div>
						<div
							className="mt-3 border-t-[3px] border-t-ink pt-2.5"
							style={{
								opacity: langMode === "auto" ? 1 : 0.4,
								pointerEvents:
									langMode === "auto" ? "auto" : "none",
							}}
						>
							<div className="mb-2 flex items-center justify-between gap-3">
								<div className="font-mono text-sm tracking-widest text-paper">
									SWITCH EVERY
								</div>
								<output
									className="min-w-13.5 rounded-md border-2 border-ink bg-magenta px-1.75 py-1 text-center font-mono text-sm font-bold text-ink"
									style={{
										boxShadow: "2px 2px 0 var(--ink)",
									}}
								>
									{`${(langMs / 1000).toFixed(0)}S`}
								</output>
							</div>
							<input
								type="range"
								className="switch-range w-full"
								min={1000}
								max={60000}
								step={1000}
								value={langMs}
								aria-label="Language switch interval"
								onChange={(ev) =>
									setLangMs(Number(ev.target.value))
								}
								style={
									{
										"--range-fill": `${(langMs - 1000) / 590}%`,
									} as React.CSSProperties
								}
							/>
							<div className="mt-1 flex w-full justify-between font-mono text-[10px] tracking-[.08em] text-paper">
								<span>1S</span>
								<span>60S</span>
							</div>
						</div>
					</div>
					{/* display settings */}
					<section
						className="col-span-full rounded-xl border-3 border-ink bg-paper-2 p-3"
						style={{ boxShadow: "4px 4px 0 var(--blue)" }}
					>
						<div className="mb-2.5 font-display text-[28px] leading-[0.85] text-ink">
							DISPLAY SETTINGS
						</div>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<div className="mb-1.75 flex justify-between gap-2 font-mono text-[11px] font-bold tracking-widest">
									<span>STATIONS PER PAGE</span>
									<output
										className="min-w-13.5 rounded-md border-2 border-ink bg-magenta px-1.75 py-1 text-center font-mono text-sm font-bold text-ink"
										style={{
											boxShadow: "2px 2px 0 var(--ink)",
										}}
									>
										{pageSize}
									</output>
								</div>
								<input
									type="range"
									className="switch-range"
									min={4}
									max={12}
									step={1}
									value={pageSize}
									aria-label="Maximum stations per page"
									onChange={(ev) =>
										setPageSize(Number(ev.target.value))
									}
									style={
										{
											"--range-fill": `${((pageSize - 4) / 8) * 100}%`,
										} as React.CSSProperties
									}
								/>
								<div className="mt-1 flex w-55 justify-between font-mono text-[10px] tracking-[.08em] text-muted">
									<span>4</span>
									<span>12</span>
								</div>
							</div>
							<div className="flex flex-col gap-3">
								<div>
									<div className="mb-1.75 flex justify-between gap-2 font-mono text-[11px] font-bold tracking-widest">
										<span>DOOR POP-UP TIME</span>
										<output
											className="min-w-13.5 rounded-md border-2 border-ink bg-magenta px-1.75 py-1 text-center font-mono text-sm font-bold text-ink"
											style={{
												boxShadow:
													"2px 2px 0 var(--ink)",
											}}
										>
											{`${(doorNoticeMs / 1000).toFixed(0)}S`}
										</output>
									</div>
									<input
										type="range"
										className="switch-range"
										min={1000}
										max={60000}
										step={1000}
										value={doorNoticeMs}
										aria-label="Door pop-up visible duration"
										onChange={(ev) =>
											setDoorNoticeMs(
												Number(ev.target.value),
											)
										}
										style={
											{
												"--range-fill": `${(doorNoticeMs - 1000) / 590}%`,
											} as React.CSSProperties
										}
									/>
									<div className="mt-1 flex w-55 justify-between font-mono text-[10px] tracking-[.08em] text-muted">
										<span>1S</span>
										<span>60S</span>
									</div>
								</div>
								<div className="border-t-2 border-t-ink pt-2.5">
									<div className="mb-1.75 flex justify-between gap-2 font-mono text-[11px] font-bold tracking-widest">
										<span>WAIT BEFORE POP-UP</span>
										<output
											className="rounded-md border-2 border-ink bg-blue px-1.75 py-1 text-center font-mono text-sm font-bold text-paper"
											style={{
												boxShadow:
													"2px 2px 0 var(--ink)",
												minWidth: 54,
											}}
										>
											{`${(doorNoticeWaitMs / 1000).toFixed(0)}S`}
										</output>
									</div>
									<input
										type="range"
										className="switch-range"
										min={1000}
										max={60000}
										step={1000}
										value={doorNoticeWaitMs}
										aria-label="Seconds to wait before the door pop-up returns"
										onChange={(ev) =>
											setDoorNoticeWaitMs(
												Number(ev.target.value),
											)
										}
										style={
											{
												"--range-fill": `${(doorNoticeWaitMs - 1000) / 590}%`,
											} as React.CSSProperties
										}
									/>
									<div className="mt-1 flex w-55 justify-between font-mono text-[10px] tracking-[.08em] text-muted">
										<span>1S</span>
										<span>60S</span>
									</div>
								</div>
							</div>
							<div>
								<div className="mb-1.75 flex justify-between gap-2 font-mono text-[11px] font-bold tracking-widest">
									<span>STAY AT STATION</span>
									<output
										className="min-w-13.5 rounded-md border-2 border-ink bg-magenta px-1.75 py-1 text-center font-mono text-sm font-bold text-ink"
										style={{
											boxShadow: "2px 2px 0 var(--ink)",
										}}
									>
										{`${(stationStayMs / 1000).toFixed(0)}S`}
									</output>
								</div>
								<input
									type="range"
									className="switch-range"
									min={5000}
									max={600000}
									step={5000}
									value={stationStayMs}
									aria-label="Stay time at station"
									onChange={(ev) =>
										setStationStayMs(
											Number(ev.target.value),
										)
									}
									style={
										{
											"--range-fill": `${(stationStayMs - 5000) / 5950}%`,
										} as React.CSSProperties
									}
								/>
								<div className="mt-1 flex w-55 justify-between font-mono text-[10px] tracking-[.08em] text-muted">
									<span>5S</span>
									<span>600S</span>
								</div>
							</div>
						</div>
						<div className="mt-3.5 flex flex-wrap gap-3.5 border-t-[3px] border-t-ink pt-2.5">
							{hasCurrentTransfers ? (
								<button
									onClick={() =>
										setTransferDisplayMode(
											transferExpanded ? "split" : "full",
										)
									}
									className="lc-btn"
									aria-pressed={transferExpanded}
									style={{
										background: transferExpanded
											? "var(--ink)"
											: "var(--acid)",
										color: transferExpanded
											? "var(--paper)"
											: "var(--ink)",
									}}
								>
									{transferExpanded ? "SPLIT TRANSFER" : "FULL TRANSFER"}
								</button>
							) : null}
							<Switch
								checked={showDistanceIndicator}
								onChange={setShowDistanceIndicator}
								label="KM TO NEXT"
							/>
							<Switch
								checked={showSpeedIndicator}
								onChange={setShowSpeedIndicator}
								label="SPEED"
							/>
							<Switch
								checked={showStationStayIndicator}
								onChange={setShowStationStayIndicator}
								label="REMAINING STAY TIME"
							/>
							<Switch
								checked={showHiragana}
								onChange={setShowHiragana}
								label="INCLUDE HIRAGANA IN AUTO LOOP"
							/>
							<Switch
								checked={showKatakana}
								onChange={setShowKatakana}
								label="SHOW KATAKANA WITH KANJI"
							/>
							<Switch
								checked={followDirectionView}
								onChange={setFollowDirectionView}
								label="FOLLOW DIRECTION VIEW"
							/>
						</div>
					</section>
					{/* lower marquee programming */}
					<section
						className="col-span-full rounded-xl border-3 border-ink bg-blue p-3.5 text-ink"
						style={{
							boxShadow: "6px 6px 0 var(--ink)",
							backgroundImage:
								"radial-gradient(rgba(14,14,18,.3) 1px, transparent 1.3px)",
							backgroundSize: "9px 9px",
						}}
					>
						<div className="mb-3 inline-block rounded-none border-2 border-ink bg-acid px-2.5 py-1.5 font-display text-[28px] leading-[0.85] text-ink shadow-[3px_3px_0_var(--ink)]">
							LOWER MARQUEE
						</div>
						<div
							className="grid items-start gap-4"
							style={{
								gridTemplateColumns:
									"minmax(230px, 1fr) minmax(260px, 2fr)",
							}}
						>
							<div
								className="flex flex-col gap-2.5 rounded-lg border-3 border-ink bg-paper p-3 text-ink"
								style={{ boxShadow: "4px 4px 0 var(--ink)" }}
							>
								<Switch
									checked={delayNextMarqueeMessage}
									onChange={setDelayNextMarqueeMessage}
									label="DELAY NEXT-STATION MESSAGE"
								/>
								<div
									style={{
										opacity: delayNextMarqueeMessage
											? 1
											: 0.45,
										pointerEvents: delayNextMarqueeMessage
											? "auto"
											: "none",
									}}
								>
									<div className="mb-1.75 flex justify-between gap-2 font-mono text-[11px] font-bold tracking-[.08em]">
										<span>SHOW NEXT AFTER</span>
										<output
											className="rounded-sm border-2 border-ink bg-acid px-1.5 py-0.75 font-mono font-bold text-ink"
											style={{
												boxShadow:
													"2px 2px 0 var(--ink)",
											}}
										>
											{`${nextMarqueeThreshold}% OF LEG`}
										</output>
									</div>
									<input
										type="range"
										className="switch-range w-full"
										min={0}
										max={100}
										step={5}
										value={nextMarqueeThreshold}
										aria-label="Next station marquee threshold"
										onChange={(ev) =>
											setNextMarqueeThreshold(
												Number(ev.target.value),
											)
										}
										style={
											{
												"--range-fill": `${nextMarqueeThreshold}%`,
											} as React.CSSProperties
										}
									/>
									<p className="mt-1.75 font-body text-sm leading-[1.3] text-muted">
										Ads and Metro notices hold the ticker
										until this share of the current leg is
										complete.
									</p>
								</div>
							</div>
							<div
								className="min-w-0 rounded-lg border-3 border-ink bg-orange p-3 text-ink"
								style={{ boxShadow: "4px 4px 0 var(--ink)" }}
							>
								<div className="mb-1.75 flex items-center justify-between gap-2.5">
									<span className="font-mono text-[11px] font-bold tracking-widest text-ink">
										CONTENT PLAYLIST · ENGLISH + OPTIONAL
										JAPANESE
									</span>
									<button
										className="lc-btn"
									onClick={() => dispatch({ type: "addMarqueeItem" })}
										style={{
											padding: "5px 9px",
											background: "var(--acid)",
											color: "var(--ink)",
											fontSize: 11,
										}}
									>
										+ ADD ITEM
									</button>
								</div>
								<div className="flex max-h-65 flex-col gap-1.5 overflow-y-auto pr-0.75">
									{marqueeContent.map((item, index) => (
										<div
											key={index}
											className="grid items-center gap-1.5 rounded-[7px] border-2 border-ink bg-paper-2 p-1.5 text-ink"
											style={{
												gridTemplateColumns:
													"auto 70px minmax(170px, 1fr) minmax(170px, 1fr) auto",
												boxShadow:
													"2px 2px 0 var(--ink)",
											}}
										>
											<Switch
												checked={item.enabled}
												onChange={(enabled: boolean) =>
													dispatch({ type: "updateMarqueeItem", index, field: "enabled", value: enabled })
												}
												label=""
											/>
											<select
												value={item.type}
												aria-label="Marquee content type"
												onChange={(ev) =>
													dispatch({ type: "updateMarqueeItem", index, field: "type", value: ev.target.value as MarqueeContentItem["type"] })
												}
												className="w-full rounded-[5px] border-2 border-ink bg-paper p-1.5 font-mono text-[10px] font-bold text-ink"
											>
												<option value="ad">AD</option>
												<option value="notice">
													NOTICE
												</option>
											</select>
											<input
												value={item.en}
												placeholder="English message"
												aria-label={`English marquee item ${index + 1}`}
												onChange={(ev) =>
													dispatch({ type: "updateMarqueeItem", index, field: "en", value: ev.target.value })
												}
												className="w-full min-w-0 rounded-[5px] border-2 border-ink bg-paper px-2 py-1.5 font-body font-semibold text-ink"
											/>
											<input
												value={item.ja}
												placeholder="日本語（任意）"
												aria-label={`Japanese marquee item ${index + 1}`}
												onChange={(ev) =>
													dispatch({ type: "updateMarqueeItem", index, field: "ja", value: ev.target.value })
												}
												className="w-full min-w-0 rounded-[5px] border-2 border-ink bg-paper px-2 py-1.5 font-body font-semibold text-ink"
											/>
											<button
												className="lc-btn"
											onClick={() => dispatch({ type: "removeMarqueeItem", index })}
												title="Remove playlist item"
												aria-label={`Remove marquee item ${index + 1}`}
												style={{
													padding: "4px 9px",
													background: "var(--paper)",
													color: "var(--ink)",
													fontSize: 13,
												}}
											>
												✕
											</button>
										</div>
									))}
								</div>
							</div>
						</div>
					</section>
					{/* running controls */}
					<section
						className="col-span-full rounded-xl border-3 border-ink bg-acid p-3"
						style={{ boxShadow: "4px 4px 0 var(--ink)" }}
					>
						<div className="mb-2.5 font-display text-[28px] leading-[0.85]">
							RUNNING CONTROLS
						</div>
						<div
							className="grid items-center gap-3"
							style={{
								gridTemplateColumns:
									"minmax(240px, 1fr) repeat(3, auto)",
							}}
						>
							<div className="flex items-center justify-between gap-2 rounded-md border-2 border-ink bg-paper p-2">
								<span className="font-mono text-[10px] font-bold tracking-widest">
									RUN DIRECTION
								</span>
								<div className="flex gap-1.25">
									<button
										onClick={() => setTravelDirection(1)}
										className="cursor-pointer rounded-[5px] border-2 border-ink px-1.75 py-1.25 font-mono text-[10px] font-bold"
										style={{
											background:
												travelDirection > 0
													? "var(--blue)"
													: "var(--paper)",
											color:
												travelDirection > 0
													? "#fff"
													: "var(--ink)",
										}}
									>
										FORWARD ››
									</button>
									<button
										onClick={() => setTravelDirection(-1)}
										className="cursor-pointer rounded-[5px] border-2 border-ink px-1.75 py-1.25 font-mono text-[10px] font-bold"
										style={{
											background:
												travelDirection < 0
													? "var(--violet)"
													: "var(--paper)",
											color:
												travelDirection < 0
													? "#fff"
													: "var(--ink)",
										}}
									>
										‹‹ REVERSE
									</button>
								</div>
							</div>
							<Switch
								checked={pauseAtPageBreak}
								onChange={setPauseAtPageBreak}
								label="PAUSE AT PAGE BREAK"
							/>
						</div>
					</section>
					{/* alert system — a high-contrast broadcast console */}
					<section
						className="col-span-full overflow-hidden rounded-xl border-3 border-ink bg-paper"
						style={{
							boxShadow: "6px 6px 0 var(--ink)",
							minWidth: 310,
						}}
					>
						<div
							className="relative border-b-[3px] border-b-ink bg-magenta p-[12px_14px] text-ink"
							style={{
								backgroundImage:
									"radial-gradient(rgba(14,14,18,.2) 1px, transparent 1.3px)",
								backgroundSize: "9px 9px",
							}}
						>
							<div className="relative flex items-start justify-between gap-3">
								<div>
									<div className="font-mono text-[10px] font-bold tracking-[.16em]">
										ONBOARD CONTROL
									</div>
									<div className="font-display text-[32px] leading-[0.85] tracking-[.02em]">
										BROADCAST
									</div>
								</div>
								<span
									className="border-2 border-ink px-1.75 py-1 font-mono text-[10px] font-bold tracking-[.08em]"
									style={{
										background: alertActive
											? "var(--acid)"
											: "var(--paper)",
									}}
								>
									{alertActive ? "LIVE" : "STANDBY"}
								</span>
							</div>
						</div>
						<div className="flex flex-col gap-2.5 p-3">
							<label className="flex flex-col gap-1.25 font-mono text-[10px] font-bold tracking-[.12em] text-muted">
								PRIMARY MESSAGE
								<input
									value={alertText}
									onChange={(ev) =>
										setAlertText(ev.target.value)
									}
									placeholder="ALERT MESSAGE"
									aria-label="Primary alert message"
									className="w-full rounded-md border-3 border-ink bg-paper-2 px-2.5 py-2.25 font-body font-bold text-ink"
								/>
							</label>
							<label className="flex flex-col gap-1.25 font-mono text-[10px] font-bold tracking-[.12em] text-muted">
								SECOND LANGUAGE · OPTIONAL
								<input
									value={alertSecondText}
									onChange={(ev) =>
										setAlertSecondText(ev.target.value)
									}
									placeholder="SECOND LANGUAGE MESSAGE"
									aria-label="Second language alert message"
									className="w-full rounded-md border-3 border-ink bg-paper-2 px-2.5 py-2.25 font-body font-bold text-ink"
								/>
							</label>
							<div className="font-mono text-[10px] font-bold tracking-[.12em] text-muted">
								DISPLAY TARGET
							</div>
							<div className="grid grid-cols-3 gap-1.5">
								{(
									[
										["marquee", "TEXT"],
										["lower", "LOWER"],
										["monitor", "SCREEN"],
									] as const
								).map(([scope, label]) => (
									<button
										key={scope}
										onClick={() => setAlertScope(scope)}
										className="cursor-pointer rounded-md border-3 border-ink p-1.5 font-mono text-[10px] font-bold tracking-[.08em]"
										style={{
											minHeight: 46,
											background:
												alertScope === scope
													? "var(--violet)"
													: "var(--paper-2)",
											color:
												alertScope === scope
													? "#fff"
													: "var(--ink)",
											boxShadow:
												alertScope === scope
													? "3px 3px 0 var(--ink)"
													: "none",
											transition:
												"transform var(--dur-fast) var(--ease-pop)",
										}}
									>
										{label}
									</button>
								))}
							</div>
							<div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t-[3px] border-t-ink pt-2.5">
								<button
									className="lc-btn justify-center"
									onClick={() => {
										dispatch(setControl("alertLeaving", false));
										dispatch(setControl("alertActive", true));
									}}
									disabled={!alertText.trim()}
									style={{
										background: "var(--acid)",
										color: "var(--ink)",
										fontSize: 12,
									}}
								>
									{alertActive
										? "UPDATE ALERT"
										: "SEND ALERT"}
								</button>
								<button
									className="lc-btn"
									onClick={clearAlert}
									disabled={!alertActive || alertLeaving}
									style={{
										padding: "9px 12px",
										background: "var(--ink)",
										color: "var(--paper)",
										fontSize: 11,
									}}
								>
									CLEAR
								</button>
							</div>
						</div>
					</section>
				</div>
			</div>
	);
}
