/**
 * Canonical backend-owned workstream, journal, artifact, and checkpoint contracts.
 *
 * **Details**
 *
 * Workstreams, their journal events, artifacts, checkpoints, and work
 * intents are Workflow, not a memory layer. Conversation is upstream of
 * memory and of workstreams; a workstream event may cite a conversation as
 * evidence, but neither is a memory. Action items and goals referenced here
 * ({@link ActionItemResponse}, {@link GoalResponse}) are Workflow too.
 *
 * **Gotchas**
 *
 * Every Python model in this module except {@link TaskGoalLinkImportReport}
 * is `extra='forbid'`. Effect strips unknown keys unless decode uses
 * `{ onExcessProperty: "error" }`; use that option to match the Python
 * behaviour. {@link WorkIntentRequest} is the only shape-splitting union:
 * `origin` selects which of title and objective are required.
 *
 * @since 0.0.0
 */
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as Utils from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { ActionItemResponse, EvidenceRef } from "./ActionItem.ts";
import { GoalProgressEvent, GoalResponse } from "./Goal.ts";
import {
  Model,
  StableId,
  UtcTimestamp,
  bool,
  boundedText,
  optionalStableId,
  optionalTimestamp,
  pg,
  stableId,
  stableIdCheck,
  textBoundsCheck,
  timestamp,
} from "./Kit.ts";
import { atLeastCheck, intAtLeast, jsonbArrayLengthCheck } from "./Port.ts";

const $I = $ScratchpadId.create("beep/Workstream");

const kit = <const L extends Utils.NonEmptyReadonlyArray<string>>(name: string, description: string, literals: L) =>
  LiteralKit(literals).pipe($I.annoteSchema(name, { description }));

const doc = (name: string, description: string) => $I.annote(name, { description });

const noEvidence = (): ReadonlyArray<EvidenceRef> => [];

const noStableIds = (): ReadonlyArray<StableId> => [];

const evidenceList = (column: string) =>
  S.Array(EvidenceRef)
    .check(S.isMaxLength(50))
    .pipe(S.withConstructorDefault(Effect.sync(noEvidence)), pg.jsonb(), pg.columnName(column));

const stableIdList = (column: string, maximum: number) =>
  S.Array(StableId)
    .check(S.isMaxLength(maximum))
    .pipe(S.withConstructorDefault(Effect.sync(noStableIds)), pg.jsonb(), pg.columnName(column));

const summaryText = (column: string) =>
  S.String.check(S.isMaxLength(4000)).pipe(S.withConstructorDefault(Effect.succeed("")), pg.text(), pg.columnName(column));

const intAtLeastDefault = (column: string, minimum: number, fallback: number) =>
  S.Int.check(S.isGreaterThanOrEqualTo(minimum)).pipe(
    S.withConstructorDefault(Effect.succeed(fallback)),
    pg.integer(),
    pg.columnName(column),
  );

const modelList = <A extends S.Top>(schema: A, column: string) =>
  S.Array(schema).pipe(pg.jsonb(), pg.columnName(column));

/**
 * A workstream contract rule failed.
 *
 * **Example** (Read the message)
 *
 * ```ts
 * import { WorkstreamContractError } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(WorkstreamContractError.make({ message: "no" }).message) // "no"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkstreamContractError extends S.TaggedError<WorkstreamContractError>()(
  "WorkstreamContractError",
  { message: S.String },
  $I.annoteError("WorkstreamContractError", { description: "A workstream patch or contract rule failed." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamContractError {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamContractError>;
}

/**
 * Lifecycle status of a workstream.
 *
 * **Example** (Decode open)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { WorkstreamStatus } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(WorkstreamStatus)("open"))) // "open"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkstreamStatus = kit("WorkstreamStatus", "Workstream lifecycle status.", [
  "open",
  "paused",
  "completed",
  "archived",
]);

/** @category type-level @since 0.0.0 */
export type WorkstreamStatus = typeof WorkstreamStatus.Type;
/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamStatus {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamStatus>;
}

/**
 * Kind of a workstream journal event.
 *
 * **Example** (Decode a decision)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { WorkstreamEventKind } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(WorkstreamEventKind)("decision"))) // "decision"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkstreamEventKind = kit("WorkstreamEventKind", "Workstream journal event kind.", [
  "user_note",
  "conversation",
  "message",
  "screen_observation",
  "task_change",
  "decision",
  "agent_update",
  "artifact_version",
  "external_update",
  "system",
]);

/** @category type-level @since 0.0.0 */
export type WorkstreamEventKind = typeof WorkstreamEventKind.Type;
/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamEventKind {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamEventKind>;
}

