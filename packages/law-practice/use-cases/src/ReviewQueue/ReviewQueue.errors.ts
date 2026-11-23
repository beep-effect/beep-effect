/**
 * Typed failures of the review queue and its verdict-log store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ReviewBatchId } from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { DefectCause } from "../internal/DefectCause.ts";

const $I = $LawPracticeUseCasesId.create("ReviewQueue/ReviewQueue.errors");

/**
 * **Details**
 *
 * Raised by every write to a locked batch: a verdict for any item, an undo,
 * and a second lock. `lockedAt` is the `lockedAt` of the row that closed the
 * batch. Writes under a different `batchId` are unaffected.
 *
 * **Example** (Report a write to a locked batch)
 *
 * ```ts
 * import { VerdictBatchLockedError } from "@beep/law-practice-use-cases/ReviewQueue"
 * import * as DateTime from "effect/DateTime"
 *
 * const error = VerdictBatchLockedError.make({
 *   batchId: "sitting-2026-10-14",
 *   lockedAt: DateTime.makeUnsafe(1_760_400_000_000),
 * })
 * console.log(error._tag) // "VerdictBatchLockedError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VerdictBatchLockedError extends S.TaggedError<VerdictBatchLockedError, { readonly brand: unique symbol }>(
  $I`VerdictBatchLockedError`
)(
  "VerdictBatchLockedError",
  {
    batchId: ReviewBatchId.annotateKey({
      description: "Locked batch the write targeted.",
    }),
    lockedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "When the batch was locked, from the closing row's lockedAt.",
    }),
  },
  $I.annoteError<VerdictBatchLockedError>("VerdictBatchLockedError", {
    title: "Review batch locked",
    description: "A write targeted a review batch that a lock row has already closed.",
  })
) {}

/**
 * **Details**
 *
 * The lock is carried on a copy of the batch's latest row, so a batch with no
 * rows has nothing to carry it. Record at least one verdict first.
 *
 * **Example** (Report a lock of an empty batch)
 *
 * ```ts
 * import { VerdictBatchEmptyError } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * const error = VerdictBatchEmptyError.make({ batchId: "sitting-2026-10-14" })
 * console.log(error.batchId) // "sitting-2026-10-14"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VerdictBatchEmptyError extends S.TaggedError<VerdictBatchEmptyError, { readonly brand: unique symbol }>(
  $I`VerdictBatchEmptyError`
)(
  "VerdictBatchEmptyError",
  {
    batchId: ReviewBatchId.annotateKey({
      description: "Batch the lock targeted; it has no verdict rows.",
    }),
  },
  $I.annoteError<VerdictBatchEmptyError>("VerdictBatchEmptyError", {
    title: "Review batch empty",
    description: "A lock targeted a review batch that has no verdict rows to carry it.",
  })
) {}

const VerdictLogOperationBase = LiteralKit(["read", "append"]);

/**
 * **Example** (Guard a store operation)
 *
 * ```ts
 * import { VerdictLogOperation } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * console.log(VerdictLogOperation.is.append("append")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VerdictLogOperation = VerdictLogOperationBase.pipe(
  $I.annoteSchema("VerdictLogOperation", {
    description: "Verdict-log store operation that failed: reading the rows or appending one.",
  }),
  SchemaUtils.withLiteralKitStatics(VerdictLogOperationBase)
);

/**
 * @see {@link VerdictLogOperation} for the operation names.
 * @category errors
 * @since 0.0.0
 */
export type VerdictLogOperation = typeof VerdictLogOperation.Type;

/**
 * **Details**
 *
 * A store that cannot answer fails with this error rather than returning an
 * empty log: an unreadable log would otherwise show every item as open and
 * every batch as unlocked. After a failed `append` the row may or may not be
 * stored; read the log before writing again. `reason` holds ids, counts and
 * status text only, never verdict notes.
 *
 * **Example** (Report a failed append)
 *
 * ```ts
 * import { VerdictLogError } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * const error = VerdictLogError.make({ operation: "append", reason: "log file not writable" })
 * console.log(error.operation) // "append"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VerdictLogError extends S.TaggedError<VerdictLogError, { readonly brand: unique symbol }>(
  $I`VerdictLogError`
)(
  "VerdictLogError",
  {
    cause: DefectCause.annotateKey({
      description: "Optional underlying store defect.",
    }),
    operation: VerdictLogOperation.annotateKey({
      description: "Store operation that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Diagnostic made of ids, counts and status text only; never verdict notes.",
    }),
  },
  $I.annoteError<VerdictLogError>("VerdictLogError", {
    title: "Verdict log unavailable",
    description: "The verdict-log store could not read its rows or append one.",
  })
) {}
