/* 会社詳細ページ（company.html?id=会社ID） */
(function () {
  "use strict";
  var U = window.Inari;
  var C = window.InariCompanies;
  var CFG = window.SITE_CONFIG || {};

  var RANGES = { "24h": 864e5, "7d": 7 * 864e5, "30d": 30 * 864e5, all: Infinity };

  function notFound(msg) {
    document.getElementById("company-head").innerHTML = '<h1 style="margin:0">会社が見つかりません</h1>';
    document.getElementById("company-body").innerHTML =
      '<div class="empty"><strong>' + U.esc(msg) + '</strong><a href="companies.html">会社ランキングへ戻る</a></div>';
  }

  function render(c, data) {
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

    var info = [
      ["代表者", c.president],
      ["設立日", c.foundedAt ? U.date(c.foundedAt) : ""],
      ["業種", c.industry],
      ["本社所在地", c.headquarters]
    ].filter(function (r) { return r[1]; });

    var members = Array.isArray(c.members) ? c.members : [];

    var html = "";
    if (data.sample) html += U.sampleNotice("会社情報");
    html +=
      '<div class="stat-row">' +
      '<div class="stat"><div class="k">順位</div><div class="v">' + c.rankNo + "<small>位 / " + data.companies.length + "社</small></div></div>" +
      '<div class="stat"><div class="k">累計売上</div><div class="v">' + U.money(c.totalSales) + "</div></div>" +
      '<div class="stat"><div class="k">社員数</div><div class="v">' + (U.isNum(c.employees) ? U.num(c.employees) + "<small>人</small>" : "—") + "</div></div>" +
      '<div class="stat"><div class="k">株価</div><div class="v">' + (c.listed ? U.money(c.stockPrice) : '<span style="font-size:.9rem">非上場</span>') + "</div></div>" +
      "</div>" +
      '<div class="two-col">' +
      "<div>" +
      (c.description ? '<div class="card card-body" style="margin-bottom:20px"><h2 style="font-size:1.15rem">会社紹介</h2><p style="margin:0;white-space:pre-wrap">' + U.esc(c.description) + "</p></div>" : "") +
      (c.listed
        ? '<div class="chart-box"><div class="chart-head"><h3>株価推移</h3>' +
          '<div class="segmented" id="range-tabs" role="group" aria-label="期間">' +
          '<button type="button" data-range="24h" aria-pressed="false">24時間</button>' +
          '<button type="button" data-range="7d" aria-pressed="false">7日間</button>' +
          '<button type="button" data-range="30d" aria-pressed="true">30日間</button>' +
          '<button type="button" data-range="all" aria-pressed="false">全期間</button>' +
          '</div></div><div id="stock-chart"></div></div>'
        : '<div class="card card-body"><h2 style="font-size:1.15rem">株式</h2><p style="margin:0;color:var(--ink-soft)">この会社は現在上場していません。上場すると株価と推移グラフが表示されます。</p></div>') +
      "</div>" +
      "<div>" +
      (info.length
        ? '<div class="card card-body" style="margin-bottom:20px"><h2 style="font-size:1.15rem">会社概要</h2><dl class="dl-grid">' +
          info.map(function (r) { return "<dt>" + U.esc(r[0]) + "</dt><dd>" + U.esc(r[1]) + "</dd>"; }).join("") + "</dl></div>"
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
      var range = "30d";
      var draw = function () {
        var hist = Array.isArray(c.stockHistory) ? c.stockHistory : [];
        var to = data.updatedAt ? new Date(data.updatedAt) : new Date();
        if (isNaN(to)) to = new Date();
        var span = RANGES[range];
        var pts = hist.filter(function (h) {
          var t = +new Date(h.t);
          return span === Infinity || (t >= +to - span && t <= +to);
        }).map(function (h) { return { t: h.t, v: h.v }; });
        U.lineChart(document.getElementById("stock-chart"), {
          series: [{ label: "株価", color: "#1e4d36", points: pts }],
          from: span === Infinity ? null : new Date(+to - span),
          to: span === Infinity ? null : to,
          ariaLabel: c.name + " の株価推移",
          emptyText: "この期間の株価履歴はまだありません。データが蓄積されると自動でグラフが表示されます。"
        });
      };
      document.getElementById("range-tabs").addEventListener("click", function (e) {
        var b = e.target.closest("[data-range]");
        if (!b) return;
        range = b.getAttribute("data-range");
        this.querySelectorAll("[data-range]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        draw();
      });
      draw();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var id = U.param("id");
    if (!id) { notFound("会社が指定されていません。"); return; }
    C.load().then(function (data) {
      var c = data.companies.filter(function (x) { return String(x.id) === id; })[0];
      if (!c) { notFound("指定された会社（" + id + "）は登録されていません。"); return; }
      render(c, data);
    }).catch(function (e) {
      document.getElementById("company-body").innerHTML = U.errorBox(e.message);
    });
  });
})();
