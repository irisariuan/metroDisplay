export type LineId = "CS" | "MZ" | "KW" | "UK" | "SD" | "AR";

export type Side = "L" | "R";

export type Lang = "ja" | "en";

export type Phase = "approach" | "at";

export interface LineMeta {
	id: LineId;
	code: string;
	ja: string;
	en: string;
	color: string;
	textOnColor: string;
}

export interface Station {
	ja: string;
	en: string;
	side: Side;
	xf: LineId[];
	hira: string;
	kata: string;
}

export interface Route {
	line: LineId;
	destJa: string;
	destEn: string;
	towardJa: string;
	towardEn: string;
	stations: Station[];
}

export type Lines = Record<LineId, LineMeta>;
export type Routes = Record<LineId, Route>;

export interface MarqueeItem {
	type: "ad" | "notice";
	en: string;
	ja?: string;
}
