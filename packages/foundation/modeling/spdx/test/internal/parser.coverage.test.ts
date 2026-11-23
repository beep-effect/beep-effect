import { MAX_NESTING_DEPTH, parse, RawExpression } from "@beep/spdx/internal/parser";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const isRawExpression = S.is(RawExpression);

describe("SPDX parser rejection paths", () => {
  it.effect("raw schema validates recursive parser output without changing its plain records", () =>
    Effect.gen(function* () {
      for (const input of [
        "MIT",
        "GPL-2.0+",
        "LicenseRef-local",
        "DocumentRef-doc:LicenseRef-custom",
        "MIT WITH Classpath-exception-2.0",
        "LicenseRef-local WITH Classpath-exception-2.0",
        "(MIT OR Apache-2.0) AND (GPL-2.0+ OR LicenseRef-local)",
        "(MIT AND Apache-2.0) OR (LicenseRef-local AND DocumentRef-doc:LicenseRef-custom)",
      ]) {
        const parsed = O.getOrThrow(parse(input));
        assert.strictEqual(isRawExpression(parsed), true, input);
        const decoded = yield* S.decodeEffect(RawExpression)(parsed);
        assert.deepStrictEqual(decoded, parsed, input);
      }
    })
  );
  it.effect("raw schema requires reference keys and restricts WITH to simple operands", () =>
    Effect.gen(function* () {
      assert.strictEqual(isRawExpression({ kind: "licenseRef", ref: "local", documentRef: undefined }), true);
      assert.strictEqual(isRawExpression({ kind: "licenseRef", ref: "local" }), false);
      assert.strictEqual(isRawExpression({ kind: "license", id: "MIT", plus: "true" }), false);
      assert.strictEqual(
        isRawExpression({
          kind: "with",
          license: O.getOrThrow(parse("MIT AND Apache-2.0")),
          exception: "Classpath-exception-2.0",
        }),
        false
      );
      assert.strictEqual(
        isRawExpression({ kind: "and", left: O.getOrThrow(parse("MIT")), right: { kind: "unknown" } }),
        false
      );
      assert.strictEqual(
        isRawExpression({ kind: "or", left: { kind: "unknown" }, right: O.getOrThrow(parse("MIT")) }),
        false
      );
    })
  );
  it.effect("rejects scanner errors and malformed document and license references", () =>
    Effect.gen(function* () {
      for (const input of [
        "MIT +",
        "+",
        "MIT\tOR Apache-2.0",
        "MIT_",
        "DocumentRef-doc",
        "DocumentRef-doc:",
        "DocumentRef-doc:AND",
        "DocumentRef-doc:MIT",
        "DocumentRef-:LicenseRef-x",
        "DocumentRef-doc:LicenseRef-",
        "LicenseRef-",
        "MIT WITH",
        "MIT WITH AND",
        "MIT WITH unknown",
        "MIT AND",
        "MIT OR",
        "(MIT",
        "(MIT OR)",
      ])
        assertNone(parse(input));
    })
  );
  it("reads an operator word inside a maximal idstring run as part of the id, not as an operator", () => {
    assert.deepStrictEqual(parse("GPL-2.0-or-later"), O.some({ kind: "license", id: "GPL-2.0-or-later", plus: false }));
  });
  it.effect("bounds recursion at each grammar entry and recovers on a fresh parse", () =>
    Effect.gen(function* () {
      for (const operator of ["OR", "AND"])
        assertNone(parse(A.join(A.replicate("MIT", MAX_NESTING_DEPTH + 1), ` ${operator} `)));
      const paddingThatTripsTheOrAndOrAtomGuard = ["MIT OR ", "MIT AND ", ""];
      for (const padding of paddingThatTripsTheOrAndOrAtomGuard)
        assertNone(parse(`${padding + Str.repeat(85)("(")}MIT${Str.repeat(85)(")")}`));
      assert.deepStrictEqual(parse("MIT"), O.some({ kind: "license", id: "MIT", plus: false }));
    })
  );
});
