/**
 * Toolchain command group: maintenance for the patched TypeScript compilers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { pruneTsgoBackups } from "./Toolchain.prune.ts";

const pruneTsgoBackupsCommand = Command.make(
  "prune-tsgo-backups",
  {},
  Effect.fn(function* () {
    const path = yield* Path.Path;
    // The root `prepare` lifecycle runs at the install root, so prune the current directory.
    yield* pruneTsgoBackups(path.resolve("."));
  })
).pipe(
  Command.withDescription(
    "Delete stale effect-tsgo binary backups (*.original.<n>, *.patched) under ./node_modules; never fails"
  )
);

/**
 * Toolchain maintenance command group.
 *
 * **Example** (Inspect the toolchain command)
 *
 * ```ts
 * import { toolchainCommand } from "@beep/repo-cli/commands/Toolchain"
 *
 * console.log(toolchainCommand.name) // "toolchain"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const toolchainCommand = Command.make("toolchain", {}, () =>
  Console.log("toolchain commands: prune-tsgo-backups")
).pipe(
  Command.withDescription("Patched TypeScript toolchain maintenance"),
  Command.withSubcommands([pruneTsgoBackupsCommand])
);
