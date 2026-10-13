import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as A from "effect/Array";
import type { Counter, Inline } from "../../../effected/cli/Doc.ts";
import { columnLabel, counterLabel, countsTableOf, totalOf, visibleCountersOf } from "../../../effected/cli/internal/counts.ts";
const runs = { arbitrary: fcRuns(100) };
const count = S.Int.check(S.isBetween({ minimum: 0, maximum: 100000 }));
const counter = (n: number): Counter => ({ key: "repos", label: { one: "repo", other: "repos" }, n, status: { name: "ok", def: { glyph: "+", ascii: "+", token: "success", rank: 0 } } });
it.effect.prop("counts tables preserve first-seen columns and first duplicate values, labels and tokens", [Arbitrary.schema(count), Arbitrary.schema(count)], ([first, second]) => Effect.sync(() => {
  const duplicate: Counter = { ...counter(999999), label: "ignored", status: { name: "bad", def: { glyph: "-", ascii: "-", token: "failure", rank: 1 } } };
  const extra: Counter = { ...counter(7), key: "extra", label: "extras" };
  const table = countsTableOf({ _tag: "CountsTable", rows: [
    { label: [], counters: [counter(first), duplicate, extra] },
    { label: [], counters: [{ ...duplicate, n: second }, counter(888888)] },
    { label: [], counters: [] },
  ], totalRow: true });
  assert.deepStrictEqual(table.columns, [
    { header: [] },
    { header: [{ _tag: "Text", value: "repos" }] },
    { header: [{ _tag: "Text", value: "extras" }] },
  ]);
  assert.deepStrictEqual(table.rows, [
    [[], [{ _tag: "Text", value: String(first), token: "success" }], [{ _tag: "Text", value: "7", token: "success" }]],
    [[], [{ _tag: "Text", value: String(second), token: "failure" }], []],
    [[], [], []],
    [[{ _tag: "Text", value: "Total" }], [{ _tag: "Text", value: String(first + second) }], [{ _tag: "Text", value: "7" }]],
  ]);
}), runs);
it.effect("counts-table key discovery and lookup scale with the input and emitted cells", () => Effect.sync(() => {
  for (const size of [10, 20, 40]) {
    let reads = 0;
    const counters = A.makeBy(size, (index): Counter => ({ ...counter(index), get key() { reads += 1; return `key_${index}`; } }));
    const table = countsTableOf({ _tag: "CountsTable", rows: [{ label: [], counters }], totalRow: true });
    assert.lengthOf(table.columns, size + 1);
    assert.lengthOf(table.rows, 2);
    assert.deepStrictEqual(table.rows[0], [[], ...A.makeBy(size, (index): ReadonlyArray<Inline> => [{ _tag: "Text", value: String(index), token: "success" }])]);
    assert.isAtMost(reads, size * 4, "key reads remain linear when the column count doubles");
  }
}));
it.effect.prop("counter labels preserve singular/plural semantics and number cells round-trip", [Arbitrary.schema(count)], ([n]) => Effect.sync(() => {
  const c = counter(n);
  assert.strictEqual(counterLabel(c), n === 1 ? "repo" : "repos");
  assert.strictEqual(counterLabel(n)(c), counterLabel(c));
  assert.strictEqual(columnLabel(c), "repos");
  const block = { _tag: "Counts" as const, layout: "inline" as const, counters: [c] };
  assert.strictEqual(totalOf(block), n);
  const visible = visibleCountersOf(block);
  assert.deepStrictEqual(visible, n === 0 ? [] : [c]);
  assert.deepStrictEqual(visibleCountersOf({ ...block, counters: visible }), visible);
  const table = countsTableOf({ _tag: "CountsTable", rows: [{ label: [], counters: [c] }] });
  assert.deepStrictEqual(table.rows, [[[], [{ _tag: "Text", value: String(n), token: "success" }]]]);
  assert.strictEqual(Number(String(n)), n);
  assert.deepStrictEqual(countsTableOf({ _tag: "CountsTable", rows: [{ label: [], counters: [counter(Number(String(n)))] }] }), table);
}), runs);
