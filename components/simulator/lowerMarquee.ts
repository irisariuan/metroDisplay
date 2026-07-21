export interface LowerMarqueeSource {
	/** Stable identifier — documents intent and aids debugging. */
	id: string;
	/** Whether this source currently wants the marquee. */
	active: boolean;
	/** What it would show — one entry per active language. */
	items: string[];
}

/**
 * The single decision point for lower-marquee contents.
 *
 * The marquee shows one source at a time. Sources are passed in priority order
 * (highest first); the first that is `active` with non-empty `items` wins,
 * otherwise the marquee is empty. Adding a message channel is one entry with its
 * own trigger — no threading another branch through a nested ternary.
 */
export function resolveLowerMarquee(sources: LowerMarqueeSource[]): string[] {
	for (const source of sources) {
		if (source.active && source.items.length > 0) return source.items;
	}
	return [];
}
