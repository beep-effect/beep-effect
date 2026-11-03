/**
 * Review queue implementation over the append-only verdict log.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ReviewItem, VerdictRow } from "@beep/law-practice-domain";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Semaphore from "effect/Semaphore";
import {
  batchLockedAt,
  isFinalVerdict,
  latestBatchRow,
  latestVerdictByItem,
  nextRevision,
} from "../internal/latestVerdict.ts";
import { VerdictBatchEmptyError, VerdictBatchLockedError } from "./ReviewQueue.errors.ts";
import { ReviewQueue, VerdictLog } from "./ReviewQueue.ports.ts";
import type { ReviewBatchId } from "@beep/law-practice-domain";
import type { RecordVerdictInput, ReviewQueueShape, VerdictLogShape } from "./ReviewQueue.ports.ts";

const isQuestion = ReviewItem.guards.question;

const ensureUnlocked = (rows: ReadonlyArray<VerdictRow>, batchId: ReviewBatchId) =>
  O.match(batchLockedAt(rows, batchId), {
    onNone: () => Effect.void,
    onSome: (lockedAt) => Effect.fail(VerdictBatchLockedError.make({ batchId, lockedAt })),
  });

const makeReviewQueue = (log: VerdictLogShape, writeLock: Semaphore.Semaphore): ReviewQueueShape => {
  const append = Effect.fnUntraced(function* (row: VerdictRow) {
    yield* log.append(row);
    return row;
  });

  const openItems = Effect.fn("ReviewQueue.openItems")(function* (items: ReadonlyArray<ReviewItem>) {
    const rows1 = yield* log.rows;
    const latest = latestVerdictByItem(rows1);
    // Questions close by answer, not verdict; the question loop owns them.
    return A.filter(items, (item) => !isQuestion(item) && !O.exists(HashMap.get(latest, item.itemId), isFinalVerdict));
  });

  // Writes read the log, check the lock and append under one permit, so no
  // other write of this queue interleaves between the check and the append.
  const recordVerdict = Effect.fn("ReviewQueue.recordVerdict")(function* (input: RecordVerdictInput) {
    const rows = yield* log.rows;
    yield* ensureUnlocked(rows, input.batchId);
    const recordedAt = yield* DateTime.now;
    return yield* append(
      VerdictRow.make({
        itemId: input.itemId,
        batchId: input.batchId,
        verdict: input.verdict,
        note: input.note,
        revision: nextRevision(rows, input.itemId, input.batchId),
        recordedAt,
      })
    );
  }, writeLock.withPermits(1));

  const lockBatch = Effect.fn("ReviewQueue.lockBatch")(function* (batchId: ReviewBatchId) {
    const rows = yield* log.rows;
    yield* ensureUnlocked(rows, batchId);
    const closing = yield* Effect.fromOption(latestBatchRow(rows, batchId), () =>
      VerdictBatchEmptyError.make({ batchId })
    );
    const lockedAt = yield* DateTime.now;
    return yield* append(
      VerdictRow.make({
        itemId: closing.itemId,
        batchId,
        verdict: closing.verdict,
        note: closing.note,
        revision: nextRevision(rows, closing.itemId, batchId),
        recordedAt: closing.recordedAt,
        lockedAt: O.some(lockedAt),
      })
    );
  }, writeLock.withPermits(1));

  return ReviewQueue.of({
    lockBatch,
    openItems,
    readLog: log.rows.pipe(Effect.withSpan("ReviewQueue.readLog")),
    recordVerdict,
  });
};

/**
 * Layer providing the review queue over whichever {@link VerdictLog} store
 * the caller supplies.
 *
 * **Details**
 *
 * The queue owns revision numbering, the lock check and the open-item rule,
 * and reads timestamps from the `Clock` service. Each built queue runs its
 * writes (`recordVerdict`, `lockBatch`) one at a time, so a verdict racing a
 * lock in the same process cannot land after the lock row. Provide
 * `VerdictLogMemory` from `@beep/law-practice-use-cases/test` in tests; the
 * durable store lives with the plugin.
 *
 * **Example** (Record a verdict against the in-memory store)
 *
 * ```ts
 * import { RecordVerdictInput, ReviewQueue, ReviewQueueLive } from "@beep/law-practice-use-cases/ReviewQueue"
 * import { VerdictLogMemory } from "@beep/law-practice-use-cases/test"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* ReviewQueue
 *   const row = yield* queue.recordVerdict(
 *     RecordVerdictInput.make({ itemId: "claim-finding:1", batchId: "sitting-1", verdict: "right" })
 *   )
 *   console.log(row.revision) // 1
 * }).pipe(Effect.provide(ReviewQueueLive.pipe(Layer.provide(VerdictLogMemory))))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ReviewQueueLive: Layer.Layer<ReviewQueue, never, VerdictLog> = Layer.effect(
  ReviewQueue,
  Effect.gen(function* () {
    const log = yield* VerdictLog;
    const writeLock = yield* Semaphore.make(1);
    return makeReviewQueue(log, writeLock);
  })
);
