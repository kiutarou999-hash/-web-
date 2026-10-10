/* 参加方法ページ */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};

  function addrBox(id, label, text) {
    var el = document.getElementById(id);
    if (!text) { el.textContent = label + "準備中"; return; }
    el.innerHTML = U.esc(label + text) + '<button class="copy-btn" type="button" data-copy="' + U.esc(text) + '">コピー</button>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".js-version").forEach(function (e) {
      e.textContent = CFG.supportedVersions || "準備中";
    });
    addrBox("java-addr", "", U.javaAddress());
    addrBox("bedrock-addr", "", CFG.bedrockAddress);
    addrBox("bedrock-port", "ポート：", String(CFG.bedrockPort || 19132));
    U.applyDiscord(document.getElementById("join-discord"));
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]");
      if (b) U.copy(b.getAttribute("data-copy"), b);
    });
  });
})();
