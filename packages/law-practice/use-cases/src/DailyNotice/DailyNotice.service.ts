/**
 * Daily notice implementation over the notice-mailbox port.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { DailyNotice, NoticeMailbox } from "./DailyNotice.ports.ts";
import { DailyNoticeOutcome, NoticeMessage } from "./DailyNotice.schemas.ts";
import type { LocalDate } from "@beep/schema/LocalDate";
import type { QuestionReviewItem } from "../QuestionQueue/QuestionQueue.schemas.ts";
import type { NoticeMailboxShape } from "./DailyNotice.ports.ts";

/**
 * The notice for a number of waiting questions: the count, and nothing else.
 *
 * **Example** (Build the notice for three questions)
 *
 * ```ts
 * import { noticeMessage } from "@beep/law-practice-use-cases/DailyNotice"
 *
 * console.log(noticeMessage(3).subject) // "Claude: 3 questions waiting"
 * console.log(noticeMessage(1).subject) // "Claude: 1 question waiting"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const noticeMessage = (count: number): NoticeMessage => {
  const questions = count === 1 ? "1 question" : `${count} questions`;
  return NoticeMessage.make({
    subject: `Claude: ${questions} waiting`,
    body: `${questions} ${count === 1 ? "is" : "are"} waiting for you in Claude. Open the review queue to answer.`,
  });
};

const makeDailyNotice = (mailbox: NoticeMailboxShape) =>
  DailyNotice.of({
    sendIfDue: Effect.fn("DailyNotice.sendIfDue")(function* (input: {
      readonly digest: ReadonlyArray<QuestionReviewItem>;
      readonly today: LocalDate;
    }) {
      if (A.isReadonlyArrayEmpty(input.digest)) {
        return DailyNoticeOutcome.cases["nothing-waiting"].make({});
      }
      if (!(yield* mailbox.claimDay(input.today))) {
        return DailyNoticeOutcome.cases["already-sent"].make({ sentOn: input.today });
      }
      const message = noticeMessage(A.length(input.digest));
      yield* mailbox.send(message);
      return DailyNoticeOutcome.cases.sent.make({ message, sentOn: input.today });
    }),
  });

/**
 * Layer providing the daily notice over whichever {@link NoticeMailbox} the caller supplies.
 *
 * **Details**
 *
 * An empty digest sends nothing and claims nothing. Otherwise the run claims
 * the day, and a day another run already claimed sends nothing. Then the notice
 * goes out; so the attorney gets one email a day at most, and a failed send
 * is reported rather than retried that day.
 *
 * **Example** (Provide the notice over a mailbox)
 *
 * ```ts
 * import { DailyNoticeLive, NoticeMailbox } from "@beep/law-practice-use-cases/DailyNotice"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const mailbox = Layer.succeed(NoticeMailbox, {
 *   claimDay: () => Effect.succeed(true),
 *   send: () => Effect.void
 * })
 * console.log(Layer.isLayer(DailyNoticeLive.pipe(Layer.provide(mailbox)))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DailyNoticeLive: Layer.Layer<DailyNotice, never, NoticeMailbox> = Layer.effect(
  DailyNotice,
  Effect.map(NoticeMailbox, makeDailyNotice)
);
