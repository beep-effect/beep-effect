import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  MigrationBundleLegacyNameSet,
  makeDrizzle,
  makeDrizzleLayer,
  migrate,
  migrateBundle,
  NativePgClient,
  PostgresClient,
  PostgresDrizzle,
} from "@beep/postgres";
import { makePgliteIntegrationGate, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import { formatToMillis } from "drizzle-orm/migrator.utils";
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { Effect, Layer, pipe } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Statement from "effect/unstable/sql/Statement";

const { shouldRunPgliteIntegration, makePgliteLayer } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("./fixtures/migrations", import.meta.url));
const fixtureMigrationName = "20260101000000_create_driver_migrated_notes";

const driverNotes = pgTable("driver_notes", {
  body: text("body").notNull(),
  id: serial("id").primaryKey(),
  rating: integer("rating").notNull(),
});

const migratedNotes = pgTable("driver_migrated_notes", {
  body: text("body").notNull(),
  id: serial("id").primaryKey(),
});

const bundleNotes = pgTable("driver_bundle_notes", {
  body: text("body").notNull(),
  id: serial("id").primaryKey(),
});

// Multi-statement SQL without `--> statement-breakpoint` markers, exercising
// the legacy statement split on the in-memory path.
const bundleNotesMigration = {
  name: "20260102000000_create_driver_bundle_notes",
  sql: [
    "CREATE TABLE driver_bundle_notes (",
    "  id SERIAL PRIMARY KEY,",
    "  body TEXT NOT NULL",
    ");",
    "",
    "CREATE UNIQUE INDEX driver_bundle_notes_body_unique_idx",
    "  ON driver_bundle_notes (body);",
    "",
  ].join("\n"),
};

const makePostgresClientLayer = () =>
  Layer.unwrap(Effect.map(Effect.service(NativePgClient.PgClient), PostgresClient.fromPgClient)).pipe(
    Layer.provideMerge(makePgliteLayer())
  );

const makePostgresDrizzleLayer = () =>
  makeDrizzleLayer().pipe(Layer.provideMerge(makePgliteLayer({ migrate: createDriverNotesTable })));

const createDriverNotesTable = Effect.gen(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  yield* sql`
    CREATE TABLE driver_notes (
      id SERIAL PRIMARY KEY,
      body TEXT NOT NULL,
      rating INTEGER NOT NULL
    )
  `;
});

const bodiesWithRatings = (rows: ReadonlyArray<{ readonly body: string; readonly rating: number }>) =>
  pipe(
    rows,
    A.map((row) => `${row.body}:${row.rating}`)
  );

