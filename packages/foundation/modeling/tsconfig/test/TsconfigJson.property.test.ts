import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  FallbackPolling,
  Reference,
  TsconfigJson,
  TsconfigJsonFromString,
  TsconfigParseError,
  TypeAcquisition,
  WatchDirectory,
  WatchFile,
  WatchOptions,
} from "@beep/tsconfig/TsconfigJson";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: encoding decodes successfully to an equivalent value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("TsconfigJson property floor", () => {
  roundTrips("WatchFile", WatchFile);
  roundTrips("WatchDirectory", WatchDirectory);
  roundTrips("FallbackPolling", FallbackPolling);
  roundTrips("Reference", Reference);
  roundTrips("WatchOptions", WatchOptions);
  roundTrips("TypeAcquisition", TypeAcquisition);
  roundTrips("TsconfigJson", TsconfigJson);
  roundTrips("TsconfigJsonFromString", TsconfigJsonFromString);
  roundTrips("TsconfigParseError", TsconfigParseError);
});

it.effect.prop(
  "JSONC parsing preserves values, comments and trailing commas are accepted, rendering is stable",
  [Arbitrary.schema(TsconfigJsonFromString)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(TsconfigJsonFromString)(value);
      const commented = `/* config */ ${Str.slice(0, -1)(encoded)}${Str.trim(encoded) === "{}" ? "" : ","}} // end`;
      const parsed = yield* S.decodeEffect(TsconfigJsonFromString)(commented);
      assertTrue(S.toEquivalence(TsconfigJson)(parsed, value));
      const formatted = yield* S.encodeEffect(TsconfigJsonFromString)(parsed);
      const reparsed = yield* S.decodeEffect(TsconfigJsonFromString)(formatted);
      assertTrue(S.toEquivalence(TsconfigJson)(reparsed, parsed));
      const value2 = yield* S.encodeEffect(TsconfigJsonFromString)(reparsed);
      assert.strictEqual(value2, formatted);
    }),
  runs
);
