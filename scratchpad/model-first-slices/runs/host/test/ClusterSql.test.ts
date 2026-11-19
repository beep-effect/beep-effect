import { makeLayer } from "@beep/pglite";
import { expect, it } from "@effect/vitest";
import { ClusterSql, clusterSqlFrom, clusterSqlNames, migrate, migrationsTable } from "@proto/runs-host/ClusterSql";
import { RunsMigrations } from "@proto/runs-host/Runs.migrations";
import * as RunsSchema from "@proto/runs-host/Runs.schema";
import { getTableName, isTable } from "drizzle-orm";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

// The committed migrations, applied the way a runner applies them: on a real Postgres engine
// (PGlite), once per connection, recorded in Runs host's own migrations table.

const Recorded = S.Array(S.Struct({ migrationId: S.Int, name: S.String }));
const Tables = S.Array(S.Struct({ tablename: S.String }));

it.layer(clusterSqlFrom(makeLayer(clusterSqlNames), RunsMigrations))("Runs host's cluster database", (it) => {
  it.effect("a connection applies every committed migration once and creates every table the schema module exports", () =>
    Effect.gen(function* () {
      const { connect } = yield* ClusterSql;
      const first = yield* connect;
      const second = yield* connect;
      expect(second).toBe(first);
      const rows = yield* first.sql`SELECT migration_id, name FROM ${first.sql(migrationsTable)} ORDER BY migration_id`;
      const recorded = yield* S.decodeUnknownEffect(Recorded)(rows);
      expect(A.map(recorded, ({ migrationId, name }) => `${migrationId}_${name}`)).toEqual(A.sort(R.keys(RunsMigrations), Order.String));
      const again = yield* migrate(RunsMigrations).pipe(Effect.provideService(SqlClient.SqlClient, first.sql));
      expect(again).toEqual([]);
      const listed = yield* first.sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
      const tables = yield* S.decodeUnknownEffect(Tables)(listed);
      const expected = A.map(A.filter(R.values(RunsSchema), isTable), getTableName);
      A.forEach(expected, (table) => expect(A.map(tables, ({ tablename }) => tablename)).toContain(table));
    }),
  );
});
