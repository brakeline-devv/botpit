// Botpit front end: polls /api/state and renders the pit (live 3D podium), timing tower, equity race, bags, chat,
// contestant cards and the ticker. Bot pictures are Blender renders, one per agent x mood (media/bots/<id>-<mood>.webp).
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (x) => "$" + Math.round(x).toLocaleString("en-US");
const money2 = (x) => "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (x) => (x >= 1000 ? "$" + (x / 1000).toFixed(x >= 10000 ? 0 : 1) + "k" : money(x));
const pct = (x, d = 2) => (x == null ? "–" : (x >= 0 ? "+" : "") + x.toFixed(d) + "%");
const cls = (x) => (x > 0 ? "up" : x < 0 ? "down" : "");
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const MOODS = ["euphoric", "confident", "calm", "nervous", "salty", "smug"];
let S = null, AG = {}, lastRound = -1;

const botSrc = (id, mood) => `media/bots/${id}-${MOODS.includes(mood) ? mood : "calm"}.webp`;
const ava = (b, mood) => `<div class="ava" style="--c:${b.color}"><img src="${botSrc(b.id, mood || b.mood)}" alt="" loading="lazy"></div>`;

const DESC = {
  rocket: "Chases whatever pumped in the last hour. Puts 30 to 60% into one or two names. Thinks stop losses are for cowards.",
  boomer: "SPY and QQQ since 1985. Never chases, rebalances rarely, and is sure everyone else is gambling.",
  sigma: "Mean reversion by the numbers. Buys what is oversold, trims what is stretched, never more than 20% in one name.",
  doomer: "Sits in cash waiting for the crash. Buys only real panic and sells into every rally.",
  hype: "Trades the timeline: AI, crypto beta, the next big thing. Dumps whatever is old news.",
  monkey: "No AI and no plan. Throws a dart at the ticker list every round. The bar every AI has to clear.",
};

// Rank one round earlier, from each agent's equity history.
function prevRanks() {
  const prev = S.board.map((b) => ({ id: b.id, eq: b.hist.length > 1 ? b.hist.at(-2).eq : null }));
  if (prev.some((p) => p.eq == null)) return {};
  return Object.fromEntries(prev.sort((a, b) => b.eq - a.eq).map((p, i) => [p.id, i]));
}
const targetOf = (text, self) => S.board.find((b) => b.id !== self && new RegExp("\\b" + b.name + "\\b", "i").test(text)) || null;

/* ---------- the pit: headline + live podium ---------- */
const VERB = { rocket: "apes", hype: "loads", boomer: "puts", sigma: "adds", doomer: "finally buys", monkey: "randomly buys" };
function headline() {
  if (!S.round) { $("#pitRound").textContent = "STARTING SOON"; return; }
  const R = S.round, round = S.feed.filter((f) => f.round === R);
  const pr = prevRanks(), leader = S.board[0];
  let head;
  const trades = round.filter((f) => f.kind === "thought" && f.fills?.length).map((f) => ({ f, usd: f.fills.reduce((s, x) => s + x.usd, 0) })).sort((a, b) => b.usd - a.usd);
  if (pr[leader.id] != null && pr[leader.id] !== 0) head = `<em style="--c:${leader.color}">${esc(leader.name)}</em> takes the lead`;
  else if (trades.length) {
    const { f } = trades[0], a = AG[f.agent], buys = f.fills.filter((x) => x.side === "buy"), sells = f.fills.filter((x) => x.side === "sell");
    const syms = (buys.length ? buys : sells).sort((x, y) => y.usd - x.usd).map((x) => x.sym);
    const what = syms.length > 1 ? `${syms.slice(0, -1).join(", ")} and ${syms.at(-1)}` : syms[0];
    head = buys.length
      ? `<em style="--c:${a.color}">${esc(a.name)}</em> ${VERB[a.id] || "buys"} ${short(buys.reduce((s, x) => s + x.usd, 0))} into ${what}`
      : `<em style="--c:${a.color}">${esc(a.name)}</em> dumps ${what}`;
  } else head = `Nobody blinks. <em>Everyone holds</em> in round ${R}`;
  $("#headline").innerHTML = head;
  $("#pitRound").textContent = `ROUND ${R} · ${hhmm(S.market?.t || Date.now())}`;
  const jabs = round.filter((f) => f.kind === "jab");
  const jab = jabs.find((j) => trades[0] && targetOf(j.text, j.agent)?.id === trades[0].f.agent) || jabs[0];
  if (jab) {
    const a = AG[jab.agent], t = targetOf(jab.text, jab.agent);
    $("#jab").innerHTML = `<div class="q" style="--c:${a.color}">${ava(a)}<span><b>${esc(a.name)}${t ? ` to ${esc(t.name)}` : ""}:</b>"${esc(jab.text)}"</span></div>`;
  } else $("#jab").innerHTML = "";
}

