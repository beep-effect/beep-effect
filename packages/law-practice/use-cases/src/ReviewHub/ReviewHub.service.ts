/**
 * Review hub implementation over the review queue, the question queue and
 * the review-item store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ReviewItem } from "@beep/law-practice-domain";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { QuestionNotFoundError } from "../QuestionQueue/QuestionQueue.errors.ts";
import { QuestionQueue } from "../QuestionQueue/QuestionQueue.ports.ts";
import { DigestSelection } from "../QuestionQueue/QuestionQueue.schemas.ts";
import { ReviewItemStore } from "../ReviewItemStore/ReviewItemStore.ports.ts";
import { ReviewQueue } from "../ReviewQueue/ReviewQueue.ports.ts";
import { ReviewHubToolError } from "./ReviewHub.errors.ts";
import { ReviewHub } from "./ReviewHub.ports.ts";
import { OpenItems } from "./ReviewHub.schemas.ts";
import type { AnswerLogError, UnknownQuestionOptionError } from "../QuestionQueue/QuestionQueue.errors.ts";
import type { QuestionQueueShape } from "../QuestionQueue/QuestionQueue.ports.ts";
import type { ReviewItemStoreError } from "../ReviewItemStore/ReviewItemStore.errors.ts";
import type { ReviewItemStoreShape } from "../ReviewItemStore/ReviewItemStore.ports.ts";
import type {
  VerdictBatchEmptyError,
  VerdictBatchLockedError,
  VerdictLogError,
} from "../ReviewQueue/ReviewQueue.errors.ts";
import type { RecordVerdictInput, ReviewQueueShape } from "../ReviewQueue/ReviewQueue.ports.ts";
import type { LockBatchRequest, OpenItemsRequest, RecordAnswerRequest } from "./ReviewHub.schemas.ts";

type HubFailure =
  | AnswerLogError
  | QuestionNotFoundError
  | ReviewItemStoreError
  | UnknownQuestionOptionError
  | VerdictBatchEmptyError
  | VerdictBatchLockedError
  | VerdictLogError;

const storeUnavailable = ({ _tag, operation }: AnswerLogError | ReviewItemStoreError | VerdictLogError) =>
  ReviewHubToolError.make({ code: "store-unavailable", message: `The review store failed to ${operation} (${_tag}).` });

// Every typed failure of the queues and the store, as the code the client branches on.
const toolError = (failure: HubFailure): ReviewHubToolError =>
  Match.valueTags(failure, {
    AnswerLogError: storeUnavailable,
    QuestionNotFoundError: ({ itemId }) =>
      ReviewHubToolError.make({ code: "not-found", message: `No question ${itemId} is waiting for this answer.` }),
    ReviewItemStoreError: storeUnavailable,
    UnknownQuestionOptionError: ({ itemId, optionId }) =>
      ReviewHubToolError.make({ code: "unknown-option", message: `Question ${itemId} offers no option ${optionId}.` }),
    VerdictBatchEmptyError: ({ batchId }) =>
      ReviewHubToolError.make({ code: "not-found", message: `Review batch ${batchId} has no verdicts to lock.` }),
    VerdictBatchLockedError: ({ batchId }) =>
      ReviewHubToolError.make({ code: "locked", message: `Review batch ${batchId} is locked.` }),
    VerdictLogError: storeUnavailable,
  });

const makeReviewHub = (store: ReviewItemStoreShape, reviews: ReviewQueueShape, questions: QuestionQueueShape) =>
  ReviewHub.of({
    lockBatch: Effect.fn("ReviewHub.lockBatch")(
      (request: LockBatchRequest) => reviews.lockBatch(request.batchId),
      Effect.mapError(toolError)
    ),
    openItems: Effect.fn("ReviewHub.openItems")(function* ({ today }: OpenItemsRequest) {
      const items = yield* store.list;
      const open = yield* reviews.openItems(A.filter(items, P.not(ReviewItem.guards.question)));
      const due = yield* questions.digest(
        DigestSelection.make({ today, items: A.filter(items, ReviewItem.guards.question) })
      );
      const waiting = HashSet.fromIterable(A.map(A.appendAll(open, due), ({ itemId }) => itemId));
      return OpenItems.make({ items: A.filter(items, ({ itemId }) => HashSet.has(waiting, itemId)) });
    }, Effect.mapError(toolError)),
    recordAnswer: Effect.fn("ReviewHub.recordAnswer")(function* ({ itemId, answer }: RecordAnswerRequest) {
      const list1 = yield* store.list;
      const item = yield* Effect.fromOption(
        pipe(
          A.findFirst(list1, (stored) => stored.itemId === itemId),
          O.filter(ReviewItem.guards.question)
        ),
        () => QuestionNotFoundError.make({ itemId })
      );
      return yield* questions.recordAnswer({ item, answer });
    }, Effect.mapError(toolError)),
    recordVerdict: Effect.fn("ReviewHub.recordVerdict")(
      (input: RecordVerdictInput) => reviews.recordVerdict(input),
      Effect.mapError(toolError)
    ),
  });

/**
 * Layer providing the review hub over the review queue, the question queue
 * and the review-item store the caller supplies.
 *
 * **Details**
 *
 * `openItems` lists the store, passes the verdict items to
 * `ReviewQueue.openItems` and the questions to `QuestionQueue.digest`, and
 * keeps the store's order. `recordAnswer` answers only a stored `question`
 * item. Every failure is mapped to its code: a missing question or an empty
 * batch to `not-found`, a locked batch to `locked`, an option the question
 * does not offer to `unknown-option`, and any store failure to
 * `store-unavailable`. The hub never writes the calendar.
 *
 * **Example** (Provide the hub over in-memory stores)
 *
 * ```ts
 * import { QuestionQueueLive } from "@beep/law-practice-use-cases/QuestionQueue"
 * import { ReviewHubLive } from "@beep/law-practice-use-cases/ReviewHub"
 * import { ReviewQueueLive } from "@beep/law-practice-use-cases/ReviewQueue"
 * import { AnswerLogMemory, ReviewItemStoreMemory, VerdictLogMemory } from "@beep/law-practice-use-cases/test"
 * import * as Layer from "effect/Layer"
 *
 * const hub = ReviewHubLive.pipe(
 *   Layer.provide(Layer.mergeAll(ReviewQueueLive, QuestionQueueLive, ReviewItemStoreMemory)),
 *   Layer.provide(Layer.merge(VerdictLogMemory, AnswerLogMemory))
 * )
 * console.log(Layer.isLayer(hub)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ReviewHubLive: Layer.Layer<ReviewHub, never, QuestionQueue | ReviewItemStore | ReviewQueue> = Layer.effect(
  ReviewHub,
  Effect.gen(function* () {
    const ReviewItemStore2 = yield* ReviewItemStore;
    const ReviewQueue3 = yield* ReviewQueue;
    const QuestionQueue4 = yield* QuestionQueue;
    return makeReviewHub(ReviewItemStore2, ReviewQueue3, QuestionQueue4);
  })
);
