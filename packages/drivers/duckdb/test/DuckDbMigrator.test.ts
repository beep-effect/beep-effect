import { DuckDbMigrator, DuckDbTestLayer } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { assert, describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as SqlClient from "effect/sql/SqlClient";

// Mirrors effect@4.0.5 packages/sql/pglite/test/Migrator.test.ts plus the
// DuckDB-specific batch semantics pinned by SPEC §8.5. All tests in the first
// block share one in-memory database, so each test uses its own migrations
// table and data tables.

type MigrationRow = {
  readonly migration_id: number;
  readonly name: string;
  readonly created_at: unknown;
};

const withSql = <A, E>(f: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>) =>
  Effect.flatMap(Effect.service(SqlClient.SqlClient), f);

const recordedIds = (table: string) =>
  withSql((sql) =>
    Effect.map(
      sql<{ readonly migration_id: number }>`SELECT migration_id FROM ${sql(table)} ORDER BY migration_id`,
      A.map((row) => row.migration_id)
    )
  );

const tableExists = (name: string) =>
  withSql((sql) =>
    Effect.map(
      sql<{ readonly n: number }>`SELECT count(*) AS n FROM duckdb_tables() WHERE table_name = ${name}`,
      (rows) => rows[0]?.n === 1
    )
  );

describe("DuckDbMigrator", () => {
  it.layer(Layer.mergeAll(DuckDbTestLayer, FileSystem.layerNoop({}), Path.layer), { timeout: "30 seconds" })((it) => {
    it.effect("fromRecord runs migrations in order and records them", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const loader = DuckDbMigrator.fromRecord({
          "2_seed": withSql((sql) => sql`INSERT INTO migrator_test (id, value) VALUES (1, 'hello')`),
          "1_create": withSql((sql) => sql`CREATE TABLE migrator_test (id INTEGER PRIMARY KEY, value TEXT)`),
        });

        const completed = yield* DuckDbMigrator.run({ loader });

        assert.deepStrictEqual(completed, [
          [1, "create"],
          [2, "seed"],
        ]);
        const rows = yield* sql<{ readonly value: string }>`SELECT value FROM migrator_test`;
        assert.deepStrictEqual(rows, [{ value: "hello" }]);
        const migrations =
          yield* sql<MigrationRow>`SELECT migration_id, name, created_at FROM effect_sql_migrations ORDER BY migration_id`;
        assert.deepStrictEqual(
          A.map(migrations, (row) => [row.migration_id, row.name]),
          [
            [1, "create"],
            [2, "seed"],
          ]
        );
        for (const row of migrations) {
          expect(row.created_at).toBeInstanceOf(Date);
        }
      })
    );

    it.effect("rerun returns []", () =>
      Effect.gen(function* () {
        const table = "rerun_migrations";
        const loader = DuckDbMigrator.fromRecord({
          "1_create": withSql((sql) => sql`CREATE TABLE rerun_test (id INTEGER)`),
        });

        const first = yield* DuckDbMigrator.run({ loader, table });
        const second = yield* DuckDbMigrator.run({ loader, table });

        assert.deepStrictEqual(first, [[1, "create"]]);
        assert.deepStrictEqual(second, []);
        assert.deepStrictEqual(yield* recordedIds(table), [1]);
      })
    );

    it.effect("a failing migration dies with MigrationError and rolls back its whole batch", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const table = "failing_migrations";
        const base = {
          "1_base": withSql((sql) => sql`CREATE TABLE failing_base (id INTEGER)`),
        };
        assert.deepStrictEqual(yield* DuckDbMigrator.run({ loader: DuckDbMigrator.fromRecord(base), table }), [
          [1, "base"],
        ]);

        const exit = yield* DuckDbMigrator.run({
          loader: DuckDbMigrator.fromRecord({
            ...base,
            "2_insert": withSql((sql) => sql`INSERT INTO failing_base VALUES (1)`),
            "3_extra": withSql((sql) => sql`CREATE TABLE failing_extra (id INTEGER)`),
            "4_boom": Effect.fail("boom"),
          }),
          table,
        }).pipe(Effect.exit);

        // Since effect 4.0.6 a failing migration is a typed MigrationError failure
        // (4.0.5 raised it as a defect).
        const failure = Exit.findError(exit);
        if (Result.isFailure(failure)) {
          return assert.fail("expected the failing migration run to fail with a MigrationError");
        }
        const error = failure.success;
        assert(error instanceof DuckDbMigrator.MigrationError);
        assert.strictEqual(error.kind, "Failed");
        assert.strictEqual(error.cause, "boom");

        assert.deepStrictEqual(yield* recordedIds(table), [1]);
        assert.deepStrictEqual(yield* sql`SELECT * FROM failing_base`, []);
        assert.isFalse(yield* tableExists("failing_extra"));
      })
    );

    it.effect("a migration that opens sql.withTransaction succeeds", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const table = "nested_tx_migrations";
        const loader = DuckDbMigrator.fromRecord({
          "1_create": withSql((sql) => sql`CREATE TABLE nested_tx_test (id INTEGER)`),
          "2_nested": withSql((sql) =>
            sql.withTransaction(
              Effect.andThen(sql`INSERT INTO nested_tx_test VALUES (1)`, sql`INSERT INTO nested_tx_test VALUES (2)`)
            )
          ),
        });

        assert.deepStrictEqual(yield* DuckDbMigrator.run({ loader, table }), [
          [1, "create"],
          [2, "nested"],
        ]);
        assert.deepStrictEqual(yield* sql`SELECT id FROM nested_tx_test ORDER BY id`, [{ id: 1 }, { id: 2 }]);
        assert.deepStrictEqual(yield* recordedIds(table), [1, 2]);
      })
    );

    it.effect("reuses a custom migrations table whose name needs quoting", () =>
      Effect.gen(function* () {
        const table = "custom migrations";
        const loader = DuckDbMigrator.fromRecord({ "1_first": Effect.void });

        assert.deepStrictEqual(yield* DuckDbMigrator.run({ loader, table }), [[1, "first"]]);
        assert.deepStrictEqual(yield* DuckDbMigrator.run({ loader, table }), []);
        assert.deepStrictEqual(yield* recordedIds(table), [1]);
      })
    );
  });

  it.layer(
    DuckDbMigrator.layer({
      loader: DuckDbMigrator.fromRecord({
        "1_init": withSql((sql) => sql`CREATE TABLE layer_test (id INTEGER PRIMARY KEY, value TEXT)`),
        "2_insert": withSql((sql) => sql`INSERT INTO layer_test VALUES (1, 'hello')`),
      }),
    }).pipe(Layer.provideMerge(DuckDbTestLayer), Layer.provide(Layer.merge(FileSystem.layerNoop({}), Path.layer))),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("DuckDbMigrator.layer builds and migrates", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        assert.deepStrictEqual(yield* sql`SELECT value FROM layer_test`, [{ value: "hello" }]);
        assert.deepStrictEqual(yield* recordedIds("effect_sql_migrations"), [1, 2]);
      })
    );
  });
});
