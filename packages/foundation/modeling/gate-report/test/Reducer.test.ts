// Retargets upstream packages/ui/__test__/reducer.test.ts and the model half
// of packages/sdk/__test__/build-report.test.ts (vitest-agent 1cf1ab94), and
// holds the AC-L4 honest-count cases. Cases about Vitest objects (stack
// frames, missing diagnostics, throwing getters, unknown states) belong to the
// Vitest adapter slice and are listed in its port inventory.

import { Unit } from "@beep/gate-report/GateReport";
import { ItemDetail } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { PolicyBreach } from "@beep/gate-report/Policy";
import { IncompleteRunError, reduceEvents } from "@beep/gate-report/Reducer";
import { StrayOutput } from "@beep/gate-report/StrayOutput";
import { itemOutcomeFromTestState } from "@beep/gate-report/Widening";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { E, FILE, failedTest, finished, reduce, runFinished, runStarted, testItem } from "./support/builders.ts";
import type { GateEvent } from "@beep/gate-report/GateEvent";

const fileUnit = Unit.make({ id: FILE, kind: "file", parent: O.some("@beep/glob") });
const key = (name: string) => ItemKey.cases.TestKey.make({ file: FILE, fullName: `math > ${name}` });

describe("reduceEvents — individual events", () => {
  it("RunStarted carries the run id, gate, subject, start and input fingerprint", () => {
    const report = reduce([runStarted({ head: O.some("abc"), branch: O.some("main") }), runFinished()]);
    assert.strictEqual(report.runId, "r1");
    assert.strictEqual(report.gate, "test");
    assert.strictEqual(report.subject, "@beep/glob");
    assert.strictEqual(report.inputFingerprint, "fingerprint");
    assertSome(report.head, "abc");
    assertSome(report.branch, "main");
  });

  it("a second RunStarted resets units, items, breaches and stray output from the previous run", () => {
    const report = reduce([
      runStarted({ runId: "old" }),
      E.UnitQueued.make({ unit: fileUnit }),
      finished(failedTest({ name: "divides", message: "boom" })),
      E.PolicyBreached.make({ breach: PolicyBreach.cases.ErrorBudgetBreach.make({ budget: 0, actual: 1 }) }),
      E.StrayOutputCaptured.make({
        strayOutput: StrayOutput.make({ total: 1, stdout: 1, stderr: 0, bytes: 2, samples: [] }),
      }),
      runStarted({ runId: "new" }),
      E.UnitCollected.make({ unit: FILE, items: 1 }),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished(),
    ]);
    assert.strictEqual(report.runId, "new");
    assert.deepStrictEqual(report.units, []);
    assert.deepStrictEqual(
      A.map(report.items, (item) => item.name),
      ["adds"]
    );
    assertNone(report.policy);
    assertNone(report.strayOutput);
  });

  it("events before the first RunStarted are dropped", () => {
    const report = reduce([
      E.UnhandledError.make({ detail: ItemDetail.make({ message: "early" }) }),
      finished(testItem({ name: "early", outcome: "failed" })),
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished(),
    ]);
    assert.deepStrictEqual(
      A.map(report.items, (item) => item.name),
      ["adds"]
    );
    assert.strictEqual(report.totals.unhandled, 0);
  });

  it("UnitQueued adds a unit, and queueing twice keeps the first", () => {
    const report = reduce([
      runStarted(),
      E.UnitQueued.make({ unit: fileUnit }),
      E.UnitQueued.make({ unit: Unit.make({ id: FILE, kind: "job" }) }),
      runFinished({ collected: O.some(1) }),
    ]);
    assert.deepStrictEqual(report.units, [fileUnit]);
  });

  it("UnitQueued threads the parent package onto the unit, and a unit without one has none", () => {
    const report = reduce([
      runStarted(),
      E.UnitQueued.make({ unit: fileUnit }),
      E.UnitQueued.make({ unit: Unit.make({ id: "src/b.test.ts", kind: "file" }) }),
      runFinished({ collected: O.some(1) }),
    ]);
    assertSome(report.units[0]?.parent ?? O.none(), "@beep/glob");
    assertNone(report.units[1]?.parent ?? O.some("unexpected"));
  });

  it("UnitStarted and ItemStarted pass through without changing the report", () => {
    const base = [
      runStarted(),
      E.UnitQueued.make({ unit: fileUnit }),
      finished(testItem({ name: "adds", outcome: "passed" })),
    ];
    const withStarts = [
      ...base,
      E.UnitStarted.make({ unit: FILE }),
      E.UnitStarted.make({ unit: "src/undeclared.test.ts" }),
      E.ItemStarted.make({ key: key("adds"), unit: FILE }),
      runFinished(),
    ];
    assert.deepStrictEqual(reduce(withStarts), reduce([...base, runFinished()]));
  });

  it("an item that started but never finished is not in the report", () => {
    const report = reduce([runStarted(), E.ItemStarted.make({ key: key("hangs"), unit: FILE }), runFinished()]);
    assert.deepStrictEqual(report.items, []);
  });

  it("a second ItemFinished for the same key replaces the first in place", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "failed" })),
      finished(testItem({ name: "subtracts", outcome: "passed" })),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished(),
    ]);
    assert.deepStrictEqual(
      A.map(report.items, (item) => [item.name, item.outcome]),
      [
        ["adds", "passed"],
        ["subtracts", "passed"],
      ]
    );
  });

  it("a failed item arrives without a label", () => {
    const report = reduce([runStarted(), finished(failedTest({ name: "divides", message: "boom" })), runFinished()]);
    assertNone(report.items[0]?.label ?? O.some("persistent"));
  });

  it("UnitFinished records the unit's duration", () => {
    const report = reduce([
      runStarted(),
      E.UnitQueued.make({ unit: fileUnit }),
      E.UnitFinished.make({ unit: FILE, durationMs: 42 }),
      E.UnitFinished.make({ unit: "src/undeclared.test.ts", durationMs: 7 }),
      runFinished({ collected: O.some(1) }),
    ]);
    assertSome(report.units[0]?.durationMs ?? O.none(), 42);
    assert.strictEqual(report.units.length, 1);
  });

  it("PolicyBreached appends breaches in order and needs no prior event", () => {
    const first = PolicyBreach.cases.CoverageBreach.make({ metric: "lines", expected: 80, actual: 72 });
    const second = PolicyBreach.cases.CoverageBreach.make({ metric: "branches", expected: 70, actual: 60 });
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      E.PolicyBreached.make({ breach: first }),
      E.PolicyBreached.make({ breach: second }),
      runFinished(),
    ]);
    assertSome(
      O.map(report.policy, (policy) => policy.breaches),
      [first, second]
    );
    assert.strictEqual(report.outcome, "policy-violation");
  });

  it("a run without a breach has no policy slot", () => {
    assertNone(reduce([runStarted(), finished(testItem({ name: "adds", outcome: "passed" })), runFinished()]).policy);
  });

  it("ItemLabelled sets the label of the matching item and ignores an unknown key", () => {
    const report = reduce([
      runStarted(),
      finished(failedTest({ name: "divides", message: "boom" })),
      E.ItemLabelled.make({ key: key("divides"), label: "persistent" }),
      E.ItemLabelled.make({ key: key("unknown"), label: "flaky" }),
      runFinished(),
    ]);
    assert.strictEqual(report.items.length, 1);
    assertSome(report.items[0]?.label ?? O.none(), "persistent");
  });

  it("RunFinished sets the duration; totals are counted from the items", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      finished(testItem({ name: "skips", outcome: "skipped" })),
      runFinished({ durationMs: 250 }),
    ]);
    assert.strictEqual(report.durationMs, 250);
    assert.strictEqual(report.totals.durationMs, 250);
    assert.strictEqual(report.totals.passed, 1);
    assert.strictEqual(report.totals.skipped, 1);
  });

  it("UnhandledError adds one fault item per error with its own total", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      E.UnhandledError.make({ detail: ItemDetail.make({ message: "late rejection" }) }),
      E.UnhandledError.make({ detail: ItemDetail.make({ message: "late rejection" }) }),
      runFinished(),
    ]);
    assert.strictEqual(report.totals.unhandled, 2);
    assert.strictEqual(report.totals.failed, 0);
    assert.strictEqual(report.reason, "failed");
    assert.strictEqual(report.outcome, "some-fail");
  });

  it("RunFinished.collected wins over UnitCollected, which wins over the item count", () => {
    const events = [
      runStarted(),
      E.UnitCollected.make({ unit: FILE, items: 4 }),
      E.UnitCollected.make({ unit: "src/b.test.ts", items: 3 }),
      finished(testItem({ name: "adds", outcome: "passed" })),
    ];
    assert.strictEqual(reduce([...events, runFinished({ collected: O.some(12) })]).totals.collected, 12);
    assert.strictEqual(reduce([...events, runFinished()]).totals.collected, 7);
    assert.strictEqual(
      reduce([runStarted(), finished(testItem({ name: "adds", outcome: "passed" })), runFinished()]).totals.collected,
      1
    );
  });
});