if (!shouldRunPgliteIntegration) {
  describe.skip("Postgres PgLite integration", () => {});
} else {
  // The shared PgLite wire-protocol server is single-connection; keep the layer
  // acquisitions sequential so Drizzle and migration tests do not race it.
  describe("Postgres PgLite integration", { concurrent: false }, () => {
    layer(makePostgresClientLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "provides PostgresClient over the PgLite PgClient",
        Effect.fnUntraced(function* () {
          const beepClient = yield* PostgresClient;
          const nativeClient = yield* NativePgClient.PgClient;
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const info = yield* TestDatabaseInfo;
          const rows = yield* sql<{ readonly value: number }>`SELECT 41 + 1 AS value`;
          const value = pipe(
            rows,
            A.head,
            O.map((row) => row.value),
            O.getOrElse(() => 0)
          );

          expect(["pg-external", "pglite-testcontainers", "pglite-inprocess"]).toContain(info.driver);
          expect(beepClient).toBe(nativeClient);
          expect(value).toBe(42);
        }),
        120_000
      );
    });

    layer(makePostgresDrizzleLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs Drizzle CRUD and transactions through makeDrizzleLayer",
        Effect.fnUntraced(function* () {
          const db = yield* PostgresDrizzle;

          yield* db.insert(driverNotes).values([
            { body: "alpha", rating: 2 },
            { body: "beta", rating: 1 },
          ]);

          const selected = yield* db
            .select({ body: driverNotes.body, rating: driverNotes.rating })
            .from(driverNotes)
            .orderBy(driverNotes.rating);
          const transacted = yield* db.transaction(
            Effect.fnUntraced(function* (tx) {
              yield* tx.insert(driverNotes).values({ body: "tx", rating: 3 });
              return yield* tx
                .select({ body: driverNotes.body, rating: driverNotes.rating })
                .from(driverNotes)
                .orderBy(driverNotes.rating);
            })
          );

          expect(bodiesWithRatings(selected)).toEqual(["beta:1", "alpha:2"]);
          expect(bodiesWithRatings(transacted)).toEqual(["beta:1", "alpha:2", "tx:3"]);
        }),
        120_000
      );
    });

    layer(makePgliteLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs Drizzle migrations from a fixture folder through PgLite",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );

          yield* migrate(db, {
            migrationsFolder,
            migrationsSchema,
          });
          yield* db.insert(migratedNotes).values({ body: "from migration" });
          const rows = yield* db.select({ body: migratedNotes.body }).from(migratedNotes);

          const result = pipe(
            rows,
            A.map((row) => row.body)
          );

          expect(result).toEqual(["from migration"]);
        }),
        120_000
      );
    });

    layer(Layer.merge(makePgliteLayer(), NodeServices.layer), { timeout: "2 minutes" })((it) => {
      it.effect(
        "continues a folder-migrated journal from an in-memory bundle",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const info = yield* TestDatabaseInfo;
          const path = yield* Path.Path;
          const db = yield* makeDrizzle();
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const fixtureMigrationSql = yield* fs.readFileString(
            path.join(migrationsFolder, fixtureMigrationName, "migration.sql")
          );
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );

          // Journal seeded by the folder path, exactly like a deployed database.
          yield* migrate(db, { migrationsFolder, migrationsSchema });

          // Handoff: the same migration delivered as an in-memory bundle must
          // be a no-op (name-keyed journal) rather than a re-application.
          yield* migrateBundle(db, {
            migrations: [{ name: fixtureMigrationName, sql: fixtureMigrationSql }],
            migrationsSchema,
          });

          const journalAfterHandoff = yield* sql<{ readonly hash: string; readonly name: string }>`
            SELECT hash, name FROM ${Statement.identifier(migrationsSchema)}.__drizzle_migrations ORDER BY id
          `;

          expect(
            pipe(
              journalAfterHandoff,
              A.map(({ hash, name }) => ({ hash, name }))
            )
          ).toEqual([
            {
              hash: createHash("sha256").update(fixtureMigrationSql).digest("hex"),
              name: fixtureMigrationName,
            },
          ]);

          // A genuinely new bundle migration applies and journals normally.
          yield* migrateBundle(db, {
            migrations: [{ name: fixtureMigrationName, sql: fixtureMigrationSql }, bundleNotesMigration],
            migrationsSchema,
          });

          yield* db.insert(bundleNotes).values({ body: "from bundle" });
          const rows = yield* db.select({ body: bundleNotes.body }).from(bundleNotes);
          const journalNames = yield* sql<{ readonly name: string }>`
            SELECT name FROM ${Statement.identifier(migrationsSchema)}.__drizzle_migrations ORDER BY id
          `;

          expect(
            pipe(
              rows,
              A.map((row) => row.body)
            )
          ).toEqual(["from bundle"]);
          expect(
            pipe(
              journalNames,
              A.map((row) => row.name)
            )
          ).toEqual([fixtureMigrationName, bundleNotesMigration.name]);

          // Entries without a timestamped name fail fast instead of silently
          // re-applying on every boot (v1 journal matching is name-keyed).
          const invalidNameError = yield* migrateBundle(db, {
            migrations: [{ name: "", sql: "SELECT 1;\n" }],
            migrationsSchema,
          }).pipe(Effect.flip);

          expect(invalidNameError._tag).toBe("PostgresError");
        }),
        120_000
      );

      it.effect(
        "skips a re-baseline only after the complete legacy journal is present",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );
          const firstLegacy = {
            name: "20260101000000_legacy_first",
            sql: "CREATE TABLE legacy_rebaseline_probe (id integer PRIMARY KEY);\n",
          };
          const secondLegacy = {
            name: "20260101000001_legacy_second",
            sql: "ALTER TABLE legacy_rebaseline_probe ADD COLUMN prior_value text;\n",
          };
          const canonicalBaseline = {
            name: "20260101000002_canonical_baseline",
            sql: "CREATE TABLE legacy_rebaseline_probe (id integer PRIMARY KEY, prior_value text);\n",
          };
          const compatibility = MigrationBundleLegacyNameSet.make({
            canonicalName: canonicalBaseline.name,
            legacyNames: [firstLegacy.name, secondLegacy.name],
          });

          yield* migrateBundle(db, { migrations: [firstLegacy, secondLegacy], migrationsSchema });
          yield* migrateBundle(db, {
            legacyNameSets: [compatibility],
            migrations: [
              canonicalBaseline,
              {
                name: "20260101000003_after_rebaseline",
                sql: "ALTER TABLE legacy_rebaseline_probe ADD COLUMN current_value text;\n",
              },
            ],
            migrationsSchema,
          });

          const columns = yield* sql<{ readonly column_name: string }>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'legacy_rebaseline_probe'
            ORDER BY ordinal_position
          `;
          expect(A.map(columns, (row) => row.column_name)).toEqual(["id", "prior_value", "current_value"]);
          const journalNames = yield* sql<{ readonly name: string }>`
            SELECT name FROM ${Statement.identifier(migrationsSchema)}.__drizzle_migrations ORDER BY id
          `;
          expect(
            A.takeRight(
              A.map(journalNames, (row) => row.name),
              3
            )
          ).toEqual([firstLegacy.name, secondLegacy.name, "20260101000003_after_rebaseline"]);
        }),
        120_000
      );

      it.effect(
        "upgrades a complete version-zero legacy journal before skipping a re-baseline",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );
          const migrationsTable = "__drizzle_migrations_v0_rebaseline";
          const firstLegacy = {
            name: "20260103000000_legacy_first",
            sql: "CREATE TABLE legacy_v0_rebaseline_probe (id integer PRIMARY KEY);\n",
          };
          const secondLegacy = {
            name: "20260103000001_legacy_second",
            sql: "ALTER TABLE legacy_v0_rebaseline_probe ADD COLUMN prior_value text;\n",
          };
          const canonicalBaseline = {
            name: "20260103000002_canonical_baseline",
            sql: "CREATE TABLE legacy_v0_rebaseline_probe (id integer PRIMARY KEY, prior_value text);\n",
          };

          yield* sql`CREATE SCHEMA IF NOT EXISTS ${Statement.identifier(migrationsSchema)}`;
          yield* sql`
            CREATE TABLE ${Statement.identifier(migrationsSchema)}.${Statement.identifier(migrationsTable)} (
              id serial PRIMARY KEY,
              hash text NOT NULL,
              created_at bigint
            )
          `;
          yield* sql`CREATE TABLE legacy_v0_rebaseline_probe (id integer PRIMARY KEY)`;
          yield* sql`ALTER TABLE legacy_v0_rebaseline_probe ADD COLUMN prior_value text`;
          yield* sql`
            INSERT INTO ${Statement.identifier(migrationsSchema)}.${Statement.identifier(migrationsTable)}
              (hash, created_at)
            VALUES
              (
                ${createHash("sha256").update(firstLegacy.sql).digest("hex")},
                ${formatToMillis(Str.slice(0, 14)(firstLegacy.name))}
              ),
              (
                ${createHash("sha256").update(secondLegacy.sql).digest("hex")},
                ${formatToMillis(Str.slice(0, 14)(secondLegacy.name))}
              )
          `;

          yield* migrateBundle(db, {
            legacyNameSets: [
              MigrationBundleLegacyNameSet.make({
                canonicalName: canonicalBaseline.name,
                legacyNames: [firstLegacy.name, secondLegacy.name],
              }),
            ],
            migrations: [
              canonicalBaseline,
              {
                name: "20260103000003_after_rebaseline",
                sql: "ALTER TABLE legacy_v0_rebaseline_probe ADD COLUMN current_value text;\n",
              },
            ],
            migrationsSchema,
            migrationsTable,
          });

          const journalNames = yield* sql<{ readonly name: string }>`
            SELECT name
            FROM ${Statement.identifier(migrationsSchema)}.${Statement.identifier(migrationsTable)}
            ORDER BY id
          `;
          expect(A.map(journalNames, (row) => row.name)).toEqual([
            firstLegacy.name,
            secondLegacy.name,
            "20260103000003_after_rebaseline",
          ]);
        }),
        120_000
      );

      it.effect(
        "refuses a partial legacy journal instead of applying a conflicting baseline",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );
          const firstLegacy = {
            name: "20260102000000_legacy_first",
            sql: "CREATE TABLE partial_rebaseline_probe (id integer PRIMARY KEY);\n",
          };
          const canonicalBaseline = {
            name: "20260102000002_canonical_baseline",
            sql: "CREATE TABLE partial_rebaseline_probe (id integer PRIMARY KEY);\n",
          };
          yield* migrateBundle(db, { migrations: [firstLegacy], migrationsSchema });

          const failure = yield* migrateBundle(db, {
            legacyNameSets: [
              MigrationBundleLegacyNameSet.make({
                canonicalName: canonicalBaseline.name,
                legacyNames: [firstLegacy.name, "20260102000001_legacy_second"],
              }),
            ],
            migrations: [canonicalBaseline],
            migrationsSchema,
          }).pipe(Effect.flip);

          expect(failure._tag).toBe("PostgresError");
          expect(O.getOrElse(failure.message, () => "")).toContain("partial legacy migration history");
        }),
        120_000
      );
    });
  });
}
