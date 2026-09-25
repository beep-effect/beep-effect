/**
 * Neutral canonical-memory recurrence signal consumed by workflow orchestration.
 *
 * **Details**
 *
 * Memory may emit this evidence contract. It never writes a Candidate or
 * workstream. Workflow owns qualification and mutation.
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
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import {
  Model,
  confidence,
  optionalNull,
  optionalStableId,
  pg,
  stableId,
  stableIdCheck,
  Table,
  textBoundsCheck,
  unitIntervalCheck,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemoryRecurrence");

const awareInstant =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

/**
 * Evidence kind accepted by a canonical recurrence signal.
 *
 * **Example** (Read memory item)
 *
 * ```ts
 * import { RecurrenceEvidenceKind } from "./MemoryRecurrence.ts"
 *
 * console.log(RecurrenceEvidenceKind.literals.includes("memory_item")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecurrenceEvidenceKind = LiteralKit(["memory_item", "conversation"]).pipe(
  $I.annoteSchema("RecurrenceEvidenceKind", {
    description: "Canonical recurrence evidence is a memory item or a conversation.",
  }),
);
/**
 * Decoded type of {@link RecurrenceEvidenceKind}.
 *
 * @see {@link RecurrenceEvidenceKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type RecurrenceEvidenceKind = typeof RecurrenceEvidenceKind.Type;

const AwareUtcTimestamp = S.String.check(S.isPattern(awareInstant)).pipe(
  S.decodeTo(S.DateTimeUtc, {
    decode: SchemaGetter.transform((input: string) => DateTime.toUtc(DateTime.makeUnsafe(input))),
    encode: SchemaGetter.transform(DateTime.formatIso),
  }),
);

/**
 * Canonical evidence reference used by a recurrence signal.
 *
 * **Details**
 *
 * Scope is canonical. Kind is `memory_item` or `conversation`. A device id is
 * rejected because canonical evidence cannot carry one.
 *
 * **Example** (Reference a memory)
 *
 * ```ts
 * import { RecurrenceEvidenceRef } from "./MemoryRecurrence.ts"
 *
 * const ref = RecurrenceEvidenceRef.make({ kind: "memory_item", id: "goal-1", scope: "canonical" })
 * console.log(ref.id) // "goal-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecurrenceEvidenceRef extends Model<RecurrenceEvidenceRef>("RecurrenceEvidenceRef")(
  {
    kind: RecurrenceEvidenceKind.annotateKey({ description: "memory_item or conversation." }).pipe(
      pg.text(),
      pg.columnName("kind"),
    ),
    id: stableId("id"),
    scope: S.Literal("canonical").annotateKey({ description: "Canonical scope. Device-local evidence is rejected." }).pipe(
      pg.text(),
      pg.columnName("scope"),
    ),
    version: optionalNull(S.String.check(S.isMaxLength(128)))
      .annotateKey({ description: "Optional evidence version, at most 128 characters." })
      .pipe(pg.text(), pg.columnName("version")),
    deviceId: optionalStableId("device_id"),
    excerptHash: optionalNull(S.String.check(S.isPattern(/^[a-f0-9]{64}$/)))
      .annotateKey({ description: "Optional 64-character lowercase hex excerpt hash." })
      .pipe(pg.text(), pg.columnName("excerpt_hash")),
    startSeconds: optionalNull(S.Finite.check(S.isGreaterThanOrEqualTo(0)))
      .annotateKey({ description: "Optional start offset in seconds." })
      .pipe(pg.doublePrecision(), pg.columnName("start_seconds")),
    endSeconds: optionalNull(S.Finite.check(S.isGreaterThanOrEqualTo(0)))
      .annotateKey({ description: "Optional end offset in seconds." })
      .pipe(pg.doublePrecision(), pg.columnName("end_seconds")),
  },
  $I.annote("RecurrenceEvidenceRef", { description: "Canonical memory or conversation evidence." }),
  (columns) => [
    stableIdCheck("id")(columns.id),
    stableIdCheck("device_id")(columns.deviceId),
    textBoundsCheck("version", { maxLength: 128 })(columns.version),
    textBoundsCheck("excerpt_hash", { minLength: 64, maxLength: 64, pattern: "^[a-f0-9]{64}$" })(columns.excerptHash),
    Table.check("start_seconds_ge")(sql<boolean>`${columns.startSeconds} is null or ${columns.startSeconds} >= 0`),
    Table.check("end_seconds_ge")(sql<boolean>`${columns.endSeconds} is null or ${columns.endSeconds} >= 0`),
  ],
) {}

/**
 * Encoded shape of {@link RecurrenceEvidenceRef}.
 *
 * @see {@link RecurrenceEvidenceRef} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RecurrenceEvidenceRef {
  /** Encoded form of {@link RecurrenceEvidenceRef}. */
  export type Encoded = S.Codec.Encoded<typeof RecurrenceEvidenceRef>;
}

