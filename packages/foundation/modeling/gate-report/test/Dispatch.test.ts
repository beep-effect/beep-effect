// Ported from vitest-agent 1cf1ab94 packages/ui/__test__/dispatch.test.ts and packages/ui/__test__/footer.test.ts (MIT).
import { FoldResult } from "@beep/gate-report/CauseFold";
import { classifyShape } from "@beep/gate-report/Classify";
import { FailureEntry, GatePointers, NoteEntry, RunDelta } from "@beep/gate-report/ConsoleDocument";
import { CellContext, ConsoleInput, dispatch, dispatchTable, dominantLabel } from "@beep/gate-report/Dispatch";
import { Totals, Unit } from "@beep/gate-report/GateReport";
import { ItemDetail, Location } from "@beep/gate-report/Item";
import { DiagnosticKeyInput, diagnosticKey } from "@beep/gate-report/ItemKey";
import { projectLines, verdictText } from "@beep/gate-report/PlainText";
import { breachLine, PolicyBreach, PolicyRenderState } from "@beep/gate-report/Policy";
import { StrayOutput } from "@beep/gate-report/StrayOutput";
import { RunOutcome, RunShape } from "@beep/gate-report/Vocabulary";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import {
  agentBudget,
  FILE,
  failedTest,
  makeReport,
  pointerTable,
  project,
  projectWith,
  recordPaths,
  testItem,
} from "./support/builders.ts";
import type { HistoryLabel } from "@beep/gate-report/Vocabulary";

const failing = makeReport({
  reason: "failed",
  outcome: "some-fail",
  units: [Unit.make({ id: FILE, kind: "file" })],
  items: [
    testItem({ name: "adds", outcome: "passed" }),
    failedTest({ name: "divides", message: "expected 0.5 to equal 0.5000001" }),
  ],
  totals: Totals.make({ collected: 2, passed: 1, failed: 1 }),
});

const labelled = (label: HistoryLabel) =>
  makeReport({
    ...failing,
    items: [
      testItem({ name: "adds", outcome: "passed" }),
      failedTest({ name: "divides", message: "boom", label: O.some(label) }),
    ],
  });

interface ViteRawEagerGlobOptionsSubset {
  readonly eager: true;
  readonly import: "default";
  readonly query: "?raw";
}

declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: ViteRawEagerGlobOptionsSubset): Record<string, T>;
  }
}

const UPSTREAM_MCP_TOOLS = new RegExp(
  A.join(
    A.map(
      [
        ["test", "errors"],
        ["failure", "signature", "get"],
        ["file", "coverage"],
        ["test", "coverage"],
      ],
      A.join("_")
    ),
    "|"
  ),
  "u"
);

const pointerOf = (lines: ReadonlyArray<string>): string => lines[lines.length - 2] ?? "";

