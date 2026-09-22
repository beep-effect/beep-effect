import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Task, TaskAction, TaskActionProvider, TaskStatus } from "../../beep/Task.ts";
import { toWire } from "../../beep/Port.ts";

const decode = <A extends S.Top>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Top, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const present = {
  id: "task-1",
  action: "hume_mersure_user_expression",
  status: "done",
  created_at: "2020-01-02T03:04:05.000Z",
  executed_at: "2020-01-02T04:00:00.000Z",
  updated_at: "2020-01-02T05:00:00.000Z",
  request_id: "req-1",
  memory_id: "mem-1",
  user_uid: "user-1",
};

describe("Task", () => {
  it("decodes a present snake_case row", () => {
    const decoded = decode(toWire(Task), present);
    assert.strictEqual(decoded.id, "task-1");
    assert.strictEqual(decoded.action, "hume_mersure_user_expression");
    assert.strictEqual(decoded.status, "done");
    assert.strictEqual(DateTime.formatIso(decoded.createdAt), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(O.isSome(decoded.executedAt), true);
    assert.strictEqual(O.isSome(decoded.requestId), true);
    assert.strictEqual(O.getOrElse(decoded.userUid, () => ""), "user-1");
  });

  it("decodes missing and null option fields as None", () => {
    const missing = decode(toWire(Task), {
      id: "task-1",
      action: "hume_mersure_user_expression",
      status: "processing",
      created_at: "2020-01-02T03:04:05",
    });
    assert.strictEqual(O.isNone(missing.executedAt), true);
    assert.strictEqual(O.isNone(missing.updatedAt), true);
    assert.strictEqual(O.isNone(missing.requestId), true);
    assert.strictEqual(O.isNone(missing.memoryId), true);
    assert.strictEqual(O.isNone(missing.userUid), true);
    assert.strictEqual(DateTime.formatIso(missing.createdAt), "2020-01-02T03:04:05.000Z");

    const nulled = decode(toWire(Task), {
      id: "task-1",
      action: "hume_mersure_user_expression",
      status: "error",
      created_at: "2020-01-02T03:04:05.000Z",
      executed_at: null,
      updated_at: null,
      request_id: null,
      memory_id: null,
      user_uid: null,
    });
    assert.strictEqual(O.isNone(nulled.executedAt), true);
    assert.strictEqual(O.isNone(nulled.memoryId), true);
  });

  it("rejects an unknown action and an unknown extra key", () => {
    assert.strictEqual(
      fails(toWire(Task), {
        id: "task-1",
        action: "other",
        status: "done",
        created_at: "2020-01-02T03:04:05.000Z",
      }),
      true,
    );
    assert.strictEqual(
      Effect.runSyncExit(
        S.decodeUnknownEffect(toWire(Task), { onExcessProperty: "error" })({
          id: "task-1",
          action: "hume_mersure_user_expression",
          status: "done",
          created_at: "2020-01-02T03:04:05.000Z",
          extra: true,
        }),
      )._tag,
      "Failure",
    );
  });

  it("derives an arbitrary for every exported schema", () => {
    const schemas = [TaskActionProvider, TaskAction, TaskStatus, Task];
    for (const schema of schemas) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});
