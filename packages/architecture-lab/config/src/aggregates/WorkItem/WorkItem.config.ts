/**
 * WorkItem configuration models.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { $ArchitectureLabConfigId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ArchitectureLabConfigId.create("WorkItemConfig");
const WORK_ITEM_MIGRATION_SCHEMA_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

const WorkItemMigrationSchemaName = S.NonEmptyString.check(
  S.isPattern(WORK_ITEM_MIGRATION_SCHEMA_NAME_PATTERN, {
    description: "A database schema identifier beginning with a letter or underscore.",
  })
).pipe(
  $I.annoteSchema("WorkItemMigrationSchemaName", {
    title: "WorkItem migration schema name",
    description: "Database schema identifier used by WorkItem migration tooling.",
  })
);

/**
 * Client-safe feature flags for WorkItem behavior.
 *
 * **Example** (Decode public feature flags)
 *
 * ```ts
 * import { WorkItemPublicConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(WorkItemPublicConfig)({
 *   assignmentEnabled: true,
 *   reopenCompletedEnabled: false
 * })
 *
 * console.log(config.reopenCompletedEnabled) // false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class WorkItemPublicConfig extends S.Class<WorkItemPublicConfig>($I`WorkItemPublicConfig`)(
  {
    assignmentEnabled: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether WorkItem assignment controls are available to clients.",
    }),
    reopenCompletedEnabled: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether completed WorkItems may be reopened by clients.",
    }),
  },
  $I.annote("WorkItemPublicConfig", {
    title: "WorkItem public config",
    description: "Client-safe feature flags for the architecture lab WorkItem proof.",
  })
) {}

/**
 * Server-only repository and migration settings for WorkItem persistence.
 *
 * **Example** (Decode server repository settings)
 *
 * ```ts
 * import { WorkItemServerConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(WorkItemServerConfig)({
 *   repositoryName: "architecture-lab-work-items",
 *   migrationSchemaName: "architecture_lab"
 * })
 *
 * console.log(config.repositoryName) // "architecture-lab-work-items"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class WorkItemServerConfig extends S.Class<WorkItemServerConfig>($I`WorkItemServerConfig`)(
  {
    repositoryName: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("architecture-lab-work-items")).annotateKey({
      description: "Repository name used for architecture lab WorkItem persistence.",
    }),
    migrationSchemaName: WorkItemMigrationSchemaName.pipe(SchemaUtils.withKeyDefaults("architecture_lab")).annotateKey({
      description: "Database schema name used for architecture lab WorkItem migrations.",
    }),
  },
  $I.annote("WorkItemServerConfig", {
    title: "WorkItem server config",
    description: "Server-side repository and migration names for the architecture lab WorkItem proof.",
  })
) {}

/**
 * Secret-reference configuration for the WorkItem backing connection.
 *
 * **Example** (Decode secret connection name)
 *
 * ```ts
 * import { WorkItemSecretConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(WorkItemSecretConfig)({
 *   connectionName: "architecture-lab-proof"
 * })
 *
 * console.log(config.connectionName) // "architecture-lab-proof"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class WorkItemSecretConfig extends S.Class<WorkItemSecretConfig>($I`WorkItemSecretConfig`)(
  {
    connectionName: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("architecture-lab-proof")).annotateKey({
      description: "Secret connection reference name for the WorkItem backing connection.",
    }),
  },
  $I.annote("WorkItemSecretConfig", {
    title: "WorkItem secret config",
    description: "Secret connection reference for the architecture lab WorkItem proof.",
  })
) {}

/**
 * Default browser-safe WorkItem feature flags used by test and local layers.
 *
 * **Example** (Check default feature flags)
 *
 * ```ts
 * import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 *
 * const bothActionsEnabled =
 *   defaultWorkItemPublicConfig.assignmentEnabled &&
 *   defaultWorkItemPublicConfig.reopenCompletedEnabled
 *
 * console.log(bothActionsEnabled) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultWorkItemPublicConfig = WorkItemPublicConfig.make({});

/**
 * Default server-side WorkItem repository and migration names.
 *
 * **Example** (Read default migration schema)
 *
 * ```ts
 * import { defaultWorkItemServerConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 *
 * console.log(defaultWorkItemServerConfig.migrationSchemaName) // "architecture_lab"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultWorkItemServerConfig = WorkItemServerConfig.make({});

/**
 * Default WorkItem secret reference name for local proof wiring.
 *
 * **Example** (Read default connection name)
 *
 * ```ts
 * import { defaultWorkItemSecretConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 *
 * console.log(defaultWorkItemSecretConfig.connectionName) // "architecture-lab-proof"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultWorkItemSecretConfig = WorkItemSecretConfig.make({});
