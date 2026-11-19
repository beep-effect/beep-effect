// AC-L1, AC-L2 and AC-L3 as properties over inputs generated from the report
// schema's arbitrary: verdict first and last, silent on success, bounded.
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ConsoleBudget, ConsoleDocument, ConsoleEntry } from "@beep/gate-report/ConsoleDocument";
import { ConsoleInput, dispatch } from "@beep/gate-report/Dispatch";
import { GateReport } from "@beep/gate-report/GateReport";
import { fitDocument, projectLines } from "@beep/gate-report/PlainText";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { agentBudget } from "./support/builders.ts";

const runs = { arbitrary: fcRuns(100) };

const size = (lines: ReadonlyArray<string>): number => A.reduce(lines, 0, (total, line) => total + line.length + 1);

const inputs = Arbitrary.schema(ConsoleInput);
const budgets = Arbitrary.schema(ConsoleBudget);
const documents = Arbitrary.schema(ConsoleDocument);

describe("console laws", () => {
  it.effect.prop(
    "AC-L1: the first and last lines are both the verdict line",
    [inputs, budgets],
    ([input, budget]) =>
      Effect.sync(() => {
        const document = dispatch(input);
        const lines = projectLines({ document, budget });
        const verdictOnly = ConsoleDocument.make({ verdict: document.verdict, entries: [], folds: [] });
        assert.isTrue(A.isReadonlyArrayNonEmpty(lines));
        assert.strictEqual(lines[0], lines[lines.length - 1]);
        assert.deepStrictEqual(projectLines({ document: verdictOnly, budget }), A.take(lines, 1));
      }),
    runs
  );

  it.effect.prop(
    "AC-L2: an all-pass report projects to exactly one line",
    [inputs],
    ([input]) =>
      Effect.sync(() => {
        const report = GateReport.make({ ...input.report, outcome: "all-pass" });
        const lines = projectLines({
          document: dispatch(ConsoleInput.make({ ...input, report })),
          budget: agentBudget,
        });
        assert.strictEqual(lines.length, 1);
      }),
    runs
  );

  it.effect.prop(
    "AC-L3: the projection fits the budget, no line exceeds the line limit, entries are bounded and the cap counts the drops",
    [documents, budgets],
    ([document, budget]) =>
      Effect.sync(() => {
        const lines = projectLines({ document, budget });
        const fitted = fitDocument({ document, budget });
        const dropped = document.entries.length + document.folds.length - fitted.entries.length - fitted.folds.length;
        assert.isAtMost(size(lines), budget.maxChars);
        for (const line of lines) {
          assert.isAtMost(line.length, budget.maxLineChars);
        }
        for (const entry of fitted.entries) {
          if (ConsoleEntry.guards.FailureEntry(entry)) {
            assert.isAtMost(A.take(entry.diff, budget.maxDiffLines).length, budget.maxDiffLines);
          }
        }
        assert.strictEqual(
          O.getOrElse(
            O.map(fitted.cap, (cap) => cap.dropped),
            () => 0
          ),
          dropped
        );
        if (dropped > 0) {
          assert.include(lines, `... ${dropped} more in the record`);
        }
      }),
    runs
  );

  it.effect.prop(
    "AC-L3: each failure entry projects to one line plus at most its message line and the diff limit",
    [documents, budgets],
    ([document, budget]) =>
      Effect.sync(() => {
        for (const entry of document.entries) {
          if (ConsoleEntry.guards.FailureEntry(entry)) {
            const single = ConsoleDocument.make({ ...document, entries: [entry], folds: [], cap: O.none() });
            const fitted = fitDocument({ document: single, budget });
            const lines = projectLines({ document: single, budget });
            const tail = A.filter(
              [O.isSome(single.delta), O.isSome(single.path), O.isSome(single.pointer)],
              Boolean
            ).length;
            const entryLines = fitted.entries.length === 1 ? lines.length - 2 - tail : 0;
            assert.isAtMost(entryLines, 2 + budget.maxDiffLines);
            assert.isAtLeast(entryLines, fitted.entries.length);
          }
        }
      }),
    runs
  );
});
