/* 自治体詳細ページ（municipality.html?id=自治体ID） */
(function () {
  "use strict";
  var U = window.Inari;
  var L = window.InariLive;
  var CFG = window.SITE_CONFIG || {};
  var shown = false;

  function notFound(msg) {
    document.getElementById("muni-head").innerHTML = '<h1 style="margin:0">自治体が見つかりません</h1>';
    document.getElementById("muni-body").innerHTML =
      '<div class="empty"><strong>' + U.esc(msg) + '</strong><a href="municipalities.html">自治体一覧へ戻る</a></div>';
  }

  /** 領域（チャンク）の簡易地図。中心座標があればそのワールドを、なければ最も多いワールドを描きます。 */
  function territoryMap(m) {
    var cells = (m.territory && m.territory.cells) || [];
    if (!cells.length) return "";
    var world = m.center && m.center.world;
    if (!world || !cells.some(function (c) { return c[0] === world; })) {
      var counts = {};
      cells.forEach(function (c) { counts[c[0]] = (counts[c[0]] || 0) + 1; });
      world = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    }
    var list = cells.filter(function (c) { return c[0] === world; });
    var xs = list.map(function (c) { return c[1]; }), zs = list.map(function (c) { return c[2]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs) + 1;
    var minZ = Math.min.apply(null, zs), maxZ = Math.max.apply(null, zs) + 1;
    var cx = null, cz = null;
    if (m.center && m.center.world === world) {
      cx = m.center.x / 16; cz = m.center.z / 16;
      minX = Math.min(minX, Math.floor(cx)); maxX = Math.max(maxX, Math.floor(cx) + 1);
      minZ = Math.min(minZ, Math.floor(cz)); maxZ = Math.max(maxZ, Math.floor(cz) + 1);
    }
    var pad = 1, w = maxX - minX + pad * 2, h = maxZ - minZ + pad * 2;
    var rects = list.map(function (c) {
      return '<rect class="cell" x="' + (c[1] - minX + pad) + '" y="' + (c[2] - minZ + pad) + '" width="1" height="1"></rect>';
    }).join("");
    var center = cx === null ? "" : '<circle class="center" cx="' + (cx - minX + pad) + '" cy="' + (cz - minZ + pad) + '" r="' + Math.max(0.35, Math.min(w, h) / 40) + '"></circle>';
    return '<svg class="territory-map" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + U.esc(m.name) + ' の領域（' + list.length + 'チャンク）">' +
      rects + center + "</svg>" +
      '<p style="margin:8px 0 0;font-size:.82rem;color:var(--ink-mute)">1マス＝1チャンク（16×16ブロック）。上が北です。' +
      (cx === null ? "" : "金色の点が中心地点です。") + "</p>";
  }

  function render(m, d, info) {
    document.title = m.name + "｜自治体詳細｜" + (CFG.serverName || "稲荷クラフト");
    document.getElementById("crumb").textContent = m.name;
    document.getElementById("muni-head").innerHTML =
      '<div class="company-emblem" aria-hidden="true">' + U.esc(U.initial(m.name)) + "</div>" +
      '<div><h1 style="margin:0 0 6px">' + U.esc(m.name) + "</h1>" +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      (m.type ? '<span class="badge badge-gold">' + U.esc(m.type) + "</span>" : "") +
      (m.worldGroup ? '<span class="badge badge-gray">' + U.esc(m.worldGroup) + "</span>" : "") +
      "</div></div>";

    var rows = [
      [m.mayorTitle || "首長", m.mayor ? U.esc(m.mayor) + L.editionBadge(m.mayorEdition) : ""],
      ["区分", U.esc(m.type || "")],
      ["ワールドグループ", U.esc(m.worldGroup || "")],
      ["設立日", m.foundedAt ? U.esc(U.date(m.foundedAt)) : ""],
      ["中心座標", m.center ? "X " + U.num(m.center.x, 0) + " / Y " + U.num(m.center.y, 0) + " / Z " + U.num(m.center.z, 0) : ""]
    ].filter(function (r) { return r[1]; });

    var map = territoryMap(m);
    var html = "";
    if (d.sample) html += U.sampleNotice("自治体情報");
    html += '<div class="stat-row">' +
      '<div class="stat"><div class="k">' + "住民数" + '</div><div class="v">' + (U.isNum(m.population) ? U.num(m.population) + "<small>人</small>" : "—") + "</div></div>" +
      '<div class="stat"><div class="k">税率</div><div class="v">' + (U.isNum(m.taxRate) ? U.num(m.taxRate * 100, 1) + "<small>%</small>" : "—") + "</div></div>" +
      '<div class="stat"><div class="k">領域</div><div class="v">' + (m.territory && U.isNum(m.territory.chunks) ? U.num(m.territory.chunks) + "<small>チャンク</small>" : "—") + "</div></div>" +
      "</div>" +
      (U.isNum(m.taxRate) ? '<p class="meta-line" style="margin-top:-8px">税率：自治体の領域内にある土地保護の保護料金のうち、自治体の収入になる割合です。保護料金を支払う側の金額は変わりません。</p>' : "") +
      '<div class="two-col"><div>' +
      (m.description ? '<div class="card card-body" style="margin-bottom:20px"><h2 style="font-size:1.15rem">紹介</h2><p style="margin:0;white-space:pre-wrap">' + U.esc(m.description) + "</p></div>" : "") +
      (map ? '<div class="card card-body"><h2 style="font-size:1.15rem">自治体の領域</h2>' + map + "</div>" : "") +
      "</div><div>" +
      '<div class="card card-body"><h2 style="font-size:1.15rem">概要</h2><dl class="dl-grid">' +
      rows.map(function (r) { return "<dt>" + U.esc(r[0]) + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl>" +
      (m.discordUrl ? '<p style="margin:14px 0 0"><a class="btn btn-ghost btn-sm" href="' + U.esc(m.discordUrl) + '" target="_blank" rel="noopener">自治体のDiscord</a></p>' : "") +
      "</div></div></div>" +
      '<p style="margin-top:28px"><a class="btn btn-ghost btn-sm" href="municipalities.html">← 自治体一覧へ戻る</a></p>';
    document.getElementById("muni-body").innerHTML = html;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var id = U.param("id");
    if (!id) { notFound("自治体が指定されていません。"); return; }
    L.connect({
      staticPath: CFG.dataPath.municipalities,
      adapt: L.toMunicipalities,
      status: function (html) { document.getElementById("muni-status").innerHTML = html; },
      fail: function (message) {
        if (!shown) document.getElementById("muni-body").innerHTML = U.errorBox(message);
      },
      render: function (d, info) {
        var m = (d.municipalities || []).filter(function (x) { return String(x.id) === id; })[0];
        if (!m) {
          var gone = (d.dissolved || []).filter(function (x) { return String(x.id) === id; })[0];
          notFound(gone ? "「" + gone.name + "」は" + (gone.dissolvedAt ? U.date(gone.dissolvedAt) + "に" : "") + "解散しました。" : "指定された自治体（" + id + "）は登録されていません。");
          return;
        }
        shown = true;
        render(m, d, info);
      }
    });
  });
})();
