// 過去データの頻度分析ロジック
const Analysis = (() => {
  // 桁ごと(位置ごと)の0-9出現回数。 戻り値: [{0:n,1:n,...9:n}, ...] (配列長 = 桁数)
  function digitPositionFrequency(entries, len) {
    const result = Array.from({ length: len }, () => {
      const o = {};
      for (let d = 0; d <= 9; d++) o[d] = 0;
      return o;
    });
    for (const e of entries) {
      for (let pos = 0; pos < len; pos++) {
        const d = Number(e.number[pos]);
        result[pos][d]++;
      }
    }
    return result;
  }

  // 桁を区別しない0-9の出現回数合計
  function overallFrequency(entries) {
    const o = {};
    for (let d = 0; d <= 9; d++) o[d] = 0;
    for (const e of entries) {
      for (const ch of e.number) {
        o[Number(ch)]++;
      }
    }
    return o;
  }

  // 直近を重視した桁ごとのスコア (entriesは回号降順=直近が先頭という前提)
  // weight = decay^rank (rank 0 が最新)
  function recencyWeightedPositionScore(entries, len, decay = 0.99) {
    const result = Array.from({ length: len }, () => {
      const o = {};
      for (let d = 0; d <= 9; d++) o[d] = 0;
      return o;
    });
    entries.forEach((e, rank) => {
      const weight = Math.pow(decay, rank);
      for (let pos = 0; pos < len; pos++) {
        const d = Number(e.number[pos]);
        result[pos][d] += weight;
      }
    });
    return result;
  }

  // 直近N回でのホットナンバー(桁を区別せず出現数が多い数字)と
  // 全履歴での最終出現からの経過回数が長いコールドナンバーを算出
  function hotColdAnalysis(entries, recentN) {
    const recent = entries.slice(0, recentN);
    const hotCount = {};
    for (let d = 0; d <= 9; d++) hotCount[d] = 0;
    for (const e of recent) {
      for (const ch of e.number) hotCount[Number(ch)]++;
    }
    const hot = Object.entries(hotCount)
      .map(([digit, count]) => ({ digit: Number(digit), count }))
      .sort((a, b) => b.count - a.count);

    // 各数字について、最新(rank=0)から見て最初に出現するrankを経過回数とする
    const lastSeenGap = {};
    for (let d = 0; d <= 9; d++) {
      const foundRank = entries.findIndex((e) => e.number.includes(String(d)));
      lastSeenGap[d] = foundRank === -1 ? entries.length : foundRank;
    }
    const cold = Object.entries(lastSeenGap)
      .map(([digit, gap]) => ({ digit: Number(digit), gap }))
      .sort((a, b) => b.gap - a.gap);

    return { hot, cold };
  }

  return { digitPositionFrequency, overallFrequency, recencyWeightedPositionScore, hotColdAnalysis };
})();