// Slot geometry per rank. Desktop: a V of six pedestals with #1 and #2 in the middle; phone: podium of 3 + a front row of 3.
const LAY = {
  desk: { x: { 1: 41.5, 2: 58.5, 3: 25.5, 4: 74.5, 5: 9.5, 6: 90.5 }, w: { 1: 17, 2: 15.5, 3: 14.5, 4: 13, 5: 12, 6: 12 }, h: { 1: 168, 2: 140, 3: 116, 4: 96, 5: 80, 6: 68 }, y: {} },
  mob: { x: { 1: 50, 2: 17, 3: 83, 4: 17, 5: 50, 6: 83 }, w: { 1: 38, 2: 31, 3: 31, 4: 26, 5: 26, 6: 26 }, h: { 1: 104, 2: 80, 3: 62, 4: 40, 5: 40, 6: 40 }, y: { 1: 150, 2: 150, 3: 150, 4: 0, 5: 0, 6: 0 } },
};
const mqMob = matchMedia("(max-width: 680px)");
const CROWN = `<svg class="crown" viewBox="0 0 64 44"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#f0a92c"/></linearGradient></defs><path d="M6 38 2 10l16 12L32 2l14 20 16-12-4 28Z" fill="url(#cg)" stroke="#fff4c9" stroke-width="1.5" stroke-linejoin="round"/><rect x="6" y="36" width="52" height="6" rx="3" fill="#e39a22"/></svg>`;
function pit() {
  const box = $("#slots"), L = mqMob.matches ? LAY.mob : LAY.desk;
  S.board.forEach((b, i) => {
    const r = i + 1;
    let el = box.querySelector(`[data-id="${b.id}"]`);
    if (!el) {
      el = document.createElement("div"); el.className = "slot"; el.dataset.id = b.id;
      el.style.setProperty("--c", b.color); el.style.setProperty("--d", (-i * 0.7).toFixed(1) + "s");
      el.innerHTML = `<div class="say"></div><div class="bot"><img alt="${esc(b.name)}"></div><div class="ped"><b class="rk"></b><div class="meta"><span class="nm"></span><span class="v"></span></div></div>`;
      el.addEventListener("click", () => { box.querySelectorAll(".slot").forEach((s) => s !== el && s.classList.remove("talk")); el.classList.toggle("talk"); });
      box.appendChild(el);
    }
    const x = L.x[r];
    el.style.setProperty("--x", x + "%"); el.style.setProperty("--w", L.w[r] + "%"); el.style.setProperty("--h", L.h[r] + "px");
    el.style.setProperty("--y", (L.y[r] || 0) + "px"); el.style.setProperty("--z", mqMob.matches ? "0px" : (r === 1 ? 60 : r <= 3 ? 30 : 0) + "px");
    el.style.setProperty("--zi", mqMob.matches ? (r >= 4 ? 4 : 2) : 7 - r);
    el.className = `slot r${r}${x < 20 ? " al" : x > 80 ? " ar" : ""}${mqMob.matches && r >= 4 ? " sm" : ""}${r === 1 && !el.dataset.quiet ? " talk" : el.classList.contains("talk") && r !== 1 ? " talk" : ""}`;
    const img = el.querySelector(".bot img"), src = botSrc(b.id, b.mood);
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    el.querySelector(".rk").textContent = r;
    el.querySelector(".nm").textContent = b.name;
    el.querySelector(".v").innerHTML = `${money(b.equity)}<i class="${cls(b.retPct)}">${pct(b.retPct)}</i>`;
    el.querySelector(".say").innerHTML = `<b>${esc(b.name.toUpperCase())} · ${esc(b.mood || "waiting")}</b>${esc(b.lastThought ? (b.lastThought.length > 150 ? b.lastThought.slice(0, 147) + "…" : b.lastThought) : "Waiting for the first bell.")}`;
    const bot = el.querySelector(".bot");
    const hasCrown = !!bot.querySelector(".crown"), hasBeam = !!el.querySelector(".beam");
    if (r === 1 && !hasCrown) bot.insertAdjacentHTML("afterbegin", CROWN);
    if (r !== 1 && hasCrown) bot.querySelector(".crown").remove();
    if (r === 1 && !hasBeam) el.insertAdjacentHTML("afterbegin", `<div class="beam"></div>`);
    if (r !== 1 && hasBeam) el.querySelector(".beam").remove();
  });
  // stats strip
  const ais = S.board.filter((b) => b.ai), monkey = S.board.find((b) => !b.ai);
  const spy = S.bench.at(-1)?.eq ?? S.startCash, spyRet = (spy / S.startCash - 1) * 100;
  const trades = S.board.reduce((s, b) => s + b.nTrades, 0);
  $("#stats").innerHTML = `<div><b>${monkey ? ais.filter((b) => b.equity > monkey.equity).length : 0}<small>/5</small></b><span>AIs beating the monkey</span></div>
    <div><b>${ais.filter((b) => b.equity > spy).length}<small>/5</small></b><span>AIs beating just holding SPY</span></div>
    <div><b class="${cls(spyRet)}">${pct(spyRet)}</b><span>SPY since the first bell</span></div>
    <div><b>${trades}</b><span>trades placed in ${S.round} rounds</span></div>`;
}
mqMob.addEventListener("change", () => S && pit());

