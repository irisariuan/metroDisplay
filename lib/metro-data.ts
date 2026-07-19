/* 水下地鐵 — Shuika Metro network data (fictional, transcribed from the map reference)
 *
 * ⚠ Transcription notes: the source map is dense, so station ORDER, platform
 * SIDE (L/R) and a few line allocations are best-effort. Lines marked with
 * "⚠ uncertain" comments should be proofread against the map. Sides alternate
 * mechanically where the map gives no cue.
 */
import type { LineId, Lines, Routes, Station } from "@/types/metro";

// line meta: id, code letter used in station numbers, names, brand color, ink-on-color legibility
const LINES: Lines = {
	CS: {
		id: "CS",
		code: "C",
		ja: "中心原線",
		en: "Chūshingen Line",
		color: "#12318f",
		textOnColor: "#fff",
	},
	MZ: {
		id: "MZ",
		code: "M",
		ja: "水野線",
		en: "Mizuno Line",
		color: "#22a355",
		textOnColor: "#fff",
	},
	KW: {
		id: "KW",
		code: "K",
		ja: "北野川灣線",
		en: "Kitanogawa Bay Line",
		color: "#e4632a",
		textOnColor: "#fff",
	},
	UK: {
		id: "UK",
		code: "U",
		ja: "私營うかしま線",
		en: "Ukashima Line",
		color: "#e0359a",
		textOnColor: "#fff",
	},
	SD: {
		id: "SD",
		code: "S",
		ja: "水道上線",
		en: "Suidōue Line",
		color: "#f2b400",
		textOnColor: "#111",
	},
	AR: {
		id: "AR",
		code: "A",
		ja: "都鐵荒川線",
		en: "Toden Arakawa Line",
		color: "#d0121b",
		textOnColor: "#fff",
	},
	KZ: {
		id: "KZ",
		code: "Z",
		ja: "私營北野川坂線",
		en: "Kitanogawa-zaka Line",
		color: "#2ba9d8",
		textOnColor: "#fff",
	},
	KH: {
		id: "KH",
		code: "H",
		ja: "北野川本線",
		en: "Kitanogawa Main Line",
		color: "#a8bf2f",
		textOnColor: "#111",
	},
	SG: {
		id: "SG",
		code: "G",
		ja: "水道後線",
		en: "Suidōgo Line",
		color: "#7d3fb0",
		textOnColor: "#fff",
	},
	MG: {
		id: "MG",
		code: "W",
		ja: "私營水口線",
		en: "Mizuguchi Line",
		color: "#55c2ad",
		textOnColor: "#111",
	},
	SN: {
		id: "SN",
		code: "N",
		ja: "新水野線",
		en: "Shin-Mizuno Line",
		color: "#58b7c8",
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
};

// helper: s(ja, en, side, ...transferLineIds)  side: 'L' | 'R'
const s = (
	ja: string,
	en: string,
	side: Station["side"],
	...xf: LineId[]
): Station => ({
	ja,
	en,
	side,
	xf,
	hira: STATION_READINGS[ja]?.hira || "",
	kata: STATION_READINGS[ja]?.kata || "",
});

// Each line: ordered stations. terminusJa/En used for destination.
const ROUTES: Routes = {
	// 中心原線 — the east–west trunk: 荒川 → 聖橋東
	CS: {
		line: "CS",
		destJa: "聖橋東",
		destEn: "Hijiribashi-Higashi",
		towardJa: "聖橋・聖橋東",
		towardEn: "for Hijiribashi",
		stations: [
			s("荒川", "Arakawa", "R", "AR"),
			s("西森原", "Nishi-Morihara", "L", "MG"),
			s("国会議事堂前", "Kokkai-Gijidō-mae", "R"),
			s("森原", "Morihara", "R", "MZ"),
			s("中心原南", "Chūshingen-Minami", "L", "SN"),
			s("中心原", "Chūshingen", "R", "SD"),
			s("聖橋西", "Hijiribashi-Nishi", "L"),
			s("聖橋公園", "Hijiribashi-Kōen", "R"),
			s("聖橋", "Hijiribashi", "R", "KW"),
			s("中聖橋", "Naka-Hijiribashi", "L"),
			s("新中聖橋", "Shin-Naka-Hijiribashi", "R"),
			s("聖橋東", "Hijiribashi-Higashi", "L", "SN"),
		],
	},
	// 水野線 — 森原 loop up to 聖橋北 ⚠ uncertain: western leg
	// (森原小學前・森原東) vs. a southern leg through the 水道後 corridor.
	MZ: {
		line: "MZ",
		destJa: "聖橋北",
		destEn: "Hijiribashi-Kita",
		towardJa: "水道上・聖橋北",
		towardEn: "for Hijiribashi-Kita",
		stations: [
			s("森原南", "Morihara-Minami", "L", "SG"),
			s("森原", "Morihara", "R", "CS"),
			s("森原小學前", "Morihara-Shōgaku-mae", "L"),
			s("森原東", "Morihara-Higashi", "R"),
			s("中心原北", "Chūshingen-Kita", "R", "SD"),
			s("水道上南", "Suidōue-Minami", "L"),
			s("水道上", "Suidōue", "R", "KZ"),
			s("水道上火車站", "Suidōue Rail Terminal", "L"),
			s("北野川坂", "Kitanogawa-zaka", "L", "KZ"),
			s("聖橋北", "Hijiribashi-Kita", "R", "KW"),
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
			s("南聖橋", "Minami-Hijiribashi", "L", "SN"),
			s("聖橋", "Hijiribashi", "R", "CS"),
			s("聖橋北", "Hijiribashi-Kita", "L", "MZ"),
			s("北野川灣港前", "Kitanogawa-Bay-Port", "L", "UK", "KH"),
			s("北野川灣轉運站", "Kitanogawa-Bay Transit Center", "R", "KH"),
			s("北野川灣", "Kitanogawa-Bay", "R"),
			s("北野川灣東", "Kitanogawa-Bay-Higashi", "L"),
			s("新北野川", "Shin-Kitanogawa", "R"),
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
			s("西うかしま", "Nishi-Ukashima", "L", "AR"),
			s("うかしま", "Ukashima", "R", "MG"),
			s("中うかしま", "Naka-Ukashima", "L"),
			s("醫學大學前", "Igakudaigaku-mae", "R"),
			s("真海", "Shinkai", "L"),
			s("新中心原北", "Shin-Chūshingen-Kita", "R"),
			s("都鐵中心原火車站", "Toden Chūshingen Station", "L", "SD"),
			s("北野川灣港前", "Kitanogawa-Bay-Port", "R", "KW", "KH"),
			s("新聖橋", "Shin-Hijiribashi", "L"),
			s("聖橋灣", "Hijiribashi-Wan", "R"),
			s("中聖橋上", "Naka-Hijiribashi-Ue", "L"),
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
			s("登海北", "Tōkai-Kita", "L"),
			s("登海", "Tōkai", "R", "MG"),
			s("登海東", "Tōkai-Higashi", "L"),
			s("新水道上", "Shin-Suidōue", "R", "KZ"),
			s("都鐵中心原火車站", "Toden Chūshingen Station", "L", "UK"),
			s("中心原北", "Chūshingen-Kita", "R", "MZ"),
			s("中心原", "Chūshingen", "R", "CS"),
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
			s("西うかしま", "Nishi-Ukashima", "L", "UK"),
			s("新荒川北", "Shin-Arakawa-Kita", "R"),
			s("荒川公園前", "Arakawa-Kōen-mae", "L"),
			s("荒川北", "Arakawa-Kita", "R"),
			s("荒川", "Arakawa", "L", "CS"),
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
			s("安涌", "Anyū", "L"),
			s("内口", "Uchiguchi", "R", "MG"),
			s("北野川坂北", "Kitanogawa-zaka-Kita", "L"),
			s("新水道上", "Shin-Suidōue", "R", "SD"),
			s("北野川坂", "Kitanogawa-zaka", "L", "MZ"),
			s("水道上", "Suidōue", "R", "MZ"),
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
			s("北野川灣港前", "Kitanogawa-Bay-Port", "L", "KW", "UK"),
			s("北野川灣轉運站", "Kitanogawa-Bay Transit Center", "R", "KW"),
			s("北野川灣北", "Kitanogawa-Bay-Kita", "L"),
			s("新北野川国際空港", "Shin-Kitanogawa Int'l Airport", "R"),
			s("重工第一區", "Jūkō Daiichi-ku", "L"),
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
			s("南森原火車站", "Minami-Morihara Rail Terminal", "L", "MG"),
			s("新森原", "Shin-Morihara", "R"),
			s("森原南", "Morihara-Minami", "L", "MZ"),
			s("水道後西", "Suidōgo-Nishi", "R"),
			s("新水道後", "Shin-Suidōgo", "L"),
			s("水道後廣場前", "Suidōgo-Hiroba-mae", "R"),
			s("水道後南", "Suidōgo-Minami", "L"),
			s("水道後北", "Suidōgo-Kita", "R"),
			s("水道後", "Suidōgo", "L"),
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
			s("南森原火車站", "Minami-Morihara Rail Terminal", "R", "SG"),
			s("荒川火車站", "Arakawa Rail Terminal", "L"),
			s("西森原", "Nishi-Morihara", "R", "CS"),
			s("森原北", "Morihara-Kita", "L"),
			s("うかしま東", "Ukashima-Higashi", "R"),
			s("新森原北", "Shin-Morihara-Kita", "L"),
			s("南うかしま", "Minami-Ukashima", "R"),
			s("うかしま", "Ukashima", "L", "UK"),
			s("北うかしま", "Kita-Ukashima", "R"),
			s("新登海", "Shin-Tōkai", "L"),
			s("登海", "Tōkai", "R", "SD"),
			s("内口", "Uchiguchi", "L", "KZ"),
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
			s("中心原南", "Chūshingen-Minami", "L", "CS"),
			s("新水道後北", "Shin-Suidōgo-Kita", "R"),
			s("水道後火車站", "Suidōgo Rail Terminal", "L"),
			s("南聖橋", "Minami-Hijiribashi", "R", "KW"),
			s("新南聖橋", "Shin-Minami-Hijiribashi", "L"),
			s("聖橋東", "Hijiribashi-Higashi", "R", "CS"),
		],
	},
};

// station number label e.g. C05
function num(lineId: LineId, idx: number): string {
	return LINES[lineId].code + String(idx + 1).padStart(2, "0");
}

export { LINES, ROUTES, num };
