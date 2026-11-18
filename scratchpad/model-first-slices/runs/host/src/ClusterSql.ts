import * as PgClient from "@effect/sql-pg/PgClient";
import { $RunsHostId } from "@proto/kernel/Identity";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as SqlClient from "effect/sql/SqlClient";
import * as Migrator from "effect/sql/Migrator";
import * as Str from "@beep/utils/Str";
import { RunsMigrations } from "./Runs.migrations.ts";

const $I = $RunsHostId.create("ClusterSql");

/**
 * How the cluster client names things: model keys become snake_case
 * columns and come back camelCase, which effect-drizzle's repositories
 * need; JSON values are left as they are.
 *
 * @category constants
 * @since 0.0.0
 */
export const clusterSqlNames = {
  transformQueryNames: Str.snakeCase,
  transformResultNames: Str.camelCase,
  transformJson: false,
} as const;

/**
 * One connection to the cluster's database, migrated: the client, and
 * Drizzle over the same client, so a Drizzle query inside
 * `sql.withTransaction` runs in that transaction.
 *
 * @category models
 * @since 0.0.0
 */
export interface Connection {
  readonly sql: SqlClient.SqlClient;
  readonly db: PgDrizzle.EffectPgDatabase;
}

/**
 * The migrations table Runs host's migrations are recorded in. The party
 * host shares the cluster's database and records its own.
 *
 * @category constants
 * @since 0.0.0
 */
export const migrationsTable = "runs_migrations";

/** A migrations module's record as `effect/sql/Migrator` loads it: each migration runs its statements in order. */
const loaderOf = (migrations: Readonly<Record<string, ReadonlyArray<string>>>) =>
  Migrator.fromRecord(
    R.map(migrations, (statements) =>
      Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
        Effect.forEach(statements, (statement) => sql.unsafe(statement), { concurrency: 1, discard: true }),
      ),
    ),
  );

/**
 * Apply the migrations `migrations` holds that the database has not recorded,
 * in id order, in one transaction, recording each in {@link migrationsTable}.
 * Returns the ids and names applied: none on a database already migrated.
 *
 * @category migrations
 * @since 0.0.0
 */
export const migrate = (migrations: Readonly<Record<string, ReadonlyArray<string>>>) =>
  Migrator.make({})({ loader: loaderOf(migrations), table: migrationsTable });

/**
 * Connect through `client` on first use, apply the pending `migrations`
 * once, and keep the connection for the scope's life.
 *
 * **Details**
 *
 * The deploy builds every runner Layer once to learn its entities, where
 * `CLUSTER_DATABASE_URL` is not set, so nothing connects until a store is
 * used. `effect/sql/Migrator` locks its table, so two runners starting
 * together apply each migration once.
 *
 * @category constructors
 * @since 0.0.0
 */
export const connectWith = Effect.fnUntraced(function* <E>(
  client: Layer.Layer<PgClient.PgClient | SqlClient.SqlClient, E>,
  migrations: Readonly<Record<string, ReadonlyArray<string>>>,
) {
  const scope = yield* Effect.scope;
  return yield* Effect.cached(
    Layer.buildWithScope(client, scope).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const applied = yield* migrate(migrations);
          yield* Effect.logInfo("cluster sql: migrated", { applied: applied.length });
          const db = yield* PgDrizzle.makeWithDefaults();
          return { sql: Context.get(context, SqlClient.SqlClient), db } satisfies Connection;
        }).pipe(Effect.provide(context)),
      ),
      Effect.tapCause((cause) => Effect.logError("cluster sql: connect or migrate failed", cause)),
      Effect.orDie,
    ),
  );
});

/**
 * The cluster's database as Runs host's stores reach it: a connection,
 * made and migrated on first use.
 *
 * @category services
 * @since 0.0.0
 */
export class ClusterSql extends Context.Service<ClusterSql, { readonly connect: Effect.Effect<Connection> }>()($I`ClusterSql`) {}

/**
 * {@link ClusterSql} over a client Layer, applying `migrations` (Runs
 * host's committed ones, `RunsMigrations`, in a deploy).
 *
 * **Example** (A test's database)
 * ```ts
 * import { makeLayer } from "@beep/pglite";
 * import { clusterSqlFrom, clusterSqlNames } from "@proto/runs-host/ClusterSql";
 * import { RunsMigrations } from "@proto/runs-host/Runs.migrations";
 *
 * const sql = clusterSqlFrom(makeLayer(clusterSqlNames), RunsMigrations);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const clusterSqlFrom: {
  (
    migrations: Readonly<Record<string, ReadonlyArray<string>>>,
  ): <E>(client: Layer.Layer<PgClient.PgClient | SqlClient.SqlClient, E>) => Layer.Layer<ClusterSql>;
  <E>(
    client: Layer.Layer<PgClient.PgClient | SqlClient.SqlClient, E>,
    migrations: Readonly<Record<string, ReadonlyArray<string>>>,
  ): Layer.Layer<ClusterSql>;
} = dual(
  2,
  <E>(client: Layer.Layer<PgClient.PgClient | SqlClient.SqlClient, E>, migrations: Readonly<Record<string, ReadonlyArray<string>>>) =>
    Layer.effect(ClusterSql, Effect.map(connectWith(client, migrations), (connect) => ({ connect }))),
);

/**
 * The cluster's own database (`CLUSTER_DATABASE_URL`, which every runner and
 * the front have), with Runs host's committed migrations.
 *
 * @category layers
 * @since 0.0.0
 */
export const ClusterSqlLive = clusterSqlFrom(
  Layer.unwrap(Effect.map(Config.Redacted("CLUSTER_DATABASE_URL"), (url) => PgClient.layer({ url, ...clusterSqlNames }))),
  RunsMigrations,
);