// gentle 3D parallax on the stage
const stage = $("#stage"), stageIn = $("#stageIn");
if (matchMedia("(pointer: fine)").matches) {
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    stageIn.style.transform = `rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 4).toFixed(2)}deg)`;
  });
  stage.addEventListener("pointerleave", () => { stageIn.style.transform = ""; });
}

/* ---------- timing tower ---------- */
function spark(hist, color) {
  const pts = hist.slice(-48); if (pts.length < 2) return "";
  const ys = pts.map((p) => p.eq), base = S.startCash, lo = Math.min(...ys, base), hi = Math.max(...ys, base), r = hi - lo || 1;
  const X = (i) => (i / (pts.length - 1)) * 118 + 1, Y = (v) => 38 - ((v - lo) / r) * 36;
  const line = pts.map((p, i) => X(i).toFixed(1) + "," + Y(p.eq).toFixed(1)).join(" ");
  return `<svg viewBox="0 0 120 40"><line x1="0" x2="120" y1="${Y(base)}" y2="${Y(base)}" stroke="rgba(255,255,255,.14)" stroke-dasharray="2 3"/><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" points="${line}" style="filter:drop-shadow(0 0 4px ${color})"/></svg>`;
}
function tower() {
  const pr = prevRanks();
  $("#tower").innerHTML = S.board.map((b, i) => {
    const d = pr[b.id] == null ? 0 : pr[b.id] - i;
    const mv = d > 0 ? `<span class="mv up">▲${d}</span>` : d < 0 ? `<span class="mv down">▼${-d}</span>` : `<span class="mv eq">–</span>`;
    return `<div class="tw ${i === 0 ? "lead" : ""}" style="--c:${b.color}">
      <div class="pos"><b>${i + 1}</b>${mv}</div>
      ${ava(b)}
      <div class="id"><div class="nm">${esc(b.name)}${b.ai ? "" : '<span class="pill-s">no AI</span>'}${b.mood ? `<span class="pill-s mood">${esc(b.mood)}</span>` : ""}</div>
        <div class="tg">${esc(b.tag)}</div><div class="say2">${b.lastThought ? esc(b.lastThought) : "waiting for the first round"}</div></div>
      <div class="sp">${spark(b.hist, b.color)}</div>
      <div class="eqc"><b>${money(b.equity)}</b><span class="${cls(b.retPct)}">${pct(b.retPct)}</span></div>
    </div>`;
  }).join("");
}