/**
 * Sensitivity of a workstream journal event.
 *
 * **Example** (Decode restricted)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { WorkstreamSensitivity } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(WorkstreamSensitivity)("restricted"))) // "restricted"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkstreamSensitivity = kit("WorkstreamSensitivity", "Workstream event sensitivity.", [
  "normal",
  "sensitive",
  "restricted",
]);

/** @category type-level @since 0.0.0 */
export type WorkstreamSensitivity = typeof WorkstreamSensitivity.Type;
/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamSensitivity {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamSensitivity>;
}

/**
 * Review status of a workstream artifact.
 *
 * **Example** (Decode draft)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ArtifactStatus } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(ArtifactStatus)("draft"))) // "draft"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArtifactStatus = kit("ArtifactStatus", "Artifact review status.", [
  "draft",
  "awaiting_review",
  "approved",
  "delivered",
  "superseded",
]);

/** @category type-level @since 0.0.0 */
export type ArtifactStatus = typeof ArtifactStatus.Type;
/** @category type-level @since 0.0.0 */
export declare namespace ArtifactStatus {
  export type Encoded = S.Codec.Encoded<typeof ArtifactStatus>;
}

/**
 * Request body that creates a workstream.
 *
 * **Details**
 *
 * `currentStateSummary` constructs as an empty string when omitted; decode
 * still requires the key. `goalId` links the new workstream to a Workflow
 * goal, not to a memory.
 *
 * **Example** (Construct with the summary default)
 *
 * ```ts
 * import { WorkstreamCreate } from "@beep/scratchpad/beep/Workstream"
 *
 * const create = WorkstreamCreate.make({ title: "Launch", objective: "Ship v2" })
 * console.log(create.currentStateSummary) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamCreate extends Model<WorkstreamCreate>("WorkstreamCreate")(
  {
    title: boundedText("title", { minLength: 1, maxLength: 256 }),
    objective: boundedText("objective", { minLength: 1, maxLength: 2048 }),
    goalId: optionalStableId("goal_id"),
    currentStateSummary: summaryText("current_state_summary"),
    nextReviewAt: optionalTimestamp("next_review_at"),
  },
  doc("WorkstreamCreate", "Workstream create request. current_state_summary constructs as empty."),
  (columns) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
    stableIdCheck("goal_id")(columns.goalId),
    textBoundsCheck("current_state_summary", { maxLength: 4000 })(columns.currentStateSummary),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamCreate {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamCreate>;
}

const patchTitle = S.OptionFromOptionalKey(S.String.check(S.isMinLength(1), S.isMaxLength(256))).pipe(
  SchemaUtils.withNoneDefault,
  pg.text(),
  pg.columnName("title"),
);

const patchObjective = S.OptionFromOptionalKey(S.String.check(S.isMinLength(1), S.isMaxLength(2048))).pipe(
  SchemaUtils.withNoneDefault,
  pg.text(),
  pg.columnName("objective"),
);

const patchStatus = S.OptionFromOptionalKey(WorkstreamStatus).pipe(
  SchemaUtils.withNoneDefault,
  pg.text(),
  pg.columnName("status"),
);

const patchSummary = S.OptionFromOptionalKey(S.String.check(S.isMaxLength(4000))).pipe(
  SchemaUtils.withNoneDefault,
  pg.text(),
  pg.columnName("current_state_summary"),
);

const patchNextReviewAt = UtcTimestamp.pipe(
  S.OptionFromNullOr,
  S.OptionFromOptionalKey,
  SchemaUtils.withNoneDefault,
  pg.timestamp({ mode: "string", withTimezone: true }),
  pg.columnName("next_review_at"),
);

/**
 * Patch body that updates a workstream.
 *
 * **Details**
 *
 * Python's `Optional` here is not uniformly nullish: `model_fields_set`
 * distinguishes an omitted key from an explicit null. `title`, `objective`,
 * `status`, and `currentStateSummary` are optional keys whose value cannot
 * be null; a present null fails to decode. `nextReviewAt` is nested: the
 * outer `None` means the key was omitted, `Some(None)` is an explicit null
 * that clears the review time, and `Some(Some(instant))` sets it.
 *
 * **Gotchas**
 *
 * The class itself does not enforce the at-least-one-field rule so that a
 * caller can construct an empty patch and inspect it.
 * {@link WorkstreamUpdateChecked} adds `require_explicit_valid_patch` as a
 * schema check, and {@link requireExplicitValidPatch} is the effectful form.
 *
 * **Example** (Decode a clear of the review time)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { WorkstreamUpdate } from "@beep/scratchpad/beep/Workstream"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(WorkstreamUpdate)({ nextReviewAt: null }))
 * console.log(O.isSome(decoded.nextReviewAt) && O.isNone(decoded.nextReviewAt.value)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamUpdate extends Model<WorkstreamUpdate>("WorkstreamUpdate")(
  {
    title: patchTitle,
    objective: patchObjective,
    status: patchStatus,
    currentStateSummary: patchSummary,
    nextReviewAt: patchNextReviewAt,
  },
  doc("WorkstreamUpdate", "Workstream patch. Omitted keys are None; next_review_at null clears."),
  (columns) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
    textBoundsCheck("current_state_summary", { maxLength: 4000 })(columns.currentStateSummary),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamUpdate {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamUpdate>;
}

const patchIsSet = (patch: WorkstreamUpdate): boolean =>
  O.isSome(patch.title) ||
  O.isSome(patch.objective) ||
  O.isSome(patch.status) ||
  O.isSome(patch.currentStateSummary) ||
  O.isSome(patch.nextReviewAt);

const explicitPatchFilter = S.makeFilter((patch: WorkstreamUpdate) =>
  patchIsSet(patch) ? undefined : "at least one workstream field is required",
);

/**
 * {@link WorkstreamUpdate} with `require_explicit_valid_patch` applied.
 *
 * **Details**
 *
 * At least one field must be set. The null ban on `title`, `objective`,
 * `status`, and `currentStateSummary` is already part of the field schemas,
 * so this check only adds the emptiness rule.
 *
 * **Example** (Reject an empty patch)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { WorkstreamUpdateChecked } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(Effect.runSyncExit(S.decodeUnknownEffect(WorkstreamUpdateChecked)({}))._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkstreamUpdateChecked = WorkstreamUpdate.check(explicitPatchFilter);

/**
 * Port of `WorkstreamUpdate.require_explicit_valid_patch`.
 *
 * **Details**
 *
 * Fails with {@link WorkstreamContractError} when no field is set. The
 * per-field null ban cannot be reached on a decoded value because the field
 * schemas reject null, so the effect only checks emptiness.
 *
 * **Example** (Accept a status patch)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { WorkstreamUpdate, requireExplicitValidPatch } from "@beep/scratchpad/beep/Workstream"
 *
 * const patch = WorkstreamUpdate.make({ status: O.some("paused") })
 * console.log(Effect.runSync(requireExplicitValidPatch(patch)).status) // { _id: "Option", _tag: "Some", value: "paused" }
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const requireExplicitValidPatch = Effect.fn("WorkstreamUpdate.requireExplicitValidPatch")(function* (
  patch: WorkstreamUpdate,
) {
  if (!patchIsSet(patch)) {
    return yield* WorkstreamContractError.make({ message: "at least one workstream field is required" });
  }
  return patch;
});

/**
 * Stored workstream row.
 *
 * **Details**
 *
 * A workstream is a Workflow thread with an objective, a rolling state
 * summary, and a journal whose latest sequence is `latestEventSequence`.
 * It is not a memory and does not carry memory layer, status, or processing
 * state axes. `goalId` links to a Workflow goal.
 *
 * **Example** (Construct with the sequence default)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Workstream } from "@beep/scratchpad/beep/Workstream"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05Z")
 * const row = Workstream.make({
 *   workstreamId: "ws-1",
 *   title: "Launch",
 *   objective: "Ship v2",
 *   status: "open",
 *   createdAt: now,
 *   updatedAt: now,
 * })
 * console.log(row.latestEventSequence) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Workstream extends Model<Workstream>("Workstream")(
  {
    workstreamId: stableId("workstream_id"),
    goalId: optionalStableId("goal_id"),
    title: boundedText("title", { minLength: 1, maxLength: 256 }),
    objective: boundedText("objective", { minLength: 1, maxLength: 2048 }),
    status: WorkstreamStatus.pipe(pg.text(), pg.columnName("status")),
    currentStateSummary: summaryText("current_state_summary"),
    nextReviewAt: optionalTimestamp("next_review_at"),
    lastMeaningfulProgressAt: optionalTimestamp("last_meaningful_progress_at"),
    latestEventSequence: intAtLeastDefault("latest_event_sequence", 0, 0),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  doc("Workstream", "Stored workstream. latest_event_sequence constructs as 0."),
  (columns) => [
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("goal_id")(columns.goalId),
    textBoundsCheck("title", { minLength: 1, maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
    textBoundsCheck("current_state_summary", { maxLength: 4000 })(columns.currentStateSummary),
    atLeastCheck("latest_event_sequence", 0)(columns.latestEventSequence),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace Workstream {
  export type Encoded = S.Codec.Encoded<typeof Workstream>;
}

/**
 * Request body that appends a journal event.
 *
 * **Details**
 *
 * `sensitivity` constructs as `normal` when omitted. `evidenceRefs` constructs
 * as an empty list and holds at most 50 refs.
 *
 * **Example** (Construct with the defaults)
 *
 * ```ts
 * import { WorkstreamEventCreate } from "@beep/scratchpad/beep/Workstream"
 *
 * const event = WorkstreamEventCreate.make({ kind: "user_note", summary: "Talked to Ada" })
 * console.log(event.sensitivity) // "normal"
 * console.log(event.evidenceRefs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamEventCreate extends Model<WorkstreamEventCreate>("WorkstreamEventCreate")(
  {
    kind: WorkstreamEventKind.pipe(pg.text(), pg.columnName("kind")),
    summary: boundedText("summary", { minLength: 1, maxLength: 2000 }),
    evidenceRefs: evidenceList("evidence_refs"),
    sensitivity: WorkstreamSensitivity.pipe(
      S.withConstructorDefault(Effect.succeed("normal")),
      pg.text(),
      pg.columnName("sensitivity"),
    ),
  },
  doc("WorkstreamEventCreate", "Journal event create request. sensitivity constructs as normal."),
  (columns) => [
    textBoundsCheck("summary", { minLength: 1, maxLength: 2000 })(columns.summary),
    jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamEventCreate {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamEventCreate>;
}

/**
 * Stored journal event.
 *
 * **Details**
 *
 * `sequence` starts at 1 and orders events within one workstream. The stored
 * row has no `sensitivity` default: every event carries the value chosen at
 * creation time.
 *
 * **Example** (Read the sequence field)
 *
 * ```ts
 * import { WorkstreamEvent } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(WorkstreamEvent.fields.sequence !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamEvent extends Model<WorkstreamEvent>("WorkstreamEvent")(
  {
    eventId: stableId("event_id"),
    workstreamId: stableId("workstream_id"),
    sequence: intAtLeast("sequence", 1),
    kind: WorkstreamEventKind.pipe(pg.text(), pg.columnName("kind")),
    summary: boundedText("summary", { minLength: 1, maxLength: 2000 }),
    evidenceRefs: evidenceList("evidence_refs"),
    sensitivity: WorkstreamSensitivity.pipe(pg.text(), pg.columnName("sensitivity")),
    createdAt: timestamp("created_at"),
  },
  doc("WorkstreamEvent", "Stored journal event. sequence starts at 1."),
  (columns) => [
    stableIdCheck("event_id")(columns.eventId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    atLeastCheck("sequence", 1)(columns.sequence),
    textBoundsCheck("summary", { minLength: 1, maxLength: 2000 })(columns.summary),
    jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamEvent {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamEvent>;
}

const artifactDescriptorCreateFields = {
  logicalKey: boundedText("logical_key", { minLength: 1, maxLength: 256 }),
  version: intAtLeast("version", 1),
  supersedesArtifactId: optionalStableId("supersedes_artifact_id"),
  kind: boundedText("kind", { minLength: 1, maxLength: 64 }),
  uri: boundedText("uri", { minLength: 1, maxLength: 2048 }),
  contentHash: boundedText("content_hash", { minLength: 16, maxLength: 128 }),
  sourceRunId: optionalStableId("source_run_id"),
  evidenceEventIds: stableIdList("evidence_event_ids", 100),
  evidenceRefs: evidenceList("evidence_refs"),
} as const;

const artifactDescriptorCreateChecks = (columns: {
  readonly logicalKey: ExtraConfigColumn;
  readonly version: ExtraConfigColumn;
  readonly supersedesArtifactId: ExtraConfigColumn;
  readonly kind: ExtraConfigColumn;
  readonly uri: ExtraConfigColumn;
  readonly contentHash: ExtraConfigColumn;
  readonly sourceRunId: ExtraConfigColumn;
  readonly evidenceEventIds: ExtraConfigColumn;
  readonly evidenceRefs: ExtraConfigColumn;
}) => [
  textBoundsCheck("logical_key", { minLength: 1, maxLength: 256 })(columns.logicalKey),
  atLeastCheck("version", 1)(columns.version),
  stableIdCheck("supersedes_artifact_id")(columns.supersedesArtifactId),
  textBoundsCheck("kind", { minLength: 1, maxLength: 64 })(columns.kind),
  textBoundsCheck("uri", { minLength: 1, maxLength: 2048 })(columns.uri),
  textBoundsCheck("content_hash", { minLength: 16, maxLength: 128 })(columns.contentHash),
  stableIdCheck("source_run_id")(columns.sourceRunId),
  jsonbArrayLengthCheck("evidence_event_ids", { maximum: 100 })(columns.evidenceEventIds),
  jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
];

/**
 * Request body that registers an artifact version.
 *
 * **Details**
 *
 * `kind` is an open string (1..64), not {@link WorkstreamEventKind} and not
 * {@link ArtifactStatus}. `version` starts at 1. `evidenceEventIds` holds at
 * most 100 ids and `evidenceRefs` at most 50 refs; both construct as empty.
 *
 * **Example** (Construct with empty evidence)
 *
 * ```ts
 * import { ArtifactDescriptorCreate } from "@beep/scratchpad/beep/Workstream"
 *
 * const create = ArtifactDescriptorCreate.make({
 *   logicalKey: "spec",
 *   version: 1,
 *   kind: "document",
 *   uri: "gs://bucket/spec.md",
 *   contentHash: "0123456789abcdef",
 * })
 * console.log(create.evidenceEventIds.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactDescriptorCreate extends Model<ArtifactDescriptorCreate>("ArtifactDescriptorCreate")(
  artifactDescriptorCreateFields,
  doc("ArtifactDescriptorCreate", "Artifact version create request. kind is an open string."),
  artifactDescriptorCreateChecks,
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ArtifactDescriptorCreate {
  export type Encoded = S.Codec.Encoded<typeof ArtifactDescriptorCreate>;
}

/**
 * Stored artifact version.
 *
 * **Details**
 *
 * Extends {@link ArtifactDescriptorCreate} with identity and review status.
 * `status` constructs as `draft`. There is no transition graph in this
 * model; {@link ArtifactStatusTransitionRequest} carries a target status only.
 *
 * **Example** (Read the status default)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { ArtifactDescriptor } from "@beep/scratchpad/beep/Workstream"
 *
 * const row = ArtifactDescriptor.make({
 *   artifactId: "art-1",
 *   workstreamId: "ws-1",
 *   logicalKey: "spec",
 *   version: 1,
 *   kind: "document",
 *   uri: "gs://bucket/spec.md",
 *   contentHash: "0123456789abcdef",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 * })
 * console.log(row.status) // "draft"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactDescriptor extends Model<ArtifactDescriptor>("ArtifactDescriptor")(
  {
    ...artifactDescriptorCreateFields,
    artifactId: stableId("artifact_id"),
    workstreamId: stableId("workstream_id"),
    status: ArtifactStatus.pipe(S.withConstructorDefault(Effect.succeed("draft")), pg.text(), pg.columnName("status")),
    createdAt: timestamp("created_at"),
  },
  doc("ArtifactDescriptor", "Stored artifact version. status constructs as draft."),
  (columns) => [
    ...artifactDescriptorCreateChecks(columns),
    stableIdCheck("artifact_id")(columns.artifactId),
    stableIdCheck("workstream_id")(columns.workstreamId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ArtifactDescriptor {
  export type Encoded = S.Codec.Encoded<typeof ArtifactDescriptor>;
}

/**
 * Request body that moves an artifact to a new status.
 *
 * **Gotchas**
 *
 * No transition graph lives in this model. Any {@link ArtifactStatus} is a
 * legal request value.
 *
 * **Example** (Decode approved)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ArtifactStatusTransitionRequest } from "@beep/scratchpad/beep/Workstream"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ArtifactStatusTransitionRequest)({ status: "approved" }))
 * console.log(decoded.status) // "approved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactStatusTransitionRequest extends Model<ArtifactStatusTransitionRequest>(
  "ArtifactStatusTransitionRequest",
)(
  { status: ArtifactStatus.pipe(pg.text(), pg.columnName("status")) },
  doc("ArtifactStatusTransitionRequest", "Artifact status transition request."),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ArtifactStatusTransitionRequest {
  export type Encoded = S.Codec.Encoded<typeof ArtifactStatusTransitionRequest>;
}

const continuationCheckpointUpsertFields = {
  runtimeId: stableId("runtime_id"),
  lastEventSequence: intAtLeast("last_event_sequence", 0),
  contextSummary: boundedText("context_summary", { maxLength: 4000 }),
  evidenceRefs: evidenceList("evidence_refs"),
} as const;

const continuationCheckpointUpsertChecks = (columns: {
  readonly runtimeId: ExtraConfigColumn;
  readonly lastEventSequence: ExtraConfigColumn;
  readonly contextSummary: ExtraConfigColumn;
  readonly evidenceRefs: ExtraConfigColumn;
}) => [
  stableIdCheck("runtime_id")(columns.runtimeId),
  atLeastCheck("last_event_sequence", 0)(columns.lastEventSequence),
  textBoundsCheck("context_summary", { maxLength: 4000 })(columns.contextSummary),
  jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
];

/**
 * Request body that upserts a runtime continuation checkpoint.
 *
 * **Details**
 *
 * `contextSummary` may be empty but is at most 4000 characters.
 * `lastEventSequence` is the journal sequence the runtime has consumed and
 * may be 0.
 *
 * **Example** (Construct with an empty summary)
 *
 * ```ts
 * import { ContinuationCheckpointUpsert } from "@beep/scratchpad/beep/Workstream"
 *
 * const upsert = ContinuationCheckpointUpsert.make({ runtimeId: "rt-1", lastEventSequence: 0, contextSummary: "" })
 * console.log(upsert.evidenceRefs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContinuationCheckpointUpsert extends Model<ContinuationCheckpointUpsert>("ContinuationCheckpointUpsert")(
  continuationCheckpointUpsertFields,
  doc("ContinuationCheckpointUpsert", "Continuation checkpoint upsert. context_summary may be empty."),
  continuationCheckpointUpsertChecks,
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ContinuationCheckpointUpsert {
  export type Encoded = S.Codec.Encoded<typeof ContinuationCheckpointUpsert>;
}

/**
 * Stored continuation checkpoint.
 *
 * **Details**
 *
 * Extends {@link ContinuationCheckpointUpsert} with identity and the update
 * instant.
 *
 * **Example** (Read the identity fields)
 *
 * ```ts
 * import { ContinuationCheckpoint } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(ContinuationCheckpoint.fields.checkpointId !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContinuationCheckpoint extends Model<ContinuationCheckpoint>("ContinuationCheckpoint")(
  {
    ...continuationCheckpointUpsertFields,
    checkpointId: stableId("checkpoint_id"),
    workstreamId: stableId("workstream_id"),
    updatedAt: timestamp("updated_at"),
  },
  doc("ContinuationCheckpoint", "Stored continuation checkpoint."),
  (columns) => [
    ...continuationCheckpointUpsertChecks(columns),
    stableIdCheck("checkpoint_id")(columns.checkpointId),
    stableIdCheck("workstream_id")(columns.workstreamId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ContinuationCheckpoint {
  export type Encoded = S.Codec.Encoded<typeof ContinuationCheckpoint>;
}

const optionalBoundedPatchText = (column: string, maxLength: number) =>
  S.OptionFromOptionalKey(S.String.check(S.isMaxLength(maxLength))).pipe(
    SchemaUtils.withNoneDefault,
    pg.text(),
    pg.columnName(column),
  );

/**
 * Work intent whose origin is an existing task.
 *
 * **Details**
 *
 * `origin` is the tag `task`. `title` and `objective` are optional here; the
 * goal-origin variant requires them. Python `Optional[str] = None` on these
 * two admits an omitted key; a present null is not a legal wire value for the
 * bounded string, so both are modeled as optional keys.
 *
 * **Example** (Construct with the tag default)
 *
 * ```ts
 * import { TaskOriginWorkIntent } from "@beep/scratchpad/beep/Workstream"
 *
 * const intent = TaskOriginWorkIntent.make({ taskId: "task-1" })
 * console.log(intent.origin) // "task"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskOriginWorkIntent extends Model<TaskOriginWorkIntent>("TaskOriginWorkIntent")(
  {
    origin: S.tag("task").pipe(pg.text(), pg.columnName("origin")),
    taskId: stableId("task_id"),
    title: optionalBoundedPatchText("title", 256),
    objective: optionalBoundedPatchText("objective", 2048),
  },
  doc("TaskOriginWorkIntent", "Work intent from an existing task. Title and objective are optional."),
  (columns) => [
    stableIdCheck("task_id")(columns.taskId),
    textBoundsCheck("title", { maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { maxLength: 2048 })(columns.objective),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace TaskOriginWorkIntent {
  export type Encoded = S.Codec.Encoded<typeof TaskOriginWorkIntent>;
}

/**
 * Work intent whose origin is a goal.
 *
 * **Details**
 *
 * `origin` is the tag `goal`. Every field is required, including the
 * description of the anchor task the workstream starts from.
 *
 * **Example** (Construct with the tag default)
 *
 * ```ts
 * import { GoalOriginWorkIntent } from "@beep/scratchpad/beep/Workstream"
 *
 * const intent = GoalOriginWorkIntent.make({
 *   goalId: "goal-1",
 *   title: "Launch",
 *   objective: "Ship v2",
 *   anchorTaskDescription: "Write the launch plan",
 * })
 * console.log(intent.origin) // "goal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalOriginWorkIntent extends Model<GoalOriginWorkIntent>("GoalOriginWorkIntent")(
  {
    origin: S.tag("goal").pipe(pg.text(), pg.columnName("origin")),
    goalId: stableId("goal_id"),
    title: boundedText("title", { minLength: 1, maxLength: 256 }),
    objective: boundedText("objective", { minLength: 1, maxLength: 2048 }),
    anchorTaskDescription: boundedText("anchor_task_description", { minLength: 1, maxLength: 2000 }),
  },
  doc("GoalOriginWorkIntent", "Work intent from a goal. Every field is required."),
  (columns) => [
    stableIdCheck("goal_id")(columns.goalId),
    textBoundsCheck("title", { minLength: 1, maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
    textBoundsCheck("anchor_task_description", { minLength: 1, maxLength: 2000 })(columns.anchorTaskDescription),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace GoalOriginWorkIntent {
  export type Encoded = S.Codec.Encoded<typeof GoalOriginWorkIntent>;
}

/**
 * Work intent request discriminated on `origin`.
 *
 * **Details**
 *
 * This is the module's one shape-splitting union. A task origin makes title
 * and objective optional; a goal origin requires them plus an anchor task
 * description.
 *
 * **Example** (Decode a goal origin)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { WorkIntentRequest } from "@beep/scratchpad/beep/Workstream"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(WorkIntentRequest)({
 *     origin: "goal",
 *     goalId: "goal-1",
 *     title: "Launch",
 *     objective: "Ship v2",
 *     anchorTaskDescription: "Write the launch plan",
 *   }),
 * )
 * console.log(decoded.origin) // "goal"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkIntentRequest = LiteralKit(["task", "goal"])
  .mapMembers(Tuple.evolve([() => TaskOriginWorkIntent, () => GoalOriginWorkIntent]))
  .pipe(
    S.toTaggedUnion("origin"),
    $I.annoteSchema("WorkIntentRequest", {
      description: "Work intent whose origin selects the task or goal shape.",
    }),
  );

/** @category type-level @since 0.0.0 */
export type WorkIntentRequest = typeof WorkIntentRequest.Type;
/** @category type-level @since 0.0.0 */
export declare namespace WorkIntentRequest {
  export type Encoded = S.Codec.Encoded<typeof WorkIntentRequest>;
}

