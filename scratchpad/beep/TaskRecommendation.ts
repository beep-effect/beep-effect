/**
 * Feedback, attention, and What Matters Now contracts.
 *
 * **Details**
 *
 * Action does not split {@link FeedbackCreate} into different fields. Every
 * action carries the same keys; {@link validateFeedbackAction} rejects the
 * illegal combinations. Subject kinds stay uniform literals.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
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
  pg,
  stableId,
  stableIdCheck,
  textBoundsCheck,
  timestamp,
  unitIntervalCheck,
} from "./Kit.ts";
import { boolDefault, jsonbArrayLengthCheck, optionalNull } from "./Port.ts";
import * as A from "@beep/utils/Array";

const $I = $ScratchpadId.create("beep/TaskRecommendation");

const awareInstant = S.String.check(
  S.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/),
).pipe(S.decodeTo(UtcTimestamp));

const aware = (column: string) =>
  awareInstant.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

const optionalAware = (column: string) =>
  optionalNull(awareInstant).pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

const kit = <const L extends A.NonEmptyReadonlyArray<string>>(name: string, description: string, literals: L) =>
  LiteralKit(literals).pipe($I.annoteSchema(name, { description }));

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

const unique = <A>(items: ReadonlyArray<A>): boolean => HashSet.size(HashSet.fromIterable(items)) === items.length;

/**
 * Recommendation or feedback validation failed.
 *
 * **Example** (Read the message)
 *
 * ```ts
 * import { TaskRecommendationError } from "./TaskRecommendation.ts"
 *
 * console.log(TaskRecommendationError.make({ message: "duplicate" }).message) // "duplicate"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaskRecommendationError extends S.TaggedError<TaskRecommendationError>()(
  "TaskRecommendationError",
  { message: S.String },
  $I.annoteError("TaskRecommendationError", { description: "A recommendation or feedback rule failed." }),
) {}

/**
 * Encoded recommendation error.
 *
 * @see {@link TaskRecommendationError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskRecommendationError {
  export type Encoded = S.Codec.Encoded<typeof TaskRecommendationError>;
}

/**
 * What a recommendation can point at.
 *
 * **Example** (Decode an agent open loop)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RecommendationSubjectKind } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(RecommendationSubjectKind)("agent_open_loop"))
 * console.log(decoded) // "agent_open_loop"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecommendationSubjectKind = kit("RecommendationSubjectKind", "Recommendation subject kind.", [
  "candidate",
  "task",
  "workstream",
  "artifact",
  "decision",
  "agent_open_loop",
]);

/** @category type-level @since 0.0.0 */
export type RecommendationSubjectKind = typeof RecommendationSubjectKind.Type;
/** @category type-level @since 0.0.0 */
export declare namespace RecommendationSubjectKind {
  /** @category type-level @since 0.0.0 */
  export type Encoded = S.Codec.Encoded<typeof RecommendationSubjectKind>;
}

/**
 * Subject a feedback row can name. There is no `agent_open_loop` member.
 *
 * **Example** (Decode a decision)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FeedbackSubjectKind } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(FeedbackSubjectKind)("decision"))
 * console.log(decoded) // "decision"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FeedbackSubjectKind = kit("FeedbackSubjectKind", "Feedback subject kind. No agent_open_loop member.", [
  "candidate",
  "task",
  "workstream",
  "artifact",
  "decision",
]);

/** @category type-level @since 0.0.0 */
export type FeedbackSubjectKind = typeof FeedbackSubjectKind.Type;
/** @category type-level @since 0.0.0 */
export declare namespace FeedbackSubjectKind {
  export type Encoded = S.Codec.Encoded<typeof FeedbackSubjectKind>;
}

/**
 * Surface that showed an intervention.
 *
 * **Example** (Decode suggested)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InterventionSurface } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(InterventionSurface)("suggested"))
 * console.log(decoded) // "suggested"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InterventionSurface = kit("InterventionSurface", "Intervention surface.", [
  "suggested",
  "what_matters_now",
]);

/** @category type-level @since 0.0.0 */
export type InterventionSurface = typeof InterventionSurface.Type;
/** @category type-level @since 0.0.0 */
export declare namespace InterventionSurface {
  export type Encoded = S.Codec.Encoded<typeof InterventionSurface>;
}

/**
 * Signal that a recommendation matched local context.
 *
 * **Example** (Decode a meeting signal)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ContextMatchSignal } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ContextMatchSignal)("meeting"))
 * console.log(decoded) // "meeting"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContextMatchSignal = kit("ContextMatchSignal", "Local context match signal.", [
  "app",
  "person",
  "document",
  "meeting",
  "free_time",
  "dependency",
  "agent",
]);

/** @category type-level @since 0.0.0 */
export type ContextMatchSignal = typeof ContextMatchSignal.Type;
/** @category type-level @since 0.0.0 */
export declare namespace ContextMatchSignal {
  export type Encoded = S.Codec.Encoded<typeof ContextMatchSignal>;
}

/**
 * Kind of an open loop reported by a device.
 *
 * **Example** (Decode an approval)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OpenLoopKind } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(OpenLoopKind)("approval"))
 * console.log(decoded) // "approval"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenLoopKind = kit("OpenLoopKind", "Open loop kind.", [
  "task",
  "artifact",
  "decision",
  "approval",
  "external_wait",
]);

/** @category type-level @since 0.0.0 */
export type OpenLoopKind = typeof OpenLoopKind.Type;
/** @category type-level @since 0.0.0 */
export declare namespace OpenLoopKind {
  export type Encoded = S.Codec.Encoded<typeof OpenLoopKind>;
}

