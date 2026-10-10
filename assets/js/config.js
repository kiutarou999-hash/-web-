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
  javaAddress: "",
  // Java版のポート（通常は 25565。25565 の場合は表示されません）
  javaPort: 25565,

  // 統合版（Bedrock）のサーバーアドレス（Java版と同じなら同じ値を入れてください）
  bedrockAddress: "",
  // 統合版のポート（通常は 19132）
  bedrockPort: 19132,

  // 対応バージョン（例: "1.21.x"）
  supportedVersions: "",

  // ゲーム内通貨の単位（例: "円"）
  currencyUnit: "円",

  // ---- リンク ----
  // Discord の招待URL（例: "https://discord.gg/xxxxxxx"）
  discordUrl: "",

  // ---- オンライン人数表示 ----
  // javaAddress が設定されている場合、外部API (mcsrvstat.us) で現在の人数を取得します。
  // 表示したくない場合は false にしてください。
  showOnlineStatus: true,
  onlineStatusApi: "https://api.mcsrvstat.us/3/",

  // ---- データファイルの場所（通常は変更不要） ----
  dataPath: {
    news: "data/news.json",
    market: "data/market.json",
    marketHistory: "data/market-history.json",
    companies: "data/companies.json",
    municipalities: "data/municipalities.json"
  }
};
