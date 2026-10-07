/**
 * Undo proofs: a run's journal is planned against an in-memory mailbox and
 * calendar, reported as a dry run, and applied under the file store.
 *
 * Every fixture is synthetic: invented ids, categories and timestamps.
 */
import { DocketDueDate } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  applyDocketUndo,
  clearDocketRun,
  DocketFileStoreOptions,
  DocketIntakeJournal,
  DocketJournalEntry,
  DocketRunId,
  DocketUndoPlan,
  dryRunDocketUndo,
  makeDocketFileJournalLayer,
  planDocketUndo,
  readDocketJournal,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketEntered,
  DocketIntakeState,
  DocketIntakeStore,
  DocketLedgerRecord,
  DocketNeedsReview,
  DocketWrittenEntry,
  IntakeFailed,
  NotDocketItem,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Cause, DateTime, Effect, Exit, HashMap, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import {
  DIRECTORY,
  event,
  FakeGraph,
  FakeGraphLayer,
  MAILBOX,
  mailMessage,
  StoreLayer,
  throttled,
} from "./DocketIntake.fixture.ts";
import type { DocketIntakeOutcome } from "@beep/law-practice-use-cases/DocketIntake";

const RUN = DocketRunId.make("run-20300109T100000000Z");
const OTHER_RUN = DocketRunId.make("run-20300110T100000000Z");
const DAY = LocalDate.make({ year: 2030, month: 1, day: 9 });

const UndoLayer = Layer.mergeAll(
  makeDocketFileJournalLayer(DocketFileStoreOptions.make({ directory: DIRECTORY })).pipe(
    Layer.provideMerge(StoreLayer)
  ),
  FakeGraphLayer
);

const at = DateTime.makeUnsafe("2030-01-09T10:00:01.000Z");

const created = (runId: DocketRunId, eventId: string) =>
  DocketJournalEntry.make({ at, eventId: O.some(eventId), kind: "event-created", runId });

const marked = (runId: DocketRunId, messageId: string, minute: number) =>
  DocketJournalEntry.make({
    at,
    kind: "message-marked",
    messageId: O.some(messageId),
    receivedAt: O.some(`2030-01-09T09:${Str.padStart(2, "0")(`${minute}`)}:00.000Z`),
    runId,
  });

const journal = [
  created(RUN, "e-provisional"),
  created(RUN, "e-provisional"),
  created(RUN, "e-verified"),
  created(RUN, "e-recategorised"),
  created(RUN, "e-gone"),
  created(RUN, "e-raced"),
  created(OTHER_RUN, "e-other"),
  marked(RUN, "m1", 30),
  marked(RUN, "m2", 40),
  marked(RUN, "m3", 50),
  marked(RUN, "m4", 55),
  marked(RUN, "m5", 58),
  marked(OTHER_RUN, "m-other", 1),
  // A message line without a message id names nothing to undo.
  DocketJournalEntry.make({ at, kind: "message-marked", runId: RUN }),
];

const undoLine = (
  runId: DocketRunId,
  kind: DocketJournalEntry["kind"],
  ids: { eventId?: string; messageId?: string }
) =>
  DocketJournalEntry.make({
    at,
    eventId: O.fromUndefinedOr(ids.eventId),
    kind,
    messageId: O.fromUndefinedOr(ids.messageId),
    runId,
  });

const writtenEntry = (eventId: string) => DocketWrittenEntry.make({ eventId });

const record = (outcome: DocketIntakeOutcome, receivedAt: string) =>
  DocketLedgerRecord.make({ attempts: 1, outcome, processedOn: DAY, receivedAt });

const needsReview = (messageId: string, eventId: string) =>
  DocketNeedsReview.make({ entry: writtenEntry(eventId), flags: [], messageId, reason: "no-usable-date" });