describe("dispatch — routing", () => {
  it("the table covers every shape by outcome pair", () => {
    assert.deepStrictEqual(R.keys(dispatchTable), [...RunShape.literals]);
    for (const shape of RunShape.literals) {
      assert.deepStrictEqual(R.keys(dispatchTable[shape]), [...RunOutcome.literals]);
    }
  });

  it("all twenty cells render, each beginning and ending with its verdict line", () => {
    for (const shape of RunShape.literals) {
      for (const outcome of RunOutcome.literals) {
        const report = makeReport({ ...failing, outcome });
        const context = CellContext.make({
          input: ConsoleInput.make({ report, pointers: pointerTable, paths: O.some(recordPaths) }),
          fold: FoldResult.make({ folds: [], rest: report.items }),
        });
        const document = dispatchTable[shape][outcome](context);
        const lines = projectLines({ document, budget: agentBudget });
        assert.strictEqual(lines[0], verdictText(document.verdict), `${shape} x ${outcome}`);
        assert.strictEqual(lines[lines.length - 1], lines[0], `${shape} x ${outcome}`);
        assert.strictEqual(lines.length === 1, outcome === "all-pass", `${shape} x ${outcome}`);
      }
    }
  });

  it("dispatch invokes the cell its shape and outcome select", () => {
    const input = ConsoleInput.make({ report: failing, pointers: pointerTable });
    const context = CellContext.make({ input, fold: FoldResult.make({ folds: [], rest: failing.items }) });
    assert.deepStrictEqual(dispatch(input), dispatchTable[classifyShape(failing)]["some-fail"](context));
  });

  it("the shape picks the verdict scope", () => {
    const scope = (shape: RunShape, report = failing) =>
      dispatchTable[shape]["some-fail"](
        CellContext.make({
          input: ConsoleInput.make({ report, pointers: {} }),
          fold: FoldResult.make({ folds: [], rest: [] }),
        })
      ).verdict.scope;
    assert.strictEqual(scope("item"), "@beep/glob > math > adds");
    assert.strictEqual(scope("unit"), `@beep/glob ${FILE}`);
    assert.strictEqual(scope("package"), "@beep/glob");
    const workspace = makeReport({
      subject: "workspace",
      units: [Unit.make({ id: "@beep/a", kind: "package" }), Unit.make({ id: "@beep/b", kind: "package" })],
    });
    assert.strictEqual(scope("workspace", workspace), "workspace (2 packages)");
    assert.strictEqual(scope("item", makeReport()), "@beep/glob");
    assert.strictEqual(scope("unit", makeReport()), "@beep/glob");
    assert.strictEqual(
      scope("unit", makeReport({ items: [testItem({ name: "adds", outcome: "passed" })] })),
      `@beep/glob ${FILE}`
    );
  });
});

