import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { YamlToken, YamlTokenKind, YamlTokens } from "@beep/yaml/YamlToken";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    name,
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
describe("YamlToken property floor", () => {
  roundTrips("YamlToken", YamlToken);
  roundTrips("YamlTokenKind", YamlTokenKind);
  it.effect.prop(
    "token source fidelity, retokenization identity and stream parity",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.gen(function* () {
        const result = YamlTokens.tokenize(text);
        assertSuccess(result, Result.getOrThrow(result));
        const tokens = result.success;
        const reconstructed = A.join(
          A.map(tokens, (token) => token.text),
          ""
        );
        assert.strictEqual(reconstructed, text);
        for (const token of tokens) {
          assert.strictEqual(token.text, Str.slice(token.offset, token.offset + token.length)(text));
        }
        assert.deepStrictEqual(YamlTokens.tokenize(reconstructed), result);
        const resultCollect = yield* Stream.runCollect(YamlTokens.stream(text));
        assert.deepStrictEqual(resultCollect, tokens);
      }),
    runs
  );
});
