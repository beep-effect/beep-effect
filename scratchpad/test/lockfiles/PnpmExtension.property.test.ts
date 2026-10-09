import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PnpmCatalogs, PnpmExtension } from "../../effected/lockfiles/PnpmExtension.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("PnpmCatalogs: encoded values decode without failure and preserve the model", [Arbitrary.schema(PnpmCatalogs)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(PnpmCatalogs)(value);
    const decoded = yield* S.decodeEffect(PnpmCatalogs)(encoded);
    assertTrue(S.toEquivalence(PnpmCatalogs)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(PnpmCatalogs)(decoded), encoded);
  }), runs);

it.effect.prop("PnpmExtension: encoded values decode without failure and preserve the model", [Arbitrary.schema(PnpmExtension)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(PnpmExtension)(value);
    const decoded = yield* S.decodeEffect(PnpmExtension)(encoded);
    assertTrue(S.toEquivalence(PnpmExtension)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(PnpmExtension)(decoded), encoded);
  }), runs);
