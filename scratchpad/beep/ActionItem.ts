/**
 * Canonical action-item contracts and legacy compatibility projections.
 *
 * Action items are Workflow, not a memory layer. They are extracted from the
 * same seam as Memories and stored separately. A long-term memory may absorb a
 * fact about a commitment; the task row stays in Workflow.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import {
  Model,
  StableId,
  bool,
  boundedText,
  optionalBool,
  optionalBoundedText,
  optionalConfidence,
  optionalNull,
  optionalStableId,
  optionalText,
  optionalTimestamp,
  pg,
  stableId,
  stableIdCheck,
  text,
  textBoundsCheck,
  unitIntervalCheck,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/ActionItem");

const activeStatus = "active";
const completedStatus = "completed";
const cancelledStatus = "cancelled";

/**
 * Workflow status of a canonical task.
 *
 * **Details**
 *
 * This is not the Hume processing status in `task.py`. The wire values are
 * `active`, `completed`, `cancelled`, and `superseded`.
 *
 * **Gotchas**
 *
 * The spelling is `cancelled`, not `canceled`.
 *
 * **Example** (Decode cancelled)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskStatus } from "@beep/scratchpad/beep/ActionItem"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskStatus)("cancelled"))
 * console.log(decoded) // "cancelled"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskStatus = LiteralKit(["active", "completed", "cancelled", "superseded"]).pipe(
  $I.annoteSchema("TaskStatus", {
    description: "Canonical Workflow task status. This is not the Hume processing status.",
  }),
);

/**
 * Decoded canonical task status.
 *
 * @see {@link TaskStatus} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskStatus = typeof TaskStatus.Type;

/**
 * Encoded form of {@link TaskStatus}.
 *
 * @see {@link TaskStatus} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskStatusEncoded = S.Codec.Encoded<typeof TaskStatus>;

/**
 * Who owns a task.
 *
 * **Example** (Decode the user owner)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskOwner } from "@beep/scratchpad/beep/ActionItem"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskOwner)("user"))
 * console.log(decoded) // "user"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskOwner = LiteralKit(["user", "other", "unknown"]).pipe(
  $I.annoteSchema("TaskOwner", { description: "Task owner: user, other, or unknown." }),
);

/**
 * Decoded task owner.
 *
 * @see {@link TaskOwner} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskOwner = typeof TaskOwner.Type;

/**
 * Encoded form of {@link TaskOwner}.
 *
 * @see {@link TaskOwner} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskOwnerEncoded = S.Codec.Encoded<typeof TaskOwner>;

/**
 * Relative priority of a task.
 *
 * **Example** (Decode high priority)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskPriority } from "@beep/scratchpad/beep/ActionItem"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskPriority)("high"))
 * console.log(decoded) // "high"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskPriority = LiteralKit(["high", "medium", "low"]).pipe(
  $I.annoteSchema("TaskPriority", { description: "Task priority: high, medium, or low." }),
);

/**
 * Decoded task priority.
 *
 * @see {@link TaskPriority} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskPriority = typeof TaskPriority.Type;

/**
 * Encoded form of {@link TaskPriority}.
 *
 * @see {@link TaskPriority} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskPriorityEncoded = S.Codec.Encoded<typeof TaskPriority>;

/**
 * Kind of evidence attached to a Workflow task.
 *
 * **Example** (Decode a conversation ref)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EvidenceKind } from "@beep/scratchpad/beep/ActionItem"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(EvidenceKind)("conversation"))
 * console.log(decoded) // "conversation"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceKind = LiteralKit([
  "conversation",
  "memory_item",
  "workstream_event",
  "artifact",
  "chat_message",
  "local_screen",
  "external",
]).pipe(
  $I.annoteSchema("EvidenceKind", {
    description: "Evidence source kind for a Workflow task. local_screen is device-local only.",
  }),
);

/**
 * Decoded evidence kind.
 *
 * @see {@link EvidenceKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceKind = typeof EvidenceKind.Type;

/**
 * Encoded form of {@link EvidenceKind}.
 *
 * @see {@link EvidenceKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceKindEncoded = S.Codec.Encoded<typeof EvidenceKind>;

/**
 * Where an evidence id is resolved.
 *
 * **Example** (Decode device-local scope)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EvidenceScope } from "@beep/scratchpad/beep/ActionItem"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(EvidenceScope)("device_local"))
 * console.log(decoded) // "device_local"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceScope = LiteralKit(["canonical", "device_local"]).pipe(
  $I.annoteSchema("EvidenceScope", {
    description: "Evidence resolution scope: canonical or device_local.",
  }),
);

/**
 * Decoded evidence scope.
 *
 * @see {@link EvidenceScope} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceScope = typeof EvidenceScope.Type;

/**
 * Encoded form of {@link EvidenceScope}.
 *
 * @see {@link EvidenceScope} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceScopeEncoded = S.Codec.Encoded<typeof EvidenceScope>;

const awarePattern =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

/**
 * Timezone-aware UTC instant.
 *
 * **Details**
 *
 * Python `AwareDatetime` rejects a zone-less string. Naive response timestamps
 * use {@link timestamp} instead and are read as UTC.
 *
 * **Example** (Reject a naive instant)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AwareTimestamp } from "@beep/scratchpad/beep/ActionItem"
 *
 * const failed = Effect.runSyncExit(S.decodeUnknownEffect(AwareTimestamp)("2020-01-02T03:04:05"))._tag
 * console.log(failed) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AwareTimestamp = S.String.check(S.isPattern(awarePattern)).pipe(
  S.decodeTo(S.DateTimeUtc, {
    decode: SchemaGetter.dateTimeUtcFromInput<string>(),
    encode: SchemaGetter.transform((value) => DateTime.formatIso(value)),
  }),
  $I.annoteSchema("AwareTimestamp", {
    description: "UTC instant that must carry an explicit offset on the wire.",
  }),
);

/**
 * Decoded aware timestamp.
 *
 * @see {@link AwareTimestamp} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AwareTimestamp = typeof AwareTimestamp.Type;

const optionalAware = (column: string) =>
  optionalNull(AwareTimestamp).pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

const nonNegativeFinite = S.Finite.check(S.isGreaterThanOrEqualTo(0));

const optionalNonNegativeFinite = (column: string) =>
  optionalNull(nonNegativeFinite).pipe(pg.doublePrecision(), pg.columnName(column));

const indentSchema = S.Int.check(S.isBetween({ minimum: 0, maximum: 3 }));

const indentDefault = indentSchema.pipe(
  S.withConstructorDefault(Effect.succeed(0)),
  pg.integer(),
  pg.columnName("indent_level"),
);

const optionalIndent = optionalNull(indentSchema).pipe(pg.integer(), pg.columnName("indent_level"));

const descriptionText = boundedText("description", { minLength: 1, maxLength: 4096 });

const optionalDescription = optionalBoundedText("description", { minLength: 1, maxLength: 4096 });

const sourceDefault = (value: string) =>
  S.String.check(S.isMinLength(1), S.isMaxLength(64)).pipe(
    S.withConstructorDefault(Effect.succeed(value)),
    pg.text(),
    pg.columnName("source"),
  );

const optionalSource = optionalBoundedText("source", { minLength: 1, maxLength: 64 });

const boolDefault = (column: string, value: boolean) =>
  S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.boolean(), pg.columnName(column));

const intDefault = (column: string, value: number) =>
  S.Int.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.integer(), pg.columnName(column));

const optionalInt = (column: string) => optionalNull(S.Int).pipe(pg.integer(), pg.columnName(column));

const statusColumn = (column: string, value: TaskStatus) =>
  TaskStatus.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));

const optionalStatus = (column: string) => optionalNull(TaskStatus).pipe(pg.text(), pg.columnName(column));

const ownerColumn = (column: string, value: TaskOwner) =>
  TaskOwner.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));

const optionalOwner = (column: string) => optionalNull(TaskOwner).pipe(pg.text(), pg.columnName(column));

const optionalPriority = (column: string) => optionalNull(TaskPriority).pipe(pg.text(), pg.columnName(column));

/**
 * Pointer at the evidence behind a Workflow task.
 *
 * **Details**
 *
 * `kind` and `scope` do not change the other fields. Scope still has rules:
 * `device_local` requires `deviceId`, `canonical` forbids it, and
 * `local_screen` must be `device_local`. When both offsets are present,
 * `endSeconds` is at least `startSeconds`.
 *
 * **Gotchas**
 *
 * Those rules are {@link evidenceScopeIssue}. The class schema stores the
 * fields; {@link EvidenceRefChecked} rejects an illegal combination.
 * `deviceId` is optional provenance. It is not an input to an evidence id hash.
 *
 * **Example** (Store canonical conversation evidence)
 *
 * ```ts
 * import { EvidenceRef } from "@beep/scratchpad/beep/ActionItem"
 *
 * const ref = EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical" })
 * console.log(ref.kind) // "conversation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceRef extends Model<EvidenceRef>("EvidenceRef")(
  {
    kind: EvidenceKind.pipe(pg.text(), pg.columnName("kind")),
    id: stableId("id"),
    version: optionalBoundedText("version", { maxLength: 128 }),
    scope: EvidenceScope.pipe(pg.text(), pg.columnName("scope")),
    deviceId: optionalStableId("device_id"),
    excerptHash: optionalBoundedText("excerpt_hash", { pattern: "^[a-f0-9]{64}$" }),
    transcriptSegmentIds: StableId.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("transcript_segment_ids")),
    startSeconds: optionalNonNegativeFinite("start_seconds"),
    endSeconds: optionalNonNegativeFinite("end_seconds"),
  },
  $I.annote("EvidenceRef", {
    description: "Evidence pointer for a Workflow task. Scope and kind stay one shape with conditional rules.",
  }),
  (columns) => [
    stableIdCheck("id")(columns.id),
    textBoundsCheck("version", { maxLength: 128 })(columns.version),
    stableIdCheck("device_id")(columns.deviceId),
    textBoundsCheck("excerpt_hash", { pattern: "^[a-f0-9]{64}$" })(columns.excerptHash),
    pg.Table.check("start_seconds_ge")(sql<boolean>`${columns.startSeconds} >= 0`),
    pg.Table.check("end_seconds_ge")(sql<boolean>`${columns.endSeconds} >= 0`),
  ],
) {}

/**
 * Encoded form of {@link EvidenceRef}.
 *
 * @see {@link EvidenceRef} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EvidenceRef {
  export type Encoded = S.Codec.Encoded<typeof EvidenceRef>;
}

/**
 * Why an evidence ref is not a legal scope combination.
 *
 * **Example** (Reject canonical evidence that names a device)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { EvidenceRef, evidenceScopeIssue } from "@beep/scratchpad/beep/ActionItem"
 *
 * const issue = evidenceScopeIssue(
 *   EvidenceRef.make({ kind: "conversation", id: "conv-1", scope: "canonical", deviceId: O.some("device-1") }),
 * )
 * console.log(O.getOrNull(issue)) // "canonical evidence cannot carry device_id"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const evidenceScopeIssue = (ref: EvidenceRef): O.Option<string> => {
  if (ref.scope === "device_local" && O.isNone(ref.deviceId)) {
    return O.some("device_local evidence requires device_id");
  }
  if (ref.scope === "canonical" && O.isSome(ref.deviceId)) {
    return O.some("canonical evidence cannot carry device_id");
  }
  if (ref.kind === "local_screen" && ref.scope !== "device_local") {
    return O.some("local_screen evidence must be device_local");
  }
  if (O.isSome(ref.startSeconds) && O.isSome(ref.endSeconds) && ref.endSeconds.value < ref.startSeconds.value) {
    return O.some("end_seconds must be greater than or equal to start_seconds");
  }
  return O.none();
};

const evidenceScopeFilter = S.makeFilter((ref: EvidenceRef) => {
  const issue = evidenceScopeIssue(ref);
  return O.isNone(issue) ? undefined : issue.value;
});

/**
 * {@link EvidenceRef} decode that rejects an illegal scope combination.
 *
 * **Example** (Reject local screen evidence that is canonical)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EvidenceRefChecked } from "@beep/scratchpad/beep/ActionItem"
 *
 * const failed = Effect.runSyncExit(
 *   S.decodeUnknownEffect(EvidenceRefChecked)({ kind: "local_screen", id: "frame-1", scope: "canonical" }),
 * )._tag
 * console.log(failed) // "Failure"
 * ```
 *
 * @see {@link evidenceScopeIssue} for the four rules.
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceRefChecked = EvidenceRef.check(evidenceScopeFilter);

const evidenceList = S.Array(EvidenceRefChecked).pipe(
  S.withConstructorDefault(Effect.sync(() => [])),
  pg.jsonb(),
  pg.columnName("provenance"),
);

const optionalEvidenceList = EvidenceRefChecked.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("provenance"));

/**
 * A task write disagreed with itself, or a patch set nothing.
 *
 * **Example** (Raise a status conflict)
 *
 * ```ts
 * import { TaskFieldConflict } from "@beep/scratchpad/beep/ActionItem"
 *
 * const error = TaskFieldConflict.make({ message: "completed must agree with status" })
 * console.log(error.message) // "completed must agree with status"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaskFieldConflict extends S.TaggedError<TaskFieldConflict>()(
  "TaskFieldConflict",
  { message: S.String },
  $I.annoteError<TaskFieldConflict>("TaskFieldConflict", {
    description: "Task status and completed disagreed, or a patch did not set a field.",
  }),
) {}

/**
 * Encoded form of {@link TaskFieldConflict}.
 *
 * @see {@link TaskFieldConflict} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskFieldConflict {
  export type Encoded = S.Codec.Encoded<typeof TaskFieldConflict>;
}

const evidenceWire = (ref: EvidenceRef) => ({
  kind: ref.kind,
  id: ref.id,
  scope: ref.scope,
  ...(O.isSome(ref.version) ? { version: ref.version.value } : {}),
  ...(O.isSome(ref.deviceId) ? { device_id: ref.deviceId.value } : {}),
  ...(O.isSome(ref.excerptHash) ? { excerpt_hash: ref.excerptHash.value } : {}),
  ...(O.isSome(ref.transcriptSegmentIds) ? { transcript_segment_ids: ref.transcriptSegmentIds.value } : {}),
  ...(O.isSome(ref.startSeconds) ? { start_seconds: ref.startSeconds.value } : {}),
  ...(O.isSome(ref.endSeconds) ? { end_seconds: ref.endSeconds.value } : {}),
});

const reconcileCreate = (self: {
  readonly status: O.Option<TaskStatus>;
  readonly completed: O.Option<boolean>;
}): Effect.Effect<{ readonly status: TaskStatus; readonly completed: boolean }, TaskFieldConflict> => {
  const status: TaskStatus = O.match(self.status, {
    onSome: (value) => value,
    onNone: () =>
      O.match(self.completed, {
        onSome: (flag) => (flag ? completedStatus : activeStatus),
        onNone: () => activeStatus,
      }),
  });
  const expected = status === completedStatus;
  if (O.isSome(self.completed) && self.completed.value !== expected) {
    return Effect.fail(TaskFieldConflict.make({ message: "completed must agree with status" }));
  }
  return Effect.succeed({ status, completed: expected });
};

const reconcileUpdate = (self: {
  readonly status: O.Option<TaskStatus>;
  readonly completed: O.Option<boolean>;
}): Effect.Effect<O.Option<{ readonly status: TaskStatus; readonly completed: boolean }>, TaskFieldConflict> => {
  if (O.isSome(self.status) && O.isSome(self.completed)) {
    const expected = self.status.value === completedStatus;
    if (self.completed.value !== expected) {
      return Effect.fail(TaskFieldConflict.make({ message: "completed must agree with status" }));
    }
    return Effect.succeedSome({ status: self.status.value, completed: expected });
  }
  if (O.isSome(self.status)) {
    return Effect.succeedSome({ status: self.status.value, completed: self.status.value === completedStatus });
  }
  if (O.isSome(self.completed)) {
    return Effect.succeedSome({
      status: self.completed.value ? completedStatus : activeStatus,
      completed: self.completed.value,
    });
  }
  return Effect.succeedNone;
};

/**
 * Shared create contract accepted by every task-writing surface.
 *
 * **Details**
 *
 * Action items are Workflow. `status` and `completed` are two encodings of the
 * same fact. {@link canonicalTaskCreateStoragePayload} fills a missing status
 * from `completed === true`, otherwise `active`, and then forces `completed`
 * to agree. `owner` constructs as `user`. `source` constructs as `manual`.
 *
 * **Gotchas**
 *
 * `dueAt` is an aware UTC instant. A zone-less string is rejected. Response
 * rows use a different, naive-as-UTC timestamp. `conversationId` here is a
 * stable id. The response field is a plain string.
 *
 * **Example** (Default the owner to the user)
 *
 * ```ts
 * import { CanonicalTaskCreate } from "@beep/scratchpad/beep/ActionItem"
 *
 * const created = CanonicalTaskCreate.make({ description: "Ship the note" })
 * console.log(created.owner) // "user"
 * console.log(created.source) // "manual"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalTaskCreate extends Model<CanonicalTaskCreate>("CanonicalTaskCreate")(
  {
    description: descriptionText,
    status: optionalStatus("status"),
    completed: optionalBool("completed"),
    goalId: optionalStableId("goal_id"),
    workstreamId: optionalStableId("workstream_id"),
    owner: ownerColumn("owner", "user"),
    dueAt: optionalAware("due_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    source: sourceDefault("manual"),
    provenance: evidenceList,
    priority: optionalPriority("priority"),
    sortOrder: intDefault("sort_order", 0),
    indentLevel: indentDefault,
    recurrenceRule: optionalBoundedText("recurrence_rule", { maxLength: 128 }),
    recurrenceParentId: optionalStableId("recurrence_parent_id"),
    conversationId: optionalStableId("conversation_id"),
    isLocked: boolDefault("is_locked", false),
    exported: boolDefault("exported", false),
    exportDate: optionalAware("export_date"),
    exportPlatform: optionalBoundedText("export_platform", { maxLength: 64 }),
    appleReminderId: optionalBoundedText("apple_reminder_id", { maxLength: 512 }),
  },
  $I.annote("CanonicalTaskCreate", {
    description: "Shared Workflow task create contract accepted by every task-writing surface.",
  }),
  (columns) => [
    textBoundsCheck("description", { minLength: 1, maxLength: 4096 })(columns.description),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    textBoundsCheck("source", { minLength: 1, maxLength: 64 })(columns.source),
    pg.Table.check("indent_level_between")(sql<boolean>`${columns.indentLevel} >= 0 and ${columns.indentLevel} <= 3`),
    textBoundsCheck("recurrence_rule", { maxLength: 128 })(columns.recurrenceRule),
    stableIdCheck("goal_id")(columns.goalId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("recurrence_parent_id")(columns.recurrenceParentId),
    stableIdCheck("conversation_id")(columns.conversationId),
    textBoundsCheck("export_platform", { maxLength: 64 })(columns.exportPlatform),
    textBoundsCheck("apple_reminder_id", { maxLength: 512 })(columns.appleReminderId),
  ],
) {}

/**
 * Encoded form of {@link CanonicalTaskCreate}.
 *
 * @see {@link CanonicalTaskCreate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CanonicalTaskCreate {
  export type Encoded = S.Codec.Encoded<typeof CanonicalTaskCreate>;
}

/**
 * Python storage document for a create, with nulls omitted.
 *
 * @see {@link canonicalTaskCreateStoragePayload} for the builder.
 * @category type-level
 * @since 0.0.0
 */
