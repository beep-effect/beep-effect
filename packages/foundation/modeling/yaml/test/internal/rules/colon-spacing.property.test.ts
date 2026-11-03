import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { colonSpacingOptions } from "@beep/yaml/internal/rules/colon-spacing";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "colonSpacingOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(colonSpacingOptions)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(colonSpacingOptions)(value);
      const decoded = yield* S.decodeEffect(colonSpacingOptions)(encoded);
      assert.isTrue(S.toEquivalence(colonSpacingOptions)(decoded, value));
      const value1 = yield* S.encodeEffect(colonSpacingOptions)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
