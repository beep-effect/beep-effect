// Folding the runs one script invocation made into one report: units and items
// once each, totals recounted, the worse reason, policy and stray output summed.
import { Totals, Unit } from "@beep/gate-report/GateReport";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { PolicyBreach, PolicyRenderState } from "@beep/gate-report/Policy";
import { mergeReports } from "@beep/gate-report/ReportMerge";
import { StrayOutput, StrayOutputSample } from "@beep/gate-report/StrayOutput";
import { worstReason } from "@beep/gate-report/Vocabulary";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { failedTest, makeReport, testItem } from "./support/builders.ts";

const pkg = Unit.make({ id: "@beep/glob", kind: "package" });
const fileUnit = (id: string) => Unit.make({ id, kind: "file", parent: O.some("@beep/glob") });

const other = (name: string) =>
  testItem({
    name,
    outcome: "passed",
    unit: "test/node.test.ts",
    key: ItemKey.cases.TestKey.make({ file: "test/node.test.ts", fullName: name }),
  });

const breach = PolicyBreach.cases.CoverageBreach.make({ metric: "lines", expected: 90, actual: 80 });

const stray = (total: number) =>
  StrayOutput.make({
    total,
    stdout: total,
    stderr: 0,
    bytes: total * 4,
    samples: [StrayOutputSample.make({ stream: "stdout", text: `line ${total}` })],
  });

describe("mergeReports", () => {
  it("keeps every unit and item once, recounts the totals and sums the durations", () => {
    const earlier = makeReport({
      runId: "first",
      durationMs: 100,
      units: [pkg, fileUnit("src/math.test.ts")],
      items: [
        failedTest({ name: "adds", message: "expected 1 to be 2" }),
        testItem({ name: "subtracts", outcome: "passed" }),
      ],
      totals: Totals.make({ collected: 2 }),
      reason: "failed",
      outcome: "some-fail",
    });
    const later = makeReport({
      runId: "second",
      durationMs: 40,
      units: [pkg, fileUnit("test/node.test.ts")],
      items: [other("boundary")],
      totals: Totals.make({ collected: 1, passed: 1 }),
    });
    const merged = mergeReports(earlier, later);
    assert.strictEqual(merged.runId, "first");
    assert.strictEqual(merged.durationMs, 140);
    assert.deepStrictEqual(
      A.map(merged.units, (unit) => unit.id),
      ["@beep/glob", "src/math.test.ts", "test/node.test.ts"]
    );
    assert.deepStrictEqual(
      A.map(merged.items, (item) => item.name),
      ["adds", "subtracts", "boundary"]
    );
    assert.deepStrictEqual(
      [merged.totals.collected, merged.totals.passed, merged.totals.failed, merged.totals.durationMs],
      [3, 2, 1, 140]
    );
    assert.strictEqual(merged.reason, "failed");
    assert.strictEqual(merged.outcome, "some-fail");
    assertSome(
      O.flatMap(A.head(merged.items), (item) => O.map(item.detail, (detail) => detail.message)),
      "expected 1 to be 2"
    );
  });

  it("keeps the later result of a key both runs report, in the earlier place", () => {
    const earlier = makeReport({
      items: [failedTest({ name: "adds", message: "red" }), testItem({ name: "x", outcome: "passed" })],
    });
    const later = makeReport({ items: [testItem({ name: "adds", outcome: "passed" })] });
    const merged = mergeReports(later)(earlier);
    assert.deepStrictEqual(
      A.map(merged.items, (item) => [item.name, item.outcome]),
      [
        ["adds", "passed"],
        ["x", "passed"],
      ]
    );
    assert.strictEqual(merged.totals.failed, 0);
  });

  it("keeps the worse reason, and a clean pair passes", () => {
    const cancelled = mergeReports(makeReport({ reason: "errored" }), makeReport({ reason: "cancelled" }));
    assert.strictEqual(cancelled.reason, "cancelled");
    assert.strictEqual(cancelled.outcome, "interrupted");
    const clean = mergeReports(makeReport(), makeReport());
    assert.strictEqual(clean.reason, "passed");
    assert.strictEqual(clean.outcome, "all-pass");
    assert.strictEqual(worstReason(["passed", "failed"]), "failed");
    assert.strictEqual(worstReason([]), "passed");
  });

  it("adds up policy breaches and stray output, and keeps what only one run has", () => {
    const withBreach = makeReport({ policy: PolicyRenderState.makeOption({ breaches: [breach] }) });
    const bothBreached = mergeReports(withBreach, withBreach);
    assertSome(
      O.map(bothBreached.policy, (state) => state.breaches.length),
      2
    );
    assert.strictEqual(bothBreached.outcome, "policy-violation");
    const emptyPolicy = makeReport({ policy: PolicyRenderState.makeOption({ breaches: [] }) });
    assertSome(
      O.map(mergeReports(emptyPolicy, makeReport()).policy, (state) => state.breaches.length),
      0
    );
    assertNone(mergeReports(makeReport(), makeReport()).policy);
    const strays = mergeReports(
      makeReport({ strayOutput: O.some(stray(2)) }),
      makeReport({ strayOutput: O.some(stray(3)) })
    );
    assertSome(
      O.map(strays.strayOutput, (output) => [output.total, output.bytes, output.samples.length]),
      [5, 20, 2]
    );
    assertSome(
      O.map(
        mergeReports(makeReport(), makeReport({ strayOutput: O.some(stray(1)) })).strayOutput,
        (output) => output.total
      ),
      1
    );
    assertSome(
      O.map(
        mergeReports(makeReport({ strayOutput: O.some(stray(4)) }), makeReport()).strayOutput,
        (output) => output.total
      ),
      4
    );
  });
});
