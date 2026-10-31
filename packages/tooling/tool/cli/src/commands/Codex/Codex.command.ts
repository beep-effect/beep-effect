/**
 * Codex agent helper commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Command from "effect/cli/Command";
import { printLines } from "../../internal/cli/Printer.ts";
import { findingsCommand } from "./Findings.command.ts";
import { securityCommand } from "./Security.command.ts";

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
    "- bun run beep codex findings ingest --from <export.csv>",
    "- bun run beep codex findings ingest --refresh --from <full-export.csv>",
    "- bun run beep codex security preflight --output-dir <directory> --max-cost <usd>",
    "- bun run beep codex security scan --output-dir <directory> --max-cost <usd>",
  ])
).pipe(
  Command.withDescription("Codex agent helper commands"),
  Command.withSubcommands([findingsCommand, securityCommand])
);
