/**
 * Content-free authority receipts for bounded JIT proactive work.
 *
 * Identifiers are SHA-256 digests, not raw content. `operation` changes which
 * sibling fields are required, so the receipt is a tagged union rather than
 * one struct with optional bags.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as P from "effect/Predicate";
import {
  Model,
  UtcTimestamp,
  nonNegativeInt,
  nonNegativeIntCheck,
  optionalNull,
  pg,
  textBoundsCheck,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/JitProactivity");

/**
 * Planned notifications allowed for one trigger on one budget day.
 *
 * **Example** (Read the planned-notification cap)
 *
 * ```ts
 * import { JIT_PLANNED_NOTIFICATIONS_PER_TRIGGER_PER_DAY } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_PLANNED_NOTIFICATIONS_PER_TRIGGER_PER_DAY) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_PLANNED_NOTIFICATIONS_PER_TRIGGER_PER_DAY = 1;

/**
 * Total proactive notifications allowed on one budget day.
 *
 * **Example** (Read the daily notification cap)
 *
 * ```ts
 * import { JIT_TOTAL_PROACTIVE_NOTIFICATIONS_PER_DAY } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_TOTAL_PROACTIVE_NOTIFICATIONS_PER_DAY) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_TOTAL_PROACTIVE_NOTIFICATIONS_PER_DAY = 3;

/**
 * Ambiguous nano triages allowed on one budget day.
 *
 * **Example** (Read the nano-triage cap)
 *
 * ```ts
 * import { JIT_AMBIGUOUS_NANO_TRIAGES_PER_DAY } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_AMBIGUOUS_NANO_TRIAGES_PER_DAY) // 8
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_AMBIGUOUS_NANO_TRIAGES_PER_DAY = 8;

/**
 * Full turns allowed for one candidate.
 *
 * **Example** (Read the per-candidate full-turn cap)
 *
 * ```ts
 * import { JIT_FULL_TURNS_PER_CANDIDATE } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_FULL_TURNS_PER_CANDIDATE) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_FULL_TURNS_PER_CANDIDATE = 1;

/**
 * Full turns allowed on one budget day.
 *
 * **Example** (Read the daily full-turn cap)
 *
 * ```ts
 * import { JIT_TOTAL_FULL_TURNS_PER_DAY } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_TOTAL_FULL_TURNS_PER_DAY) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_TOTAL_FULL_TURNS_PER_DAY = 3;

/**
 * Calendar events a JIT policy may inspect.
 *
 * **Example** (Read the calendar-event cap)
 *
 * ```ts
 * import { JIT_MAX_CALENDAR_EVENTS } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_MAX_CALENDAR_EVENTS) // 32
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_MAX_CALENDAR_EVENTS = 32;

/**
 * Seconds a JIT policy snapshot stays valid.
 *
 * **Example** (Read the policy lifetime)
 *
 * ```ts
 * import { JIT_POLICY_VALID_FOR_SECONDS } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_POLICY_VALID_FOR_SECONDS) // 30
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_POLICY_VALID_FOR_SECONDS = 30;

/**
 * SHA-256 hex digest used for content-free JIT ids.
 *
 * **Example** (Read the digest pattern)
 *
 * ```ts
 * import { JIT_CONTENT_FREE_ID_PATTERN } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JIT_CONTENT_FREE_ID_PATTERN.test("a".repeat(64))) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JIT_CONTENT_FREE_ID_PATTERN = /^[0-9a-f]{64}$/;

const CONTENT_FREE_SOURCE = "^[0-9a-f]{64}$";
const schemaVersion = "jit_proactivity_event.v1";
const utcZone = "UTC";

const awareString = S.String.check(
  S.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/),
);

const awareInstant = awareString.pipe(S.decodeTo(UtcTimestamp));

const trimTo = (decoded: S.String) =>
  S.String.pipe(
    S.decodeTo(decoded, {
      decode: SchemaGetter.transform(Str.trim),
      encode: SchemaGetter.transform((value: string) => value),
    }),
  );

const boundedId = (maxLength: number) =>
  trimTo(S.String.check(S.isMinLength(1), S.isMaxLength(maxLength), S.isPattern(/^[^/]*$/)));

const contentFreeId = trimTo(S.String.check(S.isPattern(JIT_CONTENT_FREE_ID_PATTERN)));

const hashText = S.String.check(S.isPattern(JIT_CONTENT_FREE_ID_PATTERN));

const revision = S.Int.check(S.isGreaterThanOrEqualTo(1));

const revisionCheck = (column: ExtraConfigColumn) =>
  pg.Table.check("trigger_revision_ge")(sql<boolean>`${column} >= ${sql.raw("1")}`);

const uidCheck = textBoundsCheck("uid", { minLength: 1, maxLength: 128, pattern: "^[^/]*$" });
const looseIdCheck = (column: string) => textBoundsCheck(column, { minLength: 1, maxLength: 256, pattern: "^[^/]*$" });
const hashCheck = (column: string) => textBoundsCheck(column, { pattern: CONTENT_FREE_SOURCE });
const dayCheck = textBoundsCheck("budget_day", { pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" });
const zoneCheck = textBoundsCheck("budget_timezone", { minLength: 1, maxLength: 64 });

const commonFields = () => ({
  schemaVersion: S.Literal(schemaVersion).pipe(
    S.withConstructorDefault(Effect.succeed(schemaVersion)),
    pg.text(),
    pg.columnName("schema_version"),
  ),
  uid: boundedId(128).pipe(pg.text(), pg.columnName("uid")),
  eventId: contentFreeId.pipe(pg.text(), pg.columnName("event_id")),
  candidateId: contentFreeId.pipe(pg.text(), pg.columnName("candidate_id")),
  accountGeneration: nonNegativeInt("account_generation"),
  budgetDay: S.String.check(S.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)).pipe(pg.text(), pg.columnName("budget_day")),
  budgetTimezone: S.String.check(S.isMinLength(1), S.isMaxLength(64)).pipe(
    S.withConstructorDefault(Effect.succeed(utcZone)),
    pg.text(),
    pg.columnName("budget_timezone"),
  ),
  deviceId: contentFreeId.pipe(pg.text(), pg.columnName("device_id")),
  createdAt: awareInstant.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName("created_at")),
  requestHash: hashText.pipe(pg.text(), pg.columnName("request_hash")),
  feedbackId: optionalNull(boundedId(256)).pipe(pg.text(), pg.columnName("feedback_id")),
});

const commonChecks = (columns: {
  readonly uid: ExtraConfigColumn;
  readonly eventId: ExtraConfigColumn;
  readonly candidateId: ExtraConfigColumn;
  readonly deviceId: ExtraConfigColumn;
  readonly accountGeneration: ExtraConfigColumn;
  readonly budgetDay: ExtraConfigColumn;
  readonly budgetTimezone: ExtraConfigColumn;
  readonly requestHash: ExtraConfigColumn;
  readonly feedbackId: ExtraConfigColumn;
}) => [
  uidCheck(columns.uid),
  hashCheck("event_id")(columns.eventId),
  hashCheck("candidate_id")(columns.candidateId),
  hashCheck("device_id")(columns.deviceId),
  nonNegativeIntCheck("account_generation")(columns.accountGeneration),
  dayCheck(columns.budgetDay),
  zoneCheck(columns.budgetTimezone),
  hashCheck("request_hash")(columns.requestHash),
  looseIdCheck("feedback_id")(columns.feedbackId),
];

const optionalTrigger = () => ({
  triggerMemoryId: optionalNull(boundedId(256)).pipe(pg.text(), pg.columnName("trigger_memory_id")),
  triggerRevision: optionalNull(revision).pipe(pg.integer(), pg.columnName("trigger_revision")),
});

const requiredTrigger = () => ({
  triggerMemoryId: boundedId(256).pipe(pg.text(), pg.columnName("trigger_memory_id")),
  triggerRevision: revision.pipe(pg.integer(), pg.columnName("trigger_revision")),
});

const triggerChecks = (columns: { readonly triggerMemoryId: ExtraConfigColumn; readonly triggerRevision: ExtraConfigColumn }) => [
  looseIdCheck("trigger_memory_id")(columns.triggerMemoryId),
  revisionCheck(columns.triggerRevision),
];

const triggerPairIsTogether = (value: {
  readonly triggerMemoryId: O.Option<string>;
  readonly triggerRevision: O.Option<number>;
}): boolean => O.isSome(value.triggerMemoryId) === O.isSome(value.triggerRevision);

/**
 * JIT operation that changes which receipt fields are required.
 *
 * **Details**
 *
 * `planned_notification` requires the trigger id and revision.
 * `full_turn` requires `parentEventId` and is the only operation that may
 * carry it. `ambient_notification` and `nano_triage` forbid a parent. On
 * every operation except the planned pair, the trigger id and revision are
 * both present or both absent.
 *
 * **Example** (Decode a full turn)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { JitProactivityOperation } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(JitProactivityOperation)("full_turn"))
 * console.log(decoded) // "full_turn"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JitProactivityOperation = LiteralKit([
  "planned_notification",
  "ambient_notification",
  "nano_triage",
  "full_turn",
]).pipe(
  $I.annoteSchema("JitProactivityOperation", {
    description: "JIT proactivity operation. The member changes which receipt siblings are required.",
  }),
);

/**
 * Decoded JIT proactivity operation.
 *
 * @see {@link JitProactivityOperation} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type JitProactivityOperation = typeof JitProactivityOperation.Type;

/**
 * Planned-notification receipt. The trigger pair is required and a parent is forbidden.
 *
 * **Details**
 *
 * Content-free ids are stripped, then required to be 64 lowercase hex
 * characters. `uid` is stripped to 1..128 characters with no slash. Trigger
 * and feedback ids allow 1..256 characters and no slash. `createdAt` must
 * include a timezone; a naive timestamp is rejected.
 *
 * **Example** (Construct a planned receipt)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitPlannedNotificationReceipt } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const digest = "a".repeat(64)
 * const receipt = JitPlannedNotificationReceipt.make({
 *   uid: "user-1",
 *   eventId: digest,
 *   candidateId: digest,
 *   accountGeneration: 0,
 *   triggerMemoryId: "memory-1",
 *   triggerRevision: 1,
 *   budgetDay: "2020-01-02",
 *   deviceId: digest,
 *   createdAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.operation) // "planned_notification"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitPlannedNotificationReceipt extends Model<JitPlannedNotificationReceipt>(
  "JitPlannedNotificationReceipt",
)(
  {
    ...commonFields(),
    operation: S.tag("planned_notification"),
    ...requiredTrigger(),
  },
  $I.annote("JitPlannedNotificationReceipt", {
    description: "Planned JIT notification receipt. Trigger authority is required and a parent event is forbidden.",
  }),
  (columns) => [...commonChecks(columns), ...triggerChecks(columns)],
) {}

/**
 * Encoded planned-notification receipt.
 *
 * @see {@link JitPlannedNotificationReceipt} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitPlannedNotificationReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitPlannedNotificationReceipt>;
}

/**
 * Ambient-notification receipt. The trigger pair is all-or-nothing and a parent is forbidden.
 *
 * **Example** (Construct an ambient receipt without a trigger)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitAmbientNotificationReceipt } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const digest = "b".repeat(64)
 * const receipt = JitAmbientNotificationReceipt.make({
 *   uid: "user-1",
 *   eventId: digest,
 *   candidateId: digest,
 *   accountGeneration: 1,
 *   budgetDay: "2020-01-02",
 *   deviceId: digest,
 *   createdAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.operation) // "ambient_notification"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitAmbientNotificationReceipt extends Model<JitAmbientNotificationReceipt>(
  "JitAmbientNotificationReceipt",
)(
  {
    ...commonFields(),
    operation: S.tag("ambient_notification"),
    ...optionalTrigger(),
  },
  $I.annote("JitAmbientNotificationReceipt", {
    description: "Ambient JIT notification receipt. Trigger id and revision are both present or both absent.",
  }),
  (columns) => [...commonChecks(columns), ...triggerChecks(columns)],
) {}

/**
 * Encoded ambient-notification receipt.
 *
 * @see {@link JitAmbientNotificationReceipt} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitAmbientNotificationReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitAmbientNotificationReceipt>;
}

/**
 * Nano-triage receipt. Same trigger-pair rule as an ambient notification, and no parent.
 *
 * **Example** (Construct a nano-triage receipt)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitNanoTriageReceipt } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const digest = "c".repeat(64)
 * const receipt = JitNanoTriageReceipt.make({
 *   uid: "user-1",
 *   eventId: digest,
 *   candidateId: digest,
 *   accountGeneration: 0,
 *   budgetDay: "2020-01-02",
 *   deviceId: digest,
 *   createdAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.operation) // "nano_triage"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitNanoTriageReceipt extends Model<JitNanoTriageReceipt>("JitNanoTriageReceipt")(
  {
    ...commonFields(),
    operation: S.tag("nano_triage"),
    ...optionalTrigger(),
  },
  $I.annote("JitNanoTriageReceipt", {
    description: "Nano-triage JIT receipt. Trigger id and revision are both present or both absent.",
  }),
  (columns) => [...commonChecks(columns), ...triggerChecks(columns)],
) {}

/**
 * Encoded nano-triage receipt.
 *
 * @see {@link JitNanoTriageReceipt} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitNanoTriageReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitNanoTriageReceipt>;
}

/**
 * Full-turn receipt. A parent event is required. The trigger pair stays all-or-nothing.
 *
 * **Example** (Construct a full turn)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { JitFullTurnReceipt } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const digest = "d".repeat(64)
 * const receipt = JitFullTurnReceipt.make({
 *   uid: "user-1",
 *   eventId: digest,
 *   candidateId: digest,
 *   accountGeneration: 2,
 *   parentEventId: digest,
 *   budgetDay: "2020-01-02",
 *   deviceId: digest,
 *   createdAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   requestHash: digest,
 * })
 * console.log(receipt.parentEventId) // digest
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JitFullTurnReceipt extends Model<JitFullTurnReceipt>("JitFullTurnReceipt")(
  {
    ...commonFields(),
    operation: S.tag("full_turn"),
    ...optionalTrigger(),
    parentEventId: hashText.pipe(pg.text(), pg.columnName("parent_event_id")),
  },
  $I.annote("JitFullTurnReceipt", {
    description: "Full-turn JIT receipt. parentEventId is required and is the notification-admission parent.",
  }),
  (columns) => [
    ...commonChecks(columns),
    ...triggerChecks(columns),
    hashCheck("parent_event_id")(columns.parentEventId),
  ],
) {}

/**
 * Encoded full-turn receipt.
 *
 * @see {@link JitFullTurnReceipt} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitFullTurnReceipt {
  export type Encoded = S.Codec.Encoded<typeof JitFullTurnReceipt>;
}

/**
 * JIT proactivity receipt discriminated by `operation`.
 *
 * **Details**
 *
 * Unknown keys are rejected by {@link decodeJitProactivityEventReceipt}. A
 * planned notification cannot omit its trigger. A full turn cannot omit its
 * parent. Every other operation rejects a parent. Ambient, nano, and full-turn
 * receipts reject a trigger id without its revision, and the reverse.
 *
 * **Gotchas**
 *
 * `createdAt` must be timezone-aware. Naive strings are not read as UTC here,
 * unlike import-job clocks. Content-free ids are digests, not memory text.
 *
 * **Example** (Reject a planned notification without a trigger)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeJitProactivityEventReceipt } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const digest = "a".repeat(64)
 * const exit = Effect.runSyncExit(
 *   decodeJitProactivityEventReceipt({
 *     uid: "user-1",
 *     eventId: digest,
 *     candidateId: digest,
 *     operation: "planned_notification",
 *     accountGeneration: 0,
 *     budgetDay: "2020-01-02",
 *     deviceId: digest,
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     requestHash: digest,
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JITProactivityEventReceipt = JitProactivityOperation.mapMembers(
  Tuple.evolve([
    () => JitPlannedNotificationReceipt,
    () => JitAmbientNotificationReceipt,
    () => JitNanoTriageReceipt,
    () => JitFullTurnReceipt,
  ]),
).pipe(
  S.toTaggedUnion("operation"),
  $I.annoteSchema("JITProactivityEventReceipt", {
    description: "Content-free JIT proactivity receipt. operation selects the required trigger and parent fields.",
  }),
);

/**
 * Decoded JIT proactivity receipt.
 *
 * @see {@link JITProactivityEventReceipt} for the runtime tagged union.
 * @category type-level
 * @since 0.0.0
 */
