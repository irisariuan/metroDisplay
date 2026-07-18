import { LINES } from "@/lib/metro-data";
import type { Route, Phase, Lang } from "@/types/metro";

export function announcement(
	route: Route,
	pos: number,
	phase: Phase,
	lang: Lang,
) {
	const st = route.stations[pos];
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
