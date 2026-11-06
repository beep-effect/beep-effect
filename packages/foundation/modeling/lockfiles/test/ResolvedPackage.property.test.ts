import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ResolvedPackage } from "@beep/lockfiles/ResolvedPackage";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "ResolvedPackage: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(ResolvedPackage)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ResolvedPackage)(value);
      const decoded = yield* S.decodeEffect(ResolvedPackage)(encoded);
      assertTrue(S.toEquivalence(ResolvedPackage)(decoded, value));
      const value1 = yield* S.encodeEffect(ResolvedPackage)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
