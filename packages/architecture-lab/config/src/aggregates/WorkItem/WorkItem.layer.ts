/**
 * WorkItem configuration layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { $ArchitectureLabConfigId } from "@beep/identity/packages";
import { Config, Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import {
  defaultWorkItemPublicConfig,
  defaultWorkItemSecretConfig,
  defaultWorkItemServerConfig,
  WorkItemPublicConfig,
  WorkItemSecretConfig,
  WorkItemServerConfig,
} from "./WorkItem.config.js";

const $I = $ArchitectureLabConfigId.create("WorkItemConfigLayer");

/**
 * Fully resolved WorkItem configuration value grouped by visibility boundary.
 *
 * @example
 * ```ts
 * import {
 *   defaultWorkItemPublicConfig,
 *   defaultWorkItemSecretConfig,
 *   defaultWorkItemServerConfig,
 *   WorkItemConfigValue
 * } from "@beep/architecture-lab-config/aggregates/WorkItem"
 *
 * const value = WorkItemConfigValue.make({
 *   publicConfig: defaultWorkItemPublicConfig,
 *   serverConfig: defaultWorkItemServerConfig,
 *   secretConfig: defaultWorkItemSecretConfig
 * })
 *
 * console.log(value.serverConfig.repositoryName) // "architecture-lab-work-items"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class WorkItemConfigValue extends S.Class<WorkItemConfigValue>($I`WorkItemConfigValue`)(
  {
    publicConfig: WorkItemPublicConfig.annotateKey({
      description: "Client-safe feature-flag configuration for WorkItem behavior.",
    }),
    secretConfig: WorkItemSecretConfig.annotateKey({
      description: "Secret-reference configuration for WorkItem persistence.",
    }),
    serverConfig: WorkItemServerConfig.annotateKey({
      description: "Server-side repository and migration configuration for WorkItem persistence.",
    }),
  },
  $I.annote("WorkItemConfigValue", {
    title: "WorkItem config value",
    description: "Resolved configuration value for the architecture lab WorkItem proof.",
  })
) {}

/**
 * Service shape exposed by {@link WorkItemConfig}.
 *
 * @example
 * ```ts
 * import { testWorkItemConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 * import type { WorkItemConfigShape } from "@beep/architecture-lab-config/aggregates/WorkItem"
 *
 * const shape: WorkItemConfigShape = testWorkItemConfig
 *
 * console.log(shape.publicConfig.assignmentEnabled) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkItemConfigShape = WorkItemConfigValue;

/**
 * Context service that supplies resolved WorkItem configuration.
 *
 * @example
 * ```ts
 * import {
 *   testWorkItemConfig,
 *   WorkItemConfig
 * } from "@beep/architecture-lab-config/aggregates/WorkItem"
 * import { Effect, Layer } from "effect"
 *
 * const repositoryName = Effect.runSync(
 *   WorkItemConfig.pipe(
 *     Effect.map((config) => config.serverConfig.repositoryName),
 *     Effect.provide(Layer.succeed(WorkItemConfig, testWorkItemConfig))
 *   )
 * )
 *
 * console.log(repositoryName) // "architecture-lab-work-items"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WorkItemConfig extends Context.Service<WorkItemConfig, WorkItemConfigShape>()($I`WorkItemConfig`) {}

const readWorkItemConfig = Effect.fn("ArchitectureLab.WorkItemConfig.read")(function* () {
  const assignmentEnabled = yield* Config.boolean("ARCHITECTURE_LAB_WORK_ITEM_ASSIGNMENT_ENABLED").pipe(
    Config.withDefault(defaultWorkItemPublicConfig.assignmentEnabled)
  );
  const reopenCompletedEnabled = yield* Config.boolean("ARCHITECTURE_LAB_WORK_ITEM_REOPEN_COMPLETED_ENABLED").pipe(
    Config.withDefault(defaultWorkItemPublicConfig.reopenCompletedEnabled)
  );
  const repositoryName = yield* Config.string("ARCHITECTURE_LAB_WORK_ITEM_REPOSITORY_NAME").pipe(
    Config.withDefault(defaultWorkItemServerConfig.repositoryName)
  );
  const migrationSchemaName = yield* Config.string("ARCHITECTURE_LAB_WORK_ITEM_MIGRATION_SCHEMA_NAME").pipe(
    Config.withDefault(defaultWorkItemServerConfig.migrationSchemaName)
  );
  const connectionName = yield* Config.string("ARCHITECTURE_LAB_WORK_ITEM_CONNECTION_NAME").pipe(
    Config.withDefault(defaultWorkItemSecretConfig.connectionName)
  );

  return WorkItemConfigValue.make({
    publicConfig: WorkItemPublicConfig.make({ assignmentEnabled, reopenCompletedEnabled }),
    serverConfig: WorkItemServerConfig.make({ repositoryName, migrationSchemaName }),
    secretConfig: WorkItemSecretConfig.make({ connectionName }),
  });
});

/**
 * In-memory WorkItem configuration value used by tests and examples.
 *
 * @example
 * ```ts
 * import { testWorkItemConfig } from "@beep/architecture-lab-config/aggregates/WorkItem"
 *
 * console.log(testWorkItemConfig.serverConfig.repositoryName) // "architecture-lab-work-items"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const testWorkItemConfig = WorkItemConfigValue.make({
  publicConfig: defaultWorkItemPublicConfig,
  serverConfig: defaultWorkItemServerConfig,
  secretConfig: defaultWorkItemSecretConfig,
});

/**
 * Live WorkItem configuration layer backed by Effect `Config` providers.
 *
 * @example
 * ```ts
 * import {
 *   ArchitectureLabConfigLive,
 *   WorkItemConfig
 * } from "@beep/architecture-lab-config/aggregates/WorkItem"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const ConfigLive = ConfigProvider.layer(
 *   ConfigProvider.fromUnknown({
 *     ARCHITECTURE_LAB_WORK_ITEM_ASSIGNMENT_ENABLED: "true",
 *     ARCHITECTURE_LAB_WORK_ITEM_REOPEN_COMPLETED_ENABLED: "false",
 *     ARCHITECTURE_LAB_WORK_ITEM_REPOSITORY_NAME: "custom-work-items",
 *     ARCHITECTURE_LAB_WORK_ITEM_MIGRATION_SCHEMA_NAME: "custom_schema",
 *     ARCHITECTURE_LAB_WORK_ITEM_CONNECTION_NAME: "architecture-lab-proof"
 *   })
 * )
 *
 * const program = WorkItemConfig.pipe(
 *   Effect.map((config) => config.serverConfig.repositoryName),
 *   Effect.provide(ArchitectureLabConfigLive),
 *   Effect.provide(ConfigLive)
 * )
 *
 * Effect.runPromise(program).then((name) => console.log(name)) // "custom-work-items"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArchitectureLabConfigLive = Layer.effect(WorkItemConfig, readWorkItemConfig());

/**
 * Test WorkItem configuration layer backed by {@link testWorkItemConfig}.
 *
 * @example
 * ```ts
 * import {
 *   ArchitectureLabConfigTest,
 *   WorkItemConfig
 * } from "@beep/architecture-lab-config/aggregates/WorkItem"
 * import { Effect } from "effect"
 *
 * const schemaName = Effect.runSync(
 *   WorkItemConfig.pipe(
 *     Effect.map((config) => config.serverConfig.migrationSchemaName),
 *     Effect.provide(ArchitectureLabConfigTest)
 *   )
 * )
 *
 * console.log(schemaName) // "architecture_lab"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArchitectureLabConfigTest = Layer.succeed(WorkItemConfig, testWorkItemConfig);
