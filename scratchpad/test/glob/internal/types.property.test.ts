import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Platform } from "../../../effected/glob/internal/types.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("Platform decoding an encoded platform succeeds and preserves its value", [Arbitrary.schema(Platform)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(Platform)(value);
    const decoded = yield* S.decodeEffect(Platform)(encoded);
    assert.strictEqual(decoded, value);
    assert.strictEqual(yield* S.encodeEffect(Platform)(decoded), encoded);
  }), runs);
