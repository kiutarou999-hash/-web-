#!/usr/bin/env node
/**
 * 本番公開スクリプト（Cloudflare Workers）
 *
 *   npm run release                         … デプロイ＋秘密鍵の登録＋動作確認
 *   npm run release -- --write-site-config  … さらに ../assets/js/config.js の liveApi を書き換える
 *   npm run release -- --verify-only        … 公開済みの Worker の動作確認だけ
 *   npm run release -- --verify-only --base=http://127.0.0.1:8787 … 指定した URL を確認（Cloudflare API を使わない）
 *
 * 必要な環境変数（値はログに出しません。リポジトリにも保存しません）:
 *   CLOUDFLARE_API_TOKEN   … 「Edit Cloudflare Workers」テンプレートで作った API トークン
 *   MORO_INGEST_SECRET     … サーバーの config.yml の web-sync.secret と同じ 32 文字以上の文字列
 *   CLOUDFLARE_ACCOUNT_ID  … 任意。トークンで複数のアカウントを扱える場合だけ必要
 *   WORKERS_SUBDOMAIN      … 任意。workers.dev のサブドメインが未作成のときに使う名前（既定 inari-craft）
 *
 * 動作確認では、公開データを書き換える送信は行いません。
 * 正しい署名で「中身のない稼働通知」を送り、Worker が署名を受け付けたうえで 409 を返すこと（＝状態は変わらない）を確認します。
 */
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.cloudflare.com/client/v4";
const SITE_ORIGIN = "https://kiutarou999-hash.github.io";
const args = new Set(process.argv.slice(2));
const token = process.env.CLOUDFLARE_API_TOKEN || "";
const secret = process.env.MORO_INGEST_SECRET || "";

function fail(message) {
  console.error("\n✖ " + message);
  process.exit(1);
}

function step(message) {
  console.log("\n▶ " + message);
}

async function cf(path, init = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function run(command, commandArgs, { input, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: { ...process.env, ...env, CI: "1", WRANGLER_SEND_METRICS: "false" },
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (d) => { output += d; process.stdout.write(d); });
    child.stderr.on("data", (d) => { output += d; process.stderr.write(d); });
    if (input !== undefined) {
      child.stdin.end(input);
    }
    child.on("close", (code) => resolve({ code, output }));
  });
}

function workerName() {
  const match = /^name\s*=\s*"([^"]+)"/m.exec(readFileSync(join(root, "wrangler.toml"), "utf8"));
  if (!match) fail("wrangler.toml に name がありません。");
  return match[1];
}

async function account() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const { status, body } = await cf("/accounts?per_page=50");
  if (status !== 200 || !body.success) fail("アカウント一覧を取得できませんでした（HTTP " + status + "）。トークンの権限に「Account Settings: Read」があるか確認してください。");
  if (body.result.length === 1) return body.result[0].id;
  fail("このトークンで扱えるアカウントが " + body.result.length + " 個あります。CLOUDFLARE_ACCOUNT_ID を設定してください。");
}

async function subdomain(accountId) {
  const current = await cf(`/accounts/${accountId}/workers/subdomain`);
  if (current.status === 200 && current.body.result && current.body.result.subdomain) return current.body.result.subdomain;
  const wanted = (process.env.WORKERS_SUBDOMAIN || "inari-craft").toLowerCase();
  for (const name of [wanted, wanted + "-live", wanted + "-" + Math.random().toString(36).slice(2, 6)]) {
    const created = await cf(`/accounts/${accountId}/workers/subdomain`, { method: "PUT", body: JSON.stringify({ subdomain: name }) });
    if (created.status === 200 && created.body.success) {
      console.log("  workers.dev のサブドメインを作成しました: " + name);
      return name;
    }
    console.log("  サブドメイン " + name + " は使えませんでした（" + JSON.stringify(created.body.errors || created.status) + "）");
  }
  fail("workers.dev のサブドメインを作成できませんでした。Cloudflare ダッシュボードの「Workers & Pages」を一度開き、サブドメインを決めてから再実行してください。");
}

async function retry(label, attempt, tries = 20, waitMs = 6000) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await attempt();
    } catch (error) {
      last = error;
      if (i === 0) console.log("  " + label + " … 反映待ち（新しい workers.dev は 1〜2 分かかることがあります）");
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw last;
}

function sign(timestamp, body) {
  return "v1=" + createHmac("sha256", secret).update(timestamp + "\n").update(body).digest("hex");
}

