/**
 * Goals command group.
 *
 * Goal-packet lifecycle tooling: a generated portfolio index
 * (`beep goals index`), and the single-writer status command
 * (`beep goals set-status`) with its mechanical `--migrate` mode.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Command } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.ts";
import { goalsDoctorCommand } from "./Doctor.ts";
import { goalsIndexCommand } from "./PortfolioIndex.ts";
import { goalsSetStatusCommand } from "./SetStatus.ts";

/**
 * `bun run beep goals` — goal-packet lifecycle command group.
 *
 * @example
 * ```ts
 * import { goalsCommand } from "@beep/repo-cli/commands/Goals/Goals.command"
 *
 * console.log(goalsCommand.name)
 * ```
 * @category commands
 * @since 0.0.0
 */
export const goalsCommand = Command.make("goals", {}, () =>
  printLines([
    "Goals commands:",
    "- bun run beep goals doctor [--write-baseline]",
    "- bun run beep goals index [--write | --check]",
    "- bun run beep goals set-status <slug> <status>",
    "- bun run beep goals set-status --migrate [--write]",
  ])
).pipe(
  Command.withDescription("Goal-packet lifecycle tooling (doctor, index, set-status)"),
  Command.withSubcommands([goalsDoctorCommand, goalsIndexCommand, goalsSetStatusCommand])
);
