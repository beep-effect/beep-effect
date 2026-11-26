import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { verdictWord } from "@beep/gate-report/Classify";
import {
  ConsoleBudget,
  ConsoleDocument,
  ConsoleEntry,
  NoteEntry,
  VerdictLine,
} from "@beep/gate-report/ConsoleDocument";
import { ConsoleInput, dispatch } from "@beep/gate-report/Dispatch";
import { formatDuration } from "@beep/gate-report/Format";
import { GateReport } from "@beep/gate-report/GateReport";
import { fitDocument, projectLines } from "@beep/gate-report/PlainText";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { agentBudget } from "./support/builders.ts";
import type { FailureEntry } from "@beep/gate-report/ConsoleDocument";

const runs = { arbitrary: fcRuns(100) };

const size = (lines: ReadonlyArray<string>): number => A.reduce(lines, 0, (total, line) => total + line.length + 1);

const projectOneEntryAloneCountingItsLines = (
  document: ConsoleDocument,
  entry: FailureEntry,
  budget: ConsoleBudget
) => {
  const single = ConsoleDocument.make({ ...document, entries: [entry], folds: [], cap: O.none() });
  const kept = fitDocument({ document: single, budget }).entries.length === 1;
  const lines = projectLines({ document: single, budget });
  const tail = A.filter([O.isSome(single.delta), O.isSome(single.path), O.isSome(single.pointer)], Boolean).length;
  const entryLines = kept ? lines.length - 2 - tail : 0;
  const header = kept ? 1 : 0;
  const message = kept && O.isSome(entry.message) ? 1 : 0;
  return { kept, entryLines, diffLines: entryLines - header - message };
};

const inputs = Arbitrary.schema(ConsoleInput);
const budgets = Arbitrary.schema(ConsoleBudget);
const documents = Arbitrary.schema(ConsoleDocument);

const noteOnlyTaillessDocuments = S.Struct({ verdict: VerdictLine, notes: S.Array(NoteEntry) }).pipe(Arbitrary.schema);

describe("console laws as properties over the report schema's arbitrary", () => {
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
    "AC-L1: the verdict word, counts and duration survive on both verdict lines whenever they fit the line limit",
    [documents, budgets],
    ([document, budget]) =>
      Effect.sync(() => {
        const verdict = document.verdict;
        const result = Str.replace(
          /[\u0000-\u001f\u007f]/gu,
          " "
        )(`: ${verdictWord(verdict.reason)}, ${verdict.counts} (${formatDuration(verdict.durationMs)})`);
        const lines = projectLines({ document, budget });
        if (result.length + 4 <= budget.maxLineChars) {
          assert.include(lines[0] ?? "", result);
          assert.include(lines[lines.length - 1] ?? "", result);
        }
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
    "AC-L3: a note-only document with no tail fits the budget and opens and closes on its verdict",
    [noteOnlyTaillessDocuments, budgets],
    ([{ verdict, notes }, budget]) =>
      Effect.sync(() => {
        const document = ConsoleDocument.make({ verdict, entries: notes, folds: [] });
        const lines = projectLines({ document, budget });
        assert.isAtMost(size(lines), budget.maxChars);
        assert.strictEqual(
          lines[0],
          lines[lines.length - 1],
          "a kept note brings the closing verdict back inside the budget"
        );
        assertNone(fitDocument({ document, budget }).cap);
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
        const prior = O.getOrElse(
          O.map(document.cap, (cap) => cap.dropped),
          () => 0
        );
        const records = (entries: ReadonlyArray<ConsoleEntry>) =>
          A.filter(entries, ConsoleEntry.guards.FailureEntry).length;
        const dropped =
          prior + records(document.entries) + document.folds.length - records(fitted.entries) - fitted.folds.length;
        assert.isAtMost(size(lines), budget.maxChars);
        for (const line of lines) {
          assert.isAtMost(line.length, budget.maxLineChars);
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
        for (const entry of A.filter(document.entries, ConsoleEntry.guards.FailureEntry)) {
          const projected = projectOneEntryAloneCountingItsLines(document, entry, budget);
          assert.isAtMost(projected.entryLines, 2 + budget.maxDiffLines);
          assert.isAtMost(projected.diffLines, budget.maxDiffLines);
          assert.strictEqual(
            projected.diffLines,
            projected.kept ? Math.min(entry.diff.length, budget.maxDiffLines) : 0
          );
        }
      }),
    runs
  );
});
