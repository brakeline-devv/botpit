// Botpit server: serves the live site + /api/state, and runs a round every SETTINGS.tickEveryMs.
// Reads ANTHROPIC_API_KEY (and optional BOTPIT_* settings) from botpit/.env if present.
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { SETTINGS } = await import("./config.js");
const { AGENTS } = await import("./agents.js");
const { load, view, standings } = await import("./engine.js");
const { runRound, isRunning } = await import("./runner.js");
const { ask, quota, ASK } = await import("./ask.js");

const WEB = path.join(ROOT, "web");
let nextAt = null;

function publicState() {
  const s = load();
  const px = s.prices.at(-1)?.p || {};
  const board = standings(s, px).map((b) => {
    const a = s.agents[b.id];
    const agent = AGENTS.find((x) => x.id === b.id);
    const last = [...s.feed].reverse().find((f) => f.agent === b.id && f.kind === "thought");
    const wins = a.trades.filter((t) => t.side === "sell" && t.pnl > 0).length;
    const closed = a.trades.filter((t) => t.side === "sell").length;
    return {
      ...b, ai: !agent.random,
      positions: Object.entries(b.positions).map(([sym, p]) => ({ sym, ...p })).sort((x, y) => y.value - x.value),
      hist: a.hist, trades: a.trades.slice(-30).reverse(), nTrades: a.trades.length, winRate: closed ? wins / closed : null,
      mood: last?.mood || null, lastThought: last?.text || null,
    };
  });
  // SPY buy & hold from the first round: the "just buy the market" line every agent is measured against
  const spy0 = s.prices.find((p) => p.p.SPY)?.p.SPY;
  const bench = spy0 ? s.prices.filter((p) => p.p.SPY).map((p) => ({ t: p.t, eq: Math.round(SETTINGS.startCash * p.p.SPY / spy0 * 100) / 100 })) : [];
  return {
    running: isRunning(), bench,
    round: s.round, startedAt: s.startedAt, nextAt, paused: SETTINGS.paused, tickMin: SETTINGS.tickEveryMs / 60_000,
    model: SETTINGS.brain === "mock" ? "mock" : SETTINGS.model, startCash: SETTINGS.startCash,
    board, feed: s.feed.slice(-150).reverse(), market: s.last,
  };
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".mp4": "video/mp4", ".webm": "video/webm" };
http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  // nginx passes the visitor's address in x-real-ip; the server only listens on 127.0.0.1, so the header can be trusted
  const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress || "?");
  const json = (code, obj) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (url.pathname === "/api/ask" && req.method === "GET") { const q = quota(ip); return json(200, { left: q.left, perHour: ASK.perIpHour, open: !SETTINGS.paused && q.dayLeft > 0, paused: SETTINGS.paused, maxLen: ASK.maxLen }); }
  if (url.pathname === "/api/ask" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", async () => {
      let p = {}; try { p = JSON.parse(body); } catch { return json(400, { error: "bad request" }); }
      const r = await ask(String(p.agent || ""), p.q, ip);
      json(r.status, r.body);
    });
    return;
  }
  if (url.pathname === "/api/state") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(JSON.stringify(publicState()));
  }
  let f = path.join(WEB, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  // Range support: browsers need it to seek video, and Safari/iOS won't play an mp4 without it
  const size = fs.statSync(f).size, type = TYPES[path.extname(f)] || "application/octet-stream";
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (m) {
    let start = m[1] === "" ? size - Number(m[2]) : Number(m[1]);
    let end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (!(start >= 0 && start <= end)) { res.writeHead(416, { "content-range": `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
  fs.createReadStream(f).pipe(res);
}).listen(SETTINGS.port, "127.0.0.1", () => console.log(`botpit on http://127.0.0.1:${SETTINGS.port} · brain=${SETTINGS.brain} model=${SETTINGS.model} · round every ${SETTINGS.tickEveryMs / 60_000} min`));

// Round loop. If the last round is older than one interval (or there is none), run one right away.
if (SETTINGS.paused) console.log("paused: no rounds, no Ask (BOTPIT_PAUSED=1)");
else if (!process.argv.includes("--no-loop")) {
  const schedule = (ms) => { nextAt = Date.now() + ms; setTimeout(tick, ms); };
  async function tick() {
    try { await runRound(); } catch (e) { console.error("round failed:", e.message); }
    schedule(SETTINGS.tickEveryMs);
  }
  const lastT = load().last?.t || 0;
  const due = lastT + SETTINGS.tickEveryMs - Date.now();
  schedule(Math.max(2000, due));
}
