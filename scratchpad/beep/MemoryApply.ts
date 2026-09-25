/**
 * Memory apply: writer admission, control head, outbox rows, and the
 * long-term patch transaction.
 *
 * **Details**
 *
 * This module owns the canonical ledger fence for one account: the control
 * document (`head_commit_id`, generations, writer mode), the outbox events that
 * fan a commit out to the projection and vector stores, and the pure
 * transaction that turns a {@link DurableMemoryPatch} into product
 * {@link MemoryItem} rows. Layer, status, and processing state stay three axes
 * and are validated through the memory-domain matrix before any row is built.
 *
 * **Gotchas**
 *
 * Nothing here talks to Firestore. The transaction reads a clock and logs, so
 * it is an Effect program, not a pure function. Payload dictionaries use the
 * camelCase field names of this port; hashed payloads keep the Python
 * snake_case keys so ids stay comparable across runtimes.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Rec from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import {
  Model,
  NonNegativeInt,
  nonNegativeIntCheck,
  optionalNull,
  pg,
  Table,
  textBoundsCheck,
} from "./Kit.ts";
import { validRequiredProcessingReceipt } from "./MemoryAdmission.ts";
import {
  CheckedDurableMemoryPatch,
  DurableMemoryPatch,
  deterministicContractId,
} from "./MemoryContracts.ts";
import { assertLegalState, physicalStatusToRecordStatus } from "./MemoryDomain.ts";
import { MemoryEvidence } from "./MemoryEvidence.ts";
import {
  MemoryOperation,
  logicalPayloadDigest,
  markOperationCommitted,
} from "./MemoryOperations.ts";
import {
  MemoryGraphAssertion,
  PromotionGraphPlan,
  buildMemoryGraphAssertion,
  derivePromotionGraphPlan,
  validPromotionAdmission,
} from "./MemoryPromotion.ts";
import {
  MemoryEvidenceLink,
  MemoryItem,
  SourceState,
  defaultShortTermExpiry,
  normalizedMemoryContentKey,
  restrictedSensitivityLabels,
} from "./ProductMemory.ts";

const isJsonObject = S.is(S.JsonObject);
const isSourceState = S.is(SourceState);

const $I = $ScratchpadId.create("beep/MemoryApply");

const closed = <const L extends readonly [string, ...ReadonlyArray<string>]>(
  literals: L,
  name: string,
  description: string,
) => LiteralKit(literals).pipe($I.annoteSchema(name, { description }));

const nonBlank = S.String.check(
  S.isMinLength(1),
  S.makeFilter((value: string) => (Str.isEmpty(Str.trim(value)) ? "required control fields must not be blank" : undefined)),
);

const coercedInstant =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})?$/;

const offsetSuffix = /(Z|[+-][0-9]{2}:[0-9]{2})$/;

const stampUtc = (input: string): string => (offsetSuffix.test(input) ? input : `${input}Z`);

/**
 * ISO timestamp that reads a naive value as UTC.
 *
 * **Details**
 *
 * Python's `coerce_timezone_aware` stamps `timezone.utc` on a naive datetime
 * and converts an aware one to UTC. This codec does the same: a string with
 * no offset is read as UTC, and an offset string is converted. It never
 * rejects a naive value, which is the opposite of the JIT receipt policy.
 *
 * **Example** (Read a naive timestamp as UTC)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CoercedUtcTimestamp } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CoercedUtcTimestamp)("2020-01-02T03:04:05"))
 * console.log(DateTime.formatIso(decoded)) // "2020-01-02T03:04:05.000Z"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoercedUtcTimestamp = S.String.check(S.isPattern(coercedInstant)).pipe(
  S.decodeTo(S.DateTimeUtc, {
    decode: SchemaGetter.transform((input: string) => DateTime.toUtc(DateTime.makeUnsafe(stampUtc(input)))),
    encode: SchemaGetter.transform(DateTime.formatIso),
  }),
  $I.annoteSchema("CoercedUtcTimestamp", {
    description: "ISO instant. A naive value is stamped UTC instead of rejected.",
  }),
);

/**
 * Decoded coerced UTC timestamp.
 *
 * @see {@link CoercedUtcTimestamp} for the codec.
 * @category type-level
 * @since 0.0.0
 */
export type CoercedUtcTimestamp = typeof CoercedUtcTimestamp.Type;

const optionalCoerced = (column: string, description: string) =>
  optionalNull(CoercedUtcTimestamp)
    .annotateKey({ description })
    .pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

const counter = (column: string, description: string) =>
  NonNegativeInt.annotateKey({ description }).pipe(
    S.withConstructorDefault(Effect.succeed(0)),
    pg.integer(),
    pg.columnName(column),
  );

const optionalText = (column: string, description: string) =>
  optionalNull(S.String).annotateKey({ description }).pipe(pg.text(), pg.columnName(column));

/**
 * Outcome tag of one apply attempt.
 *
 * **Details**
 *
 * This is the failure ADT of the transaction. Most apply failures return a
 * status and a reason instead of raising, so callers branch on this value.
 *
 * **Example** (Read the committed tag)
 *
 * ```ts
 * import { ApplyStatus } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(ApplyStatus.is("committed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ApplyStatus = closed(
  [
    "committed",
    "idempotent_skip",
    "retryable_head_mismatch",
    "generation_mismatch",
    "source_not_active",
    "target_not_active",
    "payload_mismatch",
    "invalid_patch",
  ],
  "ApplyStatus",
  "Apply outcome. Everything but committed is a rejected or deferred apply.",
);

/**
 * Decoded apply status.
 *
 * @see {@link ApplyStatus} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ApplyStatus = typeof ApplyStatus.Type;

/**
 * Authoritative memory-writer state for one user.
 *
 * **Details**
 *
 * Transition modes are deliberate stop-the-world fences for ordinary memory
 * writers. Account deletion and privacy enforcement are separate authorities
 * and must not be routed through this admission state.
 *
 * **Gotchas**
 *
 * The transitioning modes require a `writerTransitionOwner`; the stable modes
 * forbid one. That rule lives on {@link CheckedMemoryControlState}, not on
 * this literal kit.
 *
 * **Example** (Check a transition mode)
 *
 * ```ts
 * import { WriterMode } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(WriterMode.is("transitioning_to_ledger")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WriterMode = closed(
  ["compatibility", "transitioning_to_ledger", "ledger", "transitioning_to_compatibility"],
  "WriterMode",
  "Writer admission mode. Transition modes fence ordinary writers.",
);

/**
 * Decoded writer mode.
 *
 * @see {@link WriterMode} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type WriterMode = typeof WriterMode.Type;

/**
 * Writer class asking for admission.
 *
 * **Example** (Check the user class)
 *
 * ```ts
 * import { MemoryWriterClass } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(MemoryWriterClass.is("user")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryWriterClass = closed(
  ["compatibility", "ledger", "user"],
  "MemoryWriterClass",
  "Writer class. A parameter of requireWriterAdmitted, not a stored field.",
);

/**
 * Decoded writer class.
 *
 * @see {@link MemoryWriterClass} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryWriterClass = typeof MemoryWriterClass.Type;

const isMemoryWriterClass = S.is(MemoryWriterClass);

/**
 * Outbox event kind.
 *
 * **Gotchas**
 *
 * The apply transaction only emits `projection_sync` and `vector_sync`.
 * `export_sync` and `delete_sync` exist on the wire and are unused here.
 *
 * **Example** (Check a sync kind)
 *
 * ```ts
 * import { MemoryOutboxEventType } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(MemoryOutboxEventType.is("vector_sync")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryOutboxEventType = closed(
  ["projection_sync", "vector_sync", "export_sync", "delete_sync"],
  "MemoryOutboxEventType",
  "Outbox event kind.",
);

/**
 * Decoded outbox event kind.
 *
 * @see {@link MemoryOutboxEventType} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryOutboxEventType = typeof MemoryOutboxEventType.Type;

/**
 * Outbox delivery status.
 *
 * **Example** (Check the pending status)
 *
 * ```ts
 * import { MemoryOutboxStatus } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(MemoryOutboxStatus.is("pending")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryOutboxStatus = closed(
  ["pending", "processing", "delivered", "retryable_failure", "dead_letter"],
  "MemoryOutboxStatus",
  "Outbox delivery status.",
);

/**
 * Decoded outbox status.
 *
 * @see {@link MemoryOutboxStatus} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryOutboxStatus = typeof MemoryOutboxStatus.Type;

/**
 * The requested writer class is not admitted by the current control mode.
 *
 * **Example** (Name the rejected writer)
 *
 * ```ts
 * import { WriterAdmissionError } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(WriterAdmissionError.make({ message: "unknown memory writer class" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WriterAdmissionError extends S.TaggedError<WriterAdmissionError>()(
  "WriterAdmissionError",
  { message: S.String },
  $I.annoteError<WriterAdmissionError>("WriterAdmissionError", {
    description: "The requested writer class is not admitted by the current control mode.",
  }),
) {}

/**
 * Encoded form of {@link WriterAdmissionError}.
 *
 * @see {@link WriterAdmissionError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WriterAdmissionError {
  export type Encoded = S.Codec.Encoded<typeof WriterAdmissionError>;
}

/**
 * A control-state or watermark transition was rejected.
 *
 * **Details**
 *
 * Python raises `ValueError` from `advance_head` and
 * `advance_projection_watermark`. Those are the only sources of this error.
 *
 * **Example** (Name a blank commit)
 *
 * ```ts
 * import { MemoryApplyError } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(MemoryApplyError.make({ message: "commit_id must not be blank" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryApplyError extends S.TaggedError<MemoryApplyError>()(
  "MemoryApplyError",
  { message: S.String },
  $I.annoteError<MemoryApplyError>("MemoryApplyError", {
    description: "A control head or watermark transition was rejected.",
  }),
) {}

/**
 * Encoded form of {@link MemoryApplyError}.
 *
 * @see {@link MemoryApplyError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryApplyError {
  export type Encoded = S.Codec.Encoded<typeof MemoryApplyError>;
}

/**
 * Per-account memory control document.
 *
 * **Details**
 *
 * The control row is the canonical commit fence: `headCommitId` and
 * `commitSequence` advance together on every commit, the generations fence
 * stale operations, and `writerEpoch` is the CAS fence for writer cutovers.
 * The projection and vector watermarks record how far each downstream
 * consumer has applied the outbox.
 *
 * **Gotchas**
 *
 * `writerEpoch` and every counter reject booleans and non-integers; Python's
 * before-validator only did that for `writerEpoch`. Naive timestamps are
 * stamped UTC, never rejected. The transition-owner rule is a cross-field
 * check on {@link CheckedMemoryControlState}. `updatedAt` defaults to the
 * clock at construction.
 *
 * **Example** (Construct a compatibility-mode control row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryControlState } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const state = MemoryControlState.make({
 *   uid: "user-1",
 *   headCommitId: "commit_root",
 *   accountGeneration: 0,
 *   sourceGeneration: 0,
 * })
 * console.log(state.writerMode) // "compatibility"
 * console.log(O.isNone(state.writerTransitionOwner)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryControlState extends Model<MemoryControlState>("MemoryControlState")(
  {
    uid: nonBlank.annotateKey({ description: "Account uid. Blank is rejected." }).pipe(pg.text(), pg.columnName("uid")),
    headCommitId: nonBlank
      .annotateKey({ description: "Current canonical head commit. Blank is rejected." })
      .pipe(pg.text(), pg.columnName("head_commit_id")),
    accountGeneration: NonNegativeInt.annotateKey({ description: "Account generation fence." }).pipe(
      pg.integer(),
      pg.columnName("account_generation"),
    ),
    sourceGeneration: NonNegativeInt.annotateKey({ description: "Source generation fence." }).pipe(
      pg.integer(),
      pg.columnName("source_generation"),
    ),
    writerMode: WriterMode.annotateKey({ description: "Writer admission mode. Construction defaults to compatibility." }).pipe(
      S.withConstructorDefault(Effect.succeed<WriterMode>("compatibility")),
      pg.text(),
      pg.columnName("writer_mode"),
    ),
    writerEpoch: counter("writer_epoch", "CAS fence for writer cutovers. Booleans and strings are rejected."),
    writerTransitionOwner: optionalText(
      "writer_transition_owner",
      "Owner of an in-flight transition. Required while transitioning, forbidden otherwise.",
    ),
    ledgerMigrationMigratedCount: counter("ledger_migration_migrated_count", "Rows migrated into the ledger."),
    ledgerMigrationAdjudicatedCount: counter("ledger_migration_adjudicated_count", "Rows adjudicated during migration."),
    commitSequence: counter("commit_sequence", "Sequence of the head commit."),
    projectionWatermarkCommitId: optionalText("projection_watermark_commit_id", "Last commit the projection consumer applied."),
    projectionWatermarkSequence: counter("projection_watermark_sequence", "Sequence of the projection watermark."),
    vectorWatermarkCommitId: optionalText("vector_watermark_commit_id", "Last commit the vector consumer applied."),
    lastPromotionRunAt: optionalCoerced("last_promotion_run_at", "Last promotion sweep. Naive values are read as UTC."),
    lastConsolidationRunAt: optionalCoerced("last_consolidation_run_at", "Last consolidation sweep. Naive values are read as UTC."),
    legacyBackfillProcessedCount: counter("legacy_backfill_processed_count", "Legacy rows processed by the backfill."),
    legacyBackfillSourceFingerprint: optionalText("legacy_backfill_source_fingerprint", "Fingerprint of the backfilled legacy source."),
    legacyBackfillCompletedAt: optionalCoerced("legacy_backfill_completed_at", "Backfill completion instant. Naive values are read as UTC."),
    updatedAt: CoercedUtcTimestamp.annotateKey({ description: "Last mutation instant. Construction defaults to the clock." }).pipe(
      S.withConstructorDefault(Effect.sync(DateTime.nowUnsafe)),
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("updated_at"),
    ),
  },
  $I.annote("MemoryControlState", {
    description: "Per-account memory control document: head, generations, writer mode, and watermarks.",
  }),
  (columns) => [
    textBoundsCheck("uid", { minLength: 1 })(columns.uid),
    textBoundsCheck("head_commit_id", { minLength: 1 })(columns.headCommitId),
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
    nonNegativeIntCheck("source_generation")(columns.sourceGeneration),
    nonNegativeIntCheck("writer_epoch")(columns.writerEpoch),
    nonNegativeIntCheck("ledger_migration_migrated_count")(columns.ledgerMigrationMigratedCount),
    nonNegativeIntCheck("ledger_migration_adjudicated_count")(columns.ledgerMigrationAdjudicatedCount),
    nonNegativeIntCheck("commit_sequence")(columns.commitSequence),
    nonNegativeIntCheck("projection_watermark_sequence")(columns.projectionWatermarkSequence),
    nonNegativeIntCheck("legacy_backfill_processed_count")(columns.legacyBackfillProcessedCount),
    Table.check("writer_transition_owner_by_mode")(
      sql<boolean>`(${columns.writerMode} in ('transitioning_to_ledger', 'transitioning_to_compatibility')) = (${columns.writerTransitionOwner} is not null)`,
    ),
  ],
) {}

/**
 * Encoded form of {@link MemoryControlState}.
 *
 * @see {@link MemoryControlState} for the runtime row.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryControlState {
  export type Encoded = S.Codec.Encoded<typeof MemoryControlState>;
}

const isTransitioning = (mode: WriterMode): boolean =>
  Equal.equals(mode, "transitioning_to_ledger") || Equal.equals(mode, "transitioning_to_compatibility");

/**
 * Explain why a control row breaks the transition-owner rule, if it does.
 *
 * **Details**
 *
 * A transitioning writer mode requires a non-blank owner. A stable mode cannot
 * retain an owner. An owner must not carry surrounding whitespace.
 *
 * **Example** (Flag a stable mode with an owner)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryControlState, controlStateIssue } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const issue = controlStateIssue(
 *   MemoryControlState.make({
 *     uid: "user-1",
 *     headCommitId: "commit_root",
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     writerTransitionOwner: O.some("migrator"),
 *   }),
 * )
 * console.log(issue) // "stable writer mode cannot retain a transition owner"
 * ```
 *
 * @see {@link CheckedMemoryControlState} for the same rule on decode.
 * @category predicates
 * @since 0.0.0
 */
