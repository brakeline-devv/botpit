// Paper portfolios: fills at the on-chain price with a fee, long only, cash can't go negative.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SETTINGS } from "./config.js";
import { AGENTS } from "./agents.js";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const FILE = path.join(DATA, "state.json");

export function freshState() {
  const agents = {};
  for (const a of AGENTS) agents[a.id] = { cash: SETTINGS.startCash, pos: {}, trades: [], hist: [], stats: { rounds: 0, errors: 0, tokensIn: 0, tokensOut: 0, cacheRead: 0 } };
  return { version: 1, startedAt: Date.now(), round: 0, agents, prices: [], feed: [], last: null };
}

export function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return freshState(); }
}

export function save(state) {
  fs.mkdirSync(DATA, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE);
}

export function priceMap(snap) { return Object.fromEntries(snap.quotes.map((q) => [q.sym, q.price])); }

// Mark one portfolio to market.
export function view(acct, px) {
  const positions = {};
  let held = 0;
  for (const [sym, p] of Object.entries(acct.pos)) {
    const price = px[sym] ?? p.cost;
    const value = p.qty * price;
    held += value;
    positions[sym] = { qty: p.qty, cost: p.cost, price, value, pnlPct: (price / p.cost - 1) * 100 };
  }
  const equity = acct.cash + held;
  return { equity, cash: acct.cash, positions, retPct: (equity / SETTINGS.startCash - 1) * 100 };
}

// Sells first (so they fund buys), then buys scaled down to the cash available. Returns the fills.
export function execute(acct, orders, px, t, round) {
  const fee = SETTINGS.feeBps / 10_000;
  const fills = [];
  const clean = (orders || []).filter((o) => px[o.sym] && Number.isFinite(o.usd) && o.usd > 0).slice(0, 4);
  for (const o of clean.filter((o) => o.side === "sell")) {
    const p = acct.pos[o.sym];
    if (!p) continue;
    const price = px[o.sym];
    const qty = Math.min(p.qty, o.usd / price);
    if (qty * price < SETTINGS.minOrderUsd && qty < p.qty) continue;
    const gross = qty * price;
    acct.cash += gross * (1 - fee);
    p.qty -= qty;
    const pnl = (price - p.cost) * qty - gross * fee;
    if (p.qty * price < 1) delete acct.pos[o.sym];
    fills.push({ t, round, side: "sell", sym: o.sym, qty, price, usd: gross, pnl });
  }
  const buys = clean.filter((o) => o.side === "buy");
  const want = buys.reduce((s, o) => s + o.usd, 0);
  const scale = want > acct.cash ? acct.cash / want : 1;
  for (const o of buys) {
    const usd = Math.floor(o.usd * scale * 100) / 100;
    if (usd < SETTINGS.minOrderUsd) continue;
    const price = px[o.sym];
    const qty = (usd * (1 - fee)) / price;
    const p = acct.pos[o.sym] || { qty: 0, cost: 0 };
    p.cost = (p.cost * p.qty + price * qty) / (p.qty + qty);
    p.qty += qty;
    acct.pos[o.sym] = p;
    acct.cash = Math.max(0, acct.cash - usd);
    fills.push({ t, round, side: "buy", sym: o.sym, qty, price, usd });
  }
  return fills;
}

export function standings(state, px) {
  return AGENTS.map((a) => ({ id: a.id, name: a.name, tag: a.tag, color: a.color, ...view(state.agents[a.id], px) }))
    .sort((x, y) => y.equity - x.equity);
}
