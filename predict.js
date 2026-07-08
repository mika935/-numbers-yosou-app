// 過去データの統計を元にした予測ロジック(当選を保証するものではありません)
const Predict = (() => {
  function topFrequencyNumber(entries, len) {
    const freq = Analysis.digitPositionFrequency(entries, len);
    let result = "";
    for (let pos = 0; pos < len; pos++) {
      const best = Object.entries(freq[pos]).sort((a, b) => b[1] - a[1])[0];
      result += best[0];
    }
    return result;
  }

  function weightedScoreNumber(entries, len, decay = 0.99) {
    const scores = Analysis.recencyWeightedPositionScore(entries, len, decay);
    let result = "";
    for (let pos = 0; pos < len; pos++) {
      const best = Object.entries(scores[pos]).sort((a, b) => b[1] - a[1])[0];
      result += best[0];
    }
    return result;
  }

  function weightedRandomDigit(scoreMap) {
    const entries = Object.entries(scoreMap);
    const total = entries.reduce((sum, [, s]) => sum + s, 0);
    if (total <= 0) {
      return String(Math.floor(Math.random() * 10));
    }
    let r = Math.random() * total;
    for (const [digit, s] of entries) {
      r -= s;
      if (r <= 0) return digit;
    }
    return entries[entries.length - 1][0];
  }

  function weightedRandomNumbers(entries, len, count = 5, decay = 0.99) {
    const scores = Analysis.recencyWeightedPositionScore(entries, len, decay);
    const results = new Set();
    let attempts = 0;
    while (results.size < count && attempts < count * 20) {
      let candidate = "";
      for (let pos = 0; pos < len; pos++) {
        candidate += weightedRandomDigit(scores[pos]);
      }
      results.add(candidate);
      attempts++;
    }
    return Array.from(results);
  }

  // ---- ロト6専用 ----
  // 1〜43から6個選ぶ形式なので、桁ごとではなく「スコア上位6個」「重み付き無作為抽出(重複なし)6個」で予想する
  function topFrequencyNumbersLoto6(entries, pickCount = 6) {
    const freq = Analysis.loto6NumberFrequency(entries);
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, pickCount)
      .map(([n]) => Number(n))
      .sort((a, b) => a - b);
  }

  function weightedScoreNumbersLoto6(entries, pickCount = 6, decay = 0.99) {
    const scores = Analysis.loto6RecencyWeightedScore(entries, decay);
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, pickCount)
      .map(([n]) => Number(n))
      .sort((a, b) => a - b);
  }

  // scoreMapから重複なしでpickCount個を重み付き無作為抽出する(1セット分)
  function weightedRandomSetLoto6(scoreMap, pickCount = 6) {
    const pool = Object.entries(scoreMap).map(([n, s]) => [Number(n), s]);
    const picked = [];
    for (let i = 0; i < pickCount && pool.length > 0; i++) {
      const total = pool.reduce((sum, [, s]) => sum + s, 0);
      let idx;
      if (total <= 0) {
        idx = Math.floor(Math.random() * pool.length);
      } else {
        let r = Math.random() * total;
        idx = pool.length - 1;
        for (let j = 0; j < pool.length; j++) {
          r -= pool[j][1];
          if (r <= 0) { idx = j; break; }
        }
      }
      picked.push(pool[idx][0]);
      pool.splice(idx, 1);
    }
    return picked.sort((a, b) => a - b);
  }

  function weightedRandomSetsLoto6(entries, setCount = 5, pickCount = 6, decay = 0.99) {
    const scores = Analysis.loto6RecencyWeightedScore(entries, decay);
    const results = [];
    for (let i = 0; i < setCount; i++) {
      results.push(weightedRandomSetLoto6(scores, pickCount));
    }
    return results;
  }

  return {
    topFrequencyNumber, weightedScoreNumber, weightedRandomNumbers,
    topFrequencyNumbersLoto6, weightedScoreNumbersLoto6, weightedRandomSetsLoto6,
  };
})();
