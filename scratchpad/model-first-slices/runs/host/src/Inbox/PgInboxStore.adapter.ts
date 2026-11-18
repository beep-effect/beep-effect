import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type * as SqlClient from "effect/sql/SqlClient";
import { lazyClusterSql } from "../ClusterSql.ts";
import { InboxStore } from "./Inbox.store.ts";
import { thunk0 } from "@beep/utils"

/**
 * The inbox store in the cluster's Postgres: the producer's checkpoint and
 * the fact keys acted on, moved together in one transaction, so a restarted
 * or failed-over inbox resumes where the last commit left it.
 *
 * @category layers
 * @since 0.0.0
 */
export const PgInboxStore = Layer.effect(
  InboxStore,
  Effect.gen(function* () {
    const connect = yield* lazyClusterSql((sql) =>
      Effect.all([
        sql`CREATE TABLE IF NOT EXISTS runs_inbox_checkpoints (producer text PRIMARY KEY, seq integer NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS runs_inbox_seen (key text PRIMARY KEY)`,
      ], { concurrency: 1 }),
    );
    const withSql = <A, E>(f: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>) => Effect.flatMap(connect, f);
    return InboxStore.of({
      checkpoint: Effect.fn("PgInboxStore.checkpoint")((producer: string) =>
        withSql((sql) => sql<{ readonly seq: number }>`SELECT seq FROM runs_inbox_checkpoints WHERE producer = ${producer}`.pipe(
          Effect.map((rows) => O.getOrElse(O.map(A.head(rows), (row) => row.seq), thunk0)),
          Effect.orDie,
        )),
      ),
      seen: Effect.fn("PgInboxStore.seen")((key: string) =>
        withSql((sql) => sql`SELECT 1 FROM runs_inbox_seen WHERE key = ${key}`.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.orDie,
        )),
      ),
      commit: Effect.fn("PgInboxStore.commit")((producer: string, key: O.Option<string>, seq: number) =>
        withSql((sql) => sql
          .withTransaction(
            Effect.gen(function* () {
              if (O.isSome(key)) yield* sql`INSERT INTO runs_inbox_seen (key) VALUES (${key.value}) ON CONFLICT DO NOTHING`;
              yield* sql`INSERT INTO runs_inbox_checkpoints (producer, seq) VALUES (${producer}, ${seq})
                         ON CONFLICT (producer) DO UPDATE SET seq = GREATEST(runs_inbox_checkpoints.seq, ${seq})`;
            }),
          )
          .pipe(Effect.orDie)),
      ),
    });
  }),
);
