/**
 * 稲荷クラフト リアルタイム同期 Worker
 *
 * MoroMenuShop から HMAC 署名付きで届く公開データ（市場相場・会社・自治体）を受け取り、
 * 最新データと価格・株価の履歴を Durable Object（SQLite）に保存して、公式サイトへ読み取り専用で配信します。
 *
 *   POST /v1/ingest           … サーバーからの送信（署名必須）
 *   GET  /v1/snapshot         … 最新データ＋稼働状態＋24時間変動率
 *   GET  /v1/history?series=… … 価格・株価の履歴（range=24h|7d|30d|90d|1y|all）
 *   GET  /v1/health           … 稼働確認
 *
 * Web 側からゲームの情報を変更する経路はありません。
 */

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const OFFLINE_AFTER_MS = 90 * 1000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const RAW_RETENTION_MS = 31 * DAY;
const HOURLY_RETENTION_MS = 400 * DAY;
const SNAPSHOT_EDGE_TTL_MS = 5 * 1000;
const HISTORY_EDGE_TTL_MS = 30 * 1000;
const MAX_HISTORY_POINTS = 600;
const RANGES = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY, "90d": 90 * DAY, "1y": 365 * DAY, all: Infinity };
const SERIES_PATTERN = /^[oms]:[^\u0000-\u001f]{1,200}$/;

// Per-isolate response cache: many browsers polling the same isolate share one Durable Object request.
const edgeCache = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    try {
      if (url.pathname === "/v1/ingest") {
        if (request.method !== "POST") return json({ error: "method not allowed" }, 405, cors);
        return await ingest(request, env);
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method not allowed" }, 405, cors);
      }
      if (url.pathname === "/v1/snapshot") {
        return await cached("snapshot", edgeTtl(env, SNAPSHOT_EDGE_TTL_MS), () => hub(env).fetch("https://hub/snapshot"), cors, request);
      }
      if (url.pathname === "/v1/history") {
        const series = url.searchParams.get("series") || "";
        const range = url.searchParams.get("range") || "30d";
        if (!SERIES_PATTERN.test(series) || !(range in RANGES)) {
          return json({ error: "invalid series or range" }, 400, cors);
        }
        const target = "https://hub/history?series=" + encodeURIComponent(series) + "&range=" + range;
        return await cached("history:" + series + ":" + range, edgeTtl(env, HISTORY_EDGE_TTL_MS), () => hub(env).fetch(target), cors, request);
      }
      if (url.pathname === "/v1/health" || url.pathname === "/") {
        return json({ ok: true, service: "inari-craft-live" }, 200, cors);
      }
      return json({ error: "not found" }, 404, cors);
    } catch (error) {
      console.error("request failed", error);
      return json({ error: "internal error" }, 500, cors);
    }
  },
};

/** EDGE_CACHE_SECONDS="0" turns the per-isolate cache off (local tests). */
function edgeTtl(env, fallback) {
  const configured = Number(env.EDGE_CACHE_SECONDS);
  return env.EDGE_CACHE_SECONDS !== undefined && Number.isFinite(configured) ? configured * 1000 : fallback;
}

function hub(env) {
  return env.LIVE_HUB.get(env.LIVE_HUB.idFromName("main"));
}

async function cached(key, ttl, load, cors, request) {
  const now = Date.now();
  let entry = edgeCache.get(key);
  if (!entry || entry.expires <= now || ttl <= 0) {
    const response = await load();
    entry = { expires: now + ttl, status: response.status, body: await response.text(), etag: response.headers.get("ETag") };
    if (edgeCache.size > 500) edgeCache.clear();
    edgeCache.set(key, entry);
  }
  const headers = new Headers(cors);
  headers.set("Content-Type", "application/json; charset=utf-8");
  // Browsers revalidate every poll; an unchanged snapshot costs a 304 instead of the whole body.
  headers.set("Cache-Control", "no-cache");
  if (entry.etag) {
    headers.set("ETag", entry.etag);
    if (entry.status === 200 && request && request.headers.get("If-None-Match") === entry.etag) {
      return new Response(null, { status: 304, headers });
    }
  }
  return new Response(entry.body, { status: entry.status, headers });
}

