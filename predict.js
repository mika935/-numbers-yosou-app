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

  function weightedScoreNumber(entries, len, decay = 0.97) {
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

  function weightedRandomNumbers(entries, len, count = 5, decay = 0.97) {
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

  return { topFrequencyNumber, weightedScoreNumber, weightedRandomNumbers };
})();