async function verify(base) {
  step("動作確認: " + base);
  await retry("稼働確認", async () => {
    const r = await fetch(base + "/v1/health");
    if (r.status !== 200) throw new Error("health " + r.status);
  });
  console.log("  ✓ /v1/health 200");

  const snap = await fetch(base + "/v1/snapshot", { headers: { Origin: SITE_ORIGIN } });
  const snapBody = await snap.json();
  if (snap.status !== 200 || snapBody.schema !== 1) fail("/v1/snapshot の応答が不正です（HTTP " + snap.status + "）");
  if (snap.headers.get("access-control-allow-origin") !== SITE_ORIGIN) fail("公式サイトからの読み込みが CORS で許可されていません。wrangler.toml の ALLOWED_ORIGINS を確認してください。");
  console.log("  ✓ /v1/snapshot 200（状態: " + snapBody.status + "）、公式サイトからの CORS 許可あり");

  const unsigned = await fetch(base + "/v1/ingest", { method: "POST", body: "{}" });
  if (unsigned.status !== 401) fail("署名のない送信が拒否されませんでした（HTTP " + unsigned.status + "）");
  console.log("  ✓ 署名のない送信は 401 で拒否");

  // 署名だけを確かめる送信。既存の状態は変わりません（Worker は 409 を返して何も書き込みません）。
  const sentAt = Date.now();
  const body = JSON.stringify({ kind: "heartbeat", sentAt, hash: "release-check" });
  const signedCheck = await retry("秘密鍵の反映", async () => {
    const r = await fetch(base + "/v1/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Moro-Timestamp": String(sentAt), "X-Moro-Signature": sign(sentAt, body) },
      body,
    });
    if (r.status === 503 || r.status === 401) throw new Error("ingest " + r.status);
    return r;
  }, 10, 5000).catch((e) => fail("正しい署名の送信が受け付けられませんでした（" + e.message + "）。MORO_INGEST_SECRET と Worker の INGEST_SECRET が一致しているか確認してください。"));
  if (signedCheck.status !== 409) fail("署名確認用の送信に想定外の応答（HTTP " + signedCheck.status + "）");
  console.log("  ✓ 正しい署名は受理（データは変更なし: 409）");
}

function writeSiteConfig(base) {
  const path = join(root, "..", "assets", "js", "config.js");
  const text = readFileSync(path, "utf8");
  const next = text.replace(/liveApi:\s*"[^"]*"/, `liveApi: "${base}"`);
  if (next === text) {
    console.log("  config.js の liveApi はすでに " + base + " です。");
    return;
  }
  writeFileSync(path, next);
  console.log("  ✓ assets/js/config.js の liveApi を " + base + " に設定しました（GitHub への反映は別途 commit/push）。");
}

if (secret.length < 32) fail("MORO_INGEST_SECRET が設定されていないか、32 文字未満です。");
const baseArg = [...args].find((a) => a.startsWith("--base="));
if (baseArg && args.has("--verify-only")) {
  await verify(baseArg.slice("--base=".length).replace(/\/+$/, ""));
  console.log("\n✔ 確認完了");
  process.exit(0);
}
if (!token) fail("CLOUDFLARE_API_TOKEN が設定されていません。");

step("API トークンの確認");
const verified = await cf("/user/tokens/verify");
if (verified.status !== 200 || !verified.body.success || verified.body.result?.status !== "active") {
  fail("API トークンが無効です（HTTP " + verified.status + "）。");
}
console.log("  ✓ トークンは有効です");
const accountId = await account();
const sub = await subdomain(accountId);
const base = `https://${workerName()}.${sub}.workers.dev`;

if (!args.has("--verify-only")) {
  step("デプロイ");
  const deployed = await run("npx", ["wrangler", "deploy"], { env: { CLOUDFLARE_ACCOUNT_ID: accountId } });
  if (deployed.code !== 0) fail("wrangler deploy に失敗しました。上のログを確認してください。");

  step("秘密鍵（INGEST_SECRET）の登録");
  const stored = await run("npx", ["wrangler", "secret", "put", "INGEST_SECRET"], { input: secret, env: { CLOUDFLARE_ACCOUNT_ID: accountId } });
  if (stored.code !== 0) fail("INGEST_SECRET の登録に失敗しました。");
}

await verify(base);
if (args.has("--write-site-config")) writeSiteConfig(base);

console.log("\n✔ 公開 URL: " + base);
console.log("  サーバーの config.yml: web-sync.endpoint に上記 URL、web-sync.secret に MORO_INGEST_SECRET と同じ値を設定し、enabled: true にして再起動してください。");
