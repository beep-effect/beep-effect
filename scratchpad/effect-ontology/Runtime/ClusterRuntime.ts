/**
 * Runtime: Cluster Runtime Wiring
 *
 * Pluggable cluster layers that follow Effect best practices:
 * - Durable single-runner backed by SQL (sqlite dev by default)
 * - Swappable SQL client so prod can use Postgres/MySQL without code changes
 * - ShardingConfig pulled from environment (Effect config)
 *
 * Usage (dev, sqlite):
 * ```ts
 * import { ClusterSqliteLive } from "./Runtime/ClusterRuntime"
 *
 * const Live = HttpServerLive.pipe(
 *   Layer.provideMerge(ClusterSqliteLive()),
 *   // ...other layers
 * )
 * ```
 *
 * Usage (prod, external SqlClient):
 * ```ts
 * const Live = HttpServerLive.pipe(
 *   Layer.provideMerge(ClusterWithSqlClient),
 *   // where ClusterWithSqlClient = Layer.provideMerge(SingleRunner.layer({ prefix: "corev2" }), PgClientLayer)
 * )
 * ```
 *
 * @since 2.0.0
 * @module Runtime/ClusterRuntime
 */

import { ShardingConfig, SingleRunner } from "effect/unstable/cluster"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { Config, Effect, Layer, Option } from "effect"

/**
 * Build a durable single-runner cluster layer using sqlite (dev-friendly).
 *
 * @param options.filename Path to sqlite file (default: output/cluster.db)
 * @param options.prefix   Table prefix for cluster tables (default: corev2)
 * @param options.runnerStorage Use in-memory runner storage (for tests) if "memory"
 */
export const ClusterSqliteLive = (options?: {
  readonly filename?: string
  readonly runnerStorage?: "memory"
}) => {
  const filename = options?.filename ?? "output/cluster.db"

  const sqliteLayer = SqliteClient.layer({
    filename,
    create: true,
    readonly: false
  })

  const runnerLayer = SingleRunner.layer({
    runnerStorage: options?.runnerStorage
  })

  return Layer.provide(runnerLayer, sqliteLayer)
}

/**
 * Helper to build a SingleRunner layer when a SqlClient is already provided
 * by the caller (e.g., Postgres/MySQL). This keeps composition aligned with
 * Effect patterns: you provide SqlClient elsewhere, then merge this layer.
 *
 * @param options.prefix Table prefix for cluster tables (default: corev2)
 * @param options.runnerStorage Optional "memory" for tests
 */
export const ClusterWithSqlClient = (options?: {
  readonly runnerStorage?: "memory"
}) =>
  SingleRunner.layer({
    runnerStorage: options?.runnerStorage
  })

/**
 * ShardingConfig layer sourced from environment, exposed for convenience.
 * Can be provided to override defaults (e.g., shardsPerGroup, lock TTL).
 */
export const ClusterShardingConfigFromEnv = (options?: Parameters<typeof ShardingConfig.layerFromEnv>[0]) =>
  ShardingConfig.layerFromEnv(options)

/**
 * Build the sqlite-backed SingleRunner using environment overrides:
 * - CLUSTER_DB_FILE (default: output/cluster.db)
 * - CLUSTER_RUNNER_STORAGE (default: durable; set to "memory" for tests)
 */
export const ClusterSqliteLiveFromEnv = Layer.unwrap(
  Effect.gen(function*() {
    const filename = yield* Config.string("CLUSTER_DB_FILE").pipe(
      Config.withDefault("output/cluster.db")
    )
    const runnerStorageRaw = yield* Config.string("CLUSTER_RUNNER_STORAGE").pipe(
      Config.withDefault("durable")
    )
    const runnerStorage = runnerStorageRaw === "memory" ? "memory" : undefined
    return ClusterSqliteLive({ filename, runnerStorage })
  })
)

/**
 * Auto-select cluster storage based on env:
 * - If CLUSTER_DB_URL is provided and starts with "sqlite:", use that file.
 * - Else fall back to CLUSTER_DB_FILE (sqlite).
 *
 * Note: pg/mysql drivers are not wired yet; non-sqlite URLs will log a warning
 * and fall back to sqlite.
 */
export const ClusterAutoLiveFromEnv = Layer.unwrap(
  Effect.gen(function*() {
    const dbUrlOpt = yield* Config.string("CLUSTER_DB_URL").pipe(Config.option)
    const runnerStorageRaw = yield* Config.string("CLUSTER_RUNNER_STORAGE").pipe(
      Config.withDefault("durable")
    )
    const runnerStorage = runnerStorageRaw === "memory" ? "memory" : undefined
    const dbUrl = Option.getOrUndefined(dbUrlOpt)

    if (dbUrl) {
      if (dbUrl.startsWith("sqlite:")) {
        const filename = dbUrl.replace("sqlite:", "")
        return ClusterSqliteLive({ filename, runnerStorage })
      } else {
        yield* Effect.logWarning(
          `CLUSTER_DB_URL=${dbUrl} is set but no driver is wired; falling back to sqlite`
        )
      }
    }

    const filename = yield* Config.string("CLUSTER_DB_FILE").pipe(
      Config.withDefault("output/cluster.db")
    )
    return ClusterSqliteLive({ filename, runnerStorage })
  })
)
