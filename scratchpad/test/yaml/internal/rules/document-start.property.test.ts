import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { documentStartOptions } from "../../../../effected/yaml/internal/rules/document-start.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "documentStartOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(documentStartOptions)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(documentStartOptions)(value);
    const decoded = yield* S.decodeEffect(documentStartOptions)(encoded);
    assert.isTrue(S.toEquivalence(documentStartOptions)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(documentStartOptions)(decoded), encoded);
  }),
  runs,
);
