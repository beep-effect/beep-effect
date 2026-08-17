/**
 * PostgreSQL Layer for Workflow Persistence
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
import { Config, Effect, Layer, Redacted, Schema } from "effect";
import { ShardingConfig, SqlMessageStorage, SqlRunnerStorage } from "effect/unstable/cluster";

// -----------------------------------------------------------------------------
// PostgreSQL Configuration Schema
// -----------------------------------------------------------------------------

export const PostgresConfig = Schema.Struct({
  host: Schema.String,
  port: Port,
  database: Schema.String,
  username: Schema.String,
  password: Schema.String,
  ssl: Schema.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
});
export type PostgresConfig = typeof PostgresConfig.Type;

const PostgresPortConfig = Config.number("POSTGRES_PORT").pipe(
  Config.withDefault(5432),
  Config.mapOrFail((value) =>
    Schema.decodeEffect(Port)(value).pipe(Effect.mapError((error) => new Config.ConfigError(error)))
  )
);

// -----------------------------------------------------------------------------
// Configuration from Environment
// -----------------------------------------------------------------------------

/**
 * Load PostgreSQL configuration from environment variables
 *
 * Environment variables:
 * - POSTGRES_HOST: Database host (default: localhost)
 * - POSTGRES_PORT: Database port (default: 5432)
 * - POSTGRES_DATABASE: Database name (default: workflow)
 * - POSTGRES_USER: Database username (default: workflow)
 * - POSTGRES_PASSWORD: Database password (required)
 * - POSTGRES_SSL: Enable SSL (default: false)
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
 * Creates tables:
 * - workflow_cluster_messages: Pending workflow messages
 * - workflow_cluster_replies: Message replies
 *
 * Requires: SqlClient + ShardingConfig
 */
export const MessageStorageLive = SqlMessageStorage.layerWith({ prefix: "workflow_" });

// -----------------------------------------------------------------------------
// Runner Storage Layer
// -----------------------------------------------------------------------------

/**
 * SqlRunnerStorage layer with table prefix
 *
 * Creates tables:
 * - workflow_cluster_runners: Runner registration
 *
 * Requires: SqlClient + ShardingConfig
 */
export const RunnerStorageLive = SqlRunnerStorage.layerWith({ prefix: "workflow_" });

// -----------------------------------------------------------------------------
// Sharding Config Layer (single-node deployment)
// -----------------------------------------------------------------------------

/**
 * ShardingConfig for single-node deployment
 *
 * Uses default configuration appropriate for a single instance.
 */
export const ShardingConfigLive = ShardingConfig.layerDefaults;

// -----------------------------------------------------------------------------
// Full Persistence Stack
// -----------------------------------------------------------------------------

/**
 * Complete PostgreSQL persistence layer stack for single-node deployment
 *
 * Combines:
 * - PgClient (database connection from env)
 * - ShardingConfig (default single-node)
 * - SqlMessageStorage (message persistence)
 * - SqlRunnerStorage (runner registration)
 *
 * Usage:
 * ```ts
 * import { PostgresPersistenceLive } from "./Runtime/Persistence/PostgresLayer.ts"
 *
 * const program = Effect.gen(function*() {
 *   // Use workflow services...
 * }).pipe(
 *   Effect.provide(PostgresPersistenceLive)
 * )
 * ```
 */
export const PostgresPersistenceLive = Layer.mergeAll(MessageStorageLive, RunnerStorageLive).pipe(
  Layer.provide(ShardingConfigLive),
  Layer.provide(PgClientLive)
);

/**
 * Persistence layer with explicit PostgreSQL config
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
