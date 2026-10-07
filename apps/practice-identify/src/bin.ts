#!/usr/bin/env bun
/**
 * Document identification executable.
 *
 * Runs only when this module is the process entrypoint, so importing it starts nothing.
 * The built-in logger goes to standard error; standard output carries reports only.
 * @packageDocumentation
 * @since 0.0.0
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import { Command } from "effect/cli";
import { makePracticeIdentifyCommand } from "./PracticeIdentify.command.ts";
import { IdentificationStagesLive } from "./runtime/Layer.ts";

if (import.meta.main) {
  BunRuntime.runMain(
    Layer.effectDiscard(Command.run(makePracticeIdentifyCommand(IdentificationStagesLive), { version: "0.0.0" })).pipe(
      Layer.provide(BunServices.layer),
      Layer.provide(Layer.succeed(Logger.LogToStderr, true)),
      Layer.build,
      Effect.scoped
    )
  );
}
