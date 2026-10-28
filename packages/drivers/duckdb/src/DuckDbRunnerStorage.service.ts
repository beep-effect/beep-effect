/**
 * DuckDB runner registration and shard leases for a single process (D65).
 *
 * **Details**
 *
 * Ported from effect@4.0.6. DuckDB serializes writes on one connection.
 * Cluster storages cannot coordinate across processes sharing a DuckDB file.
 * Deviations from the upstream SQLite implementation carry `// beep:` markers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import { quotedString, quotedString as quoteString } from "@duckdb/node-api";
import * as A from "effect/Array";
import { PersistenceError } from "effect/cluster/ClusterError";
import * as RunnerStorage from "effect/cluster/RunnerStorage";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Migrator from "effect/sql/Migrator";
import * as SqlClient from "effect/sql/SqlClient";
import { runPrefixedMigrations } from "./internal/storage.ts";
import type * as Scope from "effect/Scope";
import type { SqlError } from "effect/sql/SqlError";
import type * as Statement from "effect/sql/Statement";

const withTracerDisabled = Effect.withTracerEnabled(false);

const $I = $DuckdbId.create("DuckDbRunnerStorage.service");

// beep: Public Effect leaf imports and SQLite-only branches specialize the 4.0.6 service for DuckDB.
const RunnerRegistration = S.Struct({ machine_id: S.Finite }).pipe(
  $I.annoteSchema("RunnerRegistration", { description: "Registered DuckDB runner machine id." })
);
const RunnerRegistrations = S.NonEmptyArray(RunnerRegistration);

// beep: DuckDB uses shared-client table leases only (single process, D65).
const makeStorage = Effect.fnUntraced(function* (options: { readonly prefix?: string | undefined }) {
  const config = yield* ShardingConfig.ShardingConfig;
  const lockOperationInterval = Duration.min(
    Duration.fromInputUnsafe(config.shardLockRefreshInterval),
    Duration.divideUnsafe(Duration.fromInputUnsafe(config.shardLockExpiration), 3)
  );
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const layerScope = yield* Effect.scope;
  const prefix = options?.prefix ?? "cluster";
  const table = (name: string) => `${prefix}_${name}`;

  // `Effect.timeout` waits for the timed-out effect to finish interrupting, so
  // an operation stuck in an uninterruptible region (such as a scope finalizer
  // releasing an unresponsive connection) can outlive its deadline. Fork the
  // operation and timeout the join instead, leaving stalled cleanup to finish
  // detached in the layer scope.
  const withDeadline = Effect.fnUntraced(function* <A, E, R>(operation: Effect.Effect<A, E, R>) {
    const fiber = yield* Effect.forkIn(operation, layerScope, { startImmediately: true });
    return yield* Fiber.join(fiber).pipe(
      Effect.timeout(lockOperationInterval),
      Effect.ensuring(
        Effect.suspend(() =>
          fiber.pollUnsafe() !== undefined
            ? Effect.void
            : Fiber.interrupt(fiber).pipe(Effect.forkIn(layerScope, { startImmediately: true }), Effect.asVoid)
        )
      )
    );
  });

  const runnersTable = table("runners");
  const runnersTableSql = sql(runnersTable);

  const locksTable = table("locks");
  const locksTableSql = sql(locksTable);

  // beep: Explicit function syntax avoids DuckDB ON CONFLICT binding CURRENT_TIMESTAMP as a column.
  const sqlNowString = "get_current_timestamp()";
  const sqlNow = sql.literal(sqlNowString);

  const expiresSeconds = sql.literal(
    Math.ceil(Duration.toSeconds(Duration.fromInputUnsafe(config.shardLockExpiration))).toString()
  );
  // beep: timestamp intervals replace SQLite datetime().
  const lockExpiresAt = sql`${sqlNow} - INTERVAL '${expiresSeconds} seconds'`;

  const encodeBoolean = (b: boolean) => (b ? 1 : 0);

  // Upsert runner and return machine_id
  const insertRunner = (address: string, runner: string, healthy: boolean) =>
    // sqlite
    sql<{ machine_id: number }>`
        INSERT INTO ${runnersTableSql} (address, runner, last_heartbeat, healthy)
        VALUES (${address}, ${runner}, ${sqlNow}, ${encodeBoolean(healthy)})
        ON CONFLICT(address) DO UPDATE SET
          runner = excluded.runner,
          last_heartbeat = excluded.last_heartbeat,
          healthy = excluded.healthy
        RETURNING machine_id;
      `;

  const execWithLockConn = <A>(effect: Statement.Statement<A>) => effect;

  const acquireLock = (address: string, shardIds: ReadonlyArray<string>) => {
    const values = A.map(shardIds, (shardId) => sql`(${stringLiteral(shardId)}, ${stringLiteral(address)}, ${sqlNow})`);
    return sql`
        WITH source(shard_id, address, acquired_at) AS (VALUES ${sql.csv(values)})
        INSERT INTO ${locksTableSql} (shard_id, address, acquired_at)
        SELECT source.shard_id, source.address, source.acquired_at
        FROM source
        WHERE NOT EXISTS (
          SELECT 1 FROM ${locksTableSql}
          WHERE shard_id = source.shard_id
          AND address != ${address}
          AND acquired_at >= ${lockExpiresAt}
        )
        ON CONFLICT(shard_id) DO UPDATE
        SET address = ${address}, acquired_at = ${sqlNow}
      `.pipe(Effect.andThen(acquiredLocks(address, shardIds)), sql.withTransaction);
  };

  // beep: Advisory lock maps are unnecessary for the shared DuckDB writer.
  const acquiredLocks = (address: string, shardIds: ReadonlyArray<string>) =>
    sql<{ shard_id: string }>`
      SELECT shard_id FROM ${sql(locksTable)}
      WHERE address = ${address}
      AND acquired_at >= ${lockExpiresAt}
      AND shard_id IN ${stringLiteralArr(shardIds)}
    `.pipe(
      // beep: DuckDB hash scans are unordered; preserve the upstream input shard order.
      Effect.map((rows) => A.filter(shardIds, (id) => A.some(rows, (row) => row.shard_id === id)))
    );

  const wrapString = quotedString;
  const stringLiteral = (s: string) => sql.literal(wrapString(s));
  const stringLiteralArr = (arr: ReadonlyArray<string>) => sql.literal(`(${A.join(A.map(arr, wrapString), ",")})`);

  const refreshShards = (address: string, shardIds: ReadonlyArray<string>) =>
    sql<{ shard_id: string }>`
        UPDATE ${locksTableSql}
        SET acquired_at = ${sqlNow}
        WHERE address = ${address} AND shard_id IN ${stringLiteralArr(shardIds)}
        RETURNING shard_id
      `.pipe(Effect.map(A.map((row) => row.shard_id)));

  const withLockOperationDeadline = withDeadline;

  const releaseShard = (address: string, shardId: string) =>
    sql`DELETE FROM ${locksTableSql} WHERE address = ${address} AND shard_id = ${shardId}`;

  const releaseAllShards = (address: string) => sql`DELETE FROM ${locksTableSql} WHERE address = ${address}`;

  return RunnerStorage.makeEncoded({
    getRunners: sql<{
      runner: string;
      healthy: number;
    }>`SELECT runner, healthy FROM ${runnersTableSql} WHERE last_heartbeat > ${lockExpiresAt}`.pipe(
      PersistenceError.refail,
      Effect.map(A.map(({ runner, healthy }): readonly [string, boolean] => [runner, Boolean(healthy)])),
      withTracerDisabled
    ),

    register: (address, runner, healthy) =>
      insertRunner(address, runner, healthy).pipe(
        Effect.map((rows) =>
          Number(
            A.headNonEmpty(Result.getOrThrowWith(S.decodeUnknownResult(RunnerRegistrations)(rows), identity)).machine_id
          )
        ),
        PersistenceError.refail,
        withTracerDisabled
      ),

    unregister: (address) =>
      sql`DELETE FROM ${runnersTableSql} WHERE address = ${address} OR last_heartbeat < ${lockExpiresAt}`.pipe(
        Effect.asVoid,
        PersistenceError.refail,
        withTracerDisabled
      ),

    setRunnerHealth: (address, healthy) =>
      sql`UPDATE ${runnersTableSql} SET healthy = ${encodeBoolean(healthy)} WHERE address = ${address}`.pipe(
        Effect.asVoid,
        PersistenceError.refail,
        withTracerDisabled
      ),

    acquire: (address, shardIds) =>
      withLockOperationDeadline(acquireLock(address, shardIds)).pipe(PersistenceError.refail, withTracerDisabled),

    refresh: (address, shardIds) => {
      const heartbeat = sql`UPDATE ${runnersTableSql} SET last_heartbeat = ${sqlNow} WHERE address = ${address}`;
      // An empty refresh is the liveness probe used while lock storage is
      // unhealthy. Run it on the shared pool, so a wedged reserved lock
      // connection cannot block recovery.
      if (shardIds.length === 0) {
        return withDeadline(heartbeat).pipe(Effect.as([]), PersistenceError.refail, withTracerDisabled);
      }
      return withLockOperationDeadline(
        heartbeat.pipe(execWithLockConn, Effect.andThen(refreshShards(address, shardIds)))
      ).pipe(PersistenceError.refail, withTracerDisabled);
    },

    release: (address, shardId) =>
      withLockOperationDeadline(releaseShard(address, shardId)).pipe(
        Effect.asVoid,
        PersistenceError.refail,
        withTracerDisabled
      ),

    releaseAll: (address) =>
      withLockOperationDeadline(releaseAllShards(address)).pipe(
        Effect.asVoid,
        PersistenceError.refail,
        withTracerDisabled
      ),
  });
}, withTracerDisabled);

/**
 * DuckDbRunnerStorage constructor.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbRunnerStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = (options: {
  readonly prefix?: string | undefined;
}): Effect.Effect<
  RunnerStorage.RunnerStorage["Service"],
  SqlError,
  SqlClient.SqlClient | ShardingConfig.ShardingConfig | Scope.Scope
> => Effect.andThen(runRunnerMigrations(options), makeStorage(options));

/**
 * DuckDbRunnerStorage migration loader.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbRunnerStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrations = (options: { readonly prefix?: string | undefined }): Migrator.Loader => {
  const prefix = options.prefix ?? "cluster";
  const table = (name: string) => `${prefix}_${name}`;
  const runnersTable = table("runners");
  const locksTable = table("locks");

  return Migrator.fromRecord({
    // Existing deployments may have these tables but no migration history.
    "0001_create_tables": Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      const runnersTableSql = sql(runnersTable);
      const locksTableSql = sql(locksTable);
      // beep: A DuckDB sequence replaces AUTOINCREMENT.
      yield* sql`CREATE SEQUENCE IF NOT EXISTS ${sql(`${runnersTable}_sequence`)}`;

      yield* sql`
            CREATE TABLE IF NOT EXISTS ${runnersTableSql} (
              machine_id BIGINT PRIMARY KEY DEFAULT nextval(${sql.literal(quoteString(sql`${sql(`${runnersTable}_sequence`)}`.compile()[0]))}),
              address TEXT NOT NULL,
              runner TEXT NOT NULL,
              healthy INTEGER NOT NULL DEFAULT 1,
              last_heartbeat DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
              UNIQUE(address)
            )
          `;

      yield* sql`
            CREATE TABLE IF NOT EXISTS ${locksTableSql} (
              shard_id TEXT PRIMARY KEY,
              address TEXT NOT NULL,
              acquired_at DATETIME NOT NULL
            )
          `;
    }),
  });
};

// Message and runner migration ids overlap, so keep separate histories.
const runRunnerMigrations = runPrefixedMigrations({ migrations, historySuffix: "runner_migrations" });

/**
 * DuckDbRunnerStorage layer.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbRunnerStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerMigrations = (options: {
  readonly prefix?: string | undefined;
}): Layer.Layer<never, never, SqlClient.SqlClient> => Layer.effectDiscard(runRunnerMigrations(options));

/**
 * DuckDbRunnerStorage layer.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbRunnerStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStorage = (options: {
  readonly prefix?: string | undefined;
}): Layer.Layer<RunnerStorage.RunnerStorage, never, SqlClient.SqlClient | ShardingConfig.ShardingConfig> =>
  Layer.effect(RunnerStorage.RunnerStorage)(makeStorage(options));

/**
 * DuckDbRunnerStorage layer.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbRunnerStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerWith = (options: {
  readonly prefix?: string | undefined;
}): Layer.Layer<RunnerStorage.RunnerStorage, SqlError, SqlClient.SqlClient | ShardingConfig.ShardingConfig> =>
  Layer.effect(RunnerStorage.RunnerStorage)(make(options));

/**
 * DuckDbRunnerStorage layer.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbRunnerStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<
  RunnerStorage.RunnerStorage,
  SqlError,
  SqlClient.SqlClient | ShardingConfig.ShardingConfig
> = layerWith({});
