import type { Phase } from "@/types/metro";

export interface Journey {
	pos: number;
	phase: Phase;
	progress: number;
	from: number | null;
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