export const controlStateIssue = (state: MemoryControlState): string | undefined => {
  const transitioning = isTransitioning(state.writerMode);
  const owner = Str.trim(O.getOrElse(state.writerTransitionOwner, () => ""));
  if (transitioning && Str.isEmpty(owner)) return "transitioning writer mode requires an owner";
  if (!transitioning && O.isSome(state.writerTransitionOwner)) {
    return "stable writer mode cannot retain a transition owner";
  }
  if (O.isSome(state.writerTransitionOwner) && state.writerTransitionOwner.value !== owner) {
    return "writer transition owner must not contain surrounding whitespace";
  }
  return undefined;
};

/**
 * {@link MemoryControlState} with the transition-owner rule enforced on decode.
 *
 * **Example** (Reject a transition without an owner)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CheckedMemoryControlState } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(CheckedMemoryControlState)({
 *     uid: "user-1",
 *     headCommitId: "commit_root",
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     writerMode: "transitioning_to_ledger",
 *     updatedAt: "2020-01-02T03:04:05Z",
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CheckedMemoryControlState = MemoryControlState.check(
  S.makeFilter(controlStateIssue, {
    identifier: "MemoryControlStateWriterOwner",
    title: "Writer transition owner matches writer mode",
  }),
);

/**
 * Decoded checked control state.
 *
 * @see {@link CheckedMemoryControlState} for the schema.
 * @category type-level
 * @since 0.0.0
 */
export type CheckedMemoryControlState = typeof CheckedMemoryControlState.Type;

/**
 * Fail unless the writer owns the stable mode or the explicit migration seam.
 *
 * **Details**
 *
 * `user` writes are admitted in the stable modes only. The `compatibility`
 * writer is admitted in compatibility mode. The `ledger` writer is admitted in
 * ledger mode always, and in compatibility or transitioning-to-ledger mode
 * only when `allowLedgerMigration` is set. `transitioning_to_compatibility`
 * admits nobody. An unknown class fails before the mode is consulted.
 *
 * **Example** (Admit a user write in ledger mode)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import { MemoryControlState, requireWriterAdmitted } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const state = MemoryControlState.make({
 *   uid: "user-1",
 *   headCommitId: "commit_root",
 *   accountGeneration: 0,
 *   sourceGeneration: 0,
 *   writerMode: "ledger",
 * })
 * console.log(Exit.isSuccess(Effect.runSyncExit(requireWriterAdmitted(state, "user")))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const requireWriterAdmitted = Effect.fn("MemoryApply.requireWriterAdmitted")(function* (
  control: MemoryControlState,
  writerClass: string,
  allowLedgerMigration: boolean = false,
) {
  if (!isMemoryWriterClass(writerClass)) {
    return yield* WriterAdmissionError.make({ message: "unknown memory writer class" });
  }
  const mode = control.writerMode;
  if (Equal.equals(writerClass, "user") && (Equal.equals(mode, "compatibility") || Equal.equals(mode, "ledger"))) {
    return;
  }
  if (Equal.equals(mode, "compatibility")) {
    if (Equal.equals(writerClass, "compatibility")) return;
    if (Equal.equals(writerClass, "ledger") && allowLedgerMigration) return;
  } else if (Equal.equals(mode, "ledger") && Equal.equals(writerClass, "ledger")) {
    return;
  } else if (Equal.equals(mode, "transitioning_to_ledger") && Equal.equals(writerClass, "ledger") && allowLedgerMigration) {
    return;
  }
  return yield* WriterAdmissionError.make({
    message: `${writerClass} writer is not admitted while writer mode is ${mode}`,
  });
});

/**
 * Deterministic id of the next commit on this head.
 *
 * **Details**
 *
 * `commit_` plus the first 32 hex characters of the `memory-commit` contract id
 * over uid, current head, operation id, and `commitSequence + 1`.
 *
 * **Example** (Derive the next commit id)
 *
 * ```ts
 * import { MemoryControlState, nextCommitId } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const state = MemoryControlState.make({
 *   uid: "user-1",
 *   headCommitId: "commit_root",
 *   accountGeneration: 0,
 *   sourceGeneration: 0,
 * })
 * console.log(nextCommitId(state, "op_1").startsWith("commit_")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const nextCommitId: {
  (operationId: string): (state: MemoryControlState) => string;
  (state: MemoryControlState, operationId: string): string;
} = dual(
  2,
  (state: MemoryControlState, operationId: string): string =>
    `commit_${Str.takeLeft(32)(
      deterministicContractId("memory-commit", {
        uid: state.uid,
        head_commit_id: state.headCommitId,
        operation_id: operationId,
        commit_sequence: state.commitSequence + 1,
      }),
    )}`,
);

/**
 * Move the head to a new commit and bump the sequence.
 *
 * **Details**
 *
 * Fails with {@link MemoryApplyError} on a blank commit id. `updatedAt` is
 * stamped from the clock.
 *
 * **Example** (Advance one commit)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { MemoryControlState, advanceHead } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const state = MemoryControlState.make({
 *   uid: "user-1",
 *   headCommitId: "commit_root",
 *   accountGeneration: 0,
 *   sourceGeneration: 0,
 * })
 * const next = Effect.runSync(advanceHead(state, "commit_next"))
 * console.log(next.commitSequence) // 1
 * ```
 *
 * @category transitions
 * @since 0.0.0
 */
