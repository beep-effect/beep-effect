import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { IeeeNumber } from "../../../effected/github-actions/internal/ieeeNumber.ts";

it.effect("IEEE JSON and string-tree codecs preserve finite and non-finite values", () => Effect.gen(function* () {
  for (const value of [0, -12.5, Infinity, -Infinity, NaN]) {
    for (const codec of [S.toCodecJson(IeeeNumber), S.toCodecStringTree(IeeeNumber)]) {
      const encoded = yield* S.encodeEffect(codec)(value);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      assert.strictEqual(Object.is(decoded, value), true);
    }
  }
  assert.strictEqual(yield* Effect.isFailure(S.decodeUnknownEffect(IeeeNumber)("1")), true);
}));