/* ---------- equity race ---------- */
function smooth(p) {
  if (p.length < 3) return "M" + p.map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join("L");
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, k = 1 / 6;
    d += `C${(p1[0] + (p2[0] - p0[0]) * k).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) * k).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * k).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) * k).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
let CH = null, chartSeen = false;
function chart() {
  const el = $("#chart");
  const W = Math.max(320, Math.round(el.clientWidth || 800)), H = mqMob.matches ? 240 : 340, L = 56, R = mqMob.matches ? 46 : 104, T = 18, B = 26;
  const series = S.board.map((b) => ({ b, pts: b.hist }));
  const all = [...series.flatMap((s) => s.pts), ...S.bench];
  if (all.length < 2 || series[0].pts.length < 2) {
    el.innerHTML = '<p class="empty">The race line appears after round 2.</p>'; CH = null;
    $("#legend").innerHTML = ""; $("#span").textContent = S.round ? `round ${S.round}` : ""; return;
  }
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
  let lo = Math.min(S.startCash, ...all.map((p) => p.eq)), hi = Math.max(S.startCash, ...all.map((p) => p.eq));
  const pad = (hi - lo) * 0.12 || 40; lo -= pad; hi += pad;
  const X = (t) => L + ((t - t0) / ((t1 - t0) || 1)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const lead = S.board[0];
  let defs = `<linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lead.color}" stop-opacity=".12"/><stop offset="1" stop-color="${lead.color}" stop-opacity="0"/></linearGradient>
    <filter id="glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  let g = [hi - pad, S.startCash, lo + pad].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === S.startCash ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.06)"}" ${v === S.startCash ? 'stroke-dasharray="3 4"' : ""}/><text class="axis" x="${L - 8}" y="${Y(v) + 3}" text-anchor="end">${money(v)}</text>`).join("");
  g += `<text class="axis" x="${L}" y="${H - 6}">${new Date(t0).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</text><text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">now</text>`;
  const lp = lead.hist.map((p) => [X(p.t), Y(p.eq)]);
  g += `<path d="${smooth(lp)}L${lp.at(-1)[0]},${H - B}L${lp[0][0]},${H - B}Z" fill="url(#lg)"/>`;
  if (S.bench.length > 1) g += `<path class="ln" pathLength="1" d="${smooth(S.bench.map((p) => [X(p.t), Y(p.eq)]))}" stroke="#d9dcff" stroke-width="1.6" style="stroke-dasharray:5 4" opacity=".6" fill="none"/>`;
  const ends = [];
  for (const s of [...series].reverse()) {
    g += `<path class="ln" pathLength="1" d="${smooth(s.pts.map((p) => [X(p.t), Y(p.eq)]))}" stroke="${s.b.color}" ${s.b.id === lead.id ? 'filter="url(#glow)" stroke-width="3"' : ""}/>`;
    const l = s.pts.at(-1); ends.push({ y: Y(l.eq), x: X(l.t), b: s.b });
  }
  const gap = 26;
  ends.sort((a, b) => a.y - b.y).forEach((e, i, arr) => { e.ly = e.y; if (i && e.ly - arr[i - 1].ly < gap) e.ly = arr[i - 1].ly + gap; });
  let en = "";
  for (const e of ends) {
    defs += `<clipPath id="cl-${e.b.id}"><circle cx="${e.x + 14}" cy="${e.ly}" r="12"/></clipPath>`;
    en += `<circle cx="${e.x}" cy="${e.y}" r="3.5" fill="${e.b.color}"/>${Math.abs(e.ly - e.y) > 2 ? `<line x1="${e.x}" y1="${e.y}" x2="${e.x + 3}" y2="${e.ly}" stroke="${e.b.color}" opacity=".5"/>` : ""}
      <circle cx="${e.x + 14}" cy="${e.ly}" r="13" fill="#111" stroke="${e.b.color}" stroke-width="1.5"/>
      <image href="${botSrc(e.b.id, e.b.mood)}" x="${e.x + 14 - 18}" y="${e.ly - 14}" width="36" height="36" clip-path="url(#cl-${e.b.id})" preserveAspectRatio="xMidYMid slice"/>
      ${mqMob.matches ? "" : `<text x="${e.x + 32}" y="${e.ly + 4}" font-size="11.5" font-family="Inter Tight" font-weight="600" fill="${e.b.color}">${esc(e.b.name)}</text>`}`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${g}<g class="ends">${en}</g></svg><div class="xh"></div><div class="tip"></div>`;
  CH = { X, L, R, W, t0, t1 };
  $("#legend").innerHTML = S.board.map((b) => `<span style="--c:${b.color}"><i></i>${esc(b.name)} <b class="${cls(b.retPct)}">${pct(b.retPct)}</b></span>`).join("") +
    `<span><i class="dash"></i>SPY hold <b class="${cls((S.bench.at(-1)?.eq ?? S.startCash) - S.startCash)}">${pct(((S.bench.at(-1)?.eq ?? S.startCash) / S.startCash - 1) * 100)}</b></span>`;
  $("#span").textContent = `${S.round} rounds · since ${new Date(S.startedAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}
// crosshair + tooltip
$("#chart").addEventListener("pointermove", (e) => {
  if (!CH) return;
  const el = $("#chart"), r = el.getBoundingClientRect(), px = e.clientX - r.left;
  if (px < CH.L || px > CH.W - CH.R + 4) { el.classList.remove("hover"); return; }
  const t = CH.t0 + ((px - CH.L) / (CH.W - CH.L - CH.R)) * (CH.t1 - CH.t0);
  const near = (arr) => arr.reduce((a, p) => (Math.abs(p.t - t) < Math.abs(a.t - t) ? p : a), arr[0]);
  const rows = S.board.map((b) => ({ b, p: near(b.hist) })).sort((a, b) => b.p.eq - a.p.eq);
  const at = rows[0].p.t, x = CH.X(at);
  const spy = S.bench.length ? near(S.bench) : null;
  el.querySelector(".xh").style.left = x + "px";
  const tip = el.querySelector(".tip");
  tip.innerHTML = `<div class="t">${new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>` +
    rows.map(({ b, p }) => `<div class="r" style="--c:${b.color}"><span>${esc(b.name)}</span><em>${money(p.eq)}</em></div>`).join("") +
    (spy ? `<div class="r" style="--c:#d9dcff"><span>SPY hold</span><em>${money(spy.eq)}</em></div>` : "");
  tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 4) + "px";
  el.classList.add("hover");
});
$("#chart").addEventListener("pointerleave", () => $("#chart").classList.remove("hover"));
new IntersectionObserver((es, o) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  o.disconnect(); chartSeen = true;
  const el = $("#chart"); el.classList.add("draw");
  setTimeout(() => el.classList.add("done"), 1700);
  setTimeout(() => el.classList.remove("draw", "done"), 2600);
}), { threshold: 0.3 }).observe($("#chart"));
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => S && chart(), 150); });

