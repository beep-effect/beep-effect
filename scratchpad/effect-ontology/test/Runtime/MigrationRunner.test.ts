import { PgliteTestLayer } from "@beep/pglite";
import { makeDrizzleLayer, migrateBundle, PostgresDrizzle } from "@beep/postgres";
import * as BunServices from "@effect/platform-bun/BunServices";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import {
  LegacyMigrationHistoryError,
  migrateOnBoot,
  migrationsFolder,
} from "../../Runtime/Persistence/MigrationRunner.ts";

const MigrationProbeRow = S.Struct({ id: S.Int, label: S.String });
const MigrationJournalRow = S.Struct({ name: S.String });

const BaselineProbe = {
  name: "20260101000000_probe_baseline",
  sql: "CREATE TABLE migration_probe (id INTEGER PRIMARY KEY);",
};

const FutureProbe = {
  name: "20260102000000_probe_future",
  sql: "ALTER TABLE migration_probe ADD COLUMN label TEXT NOT NULL DEFAULT 'future';",
};

const DatabaseTestLayer = makeDrizzleLayer().pipe(Layer.provideMerge(PgliteTestLayer));
const MigrationRunnerTestLayer = Layer.merge(DatabaseTestLayer, BunServices.layer);

describe("effect-ontology migrations", () => {
  it.layer(BunServices.layer)("with generated migration files", (it) => {
    it.effect("keeps unsupported PostgreSQL features in the reviewed custom migration", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const migrationNames = yield* fs.readDirectory(migrationsFolder);
        const customSql = yield* Effect.forEach(
          A.filter(migrationNames, Str.endsWith("_postgres_features")),
          (name) => fs.readFileString(`${migrationsFolder}/${name}/migration.sql`)
        );
        const baselineSql = yield* Effect.forEach(
          A.filter(migrationNames, Str.endsWith("_baseline")),
          (name) => fs.readFileString(`${migrationsFolder}/${name}/migration.sql`)
        );
        const sql = A.join(customSql, "\n");
        const baseline = A.join(baselineSql, "\n");

        assert.include(sql, "ADD COLUMN content_tsv tsvector");
        assert.include(sql, "CREATE OR REPLACE FUNCTION hybrid_search");
        assert.include(sql, "idx_embeddings_ivfflat");
        assert.include(sql, "idx_llm_examples_input_text_trgm");
        assert.include(sql, "idx_ingested_links_topics");
        assert.include(sql, "CREATE TRIGGER ingested_links_updated_at");
        assert.isBelow(baseline.indexOf("CREATE EXTENSION IF NOT EXISTS vector"), baseline.indexOf('vector(768)'));
        assert.include(baseline, 'CONSTRAINT "claims_rank_check"');
        assert.include(baseline, 'CONSTRAINT "different_claims"');
        assert.include(baseline, 'CONSTRAINT "ingested_links_status_check"');
        assert.include(baseline, 'CREATE INDEX "idx_claims_derived_at"');
      })
    );
  });

  it.layer(DatabaseTestLayer)("with canonical Drizzle migration journaling", (it) => {
    it.effect("applies fresh, remains idempotent, and discovers a future migration", () =>
      Effect.gen(function* () {
        const database = yield* PostgresDrizzle;
        const sql = yield* SqlClient.SqlClient;
        const config = { migrationsSchema: "effect_ontology", migrations: [BaselineProbe] };

        yield* migrateBundle(database, config);
        yield* migrateBundle(database, config);
        yield* migrateBundle(database, { ...config, migrations: [BaselineProbe, FutureProbe] });
        yield* sql`INSERT INTO migration_probe (id) VALUES (1)`;

        const readProbe = SqlSchema.findOne({
          Request: S.Void,
          Result: MigrationProbeRow,
          execute: () => sql`SELECT id, label FROM migration_probe WHERE id = 1`,
        });
        const readJournal = SqlSchema.findAll({
          Request: S.Void,
          Result: MigrationJournalRow,
          execute: () => sql`
            SELECT name
            FROM effect_ontology.__drizzle_migrations
            ORDER BY name
          `,
        });

        const probe = yield* readProbe(undefined);
        const journal = yield* readJournal(undefined);
        assert.strictEqual(probe.label, "future");
        assert.deepStrictEqual(
          A.map(journal, (row) => row.name),
          [BaselineProbe.name, FutureProbe.name]
        );
      })
    );
  });

  it.layer(MigrationRunnerTestLayer)("with a legacy scratch migration journal", (it) => {
    it.effect("refuses an unsafe in-place rebaseline with reset guidance", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`
          CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL
          )
        `;

        const error = yield* migrateOnBoot.pipe(Effect.flip);
        assert.instanceOf(error, LegacyMigrationHistoryError);
        assert.include(error.message, "Recreate the scratch database");
      })
    );
  });
});
