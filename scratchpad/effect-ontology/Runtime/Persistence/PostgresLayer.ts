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

import { $ScratchpadId } from "@beep/identity";
import { makeDrizzleLayer } from "@beep/postgres";
import { Port } from "@beep/schema/Port";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, Layer} from "effect";
import * as S from "effect/Schema";
import { ShardingConfig, SqlMessageStorage, SqlRunnerStorage } from "effect/unstable/cluster";
import { databaseReady } from "./DatabaseReady.ts";
import {flow} from "effect/Function";

const $I = $ScratchpadId.create("effect-ontology/Runtime/Persistence/PostgresLayer");

export { databaseReady } from "./DatabaseReady.ts";

// -----------------------------------------------------------------------------
// PostgreSQL Configuration Schema
// -----------------------------------------------------------------------------

/**
 * Host, port, credentials, and TLS flag for a PostgreSQL workflow store.
 *
 * **Details**
 *
 * `ssl` defaults to `false`. The password is redacted after decoding so logs
 * cannot print the secret.
 *
 * **Example** (Decode a local workflow config)
 *
 * ```ts
 * import { PostgresConfig } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(PostgresConfig)({
 *   host: "localhost",
 *   port: 5432,
 *   database: "workflow",
 *   username: "workflow",
 *   password: "secret",
 *   ssl: false
 * })
 * console.log(O.map(decoded, (config) => config.host))
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
  password: S.Redacted(S.NonEmptyString),
  ssl: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
}).pipe(
  $I.annoteSchema("PostgresConfig", {
    description: "PostgreSQL host, port, database, username, redacted password, and optional TLS flag.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded PostgreSQL connection settings produced by {@link PostgresConfig}.
 *
 * @see {@link PostgresConfig} for the runtime schema, SSL default, and redacted password.
 * @category type-level
 * @since 0.0.0
 */
export type PostgresConfig = typeof PostgresConfig.Type;

