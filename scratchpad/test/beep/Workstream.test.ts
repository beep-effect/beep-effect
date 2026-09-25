import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ArtifactDescriptor,
  ArtifactDescriptorCreate,
  ArtifactStatus,
  ArtifactStatusTransitionRequest,
  ContinuationCheckpoint,
  ContinuationCheckpointUpsert,
  GoalDetailProjection,
  GoalOriginWorkIntent,
  TaskGoalLinkImport,
  TaskGoalLinkImportReport,
  TaskGoalLinkImportRequest,
  TaskOriginWorkIntent,
  WorkIntentReceipt,
  WorkIntentRequest,
  Workstream,
  WorkstreamContractError,
  WorkstreamCreate,
  WorkstreamDetailProjection,
  WorkstreamEvent,
  WorkstreamEventCreate,
  WorkstreamEventKind,
  WorkstreamSensitivity,
  WorkstreamStatus,
  WorkstreamUpdate,
  WorkstreamUpdateChecked,
  requireExplicitValidPatch,
} from "../../beep/Workstream.ts";

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const encode = <Sch extends S.Codec<unknown, unknown, never, never>>(schema: Sch, value: Sch["Type"]): Sch["Encoded"] =>
  Effect.runSync(S.encodeEffect(schema)(value));

const at = "2020-01-02T03:04:05.000Z";
const now = DateTime.makeUnsafe(at);

const evidence = { kind: "conversation", id: "conv-1", scope: "canonical" };

const workstream = {
  workstreamId: "ws-1",
  title: "Launch",
  objective: "Ship v2",
  status: "open",
  currentStateSummary: "",
  latestEventSequence: 0,
  createdAt: at,
  updatedAt: at,
};

const event = {
  eventId: "evt-1",
  workstreamId: "ws-1",
  sequence: 1,
  kind: "user_note",
  summary: "Talked to Ada",
  evidenceRefs: [evidence],
  sensitivity: "normal",
  createdAt: at,
};

const artifactCreate = {
  logicalKey: "spec",
  version: 1,
  kind: "document",
  uri: "gs://bucket/spec.md",
  contentHash: "0123456789abcdef",
  evidenceEventIds: ["evt-1"],
  evidenceRefs: [evidence],
};

const artifact = { ...artifactCreate, artifactId: "art-1", workstreamId: "ws-1", status: "approved", createdAt: at };

const checkpointUpsert = { runtimeId: "rt-1", lastEventSequence: 0, contextSummary: "", evidenceRefs: [] };

const checkpoint = { ...checkpointUpsert, checkpointId: "cp-1", workstreamId: "ws-1", updatedAt: at };

const goal = {
  id: "goal-1",
  goalId: "goal-1",
  title: "Run",
  desiredOutcome: "Run a marathon",
  successCriteria: [],
  status: "background",
  source: "user",
  createdAt: at,
  updatedAt: at,
  latestProgressSequence: 0,
  goalType: "boolean",
  targetValue: 1,
  currentValue: 0,
  minValue: 0,
  maxValue: 1,
  isActive: true,
};

const task = {
  id: "task-1",
  description: "Write the plan",
  status: "active",
  completed: false,
  owner: "user",
  source: "legacy",
  provenance: [],
  sortOrder: 0,
  indentLevel: 0,
  isLocked: false,
  exported: false,
};

const progressEvent = {
  eventId: "gpe-1",
  goalId: "goal-1",
  sequence: 1,
  kind: "milestone",
  summary: "Halfway",
  evidenceRefs: [],
  createdAt: at,
};

describe("literal kits", () => {
  it("decode every member and reject strangers", () => {
    assert.strictEqual(decode(WorkstreamStatus, "archived"), "archived");
    assert.strictEqual(decode(WorkstreamEventKind, "screen_observation"), "screen_observation");
    assert.strictEqual(decode(WorkstreamSensitivity, "sensitive"), "sensitive");
    assert.strictEqual(decode(ArtifactStatus, "awaiting_review"), "awaiting_review");
    assert.strictEqual(decodeFails(WorkstreamStatus, "closed"), true);
    assert.strictEqual(decodeFails(ArtifactStatus, "final"), true);
  });
});

