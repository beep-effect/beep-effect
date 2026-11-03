import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { LockfileIntegrity, WorkspaceManifest } from "@beep/lockfiles/LockfileIntegrity";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "LockfileIntegrity: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(LockfileIntegrity)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LockfileIntegrity)(value);
      const decoded = yield* S.decodeEffect(LockfileIntegrity)(encoded);
      assertTrue(S.toEquivalence(LockfileIntegrity)(decoded, value));
      const value1 = yield* S.encodeEffect(LockfileIntegrity)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "WorkspaceManifest: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(WorkspaceManifest)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(WorkspaceManifest)(value);
      const decoded = yield* S.decodeEffect(WorkspaceManifest)(encoded);
      assertTrue(S.toEquivalence(WorkspaceManifest)(decoded, value));
      const value2 = yield* S.encodeEffect(WorkspaceManifest)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);