describe("reduceEvents — canonical runs", () => {
  it("an all-pass run finishes passed with matching totals", () => {
    const report = reduce([
      runStarted(),
      E.UnitCollected.make({ unit: FILE, items: 2 }),
      finished(testItem({ name: "adds", outcome: "passed" })),
      finished(testItem({ name: "subtracts", outcome: "passed" })),
      runFinished(),
    ]);
    assert.strictEqual(report.reason, "passed");
    assert.strictEqual(report.outcome, "all-pass");
    assert.strictEqual(report.totals.passed, 2);
  });

  it("a mixed run records the failing item and its label", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      finished(failedTest({ name: "divides", message: "expected 0.5 to equal 0.5000001" })),
      E.ItemLabelled.make({ key: key("divides"), label: "introduced-on-lane" }),
      runFinished({ reason: "failed", exitCode: O.some(1) }),
    ]);
    assert.strictEqual(report.reason, "failed");
    assert.strictEqual(report.totals.failed, 1);
    assertSome(report.items[1]?.label ?? O.none(), "introduced-on-lane");
  });

  it("a flaky-and-recovered run keeps both labels", () => {
    const report = reduce([
      runStarted(),
      finished(failedTest({ name: "flaps", message: "boom" })),
      finished(failedTest({ name: "heals", message: "boom" })),
      E.ItemLabelled.make({ key: key("flaps"), label: "flaky" }),
      E.ItemLabelled.make({ key: key("heals"), label: "recovered" }),
      runFinished({ reason: "failed" }),
    ]);
    assert.deepStrictEqual(
      A.map(report.items, (item) => O.getOrNull(item.label)),
      ["flaky", "recovered"]
    );
  });

  it("reducing is deterministic and leaves the event array untouched", () => {
    const events = [runStarted(), finished(testItem({ name: "adds", outcome: "passed" })), runFinished()];
    const copy = [...events];
    assert.deepStrictEqual(reduce(events), reduce(events));
    assert.deepStrictEqual(events, copy);
  });

  it("RunCancelled ends the run even when no RunFinished follows", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      E.RunCancelled.make({ message: "process timeout" }),
    ]);
    assert.strictEqual(report.reason, "cancelled");
    assert.strictEqual(report.outcome, "interrupted");
  });

  it("a run without a start or an end is an IncompleteRunError", () => {
    assertFailure(reduceEvents([runFinished()]), IncompleteRunError.make({ message: "the events hold no RunStarted" }));
    assertFailure(
      reduceEvents([runStarted()]),
      IncompleteRunError.make({ message: "the events hold no RunFinished or RunCancelled" })
    );
  });
});