/**
 * Status of an open loop.
 *
 * **Example** (Decode blocked)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OpenLoopStatus } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(OpenLoopStatus)("blocked"))
 * console.log(decoded) // "blocked"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenLoopStatus = kit("OpenLoopStatus", "Open loop status.", [
  "open",
  "blocked",
  "awaiting_user",
  "awaiting_external",
]);

/** @category type-level @since 0.0.0 */
export type OpenLoopStatus = typeof OpenLoopStatus.Type;
/** @category type-level @since 0.0.0 */
export declare namespace OpenLoopStatus {
  export type Encoded = S.Codec.Encoded<typeof OpenLoopStatus>;
}

/**
 * Feedback action imported from task intelligence.
 *
 * **Example** (Decode do now)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceFeedbackAction } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskIntelligenceFeedbackAction)("do_now"))
 * console.log(decoded) // "do_now"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceFeedbackAction = kit("TaskIntelligenceFeedbackAction", "Feedback action.", [
  "do_now",
  "later",
  "dismiss",
  "accept_candidate",
  "edit",
  "complete",
]);

/** @category type-level @since 0.0.0 */
export type TaskIntelligenceFeedbackAction = typeof TaskIntelligenceFeedbackAction.Type;
/** @category type-level @since 0.0.0 */
export declare namespace TaskIntelligenceFeedbackAction {
  export type Encoded = S.Codec.Encoded<typeof TaskIntelligenceFeedbackAction>;
}

/**
 * Reason allowed only on dismiss feedback.
 *
 * **Example** (Decode not mine)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceFeedbackReason } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskIntelligenceFeedbackReason)("not_mine"))
 * console.log(decoded) // "not_mine"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceFeedbackReason = kit("TaskIntelligenceFeedbackReason", "Dismiss reason.", [
  "already_handled",
  "not_mine",
  "not_useful",
]);

/** @category type-level @since 0.0.0 */
export type TaskIntelligenceFeedbackReason = typeof TaskIntelligenceFeedbackReason.Type;
/** @category type-level @since 0.0.0 */
export declare namespace TaskIntelligenceFeedbackReason {
  export type Encoded = S.Codec.Encoded<typeof TaskIntelligenceFeedbackReason>;
}

/**
 * Outcome code recorded after an intervention.
 *
 * **Example** (Decode task completed)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskIntelligenceOutcomeCode } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskIntelligenceOutcomeCode)("task_completed"))
 * console.log(decoded) // "task_completed"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskIntelligenceOutcomeCode = kit("TaskIntelligenceOutcomeCode", "Outcome code.", [
  "task_completed",
  "artifact_approved",
  "artifact_delivered",
  "decision_resolved",
  "agent_output_applied",
  "workstream_advanced",
]);

/** @category type-level @since 0.0.0 */
export type TaskIntelligenceOutcomeCode = typeof TaskIntelligenceOutcomeCode.Type;
/** @category type-level @since 0.0.0 */
export declare namespace TaskIntelligenceOutcomeCode {
  export type Encoded = S.Codec.Encoded<typeof TaskIntelligenceOutcomeCode>;
}

/**
 * Kind of evidence a recommendation can cite.
 *
 * **Example** (Decode a conversation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EvidenceKind } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(EvidenceKind)("conversation"))
 * console.log(decoded) // "conversation"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceKind = kit("EvidenceKind", "Evidence kind embedded from action items.", [
  "conversation",
  "memory_item",
  "workstream_event",
  "artifact",
  "chat_message",
  "local_screen",
  "external",
]);

/** @category type-level @since 0.0.0 */
export type EvidenceKind = typeof EvidenceKind.Type;
/** @category type-level @since 0.0.0 */
export declare namespace EvidenceKind {
  export type Encoded = S.Codec.Encoded<typeof EvidenceKind>;
}

/**
 * Scope of an evidence reference.
 *
 * **Example** (Decode device local)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EvidenceScope } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(EvidenceScope)("device_local"))
 * console.log(decoded) // "device_local"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceScope = kit("EvidenceScope", "Evidence scope.", ["canonical", "device_local"]);

/** @category type-level @since 0.0.0 */
export type EvidenceScope = typeof EvidenceScope.Type;
/** @category type-level @since 0.0.0 */
export declare namespace EvidenceScope {
  export type Encoded = S.Codec.Encoded<typeof EvidenceScope>;
}

const optionalFinite = (column: string) =>
  optionalNull(S.Finite.check(S.isGreaterThanOrEqualTo(0))).pipe(pg.doublePrecision(), pg.columnName(column));

