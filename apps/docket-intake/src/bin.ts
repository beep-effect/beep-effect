#!/usr/bin/env bun

/**
 * Command-line entrypoint of the docket intake service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { DateTime, Duration, Effect, Layer } from "effect";
import { Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import { DocketIntakeAppConfigFromEnv } from "./Config.ts";
import { pollCycle, pollForever, seedCursor } from "./Cycle.ts";
import { makeDocketIntakeAppLayer, makeM365Layer } from "./runtime/Layer.ts";
import { smoke } from "./Smoke.ts";

const DEFAULT_INTERVAL_MINUTES = 5;

const intervalMinutes = Flag.Int("interval-minutes").pipe(
  Flag.withDefault(DEFAULT_INTERVAL_MINUTES),
  Flag.withDescription("Minutes between poll cycles.")
);

const write = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Also create, find and delete one labelled test event.")
);

// Build the live pipeline for this process, seed the cursor on a first run, then run the program.
const withIntake = Effect.fnUntraced(function* (everyMinutes: O.Option<number>) {
  const config = yield* DocketIntakeAppConfigFromEnv;
  const now = yield* DateTime.now;
  const startAt = DateTime.formatIso(O.getOrElse(config.startAt, () => now));
  const program = O.match(everyMinutes, {
    onNone: () => Effect.asVoid(pollCycle(config)),
    onSome: (minutes) => pollForever({ config, interval: Duration.minutes(minutes) }),
  });
  yield* Effect.scoped(
    Layer.build(
      Layer.effectDiscard(Effect.andThen(seedCursor(startAt), program)).pipe(
        Layer.provide(makeDocketIntakeAppLayer({ config, initialSince: startAt }))
      )
    )
  );
});

const pollCommand = Command.make("poll", {}, () => withIntake(O.none())).pipe(
  Command.withDescription("Run one poll cycle and write yesterday's digest if it is owed.")
);

const runCommand = Command.make("run", { intervalMinutes }, (flags) => withIntake(O.some(flags.intervalMinutes))).pipe(
  Command.withDescription("Repeat the poll cycle forever.")
);

const smokeCommand = Command.make(
  "smoke",
  { write },
  Effect.fnUntraced(function* (flags) {
    const config = yield* DocketIntakeAppConfigFromEnv;
    yield* Effect.scoped(
      Layer.build(
        Layer.effectDiscard(smoke(config, flags.write)).pipe(
          Layer.provide(Layer.merge(makeM365Layer(config), BunCrypto.layer))
        )
      )
    );
  })
).pipe(Command.withDescription("Check the mailbox connection; read-only unless --write is given."));

const command = Command.make("docket-intake").pipe(
  Command.withDescription("Docket intake service."),
  Command.withSubcommands([pollCommand, runCommand, smokeCommand])
);

const program = Command.run(command, { version: "0.0.0" });

if (import.meta.main) {
  BunRuntime.runMain(Effect.scoped(Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(BunServices.layer)))));
}