describe("reduceEvents — timeouts and unit faults (build-report retargeted)", () => {
  it("a timed-out item counts as timed out, not failed, and fails the run", () => {
    const report = reduce([
      runStarted(),
      finished(failedTest({ name: "slow", message: "Test timed out in 5000ms", failureKind: O.some("timeout") })),
      runFinished({ reason: "failed" }),
    ]);
    assert.strictEqual(report.totals.timedOut, 1);
    assert.strictEqual(report.totals.failed, 0);
    assert.strictEqual(report.outcome, "some-fail");
  });

  it("a load failure with zero items is surfaced as its own total and fails the run", () => {
    const report = reduce([
      runStarted(),
      E.UnitFaulted.make({
        unit: FILE,
        kind: "load",
        name: "load",
        detail: ItemDetail.make({ message: "Cannot find module './missing'" }),
      }),
      runFinished({ reason: "failed", collected: O.some(1) }),
    ]);
    assert.strictEqual(report.totals.loadFailed, 1);
    assert.strictEqual(report.totals.failed, 0);
    assert.strictEqual(report.reason, "failed");
    assert.strictEqual(report.outcome, "some-fail");
  });

  it("an afterAll hook that threw fails the unit though every item passed", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      E.UnitFaulted.make({
        unit: FILE,
        kind: "hook",
        name: "afterAll",
        detail: ItemDetail.make({ message: "teardown failed" }),
      }),
      runFinished(),
    ]);
    assert.strictEqual(report.totals.hookFailed, 1);
    assert.strictEqual(report.totals.passed, 1);
    assert.strictEqual(report.reason, "failed");
  });

  it("a fault with an empty message still counts (a unit in state failed with no errors)", () => {
    const report = reduce([
      runStarted(),
      E.UnitFaulted.make({ unit: FILE, kind: "load", name: "load", detail: ItemDetail.make({ message: "" }) }),
      runFinished({ collected: O.some(1) }),
    ]);
    assert.strictEqual(report.totals.loadFailed, 1);
    assert.strictEqual(report.reason, "failed");
  });

  it("failed counts ordinary failures only; load and hook faults keep their own totals", () => {
    const report = reduce([
      runStarted(),
      finished(failedTest({ name: "divides", message: "boom" })),
      E.UnitFaulted.make({
        unit: "src/b.test.ts",
        kind: "load",
        name: "load",
        detail: ItemDetail.make({ message: "x" }),
      }),
      E.UnitFaulted.make({ unit: FILE, kind: "hook", name: "beforeAll", detail: ItemDetail.make({ message: "y" }) }),
      runFinished({ reason: "failed" }),
    ]);
    assert.deepStrictEqual([report.totals.failed, report.totals.loadFailed, report.totals.hookFailed], [1, 1, 1]);
  });

  it("a passing tool reason self-corrects to failed when a fault exists", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      E.UnitFaulted.make({
        unit: "src/b.test.ts",
        kind: "load",
        name: "load",
        detail: ItemDetail.make({ message: "x" }),
      }),
      runFinished({ reason: "passed", exitCode: O.some(0) }),
    ]);
    assert.strictEqual(report.reason, "failed");
  });

  it("a pending test state is counted as skipped", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "todo", outcome: itemOutcomeFromTestState("pending") })),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished(),
    ]);
    assert.strictEqual(report.totals.skipped, 1);
    assert.strictEqual(report.reason, "passed");
  });

  it("records passing items and their retries, and keeps a failure's diff", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed", attempts: O.some(["failed", "passed"]) })),
      finished(failedTest({ name: "divides", message: "boom" })),
      runFinished({ reason: "failed" }),
    ]);
    assertSome(report.items[0]?.attempts ?? O.none(), ["failed", "passed"]);
    assertSome(
      O.flatMap(report.items[1]?.detail ?? O.none(), (detail) => detail.diff),
      "- expected\n+ received"
    );
  });
});