export const advanceHead = Effect.fn("MemoryApply.advanceHead")(function* (state: MemoryControlState, commitId: string) {
  if (Str.isEmpty(Str.trim(commitId))) {
    return yield* MemoryApplyError.make({ message: "commit_id must not be blank" });
  }
  const now = yield* DateTime.now;
  return MemoryControlState.make({
    ...state,
    headCommitId: commitId,
    commitSequence: state.commitSequence + 1,
    updatedAt: now,
  });
});

/**
 * Advance the projection watermark by exactly one outbox event.
 *
 * **Details**
 *
 * The event's commit must be non-blank, its account generation must match,
 * its sequence must be the watermark plus one, and when a watermark commit is
 * already set the event's parent must equal it. `updatedAt` is stamped from
 * the clock.
 *
 * **Example** (Reject a skipped commit)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import { MemoryControlState, MemoryOutboxEvent, advanceProjectionWatermark } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const state = MemoryControlState.make({ uid: "user-1", headCommitId: "c1", accountGeneration: 0, sourceGeneration: 0 })
 * const event = MemoryOutboxEvent.make({
 *   eventId: "evt_1",
 *   uid: "user-1",
 *   eventType: "projection_sync",
 *   commitId: "c3",
 *   parentCommitId: "c2",
 *   commitSequence: 3,
 *   operationId: "op_1",
 *   accountGeneration: 0,
 *   sourceGeneration: 0,
 * })
 * console.log(Exit.isFailure(Effect.runSyncExit(advanceProjectionWatermark(state, event)))) // true
 * ```
 *
 * @category transitions
 * @since 0.0.0
 */
export const advanceProjectionWatermark = Effect.fn("MemoryApply.advanceProjectionWatermark")(function* (
  state: MemoryControlState,
  event: MemoryOutboxEvent,
) {
  if (Str.isEmpty(Str.trim(event.commitId))) {
    return yield* MemoryApplyError.make({ message: "projection watermark commit_id must not be blank" });
  }
  if (event.accountGeneration !== state.accountGeneration) {
    return yield* MemoryApplyError.make({ message: "projection watermark account_generation mismatch" });
  }
  if (event.commitSequence !== state.projectionWatermarkSequence + 1) {
    return yield* MemoryApplyError.make({ message: "projection watermark cannot skip commits or move backwards" });
  }
  if (
    O.isSome(state.projectionWatermarkCommitId) &&
    !Str.isEmpty(state.projectionWatermarkCommitId.value) &&
    event.parentCommitId !== state.projectionWatermarkCommitId.value
  ) {
    return yield* MemoryApplyError.make({ message: "projection watermark parent chain mismatch" });
  }
  const now = yield* DateTime.now;
  return MemoryControlState.make({
    ...state,
    projectionWatermarkCommitId: O.some(event.commitId),
    projectionWatermarkSequence: event.commitSequence,
    updatedAt: now,
  });
});

