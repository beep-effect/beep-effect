import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { BunExtension } from "../../effected/lockfiles/BunExtension.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("BunExtension: encoded values decode without failure and preserve the model", [Arbitrary.schema(BunExtension)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(BunExtension)(value);
    const decoded = yield* S.decodeEffect(BunExtension)(encoded);
    assertTrue(S.toEquivalence(BunExtension)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(BunExtension)(decoded), encoded);
  }), runs);
