import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ResolvedPackage } from "../../effected/lockfiles/ResolvedPackage.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("ResolvedPackage: encoded values decode without failure and preserve the model", [Arbitrary.schema(ResolvedPackage)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(ResolvedPackage)(value);
    const decoded = yield* S.decodeEffect(ResolvedPackage)(encoded);
    assertTrue(S.toEquivalence(ResolvedPackage)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(ResolvedPackage)(decoded), encoded);
  }), runs);
