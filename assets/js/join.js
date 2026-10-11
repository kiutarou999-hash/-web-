/* 参加方法ページ */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};

  function addrBox(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!text) { el.textContent = "準備中"; return; }
    el.innerHTML = '<span class="addr-text">' + U.esc(text) + '</span><button class="copy-btn" type="button" data-copy="' + U.esc(text) + '">コピー</button>';
  }

  function fill(selector, text) {
    document.querySelectorAll(selector).forEach(function (e) { e.textContent = text; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    fill(".js-version", CFG.supportedVersions || "準備中");
    fill(".js-server-name", CFG.serverName || "稲荷クラフト");
    fill(".js-friend", CFG.bedrockFriendName || "準備中");
    addrBox("java-addr", U.javaAddress());
    addrBox("java-addr-step", U.javaAddress());
    addrBox("friend-name", CFG.bedrockFriendName);
    addrBox("bedrock-addr", CFG.bedrockAddress);
    addrBox("bedrock-port", String(CFG.bedrockPort || 19132));
    U.applyDiscord(document.getElementById("join-discord"));
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]");
      if (b) U.copy(b.getAttribute("data-copy"), b);
    });
  });
})();
