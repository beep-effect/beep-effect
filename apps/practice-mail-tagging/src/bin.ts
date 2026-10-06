#!/usr/bin/env bun

/**
 * Executable of the practice mail-tagging job.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Command } from "effect/cli";
import { runEntrypoint } from "./entrypoint.ts";
import { makePracticeMailTaggingCommand } from "./PracticeMailTagging.command.ts";
import { MailTaggingPassesLive, MailTaggingStateLive } from "./runtime/Layer.ts";

const program = Command.run(
  makePracticeMailTaggingCommand({ passes: MailTaggingPassesLive, state: MailTaggingStateLive }),
  { version: "0.0.0" }
);

runEntrypoint({ isMain: import.meta.main, program });
