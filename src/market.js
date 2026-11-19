// Market snapshot: on-chain price of each Robinhood Chain stock token (DexScreener, trades 24/7)
// plus Wall Street context from Yahoo (5-day and 1-month trend, whether NYSE is open).
import { STOCKS, SETTINGS } from "./config.js";

const UA = { "user-agent": "Mozilla/5.0 (botpit research)" };

async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 800 * (i + 1)));
    }
  }
  throw new Error(`${url.split("?")[0]}: ${last?.message}`);
}

// Liquidity-weighted median price across the token's real pools, plus the deepest pool's recent % changes.
export async function tokenQuote(address) {
  const pairs = await getJson(`https://api.dexscreener.com/token-pairs/v1/robinhood/${address}`);
  const mine = (Array.isArray(pairs) ? pairs : []).filter((p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase() && Number(p.priceUsd) > 0);
  const deep = mine.filter((p) => (p.liquidity?.usd || 0) >= SETTINGS.minPoolLiquidityUsd);
  const use = deep.length ? deep : mine;
  if (!use.length) return null;
  const pts = use.map((p) => ({ px: Number(p.priceUsd), w: p.liquidity?.usd || 1 })).sort((a, b) => a.px - b.px);
  const total = pts.reduce((s, p) => s + p.w, 0);
  let acc = 0, price = pts[0].px;
  for (const p of pts) { acc += p.w; if (acc >= total / 2) { price = p.px; break; } }
  const top = [...use].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  const pc = top.priceChange || {};
  return {
    price,
    liq: Math.round(use.reduce((s, p) => s + (p.liquidity?.usd || 0), 0)),
    vol24: Math.round(use.reduce((s, p) => s + (p.volume?.h24 || 0), 0)),
    h1: pc.h1 ?? null, h6: pc.h6 ?? null, h24: pc.h24 ?? null,
  };
}

async function yahooContext(symbol) {
  const j = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`);
  const r = j?.chart?.result?.[0];
  const closes = (r?.indicators?.quote?.[0]?.close || []).filter((c) => c != null);
  const m = r?.meta || {};
  const pct = (a, b) => (a && b ? ((a / b) - 1) * 100 : null);
  const last = closes.at(-1);
  const reg = m.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;
  return {
    nyse: m.regularMarketPrice ?? last,
    d5: pct(last, closes.at(-6)),
    m1: pct(last, closes[0]),
    nyseOpen: !!(reg && now >= reg.start && now < reg.end),
  };
}

const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

export async function snapshot() {
  const rows = await Promise.all(STOCKS.map(async (s) => {
    const [q, y] = await Promise.all([tokenQuote(s.token).catch(() => null), yahooContext(s.yahoo).catch(() => null)]);
    if (!q) return null;
    return {
      sym: s.sym, name: s.name, price: q.price,
      h1: r2(q.h1), h6: r2(q.h6), h24: r2(q.h24), d5: r2(y?.d5), m1: r2(y?.m1),
      nyse: y?.nyse ?? null, premium: y?.nyse ? r2(((q.price / y.nyse) - 1) * 100) : null,
      liq: q.liq, vol24: q.vol24,
    };
  }));
  const quotes = rows.filter(Boolean);
  if (quotes.length < STOCKS.length / 2) throw new Error(`only ${quotes.length}/${STOCKS.length} stock tokens priced`);
  const anyYahoo = await yahooContext("SPY").catch(() => null);
  return { t: Date.now(), nyseOpen: !!anyYahoo?.nyseOpen, quotes };
}
