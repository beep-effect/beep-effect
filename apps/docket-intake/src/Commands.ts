/**
 * The commands of the docket intake service, built over injected layer wiring
 * so they run the same way against live services and against fakes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  DocketFileStoreOptions,
  DocketRunSummary,
  DocketUndoReport,
  makeDocketFileJournalLayer,
  makeDocketFileStoreLayer,
} from "@beep/law-practice-server/DocketIntake";
import { DocketIntakeError, DocketPollOptions } from "@beep/law-practice-use-cases/DocketIntake";
import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { DocketIntakeAppConfigFromEnv } from "./Config.ts";
import { DocketCycleReport, pollCycle, pollOnSchedule, seedCursor } from "./Cycle.ts";
import { DocketDryRunReport, dryRunCycle, prepareDryRun } from "./DryRun.ts";
import { DocketIntakeCommandError } from "./Errors.ts";
import { smoke } from "./Smoke.ts";
import { DocketRunSelector, listRuns, undoDryRun, undoRun } from "./Undo.ts";
import type { DocketIntakeJournal } from "@beep/law-practice-server/DocketIntake";
import type { DocketIntake, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import type { M365 } from "@beep/m365";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { DocketIntakeAppConfig } from "./Config.ts";
import type { DocketDryRunRecorder } from "./DryRun.ts";

/**
 * The layers the commands run over.
 *
 * **Example** (Name a wiring member)
 *
 * ```ts
 * import type { DocketIntakeWiring } from "../../src/Commands.ts"
 *
 * const member: keyof DocketIntakeWiring<never, never, never, never, never, never> = "dryRun"
 * console.log(member)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketIntakeWiring<E1, R1, E2, R2, E3, R3> = {
  /** The pipeline over recording ports and a throwaway store in `directory`, for `dry-run`. */
  readonly dryRun: (options: {
    readonly config: DocketIntakeAppConfig;
    readonly directory: string;
    readonly initialSince: string;
  }) => Layer.Layer<DocketDryRunRecorder | DocketIntake | DocketIntakeStore, E3, R3>;
  /** The pipeline, its store and its write journal, for `poll` and `run`. */
  readonly intake: (options: {
    readonly config: DocketIntakeAppConfig;
    readonly initialSince: string;
  }) => Layer.Layer<DocketIntake | DocketIntakeJournal | DocketIntakeStore, E1, R1>;
  /** The mailbox connection alone, for `smoke` and `undo`. */
  readonly mailbox: (config: DocketIntakeAppConfig) => Layer.Layer<Crypto.Crypto | M365, E2, R2>;
};

const DEFAULT_INTERVAL_MINUTES = 5;

const intervalMinutes = Flag.Int("interval-minutes").pipe(
  Flag.withDefault(DEFAULT_INTERVAL_MINUTES),
  Flag.withDescription("Minutes between poll cycles.")
);

const write = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Also create, find and delete one labelled test event.")
);

const since = Flag.String("since").pipe(
  Flag.withSchema(S.DateTimeUtcFromString),
  Flag.optional,
  Flag.withDescription("UTC instant to start reading from on a first run; ignored once a cursor is saved.")
);

const maxMessages = Flag.Int("max-messages").pipe(
  Flag.withSchema(S.Int.check(S.isGreaterThan(0))),
  Flag.optional,
  Flag.withDescription("Process at most this many pending messages, oldest first; the rest stay pending.")
);

const yes = Flag.Boolean("yes").pipe(Flag.withDefault(false), Flag.withDescription("Confirm that undo may write."));

const undoFlags = {
  dryRun: Flag.Boolean("dry-run").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Report what the undo would do and write nothing.")
  ),
  run: Flag.String("run").pipe(
    Flag.withSchema(DocketRunSelector),
    Flag.withDescription("Run id to undo, or `latest` for the newest run in the journal.")
  ),
  yes,
};

type PassFlags = {
  readonly maxMessages: O.Option<number>;
  readonly since: O.Option<DateTime.Utc>;
};

