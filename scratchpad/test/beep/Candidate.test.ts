import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { EvidenceRef, TaskCreatePayload } from "../../beep/ActionItem.ts";
import {
  CandidateAction,
  CandidateCompatibilityMetadata,
  CandidateCreate,
  CandidateListResponse,
  CandidateMigrationReport,
  CandidateMigrationRequest,
  CandidateRecord,
  CandidateResolutionReceipt,
  CandidateResolutionRequest,
  CandidateStatus,
  CandidateSubjectKind,
  TaskCancelCandidate,
  TaskCandidate,
  TaskCompleteCandidate,
  TaskCreateCandidate,
  TaskSupersedeCandidate,
  TaskUpdateCandidate,
  TaskWorkflowMode,
  WorkstreamCreateCandidate,
  WorkstreamProposal,
  candidateCaptureConfidence,
  candidateCompatibility,
  candidateCreateJsonSchema,
  candidateEvidenceRefs,
  candidateGoalId,
  candidateOwnershipConfidence,
  candidateProposedAction,
  candidateRecordAsProposal,
  candidateRecordFromStorage,
  candidateRecordJsonSchema,
  candidateResolutionIssue,
  candidateSourceSurface,
  candidateSubjectKind,
  candidateTaskChange,
  candidateTaskId,
  candidateWorkstreamId,
  candidateWorkstreamProposal,
} from "../../beep/Candidate.ts";

const evidence = [{ kind: "conversation", id: "conv-1", scope: "canonical" }];

const envelope = {
  captureConfidence: 0.5,
  ownershipConfidence: 0.5,
  evidenceRefs: evidence,
  sourceSurface: "chat",
};

const storedCreate = {
  candidateId: "cand-1",
  subjectKind: "task",
  proposedAction: "create",
  accountGeneration: 0,
  idempotencyKey: "once",
  createdAt: "2020-01-02T03:04:05.000Z",
  ...envelope,
  taskChange: { description: "Call back", owner: "unknown" },
};

const failed = (input: unknown) => {
  const exit = Effect.runSyncExit(candidateRecordFromStorage(input));
  assert.strictEqual(exit._tag, "Failure");
};

