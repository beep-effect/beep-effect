import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { InvalidPattern } from "@beep/glob/internal/assertValidPattern";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "InvalidPattern round trips preserve the error tag and message",
  [Arbitrary.schema(InvalidPattern)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(InvalidPattern)(value);
      const decoded = yield* S.decodeEffect(InvalidPattern)(encoded);
      const value1 = yield* S.encodeEffect(InvalidPattern)(decoded);
      assert.deepStrictEqual(value1, encoded);
      assert.strictEqual(decoded.message, value.message);
      assert.strictEqual(decoded._tag, value._tag);
    }),
  runs
);
