/* 自治体一覧ページ */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};
  var L = window.InariLive;
  var state = { list: [], dissolved: [], live: false, q: "", sort: "population" };

  function render() {
    var box = U.htmlSink(document.getElementById("muni-list"));
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
        [m.mayorTitle || "首長", m.mayor],
        ["住民数", U.isNum(m.population) ? U.num(m.population) + "人" : ""],
        ["税率", U.isNum(m.taxRate) ? U.num(m.taxRate * 100, 1) + "%" : ""],
        ["設立日", m.foundedAt ? U.date(m.foundedAt) : ""]
      ].filter(function (r) { return r[1]; });
      return '<article class="card card-body muni-card" id="' + U.esc(m.id) + '">' +
        '<div class="muni-meta">' +
        (m.type ? '<span class="badge">' + U.esc(m.type) + "</span>" : "") +
        (m.worldGroup ? '<span class="badge badge-gray">' + U.esc(m.worldGroup) + "</span>" : "") +
        "</div>" +
        '<h3><a href="municipality.html?id=' + encodeURIComponent(m.id) + '">' + U.esc(m.name) + "</a></h3>" +
        (m.description ? "<p>" + U.esc(m.description) + "</p>" : "") +
        (rows.length ? '<dl class="dl-grid">' + rows.map(function (r) { return "<dt>" + U.esc(r[0]) + "</dt><dd>" + U.esc(r[1]) + "</dd>"; }).join("") + "</dl>" : "") +
        (m.discordUrl ? '<p style="margin:14px 0 0"><a class="btn btn-ghost btn-sm" href="' + U.esc(m.discordUrl) + '" target="_blank" rel="noopener">自治体のDiscord</a></p>' : "") +
        "</article>";
    }).join("") + "</div>" + dissolvedHtml();
  }

  function dissolvedHtml() {
    if (!state.dissolved.length) return "";
    return '<details class="card card-body" style="margin-top:24px"><summary>解散した自治体（' + state.dissolved.length + "）</summary>" +
      '<ul class="dissolved-list" style="margin-top:12px">' + state.dissolved.map(function (m) {
        return "<li>" + U.esc(m.name) + (m.type ? "（" + U.esc(m.type) + "）" : "") +
          (m.dissolvedAt ? "　" + U.esc(U.date(m.dissolvedAt)) + " 解散" : "") + "</li>";
      }).join("") + "</ul></details>";
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("q").addEventListener("input", U.debounce(function (e) { state.q = e.target.value; render(); }, 120));
    document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });
    var loaded = false;
    L.connect({
      staticPath: CFG.dataPath.municipalities,
      adapt: L.toMunicipalities,
      status: function (html) { document.getElementById("muni-notice").innerHTML = html; },
      fail: function (message) {
        if (!loaded) document.getElementById("muni-list").innerHTML = U.errorBox(message);
      },
      render: function (d, info) {
        loaded = true;
        state.live = info.live;
        state.list = d.municipalities || [];
        state.dissolved = d.dissolved || [];
        if (d.sample) document.getElementById("muni-notice").innerHTML = U.sampleNotice("自治体情報");
        document.getElementById("muni-meta").textContent = "最終更新：" +
          (info.live ? L.time(+new Date(d.updatedAt)) : U.date(d.updatedAt, true)) + "　／　登録 " + state.list.length + " 自治体" +
          (info.live ? "　／　自治体はワールドグループごとに独立しています" : "");
        render();
      }
    });
  });
})();
