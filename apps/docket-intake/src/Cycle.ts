/**
 * The poll cycle of the docket intake service and the loop that repeats it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { docketDayInZone, writeDigestFile } from "@beep/law-practice-server/DocketIntake";
import { DocketIntake, DocketIntakeState, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import { DateTime, Effect } from "effect";
import * as O from "effect/Option";
import { digestDayDue } from "./Digest.ts";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";
import type { LocalDate } from "@beep/schema/LocalDate";
import type { Schedule } from "effect";
import type { DocketIntakeAppConfig } from "./Config.ts";

/**
 * Give a first run its starting point: when no cursor has been saved yet, save
 * one at the start time, so a restart continues from there instead of from
 * the time of the restart.
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

/**
 * One cycle: poll the mailbox for today's practice day, then write
 * yesterday's digest if it has not been written. Logs counts only.
 *
 * @category utilities
 * @since 0.0.0
 */
export const pollCycle = Effect.fn("DocketIntakeApp.pollCycle")(function* (config: DocketIntakeAppConfig) {
  const intake = yield* DocketIntake;
  const store = yield* DocketIntakeStore;
  const today = docketDayInZone(yield* DateTime.now, config.timeZone);

  const report = yield* intake.pollOnce(today);
  yield* Effect.logInfo("docket intake poll finished", {
    entered: report.entered,
    failed: report.failed,
    needsReview: report.needsReview,
    notDocket: report.notDocket,
    processed: report.processed,
    seen: report.seen,
  });

  const state = yield* store.load;
  yield* O.match(digestDayDue(today, state.digestedThrough), {
    onNone: () => Effect.void,
    onSome: (day) => writeDayDigest(config.stateDirectory, day),
  });
  return report;
});

const logCycleFailure = (error: DocketIntakeError) =>
  Effect.logError("docket intake cycle failed", { cause: error.cause, stage: error.stage });

/**
 * Repeat the poll cycle on a schedule. A cycle that fails is logged with its
 * stage and the loop goes on to the next one.
 *
 * @category utilities
 * @since 0.0.0
 */
export const pollOnSchedule = <Out, R>(options: {
  readonly config: DocketIntakeAppConfig;
  readonly schedule: Schedule.Schedule<Out, unknown, never, R>;
}) => pollCycle(options.config).pipe(Effect.catch(logCycleFailure), Effect.repeat(options.schedule), Effect.asVoid);
