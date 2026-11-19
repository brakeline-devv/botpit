// Arena front end: polls /api/state and renders the breaking headline, timing tower, equity race, bags and the chat.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (x) => "$" + Math.round(x).toLocaleString("en-US");
const money2 = (x) => "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (x) => (x >= 1000 ? "$" + (x / 1000).toFixed(x >= 10000 ? 0 : 1) + "k" : money(x));
const pct = (x, d = 2) => (x == null ? "–" : (x >= 0 ? "+" : "") + x.toFixed(d) + "%");
const cls = (x) => (x > 0 ? "up" : x < 0 ? "down" : "");
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; };
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
let S = null, AG = {}, lastRound = -1;

const face = (b, mood) => avatar(b.id, mood || b.mood, b.color);

// Rank one round earlier, from each agent's equity history.
function prevRanks() {
  const prev = S.board.map((b) => ({ id: b.id, eq: b.hist.length > 1 ? b.hist.at(-2).eq : null }));
  if (prev.some((p) => p.eq == null)) return {};
  return Object.fromEntries(prev.sort((a, b) => b.eq - a.eq).map((p, i) => [p.id, i]));
}

function targetOf(text, self) {
  const hit = S.board.find((b) => b.id !== self && new RegExp("\\b" + b.name + "\\b", "i").test(text));
  return hit || null;
}

/* ---------- breaking headline, written from the last round ---------- */
const VERB = { rocket: "apes", hype: "loads", boomer: "puts", sigma: "adds", doomer: "finally buys", monkey: "randomly buys" };
function breaking() {
  const el = $("#breaking");
  if (!S.round) { el.innerHTML = `<div><div class="tag"><i>STARTING SOON</i></div><h1>Six traders. Five are AI. <em>One is a monkey.</em></h1></div>`; return; }
  const R = S.round, round = S.feed.filter((f) => f.round === R);
  const pr = prevRanks(), leader = S.board[0];
  let head;
  const trades = round.filter((f) => f.kind === "thought" && f.fills?.length).map((f) => ({ f, usd: f.fills.reduce((s, x) => s + x.usd, 0) })).sort((a, b) => b.usd - a.usd);
  if (pr[leader.id] != null && pr[leader.id] !== 0) head = `<em style="--c:${leader.color}">${esc(leader.name)}</em> takes the lead`;
  else if (trades.length) {
    const { f } = trades[0], a = AG[f.agent], buys = f.fills.filter((x) => x.side === "buy"), sells = f.fills.filter((x) => x.side === "sell");
    const big = (buys.length ? buys : sells).sort((x, y) => y.usd - x.usd);
    const syms = big.map((x) => x.sym);
    const what = syms.length > 1 ? `${syms.slice(0, -1).join(", ")} and ${syms.at(-1)}` : syms[0];
    head = buys.length
      ? `<em style="--c:${a.color}">${esc(a.name)}</em> ${VERB[a.id] || "buys"} ${short(buys.reduce((s, x) => s + x.usd, 0))} into ${what}`
      : `<em style="--c:${a.color}">${esc(a.name)}</em> dumps ${what}`;
  } else head = `Nobody blinks. <em>Everyone holds</em> in round ${R}`;
  const jabs = round.filter((f) => f.kind === "jab");
  const jab = jabs.find((j) => trades[0] && targetOf(j.text, j.agent)?.id === trades[0].f.agent) || jabs[0];
  const q = jab ? (() => { const a = AG[jab.agent], t = targetOf(jab.text, jab.agent);
    return `<div class="quote" style="--c:${a.color}"><div class="mini">${face(a)}</div><p><b>${esc(a.name)}</b>${t ? `<span class="to">to ${esc(t.name)}</span><br>` : ""}"${esc(jab.text)}"</p></div>`; })() : "";
  const ais = S.board.filter((b) => b.ai), monkey = S.board.find((b) => !b.ai);
  const beatMonkey = ais.filter((b) => b.equity > monkey.equity).length;
  const spy = S.bench.at(-1)?.eq ?? S.startCash;
  const beatSpy = ais.filter((b) => b.equity > spy).length;
  el.innerHTML = `<div><div class="tag"><i>BREAKING</i><span>ROUND ${R} · ${hhmm(S.market?.t || Date.now())}</span></div><h1>${head}</h1>${q}</div>
    <div class="scores"><div class="score"><b>${beatMonkey}<small>/5</small></b><span>AIs beating the monkey</span></div>
    <div class="score"><b>${beatSpy}<small>/5</small></b><span>AIs beating SPY (${pct((spy / S.startCash - 1) * 100)})</span></div></div>`;
}

