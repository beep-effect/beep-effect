// Opt-in live pgvector migration proof.
//
//   docker run -d --name effect-ontology-pg -e POSTGRES_PASSWORD=postgres \
//     -e POSTGRES_DB=effect_ontology -p 55436:5432 pgvector/pgvector:0.8.6-pg18
//   EFFECT_ONTOLOGY_PG_URL=postgres://postgres:postgres@localhost:55436/effect_ontology \
//     bunx --bun vitest run --config vitest.config.ts test/Runtime/MigrationRunner.pg.test.ts
//   docker stop effect-ontology-pg && docker rm effect-ontology-pg
import { makeDrizzleLayer, PostgresDrizzle } from "@beep/postgres";
import { BunServices } from "@effect/platform-bun";
import * as PgClient from "@effect/sql-pg/PgClient";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { databaseReady } from "../../Runtime/Persistence/DatabaseReady.ts";
import { migrateFromFolder, migrateOnBoot, migrationsFolder } from "../../Runtime/Persistence/MigrationRunner.ts";

const externalUrl = O.getOrElse(O.fromUndefinedOr(Bun.env.EFFECT_ONTOLOGY_PG_URL), () => "");

const LiveDatabaseLayer = makeDrizzleLayer().pipe(
  Layer.provideMerge(PgClient.layerFrom(PgClient.make({ url: Redacted.make(externalUrl) })))
);

const LivePgvectorLayer = LiveDatabaseLayer.pipe(
  Layer.tap((databaseContext) => databaseReady().pipe(Effect.provide(databaseContext))),
  Layer.provideMerge(BunServices.layer)
);

const JournalRow = S.Struct({ name: S.String });
const FutureMigration = {
  name: "20990101000000_future_probe",
  sql: "CREATE TABLE ontology_future_migration_probe (id integer PRIMARY KEY);",
};

if (Str.isEmpty(externalUrl)) {
  describe.skip("effect-ontology live pgvector migrations — EFFECT_ONTOLOGY_PG_URL not set", () => {});
} else {
  describe("effect-ontology live pgvector migrations", () => {
    it.layer(LivePgvectorLayer)("against a fresh extension-capable PostgreSQL database", (it) => {
      it.effect(
        "applies actual folders, is idempotent, and accepts a future migration",
        Effect.fnUntraced(function* () {
          const database = yield* PostgresDrizzle;
          const sql = yield* SqlClient.SqlClient;
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* migrateOnBoot;
          yield* migrateOnBoot;
          const futureRoot = yield* fs.makeTempDirectoryScoped({ prefix: "effect-ontology-future-migration-" });
          const futureMigrations = path.join(futureRoot, "migrations");
          yield* fs.copy(migrationsFolder, futureMigrations);
          const futureFolder = path.join(futureMigrations, FutureMigration.name);
          yield* fs.makeDirectory(futureFolder);
          yield* fs.writeFileString(path.join(futureFolder, "migration.sql"), FutureMigration.sql);
          yield* migrateFromFolder(futureMigrations);
          const readJournal = SqlSchema.findAll({
            Request: S.Void,
            Result: JournalRow,
            execute: () => sql`SELECT name FROM effect_ontology.__drizzle_migrations ORDER BY id`,
          });
          const names = A.map(yield* readJournal(undefined), (row) => row.name);
          assert.deepEqual(names, [
            "20260817205112_baseline",
            "20260817205129_postgres_features",
            FutureMigration.name,
          ]);
          assert.strictEqual(database, yield* PostgresDrizzle);
          assert.strictEqual(sql, yield* SqlClient.SqlClient);
        })
      );
    });
  });
}
