/**
 * Question queue implementation over the append-only answer log.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnswerRow } from "@beep/law-practice-domain";
import { isAfter } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Semaphore from "effect/Semaphore";
import { latestRowByItem, nextItemRevision } from "../internal/latestVerdict.ts";
import { QuestionNotFoundError, UnknownQuestionOptionError } from "./QuestionQueue.errors.ts";
import { AnswerLog, QuestionQueue } from "./QuestionQueue.ports.ts";
import { RecordAnswerInput } from "./QuestionQueue.schemas.ts";
import type { LocalDate } from "@beep/schema/LocalDate";
import type { AnswerLogShape, QuestionQueueShape } from "./QuestionQueue.ports.ts";
import type { DigestSelection, QuestionReviewItem } from "./QuestionQueue.schemas.ts";

// The answer the queue appends: the submission with its revision and timestamp.
const answerRow = (answer: RecordAnswerInput, revision: number, recordedAt: DateTime.Utc): AnswerRow =>
  RecordAnswerInput.match(answer, {
    decided: (submitted) => AnswerRow.cases.decided.make({ ...submitted, revision, recordedAt }),
    "pending-on-client": (submitted) =>
      AnswerRow.cases["pending-on-client"].make({ ...submitted, revision, recordedAt }),
    "keep-reminding": (submitted) => AnswerRow.cases["keep-reminding"].make({ ...submitted, revision, recordedAt }),
    withdrawn: (submitted) => AnswerRow.cases.withdrawn.make({ ...submitted, revision, recordedAt }),
  });

// The answer belongs to the given question, and a decided answer names one of its options.
const ensureAnswers = Effect.fnUntraced(function* (item: QuestionReviewItem, answer: RecordAnswerInput) {
  if (answer.itemId !== item.itemId) {
    return yield* QuestionNotFoundError.make({ itemId: answer.itemId });
  }
  if (
    RecordAnswerInput.guards.decided(answer) &&
    !A.some(item.options, ({ optionId }) => optionId === answer.optionId)
  ) {
    return yield* UnknownQuestionOptionError.make({ itemId: item.itemId, optionId: answer.optionId });
  }
});

// Whether a question belongs in the digest on `today`, given its current answer.
const isDueOn =
  (today: LocalDate) =>
  (answer: O.Option<AnswerRow>): boolean =>
    O.match(answer, {
      onNone: () => true,
      onSome: AnswerRow.match({
        decided: () => false,
        "pending-on-client": ({ resurfaceOn }) => !isAfter(resurfaceOn, today),
        "keep-reminding": () => true,
        withdrawn: () => false,
      }),
    });

const makeQuestionQueue = (log: AnswerLogShape, writeLock: Semaphore.Semaphore): QuestionQueueShape => {
  const currentAnswers = Effect.fn("QuestionQueue.currentAnswers")(function* (
    items: ReadonlyArray<QuestionReviewItem>
  ) {
    const asked = HashSet.fromIterable(A.map(items, ({ itemId }) => itemId));
    const rows1 = yield* log.rows;
    return latestRowByItem(A.filter(rows1, ({ itemId }) => HashSet.has(asked, itemId)));
  });

  const digest = Effect.fn("QuestionQueue.digest")(function* (selection: DigestSelection) {
    const answers = yield* currentAnswers(selection.items);
    return A.filter(selection.items, (item) => isDueOn(selection.today)(HashMap.get(answers, item.itemId)));
  });

  // Validation, the revision read and the append run under one permit, so no
  // other answer of this queue interleaves between the read and the append.
  const recordAnswer = Effect.fn("QuestionQueue.recordAnswer")(function* (input: {
    readonly item: QuestionReviewItem;
    readonly answer: RecordAnswerInput;
  }) {
    yield* ensureAnswers(input.item, input.answer);
    const rows = yield* log.rows;
    const argument = nextItemRevision(rows, input.item.itemId);
    const now1 = yield* DateTime.now;
    const row = answerRow(input.answer, argument, now1);
    yield* log.append(row);
    return row;
  }, writeLock.withPermits(1));

  return QuestionQueue.of({
    currentAnswers,
    digest,
    readLog: log.rows.pipe(Effect.withSpan("QuestionQueue.readLog")),
    recordAnswer,
  });
};

/**
 * Layer providing the question queue over whichever {@link AnswerLog} store
 * the caller supplies.
 *
 * **Details**
 *
 * The queue owns option validation, revision numbering and the digest rule,
 * and reads timestamps from the `Clock` service. Each built queue records
 * answers one at a time. Provide `AnswerLogMemory` from
 * `@beep/law-practice-use-cases/test` in tests.
 *
 * **Example** (Record an answer against the in-memory store)
 *
 * ```ts
 * import { QuestionOption, ReviewItem } from "@beep/law-practice-domain"
 * import { QuestionQueue, QuestionQueueLive, RecordAnswerInput } from "@beep/law-practice-use-cases/QuestionQueue"
 * import { AnswerLogMemory } from "@beep/law-practice-use-cases/test"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* QuestionQueue
 *   const item = ReviewItem.cases.question.make({
 *     itemId: "question:1",
 *     text: "Keep the current date?",
 *     sourceRefs: [],
 *     facts: [],
 *     options: [
 *       QuestionOption.make({ optionId: "keep-date", label: "Keep it" }),
 *       QuestionOption.make({ optionId: "move-date", label: "Move it" })
 *     ]
 *   })
 *   const row = yield* queue.recordAnswer({
 *     item,
 *     answer: RecordAnswerInput.cases["keep-reminding"].make({ itemId: "question:1" })
 *   })
 *   console.log(row.revision) // 1
 * }).pipe(Effect.provide(QuestionQueueLive.pipe(Layer.provide(AnswerLogMemory))))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const QuestionQueueLive: Layer.Layer<QuestionQueue, never, AnswerLog> = Layer.effect(
  QuestionQueue,
  Effect.gen(function* () {
    const log = yield* AnswerLog;
    const writeLock = yield* Semaphore.make(1);
    return makeQuestionQueue(log, writeLock);
  })
);
