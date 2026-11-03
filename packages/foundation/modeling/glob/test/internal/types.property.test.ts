import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Platform } from "@beep/glob/internal/types";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "Platform decoding an encoded platform succeeds and preserves its value",
  [Arbitrary.schema(Platform)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Platform)(value);
      const decoded = yield* S.decodeEffect(Platform)(encoded);
      assert.strictEqual(decoded, value);
      const value1 = yield* S.encodeEffect(Platform)(decoded);
      assert.strictEqual(value1, encoded);
    }),
  runs
);
