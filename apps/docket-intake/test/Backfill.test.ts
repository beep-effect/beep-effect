/**
 * `backfill-questions` proofs: stored docket intake questions that do not say
 * which email they are about are matched to journaled messages by digest,
 * read from a fake mailbox, and rewritten once. The hub's data directory is a
 * temporary directory on the tests' in-memory file system; every message,
 * address and link is synthetic.
 */
import { DocketJournalEntry, DocketRunId } from "@beep/law-practice-server/DocketIntake";
import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import {
  DocketIntakeState,
  DocketLedgerRecord,
  DocketNeedsReview,
  DocketQuestionEmail,
  DocketQuestionInput,
  DocketQuestions,
  DocketQuestionsLive,
  DocketWrittenEntry,
  docketQuestionNamesEmail,
} from "@beep/law-practice-use-cases/DocketIntake";
import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore";
import { GraphEmailAddress, GraphMessage, GraphRecipient, M365Error } from "@beep/m365";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import { backfillQuestions, DocketBackfillReport, describeDocketMessage } from "@/Backfill";
import { fixtureConfig } from "./support/Config.ts";
import { FakeM365, FakeM365Layer, throttled } from "./support/FakeM365.ts";
import { CryptoLayer, FilesLayer } from "./support/Pipeline.ts";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";
import type { ReviewItemStoreShape } from "@beep/law-practice-use-cases/ReviewItemStore";

const DAY = LocalDate.make({ year: 2030, month: 1, day: 9 });
const RUN = DocketRunId.make("run-20300109T100000000Z");
const AT = DateTime.makeUnsafe("2030-01-09T10:00:01.000Z");
const RECEIVED_AT = "2030-01-09T09:00:00.000Z";

const needsReview = (messageId: string) =>
  DocketNeedsReview.make({
    entry: DocketWrittenEntry.make({ eventId: `evt-${messageId}` }),
    flags: ["dates-differ"],
    messageId,
    reason: "no-usable-date",
  });

const marked = (messageId: string) =>
  DocketJournalEntry.make({
    at: AT,
    kind: "message-marked",
    messageId: O.some(messageId),
    receivedAt: O.some(RECEIVED_AT),
    runId: RUN,
  });

// The service marked every message but `m-unjournaled`, whose question predates the journal.
const journal = [
  DocketJournalEntry.make({ at: AT, eventId: O.some("evt-m-journaled"), kind: "event-created", runId: RUN }),
  ...A.map(["m-journaled", "m-in-ledger", "m-moved", "m-named"], marked),
];

// `m-in-ledger` is still a needs-review record, so the service republishes its question every cycle.
const state = DocketIntakeState.make({
  ledger: {
    "m-in-ledger": DocketLedgerRecord.make({
      attempts: 1,
      outcome: needsReview("m-in-ledger"),
      processedOn: DAY,
      receivedAt: RECEIVED_AT,
    }),
  },
});

const EMAIL = DocketQuestionEmail.make({
  messageLink: O.some("https://outlook.fixture.invalid/mail/m-journaled"),
  receivedDate: O.some(DAY),
  sender: O.some("examiner@example.com"),
  subject: O.some("Office action response"),
});

// The mailbox still has `m-journaled`; `m-moved` was moved, so Graph no longer finds it by that id.
const fakeMailbox = Effect.fnUntraced(function* () {
  const asked = yield* Ref.make<ReadonlyArray<string>>([]);
  const describeMessage = (messageId: string): Effect.Effect<O.Option<DocketQuestionEmail>, DocketIntakeError> =>
    Ref.update(asked, A.append(messageId)).pipe(Effect.as(O.filter(O.some(EMAIL), () => messageId === "m-journaled")));
  return { asked, describeMessage };
});

// The hub's item store over a fresh data directory, with the five questions the producer raised:
// four that do not name their email, and one that does.
const seededHub = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const questions = yield* DocketQuestions;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "review-hub-" });
  const build1 = yield* Layer.build(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory: directory })));
  const store = Context.get(build1, ReviewItemStore);
  const forEach2 = yield* Effect.forEach(["m-journaled", "m-in-ledger", "m-unjournaled", "m-moved"], (messageId) =>
    questions.raise(DocketQuestionInput.make({ outcome: needsReview(messageId) }))
  );
  const unnamed = A.getSomes(forEach2);
  const named = yield* questions.raise(
    DocketQuestionInput.make({ outcome: needsReview("m-named"), receivedDate: O.some(DAY) })
  );
  yield* store.upsert([...unnamed, ...O.toArray(named)]);
  return { file: `${directory}/items.jsonl`, store, unnamed };
});

const backfill = (store: ReviewItemStoreShape, apply: boolean) =>
  Effect.flatMap(fakeMailbox(), ({ asked, describeMessage }) =>
    backfillQuestions({ apply, describe: describeMessage, journal, state }).pipe(
      Effect.provideService(ReviewItemStore, store),
      Effect.flatMap((report) => Effect.map(Ref.get(asked), (messageIds) => ({ messageIds, report })))
    )
  );

