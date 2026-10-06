/**
 * The commands of the docket intake service, built over injected layer wiring
 * so they run the same way against live services and against fakes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DateTime, Duration, Effect, Layer, Schedule } from "effect";
import { Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import { DocketIntakeAppConfigFromEnv } from "./Config.ts";
import { pollCycle, pollOnSchedule, seedCursor } from "./Cycle.ts";
import { smoke } from "./Smoke.ts";
import type { DocketIntake, DocketIntakeError, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import type { M365 } from "@beep/m365";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { DocketIntakeAppConfig } from "./Config.ts";

/**
 * The layers the commands run over.
 *
 * @category models
 * @since 0.0.0
 */
export type DocketIntakeWiring<E1, R1, E2, R2> = {
  /** The pipeline and its store, for `poll` and `run`. */
  readonly intake: (options: {
    readonly config: DocketIntakeAppConfig;
    readonly initialSince: string;
  }) => Layer.Layer<DocketIntake | DocketIntakeStore, E1, R1>;
  /** The mailbox connection alone, for `smoke`. */
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

type IntakeProgram = (
  config: DocketIntakeAppConfig
) => Effect.Effect<void, DocketIntakeError, DocketIntake | DocketIntakeStore | FileSystem.FileSystem | Path.Path>;

/**
 * The handler of each command.
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeHandlers = <E1, R1, E2, R2>(wiring: DocketIntakeWiring<E1, R1, E2, R2>) => {
  // Build the pipeline for this process, seed the cursor on a first run, then run the program.
  const withIntake = Effect.fnUntraced(function* (program: IntakeProgram) {
    const config = yield* DocketIntakeAppConfigFromEnv;
    const now = yield* DateTime.now;
    const startAt = DateTime.formatIso(O.getOrElse(config.startAt, () => now));
    yield* Effect.scoped(
      Layer.build(
        Layer.effectDiscard(Effect.andThen(seedCursor(startAt), program(config))).pipe(
          Layer.provide(wiring.intake({ config, initialSince: startAt }))
        )
      )
    );
  });

  return {
    poll: Effect.fnUntraced(function* () {
      yield* withIntake((config) => Effect.asVoid(pollCycle(config)));
    }),
    run: Effect.fnUntraced(function* (flags: { readonly intervalMinutes: number }) {
      yield* withIntake((config) =>
        pollOnSchedule({ config, schedule: Schedule.spaced(Duration.minutes(flags.intervalMinutes)) })
      );
    }),
    smoke: Effect.fnUntraced(function* (flags: { readonly write: boolean }) {
      const config = yield* DocketIntakeAppConfigFromEnv;
      yield* Effect.scoped(
        Layer.build(Layer.effectDiscard(smoke(config, flags.write)).pipe(Layer.provide(wiring.mailbox(config))))
      );
    }),
  };
};

/**
 * The `docket-intake` command with its `poll`, `run` and `smoke` subcommands.
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeCommand = <E1, R1, E2, R2>(wiring: DocketIntakeWiring<E1, R1, E2, R2>) => {
  const handlers = makeHandlers(wiring);
  return Command.make("docket-intake").pipe(
    Command.withDescription("Docket intake service."),
    Command.withSubcommands([
      Command.make("poll", {}, handlers.poll).pipe(
        Command.withDescription("Run one poll cycle and write yesterday's digest if it is owed.")
      ),
      Command.make("run", { intervalMinutes }, handlers.run).pipe(
        Command.withDescription("Repeat the poll cycle forever.")
      ),
      Command.make("smoke", { write }, handlers.smoke).pipe(
        Command.withDescription("Check the mailbox connection; read-only unless --write is given.")
      ),
    ])
  );
};