/**
 * One outbox row fanning a commit out to a downstream consumer.
 *
 * **Details**
 *
 * Barrier events carry no memory id and `{ action: "barrier" }`. Item events
 * carry the memory id, tier, item revision, content hash, and an `upsert` or
 * `delete` action. `parentCommitId` is the head the commit was built on.
 *
 * **Gotchas**
 *
 * `parentCommitId` is not in the non-blank validator; only `eventId`, `uid`,
 * `commitId`, and `operationId` are. `payload` is an untyped JSON object.
 * `availableAt` defaults to the clock at construction.
 *
 * **Example** (Construct a barrier event)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryOutboxEvent } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * const event = MemoryOutboxEvent.make({
 *   eventId: "evt_1",
 *   uid: "user-1",
 *   eventType: "projection_sync",
 *   commitId: "c1",
 *   parentCommitId: "c0",
 *   commitSequence: 1,
 *   operationId: "op_1",
 *   accountGeneration: 0,
 *   sourceGeneration: 0,
 * })
 * console.log(event.status) // "pending"
 * console.log(O.isNone(event.memoryId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryOutboxEvent extends Model<MemoryOutboxEvent>("MemoryOutboxEvent")(
  {
    eventId: nonBlank.annotateKey({ description: "Deterministic outbox event id." }).pipe(pg.text(), pg.columnName("event_id")),
    uid: nonBlank.annotateKey({ description: "Account uid." }).pipe(pg.text(), pg.columnName("uid")),
    eventType: MemoryOutboxEventType.annotateKey({ description: "Downstream consumer this event feeds." }).pipe(
      pg.text(),
      pg.columnName("event_type"),
    ),
    status: MemoryOutboxStatus.annotateKey({ description: "Delivery status. Construction defaults to pending." }).pipe(
      S.withConstructorDefault(Effect.succeed<MemoryOutboxStatus>("pending")),
      pg.text(),
      pg.columnName("status"),
    ),
    commitId: nonBlank.annotateKey({ description: "Commit this event belongs to." }).pipe(pg.text(), pg.columnName("commit_id")),
    parentCommitId: S.String.annotateKey({ description: "Head the commit was built on. Not checked for blanks." }).pipe(
      pg.text(),
      pg.columnName("parent_commit_id"),
    ),
    commitSequence: S.Int.annotateKey({ description: "Sequence of the commit." }).pipe(pg.integer(), pg.columnName("commit_sequence")),
    memoryId: optionalText("memory_id", "Changed memory id. Null on barrier events."),
    operationId: nonBlank.annotateKey({ description: "Operation that produced the commit." }).pipe(
      pg.text(),
      pg.columnName("operation_id"),
    ),
    accountGeneration: S.Int.annotateKey({ description: "Account generation at commit time." }).pipe(
      pg.integer(),
      pg.columnName("account_generation"),
    ),
    sourceGeneration: S.Int.annotateKey({ description: "Source generation at commit time." }).pipe(
      pg.integer(),
      pg.columnName("source_generation"),
    ),
    payload: S.JsonObject.annotateKey({ description: "Untyped consumer payload. Barrier or item action." }).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      pg.jsonb(),
      pg.columnName("payload"),
    ),
    availableAt: CoercedUtcTimestamp.annotateKey({ description: "Earliest delivery instant. Construction defaults to the clock." }).pipe(
      S.withConstructorDefault(Effect.sync(DateTime.nowUnsafe)),
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("available_at"),
    ),
    attemptCount: S.Int.annotateKey({ description: "Delivery attempts so far. Construction defaults to 0." }).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("attempt_count"),
    ),
  },
  $I.annote("MemoryOutboxEvent", {
    description: "Outbox row that fans one commit out to the projection or vector consumer.",
  }),
  (columns) => [
    textBoundsCheck("event_id", { minLength: 1 })(columns.eventId),
    textBoundsCheck("uid", { minLength: 1 })(columns.uid),
    textBoundsCheck("commit_id", { minLength: 1 })(columns.commitId),
    textBoundsCheck("operation_id", { minLength: 1 })(columns.operationId),
  ],
) {}

/**
 * Encoded form of {@link MemoryOutboxEvent}.
 *
 * @see {@link MemoryOutboxEvent} for the runtime row.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryOutboxEvent {
  export type Encoded = S.Codec.Encoded<typeof MemoryOutboxEvent>;
}

/**
 * Deterministic outbox event id.
 *
 * **Details**
 *
 * `evt_` plus the first 32 hex characters of the `memory-outbox` contract id
 * over event type, commit id, memory id (null on barriers), and operation id.
 *
 * **Example** (Derive a barrier event id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { outboxEventId } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(outboxEventId({ eventType: "projection_sync", commitId: "c1", memoryId: O.none(), operationId: "op_1" }).startsWith("evt_"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const outboxEventId = (input: {
  readonly eventType: MemoryOutboxEventType;
  readonly commitId: string;
  readonly memoryId: O.Option<string>;
  readonly operationId: string;
}): string =>
  `evt_${Str.takeLeft(32)(
    deterministicContractId("memory-outbox", {
      event_type: input.eventType,
      commit_id: input.commitId,
      memory_id: O.getOrNull(input.memoryId),
      operation_id: input.operationId,
    }),
  )}`;

/**
 * Result of one apply attempt.
 *
 * **Details**
 *
 * `status` is the outcome tag. On a committed apply, `controlState` is the
 * advanced head and the collections hold every changed item, graph assertion,
 * and outbox event. On every other status, `controlState` is the caller's
 * original row and the collections are empty.
 *
 * **Example** (Read an idempotent skip)
 *
 * ```ts
 * import { ApplyResult } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(ApplyResult.identifier) // "ApplyResult"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyResult extends Model<ApplyResult>("ApplyResult")(
  {
    status: ApplyStatus.annotateKey({ description: "Apply outcome tag." }).pipe(pg.text(), pg.columnName("status")),
    controlState: MemoryControlState.annotateKey({ description: "Control row after the attempt." }).pipe(
      pg.jsonb(),
      pg.columnName("control_state"),
    ),
    operation: MemoryOperation.annotateKey({ description: "Operation after the attempt." }).pipe(
      pg.jsonb(),
      pg.columnName("operation"),
    ),
    memoryItems: S.Array(MemoryItem)
      .annotateKey({ description: "Changed product memories. Empty unless committed." })
      .pipe(S.withConstructorDefault(Effect.succeed(A.empty<MemoryItem>())), pg.jsonb(), pg.columnName("memory_items")),
    graphAssertions: S.Array(MemoryGraphAssertion)
      .annotateKey({ description: "Graph assertions refreshed by the commit." })
      .pipe(S.withConstructorDefault(Effect.succeed(A.empty<MemoryGraphAssertion>())), pg.jsonb(), pg.columnName("graph_assertions")),
    outboxEvents: S.Array(MemoryOutboxEvent)
      .annotateKey({ description: "Outbox rows appended by the commit." })
      .pipe(S.withConstructorDefault(Effect.succeed(A.empty<MemoryOutboxEvent>())), pg.jsonb(), pg.columnName("outbox_events")),
    reason: optionalText("reason", "Why the apply did not commit. Null on success."),
  },
  $I.annote("ApplyResult", {
    description: "Outcome of one long-term patch apply attempt.",
  }),
) {}

/**
 * Encoded form of {@link ApplyResult}.
 *
 * @see {@link ApplyResult} for the runtime shape.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ApplyResult {
  export type Encoded = S.Codec.Encoded<typeof ApplyResult>;
}

const readKey = (record: S.JsonObject, snake: string, camel: string): O.Option<unknown> =>
  P.hasProperty(record, snake) ? O.some(record[snake]) : P.hasProperty(record, camel) ? O.some(record[camel]) : O.none();

const recordOf = (value: { readonly [key: string]: unknown }): { readonly [key: string]: unknown } => value;

const asJsonObject = (value: unknown): O.Option<S.JsonObject> => (isJsonObject(value) ? O.some(value) : O.none());

const jsonObjectOrEmpty = (value: O.Option<S.JsonObject>): S.JsonObject => O.getOrElse(value, () => ({}));

const promotionOf = (item: MemoryItem): S.JsonObject => jsonObjectOrEmpty(item.promotion);

const pyTruthy = (value: O.Option<unknown>): boolean =>
  O.match(value, {
    onNone: () => false,
    onSome: (json) => {
      if (P.isNull(json) || json === false || json === 0 || json === "") return false;
      if (A.isArray(json)) return json.length > 0;
      if (P.isObject(json)) return Rec.size(json) > 0;
      return true;
    },
  });

const userReviewNotFalse = (promotion: S.JsonObject): boolean =>
  O.getOrNull(readKey(promotion, "user_review", "userReview")) !== false;

const sortedIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(ids, Order.String);

const sameList = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && A.every(A.zip(left, right), ([a, b]) => a === b);

const evidenceIdsOf = (rows: ReadonlyArray<MemoryEvidence>): ReadonlyArray<string> => A.map(rows, (row) => row.evidenceId);

const linksOf = (rows: ReadonlyArray<MemoryEvidence>): ReadonlyArray<MemoryEvidenceLink> =>
  A.map(rows, (row) =>
    MemoryEvidenceLink.make({
      sourceId: row.sourceId,
      conversationId: row.conversationId,
      sourceState: isSourceState(row.sourceState) ? row.sourceState : "active",
    }),
  );

const hasRestrictedSensitivity = (labels: ReadonlyArray<string>): boolean =>
  A.some(labels, (label) => HashSet.has(restrictedSensitivityLabels, label));

const sameJson = (left: S.Json, right: S.Json): boolean =>
  deterministicContractId("memory-apply-json", { value: left }) ===
  deterministicContractId("memory-apply-json", { value: right });

const nonEmptyRecord = (value: S.JsonObject): boolean => Rec.size(value) > 0;

const graphPredicate = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

const excludedIdentityKeys = HashSet.make(
  "schema_version",
  "schemaVersion",
  "patch_id",
  "patchId",
  "packet_id",
  "packetId",
  "run_id",
  "runId",
  "observed_head_commit_id",
  "observedHeadCommitId",
  "idempotency_key",
  "idempotencyKey",
  "decision",
  "result_status",
  "resultStatus",
  "target_memory_id",
  "targetMemoryId",
  "memory_text",
  "memoryText",
  "supersedes",
  "existing_item",
  "existingItem",
  "superseded_items",
  "supersededItems",
  "evidence",
  "mutation_metadata",
  "mutationMetadata",
);

/**
 * Every item-affecting patch field not already in the base operation digest.
 *
 * **Details**
 *
 * Drops the identity, decision, target, text, supersedes, evidence, and
 * mutation-metadata keys and keeps the rest. Python also canonicalizes nested
 * models, enums, datetimes, and sets; a JSON payload has none of those, so the
 * remaining values pass through unchanged. Both snake_case and camelCase
 * spellings of each excluded key are dropped.
 *
 * **Example** (Keep only the extra keys)
 *
 * ```ts
 * import { buildPatchMutationIdentity } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(buildPatchMutationIdentity({ decision: "add", memoryText: "x", halfLifeDays: 30 })) // { halfLifeDays: 30 }
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildPatchMutationIdentity = (payload: S.JsonObject): S.JsonObject =>
  Rec.filter(payload, (_, key) => !HashSet.has(excludedIdentityKeys, key));

const deterministicMaterializedMemoryId = (input: {
  readonly uid: string;
  readonly patch: DurableMemoryPatch;
  readonly commitId: string;
}): string =>
  O.match(input.patch.targetMemoryId, {
    onSome: (target) => target,
    onNone: () =>
      O.match(input.patch.newMemoryId, {
        onSome: (fresh) => fresh,
        onNone: () =>
          `mem_${Str.takeLeft(32)(
            deterministicContractId("memory-materialized-item", {
              uid: input.uid,
              commit_id: input.commitId,
              patch_id: input.patch.patchId,
              idempotency_key: input.patch.idempotencyKey,
            }),
          )}`,
      }),
  });

/**
 * Full `memory-content` contract hash over content and evidence ids.
 *
 * **Details**
 *
 * Unlike the commit and outbox ids, this hash is not truncated.
 *
 * **Example** (Hash content with one evidence id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { memoryContentHash } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(memoryContentHash(O.some("Ada lives in Seattle"), ["ev-1"]).length) // 64
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const memoryContentHash: {
  (evidenceIds: ReadonlyArray<string>): (content: O.Option<string>) => string;
  (content: O.Option<string>, evidenceIds: ReadonlyArray<string>): string;
} = dual(
  2,
  (content: O.Option<string>, evidenceIds: ReadonlyArray<string>): string =>
    deterministicContractId("memory-content", { content: O.getOrNull(content), evidence_ids: A.copy(evidenceIds) }),
);

const nonNegativeInteger = (value: unknown): value is number =>
  P.isNumber(value) && Number.isInteger(value) && value >= 0;

const nonBlankString = (value: unknown): value is string => P.isString(value) && !Str.isEmpty(Str.trim(value));

/**
 * Validate the persisted graph-enrichment receipt before a graph-only long-term mutation.
 *
 * **Details**
 *
 * The receipt must carry schema `canonical_memory_graph_enrichment_receipt.v1`,
 * a non-empty list of unique non-blank evidence ids, non-blank identity
 * strings, non-negative integer revision and generations, and an id equal to
 * `ger_` plus the truncated contract id over those fields. It must then match
 * the operation uid, the existing item's id, revision, content hash, and
 * evidence ids, the control generations, and the plan hash.
 *
 * **Gotchas**
 *
 * The existing item's evidence ids are passed separately because the product
 * {@link MemoryItem} embeds evidence links without an evidence id.
 *
 * **Example** (Reject a non-object receipt)
 *
 * ```ts
 * import { validGraphEnrichmentReceipt } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof validGraphEnrichmentReceipt) // "function"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validGraphEnrichmentReceipt: {
  (context: GraphEnrichmentContext): (rawReceipt: unknown) => boolean;
  (rawReceipt: unknown, context: GraphEnrichmentContext): boolean;
} = dual(2, (rawReceipt: unknown, context: GraphEnrichmentContext): boolean => {
  const receipt = asJsonObject(rawReceipt);
  if (O.isNone(receipt) || O.isNone(context.graphPlan)) return false;
  const record = receipt.value;
  const plan = context.graphPlan.value;
  const schemaVersion = O.getOrNull(readKey(record, "schema_version", "schemaVersion"));
  if (schemaVersion !== "canonical_memory_graph_enrichment_receipt.v1") return false;
  const rawEvidenceIds = O.getOrNull(readKey(record, "evidence_ids", "evidenceIds"));
  if (!A.isArray(rawEvidenceIds) || rawEvidenceIds.length === 0) return false;
  const evidenceStrings = A.filter(rawEvidenceIds, P.isString);
  if (evidenceStrings.length !== rawEvidenceIds.length || !A.every(evidenceStrings, nonBlankString)) return false;
  const normalizedEvidenceIds = sortedIds(A.map(evidenceStrings, Str.trim));
  if (A.dedupe(normalizedEvidenceIds).length !== normalizedEvidenceIds.length) return false;
  const receiptId = O.getOrNull(readKey(record, "receipt_id", "receiptId"));
  const uid = O.getOrNull(readKey(record, "uid", "uid"));
  const memoryId = O.getOrNull(readKey(record, "memory_id", "memoryId"));
  const contentHash = O.getOrNull(readKey(record, "content_hash", "contentHash"));
  const planHash = O.getOrNull(readKey(record, "plan_hash", "planHash"));
  const itemRevision = O.getOrNull(readKey(record, "item_revision", "itemRevision"));
  const accountGeneration = O.getOrNull(readKey(record, "account_generation", "accountGeneration"));
  const sourceGeneration = O.getOrNull(readKey(record, "source_generation", "sourceGeneration"));
  if (
    !nonBlankString(receiptId) ||
    !nonBlankString(uid) ||
    !nonBlankString(memoryId) ||
    !nonBlankString(contentHash) ||
    !nonBlankString(planHash) ||
    !nonNegativeInteger(itemRevision) ||
    !nonNegativeInteger(accountGeneration) ||
    !nonNegativeInteger(sourceGeneration)
  ) {
    return false;
  }
  const expectedId = `ger_${Str.takeLeft(32)(
    deterministicContractId("canonical-memory-graph-enrichment-receipt", {
      schema_version: schemaVersion,
      uid,
      memory_id: memoryId,
      item_revision: itemRevision,
      content_hash: contentHash,
      evidence_ids: A.copy(normalizedEvidenceIds),
      account_generation: accountGeneration,
      source_generation: sourceGeneration,
      plan_hash: planHash,
    }),
  )}`;
  return (
    receiptId === expectedId &&
    uid === context.operation.uid &&
    memoryId === context.existingItem.memoryId &&
    itemRevision === context.existingItem.itemRevision &&
    contentHash === O.getOrNull(context.existingItem.contentHash) &&
    sameList(normalizedEvidenceIds, sortedIds(context.existingEvidenceIds)) &&
    accountGeneration === context.controlState.accountGeneration &&
    sourceGeneration === context.controlState.sourceGeneration &&
    planHash === plan.planHash
  );
});

/**
 * Inputs {@link validGraphEnrichmentReceipt} compares a receipt against.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface GraphEnrichmentContext {
  readonly operation: MemoryOperation;
  readonly existingItem: MemoryItem;
  readonly existingEvidenceIds: ReadonlyArray<string>;
  readonly controlState: MemoryControlState;
  readonly graphPlan: O.Option<PromotionGraphPlan>;
}

/**
 * Map a promotion document's `processing_status` onto a product processing state.
 *
 * **Details**
 *
 * `pending_processing`, `processing_failed_retryable`, and `pending_admission`
 * are pending. `processing_blocked` is blocked. `processed` is processed. Any
 * other value, including a missing document, returns the fallback.
 *
 * **Example** (Read a blocked status)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { processingStateForPromotion } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(processingStateForPromotion(O.some({ processingStatus: "processing_blocked" }), "processed")) // "blocked"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const processingStateForPromotion: {
  (fallback: MemoryItem["processingState"]): (promotion: O.Option<S.JsonObject>) => MemoryItem["processingState"];
  (promotion: O.Option<S.JsonObject>, fallback: MemoryItem["processingState"]): MemoryItem["processingState"];
} = dual(2, (promotion: O.Option<S.JsonObject>, fallback: MemoryItem["processingState"]): MemoryItem["processingState"] => {
  const status = O.getOrNull(readKey(jsonObjectOrEmpty(promotion), "processing_status", "processingStatus"));
  if (status === "pending_processing" || status === "processing_failed_retryable" || status === "pending_admission") {
    return "pending";
  }
  if (status === "processing_blocked") return "blocked";
  if (status === "processed") return "processed";
  return fallback;
});

const legalItemState = Effect.fn("MemoryApply.legalItemState")(function* (
  tier: MemoryItem["tier"],
  status: MemoryItem["status"],
  processingState: MemoryItem["processingState"],
) {
  const recordStatus = yield* physicalStatusToRecordStatus(status);
  yield* assertLegalState(tier, recordStatus, processingState);
});

/**
 * Build the first revision of a product memory from an add-style patch.
 *
 * **Details**
 *
 * Short-term items get the default 48-hour adjudication deadline; other tiers
 * get none. The item starts active. Processing state comes from the promotion
 * document, falling back to processed. The layer, status, and processing
 * combination is checked against the memory-domain matrix before the row is
 * built. `validFrom` falls back to the clock.
 *
 * **Example** (Materialize a short-term item)
 *
 * ```ts
 * import { materializeMemoryItem } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof materializeMemoryItem) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const materializeMemoryItem = Effect.fn("MemoryApply.materializeMemoryItem")(function* (input: {
  readonly uid: string;
  readonly patch: DurableMemoryPatch;
  readonly evidence: ReadonlyArray<MemoryEvidence>;
  readonly commitId: string;
  readonly sequence: number;
  readonly accountGeneration: number;
  readonly promotion: O.Option<S.JsonObject>;
}) {
  const now = yield* DateTime.now;
  const tier = input.patch.initialTier;
  const expiresAt = Equal.equals(tier, "short_term") ? now.pipe(defaultShortTermExpiry, O.some) : O.none();
  const processingState = processingStateForPromotion(input.promotion, "processed");
  yield* legalItemState(tier, "active", processingState);
  const normalizedContentKey = yield* normalizedMemoryContentKey(input.patch.memoryText);
  return MemoryItem.make({
    memoryId: deterministicMaterializedMemoryId({ uid: input.uid, patch: input.patch, commitId: input.commitId }),
    uid: input.uid,
    version: 1,
    tier,
    status: "active",
    processingState,
    content: input.patch.memoryText,
    normalizedContentKey,
    evidence: linksOf(input.evidence),
    sourceState: "active",
    sensitivityLabels: [],
    visibility: Str.isEmpty(input.patch.visibility) ? "private" : input.patch.visibility,
    userAsserted: input.patch.userAsserted,
    capturedAt: now,
    updatedAt: now,
    expiresAt,
    ledgerCommitId: O.some(input.commitId),
    ledgerSequence: O.some(input.sequence),
    itemRevision: 1,
    sourceCommitId: O.some(input.commitId),
    sourceCommitSequence: O.some(input.sequence),
    contentHash: O.some(memoryContentHash(input.patch.memoryText, input.patch.evidenceIds)),
    accountGeneration: input.accountGeneration,
    promotion: input.promotion,
    subjectEntityId: input.patch.subjectEntityId,
    predicate: input.patch.predicate,
    arguments: input.patch.arguments,
    ledgerSchemaVersion: input.patch.ledgerSchemaVersion,
    kind: input.patch.kind,
    subjectScope: input.patch.subjectScope,
    halfLifeDays: input.patch.halfLifeDays,
    beliefClass: input.patch.beliefClass,
    slot: input.patch.slot,
    body: input.patch.body,
    validFrom: O.some(O.getOrElse(input.patch.validFrom, () => now)),
    validTo: input.patch.validTo,
    curationWeight: input.patch.curationWeight,
    triggerCondition: input.patch.triggerCondition,
    intentBacked: input.patch.intentBacked,
    writeReason: input.patch.writeReason,
  });
});

const hasText = (value: O.Option<string>): boolean => O.isSome(value) && !Str.isEmpty(Str.trim(value.value));

/**
 * Preserve existing content when the patch omits or blanks `memoryText`.
 *
 * **Example** (Keep the existing content)
 *
 * ```ts
 * import { resolvedUpdateContent } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof resolvedUpdateContent) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolvedUpdateContent: {
  (patch: DurableMemoryPatch): (existing: MemoryItem) => O.Option<string>;
  (existing: MemoryItem, patch: DurableMemoryPatch): O.Option<string>;
} = dual(2, (existing: MemoryItem, patch: DurableMemoryPatch): O.Option<string> =>
  hasText(patch.memoryText) ? patch.memoryText : existing.content,
);

const encodeItem = S.encodeSync(MemoryItem);
const decodeItem = S.decodeUnknownEffect(MemoryItem);

const overlayExtras = Effect.fn("MemoryApply.overlayExtras")(function* (item: MemoryItem, extras: { readonly [key: string]: unknown }) {
  if (Rec.size(extras) === 0) return item;
  const encoded = encodeItem(item);
  return yield* decodeItem({ ...encoded, ...extras });
});

const clearedGraphFields = {
  subjectEntityId: O.none<string>(),
  predicate: O.none<string>(),
  arguments: {},
  graphReady: false,
  graphAssertionId: O.none<string>(),
  graphPlanHash: O.none<string>(),
  kgExtracted: false,
};

/**
 * Apply an update patch to an existing product memory.
 *
 * **Details**
 *
 * The update instant is the latest of the clock, `capturedAt`, and
 * `updatedAt`. The tier comes from `targetTier` or stays. Result status
 * `hidden` or `rejected` hides, `superseded` supersedes, `active` activates,
 * anything else keeps the stored status. Short-term keeps or defaults its
 * deadline; other tiers clear it. Long-term forces `processed`. Version and
 * revision bump. The content hash is recomputed only when the patch carries
 * text. Ledger fields copy over when present on the patch, extras overlay
 * through a re-decode, and `clearGraphAssertion` nulls the graph fields last.
 *
 * **Gotchas**
 *
 * Python copies ledger keys only when they are in `model_fields_set`. This
 * port copies them when the patch value is present, or, for the always-set
 * fields (`kind`, `subjectScope`, `curationWeight`, `triggerCondition`,
 * `intentBacked`), always. Extras are applied through a full re-decode, so an
 * invalid extra fails the effect instead of corrupting the row.
 *
 * **Example** (Bump the revision)
 *
 * ```ts
 * import { applyUpdateMemoryItem } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof applyUpdateMemoryItem) // "function"
 * ```
 *
 * @category transitions
 * @since 0.0.0
 */
