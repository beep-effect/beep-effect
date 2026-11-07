import * as NodeURL from "node:url";
import { makeDrizzle, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../drizzle", import.meta.url));
const downPath = NodeURL.fileURLToPath(
  new URL("../../drizzle/20261107120500_shared_membership/down.sql", import.meta.url)
);
const database = Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const migrateAll = Effect.gen(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  yield* migrate(db, { migrationsFolder, migrationsSchema: O.getOrElse(info.schema, () => "drizzle") });
});

const tableExists = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`SELECT to_regclass('shared_membership') IS NOT NULL AS present`;
  return rows[0]?.present === true;
});

describe("db-admin shared membership migration", () => {
  it.layer(Layer.merge(database, BunFileSystem.layer), { timeout: "2 minutes" })((it) => {
    it.effect("creates the table, reverses through down.sql, and re-applies", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const fs = yield* FileSystem.FileSystem;
        yield* migrateAll;
        const created = yield* tableExists;
        expect(created).toBe(true);

        const down = yield* fs.readFileString(downPath);
        for (const statement of Str.split(down, "--> statement-breakpoint")) {
          const body = Str.trim(statement);
          if (body.length > 0) yield* sql.unsafe(body);
        }
        const reversed = yield* tableExists;
        expect(reversed).toBe(false);

        // The journal entry is gone too, so the forward migration runs again.
        yield* migrateAll;
        const reapplied = yield* tableExists;
        expect(reapplied).toBe(true);
      })
    );
  });
});
