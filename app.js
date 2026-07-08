(() => {
  let currentGame = "numbers4";
  const RECENT_N = 30;

  // ---- タブ切り替え ----
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "list") renderList();
      if (btn.dataset.tab === "analysis") renderAnalysis();
      if (btn.dataset.tab === "predict") renderPredict();
    });
  });

  // ---- ゲーム種別切り替え ----
  document.querySelectorAll('input[name="gameType"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      currentGame = e.target.value;
      updateInputFieldsForGame();
      refreshActiveTab();
    });
  });

  // 選択中のゲーム種別に応じて、入力フォーム・CSVヒント文言を切り替える
  function updateInputFieldsForGame() {
    const isLoto6 = currentGame === "loto6";
    document.getElementById("f-number-label").style.display = isLoto6 ? "none" : "";
    document.getElementById("f-number").required = !isLoto6;
    document.getElementById("f-loto-numbers-label").style.display = isLoto6 ? "" : "none";
    document.getElementById("f-loto-bonus-label").style.display = isLoto6 ? "" : "none";
    document.getElementById("f-loto-numbers").required = isLoto6;
    document.getElementById("f-loto-bonus").required = isLoto6;

    if (!isLoto6) {
      const len = Storage.DIGITS[currentGame];
      document.getElementById("f-number").placeholder = "例: " + "1234".slice(0, len);
      document.getElementById("f-number").maxLength = len;
    }

    const csvHint = document.getElementById("csv-hint");
    if (isLoto6) {
      csvHint.innerHTML = `
        1行につき「回号,抽選日(YYYY-MM-DD),本数字6個,ボーナス数字」の形式のCSVを読み込みます。本数字はカンマ・スペースどちらの区切りでも、列を分けてもかまいません。ヘッダー行があっても自動でスキップします。<br>
        例: <code>1234,2026-06-30,1 5 12 23 34 41,7</code>`;
    } else {
      csvHint.innerHTML = `
        1行につき「回号,抽選日(YYYY-MM-DD),当せん番号」の形式のCSVを読み込みます。ヘッダー行があっても自動でスキップします。<br>
        例: <code>6543,2026-06-30,1234</code>`;
    }
  }

  function refreshActiveTab() {
    const activeTab = document.querySelector(".tab-btn.active").dataset.tab;
    if (activeTab === "list") renderList();
    if (activeTab === "analysis") renderAnalysis();
    if (activeTab === "predict") renderPredict();
  }

  // ---- 手動入力フォーム ----
  const form = document.getElementById("manual-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const round = document.getElementById("f-round").value;
    const date = document.getElementById("f-date").value;
    const hint = document.getElementById("input-hint");
    try {
      if (currentGame === "loto6") {
        const numbersArr = document.getElementById("f-loto-numbers").value
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        const bonus = document.getElementById("f-loto-bonus").value;
        Storage.addLoto6Entry(round, date, numbersArr, bonus);
      } else {
        const number = document.getElementById("f-number").value.trim();
        Storage.addEntry(currentGame, round, date, number);
      }
      hint.textContent = `回号${round}を登録しました。`;
      hint.style.color = "#1e6b3a";
      form.reset();
      updateInputFieldsForGame();
      refreshActiveTab();
    } catch (err) {
      hint.textContent = "エラー: " + err.message;
      hint.style.color = "#b23b3b";
    }
  });

  // ---- CSVインポート ----
  // みずほ銀行公式サイトのCSVはShift-JISで書き出されることが多いため、
  // まずUTF-8として厳密デコードを試み、失敗したらShift-JISとして読み直す
  document.getElementById("csv-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const box = document.getElementById("csv-import-result");
    try {
      const buf = await file.arrayBuffer();
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch (err) {
        text = new TextDecoder("shift-jis").decode(buf);
      }
      const result = currentGame === "loto6" ? Storage.importLoto6CSV(text) : Storage.importCSV(currentGame, text);
      let msg = `${result.added}件登録、${result.skipped}件スキップしました。`;
      if (result.errors.length > 0) {
        msg += "\n" + result.errors.slice(0, 5).join("\n");
      }
      box.textContent = msg;
      refreshActiveTab();
    } catch (err) {
      box.textContent = "読み込みに失敗しました: " + err.message;
    } finally {
      e.target.value = "";
    }
  });

  // ---- CSVエクスポート ----
  // ここでダウンロードしたファイルを public-data/numbers3.csv (または numbers4.csv) に
  // 上書きしてgitでpushすると、公開サイトの「みんなが見るデータ」が更新される
  document.getElementById("export-csv-btn").addEventListener("click", () => {
    const csv = currentGame === "loto6" ? Storage.exportLoto6CSV() : Storage.exportCSV(currentGame);
    const blob = new Blob(["﻿" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentGame}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ---- 公開データの取り込み(初回のみ・既存ローカルデータは上書きしない) ----
  // public-data/numbers3.csv, numbers4.csv をサーバー越しに開いている場合に読み込む。
  // file://で直接開いた場合はfetchがブロックされるため、その場合は何もしない
  async function seedFromPublicData(gameType) {
    try {
      const res = await fetch(`public-data/${gameType}.csv`);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch (err) {
        text = new TextDecoder("shift-jis").decode(buf);
      }
      if (gameType === "loto6") {
        Storage.importLoto6CSV(text, false);
      } else {
        Storage.importCSV(gameType, text, false);
      }
    } catch (err) {
      // file://などfetchできない環境では何もしない
    }
  }

  // ---- 一覧表示 ----
  function renderList() {
    const isLoto6 = currentGame === "loto6";
    const entries = isLoto6 ? Storage.getLoto6Entries() : Storage.getEntries(currentGame);
    document.getElementById("list-count").textContent = `(${entries.length}件)`;

    const thead = document.getElementById("data-table-head");
    thead.innerHTML = isLoto6
      ? "<tr><th>回号</th><th>抽選日</th><th>本数字</th><th>ボーナス</th><th></th></tr>"
      : "<tr><th>回号</th><th>抽選日</th><th>当せん番号</th><th></th></tr>";

    const tbody = document.querySelector("#data-table tbody");
    tbody.innerHTML = "";
    for (const e of entries) {
      const tr = document.createElement("tr");
      tr.innerHTML = isLoto6
        ? `
        <td>${e.round}</td>
        <td>${e.date || ""}</td>
        <td>${e.numbers.join(", ")}</td>
        <td>${e.bonus}</td>
        <td><button data-round="${e.round}" class="del-btn">削除</button></td>
      `
        : `
        <td>${e.round}</td>
        <td>${e.date || ""}</td>
        <td>${e.number}</td>
        <td><button data-round="${e.round}" class="del-btn">削除</button></td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll(".del-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (isLoto6) {
          Storage.removeLoto6Entry(btn.dataset.round);
        } else {
          Storage.removeEntry(currentGame, btn.dataset.round);
        }
        renderList();
      });
    });
  }

  // ---- 分析表示 ----
  function renderAnalysis() {
    const isLoto6 = currentGame === "loto6";
    const entries = isLoto6 ? Storage.getLoto6Entries() : Storage.getEntries(currentGame);
    document.getElementById("recent-n-label").textContent = RECENT_N;

    const digitChartsTitle = document.getElementById("digit-charts-title");
    const digitChartsHint = document.getElementById("digit-charts-hint");
    const overallChartTitle = document.getElementById("overall-chart-title");
    const digitCharts = document.getElementById("digit-charts");
    digitCharts.innerHTML = "";

    const pairSectionTitle = document.getElementById("pair-section-title");
    const pairSectionHint = document.getElementById("pair-section-hint");
    const pairList = document.getElementById("pair-list");
    const balanceSectionTitle = document.getElementById("balance-section-title");
    const balanceSectionHint = document.getElementById("balance-section-hint");
    const balanceCharts = document.getElementById("balance-charts");

    if (entries.length === 0) {
      digitCharts.innerHTML = '<p class="empty-note">データがありません。まずは「データ入力」タブから登録してください。</p>';
      document.getElementById("overall-chart").innerHTML = "";
      document.getElementById("hot-list").innerHTML = "";
      document.getElementById("cold-list").innerHTML = "";
      pairList.innerHTML = "";
      pairSectionTitle.style.display = "none";
      pairSectionHint.style.display = "none";
      balanceCharts.innerHTML = "";
      balanceSectionTitle.style.display = "none";
      balanceSectionHint.style.display = "none";
      return;
    }

    if (isLoto6) {
      digitChartsTitle.style.display = "none";
      digitChartsHint.style.display = "none";
      overallChartTitle.textContent = "数字ごとの出現頻度(1〜43)";

      const freq = Analysis.loto6NumberFrequency(entries);
      document.getElementById("overall-chart").innerHTML = "";
      document.getElementById("overall-chart").appendChild(buildBarChart("出現回数", freq, 1, 43));

      const { hot, cold } = Analysis.loto6HotColdAnalysis(entries, RECENT_N);
      const hotList = document.getElementById("hot-list");
      hotList.innerHTML = '<div class="chip-list">' +
        hot.slice(0, 6).map((h) => `<span class="chip hot">${h.number} (${h.count}回)</span>`).join("") +
        "</div>";
      const coldList = document.getElementById("cold-list");
      coldList.innerHTML = '<div class="chip-list">' +
        cold.slice(0, 6).map((c) => `<span class="chip cold">${c.number} (${c.gap}回未出現)</span>`).join("") +
        "</div>";

      pairSectionTitle.style.display = "";
      pairSectionHint.style.display = "";
      const pairs = Analysis.loto6PairFrequency(entries);
      pairList.innerHTML = '<div class="chip-list">' +
        pairs.slice(0, 10).map((p) => `<span class="chip">${p.pair[0]}-${p.pair[1]} (${p.count}回)</span>`).join("") +
        "</div>";

      balanceSectionTitle.style.display = "";
      balanceSectionHint.style.display = "";
      balanceCharts.innerHTML = "";
      const oddEven = Analysis.loto6OddEvenBalance(entries);
      const highLow = Analysis.loto6HighLowBalance(entries);
      balanceCharts.appendChild(buildBarChart("奇数の個数(6個中)", oddEven, 0, 6));
      balanceCharts.appendChild(buildBarChart("高い数字(22〜43)の個数(6個中)", highLow, 0, 6));
      return;
    }

    digitChartsTitle.style.display = "";
    digitChartsHint.style.display = "";
    digitChartsTitle.textContent = "桁ごとの出現頻度";
    overallChartTitle.textContent = "数字全体の出現頻度(桁を区別しない合計)";
    pairSectionTitle.style.display = "none";
    pairSectionHint.style.display = "none";
    pairList.innerHTML = "";
    balanceSectionTitle.style.display = "none";
    balanceSectionHint.style.display = "none";
    balanceCharts.innerHTML = "";

    const len = Storage.DIGITS[currentGame];
    const posFreq = Analysis.digitPositionFrequency(entries, len);
    const posLabels = len === 4 ? ["千の位", "百の位", "十の位", "一の位"] : ["百の位", "十の位", "一の位"];
    posFreq.forEach((freq, i) => {
      digitCharts.appendChild(buildBarChart(posLabels[i], freq, 0, 9));
    });

    const overall = Analysis.overallFrequency(entries);
    document.getElementById("overall-chart").innerHTML = "";
    document.getElementById("overall-chart").appendChild(buildBarChart("全桁合計", overall, 0, 9));

    const { hot, cold } = Analysis.hotColdAnalysis(entries, RECENT_N);
    const hotList = document.getElementById("hot-list");
    hotList.innerHTML = '<div class="chip-list">' +
      hot.slice(0, 5).map((h) => `<span class="chip hot">${h.digit} (${h.count}回)</span>`).join("") +
      "</div>";
    const coldList = document.getElementById("cold-list");
    coldList.innerHTML = '<div class="chip-list">' +
      cold.slice(0, 5).map((c) => `<span class="chip cold">${c.digit} (${c.gap}回未出現)</span>`).join("") +
      "</div>";
  }

  function buildBarChart(title, freqObj, minD = 0, maxD = 9) {
    const wrap = document.createElement("div");
    wrap.className = "digit-chart";
    const max = Math.max(1, ...Object.values(freqObj));
    let html = `<h4>${title}</h4>`;
    for (let d = minD; d <= maxD; d++) {
      const count = freqObj[d] || 0;
      const pct = Math.round((count / max) * 100);
      html += `
        <div class="bar-row">
          <span class="bar-label">${d}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
          <span class="bar-count">${count}</span>
        </div>`;
    }
    wrap.innerHTML = html;
    return wrap;
  }

  // ---- 予測表示 ----
  function renderPredict() {
    const isLoto6 = currentGame === "loto6";
    const entries = isLoto6 ? Storage.getLoto6Entries() : Storage.getEntries(currentGame);
    const boxes = ["predict-top", "predict-weighted", "predict-random"];
    if (entries.length === 0) {
      boxes.forEach((id) => {
        document.getElementById(id).innerHTML = '<p class="empty-note">データがありません。まずは「データ入力」タブから登録してください。</p>';
      });
      return;
    }

    if (isLoto6) {
      document.getElementById("predict-top-title").textContent = "数字別頻度トップ6予想(決定的)";
      document.getElementById("predict-weighted-title").textContent = "直近重み付きスコア トップ6予想(決定的)";
      document.getElementById("predict-random-title").textContent = "重み付きランダム候補(5点、各6個)";

      document.getElementById("predict-top").innerHTML =
        `<span class="predict-number loto">${Predict.topFrequencyNumbersLoto6(entries).join(", ")}</span>`;

      document.getElementById("predict-weighted").innerHTML =
        `<span class="predict-number loto">${Predict.weightedScoreNumbersLoto6(entries).join(", ")}</span>`;

      const sets = Predict.weightedRandomSetsLoto6(entries, 5);
      document.getElementById("predict-random").innerHTML =
        sets.map((s) => `<span class="predict-number loto">${s.join(", ")}</span>`).join("");
      return;
    }

    document.getElementById("predict-top-title").textContent = "桁別頻度トップ予想(決定的)";
    document.getElementById("predict-weighted-title").textContent = "直近重み付きスコア予想(決定的)";
    document.getElementById("predict-random-title").textContent = "重み付きランダム候補(5点)";

    const len = Storage.DIGITS[currentGame];
    document.getElementById("predict-top").innerHTML =
      `<span class="predict-number">${Predict.topFrequencyNumber(entries, len)}</span>`;

    document.getElementById("predict-weighted").innerHTML =
      `<span class="predict-number">${Predict.weightedScoreNumber(entries, len)}</span>`;

    const randoms = Predict.weightedRandomNumbers(entries, len, 5);
    document.getElementById("predict-random").innerHTML =
      randoms.map((n) => `<span class="predict-number">${n}</span>`).join("");
  }

  document.getElementById("regenerate-btn").addEventListener("click", renderPredict);

  // 初期化
  updateInputFieldsForGame();
  Promise.all([seedFromPublicData("numbers3"), seedFromPublicData("numbers4"), seedFromPublicData("loto6")]).then(() => {
    refreshActiveTab();
  });
})();
