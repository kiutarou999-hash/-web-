/* 会社データの読み込みと共通処理（ランキング・詳細ページで共用） */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};

  // 会社ランクの並び順（上ほど高ランク）。MoroMenuShop のランクは数値（1〜4、大きいほど上位）なので、
  // 数値ランクはそのまま比較します。以下は文字のランクを使う場合の並び順です。
  var RANK_ORDER = ["SSS", "SS", "S", "A", "B", "C", "D", "E", "F"];

  function rankValue(r) {
    if (U.isNum(r)) return r;
    if (r === null || r === undefined || r === "") return null;
    var n = Number(r);
    if (!isNaN(n)) return n;
    var i = RANK_ORDER.indexOf(String(r).toUpperCase());
    return i < 0 ? null : RANK_ORDER.length - i;
  }

  /**
   * 静的 JSON の会社一覧に、累計売上順の順位（rankNo）を付与します。
   * リアルタイム配信のデータは、ゲーム内ランキングの順位（資産凍結中の会社は順位なし）をそのまま使います。
   */
  function prepare(d) {
    if (d.live) return d;
    var list = (d.companies || []).slice();
    var bySales = list.slice().sort(function (a, b) {
      return (U.isNum(b.totalSales) ? b.totalSales : -Infinity) - (U.isNum(a.totalSales) ? a.totalSales : -Infinity);
    });
    bySales.forEach(function (c, i) { c.rankNo = i + 1; });
    return { sample: !!d.sample, updatedAt: d.updatedAt, companies: list };
  }

  /** 会社一覧の読み込み。リアルタイム配信が有効なら更新のたびに render が呼ばれます。 */
  function connect(handlers) {
    var L = window.InariLive;
    var opts = {
      staticPath: CFG.dataPath.companies,
      adapt: L ? L.toCompanies : null,
      status: handlers.status,
      fail: handlers.fail,
      render: function (d, info) { handlers.render(prepare(d), info); }
    };
    if (L) {
      L.connect(opts);
    } else {
      U.fetchJSON(opts.staticPath).then(function (d) { opts.render(d, { live: false, sample: !!d.sample }); })
        .catch(function (e) { handlers.fail(e.message); });
    }
  }

  function load() {
    return U.fetchJSON(CFG.dataPath.companies).then(prepare);
  }

  /** 並び替え用の順位（順位なしは最後） */
  function rankSortValue(c) {
    return U.isNum(c.rankNo) ? c.rankNo : Infinity;
  }

  function listedBadge(c) {
    return c.listed ? '<span class="badge">上場</span>' : '<span class="badge badge-gray">非上場</span>';
  }

  function rankNoHtml(n) {
    if (!U.isNum(n)) return '<span class="rank-no" title="ランキング対象外">—</span>';
    return '<span class="rank-no' + (n <= 3 ? " r" + n : "") + '">' + n + "</span>";
  }

  function detailUrl(c) {
    return "company.html?id=" + encodeURIComponent(c.id);
  }

  window.InariCompanies = { load: load, connect: connect, rankSortValue: rankSortValue, rankValue: rankValue, listedBadge: listedBadge, rankNoHtml: rankNoHtml, detailUrl: detailUrl };
})();
