/**
 * The `practice-mail-tagging` command line: dry-run, apply, watch, undo, and
 * report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TaggingRunId } from "@beep/law-practice-domain/values/MailTagging";
import { RunMailTaggingRequest, UndoMailTaggingRequest } from "@beep/law-practice-use-cases/MailTagging";
import * as A from "effect/Array";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { PracticeMailTaggingError, PracticeMailTaggingFailureKind } from "./PracticeMailTagging.errors.ts";
import { StateLock } from "./PracticeMailTagging.lock.ts";
import { MailTaggingPasses, makeRunId } from "./PracticeMailTagging.passes.ts";
import {
  printRunReport,
  printStateSummary,
  printUndoReport,
  readMailTaggingStateSummary,
} from "./PracticeMailTagging.report.ts";
import type { TaggingMode, TaggingRunReport } from "@beep/law-practice-domain/values/MailTagging";
import type { BackfillCheckpointStore, FilingLedger, TagLedger } from "@beep/law-practice-use-cases/MailTagging";
import type * as DateTime from "effect/DateTime";

const positive = (name: string) =>
  Flag.Int(name).pipe(
    Flag.filter(Num.isGreaterThan(0), (value) => `--${name} must be greater than zero, got ${value}`)
  );

const passFlags = {
  since: Flag.String("since").pipe(
    Flag.withSchema(S.DateTimeUtcFromString),
    Flag.optional,
    Flag.withDescription("Instant to start from when no checkpoint exists (ISO 8601); the checkpoint wins.")
  ),
  maxPages: positive("max-pages").pipe(
    Flag.optional,
    Flag.withDescription("Upper bound on mailbox pages read in one pass.")
  ),
};

const yes = Flag.Boolean("yes").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Confirm that this command may write.")
);

type PassFlags = {
  readonly since: O.Option<DateTime.Utc>;
  readonly maxPages: O.Option<number>;
};

const confirmed = (command: string, confirmedByFlag: boolean): Effect.Effect<void, PracticeMailTaggingError> =>
  confirmedByFlag
    ? Effect.void
    : Effect.fail(
        PracticeMailTaggingError.refused(
          `${command} writes Outlook categories and may file attachments to Box; pass --yes to confirm.`
        )
      );

const runPass = Effect.fn("PracticeMailTagging.runPass")(function* (mode: TaggingMode, flags: PassFlags) {
  const passes = yield* MailTaggingPasses;
  const runId = yield* makeRunId("tag");
  return yield* passes.runJob(
    RunMailTaggingRequest.make({
      mode,
      runId,
      since: O.getOrElse(flags.since, () => passes.schedule.since),
      maxPages: flags.maxPages,
    })
  );
});

const categoriesAdded = (report: TaggingRunReport): number =>
  A.reduce(report.categoryAdds, 0, (total, add) => total + add.count);

// A watch process logs to the journal, so it logs totals and never a category name.
const logPass = (report: TaggingRunReport) =>
  Effect.logInfo("mail-tagging pass finished").pipe(
    Effect.annotateLogs({
      runId: report.runId,
      scanned: report.scanned,
      matched: report.matched,
      categoriesAdded: categoriesAdded(report),
      attachmentsFiled: report.attachmentsFiled,
      wrote: report.wrote,
    })
  );

const logFailure = (error: PracticeMailTaggingError) =>
  Effect.logWarning("mail-tagging pass failed").pipe(
    Effect.annotateLogs({ kind: error.kind, source: error.source, detail: error.message })
  );

const isRetryable = (error: PracticeMailTaggingError): boolean =>
  !PracticeMailTaggingFailureKind.is.throttled(error.kind);

const watch = Effect.fn("PracticeMailTagging.watch")(function* (flags: PassFlags, maxPasses: O.Option<number>) {
  const { schedule } = yield* MailTaggingPasses;
  const pass = runPass("apply", flags).pipe(
    Effect.tap(logPass),
    Effect.tapError(logFailure),
    Effect.retry({
      schedule: Schedule.min([Schedule.exponential(schedule.pollInterval), Schedule.spaced(schedule.maxBackoff)]),
      while: isRetryable,
    })
  );
  yield* Effect.repeat(pass, {
    schedule: Schedule.spaced(schedule.pollInterval),
    times: O.getOrUndefined(O.map(maxPasses, Num.subtract(1))),
  });
});

const undoMode = (dryRun: boolean): TaggingMode => (dryRun ? "dry-run" : "apply");

const dryRunCommand = Command.make("dry-run", passFlags, (flags) =>
  Effect.flatMap(runPass("dry-run", flags), printRunReport)
).pipe(Command.withDescription("Run one pass that reads, decides, and reports, and writes nothing."));

// A writing command holds the state-directory lock until its process ends.
const writing =
  (command: string) =>
  <A, E, R>(work: Effect.Effect<A, E, R>) =>
    Effect.scoped(
      Effect.andThen(
        StateLock.use((lock) => lock.hold(command)),
        work
      )
    );

const applyCommand = Command.make("apply", { ...passFlags, yes }, (flags) =>
  Effect.andThen(
    confirmed("apply", flags.yes),
    writing("apply")(Effect.flatMap(runPass("apply", flags), printRunReport))
  )
).pipe(Command.withDescription("Run one pass that tags mail and files attachments; needs --yes."));

const watchCommand = Command.make(
  "watch",
  {
    ...passFlags,
    yes,
    maxPasses: positive("max-passes").pipe(
      Flag.optional,
      Flag.withDescription("Stop after this many successful passes; unset runs until stopped.")
    ),
  },
  (flags) => Effect.andThen(confirmed("watch", flags.yes), writing("watch")(watch(flags, flags.maxPasses)))
).pipe(Command.withDescription("Run apply passes on the poll interval until stopped or throttled; needs --yes."));

const undoCommand = Command.make(
  "undo",
  {
    run: Flag.String("run").pipe(
      Flag.withSchema(TaggingRunId),
      Flag.withDescription("Run id whose category additions are removed.")
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Count what an undo would remove and write nothing.")
    ),
    yes,
  },
  Effect.fnUntraced(function* (flags) {
    yield* confirmed("undo", flags.dryRun || flags.yes);
    const passes = yield* MailTaggingPasses;
    const runId = yield* makeRunId("undo");
    const undo = Effect.flatMap(
      passes.runUndo(UndoMailTaggingRequest.make({ originalRunId: flags.run, runId, mode: undoMode(flags.dryRun) })),
      printUndoReport
    );
    yield* flags.dryRun ? undo : writing("undo")(undo);
  })
).pipe(Command.withDescription("Remove the categories one run added; needs --yes unless --dry-run."));

const reportCommand = Command.make("report", {}, () =>
  readMailTaggingStateSummary.pipe(
    Effect.mapError(PracticeMailTaggingError.fromPass),
    Effect.flatMap(printStateSummary)
  )
).pipe(Command.withDescription("Count the ledgers and the checkpoint; calls no provider."));

/**
 * Builds the `practice-mail-tagging` command over the layers its subcommands
 * run with.
 *
 * **Details**
 *
 * `dry-run`, `apply`, `watch`, and `undo` get the pass runner; `report` gets
 * the ledgers and the checkpoint only, so it needs no mailbox or Box setting.
 * A layer is built when its subcommand runs, not before.
 *
 * The writing commands, `apply`, `watch`, and `undo` without `--dry-run`, hold
 * the state-directory lock from after the `--yes` check until the process
 * ends; `watch` holds it across all its passes. `dry-run`, `undo --dry-run`,
 * and `report` take no lock.
 *
 * **Example** (Reference the command constructor)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { makePracticeMailTaggingCommand } from "@/PracticeMailTagging.command"
 *
 * console.log(P.isFunction(makePracticeMailTaggingCommand)) // true
 * ```
 *
 * @param layers - The pass runner, the state-directory lock, and the state stores.
 * @returns The root command with its five subcommands.
 * @category cli-commands
 * @since 0.0.0
 */
export const makePracticeMailTaggingCommand = <E1, R1, E2, R2, E3, R3>(layers: {
  readonly passes: Layer.Layer<MailTaggingPasses, E1, R1>;
  readonly lock: Layer.Layer<StateLock, E3, R3>;
  readonly state: Layer.Layer<TagLedger | FilingLedger | BackfillCheckpointStore, E2, R2>;
}) => {
  const writer = Layer.merge(layers.passes, layers.lock);
  return Command.make("practice-mail-tagging").pipe(
    Command.withDescription("Tag the attorney mailbox by matter and file attachments into the matter folders."),
    Command.withSubcommands([
      Command.provide(dryRunCommand, layers.passes),
      Command.provide(applyCommand, writer),
      Command.provide(watchCommand, writer),
      Command.provide(undoCommand, writer),
      Command.provide(reportCommand, layers.state),
    ])
  );
};
