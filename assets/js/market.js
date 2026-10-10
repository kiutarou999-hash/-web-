/* 市場相場ページ */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};

  var RANGES = { "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5 };
  var COLORS = { buy: "#1e4d36", sell: "#b8862b" };

  var state = {
    market: null,
    history: {},
    wg: null,
    q: "",
    cat: "",
    sort: "default",
    current: null,
    range: "24h"
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

  function activeDemands() {
    var now = Date.now();
    return (state.market.specialDemands || []).filter(function (d) {
      if (d.worldGroup && d.worldGroup !== state.wg) return false;
      if (d.start && +new Date(d.start) > now) return false;
      if (d.end && +new Date(d.end) < now) return false;
      return true;
    });
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
      if (i.category && cats.indexOf(i.category) < 0) cats.push(i.category);
    });
    var sel = document.getElementById("cat");
    sel.innerHTML = '<option value="">すべてのカテゴリ</option>' + cats.map(function (c) {
      return '<option value="' + U.esc(c) + '">' + U.esc(c) + "</option>";
    }).join("");
    sel.parentNode.hidden = cats.length === 0;
  }

  function renderDemands() {
    var list = activeDemands();
    var sec = document.getElementById("demand-section");
    sec.hidden = list.length === 0;
    document.getElementById("demands").innerHTML = list.map(function (d) {
      var item = itemById(d.itemId) || { name: d.itemName || d.itemId };
      var period = (d.start ? U.date(d.start, true) : "") + " 〜 " + (d.end ? U.date(d.end, true) : "未定");
      return '<article class="card demand-card">' +
        '<div class="item-cell">' + iconHtml(item) +
        '<div style="flex:1"><span class="item-name">' + U.esc(item.name) + "</span>" +
        '<span class="item-sub">' + U.esc(period) + "</span></div>" +
        (U.isNum(d.multiplier) ? '<span class="mult">×' + U.num(d.multiplier) + "</span>" : "") +
        "</div>" +
        (d.note ? "<p>" + U.esc(d.note) + "</p>" : "") +
        "</article>";
    }).join("");
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
    var box = document.getElementById("market-list");
    var rows = filteredItems();
    var demandIds = {};
    activeDemands().forEach(function (d) { demandIds[d.itemId] = d; });

    if (!rows.length) {
      box.innerHTML = '<div class="empty"><strong>該当するアイテムがありません</strong>検索条件を変えてお試しください。</div>';
      return;
    }
    box.innerHTML = '<div class="table-wrap"><table class="data-table responsive">' +
      "<thead><tr><th>アイテム</th><th class=\"num\">購入価格</th><th class=\"num\">売却価格</th><th class=\"num\">変動率(24h)</th></tr></thead><tbody>" +
      rows.map(function (r) {
        var i = r.item, d = demandIds[i.id];
        return '<tr class="is-link" tabindex="0" data-item="' + U.esc(i.id) + '">' +
          '<td class="cell-main"><div class="item-cell">' + iconHtml(i) +
          '<div><span class="item-name">' + U.esc(i.name) + "</span>" +
          (d ? ' <span class="badge badge-gold">特需' + (U.isNum(d.multiplier) ? " ×" + U.num(d.multiplier) : "") + "</span>" : "") +
          '<span class="item-sub">' + U.esc(i.category || i.id) + "</span></div></div></td>" +
          '<td class="num" data-label="購入価格">' + U.money(r.buy) + "</td>" +
          '<td class="num" data-label="売却価格">' + U.money(r.sell) + "</td>" +
          '<td class="num" data-label="変動率(24h)">' + U.change(r.change) + "</td>" +
          "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function renderMeta() {
    var m = state.market;
    var count = (m.items || []).filter(priceOf).length;
    document.getElementById("market-meta").textContent =
      "最終更新：" + U.date(m.updatedAt, true) + "　／　掲載 " + count + " 品目　／　購入価格＝ショップで買う値段、売却価格＝ショップに売る値段";
  }

  function renderAll() {
    renderTabs();
    renderDemands();
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
    var wgName = ((state.market.worldGroups || []).filter(function (g) { return g.id === state.wg; })[0] || {}).name || "";
    document.getElementById("dlg-stats").innerHTML =
      '<div class="stat"><div class="k">購入価格</div><div class="v">' + U.money(p.buy) + "</div></div>" +
      '<div class="stat"><div class="k">売却価格</div><div class="v">' + U.money(p.sell) + "</div></div>" +
      '<div class="stat"><div class="k">変動率(24h)</div><div class="v">' + U.change(change24h(item)) + "</div></div>" +
      '<div class="stat"><div class="k">ワールドグループ</div><div class="v" style="font-size:1rem">' + U.esc(wgName) + "</div></div>";
    renderChart();
    var dlg = document.getElementById("item-dialog");
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function renderChart() {
    var item = state.current;
    if (!item) return;
    var to = refTime();
    var from = new Date(+to - RANGES[state.range]);
    var hist = historyOf(item.id).filter(function (h) {
      var t = +new Date(h.t);
      return t >= +from && t <= +to;
    });
    U.lineChart(document.getElementById("dlg-chart"), {
      series: [
        { label: "購入価格", color: COLORS.buy, points: hist.map(function (h) { return { t: h.t, v: h.buy }; }) },
        { label: "売却価格", color: COLORS.sell, points: hist.map(function (h) { return { t: h.t, v: h.sell }; }) }
      ],
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
      try { localStorage.setItem("inari.market.wg", state.wg); } catch (err) { /* 無視 */ }
      renderAll();
    });
    document.getElementById("q").addEventListener("input", U.debounce(function (e) {
      state.q = e.target.value;
      renderList();
    }, 120));
    document.getElementById("cat").addEventListener("change", function (e) { state.cat = e.target.value; renderList(); });
    document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; renderList(); });

    var list = document.getElementById("market-list");
    list.addEventListener("click", function (e) {
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

  document.addEventListener("DOMContentLoaded", function () {
    bind();
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
      if (state.market.sample) document.getElementById("market-notice").innerHTML = U.sampleNotice("価格・特需情報");
      renderCategories();
      renderAll();
    }).catch(function (e) {
      document.getElementById("market-list").innerHTML = U.errorBox(e.message);
    });
  });
})();
