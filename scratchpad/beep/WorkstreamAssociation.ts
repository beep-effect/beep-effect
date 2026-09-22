/**
 * Association, recurrence inbox, import, and artifact-status contracts.
 *
 * **Details**
 *
 * `material` and `reason` constrain each other but do not partition the other
 * fields, so {@link AssociationJudgment} stays one struct. The rules are
 * {@link validateAssociationJudgment}.
 *
 * @since 0.0.0
 */
import * as A from "@beep/utils/Array";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  Model,
  UtcTimestamp,
  bool,
  boundedText,
  confidence,
  optionalBoundedText,
  optionalStableId,
  optionalText,
  pg,
  stableId,
  stableIdCheck,
  textBoundsCheck,
  unitIntervalCheck,
} from "./Kit.ts";
import { atLeastCheck, boolDefault, intAtLeast, jsonbArrayLengthCheck, optionalNull } from "./Port.ts";
import { EvidenceKind, EvidenceRef, EvidenceScope } from "./TaskRecommendation.ts";

const $I = $ScratchpadId.create("beep/WorkstreamAssociation");

const awareInstant = S.String.check(
  S.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/),
).pipe(S.decodeTo(UtcTimestamp));

const aware = (column: string) =>
  awareInstant.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

const kit = <const L extends A.NonEmptyReadonlyArray<string>>(name: string, description: string, literals: L) =>
  LiteralKit(literals).pipe($I.annoteSchema(name, { description }));

const doc = (name: string, description: string) => $I.annote(name, { description });

const boundedList = <A extends S.Top>(
  item: A,
  column: string,
  bounds: { readonly minimum?: number; readonly maximum?: number },
  emptyDefault: boolean,
) => {
  const base = S.Array(item);
  const limited =
    bounds.minimum !== undefined && bounds.maximum !== undefined
      ? base.check(S.isMinLength(bounds.minimum), S.isMaxLength(bounds.maximum))
      : bounds.minimum !== undefined
        ? base.check(S.isMinLength(bounds.minimum))
        : bounds.maximum !== undefined
          ? base.check(S.isMaxLength(bounds.maximum))
          : base;
  const schema = emptyDefault ? limited.pipe(S.withConstructorDefault(Effect.sync(() => new Array<A["Type"]>()))) : limited;
  return schema.pipe(pg.jsonb(), pg.columnName(column));
};

/**
 * Association validation failed.
 *
 * **Example** (Read the message)
 *
 * ```ts
 * import { WorkstreamAssociationError } from "./WorkstreamAssociation.ts"
 *
 * console.log(WorkstreamAssociationError.make({ message: "no" }).message) // "no"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkstreamAssociationError extends S.TaggedError<WorkstreamAssociationError>()(
  "WorkstreamAssociationError",
  { message: S.String },
  $I.annoteError("WorkstreamAssociationError", { description: "An association or recurrence rule failed." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamAssociationError {
  export type Encoded = S.Codec.Encoded<typeof WorkstreamAssociationError>;
}

/**
 * Why an association was or was not selected.
 *
 * **Example** (Decode selected)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AssociationReason } from "./WorkstreamAssociation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AssociationReason)("selected"))
 * console.log(decoded) // "selected"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AssociationReason = kit("AssociationReason", "Association reason.", [
  "selected",
  "none",
  "ambiguous",
  "immaterial",
]);

/** @category type-level @since 0.0.0 */
export type AssociationReason = typeof AssociationReason.Type;
/** @category type-level @since 0.0.0 */
export declare namespace AssociationReason {
  export type Encoded = S.Codec.Encoded<typeof AssociationReason>;
}

