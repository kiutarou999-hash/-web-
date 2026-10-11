// Worker の結合テスト：ローカルの `wrangler dev`（Durable Object も含む）を起動して HTTP で確認します。
// 実行: cd worker && npm install && npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { seriesValues, verifySignature } from "../src/index.js";

const SECRET = "test-secret-0123456789abcdef0123456789";
const PORT = 18787 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let dev;
let persist;
let clock = Date.now();

function sign(timestamp, body, secret = SECRET) {
  return "v1=" + createHmac("sha256", secret).update(timestamp + "\n").update(body).digest("hex");
}

async function post(message, { secret = SECRET, timestamp, signature } = {}) {
  const body = JSON.stringify(message);
  const ts = String(timestamp ?? message.sentAt);
  return fetch(`${BASE}/v1/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Moro-Timestamp": ts, "X-Moro-Signature": signature ?? sign(ts, body, secret) },
    body,
  });
}

function next() {
  clock = Math.max(clock + 1, Date.now());
  return clock;
}

function snapshot(wheatBuy = 12, sharePrice = 150) {
  return {
    schema: 1,
    server: { onlinePlayers: 1, maxPlayers: 20, tps: 20 },
    worldGroups: [{ id: "permanent", name: "常設ワールド", dataGroup: "survival", marketEnabled: true, municipalityEnabled: true }],
    officialShop: { scope: "global", items: [{ id: "wheat", material: "WHEAT", name: "小麦", category: "FOOD", categoryName: "食料系", buy: wheatBuy, sell: 4, baseBuy: 12 }] },
    playerMarket: { buyerFeeMultiplier: 1.5, dataGroups: [{ id: "survival", worldGroups: ["permanent"], items: [{ id: "diamond", material: "DIAMOND", name: "ダイヤモンド", available: 3, offers: 1, lowestUnitPrice: 100, lowestBuyerPrice: 150, listedTotal: 3, purchasedTotal: 0 }] }] },
    specialDemands: { supported: false, items: [] },
    companies: [{ id: 1, name: "稲荷商事", rank: 2, listed: true, sharePrice }],
    municipalities: [],
    dissolvedMunicipalities: [],
  };
}

before(async () => {
  persist = mkdtempSync(join(tmpdir(), "inari-live-"));
  dev = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--ip", "127.0.0.1", "--persist-to", persist,
    "--var", `INGEST_SECRET:${SECRET}`, "--var", "EDGE_CACHE_SECONDS:0", "--var", "OFFLINE_AFTER_SECONDS:3"],
  { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" } });
  let log = "";
  dev.stdout.on("data", (d) => { log += d; });
  dev.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/v1/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("wrangler dev did not start:\n" + log);
});

after(async () => {
  // wrangler stops its workerd child on Ctrl+C; signal the whole process group and wait for it to exit.
  const exited = new Promise((resolve) => dev.once("exit", resolve));
  try { process.kill(-dev.pid, "SIGINT"); } catch {}
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
  try { process.kill(-dev.pid, "SIGKILL"); } catch {}
  dev?.stdout.destroy();
  dev?.stderr.destroy();
  if (persist) rmSync(persist, { recursive: true, force: true });
});

test("snapshot before any data says it is waiting", async () => {
  const r = await fetch(`${BASE}/v1/snapshot`);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.status, "waiting");
  assert.equal(body.data, null);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
});

test("unsigned, wrongly signed and stale messages are refused", async () => {
  const message = { kind: "snapshot", sentAt: next(), hash: "h1", snapshot: snapshot() };
  assert.equal((await post(message, { secret: "another-secret-0123456789abcdef0123" })).status, 401);
  assert.equal((await post(message, { signature: "" })).status, 401);
  const old = Date.now() - 10 * 60 * 1000;
  assert.equal((await post({ ...message, sentAt: old })).status, 401);
  assert.equal((await post(message, { timestamp: message.sentAt + 1, signature: sign(message.sentAt + 1, JSON.stringify(message)) })).status, 400);
  const r = await fetch(`${BASE}/v1/snapshot`);
  assert.equal((await r.json()).status, "waiting", "a refused message changes nothing");
});

test("a signed snapshot is published read-only with its status", async () => {
  const sentAt = next();
  const r = await post({ kind: "snapshot", sentAt, hash: "h1", snapshot: snapshot() });
  assert.equal(r.status, 200, await r.text());
  const body = await (await fetch(`${BASE}/v1/snapshot`)).json();
  assert.equal(body.status, "online");
  assert.equal(body.generatedAt, sentAt);
  assert.equal(body.data.officialShop.items[0].buy, 12);
  assert.equal(body.data.companies[0].sharePrice, 150);
  assert.equal((await post({ kind: "snapshot", sentAt, hash: "h1", snapshot: snapshot() })).status, 409, "replays are refused");
  assert.equal((await fetch(`${BASE}/v1/snapshot`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${BASE}/v1/ingest`)).status, 405);
});

