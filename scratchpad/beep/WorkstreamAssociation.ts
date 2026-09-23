/**
 * Versioned workflow association and recurrence-consumption contracts.
 *
 * **Details**
 *
 * Workstream association is Workflow, not a memory layer. `material` and
 * `reason` constrain each other on {@link AssociationJudgment} but do not
 * partition the other fields, so the judgment stays one struct and the rules
 * live in {@link validateAssociationJudgment}.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EvidenceRef } from "./ActionItem.ts";
import {
  Model,
  NonNegativeInt,
  StableId,
  bool,
  boundedText,
  nonNegativeIntCheck,
  optionalBoundedText,
  optionalStableId,
  pg,
  stableId,
  stableIdCheck,
  text,
  textBoundsCheck,
  timestamp,
} from "./Kit.ts";
import { CanonicalRecurrenceSignal } from "./MemoryRecurrence.ts";
import { atLeastCheck, jsonbArrayLengthCheck, optionalNull } from "./Port.ts";

const $I = $ScratchpadId.create("beep/WorkstreamAssociation");

const emptyIds: ReadonlyArray<string> = [];

const schemaVersion = S.Literal(1)
  .annotateKey({ description: "Contract schema version. Always 1." })
  .pipe(S.withConstructorDefault(Effect.succeed<1>(1)), pg.integer(), pg.columnName("schema_version"));

const policyVersion = S.Literal("association.v1")
  .annotateKey({ description: "Association policy version. Always association.v1." })
  .pipe(S.withConstructorDefault(Effect.succeed<"association.v1">("association.v1")), pg.text(), pg.columnName("policy_version"));

const stableIdList = (column: string, maximum: number, description: string) =>
  S.Array(StableId)
    .check(S.isMaxLength(maximum))
    .annotateKey({ description })
    .pipe(S.withConstructorDefault(Effect.succeed(emptyIds)), pg.jsonb(), pg.columnName(column));

/**
 * An association or recurrence rule failed.
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
  /** Encoded form of {@link WorkstreamAssociationError}. */
  export type Encoded = S.Codec.Encoded<typeof WorkstreamAssociationError>;
}

/**
 * Minimized evidence handed to the association adjudicator.
 *
 * **Details**
 *
 * `summary` is the minimized text. Raw private content never enters this
 * contract; only evidence references do.
 *
 * **Example** (Construct one evidence record)
 *
 * ```ts
 * import { EvidenceRef } from "./ActionItem.ts"
 * import { AssociationEvidence } from "./WorkstreamAssociation.ts"
 *
 * const evidence = AssociationEvidence.make({
 *   evidenceId: "e1",
 *   summary: "Discussed the launch checklist",
 *   evidenceRefs: [EvidenceRef.make({ kind: "conversation", id: "c1", scope: "canonical" })],
 * })
 * console.log(evidence.evidenceRefs.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationEvidence extends Model<AssociationEvidence>("AssociationEvidence")(
  {
    evidenceId: stableId("evidence_id"),
    summary: boundedText("summary", { minLength: 1, maxLength: 2000 }),
    evidenceRefs: S.Array(EvidenceRef)
      .check(S.isMinLength(1), S.isMaxLength(50))
      .annotateKey({ description: "One to fifty evidence references." })
      .pipe(pg.jsonb(), pg.columnName("evidence_refs")),
  },
  $I.annote("AssociationEvidence", { description: "Minimized evidence for association adjudication." }),
  (columns) => [
    stableIdCheck("evidence_id")(columns.evidenceId),
    textBoundsCheck("summary", { minLength: 1, maxLength: 2000 })(columns.summary),
    jsonbArrayLengthCheck("evidence_refs", { minimum: 1, maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationEvidence {
  /** Encoded form of {@link AssociationEvidence}. */
  export type Encoded = S.Codec.Encoded<typeof AssociationEvidence>;
}

