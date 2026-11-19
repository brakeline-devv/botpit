// One decision per agent per round. Claude gets the rules + persona (stable, cached) and this round's market,
// its own portfolio and the standings; it answers with schema-checked JSON (structured outputs).
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SETTINGS, SYMBOLS } from "./config.js";
import { RULES } from "./agents.js";

export const Decision = z.object({
  thought: z.string().describe("What you think about the market and your move, in character. Max 240 characters."),
  orders: z.array(z.object({
    side: z.enum(["buy", "sell"]),
    sym: z.enum(SYMBOLS),
    usd: z.number().describe("Dollar amount of this order"),
  })).describe("0 to 4 orders. Empty means hold."),
  mood: z.enum(["euphoric", "confident", "calm", "nervous", "salty", "smug"]),
  jab: z.string().describe("Optional one-line roast of another contestant by name, or an empty string. Max 140 characters."),
});

let client;
const cli = () => (client ||= new Anthropic());

const money = (x) => "$" + Math.round(x).toLocaleString("en-US");
const pc = (x) => (x == null ? "  n/a" : (x >= 0 ? "+" : "") + x.toFixed(1) + "%");

export function roundPrompt(me, snap, standings) {
  const lines = snap.quotes.map((q) => `${q.sym.padEnd(5)} $${q.price.toFixed(2).padStart(8)}  1h ${pc(q.h1)}  6h ${pc(q.h6)}  24h ${pc(q.h24)}  5d ${pc(q.d5)}  1mo ${pc(q.m1)}`);
  const pos = Object.entries(me.view.positions).map(([s, p]) => `${s}: ${p.qty.toFixed(4)} tokens, worth ${money(p.value)} (${pc(p.pnlPct)} vs your cost)`);
  const recent = me.trades.slice(-5).map((t) => `${new Date(t.t).toISOString().slice(5, 16)} ${t.side} ${money(t.usd)} ${t.sym} @ $${t.price.toFixed(2)}`);
  const board = standings.map((s, i) => `${i + 1}. ${s.name} (${s.tag}) ${money(s.equity)} (${pc(s.retPct)})`);
  return `Round ${snap.round} · ${new Date(snap.t).toUTCString()} · Wall Street is ${snap.nyseOpen ? "OPEN" : "CLOSED (tokens still trade)"}

MARKET (on-chain price, % changes)
${lines.join("\n")}

YOUR PORTFOLIO
Cash ${money(me.cash)} · Equity ${money(me.view.equity)} (${pc(me.view.retPct)} since start)
${pos.length ? pos.join("\n") : "No positions."}
${recent.length ? "Your last trades:\n" + recent.join("\n") : "You have not traded yet."}

STANDINGS
${board.join("\n")}

Make your move.`;
}

export async function decideClaude(agent, me, snap, standings) {
  const res = await cli().messages.parse({
    model: agent.model || SETTINGS.model,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Decision) },
    system: [{ type: "text", text: `${RULES}\n\n${agent.persona}`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: roundPrompt(me, snap, standings) }],
  });
  if (res.stop_reason === "refusal") throw new Error("refused");
  if (!res.parsed_output) throw new Error(`no parsed output (stop: ${res.stop_reason})`);
  const u = res.usage || {};
  return { ...res.parsed_output, usage: { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 } };
}

// Free stand-in used for the monkey and for ARENA_BRAIN=mock (engine and site tests without API spend).
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
export function decideRandom(agent, me, snap) {
  const r = rng(snap.round * 7919 + agent.id.length * 104729 + agent.id.charCodeAt(0));
  const orders = [];
  const held = Object.keys(me.view.positions);
  if (held.length && r() < 0.45) orders.push({ side: "sell", sym: held[Math.floor(r() * held.length)], usd: 1e9 });
  if (r() < 0.6 && me.cash > 100) orders.push({ side: "buy", sym: snap.quotes[Math.floor(r() * snap.quotes.length)].sym, usd: me.cash * (0.15 + r() * 0.35) });
  const lines = agent.random
    ? ["*throws dart at the board*", "*eats banana, presses buy*", "*screeches at the chart*", "*sits on the keyboard*", "*flings a ticker at the wall*"]
    : [`mock decision for ${agent.name}`];
  return { thought: lines[Math.floor(r() * lines.length)], orders, mood: "calm", jab: "", usage: null };
}

export async function decide(agent, me, snap, standings) {
  if (agent.random || SETTINGS.brain === "mock") return decideRandom(agent, me, snap);
  return decideClaude(agent, me, snap, standings);
}
