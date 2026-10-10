/* 会社ランキングページ */
(function () {
  "use strict";
  var U = window.Inari;
  var C = window.InariCompanies;

  var state = { data: null, q: "", listed: "", sort: "sales-desc" };

  var KEYS = {
    sales: function (c) { return c.totalSales; },
    rank: function (c) { return C.rankValue(c.rank); },
    employees: function (c) { return c.employees; },
    stock: function (c) { return c.listed ? c.stockPrice : null; }
  };

  var COLUMNS = [
    { key: "no", label: "順位" },
    { key: "name", label: "会社名" },
    { key: "rank", label: "ランク" },
    { key: "sales", label: "累計売上", num: true },
    { key: "employees", label: "社員数", num: true },
    { key: "stock", label: "株価", num: true },
    { key: "listed", label: "上場状況" }
  ];

  function rows() {
    var q = U.normalize(state.q);
    var list = state.data.companies.filter(function (c) {
      if (state.listed === "listed" && !c.listed) return false;
      if (state.listed === "unlisted" && c.listed) return false;
      if (q && U.normalize(c.name + " " + (c.kana || "")).indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort.split("-")[0], dir = state.sort.split("-")[1] === "asc" ? 1 : -1;
    list.sort(function (a, b) {
      if (key === "name") return String(a.name).localeCompare(String(b.name), "ja");
      var av = KEYS[key](a), bv = KEYS[key](b);
      var an = U.isNum(av), bn = U.isNum(bv);
      if (!an && !bn) return a.rankNo - b.rankNo;
      if (!an) return 1;
      if (!bn) return -1;
      return (av - bv) * dir || a.rankNo - b.rankNo;
    });
    return list;
  }

  function header() {
    var cur = state.sort.split("-");
    return "<thead><tr>" + COLUMNS.map(function (col) {
      var sortable = KEYS[col.key] || col.key === "name";
      var inner = U.esc(col.label);
      if (sortable) {
        var active = cur[0] === col.key;
        var arrow = active ? (cur[1] === "asc" ? "▲" : "▼") : "▼";
        inner = '<button type="button" class="th-sort" data-sort="' + col.key + '"' +
          (active ? ' aria-sort="' + (cur[1] === "asc" ? "ascending" : "descending") + '"' : "") + ">" +
          inner + '<span class="arrow" aria-hidden="true">' + arrow + "</span></button>";
      }
      return '<th' + (col.num ? ' class="num"' : "") + ">" + inner + "</th>";
    }).join("") + "</tr></thead>";
  }

  function render() {
    var box = document.getElementById("companies-list");
    var list = rows();
    if (!state.data.companies.length) {
      box.innerHTML = '<div class="empty"><strong>まだ会社が登録されていません</strong>会社データが追加されるとここに表示されます。</div>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="empty"><strong>該当する会社がありません</strong>検索条件を変えてお試しください。</div>';
      return;
    }
    box.innerHTML = '<div class="table-wrap"><table class="data-table responsive">' + header() + "<tbody>" +
      list.map(function (c) {
        return '<tr class="is-link" data-href="' + U.esc(C.detailUrl(c)) + '">' +
          '<td data-label="順位">' + C.rankNoHtml(c.rankNo) + "</td>" +
          '<td class="cell-main" data-label="会社名"><a href="' + U.esc(C.detailUrl(c)) + '" class="item-name">' + U.esc(c.name) + "</a>" +
          (c.industry ? '<span class="item-sub">' + U.esc(c.industry) + "</span>" : "") + "</td>" +
          '<td data-label="ランク"><span class="badge badge-gold">' + U.esc(c.rank != null && c.rank !== "" ? c.rank : "—") + "</span></td>" +
          '<td class="num" data-label="累計売上">' + U.money(c.totalSales) + "</td>" +
          '<td class="num" data-label="社員数">' + (U.isNum(c.employees) ? "<span>" + U.num(c.employees) + "<small>人</small></span>" : "—") + "</td>" +
          '<td class="num" data-label="株価">' + (c.listed ? U.money(c.stockPrice) : "—") + "</td>" +
          '<td data-label="上場状況">' + C.listedBadge(c) + "</td>" +
          "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function bind() {
    document.getElementById("q").addEventListener("input", U.debounce(function (e) { state.q = e.target.value; render(); }, 120));
    document.getElementById("listed").addEventListener("change", function (e) { state.listed = e.target.value; render(); });
    var sortSel = document.getElementById("sort");
    sortSel.addEventListener("change", function (e) { state.sort = e.target.value; render(); });

    var box = document.getElementById("companies-list");
    box.addEventListener("click", function (e) {
      var th = e.target.closest("[data-sort]");
      if (th) {
        var key = th.getAttribute("data-sort");
        var cur = state.sort.split("-");
        var dir = cur[0] === key ? (cur[1] === "desc" ? "asc" : "desc") : key === "name" ? "asc" : "desc";
        state.sort = key + "-" + dir;
        if (sortSel.querySelector('option[value="' + state.sort + '"]')) sortSel.value = state.sort;
        render();
        return;
      }
      if (e.target.closest("a")) return;
      var tr = e.target.closest("[data-href]");
      if (tr) location.href = tr.getAttribute("data-href");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    C.load().then(function (d) {
      state.data = d;
      if (d.sample) document.getElementById("companies-notice").innerHTML = U.sampleNotice("会社情報");
      document.getElementById("companies-meta").textContent =
        "最終更新：" + U.date(d.updatedAt, true) + "　／　登録 " + d.companies.length + " 社　／　順位は累計売上順";
      render();
    }).catch(function (e) {
      document.getElementById("companies-list").innerHTML = U.errorBox(e.message);
    });
  });
})();
