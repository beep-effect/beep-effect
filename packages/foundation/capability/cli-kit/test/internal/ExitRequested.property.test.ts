import { ExitRequested } from "@beep/cli-kit/internal/ExitRequested";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "ExitRequested encodes and decodes without failure or loss",
  [Arbitrary.schema(ExitRequested)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ExitRequested)(value);
      const decoded = yield* S.decodeEffect(ExitRequested)(encoded);
      assertTrue(S.toEquivalence(ExitRequested)(decoded, value));
      const value1 = yield* S.encodeEffect(ExitRequested)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
