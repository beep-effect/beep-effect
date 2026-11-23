/**
 * `beep identity`: the identity registry command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import { identityRegistryCommand } from "./Registry.command.ts";
import { identityDeprecateCommand, identityRebindCommand } from "./ShardEdit.ts";

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
  Console.log(
    "Identity registry commands: bun run beep identity registry [--write [--base <ref>] | --check], identity rebind <from> <to> [--base <ref>], identity deprecate <curie> [--replacement <curie>] [--base <ref>]"
  )
).pipe(
  Command.withDescription("Declared terms: generate and check the identity registry, rebind codes, deprecate terms"),
  Command.withSubcommands([identityRegistryCommand, identityRebindCommand, identityDeprecateCommand])
);
