import { test } from "node:test";
import assert from "node:assert/strict";
import { execute, view } from "../src/engine.js";

const acct = () => ({ cash: 10_000, pos: {}, trades: [] });

test("buy pays the fee and books cost", () => {
  const a = acct();
  const f = execute(a, [{ side: "buy", sym: "NVDA", usd: 1000 }], { NVDA: 100 }, 0, 1);
  assert.equal(f.length, 1);
  assert.equal(a.cash, 9000);
  assert.ok(Math.abs(a.pos.NVDA.qty - 9.97) < 1e-9);
  assert.ok(Math.abs(view(a, { NVDA: 100 }).equity - 9997) < 1e-6);
});

test("buys are scaled to available cash, never negative", () => {
  const a = acct();
  execute(a, [{ side: "buy", sym: "NVDA", usd: 8000 }, { side: "buy", sym: "TSLA", usd: 8000 }], { NVDA: 100, TSLA: 200 }, 0, 1);
  assert.ok(a.cash >= 0 && a.cash < 1);
});

test("oversized sell closes the position; sells fund buys in the same round", () => {
  const a = acct();
  execute(a, [{ side: "buy", sym: "NVDA", usd: 10_000 }], { NVDA: 100 }, 0, 1);
  const f = execute(a, [{ side: "buy", sym: "TSLA", usd: 5000 }, { side: "sell", sym: "NVDA", usd: 1e9 }], { NVDA: 110, TSLA: 200 }, 1, 2);
  assert.equal(a.pos.NVDA, undefined);
  assert.deepEqual(f.map((x) => x.side), ["sell", "buy"]);
  assert.ok(f[0].pnl > 0);
});

test("unknown symbols, shorts and junk are ignored", () => {
  const a = acct();
  const f = execute(a, [{ side: "sell", sym: "NVDA", usd: 100 }, { side: "buy", sym: "XXX", usd: 100 }, { side: "buy", sym: "NVDA", usd: NaN }], { NVDA: 100 }, 0, 1);
  assert.equal(f.length, 0);
  assert.equal(a.cash, 10_000);
});
