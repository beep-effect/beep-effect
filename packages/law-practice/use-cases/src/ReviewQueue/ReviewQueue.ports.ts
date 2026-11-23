/**
 * Review queue contracts: the verdict-log store port and the queue service
 * that records, undoes and locks the attorney's verdicts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ReviewBatchId, ReviewItemId, Verdict } from "@beep/law-practice-domain";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { ReviewItem, VerdictRow } from "@beep/law-practice-domain";
import type { VerdictBatchEmptyError, VerdictBatchLockedError, VerdictLogError } from "./ReviewQueue.errors.ts";

const $I = $LawPracticeUseCasesId.create("ReviewQueue/ReviewQueue.ports");

/**
 * Port shape: the append-only store behind the verdict log.
 *
 * **Details**
 *
 * The store has no policy: it does not compute revisions, check locks or
 * order rows by time. It appends what it is given and reads back every row in
 * append order. There is no update and no delete.
 *
 * **Gotchas**
 *
 * The queue reads the log, checks the lock, then appends, and it serializes
 * those steps for its own writes within one process. Writers in separate
 * processes sharing one durable store can still both pass the lock check or
 * both compute the same revision, so only cross-process writers need
 * adapter-level serialization. Append-only rows mean such a race never loses
 * a verdict, only duplicates a revision number.
 *
 * **Example** (Name a store method)
 *
 * ```ts
 * import type { VerdictLogShape } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * const method: keyof VerdictLogShape = "append"
 * console.log(method) // "append"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface VerdictLogShape {
  /** Append one row to the end of the log. A failure may or may not have stored it. */
  readonly append: (row: VerdictRow) => Effect.Effect<void, VerdictLogError>;
  /** Every stored row, in append order. Empty only when the store answered and holds no rows. */
  readonly rows: Effect.Effect<ReadonlyArray<VerdictRow>, VerdictLogError>;
}

