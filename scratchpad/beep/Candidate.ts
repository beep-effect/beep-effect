/**
 * Universal candidate lifecycle for task and workstream proposals.
 *
 * **Details**
 *
 * `CandidateCreate` nests `subjectKind`, then `proposedAction` for tasks.
 * `CandidateRecord` stays the flat stored shape with optional arms.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { EvidenceRefChecked, TaskChangePayload, TaskCreatePayload, type TaskStatus } from "./ActionItem.ts";
import {
  Model,
  NonNegativeInt,
  StableId,
  boundedText,
  confidence,
  nonNegativeInt,
  nonNegativeIntCheck,
  optionalBoundedText,
  optionalNull,
  optionalStableId,
  optionalText,
  optionalTimestamp,
  pg,
  stableId,
  stableIdCheck,
  textBoundsCheck,
  timestamp,
  unitIntervalCheck,
} from "./Kit.ts";

const decodeStableId = S.decodeUnknownEffect(StableId);
const decodeNonNegativeInt = S.decodeUnknownEffect(NonNegativeInt);
const decodeDateTimeUtcFromString = S.decodeUnknownEffect(S.DateTimeUtcFromString);
const isTaskCreatePayload = S.is(TaskCreatePayload);
const encodeTaskCreatePayload = S.encodeEffect(TaskCreatePayload);
const encodeTaskChangePayload = S.encodeEffect(TaskChangePayload);
const encodeEvidenceRefCheckedArray = S.encodeEffect(S.Array(EvidenceRefChecked));

const $I = $ScratchpadId.create("beep/Candidate");

const completed: TaskStatus = "completed";
const cancelled: TaskStatus = "cancelled";
const superseded: TaskStatus = "superseded";

/**
 * What a candidate proposes to change.
 *
 * **Example** (Decode a task subject)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CandidateSubjectKind } from "@beep/scratchpad/beep/Candidate"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CandidateSubjectKind)("task"))
 * console.log(decoded) // "task"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateSubjectKind = LiteralKit(["task", "workstream"]).pipe(
  $I.annoteSchema("CandidateSubjectKind", { description: "Candidate subject: task or workstream." }),
);

/**
 * Decoded candidate subject.
 *
 * @see {@link CandidateSubjectKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type CandidateSubjectKind = typeof CandidateSubjectKind.Type;

/**
 * Proposed candidate action.
 *
 * **Example** (Decode supersede)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CandidateAction } from "@beep/scratchpad/beep/Candidate"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CandidateAction)("supersede"))
 * console.log(decoded) // "supersede"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAction = LiteralKit(["create", "update", "complete", "cancel", "supersede"]).pipe(
  $I.annoteSchema("CandidateAction", {
    description: "Candidate action: create, update, complete, cancel, or supersede.",
  }),
);

/**
 * Decoded candidate action.
 *
 * @see {@link CandidateAction} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type CandidateAction = typeof CandidateAction.Type;

/**
 * Lifecycle status of a stored candidate.
 *
 * **Example** (Decode pending)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CandidateStatus } from "@beep/scratchpad/beep/Candidate"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CandidateStatus)("pending"))
 * console.log(decoded) // "pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateStatus = LiteralKit(["pending", "accepted", "rejected", "expired"]).pipe(
  $I.annoteSchema("CandidateStatus", {
    description: "Stored candidate status: pending, accepted, rejected, or expired.",
  }),
);

/**
 * Decoded candidate status.
 *
 * @see {@link CandidateStatus} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type CandidateStatus = typeof CandidateStatus.Type;

const decodeCandidateStatus = S.decodeUnknownEffect(CandidateStatus);

/**
 * Task-intelligence workflow mode copied onto a migration report.
 *
 * **Details**
 *
 * The enum lives in `task_intelligence.py`. Wire values are `off`, `shadow`,
 * `write`, and `read`.
 *
 * **Example** (Decode shadow mode)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskWorkflowMode } from "@beep/scratchpad/beep/Candidate"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskWorkflowMode)("shadow"))
 * console.log(decoded) // "shadow"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskWorkflowMode = LiteralKit(["off", "shadow", "write", "read"]).pipe(
  $I.annoteSchema("TaskWorkflowMode", {
    description: "Task-intelligence workflow mode: off, shadow, write, or read.",
  }),
);

/**
 * Decoded workflow mode.
 *
 * @see {@link TaskWorkflowMode} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskWorkflowMode = typeof TaskWorkflowMode.Type;

const relevance = S.Int.check(S.isBetween({ minimum: 0, maximum: 1000 }));
const migrationLimit = S.Int.check(S.isBetween({ minimum: 1, maximum: 500 }));

/**
 * Workstream a candidate wants to create, including its anchor task.
 *
 * **Example** (Name a proposal)
 *
 * ```ts
 * import { TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 * import { WorkstreamProposal } from "@beep/scratchpad/beep/Candidate"
 *
 * const proposal = WorkstreamProposal.make({
 *   title: "Launch",
 *   objective: "Ship the note",
 *   anchorTask: TaskCreatePayload.make({ description: "Write the note" }),
 * })
 * console.log(proposal.title) // "Launch"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamProposal extends Model<WorkstreamProposal>("WorkstreamProposal")(
  {
    title: boundedText("title", { minLength: 1, maxLength: 256 }),
    objective: boundedText("objective", { minLength: 1, maxLength: 2048 }),
    anchorTask: TaskCreatePayload.pipe(pg.jsonb(), pg.columnName("anchor_task")),
  },
  $I.annote("WorkstreamProposal", { description: "Proposed workstream title, objective, and anchor task." }),
  (columns) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
  ],
) {}

/**
 * Encoded form of {@link WorkstreamProposal}.
 *
 * @see {@link WorkstreamProposal} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkstreamProposal {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamProposal>;
}

const encodeWorkstreamProposal = S.encodeEffect(WorkstreamProposal);

/**
 * Presentation fields kept outside the strict task payload.
 *
 * **Example** (Score a staged task)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { CandidateCompatibilityMetadata } from "@beep/scratchpad/beep/Candidate"
 *
 * const metadata = CandidateCompatibilityMetadata.make({ relevanceScore: O.some(10) })
 * console.log(O.getOrNull(metadata.relevanceScore)) // 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateCompatibilityMetadata extends Model<CandidateCompatibilityMetadata>(
  "CandidateCompatibilityMetadata",
)(
  {
    metadata: optionalText("metadata"),
    category: optionalText("category"),
    relevanceScore: optionalNull(relevance).pipe(pg.integer(), pg.columnName("relevance_score")),
  },
  $I.annote("CandidateCompatibilityMetadata", {
    description: "Released-client presentation fields kept outside the canonical task payload.",
  }),
  (columns) => [
    pg.Table.check("relevance_score_between")(
      sql<boolean>`${columns.relevanceScore} >= 0 and ${columns.relevanceScore} <= 1000`,
    ),
  ],
) {}

/**
 * Encoded form of {@link CandidateCompatibilityMetadata}.
 *
 * @see {@link CandidateCompatibilityMetadata} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateCompatibilityMetadata {
  export type Encoded = S.Codec.Encoded<typeof CandidateCompatibilityMetadata>;
}

const encodeCandidateCompatibilityMetadata = S.encodeEffect(CandidateCompatibilityMetadata);

const evidenceRefs = S.Array(EvidenceRefChecked)
  .check(S.isMinLength(1))
  .pipe(pg.jsonb(), pg.columnName("evidence_refs"));

const envelope = {
  captureConfidence: confidence("capture_confidence"),
  ownershipConfidence: confidence("ownership_confidence"),
  goalId: optionalStableId("goal_id"),
  workstreamId: optionalStableId("workstream_id"),
  evidenceRefs,
  sourceSurface: boundedText("source_surface", { minLength: 1, maxLength: 64 }),
  compatibility: optionalNull(CandidateCompatibilityMetadata).pipe(pg.jsonb(), pg.columnName("compatibility")),
};

const taskTag = S.tag("task").pipe(pg.text(), pg.columnName("subject_kind"));
const workstreamTag = S.tag("workstream").pipe(pg.text(), pg.columnName("subject_kind"));
const actionTag = (value: CandidateAction) => S.tag(value).pipe(pg.text(), pg.columnName("proposed_action"));

/**
 * Proposal to create a task. There is no `taskId`.
 *
 * **Example** (Create a task candidate)
 *
 * ```ts
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 * import { TaskCreateCandidate } from "@beep/scratchpad/beep/Candidate"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 0.5,
 *   ownershipConfidence: 0.5,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(candidate.proposedAction) // "create"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskCreateCandidate extends Model<TaskCreateCandidate>("TaskCreateCandidate")(
  {
    ...envelope,
    subjectKind: taskTag,
    proposedAction: actionTag("create"),
    taskChange: TaskCreatePayload.pipe(pg.jsonb(), pg.columnName("task_change")),
  },
  $I.annote("TaskCreateCandidate", { description: "Candidate that creates a Workflow task." }),
  (columns) => [
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    unitIntervalCheck("ownership_confidence")(columns.ownershipConfidence),
    stableIdCheck("goal_id")(columns.goalId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    textBoundsCheck("source_surface", { minLength: 1, maxLength: 64 })(columns.sourceSurface),
  ],
) {}

/**
 * Encoded form of {@link TaskCreateCandidate}.
 *
 * @see {@link TaskCreateCandidate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskCreateCandidate {
  export type Encoded = S.Codec.Encoded<typeof TaskCreateCandidate>;
}

/**
 * Proposal to update an existing task.
 *
 * **Example** (Name the task)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { EvidenceRef, TaskChangePayload } from "@beep/scratchpad/beep/ActionItem"
 * import { TaskUpdateCandidate } from "@beep/scratchpad/beep/Candidate"
 *
 * const candidate = TaskUpdateCandidate.make({
 *   captureConfidence: 0.5,
 *   ownershipConfidence: 0.5,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskId: "task-1",
 *   taskChange: TaskChangePayload.make({ description: O.some("Call tomorrow") }),
 * })
 * console.log(candidate.taskId) // "task-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskUpdateCandidate extends Model<TaskUpdateCandidate>("TaskUpdateCandidate")(
  {
    ...envelope,
    subjectKind: taskTag,
    proposedAction: actionTag("update"),
    taskId: stableId("task_id"),
    taskChange: TaskChangePayload.pipe(pg.jsonb(), pg.columnName("task_change")),
  },
  $I.annote("TaskUpdateCandidate", { description: "Candidate that updates a Workflow task." }),
  (columns) => [
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    unitIntervalCheck("ownership_confidence")(columns.ownershipConfidence),
    stableIdCheck("goal_id")(columns.goalId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("task_id")(columns.taskId),
    textBoundsCheck("source_surface", { minLength: 1, maxLength: 64 })(columns.sourceSurface),
  ],
) {}

/**
 * Encoded form of {@link TaskUpdateCandidate}.
 *
 * @see {@link TaskUpdateCandidate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskUpdateCandidate {
  export type Encoded = S.Codec.Encoded<typeof TaskUpdateCandidate>;
}

const isTaskUpdateCandidate = S.is(TaskUpdateCandidate);

/**
 * Proposal to complete an existing task. Status must be `completed`.
 *
 * **Example** (Require completed status)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { EvidenceRef, TaskChangePayload, TaskStatus } from "@beep/scratchpad/beep/ActionItem"
 * import { TaskCompleteCandidate } from "@beep/scratchpad/beep/Candidate"
 *
 * const candidate = TaskCompleteCandidate.make({
 *   captureConfidence: 0.5,
 *   ownershipConfidence: 0.5,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskId: "task-1",
 *   taskChange: TaskChangePayload.make({ status: O.some(TaskStatus.Enum.completed) }),
 * })
 * console.log(candidate.proposedAction) // "complete"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskCompleteCandidate extends Model<TaskCompleteCandidate>("TaskCompleteCandidate")(
  {
    ...envelope,
    subjectKind: taskTag,
    proposedAction: actionTag("complete"),
    taskId: stableId("task_id"),
    taskChange: TaskChangePayload.pipe(pg.jsonb(), pg.columnName("task_change")),
  },
  $I.annote("TaskCompleteCandidate", { description: "Candidate that completes a Workflow task." }),
  (columns) => [
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    stableIdCheck("task_id")(columns.taskId),
    textBoundsCheck("source_surface", { minLength: 1, maxLength: 64 })(columns.sourceSurface),
  ],
) {}

/**
 * Encoded form of {@link TaskCompleteCandidate}.
 *
 * @see {@link TaskCompleteCandidate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskCompleteCandidate {
  export type Encoded = S.Codec.Encoded<typeof TaskCompleteCandidate>;
}

const isTaskCompleteCandidate = S.is(TaskCompleteCandidate);

/**
 * Proposal to cancel an existing task. Status must be `cancelled`.
 *
 * **Example** (Cancel a task)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { EvidenceRef, TaskChangePayload, TaskStatus } from "@beep/scratchpad/beep/ActionItem"
 * import { TaskCancelCandidate } from "@beep/scratchpad/beep/Candidate"
 *
 * const candidate = TaskCancelCandidate.make({
 *   captureConfidence: 0.5,
 *   ownershipConfidence: 0.5,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskId: "task-1",
 *   taskChange: TaskChangePayload.make({ status: O.some(TaskStatus.Enum.cancelled) }),
 * })
 * console.log(candidate.proposedAction) // "cancel"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskCancelCandidate extends Model<TaskCancelCandidate>("TaskCancelCandidate")(
  {
    ...envelope,
    subjectKind: taskTag,
    proposedAction: actionTag("cancel"),
    taskId: stableId("task_id"),
    taskChange: TaskChangePayload.pipe(pg.jsonb(), pg.columnName("task_change")),
  },
  $I.annote("TaskCancelCandidate", { description: "Candidate that cancels a Workflow task." }),
  (columns) => [
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    stableIdCheck("task_id")(columns.taskId),
    textBoundsCheck("source_surface", { minLength: 1, maxLength: 64 })(columns.sourceSurface),
  ],
) {}

/**
 * Encoded form of {@link TaskCancelCandidate}.
 *
 * @see {@link TaskCancelCandidate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskCancelCandidate {
  export type Encoded = S.Codec.Encoded<typeof TaskCancelCandidate>;
}

const isTaskCancelCandidate = S.is(TaskCancelCandidate);

/**
 * Proposal to supersede an existing task.
 *
 * **Details**
 *
 * Status must be `superseded` and `supersededBy` must be present.
 *
 * **Example** (Point at the replacement)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { EvidenceRef, TaskChangePayload, TaskStatus } from "@beep/scratchpad/beep/ActionItem"
 * import { TaskSupersedeCandidate } from "@beep/scratchpad/beep/Candidate"
 *
 * const candidate = TaskSupersedeCandidate.make({
 *   captureConfidence: 0.5,
 *   ownershipConfidence: 0.5,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskId: "task-1",
 *   taskChange: TaskChangePayload.make({
 *     status: O.some(TaskStatus.Enum.superseded),
 *     supersededBy: O.some("task-2"),
 *   }),
 * })
 * console.log(candidate.taskId) // "task-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskSupersedeCandidate extends Model<TaskSupersedeCandidate>("TaskSupersedeCandidate")(
  {
    ...envelope,
    subjectKind: taskTag,
    proposedAction: actionTag("supersede"),
    taskId: stableId("task_id"),
    taskChange: TaskChangePayload.pipe(pg.jsonb(), pg.columnName("task_change")),
  },
  $I.annote("TaskSupersedeCandidate", { description: "Candidate that supersedes a Workflow task." }),
  (columns) => [
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    stableIdCheck("task_id")(columns.taskId),
    textBoundsCheck("source_surface", { minLength: 1, maxLength: 64 })(columns.sourceSurface),
  ],
) {}

/**
 * Encoded form of {@link TaskSupersedeCandidate}.
 *
 * @see {@link TaskSupersedeCandidate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskSupersedeCandidate {
  export type Encoded = S.Codec.Encoded<typeof TaskSupersedeCandidate>;
}

const isTaskSupersedeCandidate = S.is(TaskSupersedeCandidate);

/**
 * Proposal to create a workstream.
 *
 * **Example** (Create a workstream candidate)
 *
 * ```ts
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 * import { WorkstreamCreateCandidate, WorkstreamProposal } from "@beep/scratchpad/beep/Candidate"
 *
 * const candidate = WorkstreamCreateCandidate.make({
 *   captureConfidence: 0.5,
 *   ownershipConfidence: 0.5,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   workstreamProposal: WorkstreamProposal.make({
 *     title: "Launch",
 *     objective: "Ship the note",
 *     anchorTask: TaskCreatePayload.make({ description: "Write the note" }),
 *   }),
 * })
 * console.log(candidate.subjectKind) // "workstream"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamCreateCandidate extends Model<WorkstreamCreateCandidate>("WorkstreamCreateCandidate")(
  {
    ...envelope,
    subjectKind: workstreamTag,
    proposedAction: actionTag("create"),
    workstreamProposal: WorkstreamProposal.pipe(pg.jsonb(), pg.columnName("workstream_proposal")),
  },
  $I.annote("WorkstreamCreateCandidate", { description: "Candidate that creates a workstream." }),
  (columns) => [
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    unitIntervalCheck("ownership_confidence")(columns.ownershipConfidence),
    textBoundsCheck("source_surface", { minLength: 1, maxLength: 64 })(columns.sourceSurface),
  ],
) {}

/**
 * Encoded form of {@link WorkstreamCreateCandidate}.
 *
 * @see {@link WorkstreamCreateCandidate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkstreamCreateCandidate {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamCreateCandidate>;
}

const changeHasField = (change: TaskChangePayload): boolean =>
  O.isSome(change.description) ||
  O.isSome(change.status) ||
  O.isSome(change.owner) ||
  O.isSome(change.dueAt) ||
  O.isSome(change.dueConfidence) ||
  O.isSome(change.priority) ||
  O.isSome(change.recurrenceRule) ||
  O.isSome(change.recurrenceParentId) ||
  O.isSome(change.supersededBy);

const nonEmptyChange = <A extends { readonly taskChange: TaskChangePayload }>() =>
  S.makeFilter((arm: A) => (changeHasField(arm.taskChange) ? undefined : "task change requires at least one field"));

const statusIs = <A extends { readonly taskChange: TaskChangePayload }>(expected: TaskStatus, message: string) =>
  S.makeFilter((arm: A) => {
    if (O.isNone(arm.taskChange.status) || arm.taskChange.status.value !== expected) return message;
    return undefined;
  });

/**
 * Task candidates, split by `proposedAction`.
 *
 * **Details**
 *
 * Create carries {@link TaskCreatePayload} and no task id. The other arms carry
 * {@link TaskChangePayload} and a task id. Complete, cancel, and supersede add
 * status constraints. Supersede also requires `supersededBy`.
 *
 * **Gotchas**
 *
 * `subjectKind` is `task` on every arm, so this union is tagged by
 * `proposedAction`. Nesting it under another `subjectKind` union makes Effect
 * see duplicate `task` sentinels, so the outer union is {@link CandidateCreate}.
 *
 * **Example** (Decode an update)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskCandidate } from "@beep/scratchpad/beep/Candidate"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(TaskCandidate)({
 *     subjectKind: "task",
 *     proposedAction: "update",
 *     captureConfidence: 0.5,
 *     ownershipConfidence: 0.5,
 *     evidenceRefs: [{ kind: "conversation", id: "conv-1", scope: "canonical" }],
 *     sourceSurface: "chat",
 *     taskId: "task-1",
 *     taskChange: { description: "Call tomorrow" },
 *   }),
 * )
 * console.log(decoded.proposedAction) // "update"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskCandidate = LiteralKit(["create", "update", "complete", "cancel", "supersede"])
  .mapMembers(
    Tuple.evolve([
      () => TaskCreateCandidate,
      () => TaskUpdateCandidate.check(nonEmptyChange<TaskUpdateCandidate>()),
      () =>
        TaskCompleteCandidate.check(
          nonEmptyChange<TaskCompleteCandidate>(),
          statusIs<TaskCompleteCandidate>(completed, "complete Candidate requires status=completed"),
        ),
      () =>
        TaskCancelCandidate.check(
          nonEmptyChange<TaskCancelCandidate>(),
          statusIs<TaskCancelCandidate>(cancelled, "cancel Candidate requires status=cancelled"),
        ),
      () =>
        TaskSupersedeCandidate.check(
          nonEmptyChange<TaskSupersedeCandidate>(),
          statusIs<TaskSupersedeCandidate>(superseded, "supersede Candidate requires status=superseded"),
          S.makeFilter((arm: TaskSupersedeCandidate) =>
            O.isNone(arm.taskChange.supersededBy) ? "supersede Candidate requires superseded_by" : undefined,
          ),
        ),
    ]),
  )
  .pipe(
    S.toTaggedUnion("proposedAction"),
    $I.annoteSchema("TaskCandidate", { description: "Task candidate tagged by the proposed action." }),
  );

/**
 * Decoded task candidate.
 *
 * @see {@link TaskCandidate} for the runtime union.
 * @category type-level
 * @since 0.0.0
 */
