# 稲荷クラフト 公式ホームページ

Minecraft サーバー「稲荷クラフト」の公式サイトです。
HTML / CSS / JavaScript だけで作られており、ビルド作業なしで GitHub Pages にそのまま公開できます。

## ページ一覧

| ファイル | 内容 |
| --- | --- |
| `index.html` | トップページ（紹介・特徴・サーバー状態・お知らせ・各ページへの導線） |
| `join.html` | 参加方法（Java版／統合版：Xboxフレンド参加・直接接続） |
| `market.html` | アイテム相場（プレイヤー市場ごとの価格・売却時の出品価格・検索・並び替え・価格推移グラフ） |
| `companies.html` | 会社一覧（順位・検索・項目別並び替え・上場状況での絞り込み） |
| `company.html?id=会社ID` | 会社詳細（順位・売上・社員・株価推移・会社概要） |
| `municipalities.html` | 自治体一覧（解散した自治体も表示） |
| `municipality.html?id=自治体ID` | 自治体詳細（首長・住民・税率・領域の地図） |

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

## 4. 予備：手動データで表示する（liveApi が空欄のとき）

現在はリアルタイム同期（次の章）で表示しているため、この章の作業は不要です。
`liveApi` を空欄に戻したときだけ、`data/*.json` の内容が表示されます。

`data/market.json`・`data/companies.json`・`data/municipalities.json` には
**表示確認用のサンプルデータ**が入っています（`"sample": true`）。
サンプルの間は各ページに「サンプルデータです」という注意書きが表示されます。
実データに差し替えたら、`"sample": true` を削除（または `false` に）してください。

### アイテム相場 `data/market.json`

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
- 会社ランクは MoroMenuShop と同じ数値（1〜4）で入れてください。
- 会社は全ワールドグループ共通です。

### 自治体 `data/municipalities.json`

```json
{ "id": "inari-city", "name": "稲荷市", "type": "市", "worldGroup": "メインワールド",
  "mayor": "プレイヤー名", "population": 18, "foundedAt": "2026-04-29",
  "description": "紹介文", "discordUrl": "" }
```

---

## 5. リアルタイム同期（MoroMenuShop と連携）

`assets/js/config.js` の `liveApi` に配信用 Worker の URL を設定すると、次の情報がゲーム内とほぼ同時（通常 5〜15 秒）に自動更新されます。
`data/*.json` の手動更新は不要になります。

- アイテム相場
- 価格の推移（24時間・7日間・30日間）
- 会社一覧
- 会社の詳細と株価の推移
- 自治体

仕組み:

```
MoroMenuShop（サーバー）──HTTPS・署名付き──▶ Cloudflare Worker（worker/）──読み取り専用──▶ このサイト
```

- 自宅サーバーは外へ送信するだけです。ポートを開ける必要はありません。サイトからゲームを操作することはできません。
- サーバーが停止したとき、または通信が途切れたときは、各ページの上部に「サーバー停止中」などの表示と最終更新日時が出ます。最後の情報はそのまま表示されます。
- 価格はゲーム内の現在の価格（基準価格）です。プレイヤーによって実際の支払額・受取額が異なる場合があります。
  - **旧公式ショップは使われていません**: ゲーム内の「購入」はプレイヤー市場を開くため、旧公式ショップの購入価格は表示しません。
  - **売却時の出品価格**: ゲーム内の「売却」（/s）で出品するときの基準価格です（MoroMenuShop の価格表 `prices.yml` の売却価格）。売れたときの受取額は市場の状況で変わります。
  - **プレイヤー市場**: data-group ごと（標準では常設ワールドと資源ワールドで共通）です。「購入時の価格」は手数料込みで、送料は含みません。「出品者の受取額」は売れたときに出品者が受け取る金額です。
- 会社の順位はゲーム内の会社ランキングと同じ「会社売上」（会社の自動販売機で社外のプレイヤーに売れた金額の合計）の順です。
  - 詳細ページの「累計売上（ランク判定）」は昇格条件に使われる別の記録で、会社売上と一致しないことがあります。
  - 社員数に社長は含みません。ランクは MoroMenuShop の数値ランク（1〜4）です。
- 自治体はワールドグループごとに独立しています。
- 税率は、自治体の領域内にある土地保護の保護料金のうち、自治体の収入になる割合です。
- 会社の業種・本社・設立日・社員名、自治体の Discord はプラグインにデータがないため、表示しません。
- 特需は MoroMenuShop に機能がないため、表示しません。
- 配信に接続できないときに、サンプルデータを本物として表示することはありません。

設定手順・無料枠の目安は [`worker/README.md`](worker/README.md) を、プラグイン側の設定は MoroMenuShop リポジトリの `docs/web-sync.md` を参照してください。

`liveApi` が空欄の間は、`data/*.json` を表示します（前の章の方法がそのまま使えます）。

## ファイル構成

```
index.html / join.html / market.html / companies.html / company.html / municipalities.html / 404.html
assets/css/style.css        … デザイン
assets/js/config.js         … ★サイト設定（アドレス・Discord など）
assets/js/common.js         … ヘッダー・フッター・共通処理
assets/js/chart.js          … 軽量グラフ（外部ライブラリ不使用）
assets/js/live.js           … リアルタイム同期（liveApi 設定時）
worker/                     … 配信用 Cloudflare Worker（サイトには影響しません）
assets/js/*.js              … 各ページの処理
assets/img/                 … 画像（favicon、アイテム画像）
data/*.json                 … ★表示データ
tools/update-history.mjs    … 価格・株価履歴の蓄積スクリプト
```

当サイトは非公式のファンサーバーのサイトであり、Mojang Studios および Microsoft とは関係ありません。
