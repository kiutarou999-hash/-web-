/* =========================================================
   稲荷クラフト 共通スクリプト（ヘッダー・フッター・ユーティリティ）
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};

  var NAV = [
    { href: "index.html", label: "トップ", key: "home" },
    { href: "join.html", label: "参加方法", key: "join" },
    { href: "market.html", label: "アイテム相場", key: "market" },
    { href: "companies.html", label: "会社一覧", key: "companies" },
    { href: "municipalities.html", label: "自治体一覧", key: "municipalities" }
  ];

  // 公式アイコン（assets/img/icon-128.png）
  var BRAND_IMG = '<img class="brand-mark" src="assets/img/icon-128.png" width="44" height="44" alt="">';
  var DISCORD_LABEL = "Discordに参加する";

  var U = {};

  /** HTML エスケープ */
  U.esc = function (v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  U.isNum = function (v) {
    return typeof v === "number" && isFinite(v);
  };

  /** 数値を 1,234 形式に。値がなければ「—」 */
  U.num = function (v, digits) {
    if (!U.isNum(v)) return "—";
    return v.toLocaleString("ja-JP", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits === undefined ? 2 : digits
    });
  };

  /** 通貨表記（ゲーム内通貨） */
  U.money = function (v) {
    if (!U.isNum(v)) return "—";
    return "<span>" + U.num(v) + "<small>" + U.esc(CFG.currencyUnit || "") + "</small></span>";
  };
  U.moneyText = function (v) {
    if (!U.isNum(v)) return "—";
    return U.num(v) + (CFG.currencyUnit || "");
  };

  /** 変動率（%）表示。値がなければ「—」 */
  U.change = function (v) {
    if (!U.isNum(v)) return '<span class="flat">—</span>';
    var cls = v > 0 ? "up" : v < 0 ? "down" : "flat";
    var sign = v > 0 ? "+" : v < 0 ? "−" : "±";
    var arrow = v > 0 ? "▲" : v < 0 ? "▼" : "";
    return '<span class="' + cls + '">' + arrow + sign + Math.abs(v).toFixed(2) + "%</span>";
  };

  U.date = function (v, withTime) {
    if (!v) return "—";
    var d = new Date(v);
    if (isNaN(d)) return U.esc(v);
    var p = function (n) { return String(n).padStart(2, "0"); };
    var s = d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate());
    if (withTime) s += " " + p(d.getHours()) + ":" + p(d.getMinutes());
    return s;
  };

  U.fetchJSON = function (path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " の読み込みに失敗しました (" + r.status + ")");
      return r.json();
    });
  };

  U.param = function (name) {
    return new URLSearchParams(location.search).get(name);
  };

  /** 検索用に文字列を正規化（カタカナ→ひらがな、全角英数→半角、小文字化） */
  U.normalize = function (s) {
    return String(s || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0x60);
      });
  };

  U.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  };

  /** 頭文字アイコン（画像がない場合の代替） */
  U.initial = function (name) {
    var s = String(name || "?").trim();
    return s ? Array.from(s)[0] : "?";
  };

  U.copy = function (text, btn) {
    var show = function (msg) {
      if (!btn) return;
      if (!btn.dataset.label) btn.dataset.label = btn.textContent;
      btn.textContent = msg;
      clearTimeout(btn._t);
      btn._t = setTimeout(function () { btn.textContent = btn.dataset.label; }, 1600);
    };
    var legacy = function () {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) show("コピーしました");
      else window.prompt("以下をコピーしてください", text);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { show("コピーしました"); }, legacy);
    } else {
      legacy();
    }
  };

  U.sampleNotice = function (what) {
    return (
      '<div class="notice" role="note"><span class="notice-icon">!</span><div>' +
      "<strong>表示確認用のサンプルデータです。</strong>" +
      U.esc(what) +
      "はゲーム内の実際の値ではありません。</div></div>"
    );
  };

  U.errorBox = function (msg) {
    return '<div class="empty"><strong>データを読み込めませんでした</strong>' + U.esc(msg) + "</div>";
  };

  /** サーバーアドレス表示用（標準ポートの場合は省略） */
  U.address = function (addr, port, defaultPort) {
    if (!addr) return "";
    return port && port !== defaultPort ? addr + ":" + port : addr;
  };
  U.javaAddress = function () { return U.address(CFG.javaAddress, CFG.javaPort, 25565); };

  /** Discord ボタンに URL を設定。未設定なら「準備中」にして無効化 */
  U.applyDiscord = function (el) {
    if (!el) return;
    if (CFG.discordUrl) {
      el.href = CFG.discordUrl;
    } else {
      el.removeAttribute("href");
      el.setAttribute("aria-disabled", "true");
      el.removeAttribute("target");
      el.textContent = "Discord（準備中）";
    }
  };

  /* ---------- Header / Footer ---------- */
  function renderHeader() {
    var el = document.getElementById("site-header");
    if (!el) return;
    var current = document.body.getAttribute("data-page");
    var links = NAV.map(function (n) {
      return (
        '<li><a href="' + n.href + '"' + (n.key === current ? ' aria-current="page"' : "") + ">" + n.label + "</a></li>"
      );
    }).join("");
    var discord = CFG.discordUrl
      ? '<a class="btn btn-gold btn-sm header-discord" href="' + U.esc(CFG.discordUrl) + '" target="_blank" rel="noopener">' + DISCORD_LABEL + "</a>"
      : "";
    if (CFG.discordUrl) {
      links += '<li class="nav-discord"><a href="' + U.esc(CFG.discordUrl) + '" target="_blank" rel="noopener">' + DISCORD_LABEL + "</a></li>";
    }
    el.className = "site-header";
    el.innerHTML =
      '<div class="container">' +
      '<a class="brand" href="index.html">' + BRAND_IMG +
      '<span class="brand-name">' + U.esc(CFG.serverName || "稲荷クラフト") + "</span></a>" +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="global-nav">' +
      '<span aria-hidden="true">☰</span>メニュー</button>' +
      '<nav class="global-nav" id="global-nav" aria-label="メインメニュー"><ul>' + links + "</ul></nav>" +
      discord +
      "</div>";
    var btn = el.querySelector(".nav-toggle");
    var nav = el.querySelector(".global-nav");
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function renderFooter() {
    var el = document.getElementById("site-footer");
    if (!el) return;
    var links = NAV.map(function (n) {
      return '<li><a href="' + n.href + '">' + n.label + "</a></li>";
    }).join("");
    var discord = CFG.discordUrl
      ? '<p style="margin:16px 0 0"><a class="btn btn-gold btn-sm" href="' + U.esc(CFG.discordUrl) + '" target="_blank" rel="noopener">' + DISCORD_LABEL + "</a></p>"
      : "";
    el.className = "site-footer";
    el.innerHTML =
      '<div class="container">' +
      '<div class="footer-grid">' +
      '<div><a class="brand" href="index.html">' + BRAND_IMG +
      '<span class="brand-name">' + U.esc(CFG.serverName || "稲荷クラフト") + "</span></a>" +
      '<p style="margin:10px 0 0">サバイバル × 経済 × 会社 × 自治体</p>' + discord + "</div>" +
      '<ul class="footer-links">' + links + "</ul>" +
      "</div>" +
      '<p class="footer-note">© ' + new Date().getFullYear() + " " + U.esc(CFG.serverName || "稲荷クラフト") +
      "　当サイトは非公式のファンサーバーのサイトであり、Mojang Studios および Microsoft とは関係ありません。" +
      "Minecraft は Mojang Synergies AB の商標です。</p>" +
      "</div>";
  }

  /* ---------- 控えめなフェードイン ---------- */
  U.observeReveal = function (root) {
    var items = (root || document).querySelectorAll(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (e) { e.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (e) { io.observe(e); });
  };

  window.Inari = U;

  document.addEventListener("DOMContentLoaded", function () {
    renderHeader();
    renderFooter();
    U.observeReveal();
  });
})();
