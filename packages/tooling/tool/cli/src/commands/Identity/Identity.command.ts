/**
 * `beep identity`: the identity registry command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import { identityRegistryCommand } from "./Registry.ts";

/**
 * `beep identity`: the identity registry command group.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { identityCommand } from "@beep/repo-cli/commands/Identity"
 *
 * console.log(identityCommand.name) // "identity"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const identityCommand = Command.make("identity", {}, () =>
  Console.log("Identity registry commands: bun run beep identity registry [--write | --check]")
).pipe(
  Command.withDescription("Declared terms: generate and check the identity registry"),
  Command.withSubcommands([identityRegistryCommand])
);
