import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LockfileIntegrity, WorkspaceManifest } from "../../effected/lockfiles/LockfileIntegrity.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("LockfileIntegrity: encoded values decode without failure and preserve the model", [Arbitrary.schema(LockfileIntegrity)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(LockfileIntegrity)(value);
    const decoded = yield* S.decodeEffect(LockfileIntegrity)(encoded);
    assertTrue(S.toEquivalence(LockfileIntegrity)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(LockfileIntegrity)(decoded), encoded);
  }), runs);

it.effect.prop("WorkspaceManifest: encoded values decode without failure and preserve the model", [Arbitrary.schema(WorkspaceManifest)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(WorkspaceManifest)(value);
    const decoded = yield* S.decodeEffect(WorkspaceManifest)(encoded);
    assertTrue(S.toEquivalence(WorkspaceManifest)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(WorkspaceManifest)(decoded), encoded);
  }), runs);
