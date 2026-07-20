/* 水下地鐵 — Shuika Metro network data (fictional, transcribed from the map reference)
 *
 * ⚠ Transcription notes: the source map is dense, so station ORDER, platform
 * SIDE (L/R) and a few line allocations are best-effort. Lines marked with
 * "⚠ uncertain" comments should be proofread against the map. Sides alternate
 * mechanically where the map gives no cue.
 */
import type {
	AnnotatedLines,
	EditableStation,
	LineId,
	Route,
	Routes,
	Station,
} from "@/types/metro";

// line meta: id, code letter used in station numbers, names, brand color, ink-on-color legibility
const LINES: AnnotatedLines = {
	CS: {
		id: "CS",
		code: "C",
		ja: "中心原線",
		en: "Chūshingen Line",
		jaReading: "ちゅうしんげんせん",
		color: "#12318f",
		textOnColor: "#fff",
	},
	MZ: {
		id: "MZ",
		code: "M",
		ja: "水野線",
		jaReading: "みずのせん",
		en: "Mizuno Line",
		color: "#22a355",
		textOnColor: "#fff",
	},
	KW: {
		id: "KW",
		code: "K",
		ja: "北野川灣線",
		jaReading: "きたのがわわんせん",
		en: "Kitanogawa Bay Line",
		color: "#e4632a",
		textOnColor: "#fff",
	},
	UK: {
		id: "UK",
		code: "U",
		ja: "私營うかしま線",
		jaReading: "しえいうかしません",
		en: "Ukashima Line",
		color: "#e0359a",
		textOnColor: "#fff",
	},
	SD: {
		id: "SD",
		code: "S",
		ja: "水道上線",
		jaReading: "すいどううえせん",
		en: "Suidōue Line",
		color: "#f2b400",
		textOnColor: "#111",
	},
	AR: {
		id: "AR",
		code: "A",
		ja: "都鐵荒川線",
		jaReading: "とてつあらかわせん",
		en: "Toden Arakawa Line",
		color: "#d0121b",
		textOnColor: "#fff",
	},
	KZ: {
		id: "KZ",
		code: "Z",
		ja: "私營北野川坂線",
		jaReading: "しえいきたのがわざかせん",
		en: "Kitanogawa-zaka Line",
		color: "#2ba9d8",
		textOnColor: "#fff",
	},
	KH: {
		id: "KH",
		code: "H",
		ja: "北野川本線",
		jaReading: "きたのがわほんせん",
		en: "Kitanogawa Main Line",
		color: "#a8bf2f",
		textOnColor: "#111",
	},
	SG: {
		id: "SG",
		code: "G",
		ja: "水道後線",
		jaReading: "すいどうごせん",
		en: "Suidōgo Line",
		color: "#7d3fb0",
		textOnColor: "#fff",
	},
	MG: {
		id: "MG",
		code: "W",
		ja: "私營水口線",
		jaReading: "しえいみずぐちせん",
		en: "Mizuguchi Line",
		color: "#55c2ad",
		textOnColor: "#111",
	},
	SN: {
		id: "SN",
		code: "N",
		ja: "新水野線",
		jaReading: "しんみずのせん",
		en: "Shin-Mizuno Line",
		color: "#58b7c8",
		textOnColor: "#111",
	},
	YM: {
		id: "YM",
		code: "JY",
		ja: "JR山手線",
		jaReading: "じぇいあーるやまのてせん",
		en: "JR Yamanote Line",
		color: "#9acd32",
		textOnColor: "#111",
	},
};

