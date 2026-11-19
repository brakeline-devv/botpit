import { fileURLToPath } from "url";
// botpit/.env holds ANTHROPIC_API_KEY and optional BOTPIT_* overrides (never committed)
try { process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url))); } catch {}

// Botpit settings. Stock token addresses are the ones pinned (and checked) in meme-coin/gapline/src/config.js:
// DexScreener search also returns look-alike tokens with the same ticker, so never search by symbol.
export const STOCKS = [
  { sym: "SPY",   name: "S&P 500 ETF",    yahoo: "SPY",   token: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C" },
  { sym: "QQQ",   name: "Nasdaq-100 ETF", yahoo: "QQQ",   token: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68" },
  { sym: "NVDA",  name: "NVIDIA",         yahoo: "NVDA",  token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" },
  { sym: "TSLA",  name: "Tesla",          yahoo: "TSLA",  token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" },
  { sym: "AAPL",  name: "Apple",          yahoo: "AAPL",  token: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" },
  { sym: "MSFT",  name: "Microsoft",      yahoo: "MSFT",  token: "0xe93237C50D904957Cf27E7B1133b510C669c2e74" },
  { sym: "AMZN",  name: "Amazon",         yahoo: "AMZN",  token: "0x12f190a9F9d7D37a250758b26824B97CE941bF54" },
  { sym: "GOOGL", name: "Alphabet",       yahoo: "GOOGL", token: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3" },
  { sym: "META",  name: "Meta",           yahoo: "META",  token: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35" },
  { sym: "AMD",   name: "AMD",            yahoo: "AMD",   token: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC" },
  { sym: "PLTR",  name: "Palantir",       yahoo: "PLTR",  token: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A" },
  { sym: "COIN",  name: "Coinbase",       yahoo: "COIN",  token: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b" },
  { sym: "MSTR",  name: "Strategy",       yahoo: "MSTR",  token: "0xec262a75e413fAfD0dF80480274532C79D42da09" },
];
export const SYMBOLS = STOCKS.map((s) => s.sym);

export const SETTINGS = {
  port: Number(process.env.PORT || 6400),
  tickEveryMs: Number(process.env.BOTPIT_TICK_MIN || 60) * 60_000, // how often every agent decides
  startCash: 10_000,
  feeBps: 30,              // each fill pays 0.30%, like a Uniswap pool fee
  minOrderUsd: 25,         // smaller orders are dropped
  minPoolLiquidityUsd: 25_000,
  // Claude model for every agent unless the agent sets its own. Haiku keeps the botpit at a few dollars a month.
  model: process.env.BOTPIT_MODEL || "claude-haiku-5-5",
  // "claude" calls the API; "mock" uses a rule-based stand-in (free, for testing the engine and the site)
  brain: process.env.BOTPIT_BRAIN || "claude",
  keepTicks: 24 * 60,      // price ticks kept in state (about two months at one per hour)
  keepFeed: 600,
};