export const applyUpdateMemoryItem = Effect.fn("MemoryApply.applyUpdateMemoryItem")(function* (input: {
  readonly existing: MemoryItem;
  readonly patch: DurableMemoryPatch;
  readonly evidence: ReadonlyArray<MemoryEvidence>;
  readonly existingEvidenceIds: ReadonlyArray<string>;
  readonly commitId: string;
  readonly sequence: number;
  readonly promotionAudit: O.Option<S.JsonObject>;
  readonly extraUpdates: { readonly [key: string]: unknown };
}) {
  const { existing, patch } = input;
  const clock = yield* DateTime.now;
  const now = clock.pipe(DateTime.max(existing.capturedAt), DateTime.max(existing.updatedAt));
  const tier = O.getOrElse(patch.targetTier, () => existing.tier);
  const content = resolvedUpdateContent(existing, patch);
  const status: MemoryItem["status"] =
    Equal.equals(patch.resultStatus, "hidden") || Equal.equals(patch.resultStatus, "rejected")
      ? "hidden"
      : Equal.equals(patch.resultStatus, "superseded")
        ? "superseded"
        : Equal.equals(patch.resultStatus, "active")
          ? "active"
          : existing.status;
  const expiresAt = Equal.equals(tier, "short_term")
    ? O.some(O.getOrElse(existing.expiresAt, () => defaultShortTermExpiry(existing.capturedAt)))
    : O.none<DateTime.Utc>();
  const processingState: MemoryItem["processingState"] = Equal.equals(tier, "long_term")
    ? "processed"
    : processingStateForPromotion(input.promotionAudit, existing.processingState);
  yield* legalItemState(tier, status, processingState);
  const evidenceIds = input.evidence.length === 0 ? input.existingEvidenceIds : evidenceIdsOf(input.evidence);
  const normalizedContentKey = yield* normalizedMemoryContentKey(content);
  const updated = MemoryItem.make({
    ...existing,
    tier,
    status,
    processingState,
    content,
    normalizedContentKey,
    evidence: input.evidence.length === 0 ? existing.evidence : linksOf(input.evidence),
    updatedAt: now,
    expiresAt,
    ledgerCommitId: O.some(input.commitId),
    ledgerSequence: O.some(input.sequence),
    version: existing.version + 1,
    itemRevision: existing.itemRevision + 1,
    contentHash: hasText(patch.memoryText) ? O.some(memoryContentHash(patch.memoryText, evidenceIds)) : existing.contentHash,
    promotion: O.isSome(input.promotionAudit) ? input.promotionAudit : existing.promotion,
    subjectEntityId: O.isSome(patch.subjectEntityId) ? patch.subjectEntityId : existing.subjectEntityId,
    predicate: O.isSome(patch.predicate) ? patch.predicate : existing.predicate,
    arguments: nonEmptyRecord(patch.arguments) ? patch.arguments : existing.arguments,
    visibility: O.getOrElse(patch.targetVisibility, () => existing.visibility),
    userAsserted: O.getOrElse(patch.targetUserAsserted, () => existing.userAsserted),
    ledgerSchemaVersion: O.isSome(patch.ledgerSchemaVersion) ? patch.ledgerSchemaVersion : existing.ledgerSchemaVersion,
    kind: patch.kind,
    subjectScope: patch.subjectScope,
    halfLifeDays: O.isSome(patch.halfLifeDays) ? patch.halfLifeDays : existing.halfLifeDays,
    beliefClass: O.isSome(patch.beliefClass) ? patch.beliefClass : existing.beliefClass,
    slot: O.isSome(patch.slot) ? patch.slot : existing.slot,
    body: O.isSome(patch.body) ? patch.body : existing.body,
    validFrom: O.isSome(patch.validFrom) ? patch.validFrom : existing.validFrom,
    validTo: O.isSome(patch.validTo) ? patch.validTo : existing.validTo,
    curationWeight: patch.curationWeight,
    triggerCondition: patch.triggerCondition,
    intentBacked: patch.intentBacked,
    writeReason: O.isSome(patch.writeReason) ? patch.writeReason : existing.writeReason,
  });
  const overlaid = yield* overlayExtras(updated, input.extraUpdates);
  return patch.clearGraphAssertion ? MemoryItem.make({ ...overlaid, ...clearedGraphFields }) : overlaid;
});

