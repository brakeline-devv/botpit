// Ask the pit: pick a contestant, ask a question, get an in-character answer (POST /api/ask). Uses S, AG, ava, botSrc, esc from app.js.
const SUGG = {
  rocket: ["Why are you all in?", "Do you even have a stop loss?", "Rate Doomer's strategy"],
  boomer: ["What happened in '87?", "What do you think of Rocket?", "Why so much SPY?"],
  sigma: ["Explain your last trade", "Who has the worst risk here?", "Is the monkey statistically better than you?"],
  doomer: ["When will you finally buy?", "Is the crash coming?", "Why so much cash?"],
  hype: ["What's the next narrative?", "Why are you so far down?", "Hype me up"],
  monkey: ["How are you beating the AIs?", "What's your strategy?", "Banana?"],
};
const XI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L2.8 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L8.3 3.9H6.5L17.8 20Z"/></svg>';
let askReady = false, askId = "rocket", askBusy = false, askPerHour = 5;
const askLog = {};

function askPaint() {
  const b = AG[askId]; if (!b) return;
  $("#askPick").querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.id === askId)));
  $("#askArt").style.setProperty("--c", b.color);
  document.querySelector(".ask-chat").style.setProperty("--c", b.color);
  const log = askLog[askId] || [];
  const last = log.filter((m) => m.a && !m.err).at(-1);
  $("#askImg").src = botSrc(b.id, last?.mood || b.mood); $("#askImg").alt = b.name;
  $("#askName").textContent = b.name;
  $("#askTag").textContent = b.tag + (b.ai ? " · Claude" : "");
  $("#askQ").placeholder = `Ask ${b.name} something…`;
  $("#askSugg").innerHTML = (SUGG[askId] || []).map((s) => `<button type="button">${esc(s)}</button>`).join("");
  const rank = S.board.findIndex((x) => x.id === b.id) + 1;
  $("#askLog").innerHTML = log.length
    ? log.map((m) => (m.q ? `<div class="qa-q">${esc(m.q)}</div>` : askAnswer(b, m))).join("")
    : `<p class="empty2">${b.ai ? `${esc(b.name)} is #${rank} right now and has opinions.` : "The monkey does not use AI. Ask anyway."}</p>`;
  $("#askLog").scrollTop = 1e6;
}

function askAnswer(b, m) {
  if (m.typing) return `<div class="qa-a" style="--c:${b.color}">${ava(b)}<div class="bub"><small>${esc(b.name)}</small><span class="typing" style="padding:0"><span class="dots"><i></i><i></i><i></i></span>thinking</span></div></div>`;
  const share = m.err ? "" : `<a class="share" target="_blank" rel="noopener" href="https://x.com/intent/post?via=botpittrade&text=${encodeURIComponent(shareText(b, m))}">${XI}Share</a>`;
  return `<div class="qa-a ${m.err ? "err" : ""}" style="--c:${b.color}">${ava(b, m.mood)}<div class="bub"><small>${esc(b.name)}</small>${esc(m.a)}${share ? "<br>" + share : ""}</div></div>`;
}

function shareText(b, m) {
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  return `I asked ${b.name} in the Botpit: "${cut(m.qText, 70)}"\n\n${b.name}: "${cut(m.a, 150)}"\n\nbotpit.trade`;
}

async function askQuota() {
  try {
    const r = await (await fetch("/api/ask", { cache: "no-store" })).json();
    askPerHour = r.perHour || askPerHour;
    $("#askLeft").textContent = !r.open ? (r.paused ? "The pit is paused. Questions are closed for now." : "Questions are closed for today.") : `${r.left} of ${r.perHour} questions left this hour`;
  } catch {}
}

async function askSend(q) {
  q = String(q || "").trim();
  if (!q || askBusy) return;
  askBusy = true; $("#askBtn").disabled = true;
  const id = askId, b = AG[id], log = (askLog[id] ||= []);
  const pending = { typing: true };
  log.push({ q }, pending);
  $("#askQ").value = "";
  $("#askArt").classList.add("think"); askPaint();
  let body;
  try {
    const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: id, q }) });
    body = await r.json();
  } catch { body = { error: "Connection lost. Try again." }; }
  Object.assign(pending, { typing: false, qText: q }, body.error ? { a: body.error, err: true } : { a: body.answer, mood: body.mood });
  $("#askArt").classList.remove("think"); askBusy = false; $("#askBtn").disabled = false;
  if (askId === id) askPaint();
  if (body.left != null) $("#askLeft").textContent = `${body.left} of ${askPerHour} questions left this hour`;
}

function askPickBot(id, scroll) {
  askId = id; askPaint();
  if (scroll) document.getElementById("ask").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => $("#askQ").focus({ preventScroll: true }), scroll ? 700 : 0);
}

function askInit() {
  if (askReady || !S) return;
  askReady = true;
  const order = ["rocket", "boomer", "sigma", "doomer", "hype", "monkey"].filter((id) => AG[id]);
  $("#askPick").innerHTML = order.map((id) => { const b = AG[id]; return `<button type="button" role="tab" data-id="${id}" style="--c:${b.color}">${ava(b)}${esc(b.name)}</button>`; }).join("");
  $("#askPick").addEventListener("click", (e) => { const x = e.target.closest("button"); if (x) askPickBot(x.dataset.id); });
  $("#askSugg").addEventListener("click", (e) => { const x = e.target.closest("button"); if (x) askSend(x.textContent); });
  $("#askForm").addEventListener("submit", (e) => { e.preventDefault(); askSend($("#askQ").value); });
  $("#ctGrid").addEventListener("click", (e) => { const x = e.target.closest("[data-ask]"); if (x) askPickBot(x.dataset.ask, true); });
  askPaint(); askQuota();
}
