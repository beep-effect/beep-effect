import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { AST, ASTError, ExtglobType } from "@beep/glob/internal/ast";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { legacyFragment, legacyOracle } from "../legacyOracle.ts";

const runs = { arbitrary: fcRuns(100) };
const atoms = Arbitrary.schema(
  S.Literals(["a", "b", ".", "*", "?", "[ab]", "[[:alpha:]]", "\\*", "\\@", "\\", "[", "]"])
);
const pattern = Arbitrary.schema(ExtglobType).pipe(
  Arbitrary.flatMap((op) =>
    S.Literals(["a", "b", "*", "?", "[ab]", "."]).pipe(
      S.Array,
      Arbitrary.schema,
      Arbitrary.map((parts) => `${op}(a|${A.join(parts, "|")})`)
    )
  )
);
const patterns = Arbitrary.schema(S.Boolean).pipe(
  Arbitrary.flatMap((nested) => pattern.pipe(Arbitrary.map((text) => (nested ? `a+(${text}|b)c` : text))))
);

describe("AST property floor", () => {
  it.effect.prop(
    "ExtglobType encode/decode identity",
    [Arbitrary.schema(ExtglobType)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(ExtglobType)(value);
        const decoded = yield* S.decodeEffect(ExtglobType)(encoded);
        assert.strictEqual(decoded, value);
      }),
    runs
  );
  it.effect.prop(
    "ASTError encode/decode identity",
    [Arbitrary.schema(ASTError)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(ASTError)(value);
        const decoded = yield* S.decodeEffect(ASTError)(encoded);
        assert.isTrue(S.toEquivalence(ASTError)(decoded, value));
      }),
    runs
  );
  it.effect.prop(
    "parse/stringify fidelity and formatting idempotence",
    [patterns],
    ([text]) =>
      Effect.sync(() => {
        const tree = AST.fromGlob(text);
        const rendered = tree.toString();
        assert.strictEqual(AST.fromGlob(rendered).toString(), rendered);
        assert.deepStrictEqual(AST.fromGlob(rendered).toJSON(), tree.toJSON());
        const source = tree.toRegExpSource();
        assert.deepStrictEqual(tree.toRegExpSource(), source);
      }),
    runs
  );
  it.effect.prop(
    "independent legacy fragment corpus agrees for fresh arbitrary candidates",
    [
      Arbitrary.schema(S.Literals(legacyOracle.patterns)),
      S.Array(S.Literals(["a", "b", "c", "."]))
        .check(S.isBetweenLength(0, 12))
        .pipe(Arbitrary.schema),
      Arbitrary.schema(S.Boolean),
    ],
    ([text, chars, dot]) =>
      Effect.sync(() => {
        const candidate = A.join(chars, "");
        const actual = AST.fromGlob(text, { dot }).toMMPattern();
        const expected = legacyFragment(text, { dot });
        assert.strictEqual(
          P.isString(actual) ? actual === candidate : actual.test(candidate),
          P.isString(expected) ? expected === candidate : expected.test(candidate)
        );
      }),
    runs
  );
  it.effect.prop(
    "literal and wildcard parser round trips",
    [atoms],
    ([text]) =>
      Effect.sync(() => {
        const tree = AST.fromGlob(text);
        assert.deepStrictEqual(AST.fromGlob(tree.toString()).toJSON(), tree.toJSON());
        assert.deepStrictEqual(AST.fromGlob(tree.toString()).toRegExpSource(), tree.toRegExpSource());
      }),
    runs
  );
});
