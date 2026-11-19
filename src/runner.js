// One round: snapshot the market, every agent decides (in parallel), fills are booked, equity is recorded.
// `node src/runner.js --once` runs a single round and exits.
import { AGENTS } from "./agents.js";
import { SETTINGS } from "./config.js";
import { snapshot } from "./market.js";
import { decide } from "./brain.js";
import { load, save, view, execute, priceMap, standings } from "./engine.js";

let running = false;
export const isRunning = () => running;

export async function runRound(log = console.log) {
  if (running) return null;
  running = true;
  try {
    const state = load();
    const snap = await snapshot();
    snap.round = state.round + 1;
    const px = priceMap(snap);
    const board = standings(state, px);
    const results = await Promise.all(AGENTS.map(async (a) => {
      const acct = state.agents[a.id];
      const me = { ...acct, view: view(acct, px) };
      try { return { a, d: await decide(a, me, snap, board) }; }
      catch (e) { return { a, err: e.message || String(e) }; }
    }));
    const t = snap.t;
    for (const { a, d, err } of results) {
      const acct = state.agents[a.id];
      acct.stats.rounds++;
      if (err) {
        acct.stats.errors++;
        state.feed.push({ t, round: snap.round, agent: a.id, kind: "error", text: err.slice(0, 200) });
        log(`  ${a.name}: error ${err}`);
        continue;
      }
      if (d.usage) { acct.stats.tokensIn += d.usage.in; acct.stats.tokensOut += d.usage.out; acct.stats.cacheRead += d.usage.cacheRead; }
      const fills = execute(acct, d.orders, px, t, snap.round);
      acct.trades.push(...fills);
      acct.trades = acct.trades.slice(-500);
      state.feed.push({ t, round: snap.round, agent: a.id, kind: "thought", text: d.thought.slice(0, 280), mood: d.mood, fills: fills.map(({ side, sym, usd, price, pnl }) => ({ side, sym, usd, price, pnl })) });
      if (d.jab && d.jab.trim()) state.feed.push({ t, round: snap.round, agent: a.id, kind: "jab", text: d.jab.trim().slice(0, 160) });
      log(`  ${a.name.padEnd(7)} ${fills.map((f) => `${f.side} $${Math.round(f.usd)} ${f.sym}`).join(", ") || "hold"} · ${d.thought.slice(0, 90)}`);
    }
    for (const a of AGENTS) {
      const acct = state.agents[a.id];
      acct.hist.push({ t, eq: Math.round(view(acct, px).equity * 100) / 100 });
      acct.hist = acct.hist.slice(-SETTINGS.keepTicks);
    }
    state.round = snap.round;
    state.last = snap;
    state.prices.push({ t, p: px });
    state.prices = state.prices.slice(-SETTINGS.keepTicks);
    state.feed = state.feed.slice(-SETTINGS.keepFeed);
    save(state);
    log(`round ${snap.round} done · ${standings(state, px).map((s) => `${s.name} ${s.retPct >= 0 ? "+" : ""}${s.retPct.toFixed(2)}%`).join(" · ")}`);
    return state;
  } finally {
    running = false;
  }
}

if (process.argv.includes("--once")) {
  runRound().catch((e) => { console.error("round failed:", e.message); process.exit(1); });
}