/**
 * Judgment of whether an event belongs to a workstream.
 *
 * **Gotchas**
 *
 * Material judgments require `workstreamId`, reason `selected`, and an event
 * summary. Non-material judgments cannot use `selected` or carry a summary.
 * `immaterial` requires a workstream id and is the only non-material reason
 * that may have one.
 *
 * **Example** (Construct a none judgment)
 *
 * ```ts
 * import { AssociationJudgment } from "./WorkstreamAssociation.ts"
 *
 * const judgment = AssociationJudgment.make({ material: false, reason: "none" })
 * console.log(judgment.material) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationJudgment extends Model<AssociationJudgment>("AssociationJudgment")(
  {
    material: bool("material"),
    reason: AssociationReason.pipe(pg.text(), pg.columnName("reason")),
    workstreamId: optionalStableId("workstream_id"),
    eventSummary: optionalBoundedText("event_summary", { minLength: 1, maxLength: 500 }),
  },
  doc("AssociationJudgment", "Association judgment. The pair of material and reason is checked by validateAssociationJudgment."),
  (columns) => [
    stableIdCheck("workstream_id")(columns.workstreamId),
    textBoundsCheck("event_summary", { minLength: 1, maxLength: 500 })(columns.eventSummary),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationJudgment {
  export type Encoded = S.Codec.Encoded<typeof AssociationJudgment>;
}

/**
 * Enforce the material and reason pairing.
 *
 * **Example** (Reject a material judgment without a workstream)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { AssociationJudgment, validateAssociationJudgment } from "./WorkstreamAssociation.ts"
 *
 * const judgment = AssociationJudgment.make({ material: true, reason: "selected" })
 * console.log(Effect.runSyncExit(validateAssociationJudgment(judgment))._tag) // "Failure"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const validateAssociationJudgment = Effect.fn("AssociationJudgment.validate")(function* (
  judgment: AssociationJudgment,
) {
  const message =
    judgment.material && O.isNone(judgment.workstreamId)
      ? "material association requires workstream_id"
      : judgment.material && judgment.reason !== "selected"
        ? "material association requires selected reason"
        : judgment.material && O.isNone(judgment.eventSummary)
          ? "material association requires a minimized event_summary"
          : !judgment.material && judgment.reason === "selected"
            ? "selected reason requires material association"
            : !judgment.material && O.isSome(judgment.eventSummary)
              ? "non-material association must not emit an event_summary"
              : !judgment.material && O.isSome(judgment.workstreamId) && judgment.reason !== "immaterial"
                ? "a non-material workstream selection requires immaterial reason"
                : !judgment.material && O.isNone(judgment.workstreamId) && judgment.reason === "immaterial"
                  ? "immaterial reason requires a workstream selection"
                  : undefined;
  if (message !== undefined) return yield* WorkstreamAssociationError.make({ message });
  return judgment;
});

/**
 * Input the adjudicator reads. Raw private content is not a field.
 *
 * **Example** (Construct one evidence ref)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { AssociationAdjudicationInput, EvidenceRef } from "./WorkstreamAssociation.ts"
 *
 * const input = AssociationAdjudicationInput.make({
 *   taskId: "t1",
 *   sourceKind: "conversation",
 *   sourceId: "c1",
 *   occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "c1", scope: "canonical" })],
 * })
 * console.log(input.taskId) // "t1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationAdjudicationInput extends Model<AssociationAdjudicationInput>("AssociationAdjudicationInput")(
  {
    taskId: stableId("task_id"),
    goalId: optionalStableId("goal_id"),
    sourceKind: EvidenceKind.pipe(pg.text(), pg.columnName("source_kind")),
    sourceId: stableId("source_id"),
    occurredAt: aware("occurred_at"),
    evidenceRefs: boundedList(EvidenceRef, "evidence_refs", { minimum: 1, maximum: 50 }, false),
  },
  doc("AssociationAdjudicationInput", "Adjudication input. Raw private content cannot be stored here."),
  (columns) => [
    stableIdCheck("task_id")(columns.taskId),
    stableIdCheck("goal_id")(columns.goalId),
    stableIdCheck("source_id")(columns.sourceId),
    jsonbArrayLengthCheck("evidence_refs", { minimum: 1, maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationAdjudicationInput {
  export type Encoded = S.Codec.Encoded<typeof AssociationAdjudicationInput>;
}

/**
 * Audit of one association decision.
 *
 * **Example** (Read the policy version)
 *
 * ```ts
 * import { AssociationDecisionRecord } from "./WorkstreamAssociation.ts"
 *
 * console.log(AssociationDecisionRecord.fields.policyVersion !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationDecisionRecord extends Model<AssociationDecisionRecord>("AssociationDecisionRecord")(
  {
    decisionId: stableId("decision_id"),
    taskId: stableId("task_id"),
    policyVersion: S.Literal("association.v1").pipe(
      S.withConstructorDefault(Effect.succeed("association.v1")),
      pg.text(),
      pg.columnName("policy_version"),
    ),
    candidateWorkstreamIds: boundedList(stableId("candidate"), "candidate_workstream_ids", { maximum: 32 }, false),
    judgment: AssociationJudgment.pipe(pg.jsonb(), pg.columnName("judgment")),
    modelVersion: stableId("model_version"),
    decidedAt: aware("decided_at"),
  },
  doc("AssociationDecisionRecord", "Audit of one association decision. policy_version is association.v1."),
  (columns) => [
    stableIdCheck("decision_id")(columns.decisionId),
    stableIdCheck("task_id")(columns.taskId),
    jsonbArrayLengthCheck("candidate_workstream_ids", { maximum: 32 })(columns.candidateWorkstreamIds),
    stableIdCheck("model_version")(columns.modelVersion),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationDecisionRecord {
  export type Encoded = S.Codec.Encoded<typeof AssociationDecisionRecord>;
}

/**
 * Result of adjudicating one event.
 *
 * **Example** (Read the task id)
 *
 * ```ts
 * import { AssociationAdjudicationResult } from "./WorkstreamAssociation.ts"
 *
 * console.log(AssociationAdjudicationResult.fields.taskId !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationAdjudicationResult extends Model<AssociationAdjudicationResult>("AssociationAdjudicationResult")(
  {
    taskId: stableId("task_id"),
    judgment: AssociationJudgment.pipe(pg.jsonb(), pg.columnName("judgment")),
    decision: AssociationDecisionRecord.pipe(pg.jsonb(), pg.columnName("decision")),
  },
  doc("AssociationAdjudicationResult", "Judgment plus the audit record."),
  (columns) => [stableIdCheck("task_id")(columns.taskId)],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationAdjudicationResult {
  export type Encoded = S.Codec.Encoded<typeof AssociationAdjudicationResult>;
}

/**
 * Recurrence signal embedded from the memory-recurrence contract.
 *
 * **Example** (Require one occurrence)
 *
 * ```ts
 * import { CanonicalRecurrenceSignal } from "./WorkstreamAssociation.ts"
 *
 * console.log(CanonicalRecurrenceSignal.fields.occurrenceCount !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalRecurrenceSignal extends Model<CanonicalRecurrenceSignal>("CanonicalRecurrenceSignal")(
  {
    signalId: stableId("signal_id"),
    title: boundedText("title", { minLength: 1, maxLength: 256 }),
    objective: boundedText("objective", { minLength: 1, maxLength: 2048 }),
    anchorTaskDescription: boundedText("anchor_task_description", { minLength: 1, maxLength: 2000 }),
    occurrenceCount: intAtLeast("occurrence_count", 1),
    distinctDayCount: intAtLeast("distinct_day_count", 1),
    unresolved: bool("unresolved"),
    confidence: confidence("confidence"),
    firstSeenAt: aware("first_seen_at"),
    lastSeenAt: aware("last_seen_at"),
    evidenceRefs: boundedList(EvidenceRef, "evidence_refs", { minimum: 1, maximum: 50 }, false),
  },
  doc("CanonicalRecurrenceSignal", "Canonical recurrence signal. Temporal rules are validateCanonicalRecurrenceSignal."),
  (columns) => [
    stableIdCheck("signal_id")(columns.signalId),
    textBoundsCheck("title", { minLength: 1, maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
    textBoundsCheck("anchor_task_description", { minLength: 1, maxLength: 2000 })(columns.anchorTaskDescription),
    atLeastCheck("occurrence_count", 1)(columns.occurrenceCount),
    atLeastCheck("distinct_day_count", 1)(columns.distinctDayCount),
    unitIntervalCheck("confidence")(columns.confidence),
    jsonbArrayLengthCheck("evidence_refs", { minimum: 1, maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace CanonicalRecurrenceSignal {
  export type Encoded = S.Codec.Encoded<typeof CanonicalRecurrenceSignal>;
}

const utcDay = (instant: DateTimeUtc): number => Math.floor(DateTime.toEpochMillis(instant) / 86_400_000);

/**
 * Enforce recurrence evidence scope and the day-span bound.
 *
 * **Example** (Reject a reversed window)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { CanonicalRecurrenceSignal, EvidenceRef, validateCanonicalRecurrenceSignal } from "./WorkstreamAssociation.ts"
 *
 * const signal = CanonicalRecurrenceSignal.make({
 *   signalId: "s1",
 *   title: "T",
 *   objective: "O",
 *   anchorTaskDescription: "A",
 *   occurrenceCount: 1,
 *   distinctDayCount: 1,
 *   unresolved: true,
 *   confidence: 1,
 *   firstSeenAt: DateTime.makeUnsafe("2020-01-03T00:00:00Z"),
 *   lastSeenAt: DateTime.makeUnsafe("2020-01-02T00:00:00Z"),
 *   evidenceRefs: [EvidenceRef.make({ kind: "memory_item", id: "m1", scope: "canonical" })],
 * })
 * console.log(Effect.runSyncExit(validateCanonicalRecurrenceSignal(signal))._tag) // "Failure"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const validateCanonicalRecurrenceSignal = Effect.fn("CanonicalRecurrenceSignal.validate")(function* (
  signal: CanonicalRecurrenceSignal,
) {
  if (signal.distinctDayCount > signal.occurrenceCount) {
    return yield*WorkstreamAssociationError.make({ message: "distinct_day_count cannot exceed occurrence_count" });
  }
  if (DateTime.toEpochMillis(signal.firstSeenAt) > DateTime.toEpochMillis(signal.lastSeenAt)) {
    return yield*WorkstreamAssociationError.make({ message: "first_seen_at cannot be after last_seen_at" });
  }
  const span = utcDay(signal.lastSeenAt) - utcDay(signal.firstSeenAt) + 1;
  if (signal.distinctDayCount > span) {
    return yield*WorkstreamAssociationError.make({ message: "distinct_day_count exceeds the inclusive day span" });
  }
  for (const ref of signal.evidenceRefs) {
    if (ref.scope !== "canonical") {
      return yield* WorkstreamAssociationError.make({ message: "recurrence evidence must be canonical" });
    }
    if (ref.kind !== "memory_item" && ref.kind !== "conversation") {
      return yield* WorkstreamAssociationError.make({ message: "recurrence evidence must be a memory item or conversation" });
    }
  }
  return signal;
});

import * as DateTime from "effect/DateTime";
type DateTimeUtc = DateTime.Utc;

/**
 * Receipt that a recurrence signal was accepted into the inbox.
 *
 * **Example** (Read the index version)
 *
 * ```ts
 * import { RecurrenceInboxReceipt } from "./WorkstreamAssociation.ts"
 *
 * console.log(RecurrenceInboxReceipt.fields.indexVersion !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecurrenceInboxReceipt extends Model<RecurrenceInboxReceipt>("RecurrenceInboxReceipt")(
  {
    signalId: stableId("signal_id"),
    indexVersion: S.Literal("recurrence-index.v1").pipe(
      S.withConstructorDefault(Effect.succeed("recurrence-index.v1")),
      pg.text(),
      pg.columnName("index_version"),
    ),
    accountGeneration: intAtLeast("account_generation", 0),
    sequence: intAtLeast("sequence", 1),
    acceptedAt: aware("accepted_at"),
  },
  doc("RecurrenceInboxReceipt", "Inbox receipt. sequence starts at 1."),
  (columns) => [
    stableIdCheck("signal_id")(columns.signalId),
    atLeastCheck("account_generation", 0)(columns.accountGeneration),
    atLeastCheck("sequence", 1)(columns.sequence),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace RecurrenceInboxReceipt {
  export type Encoded = S.Codec.Encoded<typeof RecurrenceInboxReceipt>;
}

/**
 * Outcome of consuming a recurrence signal.
 *
 * **Example** (Decode created)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RecurrenceConsumptionOutcome } from "./WorkstreamAssociation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(RecurrenceConsumptionOutcome)("created"))
 * console.log(decoded) // "created"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecurrenceConsumptionOutcome = kit("RecurrenceConsumptionOutcome", "Recurrence consumption outcome.", [
  "created",
  "merged",
  "unchanged",
  "deferred",
]);

/** @category type-level @since 0.0.0 */
export type RecurrenceConsumptionOutcome = typeof RecurrenceConsumptionOutcome.Type;
/** @category type-level @since 0.0.0 */
export declare namespace RecurrenceConsumptionOutcome {
  export type Encoded = S.Codec.Encoded<typeof RecurrenceConsumptionOutcome>;
}

