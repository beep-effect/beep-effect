import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { EnumerationFailureKind } from "@beep/repo-workspaces/internal/enumerate";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "EnumerationFailureKind decode(encode(x)) equals x and never fails",
  [Arbitrary.schema(EnumerationFailureKind)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(EnumerationFailureKind)(value);
      const decoded = yield* S.decodeEffect(EnumerationFailureKind)(encoded);
      assert.isTrue(S.toEquivalence(EnumerationFailureKind)(decoded, value));
      const value1 = yield* S.encodeEffect(EnumerationFailureKind)(decoded);
      assert.strictEqual(value1, encoded);
    }),
  runs
);