type IntakeProgram = (
  config: DocketIntakeAppConfig
) => Effect.Effect<
  void,
  DocketIntakeError | DocketIntakeCommandError,
  DocketIntake | DocketIntakeJournal | DocketIntakeStore | FileSystem.FileSystem | Path.Path
>;

const isDocketIntakeError = S.is(DocketIntakeError);

// Pipeline and adapter failures end the process with their own exit code: 3 when Graph throttled.
const asCommandError = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.catchIf(effect, isDocketIntakeError, (error) => Effect.fail(DocketIntakeCommandError.fromIntake(error)));

// One JSON line on standard output; logs go to standard error.
const printJson =
  <A>(encode: (value: A) => Effect.Effect<string, S.SchemaError>) =>
  (value: A) =>
    encode(value).pipe(Effect.orDie, Effect.flatMap(Console.log));

const printCycleReport = printJson(S.encodeEffect(S.fromJsonString(DocketCycleReport)));
const printDryRunReport = printJson(S.encodeEffect(S.fromJsonString(DocketDryRunReport)));
const printRunSummary = printJson(S.encodeEffect(S.fromJsonString(DocketRunSummary)));
const printUndoReport = printJson(S.encodeEffect(S.fromJsonString(DocketUndoReport)));

const pollOptions = (limit: O.Option<number>) => DocketPollOptions.make({ maxMessages: limit });

// Build a layer for the length of one program and run the program with what it provides.
const runWith = <A, E, R, ROut, E2, R2>(
  program: Effect.Effect<A, E, R>,
  layer: Layer.Layer<ROut, E2, R2>
): Effect.Effect<A, E | E2, Exclude<R, ROut> | R2> =>
  layer.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  );

// The start of a first run: `--since`, else DOCKET_INTAKE_START_AT, else now.
const startOf = Effect.fnUntraced(function* (config: DocketIntakeAppConfig, flagged: O.Option<DateTime.Utc>) {
  const now = yield* DateTime.now;
  return DateTime.formatIso(
    O.getOrElse(
      O.orElse(flagged, () => config.startAt),
      () => now
    )
  );
});

