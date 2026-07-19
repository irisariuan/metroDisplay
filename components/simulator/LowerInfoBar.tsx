"use client";

import { TransferStrip } from "@/components/display/TransferStrip";
import { Ticker } from "@/components/simulator/Ticker";
import type { Lang } from "@/types/metro";

interface LowerInfoBarProps {
	route: any;
	pos: number;
	lang: Lang;
	hasTransfers: boolean;
	transferExpanded: boolean;
	onToggleTransferExpanded: () => void;
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
	onToggleTransferExpanded,
	tickerItems,
	tickerColor,
	alertMessages,
	alertLeaving,
	lowerAlertMessages,
}: LowerInfoBarProps) {
	return (
		<div className="relative flex h-19 items-stretch gap-0 overflow-hidden border-t-3 border-t-ink">
			<div
				data-transfer-expanded={transferExpanded}
				className="relative flex min-w-0 flex-none items-center overflow-hidden bg-paper-2 px-4.5 py-2"
				style={{
					width: transferExpanded ? "100%" : hasTransfers ? 280 : "auto",
					borderRight: transferExpanded
						? "0 solid var(--ink)"
						: "3px solid var(--ink)",
					transition:
						"width 650ms var(--ease-pop), border-width 650ms var(--ease-pop)",
				}}
			>
				{hasTransfers ? (
					<>
						<div className="min-w-0 flex-1 pr-12">
							<TransferStrip
								route={route}
								pos={pos}
								lang={lang}
								expanded={transferExpanded}
							/>
						</div>
						<button
							onClick={onToggleTransferExpanded}
							className="lc-btn absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px]"
							style={{
								background: transferExpanded
									? "var(--ink)"
									: "var(--acid)",
								color: transferExpanded
									? "var(--paper)"
									: "var(--ink)",
							}}
						>
							{transferExpanded ? "SPLIT" : "FULL"}
						</button>
					</>
				) : (
					<span
						key={`no-transfer-${pos}-${lang}`}
						className="font-mono text-sm tracking-widest text-muted"
						style={{ animation: "swipeIn .35s var(--ease-out) both" }}
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
