import { PgClient } from "@effect/sql-pg";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

/**
 * The cluster's Postgres client, connected on first use, not when the Layer
 * builds: the deploy builds every runner Layer once to learn its entities,
 * where `CLUSTER_DATABASE_URL` is not set. `prepare` runs once after
 * connecting (creating tables).
 *
 * @category constructors
 * @since 0.0.0
 */
export const lazyClusterSql = Effect.fnUntraced(function* (
  prepare: (sql: SqlClient.SqlClient) => Effect.Effect<unknown, unknown>,
) {
  const scope = yield* Effect.scope;
  return yield* Effect.cached(
    Layer.buildWithScope(PgClient.layerConfig({ url: Config.Redacted("CLUSTER_DATABASE_URL") }), scope).pipe(
      Effect.map((context) => Context.get(context, SqlClient.SqlClient)),
      Effect.tap(prepare),
      Effect.tapCause((cause) => Effect.logError("cluster sql: connect or prepare failed", cause)),
      Effect.orDie,
    ),
  );
});
