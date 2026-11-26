// Ported from vitest-agent 1cf1ab94 packages/ui/__test__/classify.test.ts (MIT).
import { classifyOutcome, classifyShape, itemBucket, tally, verdictWord } from "@beep/gate-report/Classify";
import { Totals, Unit } from "@beep/gate-report/GateReport";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { PolicyBreach, PolicyRenderState } from "@beep/gate-report/Policy";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { FILE, failedTest, makeReport, testItem } from "./support/builders.ts";
import type { ItemDetail } from "@beep/gate-report/Item";

const file = (id: string) => Unit.make({ id, kind: "file", parent: O.some("@beep/glob") });
const pkg = (id: string) => Unit.make({ id, kind: "package" });

describe("classifyShape", () => {
  it("returns item for one unit with one item", () => {
    assert.strictEqual(
      classifyShape(makeReport({ units: [file(FILE)], items: [testItem({ name: "adds", outcome: "passed" })] })),
      "item"
    );
  });

  it("returns unit for one unit with more than one item", () => {
    const items = [testItem({ name: "adds", outcome: "passed" }), testItem({ name: "subtracts", outcome: "passed" })];
    assert.strictEqual(classifyShape(makeReport({ units: [file(FILE)], items })), "unit");
  });

  it("returns package for more than one unit", () => {
    const units = [file(FILE), file("src/b.test.ts")];
    assert.strictEqual(
      classifyShape(makeReport({ units, items: [testItem({ name: "adds", outcome: "passed" })] })),
      "package"
    );
  });

  it("returns package when items name one unit but several units were declared", () => {
    const units = [file(FILE), file("src/b.test.ts"), file("src/c.test.ts")];
    assert.strictEqual(
      classifyShape(makeReport({ units, items: [failedTest({ name: "divides", message: "x" })] })),
      "package"
    );
  });

  it("derives leaf units from the items when none were declared", () => {
    assert.strictEqual(classifyShape(makeReport({ items: [testItem({ name: "adds", outcome: "passed" })] })), "item");
    const items = [
      testItem({ name: "adds", outcome: "passed" }),
      testItem({ name: "other", outcome: "passed", unit: "src/b.test.ts" }),
    ];
    assert.strictEqual(classifyShape(makeReport({ items })), "package");
  });

  it("returns workspace when more than one package unit is present, whatever the leaf count", () => {
    assert.strictEqual(classifyShape(makeReport({ units: [pkg("@beep/a"), pkg("@beep/b")] })), "workspace");
    assert.strictEqual(
      classifyShape(
        makeReport({
          units: [pkg("@beep/a"), pkg("@beep/b"), file(FILE)],
          items: [testItem({ name: "adds", outcome: "passed" })],
        })
      ),
      "workspace"
    );
  });

  it("returns package for the empty report", () => {
    assert.strictEqual(classifyShape(makeReport()), "package");
  });

  it("one package unit is not a workspace", () => {
    assert.strictEqual(
      classifyShape(
        makeReport({ units: [pkg("@beep/glob"), file(FILE)], items: [testItem({ name: "adds", outcome: "passed" })] })
      ),
      "item"
    );
  });

  it("does not count fault items toward the item shape", () => {
    const fault = testItem({
      name: "load",
      outcome: "failed",
      key: ItemKey.cases.FaultKey.make({ unit: FILE, kind: "load", name: "load" }),
      failureKind: O.some("load"),
    });
    assert.strictEqual(classifyShape(makeReport({ units: [file(FILE)], items: [fault] })), "unit");
  });
});

const breaches = (...values: ReadonlyArray<PolicyBreach>) => PolicyRenderState.makeOption({ breaches: values });
const coverage = PolicyBreach.cases.CoverageBreach.make({ metric: "lines", expected: 80, actual: 72 });
const glob = PolicyBreach.cases.CoverageBreach.make({
  metric: "branches",
  expected: 70,
  actual: 60,
  pattern: O.some("src/**"),
});

