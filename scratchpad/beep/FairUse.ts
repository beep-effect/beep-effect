/**
 * Fair-use enforcement records.
 *
 * **Details**
 *
 * Clocks in this module are naive UTC: the Python factory takes an aware UTC
 * instant and drops the timezone. The wire therefore has no `Z` suffix. Other
 * modules in this batch keep an aware UTC string or a plain date string.
 * `enforcement_action` stays an open string.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { UtcTimestamp, text, userId } from "./Kit.ts";
import { boolDefault, finiteDefault, intDefault, jsonList, Model, optionalJsonColumn, optionalNull, pg, textDefault } from "./Port.ts";

const $I = $ScratchpadId.create("beep/FairUse");

const stripUtcSuffix = (value: string): string => Str.replace(/Z$/u, "")(value);

/**
 * Naive UTC instant.
 *
 * **Details**
 *
 * A string with no zone is read as UTC, matching the Python clock that stores
 * `datetime.now(timezone.utc).replace(tzinfo=None)`. Encoding drops the `Z`
 * so the stored form stays naive. Offset strings are converted to UTC and
 * then written without a zone.
 *
 * **Example** (Round-trip a naive stamp)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { NaiveUtcTimestamp } from "@beep/scratchpad/beep/FairUse"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(NaiveUtcTimestamp)("2020-01-02T03:04:05.000"))
 * const encoded = Effect.runSync(S.encodeEffect(NaiveUtcTimestamp)(decoded))
 * console.log(encoded) // "2020-01-02T03:04:05.000"
 * ```
 *
 * @see {@link fairUseUtcNow} for the clock.
 * @category schemas
 * @since 0.0.0
 */
export const NaiveUtcTimestamp = S.String.pipe(
  S.decodeTo(UtcTimestamp, {
    decode: SchemaGetter.transform((value: string) => value),
    encode: SchemaGetter.transform(stripUtcSuffix),
  }),
  $I.annoteSchema("NaiveUtcTimestamp", {
    description: "UTC instant stored without a zone suffix. Zoneless input is read as UTC.",
  }),
);

/**
 * Decoded naive UTC instant.
 *
 * @see {@link NaiveUtcTimestamp} for the runtime codec.
 * @category type-level
 * @since 0.0.0
 */
export type NaiveUtcTimestamp = typeof NaiveUtcTimestamp.Type;

const naiveNow = Effect.sync(() => DateTime.toUtc(DateTime.nowUnsafe()));

const naiveColumn = pg.timestamp({ mode: "string", withTimezone: false });

const naiveTimestamp = (column: string) =>
  NaiveUtcTimestamp.pipe(S.withConstructorDefault(naiveNow), naiveColumn, pg.columnName(column));

const optionalNaiveTimestamp = (column: string) =>
  NaiveUtcTimestamp.pipe(optionalNull, naiveColumn, pg.columnName(column));

/**
 * Current naive UTC instant used by fair-use rows.
 *
 * **Details**
 *
 * The returned value is a UTC instant. {@link NaiveUtcTimestamp} writes it
 * without a timezone suffix.
 *
 * **Example** (Read the clock)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { fairUseUtcNow } from "@beep/scratchpad/beep/FairUse"
 *
 * const now = Effect.runSync(fairUseUtcNow())
 * console.log(typeof now.epochMilliseconds) // "number"
 * ```
 *
 * @see {@link NaiveUtcTimestamp} for the wire form.
 * @category clocks
 * @since 0.0.0
 */
export const fairUseUtcNow = Effect.fn("FairUse.utcNow")(function* () {
  return DateTime.toUtc(DateTime.nowUnsafe());
});

/**
 * Graduated enforcement stage.
 *
 * **Details**
 *
 * Graduated enforcement stages.
 *
 * **Example** (Decode restrict)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FairUseStage } from "@beep/scratchpad/beep/FairUse"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(FairUseStage)("restrict"))) // "restrict"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FairUseStage = LiteralKit(["none", "warning", "throttle", "restrict"]).pipe(
  $I.annoteSchema("FairUseStage", { description: "Graduated enforcement stages." }),
);

/**
 * Decoded fair-use stage.
 *
 * @see {@link FairUseStage} for the runtime literal set.
 * @category type-level
 * @since 0.0.0
 */
