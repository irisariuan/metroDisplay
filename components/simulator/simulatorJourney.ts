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

/** Calculate one manual/automatic phase step without depending on React state. */
export function advanceJourney(
	journey: Journey,
	direction: number,
	{
		stationCount,
		circular,
		skippedStations,
		startIndex,
		endIndex,
	}: JourneyBounds,
): Journey {
	if (direction > 0) {
		if (journey.phase === "approach") {
			if (
				skippedStations.has(journey.pos) &&
				(journey.pos < endIndex || circular)
			) {
				return {
					pos: (journey.pos + 1) % stationCount,
					phase: "approach",
					progress: 0,
					from: journey.pos,
				};
			}
			return { ...journey, phase: "at", progress: 1 };
		}

		if (journey.pos === endIndex && !circular) return journey;
		return {
			pos: (journey.pos + 1) % stationCount,
			phase: "approach",
			progress: 0,
			from: journey.pos,
		};
	}

	if (journey.phase === "approach") {
		if (journey.pos === startIndex && !circular)
			return { ...journey, phase: "at", progress: 1 };
		const target = (journey.pos - 1 + stationCount) % stationCount;
		if (skippedStations.has(target) && (target > startIndex || circular)) {
			return {
				pos: target,
				phase: "approach",
				progress: 0,
				from: journey.pos,
			};
		}
		return {
			pos: target,
			phase: "at",
			progress: 1,
			from: journey.pos,
		};
	}

	if (journey.pos === startIndex && !circular) return journey;
	return {
		pos: (journey.pos - 1 + stationCount) % stationCount,
		phase: "approach",
		progress: 0,
		from: journey.pos,
	};
}
