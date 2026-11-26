import { CauseFoldRule, defaultCauseFolds, FoldInput, foldCauses } from "@beep/gate-report/CauseFold";
import { Totals } from "@beep/gate-report/GateReport";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { DiagnosticKeyInput, diagnosticKey } from "@beep/gate-report/ItemKey";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import {
  diagnosticAt,
  finished,
  makeReport,
  projectWith,
  reduce,
  runFinished,
  runStarted,
} from "./support/builders.ts";

const diagnostic = (index: number, code: string, message: string): Item => {
  const file = `src/module${index}.ts`;
  return Item.make({
    key: diagnosticKey(DiagnosticKeyInput.make({ file, code, message })),
    unit: file,
    path: [],
    name: message,
    outcome: "failed",
    code: O.some(code),
    severity: O.some("error"),
    location: Location.makeOption({ file, line: 1, column: 1 }),
    detail: ItemDetail.makeOption({ message }),
  });
};

const syntheticTs6305Cascade = A.makeBy(701, (index) =>
  diagnostic(
    index,
    "TS6305",
    `Output file '/repo/packages/dep/dist/m${index}.d.ts' has not been built from source file '/repo/packages/dep/src/m${index}.ts'.`
  )
);

const FIX = "bun x turbo run build --filter=@beep/glob^...";

describe("cause folding", () => {
  it("TS6305 is the first rule of the default table", () => {
    assert.strictEqual(defaultCauseFolds[0].code, "TS6305");
  });

  it("folds the TS6305 cascade to one line with its count, cause and supplied fix command, in at most five lines (AC-L7)", () => {
    const report = makeReport({
      gate: "check",
      itemKind: "diagnostic",
      reason: "failed",
      outcome: "some-fail",
      items: syntheticTs6305Cascade,
      totals: Totals.make({ collected: 40, failed: 701 }),
    });
    const lines = projectWith({ report, fixes: { TS6305: FIX } });
    assert.isAtMost(lines.length, 5);
    assert.include(
      lines,
      `TS6305 x701: upstream declarations are not built. Fix: ${FIX}`,
      "the cascade list is synthetic; the repository-generated fixture arrives with the type-checker adapter"
    );
    assert.strictEqual(lines[0], lines[lines.length - 1]);
  });

  it("folds a reduced cascade of 701 diagnostics in 7 files to one line counting diagnostics, not files", () => {
    const events = A.makeBy(701, (index) =>
      finished(
        diagnosticAt({
          file: `src/module${index % 7}.ts`,
          code: "TS6305",
          message: `Output file '/repo/dist/m${index}.d.ts' has not been built from source file '/repo/src/m${index}.ts'.`,
          line: index + 1,
        })
      )
    );
    const report = reduce([
      runStarted({ gate: "check", itemKind: "diagnostic" }),
      ...events,
      runFinished({ reason: "failed", exitCode: O.some(2), collected: O.some(7) }),
    ]);
    assert.strictEqual(report.totals.failed, 701);
    const lines = projectWith({ report, fixes: { TS6305: FIX } });
    assert.isAtMost(lines.length, 5);
    assert.include(lines, `TS6305 x701: upstream declarations are not built. Fix: ${FIX}`);
  });

  it("keeps items no rule names, in order, and folds without a fix when none is supplied", () => {
    const other = diagnostic(1, "TS2322", "Type 'a' is not assignable to type 'b'.");
    const result = foldCauses(
      FoldInput.make({
        items: [syntheticTs6305Cascade[0] ?? other, other, syntheticTs6305Cascade[1] ?? other],
        rules: defaultCauseFolds,
        fixes: {},
      })
    );
    assert.deepStrictEqual(result.rest, [other]);
    assert.strictEqual(result.folds.length, 1);
    assert.strictEqual(result.folds[0]?.count, 2);
    assertNone(result.folds[0]?.fix ?? O.some("unexpected"));
  });

  it("a rule with no matching item produces no line; items without a code are never folded", () => {
    const uncoded = Item.make({ ...diagnostic(2, "TS1", "m"), code: O.none() });
    const result = foldCauses(FoldInput.make({ items: [uncoded], rules: defaultCauseFolds, fixes: { TS6305: FIX } }));
    assert.deepStrictEqual(result.folds, []);
    assert.deepStrictEqual(result.rest, [uncoded]);
  });

  it("folds in table order, one line per code, and a repeated code keeps its first rule", () => {
    const rules = [
      CauseFoldRule.make({ code: "TS2307", cause: "a module is missing" }),
      CauseFoldRule.make({ code: "TS6305", cause: "upstream declarations are not built" }),
      CauseFoldRule.make({ code: "TS2307", cause: "a duplicate rule" }),
    ];
    const items = [...A.take(syntheticTs6305Cascade, 1), diagnostic(3, "TS2307", "Cannot find module 'x'.")];
    const result = foldCauses(FoldInput.make({ items, rules, fixes: { TS2307: "bun install" } }));
    assert.deepStrictEqual(
      A.map(result.folds, (fold) => [fold.code, fold.cause, fold.count]),
      [
        ["TS2307", "a module is missing", 1],
        ["TS6305", "upstream declarations are not built", 1],
      ]
    );
    assertSome(result.folds[0]?.fix ?? O.none(), "bun install");
  });
});