export type TaskCandidate = typeof TaskCandidate.Type;

/**
 * Nested candidate create union.
 *
 * **Details**
 *
 * Workstream create is its own arm. Task arms are {@link TaskCandidate}. Effect
 * cannot tag the outer union by `subjectKind` because every task arm already
 * carries that sentinel, so this is a plain union. Decode still selects the
 * task arm by `proposedAction`.
 *
 * **Example** (Decode a workstream create)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CandidateCreate } from "@beep/scratchpad/beep/Candidate"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(CandidateCreate)({
 *     subjectKind: "workstream",
 *     proposedAction: "create",
 *     captureConfidence: 0.4,
 *     ownershipConfidence: 0.4,
 *     evidenceRefs: [{ kind: "conversation", id: "conv-1", scope: "canonical" }],
 *     sourceSurface: "chat",
 *     workstreamProposal: {
 *       title: "Launch",
 *       objective: "Ship the note",
 *       anchorTask: { description: "Write the note", owner: "unknown" },
 *     },
 *   }),
 * )
 * console.log(decoded.subjectKind) // "workstream"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateCreate = S.Union([TaskCandidate, WorkstreamCreateCandidate]).pipe(
  $I.annoteSchema("CandidateCreate", {
    description: "Candidate create payload. subjectKind selects task or workstream, then proposedAction.",
  }),
);

/**
 * Decoded candidate create payload.
 *
 * @see {@link CandidateCreate} for the runtime union.
 * @category type-level
 * @since 0.0.0
 */
