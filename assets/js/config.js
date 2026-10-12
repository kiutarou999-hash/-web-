/*
 * ===========================================================
 *  稲荷クラフト サイト設定ファイル
 * ===========================================================
 *  サーバーアドレスや Discord の招待URLなどはここで変更します。
 *  値を "" (空文字) のままにすると、サイト上では「準備中」と表示されます。
 *  編集後は保存して GitHub に反映するだけでサイトに反映されます。
 */
window.SITE_CONFIG = {
  // サーバー名
  serverName: "稲荷クラフト",

  // キャッチコピー（トップページに表示）
  tagline: "実りを育て、市場を動かし、街をつくる。",

  // ---- 接続情報 ----
  // Java版のサーバーアドレス（例: "play.inari-craft.jp"）
  javaAddress: "106.73.10.99",
  // Java版のポート（通常は 25565。25565 の場合は表示されません）
  javaPort: 4466,

  // 統合版（Bedrock）のサーバーアドレス（Java版と同じなら同じ値を入れてください）
  bedrockAddress: "106.73.10.99",
  // 統合版のポート（通常は 19132）
  bedrockPort: 4466,

  // 統合版で Xbox フレンド機能から参加する場合のフレンド名（ゲーマータグ）
  bedrockFriendName: "InariPlay",

  // 対応バージョン（例: "1.21.x"）
  supportedVersions: "26.2",

  // ゲーム内通貨の単位（例: "円"）
  currencyUnit: "円",

  // ---- リンク ----
  // Discord の招待URL（例: "https://discord.gg/xxxxxxx"）
  discordUrl: "https://discord.gg/yrKgNeEyeR",

  // ---- オンライン人数表示 ----
  // javaAddress が設定されている場合、外部API (mcsrvstat.us) で現在の人数を取得します。
  // 問い合わせ先は「javaAddress:javaPort」（例: 106.73.10.99:4466）です。
  // 表示したくない場合は false にしてください。
  showOnlineStatus: true,
  onlineStatusApi: "https://api.mcsrvstat.us/3/",

  // ---- リアルタイム同期（MoroMenuShop → Cloudflare Worker） ----
  // 配信用 Worker の URL（例: "https://inari-craft-live.xxxx.workers.dev"）。
  // 設定すると、市場相場・会社・自治体・株価がゲーム内とほぼ同時（10〜20秒程度）に更新されます。
  // 空欄のままなら、従来どおり data/*.json を表示します。秘密の鍵はここに書かないでください（読み取り専用の URL だけです）。
  liveApi: "https://inari-craft-live.kiutarou999.workers.dev",
  // 再取得の間隔（秒、10 以上）。ページを開いている間だけ取得します。
  livePollSeconds: 10,

  // ---- データファイルの場所（通常は変更不要） ----
  dataPath: {
    news: "data/news.json",
    market: "data/market.json",
    marketHistory: "data/market-history.json",
    companies: "data/companies.json",
    municipalities: "data/municipalities.json"
  }
};