export type JITProactivityEventReceipt = typeof JITProactivityEventReceipt.Type;

const decodeJITProactivityEventReceipt = S.decodeUnknownEffect(JITProactivityEventReceipt, { onExcessProperty: "error" });

/**
 * Trigger id and revision were not supplied together.
 *
 * **Example** (Show the failure tag)
 *
 * ```ts
 * import { JitTriggerPairInvalid } from "@beep/scratchpad/beep/JitProactivity"
 *
 * console.log(JitTriggerPairInvalid.make({ reason: "JIT trigger id and revision must be supplied together" }).reason) // "JIT trigger id and revision must be supplied together"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JitTriggerPairInvalid extends S.TaggedError<JitTriggerPairInvalid>()(
  "JitTriggerPairInvalid",
  { reason: S.String },
  $I.annoteError<JitTriggerPairInvalid>("JitTriggerPairInvalid", {
    description: "A JIT receipt supplied a trigger id without its revision, or the reverse.",
  }),
) {}

/**
 * Encoded trigger-pair error.
 *
 * @see {@link JitTriggerPairInvalid} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JitTriggerPairInvalid {
  export type Encoded = S.Codec.Encoded<typeof JitTriggerPairInvalid>;
}

const triggerPairInvalid = (): JitTriggerPairInvalid =>
  JitTriggerPairInvalid.make({ reason: "JIT trigger id and revision must be supplied together" });

/**
 * Decodes a JIT receipt, rejects unknown keys, and checks the trigger pair.
 *
 * **Details**
 *
 * `extra='forbid'` is this decode option. A parent key on a non-full-turn
 * receipt is unknown and fails here. Ambient, nano, and full-turn receipts
 * fail when the trigger id and revision are not both present or both absent.
 * The pair rule lives here, not on the class, so the tagged union stays a
 * plain schema.
 *
 * **Example** (Decode an ambient receipt)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeJitProactivityEventReceipt } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const digest = "b".repeat(64)
 * const decoded = Effect.runSync(
 *   decodeJitProactivityEventReceipt({
 *     schemaVersion: "jit_proactivity_event.v1",
 *     uid: " user-1 ",
 *     eventId: digest,
 *     candidateId: digest,
 *     operation: "ambient_notification",
 *     accountGeneration: 0,
 *     budgetDay: "2020-01-02",
 *     deviceId: digest,
 *     createdAt: "2020-01-02T03:04:05Z",
 *     requestHash: digest,
 *   }),
 * )
 * console.log(decoded.uid) // "user-1"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeJitProactivityEventReceipt = Effect.fn("JITProactivityEventReceipt.decode")(function* (
  input: unknown,
) {
  const decoded = yield* decodeJITProactivityEventReceipt(input);
  if (
    (decoded.operation === "ambient_notification" ||
      decoded.operation === "nano_triage" ||
      decoded.operation === "full_turn") &&
    !triggerPairIsTogether(decoded)
  ) {
    return yield* triggerPairInvalid();
  }
  return decoded;
});

const restrictedLabels = HashSet.make(
  "credential",
  "secret",
  "financial",
  "health",
  "intimate",
  "minor",
  "minors",
  "workplace_confidential",
  "identity_authentication",
);

const collapse = (value: string): string => A.join(" ")(A.filter(Str.split(/\s+/u)(value), (part) => part.length > 0));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value);

/**
 * Plain view of the product memory fields the paid-authority fence reads.
 *
 * **Details**
 *
 * This is not `product_memory.MemoryItem`. The fence only needs the ledger,
 * lifecycle, evidence, and trigger-condition fields. Null means the Python
 * attribute was missing or `None`.
 *
 * @see {@link isJitTriggerPaidAuthority} for the fence that consumes this view.
 * @category type-level
 * @since 0.0.0
 */