/**
 * Workstream candidate as the adjudicator sees it.
 *
 * **Example** (Allow an empty state summary)
 *
 * ```ts
 * import { AssociationCandidateView } from "./WorkstreamAssociation.ts"
 *
 * const view = AssociationCandidateView.make({ workstreamId: "w1", objective: "Ship", currentStateSummary: "" })
 * console.log(view.currentStateSummary) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationCandidateView extends Model<AssociationCandidateView>("AssociationCandidateView")(
  {
    workstreamId: stableId("workstream_id"),
    objective: boundedText("objective", { minLength: 1, maxLength: 2048 }),
    currentStateSummary: S.String.check(S.isMaxLength(4000))
      .annotateKey({ description: "Current state summary, at most 4000 characters. May be empty." })
      .pipe(pg.text(), pg.columnName("current_state_summary")),
  },
  $I.annote("AssociationCandidateView", { description: "Candidate workstream projected for adjudication." }),
  (columns) => [
    stableIdCheck("workstream_id")(columns.workstreamId),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
    textBoundsCheck("current_state_summary", { maxLength: 4000 })(columns.currentStateSummary),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationCandidateView {
  /** Encoded form of {@link AssociationCandidateView}. */
  export type Encoded = S.Codec.Encoded<typeof AssociationCandidateView>;
}

/**
 * Input the adjudicator reads: one evidence summary and one to five candidates.
 *
 * **Example** (Defaults for the version fields)
 *
 * ```ts
 * import { AssociationAdjudicationInput, AssociationCandidateView } from "./WorkstreamAssociation.ts"
 *
 * const input = AssociationAdjudicationInput.make({
 *   evidenceSummary: "Launch checklist",
 *   candidates: [AssociationCandidateView.make({ workstreamId: "w1", objective: "Ship", currentStateSummary: "" })],
 * })
 * console.log(input.schemaVersion, input.policyVersion) // 1 "association.v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationAdjudicationInput extends Model<AssociationAdjudicationInput>("AssociationAdjudicationInput")(
  {
    schemaVersion,
    policyVersion,
    evidenceSummary: boundedText("evidence_summary", { minLength: 1, maxLength: 2000 }),
    candidates: S.Array(AssociationCandidateView)
      .check(S.isMinLength(1), S.isMaxLength(5))
      .annotateKey({ description: "One to five candidate views." })
      .pipe(pg.jsonb(), pg.columnName("candidates")),
  },
  $I.annote("AssociationAdjudicationInput", { description: "Adjudication input. Raw private content cannot be stored here." }),
  (columns) => [
    textBoundsCheck("evidence_summary", { minLength: 1, maxLength: 2000 })(columns.evidenceSummary),
    jsonbArrayLengthCheck("candidates", { minimum: 1, maximum: 5 })(columns.candidates),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationAdjudicationInput {
  /** Encoded form of {@link AssociationAdjudicationInput}. */
  export type Encoded = S.Codec.Encoded<typeof AssociationAdjudicationInput>;
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
 * console.log(Effect.runSync(S.decodeUnknownEffect(AssociationReason)("selected"))) // "selected"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AssociationReason = LiteralKit(["selected", "no_match", "immaterial", "ambiguous", "model_unavailable"]).pipe(
  $I.annoteSchema("AssociationReason", { description: "Association reason." }),
);

/** @category type-level @since 0.0.0 */
export type AssociationReason = typeof AssociationReason.Type;

