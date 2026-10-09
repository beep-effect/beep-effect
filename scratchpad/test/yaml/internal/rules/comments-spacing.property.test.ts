import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { commentsSpacingOptions } from "../../../../effected/yaml/internal/rules/comments-spacing.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "commentsSpacingOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(commentsSpacingOptions)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(commentsSpacingOptions)(value);
    const decoded = yield* S.decodeEffect(commentsSpacingOptions)(encoded);
    assert.isTrue(S.toEquivalence(commentsSpacingOptions)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(commentsSpacingOptions)(decoded), encoded);
  }),
  runs,
);
