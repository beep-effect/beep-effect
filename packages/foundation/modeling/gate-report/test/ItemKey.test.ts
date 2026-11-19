// The stable item key rules of the SPEC: file plus full name for a test; file,
// code or rule, and normalized message shape for a diagnostic.
import {
  DiagnosticKeyInput,
  diagnosticKey,
  fingerprint,
  ItemKey,
  messageShape,
  SeriesKey,
} from "@beep/gate-report/ItemKey";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const equivalent = S.toEquivalence(ItemKey);

describe("item keys", () => {
  it("keeps same-named tests in two files distinct", () => {
    const a = ItemKey.cases.TestKey.make({ file: "src/a.test.ts", fullName: "math > adds" });
    const b = ItemKey.cases.TestKey.make({ file: "src/b.test.ts", fullName: "math > adds" });
    assert.isFalse(equivalent(a, b));
    assert.notStrictEqual(fingerprint(a), fingerprint(b));
  });

  it("keys a diagnostic on file, code and message shape, not on its literals or line numbers", () => {
    const first = diagnosticKey(
      DiagnosticKeyInput.make({
        file: "src/a.ts",
        code: "TS2322",
        message: "Type 'string' is not assignable to type 'number'.",
      })
    );
    const moved = diagnosticKey(
      DiagnosticKeyInput.make({
        file: "src/a.ts",
        code: "TS2322",
        message: "Type 'boolean' is not assignable to type 'Foo'.",
      })
    );
    const other = diagnosticKey(
      DiagnosticKeyInput.make({
        file: "src/a.ts",
        code: "TS2345",
        message: "Type 'string' is not assignable to type 'number'.",
      })
    );
    assert.isTrue(equivalent(first, moved));
    assert.isFalse(equivalent(first, other));
  });

  it("keys a lint diagnostic on its rule", () => {
    const key = diagnosticKey(
      DiagnosticKeyInput.make({
        file: "src/a.ts",
        code: "lint/style/useConst",
        message: "This let is never reassigned.",
      })
    );
    assert.strictEqual(key.code, "lint/style/useConst");
  });

  it("normalizes quoted literals, numbers, whitespace and keeps only the first line", () => {
    assert.strictEqual(
      messageShape("Output file '/x/dist/a.d.ts' has not been built from source file \"/x/src/a.ts\".\n  more"),
      "Output file <s> has not been built from source file <s>."
    );
    assert.strictEqual(
      messageShape("Expected 2 arguments, but got 3  (line 12)"),
      "Expected <n> arguments, but got <n> (line <n>)"
    );
    assert.strictEqual(messageShape("uses `template` text"), "uses <s> text");
  });

  it("fingerprints each key kind with its own prefix", () => {
    const fault = ItemKey.cases.FaultKey.make({ unit: "src/a.test.ts", kind: "load", name: "load" });
    const diagnostic = diagnosticKey(DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS1", message: "m" }));
    assert.deepStrictEqual(
      A.map([fault, diagnostic], (key) => A.headNonEmpty(Str.split(fingerprint(key), "\u001f"))),
      ["fault", "diagnostic"]
    );
  });

  it("a series key carries the gate, subject, item key and branch", () => {
    const item = ItemKey.cases.TestKey.make({ file: "src/a.test.ts", fullName: "x" });
    const series = SeriesKey.make({ gate: "test", subject: "@beep/glob", item, branch: "main" });
    assert.isTrue(equivalent(series.item, item));
  });
});
