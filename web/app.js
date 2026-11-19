// Arena front end: polls /api/state and renders the board, equity race, feed and portfolios.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (x) => "$" + Math.round(x).toLocaleString("en-US");
const money2 = (x) => "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (x, d = 2) => (x == null ? "–" : (x >= 0 ? "+" : "") + x.toFixed(d) + "%");
const cls = (x) => (x > 0 ? "up" : x < 0 ? "down" : "");
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; };
let S = null, filter = "all";

function spark(hist, color, start) {
  const pts = hist.slice(-48);
  if (pts.length < 2) return "";
  const ys = pts.map((p) => p.eq), lo = Math.min(...ys, start), hi = Math.max(...ys, start), r = hi - lo || 1;
  const X = (i) => (i / (pts.length - 1)) * 108 + 1, Y = (v) => 34 - ((v - lo) / r) * 32;
  return `<svg viewBox="0 0 110 36"><line x1="0" x2="110" y1="${Y(start)}" y2="${Y(start)}" stroke="#2a323d" stroke-dasharray="2 3"/><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.map((p, i) => X(i) + "," + Y(p.eq)).join(" ")}"/></svg>`;
}

function board() {
  $("#board").innerHTML = S.board.map((b, i) => `
    <div class="row ${i === 0 ? "first" : ""}" style="--c:${b.color}" data-id="${b.id}">
      <div class="rk">${i + 1}</div>
      <div class="who"><div class="av">${b.name[0]}</div><div><div class="nm">${esc(b.name)}${b.ai ? "" : '<span class="badge">NO AI</span>'}</div><div class="tg">${esc(b.tag)}</div></div></div>
      <div class="eq">${money(b.equity)}<small class="${cls(b.retPct)}">${pct(b.retPct)}</small></div>
      <div class="spark">${spark(b.hist, b.color, S.startCash)}</div>
      <div class="say">${b.lastThought ? `<i>"</i>${esc(b.lastThought)}<i>"</i>` : '<i>waiting for the first round</i>'}</div>
      <div class="meta">${b.mood ? `<span class="mood">${esc(b.mood)}</span><br>` : ""}${b.nTrades} trades${b.winRate != null ? ` · ${Math.round(b.winRate * 100)}% wins` : ""}</div>
    </div>`).join("");
  document.querySelectorAll(".row").forEach((r) => r.onclick = () => {
    const el = document.getElementById("book-" + r.dataset.id);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  });
}

