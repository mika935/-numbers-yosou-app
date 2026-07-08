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

  // ---- ロト6専用 ----
  // ロト6は桁の概念がなく「1〜43のどの数字が出たか」がすべてなので、
  // ナンバーズの桁ごと分析とは別に、1〜43の出現頻度をまとめて分析する
  const LOTO6_MAX = 43;

  function loto6NumberFrequency(entries) {
    const o = {};
    for (let n = 1; n <= LOTO6_MAX; n++) o[n] = 0;
    for (const e of entries) {
      for (const n of e.numbers) o[n]++;
    }
    return o;
  }

  function loto6RecencyWeightedScore(entries, decay = 0.99) {
    const o = {};
    for (let n = 1; n <= LOTO6_MAX; n++) o[n] = 0;
    entries.forEach((e, rank) => {
      const weight = Math.pow(decay, rank);
      for (const n of e.numbers) o[n] += weight;
    });
    return o;
  }

  function loto6HotColdAnalysis(entries, recentN) {
    const recent = entries.slice(0, recentN);
    const hotCount = {};
    for (let n = 1; n <= LOTO6_MAX; n++) hotCount[n] = 0;
    for (const e of recent) {
      for (const n of e.numbers) hotCount[n]++;
    }
    const hot = Object.entries(hotCount)
      .map(([number, count]) => ({ number: Number(number), count }))
      .sort((a, b) => b.count - a.count);

    const lastSeenGap = {};
    for (let n = 1; n <= LOTO6_MAX; n++) {
      const foundRank = entries.findIndex((e) => e.numbers.includes(n));
      lastSeenGap[n] = foundRank === -1 ? entries.length : foundRank;
    }
    const cold = Object.entries(lastSeenGap)
      .map(([number, gap]) => ({ number: Number(number), gap }))
      .sort((a, b) => b.gap - a.gap);

    return { hot, cold };
  }

  // 同じ抽選回に一緒に出現した数字のペア(組み合わせ)の頻度を集計する
  function loto6PairFrequency(entries) {
    const pairCount = {};
    for (const e of entries) {
      const nums = e.numbers.slice().sort((a, b) => a - b);
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const key = `${nums[i]}-${nums[j]}`;
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    }
    return Object.entries(pairCount)
      .map(([key, count]) => {
        const [a, b] = key.split("-").map(Number);
        return { pair: [a, b], count };
      })
      .sort((a, b) => b.count - a.count);
  }

  // 本数字6個のうち奇数がいくつ含まれるかの分布(0〜6個)を集計する
  function loto6OddEvenBalance(entries) {
    const o = {};
    for (let i = 0; i <= 6; i++) o[i] = 0;
    for (const e of entries) {
      const oddCount = e.numbers.filter((n) => n % 2 !== 0).length;
      o[oddCount]++;
    }
    return o;
  }

  // 本数字6個のうち高い数字(22〜43)がいくつ含まれるかの分布(0〜6個)を集計する
  function loto6HighLowBalance(entries, threshold = 22) {
    const o = {};
    for (let i = 0; i <= 6; i++) o[i] = 0;
    for (const e of entries) {
      const highCount = e.numbers.filter((n) => n >= threshold).length;
      o[highCount]++;
    }
    return o;
  }

  return {
    digitPositionFrequency, overallFrequency, recencyWeightedPositionScore, hotColdAnalysis,
    loto6NumberFrequency, loto6RecencyWeightedScore, loto6HotColdAnalysis, loto6PairFrequency,
    loto6OddEvenBalance, loto6HighLowBalance,
  };
})();