// Station readings are stored separately so every route that shares a station
// consistently exposes both phonetic Japanese scripts.
const STATION_READINGS: Record<string, { hira: string; kata: string }> = {
	// — 荒川 / 森原 area
	荒川: { hira: "あらかわ", kata: "アラカワ" },
	荒川北: { hira: "あらかわきた", kata: "アラカワキタ" },
	新荒川北: { hira: "しんあらかわきた", kata: "シンアラカワキタ" },
	荒川公園前: { hira: "あらかわこうえんまえ", kata: "アラカワコウエンマエ" },
	荒川火車站: { hira: "あらかわかしゃえき", kata: "アラカワカシャエキ" },
	西森原: { hira: "にしもりはら", kata: "ニシモリハラ" },
	森原: { hira: "もりはら", kata: "モリハラ" },
	森原北: { hira: "もりはらきた", kata: "モリハラキタ" },
	森原東: { hira: "もりはらひがし", kata: "モリハラヒガシ" },
	森原南: { hira: "もりはらみなみ", kata: "モリハラミナミ" },
	新森原: { hira: "しんもりはら", kata: "シンモリハラ" },
	新森原北: { hira: "しんもりはらきた", kata: "シンモリハラキタ" },
	南森原火車站: {
		hira: "みなみもりはらかしゃえき",
		kata: "ミナミモリハラカシャエキ",
	},
	森原小學前: {
		hira: "もりはらしょうがくまえ",
		kata: "モリハラショウガクマエ",
	},
	国会議事堂前: {
		hira: "こっかいぎじどうまえ",
		kata: "コッカイギジドウマエ",
	},
	// — 中心原 area
	中心原: { hira: "ちゅうしんげん", kata: "チュウシンゲン" },
	中心原南: { hira: "ちゅうしんげんみなみ", kata: "チュウシンゲンミナミ" },
	中心原北: { hira: "ちゅうしんげんきた", kata: "チュウシンゲンキタ" },
	新中心原北: {
		hira: "しんちゅうしんげんきた",
		kata: "シンチュウシンゲンキタ",
	},
	都鐵中心原火車站: {
		hira: "とてつちゅうしんげんかしゃえき",
		kata: "トテツチュウシンゲンカシャエキ",
	},
	// — 聖橋 area
	聖橋: { hira: "ひじりばし", kata: "ヒジリバシ" },
	聖橋西: { hira: "ひじりばしにし", kata: "ヒジリバシニシ" },
	聖橋東: { hira: "ひじりばしひがし", kata: "ヒジリバシヒガシ" },
	聖橋北: { hira: "ひじりばしきた", kata: "ヒジリバシキタ" },
	聖橋公園: { hira: "ひじりばしこうえん", kata: "ヒジリバシコウエン" },
	聖橋灣: { hira: "ひじりばしわん", kata: "ヒジリバシワン" },
	新聖橋: { hira: "しんひじりばし", kata: "シンヒジリバシ" },
	南聖橋: { hira: "みなみひじりばし", kata: "ミナミヒジリバシ" },
	中聖橋: { hira: "なかひじりばし", kata: "ナカヒジリバシ" },
	中聖橋上: { hira: "なかひじりばしうえ", kata: "ナカヒジリバシウエ" },
	新中聖橋: { hira: "しんなかひじりばし", kata: "シンナカヒジリバシ" },
	新南聖橋: {
		hira: "しんみなみひじりばし",
		kata: "シンミナミヒジリバシ",
	},
	// — 水道上 area
	水道上: { hira: "すいどううえ", kata: "スイドウウエ" },
	水道上南: { hira: "すいどううえみなみ", kata: "スイドウウエミナミ" },
	新水道上: { hira: "しんすいどううえ", kata: "シンスイドウウエ" },
	水道上火車站: {
		hira: "すいどううえかしゃえき",
		kata: "スイドウウエカシャエキ",
	},
	// — 水道後 area
	水道後: { hira: "すいどうご", kata: "スイドウゴ" },
	水道後西: { hira: "すいどうごにし", kata: "スイドウゴニシ" },
	水道後南: { hira: "すいどうごみなみ", kata: "スイドウゴミナミ" },
	水道後北: { hira: "すいどうごきた", kata: "スイドウゴキタ" },
	新水道後: { hira: "しんすいどうご", kata: "シンスイドウゴ" },
	新水道後北: { hira: "しんすいどうごきた", kata: "シンスイドウゴキタ" },
	水道後廣場前: {
		hira: "すいどうごひろばまえ",
		kata: "スイドウゴヒロバマエ",
	},
	水道後火車站: {
		hira: "すいどうごかしゃえき",
		kata: "スイドウゴカシャエキ",
	},
	// — 北野川 area
	北野川坂: { hira: "きたのがわざか", kata: "キタノガワザカ" },
	北野川坂北: { hira: "きたのがわざかきた", kata: "キタノガワザカキタ" },
	新北野川: { hira: "しんきたのがわ", kata: "シンキタノガワ" },
	北野川灣: { hira: "きたのがわわん", kata: "キタノガワワン" },
	北野川灣北: { hira: "きたのがわわんきた", kata: "キタノガワワンキタ" },
	北野川灣東: { hira: "きたのがわわんひがし", kata: "キタノガワワンヒガシ" },
	北野川灣港前: {
		hira: "きたのがわわんこうまえ",
		kata: "キタノガワワンコウマエ",
	},
	北野川灣轉運站: {
		hira: "きたのがわわんてんうんえき",
		kata: "キタノガワワンテンウンエキ",
	},
	新北野川国際空港: {
		hira: "しんきたのがわこくさいくうこう",
		kata: "シンキタノガワコクサイクウコウ",
	},
	重工第一區: { hira: "じゅうこうだいいちく", kata: "ジュウコウダイイチク" },
	// — うかしま area
	うかしま: { hira: "うかしま", kata: "ウカシマ" },
	西うかしま: { hira: "にしうかしま", kata: "ニシウカシマ" },
	中うかしま: { hira: "なかうかしま", kata: "ナカウカシマ" },
	南うかしま: { hira: "みなみうかしま", kata: "ミナミウカシマ" },
	北うかしま: { hira: "きたうかしま", kata: "キタウカシマ" },
	うかしま東: { hira: "うかしまひがし", kata: "ウカシマヒガシ" },
	// — 登海 area
	登海: { hira: "とうかい", kata: "トウカイ" },
	登海北: { hira: "とうかいきた", kata: "トウカイキタ" },
	登海東: { hira: "とうかいひがし", kata: "トウカイヒガシ" },
	新登海: { hira: "しんとうかい", kata: "シントウカイ" },
	// — others
	醫學大學前: { hira: "いがくだいがくまえ", kata: "イガクダイガクマエ" },
	真海: { hira: "しんかい", kata: "シンカイ" }, // ⚠ uncertain reading
	安涌: { hira: "あんゆう", kata: "アンユウ" }, // ⚠ uncertain reading
	内口: { hira: "うちぐち", kata: "ウチグチ" },
	// — Tokyo / Yamanote Line
	東京: { hira: "とうきょう", kata: "トウキョウ" },
	神田: { hira: "かんだ", kata: "カンダ" },
	秋葉原: { hira: "あきはばら", kata: "アキハバラ" },
	御徒町: { hira: "おかちまち", kata: "オカチマチ" },
	上野: { hira: "うえの", kata: "ウエノ" },
	鶯谷: { hira: "うぐいすだに", kata: "ウグイスダニ" },
	日暮里: { hira: "にっぽり", kata: "ニッポリ" },
	西日暮里: { hira: "にしにっぽり", kata: "ニシニッポリ" },
	田端: { hira: "たばた", kata: "タバタ" },
	駒込: { hira: "こまごめ", kata: "コマゴメ" },
	巣鴨: { hira: "すがも", kata: "スガモ" },
	大塚: { hira: "おおつか", kata: "オオツカ" },
	池袋: { hira: "いけぶくろ", kata: "イケブクロ" },
	目白: { hira: "めじろ", kata: "メジロ" },
	高田馬場: { hira: "たかだのばば", kata: "タカダノババ" },
	新大久保: { hira: "しんおおくぼ", kata: "シンオオクボ" },
	新宿: { hira: "しんじゅく", kata: "シンジュク" },
	代々木: { hira: "よよぎ", kata: "ヨヨギ" },
	原宿: { hira: "はらじゅく", kata: "ハラジュク" },
	渋谷: { hira: "しぶや", kata: "シブヤ" },
	恵比寿: { hira: "えびす", kata: "エビス" },
	目黒: { hira: "めぐろ", kata: "メグロ" },
	五反田: { hira: "ごたんだ", kata: "ゴタンダ" },
	大崎: { hira: "おおさき", kata: "オオサキ" },
	品川: { hira: "しながわ", kata: "シナガワ" },
	高輪ゲートウェイ: {
		hira: "たかなわげーとうぇい",
		kata: "タカナワゲートウェイ",
	},
	田町: { hira: "たまち", kata: "タマチ" },
	浜松町: { hira: "はままつちょう", kata: "ハママツチョウ" },
	新橋: { hira: "しんばし", kata: "シンバシ" },
	有楽町: { hira: "ゆうらくちょう", kata: "ユウラクチョウ" },
};

