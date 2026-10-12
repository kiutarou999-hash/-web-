/* =========================================================
   リアルタイム同期（MoroMenuShop → Cloudflare Worker → このサイト）
   config.js の liveApi が設定されているときだけ動作します。
   未設定なら各ページは従来どおり data/*.json を表示します。
   ========================================================= */
(function () {
  "use strict";
  var U = window.Inari;
  var CFG = window.SITE_CONFIG || {};
  var L = {};

  var historyCache = {};

  L.enabled = function () {
    return typeof CFG.liveApi === "string" && /^https?:\/\//.test(CFG.liveApi);
  };

  function api(path) {
    return CFG.liveApi.replace(/\/+$/, "") + path;
  }

  function pollMs() {
    var s = Number(CFG.livePollSeconds);
    return (isFinite(s) && s >= 10 ? s : 10) * 1000;
  }

  /** 最新データを1回取得します。 */
  L.load = function () {
    return fetch(api("/v1/snapshot"), { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("配信サーバーの応答が不正です (" + r.status + ")");
      return r.json();
    }).then(function (s) {
      if (!s || s.schema !== 1) throw new Error("対応していないデータ形式です");
      return s;
    });
  };

  /**
   * 定期取得。ページが表示されている間だけ取得し、データか状態が変わったときに onUpdate(state) を呼びます。
   * 通信に失敗したときは onError(error, lastState) を呼び、間隔を延ばして再試行します。
   */
  L.watch = function (onUpdate, onError) {
    var last = null, lastKey = "", timer = null, failures = 0;
    function schedule(ms) {
      clearTimeout(timer);
      timer = setTimeout(tick, ms);
    }
    function tick() {
      if (document.visibilityState === "hidden") return;
      L.load().then(function (s) {
        failures = 0;
        var key = s.status + ":" + s.generatedAt + ":" + (s.status === "online" ? "" : s.lastSeenAt);
        last = s;
        if (key !== lastKey) {
          lastKey = key;
          onUpdate(s);
        }
        schedule(s.status === "online" ? pollMs() : Math.max(pollMs(), 60000));
      }).catch(function (e) {
        failures++;
        if (onError) onError(e, last);
        schedule(Math.min(300000, pollMs() * Math.pow(2, Math.min(failures, 4))));
      });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") schedule(0);
      else clearTimeout(timer);
    });
    tick();
  };

  /** 価格・株価の履歴。points は [時刻, a, b] の配列です。 */
  L.history = function (series, range) {
    var key = series + "|" + range;
    var hit = historyCache[key];
    if (hit && Date.now() - hit.at < 30000) return Promise.resolve(hit.points);
    return fetch(api("/v1/history?series=" + encodeURIComponent(series) + "&range=" + encodeURIComponent(range)), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("履歴を取得できませんでした (" + r.status + ")");
        return r.json();
      }).then(function (d) {
        historyCache[key] = { at: Date.now(), points: d.points || [] };
        return d.points || [];
      });
  };

  function time(ms) {
    if (!U.isNum(ms) || ms <= 0) return "—";
    var d = new Date(ms);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return U.date(d, true) + ":" + p(d.getSeconds());
  }
  L.time = time;

  L.iso = function (ms) {
    return U.isNum(ms) && ms > 0 ? new Date(ms).toISOString() : null;
  };

  /** ページ上部に出す稼働状態の表示。 */
  L.statusHtml = function (s, error) {
    var cls, title, text;
    if (error && !s) {
      cls = "off"; title = "配信サーバーに接続できません";
      text = "しばらくしてから再読み込みしてください。";
    } else if (error) {
      cls = "off"; title = "配信サーバーとの通信が途切れています";
      text = "表示中の情報は " + time(s.generatedAt) + " 時点のものです。自動で再接続します。";
    } else if (s.status === "waiting") {
      cls = ""; title = "サーバーからのデータ待ち";
      text = "まだゲームサーバーからデータが届いていません。";
    } else if (s.status === "online") {
      cls = "on"; title = "リアルタイム表示中";
      text = "ゲーム内の最新情報（" + time(s.generatedAt) + " 時点）を表示しています。自動で更新されます。";
    } else if (s.status === "stopped") {
      cls = "off"; title = "サーバー停止中";
      text = "ゲームサーバーは停止しています。表示中の情報は停止前の最終更新（" + time(s.generatedAt) + "）時点のものです。";
    } else {
      cls = "off"; title = "サーバーと通信できません";
      text = "最後の受信は " + time(s.lastSeenAt) + " です。表示中の情報は " + time(s.generatedAt) + " 時点のものです。";
    }
    return '<div class="live-status' + (cls ? " is-" + cls : "") + '" role="status">' +
      '<span class="status-dot' + (cls ? " " + cls : "") + '"></span>' +
      "<div><strong>" + U.esc(title) + "</strong>" + U.esc(text) + "</div></div>";
  };

  /*
   * サーバーの config.yml に display-name がないワールドグループは、ID（例: resource）がそのまま名前として届きます。
   * その場合だけ、MoroMenuShop の既定設定（src/main/resources/config.yml）と同じ表示名を使います。
   */
  var DEFAULT_GROUP_NAMES = { permanent: "常設ワールド", resource: "資源ワールド", tutorial: "チュートリアル", hub: "Hub" };
  function groupName(id, name) {
    if (name && name !== id) return name;
    return DEFAULT_GROUP_NAMES[id] || name || id || "";
  }

  function change(map, series, index) {
    var v = map && map[series];
    return v && U.isNum(v[index]) ? v[index] : null;
  }

  /* ---------- ページ用のデータ形式へ変換 ---------- */

  /** 市場：「公式ショップ（全体共通）」と「data-group ごとのプレイヤー市場」をタブに分けます。 */
  L.toMarket = function (s) {
    var d = s.data || {};
    var ch = s.change24h || {};
    var wgName = {};
    (d.worldGroups || []).forEach(function (g) { wgName[g.id] = groupName(g.id, g.name); });
    var groups = [{ id: "official", name: "公式ショップ（全ワールド共通）", kind: "official" }];
    ((d.playerMarket || {}).dataGroups || []).forEach(function (g) {
      // 出品が1件もない data-group（テスト用ワールドなど）はタブを出しません。
      if (!(g.items || []).length) return;
      groups.push({
        id: "market:" + g.id,
        kind: "market",
        name: "プレイヤー市場（" + (g.worldGroups || []).map(function (id) { return wgName[id] || id; }).join("・") + "）"
      });
    });
    var items = {}, order = [];
    function item(id, name, category) {
      if (!items[id]) {
        items[id] = { id: id, name: name, category: category || "その他", image: "", prices: {} };
        order.push(id);
      }
      return items[id];
    }
    ((d.officialShop || {}).items || []).forEach(function (i) {
      item(i.id, i.name, i.categoryName).prices.official = {
        buy: i.buy, sell: i.sell,
        change24h: change(ch, "o:" + i.id, 0),
        series: "o:" + i.id, buyIndex: 1, sellIndex: 2
      };
    });
    ((d.playerMarket || {}).dataGroups || []).forEach(function (g) {
      (g.items || []).forEach(function (i) {
        var series = "m:" + g.id + ":" + i.id;
        item(i.id, i.name, null).prices["market:" + g.id] = {
          buy: i.lowestBuyerPrice, sell: i.lowestUnitPrice, available: i.available, offers: i.offers,
          change24h: change(ch, series, 1),
          series: series, buyIndex: 2, sellIndex: 1
        };
      });
    });
    return {
      live: true,
      updatedAt: L.iso(s.generatedAt),
      worldGroups: groups,
      buyerFeeMultiplier: (d.playerMarket || {}).buyerFeeMultiplier,
      items: order.map(function (id) { return items[id]; }),
      specialDemands: [],
      specialDemandSupported: !!(d.specialDemands && d.specialDemands.supported)
    };
  };

  /** 会社：順位はゲーム内の会社ランキング（自動販売機の売上順）と同じです。 */
  L.toCompanies = function (s) {
    var d = s.data || {};
    var ch = s.change24h || {};
    var list = (d.companies || []).map(function (c) {
      return {
        id: String(c.id),
        name: c.name,
        rank: c.rank,
        totalSales: c.rankingSales,
        rankRevenue: c.rankRevenue,
        employees: c.employees,
        members: c.members,
        listed: !!c.listed,
        stockPrice: c.listed ? c.sharePrice : null,
        stockChange24h: change(ch, "s:" + c.id, 0),
        initialSharePrice: c.initialSharePrice,
        totalShares: c.totalShares,
        availableShares: c.availableShares,
        // 一度もこのサーバーに来ていない等で名前が分からないときは「不明」と表示します（UUID は公開しません）。
        president: c.president && c.president.name ? c.president.name : "不明",
        presidentEdition: c.president ? c.president.edition : "",
        nextRank: c.nextRank || null,
        rankNo: U.isNum(c.rankingPosition) ? c.rankingPosition : null,
        stockSeries: "s:" + c.id
      };
    });
    return { live: true, sample: false, updatedAt: L.iso(s.generatedAt), companies: list };
  };

  /** 自治体：world-group ごとに分かれています（data-group は参考表示）。 */
  L.toMunicipalities = function (s) {
    var d = s.data || {};
    var list = (d.municipalities || []).map(function (m) {
      return {
        id: String(m.id),
        name: m.name,
        type: m.stageName,
        stage: m.stage,
        worldGroup: groupName(m.worldGroup, m.worldGroupName),
        worldGroupId: m.worldGroup,
        dataGroup: m.dataGroup,
        mayor: m.leader && m.leader.name ? m.leader.name : "不明",
        mayorEdition: m.leader ? m.leader.edition : "",
        mayorTitle: m.leaderTitle || "首長",
        population: m.residents,
        taxRate: m.taxRate,
        foundedAt: L.iso(m.createdAt),
        description: m.profile || "",
        center: m.center || null,
        territory: m.territory || { chunks: 0 }
      };
    });
    var dissolved = (d.dissolvedMunicipalities || []).map(function (m) {
      return { id: String(m.id), name: m.name, type: m.stageName, dissolvedAt: L.iso(m.dissolvedAt) };
    });
    return { live: true, sample: false, updatedAt: L.iso(s.generatedAt), municipalities: list, dissolved: dissolved };
  };

  /**
   * ページ共通の読み込み。
   *  opts.staticPath … liveApi 未設定時に読む data/*.json
   *  opts.adapt(state) … 配信データをページ用の形に変換
   *  opts.render(data, info) … info = { live, sample, state }
   *  opts.status(html) … 稼働状態の表示先
   *  opts.fail(message) … 表示できるデータがないとき
   * 配信に接続できないときにサンプルデータを本物として表示することはありません。
   */
  L.connect = function (opts) {
    function loadStatic(liveError) {
      return U.fetchJSON(opts.staticPath).then(function (d) {
        if (liveError && d && d.sample) {
          opts.status(L.statusHtml(null, liveError));
          opts.fail("リアルタイム配信に接続できず、表示できる実データがありません。");
          return;
        }
        if (liveError) opts.status(L.statusHtml(null, liveError));
        opts.render(d, { live: false, sample: !!(d && d.sample), state: null });
      });
    }
    if (!L.enabled()) {
      loadStatic(null).catch(function (e) { opts.fail(e.message); });
      return;
    }
    var shown = false, fellBack = false;
    L.watch(function (s) {
      shown = true;
      opts.status(L.statusHtml(s));
      if (s.status === "waiting" || !s.data) {
        opts.fail("ゲームサーバーからのデータを待っています。サーバーが起動すると自動で表示されます。");
        return;
      }
      opts.render(opts.adapt(s), { live: true, sample: false, state: s });
    }, function (e, last) {
      if (shown && last) {
        opts.status(L.statusHtml(last, e));
      } else if (!fellBack) {
        fellBack = true;
        loadStatic(e).catch(function () {
          opts.status(L.statusHtml(null, e));
          opts.fail("データを読み込めませんでした。");
        });
      }
    });
  };

  /** 統合版プレイヤーの印。 */
  L.editionBadge = function (edition) {
    return edition === "bedrock" ? ' <span class="badge badge-gray" title="統合版（Bedrock）プレイヤー">統合版</span>' : "";
  };

  window.InariLive = L;
})();