export type CandidateCreate = typeof CandidateCreate.Type;

const decodeCandidateCreate = S.decodeUnknownEffect(CandidateCreate);

/**
 * Subject of a create payload.
 *
 * **Example** (Read a task subject)
 *
 * ```ts
 * import { TaskCreateCandidate, candidateSubjectKind } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(candidateSubjectKind(candidate)) // "task"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateSubjectKind = (candidate: CandidateCreate): CandidateSubjectKind => candidate.subjectKind;

/**
 * Proposed action of a create payload.
 *
 * **Example** (Read create)
 *
 * ```ts
 * import { TaskCreateCandidate, candidateProposedAction } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(candidateProposedAction(candidate)) // "create"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateProposedAction = (candidate: CandidateCreate): CandidateAction => candidate.proposedAction;

/**
 * Task id for a mutation, or none for create.
 *
 * **Example** (Create has no task id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskCreateCandidate, candidateTaskId } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(O.isNone(candidateTaskId(candidate))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateTaskId = (candidate: CandidateCreate): O.Option<string> => {
  if (isTaskUpdateCandidate(candidate)) return O.some(candidate.taskId);
  if (isTaskCompleteCandidate(candidate)) return O.some(candidate.taskId);
  if (isTaskCancelCandidate(candidate)) return O.some(candidate.taskId);
  if (isTaskSupersedeCandidate(candidate)) return O.some(candidate.taskId);
  return O.none();
};

/**
 * Task payload for a task candidate, or none for a workstream.
 *
 * **Example** (Read a create description)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskCreateCandidate, candidateTaskChange } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * const change = candidateTaskChange(candidate)
 * console.log(O.isSome(change) && change.value.description) // "Call back"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateTaskChange = (
  candidate: CandidateCreate,
): O.Option<TaskCreatePayload | TaskChangePayload> => {
  if (candidate.subjectKind === "workstream") return O.none();
  return O.some(candidate.taskChange);
};

/**
 * Workstream proposal, or none for a task candidate.
 *
 * **Example** (Task create has no workstream)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskCreateCandidate, candidateWorkstreamProposal } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(O.isNone(candidateWorkstreamProposal(candidate))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateWorkstreamProposal = (candidate: CandidateCreate): O.Option<WorkstreamProposal> =>
  candidate.subjectKind === "workstream" ? O.some(candidate.workstreamProposal) : O.none();

/**
 * Capture confidence shared by every create arm.
 *
 * **Example** (Read capture confidence)
 *
 * ```ts
 * import { TaskCreateCandidate, candidateCaptureConfidence } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 0.25,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(candidateCaptureConfidence(candidate)) // 0.25
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateCaptureConfidence = (candidate: CandidateCreate): number => candidate.captureConfidence;

/**
 * Ownership confidence shared by every create arm.
 *
 * **Example** (Read ownership confidence)
 *
 * ```ts
 * import { TaskCreateCandidate, candidateOwnershipConfidence } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 0.75,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(candidateOwnershipConfidence(candidate)) // 0.75
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateOwnershipConfidence = (candidate: CandidateCreate): number => candidate.ownershipConfidence;

/**
 * Optional goal id shared by every create arm.
 *
 * **Example** (Missing goal)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskCreateCandidate, candidateGoalId } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(O.isNone(candidateGoalId(candidate))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateGoalId = (candidate: CandidateCreate): O.Option<string> => candidate.goalId;

/**
 * Optional workstream id shared by every create arm.
 *
 * **Example** (Missing workstream id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskCreateCandidate, candidateWorkstreamId } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(O.isNone(candidateWorkstreamId(candidate))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateWorkstreamId = (candidate: CandidateCreate): O.Option<string> => candidate.workstreamId;

/**
 * Evidence refs shared by every create arm.
 *
 * **Example** (Read the first ref)
 *
 * ```ts
 * import { TaskCreateCandidate, candidateEvidenceRefs } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(candidateEvidenceRefs(candidate)[0]?.id) // "conv-1"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateEvidenceRefs = (candidate: CandidateCreate) => candidate.evidenceRefs;

/**
 * Source surface shared by every create arm.
 *
 * **Example** (Read the surface)
 *
 * ```ts
 * import { TaskCreateCandidate, candidateSourceSurface } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(candidateSourceSurface(candidate)) // "chat"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateSourceSurface = (candidate: CandidateCreate): string => candidate.sourceSurface;

/**
 * Optional compatibility metadata shared by every create arm.
 *
 * **Example** (Missing compatibility)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskCreateCandidate, candidateCompatibility } from "@beep/scratchpad/beep/Candidate"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const candidate = TaskCreateCandidate.make({
 *   captureConfidence: 1,
 *   ownershipConfidence: 1,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: TaskCreatePayload.make({ description: "Call back" }),
 * })
 * console.log(O.isNone(candidateCompatibility(candidate))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const candidateCompatibility = (
  candidate: CandidateCreate,
): O.Option<CandidateCompatibilityMetadata> => candidate.compatibility;

/**
 * Renames a generated `anyOf` create schema to `oneOf`.
 *
 * **Details**
 *
 * Python's schema hook does this so clients treat the arms as exclusive.
 * A schema without `anyOf` is returned unchanged.
 *
 * **Example** (Rename anyOf)
 *
 * ```ts
 * import { candidateCreateJsonSchema } from "@beep/scratchpad/beep/Candidate"
 *
 * const schema = candidateCreateJsonSchema({ anyOf: [{ type: "object" }] })
 * console.log("oneOf" in schema) // true
 * console.log("anyOf" in schema) // false
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const candidateCreateJsonSchema = (schema: {
  readonly anyOf?: S.Json;
  readonly [key: string]: S.Json | undefined;
}) => {
  if (schema.anyOf === undefined) return schema;
  const { anyOf, ...rest } = schema;
  return { ...rest, oneOf: anyOf };
};

const taskChangeField = optionalNull(S.Union([TaskCreatePayload, TaskChangePayload])).pipe(
  pg.jsonb(),
  pg.columnName("task_change"),
);

/**
 * Flat stored candidate. Arms are optional and rechecked through {@link CandidateCreate}.
 *
 * **Details**
 *
 * Pending records cannot carry a resolution time or reason. A non-pending
 * record requires `resolvedAt`. An accepted task requires `resultTaskId`. An
 * accepted workstream requires `resultWorkstreamId`.
 *
 * **Gotchas**
 *
 * Direct construction does not re-parse the arm. Use {@link candidateRecordFromStorage}
 * for a stored dict. {@link candidateResolutionIssue} states the lifecycle rule.
 *
 * **Example** (Construct a pending create)
 *
 * ```ts
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { CandidateRecord } from "@beep/scratchpad/beep/Candidate"
 *
 * const record = CandidateRecord.make({
 *   candidateId: "cand-1",
 *   subjectKind: "task",
 *   proposedAction: "create",
 *   accountGeneration: 0,
 *   idempotencyKey: "once",
 *   captureConfidence: 0.5,
 *   ownershipConfidence: 0.5,
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *   sourceSurface: "chat",
 *   taskChange: O.some(TaskCreatePayload.make({ description: "Call back" })),
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(record.status) // "pending"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateRecord extends Model<CandidateRecord>("CandidateRecord")(
  {
    candidateId: stableId("candidate_id"),
    subjectKind: CandidateSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    proposedAction: CandidateAction.pipe(pg.text(), pg.columnName("proposed_action")),
    taskId: optionalStableId("task_id"),
    taskChange: taskChangeField,
    workstreamProposal: optionalNull(WorkstreamProposal).pipe(pg.jsonb(), pg.columnName("workstream_proposal")),
    captureConfidence: confidence("capture_confidence"),
    ownershipConfidence: confidence("ownership_confidence"),
    goalId: optionalStableId("goal_id"),
    workstreamId: optionalStableId("workstream_id"),
    evidenceRefs,
    sourceSurface: boundedText("source_surface", { minLength: 1, maxLength: 64 }),
    compatibility: optionalNull(CandidateCompatibilityMetadata).pipe(pg.jsonb(), pg.columnName("compatibility")),
    status: CandidateStatus.pipe(
      S.withConstructorDefault(Effect.succeed<CandidateStatus>("pending")),
      pg.text(),
      pg.columnName("status"),
    ),
    accountGeneration: nonNegativeInt("account_generation"),
    idempotencyKey: stableId("idempotency_key"),
    resolutionReason: optionalBoundedText("resolution_reason", { maxLength: 64 }),
    resultTaskId: optionalStableId("result_task_id"),
    resultWorkstreamId: optionalStableId("result_workstream_id"),
    createdAt: timestamp("created_at"),
    resolvedAt: optionalTimestamp("resolved_at"),
    expiresAt: optionalTimestamp("expires_at"),
  },
  $I.annote("CandidateRecord", {
    description: "Flat stored candidate. Proposal arms are optional and rechecked as CandidateCreate.",
  }),
  (columns) => [
    stableIdCheck("candidate_id")(columns.candidateId),
    stableIdCheck("task_id")(columns.taskId),
    stableIdCheck("idempotency_key")(columns.idempotencyKey),
    stableIdCheck("goal_id")(columns.goalId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("result_task_id")(columns.resultTaskId),
    stableIdCheck("result_workstream_id")(columns.resultWorkstreamId),
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    unitIntervalCheck("ownership_confidence")(columns.ownershipConfidence),
    textBoundsCheck("source_surface", { minLength: 1, maxLength: 64 })(columns.sourceSurface),
    textBoundsCheck("resolution_reason", { maxLength: 64 })(columns.resolutionReason),
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
  ],
) {}

/**
 * Encoded form of {@link CandidateRecord}.
 *
 * @see {@link CandidateRecord} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateRecord {
  export type Encoded = S.Codec.Encoded<typeof CandidateRecord>;
}

/**
 * Why a stored candidate's resolution fields disagree with its status.
 *
 * **Example** (Pending cannot be resolved)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 * import { CandidateRecord, candidateResolutionIssue } from "@beep/scratchpad/beep/Candidate"
 *
 * const issue = candidateResolutionIssue(
 *   CandidateRecord.make({
 *     candidateId: "cand-1",
 *     subjectKind: "task",
 *     proposedAction: "create",
 *     accountGeneration: 0,
 *     idempotencyKey: "once",
 *     captureConfidence: 0.5,
 *     ownershipConfidence: 0.5,
 *     evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *     sourceSurface: "chat",
 *     taskChange: O.some(TaskCreatePayload.make({ description: "Call back" })),
 *     createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *     resolvedAt: O.some(DateTime.makeUnsafe("2020-01-03T03:04:05.000Z")),
 *   }),
 * )
 * console.log(O.isSome(issue)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const candidateResolutionIssue = (record: CandidateRecord): O.Option<string> => {
  if (record.status === "pending") {
    if (O.isSome(record.resolvedAt) || O.isSome(record.resolutionReason)) {
      return O.some("pending Candidate cannot have resolution metadata");
    }
    return O.none();
  }
  if (O.isNone(record.resolvedAt)) return O.some("resolved Candidate requires resolved_at");
  if (record.status === "accepted" && record.subjectKind === "task" && O.isNone(record.resultTaskId)) {
    return O.some("accepted task Candidate requires result_task_id");
  }
  if (record.status === "accepted" && record.subjectKind === "workstream" && O.isNone(record.resultWorkstreamId)) {
    return O.some("accepted workstream Candidate requires result_workstream_id");
  }
  return O.none();
};

/**
 * A stored candidate dict did not match a create arm or a resolution rule.
 *
 * **Example** (Name the failure)
 *
 * ```ts
 * import { CandidateShapeError } from "@beep/scratchpad/beep/Candidate"
 *
 * const error = CandidateShapeError.make({ message: "pending Candidate cannot include resolution" })
 * console.log(error.message) // "pending Candidate cannot include resolution"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CandidateShapeError extends S.TaggedError<CandidateShapeError>()(
  "CandidateShapeError",
  { message: S.String },
  $I.annoteError<CandidateShapeError>("CandidateShapeError", {
    description: "A stored candidate did not match a create arm or a resolution rule.",
  }),
) {}

/**
 * Encoded form of {@link CandidateShapeError}.
 *
 * @see {@link CandidateShapeError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateShapeError {
  export type Encoded = S.Codec.Encoded<typeof CandidateShapeError>;
}

const omitNull = (value: unknown): unknown => (value === null ? undefined : value);

const optionalReason = optionalNull(S.String.check(S.isMaxLength(64)));
const optionalId = optionalNull(StableId);
const optionalInstant = optionalNull(S.DateTimeUtcFromString);

// Optional-key codecs only decode inside a struct: a bare absent value has no
// key to be missing, so the resolution tail is read as one struct.
const StoredResolutionTail = S.Struct({
  resolutionReason: optionalReason,
  resultTaskId: optionalId,
  resultWorkstreamId: optionalId,
  resolvedAt: optionalInstant,
  expiresAt: optionalInstant,
});

const decodeStoredResolutionTail = S.decodeEffect(StoredResolutionTail);

/**
 * Rebuilds a stored candidate by validating its proposal arm and resolution.
 *
 * **Details**
 *
 * Record bookkeeping keys and nulls are removed before the remainder is decoded
 * as {@link CandidateCreate}. The normalized arm is written back. A pending
 * resolution, a missing resolved time, or a missing accepted result fails.
 *
 * **Example** (Reject a task id on create)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { candidateRecordFromStorage } from "@beep/scratchpad/beep/Candidate"
 *
 * const failed = Effect.runSyncExit(
 *   candidateRecordFromStorage({
 *     candidateId: "cand-1",
 *     subjectKind: "task",
 *     proposedAction: "create",
 *     taskId: "task-1",
 *     accountGeneration: 0,
 *     idempotencyKey: "once",
 *     captureConfidence: 0.5,
 *     ownershipConfidence: 0.5,
 *     evidenceRefs: [{ kind: "conversation", id: "conv-1", scope: "canonical" }],
 *     sourceSurface: "chat",
 *     taskChange: { description: "Call back", owner: "unknown" },
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )._tag
 * console.log(failed) // "Failure"
 * ```
 *
 * **Example** (Rebuild a pending create candidate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { candidateRecordFromStorage } from "@beep/scratchpad/beep/Candidate"
 *
 * const record = Effect.runSync(
 *   candidateRecordFromStorage({
 *     candidateId: "cand-1",
 *     subjectKind: "task",
 *     proposedAction: "create",
 *     taskId: null,
 *     accountGeneration: 0,
 *     idempotencyKey: "once",
 *     captureConfidence: 0.5,
 *     ownershipConfidence: 0.5,
 *     evidenceRefs: [{ kind: "conversation", id: "conv-1", scope: "canonical" }],
 *     sourceSurface: "chat",
 *     taskChange: { description: "Call back", owner: "unknown" },
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(record.status) // "pending"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const candidateRecordFromStorage = Effect.fn("CandidateRecord.fromStorage")(function* (value: unknown) {
  if (!P.isObject(value)) {
    return yield* CandidateShapeError.make({ message: "candidate record must be an object" });
  }
  const data: { [key: string]: unknown } = { ...value };
  // Absent and null arms must be missing keys, not `undefined` values:
  // `CandidateCreate` decodes with `onExcessProperty: "error"`.
  const proposalInput: unknown = R.filter(
    {
      subjectKind: omitNull(data.subjectKind),
      proposedAction: omitNull(data.proposedAction),
      taskId: omitNull(data.taskId),
      taskChange: omitNull(data.taskChange),
      workstreamProposal: omitNull(data.workstreamProposal),
      captureConfidence: data.captureConfidence,
      ownershipConfidence: data.ownershipConfidence,
      goalId: omitNull(data.goalId),
      workstreamId: omitNull(data.workstreamId),
      evidenceRefs: data.evidenceRefs,
      sourceSurface: data.sourceSurface,
      compatibility: omitNull(data.compatibility),
    },
    P.isNotUndefined,
  );
  const proposal = yield* decodeCandidateCreate(proposalInput, { onExcessProperty: "error" });
  const tail = yield* decodeStoredResolutionTail(data);
  const record = CandidateRecord.make({
    candidateId: yield* decodeStableId(data.candidateId),
    subjectKind: proposal.subjectKind,
    proposedAction: proposal.proposedAction,
    taskId: candidateTaskId(proposal),
    taskChange: candidateTaskChange(proposal),
    workstreamProposal: candidateWorkstreamProposal(proposal),
    captureConfidence: proposal.captureConfidence,
    ownershipConfidence: proposal.ownershipConfidence,
    goalId: proposal.goalId,
    workstreamId: proposal.workstreamId,
    evidenceRefs: proposal.evidenceRefs,
    sourceSurface: proposal.sourceSurface,
    compatibility: proposal.compatibility,
    status: data.status === undefined ? "pending" : yield* decodeCandidateStatus(data.status),
    accountGeneration: yield* decodeNonNegativeInt(data.accountGeneration),
    idempotencyKey: yield* decodeStableId(data.idempotencyKey),
    resolutionReason: tail.resolutionReason,
    resultTaskId: tail.resultTaskId,
    resultWorkstreamId: tail.resultWorkstreamId,
    createdAt: yield* decodeDateTimeUtcFromString(data.createdAt),
    resolvedAt: tail.resolvedAt,
    expiresAt: tail.expiresAt,
  });
  const issue = candidateResolutionIssue(record);
  if (O.isSome(issue)) return yield* CandidateShapeError.make({ message: issue.value });
  return record;
});

const encodeTaskChange = (change: TaskCreatePayload | TaskChangePayload) =>
  isTaskCreatePayload(change)
    ? encodeTaskCreatePayload(change)
    : encodeTaskChangePayload(change);

/**
 * Re-validates a flat candidate record's proposal fields as {@link CandidateCreate}, encoding nested payloads first.
 *
 * **Example** (Read the create arm)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { EvidenceRef, TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 * import { CandidateRecord, candidateRecordAsProposal } from "@beep/scratchpad/beep/Candidate"
 *
 * const proposal = Effect.runSync(
 *   candidateRecordAsProposal(
 *     CandidateRecord.make({
 *       candidateId: "cand-1",
 *       subjectKind: "task",
 *       proposedAction: "create",
 *       accountGeneration: 0,
 *       idempotencyKey: "once",
 *       captureConfidence: 0.5,
 *       ownershipConfidence: 0.5,
 *       evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })],
 *       sourceSurface: "chat",
 *       taskChange: O.some(TaskCreatePayload.make({ description: "Call back" })),
 *       createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *     }),
 *   ),
 * )
 * console.log(proposal.proposedAction) // "create"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const candidateRecordAsProposal = Effect.fn("CandidateRecord.asProposal")(function* (record: CandidateRecord) {
  const input: { [key: string]: unknown } = {
    subjectKind: record.subjectKind,
    proposedAction: record.proposedAction,
    captureConfidence: record.captureConfidence,
    ownershipConfidence: record.ownershipConfidence,
    evidenceRefs: yield* encodeEvidenceRefCheckedArray(record.evidenceRefs),
    sourceSurface: record.sourceSurface,
  };
  if (O.isSome(record.taskId)) input.taskId = record.taskId.value;
  if (O.isSome(record.taskChange)) input.taskChange = yield* encodeTaskChange(record.taskChange.value);
  if (O.isSome(record.workstreamProposal)) {
    input.workstreamProposal = yield* encodeWorkstreamProposal(record.workstreamProposal.value);
  }
  if (O.isSome(record.goalId)) input.goalId = record.goalId.value;
  if (O.isSome(record.workstreamId)) input.workstreamId = record.workstreamId.value;
  if (O.isSome(record.compatibility)) {
    input.compatibility = yield* encodeCandidateCompatibilityMetadata(record.compatibility.value);
  }
  return yield* decodeCandidateCreate(input);
});

/**
 * One-of constraint arms for the flat record, mirroring the Python schema hook.
 *
 * **Example** (Count the arms)
 *
 * ```ts
 * import { candidateRecordJsonSchema } from "@beep/scratchpad/beep/Candidate"
 *
 * const schema = candidateRecordJsonSchema()
 * console.log(schema.oneOf.length) // 6
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const candidateRecordJsonSchema = () => ({
  oneOf: [
    { title: "TaskCreate", properties: { subjectKind: { const: "task" }, proposedAction: { const: "create" } } },
    { title: "TaskUpdate", properties: { subjectKind: { const: "task" }, proposedAction: { const: "update" } } },
    { title: "TaskComplete", properties: { subjectKind: { const: "task" }, proposedAction: { const: "complete" } } },
    { title: "TaskCancel", properties: { subjectKind: { const: "task" }, proposedAction: { const: "cancel" } } },
    { title: "TaskSupersede", properties: { subjectKind: { const: "task" }, proposedAction: { const: "supersede" } } },
    {
      title: "WorkstreamCreate",
      properties: { subjectKind: { const: "workstream" }, proposedAction: { const: "create" } },
    },
  ],
});

/**
 * Page of stored candidates.
 *
 * **Example** (Empty page)
 *
 * ```ts
 * import { CandidateListResponse } from "@beep/scratchpad/beep/Candidate"
 *
 * const page = CandidateListResponse.make({ candidates: [] })
 * console.log(page.candidates.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateListResponse extends Model<CandidateListResponse>("CandidateListResponse")(
  {
    candidates: S.Array(CandidateRecord).pipe(pg.jsonb(), pg.columnName("candidates")),
  },
  $I.annote("CandidateListResponse", { description: "Page of stored candidates." }),
) {}

/**
 * Encoded form of {@link CandidateListResponse}.
 *
 * @see {@link CandidateListResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateListResponse {
  export type Encoded = S.Codec.Encoded<typeof CandidateListResponse>;
}

/**
 * Request to accept or reject a candidate.
 *
 * **Example** (Reject with a reason)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { CandidateResolutionRequest } from "@beep/scratchpad/beep/Candidate"
 *
 * const request = CandidateResolutionRequest.make({
 *   status: "rejected",
 *   reason: O.some("not_a_task"),
 * })
 * console.log(request.status) // "rejected"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateResolutionRequest extends Model<CandidateResolutionRequest>("CandidateResolutionRequest")(
  {
    status: LiteralKit(["accepted", "rejected"]).pipe(pg.text(), pg.columnName("status")),
    reason: optionalBoundedText("reason", { maxLength: 64 }),
  },
  $I.annote("CandidateResolutionRequest", { description: "Request to accept or reject one candidate." }),
  (columns) => [textBoundsCheck("reason", { maxLength: 64 })(columns.reason)],
) {}

/**
 * Encoded form of {@link CandidateResolutionRequest}.
 *
 * @see {@link CandidateResolutionRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateResolutionRequest {
  export type Encoded = S.Codec.Encoded<typeof CandidateResolutionRequest>;
}

/**
 * Receipt returned after a candidate is resolved.
 *
 * **Example** (Name the receipt)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { CandidateResolutionReceipt } from "@beep/scratchpad/beep/Candidate"
 *
 * const receipt = CandidateResolutionReceipt.make({
 *   candidateId: "cand-1",
 *   status: "accepted",
 *   receiptId: "rcpt-1",
 *   newlyResolved: true,
 *   resolvedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(receipt.newlyResolved) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateResolutionReceipt extends Model<CandidateResolutionReceipt>("CandidateResolutionReceipt")(
  {
    candidateId: stableId("candidate_id"),
    status: CandidateStatus.pipe(pg.text(), pg.columnName("status")),
    receiptId: stableId("receipt_id"),
    taskId: optionalStableId("task_id"),
    workstreamId: optionalStableId("workstream_id"),
    newlyResolved: S.Boolean.pipe(pg.boolean(), pg.columnName("newly_resolved")),
    resolvedAt: timestamp("resolved_at"),
  },
  $I.annote("CandidateResolutionReceipt", { description: "Receipt for a resolved candidate." }),
  (columns) => [
    stableIdCheck("candidate_id")(columns.candidateId),
    stableIdCheck("receipt_id")(columns.receiptId),
    stableIdCheck("task_id")(columns.taskId),
    stableIdCheck("workstream_id")(columns.workstreamId),
  ],
) {}

/**
 * Encoded form of {@link CandidateResolutionReceipt}.
 *
 * @see {@link CandidateResolutionReceipt} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateResolutionReceipt {
  export type Encoded = S.Codec.Encoded<typeof CandidateResolutionReceipt>;
}

/**
 * Counts from a candidate backfill.
 *
 * **Example** (Count a dry run)
 *
 * ```ts
 * import { CandidateMigrationReport } from "@beep/scratchpad/beep/Candidate"
 *
 * const report = CandidateMigrationReport.make({
 *   workflowMode: "shadow",
 *   accountGeneration: 1,
 *   dryRun: true,
 *   scanned: 2,
 *   created: 1,
 *   reconciled: 0,
 *   unchanged: 1,
 *   failed: 0,
 *   failureIds: [],
 * })
 * console.log(report.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateMigrationReport extends Model<CandidateMigrationReport>("CandidateMigrationReport")(
  {
    workflowMode: TaskWorkflowMode.pipe(pg.text(), pg.columnName("workflow_mode")),
    accountGeneration: nonNegativeInt("account_generation"),
    dryRun: S.Boolean.pipe(pg.boolean(), pg.columnName("dry_run")),
    scanned: nonNegativeInt("scanned"),
    created: nonNegativeInt("created"),
    reconciled: nonNegativeInt("reconciled"),
    unchanged: nonNegativeInt("unchanged"),
    failed: nonNegativeInt("failed"),
    failureIds: S.Array(StableId).pipe(pg.jsonb(), pg.columnName("failure_ids")),
    checkpoint: optionalStableId("checkpoint"),
  },
  $I.annote("CandidateMigrationReport", { description: "Counts from a candidate backfill." }),
  (columns) => [
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
    nonNegativeIntCheck("scanned")(columns.scanned),
    nonNegativeIntCheck("created")(columns.created),
    nonNegativeIntCheck("reconciled")(columns.reconciled),
    nonNegativeIntCheck("unchanged")(columns.unchanged),
    nonNegativeIntCheck("failed")(columns.failed),
    stableIdCheck("checkpoint")(columns.checkpoint),
  ],
) {}

/**
 * Encoded form of {@link CandidateMigrationReport}.
 *
 * @see {@link CandidateMigrationReport} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateMigrationReport {
  export type Encoded = S.Codec.Encoded<typeof CandidateMigrationReport>;
}

/**
 * Page request for a candidate backfill.
 *
 * **Example** (Default the page size)
 *
 * ```ts
 * import { CandidateMigrationRequest } from "@beep/scratchpad/beep/Candidate"
 *
 * const request = CandidateMigrationRequest.make({})
 * console.log(request.limit) // 500
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateMigrationRequest extends Model<CandidateMigrationRequest>("CandidateMigrationRequest")(
  {
    afterId: optionalStableId("after_id"),
    limit: migrationLimit.pipe(S.withConstructorDefault(Effect.succeed(500)), pg.integer(), pg.columnName("limit")),
  },
  $I.annote("CandidateMigrationRequest", { description: "Page request for a candidate backfill." }),
  (columns) => [
    stableIdCheck("after_id")(columns.afterId),
    pg.Table.check("limit_between")(sql<boolean>`${columns.limit} >= 1 and ${columns.limit} <= 500`),
  ],
) {}

/**
 * Encoded form of {@link CandidateMigrationRequest}.
 *
 * @see {@link CandidateMigrationRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CandidateMigrationRequest {
  export type Encoded = S.Codec.Encoded<typeof CandidateMigrationRequest>;
}