function chart() {
  const W = 800, H = 330, L = 58, R = 12, T = 12, B = 26;
  const series = S.board.map((b) => ({ c: b.color, n: b.name, pts: b.hist }));
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) { $("#chart").innerHTML = '<p class="empty">The race starts after the first round.</p>'; $("#legend").innerHTML = ""; $("#span").textContent = ""; return; }
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t)) || t0 + 1;
  let lo = Math.min(S.startCash, ...all.map((p) => p.eq)), hi = Math.max(S.startCash, ...all.map((p) => p.eq));
  const pad = (hi - lo) * 0.08 || 50; lo -= pad; hi += pad;
  const X = (t) => L + ((t - t0) / ((t1 - t0) || 1)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi, S.startCash];
  let g = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === S.startCash ? "#3a4350" : "#1b2129"}" ${v === S.startCash ? 'stroke-dasharray="4 4"' : ""}/><text class="axis" x="${L - 8}" y="${Y(v) + 3}" text-anchor="end">${money(v)}</text>`).join("");
  g += `<text class="axis" x="${L}" y="${H - 6}">${new Date(t0).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</text><text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">now</text>`;
  for (const s of [...series].reverse()) {
    if (!s.pts.length) continue;
    g += `<polyline fill="none" stroke="${s.c}" stroke-width="2.2" stroke-linejoin="round" points="${s.pts.map((p) => X(p.t).toFixed(1) + "," + Y(p.eq).toFixed(1)).join(" ")}"/>`;
    const l = s.pts.at(-1);
    g += `<circle cx="${X(l.t)}" cy="${Y(l.eq)}" r="4" fill="${s.c}"/>`;
  }
  $("#chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
  $("#legend").innerHTML = S.board.map((b) => `<span style="--c:${b.color}">${esc(b.name)} <b class="${cls(b.retPct)}">${pct(b.retPct)}</b></span>`).join("");
  $("#span").textContent = `${S.round} rounds since ${new Date(S.startedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function feed() {
  const by = Object.fromEntries(S.board.map((b) => [b.id, b]));
  const items = S.feed.filter((f) => filter === "all" ? f.kind !== "error" || true : filter === "trade" ? f.kind === "thought" && f.fills?.length : f.kind === filter);
  $("#feed").innerHTML = items.length ? items.slice(0, 80).map((f) => {
    const b = by[f.agent] || { name: "?", color: "#555" };
    const fills = (f.fills || []).map((x) => `<span class="fill ${x.side}">${x.side} ${money(x.usd)} ${x.sym}${x.side === "sell" && x.pnl != null ? ` <span class="${cls(x.pnl)}">${x.pnl >= 0 ? "+" : "−"}${money(Math.abs(x.pnl))}</span>` : ""}</span>`).join("");
    const kind = f.kind === "jab" ? "jab" : f.kind === "error" ? "err" : "";
    const txt = f.kind === "error" ? "skipped this round (brain freeze)" : esc(f.text);
    return `<li class="${kind}" style="--c:${b.color}"><div class="fav">${b.name[0]}</div><div><div class="fh"><b>${esc(b.name)}</b>${f.kind === "jab" ? "jab · " : ""}round ${f.round} · ${ago(f.t)}</div><div class="txt">${txt}</div>${fills ? `<div class="fills">${fills}</div>` : ""}</div></li>`;
  }).join("") : '<li class="empty">Nothing yet.</li>';
}

function books() {
  $("#books").innerHTML = S.board.map((b) => `
    <div class="book" id="book-${b.id}" style="--c:${b.color}">
      <h3><span>${esc(b.name)}</span><span class="${cls(b.retPct)}">${money(b.equity)}</span></h3>
      <table>${b.positions.map((p) => `<tr><td>${p.sym}</td><td>${money(p.value)}</td><td class="${cls(p.pnlPct)}">${pct(p.pnlPct, 1)}</td></tr>`).join("")}
        <tr class="cash"><td>cash</td><td>${money(b.cash)}</td><td>${Math.round((b.cash / b.equity) * 100)}%</td></tr></table>
      <div class="stats"><span>${b.nTrades} trades</span>${b.winRate != null ? `<span>${Math.round(b.winRate * 100)}% winning sells</span>` : ""}</div>
    </div>`).join("");
}

function tape() {
  const q = S.market?.quotes || [];
  const one = q.map((x) => `<span><b>${x.sym}</b>${money2(x.price)} <span class="${cls(x.h24)}">${pct(x.h24)}</span></span>`).join("");
  $("#tape").innerHTML = one + one;
}

function clock() {
  if (!S) return;
  $("#round").textContent = "round " + S.round;
  const ms = S.nextAt ? S.nextAt - Date.now() : null;
  $("#next").textContent = ms == null ? "–" : ms <= 0 ? "now" : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
}

async function refresh() {
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    S = await r.json();
    $("#model").textContent = S.model === "mock" ? "test mode · mock brains" : "brains: " + S.model;
    board(); chart(); feed(); books(); tape(); clock();
  } catch (e) { console.warn(e); }
}

$("#filters").onclick = (e) => {
  const k = e.target.dataset?.k; if (!k) return;
  filter = k; document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("on", b.dataset.k === k)); feed();
};
refresh();
setInterval(refresh, 30_000);
setInterval(clock, 1000);
