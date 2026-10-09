/**
 * Write journal proofs over an in-memory file system: the line format, the
 * append-only file, run ids, run summaries, and the port decorators that
 * record exactly the writes that succeeded.
 *
 * Every fixture is synthetic: invented ids and placeholder text.
 */
import {
  DocketFileStoreOptions,
  DocketIntakeJournal,
  DocketJournalEntry,
  DocketJournalingPortsLive,
  DocketRunId,
  latestDocketRun,
  makeDocketFileJournalLayer,
  makeDocketRunId,
  readDocketJournal,
  recordDocketRunCompleted,
  summarizeDocketRuns,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketCalendar,
  DocketCalendarEntry,
  DocketIntakeError,
  DocketMailbox,
  DocketMessage,
  DocketPollReport,
  DocketWrittenEntry,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DIRECTORY, StoreLayer } from "./DocketIntake.fixture.ts";

const JOURNAL = `${DIRECTORY}/journal.jsonl`;
const RUN = DocketRunId.make("run-19700101T000000000Z");
const LATER_RUN = DocketRunId.make("run-19700101T000001000Z");

const JournalLayer = makeDocketFileJournalLayer(DocketFileStoreOptions.make({ directory: DIRECTORY })).pipe(
  Layer.provideMerge(StoreLayer)
);

const entry = DocketCalendarEntry.make({
  bodyText: "Synthetic fixture entry.",
  category: "Docket - unverified",
  date: LocalDate.make({ year: 2030, month: 4, day: 8 }),
  key: "docket:0f3a",
  kind: "due",
  subject: "[UNVERIFIED] Due Date: fixture response",
  tentative: true,
});

const message = DocketMessage.make({
  bodyText: "Synthetic fixture body.",
  messageId: "m1",
  receivedAt: "2030-01-09T10:00:00.000Z",
  receivedDate: LocalDate.make({ year: 2030, month: 1, day: 9 }),
});

const portFailure = DocketIntakeError.make({ cause: "transport", stage: "calendar" });
const markFailure = DocketIntakeError.make({ cause: "transport", stage: "mailbox" });
const ambiguous = DocketIntakeError.make({ ambiguousWrite: true, cause: "ambiguous write", stage: "calendar" });

type InnerPortsShape = {
  /** What the next create does. */
  readonly create: Ref.Ref<Effect.Effect<DocketWrittenEntry, DocketIntakeError>>;
  /** What a lookup by key finds. */
  readonly found: Ref.Ref<O.Option<DocketWrittenEntry>>;
  /** What the next mark does. */
  readonly mark: Ref.Ref<Effect.Effect<void, DocketIntakeError>>;
};

class InnerPorts extends Context.Service<InnerPorts, InnerPortsShape>()(
  "@beep/law-practice-server/test/DocketIntake.journal.test/InnerPorts"
) {}

const written = DocketWrittenEntry.make({ eventId: "event-1" });

const InnerPortsLayer = Layer.effectContext(
  Effect.gen(function* () {
    const inner = InnerPorts.of({
      create: yield* Ref.make<Effect.Effect<DocketWrittenEntry, DocketIntakeError>>(Effect.succeed(written)),
      found: yield* Ref.make(O.none<DocketWrittenEntry>()),
      mark: yield* Ref.make<Effect.Effect<void, DocketIntakeError>>(Effect.void),
    });
    return Context.make(InnerPorts, inner).pipe(
      Context.add(
        DocketCalendar,
        DocketCalendar.of({
          create: Effect.fnUntraced(function* () {
            return yield* inner.create.pipe(Ref.get, Effect.flatten);
          }),
          findByKey: Effect.fnUntraced(function* () {
            return yield* Ref.get(inner.found);
          }),
        })
      ),
      Context.add(
        DocketMailbox,
        DocketMailbox.of({
          markEntered: Effect.fnUntraced(function* () {
            yield* inner.mark.pipe(Ref.get, Effect.flatten);
          }),
          receivedSince: Effect.fnUntraced(function* () {
            return yield* Effect.succeed([message]);
          }),
          sourceDocuments: Effect.fnUntraced(function* () {
            return yield* Effect.succeed([]);
          }),
        })
      )
    );
  })
);