/**
 * Recurrence signal that failed a temporal or evidence rule.
 *
 * **Example** (Name an order failure)
 *
 * ```ts
 * import { RecurrenceRejected } from "./MemoryRecurrence.ts"
 *
 * console.log(RecurrenceRejected.make({ reason: "first_seen_at must not be after last_seen_at" }).reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RecurrenceRejected extends S.TaggedError<RecurrenceRejected>()(
  "RecurrenceRejected",
  { reason: S.String },
  $I.annoteError<RecurrenceRejected>("RecurrenceRejected", {
    description: "A canonical recurrence signal failed a temporal or evidence rule.",
  }),
) {}

/**
 * Encoded shape of {@link RecurrenceRejected}.
 *
 * @see {@link RecurrenceRejected} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RecurrenceRejected {
  /** Encoded form of {@link RecurrenceRejected}. */
  export type Encoded = S.Codec.Encoded<typeof RecurrenceRejected>;
}

const positiveInt = (column: string, description: string) =>
  S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({ description }).pipe(pg.integer(), pg.columnName(column));

const bounded = (column: string, minLength: number, maxLength: number, description: string) =>
  S.String.check(S.isMinLength(minLength), S.isMaxLength(maxLength))
    .annotateKey({ description })
    .pipe(pg.text(), pg.columnName(column));