/**
 * Judgment of whether an event belongs to a workstream.
 *
 * **Details**
 *
 * Material judgments require `workstreamId`, reason `selected`, and an event
 * summary. Non-material judgments cannot use `selected` or carry a summary.
 * `immaterial` requires a workstream id and is the only non-material reason
 * that may have one. {@link validateAssociationJudgment} enforces those rules.
 *
 * **Gotchas**
 *
 * Decoding alone does not run the pairing rules; use
 * {@link decodeAssociationJudgment} for the Python constructor behavior.
 *
 * **Example** (Construct a no_match judgment)
 *
 * ```ts
 * import { AssociationJudgment } from "./WorkstreamAssociation.ts"
 *
 * const judgment = AssociationJudgment.make({ material: false, reason: "no_match" })
 * console.log(judgment.policyVersion) // "association.v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationJudgment extends Model<AssociationJudgment>("AssociationJudgment")(
  {
    schemaVersion,
    policyVersion,
    workstreamId: optionalStableId("workstream_id"),
    material: bool("material"),
    reason: AssociationReason.annotateKey({ description: "Why the event was or was not associated." }).pipe(
      pg.text(),
      pg.columnName("reason"),
    ),
    eventSummary: optionalBoundedText("event_summary", { minLength: 1, maxLength: 500 }),
  },
  $I.annote("AssociationJudgment", {
    description: "Association judgment. The pair of material and reason is checked by validateAssociationJudgment.",
  }),
  (columns) => [
    stableIdCheck("workstream_id")(columns.workstreamId),
    textBoundsCheck("event_summary", { minLength: 1, maxLength: 500 })(columns.eventSummary),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationJudgment {
  /** Encoded form of {@link AssociationJudgment}. */
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
 * Decode a judgment and run the pairing rules, as the Python constructor does.
 *
 * **Example** (Decode a material judgment)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeAssociationJudgment } from "./WorkstreamAssociation.ts"
 *
 * const judgment = Effect.runSync(
 *   decodeAssociationJudgment({
 *     schemaVersion: 1,
 *     policyVersion: "association.v1",
 *     material: true,
 *     reason: "selected",
 *     workstreamId: "w1",
 *     eventSummary: "Launch",
 *   }),
 * )
 * console.log(judgment.material) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeAssociationJudgment = Effect.fn("AssociationJudgment.decode")(function* (input: unknown) {
  return yield* validateAssociationJudgment(yield* S.decodeUnknownEffect(AssociationJudgment)(input));
});

/**
 * Terminal outcome of one association pass.
 *
 * **Example** (Decode appended)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AssociationOutcomeKind } from "./WorkstreamAssociation.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(AssociationOutcomeKind)("appended"))) // "appended"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AssociationOutcomeKind = LiteralKit([
  "workflow_disabled",
  "no_candidates",
  "no_match",
  "immaterial",
  "minimization_rejected",
  "would_append",
  "appended",
]).pipe($I.annoteSchema("AssociationOutcomeKind", { description: "Association outcome kind." }));

/** @category type-level @since 0.0.0 */
export type AssociationOutcomeKind = typeof AssociationOutcomeKind.Type;

/**
 * Result of one association pass with the candidate ids it touched.
 *
 * **Example** (Defaults for the id lists)
 *
 * ```ts
 * import { AssociationOutcome } from "./WorkstreamAssociation.ts"
 *
 * const outcome = AssociationOutcome.make({ outcome: "no_candidates" })
 * console.log(outcome.retrievedCandidateIds.length, outcome.policyVersion) // 0 "association.v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssociationOutcome extends Model<AssociationOutcome>("AssociationOutcome")(
  {
    outcome: AssociationOutcomeKind.annotateKey({ description: "Terminal outcome kind." }).pipe(
      pg.text(),
      pg.columnName("outcome"),
    ),
    retrievedCandidateIds: stableIdList("retrieved_candidate_ids", 20, "Retrieved candidate ids, at most 20."),
    hydratedCandidateIds: stableIdList("hydrated_candidate_ids", 5, "Hydrated candidate ids, at most 5."),
    workstreamId: optionalStableId("workstream_id"),
    eventId: optionalStableId("event_id"),
    judgmentReason: optionalNull(AssociationReason)
      .annotateKey({ description: "Judgment reason when an adjudication ran." })
      .pipe(pg.text(), pg.columnName("judgment_reason")),
    policyVersion,
  },
  $I.annote("AssociationOutcome", { description: "Outcome of one association pass." }),
  (columns) => [
    jsonbArrayLengthCheck("retrieved_candidate_ids", { maximum: 20 })(columns.retrievedCandidateIds),
    jsonbArrayLengthCheck("hydrated_candidate_ids", { maximum: 5 })(columns.hydratedCandidateIds),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("event_id")(columns.eventId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace AssociationOutcome {
  /** Encoded form of {@link AssociationOutcome}. */
  export type Encoded = S.Codec.Encoded<typeof AssociationOutcome>;
}

