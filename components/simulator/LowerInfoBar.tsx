"use client";

import { TransferStrip } from "@/components/display/TransferStrip";
import { Ticker } from "@/components/simulator/Ticker";
import type { Lang, Route } from "@/types/metro";

interface LowerInfoBarProps {
	route: Route;
	pos: number;
	lang: Lang;
	hasTransfers: boolean;
	transferExpanded: boolean;
	tickerItems: string[];
	tickerColor: string;
	alertMessages?: string[];
	alertLeaving: boolean;
	lowerAlertMessages?: string[];
}

export function LowerInfoBar({
	route,
	pos,
	lang,
	hasTransfers,
	transferExpanded,
	tickerItems,
	tickerColor,
	alertMessages,
	alertLeaving,
	lowerAlertMessages,
}: LowerInfoBarProps) {
	const transferWidth = transferExpanded
		? "100%"
		: hasTransfers
			? "20%"
			: "15%";

	return (
		<div className="relative flex h-19 items-stretch gap-0 overflow-hidden border-t-3 border-t-ink">
			<div
				data-transfer-expanded={transferExpanded}
				data-has-transfers={hasTransfers}
				className={`relative flex ${hasTransfers ? "min-w-0" : "min-w-min"} flex-none items-center overflow-hidden bg-paper-2 px-4.5 py-2`}
				style={{
					width: transferWidth,
					borderRight: transferExpanded
						? "0 solid var(--ink)"
						: "3px solid var(--ink)",
					transition:
						"width 650ms var(--ease-pop), border-width 650ms var(--ease-pop)",
				}}
			>
				{hasTransfers ? (
					<div
						key={`transfers-${pos}-${lang}`}
						className="min-w-0 flex-1"
						style={{
							animation: "swipeIn .4s var(--ease-out) both",
						}}
					>
						<TransferStrip
							route={route}
							pos={pos}
							lang={lang}
							expanded={transferExpanded}
						/>
					</div>
				) : (
					<span
						key={`no-transfer-${pos}-${lang}`}
						className="font-mono text-sm tracking-widest text-muted whitespace-nowrap"
						style={{
							animation: "swipeIn .35s var(--ease-out) both",
						}}
					>
						{lang === "ja" ? "乗換なし" : "NO TRANSFER"}
					</span>
				)}
			</div>
			<Ticker
				items={tickerItems}
				color={tickerColor}
				alertMessages={alertMessages}
				alertLeaving={alertLeaving}
			/>
			{lowerAlertMessages ? (
				<div className="absolute inset-0 z-20 flex">
					<Ticker
						items={[]}
						color="var(--ink)"
						background="var(--magenta)"
						borderTop="none"
						separateAlertLanguages={true}
						lang={lang}
						alertMessages={lowerAlertMessages}
						alertLeaving={alertLeaving}
					/>
				</div>
			) : null}
		</div>
	);
}
