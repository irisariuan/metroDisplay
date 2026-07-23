export type LineId = string
	// | "CS" // 中心原線
	// | "MZ" // 水野線
	// | "KW" // 北野川灣線
	// | "UK" // 私營うかしま線
	// | "SD" // 水道上線
	// | "AR" // 都鐵荒川線
	// | "KZ" // 私營北野川坂線
	// | "KH" // 北野川本線
	// | "SG" // 水道後線
	// | "MG" // 私營水口線
	// | "SN" // 新水野線
	// | "YM"; // JR 山手線

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

export interface AnnotatedLineMeta extends LineMeta {
	jaReading?: string;
	enReading?: string;
}

export interface Station {
	ja: string;
	en: string;
	side: Side;
	xf: LineId[];
	hira: string;
	kata: string;
	/** highlighted stop for route displays and service announcements */
	major?: boolean;
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
	/** loops back to the first station instead of terminating */
	circular?: boolean;
}

/** Editor-only station data used by the simulator's line designer. */
export interface EditableStation extends Station {
	distance?: number;
}

/** Route data enriched with the simulator editor's mutable fields. */
export interface EditableRoute extends Omit<Route, "stations"> {
	circular?: boolean;
	stations: EditableStation[];
}

export type EditableStationField = "ja" | "en" | "hira" | "kata" | "distance";
export type LineEditorField = "ja" | "en" | "color";
export type RouteDestinationField = "destJa" | "destEn";

export type Lines = Record<LineId, LineMeta>;
export type AnnotatedLines = Record<LineId, AnnotatedLineMeta>;
export type Routes = Record<LineId, EditableRoute>;

export type AnnouncementContentType = "ad" | "notice" | 'sound';

export interface AnnouncementContent {
	type: AnnouncementContentType;
	en: string;
	ja?: string;
	enReading?: string;
	jaReading?: string;
}
