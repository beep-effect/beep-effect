/**
 * The review hub's questions from the poll cycle: with the hub configured,
 * every needs-review message in the ledger becomes one stored question that
 * says which email it is about, and a repeated cycle stores nothing new. The
 * data directory is a temporary directory on the tests' in-memory file
 * system; every message is synthetic.
 */
import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import {
  DocketCandidateDate,
  DocketIntakeState,
  DocketLedgerRecord,
  DocketNeedsReview,
  DocketWrittenEntry,
  IntakeFailed,
} from "@beep/law-practice-use-cases/DocketIntake";
import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import { pollCycle } from "@/Cycle";
import { DocketQuestionPublisher, makeDocketQuestionPublisherLayer, questionInput } from "@/Questions";
import { fixtureConfig } from "./support/Config.ts";
import { CryptoLayer, FilesLayer, PipelineHarness, PipelineLayer } from "./support/Pipeline.ts";

const needsReview = DocketLedgerRecord.make({
  attempts: 1,
  outcome: DocketNeedsReview.make({
    entry: DocketWrittenEntry.make({ eventId: "evt-needs-review" }),
    flags: ["dates-differ"],
    messageId: "m-review",
    reason: "agents-disagree",
  }),
  processedOn: LocalDate.make({ year: 1969, month: 12, day: 31 }),
  receivedAt: "2030-01-09T09:00:00.000Z",
});

const RECEIVED = LocalDate.make({ year: 2030, month: 1, day: 9 });

// A needs-review record that kept which email it is about.
const identified = DocketLedgerRecord.make({
  attempts: 1,
  outcome: DocketNeedsReview.make({
    candidateDates: [
      DocketCandidateDate.make({ date: LocalDate.make({ year: 2030, month: 4, day: 8 }), source: "reviewer" }),
    ],
    conversationId: O.some("AAQkADsynthetic-thread"),
    docket: O.some("0000.00001US01"),
    entry: DocketWrittenEntry.make({
      eventId: "evt-named",
      webLink: O.some("https://outlook.fixture.invalid/calendar/evt-named"),
    }),
    flags: [],
    matter: O.some("family 0000.00001 · dockets 0000.00001US01"),
    messageId: "m-named",
    messageLink: O.some("https://outlook.fixture.invalid/mail/m-named"),
    reason: "no-usable-date",
    receivedDate: O.some(RECEIVED),
    sender: O.some("examiner@example.com"),
    subject: O.some("Office action response"),
    title: O.some("Response to office action"),
  }),
  processedOn: RECEIVED,
  receivedAt: "2030-01-09T09:00:00.000Z",
});

const lineCount = (text: string) => A.length(A.filter(Str.split(text, "\n"), Str.isNonEmpty));

describe("@beep/docket-intake review hub questions", () => {
  it("maps a needs-review record's email, links, matter, docket and dates into the question input", () => {
    const input = questionInput(identified);

    assertSome(input.subject, "Office action response");
    assertSome(input.sender, "examiner@example.com");
    assertSome(input.messageLink, "https://outlook.fixture.invalid/mail/m-named");
    assertSome(input.entryLink, "https://outlook.fixture.invalid/calendar/evt-named");
    assertSome(input.matter, "family 0000.00001 · dockets 0000.00001US01");
    assertSome(input.docket, "0000.00001US01");
    assertSome(input.conversationId, "AAQkADsynthetic-thread");
    assertSome(
      O.map(input.receivedDate, (date) => date.toISOString()),
      "2030-01-09"
    );
    expect(A.map(input.candidateDates, ({ date }) => date.toISOString())).toStrictEqual(["2030-04-08"]);
    assertSome(input.title, "Response to office action");

    const old = questionInput(needsReview);
    assertNone(old.subject);
    assertNone(old.entryLink);
    assertNone(old.title);
    expect(old.candidateDates).toStrictEqual([]);

    const failed = questionInput(
      DocketLedgerRecord.make({
        ...needsReview,
        outcome: IntakeFailed.make({ messageId: "m-failed", stage: "review" }),
      })
    );
    expect(failed.outcome._tag).toBe("IntakeFailed");
  });

  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "stores a question that names its email, links it, and offers its candidate date",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "review-hub-" });
        const build1 = yield* Layer.build(makeDocketQuestionPublisherLayer(directory).pipe(Layer.provide(CryptoLayer)));
        const publisher = Context.get(build1, DocketQuestionPublisher);
        const build2 = yield* Layer.build(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory: directory })));
        const store = Context.get(build2, ReviewItemStore);

        yield* publisher.publish(DocketIntakeState.make({ ledger: { "m-named": identified } }));
        const [item] = yield* store.list;

        expect(item?.kind).toBe("question");
        expect(item?.text).toBe(
          'Docket intake found no date it could use in the email "Office action response". What is the deadline?'
        );
        expect(
          A.take(
            A.map(item?.kind === "question" ? item.facts : [], ({ text }) => text),
            4
          )
        ).toStrictEqual([
          'The email is "Office action response" from examiner@example.com, received January 9, 2030.',
          "Open the email in Outlook: https://outlook.fixture.invalid/mail/m-named",
          "Its needs-review calendar entry: https://outlook.fixture.invalid/calendar/evt-named",
          "Matter: family 0000.00001 · dockets 0000.00001US01",
        ]);
        const options = item?.kind === "question" ? item.options : [];
        expect(A.map(options, ({ optionId }) => optionId)).toStrictEqual([
          "use-2030-04-08",
          "handle-myself",
          "not-a-deadline",
        ]);
        // Choosing the date moves the needs-review entry under the item's own title, not a generic one.
        assertSome(
          O.flatMap(A.head(options), ({ write }) => O.map(write, ({ dueOn, title }) => [dueOn.toISOString(), title])),
          ["2030-04-08", "Response to office action"]
        );
      })
    );
  });

  it.layer(Layer.merge(PipelineLayer, FilesLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "stores one question per needs-review message, and nothing new on the next cycle",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const harness = yield* PipelineHarness;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "review-hub-" });
        yield* Ref.update(harness.state, (state) =>
          DocketIntakeState.make({ ...state, ledger: { ...state.ledger, "m-review": needsReview } })
        );
        const publisher = yield* Layer.build(
          makeDocketQuestionPublisherLayer(directory).pipe(Layer.provide(CryptoLayer))
        );
        const build3 = yield* Layer.build(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory: directory })));
        const store = Context.get(build3, ReviewItemStore);

        const first = yield* pollCycle(fixtureConfig).pipe(Effect.provideContext(publisher));
        const once = yield* fs.readFileString(`${directory}/items.jsonl`);
        yield* pollCycle(fixtureConfig).pipe(Effect.provideContext(publisher));
        const items = yield* store.list;

        expect([first.entered, first.needsReview]).toStrictEqual([1, 0]);
        expect(A.map(items, ({ itemId, kind }) => [kind, Str.replace(/:[0-9a-f]{32}$/u, "")(itemId)])).toStrictEqual([
          ["question", "docket-intake:agents-disagree"],
        ]);
        expect(lineCount(once)).toBe(1);
        const readFileString4 = yield* fs.readFileString(`${directory}/items.jsonl`);
        expect(readFileString4).toBe(once);
      })
    );
  });
});
