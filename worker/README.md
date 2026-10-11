# 稲荷クラフト リアルタイム同期 Worker

MoroMenuShop（Minecraft サーバー）から届く公開データを受け取り、公式サイトへ読み取り専用で配信する
Cloudflare Worker です。Cloudflare の無料プラン（Workers Free＋SQLite 版 Durable Objects）で動きます。

```
MoroMenuShop ──(HTTPS POST・HMAC 署名)──▶ この Worker ──(GET・公開データ)──▶ 公式サイト
```

| URL | 内容 |
| --- | --- |
| `POST /v1/ingest` | サーバーからの送信。署名がないもの、5 分以上ずれた時刻のもの、再送されたものは拒否します |
| `GET /v1/snapshot` | 最新データ、稼働状態（`online` / `offline` / `stopped` / `waiting`）、24 時間変動率 |
| `GET /v1/history?series=…&range=24h\|7d\|30d\|90d\|1y\|all` | 価格・株価の履歴 |
| `GET /v1/health` | 稼働確認 |

履歴の系列名:
- `o:<アイテムID>` … 公式ショップ（a=購入価格, b=売却価格）
- `m:<data-group>:<アイテムID>` … プレイヤー市場（a=出品者受取額, b=購入額）
- `s:<会社ID>` … 株価

## はじめて公開する手順

1. Cloudflare の無料アカウントを作ります（クレジットカードは不要です）。
2. このフォルダで次を実行します（Node.js 18 以上が必要）。
   ```sh
   cd worker
   npm install
   npx wrangler login
   npx wrangler secret put INGEST_SECRET   # 32文字以上のランダム文字列を入力
   npx wrangler deploy
   ```
   表示された `https://inari-craft-live.<アカウント>.workers.dev` が配信 URL です。
3. サーバーの `plugins/MoroMenuShop/config.yml` に、次を設定します。
   - `web-sync.enabled: true`
   - `endpoint`: 配信 URL
   - `secret`: 手順 2 と同じ文字列
   
   設定したらサーバーを再起動します。詳しくは MoroMenuShop の `docs/web-sync.md` を参照してください。
4. サイトの `assets/js/config.js` の `liveApi` に配信 URL を書いて、GitHub に反映します。
   `liveApi` は公開して問題ない読み取り専用の URL です。秘密の文字列は書かないでください。
5. 必要なら、`wrangler.toml` の `ALLOWED_ORIGINS` をサイトの URL（例: `https://kiutarou999-hash.github.io`）に絞ります。

## 無料枠の目安

Workers Free の制限は、リクエスト 10 万回/日、Durable Object（SQLite）の書き込み 10 万行/日、読み込み 500 万行/日、保存 5GB です。
料金や制限は変わることがあるので、公開前に Cloudflare の公式ページで確認してください。

- **サーバー → Worker**
  - 変化があるとき最大 5 秒に 1 回、変化がないときは 30 秒に 1 回です。
  - 履歴は、価格が変わった系列だけを 1 分に 1 行書き込みます。
- **閲覧者 → Worker**
  - サイトを開いている間だけ 10 秒ごとに取得します（タブを裏に回すと止まります）。
  - 変化がなければ 304（本文なし）で返します。
- 1 日に延べ約 200 時間以上ページが開かれる規模になったら、`config.js` の `livePollSeconds` を 20〜30 に延ばすか、Workers Paid（月額 5 ドル〜）を検討してください。
- 上限を超えると、その日（UTC）の残りはサイトに「接続できません」と表示されます。ゲームには影響しません。

## 履歴の保存期間

- 31 日以内: 1 分単位
- 31〜400 日: 1 時間単位に間引き
- 400 日を超えたもの: 削除（1 日 1 回の自動処理）

## テスト

```sh
npm install
npm test     # ローカルの wrangler dev を起動して、署名・再送拒否・履歴・停止表示・304 を確認します
```

## 運用上の注意

- `INGEST_SECRET` が漏れた場合は、新しい値に変えて `wrangler secret put INGEST_SECRET` を再実行し、`config.yml` も同じ値に変更します。
- データを全部消したいときは、Cloudflare のダッシュボードで Durable Object（`LiveHub`）を削除します。履歴も消えるので、実行前に確認してください。
