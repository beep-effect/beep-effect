import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { BunExtension } from "@beep/lockfiles/BunExtension";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "BunExtension: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(BunExtension)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(BunExtension)(value);
      const decoded = yield* S.decodeEffect(BunExtension)(encoded);
      assertTrue(S.toEquivalence(BunExtension)(decoded, value));
      const value1 = yield* S.encodeEffect(BunExtension)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
