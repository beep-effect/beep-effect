import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { DescendError, DescendResult, UnreadableDirectory } from "@beep/walker/Descend";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { descendErrorSample, unreadableDirectorySample } from "./support/arbitraries.ts";

const runs = { arbitrary: fcRuns(100) };

const resultSchema = DescendResult.mapFields((fields) => ({
  ...fields,
  unreadable: S.Array(unreadableDirectorySample),
}));

describe("descent schemas", () => {
  it.effect.prop(
    "DescendError: decode(encode(x)) equals x and decoding never fails",
    [Arbitrary.schema(descendErrorSample)],
    ([sample]) =>
      Effect.gen(function* () {
        const value = DescendError.make(sample);
        const encoded = yield* S.encodeEffect(DescendError)(value);
        const decoded = yield* S.decodeEffect(DescendError)(encoded);
        assertTrue(S.toEquivalence(DescendError)(decoded, value));
        assert.strictEqual(decoded.message, value.message);
        const value1 = yield* S.encodeEffect(DescendError)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
  it.effect.prop(
    "UnreadableDirectory: decode(encode(x)) preserves path and original cause",
    [Arbitrary.schema(unreadableDirectorySample)],
    ([sample]) =>
      Effect.gen(function* () {
        const value = UnreadableDirectory.make(sample);
        const encoded = yield* S.encodeEffect(UnreadableDirectory)(value);
        const decoded = yield* S.decodeEffect(UnreadableDirectory)(encoded);
        assertTrue(S.toEquivalence(UnreadableDirectory)(decoded, value));
        assert.strictEqual(decoded.cause, value.cause);
        const value2 = yield* S.encodeEffect(UnreadableDirectory)(decoded);
        assert.deepStrictEqual(value2, encoded);
      }),
    runs
  );
  it.effect.prop(
    "DescendResult: decode(encode(x)) preserves matches and unreadable records",
    [Arbitrary.schema(resultSchema)],
    ([sample]) =>
      Effect.gen(function* () {
        const value = DescendResult.make({
          matches: sample.matches,
          unreadable: A.map(sample.unreadable, (entry) => UnreadableDirectory.make(entry)),
        });
        const encoded = yield* S.encodeEffect(DescendResult)(value);
        const decoded = yield* S.decodeEffect(DescendResult)(encoded);
        assertTrue(S.toEquivalence(DescendResult)(decoded, value));
        const value3 = yield* S.encodeEffect(DescendResult)(decoded);
        assert.deepStrictEqual(value3, encoded);
      }),
    runs
  );
});
