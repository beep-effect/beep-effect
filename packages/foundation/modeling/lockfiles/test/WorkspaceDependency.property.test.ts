import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { WorkspaceDependency } from "@beep/lockfiles/WorkspaceDependency";

it.effect.prop(
  "WorkspaceDependency encoding decodes without failure and preserves the edge",
  [Arbitrary.schema(WorkspaceDependency)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(WorkspaceDependency)(value);
      const decoded = yield* S.decodeEffect(WorkspaceDependency)(encoded);
      assertTrue(S.toEquivalence(WorkspaceDependency)(decoded, value));
      const value1 = yield* S.encodeEffect(WorkspaceDependency)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
