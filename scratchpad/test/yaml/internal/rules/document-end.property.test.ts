import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { documentEndOptions } from "../../../../effected/yaml/internal/rules/document-end.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "documentEndOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(documentEndOptions)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(documentEndOptions)(value);
    const decoded = yield* S.decodeEffect(documentEndOptions)(encoded);
    assert.isTrue(S.toEquivalence(documentEndOptions)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(documentEndOptions)(decoded), encoded);
  }),
  runs,
);
