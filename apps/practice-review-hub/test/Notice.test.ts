/**
 * The daily notice over the hub's files in a temporary directory and a fake
 * mailbox that records what it would send. The test clock stands at the Unix
 * epoch, so today is 1970-01-01 in UTC. Every question here is synthetic.
 */

import { QuestionOption } from "@beep/law-practice-domain/values/Question";
import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import { NoticeClaudeFolder } from "@beep/law-practice-server/NoticeMailbox";
import { QuestionQueue, RecordAnswerInput } from "@beep/law-practice-use-cases/QuestionQueue";
import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore";
import { GraphMessage, M365 } from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import { makeNoticeLayer, noticeOutcomeLine, sendDailyNotice } from "@/Notice";
import { Platform } from "./Hub.fixture.ts";

const MAILBOX = "attorney@example.test";
const UTC = DateTime.zoneMakeNamedUnsafe("UTC");

/** One draft the fake mailbox was asked to send: its subject, recipients and body type, and its body. */
type Sent = { readonly summary: string; readonly content: string };

/** What the fake mailbox was asked to send, in order. */
class SentMail extends Context.Service<SentMail, Ref.Ref<ReadonlyArray<Sent>>>()(
  "@beep/practice-review-hub/test/Notice.test/SentMail"
) {}

/** The data directory of one layer build, so a test can read the notice's day claims. */
class DataDirectory extends Context.Service<DataDirectory, string>()(
  "@beep/practice-review-hub/test/Notice.test/DataDirectory"
) {}

// Records each draft; sending succeeds without doing anything.
const FakeMailbox = Layer.unwrap(
  Effect.map(SentMail, (sent) =>
    Layer.mock(M365)({
      createDraftMessage: ({ draft }) =>
        Effect.as(
          Ref.update(
            sent,
            A.append({
              summary: `${draft.subject} -> ${A.join(draft.toRecipients, ",")} (${draft.body.contentType})`,
              content: draft.body.content,
            })
          ),
          GraphMessage.make({ id: "draft-1" })
        ),
      sendDraftMessage: () => Effect.void,
    })
  )
);

const summaries = A.map(({ summary }: Sent) => summary);
const contents = A.map(({ content }: Sent) => content);

const noticeTest = (claudeFolder: O.Option<NoticeClaudeFolder>) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const dataDirectory = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "review-notice-" });
      return makeNoticeLayer({ claudeFolder, dataDirectory, mailbox: MAILBOX }).pipe(
        Layer.provide(FakeMailbox),
        Layer.provideMerge(Layer.succeed(DataDirectory, dataDirectory))
      );
    })
  ).pipe(Layer.provideMerge(Layer.merge(Platform, Layer.effect(SentMail, Ref.make<ReadonlyArray<Sent>>([])))));

const NoticeTest = noticeTest(O.none());

// A synthetic review folder, written with / as the runbook recommends for the environment file.
const ReviewFolderTest = noticeTest(O.some(NoticeClaudeFolder.make("C:/Users/attorney/Review")));

const question = (itemId: string) =>
  ReviewItem.cases.question.make({
    itemId,
    text: "Is the synthetic reply due on December 1?",
    sourceRefs: [],
    facts: [],
    options: [
      QuestionOption.make({ optionId: "due-december-1", label: "Yes, December 1" }),
      QuestionOption.make({ optionId: "not-a-deadline", label: "It is not a deadline" }),
    ],
  });

describe("@beep/practice-review-hub daily notice", () => {
  it.layer(NoticeTest, { timeout: "10 seconds" })("questions waiting", (it) => {
    it.effect(
      "counts only the questions the digest selects, sends once, and keeps the day",
      Effect.fnUntraced(function* () {
        const answered = question("question:notice-1");
        yield* (yield* ReviewItemStore).upsert([
          answered,
          question("question:notice-2"),
          ReviewItem.cases["kg-answer"].make({
            itemId: "kg-answer:notice-1",
            text: "The synthetic matter has one pending reply.",
            sourceRefs: [],
          }),
        ]);
        yield* (yield* QuestionQueue).recordAnswer({
          item: answered,
          answer: RecordAnswerInput.cases.decided.make({ itemId: answered.itemId, optionId: "due-december-1" }),
        });

        const first = yield* sendDailyNotice(UTC);
        const second = yield* sendDailyNotice(UTC);
        const claims = yield* (yield* FileSystem.FileSystem).readDirectory(`${yield* DataDirectory}/notice-sent`);

        expect([first.status, second.status]).toStrictEqual(["sent", "already-sent"]);
        const SentMail5 = yield* SentMail;
        const got = yield* Ref.get(SentMail5);
        expect(summaries(got)).toStrictEqual(["Claude: 1 question waiting -> attorney@example.test (text)"]);
        const SentMail6 = yield* SentMail;
        const got1 = yield* Ref.get(SentMail6);
        expect(contents(got1)).toStrictEqual([
          "1 question is waiting for you in Claude. Open the review queue to answer.",
        ]);
        expect(claims).toStrictEqual(["1970-01-01"]);
      })
    );
  });

  it.layer(ReviewFolderTest, { timeout: "10 seconds" })("questions waiting, with a Claude Code folder", (it) => {
    it.effect(
      "emails an Answer them in Claude Code link and keeps the printed outcome count-only",
      Effect.fnUntraced(function* () {
        yield* (yield* ReviewItemStore).upsert([question("question:notice-link-1")]);

        // The exact line `notice` prints to the journal.
        const printed = yield* noticeOutcomeLine(UTC);
        const SentMail2 = yield* SentMail;
        const sent = yield* Ref.get(SentMail2);

        expect(summaries(sent)).toStrictEqual(["Claude: 1 question waiting -> attorney@example.test (html)"]);
        expect(contents(sent)).toStrictEqual([
          A.join(
            [
              "<p>1 question is waiting for you in Claude. Open the review queue to answer.</p>",
              '<p><a href="claude-cli://open?cwd=C%3A%5CUsers%5Cattorney%5CReview&amp;q=Walk%20me%20through%20my%20waiting%20review%20questions.">Answer them in Claude Code</a></p>',
              "<p>The link opens Claude Code with the request typed in. Check that it reads exactly: Walk me through my waiting review questions. Then press Enter. If it reads anything else, close Claude Code without pressing Enter.</p>",
              "<p>If the link does not open, open Claude Code in C:\\Users\\attorney\\Review and type: Walk me through my waiting review questions.</p>",
            ],
            "\n"
          ),
        ]);
        expect(printed).toBe(
          '{"status":"sent","message":{"subject":"Claude: 1 question waiting","body":"1 question is waiting for you in Claude. Open the review queue to answer."},"sentOn":"1970-01-01"}'
        );
      })
    );
  });

  it.layer(NoticeTest, { timeout: "10 seconds" })("nothing waiting", (it) => {
    it.effect(
      "sends nothing and claims no day when no question waits",
      Effect.fnUntraced(function* () {
        const outcome = yield* sendDailyNotice(UTC);
        const claims = `${yield* DataDirectory}/notice-sent`;

        expect(outcome.status).toBe("nothing-waiting");
        const SentMail7 = yield* SentMail;
        const got3 = yield* Ref.get(SentMail7);
        expect(got3).toStrictEqual([]);
        const exists4 = yield* (yield* FileSystem.FileSystem).exists(claims);
        expect(exists4).toBe(false);
      })
    );
  });
});
