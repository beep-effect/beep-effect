import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { colonSpacingOptions } from "../../../../effected/yaml/internal/rules/colon-spacing.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "colonSpacingOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(colonSpacingOptions)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(colonSpacingOptions)(value);
    const decoded = yield* S.decodeEffect(colonSpacingOptions)(encoded);
    assert.isTrue(S.toEquivalence(colonSpacingOptions)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(colonSpacingOptions)(decoded), encoded);
  }),
  runs,
);
