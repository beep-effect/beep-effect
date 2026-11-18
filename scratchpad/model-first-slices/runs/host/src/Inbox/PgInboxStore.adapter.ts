import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { ClusterSql, ClusterSqlLive, type Connection } from "../ClusterSql.ts";
import { InboxStore } from "./Inbox.store.ts";
import { InboxTables, RunsInboxCheckpoints, RunsInboxSeen, StoreKit } from "./Inbox.table.ts";

const { checkpoints, seen } = InboxTables;

/** What a connection gives the store: Drizzle for the commit, and a repository per table for the reads by key. */
const storeOf = Effect.fnUntraced(function* (connection: Connection) {
  const repositories = yield* Effect.all({
    checkpoints: StoreKit.NativeRepository(RunsInboxCheckpoints, { spanPrefix: "RunsInboxCheckpoints", idColumn: "producer" }),
    seen: StoreKit.NativeRepository(RunsInboxSeen, { spanPrefix: "RunsInboxSeen", idColumn: "key" }),
  }, { concurrency: 1 }).pipe(Effect.provideService(SqlClient.SqlClient, connection.sql));
  return { ...connection, ...repositories };
});

/**
 * The inbox store in the cluster's Postgres, over `ClusterSql`: the
 * producer's checkpoint and the fact keys acted on, moved together in one
 * transaction, so a restarted or failed-over inbox resumes where the last
 * commit left it. The checkpoint only moves forward.
 *
 * @category layers
 * @since 0.0.0
 */
export const PgInboxStoreOverClusterSql = Layer.effect(
  InboxStore,
  Effect.gen(function* () {
    const { connect } = yield* ClusterSql;
    const connected = yield* Effect.cached(Effect.flatMap(connect, storeOf));
    const withStore = <A, E>(f: (store: Effect.Success<typeof connected>) => Effect.Effect<A, E>) => Effect.flatMap(connected, f);
    return InboxStore.of({
      checkpoint: Effect.fn("PgInboxStore.checkpoint")((producer: string) =>
        withStore((store) =>
          store.checkpoints.findById(producer).pipe(
            Effect.map((row) => row.seq),
            Effect.catchTag("NoSuchElementError", () => Effect.succeed(0)),
            Effect.orDie,
          ),
        ),
      ),
      seen: Effect.fn("PgInboxStore.seen")((key: string) =>
        withStore((store) =>
          store.seen.findById(key).pipe(
            Effect.as(true),
            Effect.catchTag("NoSuchElementError", () => Effect.succeed(false)),
            Effect.orDie,
          ),
        ),
      ),
      commit: dual(
        3,
        Effect.fn("PgInboxStore.commit")((producer: string, key: O.Option<string>, seq: number) =>
          withStore((store) =>
            store.sql
              .withTransaction(
                Effect.gen(function* () {
                  if (O.isSome(key)) yield* store.db.insert(seen).values({ key: key.value }).onConflictDoNothing();
                  yield* store.db
                    .insert(checkpoints)
                    .values({ producer, seq })
                    .onConflictDoUpdate({ target: checkpoints.producer, set: { seq: sql`greatest(${checkpoints.seq}, ${seq})` } });
                }),
              )
              .pipe(Effect.orDie),
          ),
        ),
      ),
    });
  }),
);

/**
 * The inbox store in the cluster's own Postgres (`CLUSTER_DATABASE_URL`),
 * connected on first use, with Runs host's pending migrations applied once.
 *
 * @category layers
 * @since 0.0.0
 */
export const PgInboxStore = PgInboxStoreOverClusterSql.pipe(Layer.provide(ClusterSqlLive));
