import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  ActionItemCreateRequest,
  ActionItemResponse,
  ActionItemUpdateRequest,
  ActionItemsResponse,
  CanonicalTaskCreate,
  CanonicalTaskUpdate,
  EvidenceKind,
  EvidenceRef,
  EvidenceRefChecked,
  EvidenceScope,
  TaskChangePayload,
  TaskCreatePayload,
  TaskFieldConflict,
  TaskOwner,
  TaskPriority,
  TaskStatus,
  actionItemUpdateStoragePayload,
  canonicalTaskCreateStoragePayload,
  canonicalTaskUpdateStoragePayload,
  evidenceScopeIssue,
  projectLegacyActionItem,
  requireTaskChange,
} from "../../beep/ActionItem.ts";

const decodeEvidenceRefChecked = S.decodeUnknownEffect(EvidenceRefChecked);

const decodeActionItemCreateRequest = S.decodeUnknownEffect(ActionItemCreateRequest);

const fail = <A>(effect: Effect.Effect<A, TaskFieldConflict>) => {
  const result = effect.pipe(Effect.result, Effect.runSync);
  assert.strictEqual(Result.isFailure(result), true);
};

const ref = (scope: "canonical" | "device_local", deviceId?: string) =>
  EvidenceRef.make({
    kind: "conversation",
    id: "conv-1",
    scope,
    ...(deviceId === undefined ? {} : { deviceId: O.some(deviceId) }),
  });

describe("ActionItem", () => {
  it("builds arbitrary values", () => {
    for (const schema of [
      TaskStatus,
      TaskOwner,
      TaskPriority,
      EvidenceKind,
      EvidenceScope,
      EvidenceRef,
      EvidenceRefChecked,
      CanonicalTaskCreate,
      CanonicalTaskUpdate,
      ActionItemCreateRequest,
      ActionItemUpdateRequest,
      ActionItemResponse,
      ActionItemsResponse,
      TaskCreatePayload,
      TaskChangePayload,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("checks every evidence scope branch", () => {
    assert.strictEqual(O.isNone(evidenceScopeIssue(ref("canonical"))), true);
    assert.strictEqual(
      O.getOrNull(evidenceScopeIssue(ref("device_local"))),
      "device_local evidence requires device_id",
    );
    assert.strictEqual(
      O.getOrNull(evidenceScopeIssue(ref("canonical", "device-1"))),
      "canonical evidence cannot carry device_id",
    );
    assert.strictEqual(
      O.getOrNull(
        evidenceScopeIssue(EvidenceRef.make({ kind: "local_screen", id: "frame-1", scope: "canonical" })),
      ),
      "local_screen evidence must be device_local",
    );
    assert.strictEqual(
      O.getOrNull(
        evidenceScopeIssue(
          EvidenceRef.make({
            kind: "conversation",
            id: "conv-1",
            scope: "canonical",
            startSeconds: O.some(5),
            endSeconds: O.some(1),
          }),
        ),
      ),
      "end_seconds must be greater than or equal to start_seconds",
    );
    const input: unknown = { kind: "local_screen", id: "frame-1", scope: "canonical" };
    const rejected = decodeEvidenceRefChecked(input).pipe(Effect.result, Effect.runSync);
    assert.strictEqual(Result.isFailure(rejected), true);
  });

  it("reconciles create status and completed", () => {
    const filled = Effect.runSync(
      canonicalTaskCreateStoragePayload(
        CanonicalTaskCreate.make({ description: "Ship the note", completed: O.some(true) }),
      ),
    );
    assert.strictEqual(filled.status, "completed");
    assert.strictEqual(filled.completed, true);
    const active = Effect.runSync(
      canonicalTaskCreateStoragePayload(CanonicalTaskCreate.make({ description: "Ship the note" })),
    );
    assert.strictEqual(active.status, "active");
    assert.strictEqual(active.completed, false);
    fail(
      canonicalTaskCreateStoragePayload(
        CanonicalTaskCreate.make({
          description: "Ship the note",
          status: O.some<TaskStatus>("active"),
          completed: O.some(true),
        }),
      ),
    );
  });

  it("derives update status and rejects an empty patch", () => {
    const derived = Effect.runSync(
      canonicalTaskUpdateStoragePayload(CanonicalTaskUpdate.make({ status: O.some<TaskStatus>("completed") })),
    );
    assert.strictEqual(derived.status, "completed");
    assert.strictEqual(derived.completed, true);
    const description = Effect.runSync(
      canonicalTaskUpdateStoragePayload(CanonicalTaskUpdate.make({ description: O.some("Rename") })),
    );
    assert.strictEqual(description.description, "Rename");
    assert.strictEqual("status" in description, false);
    fail(canonicalTaskUpdateStoragePayload(CanonicalTaskUpdate.make({})));
    fail(
      canonicalTaskUpdateStoragePayload(
        CanonicalTaskUpdate.make({ status: O.some<TaskStatus>("active"), completed: O.some(true) }),
      ),
    );
  });

  it("writes a null due date only when the clear flag is set", () => {
    const cleared = Effect.runSync(
      actionItemUpdateStoragePayload(ActionItemUpdateRequest.make({ clearDueAt: true })),
    );
    assert.strictEqual(cleared.due_at, null);
    fail(actionItemUpdateStoragePayload(ActionItemUpdateRequest.make({})));
  });

  it("projects legacy deleted, completed, and status rows", () => {
    const deleted = Effect.runSync(
      projectLegacyActionItem({ id: "task-1", description: "Old", completed: true, deleted: true }),
    );
    assert.strictEqual(deleted.status, "cancelled");
    assert.strictEqual(O.getOrNull(deleted.taskId), "task-1");
    const done = Effect.runSync(projectLegacyActionItem({ id: "task-2", description: "Old", completed: true }));
    assert.strictEqual(done.status, "completed");
    const open = Effect.runSync(
      projectLegacyActionItem({ id: "task-3", description: "Old", status: "completed" }),
    );
    assert.strictEqual(open.completed, true);
  });

  it("requires at least one task change field", () => {
    fail(requireTaskChange(TaskChangePayload.make({})));
    const kept = Effect.runSync(requireTaskChange(TaskChangePayload.make({ description: O.some("Later") })));
    assert.strictEqual(O.getOrNull(kept.description), "Later");
  });

  it("ignores an unknown create key", () => {
    const input: unknown = {
      description: "Ship the note",
      legacy: true,
      owner: "user",
      source: "manual",
      provenance: [],
      sortOrder: 0,
      indentLevel: 0,
      isLocked: false,
      exported: false,
    };
    const decoded = Effect.runSync(decodeActionItemCreateRequest(input));
    assert.strictEqual(decoded.description, "Ship the note");
  });
});
