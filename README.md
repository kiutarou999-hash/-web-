# 稲荷クラフト 公式ホームページ

Minecraft サーバー「稲荷クラフト」の公式サイトです。
HTML / CSS / JavaScript だけで作られており、ビルド作業なしで GitHub Pages にそのまま公開できます。

## ページ一覧

| ファイル | 内容 |
| --- | --- |
| `index.html` | トップページ（紹介・特徴・サーバー状態・お知らせ・各ページへの導線） |
| `join.html` | 参加方法（Java版／統合版：Xboxフレンド参加・直接接続） |
| `market.html` | 市場相場（価格一覧・検索・並び替え・ワールドグループ切替・特需・価格推移グラフ） |
| `companies.html` | 会社ランキング（検索・項目別並び替え・上場状況での絞り込み） |
| `company.html?id=会社ID` | 会社詳細（順位・売上・社員・株価推移・会社概要） |
| `municipalities.html` | 自治体一覧 |

---

## 1. GitHub Pages で公開する

1. GitHub のリポジトリページを開き、**Settings → Pages** を開きます。
2. 「Build and deployment」の **Source** を「Deploy from a branch」にします。
3. **Branch** で公開したいブランチ（このサイトのファイルがあるブランチ、通常は `main`）と `/ (root)` を選び **Save**。
4. 数分後、`https://kiutarou999-hash.github.io/-web-/` で公開されます。

> 独自ドメインを使う場合は、`404.html` 内の `/-web-/` を `/` に変更してください。

## 2. サーバーアドレス・Discord URL を設定する

`assets/js/config.js` で管理しています。現在の設定値：

```js
javaAddress: "106.73.10.99",        // Java版アドレス
javaPort: 4466,                     // Java版ポート（表示は 106.73.10.99:4466）
bedrockAddress: "106.73.10.99",     // 統合版 直接接続アドレス
bedrockPort: 4466,                  // 統合版 直接接続ポート
bedrockFriendName: "InariPlay",     // 統合版 Xboxフレンド参加用の名前
supportedVersions: "26.2",          // 対応バージョン
discordUrl: "https://discord.gg/yrKgNeEyeR",
```

- 値を変えて保存するだけで、トップ・参加方法・ヘッダー・フッターすべてに反映されます。空欄にした項目は「準備中」と表示されます。
- トップページの**オンライン人数**は、`javaAddress:javaPort`（106.73.10.99:4466）を外部サービス mcsrvstat.us に問い合わせて表示しています（止めたい場合は `showOnlineStatus: false`）。

### 公式アイコン

`assets/img/` に、公式アイコン（64×64 ドットの画像）を整数倍で拡大縮小したファイルを置いています（縦横比を維持し、にじみなし）。

| ファイル | 用途 |
| --- | --- |
| `icon-128.png` | ヘッダー・フッターのロゴ |
| `icon-512.png` | トップページのメインビジュアル、OGP画像、スマホ用 |
| `icon-192.png` / `apple-touch-icon.png` | スマートフォンのホーム画面アイコン（`site.webmanifest`） |
| `favicon.ico` / `favicon-32.png` / `favicon-16.png` | ブラウザタブのアイコン（中央の金色のキャラクター部分を正方形に切り抜き） |

## 3. お知らせを追加する

`data/news.json` に項目を追加します。新しい日付のものが上に表示されます。

```json
{ "date": "2026-10-20", "tag": "イベント", "title": "収穫祭を開催します", "body": "詳細は Discord をご覧ください。" }
```

`tag` を `"重要"` にすると赤、`"イベント"` にすると金色のラベルになります。

---

## 4. データを更新する（市場・会社・自治体）

現在の `data/market.json`・`data/companies.json`・`data/municipalities.json` には
**表示確認用のサンプルデータ**が入っています（`"sample": true`）。
サンプルの間は各ページに「サンプルデータです」という注意書きが表示されます。
実データに差し替えたら、`"sample": true` を削除（または `false` に）してください。

### 市場相場 `data/market.json`