describe("honest counts (AC-L4)", () => {
  it("a run with nothing collected is ERRORED, never PASSED", () => {
    const report = reduce([runStarted(), runFinished({ reason: "passed", exitCode: O.some(0) })]);
    assert.strictEqual(report.reason, "errored");
    assert.strictEqual(report.outcome, "some-fail");
    assert.strictEqual(report.totals.collected, 0);
  });

  it("a nonzero exit with no failed item is ERRORED with one item carrying the log excerpt", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished({ reason: "passed", exitCode: O.some(2), logExcerpt: O.some("Segmentation fault") }),
    ]);
    assert.strictEqual(report.reason, "errored");
    assert.strictEqual(report.totals.errored, 1);
    const fallback = A.filter(report.items, (item) => ItemKey.guards.FaultKey(item.key));
    assert.strictEqual(fallback.length, 1);
    assertSome(
      O.map(fallback[0]?.detail ?? O.none(), (detail) => detail.message),
      "Segmentation fault"
    );
  });

  it("the errored item names the exit code, or the tool's reason, when no excerpt was kept", () => {
    const byExit = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished({ exitCode: O.some(3) }),
    ]);
    const byReason = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished({ reason: "errored", exitCode: O.none() }),
    ]);
    const message = (report: typeof byExit) =>
      O.getOrNull(O.map(report.items[1]?.detail ?? O.none(), (detail) => detail.message));
    assert.strictEqual(message(byExit), "the tool exited with code 3 and reported no failed item");
    assert.strictEqual(message(byReason), "the tool reported errored and no failed item");
  });

  it("a zero exit with a failed item is FAILED", () => {
    const report = reduce([
      runStarted(),
      finished(failedTest({ name: "divides", message: "boom" })),
      runFinished({ reason: "passed", exitCode: O.some(0) }),
    ]);
    assert.strictEqual(report.reason, "failed");
    assert.strictEqual(report.totals.errored, 0);
  });

  it("timeouts, load failures, hook failures, unhandled errors and cancellation never yield all-pass", () => {
    const fault = (kind: "load" | "hook") =>
      E.UnitFaulted.make({ unit: FILE, kind, name: kind, detail: ItemDetail.make({ message: kind }) });
    const runs: ReadonlyArray<ReadonlyArray<GateEvent>> = [
      [finished(failedTest({ name: "slow", message: "timeout", failureKind: O.some("timeout") }))],
      [finished(testItem({ name: "adds", outcome: "passed" })), fault("load")],
      [finished(testItem({ name: "adds", outcome: "passed" })), fault("hook")],
      [
        finished(testItem({ name: "adds", outcome: "passed" })),
        E.UnhandledError.make({ detail: ItemDetail.make({ message: "x" }) }),
      ],
      [finished(testItem({ name: "adds", outcome: "passed" })), E.RunCancelled.make({ message: "SIGINT" })],
    ];
    for (const events of runs) {
      const report = reduce([runStarted(), ...events, runFinished()]);
      assert.notStrictEqual(report.outcome, "all-pass");
    }
  });

  it("a cancelled run with a nonzero exit is CANCELLED and gets no errored item", () => {
    const report = reduce([
      runStarted(),
      finished(testItem({ name: "adds", outcome: "passed" })),
      runFinished({ reason: "cancelled", exitCode: O.some(130) }),
    ]);
    assert.strictEqual(report.reason, "cancelled");
    assert.strictEqual(report.totals.errored, 0);
  });
});
