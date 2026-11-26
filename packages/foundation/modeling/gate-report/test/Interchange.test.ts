import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CtrfTest, fromCtrf, fromSarif, toCtrf, toSarif } from "@beep/gate-report/Interchange";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { DiagnosticKeyInput, diagnosticKey, fingerprint, ItemKey } from "@beep/gate-report/ItemKey";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { failedTest, testItem } from "./support/builders.ts";

const equivalent = S.toEquivalence(Item);

const typeError = Item.make({
  key: diagnosticKey(
    DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS2322", message: "Type 'a' is not assignable to type 'b'." })
  ),
  unit: "src/a.ts",
  path: [],
  name: "Type 'a' is not assignable to type 'b'.",
  outcome: "failed",
  code: O.some("TS2322"),
  severity: O.some("error"),
  location: Location.makeOption({ file: "src/a.ts", line: 3, column: 7 }),
  detail: ItemDetail.makeOption({ message: "Type 'a' is not assignable to type 'b'." }),
});

const lintWarning = Item.make({
  key: diagnosticKey(
    DiagnosticKeyInput.make({ file: "src/b.ts", code: "lint/style/useConst", message: "This let is never reassigned." })
  ),
  unit: "src/b.ts",
  path: [],
  name: "This let is never reassigned.",
  outcome: "warned",
  rule: O.some("lint/style/useConst"),
  severity: O.some("warning"),
});

const rows: ReadonlyArray<
  readonly [name: string, item: Item, ctrf: string, level: string, kind: string, ruleId: string | null]
> = [
  ["passed test", testItem({ name: "adds", outcome: "passed", durationMs: O.some(3) }), "passed", "none", "pass", null],
  [
    "failed test",
    failedTest({ name: "divides", message: "boom", signature: O.some("0123456789abcdef") }),
    "failed",
    "error",
    "fail",
    null,
  ],
  ["skipped test", testItem({ name: "todo", outcome: "skipped" }), "skipped", "none", "notApplicable", null],
  [
    "retried test",
    testItem({ name: "flaps", outcome: "passed", attempts: O.some(["failed", "passed"]), label: O.some("flaky") }),
    "passed",
    "none",
    "pass",
    null,
  ],
  ["type error", typeError, "failed", "error", "fail", "TS2322"],
  ["lint warning", lintWarning, "other", "none", "review", "lint/style/useConst"],
  [
    "load fault",
    testItem({
      name: "load",
      outcome: "failed",
      key: ItemKey.cases.FaultKey.make({ unit: "src/c.test.ts", kind: "load", name: "load" }),
      failureKind: O.some("load"),
      detail: ItemDetail.makeOption({ message: "Cannot find module", stack: O.some("at x") }),
      severity: O.some("note"),
    }),
    "failed",
    "note",
    "fail",
    null,
  ],
];

describe("CTRF and SARIF table: status, level, rule id, region and partial fingerprint back to an equal item", () => {
  for (const [name, item, ctrf, level, kind, ruleId] of rows) {
    it(`${name}: maps to CTRF ${ctrf} and SARIF ${level}/${kind}, and back to an equal item`, () => {
      const test = toCtrf(item);
      const result = toSarif(item);
      assert.strictEqual(test.status, ctrf);
      assert.strictEqual(result.level, level);
      assert.strictEqual(result.kind, kind);
      assert.strictEqual(O.getOrNull(result.ruleId), ruleId);
      assert.strictEqual(result.partialFingerprints["gateReport/itemKey/v1"], fingerprint(item.key));
      assert.isTrue(equivalent(fromCtrf(test), item));
      assert.isTrue(equivalent(fromSarif(result), item));
    });
  }

  it("carries the location as the SARIF region and the CTRF file and line", () => {
    const result = toSarif(typeError);
    assert.deepStrictEqual(
      A.map(result.locations, (location) => [location.uri, location.startLine, location.startColumn]),
      [["src/a.ts", 3, 7]]
    );
    const test = toCtrf(typeError);
    assert.deepStrictEqual([O.getOrNull(test.filePath), O.getOrNull(test.line)], ["src/a.ts", 3]);
  });

  it("counts retries and marks a pass-after-fail item flaky", () => {
    const test = toCtrf(
      testItem({ name: "flaps", outcome: "passed", attempts: O.some(["failed", "failed", "passed"]) })
    );
    assert.deepStrictEqual([test.retries, test.flaky], [2, true]);
    const steady = toCtrf(testItem({ name: "steady", outcome: "passed" }));
    assert.deepStrictEqual([steady.retries, steady.flaky, steady.duration], [0, false, 0]);
  });

  it("is not flaky when the final attempt failed, even after an earlier pass", () => {
    const test = toCtrf(testItem({ name: "breaks", outcome: "failed", attempts: O.some(["passed", "failed"]) }));
    assert.deepStrictEqual([test.retries, test.flaky], [1, false]);
    const firstTry = toCtrf(testItem({ name: "once", outcome: "passed", attempts: O.some(["passed"]) }));
    assert.isFalse(firstTry.flaky);
  });

  it("gives a failed item without a severity the error level, and no other outcome a level", () => {
    assert.strictEqual(toSarif(testItem({ name: "bare", outcome: "failed" })).level, "error");
    assert.strictEqual(toSarif(Item.make({ ...lintWarning, outcome: "passed" })).level, "none");
    assertSome(fromSarif(toSarif(lintWarning)).severity, "warning");
  });

  it("reads a CTRF pending status as skipped", () => {
    const test = toCtrf(testItem({ name: "todo", outcome: "skipped" }));
    assert.strictEqual(fromCtrf(CtrfTest.make({ ...test, status: "pending" })).outcome, "skipped");
  });

  it("uses the item name as the SARIF message when there is no detail", () => {
    assert.strictEqual(toSarif(lintWarning).message, "This let is never reassigned.");
  });

  it.effect.prop(
    "every generated item round-trips through CTRF and SARIF",
    [Arbitrary.schema(Item)],
    ([item]) =>
      Effect.sync(() => {
        assert.isTrue(
          equivalent(fromCtrf(toCtrf(item)), item),
          "the table extends to generated items by this property"
        );
        assert.isTrue(equivalent(fromSarif(toSarif(item)), item));
      }),
    { arbitrary: fcRuns(100) }
  );
});