describe("classifyOutcome: retargeted vitest-agent cases on the widened shapes and outcomes, plus the extended precedence cases", () => {
  const passed = Totals.make({ collected: 2, passed: 2 });

  it("returns all-pass for a clean run with no policy", () => {
    assert.strictEqual(
      classifyOutcome({ reason: "passed", totals: passed, policy: O.none() }),
      "all-pass",
      "retargets vitest-agent 1cf1ab94 packages/ui/__test__/classify.test.ts onto the widened shapes and outcomes"
    );
  });

  it("returns some-fail when a failure total is non-zero", () => {
    const totals = Totals.make({ collected: 2, passed: 1, failed: 1 });
    assert.strictEqual(classifyOutcome({ reason: "passed", totals, policy: O.none() }), "some-fail");
  });

  it("returns policy-violation when there is no failure and a breach exists", () => {
    assert.strictEqual(
      classifyOutcome({ reason: "passed", totals: passed, policy: breaches(coverage) }),
      "policy-violation"
    );
  });

  it("returns policy-violation when only a glob aggregate shortfall exists", () => {
    assert.strictEqual(
      classifyOutcome({ reason: "passed", totals: passed, policy: breaches(glob) }),
      "policy-violation"
    );
  });

  it("some-fail wins over a breach and over a glob shortfall", () => {
    const totals = Totals.make({ collected: 2, failed: 2 });
    assert.strictEqual(classifyOutcome({ reason: "failed", totals, policy: breaches(coverage, glob) }), "some-fail");
  });

  it("returns some-fail for a timeout-only run, and with real failures too", () => {
    assert.strictEqual(
      classifyOutcome({ reason: "passed", totals: Totals.make({ collected: 1, timedOut: 1 }), policy: O.none() }),
      "some-fail"
    );
    assert.strictEqual(
      classifyOutcome({
        reason: "failed",
        totals: Totals.make({ collected: 2, failed: 1, timedOut: 1 }),
        policy: O.none(),
      }),
      "some-fail"
    );
  });

  it("a timeout wins over a breach", () => {
    const totals = Totals.make({ collected: 1, timedOut: 1 });
    assert.strictEqual(classifyOutcome({ reason: "passed", totals, policy: breaches(coverage) }), "some-fail");
  });

  it("returns some-fail for an unhandled-only, load-only, hook-only or errored-only run", () => {
    for (const totals of [
      Totals.make({ collected: 1, passed: 1, unhandled: 1 }),
      Totals.make({ collected: 1, loadFailed: 1 }),
      Totals.make({ collected: 1, passed: 1, hookFailed: 1 }),
      Totals.make({ collected: 1, passed: 1, errored: 1 }),
    ]) {
      assert.strictEqual(classifyOutcome({ reason: "passed", totals, policy: O.none() }), "some-fail");
    }
  });

  it("returns all-pass when the policy slot is present but holds no breach", () => {
    assert.strictEqual(classifyOutcome({ reason: "passed", totals: passed, policy: breaches() }), "all-pass");
  });

  it("returns interrupted for a cancelled run, whatever else holds", () => {
    const totals = Totals.make({ collected: 2, failed: 2 });
    assert.strictEqual(classifyOutcome({ reason: "cancelled", totals, policy: breaches(coverage) }), "interrupted");
  });

  it("returns some-fail for an errored or failed reason with zero failure totals", () => {
    assert.strictEqual(classifyOutcome({ reason: "errored", totals: Totals.make({}), policy: O.none() }), "some-fail");
    assert.strictEqual(classifyOutcome({ reason: "failed", totals: passed, policy: O.none() }), "some-fail");
  });

  it("returns warnings-only for warnings and nothing worse, and a breach outranks warnings", () => {
    const totals = Totals.make({ collected: 3, passed: 2, warned: 1 });
    assert.strictEqual(classifyOutcome({ reason: "passed", totals, policy: O.none() }), "warnings-only");
    assert.strictEqual(classifyOutcome({ reason: "passed", totals, policy: breaches(coverage) }), "policy-violation");
  });
});

describe("itemBucket and tally", () => {
  it("buckets every outcome and failure kind", () => {
    const faultKey = ItemKey.cases.FaultKey.make({ unit: FILE, kind: "unhandled", name: "errored" });
    const cases: ReadonlyArray<readonly [ReturnType<typeof testItem>, string]> = [
      [testItem({ name: "a", outcome: "passed" }), "passed"],
      [testItem({ name: "a", outcome: "warned" }), "warned"],
      [testItem({ name: "a", outcome: "skipped" }), "skipped"],
      [testItem({ name: "a", outcome: "failed" }), "failed"],
      [testItem({ name: "a", outcome: "failed", failureKind: O.some("assertion") }), "failed"],
      [testItem({ name: "a", outcome: "failed", failureKind: O.some("timeout") }), "timedOut"],
      [testItem({ name: "a", outcome: "failed", failureKind: O.some("load") }), "loadFailed"],
      [testItem({ name: "a", outcome: "failed", failureKind: O.some("hook") }), "hookFailed"],
      [testItem({ name: "a", outcome: "failed", failureKind: O.some("unhandled") }), "unhandled"],
      [testItem({ name: "a", outcome: "failed", key: faultKey }), "errored"],
      [testItem({ name: "a", outcome: "failed", key: faultKey, failureKind: O.some("assertion") }), "errored"],
    ];
    for (const [item, bucket] of cases) {
      assert.strictEqual(itemBucket(item), bucket);
    }
  });

  it("tallies items and keeps the supplied collected count and duration", () => {
    const totals = tally({
      items: [
        testItem({ name: "a", outcome: "passed" }),
        failedTest({ name: "b", message: "x" }),
        testItem({ name: "c", outcome: "skipped" }),
      ],
      collected: 5,
      durationMs: 9,
    });
    assert.deepStrictEqual(totals, Totals.make({ collected: 5, passed: 1, failed: 1, skipped: 1, durationMs: 9 }));
  });
});

describe("verdictWord", () => {
  it("is the run reason in capitals", () => {
    assert.deepStrictEqual(A.map(["passed", "failed", "errored", "cancelled"] as const, verdictWord), [
      "PASSED",
      "FAILED",
      "ERRORED",
      "CANCELLED",
    ]);
  });
});

describe("ItemDetail on fault items", () => {
  it("a fault item without detail still buckets by kind", () => {
    const item = testItem({
      name: "hook",
      outcome: "failed",
      failureKind: O.some("hook"),
      detail: O.none<ItemDetail>(),
    });
    assert.strictEqual(itemBucket(item), "hookFailed");
  });
});
