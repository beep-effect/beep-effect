import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { eofNewlineOptions } from "@beep/yaml/internal/rules/eof-newline";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "eofNewlineOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(eofNewlineOptions)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(eofNewlineOptions)(value);
      const decoded = yield* S.decodeEffect(eofNewlineOptions)(encoded);
      assert.isTrue(S.toEquivalence(eofNewlineOptions)(decoded, value));
      const value1 = yield* S.encodeEffect(eofNewlineOptions)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
