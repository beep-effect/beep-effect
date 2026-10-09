import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PackageManagerLock } from "../../effected/lockfiles/PackageManagerLock.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("PackageManagerLock: encoded values decode without failure and preserve the model", [Arbitrary.schema(PackageManagerLock)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(PackageManagerLock)(value);
    const decoded = yield* S.decodeEffect(PackageManagerLock)(encoded);
    assertTrue(S.toEquivalence(PackageManagerLock)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(PackageManagerLock)(decoded), encoded);
  }), runs);
