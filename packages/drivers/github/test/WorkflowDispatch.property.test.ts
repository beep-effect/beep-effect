import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { WorkflowInfo, WorkflowRunStatus } from "@beep/github/WorkflowDispatch";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "WorkflowInfo encodes and decodes every generated definition",
  [Arbitrary.schema(WorkflowInfo)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(WorkflowInfo)(value);
      const decoded = yield* S.decodeEffect(WorkflowInfo)(encoded);
      assert.isTrue(S.toEquivalence(WorkflowInfo)(decoded, value));
      const value1 = yield* S.encodeEffect(WorkflowInfo)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "WorkflowRunStatus round-trips its fields and completion semantics",
  [Arbitrary.schema(WorkflowRunStatus)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(WorkflowRunStatus)(value);
      const decoded = yield* S.decodeEffect(WorkflowRunStatus)(encoded);
      assert.isTrue(S.toEquivalence(WorkflowRunStatus)(decoded, value));
      assert.strictEqual(decoded.isDone, value.status === "completed");
      const value2 = yield* S.encodeEffect(WorkflowRunStatus)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);