/**
 * A repeated unresolved open loop observed during canonical consolidation.
 *
 * **Details**
 *
 * Evidence must be canonical and must cite a memory item or a conversation.
 * `distinctDayCount` cannot exceed `occurrenceCount` or the inclusive UTC date
 * span from first seen to last seen. The stable loop key is the first evidence
 * identity, not the model wording.
 *
 * **Example** (Count one occurrence)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { CanonicalRecurrenceSignal, RecurrenceEvidenceRef } from "./MemoryRecurrence.ts"
 *
 * const seen = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const signal = CanonicalRecurrenceSignal.make({
 *   signalId: "signal-1",
 *   title: "Follow up",
 *   objective: "Reply",
 *   anchorTaskDescription: "Reply to Ada",
 *   occurrenceCount: 1,
 *   distinctDayCount: 1,
 *   unresolved: true,
 *   confidence: 1,
 *   firstSeenAt: seen,
 *   lastSeenAt: seen,
 *   evidenceRefs: [RecurrenceEvidenceRef.make({ kind: "memory_item", id: "goal-1", scope: "canonical" })],
 * })
 * console.log(signal.occurrenceCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalRecurrenceSignal extends Model<CanonicalRecurrenceSignal>("CanonicalRecurrenceSignal")(
  {
    signalId: stableId("signal_id"),
    title: bounded("title", 1, 256, "Loop title, 1 to 256 characters."),
    objective: bounded("objective", 1, 2048, "Loop objective, 1 to 2048 characters."),
    anchorTaskDescription: bounded("anchor_task_description", 1, 2000, "Anchor task description, 1 to 2000 characters."),
    occurrenceCount: positiveInt("occurrence_count", "How many times the loop was observed."),
    distinctDayCount: positiveInt("distinct_day_count", "Distinct UTC days in the observation span."),
    unresolved: S.Boolean.annotateKey({ description: "Whether the loop is still unresolved." }).pipe(
      pg.boolean(),
      pg.columnName("unresolved"),
    ),
    confidence: confidence("confidence"),
    firstSeenAt: AwareUtcTimestamp.annotateKey({ description: "Aware first-seen instant, stored as UTC." }).pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("first_seen_at"),
    ),
    lastSeenAt: AwareUtcTimestamp.annotateKey({ description: "Aware last-seen instant, stored as UTC." }).pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("last_seen_at"),
    ),
    evidenceRefs: S.Array(RecurrenceEvidenceRef)
      .check(S.isMinLength(1), S.isMaxLength(50))
      .annotateKey({ description: "One to fifty canonical evidence refs." })
      .pipe(pg.jsonb(), pg.columnName("evidence_refs")),
  },
  $I.annote("CanonicalRecurrenceSignal", {
    description: "Repeated unresolved open loop observed during canonical consolidation.",
  }),
  (columns) => [
    stableIdCheck("signal_id")(columns.signalId),
    textBoundsCheck("title", { minLength: 1, maxLength: 256 })(columns.title),
    textBoundsCheck("objective", { minLength: 1, maxLength: 2048 })(columns.objective),
    textBoundsCheck("anchor_task_description", { minLength: 1, maxLength: 2000 })(columns.anchorTaskDescription),
    unitIntervalCheck("confidence")(columns.confidence),
    Table.check("occurrence_count_ge")(sql<boolean>`${columns.occurrenceCount} >= 1`),
    Table.check("distinct_day_count_ge")(sql<boolean>`${columns.distinctDayCount} >= 1`),
    Table.check("distinct_day_count_le")(sql<boolean>`${columns.distinctDayCount} <= ${columns.occurrenceCount}`),
    Table.check("seen_at_order")(sql<boolean>`${columns.firstSeenAt} <= ${columns.lastSeenAt}`),
    Table.check("evidence_refs_len")(
      sql<boolean>`jsonb_typeof(${columns.evidenceRefs}) = 'array' and jsonb_array_length(${columns.evidenceRefs}) between 1 and 50`,
    ),
  ],
) {}

/**
 * Encoded shape of {@link CanonicalRecurrenceSignal}.
 *
 * @see {@link CanonicalRecurrenceSignal} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CanonicalRecurrenceSignal {
  /** Encoded form of {@link CanonicalRecurrenceSignal}. */
  export type Encoded = S.Codec.Encoded<typeof CanonicalRecurrenceSignal>;
}

const monthBase = (month: number): number =>
  O.getOrElse(A.get([0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], month - 1), () => 0);

const utcEpochDay = (value: DateTime.DateTime): number => {
  const parts = Str.split(DateTime.formatIsoDateUtc(value), "-");
  const year = Number(O.getOrElse(A.get(parts, 0), () => "0"));
  const month = Number(O.getOrElse(A.get(parts, 1), () => "1"));
  const day = Number(O.getOrElse(A.get(parts, 2), () => "1"));
  const previous = year - 1;
  const leaps = Math.floor(previous / 4) - Math.floor(previous / 100) + Math.floor(previous / 400);
  const leapDay = month > 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 1 : 0;
  return previous * 365 + leaps + monthBase(month) + leapDay + day - 1;
};

const sha256Hex = Effect.fn("MemoryRecurrence.sha256Hex")(function* (payload: string) {
  const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)));
  return A.join(
    A.map(A.fromIterable(new Uint8Array(digest)), (byte) => {
      const text = byte.toString(16);
      return Str.length(text) === 1 ? `0${text}` : text;
    }),
    "",
  );
});

