/**
 * db-admin migration target registry.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { Effect } from "effect";
import { ArchitectureLabMigrationTarget } from "./migrations/ArchitectureLab.js";
import { DocumentsSyncMigrationTarget } from "./migrations/DocumentsSync.js";
import { EpistemicUsageMigrationTarget } from "./migrations/EpistemicUsage.js";
import { WorkspaceThreadMigrationTarget } from "./migrations/WorkspaceThread.js";
import type { DbAdminMigrationTarget } from "./migrations/ArchitectureLab.js";

/**
 * Architecture lab migration target export.
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Documents sync migration target export.
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Epistemic usage migration target export.
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Workspace thread migration target export.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  ArchitectureLabMigrationTarget,
  DocumentsSyncMigrationTarget,
  EpistemicUsageMigrationTarget,
  WorkspaceThreadMigrationTarget,
};

/**
 * All db-admin migration targets owned by the current repo.
 *
 * @example
 * ```ts
 * import { DbAdminMigrationTargets } from "@beep/db-admin/targets"
 *
 * const targetNames = DbAdminMigrationTargets.map((target) => target.name)
 * console.log(targetNames) // ["architecture-lab", "workspace-thread", "epistemic-usage", "documents-sync"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DbAdminMigrationTargets = [
  ArchitectureLabMigrationTarget,
  WorkspaceThreadMigrationTarget,
  EpistemicUsageMigrationTarget,
  DocumentsSyncMigrationTarget,
] as const;

/**
 * List registered db-admin migration targets.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { listDbAdminMigrationTargets } from "@beep/db-admin/targets"
 *
 * const targetNames = Effect.runSync(
 *   listDbAdminMigrationTargets.pipe(
 *     Effect.map((targets) => targets.map((target) => target.name))
 *   )
 * )
 * console.log(targetNames) // ["architecture-lab", "workspace-thread", "epistemic-usage", "documents-sync"]
 * ```
 *
 * @effects
 * Creates a pure `Effect` that succeeds with the in-memory db-admin migration
 * target registry; it performs no database I/O.
 *
 * @category queries
 * @since 0.0.0
 */
export const listDbAdminMigrationTargets: Effect.Effect<ReadonlyArray<DbAdminMigrationTarget>> =
  Effect.succeed(DbAdminMigrationTargets);
