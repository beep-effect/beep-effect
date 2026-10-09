import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { eofNewlineOptions } from "../../../../effected/yaml/internal/rules/eof-newline.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "eofNewlineOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(eofNewlineOptions)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(eofNewlineOptions)(value);
    const decoded = yield* S.decodeEffect(eofNewlineOptions)(encoded);
    assert.isTrue(S.toEquivalence(eofNewlineOptions)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(eofNewlineOptions)(decoded), encoded);
  }),
  runs,
);