const PostgresPortConfig = Config.number("POSTGRES_PORT").pipe(
  Config.withDefault(5432),
  Config.mapOrFail(
    flow(Port.decodeEffect, Effect.mapError((error) => new Config.ConfigError(error)))
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
 * **Example** (Decode host from a password-bearing env provider)
 *
 * ```ts
 * import { ConfigProvider, Effect } from "effect"
 * import { PostgresConfigFromEnv } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * const config = Effect.runSync(
 *   Effect.provide(
 *     PostgresConfigFromEnv,
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({
 *         POSTGRES_HOST: "localhost",
 *         POSTGRES_PORT: 5432,
 *         POSTGRES_DATABASE: "workflow",
 *         POSTGRES_USER: "workflow",
 *         POSTGRES_PASSWORD: "secret",
 *         POSTGRES_SSL: false
 *       })
 *     )
 *   )
 * )
 * console.log(config.host) // "localhost"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PostgresConfigFromEnv = Config.all({
  host: Config.string("POSTGRES_HOST").pipe(Config.withDefault("localhost")),
  port: PostgresPortConfig,
  database: Config.string("POSTGRES_DATABASE").pipe(Config.withDefault("workflow")),
  username: Config.string("POSTGRES_USER").pipe(Config.withDefault("workflow")),
  password: Config.redacted("POSTGRES_PASSWORD"),
  ssl: Config.boolean("POSTGRES_SSL").pipe(Config.withDefault(false)),
}).pipe(
  Config.mapOrFail(
    flow(PostgresConfig.decodeEffect, Effect.mapError((error) => new Config.ConfigError(error)))
  )
);

/**
 * Constructs a PostgreSQL client layer from a schema-decoded configuration.
 *
 * **Example** (Build a client layer from a decoded config)
 *
 * ```ts
 * import { PostgresConfig, PgClientLayerFromConfig } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const layer = O.map(
 *   S.decodeUnknownOption(PostgresConfig)({
 *     host: "localhost",
 *     port: 5432,
 *     database: "workflow",
 *     username: "workflow",
 *     password: "secret",
 *     ssl: false
 *   }),
 *   PgClientLayerFromConfig
 * )
 * console.log(O.isSome(layer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgClientLayerFromConfig = (config: PostgresConfig) =>
  PgClient.layer({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: config.ssl,
  });

// -----------------------------------------------------------------------------
// SQL Client Layer
// -----------------------------------------------------------------------------

/**
 * Create a PgClient layer from environment config
 *
 * **Example** (Compose the env-backed PostgreSQL client)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { DrizzleLive, PgClientLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(Layer.mergeAll(PgClientLive, DrizzleLive) !== PgClientLive) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgClientLive = Layer.unwrap(PostgresConfigFromEnv.pipe(Effect.map(PgClientLayerFromConfig)));

/**
 * Constructs a Drizzle service from the PostgreSQL client in context.
 *
 * **Example** (Merge Drizzle onto a PostgreSQL client)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { DrizzleLive, PgClientLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(Layer.mergeAll(PgClientLive, DrizzleLive) !== DrizzleLive) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DrizzleLive = makeDrizzleLayer();

/**
 * Provides one environment-configured PostgreSQL client and its Drizzle service.
 *
 * **Example** (Use the combined client and Drizzle layer)
 *
 * ```ts
 * import { DrizzleLive, PgClientLive, PgDrizzleLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(PgDrizzleLive !== PgClientLive) // true
 * console.log(PgDrizzleLive !== DrizzleLive) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgDrizzleLive = DrizzleLive.pipe(Layer.provideMerge(PgClientLive));

/**
 * Provides one scoped PostgreSQL client and Drizzle service after readiness
 * verification and canonical effect-ontology migrations complete.
 *
 * **Example** (Migrate after the client is ready)
 *
 * ```ts
 * import { DatabaseReadyLive, PgDrizzleLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * console.log(DatabaseReadyLive !== PgDrizzleLive) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DatabaseReadyLive = PgDrizzleLive.pipe(
  Layer.tap((databaseContext) => databaseReady().pipe(Effect.provide(databaseContext)))
);

// -----------------------------------------------------------------------------
// Message Storage Layer
// -----------------------------------------------------------------------------

/**
 * SqlMessageStorage layer with table prefix
 *
 * **Details**
 *
 * Creates tables prefixed `workflow_`:
 * - workflow_cluster_messages: Pending workflow messages
 * - workflow_cluster_replies: Message replies
 *
 * Requires: SqlClient + ShardingConfig
 *
 * **Example** (Prefix cluster message tables)
 *
 * ```ts
 * import { MessageStorageLive, RunnerStorageLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
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
 * Creates tables prefixed `workflow_`:
 * - workflow_cluster_runners: Runner registration
 *
 * Requires: SqlClient + ShardingConfig
 *
 * **Example** (Prefix cluster runner tables)
 *
 * ```ts
 * import { MessageStorageLive, RunnerStorageLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
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
 * **Example** (Use single-node sharding defaults)
 *
 * ```ts
 * import { PgClientLive, ShardingConfigLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
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
 * **Example** (Compose message and runner storage)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { MessageStorageLive, PostgresPersistenceLive, RunnerStorageLive } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 *
 * const storage = Layer.mergeAll(MessageStorageLive, RunnerStorageLive)
 * console.log(PostgresPersistenceLive !== storage) // true
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
 * **Example** (Build persistence from a decoded config)
 *
 * ```ts
 * import { PostgresConfig, PostgresPersistenceFromConfig } from "@effect-ontology/Runtime/Persistence/PostgresLayer"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const layer = O.map(
 *   S.decodeUnknownOption(PostgresConfig)({
 *     host: "localhost",
 *     port: 5432,
 *     database: "workflow",
 *     username: "workflow",
 *     password: "secret"
 *   }),
 *   PostgresPersistenceFromConfig
 * )
 * console.log(O.isSome(layer))
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