/**
 * Check evidence bounds and the observed date span.
 *
 * **Details**
 *
 * Canonical evidence cannot carry a device id. When both offsets are present,
 * end must be at least start. The first instant must not be after the last.
 * Distinct days cannot exceed occurrences or the inclusive UTC date span.
 *
 * **Example** (Reject a reversed span)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import { CanonicalRecurrenceSignal, RecurrenceEvidenceRef, assertCanonicalRecurrenceSignal } from "./MemoryRecurrence.ts"
 *
 * const signal = CanonicalRecurrenceSignal.make({
 *   signalId: "signal-1",
 *   title: "Follow up",
 *   objective: "Reply",
 *   anchorTaskDescription: "Reply to Ada",
 *   occurrenceCount: 1,
 *   distinctDayCount: 1,
 *   unresolved: true,
 *   confidence: 1,
 *   firstSeenAt: DateTime.makeUnsafe("2020-01-03T03:04:05.000Z"),
 *   lastSeenAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   evidenceRefs: [RecurrenceEvidenceRef.make({ kind: "memory_item", id: "goal-1", scope: "canonical" })],
 * })
 * console.log(Exit.isFailure(Effect.runSyncExit(assertCanonicalRecurrenceSignal(signal)))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const assertCanonicalRecurrenceSignal = Effect.fn("CanonicalRecurrenceSignal.assertCanonicalRecurrenceSignal")(
  function* (signal: CanonicalRecurrenceSignal) {
    for (const ref of signal.evidenceRefs) {
      if (O.isSome(ref.deviceId)) {
        return yield* RecurrenceRejected.make({ reason: "canonical evidence cannot carry device_id" });
      }
      if (
        O.isSome(ref.startSeconds) &&
        O.isSome(ref.endSeconds) &&
        ref.endSeconds.value < ref.startSeconds.value
      ) {
        return yield* RecurrenceRejected.make({ reason: "end_seconds must be greater than or equal to start_seconds" });
      }
    }
    if (DateTime.toEpochMillis(signal.firstSeenAt) > DateTime.toEpochMillis(signal.lastSeenAt)) {
      return yield* RecurrenceRejected.make({ reason: "first_seen_at must not be after last_seen_at" });
    }
    if (signal.distinctDayCount > signal.occurrenceCount) {
      return yield* RecurrenceRejected.make({ reason: "distinct_day_count cannot exceed occurrence_count" });
    }
    const span = utcEpochDay(signal.lastSeenAt) - utcEpochDay(signal.firstSeenAt) + 1;
    if (signal.distinctDayCount > span) {
      return yield* RecurrenceRejected.make({ reason: "distinct_day_count cannot exceed the observed date span" });
    }
    return signal;
  },
);

/**
 * Canonical identity anchored to the first-seen evidence, not model wording.
 *
 * **Details**
 *
 * The key is `recurrence_loop_` plus the first 40 hex characters of SHA-256
 * over `scope:kind:id` of the first evidence ref.
 *
 * **Example** (Hash the first evidence id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { CanonicalRecurrenceSignal, RecurrenceEvidenceRef, stableLoopKey } from "./MemoryRecurrence.ts"
 *
 * const seen = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const signal = CanonicalRecurrenceSignal.make({
 *   signalId: "signal-1",
 *   title: "Follow up",
 *   objective: "Reply",
 *   anchorTaskDescription: "Reply to Ada",
 *   occurrenceCount: 1,
 *   distinctDayCount: 1,
 *   unresolved: true,
 *   confidence: 1,
 *   firstSeenAt: seen,
 *   lastSeenAt: seen,
 *   evidenceRefs: [RecurrenceEvidenceRef.make({ kind: "memory_item", id: "goal-1", scope: "canonical" })],
 * })
 * const key = Effect.runPromise(stableLoopKey(signal))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const stableLoopKey = Effect.fn("CanonicalRecurrenceSignal.stableLoopKey")(function* (
  signal: CanonicalRecurrenceSignal,
) {
  const anchor = A.head(signal.evidenceRefs);
  if (O.isNone(anchor)) return yield* RecurrenceRejected.make({ reason: "recurrence evidence must not be empty" });
  const digest = yield* sha256Hex(`${anchor.value.scope}:${anchor.value.kind}:${anchor.value.id}`);
  return `recurrence_loop_${Str.takeLeft(digest, 40)}`;
});