/**
 * Evidence citation embedded from the action-item contract.
 *
 * **Details**
 *
 * Device-local evidence requires `deviceId`. Canonical evidence cannot carry
 * one. `local_screen` must be device-local. `endSeconds` cannot precede
 * `startSeconds`. Those rules live in {@link validateEvidenceScope}.
 *
 * **Example** (Decode a canonical conversation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { EvidenceRef } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(EvidenceRef))({ kind: "conversation", id: "c1", scope: "canonical" }),
 * )
 * console.log(decoded.kind) // "conversation"
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
    transcriptSegmentIds: optionalNull(
      S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)).pipe(S.Array),
    ).pipe(pg.jsonb(), pg.columnName("transcript_segment_ids")),
    startSeconds: optionalFinite("start_seconds"),
    endSeconds: optionalFinite("end_seconds"),
  },
  $I.annote("EvidenceRef", { description: "Evidence citation. Scope rules are validateEvidenceScope." }),
  (columns) => [
    stableIdCheck("id")(columns.id),
    textBoundsCheck("version", { maxLength: 128 })(columns.version),
    stableIdCheck("device_id")(columns.deviceId),
    textBoundsCheck("excerpt_hash", { pattern: "^[a-f0-9]{64}$" })(columns.excerptHash),
  ],
) {}

/**
 * Encoded evidence reference.
 *
 * @see {@link EvidenceRef} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EvidenceRef {
  export type Encoded = S.Codec.Encoded<typeof EvidenceRef>;
}

const evidenceMessage = (ref: EvidenceRef): O.Option<string> => {
  if (ref.scope === "device_local" && O.isNone(ref.deviceId)) return O.some("device_local evidence requires device_id");
  if (ref.scope === "canonical" && O.isSome(ref.deviceId)) return O.some("canonical evidence cannot include device_id");
  if (ref.kind === "local_screen" && ref.scope !== "device_local") return O.some("local_screen evidence must be device_local");
  if (O.isSome(ref.startSeconds) && O.isSome(ref.endSeconds) && ref.endSeconds.value < ref.startSeconds.value) {
    return O.some("end_seconds cannot precede start_seconds");
  }
  return O.none();
};

/**
 * Enforce evidence scope, kind, and time order.
 *
 * **Example** (Reject canonical evidence with a device)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { EvidenceRef, validateEvidenceScope } from "./TaskRecommendation.ts"
 *
 * const ref = EvidenceRef.make({ kind: "conversation", id: "c1", scope: "canonical", deviceId: O.some("device-1") })
 * console.log(Effect.runSyncExit(validateEvidenceScope(ref))._tag) // "Failure"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const validateEvidenceScope = Effect.fn("EvidenceRef.validateScope")(function* (ref: EvidenceRef) {
  const message = evidenceMessage(ref);
  if (O.isSome(message)) return yield* TaskRecommendationError.make({ message: message.value });
  return ref;
});

const signalList = S.Array(ContextMatchSignal)
  .check(
    S.isMaxLength(4),
    S.makeFilter((signals: ReadonlyArray<ContextMatchSignal>) =>
      unique(signals) ? undefined : "context_match_signals must be unique",
    ),
  )
  .pipe(S.withConstructorDefault(Effect.sync(() => new Array<ContextMatchSignal>())), pg.jsonb(), pg.columnName("context_match_signals"));

/**
 * Facts the ranker computed before choosing a recommendation.
 *
 * **Example** (Construct empty signals)
 *
 * ```ts
 * import { DeterministicFacts } from "./TaskRecommendation.ts"
 *
 * const facts = DeterministicFacts.make({ hasConcreteNextAction: true, captureConfidence: 1 })
 * console.log(facts.contextMatchSignals.length) // 0
 * console.log(facts.someoneBlocked) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeterministicFacts extends Model<DeterministicFacts>("DeterministicFacts")(
  {
    daysToDue: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("days_to_due")),
    someoneBlocked: boolDefault("someone_blocked", false),
    hasConcreteNextAction: bool("has_concrete_next_action"),
    focusedGoalLinked: boolDefault("focused_goal_linked", false),
    contextMatchSignals: signalList,
    captureConfidence: confidence("capture_confidence"),
  },
  $I.annote("DeterministicFacts", { description: "Ranker facts. Context signals are unique and at most four." }),
  (columns) => [
    jsonbArrayLengthCheck("context_match_signals", { maximum: 4 })(columns.contextMatchSignals),
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace DeterministicFacts {
  export type Encoded = S.Codec.Encoded<typeof DeterministicFacts>;
}

/**
 * Reject duplicate context signals.
 *
 * **Example** (Reject a duplicate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { requireUniqueContextSignals } from "./TaskRecommendation.ts"
 *
 * console.log(Effect.runSyncExit(requireUniqueContextSignals(["app", "app"]))._tag) // "Failure"
 * console.log(Effect.runSync(requireUniqueContextSignals(["app", "meeting"])).length) // 2
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const requireUniqueContextSignals = Effect.fn("DeterministicFacts.requireUniqueContextSignals")(function* (
  signals: ReadonlyArray<ContextMatchSignal>,
) {
  if (!unique(signals)) {
    return yield* TaskRecommendationError.make({ message: "context_match_signals must be unique" });
  }
  return signals;
});

const literalVersion = S.Literal(1).pipe(S.withConstructorDefault(Effect.succeed(1)), pg.integer(), pg.columnName("schema_version"));

/**
 * Whether a subject can enter the shortlist.
 *
 * **Example** (Require every gate)
 *
 * ```ts
 * import { ShortlistEligibility } from "./TaskRecommendation.ts"
 *
 * const gate = ShortlistEligibility.make({
 *   open: true,
 *   unexpired: true,
 *   passesRecommendationGates: true,
 *   recentMaterialActivity: false,
 *   insideDueWindow: true,
 * })
 * console.log(gate.open) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShortlistEligibility extends Model<ShortlistEligibility>("ShortlistEligibility")(
  {
    open: bool("open"),
    unexpired: bool("unexpired"),
    passesRecommendationGates: bool("passes_recommendation_gates"),
    recentMaterialActivity: bool("recent_material_activity"),
    insideDueWindow: bool("inside_due_window"),
  },
  $I.annote("ShortlistEligibility", { description: "Shortlist gates. Every flag is required." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace ShortlistEligibility {
  export type Encoded = S.Codec.Encoded<typeof ShortlistEligibility>;
}

/**
 * One What Matters Now recommendation.
 *
 * **Example** (Decode a headline)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { Recommendation } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(Recommendation))({
 *     intervention_id: "i1",
 *     output_version: "o1",
 *     subject_kind: "task",
 *     subject_id: "t1",
 *     feedback_subject_kind: "task",
 *     feedback_subject_id: "t1",
 *     headline: "Call back",
 *     why_now: "They are waiting",
 *     recommended_action: "call",
 *     evidence_preview: "",
 *     evidence_refs: [{ kind: "conversation", id: "c1", scope: "canonical" }],
 *     dedupe_key: "d1",
 *     expires_at: "2020-01-02T03:04:05Z",
 *   }),
 * )
 * console.log(decoded.headline) // "Call back"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Recommendation extends Model<Recommendation>("Recommendation")(
  {
    interventionId: stableId("intervention_id"),
    outputVersion: stableId("output_version"),
    subjectKind: RecommendationSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    feedbackSubjectKind: FeedbackSubjectKind.pipe(pg.text(), pg.columnName("feedback_subject_kind")),
    feedbackSubjectId: stableId("feedback_subject_id"),
    destinationTaskId: optionalStableId("destination_task_id"),
    destinationWorkstreamId: optionalStableId("destination_workstream_id"),
    headline: boundedText("headline", { minLength: 1, maxLength: 256 }),
    whyNow: boundedText("why_now", { minLength: 1, maxLength: 1024 }),
    goalOrWorkstreamLabel: optionalBoundedText("goal_or_workstream_label", { maxLength: 256 }),
    recommendedAction: boundedText("recommended_action", { minLength: 1, maxLength: 128 }),
    alternativeAction: optionalBoundedText("alternative_action", { maxLength: 128 }),
    evidencePreview: boundedText("evidence_preview", { maxLength: 512 }),
    evidenceRefs: boundedList(EvidenceRef, "evidence_refs", { minimum: 1, maximum: 50 }, false),
    dedupeKey: stableId("dedupe_key"),
    expiresAt: aware("expires_at"),
  },
  $I.annote("Recommendation", { description: "One What Matters Now recommendation." }),
  (columns) => [
    stableIdCheck("intervention_id")(columns.interventionId),
    stableIdCheck("output_version")(columns.outputVersion),
    stableIdCheck("subject_id")(columns.subjectId),
    stableIdCheck("feedback_subject_id")(columns.feedbackSubjectId),
    stableIdCheck("destination_task_id")(columns.destinationTaskId),
    stableIdCheck("destination_workstream_id")(columns.destinationWorkstreamId),
    textBoundsCheck("headline", { minLength: 1, maxLength: 256 })(columns.headline),
    textBoundsCheck("why_now", { minLength: 1, maxLength: 1024 })(columns.whyNow),
    textBoundsCheck("goal_or_workstream_label", { maxLength: 256 })(columns.goalOrWorkstreamLabel),
    textBoundsCheck("recommended_action", { minLength: 1, maxLength: 128 })(columns.recommendedAction),
    textBoundsCheck("alternative_action", { maxLength: 128 })(columns.alternativeAction),
    textBoundsCheck("evidence_preview", { maxLength: 512 })(columns.evidencePreview),
    jsonbArrayLengthCheck("evidence_refs", { minimum: 1, maximum: 50 })(columns.evidenceRefs),
    stableIdCheck("dedupe_key")(columns.dedupeKey),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace Recommendation {
  export type Encoded = S.Codec.Encoded<typeof Recommendation>;
}

/**
 * At most three recommendations for one evaluation.
 *
 * **Example** (Construct version 1)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { WhatMattersNowProjection } from "./TaskRecommendation.ts"
 *
 * const projection = WhatMattersNowProjection.make({
 *   evaluationId: "e1",
 *   outputVersion: "o1",
 *   materialVersion: "m1",
 *   generatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 *   expiresAt: DateTime.makeUnsafe("2020-01-03T03:04:05Z"),
 *   recommendations: [],
 * })
 * console.log(projection.schemaVersion) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WhatMattersNowProjection extends Model<WhatMattersNowProjection>("WhatMattersNowProjection")(
  {
    schemaVersion: literalVersion,
    evaluationId: stableId("evaluation_id"),
    outputVersion: stableId("output_version"),
    materialVersion: stableId("material_version"),
    generatedAt: aware("generated_at"),
    expiresAt: aware("expires_at"),
    recommendations: boundedList(Recommendation, "recommendations", { maximum: 3 }, false),
  },
  $I.annote("WhatMattersNowProjection", { description: "What Matters Now projection. schema_version is 1." }),
  (columns) => [
    stableIdCheck("evaluation_id")(columns.evaluationId),
    stableIdCheck("output_version")(columns.outputVersion),
    stableIdCheck("material_version")(columns.materialVersion),
    jsonbArrayLengthCheck("recommendations", { maximum: 3 })(columns.recommendations),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace WhatMattersNowProjection {
  export type Encoded = S.Codec.Encoded<typeof WhatMattersNowProjection>;
}

/**
 * Feedback a client can record.
 *
 * **Gotchas**
 *
 * `reason` is legal only for `dismiss`. `laterUntil` is legal only for `later`.
 * `do_now`, `later`, and `dismiss` require `interventionId`. Accept, edit, and
 * complete do not. The fields do not change shape, so this is not a tagged union.
 *
 * **Example** (Construct a dismiss)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { FeedbackCreate } from "./TaskRecommendation.ts"
 *
 * const feedback = FeedbackCreate.make({
 *   subjectKind: "task",
 *   subjectId: "t1",
 *   action: "dismiss",
 *   interventionId: O.some("i1"),
 *   reason: O.some("not_mine"),
 * })
 * console.log(feedback.action) // "dismiss"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackCreate extends Model<FeedbackCreate>("FeedbackCreate")(
  {
    subjectKind: FeedbackSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    interventionId: optionalStableId("intervention_id"),
    action: TaskIntelligenceFeedbackAction.pipe(pg.text(), pg.columnName("action")),
    reason: optionalNull(TaskIntelligenceFeedbackReason).pipe(pg.text(), pg.columnName("reason")),
    contextSnapshotHash: optionalBoundedText("context_snapshot_hash", { pattern: "^[a-f0-9]{64}$" }),
    laterUntil: optionalAware("later_until"),
  },
  $I.annote("FeedbackCreate", { description: "Feedback create. Action rules are validateFeedbackAction." }),
  (columns) => [
    stableIdCheck("subject_id")(columns.subjectId),
    stableIdCheck("intervention_id")(columns.interventionId),
    textBoundsCheck("context_snapshot_hash", { pattern: "^[a-f0-9]{64}$" })(columns.contextSnapshotHash),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackCreate {
  export type Encoded = S.Codec.Encoded<typeof FeedbackCreate>;
}

const needsIntervention = (action: TaskIntelligenceFeedbackAction): boolean =>
  action === "do_now" || action === "later" || action === "dismiss";

/**
 * Enforce the feedback action rules.
 *
 * **Example** (Reject a reason on do now)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { FeedbackCreate, validateFeedbackAction } from "./TaskRecommendation.ts"
 *
 * const feedback = FeedbackCreate.make({
 *   subjectKind: "task",
 *   subjectId: "t1",
 *   action: "do_now",
 *   interventionId: O.some("i1"),
 *   reason: O.some("not_mine"),
 * })
 * console.log(Effect.runSyncExit(validateFeedbackAction(feedback))._tag) // "Failure"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const validateFeedbackAction = Effect.fn("FeedbackCreate.validateAction")(function* (feedback: FeedbackCreate) {
  if (O.isSome(feedback.reason) && feedback.action !== "dismiss") {
    return yield* TaskRecommendationError.make({ message: "reason is only valid for dismiss" });
  }
  if (O.isSome(feedback.laterUntil) && feedback.action !== "later") {
    return yield* TaskRecommendationError.make({ message: "later_until is only valid for later" });
  }
  if (needsIntervention(feedback.action) && O.isNone(feedback.interventionId)) {
    return yield* TaskRecommendationError.make({ message: `${feedback.action} requires intervention_id` });
  }
  return feedback;
});

const doc = (name: string, description: string) => $I.annote(name, { description });

/**
 * Request to record that an intervention was shown.
 *
 * **Example** (Construct an empty evidence list)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { InterventionCreate } from "./TaskRecommendation.ts"
 *
 * const created = InterventionCreate.make({
 *   surface: "suggested",
 *   subjectKind: "task",
 *   subjectId: "t1",
 *   dedupeKey: "d1",
 *   expiresAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 * })
 * console.log(created.evidenceRefs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InterventionCreate extends Model<InterventionCreate>("InterventionCreate")(
  {
    surface: InterventionSurface.pipe(pg.text(), pg.columnName("surface")),
    subjectKind: FeedbackSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    dedupeKey: stableId("dedupe_key"),
    evidenceRefs: boundedList(EvidenceRef, "evidence_refs", { maximum: 50 }, true),
    expiresAt: aware("expires_at"),
  },
  doc("InterventionCreate", "Intervention create. Evidence constructs empty and is capped at 50."),
  (columns) => [
    stableIdCheck("subject_id")(columns.subjectId),
    stableIdCheck("dedupe_key")(columns.dedupeKey),
    jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace InterventionCreate {
  export type Encoded = S.Codec.Encoded<typeof InterventionCreate>;
}

/**
 * Stored intervention, including its id and attribution chain.
 *
 * **Example** (Read the chain id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { InterventionRecord } from "./TaskRecommendation.ts"
 *
 * const record = InterventionRecord.make({
 *   surface: "what_matters_now",
 *   subjectKind: "task",
 *   subjectId: "t1",
 *   dedupeKey: "d1",
 *   expiresAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 *   interventionId: "i1",
 *   attributionChainId: "a1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 * })
 * console.log(record.interventionId) // "i1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InterventionRecord extends Model<InterventionRecord>("InterventionRecord")(
  {
    surface: InterventionSurface.pipe(pg.text(), pg.columnName("surface")),
    subjectKind: FeedbackSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    dedupeKey: stableId("dedupe_key"),
    evidenceRefs: boundedList(EvidenceRef, "evidence_refs", { maximum: 50 }, true),
    expiresAt: aware("expires_at"),
    interventionId: stableId("intervention_id"),
    attributionChainId: stableId("attribution_chain_id"),
    createdAt: aware("created_at"),
  },
  doc("InterventionRecord", "Stored intervention plus its attribution chain."),
  (columns) => [
    stableIdCheck("subject_id")(columns.subjectId),
    stableIdCheck("dedupe_key")(columns.dedupeKey),
    stableIdCheck("intervention_id")(columns.interventionId),
    stableIdCheck("attribution_chain_id")(columns.attributionChainId),
    jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace InterventionRecord {
  export type Encoded = S.Codec.Encoded<typeof InterventionRecord>;
}

/**
 * Stored feedback, including completion proposals.
 *
 * **Example** (Leave the completion candidate empty)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { FeedbackRecord } from "./TaskRecommendation.ts"
 *
 * const record = FeedbackRecord.make({
 *   subjectKind: "task",
 *   subjectId: "t1",
 *   action: "complete",
 *   feedbackId: "f1",
 *   attributionChainId: "a1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 * })
 * console.log(record.proposedCompletion) // false
 * console.log(O.isNone(record.proposedCompletionCandidateId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedbackRecord extends Model<FeedbackRecord>("FeedbackRecord")(
  {
    subjectKind: FeedbackSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    interventionId: optionalStableId("intervention_id"),
    action: TaskIntelligenceFeedbackAction.pipe(pg.text(), pg.columnName("action")),
    reason: optionalNull(TaskIntelligenceFeedbackReason).pipe(pg.text(), pg.columnName("reason")),
    contextSnapshotHash: optionalBoundedText("context_snapshot_hash", { pattern: "^[a-f0-9]{64}$" }),
    laterUntil: optionalAware("later_until"),
    feedbackId: stableId("feedback_id"),
    attributionChainId: stableId("attribution_chain_id"),
    createdAt: aware("created_at"),
    dedupeKey: optionalStableId("dedupe_key"),
    proposedCompletion: boolDefault("proposed_completion", false),
    proposedCompletionCandidateId: optionalStableId("proposed_completion_candidate_id"),
  },
  doc("FeedbackRecord", "Stored feedback. The create-action rules still apply."),
  (columns) => [
    stableIdCheck("subject_id")(columns.subjectId),
    stableIdCheck("intervention_id")(columns.interventionId),
    stableIdCheck("feedback_id")(columns.feedbackId),
    stableIdCheck("attribution_chain_id")(columns.attributionChainId),
    stableIdCheck("dedupe_key")(columns.dedupeKey),
    stableIdCheck("proposed_completion_candidate_id")(columns.proposedCompletionCandidateId),
    textBoundsCheck("context_snapshot_hash", { pattern: "^[a-f0-9]{64}$" })(columns.contextSnapshotHash),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FeedbackRecord {
  export type Encoded = S.Codec.Encoded<typeof FeedbackRecord>;
}

/**
 * Request to record an outcome.
 *
 * **Example** (Record a completed task)
 *
 * ```ts
 * import { OutcomeCreate } from "./TaskRecommendation.ts"
 *
 * const outcome = OutcomeCreate.make({
 *   attributionChainId: "a1",
 *   subjectKind: "task",
 *   subjectId: "t1",
 *   outcomeCode: "task_completed",
 * })
 * console.log(outcome.outcomeCode) // "task_completed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutcomeCreate extends Model<OutcomeCreate>("OutcomeCreate")(
  {
    attributionChainId: stableId("attribution_chain_id"),
    subjectKind: FeedbackSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    outcomeCode: TaskIntelligenceOutcomeCode.pipe(pg.text(), pg.columnName("outcome_code")),
  },
  doc("OutcomeCreate", "Outcome create request."),
  (columns) => [
    stableIdCheck("attribution_chain_id")(columns.attributionChainId),
    stableIdCheck("subject_id")(columns.subjectId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace OutcomeCreate {
  export type Encoded = S.Codec.Encoded<typeof OutcomeCreate>;
}

/**
 * Stored outcome.
 *
 * **Example** (Read the outcome id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { OutcomeRecord } from "./TaskRecommendation.ts"
 *
 * const record = OutcomeRecord.make({
 *   attributionChainId: "a1",
 *   subjectKind: "task",
 *   subjectId: "t1",
 *   outcomeCode: "task_completed",
 *   outcomeId: "o1",
 *   occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 * })
 * console.log(record.outcomeId) // "o1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutcomeRecord extends Model<OutcomeRecord>("OutcomeRecord")(
  {
    attributionChainId: stableId("attribution_chain_id"),
    subjectKind: FeedbackSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    outcomeCode: TaskIntelligenceOutcomeCode.pipe(pg.text(), pg.columnName("outcome_code")),
    outcomeId: stableId("outcome_id"),
    occurredAt: aware("occurred_at"),
  },
  doc("OutcomeRecord", "Stored outcome."),
  (columns) => [
    stableIdCheck("attribution_chain_id")(columns.attributionChainId),
    stableIdCheck("subject_id")(columns.subjectId),
    stableIdCheck("outcome_id")(columns.outcomeId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace OutcomeRecord {
  export type Encoded = S.Codec.Encoded<typeof OutcomeRecord>;
}

const matchSignals = S.Array(ContextMatchSignal)
  .check(
    S.isMinLength(1),
    S.isMaxLength(4),
    S.makeFilter((signals: ReadonlyArray<ContextMatchSignal>) => (unique(signals) ? undefined : "signals must be unique")),
  )
  .pipe(pg.jsonb(), pg.columnName("signals"));

/**
 * One subject matched by local context.
 *
 * **Example** (Require one signal)
 *
 * ```ts
 * import { NormalizedContextMatch } from "./TaskRecommendation.ts"
 *
 * const match = NormalizedContextMatch.make({ subjectKind: "task", subjectId: "t1", signals: ["meeting"] })
 * console.log(match.signals[0]) // "meeting"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizedContextMatch extends Model<NormalizedContextMatch>("NormalizedContextMatch")(
  {
    subjectKind: RecommendationSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    signals: matchSignals,
  },
  doc("NormalizedContextMatch", "Local context match. Signals are unique and between 1 and 4."),
  (columns) => [
    stableIdCheck("subject_id")(columns.subjectId),
    jsonbArrayLengthCheck("signals", { minimum: 1, maximum: 4 })(columns.signals),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace NormalizedContextMatch {
  export type Encoded = S.Codec.Encoded<typeof NormalizedContextMatch>;
}

/**
 * Reject duplicate match signals.
 *
 * **Example** (Accept one signal)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { requireUniqueMatchSignals } from "./TaskRecommendation.ts"
 *
 * console.log(Effect.runSync(requireUniqueMatchSignals(["app"])).length) // 1
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const requireUniqueMatchSignals = Effect.fn("NormalizedContextMatch.requireUniqueSignals")(function* (
  signals: ReadonlyArray<ContextMatchSignal>,
) {
  if (signals.length < 1 || signals.length > 4 || !unique(signals)) {
    return yield* TaskRecommendationError.make({ message: "signals must be unique and between 1 and 4" });
  }
  return signals;
});

/**
 * Bounded local match result. Raw local context has no field to enter through.
 *
 * **Example** (Construct an empty match list)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { NormalizedContextSnapshot } from "./TaskRecommendation.ts"
 *
 * const snapshot = NormalizedContextSnapshot.make({
 *   deviceId: "d1",
 *   snapshotId: "s1",
 *   generatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 *   expiresAt: DateTime.makeUnsafe("2020-01-02T04:04:05Z"),
 * })
 * console.log(snapshot.schemaVersion) // 1
 * console.log(snapshot.matches.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizedContextSnapshot extends Model<NormalizedContextSnapshot>("NormalizedContextSnapshot")(
  {
    schemaVersion: S.Literal(1).pipe(S.withConstructorDefault(Effect.succeed(1)), pg.integer(), pg.columnName("schema_version")),
    deviceId: stableId("device_id"),
    snapshotId: stableId("snapshot_id"),
    matches: boundedList(NormalizedContextMatch, "matches", { maximum: 32 }, true),
    generatedAt: aware("generated_at"),
    expiresAt: aware("expires_at"),
  },
  doc("NormalizedContextSnapshot", "Bounded local matches. Raw context cannot be stored here."),
  (columns) => [
    stableIdCheck("device_id")(columns.deviceId),
    stableIdCheck("snapshot_id")(columns.snapshotId),
    jsonbArrayLengthCheck("matches", { maximum: 32 })(columns.matches),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace NormalizedContextSnapshot {
  export type Encoded = S.Codec.Encoded<typeof NormalizedContextSnapshot>;
}

/**
 * One open loop on a device.
 *
 * **Example** (Leave the blocker empty)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { OpenLoopDescriptor } from "./TaskRecommendation.ts"
 *
 * const loop = OpenLoopDescriptor.make({
 *   loopId: "l1",
 *   kind: "approval",
 *   subjectId: "s1",
 *   status: "open",
 *   nextActionCode: "review",
 *   updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 * })
 * console.log(O.isNone(loop.blockingOnId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenLoopDescriptor extends Model<OpenLoopDescriptor>("OpenLoopDescriptor")(
  {
    loopId: stableId("loop_id"),
    kind: OpenLoopKind.pipe(pg.text(), pg.columnName("kind")),
    subjectId: stableId("subject_id"),
    status: OpenLoopStatus.pipe(pg.text(), pg.columnName("status")),
    nextActionCode: stableId("next_action_code"),
    blockingOnId: optionalStableId("blocking_on_id"),
    updatedAt: aware("updated_at"),
  },
  doc("OpenLoopDescriptor", "One open loop. next_action_code is a stable id, not prose."),
  (columns) => [
    stableIdCheck("loop_id")(columns.loopId),
    stableIdCheck("subject_id")(columns.subjectId),
    stableIdCheck("next_action_code")(columns.nextActionCode),
    stableIdCheck("blocking_on_id")(columns.blockingOnId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace OpenLoopDescriptor {
  export type Encoded = S.Codec.Encoded<typeof OpenLoopDescriptor>;
}

/**
 * Device snapshot of open loops.
 *
 * **Example** (Construct an empty loop list)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { OpenLoopSnapshot } from "./TaskRecommendation.ts"
 *
 * const snapshot = OpenLoopSnapshot.make({
 *   deviceId: "d1",
 *   owner: "o1",
 *   runtimeId: "r1",
 *   workstreamId: "w1",
 *   conversationId: "c1",
 *   contextPacketVersion: "v1",
 *   generatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
 *   expiresAt: DateTime.makeUnsafe("2020-01-02T04:04:05Z"),
 * })
 * console.log(snapshot.openLoopSnapshot.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenLoopSnapshot extends Model<OpenLoopSnapshot>("OpenLoopSnapshot")(
  {
    schemaVersion: S.Literal(1).pipe(S.withConstructorDefault(Effect.succeed(1)), pg.integer(), pg.columnName("schema_version")),
    deviceId: stableId("device_id"),
    owner: stableId("owner"),
    runtimeId: stableId("runtime_id"),
    workstreamId: stableId("workstream_id"),
    conversationId: stableId("conversation_id"),
    contextPacketVersion: stableId("context_packet_version"),
    checkpointRef: optionalStableId("checkpoint_ref"),
    openLoopSnapshot: boundedList(OpenLoopDescriptor, "open_loop_snapshot", { maximum: 32 }, true),
    generatedAt: aware("generated_at"),
    expiresAt: aware("expires_at"),
  },
  doc("OpenLoopSnapshot", "Device open-loop snapshot. The list field repeats the type name."),
  (columns) => [
    stableIdCheck("device_id")(columns.deviceId),
    stableIdCheck("owner")(columns.owner),
    stableIdCheck("runtime_id")(columns.runtimeId),
    stableIdCheck("workstream_id")(columns.workstreamId),
    stableIdCheck("conversation_id")(columns.conversationId),
    stableIdCheck("context_packet_version")(columns.contextPacketVersion),
    stableIdCheck("checkpoint_ref")(columns.checkpointRef),
    jsonbArrayLengthCheck("open_loop_snapshot", { maximum: 32 })(columns.openLoopSnapshot),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace OpenLoopSnapshot {
  export type Encoded = S.Codec.Encoded<typeof OpenLoopSnapshot>;
}

/**
 * Optional hint that starts an evaluation.
 *
 * **Example** (Omit both hints)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { EvaluationRequest } from "./TaskRecommendation.ts"
 *
 * const request = EvaluationRequest.make({})
 * console.log(O.isNone(request.deviceId)) // true
 * console.log(O.isNone(request.materialHint)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvaluationRequest extends Model<EvaluationRequest>("EvaluationRequest")(
  {
    deviceId: optionalStableId("device_id"),
    materialHint: optionalStableId("material_hint"),
  },
  doc("EvaluationRequest", "Optional device and material hints for an evaluation."),
  (columns) => [stableIdCheck("device_id")(columns.deviceId), stableIdCheck("material_hint")(columns.materialHint)],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace EvaluationRequest {
  export type Encoded = S.Codec.Encoded<typeof EvaluationRequest>;
}

/**
 * Debug audit of one ranking decision. It stores no prompt or model reasoning.
 *
 * **Example** (Cap the summary)
 *
 * ```ts
 * import { DecisionRecord } from "./TaskRecommendation.ts"
 *
 * console.log(DecisionRecord.fields.decisionSummary !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DecisionRecord extends Model<DecisionRecord>("DecisionRecord")(
  {
    evaluationId: stableId("evaluation_id"),
    subjectKind: RecommendationSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: stableId("subject_id"),
    shortlistIds: boundedList(
      S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)),
      "shortlist_ids",
      { maximum: 20 },
      false,
    ),
    factsSnapshot: DeterministicFacts.pipe(pg.jsonb(), pg.columnName("facts_snapshot")),
    eligibility: ShortlistEligibility.pipe(pg.jsonb(), pg.columnName("eligibility")),
    promptVersion: stableId("prompt_version"),
    policyVersion: stableId("policy_version"),
    factDefinitionVersion: stableId("fact_definition_version"),
    modelVersion: stableId("model_version"),
    decisionSummary: boundedText("decision_summary", { maxLength: 1024 }),
    reasonCodes: boundedList(S.String, "reason_codes", { maximum: 8 }, false),
    evidenceRefs: boundedList(EvidenceRef, "evidence_refs", { maximum: 50 }, true),
    finalOutputRef: stableId("final_output_ref"),
    evaluatedAt: aware("evaluated_at"),
    expiresAt: aware("expires_at"),
  },
  doc("DecisionRecord", "Debug audit. It stores no prompt or model reasoning."),
  (columns) => [
    stableIdCheck("evaluation_id")(columns.evaluationId),
    stableIdCheck("subject_id")(columns.subjectId),
    jsonbArrayLengthCheck("shortlist_ids", { maximum: 20 })(columns.shortlistIds),
    stableIdCheck("prompt_version")(columns.promptVersion),
    stableIdCheck("policy_version")(columns.policyVersion),
    stableIdCheck("fact_definition_version")(columns.factDefinitionVersion),
    stableIdCheck("model_version")(columns.modelVersion),
    textBoundsCheck("decision_summary", { maxLength: 1024 })(columns.decisionSummary),
    jsonbArrayLengthCheck("reason_codes", { maximum: 8 })(columns.reasonCodes),
    jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
    stableIdCheck("final_output_ref")(columns.finalOutputRef),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace DecisionRecord {
  export type Encoded = S.Codec.Encoded<typeof DecisionRecord>;
}

/**
 * Projection plus the debug decisions that produced it.
 *
 * **Example** (Require both halves)
 *
 * ```ts
 * import { DecisionDebugProjection } from "./TaskRecommendation.ts"
 *
 * console.log(DecisionDebugProjection.fields.projection !== undefined) // true
 * console.log(DecisionDebugProjection.fields.decisions !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DecisionDebugProjection extends Model<DecisionDebugProjection>("DecisionDebugProjection")(
  {
    projection: WhatMattersNowProjection.pipe(pg.jsonb(), pg.columnName("projection")),
    decisions: S.Array(DecisionRecord).pipe(pg.jsonb(), pg.columnName("decisions")),
  },
  doc("DecisionDebugProjection", "What Matters Now projection plus its debug decisions."),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace DecisionDebugProjection {
  export type Encoded = S.Codec.Encoded<typeof DecisionDebugProjection>;
}

/**
 * Receipt that a snapshot was stored. `expiresAt` is a plain datetime, not an aware one.
 *
 * **Example** (Decode a naive expiry)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { SnapshotReceipt } from "./TaskRecommendation.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(SnapshotReceipt))({
 *     snapshot_id: "s1",
 *     replaced: true,
 *     expires_at: "2020-01-02T03:04:05",
 *   }),
 * )
 * console.log(decoded.replaced) // true
 * console.log(DateTime.formatIso(decoded.expiresAt)) // "2020-01-02T03:04:05.000Z"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SnapshotReceipt extends Model<SnapshotReceipt>("SnapshotReceipt")(
  {
    snapshotId: stableId("snapshot_id"),
    replaced: bool("replaced"),
    expiresAt: timestamp("expires_at"),
  },
  doc("SnapshotReceipt", "Snapshot receipt. expires_at is a plain datetime read as UTC."),
  (columns) => [stableIdCheck("snapshot_id")(columns.snapshotId)],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace SnapshotReceipt {
  export type Encoded = S.Codec.Encoded<typeof SnapshotReceipt>;
}
