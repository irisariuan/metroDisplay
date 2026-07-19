import { LINES } from "@/lib/metro-data";
import type { Route, Phase, Lang } from "@/types/metro";

export interface ServiceInfo {
	ja: string;
	en: string;
	/** the train passes the current station without stopping */
	passing?: boolean;
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
	const N = route.stations.length;
	const last = pos === N - 1;
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