export interface TaskCreateStoragePayload {
  readonly description: string;
  readonly status: TaskStatus;
  readonly completed: boolean;
  readonly owner: TaskOwner;
  readonly source: string;
  readonly provenance: ReadonlyArray<ReturnType<typeof evidenceWire>>;
  readonly sort_order: number;
  readonly indent_level: number;
  readonly is_locked: boolean;
  readonly exported: boolean;
  readonly goal_id?: string;
  readonly workstream_id?: string;
  readonly due_at?: DateTime.Utc;
  readonly due_confidence?: number;
  readonly priority?: TaskPriority;
  readonly recurrence_rule?: string;
  readonly recurrence_parent_id?: string;
  readonly conversation_id?: string;
  readonly export_date?: DateTime.Utc;
  readonly export_platform?: string;
  readonly apple_reminder_id?: string;
}

/**
 * Builds the create storage document and reconciles legacy `completed`.
 *
 * **Details**
 *
 * Missing status becomes `completed` only when `completed` is true, otherwise
 * `active`. When both are present they must agree. The stored `completed` flag
 * is then `status === completed`. None fields are omitted. Provenance is always
 * present, with each ref omitting none fields.
 *
 * **Example** (Fill status from completed)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { CanonicalTaskCreate, canonicalTaskCreateStoragePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const payload = Effect.runSync(
 *   canonicalTaskCreateStoragePayload(
 *     CanonicalTaskCreate.make({ description: "Ship the note", completed: O.some(true) }),
 *   ),
 * )
 * console.log(payload.status) // "completed"
 * console.log(payload.completed) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const canonicalTaskCreateStoragePayload = Effect.fn("CanonicalTaskCreate.storagePayload")(function* (
  self: CanonicalTaskCreate,
) {
  const reconciled = yield* reconcileCreate(self);
  return {
    description: self.description,
    status: reconciled.status,
    completed: reconciled.completed,
    owner: self.owner,
    source: self.source,
    provenance: A.map(self.provenance, evidenceWire),
    sort_order: self.sortOrder,
    indent_level: self.indentLevel,
    is_locked: self.isLocked,
    exported: self.exported,
    ...(O.isSome(self.goalId) ? { goal_id: self.goalId.value } : {}),
    ...(O.isSome(self.workstreamId) ? { workstream_id: self.workstreamId.value } : {}),
    ...(O.isSome(self.dueAt) ? { due_at: self.dueAt.value } : {}),
    ...(O.isSome(self.dueConfidence) ? { due_confidence: self.dueConfidence.value } : {}),
    ...(O.isSome(self.priority) ? { priority: self.priority.value } : {}),
    ...(O.isSome(self.recurrenceRule) ? { recurrence_rule: self.recurrenceRule.value } : {}),
    ...(O.isSome(self.recurrenceParentId) ? { recurrence_parent_id: self.recurrenceParentId.value } : {}),
    ...(O.isSome(self.conversationId) ? { conversation_id: self.conversationId.value } : {}),
    ...(O.isSome(self.exportDate) ? { export_date: self.exportDate.value } : {}),
    ...(O.isSome(self.exportPlatform) ? { export_platform: self.exportPlatform.value } : {}),
    ...(O.isSome(self.appleReminderId) ? { apple_reminder_id: self.appleReminderId.value } : {}),
  } satisfies TaskCreateStoragePayload;
});

const updateHasField = (self: {
  readonly description: O.Option<string>;
  readonly status: O.Option<TaskStatus>;
  readonly completed: O.Option<boolean>;
  readonly goalId: O.Option<string>;
  readonly workstreamId: O.Option<string>;
  readonly owner: O.Option<TaskOwner>;
  readonly dueAt: O.Option<DateTime.Utc>;
  readonly dueConfidence: O.Option<number>;
  readonly source: O.Option<string>;
  readonly provenance: O.Option<ReadonlyArray<EvidenceRef>>;
  readonly priority: O.Option<TaskPriority>;
  readonly sortOrder: O.Option<number>;
  readonly indentLevel: O.Option<number>;
  readonly recurrenceRule: O.Option<string>;
  readonly recurrenceParentId: O.Option<string>;
  readonly supersededBy: O.Option<string>;
  readonly exported: O.Option<boolean>;
  readonly exportDate: O.Option<DateTime.Utc>;
  readonly exportPlatform: O.Option<string>;
  readonly appleReminderId: O.Option<string>;
}): boolean =>
  O.isSome(self.description) ||
  O.isSome(self.status) ||
  O.isSome(self.completed) ||
  O.isSome(self.goalId) ||
  O.isSome(self.workstreamId) ||
  O.isSome(self.owner) ||
  O.isSome(self.dueAt) ||
  O.isSome(self.dueConfidence) ||
  O.isSome(self.source) ||
  O.isSome(self.provenance) ||
  O.isSome(self.priority) ||
  O.isSome(self.sortOrder) ||
  O.isSome(self.indentLevel) ||
  O.isSome(self.recurrenceRule) ||
  O.isSome(self.recurrenceParentId) ||
  O.isSome(self.supersededBy) ||
  O.isSome(self.exported) ||
  O.isSome(self.exportDate) ||
  O.isSome(self.exportPlatform) ||
  O.isSome(self.appleReminderId);

/**
 * Patch for a canonical task. Every field is optional. At least one must be set.
 *
 * **Gotchas**
 *
 * Missing and JSON null both decode as `None`, so an explicit null clear is
 * not distinct from an omitted key except through {@link ActionItemUpdateRequest}'s
 * `clearDueAt` flag.
 *
 * **Example** (Construct a description patch)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { CanonicalTaskUpdate } from "@beep/scratchpad/beep/ActionItem"
 *
 * const patch = CanonicalTaskUpdate.make({ description: O.some("Rename the note") })
 * console.log(O.getOrNull(patch.description)) // "Rename the note"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalTaskUpdate extends Model<CanonicalTaskUpdate>("CanonicalTaskUpdate")(
  {
    description: optionalDescription,
    status: optionalStatus("status"),
    completed: optionalBool("completed"),
    goalId: optionalStableId("goal_id"),
    workstreamId: optionalStableId("workstream_id"),
    owner: optionalOwner("owner"),
    dueAt: optionalAware("due_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    source: optionalSource,
    provenance: optionalEvidenceList,
    priority: optionalPriority("priority"),
    sortOrder: optionalInt("sort_order"),
    indentLevel: optionalIndent,
    recurrenceRule: optionalBoundedText("recurrence_rule", { maxLength: 128 }),
    recurrenceParentId: optionalStableId("recurrence_parent_id"),
    supersededBy: optionalStableId("superseded_by"),
    exported: optionalBool("exported"),
    exportDate: optionalAware("export_date"),
    exportPlatform: optionalBoundedText("export_platform", { maxLength: 64 }),
    appleReminderId: optionalBoundedText("apple_reminder_id", { maxLength: 512 }),
  },
  $I.annote("CanonicalTaskUpdate", {
    description: "Workflow task patch. Every field is optional and at least one must be set.",
  }),
  (columns) => [
    textBoundsCheck("description", { minLength: 1, maxLength: 4096 })(columns.description),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    textBoundsCheck("source", { minLength: 1, maxLength: 64 })(columns.source),
    pg.Table.check("indent_level_between")(sql<boolean>`${columns.indentLevel} >= 0 and ${columns.indentLevel} <= 3`),
    textBoundsCheck("recurrence_rule", { maxLength: 128 })(columns.recurrenceRule),
    stableIdCheck("goal_id")(columns.goalId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("recurrence_parent_id")(columns.recurrenceParentId),
    stableIdCheck("superseded_by")(columns.supersededBy),
    textBoundsCheck("export_platform", { maxLength: 64 })(columns.exportPlatform),
    textBoundsCheck("apple_reminder_id", { maxLength: 512 })(columns.appleReminderId),
  ],
) {}

/**
 * Encoded form of {@link CanonicalTaskUpdate}.
 *
 * @see {@link CanonicalTaskUpdate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CanonicalTaskUpdate {
  export type Encoded = S.Codec.Encoded<typeof CanonicalTaskUpdate>;
}

/**
 * Storage patch. Derived status and completed are kept even when only one was sent.
 *
 * **Example** (Derive completed from status)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { CanonicalTaskUpdate, canonicalTaskUpdateStoragePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const payload = Effect.runSync(
 *   canonicalTaskUpdateStoragePayload(CanonicalTaskUpdate.make({ status: O.some("completed") })),
 * )
 * console.log(payload.status) // "completed"
 * console.log(payload.completed) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const canonicalTaskUpdateStoragePayload = Effect.fn("CanonicalTaskUpdate.storagePayload")(function* (
  self: CanonicalTaskUpdate,
) {
  if (!updateHasField(self)) {
    return yield* TaskFieldConflict.make({ message: "at least one task field is required" });
  }
  const reconciled = yield* reconcileUpdate(self);
  return {
    ...(O.isSome(self.description) ? { description: self.description.value } : {}),
    ...(O.isSome(reconciled) ? { status: reconciled.value.status, completed: reconciled.value.completed } : {}),
    ...(O.isSome(self.goalId) ? { goal_id: self.goalId.value } : {}),
    ...(O.isSome(self.workstreamId) ? { workstream_id: self.workstreamId.value } : {}),
    ...(O.isSome(self.owner) ? { owner: self.owner.value } : {}),
    ...(O.isSome(self.dueAt) ? { due_at: self.dueAt.value } : {}),
    ...(O.isSome(self.dueConfidence) ? { due_confidence: self.dueConfidence.value } : {}),
    ...(O.isSome(self.source) ? { source: self.source.value } : {}),
    ...(O.isSome(self.provenance) ? { provenance: A.map(self.provenance.value, evidenceWire) } : {}),
    ...(O.isSome(self.priority) ? { priority: self.priority.value } : {}),
    ...(O.isSome(self.sortOrder) ? { sort_order: self.sortOrder.value } : {}),
    ...(O.isSome(self.indentLevel) ? { indent_level: self.indentLevel.value } : {}),
    ...(O.isSome(self.recurrenceRule) ? { recurrence_rule: self.recurrenceRule.value } : {}),
    ...(O.isSome(self.recurrenceParentId) ? { recurrence_parent_id: self.recurrenceParentId.value } : {}),
    ...(O.isSome(self.supersededBy) ? { superseded_by: self.supersededBy.value } : {}),
    ...(O.isSome(self.exported) ? { exported: self.exported.value } : {}),
    ...(O.isSome(self.exportDate) ? { export_date: self.exportDate.value } : {}),
    ...(O.isSome(self.exportPlatform) ? { export_platform: self.exportPlatform.value } : {}),
    ...(O.isSome(self.appleReminderId) ? { apple_reminder_id: self.appleReminderId.value } : {}),
  };
});

/**
 * Released-client create adapter. Unknown historical keys are ignored.
 *
 * **Example** (Ignore an unknown key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ActionItemCreateRequest } from "@beep/scratchpad/beep/ActionItem"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ActionItemCreateRequest)({ description: "Ship the note", legacy: true }),
 * )
 * console.log(decoded.description) // "Ship the note"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionItemCreateRequest extends Model<ActionItemCreateRequest>("ActionItemCreateRequest")(
  {
    description: descriptionText,
    status: optionalStatus("status"),
    completed: optionalBool("completed"),
    goalId: optionalStableId("goal_id"),
    workstreamId: optionalStableId("workstream_id"),
    owner: ownerColumn("owner", "user"),
    dueAt: optionalAware("due_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    source: sourceDefault("manual"),
    provenance: evidenceList,
    priority: optionalPriority("priority"),
    sortOrder: intDefault("sort_order", 0),
    indentLevel: indentDefault,
    recurrenceRule: optionalBoundedText("recurrence_rule", { maxLength: 128 }),
    recurrenceParentId: optionalStableId("recurrence_parent_id"),
    conversationId: optionalStableId("conversation_id"),
    isLocked: boolDefault("is_locked", false),
    exported: boolDefault("exported", false),
    exportDate: optionalAware("export_date"),
    exportPlatform: optionalBoundedText("export_platform", { maxLength: 64 }),
    appleReminderId: optionalBoundedText("apple_reminder_id", { maxLength: 512 }),
  },
  $I.annote("ActionItemCreateRequest", {
    description: "Released-client create adapter. Unknown historical fields are ignored at this boundary.",
  }),
  (columns) => [
    textBoundsCheck("description", { minLength: 1, maxLength: 4096 })(columns.description),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    textBoundsCheck("source", { minLength: 1, maxLength: 64 })(columns.source),
    pg.Table.check("indent_level_between")(sql<boolean>`${columns.indentLevel} >= 0 and ${columns.indentLevel} <= 3`),
  ],
) {}

/**
 * Encoded form of {@link ActionItemCreateRequest}.
 *
 * @see {@link ActionItemCreateRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionItemCreateRequest {
  export type Encoded = S.Codec.Encoded<typeof ActionItemCreateRequest>;
}

/**
 * Released-client update with the desktop due-date clearing flag.
 *
 * **Details**
 *
 * `clearDueAt` is a bool, not an Option. When true, storage writes `due_at`
 * as null even though a missing due date and a JSON null both decode as `None`.
 *
 * **Example** (Construct a clear-due patch)
 *
 * ```ts
 * import { ActionItemUpdateRequest } from "@beep/scratchpad/beep/ActionItem"
 *
 * const patch = ActionItemUpdateRequest.make({ clearDueAt: true })
 * console.log(patch.clearDueAt) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionItemUpdateRequest extends Model<ActionItemUpdateRequest>("ActionItemUpdateRequest")(
  {
    description: optionalDescription,
    status: optionalStatus("status"),
    completed: optionalBool("completed"),
    goalId: optionalStableId("goal_id"),
    workstreamId: optionalStableId("workstream_id"),
    owner: optionalOwner("owner"),
    dueAt: optionalAware("due_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    source: optionalSource,
    provenance: optionalEvidenceList,
    priority: optionalPriority("priority"),
    sortOrder: optionalInt("sort_order"),
    indentLevel: optionalIndent,
    recurrenceRule: optionalBoundedText("recurrence_rule", { maxLength: 128 }),
    recurrenceParentId: optionalStableId("recurrence_parent_id"),
    supersededBy: optionalStableId("superseded_by"),
    exported: optionalBool("exported"),
    exportDate: optionalAware("export_date"),
    exportPlatform: optionalBoundedText("export_platform", { maxLength: 64 }),
    appleReminderId: optionalBoundedText("apple_reminder_id", { maxLength: 512 }),
    clearDueAt: boolDefault("clear_due_at", false),
  },
  $I.annote("ActionItemUpdateRequest", {
    description: "Released-client task patch with an explicit flag that writes due_at as null.",
  }),
  (columns) => [
    textBoundsCheck("description", { minLength: 1, maxLength: 4096 })(columns.description),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    pg.Table.check("indent_level_between")(sql<boolean>`${columns.indentLevel} >= 0 and ${columns.indentLevel} <= 3`),
  ],
) {}

/**
 * Encoded form of {@link ActionItemUpdateRequest}.
 *
 * @see {@link ActionItemUpdateRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionItemUpdateRequest {
  export type Encoded = S.Codec.Encoded<typeof ActionItemUpdateRequest>;
}

/**
 * Storage patch for a released client, including a due-date clear.
 *
 * **Details**
 *
 * `clearDueAt` is removed from the document. When it is true, `due_at` is
 * written as null. A patch that sets only that flag is valid.
 *
 * **Example** (Write a null due date)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { ActionItemUpdateRequest, actionItemUpdateStoragePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const payload = Effect.runSync(
 *   actionItemUpdateStoragePayload(ActionItemUpdateRequest.make({ clearDueAt: true })),
 * )
 * console.log(payload.due_at) // null
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const actionItemUpdateStoragePayload = Effect.fn("ActionItemUpdateRequest.storagePayload")(function* (
  self: ActionItemUpdateRequest,
) {
  if (!updateHasField(self) && !self.clearDueAt) {
    return yield* TaskFieldConflict.make({ message: "at least one task field is required" });
  }
  const parent = updateHasField(self) ? yield* canonicalTaskUpdateStoragePayload(self) : {};
  if (!self.clearDueAt) return parent;
  return { ...parent, due_at: null };
});

/**
 * Canonical task response plus fields still required by old clients.
 *
 * **Details**
 *
 * Action items are Workflow, stored apart from Memories. `conversationId` on
 * this response is a plain string, not a stable id. `owner` constructs as
 * `unknown` and `source` as `legacy`. `completed` has no constructor default;
 * {@link projectLegacyActionItem} fills it from status, and fills status from
 * `completed` or a legacy `deleted` flag.
 *
 * **Gotchas**
 *
 * Response timestamps accept a zone-less ISO string and read it as UTC. Create
 * payloads do not. `indentLevel` has no 0..3 check on the response. Forcing
 * `hasMore` when a list is truncated is not a validator on this row.
 *
 * **Example** (Construct an active legacy row)
 *
 * ```ts
 * import { ActionItemResponse } from "@beep/scratchpad/beep/ActionItem"
 *
 * const row = ActionItemResponse.make({ id: "task-1", description: "Ship the note", completed: false })
 * console.log(row.status) // "active"
 * console.log(row.owner) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionItemResponse extends Model<ActionItemResponse>("ActionItemResponse")(
  {
    id: stableId("id"),
    taskId: optionalStableId("task_id"),
    description: text("description"),
    status: statusColumn("status", activeStatus),
    completed: bool("completed"),
    goalId: optionalStableId("goal_id"),
    workstreamId: optionalStableId("workstream_id"),
    owner: ownerColumn("owner", "unknown"),
    dueAt: optionalTimestamp("due_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    source: S.String.pipe(S.withConstructorDefault(Effect.succeed("legacy")), pg.text(), pg.columnName("source")),
    provenance: evidenceList,
    priority: optionalPriority("priority"),
    sortOrder: intDefault("sort_order", 0),
    indentLevel: intDefault("indent_level", 0),
    recurrenceRule: optionalText("recurrence_rule"),
    recurrenceParentId: optionalStableId("recurrence_parent_id"),
    createdAt: optionalTimestamp("created_at"),
    updatedAt: optionalTimestamp("updated_at"),
    completedAt: optionalTimestamp("completed_at"),
    supersededBy: optionalStableId("superseded_by"),
    conversationId: optionalText("conversation_id"),
    isLocked: boolDefault("is_locked", false),
    exported: boolDefault("exported", false),
    exportDate: optionalTimestamp("export_date"),
    exportPlatform: optionalText("export_platform"),
    appleReminderId: optionalText("apple_reminder_id"),
  },
  $I.annote("ActionItemResponse", {
    description: "Workflow action-item response, including stable fields still read by old clients.",
  }),
  (columns) => [
    stableIdCheck("id")(columns.id),
    stableIdCheck("task_id")(columns.taskId),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    stableIdCheck("goal_id")(columns.goalId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("recurrence_parent_id")(columns.recurrenceParentId),
    stableIdCheck("superseded_by")(columns.supersededBy),
  ],
) {}

/**
 * Encoded form of {@link ActionItemResponse}.
 *
 * @see {@link ActionItemResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionItemResponse {
  export type Encoded = S.Codec.Encoded<typeof ActionItemResponse>;
}

const decodeActionItemResponse = S.decodeUnknownEffect(ActionItemResponse);

/**
 * Projects a legacy client dict into {@link ActionItemResponse}.
 *
 * **Details**
 *
 * When `taskId` is absent, it is copied from `id`. When `status` is absent and
 * `completed` is present, a truthy `deleted` flag becomes `cancelled`; otherwise
 * completed becomes `completed` or `active`. When `completed` is absent and
 * `status` is present, `completed` is true only for `completed`. Missing owner,
 * source, and provenance become `unknown`, `legacy`, and an empty list.
 * `deleted` is not a stored field.
 *
 * **Example** (Map a deleted legacy row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { projectLegacyActionItem } from "@beep/scratchpad/beep/ActionItem"
 *
 * const row = Effect.runSync(
 *   projectLegacyActionItem({ id: "task-1", description: "Old", completed: true, deleted: true }),
 * )
 * console.log(row.status) // "cancelled"
 * console.log(row.taskId) // { _id: "Option", _tag: "Some", value: "task-1" }
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const projectLegacyActionItem = Effect.fn("ActionItemResponse.projectLegacyFields")(function* (
  input: unknown,
) {
  if (!P.isObject(input) || A.isArray(input)) {
    return yield* decodeActionItemResponse(input);
  }
  const data: { [key: string]: unknown } = { ...input };
  if (data.taskId === undefined && data.id !== undefined) data.taskId = data.id;
  const hasStatus = data.status !== undefined;
  const hasCompleted = data.completed !== undefined;
  if (!hasStatus && hasCompleted) {
    data.status = data.deleted === true ? cancelledStatus : data.completed === true ? completedStatus : activeStatus;
  }
  if (!hasCompleted && hasStatus) data.completed = data.status === completedStatus;
  if (data.owner === undefined) data.owner = "unknown";
  if (data.source === undefined) data.source = "legacy";
  if (data.provenance === undefined) data.provenance = [];
  if (data.sortOrder === undefined) data.sortOrder = 0;
  if (data.indentLevel === undefined) data.indentLevel = 0;
  if (data.isLocked === undefined) data.isLocked = false;
  if (data.exported === undefined) data.exported = false;
  if (data.status === undefined) data.status = activeStatus;
  const wire: unknown = data;
  return yield* decodeActionItemResponse(wire);
});

/**
 * List envelope for action items.
 *
 * **Details**
 *
 * `truncated` is set only when the list-read budget ends the scan early. Such
 * pages may not be a complete prefix, so callers also force `hasMore`. That
 * force is not a validator on this model.
 *
 * **Example** (Construct an empty page)
 *
 * ```ts
 * import { ActionItemsResponse } from "@beep/scratchpad/beep/ActionItem"
 *
 * const page = ActionItemsResponse.make({ actionItems: [] })
 * console.log(page.hasMore) // false
 * console.log(page.truncated) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionItemsResponse extends Model<ActionItemsResponse>("ActionItemsResponse")(
  {
    actionItems: S.Array(ActionItemResponse).pipe(pg.jsonb(), pg.columnName("action_items")),
    hasMore: boolDefault("has_more", false),
    truncated: boolDefault("truncated", false),
  },
  $I.annote("ActionItemsResponse", {
    description: "Workflow action-item list page. Truncation does not itself force hasMore.",
  }),
) {}

/**
 * Encoded form of {@link ActionItemsResponse}.
 *
 * @see {@link ActionItemsResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionItemsResponse {
  export type Encoded = S.Codec.Encoded<typeof ActionItemsResponse>;
}

/**
 * Search envelope containing only the matching action items.
 *
 * **Example** (Decode an empty search)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ActionItemsSearchResponse } from "@beep/scratchpad/beep/ActionItem"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ActionItemsSearchResponse)({ actionItems: [] }))
 * console.log(decoded.actionItems.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionItemsSearchResponse extends Model<ActionItemsSearchResponse>("ActionItemsSearchResponse")(
  {
    actionItems: S.Array(ActionItemResponse).pipe(pg.jsonb(), pg.columnName("action_items")),
  },
  $I.annote("ActionItemsSearchResponse", {
    description: "Workflow action items matched by a search.",
  }),
) {}

/**
 * Encoded form of {@link ActionItemsSearchResponse}.
 *
 * @see {@link ActionItemsSearchResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionItemsSearchResponse {
  export type Encoded = S.Codec.Encoded<typeof ActionItemsSearchResponse>;
}

/**
 * Action items that belong to one conversation.
 *
 * **Details**
 *
 * Conversation is upstream of memory and is not itself a memory. This envelope
 * only groups Workflow rows by that upstream id.
 *
 * **Example** (Name the conversation)
 *
 * ```ts
 * import { ConversationActionItemsResponse } from "@beep/scratchpad/beep/ActionItem"
 *
 * const page = ConversationActionItemsResponse.make({ actionItems: [], conversationId: "conv-1" })
 * console.log(page.conversationId) // "conv-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationActionItemsResponse extends Model<ConversationActionItemsResponse>(
  "ConversationActionItemsResponse",
)(
  {
    actionItems: S.Array(ActionItemResponse).pipe(pg.jsonb(), pg.columnName("action_items")),
    conversationId: text("conversation_id"),
  },
  $I.annote("ConversationActionItemsResponse", {
    description: "Workflow action items linked to one upstream conversation.",
  }),
) {}

/**
 * Encoded form of {@link ConversationActionItemsResponse}.
 *
 * @see {@link ConversationActionItemsResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationActionItemsResponse {
  export type Encoded = S.Codec.Encoded<typeof ConversationActionItemsResponse>;
}

/**
 * Action items waiting to export and action items already synced.
 *
 * **Example** (Construct empty sync buckets)
 *
 * ```ts
 * import { PendingSyncResponse } from "@beep/scratchpad/beep/ActionItem"
 *
 * const sync = PendingSyncResponse.make({ pendingExport: [], syncedItems: [] })
 * console.log(sync.pendingExport.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PendingSyncResponse extends Model<PendingSyncResponse>("PendingSyncResponse")(
  {
    pendingExport: S.Array(ActionItemResponse).pipe(pg.jsonb(), pg.columnName("pending_export")),
    syncedItems: S.Array(ActionItemResponse).pipe(pg.jsonb(), pg.columnName("synced_items")),
  },
  $I.annote("PendingSyncResponse", {
    description: "Workflow action items waiting for export and those already synced.",
  }),
) {}

/**
 * Encoded form of {@link PendingSyncResponse}.
 *
 * @see {@link PendingSyncResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PendingSyncResponse {
  export type Encoded = S.Codec.Encoded<typeof PendingSyncResponse>;
}

/**
 * Candidate task-create payload. Envelope metadata is intentionally absent.
 *
 * **Details**
 *
 * `owner` constructs as `unknown`, not the create-contract default `user`.
 *
 * **Example** (Default the owner to unknown)
 *
 * ```ts
 * import { TaskCreatePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const payload = TaskCreatePayload.make({ description: "Call back" })
 * console.log(payload.owner) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskCreatePayload extends Model<TaskCreatePayload>("TaskCreatePayload")(
  {
    description: descriptionText,
    owner: ownerColumn("owner", "unknown"),
    dueAt: optionalAware("due_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    priority: optionalPriority("priority"),
    recurrenceRule: optionalBoundedText("recurrence_rule", { maxLength: 128 }),
    recurrenceParentId: optionalStableId("recurrence_parent_id"),
  },
  $I.annote("TaskCreatePayload", {
    description: "Candidate Workflow task-create payload without envelope metadata.",
  }),
  (columns) => [
    textBoundsCheck("description", { minLength: 1, maxLength: 4096 })(columns.description),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    textBoundsCheck("recurrence_rule", { maxLength: 128 })(columns.recurrenceRule),
    stableIdCheck("recurrence_parent_id")(columns.recurrenceParentId),
  ],
) {}

/**
 * Encoded form of {@link TaskCreatePayload}.
 *
 * @see {@link TaskCreatePayload} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskCreatePayload {
  export type Encoded = S.Codec.Encoded<typeof TaskCreatePayload>;
}

/**
 * Candidate task mutation. At least one field must be present.
 *
 * **Example** (Patch only the description)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskChangePayload } from "@beep/scratchpad/beep/ActionItem"
 *
 * const change = TaskChangePayload.make({ description: O.some("Call back tomorrow") })
 * console.log(O.getOrNull(change.description)) // "Call back tomorrow"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskChangePayload extends Model<TaskChangePayload>("TaskChangePayload")(
  {
    description: optionalDescription,
    status: optionalStatus("status"),
    owner: optionalOwner("owner"),
    dueAt: optionalAware("due_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    priority: optionalPriority("priority"),
    recurrenceRule: optionalBoundedText("recurrence_rule", { maxLength: 128 }),
    recurrenceParentId: optionalStableId("recurrence_parent_id"),
    supersededBy: optionalStableId("superseded_by"),
  },
  $I.annote("TaskChangePayload", {
    description: "Candidate Workflow task change. At least one field is required.",
  }),
  (columns) => [
    textBoundsCheck("description", { minLength: 1, maxLength: 4096 })(columns.description),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    textBoundsCheck("recurrence_rule", { maxLength: 128 })(columns.recurrenceRule),
    stableIdCheck("recurrence_parent_id")(columns.recurrenceParentId),
    stableIdCheck("superseded_by")(columns.supersededBy),
  ],
) {}

/**
 * Encoded form of {@link TaskChangePayload}.
 *
 * @see {@link TaskChangePayload} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskChangePayload {
  export type Encoded = S.Codec.Encoded<typeof TaskChangePayload>;
}

/**
 * Rejects a task change that sets no field.
 *
 * **Example** (Reject an empty change)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { TaskChangePayload, requireTaskChange } from "@beep/scratchpad/beep/ActionItem"
 *
 * const failed = Effect.runSyncExit(requireTaskChange(TaskChangePayload.make({})))._tag
 * console.log(failed) // "Failure"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const requireTaskChange = (change: TaskChangePayload): Effect.Effect<TaskChangePayload, TaskFieldConflict> => {
  const set =
    O.isSome(change.description) ||
    O.isSome(change.status) ||
    O.isSome(change.owner) ||
    O.isSome(change.dueAt) ||
    O.isSome(change.dueConfidence) ||
    O.isSome(change.priority) ||
    O.isSome(change.recurrenceRule) ||
    O.isSome(change.recurrenceParentId) ||
    O.isSome(change.supersededBy);
  return set
    ? Effect.succeed(change)
    : Effect.fail(TaskFieldConflict.make({ message: "task change requires at least one field" }));
};
