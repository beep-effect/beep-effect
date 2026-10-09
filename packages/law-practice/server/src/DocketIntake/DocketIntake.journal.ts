/**
 * The write journal of the docket intake service: one line for every calendar
 * entry it creates and every message it marks, so a run can be listed and
 * undone.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  DocketCalendar,
  DocketIntakeError,
  DocketIntakeStore,
  DocketMailbox,
  DocketPollReport,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DocketCalendarEntry, DocketWrittenEntry } from "@beep/law-practice-use-cases/DocketIntake";
import type { DocketFileStoreOptions } from "./DocketIntake.store.ts";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.journal");

const JOURNAL_FILE = "journal.jsonl";
const LINE_BREAK = "\n";
const LINE_FEED = 0x0a;

/**
 * Id of one poll cycle, the unit `runs` lists and `undo` takes back.
 *
 * **Details**
 *
 * It reads `run-` followed by the UTC instant the cycle started, to the
 * millisecond, with the separators removed: `run-20300109T100000123Z`. Ids of
 * later runs sort after ids of earlier ones. An instant outside the years
 * 0000 to 9999 keeps its sign and extra year digits, so every instant has an
 * id.
 *
 * **Example** (Check a run id)
 *
 * ```ts
 * import { DocketRunId } from "@beep/law-practice-server/DocketIntake";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(DocketRunId)("run-20300109T100000123Z")); // true
 * console.log(S.is(DocketRunId)("latest")); // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketRunId = S.String.check(S.isPattern(/^run-[+-]?\d{8,}T\d{9}Z$/)).pipe(
  S.brand("DocketRunId"),
  $I.annoteSchema("DocketRunId", { description: "Id of one docket intake poll cycle." })
);

/**
 * Type of {@link DocketRunId}.
 *
 * **Example** (Type a run id)
 *
 * ```ts
 * import { DocketRunId } from "@beep/law-practice-server/DocketIntake";
 *
 * const runId: DocketRunId = DocketRunId.make("run-20300109T100000123Z");
 * console.log(runId);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketRunId = typeof DocketRunId.Type;

const compactInstant = Str.replace(/[-:.]/g, "");

/**
 * The run id of a cycle that starts at the given instant.
 *
 * **Example** (Mint a run id)
 *
 * ```ts
 * import { makeDocketRunId } from "@beep/law-practice-server/DocketIntake";
 * import * as DateTime from "effect/DateTime";
 * console.log(makeDocketRunId(DateTime.makeUnsafe("2030-01-09T10:00:00.123Z"))); // run-20300109T100000123Z
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDocketRunId = (instant: DateTime.DateTime): DocketRunId =>
  DocketRunId.make(`run-${instant.pipe(DateTime.toUtc, DateTime.formatIso, compactInstant)}`);

/**
 * What one journal line records.
 *
 * **Details**
 *
 * `event-created` and `message-marked` are the writes of a poll cycle.
 * `event-adopted` names an event a cycle found by its key that no earlier
 * line names, such as one created by a cycle that stopped before it could
 * journal the create; an undo treats it as created by the adopting run. The
 * `undo-` kinds are what an undo of that run found and did: an event it
 * deleted, kept (the attorney had confirmed or recategorised it) or found
 * gone, and a message it unmarked or found gone. `run-completed` closes every
 * poll cycle, including one that wrote nothing, with the cycle's counts, so
 * every run is listed and can be undone; journals written before it existed
 * simply have no such lines.
 *
 * **Example** (Check a journal kind)
 *
 * ```ts
 * import { DocketJournalKind } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketJournalKind.is["event-created"]("event-created")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketJournalKind = LiteralKit([
  "event-created",
  "event-adopted",
  "message-marked",
  "undo-event-deleted",
  "undo-event-kept",
  "undo-event-gone",
  "undo-message-unmarked",
  "undo-message-gone",
  "run-completed",
]).pipe($I.annoteSchema("DocketJournalKind", { description: "What one docket intake journal line records." }));

/**
 * Type of {@link DocketJournalKind}.
 *
 * **Example** (Type a journal kind)
 *
 * ```ts
 * import type { DocketJournalKind } from "@beep/law-practice-server/DocketIntake";
 *
 * const kind: DocketJournalKind = "message-marked";
 * console.log(kind);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketJournalKind = typeof DocketJournalKind.Type;

const optionalKey = <Value extends S.Top>(value: Value, description: string) =>
  S.OptionFromOptionalKey(value).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({ description });

/**
 * One line of the write journal. It carries ids, a category and timestamps,
 * never message content.
 *
 * **Example** (Record a created event)
 *
 * ```ts
 * import { DocketJournalEntry, DocketRunId } from "@beep/law-practice-server/DocketIntake";
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option";
 *
 * const line = DocketJournalEntry.make({
 *   at: DateTime.makeUnsafe("2030-01-09T10:00:01.000Z"),
 *   category: O.some("Docket - unverified"),
 *   eventId: O.some("event-1"),
 *   idempotencyKey: O.some("docket:0f3a"),
 *   kind: "event-created",
 *   runId: DocketRunId.make("run-20300109T100000000Z")
 * });
 * console.log(line.kind);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketJournalEntry extends S.Class<DocketJournalEntry>($I`DocketJournalEntry`)(
  {
    runId: DocketRunId.annotateKey({ description: "The run the line belongs to." }),
    kind: DocketJournalKind.annotateKey({ description: "What the line records." }),
    at: S.DateTimeUtcFromString.annotateKey({ description: "When it happened, as UTC ISO-8601." }),
    eventId: optionalKey(S.NonEmptyString, "Calendar event id, on an event line."),
    messageId: optionalKey(S.NonEmptyString, "Message id, on a message line."),
    receivedAt: optionalKey(S.NonEmptyString, "UTC receipt time of the message, on a message line."),
    idempotencyKey: optionalKey(S.NonEmptyString, "Idempotency key of a created event."),
    category: optionalKey(DocketCategory, "Docket category of a created event."),
    counts: optionalKey(DocketPollReport, "Counts of the cycle, on a run-completed line."),
  },
  $I.annote("DocketJournalEntry", { description: "One line of the docket intake write journal." })
) {}

const JournalLine = S.fromJsonString(DocketJournalEntry);
const encodeJournalLine = S.encodeEffect(JournalLine);
const encodeLine = (entry: DocketJournalEntry) => encodeJournalLine(entry);
const decodeJournalLine = S.decodeUnknownEffect(JournalLine);
const decodeLine = (line: string) => decodeJournalLine(line);

const journalError = (cause: string) => () => DocketIntakeError.make({ cause, stage: "store" });

const textEncoder = new TextEncoder();

/**
 * Service shape of the write journal.
 *
 * **Example** (Name a journal method)
 *
 * ```ts
 * import type { DocketIntakeJournalShape } from "@beep/law-practice-server/DocketIntake";
 *
 * const method: keyof DocketIntakeJournalShape = "beginRun";
 * console.log(method);
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DocketIntakeJournalShape {
  /** Append lines to the journal and flush them to disk before succeeding. */
  readonly append: (entries: ReadonlyArray<DocketJournalEntry>) => Effect.Effect<void, DocketIntakeError>;
  /** Mint the id of a new run from the current time; later writes are recorded under it. */
  readonly beginRun: Effect.Effect<DocketRunId>;
  /** The id writes are recorded under now. */
  readonly currentRun: Effect.Effect<DocketRunId>;
  /** Every line of the journal, oldest first. */
  readonly entries: Effect.Effect<ReadonlyArray<DocketJournalEntry>, DocketIntakeError>;
}