/**
 * Receipt for a resolved work intent.
 *
 * **Details**
 *
 * Not the union: a flat receipt. `taskId` is always present, even for a goal
 * origin, because resolving a goal intent creates or finds the anchor task.
 * `newlyCreated` says whether the workstream was created by this request.
 *
 * **Example** (Decode a goal-less receipt)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { WorkIntentReceipt } from "@beep/scratchpad/beep/Workstream"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(WorkIntentReceipt)({
 *     receiptId: "rcpt-1",
 *     workstreamId: "ws-1",
 *     taskId: "task-1",
 *     newlyCreated: true,
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(O.isNone(decoded.goalId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkIntentReceipt extends Model<WorkIntentReceipt>("WorkIntentReceipt")(
  {
    receiptId: stableId("receipt_id"),
    workstreamId: stableId("workstream_id"),
    taskId: stableId("task_id"),
    goalId: optionalStableId("goal_id"),
    newlyCreated: bool("newly_created"),
    createdAt: timestamp("created_at"),
  },
  doc("WorkIntentReceipt", "Work intent receipt. task_id is always present."),
  (columns) => [
    stableIdCheck("receipt_id")(columns.receiptId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("task_id")(columns.taskId),
    stableIdCheck("goal_id")(columns.goalId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkIntentReceipt {
  export type Encoded = S.Codec.Encoded<typeof WorkIntentReceipt>;
}

/**
 * Goal detail page projection.
 *
 * **Details**
 *
 * Joins a Workflow goal with its active workstreams, its tasks
 * ({@link ActionItemResponse}, not the legacy `task.py` shape), and its
 * progress events.
 *
 * **Example** (Read the projection fields)
 *
 * ```ts
 * import { GoalDetailProjection } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(GoalDetailProjection.fields.activeThreads !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDetailProjection extends Model<GoalDetailProjection>("GoalDetailProjection")(
  {
    goal: GoalResponse.pipe(pg.jsonb(), pg.columnName("goal")),
    activeThreads: modelList(Workstream, "active_threads"),
    tasks: modelList(ActionItemResponse, "tasks"),
    progressEvents: modelList(GoalProgressEvent, "progress_events"),
  },
  doc("GoalDetailProjection", "Goal detail projection with active workstreams, tasks, and progress events."),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace GoalDetailProjection {
  export type Encoded = S.Codec.Encoded<typeof GoalDetailProjection>;
}

/**
 * Workstream detail page projection.
 *
 * **Details**
 *
 * Joins a workstream with its recent journal events, tasks, artifacts, and
 * continuation checkpoints.
 *
 * **Example** (Read the projection fields)
 *
 * ```ts
 * import { WorkstreamDetailProjection } from "@beep/scratchpad/beep/Workstream"
 *
 * console.log(WorkstreamDetailProjection.fields.checkpoints !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamDetailProjection extends Model<WorkstreamDetailProjection>("WorkstreamDetailProjection")(
  {
    workstream: Workstream.pipe(pg.jsonb(), pg.columnName("workstream")),
    recentEvents: modelList(WorkstreamEvent, "recent_events"),
    tasks: modelList(ActionItemResponse, "tasks"),
    artifacts: modelList(ArtifactDescriptor, "artifacts"),
    checkpoints: modelList(ContinuationCheckpoint, "checkpoints"),
  },
  doc("WorkstreamDetailProjection", "Workstream detail projection with events, tasks, artifacts, and checkpoints."),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamDetailProjection {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamDetailProjection>;
}

/**
 * One task-to-goal link to import.
 *
 * **Example** (Decode a link)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskGoalLinkImport } from "@beep/scratchpad/beep/Workstream"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskGoalLinkImport)({ taskId: "task-1", goalId: "goal-1" }))
 * console.log(decoded.goalId) // "goal-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskGoalLinkImport extends Model<TaskGoalLinkImport>("TaskGoalLinkImport")(
  {
    taskId: stableId("task_id"),
    goalId: stableId("goal_id"),
  },
  doc("TaskGoalLinkImport", "One task-to-goal link."),
  (columns) => [stableIdCheck("task_id")(columns.taskId), stableIdCheck("goal_id")(columns.goalId)],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace TaskGoalLinkImport {
  export type Encoded = S.Codec.Encoded<typeof TaskGoalLinkImport>;
}

/**
 * Batch of task-to-goal links to import.
 *
 * **Details**
 *
 * `links` holds at most 500 entries and has no default: an empty batch must
 * be sent explicitly.
 *
 * **Example** (Decode an empty batch)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskGoalLinkImportRequest } from "@beep/scratchpad/beep/Workstream"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskGoalLinkImportRequest)({ links: [] }))
 * console.log(decoded.links.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskGoalLinkImportRequest extends Model<TaskGoalLinkImportRequest>("TaskGoalLinkImportRequest")(
  {
    links: S.Array(TaskGoalLinkImport).check(S.isMaxLength(500)).pipe(pg.jsonb(), pg.columnName("links")),
  },
  doc("TaskGoalLinkImportRequest", "Task-to-goal link import batch of at most 500 links."),
  (columns) => [jsonbArrayLengthCheck("links", { maximum: 500 })(columns.links)],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace TaskGoalLinkImportRequest {
  export type Encoded = S.Codec.Encoded<typeof TaskGoalLinkImportRequest>;
}

/**
 * Outcome counts of a task-to-goal link import.
 *
 * **Gotchas**
 *
 * This is the one model in the module without `extra='forbid'`; unknown keys
 * are tolerated by the Python model and stripped here.
 *
 * **Example** (Decode a report)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskGoalLinkImportReport } from "@beep/scratchpad/beep/Workstream"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(TaskGoalLinkImportReport)({ imported: 1, unchanged: 2, failed: 1, failureTaskIds: ["task-9"] }),
 * )
 * console.log(decoded.failureTaskIds.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskGoalLinkImportReport extends Model<TaskGoalLinkImportReport>("TaskGoalLinkImportReport")(
  {
    imported: S.Int.pipe(pg.integer(), pg.columnName("imported")),
    unchanged: S.Int.pipe(pg.integer(), pg.columnName("unchanged")),
    failed: S.Int.pipe(pg.integer(), pg.columnName("failed")),
    failureTaskIds: S.Array(StableId).pipe(pg.jsonb(), pg.columnName("failure_task_ids")),
  },
  doc("TaskGoalLinkImportReport", "Task-to-goal link import counts. Unknown keys are tolerated."),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace TaskGoalLinkImportReport {
  export type Encoded = S.Codec.Encoded<typeof TaskGoalLinkImportReport>;
}