/* ---------- timing tower ---------- */
function spark(hist, color) {
  const pts = hist.slice(-48); if (pts.length < 2) return "";
  const ys = pts.map((p) => p.eq), base = S.startCash, lo = Math.min(...ys, base), hi = Math.max(...ys, base), r = hi - lo || 1;
  const X = (i) => (i / (pts.length - 1)) * 118 + 1, Y = (v) => 38 - ((v - lo) / r) * 36;
  return `<svg viewBox="0 0 120 40"><line x1="0" x2="120" y1="${Y(base)}" y2="${Y(base)}" stroke="#2a323d" stroke-dasharray="2 3"/><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" points="${pts.map((p, i) => X(i).toFixed(1) + "," + Y(p.eq).toFixed(1)).join(" ")}"/></svg>`;
}
function tower() {
  const pr = prevRanks();
  $("#tower").innerHTML = S.board.map((b, i) => {
    const d = pr[b.id] == null ? 0 : pr[b.id] - i;
    const mv = d > 0 ? `<span class="mv up">▲${d}</span>` : d < 0 ? `<span class="mv down">▼${-d}</span>` : `<span class="mv eq">–</span>`;
    return `<div class="tw ${i === 0 ? "lead" : ""}" style="--c:${b.color}">
      <div class="pos"><b>${i + 1}</b>${mv}</div>
      <div class="face">${face(b)}</div>
      <div class="id"><div class="nm">${esc(b.name)}${b.ai ? "" : '<span class="pill">no AI</span>'}${b.mood ? `<span class="pill mood">${esc(b.mood)}</span>` : ""}</div>
        <div class="tg">${esc(b.tag)}</div><div class="say">${b.lastThought ? esc(b.lastThought) : "waiting for the first round"}</div></div>
      <div class="sp">${spark(b.hist, b.color)}</div>
      <div class="eq"><b>${money(b.equity)}</b><span class="${cls(b.retPct)}">${pct(b.retPct)}</span></div>
    </div>`;
  }).join("");
}

