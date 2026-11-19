// The plain-text projection: line order, truncation, control characters, and
// the cap under a tight budget.
import {
  CapLine,
  ConsoleBudget,
  ConsoleDocument,
  FailureEntry,
  FoldLine,
  NoteEntry,
  PointerLine,
  RunDelta,
  VerdictLine,
} from "@beep/gate-report/ConsoleDocument";
import { deltaText, fitDocument, foldText, projectLines, verdictText } from "@beep/gate-report/PlainText";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { agentBudget, recordPaths } from "./support/builders.ts";

const verdict = VerdictLine.make({
  gate: "test",
  scope: "@beep/glob",
  reason: "failed",
  counts: "0/9 passed",
  durationMs: 5,
});

const entry = (index: number, diffLines: number) =>
  FailureEntry.make({
    unit: "src/a.test.ts",
    path: ["suite"],
    name: `case ${index}`,
    message: O.some("expected 1 to be 2"),
    diff: A.makeBy(diffLines, (line) => `+ line ${line}`),
  });

const red = (entries: ReadonlyArray<FailureEntry>, folds: ReadonlyArray<FoldLine> = []) =>
  ConsoleDocument.make({
    verdict,
    entries,
    folds,
    path: O.some(recordPaths),
    pointer: PointerLine.makeOption({ commands: ["beep gate show test"] }),
  });

const size = (lines: ReadonlyArray<string>) => A.reduce(lines, 0, (total, line) => total + line.length + 1);

describe("projectLines", () => {
  it("keeps at most the diff limit of a failure entry's diff", () => {
    const lines = projectLines({ document: red([entry(1, 30)]), budget: agentBudget });
    assert.strictEqual(A.filter(lines, Str.startsWith("  + line")).length, 12);
  });

  it("cuts a long line to the line limit with an ellipsis", () => {
    const long = VerdictLine.make({ ...verdict, scope: Str.repeat(400)("x") });
    const [line] = projectLines({
      document: ConsoleDocument.make({ verdict: long, entries: [], folds: [] }),
      budget: agentBudget,
    });
    assert.strictEqual(line?.length, 240);
    assert.isTrue(Str.endsWith("...")(line ?? ""));
  });

  it("replaces control characters so a value never splits a line", () => {
    const tricky = VerdictLine.make({ ...verdict, scope: "a\nb\tc" });
    assert.deepStrictEqual(
      projectLines({
        document: ConsoleDocument.make({ verdict: tricky, entries: [], folds: [] }),
        budget: agentBudget,
      }),
      ["test a b c: FAILED, 0/9 passed (5ms)"]
    );
  });

  it("prints a note's lines and a fold line in order before the tail", () => {
    const fold = FoldLine.make({ code: "TS6305", count: 3, cause: "upstream declarations are not built" });
    const lines = projectLines({
      document: ConsoleDocument.make({ ...red([], [fold]), entries: [NoteEntry.make({ lines: ["one", "two"] })] }),
      budget: agentBudget,
    });
    assert.deepStrictEqual(lines.slice(1, 4), ["one", "two", foldText(fold)]);
    assert.strictEqual(foldText(fold), "TS6305 x3: upstream declarations are not built.");
  });

  it("a red document without entries still prints its frame", () => {
    const lines = projectLines({ document: red([]), budget: agentBudget });
    assert.strictEqual(lines.length, 4);
  });
});

describe("fitDocument and the cap", () => {
  const tight = ConsoleBudget.make({ maxChars: 1200, maxLineChars: 80, maxDiffLines: 3 });

  it("leaves a document that fits unchanged, with no cap", () => {
    const document = red([entry(1, 2)]);
    const fitted = fitDocument({ document, budget: agentBudget });
    assert.deepStrictEqual(fitted.entries, document.entries);
    assertNone(fitted.cap);
  });

  it("drops entries from the end, keeps folds first, and the cap says how many", () => {
    const fold = FoldLine.make({ code: "TS6305", count: 701, cause: "upstream declarations are not built" });
    const document = red(
      A.makeBy(40, (index) => entry(index, 5)),
      [fold]
    );
    const fitted = fitDocument({ document, budget: tight });
    const lines = projectLines({ document, budget: tight });
    const dropped = 40 - fitted.entries.length;
    assert.isAbove(dropped, 0);
    assert.deepStrictEqual(fitted.folds, [fold]);
    assertSome(
      O.map(fitted.cap, (cap) => cap.dropped),
      dropped
    );
    assert.include(lines, `... ${dropped} more in the record`);
    assert.isAtMost(size(lines), tight.maxChars);
    assert.strictEqual(lines[0], lines[lines.length - 1]);
  });

  it("drops folds too when they alone overflow", () => {
    const folds = A.makeBy(40, (index) => FoldLine.make({ code: `TS${index}`, count: 2, cause: Str.repeat(60)("x") }));
    const fitted = fitDocument({ document: red([entry(0, 1)], folds), budget: tight });
    assert.isBelow(fitted.folds.length, 40);
    assertSome(
      O.map(fitted.cap, (cap) => cap.dropped),
      41 - fitted.folds.length - fitted.entries.length
    );
  });

  it("recomputes a cap the document already held", () => {
    const document = ConsoleDocument.make({ ...red([]), cap: CapLine.makeOption({ dropped: 9 }) });
    assertNone(fitDocument({ document, budget: agentBudget }).cap);
  });
});

describe("verdict and delta text", () => {
  it("renders the verdict, and appends the delta when the verdict carries one", () => {
    assert.strictEqual(verdictText(verdict), "test @beep/glob: FAILED, 0/9 passed (5ms)");
    const withDelta = VerdictLine.make({
      ...verdict,
      delta: RunDelta.makeOption({ fixed: 1, stillFailing: 0, new: 0 }),
    });
    assert.strictEqual(
      verdictText(withDelta),
      "test @beep/glob: FAILED, 0/9 passed (5ms); since last run: 1 fixed, 0 still failing, 0 new"
    );
  });

  it("renders the delta phrase", () => {
    assert.strictEqual(
      deltaText(RunDelta.make({ fixed: 0, stillFailing: 2, new: 1 })),
      "since last run: 0 fixed, 2 still failing, 1 new"
    );
  });
});
