import type * as Domain from "@alchemy.run/domain";
import type { OrgId } from "@proto/kernel/Ids";
import type { DirectoryRow } from "@proto/party-contract/Directory/FindParties.read";
import type { PartyId } from "@proto/party-contract/Party/Party.id";
import {
  DirectoryChange,
  type DirectoryWrite,
  GenerationBehind,
  PartyDirectoryStore,
} from "@proto/party-model/Directory/PartyDirectory.store";
import { lazyClusterSql } from "../ClusterSql.ts";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type * as SqlClient from "effect/sql/SqlClient";
import * as Str from "effect/String";

const schema = (sql: SqlClient.SqlClient) =>
  Effect.all(
    [
      sql`CREATE TABLE IF NOT EXISTS party_directory_rows (
        generation integer NOT NULL, party_id text NOT NULL, org text NOT NULL, name text NOT NULL,
        absorbed text[] NOT NULL DEFAULT '{}', PRIMARY KEY (generation, party_id))`,
      sql`CREATE TABLE IF NOT EXISTS party_directory_positions (
        generation integer NOT NULL, stream text NOT NULL, seq integer NOT NULL,
        PRIMARY KEY (generation, stream))`,
      sql`CREATE TABLE IF NOT EXISTS party_directory_active (
        id integer PRIMARY KEY CHECK (id = 1), generation integer NOT NULL)`,
    ],
    { discard: true },
  );

/**
 * The directory in Postgres: rows and per-source positions per generation,
 * written together in one transaction, so a replayed or redelivered change
 * is refused exactly as the in-memory store refuses it (D14, D16). The
 * model's port is unchanged; only this adapter knows about Postgres.
 *
 * **Details**
 *
 * It connects to the cluster's own database (`CLUSTER_DATABASE_URL`, which
 * every runner and the front have) on first use, and creates its three
 * tables if absent.
 *
 * @category adapters
 * @since 0.0.0
 */
export const PgPartyDirectoryStore = Layer.effect(
  PartyDirectoryStore,
  Effect.gen(function* () {
    const connect = yield* lazyClusterSql(schema);
    const withSql = <A, E>(f: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>) =>
      Effect.logInfo("party directory: using Postgres").pipe(Effect.andThen(Effect.flatMap(connect, f)));
    const activeGeneration = (sql: SqlClient.SqlClient) => Effect.map(
      sql<{ readonly generation: number }>`SELECT generation FROM party_directory_active WHERE id = 1`,
      (rows) => O.map(A.head(rows), (row) => row.generation),
    );
    return PartyDirectoryStore.of({
      apply: Effect.fn("PgPartyDirectoryStore.apply")((generation: number, writes: ReadonlyArray<DirectoryWrite>) =>
        withSql((sql) => sql
          .withTransaction(
            Effect.gen(function* () {
              const active = yield* activeGeneration(sql);
              if (O.exists(active, (current) => generation < current)) return 0;
              if (O.isNone(active)) {
                yield* sql`INSERT INTO party_directory_active (id, generation) VALUES (1, ${generation}) ON CONFLICT (id) DO NOTHING`;
              }
              let applied = 0;
              for (const write of writes) {
                // Lock the position row: two runners applying one stream serialise here.
                const position = yield* sql<{ readonly seq: number }>`
                  SELECT seq FROM party_directory_positions
                  WHERE generation = ${generation} AND stream = ${write.stream} FOR UPDATE`;
                if (O.exists(A.head(position), (row) => write.seq <= row.seq)) continue;
                yield* DirectoryChange.match(write.change, {
                  Registered: ({ partyId, org, name }) =>
                    sql`INSERT INTO party_directory_rows (generation, party_id, org, name, absorbed)
                        VALUES (${generation}, ${partyId}, ${org}, ${name}, '{}')
                        ON CONFLICT (generation, party_id) DO UPDATE SET org = ${org}, name = ${name}, absorbed = '{}'`,
                  Merged: ({ partyId, absorbed }) =>
                    sql`UPDATE party_directory_rows SET absorbed = array_append(absorbed, ${absorbed})
                        WHERE generation = ${generation} AND party_id = ${partyId} AND NOT (${absorbed} = ANY(absorbed))`,
                });
                yield* sql`INSERT INTO party_directory_positions (generation, stream, seq)
                           VALUES (${generation}, ${write.stream}, ${write.seq})
                           ON CONFLICT (generation, stream) DO UPDATE SET seq = ${write.seq}`;
                applied += 1;
              }
              return applied;
            }),
          )
          .pipe(Effect.orDie)),
      ),
      active: withSql((sql) => Effect.orDie(activeGeneration(sql))),
      checkpoints: Effect.fn("PgPartyDirectoryStore.checkpoints")((generation: number) =>
        withSql((sql) => sql<{ readonly stream: string; readonly seq: number }>`
          SELECT stream, seq FROM party_directory_positions WHERE generation = ${generation}`.pipe(
          Effect.map((rows) => HashMap.fromIterable(A.map(rows, (row) => [row.stream, row.seq] as const))),
          Effect.orDie,
        )),
      ),
      switchTo: Effect.fn("PgPartyDirectoryStore.switchTo")((generation: number) =>
        withSql((sql) => sql
          .withTransaction(
            Effect.gen(function* () {
              const behind = yield* sql<{ readonly stream: string }>`
                SELECT a.stream FROM party_directory_positions a
                JOIN party_directory_active act ON act.id = 1 AND a.generation = act.generation
                LEFT JOIN party_directory_positions c ON c.generation = ${generation} AND c.stream = a.stream
                WHERE c.seq IS NULL OR c.seq < a.seq`;
              if (behind.length > 0) return A.map(behind, (row) => row.stream);
              yield* sql`INSERT INTO party_directory_active (id, generation) VALUES (1, ${generation})
                         ON CONFLICT (id) DO UPDATE SET generation = ${generation}`;
              yield* sql`DELETE FROM party_directory_rows WHERE generation < ${generation}`;
              yield* sql`DELETE FROM party_directory_positions WHERE generation < ${generation}`;
              return [];
            }),
          )
          .pipe(
            Effect.orDie,
            Effect.flatMap((behind) =>
              A.isReadonlyArrayEmpty(behind) ? Effect.void : Effect.fail(GenerationBehind.make({ generation, behind })),
            ),
          )),
      ),
      search: Effect.fn("PgPartyDirectoryStore.search")((org: OrgId, text: string, { after, take }: Domain.Query.PageRequest) =>
        withSql((sql) => Effect.gen(function* () {
          const rows = yield* sql<{
            readonly party_id: string;
            readonly org: string;
            readonly name: string;
            readonly absorbed: ReadonlyArray<string>;
          }>`
            SELECT r.party_id, r.org, r.name, r.absorbed FROM party_directory_rows r
            JOIN party_directory_active act ON act.id = 1 AND r.generation = act.generation
            WHERE r.org = ${org} AND lower(r.name) LIKE ${`%${pipe(text, Str.toLowerCase)}%`}
              AND (${after ?? null}::text IS NULL OR r.party_id > ${after ?? null})
            ORDER BY r.party_id LIMIT ${take + 1}`;
          const entries = A.map(
            A.take(rows, take),
            (row): DirectoryRow => ({
              partyId: row.party_id as PartyId,
              org: row.org as OrgId,
              name: row.name,
              absorbed: row.absorbed as ReadonlyArray<PartyId>,
            }),
          );
          return {
            entries,
            cursor: rows.length > take ? O.getOrNull(O.map(A.last(entries), (row) => row.partyId)) : null,
          };
        }).pipe(Effect.orDie)),
      ),
    });
  }),
);
