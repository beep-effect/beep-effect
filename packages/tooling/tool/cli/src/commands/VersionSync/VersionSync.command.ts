/**
 * Version synchronization CLI command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { resolveRunMode } from "../../internal/cli/RunMode.js";
import { handleVersionSync } from "./internal/Handler.js";
import type { VersionSyncMode } from "./VersionSync.schemas.js";

/**
 * Resolve command mode from flags.
 *
 * @param write - Whether `--write` was passed.
 * @param dryRun - Whether `--dry-run` was passed.
 * @returns The resolved command execution mode.
 * @category utilities
 * @since 0.0.0
 */
const resolveMode = (write: boolean, dryRun: boolean): VersionSyncMode =>
  resolveRunMode(
    [
      [write && dryRun, "dry-run"],
      [write && !dryRun, "write"],
    ],
    "check"
  );

/**
 * CLI command for synchronizing version pins across the monorepo.
 *
 * @example
 * ```ts
 * import { versionSyncCommand } from "@beep/repo-cli/commands/VersionSync"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(versionSyncCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const versionSyncCommand = Command.make(
  "version-sync",
  {
    write: Flag.boolean("write").pipe(
      Flag.withAlias("w"),
      Flag.withDescription("Apply version updates (without this, only reports drift)")
    ),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withAlias("d"),
      Flag.withDescription("Show what --write would do without modifying files")
    ),
    skipNetwork: Flag.boolean("skip-network").pipe(
      Flag.withAlias("s"),
      Flag.withDescription("Skip upstream version resolution (only check internal consistency)")
    ),
    bunOnly: Flag.boolean("bun-only").pipe(Flag.withDescription("Only sync Bun versions")),
    nodeOnly: Flag.boolean("node-only").pipe(Flag.withDescription("Only sync Node versions")),
    dockerOnly: Flag.boolean("docker-only").pipe(Flag.withDescription("Only sync Docker image versions")),
    biomeOnly: Flag.boolean("biome-only").pipe(Flag.withDescription("Only sync Biome schema version")),
    effectOnly: Flag.boolean("effect-only").pipe(
      Flag.withDescription("Only sync lockstep Effect catalog versions in the root package.json")
    ),
  },
  Effect.fn(function* ({ write, dryRun, skipNetwork, bunOnly, nodeOnly, dockerOnly, biomeOnly, effectOnly }) {
    const mode = resolveMode(write, dryRun);

    yield* handleVersionSync({
      mode,
      skipNetwork,
      bunOnly,
      nodeOnly,
      dockerOnly,
      biomeOnly,
      effectOnly,
    }).pipe(
      Effect.catchTags({
        VersionSyncDriftError: Effect.fn(function* (error) {
          yield* Console.error(`version-sync: ${error.message}`);
          return yield* failWithReportedExit(`version-sync: ${error.message}`);
        }),
        VersionSyncError: Effect.fn(function* (error) {
          yield* Console.error(`version-sync: ${error.message} (${error.file})`);
          return yield* failWithReportedExit(`version-sync: ${error.message}`);
        }),
        NoSuchFileError: Effect.fn(function* (error) {
          yield* Console.error(`version-sync: ${error.message}`);
          return yield* failWithReportedExit(`version-sync: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription(
    "Detect and fix version drift across .bun-version, package.json, .nvmrc, CI workflows, docker-compose.yml, biome.jsonc, and the root Effect catalog"
  )
);