async function ingest(request, env) {
  if (!env.INGEST_SECRET || env.INGEST_SECRET.length < 32) {
    return json({ error: "ingest secret is not configured" }, 503);
  }
  const length = Number(request.headers.get("Content-Length") || "0");
  if (length > MAX_BODY_BYTES) return json({ error: "too large" }, 413);
  const timestampText = request.headers.get("X-Moro-Timestamp") || "";
  const signature = request.headers.get("X-Moro-Signature") || "";
  const timestamp = Number(timestampText);
  if (!/^\d{1,16}$/.test(timestampText) || Math.abs(Date.now() - timestamp) > CLOCK_SKEW_MS) {
    return json({ error: "stale or missing timestamp" }, 401);
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) return json({ error: "too large" }, 413);
  if (!(await verifySignature(env.INGEST_SECRET, timestampText, bytes, signature))) {
    return json({ error: "bad signature" }, 401);
  }
  // The body is parsed once, inside the Durable Object, to stay well within the Worker's CPU limit.
  return hub(env).fetch("https://hub/ingest", { method: "POST", body: bytes, headers: { "X-Moro-Timestamp": timestampText } });
}

export async function verifySignature(secret, timestampText, bodyBytes, header) {
  const match = /^v1=([0-9a-f]{64})$/.exec(header);
  if (!match) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const prefix = new TextEncoder().encode(timestampText + "\n");
  const signed = new Uint8Array(prefix.byteLength + bodyBytes.byteLength);
  signed.set(prefix, 0);
  signed.set(bodyBytes, prefix.byteLength);
  const expected = new Uint8Array(match[1].match(/../g).map((h) => parseInt(h, 16)));
  // crypto.subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", key, expected, signed);
}

export function corsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (allowed.includes("*")) headers["Access-Control-Allow-Origin"] = "*";
  else if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Values recorded in the history, keyed by series name. */
export function seriesValues(snapshot) {
  const values = {};
  for (const item of snapshot?.officialShop?.items || []) {
    if (typeof item.id === "string") values["o:" + item.id] = [num(item.buy), num(item.sell)];
  }
  for (const group of snapshot?.playerMarket?.dataGroups || []) {
    for (const item of group.items || []) {
      if (typeof item.id === "string") values["m:" + group.id + ":" + item.id] = [num(item.lowestUnitPrice), num(item.lowestBuyerPrice)];
    }
  }
  for (const company of snapshot?.companies || []) {
    if (company.listed && Number.isFinite(company.sharePrice)) values["s:" + company.id] = [company.sharePrice, null];
  }
  return values;
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function percentChange(now, before) {
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) return null;
  return Math.round(((now - before) / before) * 10000) / 100;
}

