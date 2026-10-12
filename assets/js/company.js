/* 会社詳細ページ（company.html?id=会社ID） */
(function () {
  "use strict";
  var U = window.Inari;
  var C = window.InariCompanies;
  var L = window.InariLive;
  var CFG = window.SITE_CONFIG || {};

  var RANGES = { "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5, all: Infinity };
  var range = "30d";
  var current = null;

  function notFound(msg) {
    document.getElementById("company-head").innerHTML = '<h1 style="margin:0">会社が見つかりません</h1>';
    document.getElementById("company-body").innerHTML =
      '<div class="empty"><strong>' + U.esc(msg) + '</strong><a href="companies.html">会社ランキングへ戻る</a></div>';
  }

  function stat(label, value) {
    return '<div class="stat"><div class="k">' + U.esc(label) + '</div><div class="v">' + value + "</div></div>";
  }

  function render(c, data, info) {
    current = { c: c, data: data, live: !!(info && info.live) };
    document.title = c.name + "｜会社詳細｜" + (CFG.serverName || "稲荷クラフト");
    document.getElementById("crumb").textContent = c.name;

    document.getElementById("company-head").innerHTML =
      '<div class="company-emblem" aria-hidden="true">' + U.esc(U.initial(c.name)) + "</div>" +
      "<div><h1 style=\"margin:0 0 6px\">" + U.esc(c.name) + "</h1>" +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<span class="badge badge-gold">ランク ' + U.esc(c.rank != null && c.rank !== "" ? c.rank : "—") + "</span>" +
      C.listedBadge(c) +
      (c.industry ? '<span class="badge badge-gray">' + U.esc(c.industry) + "</span>" : "") +
      "</div></div>";

    // 値は表示用 HTML（文字列はすべてエスケープ済み）
    var rows = [
      ["社長", c.president ? U.esc(c.president) + (L ? L.editionBadge(c.presidentEdition) : "") : ""],
      ["設立日", c.foundedAt ? U.esc(U.date(c.foundedAt)) : ""],
      ["業種", U.esc(c.industry || "")],
      ["本社所在地", U.esc(c.headquarters || "")]
    ];
    if (current.live) {
      rows.push(["累計売上（ランク判定）", U.money(c.rankRevenue)]);
      rows.push(["次のランク", c.nextRank
        ? "Rank " + U.esc(c.nextRank.rank) + "（売上 " + U.esc(U.moneyText(c.nextRank.revenue)) + "・社員 " + U.num(c.nextRank.employees) + "人）"
        : "最高ランクです"]);
      if (c.listed) {
        rows.push(["発行済み株数", U.isNum(c.totalShares) ? U.num(c.totalShares) + "株" : ""]);
        rows.push(["販売中の株数", U.isNum(c.availableShares) ? U.num(c.availableShares) + "株" : ""]);
        rows.push(["初回発行価格", U.isNum(c.initialSharePrice) ? U.money(c.initialSharePrice) : ""]);
      }
    }
    rows = rows.filter(function (r) { return r[1]; });

    var members = Array.isArray(c.members) ? c.members : [];
    var rankText = U.isNum(c.rankNo) ? c.rankNo + "<small>位 / " + data.companies.length + "社</small>" : '<span style="font-size:.9rem">対象外</span>';
    var stock = c.listed
      ? U.money(c.stockPrice) + (U.isNum(c.stockChange24h) ? '<div style="font-size:.8rem">' + U.change(c.stockChange24h) + "</div>" : "")
      : '<span style="font-size:.9rem">非上場</span>';

    var html = "";
    if (data.sample) html += U.sampleNotice("会社情報");
    html +=
      '<div class="stat-row">' +
      stat("順位", rankText) +
      stat(current.live ? "会社売上" : "累計売上", U.money(c.totalSales)) +
      stat("社員数", U.isNum(c.employees) ? U.num(c.employees) + "<small>人" + (current.live ? "（社長を除く）" : "") + "</small>" : "—") +
      stat("株価", stock) +
      "</div>" +
      (current.live
        ? '<p class="meta-line" style="margin-top:-8px">会社売上：ゲーム内の会社ランキングに使われる金額です（会社の自動販売機で社外のプレイヤーに売れた金額の合計。社長の資産が凍結されている間の売上は含みません）。' +
          "累計売上（ランク判定）：会社ランクの昇格条件に使われる金額です（社員による購入は含みません）。記録の仕方が異なるため、2つの金額は一致しないことがあります。</p>"
        : "") +
      '<div class="two-col">' +
      "<div>" +
      (c.description ? '<div class="card card-body" style="margin-bottom:20px"><h2 style="font-size:1.15rem">会社紹介</h2><p style="margin:0;white-space:pre-wrap">' + U.esc(c.description) + "</p></div>" : "") +
      (c.listed
        ? '<div class="chart-box"><div class="chart-head"><h3>株価推移</h3>' +
          '<div class="segmented" id="range-tabs" role="group" aria-label="期間">' +
          ["24h", "7d", "30d", "all"].map(function (r) {
            var label = { "24h": "24時間", "7d": "7日間", "30d": "30日間", all: "全期間" }[r];
            return '<button type="button" data-range="' + r + '" aria-pressed="' + (r === range) + '">' + label + "</button>";
          }).join("") +
          '</div></div><div id="stock-chart"></div></div>'
        : '<div class="card card-body"><h2 style="font-size:1.15rem">株式</h2><p style="margin:0;color:var(--ink-soft)">この会社は現在上場していません。上場すると株価と推移グラフが表示されます。</p></div>') +
      "</div>" +
      "<div>" +
      (rows.length
        ? '<div class="card card-body" style="margin-bottom:20px"><h2 style="font-size:1.15rem">会社概要</h2><dl class="dl-grid">' +
          rows.map(function (r) { return "<dt>" + U.esc(r[0]) + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl></div>"
        : "") +
      '<div class="card card-body"><h2 style="font-size:1.15rem">社員</h2>' +
      (members.length
        ? '<ul class="member-list">' + members.map(function (m) {
            return "<li><span>" + U.esc(m.name) + '</span><span class="role">' + U.esc(m.role || "") + "</span></li>";
          }).join("") + "</ul>"
        : '<p style="margin:0;color:var(--ink-mute)">社員情報は公開されていません。</p>') +
      "</div></div></div>" +
      '<p style="margin-top:28px"><a class="btn btn-ghost btn-sm" href="companies.html">← 会社ランキングへ戻る</a></p>';

    document.getElementById("company-body").innerHTML = html;

    if (c.listed) {
      document.getElementById("range-tabs").addEventListener("click", function (e) {
        var b = e.target.closest("[data-range]");
        if (!b) return;
        range = b.getAttribute("data-range");
        this.querySelectorAll("[data-range]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        drawStock();
      });
      drawStock();
    }
  }

  function draw(c, points, from, to) {
    U.lineChart(document.getElementById("stock-chart"), {
      series: [{ label: "株価", color: "#1e4d36", points: points }],
      from: from,
      to: to,
      ariaLabel: c.name + " の株価推移",
      emptyText: "この期間の株価履歴はまだありません。データが蓄積されると自動でグラフが表示されます。"
    });
  }

  function drawStock() {
    var c = current.c, data = current.data;
    var to = data.updatedAt ? new Date(data.updatedAt) : new Date();
    if (isNaN(to)) to = new Date();
    var span = RANGES[range];
    var from = span === Infinity ? null : new Date(+to - span);
    if (current.live) {
      var box = document.getElementById("stock-chart");
      var wanted = c.id + "|" + range;
      box.setAttribute("data-wanted", wanted);
      L.history(c.stockSeries, range).then(function (points) {
        if (box.getAttribute("data-wanted") !== wanted) return;
        var pts = points.map(function (p) { return { t: new Date(from ? Math.max(p[0], +from) : p[0]).toISOString(), v: p[1] }; });
        // 現在の株価を右端に置き、最後の取引から今までの横ばいも描きます。
        if (pts.length && U.isNum(c.stockPrice)) pts.push({ t: to.toISOString(), v: c.stockPrice });
        draw(c, pts, from, span === Infinity ? null : to);
      }).catch(function (e) {
        if (box.getAttribute("data-wanted") === wanted) box.innerHTML = '<div class="chart-empty">' + U.esc(e.message) + "</div>";
      });
      return;
    }
    var hist = Array.isArray(c.stockHistory) ? c.stockHistory : [];
    var pts = hist.filter(function (h) {
      var t = +new Date(h.t);
      return span === Infinity || (t >= +to - span && t <= +to);
    }).map(function (h) { return { t: h.t, v: h.v }; });
    draw(c, pts, from, span === Infinity ? null : to);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var id = U.param("id");
    if (!id) { notFound("会社が指定されていません。"); return; }
    var body = document.getElementById("company-body");
    var statusBox = document.createElement("div");
    statusBox.className = "container";
    statusBox.style.paddingTop = "20px";
    body.parentNode.insertBefore(statusBox, body);
    C.connect({
      status: function (html) { statusBox.innerHTML = html; },
      fail: function (message) {
        if (!current) body.innerHTML = U.errorBox(message);
      },
      render: function (data, info) {
        var c = data.companies.filter(function (x) { return String(x.id) === id; })[0];
        if (!c) { notFound("指定された会社（" + id + "）は登録されていません。"); return; }
        render(c, data, info);
      }
    });
  });
})();