/**
 * Rewrite an operation as `stale_generation` with a fresh `updatedAt`.
 *
 * **Example** (Mark stale)
 *
 * ```ts
 * import { staleOperation } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof staleOperation) // "function"
 * ```
 *
 * @category transitions
 * @since 0.0.0
 */
export const staleOperation = Effect.fn("MemoryApply.staleOperation")(function* (operation: MemoryOperation) {
  const now = yield* DateTime.now;
  return MemoryOperation.make({ ...operation, status: "stale_generation", updatedAt: now });
});

/**
 * Digest of the patch as the operation's logical payload would express it.
 *
 * **Details**
 *
 * Always includes decision, memory text, target id, result status,
 * supersedes, and arguments. Subject, predicate, target tier, target
 * visibility, target user assertion, clear-graph, and mutation metadata are
 * included only when the operation's own logical payload already carries that
 * key. Mutation metadata is replaced by the mutation identity, not the raw
 * metadata.
 *
 * **Example** (Digest a patch)
 *
 * ```ts
 * import { operationDigestForPatch } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof operationDigestForPatch) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const operationDigestForPatch = Effect.fn("MemoryApply.operationDigestForPatch")(function* (
  patch: DurableMemoryPatch,
  operation: MemoryOperation,
  mutationIdentity: S.JsonObject,
) {
  const logical = operation.logicalPayload;
  const payload: { [key: string]: S.Json } = {
    decision: patch.decision,
    memory_text: O.getOrNull(patch.memoryText),
    target_memory_id: O.getOrNull(patch.targetMemoryId),
    result_status: patch.resultStatus,
    supersedes: A.copy(patch.supersedes),
    arguments: patch.arguments,
  };
  if (O.isSome(logical.subjectEntityId)) payload.subject_entity_id = O.getOrNull(patch.subjectEntityId);
  if (O.isSome(logical.predicate)) payload.predicate = O.getOrNull(patch.predicate);
  if (O.isSome(logical.targetTier)) payload.target_tier = O.getOrNull(patch.targetTier);
  if (O.isSome(logical.targetVisibility)) payload.target_visibility = O.getOrNull(patch.targetVisibility);
  if (O.isSome(logical.targetUserAsserted)) payload.target_user_asserted = O.getOrNull(patch.targetUserAsserted);
  if (O.isSome(logical.clearGraphAssertion)) payload.clear_graph_assertion = patch.clearGraphAssertion;
  if (O.isSome(logical.mutationMetadata)) payload.mutation_metadata = mutationIdentity;
  return yield* logicalPayloadDigest(payload);
});

const syncEventTypes: ReadonlyArray<MemoryOutboxEventType> = ["projection_sync", "vector_sync"];

/**
 * Projection and vector barrier events for a commit that changed no item.
 *
 * **Example** (Two barrier events)
 *
 * ```ts
 * import { barrierOutboxEvents } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof barrierOutboxEvents) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const barrierOutboxEvents = (input: {
  readonly operation: MemoryOperation;
  readonly controlState: MemoryControlState;
  readonly commitId: string;
  readonly sequence: number;
}): ReadonlyArray<MemoryOutboxEvent> =>
  A.map(syncEventTypes, (eventType) =>
    MemoryOutboxEvent.make({
      eventId: outboxEventId({ eventType, commitId: input.commitId, memoryId: O.none(), operationId: input.operation.operationId }),
      uid: input.operation.uid,
      eventType,
      commitId: input.commitId,
      parentCommitId: input.controlState.headCommitId,
      commitSequence: input.sequence,
      memoryId: O.none(),
      operationId: input.operation.operationId,
      accountGeneration: input.controlState.accountGeneration,
      sourceGeneration: input.controlState.sourceGeneration,
      payload: { action: "barrier" },
    }),
  );

/**
 * Parse a stored ISO timestamp string, tolerating a trailing `Z` or no offset.
 *
 * **Details**
 *
 * Returns `None` on a malformed value so the caller can drop just that one
 * field instead of letting a single drifted string abort the whole patch.
 * Logs the field name only, never the raw value, which can carry memory text.
 *
 * **Example** (Drop a malformed field)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { coerceIsoTimestamp } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(O.isNone(Effect.runSync(coerceIsoTimestamp("yesterday", "captured_at")))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const coerceIsoTimestamp = Effect.fn("MemoryApply.coerceIsoTimestamp")(function* (value: string, field: string) {
  const parsed = coercedInstant.test(value) ? DateTime.make(stampUtc(value)) : O.none<DateTime.Utc>();
  if (O.isNone(parsed)) {
    yield* Effect.logWarning(`Dropping malformed timestamp field ${field} in long-term memory patch`);
    return O.none<DateTime.Utc>();
  }
  return parsed.value.pipe(DateTime.toUtc, O.some);
});

const extraItemKeys: ReadonlyArray<readonly [string, string]> = [
  ["corroboration_count", "corroborationCount"],
  ["last_corroborated_at", "lastCorroboratedAt"],
  ["half_life_days", "halfLifeDays"],
  ["belief_class", "beliefClass"],
  ["captured_at", "capturedAt"],
  ["updated_at", "updatedAt"],
  ["expires_at", "expiresAt"],
  ["superseded_by", "supersededBy"],
  ["kg_extracted", "kgExtracted"],
  ["confidence", "confidence"],
  ["sensitivity_labels", "sensitivityLabels"],
  ["capture_device_ids", "captureDeviceIds"],
  ["primary_capture_device", "primaryCaptureDevice"],
];

const extraTimestampKeys: ReadonlyArray<string> = ["lastCorroboratedAt", "capturedAt", "updatedAt", "expiresAt"];

const takeKey = (
  record: S.JsonObject,
  snake: string,
  camel: string,
): readonly [O.Option<unknown>, S.JsonObject] => [
  readKey(record, snake, camel),
  Rec.filter(record, (_, key) => key !== snake && key !== camel),
];

const requiredPatchKeys = HashSet.make(
  "patchId",
  "packetId",
  "runId",
  "idempotencyKey",
  "decision",
  "resultStatus",
  "observedHeadCommitId",
);

/**
 * Wire values of every defaulted patch field.
 *
 * Python's `DurableMemoryPatch(**raw)` fills a missing key from the field
 * default. The port's decode requires the key, so the transaction spreads
 * these encoded defaults under the caller's payload before decoding. Required
 * keys are removed so a missing required key still fails.
 */
const patchWireDefaults: { readonly [key: string]: unknown } = Rec.filter(
  recordOf(S.encodeSync(DurableMemoryPatch)(
    DurableMemoryPatch.make({
      patchId: "x",
      packetId: "x",
      runId: "x",
      idempotencyKey: "x",
      decision: "add",
      resultStatus: "working",
      observedHeadCommitId: O.none(),
    })),
  ),
  (_, key) => !HashSet.has(requiredPatchKeys, key),
);

const requiredEvidenceKeys = HashSet.make("evidenceId", "sourceType", "artifactPreservation");

const evidenceWireDefaults: { readonly [key: string]: unknown } = Rec.filter(
  recordOf(S.encodeSync(MemoryEvidence)(MemoryEvidence.make({ evidenceId: "x", sourceType: "x", artifactPreservation: "preserved" }))),
  (_, key) => !HashSet.has(requiredEvidenceKeys, key),
);

const withWireDefaults = (defaults: { readonly [key: string]: unknown }, row: unknown): unknown =>
  P.isObject(row) && !A.isArray(row) ? { ...defaults, ...row } : row;

const decodeEvidenceRowsRaw = S.decodeUnknownEffect(S.Array(MemoryEvidence));
const decodeEvidenceRows = (rows: ReadonlyArray<unknown>) =>
  decodeEvidenceRowsRaw(A.map(rows, (row) => withWireDefaults(evidenceWireDefaults, row)));
const requiredItemKeys = HashSet.make(
  "memoryId",
  "uid",
  "version",
  "tier",
  "status",
  "processingState",
  "content",
  "sourceState",
  "sensitivityLabels",
  "visibility",
  "userAsserted",
  "capturedAt",
  "updatedAt",
);

const itemWireDefaults: { readonly [key: string]: unknown } = Rec.filter(
  recordOf(encodeItem(
    MemoryItem.make({
      memoryId: "x",
      uid: "x",
      version: 1,
      tier: "short_term",
      status: "active",
      processingState: "processed",
      content: O.none(),
      sourceState: "active",
      sensitivityLabels: [],
      visibility: "private",
      userAsserted: false,
      capturedAt: DateTime.makeUnsafe(0),
      updatedAt: DateTime.makeUnsafe(0),
    })),
  ),
  (_, key) => !HashSet.has(requiredItemKeys, key),
);

const decodeItemRow = (row: unknown) => decodeItem(withWireDefaults(itemWireDefaults, row));
const decodeItemsRaw = S.decodeUnknownEffect(S.Array(MemoryItem));
const decodeItems = (rows: ReadonlyArray<unknown>) =>
  decodeItemsRaw(A.map(rows, (row) => withWireDefaults(itemWireDefaults, row)));
const decodePatchRaw = S.decodeUnknownEffect(CheckedDurableMemoryPatch);
const decodePatch = (raw: S.JsonObject) => decodePatchRaw({ ...patchWireDefaults, ...raw });
const decodeGraphPlan = S.decodeUnknownOption(PromotionGraphPlan);

const graphPlanFromJson = (raw: unknown): O.Option<PromotionGraphPlan> =>
  O.flatMap(decodeGraphPlan(raw), (plan) => Result.getSuccess(derivePromotionGraphPlan(plan)));

const syntheticEvidence = (evidenceId: string): MemoryEvidence =>
  MemoryEvidence.make({
    evidenceId,
    sourceType: "unknown",
    sourceId: O.some(`source_for_${evidenceId}`),
    sourceVersion: O.some("unknown"),
    artifactPreservation: "preserved",
  });

const stringsOf = (value: O.Option<unknown>): ReadonlyArray<string> =>
  O.match(value, {
    onNone: () => A.empty<string>(),
    onSome: (json) => (A.isArray(json) ? A.filter(json, P.isString) : A.empty<string>()),
  });

const rejected = (
  status: ApplyStatus,
  controlState: MemoryControlState,
  operation: MemoryOperation,
  reason: string,
): ApplyResult => ApplyResult.make({ status, controlState, operation, reason: O.some(reason) });

