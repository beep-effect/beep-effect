import {
  BunSqliteTestDriver,
  makePgliteSqlTestLayer,
  makePgliteTestcontainerResource,
  makeSqlTestLayer,
  NodeSqliteTestDriver,
  PgExternalTestDriver,
  provideScopedLayer,
  SqlTestHarnessError,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, ConfigProvider, Duration, Effect, Exit, Fiber } from "effect";
import * as O from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const nodeRuntimeEffectIt = it.effect.skipIf(process.versions.bun !== undefined);

vi.doMock("pg", () => ({
  Client: class {
    readonly connection = { stream: { destroy: () => undefined } };

    connect = () => Promise.reject("offline PostgreSQL refusal");
    end = () => Promise.resolve();
    query = () => Promise.resolve();
  },
}));

vi.doMock("testcontainers", () => ({
  GenericContainer: class {
    static fromDockerfile = () => ({
      build: () => Promise.resolve(),
    });

    withEnvironment = () => this;
    withExposedPorts = () => this;
    withStartupTimeout = () => this;
    withWaitStrategy = () => this;
    start = () => Promise.reject("offline container startup refusal");
  },
  Wait: {
    forListeningPorts: () => ({}),
  },
}));

const migrate = Effect.gen(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  yield* sql`
    CREATE TABLE offline_notes (
      id INTEGER PRIMARY KEY,
      body TEXT NOT NULL
    )
  `;
});

const seed = Effect.gen(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  yield* sql`
    INSERT INTO offline_notes (id, body)
    VALUES (1, 'alpha'), (2, 'beta')
  `;
});

const readOfflineFixture = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const rows = yield* sql<{ readonly body: string }>`
    SELECT body
    FROM offline_notes
    ORDER BY id ASC
  `;

  return {
    bodies: A.map(rows, (row) => row.body),
    databasePath: info.databasePath,
    driver: info.driver,
    tempDir: info.tempDir,
  };
});

describe("SqlTest offline coverage", () => {
  it.effect("provisions Node SQLite and runs migrate and seed hooks", () =>
    Effect.gen(function* () {
      const result = yield* readOfflineFixture().pipe(
        provideScopedLayer(
          makeSqlTestLayer({
            config: undefined,
            driver: NodeSqliteTestDriver,
            hooks: { migrate, seed },
          })
        )
      );

      expect(result.driver).toBe("node-sqlite");
      expect(result.bodies).toEqual(["alpha", "beta"]);
      expect(O.isSome(result.databasePath)).toBe(true);
      expect(O.isSome(result.tempDir)).toBe(true);
    })
  );

  it.effect("maps migrate and seed hook failures to their lifecycle phases", () =>
    Effect.gen(function* () {
      const migrateExit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makeSqlTestLayer({
              config: undefined,
              driver: NodeSqliteTestDriver,
              hooks: { migrate: Effect.fail("offline migrate failure") },
            })
          )
        )
      );
      const seedExit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makeSqlTestLayer({
              config: undefined,
              driver: NodeSqliteTestDriver,
              hooks: { seed: Effect.fail("offline seed failure") },
            })
          )
        )
      );

      expect(Exit.isFailure(migrateExit)).toBe(true);
      if (Exit.isFailure(migrateExit)) {
        const failure = Cause.squash(migrateExit.cause);
        expect(SqlTestHarnessError.is(failure)).toBe(true);
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.driver).toBe("node-sqlite");
          expect(failure.phase).toBe("migrate");
        }
      }

      expect(Exit.isFailure(seedExit)).toBe(true);
      if (Exit.isFailure(seedExit)) {
        const failure = Cause.squash(seedExit.cause);
        expect(SqlTestHarnessError.is(failure)).toBe(true);
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.driver).toBe("node-sqlite");
          expect(failure.phase).toBe("seed");
        }
      }
    })
  );

  it.effect("uses auto-selected in-process PGLite with no database environment", () =>
    Effect.gen(function* () {
      const result = yield* readOfflineFixture().pipe(
        provideScopedLayer(makePgliteSqlTestLayer({ hooks: { migrate, seed } })),
        provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({})))
      );

      expect(result.driver).toBe("pglite-inprocess");
      expect(result.bodies).toEqual(["alpha", "beta"]);
      expect(O.isSome(result.databasePath)).toBe(true);
      expect(O.isSome(result.tempDir)).toBe(true);
    })
  );

  it.effect("maps an auto-selected invalid external URL before network access", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(makePgliteSqlTestLayer()),
          provideScopedLayer(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                BEEP_TEST_DATABASE_URL: "not a postgres url",
              })
            )
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);
        expect(SqlTestHarnessError.is(failure)).toBe(true);
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.driver).toBe("pg-external");
          expect(failure.phase).toBe("provision");
        }
      }
    })
  );

  it.effect("maps in-process PGLite extension setup failures", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makePgliteSqlTestLayer({
              inProcess: {
                extensions: {
                  offlineFailure: {
                    name: "offline-failure",
                    setup: () => Promise.reject("offline extension failure"),
                  },
                },
              },
              mode: "in-process",
            })
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);
        expect(SqlTestHarnessError.is(failure)).toBe(true);
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.driver).toBe("pglite-inprocess");
          expect(failure.phase).toBe("provision");
        }
      }
    })
  );

  it.effect("maps mocked Testcontainers startup failure without Docker", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Effect.scoped(makePgliteTestcontainerResource()));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);
        expect(SqlTestHarnessError.is(failure)).toBe(true);
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.driver).toBe("pglite-testcontainers");
          expect(failure.phase).toBe("provision");
        }
      }
    })
  );

  nodeRuntimeEffectIt("maps Bun SQLite provisioning failure under the Node coverage runtime", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makeSqlTestLayer({
              config: undefined,
              driver: BunSqliteTestDriver,
            })
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);
        expect(SqlTestHarnessError.is(failure)).toBe(true);
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.driver).toBe("bun-sqlite");
          expect(failure.phase).toBe("provision");
        }
      }
    })
  );

  nodeRuntimeEffectIt("maps mocked external PostgreSQL refusal with virtual retry time", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.void.pipe(
        provideScopedLayer(
          makeSqlTestLayer({
            config: {
              connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/offline",
              connectTimeoutMs: 1,
              isolation: "none",
            },
            driver: PgExternalTestDriver,
          })
        ),
        Effect.exit,
        Effect.forkChild
      );

      yield* Effect.forEach(
        A.range(0, 24),
        () => Effect.yieldNow.pipe(Effect.andThen(TestClock.adjust(Duration.millis(300)))),
        { discard: true }
      );
      const exit = yield* Fiber.join(fiber);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);
        expect(SqlTestHarnessError.is(failure)).toBe(true);
        if (SqlTestHarnessError.is(failure)) {
          expect(failure.driver).toBe("pg-external");
          expect(failure.phase).toBe("provision");
        }
      }
    })
  );
});
