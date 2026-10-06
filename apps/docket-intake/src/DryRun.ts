/**
 * The dry run of the docket intake service: one full pipeline pass over a
 * throwaway copy of the state, where the calendar and the mailbox record what
 * would be written and write nothing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  DocketRunId,
  docketDayInZone,
  makeDocketRunId,
  readDocketStateFile,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketCalendar,
  DocketEntryFlag,
  DocketEntryKind,
  DocketIntake,
  DocketIntakeError,
  DocketIntakeOutcome,
  DocketIntakeStore,
  DocketMailbox,
  DocketPollReport,
  DocketWrittenEntry,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import { Context, DateTime, Effect, FileSystem, HashMap, Layer, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { seedCursor } from "./Cycle.ts";
import type {
  DocketCalendarEntry,
  DocketIntakeState,
  DocketPollOptions,
} from "@beep/law-practice-use-cases/DocketIntake";
import type { DocketIntakeAppConfig } from "./Config.ts";

const $I = $DocketIntakeId.create("DryRun");

const DRY_RUN_DIRECTORY = "dry-run";

// Service shape of the dry-run recorder.
interface DocketDryRunRecorderShape {
  /** The calendar entries the pass would have created, in order. */
  readonly entries: Effect.Effect<ReadonlyArray<DocketCalendarEntry>>;
}

