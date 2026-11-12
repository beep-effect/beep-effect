import { it } from "@beep/test-runner";
import { describe, expect, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import type { SqlTestHarnessError } from "@beep/test-utils/SqlTest";

const unavailable = () => {
  throw new Error("fixture module unavailable");
};

const expectLoaderFailure = (error: unknown, message: string) => {
  expect(error).toMatchObject({ _tag: "SqlTestHarnessError", phase: "provision", message });
};

describe("SqlTest dependency failures", () => {
  it.effect("maps unavailable optional modules to provisioning errors", () =>
    Effect.gen(function* () {
      const modules = [
        { dependency: "testcontainers", message: "Failed to load Testcontainers support for PGLite SQL tests." },
        { dependency: "pg", message: "Failed to load pg support for SQL tests." },
        { dependency: "@effect/sql-pg", message: "Failed to load PostgreSQL client support for SQL tests." },
        {
          dependency: "@effect/sql-pglite/PgliteClient",
          message: "Failed to load @effect/sql-pglite in-process driver support for SQL tests.",
        },
        {
          dependency: "@effect/sql-sqlite-node/SqliteClient",
          message: "Failed to load @effect/sql-sqlite-node driver support for SQL tests.",
        },
        {
          dependency: "@effect/platform-bun/BunFileSystem",
          message: "Failed to load Bun filesystem support for SQL tests.",
        },
        { dependency: "@effect/platform-bun/BunPath", message: "Failed to load Bun path support for SQL tests." },
        { dependency: "@effect/sql-sqlite-bun", message: "Failed to load Bun SQLite support for SQL tests." },
      ];
      for (const { dependency, message } of modules) {
        vi.resetModules();
        vi.doMock("@effect/platform-bun/BunFileSystem", () => import("@effect/platform-node/NodeFileSystem"));
        vi.doMock("@effect/platform-bun/BunPath", () => import("@effect/platform-node/NodePath"));
        if (dependency === "pg") {
          vi.doMock("testcontainers", () => ({
            GenericContainer: class {
              static fromDockerfile = () => ({ build: () => Promise.resolve() });
              withEnvironment = () => this;
              withExposedPorts = () => this;
              withStartupTimeout = () => this;
              withWaitStrategy = () => this;
              start = () =>
                Promise.resolve({
                  getHost: () => "localhost",
                  getMappedPort: () => 5432,
                  stop: () => Promise.resolve(),
                });
            },
            Wait: { forListeningPorts: () => ({}) },
          }));
        }
        vi.doMock(dependency, unavailable);
        const harness = yield* Effect.promise(() => import("@beep/test-utils/SqlTest"));
        const containerResource = () =>
          harness.makePgliteTestcontainerResource({ password: "fixture" }).pipe(Effect.asVoid);
        const effect = Match.value(dependency).pipe(
          Match.when("testcontainers", containerResource),
          Match.when("pg", containerResource),
          Match.when("@effect/sql-pg", () =>
            harness.PgExternalTestDriver.makeLayer({ connectionUri: "postgres://localhost/fixture" }).pipe(
              Layer.build,
              Effect.asVoid
            )
          ),
          Match.when("@effect/sql-pglite/PgliteClient", () =>
            harness.PgliteInProcessTestDriver.makeLayer(undefined).pipe(Layer.build, Effect.asVoid)
          ),
          Match.when("@effect/sql-sqlite-node/SqliteClient", () =>
            harness.NodeSqliteTestDriver.makeLayer(undefined).pipe(Layer.build, Effect.asVoid)
          ),
          Match.orElse(() => harness.BunSqliteTestDriver.makeLayer(undefined).pipe(Layer.build, Effect.asVoid))
        );
        const error = yield* effect.pipe(Effect.flip);
        expect(harness.SqlTestHarnessError.is(error)).toBe(true);
        expectLoaderFailure(error, message);
        vi.doUnmock(dependency);
        vi.doUnmock("testcontainers");
        vi.doUnmock("@effect/platform-bun/BunFileSystem");
        vi.doUnmock("@effect/platform-bun/BunPath");
      }
    })
  );
  it.effect("rejects a later provisioning error when the driver loader mock is absent", () =>
    Effect.gen(function* () {
      vi.resetModules();
      vi.doUnmock("@effect/sql-sqlite-node/SqliteClient");
      vi.doMock("@effect/platform-node/NodeFileSystem", () => ({
        layer: Layer.effectContext(Effect.fail("fixture platform failure")),
      }));
      const harness = yield* Effect.promise(() => import("@beep/test-utils/SqlTest"));
      const error = yield* harness.NodeSqliteTestDriver.makeLayer(undefined).pipe(Layer.build, Effect.flip);
      expect(harness.SqlTestHarnessError.is(error)).toBe(true);
      expect(error).toMatchObject({ phase: "provision", message: "Failed to provision the Node SQLite test driver." });
      expect(() =>
        expectLoaderFailure(error, "Failed to load @effect/sql-sqlite-node driver support for SQL tests.")
      ).toThrow();
      vi.doUnmock("@effect/platform-node/NodeFileSystem");
    })
  );
  it.effect("wraps raw platform-layer failures for each filesystem-backed driver", () =>
    Effect.gen(function* () {
      vi.resetModules();
      vi.doMock("@effect/platform-node/NodeFileSystem", () => ({
        layer: Layer.effectContext(Effect.fail("fixture platform failure")),
      }));
      vi.doMock("@effect/platform-bun/BunFileSystem", () => ({
        layer: Layer.effectContext(Effect.fail("fixture platform failure")),
      }));
      vi.doMock("@effect/platform-bun/BunPath", () => import("@effect/platform-node/NodePath"));
      vi.doMock("@effect/sql-sqlite-bun", () =>
        import("@effect/sql-sqlite-node/SqliteClient").then((SqliteClient) => ({ SqliteClient }))
      );
      const harness = yield* Effect.promise(() => import("@beep/test-utils/SqlTest"));
      const drivers = [harness.NodeSqliteTestDriver, harness.BunSqliteTestDriver, harness.PgliteInProcessTestDriver];
      for (const driver of drivers) {
        // Driver layers provide different client services; only the failure matters here.
        const layer: Layer.Layer<never, SqlTestHarnessError> = driver.makeLayer(undefined);
        const error = yield* layer.pipe(Layer.build, Effect.flip);
        expect(harness.SqlTestHarnessError.is(error)).toBe(true);
        if (harness.SqlTestHarnessError.is(error)) {
          expect(error.driver).toBe(driver.name);
          expect(error.phase).toBe("provision");
        }
      }
      vi.doUnmock("@effect/platform-node/NodeFileSystem");
      vi.doUnmock("@effect/platform-bun/BunFileSystem");
      vi.doUnmock("@effect/platform-bun/BunPath");
      vi.doUnmock("@effect/sql-sqlite-bun");
    })
  );

  it.effect("maps container image-build failures before starting a container", () =>
    Effect.gen(function* () {
      vi.resetModules();
      vi.doMock("testcontainers", () => ({
        GenericContainer: class {
          static fromDockerfile = () => ({ build: () => Promise.reject("fixture image build failure") });
        },
      }));
      const harness = yield* Effect.promise(() => import("@beep/test-utils/SqlTest"));
      const error = yield* harness.makePgliteTestcontainerResource({ password: "fixture" }).pipe(Effect.flip);
      expect(harness.SqlTestHarnessError.is(error)).toBe(true);
      if (harness.SqlTestHarnessError.is(error)) {
        expect(error.message).toBe("Failed to build the PGLite Testcontainers image.");
      }
      vi.doUnmock("testcontainers");
    })
  );
});
