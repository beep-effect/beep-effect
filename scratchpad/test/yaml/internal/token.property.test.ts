import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { YamlToken, YamlTokenKind } from "../../../effected/yaml/internal/token.ts";

const runs = { arbitrary: fcRuns(100) };

describe("internal YAML token schema property floor", () => {
  it.effect.prop(
    "YamlTokenKind: decoding an encoded kind succeeds and preserves the kind",
    [Arbitrary.schema(YamlTokenKind)],
    ([kind]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(YamlTokenKind)(kind);
        const decoded = yield* S.decodeEffect(YamlTokenKind)(encoded);
        assertTrue(S.toEquivalence(YamlTokenKind)(decoded, kind));
        assert.strictEqual(encoded, kind);
        assert.strictEqual(yield* S.encodeEffect(YamlTokenKind)(decoded), encoded);
      }),
    runs
  );

  it.effect.prop(
    "YamlToken: decoding an encoded token succeeds and preserves its payload and coordinates",
    [Arbitrary.schema(YamlToken)],
    ([token]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(YamlToken)(token);
        const decoded = yield* S.decodeEffect(YamlToken)(encoded);
        assertTrue(S.toEquivalence(YamlToken)(decoded, token));
        assert.deepStrictEqual(encoded, token);
        assert.deepStrictEqual(yield* S.encodeEffect(YamlToken)(decoded), encoded);
      }),
    runs
  );
});