const ledger = {
  m1: record(
    DocketEntered.make({
      dueDate: DocketDueDate.make({
        basis: "stated",
        computed: O.none(),
        date: LocalDate.make({ year: 2030, month: 4, day: 8 }),
        stated: O.some(LocalDate.make({ year: 2030, month: 4, day: 8 })),
      }),
      entry: writtenEntry("e-provisional"),
      flags: [],
      messageId: "m1",
      reminders: [writtenEntry("e-reminder")],
    }),
    "2030-01-09T09:30:00.000Z"
  ),
  m2: record(needsReview("m2", "e-verified"), "2030-01-09T09:40:00.000Z"),
  // Its mark failed, so only the event it got ties it to the run.
  "m-unmarked": record(needsReview("m-unmarked", "e-recategorised"), "2030-01-09T09:20:00.000Z"),
  "m-quiet": record(NotDocketItem.make({ messageId: "m-quiet" }), "2030-01-09T09:10:00.000Z"),
  "m-failing": record(IntakeFailed.make({ messageId: "m-failing", stage: "review" }), "2030-01-09T09:59:00.000Z"),
  "m-other": record(needsReview("m-other", "e-other"), "2030-01-09T09:01:00.000Z"),
};

const savedState = DocketIntakeState.make({
  cursor: O.some("2030-01-09T12:00:00.000Z"),
  digestedThrough: O.some(DAY),
  ledger,
});

// The mailbox and calendar as the attorney left them after the run.
const seed = Effect.gen(function* () {
  const fake = yield* FakeGraph;
  const store = yield* DocketIntakeStore;
  const journalService = yield* DocketIntakeJournal;
  yield* Ref.set(
    fake.events,
    HashMap.fromIterable(
      A.map(
        [
          event({ categories: ["Docket - unverified"], id: "e-provisional" }),
          event({ categories: ["Docket - verified"], id: "e-verified" }),
          event({ categories: ["Client - priority"], id: "e-recategorised" }),
          event({ categories: ["Docket - reminder"], id: "e-raced" }),
          event({ categories: ["Docket - unverified"], id: "e-other" }),
        ],
        (value) => [value.id, value] as const
      )
    )
  );
  yield* Ref.set(
    fake.messages,
    HashMap.fromIterable(
      A.map(
        [
          mailMessage({ categories: ["M: FIX-0001", "Docket - entered"], id: "m1" }),
          mailMessage({ categories: ["Docket - entered", "Follow up"], id: "m2" }),
          mailMessage({ categories: ["M: FIX-0002"], id: "m4" }),
          mailMessage({ categories: ["Docket - entered"], id: "m5" }),
          mailMessage({ categories: ["Docket - entered"], id: "m-other" }),
        ],
        (value) => [value.id, value] as const
      )
    )
  );
  yield* store.save(savedState);
  yield* journalService.append(journal);
});

const categoriesOf = Effect.fnUntraced(function* (messageId: string) {
  const fake = yield* FakeGraph;
  return O.flatMap(HashMap.get(yield* Ref.get(fake.messages), messageId), (value) => value.categories);
});

const plan = Effect.gen(function* () {
  return yield* planDocketUndo({
    entries: yield* readDocketJournal(DIRECTORY),
    mailbox: MAILBOX,
    runId: RUN,
    state: yield* (yield* DocketIntakeStore).load,
  });
});

