/**
 * Codex agent helper commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Argument, Command } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.ts";
import { runCodexExec, runCodexQualityReviewFixLoop } from "./Codex.service.ts";
import { findingsCommand } from "./Findings.command.ts";

export { runCodexExec, runCodexQualityReviewFixLoop } from "./Codex.service.ts";

const execCommand = Command.make(
  "exec",
  {
    prompt: Argument.string("prompt").pipe(Argument.variadic),
  },
  ({ prompt }) => runCodexExec(prompt as ReadonlyArray<string>)
).pipe(Command.withDescription("Run Codex with a content-free telemetry-v2 semantic witness"));

const qualityReviewFixLoopCommand = Command.make(
  "quality-review-fix-loop",
  {
    summary: Argument.string("summary").pipe(Argument.variadic),
  },
  ({ summary }) => runCodexQualityReviewFixLoop(summary as ReadonlyArray<string>)
).pipe(Command.withDescription("Run Codex with the repo quality-review-fix-loop skill"));

/**
 * Codex helper command group.
 *
 * **Example** (Reading the command name)
 *
 * ```ts
 * import { codexCommand } from "@beep/repo-cli/commands/Codex"
 *
 * console.log(codexCommand.name) // "codex"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const codexCommand = Command.make("codex", {}, () =>
  printLines([
    "Codex commands:",
    '- bun run beep codex exec "<prompt>"',
    "- bun run beep codex quality-review-fix-loop",
    "- bun run beep codex findings ingest --from <export.csv>",
    "- bun run beep codex findings ingest --refresh --from <full-export.csv>",
  ])
).pipe(
  Command.withDescription("Codex agent helper commands"),
  Command.withSubcommands([execCommand, qualityReviewFixLoopCommand, findingsCommand])
);