const DecoratedLayer = DocketJournalingPortsLive.pipe(Layer.provideMerge(Layer.merge(InnerPortsLayer, JournalLayer)));

const journalLines = readDocketJournal(DIRECTORY);

const encodeJournalLine = S.encodeEffect(S.fromJsonString(DocketJournalEntry));

const kinds = (lines: ReadonlyArray<DocketJournalEntry>) => A.map(lines, (line) => line.kind);

const failureOf = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<O.Option<E>, never, R> =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));

const line = (runId: DocketRunId, kind: DocketJournalEntry["kind"], seconds = 0) =>
  DocketJournalEntry.make({
    at: DateTime.makeUnsafe(seconds * 1000),
    eventId: O.some(`event-${seconds}`),
    kind,
    runId,
  });

describe("@beep/law-practice-server DocketIntake journal", () => {
  it("mints run ids from the instant a cycle starts, to the millisecond", () => {
    expect(makeDocketRunId(DateTime.makeUnsafe("2030-01-09T10:00:00.123Z"))).toBe("run-20300109T100000123Z");
    expect(S.is(DocketRunId)("run-2030-01-09")).toBe(false);
  });

  it("summarizes the runs in a journal newest first and finds the latest", () => {
    const lines = [
      line(RUN, "event-created"),
      line(RUN, "message-marked", 1),
      line(LATER_RUN, "event-created", 2),
      line(LATER_RUN, "event-created", 3),
      line(RUN, "undo-event-deleted", 4),
      line(RUN, "undo-event-kept", 5),
      line(RUN, "undo-event-gone", 6),
      line(RUN, "undo-message-unmarked", 7),
      line(RUN, "undo-message-gone", 8),
      line(RUN, "event-adopted", 9),
    ];

    const summaries = summarizeDocketRuns(lines);

    expect(A.map(summaries, (summary) => summary.runId)).toStrictEqual([LATER_RUN, RUN]);
    expect(summaries[1]).toMatchObject({
      eventsCreated: 1,
      eventsDeleted: 1,
      eventsGone: 1,
      eventsKept: 1,
      messagesGone: 1,
      messagesMarked: 1,
      messagesUnmarked: 1,
      eventsAdopted: 1,
    });
    expect(summaries[0]?.eventsCreated).toBe(2);
    assertSome(latestDocketRun(lines), LATER_RUN);
    assertNone(latestDocketRun([]));
  });

  it.layer(JournalLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "appends schema-encoded lines and reads them back; a missing journal reads as empty",
      Effect.fnUntraced(function* () {
        const journal = yield* DocketIntakeJournal;
        const fs = yield* FileSystem.FileSystem;
        const before = yield* journalLines;

        yield* journal.append([line(RUN, "event-created")]);
        yield* journal.append([line(RUN, "message-marked", 1), line(RUN, "undo-event-kept", 2)]);
        const text = yield* fs.readFileString(JOURNAL);

        expect(before).toStrictEqual([]);
        expect(kinds(yield* journalLines)).toStrictEqual(["event-created", "message-marked", "undo-event-kept"]);
        assertSome(
          A.head(Str.split("\n")(text)),
          '{"runId":"run-19700101T000000000Z","kind":"event-created","at":"1970-01-01T00:00:00.000Z","eventId":"event-0"}'
        );
      })
    );
  });

  it.layer(JournalLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "closes a run with its counts, and still reads a journal written before runs were closed",
      Effect.fnUntraced(function* () {
        const journal = yield* DocketIntakeJournal;
        const fs = yield* FileSystem.FileSystem;
        // A line as the journal wrote it before run-completed existed.
        yield* fs.writeFileString(
          JOURNAL,
          '{"runId":"run-19691231T235959000Z","kind":"event-created","at":"1969-12-31T23:59:59.000Z","eventId":"event-old"}\n'
        );
        const runId = yield* journal.beginRun;

        yield* recordDocketRunCompleted(
          DocketPollReport.make({ entered: 0, failed: 0, needsReview: 0, notDocket: 2, processed: 2, seen: 3 })
        );
        const summaries = summarizeDocketRuns(yield* journalLines);

        expect(
          A.map(summaries, (summary) => [
            summary.runId,
            summary.eventsCreated,
            O.getOrNull(O.map(summary.completed, (counts) => [counts.seen, counts.processed, counts.notDocket])),
          ])
        ).toStrictEqual([
          [runId, 0, [3, 2, 2]],
          ["run-19691231T235959000Z", 1, null],
        ]);
      })
    );
  });

  it.layer(JournalLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "skips a final line a crash cut short and fails on any other line that does not decode",
      Effect.fnUntraced(function* () {
        const journal = yield* DocketIntakeJournal;
        const fs = yield* FileSystem.FileSystem;
        yield* journal.append([line(RUN, "event-created")]);

        yield* fs.writeFileString(JOURNAL, '{"runId":"run-', { flag: "a" });
        const torn = yield* journalLines;
        yield* fs.writeFileString(JOURNAL, '\n{"kind":"bogus"}\n', { flag: "a" });
        const failure = yield* failureOf(journalLines);

        expect(kinds(torn)).toStrictEqual(["event-created"]);
        assertSome(
          O.map(failure, (error) => error.cause),
          "journal-decode"
        );
      })
    );
  });

  it.layer(StoreLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "cuts a torn final line off when the journal is opened, so the next append stays readable",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const good = yield* encodeJournalLine(line(RUN, "event-created"));
        yield* fs.makeDirectory(DIRECTORY, { recursive: true });
        yield* fs.writeFileString(JOURNAL, `${good}\n{"runId":"run-`);

        const openJournal = Layer.build(
          makeDocketFileJournalLayer(DocketFileStoreOptions.make({ directory: DIRECTORY }))
        ).pipe(Effect.map(Context.get(DocketIntakeJournal)));

        // Opening the journal after the crash is what repairs it; opening an intact one changes nothing.
        yield* (yield* openJournal).append([line(RUN, "message-marked", 1)]);
        yield* (yield* openJournal).append([line(RUN, "undo-event-kept", 2)]);
        const lines = yield* journalLines;

        expect(kinds(lines)).toStrictEqual(["event-created", "message-marked", "undo-event-kept"]);
        expect(Str.endsWith("\n")(yield* fs.readFileString(JOURNAL))).toBe(true);
      })
    );
  });

  it.layer(JournalLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "starts a run under the current time on request and fails an append it cannot write",
      Effect.fnUntraced(function* () {
        const journal = yield* DocketIntakeJournal;
        const fs = yield* FileSystem.FileSystem;

        const begun = yield* journal.beginRun;
        const current = yield* journal.currentRun;
        yield* fs.remove(DIRECTORY, { recursive: true });
        const failure = yield* failureOf(journal.append([line(RUN, "event-created")]));
        const unreadable = yield* failureOf(journalLines);

        // The test clock stands at the Unix epoch.
        expect([begun, current]).toStrictEqual([RUN, RUN]);
        assertSome(
          O.map(failure, (error) => error.cause),
          "journal-write"
        );
        assertNone(unreadable);
      })
    );
  });

  it.layer(DecoratedLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "records exactly the writes that succeeded",
      Effect.fnUntraced(function* () {
        const calendar = yield* DocketCalendar;
        const mailbox = yield* DocketMailbox;
        const inner = yield* InnerPorts;

        const created = yield* calendar.create(entry);
        yield* mailbox.markEntered(message);
        yield* Ref.set(inner.create, Effect.fail(portFailure));
        yield* Ref.set(inner.mark, Effect.fail(markFailure));
        const failedCreate = yield* failureOf(calendar.create(entry));
        const failedMark = yield* failureOf(mailbox.markEntered(message));
        const lines = yield* journalLines;

        expect(created).toStrictEqual(written);
        assertSome(failedCreate, portFailure);
        assertSome(failedMark, markFailure);
        expect(kinds(lines)).toStrictEqual(["event-created", "message-marked"]);
        expect(
          A.map(lines, (line) => [
            line.runId,
            O.getOrNull(line.eventId),
            O.getOrNull(line.idempotencyKey),
            O.getOrNull(line.category),
            O.getOrNull(line.messageId),
            O.getOrNull(line.receivedAt),
          ])
        ).toStrictEqual([
          [RUN, "event-1", "docket:0f3a", "Docket - unverified", null, null],
          [RUN, null, null, null, "m1", "2030-01-09T10:00:00.000Z"],
        ]);
        // Reads pass through to the ports below.
        expect(yield* mailbox.receivedSince(O.none())).toStrictEqual([message]);
        expect(yield* mailbox.sourceDocuments(message)).toStrictEqual([]);
        assertNone(yield* calendar.findByKey(entry.key));
      })
    );
  });

  it.layer(DecoratedLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "records an ambiguous create the lookup proves happened, and passes on one it does not",
      Effect.fnUntraced(function* () {
        const calendar = yield* DocketCalendar;
        const inner = yield* InnerPorts;
        yield* Ref.set(inner.create, Effect.fail(ambiguous));

        const lost = yield* failureOf(calendar.create(entry));
        yield* Ref.set(inner.found, O.some(written));
        const recovered = yield* calendar.create(entry);

        assertSome(lost, ambiguous);
        expect(recovered).toStrictEqual(written);
        expect(kinds(yield* journalLines)).toStrictEqual(["event-created"]);
      })
    );
  });

  it.layer(DecoratedLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "adopts an event a crash left unjournaled when the next cycle finds it by key, and only once",
      Effect.fnUntraced(function* () {
        const calendar = yield* DocketCalendar;
        const inner = yield* InnerPorts;
        const fs = yield* FileSystem.FileSystem;
        // The create reaches the calendar, then the process dies before the line is written.
        yield* fs.remove(DIRECTORY, { recursive: true });
        const crashed = yield* Effect.exit(calendar.create(entry));
        yield* fs.makeDirectory(DIRECTORY, { recursive: true });
        yield* Ref.set(inner.found, O.some(written));

        const found = yield* calendar.findByKey(entry.key);
        yield* calendar.findByKey(entry.key);
        const lines = yield* journalLines;

        crashed.pipe(Exit.hasDies, assertTrue);
        assertSome(found, written);
        expect(
          A.map(lines, (line) => [line.kind, line.runId, O.getOrNull(line.eventId), O.getOrNull(line.idempotencyKey)])
        ).toStrictEqual([["event-adopted", RUN, "event-1", "docket:0f3a"]]);
      })
    );
  });

  it.layer(DecoratedLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "does not adopt an event the journal already names",
      Effect.fnUntraced(function* () {
        const calendar = yield* DocketCalendar;
        const inner = yield* InnerPorts;
        yield* calendar.create(entry);
        yield* Ref.set(inner.found, O.some(written));

        yield* calendar.findByKey(entry.key);

        expect(kinds(yield* journalLines)).toStrictEqual(["event-created"]);
      })
    );
  });

  it.layer(DecoratedLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "stops with a defect when a successful write cannot be journaled",
      Effect.fnUntraced(function* () {
        const calendar = yield* DocketCalendar;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(DIRECTORY, { recursive: true });

        const exit = yield* Effect.exit(calendar.create(entry));

        exit.pipe(Exit.hasDies, assertTrue);
      })
    );
  });
});