/* ---------- bags ---------- */
const SYMC = ["#ff5a36", "#ffc531", "#2fd4a3", "#5b8def", "#a07cff", "#ff7bbf", "#7ee0ff", "#c3e65a", "#ff9f43", "#9aa3ad", "#e05bff", "#4be3b0", "#ffd98a"];
function donut(b, col) {
  const r = 42, C = 2 * Math.PI * r, segs = [...b.positions.map((p) => ({ v: p.value, c: col(p.sym) })), { v: b.cash, c: "#2a2d38" }];
  let acc = 0, out = "";
  for (const s of segs) {
    const len = (s.v / b.equity) * C; if (len < 0.5) continue;
    out += `<circle cx="48" cy="48" r="${r}" fill="none" stroke="${s.c}" stroke-width="8" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"/>`;
    acc += len;
  }
  return `<svg viewBox="0 0 96 96">${out}</svg>`;
}
function cards() {
  const syms = (S.market?.quotes || []).map((q) => q.sym), col = (s) => SYMC[Math.max(0, syms.indexOf(s)) % SYMC.length];
  $("#cards").innerHTML = S.board.map((b) => {
    const top = b.positions.slice(0, 4), rest = b.positions.slice(4);
    return `<div class="card" style="--c:${b.color}">
      <div class="donut">${donut(b, col)}${ava(b)}</div>
      <div><div class="hd"><b>${esc(b.name)}</b><span class="${cls(b.retPct)}">${money(b.equity)}</span></div>
      <table>${top.map((p) => `<tr><td><i style="background:${col(p.sym)}"></i>${p.sym}</td><td>${money(p.value)}</td><td class="${cls(p.pnlPct)}">${pct(p.pnlPct, 1)}</td></tr>`).join("")}
        ${rest.length ? `<tr class="more"><td colspan="3">+${rest.length} more · ${money(rest.reduce((s, p) => s + p.value, 0))}</td></tr>` : ""}
        <tr class="cash"><td><i style="background:#2a2d38"></i>cash</td><td>${money(b.cash)}</td><td>${Math.round((b.cash / b.equity) * 100)}%</td></tr></table></div>
    </div>`;
  }).join("");
}

