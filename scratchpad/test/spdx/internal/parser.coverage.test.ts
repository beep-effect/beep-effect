import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { MAX_NESTING_DEPTH, parse, RawExpression } from "../../../effected/spdx/internal/parser.ts";

const isRawExpression = S.is(RawExpression);

describe("SPDX parser rejection paths", () => {
  it.effect("raw schema validates recursive parser output without changing its plain records", () => Effect.gen(function* () {
    for (const input of [
      "MIT", "GPL-2.0+", "LicenseRef-local", "DocumentRef-doc:LicenseRef-custom",
      "MIT WITH Classpath-exception-2.0", "LicenseRef-local WITH Classpath-exception-2.0",
      "(MIT OR Apache-2.0) AND (GPL-2.0+ OR LicenseRef-local)",
      "(MIT AND Apache-2.0) OR (LicenseRef-local AND DocumentRef-doc:LicenseRef-custom)",
    ]) {
      const parsed = parse(input);
      assert.strictEqual(isRawExpression(parsed), true, input);
      const decoded = yield* S.decodeUnknownEffect(RawExpression)(parsed);
      assert.deepStrictEqual(decoded, parsed, input);
    }
  }));
  it.effect("raw schema requires reference keys and restricts WITH to simple operands", () => Effect.gen(function* () {
    assert.strictEqual(isRawExpression({ kind: "licenseRef", ref: "local", documentRef: undefined }), true);
    assert.strictEqual(isRawExpression({ kind: "licenseRef", ref: "local" }), false);
    assert.strictEqual(isRawExpression({ kind: "license", id: "MIT", plus: "true" }), false);
    assert.strictEqual(isRawExpression({ kind: "with", license: parse("MIT AND Apache-2.0"), exception: "Classpath-exception-2.0" }), false);
    assert.strictEqual(isRawExpression({ kind: "and", left: parse("MIT"), right: { kind: "unknown" } }), false);
    assert.strictEqual(isRawExpression({ kind: "or", left: { kind: "unknown" }, right: parse("MIT") }), false);
  }));
  it.effect("rejects scanner errors and malformed document and license references", () => Effect.gen(function* () {
    for (const input of ["MIT +", "+", "MIT\tOR Apache-2.0", "MIT_", "DocumentRef-doc", "DocumentRef-doc:",
      "DocumentRef-doc:AND", "DocumentRef-doc:MIT", "DocumentRef-:LicenseRef-x", "DocumentRef-doc:LicenseRef-", "LicenseRef-",
      "MIT WITH", "MIT WITH AND", "MIT WITH unknown", "MIT AND", "MIT OR", "(MIT", "(MIT OR)"])
      assert.strictEqual(parse(input), undefined, input);
  }));
  it.effect("bounds recursion at each grammar entry and recovers on a fresh parse", () => Effect.gen(function* () {
    for (const operator of ["OR", "AND"])
      assert.strictEqual(parse(Array.from({ length: MAX_NESTING_DEPTH + 1 }, () => "MIT").join(` ${operator} `)), undefined);
    // A parenthesis enters Or, And and Atom in sequence. These three depths
    // target each entry guard rather than just one deeply parenthesized case.
    for (const padding of ["MIT OR ", "MIT AND ", ""])
      assert.strictEqual(parse(padding + "(".repeat(85) + "MIT" + ")".repeat(85)), undefined);
    assert.deepStrictEqual(parse("MIT"), { kind: "license", id: "MIT", plus: false });
  }));
});
