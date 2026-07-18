/* 水下地鐵 — Shuika Metro network data (fictional, from the map reference) */
  import type { LineId, Lines, Routes, Station } from "@/types/metro";

  // line meta: id, code letter used in station numbers, names, brand color, ink-on-color legibility
  const LINES: Lines = {
    CS: { id: 'CS', code: 'C', ja: '中心原線', en: 'Chūshingen Line', color: '#12318f', textOnColor: '#fff' },
    MZ: { id: 'MZ', code: 'M', ja: '水野線',   en: 'Mizuno Line',     color: '#22a355', textOnColor: '#fff' },
    KW: { id: 'KW', code: 'K', ja: '北野川灣線', en: 'Kitanogawa Bay Line', color: '#e4632a', textOnColor: '#fff' },
    UK: { id: 'UK', code: 'U', ja: 'うかしま線', en: 'Ukashima Line',  color: '#e0359a', textOnColor: '#fff' },
    SD: { id: 'SD', code: 'S', ja: '水道上線',  en: 'Suidōue Line',    color: '#f2b400', textOnColor: '#111' },
    AR: { id: 'AR', code: 'A', ja: '荒川線',    en: 'Arakawa Line',    color: '#7d3fb0', textOnColor: '#fff' },
  };

  // Station readings are stored separately so every route that shares a station
  // consistently exposes both phonetic Japanese scripts.
  const STATION_READINGS: Record<string, { hira: string; kata: string }> = {
    '荒川': { hira: 'あらかわ', kata: 'アラカワ' },
    '西森原': { hira: 'にしもりはら', kata: 'ニシモリハラ' },
    '森原': { hira: 'もりはら', kata: 'モリハラ' },
    '森原南': { hira: 'もりはらみなみ', kata: 'モリハラミナミ' },
    '中心原': { hira: 'ちゅうしんげん', kata: 'チュウシンゲン' },
    '中心原南': { hira: 'ちゅうしんげんみなみ', kata: 'チュウシンゲンミナミ' },
    '中心原北': { hira: 'ちゅうしんげんきた', kata: 'チュウシンゲンキタ' },
    '聖橋': { hira: 'ひじりばし', kata: 'ヒジリバシ' },
    '聖橋西': { hira: 'ひじりばしにし', kata: 'ヒジリバシニシ' },
    '中聖橋': { hira: 'なかひじりばし', kata: 'ナカヒジリバシ' },
    '新南聖橋': { hira: 'しんみなみひじりばし', kata: 'シンミナミヒジリバシ' },
    '聖橋東': { hira: 'ひじりばしひがし', kata: 'ヒジリバシヒガシ' },
    '聖橋北': { hira: 'ひじりばしきた', kata: 'ヒジリバシキタ' },
    '水道上': { hira: 'すいどううえ', kata: 'スイドウウエ' },
    '水道上南': { hira: 'すいどううえみなみ', kata: 'スイドウウエミナミ' },
    '新水道上': { hira: 'しんすいどううえ', kata: 'シンスイドウウエ' },
    '北野川坂': { hira: 'きたのがわざか', kata: 'キタノガワザカ' },
    '新北野川': { hira: 'しんきたのがわ', kata: 'シンキタノガワ' },
    '北野川灣港前': { hira: 'きたのがわわんこうまえ', kata: 'キタノガワワンコウマエ' },
    '北野川灣': { hira: 'きたのがわわん', kata: 'キタノガワワン' },
    '北野川灣東': { hira: 'きたのがわわんひがし', kata: 'キタノガワワンヒガシ' },
    '西うかしま': { hira: 'にしうかしま', kata: 'ニシウカシマ' },
    'うかしま': { hira: 'うかしま', kata: 'ウカシマ' },
    '中うかしま': { hira: 'なかうかしま', kata: 'ナカウカシマ' },
    '南うかしま': { hira: 'みなみうかしま', kata: 'ミナミウカシマ' },
    '醫學大學前': { hira: 'いがくだいがくまえ', kata: 'イガクダイガクマエ' },
    '登海北': { hira: 'とうかいきた', kata: 'トウカイキタ' },
    '登海': { hira: 'とうかい', kata: 'トウカイ' },
    '登海東': { hira: 'とうかいひがし', kata: 'トウカイヒガシ' },
    '荒川公園前': { hira: 'あらかわこうえんまえ', kata: 'アラカワコウエンマエ' },
    '荒川北': { hira: 'あらかわきた', kata: 'アラカワキタ' },
  };

  // helper: s(ja, en, side, ...transferLineIds)  side: 'L' | 'R'
  const s = (ja: string, en: string, side: Station["side"], ...xf: LineId[]): Station => ({
    ja,
    en,
    side,
    xf,
    hira: STATION_READINGS[ja]?.hira || '',
    kata: STATION_READINGS[ja]?.kata || '',
  });

  // Each line: ordered stations. terminusJa/En used for destination.
  const ROUTES: Routes = {
    CS: {
      line: 'CS',
      destJa: '聖橋東', destEn: 'Hijiribashi-Higashi',
      towardJa: '聖橋・聖橋東', towardEn: 'for Hijiribashi',
      stations: [
        s('荒川',       'Arakawa',              'R', 'AR', 'MZ'),
        s('西森原',     'Nishi-Morihara',       'L'),
        s('森原',       'Morihara',             'R', 'MZ'),
        s('中心原南',   'Chūshingen-Minami',    'L'),
        s('中心原',     'Chūshingen',           'R', 'MZ', 'UK', 'SD'),
        s('聖橋西',     'Hijiribashi-Nishi',    'L'),
        s('聖橋',       'Hijiribashi',          'R', 'KW', 'AR'),
        s('中聖橋',     'Naka-Hijiribashi',     'L'),
        s('新南聖橋',   'Shin-Minami-Hijiribashi','R'),
        s('聖橋東',     'Hijiribashi-Higashi',  'L', 'KW'),
      ],
    },
    MZ: {
      line: 'MZ',
      destJa: '聖橋北', destEn: 'Hijiribashi-Kita',
      towardJa: '水道上・聖橋北', towardEn: 'for Hijiribashi-Kita',
      stations: [
        s('森原南',     'Morihara-Minami',      'L'),
        s('森原',       'Morihara',             'R', 'CS'),
        s('中心原',     'Chūshingen',           'L', 'CS', 'UK', 'SD'),
        s('中心原北',   'Chūshingen-Kita',      'R'),
        s('水道上南',   'Suidōue-Minami',       'L'),
        s('水道上',     'Suidōue',              'R', 'SD'),
        s('北野川坂',   'Kitanogawa-zaka',      'L', 'KW'),
        s('聖橋北',     'Hijiribashi-Kita',     'R', 'KW'),
      ],
    },
    KW: {
      line: 'KW',
      destJa: '新北野川', destEn: 'Shin-Kitanogawa',
      towardJa: '北野川灣・新北野川', towardEn: 'for Shin-Kitanogawa',
      stations: [
        s('聖橋',       'Hijiribashi',          'R', 'CS', 'AR'),
        s('聖橋北',     'Hijiribashi-Kita',     'L', 'MZ'),
        s('北野川坂',   'Kitanogawa-zaka',      'R', 'MZ'),
        s('北野川灣港前','Kitanogawa-Bay-Port', 'L'),
        s('北野川灣',   'Kitanogawa-Bay',       'R'),
        s('北野川灣東', 'Kitanogawa-Bay-Higashi','L'),
        s('新北野川',   'Shin-Kitanogawa',      'R'),
      ],
    },
    UK: {
      line: 'UK',
      destJa: '中心原', destEn: 'Chūshingen',
      towardJa: 'うかしま・中心原', towardEn: 'for Chūshingen',
      stations: [
        s('西うかしま', 'Nishi-Ukashima',       'L'),
        s('うかしま',   'Ukashima',             'R', 'AR'),
        s('中うかしま', 'Naka-Ukashima',        'L'),
        s('醫學大學前', 'Igakudaigaku-mae',     'R'),
        s('新水道上',   'Shin-Suidōue',         'L', 'SD'),
        s('中心原',     'Chūshingen',           'R', 'CS', 'MZ', 'SD'),
      ],
    },
    SD: {
      line: 'SD',
      destJa: '中心原', destEn: 'Chūshingen',
      towardJa: '水道上・中心原', towardEn: 'for Chūshingen',
      stations: [
        s('登海北',     'Tōkai-Kita',           'L'),
        s('登海',       'Tōkai',                'R'),
        s('登海東',     'Tōkai-Higashi',        'L'),
        s('新水道上',   'Shin-Suidōue',         'R', 'UK'),
        s('水道上',     'Suidōue',              'L', 'MZ'),
        s('中心原',     'Chūshingen',           'R', 'CS', 'MZ', 'UK'),
      ],
    },
    AR: {
      line: 'AR',
      destJa: '聖橋', destEn: 'Hijiribashi',
      towardJa: '荒川・聖橋', towardEn: 'for Hijiribashi',
      stations: [
        s('荒川公園前', 'Arakawa-Kōen-mae',     'L'),
        s('荒川北',     'Arakawa-Kita',         'R'),
        s('荒川',       'Arakawa',              'L', 'CS', 'MZ'),
        s('南うかしま', 'Minami-Ukashima',      'R'),
        s('うかしま',   'Ukashima',             'L', 'UK'),
        s('聖橋',       'Hijiribashi',          'R', 'CS', 'KW'),
      ],
    },
  };

  // station number label e.g. C05
  function num(lineId: LineId, idx: number): string {
    return LINES[lineId].code + String(idx + 1).padStart(2, '0');
  }

  export { LINES, ROUTES, num };