export class LiveHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS points (series TEXT NOT NULL, t INTEGER NOT NULL, a REAL, b REAL, PRIMARY KEY (series, t)) WITHOUT ROWID`);
    this.meta = {};
    for (const row of this.sql.exec(`SELECT key, value FROM meta`)) this.meta[row.key] = row.value;
    this.lastValues = this.meta.lastValues ? JSON.parse(this.meta.lastValues) : {};
    this.publicBody = null;
  }

  setMeta(key, value) {
    this.meta[key] = value;
    this.sql.exec(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/ingest") {
      let message;
      try {
        message = JSON.parse(await request.text());
      } catch {
        return json({ error: "invalid json" }, 400);
      }
      if (!message || message.sentAt !== Number(request.headers.get("X-Moro-Timestamp"))) {
        return json({ error: "timestamp mismatch" }, 400);
      }
      return this.ingest(message);
    }
    if (url.pathname === "/snapshot") return this.snapshot();
    if (url.pathname === "/history") return this.history(url.searchParams.get("series"), url.searchParams.get("range"));
    return json({ error: "not found" }, 404);
  }

  async ingest(message) {
    const now = Date.now();
    const lastSentAt = Number(this.meta.lastSentAt || 0);
    if (!(message.sentAt > lastSentAt)) {
      return json({ error: "replayed or out-of-order message" }, 409);
    }
    if (message.kind === "snapshot") {
      const snapshot = message.snapshot;
      if (!snapshot || typeof snapshot !== "object" || snapshot.schema !== 1 || typeof message.hash !== "string") {
        return json({ error: "unsupported snapshot" }, 400);
      }
      this.ctx.storage.transactionSync(() => {
        this.recordHistory(snapshot, now);
        this.setMeta("snapshot", JSON.stringify(snapshot));
        this.setMeta("hash", message.hash);
        this.setMeta("generatedAt", String(message.sentAt));
        this.setMeta("receivedAt", String(now));
        this.markSeen(message.sentAt, now, "online");
      });
    } else if (message.kind === "heartbeat") {
      if (!this.meta.snapshot || message.hash !== this.meta.hash) {
        return json({ error: "snapshot required" }, 409);
      }
      this.ctx.storage.transactionSync(() => this.markSeen(message.sentAt, now, "online"));
    } else if (message.kind === "shutdown") {
      this.ctx.storage.transactionSync(() => this.markSeen(message.sentAt, now, "stopped"));
    } else {
      return json({ error: "unknown kind" }, 400);
    }
    this.publicBody = null;
    await this.scheduleMaintenance();
    return json({ ok: true });
  }

  markSeen(sentAt, now, state) {
    this.setMeta("lastSentAt", String(sentAt));
    this.setMeta("lastSeenAt", String(now));
    this.setMeta("state", state);
  }

  /** Writes one point per series and minute, only for series whose value changed. */
  recordHistory(snapshot, now) {
    const bucket = Math.floor(now / MINUTE) * MINUTE;
    const values = seriesValues(snapshot);
    for (const [series, value] of Object.entries(values)) {
      const previous = this.lastValues[series];
      if (previous && previous[0] === value[0] && previous[1] === value[1]) continue;
      this.sql.exec(`INSERT INTO points (series, t, a, b) VALUES (?, ?, ?, ?) ON CONFLICT(series, t) DO UPDATE SET a = excluded.a, b = excluded.b`,
        series, bucket, value[0], value[1]);
    }
    // A series that disappeared (sold out, delisted) gets an empty point so charts show the gap.
    for (const series of Object.keys(this.lastValues)) {
      if (!(series in values) && (this.lastValues[series][0] !== null || this.lastValues[series][1] !== null)) {
        this.sql.exec(`INSERT INTO points (series, t, a, b) VALUES (?, ?, NULL, NULL) ON CONFLICT(series, t) DO UPDATE SET a = NULL, b = NULL`, series, bucket);
        values[series] = [null, null];
      }
    }
    this.lastValues = values;
    this.setMeta("lastValues", JSON.stringify(values));
    // Hourly baselines give the 24-hour change without scanning the history.
    const hour = Math.floor(now / HOUR) * HOUR;
    if (!this.meta["baseline:" + hour]) {
      this.setMeta("baseline:" + hour, JSON.stringify(values));
      this.sql.exec(`DELETE FROM meta WHERE key LIKE 'baseline:%' AND CAST(substr(key, 10) AS INTEGER) < ?`, hour - 26 * HOUR);
      for (const key of Object.keys(this.meta)) {
        if (key.startsWith("baseline:") && Number(key.slice(9)) < hour - 26 * HOUR) delete this.meta[key];
      }
    }
  }

  changes(now) {
    let baselineKey = null;
    for (const key of Object.keys(this.meta)) {
      if (!key.startsWith("baseline:")) continue;
      const t = Number(key.slice(9));
      // The newest baseline at least 24 hours old.
      if (t <= now - DAY && (!baselineKey || t > Number(baselineKey.slice(9)))) baselineKey = key;
    }
    if (!baselineKey) return {};
    const base = JSON.parse(this.meta[baselineKey]);
    const result = {};
    for (const [series, value] of Object.entries(this.lastValues)) {
      const before = base[series];
      if (!before) continue;
      const a = percentChange(value[0], before[0]);
      const b = percentChange(value[1], before[1]);
      if (a !== null || b !== null) result[series] = [a, b];
    }
    return result;
  }

  snapshot() {
    const now = Date.now();
    if (!this.meta.snapshot) {
      return json({ schema: 1, status: "waiting", data: null });
    }
    if (!this.publicBody || now - this.publicBody.builtAt > MINUTE) {
      // The data part only changes on ingest; the status is recomputed for every response below.
      this.publicBody = {
        builtAt: now,
        tail: `,"generatedAt":${Number(this.meta.generatedAt)},"receivedAt":${Number(this.meta.receivedAt)},"change24h":${JSON.stringify(this.changes(now))},"data":${this.meta.snapshot}}`,
      };
    }
    const lastSeenAt = Number(this.meta.lastSeenAt || 0);
    const offlineAfter = Number(this.env?.OFFLINE_AFTER_SECONDS) > 0 ? Number(this.env.OFFLINE_AFTER_SECONDS) * 1000 : OFFLINE_AFTER_MS;
    const status = this.meta.state === "stopped" ? "stopped" : now - lastSeenAt > offlineAfter ? "offline" : "online";
    // serverTime is left out on purpose so an unchanged state keeps the same body and ETag.
    const head = `{"schema":1,"status":"${status}","lastSeenAt":${status === "online" ? 0 : lastSeenAt}`;
    const etag = `"${this.meta.generatedAt}-${status}-${status === "online" ? 0 : lastSeenAt}-${this.publicBody.builtAt}"`;
    return new Response(head + this.publicBody.tail, { headers: { "Content-Type": "application/json; charset=utf-8", "ETag": etag } });
  }

  history(series, range) {
    const now = Date.now();
    const span = RANGES[range];
    const from = span === Infinity ? 0 : now - span;
    const rows = this.sql.exec(`SELECT t, a, b FROM points WHERE series = ? AND t >= ? ORDER BY t`, series, from).toArray();
    // The last value before the range so a chart can start at the left edge.
    const before = from > 0 ? this.sql.exec(`SELECT t, a, b FROM points WHERE series = ? AND t < ? ORDER BY t DESC LIMIT 1`, series, from).toArray() : [];
    let points = before.concat(rows).map((r) => [r.t, r.a, r.b]);
    if (points.length > MAX_HISTORY_POINTS) {
      const step = Math.ceil((now - (points[0][0])) / MAX_HISTORY_POINTS);
      const buckets = new Map();
      for (const p of points) buckets.set(Math.floor(p[0] / step), p);
      points = [...buckets.values()];
    }
    return json({ series, range, serverTime: now, points });
  }

  async scheduleMaintenance() {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + HOUR);
    }
  }

  /** Thins old history: hourly points after 31 days, nothing after 400 days. */
  async alarm() {
    const now = Date.now();
    const rawCutoff = now - RAW_RETENTION_MS;
    this.sql.exec(`DELETE FROM points WHERE t < ?`, now - HOURLY_RETENTION_MS);
    this.sql.exec(
      `DELETE FROM points WHERE t < ? AND (series, t) NOT IN (SELECT series, MAX(t) FROM points WHERE t < ? GROUP BY series, t / ${HOUR})`,
      rawCutoff, rawCutoff,
    );
    await this.ctx.storage.setAlarm(now + DAY);
  }
}