describe("WorkstreamCreate", () => {
  it("decodes present values and treats null or missing options as None", () => {
    const decoded = decode(WorkstreamCreate, {
      title: "Launch",
      objective: "Ship v2",
      goalId: "goal-1",
      currentStateSummary: "Kickoff done",
      nextReviewAt: at,
    });
    assert.strictEqual(O.getOrNull(decoded.goalId), "goal-1");
    assert.strictEqual(O.isSome(decoded.nextReviewAt), true);
    const missing = decode(WorkstreamCreate, { title: "Launch", objective: "Ship v2", currentStateSummary: "" });
    assert.strictEqual(O.isNone(missing.goalId), true);
    assert.strictEqual(O.isNone(missing.nextReviewAt), true);
    const nulls = decode(WorkstreamCreate, {
      title: "Launch",
      objective: "Ship v2",
      goalId: null,
      currentStateSummary: "",
      nextReviewAt: null,
    });
    assert.strictEqual(O.isNone(nulls.goalId), true);
    assert.strictEqual(encode(WorkstreamCreate, nulls).goalId, null);
    assert.strictEqual(WorkstreamCreate.make({ title: "Launch", objective: "Ship v2" }).currentStateSummary, "");
  });

  it("enforces the text bounds", () => {
    assert.strictEqual(decodeFails(WorkstreamCreate, { title: "", objective: "Ship v2", currentStateSummary: "" }), true);
    assert.strictEqual(
      decodeFails(WorkstreamCreate, { title: "Launch", objective: "x".repeat(2049), currentStateSummary: "" }),
      true,
    );
    assert.strictEqual(
      decodeFails(WorkstreamCreate, { title: "Launch", objective: "Ship v2", currentStateSummary: "x".repeat(4001) }),
      true,
    );
  });
});

describe("WorkstreamUpdate", () => {
  it("distinguishes omitted keys from explicit values", () => {
    const empty = decode(WorkstreamUpdate, {});
    assert.strictEqual(O.isNone(empty.title), true);
    assert.strictEqual(O.isNone(empty.nextReviewAt), true);
    const set = decode(WorkstreamUpdate, { title: "New", status: "paused", nextReviewAt: at });
    assert.strictEqual(O.getOrNull(set.title), "New");
    assert.strictEqual(O.getOrNull(set.status), "paused");
    assert.strictEqual(O.isSome(set.nextReviewAt.pipe(O.flatten)), true);
    const cleared = decode(WorkstreamUpdate, { nextReviewAt: null });
    assert.strictEqual(O.isSome(cleared.nextReviewAt) && O.isNone(cleared.nextReviewAt.value), true);
    assert.strictEqual(encode(WorkstreamUpdate, cleared).nextReviewAt, null);
    assert.strictEqual("title" in encode(WorkstreamUpdate, cleared), false);
  });

  it("rejects explicit null on the non-clearable fields and out-of-bound values", () => {
    assert.strictEqual(decodeFails(WorkstreamUpdate, { title: null }), true);
    assert.strictEqual(decodeFails(WorkstreamUpdate, { objective: null }), true);
    assert.strictEqual(decodeFails(WorkstreamUpdate, { status: null }), true);
    assert.strictEqual(decodeFails(WorkstreamUpdate, { currentStateSummary: null }), true);
    assert.strictEqual(decodeFails(WorkstreamUpdate, { title: "" }), true);
    assert.strictEqual(decodeFails(WorkstreamUpdate, { currentStateSummary: "x".repeat(4001) }), true);
  });

  it("requires at least one field through the checked schema and the effect", () => {
    assert.strictEqual(decodeFails(WorkstreamUpdateChecked, {}), true);
    assert.strictEqual(O.getOrNull(decode(WorkstreamUpdateChecked, { objective: "Ship v3" }).objective), "Ship v3");
    const failure = Effect.runSyncExit(requireExplicitValidPatch(WorkstreamUpdate.make({})));
    assert.strictEqual(failure._tag, "Failure");
    const error = Effect.runSync(
      requireExplicitValidPatch(WorkstreamUpdate.make({})).pipe(
        Effect.catchTag("WorkstreamContractError", (issue: WorkstreamContractError) => Effect.succeed(issue.message)),
      ),
    );
    assert.strictEqual(error, "at least one workstream field is required");
    const ok = Effect.runSync(requireExplicitValidPatch(WorkstreamUpdate.make({ nextReviewAt: O.some(O.none()) })));
    assert.strictEqual(O.isSome(ok.nextReviewAt), true);
  });
});