/**
 * Report of one workstream association index rebuild.
 *
 * **Example** (Default index version)
 *
 * ```ts
 * import { WorkstreamIndexRebuildReport } from "./WorkstreamAssociation.ts"
 *
 * const report = WorkstreamIndexRebuildReport.make({ uid: "u1", sourceCount: 3, indexedCount: 3 })
 * console.log(report.indexVersion) // "workstream-association-v2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkstreamIndexRebuildReport extends Model<WorkstreamIndexRebuildReport>("WorkstreamIndexRebuildReport")(
  {
    uid: text("uid"),
    indexVersion: S.Literal("workstream-association-v2")
      .annotateKey({ description: "Index version. Always workstream-association-v2." })
      .pipe(
        S.withConstructorDefault(Effect.succeed<"workstream-association-v2">("workstream-association-v2")),
        pg.text(),
        pg.columnName("index_version"),
      ),
    sourceCount: NonNegativeInt.annotateKey({ description: "Workstreams read from the source." }).pipe(
      pg.integer(),
      pg.columnName("source_count"),
    ),
    indexedCount: NonNegativeInt.annotateKey({ description: "Workstreams written to the index." }).pipe(
      pg.integer(),
      pg.columnName("indexed_count"),
    ),
    failedWorkstreamIds: S.Array(StableId)
      .annotateKey({ description: "Workstreams that failed to index." })
      .pipe(S.withConstructorDefault(Effect.succeed(emptyIds)), pg.jsonb(), pg.columnName("failed_workstream_ids")),
  },
  $I.annote("WorkstreamIndexRebuildReport", { description: "Index rebuild report." }),
  (columns) => [
    nonNegativeIntCheck("source_count")(columns.sourceCount),
    nonNegativeIntCheck("indexed_count")(columns.indexedCount),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WorkstreamIndexRebuildReport {
  /** Encoded form of {@link WorkstreamIndexRebuildReport}. */
  export type Encoded = S.Codec.Encoded<typeof WorkstreamIndexRebuildReport>;
}

/**
 * Outcome kind of consuming a recurrence signal.
 *
 * **Example** (Decode candidate_created)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RecurrenceOutcomeKind } from "./WorkstreamAssociation.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(RecurrenceOutcomeKind)("candidate_created"))) // "candidate_created"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecurrenceOutcomeKind = LiteralKit([
  "workflow_disabled",
  "below_threshold",
  "would_create",
  "candidate_created",
]).pipe($I.annoteSchema("RecurrenceOutcomeKind", { description: "Recurrence consumption outcome kind." }));

/** @category type-level @since 0.0.0 */
export type RecurrenceOutcomeKind = typeof RecurrenceOutcomeKind.Type;

