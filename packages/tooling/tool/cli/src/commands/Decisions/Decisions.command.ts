/**
 * `beep decisions` command group: `check` resolves package code-decision
 * anchors and source pointers; `for` lists the decisions governing files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import * as A from "effect/Array";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import { formatCodeDecisionProblem, runCodeDecisionCheck, runCodeDecisionFor } from "./Decisions.ts";

const decisionsCheckCommand = Command.make(
  "check",
  {},
  Effect.fn(function* () {
    const report = yield* runCodeDecisionCheck(process.cwd());
    yield* printLines([
      ...A.map(report.problems, formatCodeDecisionProblem),
      `decisions: ${report.decisions}`,
      `decisions with empty enforcedBy: ${report.unenforced}`,
      `decision pointers: ${report.pointers}`,
      `problems: ${A.length(report.problems)}`,
    ]);
    if (A.isReadonlyArrayNonEmpty(report.problems)) {
      return yield* failWithReportedExit("beep decisions check: failed.");
    }
  })
).pipe(
  Command.withDescription(
    "Check package decisions/*.md files, their governs and enforcedBy anchors, and every // decision: <slug> pointer"
  )
);

const decisionsForCommand = Command.make(
  "for",
  {
    paths: Argument.String("paths").pipe(
      Argument.atLeast(1),
      Argument.withDescription("Files, or path#declaration anchors, to list the governing decisions of")
    ),
  },
  Effect.fn(function* ({ paths }) {
    const matches = yield* runCodeDecisionFor(process.cwd(), paths);
    yield* printLines(
      A.isReadonlyArrayNonEmpty(matches)
        ? A.map(matches, (match) => `${match.title}  ${match.file}`)
        : ["No package decision governs these paths."]
    );
  })
).pipe(Command.withDescription("Print the title and file of each package decision whose governs anchors name a path"));

/**
 * `beep decisions` command group.
 *
 * **Example** (Confirm the subcommands)
 *
 * ```ts
 * import { decisionsCommand } from "@beep/repo-cli/commands/Decisions"
 * import * as A from "effect/Array"
 *
 * const names = A.flatMap(decisionsCommand.subcommands, (group) => A.map(group.commands, (command) => command.name))
 * console.log(names) // ["check", "for"]
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const decisionsCommand = Command.make("decisions", {}, () =>
  printLines([
    "Package code-decision commands:",
    "- bun run beep decisions check",
    "- bun run beep decisions for <path>[#declaration]...",
  ])
).pipe(
  Command.withDescription("Package code decisions under <package>/decisions/ (check, for)"),
  Command.withSubcommands([decisionsCheckCommand, decisionsForCommand])
) as Command.Command<"decisions", {}, {}, never, never>;
