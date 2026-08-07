/**
 * db-admin migration target registry.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { Effect } from "effect";
import { ArchitectureLabMigrationTarget } from "./migrations/ArchitectureLab.ts";
import { DocumentsSyncMigrationTarget } from "./migrations/DocumentsSync.ts";
import { EpistemicContradictionTriageMigrationTarget } from "./migrations/EpistemicContradictionTriage.ts";
import { EpistemicEdgeMigrationTarget } from "./migrations/EpistemicEdge.ts";
import { EpistemicExecutionLedgerMigrationTarget } from "./migrations/EpistemicExecutionLedger.ts";
import { EpistemicUsageMigrationTarget } from "./migrations/EpistemicUsage.ts";
import { LawPracticeCandorGateMigrationTarget } from "./migrations/LawPracticeCandorGate.ts";
import { LawPracticeLegalPositionMigrationTarget } from "./migrations/LawPracticeLegalPosition.ts";
import { WorkspaceThreadMigrationTarget } from "./migrations/WorkspaceThread.ts";
import type { DbAdminMigrationTarget } from "./migrations/ArchitectureLab.ts";

/**
 * Registered db-admin migration target exports.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  ArchitectureLabMigrationTarget,
  DocumentsSyncMigrationTarget,
  EpistemicContradictionTriageMigrationTarget,
  EpistemicEdgeMigrationTarget,
  EpistemicExecutionLedgerMigrationTarget,
  EpistemicUsageMigrationTarget,
  LawPracticeCandorGateMigrationTarget,
  LawPracticeLegalPositionMigrationTarget,
  WorkspaceThreadMigrationTarget,
};

/**
 * All db-admin migration targets owned by the current repo.
 *
 * **Example** (List the registered target names)
 *
 * ```ts
 * import { DbAdminMigrationTargets } from "@beep/db-admin/targets"
 *
 * const targetNames = DbAdminMigrationTargets.map((target) => target.name)
 * console.log(targetNames) // ["architecture-lab", "workspace-thread", "epistemic-usage", "documents-sync", "epistemic-edge", "epistemic-execution-ledger"]
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
  EpistemicEdgeMigrationTarget,
  EpistemicContradictionTriageMigrationTarget,
  EpistemicExecutionLedgerMigrationTarget,
  LawPracticeCandorGateMigrationTarget,
  LawPracticeLegalPositionMigrationTarget,
] as const;

/**
 * List registered db-admin migration targets.
 *
 * **Example** (Run the registry query and read the target names)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { listDbAdminMigrationTargets } from "@beep/db-admin/targets"
 *
 * const targetNames = Effect.runSync(
 *   listDbAdminMigrationTargets.pipe(
 *     Effect.map((targets) => targets.map((target) => target.name))
 *   )
 * )
 * console.log(targetNames) // ["architecture-lab", "workspace-thread", "epistemic-usage", "documents-sync", "epistemic-edge", "epistemic-execution-ledger"]
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