describe("@beep/law-practice-server DocketIntake undo", () => {
  it.layer(UndoLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "plans and reports a dry run without writing anything",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeGraph;
        const store = yield* DocketIntakeStore;
        yield* seed;

        const planned = yield* plan;
        const report = dryRunDocketUndo(planned, yield* store.load);
        const verbs = A.map(yield* Ref.get(fake.calls), (call) => A.headNonEmpty(Str.split(" ")(call)));

        expect(A.map(planned.events, (target) => [target.eventId, target.action])).toStrictEqual([
          ["e-provisional", "delete"],
          ["e-verified", "keep"],
          ["e-recategorised", "keep"],
          ["e-gone", "gone"],
          ["e-raced", "delete"],
        ]);
        expect(A.map(planned.messages, (target) => [target.messageId, target.action])).toStrictEqual([
          ["m1", "unmark"],
          ["m2", "unmark"],
          ["m3", "gone"],
          ["m4", "unmark"],
          ["m5", "unmark"],
        ]);
        expect(report).toMatchObject({
          deleted: 2,
          dryRun: true,
          gone: 1,
          kept: 2,
          ledgerCleared: 3,
          messagesGone: 1,
          runId: RUN,
          unmarked: 4,
        });
        expect(A.dedupe(verbs)).toStrictEqual(["getEvent", "getMessage"]);
        const unchanged = yield* store.load;
        expect(R.keys(unchanged.ledger)).toStrictEqual(R.keys(savedState.ledger));
        expect(unchanged.cursor).toStrictEqual(savedState.cursor);
      })
    );
  });

  it.layer(UndoLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "deletes provisional events, keeps the attorney's, unmarks messages and clears the ledger",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeGraph;
        const store = yield* DocketIntakeStore;
        yield* seed;
        const planned = yield* plan;
        // Between the plan and the undo, one event and one message disappear, and one message
        // changes, so its first write is refused as stale.
        yield* Ref.update(fake.events, HashMap.remove("e-raced"));
        yield* Ref.update(fake.messages, HashMap.remove("m5"));
        yield* Ref.set(fake.staleWrites, 1);

        const report = yield* applyDocketUndo({ mailbox: MAILBOX, plan: planned });
        const state = yield* store.load;
        const undoLines = A.filter(yield* readDocketJournal(DIRECTORY), (line) => Str.startsWith("undo-")(line.kind));

        expect(report).toMatchObject({
          deleted: 1,
          dryRun: false,
          gone: 2,
          kept: 2,
          ledgerCleared: 3,
          messagesGone: 2,
          unmarked: 3,
        });
        expect(A.sort(A.fromIterable(HashMap.keys(yield* Ref.get(fake.events))), Str.Order)).toStrictEqual([
          "e-other",
          "e-recategorised",
          "e-verified",
        ]);
        assertSome(yield* categoriesOf("m1"), ["M: FIX-0001"]);
        assertSome(yield* categoriesOf("m2"), ["Follow up"]);
        assertSome(yield* categoriesOf("m4"), ["M: FIX-0002"]);
        assertSome(yield* categoriesOf("m-other"), ["Docket - entered"]);
        expect(A.sort(R.keys(state.ledger), Str.Order)).toStrictEqual(["m-failing", "m-other", "m-quiet"]);
        // The cursor moves back to the earliest message the run touched, so it is listed again.
        assertSome(state.cursor, "2030-01-09T09:20:00.000Z");
        assertSome(
          O.map(state.digestedThrough, (day) => day.toISOString()),
          "2030-01-09"
        );
        expect(A.map(undoLines, (line) => [line.kind, line.runId])).toStrictEqual([
          ["undo-event-deleted", RUN],
          ["undo-event-kept", RUN],
          ["undo-event-kept", RUN],
          ["undo-event-gone", RUN],
          ["undo-event-gone", RUN],
          ["undo-message-unmarked", RUN],
          ["undo-message-unmarked", RUN],
          ["undo-message-gone", RUN],
          ["undo-message-unmarked", RUN],
          ["undo-message-gone", RUN],
        ]);
        expect(A.length(A.filter(yield* Ref.get(fake.calls), Str.startsWith("updateMessageCategories")))).toBe(3);
      })
    );
  });

  it.layer(UndoLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails with the Graph reason when the mailbox throttles",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeGraph;
        yield* seed;
        yield* Ref.set(fake.failing, HashMap.make(["getEvent", throttled]));

        const exit = yield* Effect.exit(plan);

        assertSome(
          Exit.match(exit, {
            onFailure: (cause) => O.map(Cause.findErrorOption(cause), (error) => [error.cause, error.stage]),
            onSuccess: () => O.none(),
          }),
          ["throttled", "calendar"]
        );
      })
    );
  });

  it.layer(UndoLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "deletes an event only when every category it carries is provisional, adopted ones included",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeGraph;
        const journalService = yield* DocketIntakeJournal;
        yield* Ref.set(
          fake.events,
          HashMap.fromIterable(
            A.map(
              [
                event({ categories: ["Docket - unverified", "Docket - reminder"], id: "e-ours" }),
                event({ categories: ["Docket - unverified", "Docket - verified"], id: "e-verified-added" }),
                event({ categories: ["Docket - unverified", "Client - fixture"], id: "e-client-added" }),
                event({ categories: [], id: "e-uncategorised" }),
                event({ categories: ["Docket - needs review"], id: "e-adopted" }),
              ],
              (value) => [value.id, value] as const
            )
          )
        );
        yield* journalService.append([
          created(RUN, "e-ours"),
          created(RUN, "e-verified-added"),
          created(RUN, "e-client-added"),
          created(RUN, "e-uncategorised"),
          undoLine(RUN, "event-adopted", { eventId: "e-adopted" }),
        ]);

        const planned = yield* plan;
        yield* applyDocketUndo({ mailbox: MAILBOX, plan: planned });

        expect(A.map(planned.events, (target) => [target.eventId, target.action])).toStrictEqual([
          ["e-ours", "delete"],
          ["e-verified-added", "keep"],
          ["e-client-added", "keep"],
          ["e-uncategorised", "keep"],
          ["e-adopted", "delete"],
        ]);
        expect(A.sort(A.fromIterable(HashMap.keys(yield* Ref.get(fake.events))), Str.Order)).toStrictEqual([
          "e-client-added",
          "e-uncategorised",
          "e-verified-added",
        ]);
      })
    );
  });

  it.layer(UndoLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "resumes a halfway undo without touching what it already did",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeGraph;
        const store = yield* DocketIntakeStore;
        const journalService = yield* DocketIntakeJournal;
        yield* Ref.set(
          fake.events,
          HashMap.make(["e-left", event({ categories: ["Docket - unverified"], id: "e-left" })])
        );
        yield* Ref.set(
          fake.messages,
          HashMap.fromIterable(
            A.map(
              [mailMessage({ categories: [], id: "m1" }), mailMessage({ categories: ["Docket - entered"], id: "m2" })],
              (value) => [value.id, value] as const
            )
          )
        );
        yield* store.save(
          DocketIntakeState.make({
            cursor: O.some("2030-01-09T12:00:00.000Z"),
            ledger: { m1: ledger.m1, m2: ledger.m2 },
          })
        );
        // The first undo deleted e-provisional, unmarked m1 and stopped before anything else,
        // so the ledger still holds both messages.
        yield* journalService.append([
          created(RUN, "e-provisional"),
          created(RUN, "e-left"),
          marked(RUN, "m1", 30),
          marked(RUN, "m2", 40),
          undoLine(RUN, "undo-event-deleted", { eventId: "e-provisional" }),
          undoLine(RUN, "undo-message-unmarked", { messageId: "m1" }),
        ]);

        const planned = yield* plan;
        const report = yield* applyDocketUndo({ mailbox: MAILBOX, plan: planned });
        const calls = yield* Ref.get(fake.calls);
        const undoLines = A.filter(yield* readDocketJournal(DIRECTORY), (line) => Str.startsWith("undo-")(line.kind));

        expect(A.map(planned.events, (target) => [target.eventId, target.action])).toStrictEqual([
          ["e-provisional", "undone"],
          ["e-left", "delete"],
        ]);
        expect(A.map(planned.messages, (target) => [target.messageId, target.action])).toStrictEqual([
          ["m1", "undone"],
          ["m2", "unmark"],
        ]);
        expect(report).toMatchObject({ alreadyUndone: 2, deleted: 1, ledgerCleared: 2, unmarked: 1 });
        expect(A.some(calls, (call) => Str.endsWith(" e-provisional")(call) || Str.endsWith(" m1")(call))).toBe(false);
        expect(A.map(undoLines, (line) => line.kind)).toStrictEqual([
          "undo-event-deleted",
          "undo-message-unmarked",
          "undo-event-deleted",
          "undo-message-unmarked",
        ]);
        assertSome(yield* categoriesOf("m2"), []);
        expect(R.keys((yield* store.load).ledger)).toStrictEqual([]);
      })
    );
  });

  it.layer(UndoLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "undoing a run again leaves a later run's mark, ledger record and event alone",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeGraph;
        const store = yield* DocketIntakeStore;
        const journalService = yield* DocketIntakeJournal;
        yield* Ref.set(
          fake.events,
          HashMap.make(["e-provisional", event({ categories: ["Docket - unverified"], id: "e-provisional" })])
        );
        yield* Ref.set(
          fake.messages,
          HashMap.make(["m1", mailMessage({ categories: ["Docket - entered"], id: "m1" })])
        );
        yield* store.save(
          DocketIntakeState.make({ cursor: O.some("2030-01-09T12:00:00.000Z"), ledger: { m1: ledger.m1 } })
        );
        yield* journalService.append([created(RUN, "e-provisional"), marked(RUN, "m1", 30)]);
        const first = yield* applyDocketUndo({ mailbox: MAILBOX, plan: yield* plan });

        // The later run reads m1 again, enters it under a new event and marks it.
        const laterRecord = record(needsReview("m1", "e-later"), "2030-01-09T09:30:00.000Z");
        yield* Ref.update(
          fake.events,
          HashMap.set("e-later", event({ categories: ["Docket - needs review"], id: "e-later" }))
        );
        yield* Ref.update(
          fake.messages,
          HashMap.set("m1", mailMessage({ categories: ["Docket - entered"], id: "m1" }))
        );
        yield* store.save(
          DocketIntakeState.make({ cursor: O.some("2030-01-09T12:00:00.000Z"), ledger: { m1: laterRecord } })
        );
        yield* journalService.append([created(OTHER_RUN, "e-later"), marked(OTHER_RUN, "m1", 30)]);
        const linesBefore = A.length(yield* readDocketJournal(DIRECTORY));
        yield* Ref.set(fake.calls, []);

        const replanned = yield* plan;
        const again = yield* applyDocketUndo({ mailbox: MAILBOX, plan: replanned });
        const state = yield* store.load;

        expect(first).toMatchObject({ deleted: 1, ledgerCleared: 1, unmarked: 1 });
        expect(A.map(replanned.messages, (target) => [target.messageId, target.action])).toStrictEqual([
          ["m1", "keep"],
        ]);
        assertSome(
          O.flatMap(A.head(replanned.messages), (target) => target.markedLaterBy),
          OTHER_RUN
        );
        expect(again).toMatchObject({ alreadyUndone: 1, deleted: 0, ledgerCleared: 0, messagesKept: 1, unmarked: 0 });
        assertSome(yield* categoriesOf("m1"), ["Docket - entered"]);
        expect(HashMap.has(yield* Ref.get(fake.events), "e-later")).toBe(true);
        expect(R.keys(state.ledger)).toStrictEqual(["m1"]);
        expect(O.getOrUndefined(R.get(state.ledger, "m1"))?.outcome).toMatchObject({ entry: { eventId: "e-later" } });
        expect(A.length(yield* readDocketJournal(DIRECTORY))).toBe(linesBefore);
        expect(yield* Ref.get(fake.calls)).toStrictEqual([]);
      })
    );
  });

  it.layer(UndoLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "keeps an event a later run's ledger record still names",
      Effect.fnUntraced(function* () {
        const fake = yield* FakeGraph;
        const store = yield* DocketIntakeStore;
        const journalService = yield* DocketIntakeJournal;
        // Run A created e-found-later and marked m-found-later, but its ledger record was lost; the later run found
        // e-found-later by key (already journaled, so no adopted line), marked m-found-later and saved a record naming it.
        yield* Ref.set(
          fake.events,
          HashMap.make(["e-found-later", event({ categories: ["Docket - unverified"], id: "e-found-later" })])
        );
        yield* Ref.set(
          fake.messages,
          HashMap.make(["m-found-later", mailMessage({ categories: ["Docket - entered"], id: "m-found-later" })])
        );
        yield* store.save(
          DocketIntakeState.make({
            cursor: O.some("2030-01-09T12:00:00.000Z"),
            ledger: {
              "m-found-later": record(needsReview("m-found-later", "e-found-later"), "2030-01-09T09:30:00.000Z"),
            },
          })
        );
        yield* journalService.append([
          created(RUN, "e-found-later"),
          marked(RUN, "m-found-later", 30),
          marked(OTHER_RUN, "m-found-later", 30),
        ]);

        const planned = yield* plan;
        const report = yield* applyDocketUndo({ mailbox: MAILBOX, plan: planned });

        expect(A.map(planned.events, (target) => [target.eventId, target.action])).toStrictEqual([
          ["e-found-later", "keep"],
        ]);
        expect(report).toMatchObject({ deleted: 0, kept: 1, ledgerCleared: 0, messagesKept: 1 });
        expect(HashMap.has(yield* Ref.get(fake.events), "e-found-later")).toBe(true);
        assertSome(yield* categoriesOf("m-found-later"), ["Docket - entered"]);
        expect(R.keys((yield* store.load).ledger)).toStrictEqual(["m-found-later"]);
      })
    );
  });

  it("leaves a state with no cursor without one", () => {
    const cleared = clearDocketRun(
      DocketIntakeState.make({ ledger }),
      DocketUndoPlan.make({ events: [], messages: [], runId: RUN })
    );

    assertNone(cleared.state.cursor);
    expect(cleared.cleared).toBe(0);
  });
});