/**
 * What a dry run would have written to the calendar.
 *
 * **Example** (Reference the recorder)
 *
 * ```ts
 * import { DocketDryRunRecorder } from "../../src/DryRun.ts"
 *
 * console.log(DocketDryRunRecorder.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DocketDryRunRecorder extends Context.Service<DocketDryRunRecorder, DocketDryRunRecorderShape>()(
  $I`DocketDryRunRecorder`
) {}

// The synthetic id of a recorded entry is its idempotency key, so outcomes can be traced back to it.
const recordedEntry = (key: string) => DocketWrittenEntry.make({ eventId: key });

/**
 * Calendar and mailbox ports that record instead of writing, over the ports
 * below them.
 *
 * **Details**
 *
 * `create` records the entry and returns a synthetic written entry whose
 * event id is the entry's key. `findByKey` finds a recorded entry first and
 * otherwise asks the calendar below, which only reads. `markEntered` does
 * nothing. Listing mail and reading attachments pass through.
 *
 * **Example** (Reference the recording ports)
 *
 * ```ts
 * import { DocketDryRunPortsLive } from "../../src/DryRun.ts"
 *
 * console.log(DocketDryRunPortsLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocketDryRunPortsLive: Layer.Layer<
  DocketCalendar | DocketDryRunRecorder | DocketMailbox,
  never,
  DocketCalendar | DocketMailbox
> = Layer.effectContext(
  Effect.gen(function* () {
    const calendar = yield* DocketCalendar;
    const mailbox = yield* DocketMailbox;
    const recorded = yield* Ref.make(HashMap.empty<string, DocketCalendarEntry>());
    const order = yield* Ref.make(A.empty<DocketCalendarEntry>());

    return Context.make(DocketDryRunRecorder, DocketDryRunRecorder.of({ entries: Ref.get(order) })).pipe(
      Context.add(
        DocketCalendar,
        DocketCalendar.of({
          create: Effect.fn("DocketDryRun.create")(function* (entry) {
            yield* Ref.update(recorded, HashMap.set(entry.key, entry));
            yield* Ref.update(order, A.append(entry));
            return recordedEntry(entry.key);
          }),
          findByKey: Effect.fn("DocketDryRun.findByKey")(function* (key) {
            const own = HashMap.get(yield* Ref.get(recorded), key);
            return O.isSome(own) ? O.some(recordedEntry(key)) : yield* calendar.findByKey(key);
          }),
        })
      ),
      Context.add(
        DocketMailbox,
        DocketMailbox.of({
          markEntered: Effect.fn("DocketDryRun.markEntered")(function* () {
            yield* Effect.void;
          }),
          receivedSince: mailbox.receivedSince,
          sourceDocuments: mailbox.sourceDocuments,
        })
      )
    );
  })
);

// One calendar entry a dry run would have created. It carries the subject the service would write
// on the entry, never the text, sender or subject of a message.
class DocketDryRunEntry extends S.Class<DocketDryRunEntry>($I`DocketDryRunEntry`)(
  {
    messageId: S.OptionFromOptionalKey(S.NonEmptyString).annotateKey({
      description: "The message the entry is for; absent for an entry no outcome claims.",
    }),
    kind: DocketEntryKind.annotateKey({ description: "Kind of entry." }),
    category: DocketCategory.annotateKey({ description: "The docket category it would carry." }),
    date: LocalDateFromString.annotateKey({ description: "The day it would fall on." }),
    flags: S.Array(DocketEntryFlag).annotateKey({ description: "Things the attorney should check." }),
    subject: S.NonEmptyString.annotateKey({ description: "The subject the service would write on the entry." }),
  },
  $I.annote("DocketDryRunEntry", { description: "One calendar entry a docket intake dry run would create." })
) {}

/**
 * What a dry run found: a run id for the record, the pipeline's counts by
 * outcome, and every entry it would have created.
 *
 * **Example** (Read the report fields)
 *
 * ```ts
 * import { DocketDryRunReport } from "../../src/DryRun.ts"
 *
 * console.log(Object.keys(DocketDryRunReport.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketDryRunReport extends S.Class<DocketDryRunReport>($I`DocketDryRunReport`)(
  {
    runId: DocketRunId.annotateKey({ description: "Id of the dry run; nothing is journaled under it." }),
    dryRun: S.Literal(true).annotateKey({ description: "Always true: nothing was written." }),
    ...DocketPollReport.fields,
    entries: S.Array(DocketDryRunEntry).annotateKey({ description: "Entries the pass would have created." }),
  },
  $I.annote("DocketDryRunReport", { description: "What a docket intake dry run would have written." })
) {}

type Owner = { readonly flags: ReadonlyArray<DocketEntryFlag>; readonly messageId: string };

const ownersOf: (outcome: DocketIntakeOutcome) => ReadonlyArray<readonly [string, Owner]> = DocketIntakeOutcome.match({
  DocketEntered: (outcome) =>
    A.map([outcome.entry, ...outcome.reminders], (entry) => [entry.eventId, outcome] as const),
  DocketNeedsReview: (outcome) => [[outcome.entry.eventId, outcome] as const],
  IntakeFailed: A.empty<readonly [string, Owner]>,
  NotDocketItem: A.empty<readonly [string, Owner]>,
});

const entryReport =
  (owners: HashMap.HashMap<string, Owner>) =>
  (entry: DocketCalendarEntry): DocketDryRunEntry => {
    const owner = HashMap.get(owners, entry.key);
    return DocketDryRunEntry.make({
      category: entry.category,
      date: entry.date,
      flags: pipe(
        owner,
        O.map((value) => value.flags),
        O.getOrElse(A.empty)
      ),
      kind: entry.kind,
      messageId: O.map(owner, (value) => value.messageId),
      subject: entry.subject,
    });
  };

/**
 * Empty the dry-run directory, a `dry-run` subdirectory of the state
 * directory, and read the real saved state without taking its lock.
 *
 * **Example** (Reference the preparation step)
 *
 * ```ts
 * import { prepareDryRun } from "../../src/DryRun.ts"
 *
 * console.log(prepareDryRun)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const prepareDryRun = Effect.fn("DocketIntakeApp.prepareDryRun")(function* (config: DocketIntakeAppConfig) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(config.stateDirectory, DRY_RUN_DIRECTORY);
  yield* fs
    .remove(directory, { force: true, recursive: true })
    .pipe(Effect.mapError(() => DocketIntakeError.make({ cause: "dry-run-directory", stage: "store" })));
  const saved = yield* readDocketStateFile(config.stateDirectory);
  return { directory, saved };
});

/**
 * One dry-run pass inside the dry-run wiring: copy the real saved state into
 * the throwaway store, seed the cursor on a first run, run the pipeline once
 * and report what it would have written.
 *
 * **Details**
 *
 * Both agents and the review loop run, so a dry run costs model calls. The
 * pass starts from the real cursor and ledger, so it previews exactly what
 * the next `poll` would do; the real state file, the real lock and the
 * journal are never touched. No digest is written.
 *
 * **Example** (Reference the dry-run pass)
 *
 * ```ts
 * import { dryRunCycle } from "../../src/DryRun.ts"
 *
 * console.log(dryRunCycle)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const dryRunCycle = Effect.fn("DocketIntakeApp.dryRunCycle")(function* (input: {
  readonly config: DocketIntakeAppConfig;
  readonly options: DocketPollOptions;
  readonly saved: DocketIntakeState;
  readonly startAt: string;
}) {
  const store = yield* DocketIntakeStore;
  const intake = yield* DocketIntake;
  const recorder = yield* DocketDryRunRecorder;
  yield* store.save(input.saved);
  yield* seedCursor(input.startAt);
  const now = yield* DateTime.now;

  const report = yield* intake.pollOnce(docketDayInZone(now, input.config.timeZone), input.options);
  const state = yield* store.load;
  const owners = HashMap.fromIterable(A.flatMap(R.values(state.ledger), (record) => ownersOf(record.outcome)));
  const entries = A.map(yield* recorder.entries, entryReport(owners));
  yield* Effect.logInfo("docket intake dry run finished", {
    processed: report.processed,
    seen: report.seen,
    wouldCreate: A.length(entries),
  });
  return DocketDryRunReport.make({ ...report, dryRun: true, entries, runId: makeDocketRunId(now) });
});