/**
 * Result of consuming one recurrence signal.
 *
 * **Example** (Leave the workstream empty)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { RecurrenceConsumptionResult } from "./WorkstreamAssociation.ts"
 *
 * const result = RecurrenceConsumptionResult.make({ signalId: "s1", outcome: "deferred", attempts: 0 })
 * console.log(O.isNone(result.workstreamId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecurrenceConsumptionResult extends Model<RecurrenceConsumptionResult>("RecurrenceConsumptionResult")(
  {
    signalId: stableId("signal_id"),
    outcome: RecurrenceConsumptionOutcome.pipe(pg.text(), pg.columnName("outcome")),
    workstreamId: optionalStableId("workstream_id"),
    goalId: optionalStableId("goal_id"),
    attempts: intAtLeast("attempts", 0),
    reason: optionalText("reason"),
  },
  doc("RecurrenceConsumptionResult", "Consumption result. attempts constructs from zero when supplied."),
  (columns) => [
    stableIdCheck("signal_id")(columns.signalId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("goal_id")(columns.goalId),
    atLeastCheck("attempts", 0)(columns.attempts),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace RecurrenceConsumptionResult {
  export type Encoded = S.Codec.Encoded<typeof RecurrenceConsumptionResult>;
}

void EvidenceScope;
void optionalNull;
void boolDefault;
void optionalText;
