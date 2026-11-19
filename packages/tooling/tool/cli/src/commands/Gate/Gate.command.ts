/**
 * `beep gate`: the gate report command family. `gate run check` runs the
 * `check` gate of the package in the working directory; every generated
 * package `check` script calls it through the slim CLI entry, which does not
 * load this command tree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { runCheckGate } from "./GateCheck.ts";
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
  Command.withSubcommands([runCommand])
);