describe("Candidate", () => {
  it("builds arbitrary values", () => {
    for (const schema of [
      CandidateSubjectKind,
      CandidateAction,
      CandidateStatus,
      TaskWorkflowMode,
      WorkstreamProposal,
      CandidateCompatibilityMetadata,
      TaskCreateCandidate,
      TaskUpdateCandidate,
      TaskCompleteCandidate,
      TaskCancelCandidate,
      TaskSupersedeCandidate,
      WorkstreamCreateCandidate,
      TaskCandidate,
      CandidateCreate,
      CandidateRecord,
      CandidateListResponse,
      CandidateResolutionRequest,
      CandidateResolutionReceipt,
      CandidateMigrationReport,
      CandidateMigrationRequest,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("decodes each create arm", () => {
    const created = Effect.runSync(
      S.decodeUnknownEffect(CandidateCreate)({
        ...envelope,
        subjectKind: "task",
        proposedAction: "create",
        taskChange: { description: "Call back", owner: "unknown" },
      }),
    );
    assert.strictEqual(candidateSubjectKind(created), "task");
    assert.strictEqual(candidateProposedAction(created), "create");
    assert.strictEqual(O.isNone(candidateTaskId(created)), true);
    assert.strictEqual(O.isSome(candidateTaskChange(created)), true);
    assert.strictEqual(candidateCaptureConfidence(created), 0.5);
    assert.strictEqual(candidateOwnershipConfidence(created), 0.5);
    assert.strictEqual(O.isNone(candidateGoalId(created)), true);
    assert.strictEqual(O.isNone(candidateWorkstreamId(created)), true);
    assert.strictEqual(candidateEvidenceRefs(created).length, 1);
    assert.strictEqual(candidateSourceSurface(created), "chat");
    assert.strictEqual(O.isNone(candidateCompatibility(created)), true);
    assert.strictEqual(O.isNone(candidateWorkstreamProposal(created)), true);
    const updated = Effect.runSync(
      S.decodeUnknownEffect(CandidateCreate)({
        ...envelope,
        subjectKind: "task",
        proposedAction: "update",
        taskId: "task-1",
        taskChange: { description: "Tomorrow" },
      }),
    );
    assert.strictEqual(O.getOrNull(candidateTaskId(updated)), "task-1");
    const completed = Effect.runSync(
      S.decodeUnknownEffect(CandidateCreate)({
        ...envelope,
        subjectKind: "task",
        proposedAction: "complete",
        taskId: "task-1",
        taskChange: { status: "completed" },
      }),
    );
    assert.strictEqual(completed.proposedAction, "complete");
    const cancelled = Effect.runSync(
      S.decodeUnknownEffect(CandidateCreate)({
        ...envelope,
        subjectKind: "task",
        proposedAction: "cancel",
        taskId: "task-1",
        taskChange: { status: "cancelled" },
      }),
    );
    assert.strictEqual(cancelled.proposedAction, "cancel");
    const replaced = Effect.runSync(
      S.decodeUnknownEffect(CandidateCreate)({
        ...envelope,
        subjectKind: "task",
        proposedAction: "supersede",
        taskId: "task-1",
        taskChange: { status: "superseded", supersededBy: "task-2" },
      }),
    );
    assert.strictEqual(replaced.proposedAction, "supersede");
    const workstream = Effect.runSync(
      S.decodeUnknownEffect(CandidateCreate)({
        ...envelope,
        subjectKind: "workstream",
        proposedAction: "create",
        workstreamProposal: {
          title: "Launch",
          objective: "Ship the note",
          anchorTask: { description: "Write the note" },
        },
      }),
    );
    assert.strictEqual(O.isSome(candidateWorkstreamProposal(workstream)), true);
    assert.strictEqual(O.isNone(candidateTaskId(workstream)), true);
  });

  it("rejects illegal arms and resolution states", () => {
    failed({ ...storedCreate, taskId: "task-1" });
    failed({ ...storedCreate, proposedAction: "complete", taskId: "task-1", taskChange: { description: "Later" } });
    failed({ ...storedCreate, proposedAction: "cancel", taskId: "task-1", taskChange: { status: "completed" } });
    failed({
      ...storedCreate,
      proposedAction: "supersede",
      taskId: "task-1",
      taskChange: { status: "superseded" },
    });
    failed({ ...storedCreate, resolvedAt: "2020-01-03T03:04:05.000Z" });
    failed({
      ...storedCreate,
      status: "accepted",
      resolvedAt: "2020-01-03T03:04:05.000Z",
    });
    failed({
      ...envelope,
      candidateId: "cand-2",
      subjectKind: "workstream",
      proposedAction: "create",
      accountGeneration: 0,
      idempotencyKey: "once",
      createdAt: "2020-01-02T03:04:05.000Z",
      status: "accepted",
      resolvedAt: "2020-01-03T03:04:05.000Z",
      workstreamProposal: {
        title: "Launch",
        objective: "Ship the note",
        anchorTask: { description: "Write the note" },
      },
    });
    const stored = Effect.runSync(candidateRecordFromStorage(storedCreate));
    assert.strictEqual(stored.status, "pending");
    assert.strictEqual(O.isNone(candidateResolutionIssue(stored)), true);
    const proposal = Effect.runSync(candidateRecordAsProposal(stored));
    assert.strictEqual(proposal.proposedAction, "create");
  });

  it("renames anyOf and lists six record arms", () => {
    const schema = candidateCreateJsonSchema({ anyOf: [{ type: "object" }], title: "Candidate" });
    assert.strictEqual("oneOf" in schema, true);
    assert.strictEqual("anyOf" in schema, false);
    assert.strictEqual(candidateCreateJsonSchema({ title: "plain" }).title, "plain");
    assert.strictEqual(candidateRecordJsonSchema().oneOf.length, 6);
    assert.strictEqual(CandidateMigrationRequest.make({}).limit, 500);
    const record = CandidateRecord.make({
      candidateId: "cand-1",
      subjectKind: "task",
      proposedAction: "create",
      accountGeneration: 0,
      idempotencyKey: "once",
      captureConfidence: 0.5,
      ownershipConfidence: 0.5,
      evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
      sourceSurface: "chat",
      taskChange: O.some(TaskCreatePayload.make({ description: "Call back" })),
      createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
      resolvedAt: O.some(DateTime.makeUnsafe("2020-01-03T03:04:05.000Z")),
    });
    assert.strictEqual(O.isSome(candidateResolutionIssue(record)), true);
  });
});
