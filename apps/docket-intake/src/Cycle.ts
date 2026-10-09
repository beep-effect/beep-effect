/**
 * The poll cycle of the docket intake service and the loop that repeats it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import {
  DocketIntakeJournal,
  DocketRunId,
  docketDayInZone,
  recordDocketRunCompleted,
  writeDigestFile,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketIntake,
  DocketIntakeState,
  DocketIntakeStore,
  DocketPollOptions,
  DocketPollReport,
} from "@beep/law-practice-use-cases/DocketIntake";
import { Order as LocalDateOrder } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { DigestProgress, digestDayDue } from "./Digest.ts";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";
import type { LocalDate } from "@beep/schema/LocalDate";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as Schedule from "effect/Schedule";
import type { DocketIntakeAppConfig } from "./Config.ts";

const $I = $DocketIntakeId.create("Cycle");

/**
 * What one poll cycle did: its run id and the pipeline's counts. It carries
 * ids and counts only.
 *
 * **Example** (Read the report fields)
 *
 * ```ts
 * import { DocketCycleReport } from "../../src/Cycle.ts"
 *
 * console.log(Object.keys(DocketCycleReport.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketCycleReport extends S.Class<DocketCycleReport>($I`DocketCycleReport`)(
  {
    runId: DocketRunId.annotateKey({ description: "Id of the run; `undo --run` takes it back." }),
    ...DocketPollReport.fields,
  },
  $I.annote("DocketCycleReport", { description: "Run id and counts of one docket intake poll cycle." })
) {}

/**
 * Give a first run its starting point: when no cursor has been saved yet, save
 * one at the start time, so a restart continues from there instead of from
 * the time of the restart.
 *
 * **Example** (Describe a cursor seed)
 *
 * ```ts
 * import { seedCursor } from "../../src/Cycle.ts"
 *
 * console.log(seedCursor("2030-01-01T00:00:00.000Z"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const seedCursor = Effect.fn("DocketIntakeApp.seedCursor")(function* (startAt: string) {
  const store = yield* DocketIntakeStore;
  const state = yield* store.load;
  if (O.isSome(state.cursor)) {
    return;
  }
  yield* store.save(
    DocketIntakeState.make({
      cursor: O.some(startAt),
      digestedThrough: state.digestedThrough,
      ledger: state.ledger,
    })
  );
  yield* Effect.logInfo("docket intake cursor seeded");
});

const writeDayDigest = Effect.fn("DocketIntakeApp.writeDayDigest")(function* (directory: string, day: LocalDate) {
  const intake = yield* DocketIntake;
  const digest = yield* intake.writeDigest(day);
  yield* writeDigestFile({ day, directory, text: digest.bodyText });
  yield* Effect.logInfo("docket intake digest written", {
    day: day.toISOString(),
    entered: digest.entered,
    failed: digest.failed,
    needsReview: digest.needsReview,
    notDocket: digest.notDocket,
  });
});

// Most digests one cycle writes. A longer gap is closed over the following cycles.
const MAX_DIGESTS_PER_CYCLE = 62;

const earliestProcessedDay = (state: DocketIntakeState): O.Option<LocalDate> =>
  A.head(
    A.sort(
      A.map(R.values(state.ledger), (record) => record.processedOn),
      LocalDateOrder
    )
  );

// Write the digest of every day that is over and not digested yet, earliest first, so days missed
// while the service was down each get their own digest.
const writeOwedDigests: (
  config: DocketIntakeAppConfig,
  today: LocalDate,
  remaining: number
) => Effect.Effect<void, DocketIntakeError, DocketIntake | DocketIntakeStore | FileSystem.FileSystem | Path.Path> =
  Effect.fnUntraced(function* (config, today, remaining) {
    if (remaining === 0) {
      return;
    }
    const store = yield* DocketIntakeStore;
    const state = yield* store.load;
    const due = digestDayDue(
      today,
      DigestProgress.make({
        digestedThrough: state.digestedThrough,
        earliestProcessed: earliestProcessedDay(state),
      })
    );
    if (O.isNone(due)) {
      return;
    }
    yield* writeDayDigest(config.stateDirectory, due.value);
    yield* writeOwedDigests(config, today, remaining - 1);
  });

/**
 * One cycle: start a run in the journal, poll the mailbox for today's
 * practice day, then write every digest that is owed. Logs ids and counts
 * only.
 *
 * **Details**
 *
 * Every write of the cycle is journaled under the run id it starts with.
 * The options may bound the cycle to the oldest pending messages. A digest is
 * owed for each day that is over and not digested yet, so after an outage the
 * missed days are digested one by one, earliest first. One cycle writes at
 * most 62 digests; a longer gap is closed by the cycles after it.
 *
 * **Example** (Reference one poll cycle)
 *
 * ```ts
 * import { pollCycle } from "../../src/Cycle.ts"
 *
 * console.log(pollCycle)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pollCycle = Effect.fn("DocketIntakeApp.pollCycle")(function* (
  config: DocketIntakeAppConfig,
  options: DocketPollOptions = DocketPollOptions.make({})
) {
  const intake = yield* DocketIntake;
  const runId = yield* (yield* DocketIntakeJournal).beginRun;
  const today = docketDayInZone(yield* DateTime.now, config.timeZone);

  const report = yield* intake.pollOnce(today, options);
  // Every run gets a line, also one that wrote nothing, so `runs` lists it and `undo` finds it.
  yield* recordDocketRunCompleted(report);
  yield* Effect.logInfo("docket intake poll finished", {
    entered: report.entered,
    failed: report.failed,
    needsReview: report.needsReview,
    notDocket: report.notDocket,
    processed: report.processed,
    runId,
    seen: report.seen,
  });

  yield* writeOwedDigests(config, today, MAX_DIGESTS_PER_CYCLE);
  return DocketCycleReport.make({ ...report, runId });
});

/**
 * Repeat the poll cycle on a schedule until too many cycles fail in a row.
 *
 * **Details**
 *
 * A cycle that fails is logged with its stage and the number of consecutive
 * failures, and the loop goes on. A cycle that succeeds resets that number.
 * Once it reaches `maxConsecutiveFailures` the loop fails with the last
 * error, so the process exits non-zero and its supervisor can restart it and
 * raise an alert instead of the service failing quietly for hours.
 *
 * **Example** (Reference the scheduled loop)
 *
 * ```ts
 * import { pollOnSchedule } from "../../src/Cycle.ts"
 *
 * console.log(pollOnSchedule)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pollOnSchedule = Effect.fn("DocketIntakeApp.pollOnSchedule")(function* <Out, R>(options: {
  readonly config: DocketIntakeAppConfig;
  readonly schedule: Schedule.Schedule<Out, unknown, never, R>;
}) {
  const failures = yield* Ref.make(0);
  const countFailure = Effect.fnUntraced(function* (error: DocketIntakeError) {
    const consecutiveFailures = yield* Ref.updateAndGet(failures, (count) => count + 1);
    yield* Effect.logError("docket intake cycle failed", {
      cause: error.cause,
      consecutiveFailures,
      stage: error.stage,
    });
    if (consecutiveFailures >= options.config.maxConsecutiveFailures) {
      return yield* error;
    }
  });
  yield* pollCycle(options.config).pipe(
    Effect.andThen(Ref.set(failures, 0)),
    Effect.catch(countFailure),
    Effect.repeat(options.schedule)
  );
});
