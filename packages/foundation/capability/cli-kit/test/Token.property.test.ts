import { NamedColor, Style, Token, TokenName } from "@beep/cli-kit/Token";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "NamedColor encodes and decodes without failure or loss",
  [Arbitrary.schema(NamedColor)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(NamedColor)(value);
      const decoded = yield* S.decodeEffect(NamedColor)(encoded);
      assertTrue(S.toEquivalence(NamedColor)(decoded, value));
      const value1 = yield* S.encodeEffect(NamedColor)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "Style encodes and decodes without failure or loss",
  [Arbitrary.schema(Style)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Style)(value);
      const decoded = yield* S.decodeEffect(Style)(encoded);
      assertTrue(S.toEquivalence(Style)(decoded, value));
      const value2 = yield* S.encodeEffect(Style)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);

it.effect.prop(
  "TokenName encodes and decodes without failure or loss",
  [Arbitrary.schema(TokenName)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(TokenName)(value);
      const decoded = yield* S.decodeEffect(TokenName)(encoded);
      assertTrue(S.toEquivalence(TokenName)(decoded, value));
      const value3 = yield* S.encodeEffect(TokenName)(decoded);
      assert.deepStrictEqual(value3, encoded);
    }),
  runs
);

it.effect.prop(
  "explicit styles resolve idempotently with their complete attributes",
  [Arbitrary.schema(Style)],
  ([style]) =>
    Effect.sync(() => {
      const resolved = Token.resolve(Token.style(style));
      assert.strictEqual(resolved, style);
      assert.strictEqual(Token.resolve(resolved), resolved);
    }),
  runs
);