```json
{
  "updatedAt": "2026-10-10T12:00:00+09:00",
  "worldGroups": [ { "id": "main", "name": "メインワールド" } ],
  "items": [
    {
      "id": "wheat",
      "name": "小麦",
      "kana": "こむぎ",
      "category": "農作物",
      "image": "assets/img/items/wheat.png",
      "prices": { "main": { "buy": 12, "sell": 4 } }
    }
  ],
  "specialDemands": [
    { "worldGroup": "main", "itemId": "wheat", "multiplier": 1.5,
      "start": "2026-10-10T00:00:00+09:00", "end": "2026-10-17T23:59:00+09:00", "note": "収穫祭特需" }
  ]
}
```

- `buy` = 購入価格（プレイヤーがショップで買う値段）、`sell` = 売却価格（ショップに売る値段）。**ゲーム内（MoroMenuShop）の値をそのまま入れてください。**
- `prices` にそのワールドグループのキーがないアイテムは、そのグループでは表示されません。
- `kana`（読みがな）は任意です。入れるとひらがなでも検索できます。
- `image` は任意です。画像を `assets/img/items/` に置き、パスを指定します。未指定の場合は頭文字のアイコンが表示されます。
- 変動率は、`prices.main.change24h`（%）があればその値を、なければ価格履歴から自動計算します。履歴が足りない場合は「—」になります。

### 価格推移グラフ `data/market-history.json`

**履歴がないうちはグラフは「データ蓄積中」と表示され、架空の履歴は作りません。**
`market.json` を更新するたびに次のコマンドを実行すると、そのときの価格が履歴に1件追加されます（Node.js 18 以上が必要）。

```sh
node tools/update-history.mjs
```

- 30日分を保持し、それより古いものは自動で削除します。
- 同じ `updatedAt` のデータは二重に追加されません。
- `"sample": true` のデータは履歴に追加されません。
- 同時に、上場企業の現在株価が `companies.json` の各社 `stockHistory` に追加されます（365日分保持）。

履歴の形式（自前で出力する場合）：

```json
{ "updatedAt": "...", "groups": { "main": { "wheat": [ { "t": "2026-10-10T12:00:00+09:00", "buy": 12, "sell": 4 } ] } } }
```

### 会社 `data/companies.json`

```json
{
  "updatedAt": "2026-10-10T12:00:00+09:00",
  "companies": [
    {
      "id": "inari-shoji",
      "name": "稲荷商事",
      "rank": "A",
      "totalSales": 1250000,
      "employees": 12,
      "listed": true,
      "stockPrice": 1520,
      "president": "プレイヤー名",
      "foundedAt": "2026-05-01",
      "industry": "商社",
      "headquarters": "〇〇市",
      "description": "会社紹介文",
      "members": [ { "name": "プレイヤー名", "role": "社長" } ],
      "stockHistory": []
    }
  ]
}
```

- `id` は詳細ページの URL（`company.html?id=inari-shoji`）に使われます。半角英数字とハイフンがおすすめです。
- 順位は累計売上（`totalSales`）の多い順に自動で付きます。
- 会社ランクの並び順は `SSS > SS > S > A > B > C > D > E > F`、または数値です（`assets/js/companies-data.js` の `RANK_ORDER` で変更可）。
- 会社は全ワールドグループ共通です。

### 自治体 `data/municipalities.json`

```json
{ "id": "inari-city", "name": "稲荷市", "type": "市", "worldGroup": "メインワールド",
  "mayor": "プレイヤー名", "population": 18, "foundedAt": "2026-04-29",
  "description": "紹介文", "discordUrl": "" }
```

---

## 5. 今後の自動化について

サーバー側（プラグインや定期実行スクリプト）から上記形式の JSON を出力し、
`git commit` & `git push` → `node tools/update-history.mjs` を定期実行すれば、
サイトの相場・ランキング・グラフが自動で更新される構成になっています。

## ファイル構成

```
index.html / join.html / market.html / companies.html / company.html / municipalities.html / 404.html
assets/css/style.css        … デザイン
assets/js/config.js         … ★サイト設定（アドレス・Discord など）
assets/js/common.js         … ヘッダー・フッター・共通処理
assets/js/chart.js          … 軽量グラフ（外部ライブラリ不使用）
assets/js/*.js              … 各ページの処理
assets/img/                 … 画像（favicon、アイテム画像）
data/*.json                 … ★表示データ
tools/update-history.mjs    … 価格・株価履歴の蓄積スクリプト
```

当サイトは非公式のファンサーバーのサイトであり、Mojang Studios および Microsoft とは関係ありません。