// helper: s/sm(ja, en, side, ...transferLineIds)  side: 'L' | 'R'
function s(
	ja: string,
	en: string,
	side: Station["side"],
	distance: number,
	...xf: LineId[]
): EditableStation {
	return {
		ja,
		en,
		side,
		xf,
		hira: STATION_READINGS[ja]?.hira || "",
		kata: STATION_READINGS[ja]?.kata || "",
		distance,
	};
}
function sm(
	ja: string,
	en: string,
	side: Station["side"],
	distance: number,
	...xf: LineId[]
): EditableStation {
	return {
		ja,
		en,
		side,
		xf,
		hira: STATION_READINGS[ja]?.hira || "",
		kata: STATION_READINGS[ja]?.kata || "",
		distance,
		major: true,
	};
}

/**
 * Mark interchanges and both termini as major by default. Explicit editor
 * choices are retained so custom routes can opt a station in or out.
 */
export function markMajorStations(route: Route): Route {
	const terminalIndex = route.stations.length - 1;
	for (const [index, station] of route.stations.entries()) {
		if (station.major === undefined)
			station.major =
				index === 0 || index === terminalIndex || station.xf.length > 0;
	}
	return route;
}

// Each line: ordered stations. terminusJa/En used for destination.
const shuikaRoutes: Record<string, Route> = {
	// 中心原線 — the east–west trunk: 荒川 → 聖橋東
	CS: {
		line: "CS",
		destJa: "聖橋東",
		destEn: "Hijiribashi-Higashi",
		towardJa: "聖橋・聖橋東",
		towardEn: "for Hijiribashi",
		stations: [
			s("荒川", "Arakawa", "R", 1, "AR"),
			s("西森原", "Nishi-Morihara", "L", 1.1, "MG"),
			s("国会議事堂前", "Kokkai-Gijidō-mae", "R", 0.9),
			s("森原", "Morihara", "R", 1, "MZ"),
			s("中心原南", "Chūshingen-Minami", "L", 1.1, "SN"),
			s("中心原", "Chūshingen", "R", 1, "SD"),
			s("聖橋西", "Hijiribashi-Nishi", "L", 0.8),
			s("聖橋公園", "Hijiribashi-Kōen", "R", 0.9),
			s("聖橋", "Hijiribashi", "R", 1, "KW"),
			s("中聖橋", "Naka-Hijiribashi", "L", 0.8),
			s("新中聖橋", "Shin-Naka-Hijiribashi", "R", 0.9),
			s("聖橋東", "Hijiribashi-Higashi", "L", 1.1, "SN"),
		],
	},
	// 水野線 — 森原 loop up to 聖橋北 ⚠ uncertain: western leg
	// (森原小學前・森原東) vs. a southern leg through the 水道後 corridor.
	MZ: {
		line: "MZ",
		circular: true,
		destJa: "聖橋北",
		destEn: "Hijiribashi-Kita",
		towardJa: "水道上・聖橋北",
		towardEn: "for Hijiribashi-Kita",
		stations: [
			s("森原南", "Morihara-Minami", "L", 1.1, "SG"),
			s("森原", "Morihara", "R", 1, "CS"),
			s("森原小學前", "Morihara-Shōgaku-mae", "L", 0.8),
			s("森原東", "Morihara-Higashi", "R", 0.9),
			s("中心原北", "Chūshingen-Kita", "R", 1, "SD"),
			s("水道上南", "Suidōue-Minami", "L", 0.8),
			s("水道上", "Suidōue", "R", 1, "KZ"),
			s("水道上火車站", "Suidōue Rail Terminal", "L", 0.8),
			s("北野川坂", "Kitanogawa-zaka", "L", 1.1, "KZ"),
			s("聖橋北", "Hijiribashi-Kita", "R", 1, "KW"),
		],
	},
	// 北野川灣線 — 南聖橋 north to the bay, then east to 新北野川
	KW: {
		line: "KW",
		destJa: "新北野川",
		destEn: "Shin-Kitanogawa",
		towardJa: "北野川灣・新北野川",
		towardEn: "for Shin-Kitanogawa",
		stations: [
			s("南聖橋", "Minami-Hijiribashi", "L", 1.1, "SN"),
			s("聖橋", "Hijiribashi", "R", 1, "CS"),
			s("聖橋北", "Hijiribashi-Kita", "L", 1.1, "MZ"),
			s("北野川灣港前", "Kitanogawa-Bay-Port", "L", 1.1, "UK", "KH"),
			s("北野川灣轉運站", "Kitanogawa-Bay Transit Center", "R", 1, "KH"),
			s("北野川灣", "Kitanogawa-Bay", "R", 0.9),
			s("北野川灣東", "Kitanogawa-Bay-Higashi", "L", 0.8),
			s("新北野川", "Shin-Kitanogawa", "R", 0.9),
		],
	},
	// 私營うかしま線 — the long private cross-city diagonal
	// ⚠ uncertain: eastern spur (新聖橋・聖橋灣・中聖橋上) allocation.
	UK: {
		line: "UK",
		destJa: "中聖橋上",
		destEn: "Naka-Hijiribashi-Ue",
		towardJa: "真海・中聖橋上",
		towardEn: "for Naka-Hijiribashi-Ue",
		stations: [
			s("西うかしま", "Nishi-Ukashima", "L", 1.1, "AR"),
			s("うかしま", "Ukashima", "R", 1, "MG"),
			s("中うかしま", "Naka-Ukashima", "L", 0.8),
			s("醫學大學前", "Igakudaigaku-mae", "R", 0.9),
			s("真海", "Shinkai", "L", 0.8),
			s("新中心原北", "Shin-Chūshingen-Kita", "R", 0.9),
			s("都鐵中心原火車站", "Toden Chūshingen Station", "L", 1.1, "SD"),
			s("北野川灣港前", "Kitanogawa-Bay-Port", "R", 1, "KW", "KH"),
			s("新聖橋", "Shin-Hijiribashi", "L", 0.8),
			s("聖橋灣", "Hijiribashi-Wan", "R", 0.9),
			s("中聖橋上", "Naka-Hijiribashi-Ue", "L", 0.8),
		],
	},
	// 水道上線 — 登海 south-east into the 中心原 hub
	SD: {
		line: "SD",
		destJa: "中心原",
		destEn: "Chūshingen",
		towardJa: "水道上・中心原",
		towardEn: "for Chūshingen",
		stations: [
			s("登海北", "Tōkai-Kita", "L", 0.8),
			s("登海", "Tōkai", "R", 1, "MG"),
			s("登海東", "Tōkai-Higashi", "L", 0.8),
			s("新水道上", "Shin-Suidōue", "R", 1, "KZ"),
			s("都鐵中心原火車站", "Toden Chūshingen Station", "L", 1.1, "UK"),
			s("中心原北", "Chūshingen-Kita", "R", 1, "MZ"),
			s("中心原", "Chūshingen", "R", 1, "CS"),
		],
	},
	// 都鐵荒川線 — short metropolitan branch down to 荒川
	AR: {
		line: "AR",
		destJa: "荒川",
		destEn: "Arakawa",
		towardJa: "荒川北・荒川",
		towardEn: "for Arakawa",
		stations: [
			s("西うかしま", "Nishi-Ukashima", "L", 1.1, "UK"),
			s("新荒川北", "Shin-Arakawa-Kita", "R", 0.9),
			s("荒川公園前", "Arakawa-Kōen-mae", "L", 0.8),
			s("荒川北", "Arakawa-Kita", "R", 0.9),
			s("荒川", "Arakawa", "L", 1.1, "CS"),
		],
	},
	// 私營北野川坂線 — 安涌 down the eastern hillside to 水道上
	KZ: {
		line: "KZ",
		destJa: "水道上",
		destEn: "Suidōue",
		towardJa: "北野川坂・水道上",
		towardEn: "for Suidōue",
		stations: [
			s("安涌", "Anyū", "L", 0.8),
			s("内口", "Uchiguchi", "R", 1, "MG"),
			s("北野川坂北", "Kitanogawa-zaka-Kita", "L", 0.8),
			s("新水道上", "Shin-Suidōue", "R", 1, "SD"),
			s("北野川坂", "Kitanogawa-zaka", "L", 1.1, "MZ"),
			s("水道上", "Suidōue", "R", 1, "MZ"),
		],
	},
	// 北野川本線 — suburban main line out to the airport & industry belt
	KH: {
		line: "KH",
		destJa: "重工第一區",
		destEn: "Jūkō Daiichi-ku",
		towardJa: "空港・重工第一區",
		towardEn: "for Jūkō Daiichi-ku",
		stations: [
			s("北野川灣港前", "Kitanogawa-Bay-Port", "L", 1.1, "KW", "UK"),
			s("北野川灣轉運站", "Kitanogawa-Bay Transit Center", "R", 1, "KW"),
			s("北野川灣北", "Kitanogawa-Bay-Kita", "L", 0.8),
			s("新北野川国際空港", "Shin-Kitanogawa Int'l Airport", "R", 0.9),
			s("重工第一區", "Jūkō Daiichi-ku", "L", 0.8),
		],
	},
	// 水道後線 — the southern corridor ⚠ uncertain: middle-section order
	// (廣場前 / 南 / 北) is hard to read on the map.
	SG: {
		line: "SG",
		destJa: "水道後",
		destEn: "Suidōgo",
		towardJa: "水道後廣場・水道後",
		towardEn: "for Suidōgo",
		stations: [
			s("南森原火車站", "Minami-Morihara Rail Terminal", "L", 1.1, "MG"),
			s("新森原", "Shin-Morihara", "R", 0.9),
			s("森原南", "Morihara-Minami", "L", 1.1, "MZ"),
			s("水道後西", "Suidōgo-Nishi", "R", 0.9),
			s("新水道後", "Shin-Suidōgo", "L", 0.8),
			s("水道後廣場前", "Suidōgo-Hiroba-mae", "R", 0.9),
			s("水道後南", "Suidōgo-Minami", "L", 0.8),
			s("水道後北", "Suidōgo-Kita", "R", 0.9),
			s("水道後", "Suidōgo", "L", 0.8),
		],
	},
	// 私營水口線 — private western loop line ⚠ uncertain: exact path
	// between 荒川火車站 and 内口 is a best-effort reading.
	MG: {
		line: "MG",
		destJa: "内口",
		destEn: "Uchiguchi",
		towardJa: "うかしま・内口",
		towardEn: "for Uchiguchi",
		stations: [
			s("南森原火車站", "Minami-Morihara Rail Terminal", "R", 1, "SG"),
			s("荒川火車站", "Arakawa Rail Terminal", "L", 0.8),
			s("西森原", "Nishi-Morihara", "R", 1, "CS"),
			s("森原北", "Morihara-Kita", "L", 0.8),
			s("うかしま東", "Ukashima-Higashi", "R", 0.9),
			s("新森原北", "Shin-Morihara-Kita", "L", 0.8),
			s("南うかしま", "Minami-Ukashima", "R", 0.9),
			s("うかしま", "Ukashima", "L", 1.1, "UK"),
			s("北うかしま", "Kita-Ukashima", "R", 0.9),
			s("新登海", "Shin-Tōkai", "L", 0.8),
			s("登海", "Tōkai", "R", 1, "SD"),
			s("内口", "Uchiguchi", "L", 1.1, "KZ"),
		],
	},
	// 新水野線 — the new south-eastern bypass into 聖橋東
	SN: {
		line: "SN",
		destJa: "聖橋東",
		destEn: "Hijiribashi-Higashi",
		towardJa: "水道後・聖橋東",
		towardEn: "for Hijiribashi-Higashi",
		stations: [
			s("中心原南", "Chūshingen-Minami", "L", 1.1, "CS"),
			s("新水道後北", "Shin-Suidōgo-Kita", "R", 0.9),
			s("水道後火車站", "Suidōgo Rail Terminal", "L", 0.8),
			s("南聖橋", "Minami-Hijiribashi", "R", 1, "KW"),
			s("新南聖橋", "Shin-Minami-Hijiribashi", "L", 0.8),
			s("聖橋東", "Hijiribashi-Higashi", "R", 1, "CS"),
		],
	},
} as const;
const jrRoutes: Record<string, Route> = {
	// JR Yamanote Line — clockwise Tokyo loop. Each distance is the inbound
	// leg in kilometres, including the closing leg into Tokyo.
	YM: {
		line: "YM",
		circular: true,
		destJa: "東京",
		destEn: "Tokyo",
		towardJa: "品川・渋谷方面",
		towardEn: "for Shinagawa and Shibuya",
		stations: [
			sm("東京", "Tokyo", "L", 1.1),
			s("神田", "Kanda", "R", 1.3),
			s("秋葉原", "Akihabara", "L", 0.7),
			s("御徒町", "Okachimachi", "R", 1),
			sm("上野", "Ueno", "L", 0.6),
			s("鶯谷", "Uguisudani", "R", 1.1),
			sm("日暮里", "Nippori", "L", 0.5),
			s("西日暮里", "Nishi-Nippori", "R", 1.1),
			sm("田端", "Tabata", "L", 1.7),
			s("駒込", "Komagome", "R", 1.6),
			s("巣鴨", "Sugamo", "L", 1.1),
			s("大塚", "Ōtsuka", "R", 1.8),
			sm("池袋", "Ikebukuro", "L", 1.2),
			s("目白", "Mejiro", "R", 1.4),
			sm("高田馬場", "Takadanobaba", "L", 1.4),
			s("新大久保", "Shin-Ōkubo", "R", 1.3),
			sm("新宿", "Shinjuku", "L", 0.7),
			s("代々木", "Yoyogi", "R", 1.5),
			s("原宿", "Harajuku", "L", 1.6),
			sm("渋谷", "Shibuya", "R", 1.6),
			s("恵比寿", "Ebisu", "L", 1.5),
			sm("目黒", "Meguro", "R", 1.2),
			s("五反田", "Gotanda", "L", 0.9),
			sm("大崎", "Ōsaki", "R", 2),
			sm("品川", "Shinagawa", "L", 0.9),
			s("高輪ゲートウェイ", "Takanawa Gateway", "R", 1.3),
			s("田町", "Tamachi", "L", 1.5),
			sm("浜松町", "Hamamatsuchō", "R", 1.2),
			sm("新橋", "Shimbashi", "L", 1.9),
			sm("有楽町", "Yūrakuchō", "R", 0.8),
		],
	},
} as const;

const ROUTES: Routes = { ...shuikaRoutes, ...jrRoutes };
Object.values(ROUTES).forEach(markMajorStations);

/** The selectable starting points for the simulator's built-in route presets. */
export const SIMULATOR_PRESETS = [
	{
		id: "shuika",
		label: "SHUIKA METRO",
		lineId: "CS" as LineId,
		lineIds: [
			"CS",
			"MZ",
			"KW",
			"UK",
			"SD",
			"AR",
			"KZ",
			"KH",
			"SG",
			"MG",
			"SN",
		] as LineId[],
	},
	{
		id: "yamanote",
		label: "TOKYO · YAMANOTE",
		lineId: "YM" as LineId,
		lineIds: ["YM"] as LineId[],
	},
] as const;
export interface SimulatorPreset {
	id: string;
	label: string;
	lineId: LineId;
	lineIds: LineId[];
	marqueePresetId: string;
}
export type SimulatorPresetId = string;

// station number label e.g. C05
function num(lineId: LineId, idx: number): string {
	return LINES[lineId].code + String(idx + 1).padStart(2, "0");
}

export { LINES, ROUTES, num };
