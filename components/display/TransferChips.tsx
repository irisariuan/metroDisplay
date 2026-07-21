"use client";
import React from "react";
import type { LineId } from "@/types/metro";
import { LineChip } from "./LineChip";

const SMALL_SIZE = 10;
const NORMAL_SIZE = 18;
const MIN_SIZE = 6;
const COLUMN_GAP = 3;
const ROW_GAP = 2;
const CYCLE_MS = 2600;
const MOVE_MS = 400;
// Reserve the tallest possible state — two rows led by a full-size chip — so the
// strip keeps a constant height whatever a station shows. Growing, shrinking and
// the row cycle all happen inside this fixed box, so nothing around it shifts.
const RESERVED_HEIGHT = NORMAL_SIZE + ROW_GAP + SMALL_SIZE;

interface TransferChipsProps {
	lineIds: readonly LineId[];
	expanded: boolean;
}

// Largest chip edge that lets `count` chips (plus gaps) fit `width`, capped at
// `cap`. Sizing rows to fit means a row is never wider than its cell — nothing is
// cropped, at rest or while the cycle grows a row.
function fitSize(count: number, width: number, cap: number): number {
	if (count <= 0 || width <= 0) return cap;
	const per = (width - (count - 1) * COLUMN_GAP) / count;
	return Math.max(MIN_SIZE, Math.min(cap, Math.floor(per)));
}

// How many chips of edge `cap` fit one row of `width`.
function chipsPerRow(width: number, cap: number): number {
	if (width <= 0) return 1;
	return Math.max(1, Math.floor((width + COLUMN_GAP) / (cap + COLUMN_GAP)));
}

// Bounce an ever-increasing step within [0, max] (0, 1, … max, … 1, 0, 1 …) so a
// window can scroll through groups in order and reverse at the ends — never
// wrapping the last group back around to the first.
function pingPong(step: number, max: number): number {
	if (max <= 0) return 0;
	const period = max * 2;
	const t = ((step % period) + period) % period;
	return t <= max ? t : period - t;
}

// Transfer lines under a station, sized (full at the current station, mini
// elsewhere) and split across as many rows as it takes to fit. Up to two rows sit
// still — they fit the reserved height together. Beyond that the mini rows scroll
// through the extra rows in order; the arrived, full-size row instead cycles its
// groups so every line leads in turn. The motion is React state + CSS transitions
// (not a marquee), so each move eases smoothly.
export function TransferChips({ lineIds, expanded }: TransferChipsProps) {
	const viewportRef = React.useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = React.useState(0);
	const [step, setStep] = React.useState(0);

	React.useLayoutEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return undefined;
		const updateWidth = (next: number) =>
			setContainerWidth((width) => {
				return Math.abs(width - next) < 0.5 ? width : next;
			});
		if (typeof ResizeObserver === "undefined") {
			const measure = () => updateWidth(viewport.clientWidth);
			const frame = requestAnimationFrame(measure);
			window.addEventListener("resize", measure);
			return () => {
				cancelAnimationFrame(frame);
				window.removeEventListener("resize", measure);
			};
		}
		const observer = new ResizeObserver(([entry]) => {
			updateWidth(entry.contentRect.width);
		});
		observer.observe(viewport);
		return () => observer.disconnect();
	}, []);

	const count = lineIds.length;
	// Group by the size the chips are actually shown at, so a station only splits
	// when its own chips overflow one row.
	const perRow = chipsPerRow(
		containerWidth,
		expanded ? NORMAL_SIZE : SMALL_SIZE,
	);
	const groupCount =
		containerWidth > 0 ? Math.max(1, Math.ceil(count / perRow)) : 1;
	const key = lineIds.join(",");
	const groups = React.useMemo(() => {
		if (groupCount <= 1) return [lineIds.slice()];
		const per = Math.ceil(count / groupCount);
		const out: LineId[][] = [];
		for (let i = 0; i < count; i += per)
			out.push(lineIds.slice(i, i + per));
		return out;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, groupCount]);
	const total = groups.length;
	const multiRow = total >= 2;
	// Two rows fit the reserved height side by side, so they simply sit still. The
	// mini display only starts swapping once there are more rows than fit at once —
	// over two. (The arrived, full-size row still cycles its two groups so each line
	// leads in turn, which is a rotation of prominence rather than an overflow.)
	const swapping = expanded ? multiRow : total > 2;

	React.useEffect(() => {
		if (!swapping) return undefined;
		const id = setInterval(
			() => setStep((current) => current + 1),
			CYCLE_MS,
		);
		return () => clearInterval(id);
	}, [swapping]);
	const activeStep = swapping ? step : 0;

	const leadHeight = expanded ? NORMAL_SIZE : SMALL_SIZE;
	const contentHeight = leadHeight + ROW_GAP + SMALL_SIZE;
	const verticalOffset = Math.max(0, (RESERVED_HEIGHT - contentHeight) / 2);
	const leadY = verticalOffset;
	const trailY = verticalOffset + leadHeight + ROW_GAP;

	// The full-size (arrived) row rotates through every group so each line takes a
	// turn up front, wrapping past the end. The mini rows instead scroll through the
	// groups in order and bounce at the ends, so the last row never wraps round to
	// sit beside the first (no "A follows K").
	const leadingIndex = expanded
		? ((activeStep % total) + total) % total
		: pingPong(activeStep, Math.max(0, total - 2));
	const trailingIndex = expanded
		? (leadingIndex + 1) % total
		: Math.min(leadingIndex + 1, total - 1);

	const rowChips = (group: LineId[], full: boolean) =>
		group.map((lid) => (
			<LineChip
				key={lid}
				lineId={lid}
				size={fitSize(group.length, containerWidth, NORMAL_SIZE)}
				miniSize={fitSize(group.length, containerWidth, SMALL_SIZE)}
				expanded={full}
			/>
		));

	return (
		<div
			ref={viewportRef}
			className="relative w-full"
			style={{ height: RESERVED_HEIGHT }}
		>
			{multiRow ? (
				groups.map((group, groupIndex) => {
					const isLead = groupIndex === leadingIndex;
					const isTrail = groupIndex === trailingIndex;
					const visible = isLead || isTrail;
					const y = isLead ? leadY : trailY;
					return (
						<div
							key={groupIndex}
							className="pointer-events-none absolute inset-x-0 flex justify-center"
							style={{
								columnGap: COLUMN_GAP,
								// Hidden rows wait scaled-down and transparent; entering
								// the trailing slot pops them up to full scale — an
								// appear animation for the small chips after a swap.
								transform: `translateY(${y}px) scale(${visible ? 1 : 0.55})`,
								transformOrigin: "center",
								opacity: visible ? 1 : 0,
								transition: `transform ${MOVE_MS}ms var(--ease-pop), opacity ${MOVE_MS}ms var(--ease-pop)`,
							}}
						>
							{rowChips(group, expanded && isLead)}
						</div>
					);
				})
			) : (
				<div
					className="absolute inset-0 flex items-center justify-center"
					style={{ columnGap: COLUMN_GAP }}
				>
					{rowChips(groups[0], expanded)}
				</div>
			)}
		</div>
	);
}
