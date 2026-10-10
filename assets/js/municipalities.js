/* 自治体一覧ページ */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};
  var state = { list: [], q: "", sort: "population" };

  function render() {
    var box = document.getElementById("muni-list");
    if (!state.list.length) {
      box.innerHTML = '<div class="empty"><strong>まだ自治体が登録されていません</strong>自治体データが追加されるとここに表示されます。</div>';
      return;
    }
    var q = U.normalize(state.q);
    var list = state.list.filter(function (m) {
      return !q || U.normalize(m.name + " " + (m.mayor || "") + " " + (m.kana || "")).indexOf(q) >= 0;
    });
    list.sort(function (a, b) {
      if (state.sort === "name") return String(a.name).localeCompare(String(b.name), "ja");
      if (state.sort === "founded") return String(a.foundedAt || "9999").localeCompare(String(b.foundedAt || "9999"));
      return (U.isNum(b.population) ? b.population : -1) - (U.isNum(a.population) ? a.population : -1);
    });
    if (!list.length) {
      box.innerHTML = '<div class="empty"><strong>該当する自治体がありません</strong>検索条件を変えてお試しください。</div>';
      return;
    }
    box.innerHTML = '<div class="grid grid-3">' + list.map(function (m) {
      var rows = [
        ["首長", m.mayor],
        ["人口", U.isNum(m.population) ? U.num(m.population) + "人" : ""],
        ["設立日", m.foundedAt ? U.date(m.foundedAt) : ""]
      ].filter(function (r) { return r[1]; });
      return '<article class="card card-body muni-card" id="' + U.esc(m.id) + '">' +
        '<div class="muni-meta">' +
        (m.type ? '<span class="badge">' + U.esc(m.type) + "</span>" : "") +
        (m.worldGroup ? '<span class="badge badge-gray">' + U.esc(m.worldGroup) + "</span>" : "") +
        "</div>" +
        "<h3>" + U.esc(m.name) + "</h3>" +
        (m.description ? "<p>" + U.esc(m.description) + "</p>" : "") +
        (rows.length ? '<dl class="dl-grid">' + rows.map(function (r) { return "<dt>" + U.esc(r[0]) + "</dt><dd>" + U.esc(r[1]) + "</dd>"; }).join("") + "</dl>" : "") +
        (m.discordUrl ? '<p style="margin:14px 0 0"><a class="btn btn-ghost btn-sm" href="' + U.esc(m.discordUrl) + '" target="_blank" rel="noopener">自治体のDiscord</a></p>' : "") +
        "</article>";
    }).join("") + "</div>";
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("q").addEventListener("input", U.debounce(function (e) { state.q = e.target.value; render(); }, 120));
    document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });
    U.fetchJSON(CFG.dataPath.municipalities).then(function (d) {
      state.list = d.municipalities || [];
      if (d.sample) document.getElementById("muni-notice").innerHTML = U.sampleNotice("自治体情報");
      document.getElementById("muni-meta").textContent = "最終更新：" + U.date(d.updatedAt, true) + "　／　登録 " + state.list.length + " 自治体";
      render();
    }).catch(function (e) {
      document.getElementById("muni-list").innerHTML = U.errorBox(e.message);
    });
  });
})();