/**
 * The handler of each command.
 *
 * **Example** (Build the handlers over the live wiring)
 *
 * ```ts
 * import { makeHandlers } from "../../src/Commands.ts"
 * import { liveWiring } from "../../src/runtime/Layer.ts"
 *
 * console.log(Object.keys(makeHandlers(liveWiring)))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeHandlers = <E1, R1, E2, R2, E3, R3>(wiring: DocketIntakeWiring<E1, R1, E2, R2, E3, R3>) => {
  // Build the pipeline for this process, seed the cursor on a first run, then run the program.
  const withIntake = Effect.fnUntraced(function* (flagged: O.Option<DateTime.Utc>, program: IntakeProgram) {
    const config = yield* DocketIntakeAppConfigFromEnv;
    const startAt = yield* startOf(config, flagged);
    yield* Effect.andThen(seedCursor(startAt), program(config)).pipe(
      Layer.effectDiscard,
      Layer.provide(wiring.intake({ config, initialSince: startAt })),
      Layer.build,
      Effect.scoped
    );
  });

  // Undo writes under the state lock: the file store takes it when it is built.
  const lockedJournal = (config: DocketIntakeAppConfig) => {
    const options = DocketFileStoreOptions.make({ directory: config.stateDirectory });
    return makeDocketFileJournalLayer(options).pipe(Layer.provideMerge(makeDocketFileStoreLayer(options)));
  };

  return {
    dryRun: Effect.fnUntraced(function* (flags: PassFlags) {
      const config = yield* DocketIntakeAppConfigFromEnv;
      const startAt = yield* startOf(config, flags.since);
      const { directory, saved } = yield* asCommandError(prepareDryRun(config));
      const report = yield* asCommandError(
        runWith(
          dryRunCycle({ config, options: pollOptions(flags.maxMessages), saved, startAt }),
          wiring.dryRun({ config, directory, initialSince: startAt })
        )
      );
      yield* printDryRunReport(report);
    }),
    poll: Effect.fnUntraced(function* (flags: PassFlags) {
      yield* asCommandError(
        withIntake(flags.since, (config) =>
          pollCycle(config, pollOptions(flags.maxMessages)).pipe(Effect.flatMap(printCycleReport))
        )
      );
    }),
    run: Effect.fnUntraced(function* (flags: {
      readonly intervalMinutes: number;
      readonly since: O.Option<DateTime.Utc>;
    }) {
      yield* asCommandError(
        withIntake(flags.since, (config) =>
          pollOnSchedule({ config, schedule: Schedule.spaced(Duration.minutes(flags.intervalMinutes)) })
        )
      );
    }),
    runs: Effect.fnUntraced(function* () {
      const config = yield* DocketIntakeAppConfigFromEnv;
      const runs = yield* asCommandError(listRuns(config));
      yield* Effect.forEach(runs, printRunSummary, { discard: true });
    }),
    smoke: Effect.fnUntraced(function* (flags: { readonly write: boolean }) {
      const config = yield* DocketIntakeAppConfigFromEnv;
      yield* smoke(config, flags.write).pipe(
        Layer.effectDiscard,
        Layer.provide(wiring.mailbox(config)),
        Layer.build,
        Effect.scoped
      );
    }),
    undo: Effect.fnUntraced(function* (flags: {
      readonly dryRun: boolean;
      readonly run: DocketRunSelector;
      readonly yes: boolean;
    }) {
      if (!flags.dryRun && !flags.yes) {
        return yield* DocketIntakeCommandError.refused(
          "undo deletes calendar entries and changes message categories; pass --yes, or --dry-run to look first"
        );
      }
      const config = yield* DocketIntakeAppConfigFromEnv;
      const graph = wiring.mailbox(config);
      const report = yield* asCommandError(
        flags.dryRun
          ? runWith(undoDryRun(config, flags.run), graph)
          : runWith(undoRun(config, flags.run), Layer.merge(graph, lockedJournal(config)))
      );
      yield* printUndoReport(report);
    }),
  };
};

/**
 * The `docket-intake` command with its `poll`, `run`, `dry-run`, `runs`,
 * `undo` and `smoke` subcommands.
 *
 * **Example** (Build the command over the live wiring)
 *
 * ```ts
 * import { makeCommand } from "../../src/Commands.ts"
 * import { liveWiring } from "../../src/runtime/Layer.ts"
 *
 * console.log(makeCommand(liveWiring))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeCommand = <E1, R1, E2, R2, E3, R3>(wiring: DocketIntakeWiring<E1, R1, E2, R2, E3, R3>) => {
  const handlers = makeHandlers(wiring);
  return Command.make("docket-intake").pipe(
    Command.withDescription("Docket intake service."),
    Command.withSubcommands([
      Command.make("poll", { maxMessages, since }, handlers.poll).pipe(
        Command.withDescription("Run one poll cycle, write the digests that are owed, and print its run id and counts.")
      ),
      Command.make("run", { intervalMinutes, since }, handlers.run).pipe(
        Command.withDescription("Repeat the poll cycle forever.")
      ),
      Command.make("dry-run", { maxMessages, since }, handlers.dryRun).pipe(
        Command.withDescription("Run one pass that calls the agents and writes nothing; print what it would write.")
      ),
      Command.make("runs", {}, handlers.runs).pipe(
        Command.withDescription("Print one line per run in the write journal, newest first.")
      ),
      Command.make("undo", undoFlags, handlers.undo).pipe(
        Command.withDescription("Take back one run's writes; needs --yes unless --dry-run.")
      ),
      Command.make("smoke", { write }, handlers.smoke).pipe(
        Command.withDescription("Check the mailbox connection; read-only unless --write is given.")
      ),
    ])
  );
};
