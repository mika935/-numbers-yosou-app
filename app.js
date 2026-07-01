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
      const len = Storage.DIGITS[currentGame];
      document.getElementById("f-number").placeholder = "例: " + "1234".slice(0, len);
      document.getElementById("f-number").maxLength = len;
      refreshActiveTab();
    });
  });

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
    const number = document.getElementById("f-number").value.trim();
    const hint = document.getElementById("input-hint");
    try {
      Storage.addEntry(currentGame, round, date, number);
      hint.textContent = `回号${round}を登録しました。`;
      hint.style.color = "#1e6b3a";
      form.reset();
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
      const result = Storage.importCSV(currentGame, text);
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
    const csv = Storage.exportCSV(currentGame);
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
      Storage.importCSV(gameType, text, false);
    } catch (err) {
      // file://などfetchできない環境では何もしない
    }
  }

  // ---- 一覧表示 ----
  function renderList() {
    const entries = Storage.getEntries(currentGame);
    document.getElementById("list-count").textContent = `(${entries.length}件)`;
    const tbody = document.querySelector("#data-table tbody");
    tbody.innerHTML = "";
    for (const e of entries) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.round}</td>
        <td>${e.date || ""}</td>
        <td>${e.number}</td>
        <td><button data-round="${e.round}" class="del-btn">削除</button></td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll(".del-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        Storage.removeEntry(currentGame, btn.dataset.round);
        renderList();
      });
    });
  }

  // ---- 分析表示 ----
  function renderAnalysis() {
    const entries = Storage.getEntries(currentGame);
    const len = Storage.DIGITS[currentGame];
    document.getElementById("recent-n-label").textContent = RECENT_N;

    const digitCharts = document.getElementById("digit-charts");
    digitCharts.innerHTML = "";
    if (entries.length === 0) {
      digitCharts.innerHTML = '<p class="empty-note">データがありません。まずは「データ入力」タブから登録してください。</p>';
      document.getElementById("overall-chart").innerHTML = "";
      document.getElementById("hot-list").innerHTML = "";
      document.getElementById("cold-list").innerHTML = "";
      return;
    }

    const posFreq = Analysis.digitPositionFrequency(entries, len);
    const posLabels = len === 4 ? ["千の位", "百の位", "十の位", "一の位"] : ["百の位", "十の位", "一の位"];
    posFreq.forEach((freq, i) => {
      digitCharts.appendChild(buildBarChart(posLabels[i], freq));
    });

    const overall = Analysis.overallFrequency(entries);
    document.getElementById("overall-chart").innerHTML = "";
    document.getElementById("overall-chart").appendChild(buildBarChart("全桁合計", overall));

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

  function buildBarChart(title, freqObj) {
    const wrap = document.createElement("div");
    wrap.className = "digit-chart";
    const max = Math.max(1, ...Object.values(freqObj));
    let html = `<h4>${title}</h4>`;
    for (let d = 0; d <= 9; d++) {
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
    const entries = Storage.getEntries(currentGame);
    const len = Storage.DIGITS[currentGame];
    const boxes = ["predict-top", "predict-weighted", "predict-random"];
    if (entries.length === 0) {
      boxes.forEach((id) => {
        document.getElementById(id).innerHTML = '<p class="empty-note">データがありません。まずは「データ入力」タブから登録してください。</p>';
      });
      return;
    }

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
  document.getElementById("f-number").maxLength = Storage.DIGITS[currentGame];
  Promise.all([seedFromPublicData("numbers3"), seedFromPublicData("numbers4")]).then(() => {
    refreshActiveTab();
  });
})();