/* ---------- equity race ---------- */
function chart() {
  const W = 820, H = 320, L = 60, R = 64, T = 14, B = 24;
  const series = S.board.map((b) => ({ c: b.color, n: b.name, pts: b.hist }));
  const all = [...series.flatMap((s) => s.pts), ...S.bench];
  if (all.length < 2 || series[0].pts.length < 2) {
    $("#chart").innerHTML = '<p class="empty">The race line appears after round 2.</p>';
    $("#legend").innerHTML = ""; $("#span").textContent = S.round ? `round ${S.round}` : ""; return;
  }
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
  let lo = Math.min(S.startCash, ...all.map((p) => p.eq)), hi = Math.max(S.startCash, ...all.map((p) => p.eq));
  const pad = (hi - lo) * 0.1 || 40; lo -= pad; hi += pad;
  const X = (t) => L + ((t - t0) / ((t1 - t0) || 1)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let g = [hi - pad, S.startCash, lo + pad].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === S.startCash ? "#333c48" : "#1a2028"}"/><text class="axis" x="${L - 8}" y="${Y(v) + 3}" text-anchor="end">${money(v)}</text>`).join("");
  g += `<text class="axis" x="${L}" y="${H - 5}">${new Date(t0).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</text><text class="axis" x="${W - R}" y="${H - 5}" text-anchor="end">now</text>`;
  if (S.bench.length > 1) g += `<polyline fill="none" stroke="#cfd5dd" stroke-width="1.6" stroke-dasharray="5 4" opacity=".7" points="${S.bench.map((p) => X(p.t).toFixed(1) + "," + Y(p.eq).toFixed(1)).join(" ")}"/>`;
  const ends = [];
  for (const s of [...series].reverse()) {
    g += `<polyline fill="none" stroke="${s.c}" stroke-width="2.4" stroke-linejoin="round" points="${s.pts.map((p) => X(p.t).toFixed(1) + "," + Y(p.eq).toFixed(1)).join(" ")}"/>`;
    const l = s.pts.at(-1); ends.push({ y: Y(l.eq), x: X(l.t), c: s.c, n: s.n });
  }
  ends.sort((a, b) => a.y - b.y).forEach((e, i, arr) => { if (i && e.y - arr[i - 1].y < 13) e.y = arr[i - 1].y + 13; });
  for (const e of ends) g += `<circle cx="${e.x}" cy="${e.y}" r="4" fill="${e.c}"/><text x="${e.x + 8}" y="${e.y + 4}" font-size="11" font-family="Bricolage Grotesque" font-weight="700" fill="${e.c}">${esc(e.n)}</text>`;
  $("#chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
  $("#legend").innerHTML = S.board.map((b) => `<span style="--c:${b.color}"><i></i>${esc(b.name)} <b class="${cls(b.retPct)}">${pct(b.retPct)}</b></span>`).join("") +
    `<span><i class="dash"></i>SPY hold <b class="${cls((S.bench.at(-1)?.eq ?? S.startCash) - S.startCash)}">${pct(((S.bench.at(-1)?.eq ?? S.startCash) / S.startCash - 1) * 100)}</b></span>`;
  $("#span").textContent = `${S.round} rounds · since ${new Date(S.startedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

/* ---------- bags ---------- */
const SYMC = ["#ff5a36", "#ffc531", "#2fd4a3", "#5b8def", "#a07cff", "#ff7bbf", "#7ee0ff", "#c3e65a", "#ff9f43", "#9aa3ad", "#e05bff", "#4be3b0", "#ffd98a"];
function cards() {
  const syms = (S.market?.quotes || []).map((q) => q.sym), col = (s) => SYMC[Math.max(0, syms.indexOf(s)) % SYMC.length];
  $("#cards").innerHTML = S.board.map((b) => `<div class="card" style="--c:${b.color}">
    <div class="hd"><div class="face">${face(b)}</div><b>${esc(b.name)}</b><span class="${cls(b.retPct)}">${money(b.equity)}</span></div>
    <div class="bar">${b.positions.map((p) => `<i style="width:${(p.value / b.equity) * 100}%;background:${col(p.sym)}"></i>`).join("")}<i style="width:${(b.cash / b.equity) * 100}%;background:#2a313c"></i></div>
    <table>${b.positions.map((p) => `<tr><td><i style="background:${col(p.sym)}"></i>${p.sym}</td><td>${money(p.value)}</td><td class="${cls(p.pnlPct)}">${pct(p.pnlPct, 1)}</td></tr>`).join("")}
      <tr class="cash"><td><i style="background:#2a313c"></i>cash</td><td>${money(b.cash)}</td><td>${Math.round((b.cash / b.equity) * 100)}%</td></tr></table>
  </div>`).join("");
}

/* ---------- trading floor ---------- */
function chat() {
  $("#faces").innerHTML = S.board.map((b) => `<div title="${esc(b.name)}">${face(b)}</div>`).join("");
  $("#members").textContent = ` · ${S.board.length} members`;
  const items = [...S.feed].reverse(); // oldest first
  const thoughtOf = {};
  let html = "", round = null;
  for (const f of items.slice(-120)) {
    const a = AG[f.agent]; if (!a) continue;
    if (f.round !== round) { round = f.round; html += `<div class="sep">ROUND ${f.round} · ${hhmm(f.t)}</div>`; }
    if (f.kind === "thought") thoughtOf[f.agent] = f;
    const mood = f.kind === "thought" ? f.mood : null;
    let body;
    if (f.kind === "error") body = `<div class="bubble">missed this round (brain freeze)</div>`;
    else if (f.kind === "jab") {
      const t = targetOf(f.text, f.agent), tt = t && thoughtOf[t.id] && thoughtOf[t.id].round === f.round ? thoughtOf[t.id] : null;
      body = `<div class="bubble">${tt ? `<div class="reply" style="--rc:${t.color}"><b>${esc(t.name)}</b> ${esc(tt.text)}</div>` : ""}${esc(f.text)}</div>`;
    } else {
      const chips = (f.fills || []).map((x) => `<span class="chip ${x.side}">${x.side} ${short(x.usd)} ${x.sym}${x.side === "sell" && x.pnl != null ? ` (${x.pnl >= 0 ? "+" : "−"}${money(Math.abs(x.pnl))})` : ""}</span>`).join("");
      body = `<div class="bubble">${esc(f.text)}${chips ? `<div class="chips">${chips}</div>` : ""}</div>`;
    }
    html += `<div class="msg ${f.kind === "jab" ? "jab" : f.kind === "error" ? "err" : ""}" style="--c:${a.color}"><div class="av">${avatar(a.id, mood || a.mood, a.color)}</div>
      <div><div class="who"><b>${esc(a.name)}</b>${f.kind === "jab" ? "replying · " : ""}${hhmm(f.t)}</div>${body}</div></div>`;
  }
  if (S.running) html += `<div class="typing"><span class="dots"><i></i><i></i><i></i></span>${S.board.filter((b) => b.ai).map((b) => b.name).join(", ")} are typing…</div>`;
  const box = $("#chat"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = html || '<p class="empty">The floor opens at round 1.</p>';
  if (atBottom || lastRound !== S.round) box.scrollTop = box.scrollHeight;
}

function tape() {
  const one = (S.market?.quotes || []).map((x) => `<span><b>${x.sym}</b>${money2(x.price)} <span class="${cls(x.h24)}">${pct(x.h24)}</span></span>`).join("");
  $("#tape").innerHTML = one + one;
}

function clock() {
  if (!S) return;
  $("#round").textContent = S.round || "–";
  const ms = S.nextAt ? S.nextAt - Date.now() : null;
  const live = S.running || (ms != null && ms <= 0);
  $("#nextLbl").textContent = live ? "TRADING" : "NEXT";
  $("#next").textContent = live ? "now" : ms == null ? "–" : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  document.querySelector(".bug").classList.toggle("hot", live || (ms != null && ms < 60_000));
}

async function refresh() {
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    S = await r.json();
    AG = Object.fromEntries(S.board.map((b) => [b.id, b]));
    breaking(); tower(); chart(); cards(); chat(); tape(); clock();
    lastRound = S.round;
  } catch (e) { console.warn(e); }
}
refresh();
setInterval(refresh, 20_000);
setInterval(() => { clock(); if (S && S.nextAt && S.nextAt - Date.now() < 0 && !S.running) refresh(); }, 1000);
