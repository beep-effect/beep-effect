/**
 * Stable task-intelligence contracts shared by rollout and telemetry.
 *
 * Records are frozen and reject unknown keys in Python (`extra=forbid`).
 * Effect's default decode ignores unknown keys unless the caller passes
 * `onExcessProperty: "error"`.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import {
  Model,
  accountGenerationDefault,
  bool,
  boundedText,
  nonNegativeIntCheck,
  optionalNull,
  optionalStableId,
  pg,
  stableId,
  stableIdCheck,
  textBoundsCheck,
  timestamp,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/TaskIntelligence");

/**
 * Rollout mode for task workflow.
 *
 * **Details**
 *
 * `off`, `shadow`, `write`, and `read`. The mode is readable history. It is
 * not an entitlement.
 *
 * **Example** (Accept shadow mode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskWorkflowMode } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskWorkflowMode)("shadow")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskWorkflowMode = LiteralKit(["off", "shadow", "write", "read"]).pipe(
  $I.annoteSchema("TaskWorkflowMode", {
    description: "Rollout mode for task workflow. Not an entitlement.",
  }),
);

/**
 * Decoded task workflow mode.
 *
 * @see {@link TaskWorkflowMode} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskWorkflowMode = typeof TaskWorkflowMode.Type;

/**
 * Attribution event type.
 *
 * **Details**
 *
 * The five values select which identifiers {@link linkageFailure} requires.
 * They do not change the stored field set, so this stays a literal field.
 *
 * **Example** (Accept a captured candidate)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceEventType } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskIntelligenceEventType)("candidate_captured")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceEventType = LiteralKit([
  "candidate_captured",
  "candidate_resolved",
  "intervention_presented",
  "feedback_recorded",
  "outcome_recorded",
]).pipe(
  $I.annoteSchema("TaskIntelligenceEventType", {
    description: "Attribution event type. Linkage rules differ; the stored fields do not.",
  }),
);

/**
 * Decoded attribution event type.
 *
 * @see {@link TaskIntelligenceEventType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceEventType = typeof TaskIntelligenceEventType.Type;

/**
 * Where a task-intelligence fact came from.
 *
 * **Example** (Accept a conversation source)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceSourceClass } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskIntelligenceSourceClass)("conversation")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceSourceClass = LiteralKit([
  "manual",
  "conversation",
  "screen",
  "agent",
  "integration",
  "import_share",
  "recurrence",
]).pipe(
  $I.annoteSchema("TaskIntelligenceSourceClass", {
    description: "Origin class for a task-intelligence event.",
  }),
);

/**
 * Decoded source class.
 *
 * @see {@link TaskIntelligenceSourceClass} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceSourceClass = typeof TaskIntelligenceSourceClass.Type;

/**
 * Confidence band stored on an attribution event.
 *
 * **Example** (Accept an explicit band)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceConfidenceBand } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskIntelligenceConfidenceBand)("explicit")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceConfidenceBand = LiteralKit(["low", "medium", "high", "explicit"]).pipe(
  $I.annoteSchema("TaskIntelligenceConfidenceBand", {
    description: "Confidence band for a task-intelligence event.",
  }),
);

/**
 * Decoded confidence band.
 *
 * @see {@link TaskIntelligenceConfidenceBand} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceConfidenceBand = typeof TaskIntelligenceConfidenceBand.Type;

/**
 * How a candidate was resolved.
 *
 * **Example** (Accept an expiry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceResolutionCode } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskIntelligenceResolutionCode)("expired")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceResolutionCode = LiteralKit(["accepted", "rejected", "expired"]).pipe(
  $I.annoteSchema("TaskIntelligenceResolutionCode", {
    description: "How a task candidate was resolved.",
  }),
);

/**
 * Decoded resolution code.
 *
 * @see {@link TaskIntelligenceResolutionCode} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceResolutionCode = typeof TaskIntelligenceResolutionCode.Type;

/**
 * Feedback action recorded against an intervention.
 *
 * **Details**
 *
 * This is the tag enum used by feedback elsewhere. On an attribution event it
 * stays optional and does not split the record.
 *
 * **Example** (Accept dismiss)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceFeedbackAction } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskIntelligenceFeedbackAction)("dismiss")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceFeedbackAction = LiteralKit([
  "do_now",
  "later",
  "dismiss",
  "accept_candidate",
  "edit",
  "complete",
]).pipe(
  $I.annoteSchema("TaskIntelligenceFeedbackAction", {
    description: "Feedback action. A reason is valid only for dismiss.",
  }),
);

/**
 * Decoded feedback action.
 *
 * @see {@link TaskIntelligenceFeedbackAction} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceFeedbackAction = typeof TaskIntelligenceFeedbackAction.Type;

/**
 * Why feedback was dismiss.
 *
 * **Example** (Accept not mine)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceFeedbackReason } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskIntelligenceFeedbackReason)("not_mine")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceFeedbackReason = LiteralKit(["already_handled", "not_mine", "not_useful"]).pipe(
  $I.annoteSchema("TaskIntelligenceFeedbackReason", {
    description: "Reason stored only for dismiss feedback.",
  }),
);

/**
 * Decoded feedback reason.
 *
 * @see {@link TaskIntelligenceFeedbackReason} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceFeedbackReason = typeof TaskIntelligenceFeedbackReason.Type;

/**
 * Outcome recorded for an attribution chain.
 *
 * **Example** (Accept a completed task)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceOutcomeCode } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(TaskIntelligenceOutcomeCode)("task_completed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceOutcomeCode = LiteralKit([
  "task_completed",
  "artifact_approved",
  "artifact_delivered",
  "decision_resolved",
  "agent_output_applied",
  "workstream_advanced",
]).pipe(
  $I.annoteSchema("TaskIntelligenceOutcomeCode", {
    description: "Outcome recorded for an attribution chain.",
  }),
);

/**
 * Decoded outcome code.
 *
 * @see {@link TaskIntelligenceOutcomeCode} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceOutcomeCode = typeof TaskIntelligenceOutcomeCode.Type;

/**
 * Compatibility flag that can only be true.
 *
 * **Details**
 *
 * Accepting false would let callers publish a stale eligibility result.
 * Every authenticated account is universal. The flag is not authority.
 *
 * **Example** (Reject false)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MemoryCohortEligible } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * console.log(S.is(MemoryCohortEligible)(true)) // true
 * console.log(S.is(MemoryCohortEligible)(false)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryCohortEligible = S.Literal(true).pipe(
  $I.annoteSchema("MemoryCohortEligible", {
    description: "Released-wire compatibility diagnostic. Only true is accepted, and it grants no authority.",
  }),
);

/**
 * Decoded memory-cohort compatibility flag.
 *
 * @see {@link MemoryCohortEligible} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryCohortEligible = typeof MemoryCohortEligible.Type;

/**
 * Stable identifier used by task intelligence.
 *
 * Re-exported from the shared factory. The Python module defines the same
 * 1..128 pattern locally.
 *
 * @see {@link stableId} for the column factory.
 * @category schemas
 * @since 0.0.0
 */
