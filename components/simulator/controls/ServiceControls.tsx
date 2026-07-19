"use client";

import React from "react";
import { LINES, num } from "@/lib/metro-data";
import type { Route, ServiceVariant } from "@/types/metro";

interface ServiceControlsProps {
	route: Route & { circular?: boolean };
	serviceId: string;
	onPickService: (id: string) => void;
	onAddService: () => void;
	onRemoveService: (id: string) => void;
	setServiceField: (id: string, field: "ja" | "en", value: string) => void;
	toggleServiceStop: (index: number) => void;
}

// Express service designer: users define any number of stopping patterns per
// line (semi-express, super-express, …), name them freely, and toggle which
// stations each one skips. "Local" always stops everywhere.
export function ServiceControls({
	route,
	serviceId,
	onPickService,
	onAddService,
	onRemoveService,
	setServiceField,
	toggleServiceStop,
}: ServiceControlsProps) {
	const services: ServiceVariant[] = route.services || [];
	const active = services.find((sv) => sv.id === serviceId);
	const lineColor = LINES[route.line].color;
	const lastIndex = route.stations.length - 1;

	return (
		<section
			className="rounded-xl border-3 border-ink bg-paper-2 p-3"
			style={{ boxShadow: "4px 4px 0 var(--magenta)" }}
		>
			<div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
				<div className="font-mono text-sm tracking-widest text-muted">
					SERVICE TYPE · 種別
				</div>
				<button
					className="lc-btn"
					onClick={onAddService}
					style={{
						background: "var(--acid)",
						color: "var(--ink)",
						fontSize: 12,
					}}
				>
					+ ADD TYPE
				</button>
			</div>
			{/* pattern picker */}
			<div className="flex flex-wrap gap-2">
				<button
					className="lc-btn"
					onClick={() => onPickService("local")}
					aria-pressed={serviceId === "local"}
					style={{
						background:
							serviceId === "local" ? lineColor : "var(--paper)",
						color:
							serviceId === "local"
								? LINES[route.line].textOnColor
								: "var(--ink)",
						fontSize: 12,
					}}
				>
					各駅停車 · LOCAL
				</button>
				{services.map((sv) => (
					<button
						key={sv.id}
						className="lc-btn"
						onClick={() => onPickService(sv.id)}
						aria-pressed={serviceId === sv.id}
						style={{
							background:
								serviceId === sv.id
									? "var(--ink)"
									: "var(--paper)",
							color:
								serviceId === sv.id
									? "var(--acid)"
									: "var(--ink)",
							fontSize: 12,
						}}
					>
						{`${sv.ja} · ${sv.en.toUpperCase()}`}
					</button>
				))}
			</div>
			{/* variant editor */}
			{active ? (
				<div className="mt-3 flex flex-col gap-2.5 border-t-[3px] border-t-ink pt-2.5">
					<div className="flex flex-wrap items-end gap-2.5">
						<label className="flex flex-col gap-1 font-mono text-[10px] font-bold tracking-[.12em] text-muted">
							NAME · 日本語
							<input
								value={active.ja}
								aria-label="Service name in Japanese"
								onChange={(ev) =>
									setServiceField(
										active.id,
										"ja",
										ev.target.value,
									)
								}
								className="w-40 rounded-[5px] border-2 border-ink bg-paper px-2 py-1.5 font-body font-semibold text-ink"
							/>
						</label>
						<label className="flex flex-col gap-1 font-mono text-[10px] font-bold tracking-[.12em] text-muted">
							NAME · ENGLISH
							<input
								value={active.en}
								aria-label="Service name in English"
								onChange={(ev) =>
									setServiceField(
										active.id,
										"en",
										ev.target.value,
									)
								}
								className="w-40 rounded-[5px] border-2 border-ink bg-paper px-2 py-1.5 font-body font-semibold text-ink"
							/>
						</label>
						<button
							className="lc-btn"
							onClick={() => onRemoveService(active.id)}
							style={{
								padding: "8px 12px",
								background: "var(--paper)",
								color: "var(--ink)",
								fontSize: 11,
							}}
						>
							✕ REMOVE TYPE
						</button>
					</div>
					<div className="font-mono text-[10px] font-bold tracking-[.12em] text-muted">
						TAP A STATION TO TOGGLE STOP / PASS · TERMINALS ALWAYS
						STOP
					</div>
					<div className="flex flex-wrap gap-1.5">
						{route.stations.map((station, index) => {
							const terminal =
								index === 0 || index === lastIndex;
							const stops =
								terminal ||
								!station.skip?.includes(active.id);
							return (
								<button
									key={`${index}-${station.ja}`}
									className="lc-btn"
									disabled={terminal}
									onClick={() => toggleServiceStop(index)}
									aria-pressed={!stops}
									title={
										terminal
											? "Terminals always stop"
											: stops
												? "Stops — tap to pass"
												: "Passes — tap to stop"
									}
									style={{
										padding: "5px 8px",
										fontSize: 11,
										background: stops
											? lineColor
											: "var(--paper)",
										color: stops
											? LINES[route.line].textOnColor
											: "#8b897e",
										opacity: terminal ? 0.75 : 1,
										textDecoration: stops
											? "none"
											: "line-through",
									}}
								>
									{`${num(route.line, index)} ${station.ja}`}
								</button>
							);
						})}
					</div>
				</div>
			) : null}
		</section>
	);
}
