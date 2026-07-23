"use client";
/* Status strip for the split-mode pages: the room code plus the live transport
 * state (waiting / connected, and whether data rides a direct peer connection
 * or the relay). Styled to the Vivid system — thick ink border, hard offset
 * shadow, flat colour-block status pill, mono tracked labels. */
import React from "react";
import type { TransportSnapshot } from "@/lib/rtc/roomTransport";

interface ConnectionBannerProps {
	role: "display" | "control";
	room: string | null;
	conn: TransportSnapshot;
}

// Each state is a flat colour block (border always solid ink), per the brand's
// "colour as full-bleed block" rule.
function statusPill(conn: TransportSnapshot): { text: string; block: string } {
	if (conn.status === "connected")
		return conn.mode === "p2p"
			? { text: "LINKED · DIRECT", block: "bg-acid text-ink" }
			: { text: "LINKED · RELAY", block: "bg-blue text-paper" };
	if (conn.status === "waiting")
		return { text: "WAITING FOR PEER", block: "bg-orange text-ink" };
	if (conn.status === "connecting")
		return { text: "CONNECTING…", block: "bg-paper-2 text-ink" };
	return { text: "CLOSED", block: "bg-magenta text-paper" };
}

export function ConnectionBanner({ role, room, conn }: ConnectionBannerProps) {
	const { text, block } = statusPill(conn);
	return (
		<div className="mb-4.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-3 border-ink bg-paper px-4 py-2.5 shadow-hard-s">
			<div className="flex items-center gap-3 font-mono">
				<span className="rounded-md border-2 border-ink bg-ink px-2.5 py-1 text-label font-bold tracking-widest text-paper">
					{role === "display" ? "DISPLAY" : "CONTROL"}
				</span>
				<span className="flex items-baseline gap-2">
					<span className="text-label tracking-widest text-muted">
						ROOM
					</span>
					<b className="text-body font-bold tracking-[.3em] text-ink">
						{room ?? "—"}
					</b>
				</span>
			</div>
			<span
				className={`rounded-md border-2 border-ink px-2.5 py-1 font-mono text-label font-bold tracking-widest ${block}`}
			>
				{text}
			</span>
		</div>
	);
}
