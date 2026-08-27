/**
 * Runtime: Cluster Runtime Wiring
 *
 * **Details**
 *
 * Pluggable cluster layers that follow Effect best practices:
 * - Durable single-runner backed by SQL (sqlite dev by default)
 * - Swappable SQL client so prod can use Postgres/MySQL without code changes
 * - ShardingConfig pulled from environment (Effect config)
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Config, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { ShardingConfig, SingleRunner } from "effect/unstable/cluster";

/**
 * Build a durable single-runner cluster layer using sqlite (dev-friendly).
 *
 * **Example** (Build a memory-backed sqlite cluster)
 *
 * ```ts
 * import { ClusterSqliteLive, ClusterWithSqlClient } from "@effect-ontology/Runtime/ClusterRuntime"
 *
 * const cluster = ClusterSqliteLive({ filename: "output/cluster.db", runnerStorage: "memory" })
 * const injected = ClusterWithSqlClient({ runnerStorage: "memory" })
 * console.log(cluster !== injected) // true
 * ```
 *
 * @param options.filename - Path to sqlite file (default: output/cluster.db)
 * @param options.prefix - Table prefix for cluster tables (default: corev2)
 * @param options.runnerStorage - Use in-memory runner storage (for tests) if "memory"
 * @category layers
 * @since 0.0.0
 */
export const ClusterSqliteLive = (options?: { readonly filename?: string; readonly runnerStorage?: "memory" }) => {
  const filename = options?.filename ?? "output/cluster.db";

  const sqliteLayer = SqliteClient.layer({
    filename,
    create: true,
    readonly: false,
  });

  const runnerLayer = SingleRunner.layer({
    ...(P.isNotUndefined(options?.runnerStorage) ? { runnerStorage: options.runnerStorage } : {}),
  });

  return Layer.provide(runnerLayer, sqliteLayer);
};

/**
 * Helper to build a SingleRunner layer when a SqlClient is already provided
 * by the caller (e.g., Postgres/MySQL). This keeps composition aligned with
 * Effect patterns: you provide SqlClient elsewhere, then merge this layer.
 *
 * **Example** (Build a cluster that expects an injected SQL client)
 *
 * ```ts
 * import { ClusterSqliteLive, ClusterWithSqlClient } from "@effect-ontology/Runtime/ClusterRuntime"
 *
 * const injected = ClusterWithSqlClient({ runnerStorage: "memory" })
 * const sqlite = ClusterSqliteLive({ filename: "output/cluster.db", runnerStorage: "memory" })
 * console.log(injected !== sqlite) // true
 * ```
 *
 * @param options.prefix - Table prefix for cluster tables (default: corev2)
 * @param options.runnerStorage - Optional "memory" for tests
 * @category layers
 * @since 0.0.0
 */
export const ClusterWithSqlClient = (options?: { readonly runnerStorage?: "memory" }) =>
  SingleRunner.layer({
    ...(P.isNotUndefined(options?.runnerStorage) ? { runnerStorage: options.runnerStorage } : {}),
  });

/**
 * ShardingConfig layer sourced from environment, exposed for convenience.
 * Can be provided to override defaults (e.g., shardsPerGroup, lock TTL).
 *
 * **Example** (Build sharding config from environment)
 *
 * ```ts
 * import { ClusterShardingConfigFromEnv, ClusterSqliteLive } from "@effect-ontology/Runtime/ClusterRuntime"
 *
 * const sharding = ClusterShardingConfigFromEnv()
 * const cluster = ClusterSqliteLive({ filename: "output/cluster.db", runnerStorage: "memory" })
 * console.log(sharding !== cluster) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClusterShardingConfigFromEnv = (options?: Parameters<typeof ShardingConfig.layerFromEnv>[0]) =>
  ShardingConfig.layerFromEnv(options);

/**
 * Build the sqlite-backed SingleRunner using environment overrides:
 * - CLUSTER_DB_FILE (default: output/cluster.db)
 * - CLUSTER_RUNNER_STORAGE (default: durable; set to "memory" for tests)
 *
 * **Example** (Select sqlite cluster storage from env)
 *
 * ```ts
 * import { ConfigProvider, Layer } from "effect"
 * import { ClusterSqliteLive, ClusterSqliteLiveFromEnv } from "@effect-ontology/Runtime/ClusterRuntime"
 *
 * const fromEnv = ClusterSqliteLiveFromEnv.pipe(
 *   Layer.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({
 *         CLUSTER_DB_FILE: "output/cluster.db",
 *         CLUSTER_RUNNER_STORAGE: "memory"
 *       })
 *     )
 *   )
 * )
 * const explicit = ClusterSqliteLive({ filename: "output/cluster.db", runnerStorage: "memory" })
 * console.log(fromEnv !== explicit) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClusterSqliteLiveFromEnv = Layer.unwrap(
  Effect.gen(function* () {
    const filename = yield* Config.string("CLUSTER_DB_FILE").pipe(Config.withDefault("output/cluster.db"));
    const runnerStorageRaw = yield* Config.string("CLUSTER_RUNNER_STORAGE").pipe(Config.withDefault("durable"));
    const runnerStorage = runnerStorageRaw === "memory" ? "memory" : undefined;
    return ClusterSqliteLive({ filename, ...(P.isNotUndefined(runnerStorage) ? { runnerStorage } : {}) });
  })
);

/**
 * Auto-select cluster storage based on env:
 * - If CLUSTER_DB_URL is provided and starts with "sqlite:", use that file.
 * - Else fall back to CLUSTER_DB_FILE (sqlite).
 *
 * **Details**
 *
 * Note: pg/mysql drivers are not wired yet; non-sqlite URLs will log a warning
 * and fall back to sqlite.
 *
 * **Example** (Auto-select cluster storage from CLUSTER_DB_URL)
 *
 * ```ts
 * import { ConfigProvider, Layer } from "effect"
 * import { ClusterAutoLiveFromEnv, ClusterSqliteLiveFromEnv } from "@effect-ontology/Runtime/ClusterRuntime"
 *
 * const auto = ClusterAutoLiveFromEnv.pipe(
 *   Layer.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({
 *         CLUSTER_DB_URL: "sqlite:output/cluster.db",
 *         CLUSTER_RUNNER_STORAGE: "memory"
 *       })
 *     )
 *   )
 * )
 * console.log(auto !== ClusterSqliteLiveFromEnv) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClusterAutoLiveFromEnv = Layer.unwrap(
  Effect.gen(function* () {
    const dbUrlOpt = yield* Config.string("CLUSTER_DB_URL").pipe(Config.option);
    const runnerStorageRaw = yield* Config.string("CLUSTER_RUNNER_STORAGE").pipe(Config.withDefault("durable"));
    const runnerStorage = runnerStorageRaw === "memory" ? "memory" : undefined;
    const dbUrl = O.getOrUndefined(dbUrlOpt);

    if (P.isNotUndefined(dbUrl)) {
      if (Str.startsWith("sqlite:")(dbUrl)) {
        const filename = Str.replace("sqlite:", "")(dbUrl);
        return ClusterSqliteLive({ filename, ...(P.isNotUndefined(runnerStorage) ? { runnerStorage } : {}) });
      } else {
        yield* Effect.logWarning(`CLUSTER_DB_URL=${dbUrl} is set but no driver is wired; falling back to sqlite`);
      }
    }

    const filename = yield* Config.string("CLUSTER_DB_FILE").pipe(Config.withDefault("output/cluster.db"));
    return ClusterSqliteLive({ filename, ...(P.isNotUndefined(runnerStorage) ? { runnerStorage } : {}) });
  })
);