/**
 * Port: the append-only store behind the verdict log.
 *
 * **Details**
 *
 * Tests use the in-memory layer that ships with the queue implementation. The
 * durable JSONL store belongs to the `practice-claude-mod` plugin and
 * satisfies this same shape.
 *
 * **Example** (Reference the store port)
 *
 * ```ts
 * import { VerdictLog } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * console.log(VerdictLog.key)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class VerdictLog extends Context.Service<VerdictLog, VerdictLogShape>()($I`VerdictLog`) {}

/**
 * **Details**
 *
 * The queue fills in the rest of the row: `revision` and `recordedAt`.
 * `note` decodes from an optional key and defaults to `Option.none()` on
 * construction.
 *
 * **Example** (Build a verdict submission)
 *
 * ```ts
 * import { RecordVerdictInput } from "@beep/law-practice-use-cases/ReviewQueue"
 * import * as O from "effect/Option"
 *
 * const input = RecordVerdictInput.make({
 *   itemId: "claim-finding:1",
 *   batchId: "sitting-2026-10-14",
 *   verdict: "wrong",
 *   note: O.some("The reference shows a latch, not a hinge."),
 * })
 *
 * console.log(input.verdict) // "wrong"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecordVerdictInput extends S.Opaque<RecordVerdictInput, { readonly brand: unique symbol }>()(
  S.Struct({
    itemId: ReviewItemId.annotateKey({
      description: "Review item the verdict judges.",
    }),
    batchId: ReviewBatchId.annotateKey({
      description: "Review batch (sitting or queue run) the verdict is recorded in.",
    }),
    verdict: Verdict.annotateKey({
      description: "The attorney's judgement.",
    }),
    note: S.NonEmptyString.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Optional note the attorney typed with the verdict.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RecordVerdictInput", {
      description: "The attorney's verdict on one review item, before the queue assigns its revision and timestamp.",
    })
  )
) {}

/**
 * **Example** (Type an encoded verdict submission)
 *
 * ```ts
 * import type { RecordVerdictInput } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * const verdict: RecordVerdictInput.Encoded["verdict"] = "partly"
 * console.log(verdict) // "partly"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RecordVerdictInput {
  /**
   * Wire-encoded representation of a decoded {@link RecordVerdictInput}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { RecordVerdictInput } from "@beep/law-practice-use-cases/ReviewQueue"
   *
   * type Wire = RecordVerdictInput.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RecordVerdictInput.Encoded;
}

/**
 * Service shape of the review queue.
 *
 * **Details**
 *
 * Every write appends a row through {@link VerdictLog}; nothing edits or
 * deletes one.
 *
 * - **Latest verdict.** An item's latest verdict is its row with the greatest
 *   `recordedAt` across every batch; ties go to the row appended last, since
 *   rows are read in append order. Revisions never break ties: they count per
 *   item within one batch, and a later revision is always appended later. A latest verdict of `right` or `wrong` is final; `partly`
 *   and `withdrawn` are not, and `withdrawn` leaves the item with no current
 *   judgement.
 * - **Revisions.** Revisions count per item within one batch. A verdict is
 *   recorded with one more than the highest revision of that item in that
 *   batch, or 1 when the batch has no row for the item.
 * - **Undo.** Undo is the attorney's next verdict for the same item in the
 *   same batch: it appends a superseding revision and the earlier row stays
 *   in the log.
 * - **Lock.** A batch is locked once any of its rows carries `lockedAt`.
 *   Locking appends a copy of the batch's latest row (greatest `recordedAt`,
 *   then append order) with `revision` one higher, the same `itemId`, `verdict`,
 *   `note` and `recordedAt`, and `lockedAt` read from the clock. Verdict
 *   selection skips lock rows, so locking never changes any item's verdict or
 *   projection, even when `recordedAt` ties across batches. After that every write to the batch, a second lock included,
 *   fails with `VerdictBatchLockedError`; a write under a new `batchId`
 *   succeeds.
 *
 * Timestamps come from the `Clock` service, so tests control them with
 * `TestClock`.
 *
 * **Example** (Name a queue method)
 *
 * ```ts
 * import type { ReviewQueueShape } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * const method: keyof ReviewQueueShape = "recordVerdict"
 * console.log(method) // "recordVerdict"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface ReviewQueueShape {
  /**
   * Lock one batch and return the appended lock row. Fails with
   * `VerdictBatchEmptyError` when the batch has no rows and with
   * `VerdictBatchLockedError` when it is already locked.
   */
  readonly lockBatch: (
    batchId: ReviewBatchId
  ) => Effect.Effect<VerdictRow, VerdictBatchEmptyError | VerdictBatchLockedError | VerdictLogError>;
  /**
   * The items still awaiting a final verdict, in the order given: those with
   * no row in the log, and those whose latest verdict is `partly` or
   * `withdrawn`. `question` items are never open here: they close by
   * `AnswerRow`, and the question loop selects them. Producers own the
   * items; the queue stores only verdicts.
   */
  readonly openItems: (items: ReadonlyArray<ReviewItem>) => Effect.Effect<ReadonlyArray<ReviewItem>, VerdictLogError>;
  /** Every row of the verdict log, in append order, lock rows and superseded revisions included. */
  readonly readLog: Effect.Effect<ReadonlyArray<VerdictRow>, VerdictLogError>;
  /**
   * Append the attorney's verdict, or an undo, as the item's next revision in
   * the batch, stamped with the clock's current time. Returns the appended
   * row. Fails with `VerdictBatchLockedError` when the batch is locked.
   */
  readonly recordVerdict: (
    input: RecordVerdictInput
  ) => Effect.Effect<VerdictRow, VerdictBatchLockedError | VerdictLogError>;
}

/**
 * Service: the attorney's review queue over the append-only verdict log.
 *
 * **Details**
 *
 * The queue owns revision numbering, the lock check and the open-item rule;
 * {@link VerdictLog} only stores rows. Projection onto claim dispositions is
 * the separate, pure `VerdictProjector`.
 *
 * **Example** (Reference the queue service)
 *
 * ```ts
 * import { ReviewQueue } from "@beep/law-practice-use-cases/ReviewQueue"
 *
 * console.log(ReviewQueue.key)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class ReviewQueue extends Context.Service<ReviewQueue, ReviewQueueShape>()($I`ReviewQueue`) {}
