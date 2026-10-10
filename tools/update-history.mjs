#!/usr/bin/env node
/**
 * 価格履歴・株価履歴の蓄積スクリプト
 *
 * data/market.json の「現在価格」を data/market-history.json に1件追記し、
 * data/companies.json の上場企業の「現在株価」を各社の stockHistory に1件追記します。
 *
 * 使い方（Node.js 18 以上）:
 *   node tools/update-history.mjs
 *
 * ・market.json / companies.json を最新データに更新したあとに実行してください。
 * ・"sample": true のデータは履歴に追加しません（架空の履歴を作らないため）。
 * ・同じ updatedAt のデータは二重に追加されません。
 * ・市場の履歴は 30 日分、株価の履歴は 365 日分を保持し、それより古いものは削除します。
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (f) => join(root, "data", f);
const DAY = 864e5;

const readJSON = async (f) => JSON.parse(await readFile(p(f), "utf8"));
const writeJSON = (f, d) => writeFile(p(f), JSON.stringify(d, null, 2) + "\n");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function append(list, entry, keepMs, ref) {
  const last = list[list.length - 1];
  if (!last || +new Date(last.t) < +new Date(entry.t)) list.push(entry);
  return list.filter((h) => +new Date(h.t) >= ref - keepMs);
}

async function market() {
  const m = await readJSON("market.json");
  if (m.sample) return console.log("market.json はサンプルデータのため、価格履歴は追加しませんでした。");
  if (!m.updatedAt) return console.log("market.json に updatedAt がないため、価格履歴は追加しませんでした。");
  const h = await readJSON("market-history.json").catch(() => ({ groups: {} }));
  h.groups ||= {};
  const t = new Date(m.updatedAt).toISOString();
  const ref = +new Date(t);
  let n = 0;
  for (const item of m.items || []) {
    for (const [wg, price] of Object.entries(item.prices || {})) {
      if (!isNum(price.buy) && !isNum(price.sell)) continue;
      const g = (h.groups[wg] ||= {});
      const entry = { t };
      if (isNum(price.buy)) entry.buy = price.buy;
      if (isNum(price.sell)) entry.sell = price.sell;
      g[item.id] = append(g[item.id] || [], entry, 31 * DAY, ref);
      n++;
    }
  }
  h.updatedAt = t;
  await writeJSON("market-history.json", h);
  console.log(`価格履歴を更新しました（${n} 件）`);
}

async function companies() {
  const d = await readJSON("companies.json");
  if (d.sample) return console.log("companies.json はサンプルデータのため、株価履歴は追加しませんでした。");
  if (!d.updatedAt) return console.log("companies.json に updatedAt がないため、株価履歴は追加しませんでした。");
  const t = new Date(d.updatedAt).toISOString();
  const ref = +new Date(t);
  let n = 0;
  for (const c of d.companies || []) {
    if (!c.listed || !isNum(c.stockPrice)) continue;
    c.stockHistory = append(c.stockHistory || [], { t, v: c.stockPrice }, 366 * DAY, ref);
    n++;
  }
  await writeJSON("companies.json", d);
  console.log(`株価履歴を更新しました（${n} 社）`);
}

await market();
await companies();
