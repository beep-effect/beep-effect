import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ConfigDependencyLock } from "../../effected/lockfiles/ConfigDependencyLock.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("ConfigDependencyLock: encoded values decode without failure and preserve the model", [Arbitrary.schema(ConfigDependencyLock)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(ConfigDependencyLock)(value);
    const decoded = yield* S.decodeEffect(ConfigDependencyLock)(encoded);
    assertTrue(S.toEquivalence(ConfigDependencyLock)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(ConfigDependencyLock)(decoded), encoded);
  }), runs);