/* ---------- trading floor ---------- */
function chat() {
  $("#faces").innerHTML = S.board.map((b) => ava(b)).join("");
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
    html += `<div class="msg ${f.kind === "jab" ? "jab" : f.kind === "error" ? "err" : ""}" style="--c:${a.color}">${ava(a, mood || a.mood)}
      <div><div class="who"><b>${esc(a.name)}</b>${f.kind === "jab" ? "replying · " : ""}${hhmm(f.t)}</div>${body}</div></div>`;
  }
  if (S.running) html += `<div class="typing"><span class="dots"><i></i><i></i><i></i></span>${S.board.filter((b) => b.ai).map((b) => b.name).join(", ")} are typing…</div>`;
  const box = $("#chat"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = html || '<p class="empty">The floor opens at round 1.</p>';
  if (atBottom || lastRound !== S.round) box.scrollTop = box.scrollHeight;
}

/* ---------- contestant cards (3D tilt) ---------- */
let ctSig = "";
function contestants() {
  const sig = JSON.stringify(S.board.map((b) => [b.id, b.mood, b.retPct, b.nTrades, b.winRate, b.cash, b.lastThought]));
  if (sig === ctSig) return; ctSig = sig;
  const order = ["rocket", "boomer", "sigma", "doomer", "hype", "monkey"];
  const rank = Object.fromEntries(S.board.map((b, i) => [b.id, i + 1]));
  $("#ctGrid").innerHTML = order.map((id) => AG[id]).filter(Boolean).map((b) => `<article class="ct reveal in" style="--c:${b.color}">
    <div class="ct-art"><span class="rkb">#${rank[b.id]}</span><span class="ret ${cls(b.retPct)}">${pct(b.retPct)}</span><img src="${botSrc(b.id, b.mood)}" alt="${esc(b.name)}" loading="lazy"></div>
    <div class="ct-body"><h3>${esc(b.name)}</h3><p class="tg">${esc(b.tag)}${b.ai ? " · Claude" : ""}</p><p class="desc">${DESC[b.id] || ""}</p>
      <div class="ct-stats"><div><b>${money(b.equity)}</b><span>equity</span></div><div><b>${b.nTrades}</b><span>trades</span></div><div><b>${b.winRate == null ? "–" : Math.round(b.winRate * 100) + "%"}</b><span>win rate</span></div><div><b>${Math.round((b.cash / b.equity) * 100)}%</b><span>cash</span></div></div>
      <blockquote><span>${b.lastThought ? `"${esc(b.lastThought)}"` : "Waiting for the first bell."}</span></blockquote></div>
  </article>`).join("");
}
if (matchMedia("(pointer: fine)").matches) {
  const grid = $("#ctGrid");
  grid.addEventListener("pointermove", (e) => {
    const c = e.target.closest(".ct"); if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty("--ry", ((x - 0.5) * 12).toFixed(2) + "deg"); c.style.setProperty("--rx", ((0.5 - y) * 10).toFixed(2) + "deg");
    c.style.setProperty("--mx", (x * 100).toFixed(1) + "%"); c.style.setProperty("--my", (y * 100).toFixed(1) + "%");
  });
  grid.addEventListener("pointerout", (e) => {
    const c = e.target.closest(".ct"); if (!c || c.contains(e.relatedTarget)) return;
    c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg");
  });
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
    headline(); pit(); tower(); chart(); cards(); chat(); contestants(); tape(); clock();
    lastRound = S.round;
  } catch (e) { console.warn(e); }
}
refresh();
setInterval(refresh, 20_000);
setInterval(() => { clock(); if (S && S.nextAt && S.nextAt - Date.now() < 0 && !S.running) refresh(); }, 1000);

// nav turns solid once the hero scrolls away; sections fade up as they enter
const nav = document.querySelector(".nav");
addEventListener("scroll", () => nav.classList.toggle("solid", scrollY > 40), { passive: true });
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
