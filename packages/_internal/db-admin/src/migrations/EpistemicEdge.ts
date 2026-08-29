/**
 * Epistemic bitemporal edge db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { getTableName } from "drizzle-orm";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Epistemic bitemporal edge migration target used to prove candidate-claim,
 * evidence, edge-version, and claim-disposition persistence.
 *
 * **Details**
 *
 * The bitemporal invariants these tables rely on — the ordered-interval CHECK constraints,
 * the endpoint-kind CHECK constraints, the `logical_key` gist exclusion constraint, and the
 * open-head partial unique index — are owned by the raw-SQL migration rather
 * than by Drizzle metadata, so this target publishes the table set while the
 * migration publishes the invariants.
 *
 * **Example** (Log migration target tables)
 *
 * ```ts
 * import { EpistemicEdgeMigrationTarget } from "@beep/db-admin/migrations/EpistemicEdge"
 *
 * console.log(EpistemicEdgeMigrationTarget.tables)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EpistemicEdgeMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  name: "epistemic-edge",
  schemaName: "epistemic",
  tables: [
    getTableName(EpistemicDbSchema.candidateClaim),
    getTableName(EpistemicDbSchema.evidence),
    getTableName(EpistemicDbSchema.edgeVersion),
    getTableName(EpistemicDbSchema.claimDisposition),
  ],
  drizzleSchema: {
    candidateClaim: EpistemicDbSchema.candidateClaim,
    claimDisposition: EpistemicDbSchema.claimDisposition,
    edgeVersion: EpistemicDbSchema.edgeVersion,
    evidence: EpistemicDbSchema.evidence,
  },
});
