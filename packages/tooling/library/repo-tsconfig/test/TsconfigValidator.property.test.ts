import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { StrictCompilerOptions, StrictTsconfig, TsconfigValidationError } from "@beep/repo-tsconfig/TsconfigValidator";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, options = runs): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: encoding decodes successfully to an equivalent value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
        assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
      }),
    options
  );
};

describe("TsconfigValidator property floor", () => {
  roundTrips("TsconfigValidationError", TsconfigValidationError);
  // The strict schemas filter their samples (unique lists, cross-field rules), so the discard budget
  // is wide enough for a random seed to reach the accepted-sample count.
  const filtered = { arbitrary: { ...fcRuns(20), maxDiscards: fcRuns(20).runs * 100 } };
  roundTrips("StrictCompilerOptions", StrictCompilerOptions, filtered);
  roundTrips("StrictTsconfig", StrictTsconfig, filtered);
});
