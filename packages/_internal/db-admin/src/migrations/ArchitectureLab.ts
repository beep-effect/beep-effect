/**
 * Architecture lab db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { WORK_ITEM_TABLE_NAME } from "@beep/architecture-lab-tables/aggregates/WorkItem";
import { WORKER_TABLE_NAME } from "@beep/architecture-lab-tables/entities/Worker";
import { DbSchema } from "@beep/architecture-lab-tables/tables";
import { $I as $BeepId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $BeepId.create("db-admin/migrations/ArchitectureLab");

const MigrationTargetNamePattern = /^[a-z][a-z0-9-]*$/u;
const PostgresIdentifierPattern = /^[a-z][a-z0-9_]*$/u;

const MigrationTargetName = S.NonEmptyString.check(
  S.isPattern(MigrationTargetNamePattern, {
    message: "Expected a lowercase kebab-case migration target name.",
  })
).pipe(
  $I.annoteSchema("MigrationTargetName", {
    description: "Lowercase kebab-case identifier for a db-admin migration target.",
    toArbitrary: () => (fc) => fc.stringMatching(MigrationTargetNamePattern),
  })
);

const PostgresSchemaName = S.NonEmptyString.check(
  S.isPattern(PostgresIdentifierPattern, {
    message: "Expected a lowercase PostgreSQL schema identifier.",
  })
).pipe(
  $I.annoteSchema("PostgresSchemaName", {
    description: "Lowercase PostgreSQL schema identifier used by a migration target.",
    toArbitrary: () => (fc) => fc.stringMatching(PostgresIdentifierPattern),
  })
);

const MigrationTableName = S.NonEmptyString.check(
  S.isPattern(PostgresIdentifierPattern, {
    message: "Expected a lowercase PostgreSQL table identifier.",
  })
).pipe(
  $I.annoteSchema("MigrationTableName", {
    description: "Lowercase PostgreSQL table identifier included in a migration target.",
    toArbitrary: () => (fc) => fc.stringMatching(PostgresIdentifierPattern),
  })
);

const DrizzleMigrationSchema = S.Unknown.pipe(
  $I.annoteSchema("DrizzleMigrationSchema", {
    description: "Opaque imported Drizzle table-schema object used only for migration generation.",
    toArbitrary: () => (fc) => fc.constant({}),
  })
);

/**
 * db-admin migration target metadata.
 *
 * @example
 * ```ts
 * import { DbAdminMigrationTarget } from "@beep/db-admin/migrations/ArchitectureLab"
 *
 * const target = DbAdminMigrationTarget.make({
 *   drizzleSchema: {},
 *   name: "docs",
 *   schemaName: "docs",
 *   tables: ["docs_items"]
 * })
 * console.log(target.tables) // ["docs_items"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DbAdminMigrationTarget extends S.Class<DbAdminMigrationTarget>($I`DbAdminMigrationTarget`)(
  {
    drizzleSchema: DrizzleMigrationSchema.annotateKey({
      description: "Imported Drizzle table-schema object used only for migration generation.",
    }),
    name: MigrationTargetName.annotateKey({
      description: "Lowercase kebab-case migration target name.",
    }),
    schemaName: PostgresSchemaName.annotateKey({
      description: "Lowercase PostgreSQL schema name used by the target.",
    }),
    tables: S.NonEmptyArray(MigrationTableName).annotateKey({
      description: "Non-empty list of lowercase PostgreSQL table names covered by the target.",
    }),
  },
  $I.annote("DbAdminMigrationTarget", {
    title: "db-admin migration target",
    description: "Migration target metadata consumed by the db-admin aggregation proof.",
  })
) {}

/**
 * Architecture lab migration target used to prove current db-admin aggregation.
 *
 * @example
 * ```ts
 * import { ArchitectureLabMigrationTarget } from "@beep/db-admin/migrations/ArchitectureLab"
 *
 * const summary = {
 *   schemaName: ArchitectureLabMigrationTarget.schemaName,
 *   tableCount: ArchitectureLabMigrationTarget.tables.length
 * }
 * console.log(summary) // { schemaName: "architecture_lab", tableCount: 2 }
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ArchitectureLabMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  name: "architecture-lab",
  schemaName: "architecture_lab",
  tables: [WORK_ITEM_TABLE_NAME, WORKER_TABLE_NAME],
  drizzleSchema: DbSchema,
});
