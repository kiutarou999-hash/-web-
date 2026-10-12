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

公開作業は `npm run release` でまとめて行います。このコマンドは次を順に実行します。

1. API トークンを確認する
2. workers.dev のサブドメインを用意する（未作成なら `inari-craft` などで作成）
3. デプロイする
4. 秘密鍵 `INGEST_SECRET` を登録する
5. 動作確認をする

### 1. API トークンと秘密鍵を用意する（運営者の作業）

1. Cloudflare ダッシュボードで、右上のアイコン → **My Profile** → **API Tokens** → **Create Token** を開きます。
   - テンプレート **Edit Cloudflare Workers** を選びます。
   - Account Resources: 自分のアカウント
   - Zone Resources: All zones（ゾーンがなくても可）
   - 作成されたトークンは一度しか表示されません。
2. サーバーと Worker で共有する秘密の文字列を、自分の PC で作ります（PowerShell の例）。
   ```powershell
   $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```
   この文字列は、サーバーの `plugins/MoroMenuShop/config.yml` の `web-sync.secret` にも書きます。
   公開リポジトリ、サイト、チャット、Discord には貼らないでください。

### 2. 公開する

次の環境変数を設定してから実行します。

- `CLOUDFLARE_API_TOKEN`: 1-1 のトークン
- `MORO_INGEST_SECRET`: 1-2 の文字列
- `CLOUDFLARE_ACCOUNT_ID`: 任意。トークンで複数のアカウントを扱える場合だけ必要です。

Claude Code のクラウド環境で実行する場合は、環境設定の Secrets（または Environment variables）に登録してください。

```sh
cd worker
npm install
npm run release -- --write-site-config   # 公開して、サイトの config.js の liveApi も書き換える
```

最後に表示される `https://inari-craft-live.<サブドメイン>.workers.dev` が配信 URL です。
`--write-site-config` で書き換えた `assets/js/config.js` を commit / push すると、サイトがリアルタイム表示になります。

### 3. サーバーを設定する（運営者の作業）

`plugins/MoroMenuShop/config.yml` に次を設定して、サーバーを再起動します。

```yaml
web-sync:
  enabled: true
  endpoint: "https://inari-craft-live.<サブドメイン>.workers.dev"
  secret: "<1-2 で作った文字列>"
```

`/websync` に「秒前に成功」と表示されれば完了です。詳しくは MoroMenuShop の `docs/web-sync.md` を参照してください。

### 自分の PC から公開する場合

`npx wrangler login`（ブラウザでログイン）→ `npx wrangler deploy` → `npx wrangler secret put INGEST_SECRET` の順に実行しても公開できます。
公開後の確認は、次のコマンドで行えます。

```sh
MORO_INGEST_SECRET=... npm run release -- --verify-only --base=<配信URL>
```

### 読み込みを許可するサイト

`wrangler.toml` の `ALLOWED_ORIGINS` で、ブラウザからデータを読めるサイトを `https://kiutarou999-hash.github.io` に限定しています（他サイトの埋め込みで無料枠を消費されないため）。
独自ドメインに移行したら、そのオリジンを追加して再デプロイしてください。

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
