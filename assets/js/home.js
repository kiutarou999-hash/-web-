/* トップページ */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};

  function setText(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function addrHtml(text) {
    if (!text) return "準備中";
    return U.esc(text) + '<button class="copy-btn" type="button" data-copy="' + U.esc(text) + '">コピー</button>';
  }

  function renderStatic() {
    if (CFG.tagline) document.getElementById("hero-tagline").textContent = CFG.tagline;
    setText("st-java", addrHtml(U.javaAddress()));
    setText("st-friend", addrHtml(CFG.bedrockFriendName));
    setText("st-bedrock", CFG.bedrockAddress
      ? addrHtml(CFG.bedrockAddress) + '<br><span class="port-line">ポート ' + addrHtml(String(CFG.bedrockPort || 19132)) + "</span>"
      : "準備中");
    setText("st-version", CFG.supportedVersions ? U.esc(CFG.supportedVersions) : "準備中");
    U.applyDiscord(document.getElementById("hero-discord"));
    U.applyDiscord(document.getElementById("cta-discord"));
    // 地図（Pl3xMap）は config.js の mapUrl を設定したときだけ表示。HTTP の地図は埋め込まず、新しいタブで開きます。
    var map = document.getElementById("hero-map");
    if (map && CFG.mapUrl && /^https?:\/\//.test(CFG.mapUrl)) {
      map.href = CFG.mapUrl;
      map.hidden = false;
    }

    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]");
      if (b) U.copy(b.getAttribute("data-copy"), b);
    });
  }

  /* オンライン人数：リアルタイム配信があればプラグインからの情報、なければ外部サービスで取得 */
  function renderStatus() {
    var L = window.InariLive;
    if (L && L.enabled()) {
      L.load().then(function (s) {
        var server = s.data && s.data.server;
        if (s.status === "online" && server) {
          setText("st-online", '<span class="status-dot on"></span>オンライン');
          setText("st-players", U.num(server.onlinePlayers) + (U.isNum(server.maxPlayers) ? " / " + U.num(server.maxPlayers) : "") + " 人");
        } else if (s.status === "waiting") {
          renderExternalStatus();
        } else {
          setText("st-online", '<span class="status-dot off"></span>' + (s.status === "stopped" ? "停止中" : "オフライン") +
            '<br><span class="port-line">最終確認 ' + U.esc(L.time(s.lastSeenAt)) + "</span>");
          setText("st-players", "—");
        }
      }).catch(renderExternalStatus);
      return;
    }
    renderExternalStatus();
  }

  function renderExternalStatus() {
    var addr = U.javaAddress();
    if (!addr || !CFG.showOnlineStatus || !CFG.onlineStatusApi) {
      setText("st-online", '<span class="status-dot"></span>準備中');
      setText("st-players", "—");
      return;
    }
    U.fetchJSON(CFG.onlineStatusApi + encodeURIComponent(addr))
      .then(function (d) {
        if (d && d.online) {
          setText("st-online", '<span class="status-dot on"></span>オンライン');
          var p = d.players || {};
          setText("st-players", U.isNum(p.online) ? U.num(p.online) + (U.isNum(p.max) ? " / " + U.num(p.max) : "") + " 人" : "—");
        } else {
          setText("st-online", '<span class="status-dot off"></span>オフライン');
          setText("st-players", "—");
        }
      })
      .catch(function () {
        setText("st-online", '<span class="status-dot"></span>取得できませんでした');
      });
  }

  function renderNews() {
    var box = document.getElementById("news");
    U.fetchJSON(CFG.dataPath.news)
      .then(function (d) {
        var list = (d.news || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 8);
        if (!list.length) {
          box.innerHTML = '<p class="loading">現在お知らせはありません。</p>';
          return;
        }
        box.innerHTML = '<ul class="news-list">' + list.map(function (n) {
          return '<li class="news-item">' +
            '<time class="news-date" datetime="' + U.esc(n.date) + '">' + U.date(n.date) + "</time>" +
            '<span><span class="badge' + (n.tag === "重要" ? " badge-red" : n.tag === "イベント" ? " badge-gold" : "") + '">' + U.esc(n.tag || "お知らせ") + "</span></span>" +
            '<span class="news-title">' + U.esc(n.title) + "</span>" +
            (n.body ? '<p class="news-body">' + U.esc(n.body) + "</p>" : "") +
            "</li>";
        }).join("") + "</ul>";
      })
      .catch(function (e) { box.innerHTML = U.errorBox(e.message); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderStatic();
    renderStatus();
    renderNews();
  });
})();