describe("dispatch — the console contract", () => {
  it("a red run prints verdict, entry, path, pointer, verdict", () => {
    assert.deepStrictEqual(project(failing), [
      `test @beep/glob ${FILE}: FAILED, 1/2 passed, 1 failed (1.2s)`,
      `- ${FILE}:12:5 > math > divides`,
      "  expected 0.5 to equal 0.5000001",
      "  - expected",
      "  + received",
      `record: ${recordPaths.record} | log: ${recordPaths.log} (13.1 KB)`,
      "next: beep gate show test",
      `test @beep/glob ${FILE}: FAILED, 1/2 passed, 1 failed (1.2s)`,
    ]);
  });

  it("a green run prints the verdict line alone", () => {
    assert.deepStrictEqual(project(makeReport()), ["test @beep/glob: PASSED, 3/3 passed (1.2s)"]);
  });

  it("an empty run renders ERRORED with 0 tests collected and the empty-run note", () => {
    const lines = project(makeReport({ reason: "errored", outcome: "some-fail", totals: Totals.make({}) }));
    assert.strictEqual(lines[0], "test @beep/glob: ERRORED, 0 tests collected (1.2s)");
    assert.isTrue(Str.startsWith("Nothing collected.")(lines[1] ?? ""));
  });

  it("a diagnostic entry names its location and code", () => {
    const message = "Type 'string' is not assignable to type 'number'.";
    const item = testItem({
      name: message,
      outcome: "failed",
      key: diagnosticKey(DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS2322", message })),
      unit: "src/a.ts",
      path: [],
      code: O.some("TS2322"),
      severity: O.some("error"),
      location: Location.makeOption({ file: "src/a.ts", line: 3, column: 7 }),
    });
    const lines = project(
      makeReport({
        gate: "check",
        itemKind: "diagnostic",
        reason: "failed",
        outcome: "some-fail",
        items: [item],
        totals: Totals.make({ collected: 4, failed: 1 }),
      })
    );
    assert.strictEqual(lines[0], "check @beep/glob src/a.ts: FAILED, 1 error, 0 warnings, 4 units checked (1.2s)");
    assert.strictEqual(lines[1], `- src/a.ts:3:7 TS2322 > ${message}`);
    assert.strictEqual(pointerOf(lines), "next: beep gate show check");
  });

  it("an entry names a non-assertion failure kind and uses the rule when there is no code", () => {
    const item = failedTest({
      name: "slow",
      message: "timed out",
      failureKind: O.some("timeout"),
      rule: O.some("vitest/timeout"),
    });
    const lines = project(
      makeReport({ ...failing, items: [item], totals: Totals.make({ collected: 1, timedOut: 1 }) })
    );
    assert.strictEqual(lines[1], `- ${FILE}:12:5 vitest/timeout > math > slow (timeout)`);
  });

  it("an entry without a location names its unit, and one without detail prints its header alone", () => {
    const item = testItem({ name: "bare", outcome: "failed" });
    const lines = project(makeReport({ ...failing, items: [item], totals: Totals.make({ collected: 1, failed: 1 }) }));
    assert.strictEqual(lines[1], `- ${FILE} > math > bare`);
    assert.strictEqual(lines[2], `record: ${recordPaths.record} | log: ${recordPaths.log} (13.1 KB)`);
  });

  it("warnings-only lists warned items and points at the warnings command", () => {
    const report = makeReport({
      outcome: "warnings-only",
      items: [testItem({ name: "adds", outcome: "passed" }), testItem({ name: "deprecated", outcome: "warned" })],
      totals: Totals.make({ collected: 2, passed: 1, warned: 1 }),
    });
    const lines = project(report);
    assert.strictEqual(lines[1], `- ${FILE} > math > deprecated`);
    assert.strictEqual(pointerOf(lines), "next: beep gate show test --warnings");
  });

  it("an interrupted run notes the cancellation and points at the interrupted command", () => {
    const report = makeReport({ ...failing, reason: "cancelled", outcome: "interrupted" });
    const lines = project(report);
    assert.strictEqual(lines[0], `test @beep/glob ${FILE}: CANCELLED, 1/2 passed, 1 failed (1.2s)`);
    assert.include(lines[1] ?? "", "cancelled before it finished");
    assert.strictEqual(pointerOf(lines), "next: beep gate show test --log");
  });

  it("stray output prints as a note on a red run and never on a green one", () => {
    const strayOutput = StrayOutput.makeOption({ total: 1, stdout: 1, stderr: 0, bytes: 4, samples: [] });
    assert.isTrue(A.some(project(makeReport({ ...failing, strayOutput })), Str.startsWith("Stray output:")));
    assert.strictEqual(project(makeReport({ strayOutput })).length, 1);
  });
});

describe("dispatch — policy breaches (glob shortfalls retargeted)", () => {
  const coverage = PolicyBreach.cases.CoverageBreach.make({ metric: "lines", expected: 80, actual: 72.04 });
  const glob = PolicyBreach.cases.CoverageBreach.make({
    metric: "branches",
    expected: 70,
    actual: 60,
    pattern: O.some("src/**"),
  });
  const breaching = (shape: "item" | "unit" | "package" | "workspace", ...breaches: ReadonlyArray<PolicyBreach>) =>
    dispatchTable[shape]["policy-violation"](
      CellContext.make({
        input: ConsoleInput.make({
          report: makeReport({ outcome: "policy-violation", policy: PolicyRenderState.makeOption({ breaches }) }),
          pointers: pointerTable,
        }),
        fold: FoldResult.make({ folds: [], rest: [] }),
      })
    );

  it("renders the glob shortfall in the unit, package and workspace cells", () => {
    for (const shape of ["unit", "package", "workspace"] as const) {
      const lines = projectLines({ document: breaching(shape, glob), budget: agentBudget });
      assert.include(lines, "coverage branches 60% < 70% (src/**)");
    }
  });

  it("lists both per-metric breaches and glob shortfalls, then the policy pointer", () => {
    const lines = projectLines({ document: breaching("package", coverage, glob), budget: agentBudget });
    assert.deepStrictEqual(lines.slice(1, 4), [
      "coverage lines 72% < 80%",
      "coverage branches 60% < 70% (src/**)",
      "next: beep gate show test --policy",
    ]);
  });

  it("the item cell renders the verdict and the breach (upstream printed nothing)", () => {
    assert.strictEqual(projectLines({ document: breaching("item", coverage), budget: agentBudget }).length, 4);
  });

  it("keeps the precision that shows a shortfall when one decimal would print equal numbers", () => {
    const line = (actual: number, expected: number) =>
      breachLine(PolicyBreach.cases.CoverageBreach.make({ metric: "lines", expected, actual }));
    assert.strictEqual(line(79.99, 80), "coverage lines 79.99% < 80%");
    assert.strictEqual(line(79.9996, 80), "coverage lines 79.9996% < 80%");
    assert.strictEqual(line(79.9999999, 80), "coverage lines 79.9999999% < 80%");
    assert.strictEqual(line(72, 80), "coverage lines 72% < 80%");
    assert.strictEqual(line(80, 80), "coverage lines 80% < 80%");
  });

  it("renders error budget and warning limit breaches", () => {
    const lines = projectLines({
      document: breaching(
        "package",
        PolicyBreach.cases.ErrorBudgetBreach.make({ budget: 10, actual: 12 }),
        PolicyBreach.cases.WarningLimitBreach.make({ maximum: 25, actual: 30 })
      ),
      budget: agentBudget,
    });
    assert.deepStrictEqual(lines.slice(1, 3), ["error budget: 12 errors > 10 allowed", "warnings: 30 > 25 allowed"]);
  });

  it("a policy-violation report without a policy slot prints no breach", () => {
    const document = dispatch(ConsoleInput.make({ report: makeReport({ outcome: "policy-violation" }), pointers: {} }));
    assert.deepStrictEqual(document.entries, []);
  });
});

describe("pointer selection (footer retargeted)", () => {
  it("prints nothing after a green run", () => {
    assertNone(dispatch(ConsoleInput.make({ report: makeReport(), pointers: pointerTable })).pointer);
  });

  it("points at the failure command for introduced-on-lane, red-on-main and persistent", () => {
    for (const label of ["introduced-on-lane", "red-on-main", "persistent"] as const) {
      assert.strictEqual(pointerOf(project(labelled(label))), "next: beep gate show test");
    }
  });

  it("points at the flaky command when flaky dominates", () => {
    assert.strictEqual(pointerOf(project(labelled("flaky"))), "next: beep gate show test --flaky");
  });

  it("points at the failure command for recovered and for unlabelled failures (upstream printed none)", () => {
    assert.strictEqual(pointerOf(project(labelled("recovered"))), "next: beep gate show test");
    assert.strictEqual(pointerOf(project(failing)), "next: beep gate show test");
  });

  it("falls back to the failure command when the gate supplies no specific one", () => {
    const report = makeReport({ ...labelled("flaky"), gate: "check" });
    assert.strictEqual(pointerOf(project(report)), "next: beep gate show check");
  });

  it("the pointer line is the last line before the closing verdict", () => {
    const lines = project(failing);
    assert.isTrue(Str.startsWith("next: ")(lines[lines.length - 2] ?? ""));
  });
});

describe("dominantLabel", () => {
  const entry = (label: O.Option<HistoryLabel>) =>
    FailureEntry.make({ unit: FILE, path: [], name: "x", diff: [], label });

  it("returns none for no entries and for unlabelled entries", () => {
    assertNone(dominantLabel([]));
    assertNone(dominantLabel([entry(O.none()), NoteEntry.make({ lines: ["note"] })]));
  });

  it("picks introduced-on-lane over flaky, persistent over flaky, flaky over recovered", () => {
    assertSome(dominantLabel([entry(O.some("flaky")), entry(O.some("introduced-on-lane"))]), "introduced-on-lane");
    assertSome(dominantLabel([entry(O.some("flaky")), entry(O.some("persistent"))]), "persistent");
    assertSome(dominantLabel([entry(O.some("recovered")), entry(O.some("flaky"))]), "flaky");
  });
});

describe("labels and delta (AC-L5, AC-L6)", () => {
  const twoFailures = (labels: O.Option<HistoryLabel>) =>
    makeReport({
      ...failing,
      items: [
        failedTest({ name: "divides", message: "boom", label: labels }),
        failedTest({ name: "multiplies", message: "bang", label: labels }),
      ],
      totals: Totals.make({ collected: 2, failed: 2 }),
    });
  const labelTag = /\s\[(introduced-on-lane|red-on-main|persistent|flaky|recovered)\]/gu;

  it("given labels, every failure entry carries exactly one", () => {
    const headers = A.filter(pipe(O.some<HistoryLabel>("persistent"), twoFailures, project), Str.startsWith("- "));
    assert.strictEqual(headers.length, 2);
    for (const header of headers) {
      assertSome(
        O.map(Str.match(labelTag)(header), (matches) => matches.length),
        1
      );
    }
  });

  it("without labels no entry carries one and nothing else changes", () => {
    const withLabels = pipe(O.some<HistoryLabel>("persistent"), twoFailures, project);
    const without = pipe(O.none<HistoryLabel>(), twoFailures, project);
    assert.isFalse(A.some(without, (line) => labelTag.test(line)));
    assert.deepStrictEqual(A.map(withLabels, Str.replace(labelTag, "")), without);
  });

  it("the delta line renders before the path line on a red run", () => {
    const lines = projectWith({ report: failing, delta: RunDelta.make({ fixed: 1, stillFailing: 1, new: 0 }) });
    const delta = lines.indexOf("since last run: 1 fixed, 1 still failing, 0 new");
    assert.isAbove(delta, 0);
    assert.isTrue(Str.startsWith("record: ")(lines[delta + 1] ?? ""));
  });

  it("on a green run the delta is a suffix of the single verdict line", () => {
    const lines = projectWith({ report: makeReport(), delta: RunDelta.make({ fixed: 2, stillFailing: 0, new: 0 }) });
    assert.strictEqual(lines.length, 1);
    assert.isTrue(Str.endsWith(" (2 fixed since last run)")(lines[0] ?? ""));
  });

  it("a green run that fixed nothing carries no delta suffix, and a narrower scope says so", () => {
    const none = projectWith({ report: makeReport(), delta: RunDelta.make({ fixed: 0, stillFailing: 0, new: 0 }) });
    assert.isFalse(Str.includes("since last run")(none[0] ?? ""));
    const narrower = projectWith({
      report: makeReport(),
      delta: RunDelta.make({ fixed: 1, stillFailing: 0, new: 0, scopeDiffers: true }),
    });
    assert.isTrue(Str.endsWith(" (1 fixed since last run, scope differs)")(narrower[0] ?? ""));
  });
});

describe("pointers come only from the supplied table (AC-L9)", () => {
  it("prints no pointer line when the gate is missing from the table", () => {
    const document = dispatch(ConsoleInput.make({ report: failing, pointers: {} }));
    assertNone(document.pointer);
  });

  it("prints exactly the supplied command", () => {
    const document = dispatch(
      ConsoleInput.make({ report: failing, pointers: { test: GatePointers.make({ failure: "my cmd" }) } })
    );
    assertSome(
      O.map(document.pointer, (pointer) => pointer.commands),
      ["my cmd"]
    );
  });

  it("no source module names an upstream MCP tool", () => {
    const sources = import.meta.glob<string>("../src/**/*.ts", { eager: true, import: "default", query: "?raw" });
    assert.isAbove(R.keys(sources).length, 10);
    for (const [file, text] of R.toEntries(sources)) {
      assert.notMatch(
        text,
        UPSTREAM_MCP_TOOLS,
        `${file} names an upstream MCP tool; the pattern is built from parts so this test file never matches`
      );
    }
  });
});

describe("fault entries", () => {
  it("renders an unhandled fault with its message", () => {
    const report = makeReport({
      ...failing,
      items: [
        failedTest({
          name: "x",
          message: "y",
          failureKind: O.some("unhandled"),
          detail: ItemDetail.makeOption({ message: "late rejection\n    at stack" }),
        }),
      ],
      totals: Totals.make({ collected: 1, unhandled: 1 }),
    });
    const lines = project(report);
    assert.strictEqual(lines[2], "  late rejection");
  });
});