export type FairUseStage = typeof FairUseStage.Type;

/**
 * Kind of detected non-personal usage.
 *
 * **Details**
 *
 * Types of detected non-personal usage.
 *
 * **Example** (Decode tv_movie)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { UsageType } from "@beep/scratchpad/beep/FairUse"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(UsageType)("tv_movie"))) // "tv_movie"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsageType = LiteralKit([
  "none",
  "audiobook",
  "podcast",
  "prerecorded",
  "tv_movie",
  "commercial",
  "unknown",
  "free_exhausted",
]).pipe($I.annoteSchema("UsageType", { description: "Types of detected non-personal usage." }));

/**
 * Decoded usage type.
 *
 * @see {@link UsageType} for the runtime literal set.
 * @category type-level
 * @since 0.0.0
 */
export type UsageType = typeof UsageType.Type;

/**
 * Rolling window that tripped the soft cap.
 *
 * **Details**
 *
 * Which rolling window triggered the soft cap. The three-day window is the
 * wire value `3day`, not `THREE_DAY`.
 *
 * **Gotchas**
 *
 * Decoding `THREE_DAY` fails. The stored value is `3day`.
 *
 * **Example** (Decode the three-day window)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SoftCapTrigger } from "@beep/scratchpad/beep/FairUse"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(SoftCapTrigger)("3day"))) // "3day"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SoftCapTrigger = LiteralKit(["daily", "3day", "weekly"]).pipe(
  $I.annoteSchema("SoftCapTrigger", { description: "Which rolling window triggered the soft cap." }),
);

/**
 * Decoded soft-cap trigger.
 *
 * @see {@link SoftCapTrigger} for the runtime literal set.
 * @category type-level
 * @since 0.0.0
 */
export type SoftCapTrigger = typeof SoftCapTrigger.Type;

const noneStage = "none";
const noneUsage = "none";
const dailyTrigger = "daily";
const emptyInts = (): { readonly [key: string]: number } => ({});

const stageField = (column: string) =>
  FairUseStage.pipe(S.withConstructorDefault(Effect.succeed(noneStage)), pg.text(), pg.columnName(column));

const usageField = (column: string) =>
  UsageType.pipe(S.withConstructorDefault(Effect.succeed(noneUsage)), pg.text(), pg.columnName(column));

const intMap = (column: string) =>
  S.Record(S.String, S.Int).pipe(
    S.withConstructorDefault(Effect.sync(emptyInts)),
    pg.jsonb(),
    pg.columnName(column),
  );

