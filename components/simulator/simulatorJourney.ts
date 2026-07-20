import type { Phase } from "@/types/metro";

export interface Journey {
	pos: number;
	phase: Phase;
	progress: number;
	from: number | null;
}

export type JourneyEventType = "arrived" | "departed" | "almost-arrive";

export interface JourneyEvent {
	id: string;
	type: JourneyEventType;
	/** Station the event concerns: origin for departure, target otherwise. */
	stationIndex: number;
	fromIndex: number | null;
	targetIndex: number;
}

/**
 * Convert continuous movement state into one of the simulator's discrete
 * public events. The returned id stays stable while that event is active, so
 * consumers can safely process it once.
 */
export function journeyEventFor(
	journey: Journey,
	almostArriveThreshold: number,
): JourneyEvent | null {
	if (journey.phase === "at")
		return {
			id: `arrived:${journey.from ?? "entry"}:${journey.pos}`,
			type: "arrived",
			stationIndex: journey.pos,
			fromIndex: journey.from,
			targetIndex: journey.pos,
		};

	const threshold = Math.min(1, Math.max(0, almostArriveThreshold));
	// A departure is always observable for at least the first movement state,
	// even when the configured almost-arrival threshold is 0%.
	if (
		journey.from !== null &&
		(journey.progress === 0 || journey.progress < threshold)
	)
		return {
			id: `departed:${journey.from}:${journey.pos}`,
			type: "departed",
			stationIndex: journey.from,
			fromIndex: journey.from,
			targetIndex: journey.pos,
		};

	if (journey.progress >= threshold)
		return {
			id: `almost-arrive:${journey.from ?? "entry"}:${journey.pos}`,
			type: "almost-arrive",
			stationIndex: journey.pos,
			fromIndex: journey.from,
			targetIndex: journey.pos,
		};

	return null;
}

export interface JourneyBounds {
	stationCount: number;
	circular: boolean;
	skippedStations: ReadonlySet<number>;
	startIndex: number;
	endIndex: number;
}

const normalizedDirection = (direction: number) =>
	direction < 0 ? -1 : 1;

const canDepart = (
	position: number,
	direction: number,
	{ circular, startIndex, endIndex }: JourneyBounds,
) =>
	circular ||
	(normalizedDirection(direction) > 0
		? position < endIndex
		: position > startIndex);

/** Begin the adjacent leg from a station, matching autoplay departure logic. */
export function beginJourneyLeg(
	journey: Journey,
	direction: number,
	bounds: JourneyBounds,
): Journey {
	const step = normalizedDirection(direction);
	if (!canDepart(journey.pos, step, bounds)) return journey;
	return {
		pos:
			(journey.pos + step + bounds.stationCount) % bounds.stationCount,
		phase: "approach",
		progress: 0,
		from: journey.pos,
	};
}

/**
 * Start or redirect a manual trip. Reversing mid-leg swaps its endpoints and
 * mirrors progress, so the marker and fill continue from their current point.
 */
export function navigateJourney(
	journey: Journey,
	direction: number,
	bounds: JourneyBounds,
): Journey {
	const step = normalizedDirection(direction);
	if (journey.phase === "at")
		return beginJourneyLeg(journey, step, bounds);

	if (journey.from === null) {
		if (step > 0) return journey;
		return beginJourneyLeg(
			{ ...journey, phase: "at", progress: 1 },
			step,
			bounds,
		);
	}

	const currentStep =
		(journey.from + 1) % bounds.stationCount === journey.pos ? 1 : -1;
	if (step === currentStep) return journey;
	return {
		pos: journey.from,
		phase: "approach",
		progress: 1 - journey.progress,
		from: journey.pos,
	};
}

/** Arrive at the target or continue through a skipped stop, as autoplay does. */
export function completeJourneyLeg(
	journey: Journey,
	direction: number,
	bounds: JourneyBounds,
): Journey {
	if (journey.phase !== "approach") return journey;
	if (bounds.skippedStations.has(journey.pos)) {
		const next = beginJourneyLeg(
			{ ...journey, phase: "at", progress: 1 },
			direction,
			bounds,
		);
		if (next.phase === "approach") return next;
	}
	return { ...journey, phase: "at", progress: 1 };
}