test("an unchanged snapshot is revalidated with a 304 instead of resending the body", async () => {
  const first = await fetch(`${BASE}/v1/snapshot`);
  const etag = first.headers.get("etag");
  assert.ok(etag);
  await first.text();
  const again = await fetch(`${BASE}/v1/snapshot`, { headers: { "If-None-Match": etag } });
  assert.equal(again.status, 304);
  assert.equal(again.headers.get("access-control-allow-origin"), "*");
});

test("heartbeats need the current snapshot hash", async () => {
  assert.equal((await post({ kind: "heartbeat", sentAt: next(), hash: "other" })).status, 409);
  assert.equal((await post({ kind: "heartbeat", sentAt: next(), hash: "h1" })).status, 200);
});

test("price and share price changes are kept as history", async () => {
  assert.equal((await post({ kind: "snapshot", sentAt: next(), hash: "h2", snapshot: snapshot(13, 160) })).status, 200);
  const prices = await (await fetch(`${BASE}/v1/history?series=${encodeURIComponent("o:wheat")}&range=24h`)).json();
  assert.ok(prices.points.length >= 1);
  assert.deepEqual(prices.points.at(-1).slice(1), [13, 4]);
  const shares = await (await fetch(`${BASE}/v1/history?series=s:1&range=7d`)).json();
  assert.equal(shares.points.at(-1)[1], 160);
  const market = await (await fetch(`${BASE}/v1/history?series=${encodeURIComponent("m:survival:diamond")}&range=30d`)).json();
  assert.deepEqual(market.points.at(-1).slice(1), [100, 150]);
  assert.equal((await fetch(`${BASE}/v1/history?series=x:1&range=24h`)).status, 400);
  assert.equal((await fetch(`${BASE}/v1/history?series=o:wheat&range=5y`)).status, 400);
});

test("silence turns the status offline and a shutdown notice turns it stopped, keeping the last data", async () => {
  await new Promise((r) => setTimeout(r, 3500));
  let body = await (await fetch(`${BASE}/v1/snapshot`)).json();
  assert.equal(body.status, "offline");
  assert.equal(body.data.officialShop.items[0].buy, 13);
  assert.equal((await post({ kind: "heartbeat", sentAt: next(), hash: "h2" })).status, 200);
  assert.equal((await (await fetch(`${BASE}/v1/snapshot`)).json()).status, "online");
  assert.equal((await post({ kind: "shutdown", sentAt: next() })).status, 200);
  body = await (await fetch(`${BASE}/v1/snapshot`)).json();
  assert.equal(body.status, "stopped");
  assert.equal(body.data.officialShop.items[0].buy, 13);
});

test("series names cover the official shop, each market data group and listed companies", () => {
  const values = seriesValues(snapshot(12, 150));
  assert.deepEqual(values["o:wheat"], [12, 4]);
  assert.deepEqual(values["m:survival:diamond"], [100, 150]);
  assert.deepEqual(values["s:1"], [150, null]);
});

test("the Worker accepts exactly the signature format MoroMenuShop sends", async () => {
  const body = new TextEncoder().encode('{"kind":"heartbeat","sentAt":1,"hash":"x"}');
  const header = sign("1", Buffer.from(body));
  assert.equal(await verifySignature(SECRET, "1", body, header), true);
  assert.equal(await verifySignature(SECRET, "2", body, header), false);
  assert.equal(await verifySignature(SECRET, "1", body, header.toUpperCase()), false);
});
