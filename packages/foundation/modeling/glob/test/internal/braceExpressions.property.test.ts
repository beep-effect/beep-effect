import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { BraceExpressionError, parseClass } from "@beep/glob/internal/braceExpressions";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { minimatch } from "minimatch";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x without failure`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};
const classes = Arbitrary.schema(
  S.Literals([
    "[a-c]",
    "[!a]",
    "[a-a]",
    "[a-]",
    "[\\]]",
    "[[:alpha:]]",
    "[[:digit:]]",
    "[[:graph:]]",
    "[![:graph:]]",
    "[a[:graph:]]",
    "[a]",
    "[[]",
  ])
);
describe("character class property floor", () => {
  roundTrips("BraceExpressionError", BraceExpressionError);
  it.effect.prop(
    "parse/stringify fidelity and stable consumed-class rendering",
    [classes, Arbitrary.schema(S.String)],
    ([text, suffix]) =>
      Effect.sync(() => {
        const parsed = parseClass(text + suffix, 0);
        const rendered = Str.slice(0, parsed[2])(text + suffix);
        assert.deepStrictEqual(parseClass(rendered, 0), parsed);
        const again = Str.slice(0, parseClass(rendered, 0)[2])(rendered);
        assert.strictEqual(again, rendered);
        assert.deepStrictEqual(parseClass(`prefix${rendered}`, 6), parsed);
      }),
    runs
  );
  it.effect.prop(
    "compiled character classes preserve minimatch matching fidelity",
    [classes, Arbitrary.schema(S.Literals(["a", "b", "z", "7", "é", " ", "]", "[", "-", "\\"]))],
    ([text, candidate]) =>
      Effect.sync(() => {
        const [source, unicode] = parseClass(text, 0);
        const compiled = new RegExp(`^(?:${source})$`, unicode ? "u" : "");
        assert.strictEqual(compiled.test(candidate), minimatch(candidate, text));
      }),
    runs
  );
});
