export type LineId =
	| "CS" // 中心原線
	| "MZ" // 水野線
	| "KW" // 北野川灣線
	| "UK" // 私營うかしま線
	| "SD" // 水道上線
	| "AR" // 都鐵荒川線
	| "KZ" // 私營北野川坂線
	| "KH" // 北野川本線
	| "SG" // 水道後線
	| "MG" // 私營水口線
	| "SN"; // 新水野線

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
	/** service-variant ids that pass this station without stopping */
	skip?: string[];
}

/** An express-style stopping pattern the user can define per line.
 *  The implicit "local" service stops everywhere and is not stored. */
export interface ServiceVariant {
	id: string;
	ja: string;
	en: string;
}

export interface Route {
	line: LineId;
	destJa: string;
	destEn: string;
	towardJa: string;
	towardEn: string;
	stations: Station[];
	services?: ServiceVariant[];
}

export type Lines = Record<LineId, LineMeta>;
export type Routes = Record<LineId, Route>;

export interface MarqueeItem {
	type: "ad" | "notice";
	en: string;
	ja?: string;
}
