/**
 * tsconfig-sync command - synchronize workspace tsconfig references and root aliases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Effect, pipe } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { isCheckModeFlags, isDryRunModeFlags, isWriteModeFlags } from "./TsconfigSync.schemas.js";
import { syncTsconfigAtRoot } from "./TsconfigSync.service.js";
import type { TsconfigSyncMode, TsconfigSyncModeFlags } from "./TsconfigSync.schemas.js";

const resolveMode = (check: boolean, dryRun: boolean, write: boolean): TsconfigSyncMode => {
  const flags = [check, dryRun, write] satisfies TsconfigSyncModeFlags;

  return pipe(
    [
      pipe(flags, O.liftPredicate(isCheckModeFlags), O.as("check" as const)),
      pipe(flags, O.liftPredicate(isDryRunModeFlags), O.as("dry-run" as const)),
      pipe(flags, O.liftPredicate(isWriteModeFlags), O.as("sync" as const)),
    ] satisfies ReadonlyArray<O.Option<TsconfigSyncMode>>,
    O.firstSomeOf,
    O.getOrElse((): TsconfigSyncMode => "sync")
  );
};

/**
 * CLI command for synchronizing root and workspace tsconfig state.
 *
 * @example
 * ```ts
 * import { tsconfigSyncCommand } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(tsconfigSyncCommand)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const tsconfigSyncCommand = Command.make(
  "tsconfig-sync",
  {
    check: Flag.boolean("check").pipe(
      Flag.withDescription("Validate drift without writing files (non-zero exit on drift)")
    ),
    dryRun: Flag.boolean("dry-run").pipe(Flag.withDescription("Preview file changes without writing files")),
    write: Flag.boolean("write").pipe(Flag.withDescription("Apply file changes (default behavior)")),
    filter: Flag.string("filter").pipe(
      Flag.withDescription("Limit package reference sync to a workspace package name or workspace-relative path"),
      Flag.optional
    ),
    verbose: Flag.boolean("verbose").pipe(
      Flag.withAlias("v"),
      Flag.withDescription("Include per-package detail output")
    ),
  },
  Effect.fn(function* ({ check, dryRun, filter, verbose, write }) {
    const rootDir = yield* findRepoRoot();
    const mode = resolveMode(check, dryRun, write);
    const syncOptions = {
      mode,
      verbose,
      ...O.getSomesStruct({ filter }),
    };

    yield* syncTsconfigAtRoot(rootDir, syncOptions).pipe(
      Effect.catchTags({
        TsconfigSyncDriftError: Effect.fn(function* (error) {
          yield* Console.error(`tsconfig-sync: ${error.summary}`);
          return yield* failWithReportedExit(`tsconfig-sync: ${error.summary}`);
        }),
        TsconfigSyncFilterError: Effect.fn(function* (error) {
          yield* Console.error(`tsconfig-sync: ${error.message}`);
          return yield* failWithReportedExit(`tsconfig-sync: ${error.message}`);
        }),
        TsconfigSyncCycleError: Effect.fn(function* (error) {
          yield* Console.error(`tsconfig-sync: ${error.message}`);
          for (const cycle of error.cycles) {
            yield* Console.error(`  cycle: ${A.join(cycle, " -> ")}`);
          }
          return yield* failWithReportedExit(`tsconfig-sync: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription(
    "Synchronize repo-managed config files including root tsconfig references, aliases, tstyche, syncpack, and package docgen"
  )
);
