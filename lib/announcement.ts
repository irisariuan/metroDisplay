import { LINES } from "@/lib/metro-data";
import type { Route, Phase, Lang, Station } from "@/types/metro";

export interface ServiceInfo {
	ja: string;
	en: string;
	/** the train passes the current station without stopping */
	passing?: boolean;
	/** final served stop for the train's current direction */
	terminalIndex?: number;
}

interface MajorStationOptions {
	fromIndex: number;
	direction: number;
	count: number;
	serviceStopIndices?: readonly number[];
	circular?: boolean;
}

/** Return up to `count` served major stops ahead of the train. */
export function upcomingMajorStations(
	route: Route,
	{
		fromIndex,
		direction,
		count,
		serviceStopIndices,
		circular = false,
	}: MajorStationOptions,
): Station[] {
	if (count <= 0 || route.stations.length < 2) return [];
	const servedStops = serviceStopIndices
		? new Set(serviceStopIndices)
		: undefined;
	const majorStations: Station[] = [];
	const step = direction < 0 ? -1 : 1;
	let index = fromIndex;

	for (let traversed = 0; traversed < route.stations.length - 1; traversed += 1) {
		index += step;
		if (index < 0 || index >= route.stations.length) {
			if (!circular) break;
			index = (index + route.stations.length) % route.stations.length;
		}
		if (servedStops && !servedStops.has(index)) continue;
		const station = route.stations[index];
		if (station.major) majorStations.push(station);
		if (majorStations.length === count) break;
	}
	return majorStations;
}

/**
 * Stations a departure announcement names as the direction of travel. Loop
 * lines have no terminus, so they are described purely by the major stops
 * ahead; the terminal index only stands in when no major stop is available.
 */
export function boundForList(
	route: Route,
	majorStations: readonly Station[],
	destination: Station,
): Station[] {
	const stations =
		route.circular && majorStations.length
			? [...majorStations]
			: [...majorStations, destination];
	return stations.filter(
		(station, index, all) =>
			all.findIndex((candidate) => candidate.ja === station.ja) === index,
	);
}

interface TrainStartAnnouncementOptions {
	terminalIndex: number;
	serviceJa: string;
	serviceEn: string;
	majorStations?: readonly Station[];
}

/** Spoken when a new run begins, before the ordinary next-station message. */
export function trainStartAnnouncement(
	route: Route,
	{
		terminalIndex,
		serviceJa,
		serviceEn,
		majorStations = [],
	}: TrainStartAnnouncementOptions,
	lang: Lang,
) {
	if (route.circular) {
		if (lang === "en")
			return `This is a ${LINES[route.line].en} ${serviceEn} train.`;
		// Loop lines have no terminus, so they are described purely by the
		// major stops ahead as the direction (…方面).
		const circularVia = majorStations.length
			? `${majorStations.map((station) => station.ja).join("、")}方面`
			: "";
		return `この電車は${LINES[route.line].ja}（${serviceJa}）${circularVia}です。`;
	}
	const destination = route.stations[terminalIndex];
	// The destination is named on its own as the terminus (ゆき); the 方面 list
	// only carries the major stops ahead, so drop the terminus from it to avoid
	// naming the same station twice.
	const viaStations = majorStations.filter(
		(station) => station.ja !== destination.ja,
	);
	if (lang === "ja") {
		const viaText = viaStations.length
			? `、${viaStations.map((station) => station.ja).join("、")}方面`
			: "";
		return `この電車は${LINES[route.line].ja}（${serviceJa}）${destination.ja}ゆき${viaText}です。`;
	}
	const majorStopText = majorStations.length
		? ` Calling at ${majorStations.map((station) => station.en).join(", ")}.`
		: "";
	return `This is a ${LINES[route.line].en} ${serviceEn} train bound for ${destination.en}.${majorStopText}`;
}

export function announcement(
	route: Route,
	pos: number,
	phase: Phase,
	lang: Lang,
	service?: ServiceInfo,
) {
	const st = route.stations[pos];
	if (service?.passing && phase === "approach") {
		return lang === "ja"
			? `この電車は${service.ja}です。${st.ja}には停まりません。ご注意ください。`
			: `This train is the ${service.en} service and does not stop at ${st.en}. Please be careful.`;
	}
	const last =
		!route.circular &&
		pos === (service?.terminalIndex ?? route.stations.length - 1);
	const sideJa = st.side === "L" ? "左" : "右";
	const sideEn = st.side === "L" ? "left" : "right";
	const xfJa =
		st.xf && st.xf.length
			? "　" +
				st.xf.map((l) => LINES[l].ja).join("、") +
				"はお乗り換えです。"
			: "";
	const xfEn =
		st.xf && st.xf.length
			? "  Transfer here for the " +
				st.xf.map((l) => LINES[l].en).join(", ") +
				"."
			: "";
	if (phase === "approach") {
		return lang === "ja"
			? `まもなく、${st.ja}、${st.ja}です。${sideJa}側のドアが開きます。${xfJa}`
			: `We will soon arrive at ${st.en}. The doors on the ${sideEn} side will open.${xfEn}`;
	}
	return lang === "ja"
		? `${st.ja}、${st.ja}です。${last ? "この電車の終点です。ご乗車ありがとうございました。" : ""}${xfJa}`
		: `This is ${st.en}.${last ? " This is the last stop on this train. Thank you for riding." : ""}${xfEn}`;
}