export interface JitTriggerAuthorityItem {
  readonly ledgerSchemaVersion: string | null;
  readonly kind: string | null;
  readonly tier: string | null;
  readonly processingState: string | null;
  readonly status: string | null;
  readonly validTo: DateTime.Utc | null;
  readonly supersededBy: string | null;
  readonly validFrom: DateTime.Utc | null;
  readonly sourceState: string | null;
  readonly evidence: ReadonlyArray<{ readonly sourceState: string | null }>;
  readonly intentBacked: boolean;
  readonly subjectScope: string | null;
  readonly sensitivityLabels: ReadonlyArray<string>;
  readonly triggerCondition: Record<string, unknown> | null;
}

/**
 * Returns whether a trigger memory may spend paid JIT authority at `at`.
 *
 * **Details**
 *
 * True only for a `knowledge_ledger.v1` trigger in the Long-term layer that
 * is processed, active, open-ended, source-active, backed by at least one
 * active evidence row, intent-backed, and about the primary user. No
 * restricted sensitivity label is allowed. `triggerCondition.action` must be
 * `{ type: "agent_prompt", prompt }` whose whitespace-collapsed prompt length
 * is from 1 through 2000. The function does not throw.
 *
 * **Gotchas**
 *
 * `tier` here is the product layer value `long_term`, not a separate axis.
 * Restricted labels are the product set (`credential`, `secret`, `financial`,
 * `health`, `intimate`, `minor`, `minors`, `workplace_confidential`,
 * `identity_authentication`). `context_only` is not a tier and does not pass.
 *
 * **Example** (Reject an item with no trigger action)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { isJitTriggerPaidAuthority } from "@beep/scratchpad/beep/JitProactivity"
 *
 * const paid = isJitTriggerPaidAuthority({
 *   item: {
 *     ledgerSchemaVersion: "knowledge_ledger.v1",
 *     kind: "trigger",
 *     tier: "long_term",
 *     processingState: "processed",
 *     status: "active",
 *     validTo: null,
 *     supersededBy: null,
 *     validFrom: null,
 *     sourceState: "active",
 *     evidence: [],
 *     intentBacked: true,
 *     subjectScope: "primary_user",
 *     sensitivityLabels: [],
 *     triggerCondition: {},
 *   },
 *   at: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(paid) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isJitTriggerPaidAuthority = (input: {
  readonly item: JitTriggerAuthorityItem;
  readonly at: DateTime.Utc;
}): boolean => {
  const item = input.item;
  const at = input.at;
  const action = item.triggerCondition === null ? undefined : item.triggerCondition.action;
  const prompt = isRecord(action) ? action.prompt : undefined;
  const collapsed = P.isString(prompt) ? collapse(prompt) : "";
  const labels = HashSet.fromIterable(item.sensitivityLabels);
  return (
    item.ledgerSchemaVersion === "knowledge_ledger.v1" &&
    item.kind === "trigger" &&
    item.tier === "long_term" &&
    item.processingState === "processed" &&
    item.status === "active" &&
    item.validTo === null &&
    item.supersededBy === null &&
    (item.validFrom === null || DateTime.toEpochMillis(item.validFrom) <= DateTime.toEpochMillis(at)) &&
    item.sourceState === "active" &&
    A.some(item.evidence, (evidence) => evidence.sourceState === "active") &&
    item.intentBacked &&
    item.subjectScope === "primary_user" &&
    HashSet.isEmpty(HashSet.intersection(labels, restrictedLabels)) &&
    isRecord(action) &&
    action.type === "agent_prompt" &&
    P.isString(prompt) &&
    collapsed.length > 0 &&
    collapsed.length <= 2000
  );
};
