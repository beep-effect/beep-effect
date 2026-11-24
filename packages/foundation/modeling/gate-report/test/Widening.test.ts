import { classifyOutcome, classifyShape } from "@beep/gate-report/Classify";
import { FailureEntry, GatePointers, PointerTable } from "@beep/gate-report/ConsoleDocument";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { ItemKey, SeriesKey } from "@beep/gate-report/ItemKey";
import { PolicyBreach, PolicyRenderState } from "@beep/gate-report/Policy";
import { HistoryLabel, ItemOutcome, RunOutcome, RunReason, RunShape } from "@beep/gate-report/Vocabulary";
import {
  historyLabelFromUpstream,
  itemOutcomeFromTestState,
  runOutcomeFromUpstream,
  runReasonFromUpstream,
  runShapeFromUpstream,
  UpstreamClassification,
  UpstreamRunOutcome,
  UpstreamRunReason,
  UpstreamRunShape,
  UpstreamTestState,
} from "@beep/gate-report/Widening";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { epoch, makeReport } from "./support/builders.ts";

describe("widening table (SPEC): each vitest-agent 1cf1ab94 fixture value maps to its widened model type", () => {
  it("TestState -> ItemOutcome adds warned; pending folds into skipped", () => {
    assert.deepStrictEqual(A.map(UpstreamTestState.literals, itemOutcomeFromTestState), [
      "passed",
      "failed",
      "skipped",
      "skipped",
    ]);
    assert.isTrue(ItemOutcome.is.warned("warned"));
  });

  it("TestRunReason -> RunReason adds errored; interrupted becomes cancelled", () => {
    assert.deepStrictEqual(A.map(UpstreamRunReason.literals, runReasonFromUpstream), ["passed", "failed", "cancelled"]);
    assert.isTrue(RunReason.is.errored("errored"));
  });

  it("RunShape: single-test, single-file, single-project, workspace become item, unit, package, workspace", () => {
    assert.deepStrictEqual(A.map(UpstreamRunShape.literals, runShapeFromUpstream), [...RunShape.literals]);
  });

  it("RunOutcome adds warnings-only and interrupted; threshold-violation becomes policy-violation", () => {
    assert.deepStrictEqual(A.map(UpstreamRunOutcome.literals, runOutcomeFromUpstream), [
      "all-pass",
      "some-fail",
      "policy-violation",
    ]);
    assert.isTrue(RunOutcome.is["warnings-only"]("warnings-only"));
    assert.isTrue(RunOutcome.is.interrupted("interrupted"));
  });

  it("TestClassification -> HistoryLabel: stable carries no label, new-failure becomes introduced-on-lane", () => {
    assert.deepStrictEqual(
      A.map(UpstreamClassification.literals, (value) => O.getOrNull(historyLabelFromUpstream(value))),
      [null, "introduced-on-lane", "persistent", "flaky", "recovered"]
    );
    assert.isTrue(HistoryLabel.is["red-on-main"]("red-on-main"));
  });

  it("ReportError -> ItemDetail, with location, code, rule and severity on the item", () => {
    const upstream = { message: "expected 1 to be 2", stack: "at f (a.ts:1:1)", diff: "- 2\n+ 1" };
    const item = Item.make({
      key: ItemKey.cases.TestKey.make({ file: "a.ts", fullName: "f" }),
      unit: "a.ts",
      path: [],
      name: "f",
      outcome: "failed",
      detail: ItemDetail.makeOption({
        message: upstream.message,
        diff: O.some(upstream.diff),
        stack: O.some(upstream.stack),
      }),
      location: Location.makeOption({ file: "a.ts", line: 1, column: 1 }),
      code: O.some("TS1"),
      rule: O.some("rule"),
      severity: O.some("error"),
    });
    assert.isTrue(S.is(Item)(item));
  });

  it("AgentReport > ModuleReport > TestReport -> GateReport > Unit > Item", () => {
    const upstream = {
      project: "sdk",
      reason: "failed",
      failed: [{ file: "src/a.test.ts", tests: [{ name: "adds", fullName: "math > adds", state: "failed" }] }],
    } as const;
    const module = upstream.failed[0];
    const test = module.tests[0];
    const report = makeReport({
      subject: upstream.project,
      reason: runReasonFromUpstream(upstream.reason),
      outcome: "some-fail",
      units: [
        Unit.make({ id: upstream.project, kind: "package" }),
        Unit.make({ id: module.file, kind: "file", parent: O.some(upstream.project) }),
      ],
      items: [
        Item.make({
          key: ItemKey.cases.TestKey.make({ file: module.file, fullName: test.fullName }),
          unit: module.file,
          path: ["math"],
          name: test.name,
          outcome: itemOutcomeFromTestState(test.state),
        }),
      ],
      totals: Totals.make({ collected: 1, failed: 1 }),
    });
    assert.isTrue(S.is(GateReport)(report));
    assert.strictEqual(classifyShape(report), "item");
  });

  it("RunEvent -> GateEvent: Module*, Test*, Hook* become Unit* and Item*", () => {
    const events = [
      GateEvent.cases.UnitQueued.make({ unit: Unit.make({ id: "src/a.test.ts", kind: "file" }) }),
      GateEvent.cases.UnitFaulted.make({
        unit: "src/a.test.ts",
        kind: "hook",
        name: "beforeAll",
        detail: ItemDetail.make({ message: "x" }),
      }),
      GateEvent.cases.RunStarted.make({
        runId: "r",
        gate: "test",
        subject: "s",
        itemKind: "test",
        startedAt: epoch,
        inputFingerprint: "configHash",
      }),
    ];
    assert.isTrue(A.every(events, S.is(GateEvent)));
  });

  it("RenderTotals -> Totals adds collected, warned and errored beside the upstream counts", () => {
    const upstream = { passCount: 2, failCount: 1, skipCount: 1, timeoutCount: 1, durationMs: 10 };
    const totals = Totals.make({
      passed: upstream.passCount,
      failed: upstream.failCount,
      skipped: upstream.skipCount,
      timedOut: upstream.timeoutCount,
      durationMs: upstream.durationMs,
      collected: 5,
      warned: 0,
      errored: 0,
    });
    assert.isTrue(S.is(Totals)(totals));
  });

  it("FailureRecord -> FailureEntry: module path, suite path and test name become unit, path, name and location", () => {
    const upstream = {
      modulePath: "src/a.test.ts",
      suitePath: ["math"],
      testName: "divides",
      classification: "persistent",
    } as const;
    const entry = FailureEntry.make({
      unit: upstream.modulePath,
      path: upstream.suitePath,
      name: upstream.testName,
      location: Location.makeOption({ file: upstream.modulePath, line: 4, column: 2 }),
      label: historyLabelFromUpstream(upstream.classification),
      diff: [],
    });
    assert.isTrue(S.is(FailureEntry)(entry));
  });

  it("CoverageRenderState -> PolicyRenderState: coverage, error budget and maximum warnings in one slot", () => {
    const upstream = {
      violations: [{ metric: "lines", expected: 80, actual: 70 }],
      globShortfalls: [{ pattern: "src/**" }],
    } as const;
    const policy = PolicyRenderState.make({
      breaches: [
        PolicyBreach.cases.CoverageBreach.make({ ...upstream.violations[0] }),
        PolicyBreach.cases.CoverageBreach.make({
          metric: "lines",
          expected: 80,
          actual: 60,
          pattern: O.some(upstream.globShortfalls[0].pattern),
        }),
        PolicyBreach.cases.ErrorBudgetBreach.make({ budget: 0, actual: 1 }),
        PolicyBreach.cases.WarningLimitBreach.make({ maximum: 0, actual: 1 }),
      ],
    });
    assert.strictEqual(
      classifyOutcome({ reason: "passed", totals: Totals.make({ collected: 1, passed: 1 }), policy: O.some(policy) }),
      "policy-violation"
    );
  });

  it("footer strings -> PointerTable: a per-gate table of commands", () => {
    const table = { test: GatePointers.make({ failure: "beep gate show test" }) };
    assert.isTrue(S.is(PointerTable)(table));
  });

  it("test_history key -> SeriesKey: project, module path and full name become gate, subject, item key and branch", () => {
    const upstream = { project: "sdk", module_path: "src/a.test.ts", full_name: "math > adds" };
    const series = SeriesKey.make({
      gate: "test",
      subject: upstream.project,
      item: ItemKey.cases.TestKey.make({ file: upstream.module_path, fullName: upstream.full_name }),
      branch: "main",
    });
    assert.isTrue(S.is(SeriesKey)(series));
  });
});
