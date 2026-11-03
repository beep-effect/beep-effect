import { it } from "@beep/test-runner";
import {
  BunSqliteTestDriver,
  makeSqlTestLayer,
  PgExternalTestDriver,
  PgliteTestcontainersTestDriver,
  SqlTestHarnessError,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { vi } from "vitest";

const transport = vi.hoisted(() => ({ rejectSqlite: false }));

// Exercise harness lifecycle logic with real local SQL clients at the transport seam.
vi.mock("@effect/platform-bun/BunFileSystem", () => import("@effect/platform-node/NodeFileSystem"));
vi.mock("@effect/platform-bun/BunPath", () => import("@effect/platform-node/NodePath"));
vi.mock("@effect/sql-sqlite-bun", () =>
  import("@effect/sql-sqlite-node/SqliteClient").then((SqliteClient) => ({
    SqliteClient: {
      layer: (config: Parameters<typeof SqliteClient.layer>[0]) =>
        transport.rejectSqlite
          ? Layer.effectContext(Effect.fail("fixture SQLite open failure"))
          : SqliteClient.layer(config),
    },
  }))
);
vi.mock("@effect/sql-pg", (importOriginal) =>
  importOriginal<typeof import("@effect/sql-pg")>().then((actual) =>
    import("@effect/sql-pglite/PgliteClient").then((local) => ({
      ...actual,
      PgClient: {
        ...actual.PgClient,
        make: () => local.make({}),
        makeClient: () => local.make({}),
      },
    }))
  )
);
vi.mock("pg", () => ({
  Client: class {
    connect = () => Promise.resolve();
    query = () => Promise.resolve({ rows: [] });
    end = () => Promise.resolve();
  },
}));
vi.mock("testcontainers", () => ({
  GenericContainer: class {
    static fromDockerfile = () => ({ build: () => Promise.resolve() });
    withEnvironment = () => this;
    withExposedPorts = () => this;
    withStartupTimeout = () => this;
    withWaitStrategy = () => this;
    start = () =>
      Promise.resolve({
        getHost: () => "127.0.0.1",
        getId: () => "transport-fixture",
        getMappedPort: () => 5432,
        stop: () => Promise.resolve(),
      });
  },
  Wait: { forListeningPorts: () => ({}) },
}));

describe("SqlTest transport lifecycle", () => {
  it.layer(makeSqlTestLayer({ driver: BunSqliteTestDriver, config: undefined }), { timeout: "60 seconds" })(
    "Bun transport",
    (it) => {
      it.effect("runs the Bun driver lifecycle through Node-compatible transports", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* sql`CREATE TABLE transport_probe (value INTEGER)`;
          yield* sql`INSERT INTO transport_probe VALUES (42)`;
          const value1 = yield* sql`SELECT value FROM transport_probe`;
          expect(value1).toEqual([{ value: 42 }]);
          const info = yield* TestDatabaseInfo;
          expect(info.driver).toBe("bun-sqlite");
          expect(O.getOrThrow(info.databasePath)).toMatch(/\/test\.db$/);
        })
      );
    }
  );

  it.layer(
    makeSqlTestLayer({
      driver: PgExternalTestDriver,
      config: { connectionUri: "postgres://fixture:fixture@localhost:5432/fixture" },
    }),
    { timeout: "60 seconds" }
  )("external schema isolation", (it) => {
    it.effect("provisions an external session with a generated schema and connection metadata", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const info = yield* TestDatabaseInfo;
        const schema = O.getOrThrow(info.schema);
        const value2 = yield* sql`SELECT current_schema() AS schema`;
        expect(value2).toEqual([{ schema }]);
        yield* sql`CREATE TABLE transport_probe (value INTEGER)`;
        expect(info.driver).toBe("pg-external");
        assertSome(info.database, "fixture");
        assertSome(info.host, "localhost");
        assertSome(info.port, 5432);
        assertSome(info.username, "fixture");
      })
    );
  });

  it.layer(
    makeSqlTestLayer({
      driver: PgExternalTestDriver,
      config: { connectionUri: "postgres:///", isolation: "none" },
    }),
    { timeout: "60 seconds" }
  )("external session without isolation", (it) => {
    it.effect("supports external sessions without schema isolation or optional URI metadata", () =>
      Effect.gen(function* () {
        const info = yield* TestDatabaseInfo;
        assertNone(info.schema);
        assertNone(info.database);
        assertNone(info.host);
        assertNone(info.port);
        assertNone(info.username);
      })
    );
  });

  it.layer(
    makeSqlTestLayer({
      driver: PgliteTestcontainersTestDriver,
      config: { password: "fixture" },
    }),
    { timeout: "60 seconds" }
  )("container transport", (it) => {
    it.effect("builds the container driver client and exposes its resource metadata", () =>
      Effect.gen(function* () {
        const info = yield* TestDatabaseInfo;
        expect(info.driver).toBe("pglite-testcontainers");
        assertSome(info.containerId, "transport-fixture");
        assertSome(info.port, 5432);
      })
    );
  });

  it.effect("maps SQLite open failure at the Bun transport boundary", () =>
    Effect.gen(function* () {
      transport.rejectSqlite = true;
      const error = yield* BunSqliteTestDriver.makeLayer(undefined).pipe(Layer.build, Effect.flip);
      transport.rejectSqlite = false;
      expect(SqlTestHarnessError.is(error)).toBe(true);
      if (SqlTestHarnessError.is(error)) expect(error.message).toBe("Failed to open the Bun SQLite test database.");
    })
  );
});