const lineCount = (text: string) => A.length(A.filter(Str.split(text, "\n"), Str.isNonEmpty));

const TestLayer = Layer.mergeAll(
  FilesLayer,
  CryptoLayer,
  FakeM365Layer,
  DocketQuestionsLive.pipe(Layer.provide(CryptoLayer))
);

describe("@beep/docket-intake backfill-questions", () => {
  it.layer(TestLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "counts what a dry run would change by message digest, and writes nothing",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { file, store } = yield* seededHub();
        const before = yield* fs.readFileString(file);

        const { messageIds, report } = yield* backfill(store, false);

        expect(report).toStrictEqual(
          DocketBackfillReport.make({ applied: false, enriched: 1, found: 4, inLedger: 1, unmatched: 1, unreadable: 1 })
        );
        // Only the journaled messages outside the ledger are read from the mailbox.
        expect(messageIds).toStrictEqual(["m-journaled", "m-moved"]);
        const readFileString3 = yield* fs.readFileString(file);
        expect(readFileString3).toBe(before);
      })
    );

    it.effect(
      "rewrites the matched question once, keeping its id and options, and changes nothing on a second run",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { file, store, unnamed } = yield* seededHub();
        const before = yield* fs.readFileString(file);
        const original = yield* Effect.fromOption(A.head(unnamed));

        const first = yield* backfill(store, true);
        const once = yield* fs.readFileString(file);
        const second = yield* backfill(store, true);
        const items = yield* store.list;
        const rewritten = yield* Effect.fromOption(
          A.findFirst(items, (item) => item.itemId === original.itemId && item.kind === "question")
        );

        expect([first.report.applied, first.report.enriched, first.report.found]).toStrictEqual([true, 1, 4]);
        expect(lineCount(once)).toBe(lineCount(before) + 1);
        expect(second.report).toStrictEqual(
          DocketBackfillReport.make({ applied: true, enriched: 0, found: 3, inLedger: 1, unmatched: 1, unreadable: 1 })
        );
        const readFileString4 = yield* fs.readFileString(file);
        expect(readFileString4).toBe(once);
        expect(A.length(items)).toBe(5);
        assertTrue(rewritten.kind === "question" && docketQuestionNamesEmail(rewritten));
        expect(rewritten.kind === "question" ? rewritten.options : []).toStrictEqual(original.options);
        expect(A.map(rewritten.kind === "question" ? rewritten.facts : [], ({ text }) => text)).toStrictEqual([
          'The email is "Office action response" from examiner@example.com, received January 9, 2030.',
          "Open the email in Outlook: https://outlook.fixture.invalid/mail/m-journaled",
          ...A.map(original.facts, ({ text }) => text),
        ]);
        expect(rewritten.text).toBe(
          'Docket intake found no date it could use in the email "Office action response". What is the deadline?'
        );
      })
    );

    it.effect(
      "reads the subject, sender, practice day and link of a message, none for one the mailbox lost, and fails on throttling",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeM365;
        const read = describeDocketMessage(fixtureConfig);
        yield* Ref.update(fake.script, (script) => ({
          ...script,
          getMessage: Effect.succeed(
            GraphMessage.make({
              from: O.some(
                GraphRecipient.make({
                  emailAddress: O.some(GraphEmailAddress.make({ address: O.some("examiner@example.com") })),
                })
              ),
              id: "m-journaled",
              // Late on 9 January in Chicago, already 10 January in UTC.
              receivedDateTime: O.some("2030-01-10T03:30:00Z"),
              subject: O.some("Office action response"),
              webLink: O.some("https://outlook.fixture.invalid/mail/m-journaled"),
            })
          ),
        }));
        const read5 = yield* read("m-journaled");
        const email = yield* Effect.fromOption(read5);

        assertSome(email.subject, "Office action response");
        assertSome(email.sender, "examiner@example.com");
        assertSome(email.messageLink, "https://outlook.fixture.invalid/mail/m-journaled");
        assertSome(
          O.map(email.receivedDate, (date) => date.toISOString()),
          "2030-01-09"
        );

        yield* Ref.update(fake.script, (script) => ({
          ...script,
          getMessage: Effect.fail(M365Error.fromReason("response status", { status: 404 })),
        }));
        const read6 = yield* read("m-moved");
        assertNone(read6);

        yield* Ref.update(fake.script, (script) => ({ ...script, getMessage: Effect.fail(throttled) }));
        const error = yield* Effect.flip(read("m-journaled"));
        expect([error.stage, error.cause]).toStrictEqual(["mailbox", "throttled"]);
        // Graph is asked for the four fields that name the message, never the body.
        const got = yield* Ref.get(fake.calls);
        expect(got).toStrictEqual([
          "getMessage m-journaled select=subject,from,receivedDateTime,webLink",
          "getMessage m-moved select=subject,from,receivedDateTime,webLink",
          "getMessage m-journaled select=subject,from,receivedDateTime,webLink",
        ]);
      })
    );
  });
});
