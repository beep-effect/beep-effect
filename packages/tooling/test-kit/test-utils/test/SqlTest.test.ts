import {
  BunSqliteTestDriver,
  makeSqlTestLayer,
  NodeSqliteTestDriver,
  PgExternalTestDriver,
  PgliteTestcontainersTestDriver,
  PgliteTestcontainersTestDriverConfig,
  SqlTestHarnessError,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer, pipe, Scope } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { SqlTestHooks } from "@beep/test-utils";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const isBunRuntime = process.versions.bun !== undefined;
const isCoverageRatchetRun = process.env.VITEST_COVERAGE_RATCHET === "1";
const localSqliteIt = it.effect.skipIf(isCoverageRatchetRun && !isBunRuntime);
const expectedDriver = isBunRuntime ? "bun-sqlite" : "node-sqlite";
const isSqlTestHarnessError = S.is(SqlTestHarnessError);

const makeLayer = <MigrateError = never, SeedError = never>(hooks?: SqlTestHooks<MigrateError, SeedError>) =>
  isBunRuntime
    ? makeSqlTestLayer(
        hooks === undefined
          ? {
              config: undefined,
              driver: BunSqliteTestDriver,
            }
          : {
              config: undefined,
              driver: BunSqliteTestDriver,
              hooks,
            }
      )
    : makeSqlTestLayer(
        hooks === undefined
          ? {
              config: undefined,
              driver: NodeSqliteTestDriver,
            }
          : {
              config: undefined,
              driver: NodeSqliteTestDriver,
              hooks,
            }
      );

const doesTableExist = Effect.fn("SqlTest.doesTableExist")(function* (tableName: string) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const rows = yield* sql<{ readonly name: string }>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ${tableName}
  `;
  return A.isReadonlyArrayNonEmpty(rows);
});

describe("SqlTest", () => {
  localSqliteIt(
    "creates a fresh SQLite database for each locally provided layer",
    Effect.fnUntraced(function* () {
      const createTable = Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        yield* sql`
          CREATE TABLE notes (
            id INTEGER PRIMARY KEY,
            body TEXT NOT NULL
          )
        `;
        yield* sql`
          INSERT INTO notes (body)
          VALUES ('first')
        `;

        return yield* doesTableExist("notes");
      }).pipe(provideScopedLayer(makeLayer()));

      const tableExistsAfterFreshProvision = yield* doesTableExist("notes").pipe(provideScopedLayer(makeLayer()));

      expect(yield* createTable).toBe(true);
      expect(tableExistsAfterFreshProvision).toBe(false);
    })
  );

  localSqliteIt(
    "runs migrate and seed hooks before the test effect executes",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.gen(function* () {
        const info = yield* TestDatabaseInfo;
        const fs = yield* FileSystem.FileSystem;
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const databasePath = yield* Effect.fromOption(info.databasePath).pipe(Effect.orDie);
        const tempDir = yield* Effect.fromOption(info.tempDir).pipe(Effect.orDie);

        const rows = yield* sql<{ readonly value: string }>`
          SELECT value
          FROM seeded_values
          ORDER BY value ASC
        `;

        return {
          databasePathExists: yield* fs.exists(databasePath),
          driver: info.driver,
          tempDirExists: yield* fs.exists(tempDir),
          values: pipe(
            rows,
            A.map((row) => row.value)
          ),
        };
      }).pipe(
        provideScopedLayer(
          makeLayer({
            migrate: Effect.gen(function* () {
              const sql = (yield* SqlClient.SqlClient).withoutTransforms();
              yield* sql`
                CREATE TABLE seeded_values (
                  value TEXT NOT NULL
                )
              `;
            }),
            seed: Effect.gen(function* () {
              const sql = (yield* SqlClient.SqlClient).withoutTransforms();
              yield* sql`
                INSERT INTO seeded_values (value)
                VALUES ('alpha'), ('beta')
              `;
            }),
          })
        )
      );

      expect(result.driver).toBe(expectedDriver);
      expect(result.databasePathExists).toBe(true);
      expect(result.tempDirExists).toBe(true);
      expect(result.values).toEqual(["alpha", "beta"]);
    })
  );

  localSqliteIt(
    "wraps hook failures in a typed harness error",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makeLayer({
              migrate: Effect.fail("boom"),
            })
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);

        expect(failure).toBeInstanceOf(SqlTestHarnessError);
        if (isSqlTestHarnessError(failure)) {
          expect(failure.phase).toBe("migrate");
          expect(failure.driver).toBe(expectedDriver);
        }
      }
    })
  );

  localSqliteIt(
    "removes the temporary SQLite directory when the layer scope closes",
    Effect.fnUntraced(function* () {
      const scope = yield* Scope.make();
      const services = yield* Layer.buildWithScope(makeLayer(), scope);
      const info = Context.get(services, TestDatabaseInfo);
      const fs = Context.get(services, FileSystem.FileSystem);
      const tempDir = yield* Effect.fromOption(info.tempDir).pipe(Effect.orDie);

      expect(yield* fs.exists(tempDir)).toBe(true);
      yield* Scope.close(scope, Exit.void);
      expect(yield* fs.exists(tempDir)).toBe(false);
    })
  );

  it.effect(
    "rejects invalid PGLite driver config as a typed harness error",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makeSqlTestLayer({
              config: { internalPort: 0 },
              driver: PgliteTestcontainersTestDriver,
            })
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);

        expect(failure).toBeInstanceOf(SqlTestHarnessError);
        if (isSqlTestHarnessError(failure)) {
          expect(failure.phase).toBe("provision");
          expect(failure.driver).toBe("pglite-testcontainers");
        }
      }
    })
  );

  it.effect(
    "uses a generated PGLite Testcontainers password by default",
    Effect.fnUntraced(function* () {
      const config = PgliteTestcontainersTestDriverConfig.make({});

      expect(config.username).toBe("postgres");
      expect(config.database).toBe("postgres");
      expect(config.password).not.toBe("postgres");
      expect(config.password.length).toBeGreaterThan(20);
    })
  );

  it.effect(
    "rejects invalid external PostgreSQL connection URIs as typed harness errors",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makeSqlTestLayer({
              config: { connectionUri: "not a postgres url" },
              driver: PgExternalTestDriver,
            })
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);

        expect(failure).toBeInstanceOf(SqlTestHarnessError);
        if (isSqlTestHarnessError(failure)) {
          expect(failure.phase).toBe("provision");
          expect(failure.driver).toBe("pg-external");
        }
      }
    })
  );
});