/**
 * Result of consuming one recurrence signal.
 *
 * **Example** (Leave the candidate empty)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { RecurrenceConsumptionOutcome } from "./WorkstreamAssociation.ts"
 *
 * const outcome = RecurrenceConsumptionOutcome.make({ outcome: "below_threshold", signalId: "s1" })
 * console.log(O.isNone(outcome.candidateId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecurrenceConsumptionOutcome extends Model<RecurrenceConsumptionOutcome>("RecurrenceConsumptionOutcome")(
  {
    outcome: RecurrenceOutcomeKind.annotateKey({ description: "Consumption outcome kind." }).pipe(
      pg.text(),
      pg.columnName("outcome"),
    ),
    signalId: stableId("signal_id"),
    candidateId: optionalStableId("candidate_id"),
    idempotencyKey: optionalStableId("idempotency_key"),
  },
  $I.annote("RecurrenceConsumptionOutcome", { description: "Outcome of consuming one recurrence signal." }),
  (columns) => [
    stableIdCheck("signal_id")(columns.signalId),
    stableIdCheck("candidate_id")(columns.candidateId),
    stableIdCheck("idempotency_key")(columns.idempotencyKey),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace RecurrenceConsumptionOutcome {
  /** Encoded form of {@link RecurrenceConsumptionOutcome}. */
  export type Encoded = S.Codec.Encoded<typeof RecurrenceConsumptionOutcome>;
}

/**
 * Recurrence inbox row status.
 *
 * **Example** (Decode pending)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RecurrenceInboxStatus } from "./WorkstreamAssociation.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(RecurrenceInboxStatus)("pending"))) // "pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecurrenceInboxStatus = LiteralKit(["pending", "completed"]).pipe(
  $I.annoteSchema("RecurrenceInboxStatus", { description: "Recurrence inbox status." }),
);

/** @category type-level @since 0.0.0 */
export type RecurrenceInboxStatus = typeof RecurrenceInboxStatus.Type;

/**
 * Inbox receipt for a canonical recurrence signal awaiting or past consumption.
 *
 * **Details**
 *
 * `signal` embeds the canonical recurrence signal from the memory-recurrence
 * contract. `attempts` constructs from zero. Timestamps are plain UTC
 * instants without an aware-only rule.
 *
 * **Example** (Read the default attempts)
 *
 * ```ts
 * import { RecurrenceInboxReceipt } from "./WorkstreamAssociation.ts"
 *
 * console.log(RecurrenceInboxReceipt.fields.attempts !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecurrenceInboxReceipt extends Model<RecurrenceInboxReceipt>("RecurrenceInboxReceipt")(
  {
    receiptId: stableId("receipt_id"),
    loopKey: stableId("loop_key"),
    accountGeneration: NonNegativeInt.annotateKey({ description: "Account generation the receipt belongs to." }).pipe(
      pg.integer(),
      pg.columnName("account_generation"),
    ),
    status: RecurrenceInboxStatus.annotateKey({ description: "Inbox row status." }).pipe(
      pg.text(),
      pg.columnName("status"),
    ),
    signal: CanonicalRecurrenceSignal.annotateKey({ description: "Embedded canonical recurrence signal." }).pipe(
      pg.jsonb(),
      pg.columnName("signal"),
    ),
    attempts: S.Int.check(S.isGreaterThanOrEqualTo(0))
      .annotateKey({ description: "Consumption attempts. Constructs from zero." })
      .pipe(S.withConstructorDefault(Effect.succeed(0)), pg.integer(), pg.columnName("attempts")),
    lastOutcome: optionalNull(RecurrenceOutcomeKind)
      .annotateKey({ description: "Outcome of the last consumption attempt." })
      .pipe(pg.text(), pg.columnName("last_outcome")),
    lastErrorCode: optionalStableId("last_error_code"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  $I.annote("RecurrenceInboxReceipt", { description: "Inbox receipt for one recurrence signal." }),
  (columns) => [
    stableIdCheck("receipt_id")(columns.receiptId),
    stableIdCheck("loop_key")(columns.loopKey),
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
    atLeastCheck("attempts", 0)(columns.attempts),
    stableIdCheck("last_error_code")(columns.lastErrorCode),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace RecurrenceInboxReceipt {
  /** Encoded form of {@link RecurrenceInboxReceipt}. */
  export type Encoded = S.Codec.Encoded<typeof RecurrenceInboxReceipt>;
}
