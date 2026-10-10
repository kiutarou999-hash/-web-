/* 会社データの読み込みと共通処理（ランキング・詳細ページで共用） */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};

  // 会社ランクの並び順（上ほど高ランク）。ゲーム内のランク名に合わせて変更できます。
  var RANK_ORDER = ["SSS", "SS", "S", "A", "B", "C", "D", "E", "F"];

  function rankValue(r) {
    if (U.isNum(r)) return r;
    if (r === null || r === undefined || r === "") return null;
    var n = Number(r);
    if (!isNaN(n)) return n;
    var i = RANK_ORDER.indexOf(String(r).toUpperCase());
    return i < 0 ? null : RANK_ORDER.length - i;
  }

  /** 会社一覧を読み込み、累計売上順の順位（rankNo）を付与 */
  function load() {
    return U.fetchJSON(CFG.dataPath.companies).then(function (d) {
      var list = (d.companies || []).slice();
      var bySales = list.slice().sort(function (a, b) {
        return (U.isNum(b.totalSales) ? b.totalSales : -Infinity) - (U.isNum(a.totalSales) ? a.totalSales : -Infinity);
      });
      bySales.forEach(function (c, i) { c.rankNo = i + 1; });
      return { sample: !!d.sample, updatedAt: d.updatedAt, companies: list };
    });
  }

  function listedBadge(c) {
    return c.listed ? '<span class="badge">上場</span>' : '<span class="badge badge-gray">非上場</span>';
  }

  function rankNoHtml(n) {
    return '<span class="rank-no' + (n <= 3 ? " r" + n : "") + '">' + n + "</span>";
  }

  function detailUrl(c) {
    return "company.html?id=" + encodeURIComponent(c.id);
  }

  window.InariCompanies = { load: load, rankValue: rankValue, listedBadge: listedBadge, rankNoHtml: rankNoHtml, detailUrl: detailUrl };
})();
