#!/usr/bin/env bun
/**
 * Document identification executable.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Command } from "effect/cli";
import { runEntrypoint } from "./entrypoint.ts";
import { makePracticeIdentifyCommand } from "./PracticeIdentify.command.ts";
import { IdentificationStagesLive } from "./runtime/Layer.ts";

runEntrypoint({
  isMain: import.meta.main,
  program: Command.run(makePracticeIdentifyCommand(IdentificationStagesLive), { version: "0.0.0" }),
});
