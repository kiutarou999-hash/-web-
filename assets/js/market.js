/* アイテム相場ページ */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};
  var L = window.InariLive;

  var RANGES = { "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5 };
  var COLORS = { buy: "#a94e42", sell: "#3f6e8c" }; // グラフの系列色（朱と、区別用の落ち着いた青）

  var state = {
    market: null,
    history: {},
    wg: null,
    q: "",
    cat: "",
    sort: "default",
    current: null,
    range: "24h",
    limit: 100
  };

  /* ---------- データ参照 ---------- */
  function refTime() {
    var t = state.market && state.market.updatedAt ? new Date(state.market.updatedAt) : new Date();
    return isNaN(t) ? new Date() : t;
  }

  function historyOf(itemId) {
    var g = state.history[state.wg] || {};
    return Array.isArray(g[itemId]) ? g[itemId] : [];
  }

  function priceOf(item) {
    return (item.prices || {})[state.wg] || null;
  }

  /**
   * 24時間変動率（%）
   * 1) データに change24h があればそれを使用（ゲーム側の値）
   * 2) なければ価格履歴から計算
   * 3) 履歴が足りなければ null（「—」表示）。架空の値は作りません。
   */
  function change24h(item) {
    var p = priceOf(item);
    if (!p) return null;
    if (U.isNum(p.change24h)) return p.change24h;
    var hist = historyOf(item.id);
    if (!hist.length || !U.isNum(p.buy)) return null;
    var border = +refTime() - RANGES["24h"];
    var base = null;
    hist.forEach(function (h) {
      var t = +new Date(h.t);
      if (t <= border && U.isNum(h.buy)) base = h;
    });
    if (!base || !base.buy) return null;
    return ((p.buy - base.buy) / base.buy) * 100;
  }

  /*
   * タブごとの列名。プレイヤー市場では「購入時の価格（手数料込み）」と「出品者の受取額」、
   * 売却時の出品価格タブでは出品価格だけを表示します。liveApi 未設定時（手動データ）は従来の名前です。
   */
  var LABELS = {
    market: { buy: "購入時の価格", sell: "出品者の受取額" },
    listing: { buy: null, sell: "出品価格" },
    manual: { buy: "購入価格", sell: "売却価格" }
  };
  function labels() {
    return (state.market && state.market.live && LABELS[currentGroup().kind]) || LABELS.manual;
  }

  function itemById(id) {
    return (state.market.items || []).filter(function (i) { return i.id === id; })[0];
  }

  function iconHtml(item) {
    var ini = U.esc(U.initial(item.name));
    if (item.image) {
      return '<span class="item-icon"><img src="' + U.esc(item.image) + '" alt="" loading="lazy" ' +
        'onerror="this.parentNode.textContent=\'' + ini + '\'"></span>';
    }
    return '<span class="item-icon" aria-hidden="true">' + ini + "</span>";
  }

  /* ---------- 描画 ---------- */
  function renderTabs() {
    var tabs = document.getElementById("wg-tabs");
    var groups = state.market.worldGroups || [];
    tabs.innerHTML = groups.map(function (g) {
      return '<button type="button" role="tab" data-wg="' + U.esc(g.id) + '" aria-selected="' + (g.id === state.wg) + '">' + U.esc(g.name) + "</button>";
    }).join("");
    tabs.parentNode.hidden = groups.length < 2;
  }

  function renderCategories() {
    var cats = [];
    (state.market.items || []).forEach(function (i) {
      if (priceOf(i) && i.category && cats.indexOf(i.category) < 0) cats.push(i.category);
    });
    var sel = document.getElementById("cat");
    if (state.cat && cats.indexOf(state.cat) < 0) state.cat = "";
    sel.innerHTML = '<option value="">すべてのカテゴリ</option>' + cats.map(function (c) {
      return '<option value="' + U.esc(c) + '">' + U.esc(c) + "</option>";
    }).join("");
    sel.value = state.cat;
    sel.parentNode.hidden = cats.length === 0;
  }

  /** 並び替えの選択肢をタブの列名に合わせます（列がない項目は隠します）。 */
  function renderSortOptions() {
    var lb = labels();
    var sel = document.getElementById("sort");
    Array.prototype.forEach.call(sel.options, function (o) {
      var key = o.value.split("-")[0], dir = o.value.split("-")[1];
      if (key === "buy" || key === "sell") {
        o.hidden = o.disabled = !lb[key];
        if (lb[key]) o.textContent = lb[key] + (dir === "desc" ? "が高い順" : "が安い順");
      }
    });
    if (sel.selectedOptions[0] && sel.selectedOptions[0].disabled) { sel.value = "default"; state.sort = "default"; }
  }

  function filteredItems() {
    var q = U.normalize(state.q);
    var items = (state.market.items || []).filter(function (i) {
      if (!priceOf(i)) return false;
      if (state.cat && i.category !== state.cat) return false;
      if (q && U.normalize(i.name + " " + i.id + " " + (i.kana || "")).indexOf(q) < 0) return false;
      return true;
    }).map(function (i, idx) {
      var p = priceOf(i);
      return { item: i, idx: idx, buy: p.buy, sell: p.sell, change: change24h(i) };
    });

    var s = state.sort;
    if (s !== "default") {
      var key = s.split("-")[0], dir = s.split("-")[1] === "asc" ? 1 : -1;
      items.sort(function (a, b) {
        if (key === "name") return String(a.item.name).localeCompare(String(b.item.name), "ja");
        var av = a[key], bv = b[key];
        var an = U.isNum(av), bn = U.isNum(bv);
        if (!an && !bn) return a.idx - b.idx;
        if (!an) return 1;
        if (!bn) return -1;
        return (av - bv) * dir || a.idx - b.idx;
      });
    }
    return items;
  }

  function renderList() {
    var box = U.htmlSink(document.getElementById("market-list"));
    var rows = filteredItems();

    if (!rows.length) {
      box.innerHTML = '<div class="empty"><strong>該当するアイテムがありません</strong>検索条件を変えてお試しください。</div>';
      return;
    }
    var total = rows.length;
    rows = rows.slice(0, state.limit);
    var lb = labels();
    box.innerHTML = '<div class="table-wrap"><table class="data-table responsive">' +
      "<thead><tr><th>アイテム</th>" + (lb.buy ? '<th class="num">' + U.esc(lb.buy) + "</th>" : "") +
      '<th class="num">' + U.esc(lb.sell) + '</th><th class="num">変動率(24h)</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var i = r.item;
        return '<tr class="is-link" tabindex="0" data-item="' + U.esc(i.id) + '">' +
          '<td class="cell-main"><div class="item-cell">' + iconHtml(i) +
          '<div><span class="item-name">' + U.esc(i.name) + "</span>" +
          '<span class="item-sub">' + U.esc(i.category || i.id) + "</span></div></div></td>" +
          (lb.buy ? '<td class="num" data-label="' + U.esc(lb.buy) + '">' + U.money(r.buy) + "</td>" : "") +
          '<td class="num" data-label="' + U.esc(lb.sell) + '">' + U.money(r.sell) + "</td>" +
          '<td class="num" data-label="変動率(24h)">' + U.change(r.change) + "</td>" +
          "</tr>";
      }).join("") + "</tbody></table></div>" +
      (total > rows.length
        ? '<p style="text-align:center;margin:16px 0 0"><button type="button" class="btn btn-ghost btn-sm" id="more-items">さらに表示（残り ' + (total - rows.length) + " 品目）</button></p>"
        : "");
  }

  function currentGroup() {
    return (state.market.worldGroups || []).filter(function (g) { return g.id === state.wg; })[0] || {};
  }

  /*
   * 価格の見方（MoroMenuShop の実装に基づく説明）
   *  プレイヤー市場: data-group ごとに、同じアイテムで最も古い出品（購入画面に表示される出品）の現在価格。
   *    出品者の受取額 = MarketDataService.currentUnitSellPrice（出品時の価格に、その市場の出品数・購入数による係数を掛けた額）。
   *    購入時の価格 = 受取額 × market.inventory.sell-price-multiplier（手数料込み）。送料は購入場所で変わるため含まない。
   *  売却時の出品価格: ゲーム内の「売却」（/s）で出品するときの1個あたりの基準価格（prices.yml の売却価格）。
   *    価格表に売却価格がないアイテムは「売却」から出品できない（MenuService.isMenuMarketSellable）。
   *  旧公式ショップの購入はゲーム内から利用できないため、購入価格は表示しない。
   */
  var HELP = {
    market: [
      "購入時の価格：この市場でいちばん安い出品を1個買うときの価格です（手数料込み）。送料は購入する場所によって別にかかります。",
      "出品者の受取額：その出品が売れたときに、出品者が1個あたりに受け取る金額です。",
      "どちらも、この市場の出品数と購入数に応じて変わります。（　）内のワールドで共通の市場です。"
    ],
    listing: [
      "ゲーム内の「売買」→「売却」（/s）でアイテムを出すと、ここに表示している価格を基準に、そのワールドのプレイヤー市場へ出品されます。",
      "実際に売れたときの受取額は、出品先の市場の出品数と購入数に応じて、この価格から上下します。",
      "ここに載っていないアイテムは「売却」から出品できません。価格は運営の設定によって変わることがあります。"
    ]
  };

  function renderMeta() {
    var m = state.market;
    var count = (m.items || []).filter(priceOf).length;
    document.getElementById("market-meta").textContent =
      "最終更新：" + (m.live ? L.time(+new Date(m.updatedAt)) : U.date(m.updatedAt, true)) + "　／　掲載 " + count + " 品目";
    var help = document.getElementById("market-help");
    var lines = m.live ? HELP[currentGroup().kind] : null;
    help.hidden = !lines;
    if (lines) {
      help.innerHTML = '<summary>価格の見方</summary><ul>' + lines.map(function (t) { return "<li>" + U.esc(t) + "</li>"; }).join("") + "</ul>";
    }
  }

  function renderAll() {
    renderTabs();
    renderCategories();
    renderSortOptions();
    renderMeta();
    renderList();
  }

  /* ---------- 詳細ダイアログ ---------- */
  function openItem(id) {
    var item = itemById(id);
    if (!item) return;
    state.current = item;
    var p = priceOf(item) || {};
    document.getElementById("item-dialog-title").textContent = item.name;
    var icon = document.getElementById("dlg-icon");
    icon.outerHTML = iconHtml(item).replace('class="item-icon"', 'class="item-icon" id="dlg-icon"');
    renderDialogStats();
    renderChart();
    var dlg = document.getElementById("item-dialog");
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function renderDialogStats() {
    var item = state.current;
    if (!item) return;
    var p = priceOf(item) || {};
    var wgName = currentGroup().name || "";
    var lb = labels();
    document.getElementById("dlg-stats").innerHTML =
      (lb.buy ? '<div class="stat"><div class="k">' + U.esc(lb.buy) + '</div><div class="v">' + U.money(p.buy) + "</div></div>" : "") +
      '<div class="stat"><div class="k">' + U.esc(lb.sell) + '</div><div class="v">' + U.money(p.sell) + "</div></div>" +
      '<div class="stat"><div class="k">変動率(24h)</div><div class="v">' + U.change(change24h(item)) + "</div></div>" +
      (U.isNum(p.available) ? '<div class="stat"><div class="k">出品数</div><div class="v">' + U.num(p.available) + "<small>個</small></div></div>" : "") +
      '<div class="stat"><div class="k">' + (state.market.live ? "表示中の一覧" : "ワールドグループ") + '</div><div class="v" style="font-size:1rem">' + U.esc(wgName) + "</div></div>";
  }

  function renderChart() {
    var item = state.current;
    if (!item) return;
    var to = refTime();
    var from = new Date(+to - RANGES[state.range]);
    if (state.market.live) {
      renderLiveChart(item, from, to);
      return;
    }
    var hist = historyOf(item.id).filter(function (h) {
      var t = +new Date(h.t);
      return t >= +from && t <= +to;
    });
    drawChart(item, hist, from, to);
  }

  /** 配信サーバーに保存された履歴を取得し、現在値を右端に加えて描きます。 */
  function renderLiveChart(item, from, to) {
    var p = priceOf(item);
    var box = document.getElementById("dlg-chart");
    if (!p || !p.series) { drawChart(item, [], from, to); return; }
    var wanted = item.id + "|" + state.wg + "|" + state.range;
    box.setAttribute("data-wanted", wanted);
    L.history(p.series, state.range).then(function (points) {
      if (box.getAttribute("data-wanted") !== wanted) return;
      var hist = points.map(function (x) {
        return { t: new Date(Math.max(x[0], +from)).toISOString(), buy: p.buyIndex ? x[p.buyIndex] : null, sell: x[p.sellIndex] };
      });
      if (hist.length) hist.push({ t: to.toISOString(), buy: p.buy, sell: p.sell });
      drawChart(item, hist, from, to);
    }).catch(function (e) {
      if (box.getAttribute("data-wanted") === wanted) box.innerHTML = '<div class="chart-empty">' + U.esc(e.message) + "</div>";
    });
  }

  function drawChart(item, hist, from, to) {
    var lb = labels();
    var series = [];
    if (lb.buy) series.push({ label: lb.buy, color: COLORS.buy, points: hist.map(function (h) { return { t: h.t, v: h.buy }; }) });
    series.push({ label: lb.sell, color: COLORS.sell, points: hist.map(function (h) { return { t: h.t, v: h.sell }; }) });
    U.lineChart(document.getElementById("dlg-chart"), {
      series: series,
      from: from,
      to: to,
      ariaLabel: item.name + " の価格推移",
      emptyText: "この期間の価格履歴はまだありません。データが蓄積されると自動でグラフが表示されます。"
    });
  }

  /* ---------- イベント ---------- */
  function bind() {
    document.getElementById("wg-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-wg]");
      if (!b) return;
      state.wg = b.getAttribute("data-wg");
      state.limit = 100;
      try { localStorage.setItem("inari.market.wg", state.wg); } catch (err) { /* 無視 */ }
      renderAll();
    });
    document.getElementById("q").addEventListener("input", U.debounce(function (e) {
      state.q = e.target.value;
      state.limit = 100;
      renderList();
    }, 120));
    document.getElementById("cat").addEventListener("change", function (e) { state.cat = e.target.value; state.limit = 100; renderList(); });
    document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; renderList(); });

    var list = document.getElementById("market-list");
    list.addEventListener("click", function (e) {
      if (e.target.closest("#more-items")) { state.limit += 200; renderList(); return; }
      var tr = e.target.closest("[data-item]");
      if (tr) openItem(tr.getAttribute("data-item"));
    });
    list.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var tr = e.target.closest("[data-item]");
      if (tr) { e.preventDefault(); openItem(tr.getAttribute("data-item")); }
    });

    var dlg = document.getElementById("item-dialog");
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.closest("[data-close]")) dlg.close ? dlg.close() : dlg.removeAttribute("open");
    });
    document.getElementById("range-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-range]");
      if (!b) return;
      state.range = b.getAttribute("data-range");
      this.querySelectorAll("[data-range]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      renderChart();
    });
  }

  function chooseGroup() {
    var groups = state.market.worldGroups || [];
    if (groups.some(function (g) { return g.id === state.wg; })) return;
    var saved = null;
    try { saved = localStorage.getItem("inari.market.wg"); } catch (err) { /* 無視 */ }
    state.wg = groups.some(function (g) { return g.id === saved; }) ? saved : (groups[0] && groups[0].id);
  }

  /** リアルタイム配信：データが更新されるたびに、検索条件や開いている詳細を保ったまま描き直します。 */
  function startLive() {
    L.connect({
      staticPath: CFG.dataPath.market,
      adapt: L.toMarket,
      status: function (html) { document.getElementById("market-notice").innerHTML = html; },
      fail: function (message) {
        if (!state.market) document.getElementById("market-list").innerHTML = U.errorBox(message);
      },
      render: function (data, info) {
        if (!info.live) {
          // 配信に接続できず、実データの静的ファイルに切り替えたとき
          state.market = data;
          state.history = {};
          chooseGroup();
          renderAll();
          return;
        }
        state.market = data;
        chooseGroup();
        renderAll();
        var dlg = document.getElementById("item-dialog");
        if (state.current && dlg.open) {
          state.current = itemById(state.current.id) || state.current;
          renderDialogStats();
          renderChart();
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    if (L && L.enabled()) {
      startLive();
      return;
    }
    Promise.all([
      U.fetchJSON(CFG.dataPath.market),
      U.fetchJSON(CFG.dataPath.marketHistory).catch(function () { return { groups: {} }; })
    ]).then(function (res) {
      state.market = res[0] || {};
      state.history = (res[1] && res[1].groups) || {};
      var groups = state.market.worldGroups || [];
      var saved = null;
      try { saved = localStorage.getItem("inari.market.wg"); } catch (err) { /* 無視 */ }
      state.wg = groups.some(function (g) { return g.id === saved; }) ? saved : (groups[0] && groups[0].id);
      if (state.market.sample) document.getElementById("market-notice").innerHTML = U.sampleNotice("価格情報");
      renderCategories();
      renderAll();
    }).catch(function (e) {
      document.getElementById("market-list").innerHTML = U.errorBox(e.message);
    });
  });
})();
