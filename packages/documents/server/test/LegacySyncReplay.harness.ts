import * as NodeURL from "node:url";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

export const createLegacySyncTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const fs = yield* FileSystem.FileSystem;
  const ddl = yield* fs.readFileString(
    NodeURL.fileURLToPath(
      new URL("../../../_internal/db-admin/drizzle/20260813130540_baseline/migration.sql", import.meta.url)
    )
  );
  for (const statement of Str.split(ddl, "--> statement-breakpoint")) {
    if (Str.startsWith('CREATE TABLE "documents_sync_')(Str.trim(statement))) yield* sql.unsafe(statement);
  }
  const audit = yield* fs.readFileString(
    NodeURL.fileURLToPath(
      new URL("../../../_internal/db-admin/drizzle/20261009202131_audit_soft_delete/migration.sql", import.meta.url)
    )
  );
  for (const statement of Str.split(audit, "--> statement-breakpoint")) {
    if (Str.startsWith('ALTER TABLE "documents_sync_')(Str.trim(statement))) yield* sql.unsafe(statement);
  }
});

// SQL compares JSONB values, preserving strings exactly and normalizing object key order only.
// A full join catches lost/extra rows. jsonb_each compares every physical column.
export const diffLegacySyncTables = Effect.fn("test.diffLegacySyncTables")(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* Effect.forEach(
    ["item", "operation", "conflict", "cursor"],
    Effect.fnUntraced(function* (entity) {
      const table = `documents_sync_${entity}`;
      return yield* sql`WITH expected AS (SELECT id,to_jsonb(t) AS row FROM ${sql(`${table}_cutover_backup`)} t),
      actual AS (SELECT id,to_jsonb(t) AS row FROM ${sql(table)} t)
      SELECT ${table} AS "table",COALESCE(e.id,a.id) AS id,c.key AS column,
        e.row -> c.key AS expected,a.row -> c.key AS actual
      FROM expected e FULL OUTER JOIN actual a ON e.id=a.id
      CROSS JOIN LATERAL (SELECT key FROM jsonb_each(COALESCE(e.row,'{}'::jsonb))
        UNION SELECT key FROM jsonb_each(COALESCE(a.row,'{}'::jsonb))) c
      WHERE (e.row -> c.key) IS DISTINCT FROM (a.row -> c.key)
      ORDER BY id,c.key`;
    }),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
});

export const assertLegacyColumnContracts = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  for (const [entity, fields] of [
    ["item", R.keys(V.LegacyItemRow.fields)],
    ["operation", R.keys(V.LegacyOperationRow.fields)],
    ["conflict", R.keys(V.LegacyConflictRow.fields)],
    ["cursor", R.keys(V.LegacyCursorRow.fields)],
  ] as const) {
    const columns =
      yield* sql`SELECT column_name FROM information_schema.columns WHERE table_name=${`documents_sync_${entity}`} ORDER BY column_name`;
    expect(A.map(columns, (c) => c.column_name)).toEqual(A.sort(fields, Str.Order));
  }
});