describe("Workstream and journal events", () => {
  it("decode the stored row and default the sequence on construction", () => {
    const decoded = decode(Workstream, { ...workstream, goalId: "goal-1", lastMeaningfulProgressAt: at });
    assert.strictEqual(O.getOrNull(decoded.goalId), "goal-1");
    assert.strictEqual(O.isSome(decoded.lastMeaningfulProgressAt), true);
    const bare = decode(Workstream, { ...workstream, nextReviewAt: null, lastMeaningfulProgressAt: null });
    assert.strictEqual(O.isNone(bare.nextReviewAt), true);
    assert.strictEqual(decodeFails(Workstream, { ...workstream, latestEventSequence: -1 }), true);
    assert.strictEqual(decodeFails(Workstream, { ...workstream, status: "closed" }), true);
    const made = Workstream.make({
      workstreamId: "ws-1",
      title: "Launch",
      objective: "Ship v2",
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    assert.strictEqual(made.latestEventSequence, 0);
    assert.strictEqual(made.currentStateSummary, "");
  });

  it("decode events and apply the create defaults", () => {
    const decoded = decode(WorkstreamEvent, event);
    assert.strictEqual(decoded.evidenceRefs[0]?.kind, "conversation");
    assert.strictEqual(decodeFails(WorkstreamEvent, { ...event, sequence: 0 }), true);
    assert.strictEqual(decodeFails(WorkstreamEvent, { ...event, summary: "" }), true);
    assert.strictEqual(decodeFails(WorkstreamEvent, { ...event, evidenceRefs: Array.from({ length: 51 }, () => evidence) }), true);
    const create = WorkstreamEventCreate.make({ kind: "decision", summary: "Go" });
    assert.strictEqual(create.sensitivity, "normal");
    assert.deepStrictEqual(create.evidenceRefs, []);
    assert.strictEqual(
      decode(WorkstreamEventCreate, { kind: "system", summary: "Boot", evidenceRefs: [], sensitivity: "restricted" })
        .sensitivity,
      "restricted",
    );
  });
});

describe("artifacts and checkpoints", () => {
  it("decode the create and stored shapes with their bounds", () => {
    const create = decode(ArtifactDescriptorCreate, { ...artifactCreate, supersedesArtifactId: "art-0", sourceRunId: null });
    assert.strictEqual(O.getOrNull(create.supersedesArtifactId), "art-0");
    assert.strictEqual(O.isNone(create.sourceRunId), true);
    assert.strictEqual(decodeFails(ArtifactDescriptorCreate, { ...artifactCreate, version: 0 }), true);
    assert.strictEqual(decodeFails(ArtifactDescriptorCreate, { ...artifactCreate, contentHash: "short" }), true);
    assert.strictEqual(decodeFails(ArtifactDescriptorCreate, { ...artifactCreate, kind: "x".repeat(65) }), true);
    assert.strictEqual(
      decodeFails(ArtifactDescriptorCreate, {
        ...artifactCreate,
        evidenceEventIds: Array.from({ length: 101 }, (_, index) => `evt-${index}`),
      }),
      true,
    );
    const made = ArtifactDescriptorCreate.make({
      logicalKey: "spec",
      version: 1,
      kind: "document",
      uri: "gs://bucket/spec.md",
      contentHash: "0123456789abcdef",
    });
    assert.deepStrictEqual(made.evidenceEventIds, []);
    const stored = decode(ArtifactDescriptor, artifact);
    assert.strictEqual(stored.status, "approved");
    assert.strictEqual(O.isNone(stored.supersedesArtifactId), true);
    assert.strictEqual(ArtifactDescriptor.make({ ...made, artifactId: "art-1", workstreamId: "ws-1", createdAt: now }).status, "draft");
    assert.strictEqual(decode(ArtifactStatusTransitionRequest, { status: "delivered" }).status, "delivered");
    assert.strictEqual(decodeFails(ArtifactStatusTransitionRequest, { status: "done" }), true);
  });

  it("decode checkpoints", () => {
    const upsert = decode(ContinuationCheckpointUpsert, { ...checkpointUpsert, evidenceRefs: [evidence] });
    assert.strictEqual(upsert.evidenceRefs.length, 1);
    assert.strictEqual(decodeFails(ContinuationCheckpointUpsert, { ...checkpointUpsert, lastEventSequence: -1 }), true);
    assert.strictEqual(
      decodeFails(ContinuationCheckpointUpsert, { ...checkpointUpsert, contextSummary: "x".repeat(4001) }),
      true,
    );
    assert.strictEqual(ContinuationCheckpointUpsert.make({ runtimeId: "rt-1", lastEventSequence: 0, contextSummary: "" }).evidenceRefs.length, 0);
    assert.strictEqual(decode(ContinuationCheckpoint, checkpoint).checkpointId, "cp-1");
    assert.strictEqual(decodeFails(ContinuationCheckpoint, { ...checkpoint, checkpointId: "" }), true);
  });
});

describe("WorkIntentRequest", () => {
  it("decodes the task origin with optional title and objective", () => {
    const decoded = decode(WorkIntentRequest, { origin: "task", taskId: "task-1" });
    assert.strictEqual(decoded.origin, "task");
    assert.strictEqual(WorkIntentRequest.guards.task(decoded), true);
    if (WorkIntentRequest.guards.task(decoded)) {
      assert.strictEqual(O.isNone(decoded.title), true);
      assert.strictEqual(O.isNone(decoded.objective), true);
    }
    const titled = decode(TaskOriginWorkIntent, { origin: "task", taskId: "task-1", title: "Launch", objective: "Ship" });
    assert.strictEqual(O.getOrNull(titled.title), "Launch");
    assert.strictEqual(decodeFails(TaskOriginWorkIntent, { origin: "task", taskId: "task-1", title: null }), true);
    assert.strictEqual(decodeFails(TaskOriginWorkIntent, { origin: "task", taskId: "task-1", title: "x".repeat(257) }), true);
    assert.strictEqual(TaskOriginWorkIntent.make({ taskId: "task-1" }).origin, "task");
  });

  it("decodes the goal origin with every field required", () => {
    const goalIntent = {
      origin: "goal",
      goalId: "goal-1",
      title: "Launch",
      objective: "Ship v2",
      anchorTaskDescription: "Write the launch plan",
    };
    const decoded = decode(WorkIntentRequest, goalIntent);
    assert.strictEqual(decoded.origin, "goal");
    assert.strictEqual(WorkIntentRequest.guards.goal(decoded), true);
    assert.strictEqual(decodeFails(WorkIntentRequest, { origin: "goal", goalId: "goal-1" }), true);
    assert.strictEqual(decodeFails(GoalOriginWorkIntent, { ...goalIntent, anchorTaskDescription: "" }), true);
    assert.strictEqual(decodeFails(WorkIntentRequest, { origin: "memory", goalId: "goal-1" }), true);
    assert.strictEqual(
      WorkIntentRequest.match(decoded, { task: () => "task", goal: (intent) => intent.anchorTaskDescription }),
      "Write the launch plan",
    );
  });

  it("decodes the flat receipt", () => {
    const receipt = { receiptId: "rcpt-1", workstreamId: "ws-1", taskId: "task-1", newlyCreated: true, createdAt: at };
    assert.strictEqual(O.isNone(decode(WorkIntentReceipt, receipt).goalId), true);
    assert.strictEqual(O.isNone(decode(WorkIntentReceipt, { ...receipt, goalId: null }).goalId), true);
    assert.strictEqual(O.getOrNull(decode(WorkIntentReceipt, { ...receipt, goalId: "goal-1" }).goalId), "goal-1");
    assert.strictEqual(decodeFails(WorkIntentReceipt, { ...receipt, taskId: undefined }), true);
  });
});

describe("projections and imports", () => {
  it("decode the goal and workstream detail projections", () => {
    const goalDetail = decode(GoalDetailProjection, {
      goal,
      activeThreads: [workstream],
      tasks: [task],
      progressEvents: [progressEvent],
    });
    assert.strictEqual(goalDetail.goal.goalId, "goal-1");
    assert.strictEqual(goalDetail.activeThreads[0]?.workstreamId, "ws-1");
    assert.strictEqual(goalDetail.tasks[0]?.id, "task-1");
    assert.strictEqual(goalDetail.progressEvents[0]?.kind, "milestone");
    const detail = decode(WorkstreamDetailProjection, {
      workstream,
      recentEvents: [event],
      tasks: [task],
      artifacts: [artifact],
      checkpoints: [checkpoint],
    });
    assert.strictEqual(detail.recentEvents[0]?.eventId, "evt-1");
    assert.strictEqual(detail.artifacts[0]?.artifactId, "art-1");
    assert.strictEqual(detail.checkpoints[0]?.checkpointId, "cp-1");
    assert.strictEqual(decodeFails(WorkstreamDetailProjection, { workstream, recentEvents: [], tasks: [], artifacts: [] }), true);
  });

  it("decode the link import request and report", () => {
    const link = { taskId: "task-1", goalId: "goal-1" };
    assert.strictEqual(decode(TaskGoalLinkImport, link).goalId, "goal-1");
    assert.strictEqual(decode(TaskGoalLinkImportRequest, { links: [link] }).links.length, 1);
    assert.strictEqual(decode(TaskGoalLinkImportRequest, { links: [] }).links.length, 0);
    assert.strictEqual(
      decodeFails(TaskGoalLinkImportRequest, { links: Array.from({ length: 501 }, () => link) }),
      true,
    );
    const report = decode(TaskGoalLinkImportReport, {
      imported: 1,
      unchanged: 2,
      failed: 1,
      failureTaskIds: ["task-9"],
      extra: "tolerated",
    });
    assert.deepStrictEqual(report.failureTaskIds, ["task-9"]);
    assert.strictEqual(decodeFails(TaskGoalLinkImportReport, { imported: 1, unchanged: 2, failed: 1 }), true);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      WorkstreamStatus,
      WorkstreamEventKind,
      WorkstreamSensitivity,
      ArtifactStatus,
      WorkstreamCreate,
      WorkstreamUpdate,
      WorkstreamUpdateChecked,
      Workstream,
      WorkstreamEventCreate,
      WorkstreamEvent,
      ArtifactDescriptorCreate,
      ArtifactDescriptor,
      ArtifactStatusTransitionRequest,
      ContinuationCheckpointUpsert,
      ContinuationCheckpoint,
      TaskOriginWorkIntent,
      GoalOriginWorkIntent,
      WorkIntentRequest,
      WorkIntentReceipt,
      GoalDetailProjection,
      WorkstreamDetailProjection,
      TaskGoalLinkImport,
      TaskGoalLinkImportRequest,
      TaskGoalLinkImportReport,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
