import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { documentEndOptions } from "@beep/yaml/internal/rules/document-end";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "documentEndOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(documentEndOptions)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(documentEndOptions)(value);
      const decoded = yield* S.decodeEffect(documentEndOptions)(encoded);
      assert.isTrue(S.toEquivalence(documentEndOptions)(decoded, value));
      const value1 = yield* S.encodeEffect(documentEndOptions)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
