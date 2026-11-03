import { CoreStatusName, Status, StatusDef } from "@beep/cli-kit/Status";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "CoreStatusName encodes and decodes without failure or loss",
  [Arbitrary.schema(CoreStatusName)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CoreStatusName)(value);
      const decoded = yield* S.decodeEffect(CoreStatusName)(encoded);
      assertTrue(S.toEquivalence(CoreStatusName)(decoded, value));
      const value1 = yield* S.encodeEffect(CoreStatusName)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "status snapshots preserve definitions and select their original name",
  [Arbitrary.schema(CoreStatusName)],
  ([name]) =>
    Effect.sync(() => {
      const snapshot = Status.core.resolve(name);
      assert.deepStrictEqual(snapshot, Status.core.def(name));
      assert.notStrictEqual(snapshot, Status.core.def(name));
      assert.strictEqual(Status.core.worst([name, name]), name);
    }),
  runs
);

it.effect.prop(
  "StatusDef encodes and decodes without failure or loss",
  [Arbitrary.schema(StatusDef)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(StatusDef)(value);
      const decoded = yield* S.decodeEffect(StatusDef)(encoded);
      assertTrue(S.toEquivalence(StatusDef)(decoded, value));
      const value2 = yield* S.encodeEffect(StatusDef)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);
