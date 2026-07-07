import {
  assertSchemaArbitraryDecodesToSelf,
  BunSqliteTestDriver,
  makeSqlTestLayer,
  NodeSqliteTestDriver,
  PgExternalConnectionUri,
  PgExternalTestDriver,
  PgExternalTestDriverConfig,
  PgliteSqlTestLayerMode,
  PgliteTestcontainersTestDriver,
  PgliteTestcontainersTestDriverConfig,
  SqlTestHarnessError,
  TestDatabaseInfo,
  TestDatabaseInfoShape,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Config, Context, Effect, Exit, Layer, pipe, Scope } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { SqlTestHooks } from "@beep/test-utils";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const isBunRuntime = process.versions.bun !== undefined;
const isCoverageRatchetRun = O.contains(Effect.runSync(Config.option(Config.string("VITEST_COVERAGE_RATCHET"))), "1");
const localSqliteIt = it.effect.skipIf(isCoverageRatchetRun && !isBunRuntime);
const expectedDriver = isBunRuntime ? "bun-sqlite" : "node-sqlite";

const assertSchemaArbitraryRoundTrips = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: {
    readonly numRuns?: number;
  }
): void => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownEffect(schema);
  const encode = S.encodeUnknownEffect(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Effect.runSync(encode(value));
      const decoded = Effect.runSync(decode(encoded));

      return equivalent(decoded, value);
    }),
    { numRuns: options?.numRuns ?? 20 }
  );
};

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
        if (SqlTestHarnessError.is(failure)) {
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
        if (SqlTestHarnessError.is(failure)) {
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
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.phase).toBe("provision");
          expect(failure.driver).toBe("pg-external");
        }
      }
    })
  );

  it("derives SQL schema arbitrary values accepted by their schemas", () => {
    assertSchemaArbitraryDecodesToSelf(PgExternalConnectionUri, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(PgliteSqlTestLayerMode, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(TestDatabaseInfoShape, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(PgliteTestcontainersTestDriverConfig, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(PgExternalTestDriverConfig, { numRuns: 10 });
  });

  it("round-trips SQL schema arbitraries through their encoded shape", () => {
    assertSchemaArbitraryRoundTrips(PgExternalConnectionUri, { numRuns: 10 });
    assertSchemaArbitraryRoundTrips(PgliteSqlTestLayerMode, { numRuns: 10 });
    assertSchemaArbitraryRoundTrips(TestDatabaseInfoShape, { numRuns: 10 });
    assertSchemaArbitraryRoundTrips(PgliteTestcontainersTestDriverConfig, { numRuns: 10 });
    assertSchemaArbitraryRoundTrips(PgExternalTestDriverConfig, { numRuns: 10 });
  });

  it("preserves SQL schema encoded snapshots", () => {
    const info = TestDatabaseInfoShape.make({
      connectionUri: O.some("postgres://user:pass@localhost:5432/test_db"),
      containerId: O.some("container-1"),
      database: O.some("test_db"),
      databasePath: O.none(),
      driver: "pg-external",
      host: O.some("localhost"),
      port: O.some(5432),
      schema: O.some("beep_test_schema"),
      tempDir: O.none(),
      username: O.some("user"),
    });
    const pgliteConfig = PgliteTestcontainersTestDriverConfig.make({
      database: "postgres",
      internalPort: 5432,
      maxConnections: 1,
      password: "secret",
      startupTimeoutMs: 60_000,
      username: "postgres",
    });
    const pgExternalConfig = PgExternalTestDriverConfig.make({
      connectTimeoutMs: 5_000,
      connectionUri: "postgres://user:pass@localhost:5432/test_db",
      isolation: "schema",
      maxConnections: 1,
      schemaPrefix: "beep_test",
      ssl: false,
    });
    const harnessError = SqlTestHarnessError.make({
      cause: O.none(),
      driver: "pg-external",
      message: "setup failed",
      phase: "provision",
    });

    expect(Effect.runSync(S.encodeUnknownEffect(PgliteSqlTestLayerMode)("auto"))).toBe("auto");
    expect(Effect.runSync(S.encodeUnknownEffect(PgExternalConnectionUri)(pgExternalConfig.connectionUri))).toBe(
      "postgres://user:pass@localhost:5432/test_db"
    );
    expect(Effect.runSync(S.encodeUnknownEffect(TestDatabaseInfoShape)(info))).toEqual({
      connectionUri: O.some("postgres://user:pass@localhost:5432/test_db"),
      containerId: O.some("container-1"),
      database: O.some("test_db"),
      databasePath: O.none(),
      driver: "pg-external",
      host: O.some("localhost"),
      port: O.some(5432),
      schema: O.some("beep_test_schema"),
      tempDir: O.none(),
      username: O.some("user"),
    });
    expect(Effect.runSync(S.encodeUnknownEffect(PgliteTestcontainersTestDriverConfig)(pgliteConfig))).toEqual({
      database: "postgres",
      internalPort: 5432,
      maxConnections: 1,
      password: "secret",
      startupTimeoutMs: 60_000,
      username: "postgres",
    });
    expect(Effect.runSync(S.encodeUnknownEffect(PgExternalTestDriverConfig)(pgExternalConfig))).toEqual({
      connectTimeoutMs: 5_000,
      connectionUri: "postgres://user:pass@localhost:5432/test_db",
      isolation: "schema",
      maxConnections: 1,
      schemaPrefix: "beep_test",
      ssl: false,
    });
    expect(Effect.runSync(S.encodeUnknownEffect(SqlTestHarnessError)(harnessError))).toEqual({
      _tag: "SqlTestHarnessError",
      driver: "pg-external",
      message: "setup failed",
      phase: "provision",
    });
  });

  it("round-trips SQL harness error encoded values", () => {
    const SqlTestHarnessErrorEncoded = S.TaggedStruct("SqlTestHarnessError", {
      driver: S.Literals(["bun-sqlite", "node-sqlite", "pglite-testcontainers", "pglite-inprocess", "pg-external"]),
      message: S.String,
      phase: S.Literals(["provision", "migrate", "seed", "teardown"]),
    });
    const decode = S.decodeUnknownEffect(SqlTestHarnessError);
    const encode = S.encodeUnknownEffect(SqlTestHarnessError);

    fc.assert(
      fc.property(S.toArbitrary(SqlTestHarnessErrorEncoded), (encoded) => {
        const decoded = Effect.runSync(decode(encoded));

        expect(SqlTestHarnessError.is(decoded)).toBe(true);
        expect(Effect.runSync(encode(decoded))).toEqual(encoded);
      }),
      { numRuns: 10 }
    );
  });
});
