/**
 * Content-free durable receipts for explicit JIT trigger feedback.
 *
 * **Details**
 *
 * `action` changes whether `snoozedUntil` is required. Snooze is the only
 * action that carries it, and that instant must be after `recordedAt`.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { JIT_CONTENT_FREE_ID_PATTERN } from "./JitProactivity.ts";
import { Model, UtcTimestamp, nonNegativeInt, nonNegativeIntCheck, optionalNull, pg, textBoundsCheck } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/JitTriggerFeedback");

const schemaVersion = "jit_trigger_feedback.v1";
const hashSource = "^[0-9a-f]{64}$";

const awareString = S.String.check(
  S.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/),
);
const awareInstant = awareString.pipe(S.decodeTo(UtcTimestamp));
const hashText = S.String.check(S.isPattern(JIT_CONTENT_FREE_ID_PATTERN));
const revision = S.Int.check(S.isGreaterThanOrEqualTo(1));

const identifier = S.String.pipe(
  S.decodeTo(S.String.check(S.isMinLength(1), S.isMaxLength(256), S.isPattern(/^[^/]*$/)), {
    decode: SchemaGetter.transform(Str.trim),
    encode: SchemaGetter.transform((value) => value),
  }),
);

const idCheck = (column: string) => textBoundsCheck(column, { minLength: 1, maxLength: 256, pattern: "^[^/]*$" });
const hashCheck = (column: string) => textBoundsCheck(column, { pattern: hashSource });
const revisionCheck = (name: "expected_trigger_revision_ge" | "applied_trigger_revision_ge", column: ExtraConfigColumn) =>
  pg.Table.check(name)(sql<boolean>`${column} >= ${sql.raw("1")}`);

const commonFields = () => ({
  schemaVersion: S.Literal(schemaVersion).pipe(
    S.withConstructorDefault(Effect.succeed(schemaVersion)),
    pg.text(),
    pg.columnName("schema_version"),
  ),
  uid: identifier.pipe(pg.text(), pg.columnName("uid")),
  feedbackId: hashText.pipe(pg.text(), pg.columnName("feedback_id")),
  eventId: hashText.pipe(pg.text(), pg.columnName("event_id")),
  triggerMemoryId: identifier.pipe(pg.text(), pg.columnName("trigger_memory_id")),
  accountGeneration: nonNegativeInt("account_generation"),
  expectedTriggerRevision: revision.pipe(pg.integer(), pg.columnName("expected_trigger_revision")),
  recordedAt: awareInstant.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName("recorded_at")),
  requestHash: hashText.pipe(pg.text(), pg.columnName("request_hash")),
  appliedTriggerRevision: optionalNull(revision).pipe(pg.integer(), pg.columnName("applied_trigger_revision")),
});

const commonChecks = (columns: {
  readonly uid: ExtraConfigColumn;
  readonly feedbackId: ExtraConfigColumn;
  readonly eventId: ExtraConfigColumn;
  readonly triggerMemoryId: ExtraConfigColumn;
  readonly accountGeneration: ExtraConfigColumn;
  readonly expectedTriggerRevision: ExtraConfigColumn;
  readonly requestHash: ExtraConfigColumn;
  readonly appliedTriggerRevision: ExtraConfigColumn;
}) => [
  idCheck("uid")(columns.uid),
  hashCheck("feedback_id")(columns.feedbackId),
  hashCheck("event_id")(columns.eventId),
  idCheck("trigger_memory_id")(columns.triggerMemoryId),
  nonNegativeIntCheck("account_generation")(columns.accountGeneration),
  revisionCheck("expected_trigger_revision_ge", columns.expectedTriggerRevision),
  hashCheck("request_hash")(columns.requestHash),
  revisionCheck("applied_trigger_revision_ge", columns.appliedTriggerRevision),
];

const afterRecorded = S.makeFilter(
  (value: { readonly recordedAt: DateTime.Utc; readonly snoozedUntil: DateTime.Utc }) =>
    DateTime.toEpochMillis(value.snoozedUntil) > DateTime.toEpochMillis(value.recordedAt),
  {
    expected: "snoozedUntil after recordedAt",
    message: "snoozed_until must be after recorded_at",
  },
);

/**
 * Explicit JIT trigger feedback action.
 *
 * **Details**
 *
 * `snooze` requires `snoozedUntil`. Every other action forbids it.
 *
 * **Example** (Decode snooze)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { JitTriggerFeedbackAction } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(JitTriggerFeedbackAction)("snooze"))
 * console.log(decoded) // "snooze"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JitTriggerFeedbackAction = LiteralKit([
  "useful",
  "false_positive",
  "snooze",
  "disable",
  "missed_or_late",
]).pipe(
  $I.annoteSchema("JitTriggerFeedbackAction", {
    description: "Explicit JIT trigger feedback action. snooze is the only action that carries snoozedUntil.",
  }),
);

/**
 * Decoded JIT trigger feedback action.
 *
 * @see {@link JitTriggerFeedbackAction} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type JitTriggerFeedbackAction = typeof JitTriggerFeedbackAction.Type;

/**
 * Useful-feedback receipt. `snoozedUntil` is forbidden.
 *
 * **Details**
 *
 * `uid` and `triggerMemoryId` are stripped to 1..256 characters with no slash.
 * That cap is wider than the JIT proactivity uid cap of 128. Hash ids are not
 * stripped. `recordedAt` must be timezone-aware.
 *
 * **Example** (Construct useful feedback)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitUsefulFeedbackReceipt } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const digest = "a".repeat(64)
 * const receipt = JitUsefulFeedbackReceipt.make({
 *   uid: "user-1",
 *   feedbackId: digest,
 *   eventId: digest,
 *   triggerMemoryId: "memory-1",
 *   accountGeneration: 0,
 *   expectedTriggerRevision: 1,
 *   recordedAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.action) // "useful"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitUsefulFeedbackReceipt extends Model<JitUsefulFeedbackReceipt>("JitUsefulFeedbackReceipt")(
  { ...commonFields(), action: S.tag("useful") },
  $I.annote("JitUsefulFeedbackReceipt", { description: "Useful JIT trigger feedback. snoozedUntil is forbidden." }),
  (columns) => commonChecks(columns),
) {}

/**
 * Encoded useful feedback receipt.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitUsefulFeedbackReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitUsefulFeedbackReceipt>;
}

/**
 * False-positive feedback. `snoozedUntil` is forbidden.
 *
 * **Example** (Construct false-positive feedback)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitFalsePositiveFeedbackReceipt } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const digest = "b".repeat(64)
 * const receipt = JitFalsePositiveFeedbackReceipt.make({
 *   uid: "user-1",
 *   feedbackId: digest,
 *   eventId: digest,
 *   triggerMemoryId: "memory-1",
 *   accountGeneration: 0,
 *   expectedTriggerRevision: 1,
 *   recordedAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.action) // "false_positive"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitFalsePositiveFeedbackReceipt extends Model<JitFalsePositiveFeedbackReceipt>(
  "JitFalsePositiveFeedbackReceipt",
)(
  { ...commonFields(), action: S.tag("false_positive") },
  $I.annote("JitFalsePositiveFeedbackReceipt", {
    description: "False-positive JIT trigger feedback. snoozedUntil is forbidden.",
  }),
  (columns) => commonChecks(columns),
) {}

/**
 * Encoded false-positive feedback receipt.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitFalsePositiveFeedbackReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitFalsePositiveFeedbackReceipt>;
}

/**
 * Snooze feedback. `snoozedUntil` is required and must be after `recordedAt`.
 *
 * **Example** (Construct snooze feedback)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitSnoozeFeedbackReceipt } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const digest = "c".repeat(64)
 * const receipt = JitSnoozeFeedbackReceipt.make({
 *   uid: "user-1",
 *   feedbackId: digest,
 *   eventId: digest,
 *   triggerMemoryId: "memory-1",
 *   accountGeneration: 0,
 *   expectedTriggerRevision: 1,
 *   recordedAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   snoozedUntil: DateTime.unsafeMake("2020-01-03T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.action) // "snooze"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitSnoozeFeedbackReceipt extends Model<JitSnoozeFeedbackReceipt>("JitSnoozeFeedbackReceipt")(
  {
    ...commonFields(),
    action: S.tag("snooze"),
    snoozedUntil: awareInstant.pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("snoozed_until"),
    ),
  },
  $I.annote("JitSnoozeFeedbackReceipt", {
    description: "Snooze JIT trigger feedback. snoozedUntil is required and must be after recordedAt.",
  }),
  (columns) => commonChecks(columns),
) {}

/**
 * Encoded snooze feedback receipt.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitSnoozeFeedbackReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitSnoozeFeedbackReceipt>;
}

/**
 * Disable feedback. `snoozedUntil` is forbidden.
 *
 * **Example** (Construct disable feedback)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitDisableFeedbackReceipt } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const digest = "d".repeat(64)
 * const receipt = JitDisableFeedbackReceipt.make({
 *   uid: "user-1",
 *   feedbackId: digest,
 *   eventId: digest,
 *   triggerMemoryId: "memory-1",
 *   accountGeneration: 0,
 *   expectedTriggerRevision: 1,
 *   recordedAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.action) // "disable"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitDisableFeedbackReceipt extends Model<JitDisableFeedbackReceipt>("JitDisableFeedbackReceipt")(
  { ...commonFields(), action: S.tag("disable") },
  $I.annote("JitDisableFeedbackReceipt", { description: "Disable JIT trigger feedback. snoozedUntil is forbidden." }),
  (columns) => commonChecks(columns),
) {}

/**
 * Encoded disable feedback receipt.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitDisableFeedbackReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitDisableFeedbackReceipt>;
}

/**
 * Missed-or-late feedback. `snoozedUntil` is forbidden.
 *
 * **Example** (Construct missed-or-late feedback)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitMissedOrLateFeedbackReceipt } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const digest = "e".repeat(64)
 * const receipt = JitMissedOrLateFeedbackReceipt.make({
 *   uid: "user-1",
 *   feedbackId: digest,
 *   eventId: digest,
 *   triggerMemoryId: "memory-1",
 *   accountGeneration: 0,
 *   expectedTriggerRevision: 1,
 *   recordedAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.action) // "missed_or_late"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitMissedOrLateFeedbackReceipt extends Model<JitMissedOrLateFeedbackReceipt>(
  "JitMissedOrLateFeedbackReceipt",
)(
  { ...commonFields(), action: S.tag("missed_or_late") },
  $I.annote("JitMissedOrLateFeedbackReceipt", {
    description: "Missed-or-late JIT trigger feedback. snoozedUntil is forbidden.",
  }),
  (columns) => commonChecks(columns),
) {}

/**
 * Encoded missed-or-late feedback receipt.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitMissedOrLateFeedbackReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitMissedOrLateFeedbackReceipt>;
}

/**
 * JIT trigger feedback receipt discriminated by `action`.
 *
 * **Details**
 *
 * Snooze requires `snoozedUntil` after `recordedAt`. Other actions have no
 * snooze instant. {@link decodeJitTriggerFeedbackReceipt} rejects unknown keys,
 * including `snoozedUntil` on a non-snooze action.
 *
 * **Gotchas**
 *
 * Identifier length is 256 here, not the 128-character JIT proactivity uid
 * cap. Timestamps must be timezone-aware. A boolean is not a revision.
 *
 * **Example** (Reject snooze without an until instant)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeJitTriggerFeedbackReceipt } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const digest = "a".repeat(64)
 * const exit = Effect.runSyncExit(
 *   decodeJitTriggerFeedbackReceipt({
 *     uid: "user-1",
 *     feedbackId: digest,
 *     eventId: digest,
 *     triggerMemoryId: "memory-1",
 *     accountGeneration: 0,
 *     expectedTriggerRevision: 1,
 *     action: "snooze",
 *     recordedAt: "2020-01-02T03:04:05.000Z",
 *     requestHash: digest,
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JITTriggerFeedbackReceipt = JitTriggerFeedbackAction.mapMembers(
  Tuple.evolve([
    () => JitUsefulFeedbackReceipt,
    () => JitFalsePositiveFeedbackReceipt,
    () => JitSnoozeFeedbackReceipt.pipe(S.check(afterRecorded)),
    () => JitDisableFeedbackReceipt,
    () => JitMissedOrLateFeedbackReceipt,
  ]),
).pipe(
  S.toTaggedUnion("action"),
  $I.annoteSchema("JITTriggerFeedbackReceipt", {
    description: "Content-free JIT trigger feedback receipt. action selects whether snoozedUntil is required.",
  }),
);

/**
 * Decoded JIT trigger feedback receipt.
 *
 * @see {@link JITTriggerFeedbackReceipt} for the runtime tagged union.
 * @category type-level
 * @since 0.0.0
 */
export type JITTriggerFeedbackReceipt = typeof JITTriggerFeedbackReceipt.Type;

const decodeJITTriggerFeedbackReceipt = S.decodeUnknownEffect(JITTriggerFeedbackReceipt, { onExcessProperty: "error" });

/**
 * Decodes trigger feedback and rejects unknown keys.
 *
 * **Example** (Decode useful feedback)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeJitTriggerFeedbackReceipt } from "@beep/scratchpad/beep/JitTriggerFeedback"
 *
 * const digest = "a".repeat(64)
 * const decoded = Effect.runSync(
 *   decodeJitTriggerFeedbackReceipt({
 *     uid: " user-1 ",
 *     feedbackId: digest,
 *     eventId: digest,
 *     triggerMemoryId: " memory-1 ",
 *     accountGeneration: 0,
 *     expectedTriggerRevision: 1,
 *     action: "useful",
 *     recordedAt: "2020-01-02T03:04:05Z",
 *     requestHash: digest,
 *   }),
 * )
 * console.log(decoded.uid) // "user-1"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeJitTriggerFeedbackReceipt = Effect.fn("JITTriggerFeedbackReceipt.decode")(function* (
  input: unknown,
) {
  return yield* decodeJITTriggerFeedbackReceipt(input);
});