/**
 * Pure transaction skeleton for Milestone 3.
 *
 * **Details**
 *
 * Production Firestore integration must perform these reads and writes
 * atomically: control head and generations, operation journal status, memory
 * item mutation, and outbox append. This program does none of the I/O. It
 * validates the patch against the operation, fences on generations and the
 * observed head, allocates the next commit, mutates or materializes the
 * product memory, refreshes the graph assertion when a long-term item needs
 * one, supersedes targets, appends outbox rows, and marks the operation
 * committed. Every rejected path returns the caller's original control state.
 *
 * The payload is the durable patch plus these apply-only keys: `existingItem`,
 * `existingEvidenceIds`, `supersededItems`, `promotionAudit`, `promotion`,
 * `expectedItemRevision`, `expectedContentHash`, `evidence`, and the extra item
 * overrides (`corroborationCount`, `lastCorroboratedAt`, `halfLifeDays`,
 * `beliefClass`, `capturedAt`, `updatedAt`, `expiresAt`, `supersededBy`,
 * `kgExtracted`, `confidence`, `sensitivityLabels`, `captureDeviceIds`,
 * `primaryCaptureDevice`). Malformed extra timestamps are dropped with a
 * warning; a non-numeric `confidence` is dropped.
 *
 * **Gotchas**
 *
 * `existingEvidenceIds` has no Python counterpart: the product
 * {@link MemoryItem} of this port embeds evidence links without an evidence id,
 * so the caller supplies the existing item's evidence ids beside it. A patch
 * that fails to decode returns `invalid_patch` with the error tag as the
 * reason. An existing or superseded item that fails to decode fails the
 * effect, as Python would raise. The advanced head is discarded on every
 * rejection after allocation, exactly as Python discards `next_control`.
 *
 * **Example** (Reject a patch whose evidence differs from the operation)
 *
 * ```ts
 * import { applyLongTermPatchTransaction } from "@beep/scratchpad/beep/MemoryApply.ts"
 *
 * console.log(typeof applyLongTermPatchTransaction) // "function"
 * ```
 *
 * @category transactions
 * @since 0.0.0
 */
