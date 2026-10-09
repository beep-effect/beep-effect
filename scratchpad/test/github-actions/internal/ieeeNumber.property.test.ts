import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { IeeeNumber } from "../../../effected/github-actions/internal/ieeeNumber.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("IeeeNumber and its structural codecs decode every encoded value", [Arbitrary.schema(IeeeNumber)], ([value]) => Effect.gen(function* () {
  for (const codec of [IeeeNumber, S.toCodecJson(IeeeNumber), S.toCodecStringTree(IeeeNumber)]) {
    const encoded = yield* S.encodeEffect(codec)(value);
    const decoded = yield* S.decodeEffect(codec)(encoded);
    assert.strictEqual(decoded === value || (Number.isNaN(decoded) && Number.isNaN(value)), true);
  }
}), runs);
