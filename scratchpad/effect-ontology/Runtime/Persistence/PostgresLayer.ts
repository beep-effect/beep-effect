/**
 * PostgreSQL Layer for Workflow Persistence
 *
 * **Details**
 *
 * Provides Effect layers for PostgreSQL-backed workflow persistence
 * using @effect/sql-pg and @effect/cluster's ClusterWorkflowEngine.
 *
 * Architecture:
 * - SqlClient from @effect/sql-pg for database connections
 * - SqlMessageStorage from @effect/cluster for message persistence
 * - ClusterWorkflowEngine for durable workflow execution
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Port } from "@beep/schema/Port";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, Layer, Redacted } from "effect";
import * as S from "effect/Schema";
import { ShardingConfig, SqlMessageStorage, SqlRunnerStorage } from "effect/unstable/cluster";

// -----------------------------------------------------------------------------
// PostgreSQL Configuration Schema
// -----------------------------------------------------------------------------

/**
 * Validates and represents postgres config values at runtime.
 *
 * **Example** (Validate postgres config)
 *
 * ```ts
 * import { PostgresConfig } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PostgresConfig)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PostgresConfig = S.Struct({
  host: S.String,
  port: Port,
  database: S.String,
  username: S.String,
  password: S.String,
  ssl: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
});
/**
 * Describes the postgres config data exposed by this module.
 *
 *
 * **Example** (Use the PostgresConfig contract)
 *
 * ```ts
 * import type { PostgresConfig } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * const acceptsPostgresConfig = (_value: PostgresConfig): void => undefined
 *
 * console.log(acceptsPostgresConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PostgresConfig = typeof PostgresConfig.Type;

const PostgresPortConfig = Config.number("POSTGRES_PORT").pipe(
  Config.withDefault(5432),
  Config.mapOrFail((value) =>
    S.decodeEffect(Port)(value).pipe(Effect.mapError((error) => new Config.ConfigError(error)))
  )
);

// -----------------------------------------------------------------------------
// Configuration from Environment
// -----------------------------------------------------------------------------

/**
 * Load PostgreSQL configuration from environment variables
 *
 * **Details**
 *
 * Environment variables:
 * - POSTGRES_HOST: Database host (default: localhost)
 * - POSTGRES_PORT: Database port (default: 5432)
 * - POSTGRES_DATABASE: Database name (default: workflow)
 * - POSTGRES_USER: Database username (default: workflow)
 * - POSTGRES_PASSWORD: Database password (required)
 * - POSTGRES_SSL: Enable SSL (default: false)
 *
 * **Example** (Inspect postgres config from env)
 *
 * ```ts
 * import { PostgresConfigFromEnv } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(PostgresConfigFromEnv)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const PostgresConfigFromEnv = Config.all({
  host: Config.string("POSTGRES_HOST").pipe(Config.withDefault("localhost")),
  port: PostgresPortConfig,
  database: Config.string("POSTGRES_DATABASE").pipe(Config.withDefault("workflow")),
  username: Config.string("POSTGRES_USER").pipe(Config.withDefault("workflow")),
  password: Config.redacted("POSTGRES_PASSWORD"),
  ssl: Config.boolean("POSTGRES_SSL").pipe(Config.withDefault(false)),
});

// -----------------------------------------------------------------------------
// SQL Client Layer
// -----------------------------------------------------------------------------

/**
 * Create a PgClient layer from environment config
 *
 * **Example** (Inspect pg client live)
 *
 * ```ts
 * import { PgClientLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(PgClientLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgClientLive = PgClient.layerConfig({
  host: Config.string("POSTGRES_HOST").pipe(Config.withDefault("localhost")),
  port: PostgresPortConfig,
  database: Config.string("POSTGRES_DATABASE").pipe(Config.withDefault("workflow")),
  username: Config.string("POSTGRES_USER").pipe(Config.withDefault("workflow")),
  password: Config.redacted("POSTGRES_PASSWORD"),
  ssl: Config.boolean("POSTGRES_SSL").pipe(Config.withDefault(false)),
});

/**
 * PgClient layer with explicit config
 *
 * **Example** (Inspect pg client layer from config)
 *
 * ```ts
 * import { PgClientLayerFromConfig } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(PgClientLayerFromConfig)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const PgClientLayerFromConfig = (config: PostgresConfig) =>
  PgClient.layer({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: Redacted.make(config.password),
    ssl: config.ssl,
  });

// -----------------------------------------------------------------------------
// Message Storage Layer
// -----------------------------------------------------------------------------

/**
 * SqlMessageStorage layer with table prefix
 *
 * **Details**
 *
 * Creates tables:
 * - workflow_cluster_messages: Pending workflow messages
 * - workflow_cluster_replies: Message replies
 *
 * Requires: SqlClient + ShardingConfig
 *
 * **Example** (Inspect message storage live)
 *
 * ```ts
 * import { MessageStorageLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(MessageStorageLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MessageStorageLive = SqlMessageStorage.layerWith({ prefix: "workflow_" });

// -----------------------------------------------------------------------------
// Runner Storage Layer
// -----------------------------------------------------------------------------

/**
 * SqlRunnerStorage layer with table prefix
 *
 * **Details**
 *
 * Creates tables:
 * - workflow_cluster_runners: Runner registration
 *
 * Requires: SqlClient + ShardingConfig
 *
 * **Example** (Inspect runner storage live)
 *
 * ```ts
 * import { RunnerStorageLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(RunnerStorageLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RunnerStorageLive = SqlRunnerStorage.layerWith({ prefix: "workflow_" });

// -----------------------------------------------------------------------------
// Sharding Config Layer (single-node deployment)
// -----------------------------------------------------------------------------

/**
 * ShardingConfig for single-node deployment
 *
 * **Details**
 *
 * Uses default configuration appropriate for a single instance.
 *
 * **Example** (Inspect sharding config live)
 *
 * ```ts
 * import { ShardingConfigLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(ShardingConfigLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ShardingConfigLive = ShardingConfig.layerDefaults;

// -----------------------------------------------------------------------------
// Full Persistence Stack
// -----------------------------------------------------------------------------

/**
 * Complete PostgreSQL persistence layer stack for single-node deployment
 *
 * **Details**
 *
 * Combines:
 * - PgClient (database connection from env)
 * - ShardingConfig (default single-node)
 * - SqlMessageStorage (message persistence)
 * - SqlRunnerStorage (runner registration)
 *
 * **Example** (Inspect postgres persistence live)
 *
 * ```ts
 * import { PostgresPersistenceLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(PostgresPersistenceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PostgresPersistenceLive = Layer.mergeAll(MessageStorageLive, RunnerStorageLive).pipe(
  Layer.provide(ShardingConfigLive),
  Layer.provide(PgClientLive)
);

/**
 * Persistence layer with explicit PostgreSQL config
 *
 * **Example** (Inspect postgres persistence from config)
 *
 * ```ts
 * import { PostgresPersistenceFromConfig } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(PostgresPersistenceFromConfig)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PostgresPersistenceFromConfig = (config: PostgresConfig) =>
  Layer.mergeAll(MessageStorageLive, RunnerStorageLive).pipe(
    Layer.provide(ShardingConfigLive),
    Layer.provide(PgClientLayerFromConfig(config))
  );

// -----------------------------------------------------------------------------
// Schema Migrations (auto-applied by @effect/cluster)
// -----------------------------------------------------------------------------

/**
 * The @effect/cluster SqlMessageStorage and SqlRunnerStorage automatically
 * create their required tables on first use. The schema includes:
 *
 * cluster_messages:
 *   - id: BIGINT PRIMARY KEY (snowflake)
 *   - shard_id: INT
 *   - entity_type: TEXT
 *   - entity_id: TEXT
 *   - message: BYTEA (serialized message)
 *   - created_at: TIMESTAMP
 *
 * cluster_replies:
 *   - request_id: BIGINT PRIMARY KEY
 *   - reply: BYTEA
 *   - created_at: TIMESTAMP
 *
 * cluster_runners:
 *   - id: TEXT PRIMARY KEY
 *   - address: TEXT
 *   - shards: INT[]
 *   - last_heartbeat: TIMESTAMP
 *
 * With prefix "workflow_", tables become:
 *   workflow_cluster_messages, workflow_cluster_replies, workflow_cluster_runners
 */
