/**
 * The daily notice over an in-memory mailbox: one email a day at most, only
 * when questions are waiting, and never any question text. Every question
 * here is synthetic.
 */

import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import {
  DailyNotice,
  DailyNoticeLive,
  NoticeMailbox,
  NoticeMailboxError,
  noticeMessage,
} from "@beep/law-practice-use-cases/DailyNotice";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { NoticeMessage } from "@beep/law-practice-use-cases/DailyNotice";

type MailboxState = {
  readonly claimed: ReadonlyArray<string>;
  readonly sent: ReadonlyArray<NoticeMessage>;
  readonly failSend: boolean;
};

/** The in-memory mailbox's state, so a test can read what was sent and recorded. */
class MailboxRecord extends Context.Service<MailboxRecord, Ref.Ref<MailboxState>>()(
  "@beep/law-practice-use-cases/test/DailyNotice.test/MailboxRecord"
) {}

const TestMailbox = Layer.effect(
  NoticeMailbox,
  Effect.map(MailboxRecord, (state) =>
    NoticeMailbox.of({
      // One atomic step, as the adapters' exclusive create is: only the first claim of a day wins.
      claimDay: Effect.fn("TestMailbox.claimDay")((day: LocalDate) =>
        Ref.modify(state, (current): readonly [boolean, MailboxState] =>
          A.contains(current.claimed, day.toISOString())
            ? [false, current]
            : [true, { ...current, claimed: A.append(current.claimed, day.toISOString()) }]
        )
      ),
      send: Effect.fn("TestMailbox.send")(function* (message: NoticeMessage) {
        const current = yield* Ref.get(state);
        if (current.failSend) {
          return yield* NoticeMailboxError.make({ operation: "send" });
        }
        yield* Ref.set(state, { ...current, sent: A.append(current.sent, message) });
      }),
    })
  )
);

const TestLayer = DailyNoticeLive.pipe(
  Layer.provide(TestMailbox),
  Layer.provideMerge(Layer.effect(MailboxRecord, Ref.make<MailboxState>({ claimed: [], sent: [], failSend: false })))
);

const day = (dayOfMonth: number) => LocalDate.make({ year: 2026, month: 10, day: dayOfMonth });

const QUESTION_TEXT = "Is the response date for the synthetic matter November 2?";

const question = (index: number) =>
  S.decodeEffect(ReviewItem.cases.question)({
    kind: "question",
    itemId: `question:notice:${index}`,
    text: QUESTION_TEXT,
    sourceRefs: [],
    facts: [{ text: "The office action was mailed on 2026-08-02.", sourceRefs: [] }],
    options: [
      { optionId: "keep-date", label: "Keep the date" },
      { optionId: "move-date", label: "Move the date" },
    ],
    docket: "90001US01",
  });

const run = Effect.fnUntraced(function* (count: number, today: LocalDate) {
  const digest = yield* Effect.forEach(A.take(A.range(1, 10), count), question);
  return yield* (yield* DailyNotice).sendIfDue({ digest, today });
});

const sentSoFar = Effect.flatMap(MailboxRecord, (state) => Effect.map(Ref.get(state), ({ sent }) => sent));

describe("@beep/law-practice-use-cases daily notice", () => {
  it.layer(TestLayer, { timeout: "10 seconds" })("once per day", (it) => {
    it.effect(
      "sends one notice a day while questions wait, and again the next day",
      Effect.fnUntraced(function* () {
        const first = yield* run(2, day(14));
        const second = yield* run(3, day(14));
        const nextDay = yield* run(1, day(15));

        expect(A.map([first, second, nextDay], ({ status }) => status)).toStrictEqual(["sent", "already-sent", "sent"]);
        const sentSoFar1 = yield* sentSoFar;
        expect(A.map(sentSoFar1, ({ subject }) => subject)).toStrictEqual([
          "Claude: 2 questions waiting",
          "Claude: 1 question waiting",
        ]);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("concurrent runs", (it) => {
    it.effect(
      "sends exactly once when two runs on the same day race",
      Effect.fnUntraced(function* () {
        const outcomes = yield* Effect.all([run(2, day(14)), run(2, day(14))], { concurrency: 2 });

        expect(
          A.sort(
            A.map(outcomes, ({ status }) => status),
            Str.Order
          )
        ).toStrictEqual(["already-sent", "sent"]);
        const sentSoFar2 = yield* sentSoFar;
        expect(sentSoFar2).toHaveLength(1);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("empty digest", (it) => {
    it.effect(
      "sends and records nothing when no question is waiting",
      Effect.fnUntraced(function* () {
        const outcome = yield* run(0, day(14));
        const state = yield* Effect.flatMap(MailboxRecord, Ref.get);

        expect(outcome.status).toBe("nothing-waiting");
        expect(state.sent).toStrictEqual([]);
        expect(state.claimed).toStrictEqual([]);
        expect((yield* run(1, day(14))).status).toBe("sent");
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("failed send", (it) => {
    it.effect(
      "reports a failed send and sends no second notice that day",
      Effect.fnUntraced(function* () {
        const state = yield* MailboxRecord;
        yield* Ref.update(state, (current) => ({ ...current, failSend: true }));
        const failure = yield* Effect.flip(run(2, day(14)));
        yield* Ref.update(state, (current) => ({ ...current, failSend: false }));

        expect(S.is(NoticeMailboxError)(failure) && failure.operation).toBe("send");
        expect((yield* run(2, day(14))).status).toBe("already-sent");
        const sentSoFar3 = yield* sentSoFar;
        expect(sentSoFar3).toStrictEqual([]);
      })
    );
  });

  it.effect(
    "says only how many questions wait, never what they ask",
    Effect.fnUntraced(function* () {
      const items = yield* Effect.forEach(A.range(1, 4), question);
      const message = noticeMessage(A.length(items));

      expect(message.subject).toBe("Claude: 4 questions waiting");
      expect(message.body).toBe("4 questions are waiting for you in Claude. Open the review queue to answer.");
      for (const item of items) {
        for (const text of [item.text, item.itemId, "90001US01", "office action"]) {
          expect(Str.includes(text)(`${message.subject}\n${message.body}`)).toBe(false);
        }
      }
    })
  );
});
