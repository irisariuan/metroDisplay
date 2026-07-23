"use client";
/* Shown on the display device until a control device links: the room code set
 * big (Anton, per the brand's "type as a graphic element" rule) plus a
 * ready-to-open control URL on the same host, so a phone on the LAN can pair by
 * typing the code or opening the link.
 *
 * window.location.origin is external-to-React state; it's read through
 * useSyncExternalStore so it derives during render (empty on the server, so no
 * hydration mismatch) rather than via a setState-in-effect. The origin is fixed
 * for the page's lifetime, so subscribe never fires. */
import React from "react";
import { Button } from "@/components/ds";

interface PairHintProps {
	room: string;
}

const noopSubscribe = () => () => {};
function getOrigin(): string {
	return window.location.origin;
}
function getServerOrigin(): string {
	return "";
}

export function PairHint({ room }: PairHintProps) {
	const [copied, setCopied] = React.useState(false);
	const origin = React.useSyncExternalStore(
		noopSubscribe,
		getOrigin,
		getServerOrigin,
	);
	const controlUrl = origin
		? `${origin}/control?room=${encodeURIComponent(room)}`
		: "";

	const copy = () => {
		if (!controlUrl) return;
		navigator.clipboard.writeText(controlUrl).then(
			() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1500);
			},
			() => {
				/* clipboard blocked; the URL is still visible to type */
			},
		);
	};

	return (
		<div className="mb-4.5 rounded-3xl border-3 border-ink bg-acid p-5 shadow-hard">
			<div className="font-mono text-label font-bold tracking-widest text-ink/70">
				PAIR A CONTROL DEVICE
			</div>

			<div className="mt-2 grid gap-x-2 gap-y-4 items-center" style={{
				gridTemplateColumns: 'auto 1fr'
			}}>
				<span className="font-mono text-label tracking-widest text-ink/70 select-none">
					ROOM CODE
				</span>
				<span className="font-display text-display-m leading-[0.85] tracking-[.06em] text-ink selection:bg-black selection:text-acid">
					{room}
				</span>
				<span className="font-mono text-label tracking-widest text-ink/70 select-none">
					OR OPEN
				</span>
				<div>
					<code className="min-w-0 flex-1 break-all rounded-md border-2 border-ink bg-paper px-3 py-2 font-mono text-body-s text-ink mr-2 selection:bg-none selection:text-primary">
						{controlUrl || "…"}
					</code>
					<Button variant="dark" size="s" onClick={copy}>
						{copied ? "COPIED" : "COPY LINK"}
					</Button>
				</div>
			</div>
		</div>
	);
}
