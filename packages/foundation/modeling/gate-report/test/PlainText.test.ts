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

  it("shortens a 400-character scope and keeps the verdict word, counts and duration on the first and last line", () => {
    const long = VerdictLine.make({ ...verdict, scope: Str.repeat(400)("x") });
    const lines = projectLines({
      document: ConsoleDocument.make({ ...red([entry(1, 0)]), verdict: long }),
      budget: agentBudget,
    });
    for (const line of [lines[0] ?? "", lines[lines.length - 1] ?? ""]) {
      assert.strictEqual(line.length, 240);
      assert.isTrue(Str.endsWith("...: FAILED, 0/9 passed (5ms)")(line));
      assert.isTrue(Str.startsWith("test xxx")(line));
    }
  });

  it("keeps the delta suffix when it fits and drops it before the result when it does not", () => {
    const delta = RunDelta.makeOption({ fixed: 1, stillFailing: 0, new: 0 });
    const withDelta = VerdictLine.make({ ...verdict, scope: Str.repeat(400)("x"), delta });
    const verdictOnly = (budget: ConsoleBudget) =>
      projectLines({ document: ConsoleDocument.make({ verdict: withDelta, entries: [], folds: [] }), budget });
    assert.isTrue(
      Str.endsWith("(5ms); since last run: 1 fixed, 0 still failing, 0 new")(verdictOnly(agentBudget)[0] ?? "")
    );
    const narrow = ConsoleBudget.make({ maxChars: 1200, maxLineChars: 40, maxDiffLines: 3 });
    assert.deepStrictEqual(verdictOnly(narrow), ["test xxxxxx...: FAILED, 0/9 passed (5ms)"]);
  });

  it("cuts a verdict whose result alone overflows the line, and any other long line, with an ellipsis", () => {
    const narrow = ConsoleBudget.make({ maxChars: 1200, maxLineChars: 40, maxDiffLines: 3 });
    const wide = VerdictLine.make({ ...verdict, counts: Str.repeat(60)("9") });
    const [line] = projectLines({
      document: ConsoleDocument.make({ verdict: wide, entries: [], folds: [] }),
      budget: narrow,
    });
    assert.strictEqual(line, `test @beep/glob: FAILED, ${Str.repeat(12)("9")}...`);
    const note = projectLines({
      document: ConsoleDocument.make({ ...red([]), entries: [NoteEntry.make({ lines: [Str.repeat(300)("n")] })] }),
      budget: agentBudget,
    });
    assert.strictEqual(note[1], `${Str.repeat(237)("n")}...`);
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

  // Retargets upstream ui __test__/dispatcher/helpers.test.ts "strips escape sequences an error
  // message carries" (vitest-agent 1cf1ab94).
  it("strips escape sequences a message or a diff carries, so only the text counts", () => {
    const styled = FailureEntry.make({
      unit: "src/a.test.ts",
      path: [],
      name: "colours",
      message: O.some("\u001b[31mred\u001b[39m"),
      diff: ["\u001b[32m+ received\u001b[39m", "\u001b]8;;https://x.dev\u0007link\u001b]8;;\u0007"],
    });
    const lines = projectLines({ document: red([styled]), budget: agentBudget });
    assert.strictEqual(lines[2], "  red");
    assert.deepStrictEqual(A.take(A.drop(lines, 3), 2), ["  + received", "  link"]);
  });

  it("strips an escape with intermediate bytes, such as a character-set designation", () => {
    const designated = FailureEntry.make({
      unit: "src/a.test.ts",
      path: [],
      name: "charset",
      message: O.some("\u001b(Bred\u001b7 saved\u001bc"),
      diff: [],
    });
    assert.strictEqual(projectLines({ document: red([designated]), budget: agentBudget })[2], "  red saved");
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

  it("reserves both verdict lines when only a note is kept beside a tailless frame", () => {
    // The reviewer's case: a 40-character verdict and a note of seven 40-character lines.
    const minimal = ConsoleBudget.make({ maxChars: 328, maxLineChars: 40, maxDiffLines: 0 });
    const verdict40 = VerdictLine.make({
      gate: "t",
      scope: Str.repeat(12)("s"),
      reason: "failed",
      counts: "0/1 passed",
      durationMs: 5,
    });
    const note = NoteEntry.make({
      lines: [Str.repeat(40)("a"), ...A.makeBy(6, () => Str.repeat(40)("n"))],
    });
    const document = ConsoleDocument.make({ verdict: verdict40, entries: [note], folds: [] });
    const lines = projectLines({ document, budget: minimal });
    assert.strictEqual(lines[0]?.length, 40);
    assert.isAtMost(size(lines), minimal.maxChars);
    assert.strictEqual(lines[0], lines[lines.length - 1]);
  });

  it("does not count a dropped note in the cap: a note stands for nothing in the record", () => {
    const note = NoteEntry.make({ lines: A.makeBy(30, (index) => `stray line ${index} ${Str.repeat(50)("x")}`) });
    const document = ConsoleDocument.make({ ...red([entry(0, 0)]), entries: [entry(0, 0), note] });
    const fitted = fitDocument({ document, budget: tight });
    assert.strictEqual(fitted.entries.length, 1);
    assertNone(fitted.cap);
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

  it("keeps a cap the document already held, and a zero cap is no cap", () => {
    const document = ConsoleDocument.make({ ...red([]), cap: CapLine.makeOption({ dropped: 9 }) });
    assertSome(
      O.map(fitDocument({ document, budget: agentBudget }).cap, (cap) => cap.dropped),
      9
    );
    const zero = ConsoleDocument.make({ ...red([]), cap: CapLine.makeOption({ dropped: 0 }) });
    assertNone(fitDocument({ document: zero, budget: agentBudget }).cap);
  });

  it("fitting is idempotent: projecting a fitted document keeps the cap equal to the entries dropped", () => {
    const document = red(A.makeBy(40, (index) => entry(index, 5)));
    const fitted = fitDocument({ document, budget: tight });
    const dropped = 40 - fitted.entries.length;
    assert.isAbove(dropped, 0);
    assert.deepStrictEqual(fitDocument({ document: fitted, budget: tight }), fitted);
    assert.include(projectLines({ document: fitted, budget: tight }), `... ${dropped} more in the record`);
    assert.deepStrictEqual(
      projectLines({ document: fitted, budget: tight }),
      projectLines({ document, budget: tight })
    );
  });

  it("adds new drops to a cap the document already held", () => {
    const document = ConsoleDocument.make({
      ...red(A.makeBy(40, (index) => entry(index, 5))),
      cap: CapLine.makeOption({ dropped: 3 }),
    });
    const fitted = fitDocument({ document, budget: tight });
    assertSome(
      O.map(fitted.cap, (cap) => cap.dropped),
      3 + 40 - fitted.entries.length
    );
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
