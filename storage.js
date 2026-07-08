// localStorageを使った当せん番号データの保存・読み込み
const Storage = (() => {
  const KEY = "numbers_yosou_data_v1";
  const DIGITS = { numbers3: 3, numbers4: 4 };
  const LOTO6_MAIN_COUNT = 6;
  const LOTO6_MAX = 43;

  function loadAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { numbers3: [], numbers4: [], loto6: [] };
      const parsed = JSON.parse(raw);
      return {
        numbers3: Array.isArray(parsed.numbers3) ? parsed.numbers3 : [],
        numbers4: Array.isArray(parsed.numbers4) ? parsed.numbers4 : [],
        loto6: Array.isArray(parsed.loto6) ? parsed.loto6 : [],
      };
    } catch (e) {
      console.error("データ読み込みに失敗しました", e);
      return { numbers3: [], numbers4: [], loto6: [] };
    }
  }

  function saveAll(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function validateNumber(gameType, numberStr) {
    const len = DIGITS[gameType];
    if (!/^\d+$/.test(numberStr)) return null;
    if (numberStr.length !== len) return null;
    return numberStr;
  }

  function getEntries(gameType) {
    const data = loadAll();
    return (data[gameType] || []).slice().sort((a, b) => b.round - a.round);
  }

  // 既存の同じ回号があれば上書きする(overwrite=falseなら既存分はそのまま残す)
  function addEntry(gameType, round, date, numberStr, overwrite = true) {
    const number = validateNumber(gameType, numberStr);
    if (!number) throw new Error(`当せん番号は${DIGITS[gameType]}桁の数字で入力してください`);
    if (!round || isNaN(round)) throw new Error("回号を正しく入力してください");

    const data = loadAll();
    const list = data[gameType] || [];
    const idx = list.findIndex((e) => e.round === Number(round));
    if (idx >= 0 && !overwrite) return null;
    const entry = { round: Number(round), date: date || "", number };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    data[gameType] = list;
    saveAll(data);
    return entry;
  }

  function removeEntry(gameType, round) {
    const data = loadAll();
    data[gameType] = (data[gameType] || []).filter((e) => e.round !== Number(round));
    saveAll(data);
  }

  // ---- ロト6専用 ----
  // ロト6は「1〜43から6個(順不同・重複なし)+ボーナス数字1個」という形式のため、
  // ナンバーズの桁文字列とは別のデータ構造(numbers配列 + bonus)で保持する
  function validateLoto6(numbersArr, bonus) {
    if (!Array.isArray(numbersArr) || numbersArr.length !== LOTO6_MAIN_COUNT) return null;
    const nums = numbersArr.map((n) => Number(n));
    if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > LOTO6_MAX)) return null;
    if (new Set(nums).size !== LOTO6_MAIN_COUNT) return null; // 重複不可
    const b = Number(bonus);
    if (!Number.isInteger(b) || b < 1 || b > LOTO6_MAX) return null;
    return { numbers: nums.slice().sort((a, c) => a - c), bonus: b };
  }

  function getLoto6Entries() {
    const data = loadAll();
    return (data.loto6 || []).slice().sort((a, b) => b.round - a.round);
  }

  function addLoto6Entry(round, date, numbersArr, bonus, overwrite = true) {
    const validated = validateLoto6(numbersArr, bonus);
    if (!validated) throw new Error(`本数字は1〜${LOTO6_MAX}の重複しない${LOTO6_MAIN_COUNT}個の数字、ボーナス数字は1〜${LOTO6_MAX}の数字で入力してください`);
    if (!round || isNaN(round)) throw new Error("回号を正しく入力してください");

    const data = loadAll();
    const list = data.loto6 || [];
    const idx = list.findIndex((e) => e.round === Number(round));
    if (idx >= 0 && !overwrite) return null;
    const entry = { round: Number(round), date: date || "", numbers: validated.numbers, bonus: validated.bonus };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    data.loto6 = list;
    saveAll(data);
    return entry;
  }

  function removeLoto6Entry(round) {
    const data = loadAll();
    data.loto6 = (data.loto6 || []).filter((e) => e.round !== Number(round));
    saveAll(data);
  }

  // CSVから数字トークン(1〜2桁の数)を全て取り出す(カンマ・スペース・引用符区切りいずれにも対応)
  function extractNumberTokens(text) {
    const matches = text.match(/\d+/g);
    return matches ? matches.map((m) => Number(m)) : [];
  }

  // ロト6用CSVインポート。「回号,抽選日,本数字...(複数列 or 1列にまとめてもOK),ボーナス数字」形式に対応。
  // 本数字とボーナス数字の列が分かれていても、1つの列にスペース/カンマ区切りでまとまっていてもよい。
  function importLoto6CSV(text, overwrite = true) {
    const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter((l) => l.length > 0);
    let added = 0;
    let skipped = 0;
    const errors = [];

    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 3) { skipped++; continue; }

      const roundMatch = cols[0].match(/\d+/);
      if (!roundMatch) { skipped++; continue; } // ヘッダー行などをスキップ
      const round = roundMatch[0];
      const date = normalizeDate(cols[1]);

      // 3列目以降から数字を全て抽出し、先頭6個を本数字、最後の1個をボーナス数字とみなす
      const rest = cols.slice(2).join(" ");
      const tokens = extractNumberTokens(rest);
      if (tokens.length < LOTO6_MAIN_COUNT + 1) {
        errors.push(`回号${round}: 本数字${LOTO6_MAIN_COUNT}個+ボーナス数字が見つかりませんでした`);
        skipped++;
        continue;
      }
      const numbersArr = tokens.slice(0, LOTO6_MAIN_COUNT);
      const bonus = tokens[LOTO6_MAIN_COUNT];

      try {
        const result = addLoto6Entry(round, date, numbersArr, bonus, overwrite);
        if (result === null) { skipped++; } else { added++; }
      } catch (e) {
        errors.push(`回号${round}: ${e.message}`);
        skipped++;
      }
    }
    return { added, skipped, errors };
  }

  function exportLoto6CSV() {
    const entries = getLoto6Entries();
    const header = "回号,抽選日,本数字1,本数字2,本数字3,本数字4,本数字5,本数字6,ボーナス数字";
    const rows = entries.map((e) => `${e.round},${e.date},${e.numbers.join(",")},${e.bonus}`);
    return [header, ...rows].join("\n");
  }

  // 1行のCSVを、ダブルクォート内のカンマを区切りと見なさないように分割する
  function parseCSVLine(line) {
    const cols = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  }

  // "2026/6/30" のような表記を "2026-06-30" に正規化する。変換できない場合はそのまま返す
  function normalizeDate(dateRaw) {
    const m = dateRaw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return dateRaw;
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // CSVテキストをパースして一括登録する。
  // 「回号,日付,当せん番号」の単純な形式にも、
  // みずほ銀行公式の「回号,抽せん日,曜日,当せん番号,...(賞金情報)」形式にも対応する。
  function importCSV(gameType, text, overwrite = true) {
    const len = DIGITS[gameType];
    const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter((l) => l.length > 0);
    let added = 0;
    let skipped = 0;
    const errors = [];

    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 3) { skipped++; continue; }

      const roundMatch = cols[0].match(/\d+/);
      if (!roundMatch) { skipped++; continue; } // ヘッダー行などをスキップ
      const round = roundMatch[0];
      const date = normalizeDate(cols[1]);

      // 当せん番号の列は、曜日列があれば4列目、なければ3列目。
      // エクスポート時に先頭の0が落ちている場合があるため、桁数以下の数字ならゼロ埋めする
      const raw = /曜/.test(cols[2] || "") ? cols[3] : cols[2];
      const numberCol = raw && /^\d+$/.test(raw) && raw.length <= len ? raw.padStart(len, "0") : null;
      if (!numberCol) {
        errors.push(`回号${round}: ${len}桁の当せん番号が見つかりませんでした`);
        skipped++;
        continue;
      }

      try {
        const result = addEntry(gameType, round, date, numberCol, overwrite);
        if (result === null) { skipped++; } else { added++; }
      } catch (e) {
        errors.push(`回号${round}: ${e.message}`);
        skipped++;
      }
    }
    return { added, skipped, errors };
  }

  function exportCSV(gameType) {
    const entries = getEntries(gameType);
    const header = "回号,抽選日,当せん番号";
    const rows = entries.map((e) => `${e.round},${e.date},${e.number}`);
    return [header, ...rows].join("\n");
  }

  return {
    getEntries, addEntry, removeEntry, importCSV, exportCSV, DIGITS,
    getLoto6Entries, addLoto6Entry, removeLoto6Entry, importLoto6CSV, exportLoto6CSV,
    LOTO6_MAIN_COUNT, LOTO6_MAX,
  };
})();
