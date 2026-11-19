/**
 * `beep gate`: the gate report command family. `gate run check` runs the
 * `check` gate of the package in the working directory; `gate show` and
 * `gate item` read a run's record and one of its items; every generated
 * package `check` script calls it through the slim CLI entry, which does not
 * load this command tree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { runCheckGate } from "./GateCheck.ts";
import { QueryWhere, showItemLines, showRunLines } from "./GateQuery.ts";
import { splitAudienceArgs } from "./GateRuntime.ts";

const checkCommand = Command.make(
  "check",
  {
    dir: Flag.String("dir").pipe(
      Flag.withDefault("."),
      Flag.withDescription("The package directory (default: the working directory)")
    ),
  },
  ({ dir }) =>
    Effect.flatMap(Path.Path, (path) => runCheckGate(path.resolve(dir), splitAudienceArgs(process.argv.slice(2)).flags))
).pipe(
  Command.withDescription(
    "Run the package check gate: probe unbuilt references, type-check, write the record and print the console"
  )
);

const queryFlags = {
  gate: Argument.String("gate").pipe(Argument.withDescription("The gate: test or check")),
  dir: Flag.String("dir").pipe(
    Flag.optional,
    Flag.withDescription(
      "Show this package's record, its directory relative to the repository root (default: the working directory's package, else the newest root run)"
    )
  ),
  run: Flag.String("run").pipe(Flag.optional, Flag.withDescription("Show this root run instead of the newest")),
};

const printLines = (lines: ReadonlyArray<string>) => Console.log(A.join(lines, "\n"));

const showCommand = Command.make("show", queryFlags, ({ gate, dir, run }) =>
  Effect.flatMap(showRunLines(gate, QueryWhere.make({ dir, run })), printLines)
).pipe(
  Command.withDescription(
    "Show a gate run's record: verdict, totals, units, the listed items, and the record and log paths"
  )
);

const itemCommand = Command.make(
  "item",
  {
    ...queryFlags,
    selector: Argument.String("selector").pipe(
      Argument.withDescription("The item's number among the listed items, or text in its title or unit")
    ),
  },
  ({ gate, selector, dir, run }) =>
    Effect.flatMap(showItemLines(gate, selector, QueryWhere.make({ dir, run })), printLines)
).pipe(Command.withDescription("Show one item of a gate run in full: location, attempts, message, diff and stack"));

const runCommand = Command.make("run").pipe(
  Command.withDescription("Run one gate for the package in the working directory"),
  Command.withSubcommands([checkCommand])
);

/**
 * The `gate` command group.
 *
 * **Example** (Reference the group)
 *
 * ```ts
 * import { gateCommand } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(gateCommand.name) // gate
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const gateCommand = Command.make("gate").pipe(
  Command.withDescription("Gate reports: run a gate and print its console from the record"),
  Command.withSubcommands([runCommand, showCommand, itemCommand])
);
