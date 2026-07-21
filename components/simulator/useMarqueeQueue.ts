"use client";

import React from "react";

export interface MarqueeStep {
	/** What this step shows — one entry per active language. */
	items: string[];
	/**
	 * ms to hold before advancing. Omit to hold until the queue is replaced. On
	 * the last step, a hold advances into the "done" state — the queue then shows
	 * nothing, so the marquee falls through to lower-priority sources.
	 */
	holdMs?: number;
}

/**
 * Plays marquee steps in order, advancing on timers, and returns the current
 * step's items ([] when idle or done).
 *
 * `queueKey` identifies the logical queue: the sequence restarts from the first
 * step whenever it changes, and is idle when null. `steps` may be rebuilt every
 * render — the running timer keys off the current step's hold as a primitive, so
 * a fresh array with the same durations (e.g. a language swap) never resets it.
 */
export function useMarqueeQueue(
	queueKey: string | null,
	steps: MarqueeStep[],
): string[] {
	const [index, setIndex] = React.useState(0);

	// Restart at the first step when the logical queue changes. Adjusting state
	// during render (tracking the previous key) is React's pattern for this —
	// resetting inside an effect would trigger a cascading re-render.
	const [renderedKey, setRenderedKey] = React.useState(queueKey);
	if (queueKey !== renderedKey) {
		setRenderedKey(queueKey);
		setIndex(0);
	}

	// The current step's hold, taken as a plain number so the timer effect only
	// re-runs when the duration (or step/queue) actually changes — not merely
	// because `steps` was rebuilt into a new array this render.
	const currentHoldMs =
		queueKey == null ? null : (steps[index]?.holdMs ?? null);
	React.useEffect(() => {
		if (currentHoldMs == null) return undefined;
		const timer = setTimeout(() => setIndex((i) => i + 1), currentHoldMs);
		return () => clearTimeout(timer);
	}, [queueKey, index, currentHoldMs]);

	if (queueKey == null) return [];
	// Past the last step, steps[index] is undefined → [] (the done state).
	return steps[index]?.items ?? [];
}
