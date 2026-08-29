/**
 * Console rendering for tsconfig-sync results.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Console, Effect, Path } from "effect";
import { TsconfigSyncPlan } from "./TsconfigSync.plan.ts";
import { TsconfigSyncModeMatch } from "./TsconfigSync.schemas.ts";
import type { TsconfigSyncChange, TsconfigSyncMode } from "./TsconfigSync.schemas.ts";

const { relativeFromRoot } = TsconfigSyncPlan;
/**
 * Render a tsconfig-sync change summary to the console.
 *
 * **Example** (Render tsconfig change summary)
 *
 * ```ts
 * import { renderChanges } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.render"
 *
 * const result = renderChanges([{ file: "tsconfig.json", section: "references", status: "changed" }])
 * console.log(result) // rendered command output
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const renderChanges = Effect.fn(function* (
  rootDir: string,
  mode: TsconfigSyncMode,
  changes: ReadonlyArray<TsconfigSyncChange>
) {
  const path = yield* Path.Path;

  if (A.isReadonlyArrayEmpty(changes)) {
    yield* TsconfigSyncModeMatch(mode, {
      check: () => Console.log("tsconfig-sync: no drift detected"),
      "dry-run": () => Console.log("tsconfig-sync: dry-run found no changes"),
      sync: () => Console.log("tsconfig-sync: all files already in sync"),
    });
    return;
  }

  const prefix = TsconfigSyncModeMatch(mode, {
    check: () => "tsconfig-sync: drift detected",
    "dry-run": () => "tsconfig-sync: dry-run planned changes",
    sync: () => "tsconfig-sync: applied changes",
  });

  yield* Console.log(`${prefix} (${changes.length} file change(s))`);

  for (const change of changes) {
    const relativePath = relativeFromRoot(rootDir, change.filePath, path);
    yield* Console.log(`  - ${relativePath} [${change.section}] ${change.summary}`);
  }
});

/**
 * Internal renderer surface used by the tsconfig-sync service.
 *
 * **Example** (Access renderChanges property)
 *
 * ```ts
 * import { TsconfigSyncRender } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.render"
 *
 * console.log(TsconfigSyncRender.renderChanges)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const TsconfigSyncRender = {
  renderChanges,
} as const;