/**
 * The write journal of the docket intake service.
 *
 * **Example** (Reference the journal service)
 *
 * ```ts
 * import { DocketIntakeJournal } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketIntakeJournal.key);
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DocketIntakeJournal extends Context.Service<DocketIntakeJournal, DocketIntakeJournalShape>()(
  $I`DocketIntakeJournal`
) {}

const journalPath = Effect.fnUntraced(function* (directory: string) {
  const path = yield* Path.Path;
  return path.join(directory, JOURNAL_FILE);
});

// Cut a final line a crash left without its line break, so the next append starts a line of its
// own instead of being glued onto the torn one.
const repairTornTail = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, file: string) {
  if (!(yield* fs.exists(file))) {
    return;
  }
  const bytes = yield* fs.readFile(file);
  const complete = bytes.lastIndexOf(LINE_FEED) + 1;
  if (complete < bytes.length) {
    yield* fs.truncate(file, complete);
  }
});

/**
 * Build the file-backed write journal, `journal.jsonl` in the state
 * directory.
 *
 * **Details**
 *
 * Each line is one schema-encoded {@link DocketJournalEntry}. The directory
 * is created when the layer is built, and a final line a crash left without
 * its line break is cut off then, so later appends stay readable. Lines are only ever appended, and every
 * append is synced to disk before it succeeds. The layer needs the file
 * store: building the store takes `state.lock`, so the journal is only
 * written by the one process that holds the state directory.
 * The run id starts as the time the layer was built; `beginRun` replaces it
 * at the start of each cycle.
 *
 * **Example** (Make the journal layer)
 *
 * ```ts
 * import { DocketFileStoreOptions, makeDocketFileJournalLayer } from "@beep/law-practice-server/DocketIntake";
 *
 * const layer = makeDocketFileJournalLayer(DocketFileStoreOptions.make({ directory: "state/docket-intake" }));
 * console.log(layer);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketFileJournalLayer = (
  options: DocketFileStoreOptions
): Layer.Layer<DocketIntakeJournal, DocketIntakeError, DocketIntakeStore | FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    DocketIntakeJournal,
    Effect.gen(function* () {
      // The store is not used here; requiring it means the state lock is held while the journal is open.
      yield* DocketIntakeStore;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const file = yield* journalPath(options.directory);
      yield* fs
        .makeDirectory(options.directory, { recursive: true })
        .pipe(Effect.mapError(journalError("journal-directory")));
      yield* repairTornTail(fs, file).pipe(Effect.mapError(journalError("journal-repair")));
      const read = readDocketJournal(options.directory).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path)
      );
      const mint = Effect.map(DateTime.now, makeDocketRunId);
      const run = yield* Ref.make(yield* mint);

      return DocketIntakeJournal.of({
        append: Effect.fn("DocketJournal.append")(function* (entries) {
          const lines = yield* Effect.forEach(entries, encodeLine).pipe(
            Effect.mapError(journalError("journal-encode"))
          );
          yield* Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* fs.open(file, { flag: "a" });
              yield* handle.writeAll(textEncoder.encode(A.join(A.map(lines, Str.concat(LINE_BREAK)), "")));
              yield* handle.sync;
            })
          ).pipe(Effect.mapError(journalError("journal-write")));
        }),
        beginRun: Effect.tap(mint, (runId) => Ref.set(run, runId)),
        currentRun: Ref.get(run),
        entries: read,
      });
    }).pipe(Effect.withSpan("DocketJournal.make"))
  );

/**
 * Read every line of a state directory's journal, oldest first, without
 * taking the state lock.
 *
 * **Details**
 *
 * A missing journal reads as no lines. A final line without its line break,
 * left by a crash in the middle of an append, is skipped. Any other line that
 * does not decode fails at stage `store` with cause `journal-decode`.
 *
 * **Example** (Read the journal)
 *
 * ```ts
 * import { readDocketJournal } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(readDocketJournal("state/docket-intake"));
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const readDocketJournal: (
  directory: string
) => Effect.Effect<ReadonlyArray<DocketJournalEntry>, DocketIntakeError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocketJournal.read"
)(function* (directory) {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* journalPath(directory);
  const exists = yield* fs.exists(file).pipe(Effect.mapError(journalError("journal-stat")));
  if (!exists) {
    return A.empty<DocketJournalEntry>();
  }
  const contents = yield* fs.readFileString(file).pipe(Effect.mapError(journalError("journal-read")));
  // Every complete line ends with a break, so the last piece is empty or an unfinished line.
  const complete = A.dropRight(Str.split(LINE_BREAK)(contents), 1);
  return yield* Effect.forEach(complete, decodeLine).pipe(Effect.mapError(journalError("journal-decode")));
});

// Record a write that already succeeded. A write the journal cannot record is one an undo could
// not find, so the failure stops the cycle instead of being swallowed as a port failure.
const recordWrite = Effect.fnUntraced(function* (
  journal: DocketIntakeJournalShape,
  fields: Omit<ConstructorParameters<typeof DocketJournalEntry>[0], "at" | "runId">
) {
  const runId = yield* journal.currentRun;
  const at = yield* DateTime.now;
  yield* journal.append([DocketJournalEntry.make({ ...fields, at, runId })]).pipe(Effect.orDie);
});

const isEventLine = (line: DocketJournalEntry) =>
  line.kind === DocketJournalKind.Enum["event-created"] || line.kind === DocketJournalKind.Enum["event-adopted"];

// Journal an event the pipeline found by its key when no line names it yet: a cycle created it
// and stopped before the create was journaled, so without this line no undo could reach it.
const adopt = Effect.fnUntraced(function* (journal: DocketIntakeJournalShape, key: string, found: DocketWrittenEntry) {
  const lines = yield* journal.entries.pipe(Effect.orDie);
  const known = A.some(lines, (line) => isEventLine(line) && O.contains(line.eventId, found.eventId));
  if (!known) {
    yield* recordWrite(journal, {
      eventId: O.some(found.eventId),
      idempotencyKey: O.some(key),
      kind: DocketJournalKind.Enum["event-adopted"],
    });
  }
});

const createdLine = (entry: DocketCalendarEntry, written: DocketWrittenEntry) => ({
  category: O.some(entry.category),
  eventId: O.some(written.eventId),
  idempotencyKey: O.some(entry.key),
  kind: DocketJournalKind.Enum["event-created"],
});

/**
 * Calendar and mailbox ports that record every successful write in the
 * journal, decorating the ports below them.
 *
 * **Details**
 *
 * `create` records an `event-created` line after the event exists, and
 * `markEntered` a `message-marked` line after the message is marked. A failed
 * write records nothing. An entry the pipeline finds by its key is not a
 * write and records nothing when a journal line already names it; one no
 * line names, which is what a cycle that stopped between a create and its
 * line leaves behind, gets an `event-adopted` line under the current run, so
 * undoing that run reaches it. When a create fails as an ambiguous write, the
 * decorator looks the event up by its key, as the pipeline would: an event
 * found there was created by this call and is recorded and returned. A line
 * the journal cannot write or read stops the cycle as a defect, because a
 * write missing from the journal could not be undone. The mailbox reads pass
 * through unchanged.
 *
 * **Example** (Decorate the ports)
 *
 * ```ts
 * import { DocketJournalingPortsLive } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketJournalingPortsLive);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocketJournalingPortsLive: Layer.Layer<
  DocketCalendar | DocketMailbox,
  never,
  DocketCalendar | DocketIntakeJournal | DocketMailbox
> = Layer.effectContext(
  Effect.gen(function* () {
    const calendar = yield* DocketCalendar;
    const mailbox = yield* DocketMailbox;
    const journal = yield* DocketIntakeJournal;

    const created = (entry: DocketCalendarEntry) => (written: DocketWrittenEntry) =>
      recordWrite(journal, createdLine(entry, written));

    return Context.make(
      DocketCalendar,
      DocketCalendar.of({
        create: Effect.fn("DocketJournal.create")(function* (entry) {
          return yield* calendar.create(entry).pipe(
            Effect.catchIf(
              (error) => error.ambiguousWrite,
              (error) =>
                calendar
                  .findByKey(entry.key)
                  .pipe(Effect.flatMap(O.match({ onNone: () => Effect.fail(error), onSome: Effect.succeed })))
            ),
            Effect.tap(created(entry))
          );
        }),
        findByKey: Effect.fn("DocketJournal.findByKey")(function* (key) {
          const found = yield* calendar.findByKey(key);
          if (O.isSome(found)) {
            yield* adopt(journal, key, found.value);
          }
          return found;
        }),
      })
    ).pipe(
      Context.add(
        DocketMailbox,
        DocketMailbox.of({
          markEntered: Effect.fn("DocketJournal.markEntered")(function* (message) {
            yield* mailbox.markEntered(message);
            yield* recordWrite(journal, {
              kind: DocketJournalKind.Enum["message-marked"],
              messageId: O.some(message.messageId),
              receivedAt: O.some(message.receivedAt),
            });
          }),
          receivedSince: mailbox.receivedSince,
          sourceDocuments: mailbox.sourceDocuments,
        })
      )
    );
  })
);

/**
 * Journal the end of the current run with its counts.
 *
 * **Details**
 *
 * Every poll cycle ends with this line, also one that wrote nothing, so
 * `runs` lists every run and `undo` of a run that wrote nothing is a clean
 * no-op instead of an unknown run. A dry run has no journal and writes none.
 *
 * **Example** (Reference the completion record)
 *
 * ```ts
 * import { recordDocketRunCompleted } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(typeof recordDocketRunCompleted);
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const recordDocketRunCompleted = Effect.fn("DocketJournal.runCompleted")(function* (report: DocketPollReport) {
  const journal = yield* DocketIntakeJournal;
  const runId = yield* journal.currentRun;
  const at = yield* DateTime.now;
  yield* journal.append([
    DocketJournalEntry.make({ at, counts: O.some(report), kind: DocketJournalKind.Enum["run-completed"], runId }),
  ]);
});

/**
 * Counts of one run in the journal.
 *
 * **Example** (Read a run summary)
 *
 * ```ts
 * import { DocketRunSummary } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(Object.keys(DocketRunSummary.fields));
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketRunSummary extends S.Class<DocketRunSummary>($I`DocketRunSummary`)(
  {
    runId: DocketRunId.annotateKey({ description: "The run." }),
    startedAt: S.DateTimeUtcFromString.annotateKey({ description: "Time of the run's first journal line." }),
    eventsCreated: S.Natural.annotateKey({ description: "Calendar events the run created." }),
    messagesMarked: S.Natural.annotateKey({ description: "Messages the run marked entered." }),
    eventsDeleted: S.Natural.annotateKey({ description: "Events an undo of the run deleted." }),
    eventsKept: S.Natural.annotateKey({ description: "Events an undo of the run kept." }),
    eventsGone: S.Natural.annotateKey({ description: "Events an undo of the run found gone." }),
    messagesUnmarked: S.Natural.annotateKey({ description: "Messages an undo of the run unmarked." }),
    messagesGone: S.Natural.annotateKey({ description: "Messages an undo of the run found gone." }),
    eventsAdopted: S.Natural.annotateKey({
      description: "Events the run found by key that no earlier journal line named.",
    }),
    completed: optionalKey(DocketPollReport, "Counts of the cycle; absent for a run journaled before they were."),
  },
  $I.annote("DocketRunSummary", { description: "Counts of one docket intake run in the journal." })
) {}

const newestFirst = Order.flip(Order.mapInput(Str.Order, (summary: DocketRunSummary) => summary.runId));

const summarize = (lines: A.NonEmptyReadonlyArray<DocketJournalEntry>): DocketRunSummary => {
  const first = A.headNonEmpty(lines);
  const count = (kind: DocketJournalKind) => A.length(A.filter(lines, (line) => line.kind === kind));
  return DocketRunSummary.make({
    completed: O.flatMap(
      A.findLast(lines, (line) => line.kind === DocketJournalKind.Enum["run-completed"]),
      (line) => line.counts
    ),
    eventsAdopted: count("event-adopted"),
    eventsCreated: count("event-created"),
    eventsDeleted: count("undo-event-deleted"),
    eventsGone: count("undo-event-gone"),
    eventsKept: count("undo-event-kept"),
    messagesGone: count("undo-message-gone"),
    messagesMarked: count("message-marked"),
    messagesUnmarked: count("undo-message-unmarked"),
    runId: first.runId,
    startedAt: first.at,
  });
};

/**
 * One summary per run in the journal, newest run first.
 *
 * **Example** (Summarize an empty journal)
 *
 * ```ts
 * import { summarizeDocketRuns } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(summarizeDocketRuns([])); // []
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const summarizeDocketRuns = (entries: ReadonlyArray<DocketJournalEntry>): ReadonlyArray<DocketRunSummary> =>
  A.sort(A.map(R.values(A.groupBy(entries, (entry) => entry.runId)), summarize), newestFirst);

/**
 * The newest run in the journal, if it has any line.
 *
 * **Example** (Find the newest run)
 *
 * ```ts
 * import { DocketJournalEntry, DocketRunId, latestDocketRun } from "@beep/law-practice-server/DocketIntake";
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option";
 *
 * const line = (runId: string) =>
 *   DocketJournalEntry.make({
 *     at: DateTime.makeUnsafe("2030-01-09T10:00:00.000Z"),
 *     kind: "message-marked",
 *     messageId: O.some("m1"),
 *     runId: DocketRunId.make(runId)
 *   });
 * console.log(latestDocketRun([line("run-20300109T100000000Z"), line("run-20300110T100000000Z")]));
 * // Some("run-20300110T100000000Z")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const latestDocketRun = (entries: ReadonlyArray<DocketJournalEntry>): O.Option<DocketRunId> =>
  O.map(A.head(summarizeDocketRuns(entries)), (summary) => summary.runId);