/**
 * Evidence from one conversation flagged by the classifier.
 *
 * **Details**
 *
 * Evidence from a single conversation flagged by the LLM classifier.
 * Title, category, and reason construct as empty strings.
 *
 * **Example** (Construct empty evidence text)
 *
 * ```ts
 * import { ClassifierEvidence } from "@beep/scratchpad/beep/FairUse"
 *
 * const evidence = ClassifierEvidence.make({ conversationId: "c1" })
 * console.log(evidence.title) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClassifierEvidence extends Model<ClassifierEvidence>("ClassifierEvidence")(
  {
    conversationId: text("conversation_id"),
    title: textDefault("title", ""),
    category: textDefault("category", ""),
    reason: textDefault("reason", ""),
  },
  $I.annote("ClassifierEvidence", {
    description: "Evidence from a single conversation flagged by the LLM classifier.",
  }),
) {}

/**
 * Encoded form of {@link ClassifierEvidence}.
 *
 * @see {@link ClassifierEvidenceWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClassifierEvidence {
  export type Encoded = S.Codec.Encoded<typeof ClassifierEvidence>;
}

/**
 * Snake_case codec for {@link ClassifierEvidence}.
 *
 * **Example** (Decode a conversation id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClassifierEvidenceWire } from "@beep/scratchpad/beep/FairUse"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ClassifierEvidenceWire)({
 *     conversation_id: "c1",
 *     title: "",
 *     category: "",
 *     reason: "",
 *   }),
 * )
 * console.log(decoded.conversationId) // "c1"
 * ```
 *
 * @see {@link ClassifierEvidence} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const ClassifierEvidenceWire = ClassifierEvidence.pipe(S.encodeKeys({ conversationId: "conversation_id" }));

/**
 * Result from the LLM fair-use classifier.
 *
 * **Details**
 *
 * Result from the LLM fair-use classifier. `prompt_version` constructs as
 * `v2`. Scores construct as 0. `usage_type` constructs as `none`. Evidence
 * constructs as an empty list.
 *
 * **Example** (Construct classifier defaults)
 *
 * ```ts
 * import { ClassifierResult } from "@beep/scratchpad/beep/FairUse"
 *
 * const result = ClassifierResult.make({})
 * console.log(result.promptVersion) // "v2"
 * console.log(result.usageType) // "none"
 * console.log(result.evidence.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClassifierResult extends Model<ClassifierResult>("ClassifierResult")(
  {
    model: textDefault("model", ""),
    promptVersion: textDefault("prompt_version", "v2"),
    misuseScore: finiteDefault("misuse_score", 0),
    usageType: usageField("usage_type"),
    confidence: finiteDefault("confidence", 0),
    evidence: jsonList(ClassifierEvidenceWire, "evidence"),
  },
  $I.annote("ClassifierResult", {
    description: "Result from the LLM fair-use classifier.",
  }),
) {}

/**
 * Encoded form of {@link ClassifierResult}.
 *
 * @see {@link ClassifierResultWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClassifierResult {
  export type Encoded = S.Codec.Encoded<typeof ClassifierResult>;
}

/**
 * Snake_case codec for {@link ClassifierResult}.
 *
 * **Example** (Decode the default prompt version)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClassifierResultWire } from "@beep/scratchpad/beep/FairUse"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ClassifierResultWire)({
 *     model: "",
 *     prompt_version: "v2",
 *     misuse_score: 0,
 *     usage_type: "none",
 *     confidence: 0,
 *     evidence: [],
 *   }),
 * )
 * console.log(decoded.promptVersion) // "v2"
 * ```
 *
 * @see {@link ClassifierResult} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const ClassifierResultWire = ClassifierResult.pipe(
  S.encodeKeys({
    promptVersion: "prompt_version",
    misuseScore: "misuse_score",
    usageType: "usage_type",
  }),
);

/**
 * Per-user fair use enforcement state.
 *
 * **Details**
 *
 * Per-user fair use enforcement state. Stored at
 * `users/{uid}/fair_use_state/current`. Stage constructs as `none`. Violation
 * counts construct as 0 and are not bounded below. Optional instants are naive
 * UTC. `updated_at` constructs from {@link fairUseUtcNow}.
 *
 * **Gotchas**
 *
 * Missing keys fail decode. Call `make` for the constructor defaults. The
 * encoded clock has no `Z`.
 *
 * **Example** (Construct the idle stage)
 *
 * ```ts
 * import { FairUseState } from "@beep/scratchpad/beep/FairUse"
 *
 * const state = FairUseState.make({})
 * console.log(state.stage) // "none"
 * console.log(state.violationCount7d) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FairUseState extends Model<FairUseState>("FairUseState")(
  {
    stage: stageField("stage"),
    violationCount7d: intDefault("violation_count_7d", 0),
    violationCount30d: intDefault("violation_count_30d", 0),
    lastViolationAt: optionalNaiveTimestamp("last_violation_at"),
    throttleUntil: optionalNaiveTimestamp("throttle_until"),
    restrictUntil: optionalNaiveTimestamp("restrict_until"),
    lastClassifierScore: finiteDefault("last_classifier_score", 0),
    lastClassifierType: usageField("last_classifier_type"),
    updatedAt: naiveTimestamp("updated_at"),
  },
  $I.annote("FairUseState", {
    description: "Per-user fair use enforcement state stored at users/{uid}/fair_use_state/current.",
  }),
) {}

/**
 * Encoded form of {@link FairUseState}.
 *
 * @see {@link FairUseStateWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FairUseState {
  export type Encoded = S.Codec.Encoded<typeof FairUseState>;
}

/**
 * Snake_case codec for {@link FairUseState}.
 *
 * **Example** (Decode a null throttle instant)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FairUseStateWire } from "@beep/scratchpad/beep/FairUse"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FairUseStateWire)({
 *     stage: "none",
 *     violation_count_7d: 0,
 *     violation_count_30d: 0,
 *     last_violation_at: null,
 *     throttle_until: null,
 *     restrict_until: null,
 *     last_classifier_score: 0,
 *     last_classifier_type: "none",
 *     updated_at: "2020-01-02T03:04:05.000",
 *   }),
 * )
 * console.log(O.isNone(decoded.throttleUntil)) // true
 * ```
 *
 * @see {@link FairUseState} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FairUseStateWire = FairUseState.pipe(
  S.encodeKeys({
    violationCount7d: "violation_count_7d",
    violationCount30d: "violation_count_30d",
    lastViolationAt: "last_violation_at",
    throttleUntil: "throttle_until",
    restrictUntil: "restrict_until",
    lastClassifierScore: "last_classifier_score",
    lastClassifierType: "last_classifier_type",
    updatedAt: "updated_at",
  }),
);

/**
 * One fair-use violation event.
 *
 * **Details**
 *
 * A single fair-use violation event. Stored at
 * `users/{uid}/fair_use_events/{event_id}`. Window and threshold maps are open
 * string-to-int records; the comment names `daily`, `three_day`, and `weekly`,
 * but the schema does not require those keys. `enforcement_action` is an open
 * string. `classifier` is null when the LLM step did not run.
 *
 * **Gotchas**
 *
 * Do not close `enforcement_action` to warning, throttle, restrict, and none.
 * The comment is not a union.
 *
 * **Example** (Decode a null classifier)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FairUseEventWire } from "@beep/scratchpad/beep/FairUse"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FairUseEventWire)({
 *     created_at: "2020-01-02T03:04:05.000",
 *     session_id: "",
 *     trigger: "daily",
 *     window_speech_ms: {},
 *     thresholds_ms: {},
 *     classifier: null,
 *     enforcement_action: "",
 *     previous_stage: "none",
 *     new_stage: "warning",
 *     admin_notes: "",
 *     resolved: false,
 *     resolved_at: null,
 *     resolved_by: "",
 *   }),
 * )
 * console.log(O.isNone(decoded.classifier)) // true
 * console.log(decoded.newStage) // "warning"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FairUseEvent extends Model<FairUseEvent>("FairUseEvent")(
  {
    createdAt: naiveTimestamp("created_at"),
    sessionId: textDefault("session_id", ""),
    trigger: SoftCapTrigger.pipe(S.withConstructorDefault(Effect.succeed(dailyTrigger)), pg.text(), pg.columnName("trigger")),
    windowSpeechMs: intMap("window_speech_ms"),
    thresholdsMs: intMap("thresholds_ms"),
    classifier: optionalJsonColumn(ClassifierResultWire, "classifier"),
    enforcementAction: textDefault("enforcement_action", ""),
    previousStage: stageField("previous_stage"),
    newStage: stageField("new_stage"),
    adminNotes: textDefault("admin_notes", ""),
    resolved: boolDefault("resolved", false),
    resolvedAt: optionalNaiveTimestamp("resolved_at"),
    resolvedBy: textDefault("resolved_by", ""),
  },
  $I.annote("FairUseEvent", {
    description: "A single fair-use violation event stored at users/{uid}/fair_use_events/{event_id}.",
  }),
) {}

/**
 * Encoded form of {@link FairUseEvent}.
 *
 * @see {@link FairUseEventWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FairUseEvent {
  export type Encoded = S.Codec.Encoded<typeof FairUseEvent>;
}

/**
 * Snake_case codec for {@link FairUseEvent}.
 *
 * **Example** (Decode the three-day trigger)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FairUseEventWire } from "@beep/scratchpad/beep/FairUse"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FairUseEventWire)({
 *     created_at: "2020-01-02T03:04:05.000",
 *     trigger: "3day",
 *     window_speech_ms: { daily: 1 },
 *     thresholds_ms: {},
 *     classifier: null,
 *     previous_stage: "none",
 *     new_stage: "none",
 *     resolved: false,
 *     resolved_at: null,
 *     session_id: "",
 *     enforcement_action: "",
 *     admin_notes: "",
 *     resolved_by: "",
 *   }),
 * )
 * console.log(decoded.trigger) // "3day"
 * console.log(decoded.windowSpeechMs.daily) // 1
 * ```
 *
 * @see {@link FairUseEvent} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FairUseEventWire = FairUseEvent.pipe(
  S.encodeKeys({
    createdAt: "created_at",
    sessionId: "session_id",
    windowSpeechMs: "window_speech_ms",
    thresholdsMs: "thresholds_ms",
    enforcementAction: "enforcement_action",
    previousStage: "previous_stage",
    newStage: "new_stage",
    adminNotes: "admin_notes",
    resolvedAt: "resolved_at",
    resolvedBy: "resolved_by",
  }),
);

/**
 * Admin dashboard row for one user.
 *
 * **Details**
 *
 * Summary for admin dashboard. Speech hours are finite numbers that construct
 * as 0. The user id is required.
 *
 * **Example** (Construct zero speech hours)
 *
 * ```ts
 * import { FairUseUserSummary } from "@beep/scratchpad/beep/FairUse"
 *
 * const summary = FairUseUserSummary.make({ uid: "user-1" })
 * console.log(summary.speechHoursToday) // 0
 * console.log(summary.stage) // "none"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FairUseUserSummary extends Model<FairUseUserSummary>("FairUseUserSummary")(
  {
    uid: userId("uid"),
    stage: stageField("stage"),
    violationCount7d: intDefault("violation_count_7d", 0),
    violationCount30d: intDefault("violation_count_30d", 0),
    lastViolationAt: optionalNaiveTimestamp("last_violation_at"),
    lastClassifierScore: finiteDefault("last_classifier_score", 0),
    lastClassifierType: usageField("last_classifier_type"),
    speechHoursToday: finiteDefault("speech_hours_today", 0),
    speechHours7d: finiteDefault("speech_hours_7d", 0),
  },
  $I.annote("FairUseUserSummary", {
    description: "Summary for the admin dashboard.",
  }),
) {}

/**
 * Encoded form of {@link FairUseUserSummary}.
 *
 * @see {@link FairUseUserSummaryWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FairUseUserSummary {
  export type Encoded = S.Codec.Encoded<typeof FairUseUserSummary>;
}

/**
 * Snake_case codec for {@link FairUseUserSummary}.
 *
 * **Example** (Decode a null last violation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FairUseUserSummaryWire } from "@beep/scratchpad/beep/FairUse"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FairUseUserSummaryWire)({
 *     uid: "user-1",
 *     stage: "warning",
 *     violation_count_7d: 1,
 *     violation_count_30d: 1,
 *     last_violation_at: null,
 *     last_classifier_score: 0.2,
 *     last_classifier_type: "podcast",
 *     speech_hours_today: 1,
 *     speech_hours_7d: 2,
 *   }),
 * )
 * console.log(O.isNone(decoded.lastViolationAt)) // true
 * console.log(decoded.lastClassifierType) // "podcast"
 * ```
 *
 * @see {@link FairUseUserSummary} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FairUseUserSummaryWire = FairUseUserSummary.pipe(
  S.encodeKeys({
    violationCount7d: "violation_count_7d",
    violationCount30d: "violation_count_30d",
    lastViolationAt: "last_violation_at",
    lastClassifierScore: "last_classifier_score",
    lastClassifierType: "last_classifier_type",
    speechHoursToday: "speech_hours_today",
    speechHours7d: "speech_hours_7d",
  }),
);