export { StableId } from "./Kit.ts";

const offMode = "off" satisfies TaskWorkflowMode;

const cohort = MemoryCohortEligible.pipe(
  S.withConstructorDefault(Effect.succeed(true)),
  pg.boolean(),
  pg.columnName("memory_cohort_eligible"),
);

/**
 * Universal task decision for one authenticated account.
 *
 * **Details**
 *
 * `memoryCohortEligible` is retained as a released-wire compatibility
 * diagnostic. It is deliberately constant and is never used to derive any
 * task authority. `uid` is at least one character. `accountGeneration` is at
 * least 0 and defaults to 0 at construction.
 *
 * **Gotchas**
 *
 * `false` is not a legal cohort value. Unknown keys are ignored unless decode
 * is asked to reject them.
 *
 * **Example** (Construct the cohort default)
 *
 * ```ts
 * import { TaskIntelligenceRolloutDecision } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const decision = TaskIntelligenceRolloutDecision.make({
 *   uid: "user-1",
 *   workflowMode: "off",
 *   legacyReadsAuthoritative: true,
 *   legacyWritesEnabled: false,
 *   intelligenceEvaluationEnabled: false,
 *   canonicalSidecarWritesEnabled: false,
 *   canonicalReadsAuthoritative: false,
 *   compatibilityProjectionRequired: false,
 *   intelligenceProductEnabled: false,
 * })
 * console.log(decision.memoryCohortEligible) // true
 * console.log(decision.accountGeneration) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskIntelligenceRolloutDecision extends Model<TaskIntelligenceRolloutDecision>(
  "TaskIntelligenceRolloutDecision",
)(
  {
    uid: boundedText("uid", { minLength: 1 }),
    workflowMode: TaskWorkflowMode.pipe(pg.text(), pg.columnName("workflow_mode")),
    memoryCohortEligible: cohort,
    accountGeneration: accountGenerationDefault("account_generation"),
    legacyReadsAuthoritative: bool("legacy_reads_authoritative"),
    legacyWritesEnabled: bool("legacy_writes_enabled"),
    intelligenceEvaluationEnabled: bool("intelligence_evaluation_enabled"),
    canonicalSidecarWritesEnabled: bool("canonical_sidecar_writes_enabled"),
    canonicalReadsAuthoritative: bool("canonical_reads_authoritative"),
    compatibilityProjectionRequired: bool("compatibility_projection_required"),
    intelligenceProductEnabled: bool("intelligence_product_enabled"),
  },
  $I.annote("TaskIntelligenceRolloutDecision", {
    description: "Universal task decision for one authenticated account. The cohort flag is not authority.",
  }),
  (columns) => [
    textBoundsCheck("uid", { minLength: 1 })(columns.uid),
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
  ],
) {}

/**
 * Encoded rollout decision before decoding.
 *
 * @see {@link TaskIntelligenceRolloutDecision} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskIntelligenceRolloutDecision {
  export type Encoded = S.Codec.Encoded<typeof TaskIntelligenceRolloutDecision>;
}

/**
 * Drops the retired `chat_first_ui_enabled` key from a control document.
 *
 * **Details**
 *
 * Python `strip_retired_chat_first_flag` copies a dict and pops
 * `chat_first_ui_enabled` so historic documents do not fail `extra=forbid`.
 * Non-dicts are returned unchanged.
 *
 * **Gotchas**
 *
 * Only the snake_case historic key is removed. Effect already ignores unknown
 * keys on decode, so this function matters when the caller rejects excess
 * properties.
 *
 * **Example** (Drop the retired flag)
 *
 * ```ts
 * import * as Rec from "effect/Record"
 * import { stripRetiredChatFirstFlag } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const stripped = stripRetiredChatFirstFlag({ workflowMode: "off", chat_first_ui_enabled: true })
 * console.log(Rec.isRecord(stripped) && Rec.has(stripped, "chat_first_ui_enabled")) // false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const stripRetiredChatFirstFlag = (value: unknown): unknown =>
  P.isObject(value) ? Rec.remove(value, "chat_first_ui_enabled") : value;

/**
 * Persisted workflow mode plus the derived Chat-first flag.
 *
 * **Details**
 *
 * `workflowMode` remains readable for legacy records and operational history.
 * It is not an entitlement. `chatFirstUi` is derived from the universal task
 * decision. Persistence excludes it so clients cannot turn a sampled response
 * into later authority. `accountGeneration` defaults to 0. `workflowMode`
 * defaults to `off`. `chatFirstUi` defaults to false.
 *
 * **Example** (Construct the defaults)
 *
 * ```ts
 * import { TaskWorkflowControl } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const control = TaskWorkflowControl.make({})
 * console.log(control.workflowMode) // "off"
 * console.log(control.chatFirstUi) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskWorkflowControl extends Model<TaskWorkflowControl>("TaskWorkflowControl")(
  {
    workflowMode: TaskWorkflowMode.pipe(
      S.withConstructorDefault(Effect.succeed(offMode)),
      pg.text(),
      pg.columnName("workflow_mode"),
    ),
    accountGeneration: accountGenerationDefault("account_generation"),
    chatFirstUi: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      pg.boolean(),
      pg.columnName("chat_first_ui"),
    ),
  },
  $I.annote("TaskWorkflowControl", {
    description: "Persisted workflow mode plus the derived Chat-first flag, which is not stored.",
  }),
  (columns) => [nonNegativeIntCheck("account_generation")(columns.accountGeneration)],
) {}

/**
 * Encoded workflow control before decoding.
 *
 * @see {@link TaskWorkflowControl} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskWorkflowControl {
  export type Encoded = S.Codec.Encoded<typeof TaskWorkflowControl>;
}

/**
 * Firestore control record, excluding derived Chat-first state.
 *
 * **Details**
 *
 * Returns only `workflow_mode` and `account_generation`, using those wire
 * keys. `chatFirstUi` is not included.
 *
 * **Example** (Omit the derived flag)
 *
 * ```ts
 * import { TaskWorkflowControl, persistedPayload } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const payload = persistedPayload(TaskWorkflowControl.make({ chatFirstUi: true }))
 * console.log(payload.workflow_mode) // "off"
 * console.log(payload.account_generation) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const persistedPayload = (
  control: TaskWorkflowControl,
): { readonly workflow_mode: TaskWorkflowMode; readonly account_generation: number } => ({
  workflow_mode: control.workflowMode,
  account_generation: control.accountGeneration,
});

const optionalBand = optionalNull(TaskIntelligenceConfidenceBand).pipe(pg.text(), pg.columnName("confidence_band"));

/**
 * Privacy-safe attribution envelope.
 *
 * **Details**
 *
 * The absence of a free-form metadata or content field is intentional.
 * Analytics stores stable identifiers and bounded enums only. Subject ids are
 * `candidateId`, `taskId`, `workstreamId`, `artifactId`, and `decisionId`.
 * `schemaVersion` is the integer literal 1. `occurredAt` is an aware UTC
 * instant encoded as an ISO string.
 *
 * **Gotchas**
 *
 * The event type does not split the record. {@link linkageFailure} is the
 * after-validator: `candidate_captured` needs `candidateId`;
 * `candidate_resolved` needs `candidateId` and `resolutionCode`, and
 * `accepted` also needs `taskId` or `workstreamId`; `intervention_presented`
 * needs `interventionId` and a subject; `feedback_recorded` needs
 * `interventionId`, a subject, and `feedbackAction`, and `feedbackReason` is
 * valid only for `dismiss`; `outcome_recorded` needs `attributionChainId`, a
 * subject, and `outcomeCode`. Naive timestamps are accepted as UTC. Python
 * `AwareDatetime` rejects them.
 *
 * **Example** (Decode a captured candidate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceAttributionEvent } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const event = Effect.runSync(
 *   S.decodeUnknownEffect(TaskIntelligenceAttributionEvent)({
 *     schemaVersion: 1,
 *     eventId: "event-1",
 *     eventType: "candidate_captured",
 *     sourceClass: "manual",
 *     candidateId: "candidate-1",
 *     occurredAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(event.eventType) // "candidate_captured"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskIntelligenceAttributionEvent extends Model<TaskIntelligenceAttributionEvent>(
  "TaskIntelligenceAttributionEvent",
)(
  {
    schemaVersion: S.Literal(1).pipe(pg.integer(), pg.columnName("schema_version")),
    eventId: stableId("event_id"),
    eventType: TaskIntelligenceEventType.pipe(pg.text(), pg.columnName("event_type")),
    sourceClass: TaskIntelligenceSourceClass.pipe(pg.text(), pg.columnName("source_class")),
    confidenceBand: optionalBand,
    attributionChainId: optionalStableId("attribution_chain_id"),
    interventionId: optionalStableId("intervention_id"),
    candidateId: optionalStableId("candidate_id"),
    taskId: optionalStableId("task_id"),
    workstreamId: optionalStableId("workstream_id"),
    artifactId: optionalStableId("artifact_id"),
    decisionId: optionalStableId("decision_id"),
    resolutionCode: optionalNull(TaskIntelligenceResolutionCode).pipe(pg.text(), pg.columnName("resolution_code")),
    feedbackAction: optionalNull(TaskIntelligenceFeedbackAction).pipe(pg.text(), pg.columnName("feedback_action")),
    feedbackReason: optionalNull(TaskIntelligenceFeedbackReason).pipe(pg.text(), pg.columnName("feedback_reason")),
    outcomeCode: optionalNull(TaskIntelligenceOutcomeCode).pipe(pg.text(), pg.columnName("outcome_code")),
    occurredAt: timestamp("occurred_at"),
  },
  $I.annote("TaskIntelligenceAttributionEvent", {
    description: "Privacy-safe attribution envelope of stable ids and bounded enums.",
  }),
  (columns) => [
    stableIdCheck("event_id")(columns.eventId),
    stableIdCheck("attribution_chain_id")(columns.attributionChainId),
    stableIdCheck("intervention_id")(columns.interventionId),
    stableIdCheck("candidate_id")(columns.candidateId),
    stableIdCheck("task_id")(columns.taskId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("artifact_id")(columns.artifactId),
    stableIdCheck("decision_id")(columns.decisionId),
  ],
) {}

/**
 * Encoded attribution event before decoding.
 *
 * @see {@link TaskIntelligenceAttributionEvent} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskIntelligenceAttributionEvent {
  export type Encoded = S.Codec.Encoded<typeof TaskIntelligenceAttributionEvent>;
}

const hasSubject = (event: TaskIntelligenceAttributionEvent): boolean =>
  A.some(
    [event.candidateId, event.taskId, event.workstreamId, event.artifactId, event.decisionId],
    O.isSome,
  );

const someText = (value: O.Option<string>): boolean => O.isSome(value);

/**
 * Names the linkage an attribution event is missing.
 *
 * **Details**
 *
 * Returns `None` when the event type has the identifiers Python
 * `require_event_specific_linkage` requires. Otherwise returns the Python
 * error text.
 *
 * **Example** (Require a candidate id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskIntelligenceAttributionEvent, linkageFailure } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const event = TaskIntelligenceAttributionEvent.make({
 *   schemaVersion: 1,
 *   eventId: "event-1",
 *   eventType: "candidate_captured",
 *   sourceClass: "manual",
 *   occurredAt: "2020-01-02T03:04:05.000Z",
 * })
 * console.log(O.getOrElse(linkageFailure(event), () => "")) // "candidate_captured requires candidate_id"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const linkageFailure = (event: TaskIntelligenceAttributionEvent): O.Option<string> =>
  Match.value(event.eventType).pipe(
    Match.when("candidate_captured", () =>
      someText(event.candidateId) ? O.none() : O.some("candidate_captured requires candidate_id"),
    ),
    Match.when("candidate_resolved", () => {
      if (!someText(event.candidateId) || O.isNone(event.resolutionCode)) {
        return O.some("candidate_resolved requires candidate_id and resolution_code");
      }
      if (event.resolutionCode.value === "accepted" && !someText(event.taskId) && !someText(event.workstreamId)) {
        return O.some("accepted candidate_resolved requires a task_id or workstream_id");
      }
      return O.none();
    }),
    Match.when("intervention_presented", () =>
      someText(event.interventionId) && hasSubject(event)
        ? O.none()
        : O.some("intervention_presented requires intervention_id and subject"),
    ),
    Match.when("feedback_recorded", () => {
      if (!someText(event.interventionId) || !hasSubject(event) || O.isNone(event.feedbackAction)) {
        return O.some("feedback_recorded requires intervention_id, subject, and feedback_action");
      }
      if (O.isSome(event.feedbackReason) && event.feedbackAction.value !== "dismiss") {
        return O.some("feedback_reason is only valid for dismiss feedback");
      }
      return O.none();
    }),
    Match.when("outcome_recorded", () =>
      someText(event.attributionChainId) && hasSubject(event) && O.isSome(event.outcomeCode)
        ? O.none()
        : O.some("outcome_recorded requires attribution_chain_id, subject, and outcome_code"),
    ),
    Match.exhaustive,
  );

/**
 * Failure of {@link requireEventSpecificLinkage}.
 *
 * **Example** (Read the missing-candidate message)
 *
 * ```ts
 * import { TaskIntelligenceLinkageError } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const error = TaskIntelligenceLinkageError.make({ message: "candidate_captured requires candidate_id" })
 * console.log(error.message) // "candidate_captured requires candidate_id"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaskIntelligenceLinkageError extends S.TaggedError<TaskIntelligenceLinkageError>()(
  "TaskIntelligenceLinkageError",
  { message: S.String },
  $I.annoteError<TaskIntelligenceLinkageError>("TaskIntelligenceLinkageError", {
    description: "A task-intelligence event is missing the identifiers its event type requires.",
  }),
) {}

/**
 * Encoded linkage error before decoding.
 *
 * @see {@link TaskIntelligenceLinkageError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskIntelligenceLinkageError {
  export type Encoded = S.Codec.Encoded<typeof TaskIntelligenceLinkageError>;
}

/**
 * Rejects an attribution event whose type is missing its required ids.
 *
 * **Details**
 *
 * Python `require_event_specific_linkage` raises `ValueError` with a fixed
 * sentence per branch. This fails with {@link TaskIntelligenceLinkageError}
 * carrying that sentence and returns the event when the linkage is present.
 *
 * **Example** (Accept a captured candidate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { TaskIntelligenceAttributionEvent, requireEventSpecificLinkage } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const event = TaskIntelligenceAttributionEvent.make({
 *   schemaVersion: 1,
 *   eventId: "event-1",
 *   eventType: "candidate_captured",
 *   sourceClass: "manual",
 *   candidateId: "candidate-1",
 *   occurredAt: "2020-01-02T03:04:05.000Z",
 * })
 * console.log(Effect.runSync(requireEventSpecificLinkage(event)).eventId) // "event-1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const requireEventSpecificLinkage = Effect.fn("TaskIntelligenceAttributionEvent.requireEventSpecificLinkage")(
  function* (event: TaskIntelligenceAttributionEvent) {
    const failure = linkageFailure(event);
    if (O.isSome(failure)) return yield* TaskIntelligenceLinkageError.make({ message: failure.value });
    return event;
  },
);

const linkageCheck = S.makeFilter(
  (event: TaskIntelligenceAttributionEvent) => {
    const failure = linkageFailure(event);
    return O.isSome(failure) ? failure.value : undefined;
  },
  {
    identifier: "beep/TaskIntelligence/linkage",
    title: "Event linkage",
    description: "Each task-intelligence event type requires the identifiers that make the event attributable.",
  },
);

/**
 * Attribution event schema that also enforces {@link linkageFailure}.
 *
 * **Details**
 *
 * The class decodes the flat record. This checked schema fails when the
 * event type is missing its required identifiers.
 *
 * **Example** (Reject a captured event with no candidate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceAttributionEventLinkage } from "@beep/scratchpad/beep/TaskIntelligence"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(TaskIntelligenceAttributionEventLinkage)({
 *     schemaVersion: 1,
 *     eventId: "event-1",
 *     eventType: "candidate_captured",
 *     sourceClass: "manual",
 *     occurredAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceAttributionEventLinkage = TaskIntelligenceAttributionEvent.check(linkageCheck);

/**
 * Decoded linked attribution event.
 *
 * @see {@link TaskIntelligenceAttributionEventLinkage} for the checked schema.
 * @category type-level
 * @since 0.0.0
 */
export type TaskIntelligenceAttributionEventLinkage = typeof TaskIntelligenceAttributionEventLinkage.Type;
