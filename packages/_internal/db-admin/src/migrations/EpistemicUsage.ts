/**
 * Epistemic usage db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Epistemic usage migration target used to prove usage-record persistence.
 *
 * @example
 * ```ts
 * import { EpistemicUsageMigrationTarget } from "@beep/db-admin/migrations/EpistemicUsage"
 *
 * console.log(EpistemicUsageMigrationTarget.tables)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EpistemicUsageMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  name: "epistemic-usage",
  schemaName: "epistemic",
  tables: [EpistemicDbSchema.usageRecord.definition.tableName],
  drizzleSchema: {
    usageRecord: EpistemicDbSchema.usageRecord,
  },
});