export const applyLongTermPatchTransaction = Effect.fn("MemoryApply.applyLongTermPatchTransaction")(function* (input: {
  readonly controlState: MemoryControlState;
  readonly operation: MemoryOperation;
  readonly patchPayload: S.JsonObject;
  readonly allowTriggerFeedbackArguments?: boolean;
}) {
  const { controlState, operation } = input;
  const allowTriggerFeedbackArguments = input.allowTriggerFeedbackArguments ?? false;
  const mutationIdentity = buildPatchMutationIdentity(input.patchPayload);
  let raw = input.patchPayload;
  const pop = (snake: string, camel: string): O.Option<unknown> => {
    const [value, rest] = takeKey(raw, snake, camel);
    raw = rest;
    return value;
  };
  const existingItemRaw = pop("existing_item", "existingItem");
  const existingEvidenceIds = stringsOf(pop("existing_evidence_ids", "existingEvidenceIds"));
  const supersededItemsRaw = pop("superseded_items", "supersededItems");
  const promotionAudit = O.flatMap(pop("promotion_audit", "promotionAudit"), asJsonObject);
  const promotionMetadata = O.flatMap(pop("promotion", "promotion"), asJsonObject);
  const expectedItemRevision = pop("expected_item_revision", "expectedItemRevision");
  const expectedContentHash = pop("expected_content_hash", "expectedContentHash");

  let extraItemUpdates: { [key: string]: unknown } = {};
  for (const [snake, camel] of extraItemKeys) {
    const value = pop(snake, camel);
    if (O.isSome(value)) extraItemUpdates = { ...extraItemUpdates, [camel]: value.value };
  }
  for (const key of extraTimestampKeys) {
    const value = Rec.get(extraItemUpdates, key);
    if (O.isSome(value) && P.isString(value.value)) {
      const coerced = yield* coerceIsoTimestamp(value.value, key);
      extraItemUpdates = O.match(coerced, {
        onNone: () => Rec.remove(extraItemUpdates, key),
        onSome: (instant) => ({ ...extraItemUpdates, [key]: DateTime.formatIso(instant) }),
      });
    }
  }
  const confidence = Rec.get(extraItemUpdates, "confidence");
  if (O.isSome(confidence) && !P.isNull(confidence.value) && !P.isNumber(confidence.value)) {
    extraItemUpdates = Rec.remove(extraItemUpdates, "confidence");
  }

  const evidenceRaw = pop("evidence", "evidence");
  const synthesized = readKey(raw, "evidence_ids", "evidenceIds").pipe(stringsOf, A.map(syntheticEvidence));
  const evidence: ReadonlyArray<MemoryEvidence> = yield* O.match(evidenceRaw, {
    onNone: () => Effect.succeed(synthesized),
    onSome: (rows) => (A.isArray(rows) && rows.length > 0 ? decodeEvidenceRows(rows) : Effect.succeed(synthesized)),
  });

  const patchResult = yield* Effect.result(decodePatch(raw));
  if (patchResult._tag === "Failure") {
    return rejected("invalid_patch", controlState, operation, patchResult.failure._tag);
  }
  const patch = patchResult.success;

  if (!sameList(patch.evidenceIds, operation.evidenceIds)) {
    return rejected("payload_mismatch", controlState, operation, "patch evidence_ids do not match operation evidence_ids");
  }
  const ledgerPatch = O.getOrNull(patch.ledgerSchemaVersion) === "knowledge_ledger.v1";
  if (ledgerPatch && !Equal.equals(operation.operationType, "ledger_mutation")) {
    return rejected("invalid_patch", controlState, operation, "knowledge ledger writes require ledger_mutation authority");
  }
  const digest = yield* operationDigestForPatch(patch, operation, mutationIdentity);
  if (digest !== operation.logicalPayloadDigest) {
    return rejected("payload_mismatch", controlState, operation, "patch digest does not match operation logical payload digest");
  }
  if (Equal.equals(operation.status, "committed")) {
    return ApplyResult.make({ status: "idempotent_skip", controlState, operation });
  }
  if (operation.accountGeneration !== controlState.accountGeneration || operation.sourceGeneration !== controlState.sourceGeneration) {
    return rejected("generation_mismatch", controlState, yield* staleOperation(operation), "operation generation does not match control state");
  }
  if (hasText(operation.observedHeadCommitId) && O.getOrNull(operation.observedHeadCommitId) !== controlState.headCommitId) {
    const now = yield* DateTime.now;
    const rebased = MemoryOperation.make({
      ...operation,
      observedHeadCommitId: O.some(controlState.headCommitId),
      attemptCount: operation.attemptCount + 1,
      updatedAt: now,
    });
    return rejected("retryable_head_mismatch", controlState, rebased, "observed head does not match current head");
  }
  const graphEnrichmentOperation = Equal.equals(operation.operationType, "graph_enrichment");
  if (graphEnrichmentOperation && !Equal.equals(patch.decision, "update")) {
    return rejected("invalid_patch", controlState, operation, "graph enrichment requires an update decision");
  }
  if (A.some(evidence, (row) => !Equal.equals(row.sourceState, "active"))) {
    return rejected("source_not_active", controlState, operation, "cannot apply memory patch from deleted/purged source evidence");
  }

  const commitId = nextCommitId(controlState, operation.operationId);
  const nextControl = yield* advanceHead(controlState, commitId);
  const sequence = nextControl.commitSequence;
  const now = yield* DateTime.now;

  if (Equal.equals(patch.decision, "skip_duplicate")) {
    const outboxEvents = barrierOutboxEvents({ operation, controlState, commitId, sequence });
    const committed = yield* markOperationCommitted(
      operation,
      commitId,
      sequence,
      now,
      [],
      A.map(outboxEvents, (event) => event.eventId),
    );
    return ApplyResult.make({ status: "committed", controlState: nextControl, operation: committed, outboxEvents });
  }

  let transitioningToLongTerm = false;
  let graphEnrichment = false;
  let memoryItem: MemoryItem;
  let appliedEvidenceIds: ReadonlyArray<string>;
  if (Equal.equals(patch.decision, "update")) {
    if (O.isNone(existingItemRaw)) {
      return rejected("invalid_patch", controlState, operation, "update patch requires authoritative existing_item");
    }
    const existingItem = yield* decodeItemRow(existingItemRaw.value);
    if (!hasText(patch.targetMemoryId) || O.getOrNull(patch.targetMemoryId) !== existingItem.memoryId) {
      return rejected("invalid_patch", controlState, operation, "update patch target_memory_id mismatch");
    }
    if (O.isSome(expectedItemRevision) && !P.isNull(expectedItemRevision.value) && existingItem.itemRevision !== expectedItemRevision.value) {
      return rejected("invalid_patch", controlState, operation, "update patch expected_item_revision mismatch");
    }
    if (
      O.isSome(expectedContentHash) &&
      !P.isNull(expectedContentHash.value) &&
      O.getOrNull(existingItem.contentHash) !== expectedContentHash.value
    ) {
      return rejected("invalid_patch", controlState, operation, "update patch expected_content_hash mismatch");
    }
    const existingPromotion = promotionOf(existingItem);
    const proposedEvidenceIds = evidence.length === 0 ? existingEvidenceIds : evidenceIdsOf(evidence);
    graphEnrichment = graphEnrichmentOperation;
    if (graphEnrichment) {
      const audit = jsonObjectOrEmpty(promotionAudit);
      const graphPlan = O.flatMap(readKey(audit, "graph_plan", "graphPlan"), graphPlanFromJson);
      const rawReceipt = O.getOrNull(readKey(audit, "graph_enrichment_receipt", "graphEnrichmentReceipt"));
      const requiredReceiptValid =
        !pyTruthy(readKey(existingPromotion, "required", "required")) ||
        validRequiredProcessingReceipt({
          content: O.getOrElse(existingItem.content, () => ""),
          itemRevision: existingItem.itemRevision,
          promotion: existingPromotion,
        });
      const replan = existingItem.graphReady && pyTruthy(readKey(existingPromotion, "graph_enrichment", "graphEnrichment"));
      const planOk =
        O.isSome(graphPlan) &&
        validGraphEnrichmentReceipt(rawReceipt, { operation, existingItem, existingEvidenceIds, controlState, graphPlan }) &&
        O.getOrNull(patch.subjectEntityId) === graphPlan.value.subjectEntityId &&
        (replan || !hasText(existingItem.subjectEntityId) || graphPlan.value.subjectEntityId === O.getOrNull(existingItem.subjectEntityId)) &&
        O.getOrNull(patch.predicate) === graphPlan.value.predicate &&
        (replan || !hasText(existingItem.predicate) || graphPlan.value.predicate === O.getOrNull(existingItem.predicate)) &&
        graphPredicate.test(graphPlan.value.predicate) &&
        sameJson(patch.arguments, graphPlan.value.arguments) &&
        (replan || !nonEmptyRecord(existingItem.arguments) || sameJson(graphPlan.value.arguments, existingItem.arguments));
      const unchanged =
        O.isNone(patch.targetTier) &&
        O.isNone(patch.memoryText) &&
        O.isNone(patch.targetVisibility) &&
        O.isNone(patch.targetUserAsserted) &&
        !patch.clearGraphAssertion &&
        Rec.size(extraItemUpdates) === 0 &&
        O.isNone(promotionMetadata) &&
        Equal.equals(patch.resultStatus, "active") &&
        patch.supersedes.length === 0;
      if (
        !(
          Equal.equals(existingItem.status, "active") &&
          Equal.equals(existingItem.tier, "long_term") &&
          Equal.equals(existingItem.processingState, "processed") &&
          (!existingItem.graphReady || replan) &&
          planOk &&
          requiredReceiptValid &&
          !hasRestrictedSensitivity(existingItem.sensitivityLabels) &&
          userReviewNotFalse(existingPromotion) &&
          unchanged &&
          sameList(sortedIds(evidenceIdsOf(evidence)), sortedIds(existingEvidenceIds))
        )
      ) {
        return rejected(
          "invalid_patch",
          controlState,
          operation,
          "graph enrichment must attach one validated plan without changing Long-term semantics",
        );
      }
    }
    if (Equal.equals(existingItem.tier, "long_term") && Equal.equals(existingItem.status, "active")) {
      const semanticChange =
        !Equal.equals(resolvedUpdateContent(existingItem, patch), existingItem.content) ||
        !sameList(proposedEvidenceIds, existingEvidenceIds) ||
        O.getOrNull(O.orElse(patch.subjectEntityId, () => existingItem.subjectEntityId)) !== O.getOrNull(existingItem.subjectEntityId) ||
        O.getOrNull(O.orElse(patch.predicate, () => existingItem.predicate)) !== O.getOrNull(existingItem.predicate) ||
        !sameJson(nonEmptyRecord(patch.arguments) ? patch.arguments : existingItem.arguments, existingItem.arguments);
      const explicitShortTermDemotion = Equal.equals(O.getOrNull(patch.targetTier), "short_term") && patch.clearGraphAssertion;
      if (semanticChange && !explicitShortTermDemotion && !graphEnrichment && !allowTriggerFeedbackArguments) {
        return rejected(
          "invalid_patch",
          controlState,
          operation,
          "Long-term semantics are immutable; promote a new Short-term item and supersede this one",
        );
      }
    }
    transitioningToLongTerm = !Equal.equals(existingItem.tier, "long_term") && Equal.equals(O.getOrNull(patch.targetTier), "long_term");
    if (transitioningToLongTerm) {
      const admission = jsonObjectOrEmpty(promotionAudit);
      const proposedContent = O.getOrElse(resolvedUpdateContent(existingItem, patch), () => "");
      const proposedContentHash = memoryContentHash(O.some(proposedContent), proposedEvidenceIds);
      if (
        pyTruthy(readKey(admission, "required", "required")) &&
        !validRequiredProcessingReceipt({ content: proposedContent, itemRevision: existingItem.itemRevision, promotion: admission })
      ) {
        return rejected("invalid_patch", controlState, operation, "required durable memory is missing processing receipt");
      }
      const admitted = validPromotionAdmission({
        memoryId: existingItem.memoryId,
        sourceItemRevision: existingItem.itemRevision,
        outputContentHash: proposedContentHash,
        evidenceIds: proposedEvidenceIds,
        subjectEntityId: O.orElse(patch.subjectEntityId, () => existingItem.subjectEntityId),
        predicate: O.orElse(patch.predicate, () => existingItem.predicate),
        arguments: nonEmptyRecord(patch.arguments) ? patch.arguments : existingItem.arguments,
        supersedes: patch.supersedes,
        promotion: admission,
      });
      if (!admitted || !Equal.equals(operation.operationType, "synthesis")) {
        return rejected(
          "invalid_patch",
          controlState,
          operation,
          "Short-term to Long-term transition requires a current promotion admission and graph plan",
        );
      }
    }
    memoryItem = yield* applyUpdateMemoryItem({
      existing: existingItem,
      patch,
      evidence,
      existingEvidenceIds,
      commitId,
      sequence,
      promotionAudit,
      extraUpdates: extraItemUpdates,
    });
    appliedEvidenceIds = proposedEvidenceIds;
  } else {
    const materialized = yield* materializeMemoryItem({
      uid: operation.uid,
      patch,
      evidence,
      commitId,
      sequence,
      accountGeneration: controlState.accountGeneration,
      promotion: promotionMetadata,
    });
    memoryItem = yield* overlayExtras(materialized, extraItemUpdates);
    appliedEvidenceIds = evidenceIdsOf(evidence);
  }

  let memoryItems: ReadonlyArray<MemoryItem> = [memoryItem];
  let graphAssertions: ReadonlyArray<MemoryGraphAssertion> = [];
  const refreshGraphAssertion =
    transitioningToLongTerm ||
    graphEnrichment ||
    (Equal.equals(memoryItem.tier, "long_term") &&
      Equal.equals(memoryItem.status, "active") &&
      memoryItem.graphReady &&
      !patch.clearGraphAssertion);
  if (refreshGraphAssertion) {
    const rawGraphPlan = readKey(promotionOf(memoryItem), "graph_plan", "graphPlan");
    if (O.isNone(rawGraphPlan) || !isJsonObject(rawGraphPlan.value)) {
      return rejected("invalid_patch", controlState, operation, "active graph-backed Long-term update requires its stored graph plan");
    }
    const graphPlan = graphPlanFromJson(rawGraphPlan.value);
    if (O.isNone(graphPlan)) {
      return rejected("invalid_patch", controlState, operation, "active graph-backed Long-term update has an invalid stored graph plan");
    }
    const assertion = yield* Effect.fromResult(
      buildMemoryGraphAssertion({
      uid: operation.uid,
      memoryId: memoryItem.memoryId,
      itemRevision: memoryItem.itemRevision,
      contentHash: O.getOrElse(memoryItem.contentHash, () => ""),
      evidenceIds: appliedEvidenceIds,
      graphPlan: graphPlan.value,
      commitId,
        commitSequence: sequence,
        createdAt: memoryItem.updatedAt,
      }),
    );
    memoryItem = MemoryItem.make({
      ...memoryItem,
      graphReady: true,
      graphAssertionId: O.some(assertion.assertionId),
      graphPlanHash: O.some(graphPlan.value.planHash),
      kgExtracted: true,
    });
    memoryItems = [memoryItem];
    graphAssertions = [assertion];
  }

  if (A.isReadonlyArrayNonEmpty(patch.supersedes)) {
    if (O.isNone(supersededItemsRaw) || !A.isArray(supersededItemsRaw.value)) {
      return rejected("invalid_patch", controlState, operation, "superseding promotion requires authoritative superseded_items");
    }
    const supersededItems = yield* decodeItems(supersededItemsRaw.value);
    const supersededById = HashMap.fromIterable(A.map(supersededItems, (item) => [item.memoryId, item] as const));
    const supersededIds = HashSet.fromIterable(A.map(supersededItems, (item) => item.memoryId));
    if (!Equal.equals(supersededIds, HashSet.fromIterable(patch.supersedes))) {
      return rejected("invalid_patch", controlState, operation, "superseded_items do not match patch supersedes");
    }
    for (const supersededId of patch.supersedes) {
      const found = HashMap.get(supersededById, supersededId);
      if (O.isNone(found)) {
        return rejected("invalid_patch", controlState, operation, "superseded_items do not match patch supersedes");
      }
      const existingSuperseded = found.value;
      if (!Equal.equals(existingSuperseded.status, "active")) {
        return rejected("target_not_active", controlState, operation, `superseded target is not active: ${supersededId}`);
      }
      if (ledgerPatch) {
        if (O.getOrNull(existingSuperseded.ledgerSchemaVersion) !== "knowledge_ledger.v1") {
          return rejected("invalid_patch", controlState, operation, "knowledge ledger amendment may supersede only ledger rows");
        }
        if (
          !Equal.equals(existingSuperseded.kind, patch.kind) ||
          !Equal.equals(existingSuperseded.subjectScope, patch.subjectScope) ||
          O.getOrNull(existingSuperseded.subjectEntityId) !== O.getOrNull(patch.subjectEntityId)
        ) {
          return rejected("invalid_patch", controlState, operation, "knowledge ledger amendment must preserve kind and subject identity");
        }
      }
      let supersededAt = DateTime.max(now, existingSuperseded.updatedAt);
      if (ledgerPatch) {
        supersededAt = supersededAt.pipe(
          DateTime.max(O.getOrElse(memoryItem.validFrom, () => memoryItem.capturedAt)),
          DateTime.max(O.getOrElse(existingSuperseded.validFrom, () => existingSuperseded.capturedAt)),
        );
      }
      memoryItems = A.append(
        memoryItems,
        MemoryItem.make({
          ...existingSuperseded,
          canonicalMemoryId: O.some(memoryItem.memoryId),
          status: "superseded",
          supersededBy: O.some(memoryItem.memoryId),
          updatedAt: supersededAt,
          validTo: ledgerPatch ? O.some(supersededAt) : existingSuperseded.validTo,
          ledgerCommitId: O.some(commitId),
          ledgerSequence: O.some(sequence),
          version: existingSuperseded.version + 1,
          itemRevision: existingSuperseded.itemRevision + 1,
          graphReady: false,
          graphAssertionId: O.none(),
          graphPlanHash: O.none(),
          kgExtracted: false,
        }),
      );
    }
  }

  const outboxEvents = A.flatMap(memoryItems, (changed) => {
    const eligible =
      Equal.equals(changed.status, "active") &&
      Equal.equals(changed.processingState, "processed") &&
      (Equal.equals(changed.tier, "short_term") || Equal.equals(changed.tier, "long_term")) &&
      userReviewNotFalse(promotionOf(changed)) &&
      !hasRestrictedSensitivity(changed.sensitivityLabels);
    return A.map(syncEventTypes, (eventType) =>
      MemoryOutboxEvent.make({
        eventId: outboxEventId({ eventType, commitId, memoryId: O.some(changed.memoryId), operationId: operation.operationId }),
        uid: operation.uid,
        eventType,
        commitId,
        parentCommitId: controlState.headCommitId,
        commitSequence: sequence,
        memoryId: O.some(changed.memoryId),
        operationId: operation.operationId,
        accountGeneration: controlState.accountGeneration,
        sourceGeneration: controlState.sourceGeneration,
        payload: {
          memory_id: changed.memoryId,
          tier: changed.tier,
          action: eligible ? "upsert" : "delete",
          item_revision: changed.itemRevision,
          content_hash: O.getOrNull(changed.contentHash),
        },
      }),
    );
  });
  const committed = yield* markOperationCommitted(
    operation,
    commitId,
    sequence,
    now,
    A.map(memoryItems, (item) => item.memoryId),
    A.map(outboxEvents, (event) => event.eventId),
  );
  return ApplyResult.make({
    status: "committed",
    controlState: nextControl,
    operation: committed,
    memoryItems,
    graphAssertions,
    outboxEvents,
  });
});
