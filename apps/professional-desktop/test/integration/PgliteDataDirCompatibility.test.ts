import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils";
import { PGlite as LegacyPglite046 } from "@electric-sql/pglite-legacy-046";
import { pipe } from "effect";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as SqlClient from "effect/sql/SqlClient";
import {
  ChatDbCompatibilityMarker,
  ensureCompatibleChatDbDataDir,
  makeBundledPgliteLayer,
  markCompatibleChatDbDataDir,
  PgliteDrizzleLive,
} from "@/runtime/Pglite";
import { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";

const TestServices = Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer, BunPath.layer);

const markerPath = (path: Path.Path, dataDir: string): string => path.join(dataDir, ChatDbCompatibilityMarker);

const withUnreadableDataDir = Effect.fn("ProfessionalDesktop.PgliteCompatibilityTest.withUnreadableDataDir")(function* <
  A,
  E,
  R,
>(dataDir: string, use: Effect.Effect<A, E, R>) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(
    fs.chmod(dataDir, 0),
    () => use,
    () => fs.chmod(dataDir, 0o700).pipe(Effect.ignore)
  );
});

const createPgliteFixture = Effect.fn("ProfessionalDesktop.PgliteCompatibilityTest.createPgliteFixture")(function* (
  dataDir: string
) {
  yield* Effect.gen(function* () {
    const context = yield* Layer.build(makeBundledPgliteLayer({ dataDir, relaxedDurability: true }));
    const sql = Context.get(context, SqlClient.SqlClient).withoutTransforms();
    yield* sql`
        CREATE TABLE preserved_notes (
          id SERIAL PRIMARY KEY,
          body TEXT NOT NULL
        )
      `;
    yield* sql`
        INSERT INTO preserved_notes (body)
        VALUES ('keep me')
      `;
  }).pipe(Effect.scoped);
});

const createLegacyPglite046Fixture = Effect.fn(
  "ProfessionalDesktop.PgliteCompatibilityTest.createLegacyPglite046Fixture"
)(function* (dataDir: string) {
  yield* Effect.acquireUseRelease(
    Effect.sync(() => new LegacyPglite046(dataDir)),
    (pglite) =>
      Effect.promise(() => pglite.waitReady).pipe(
        Effect.andThen(
          Effect.all(
            [
              Effect.promise(() =>
                pglite.query(`
        CREATE TABLE legacy_notes (
          id SERIAL PRIMARY KEY,
          body TEXT NOT NULL
        )
      `)
              ),
              Effect.promise(() => pglite.query("INSERT INTO legacy_notes (body) VALUES ('keep me')")),
            ],
            { discard: true }
          )
        )
      ),
    (pglite) => Effect.promise(() => pglite.close()).pipe(Effect.ignore)
  );
});

const readPgliteFixture = Effect.fn("ProfessionalDesktop.PgliteCompatibilityTest.readPgliteFixture")(function* (
  dataDir: string
) {
  return yield* Effect.gen(function* () {
    const context = yield* Layer.build(makeBundledPgliteLayer({ dataDir, relaxedDurability: true }));
    const sql = Context.get(context, SqlClient.SqlClient).withoutTransforms();
    const rows = yield* sql<{ readonly body: string }>`
        SELECT body
        FROM preserved_notes
        ORDER BY id ASC
      `;

    return rows.map((row) => row.body);
  }).pipe(Effect.scoped);
});

const backupNames = Effect.fn("ProfessionalDesktop.PgliteCompatibilityTest.backupNames")(function* (
  rootDir: string,
  dataDirName: string
) {
  const fs = yield* FileSystem.FileSystem;
  return (yield* fs.readDirectory(rootDir)).filter((entry) => entry.startsWith(`${dataDirName}.pre-inprocess-`));
});

it.layer(TestServices, { timeout: vitestCoverageRunActive || fcDeepSweepActive ? "5 minutes" : "10 seconds" })(
  "Pglite data-dir compatibility gate",
  (it) => {
    describe("makeBundledPgliteLayer", () => {
      it.effect(
        "removes the materialized extension bundle when its layer scope closes",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-extension-cleanup-" });
          const dataDir = path.join(rootDir, "chat-db");
          const extensionTempRoot = path.join(rootDir, "extension-temp");
          yield* fs.makeDirectory(extensionTempRoot);
          const isolatedFileSystem = FileSystem.FileSystem.of({
            ...fs,
            makeTempDirectory: Effect.fn("ProfessionalDesktop.PgliteCompatibilityTest.makeTempDirectory")((options) =>
              fs.makeTempDirectory({ ...options, directory: extensionTempRoot })
            ),
            makeTempDirectoryScoped: Effect.fn("ProfessionalDesktop.PgliteCompatibilityTest.makeTempDirectoryScoped")(
              (options) => fs.makeTempDirectoryScoped({ ...options, directory: extensionTempRoot })
            ),
          });

          yield* makeBundledPgliteLayer({ dataDir, relaxedDurability: true }).pipe(
            Layer.build,
            Effect.asVoid,
            Effect.scoped,
            Effect.provideService(FileSystem.FileSystem, isolatedFileSystem)
          );

          expect(yield* fs.readDirectory(extensionTempRoot)).toEqual([]);
        }),
        { timeout: 90_000 }
      );
    });

    describe("ensureCompatibleChatDbDataDir", () => {
      it.effect(
        "prepares a fresh data dir and defers the marker until successful open",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-fresh-" });
          const dataDir = path.join(rootDir, "chat-db");

          const shouldMarkDataDir = yield* ensureCompatibleChatDbDataDir(dataDir);

          expect(shouldMarkDataDir).toBe(true);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(false);
          yield* markCompatibleChatDbDataDir(dataDir);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(true);
          expect(yield* backupNames(rootDir, "chat-db")).toEqual([]);
        })
      );

      it.effect(
        "leaves an already marked data dir in place",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-marked-" });
          const dataDir = path.join(rootDir, "chat-db");
          const retainedPath = path.join(dataDir, "retained.txt");

          yield* fs.makeDirectory(dataDir, { recursive: true });
          yield* fs.writeFileString(markerPath(path, dataDir), "runtime=professional-desktop-pglite-inprocess\n");
          yield* fs.writeFileString(retainedPath, "still here");

          const shouldMarkDataDir = yield* ensureCompatibleChatDbDataDir(dataDir);

          expect(shouldMarkDataDir).toBe(false);
          expect(yield* fs.readFileString(retainedPath)).toBe("still here");
          expect(yield* backupNames(rootDir, "chat-db")).toEqual([]);
        }),
        { timeout: 90_000 }
      );

      it.effect(
        "fails closed when an already marked data dir cannot be opened",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-marked-incompatible-" });
          const dataDir = path.join(rootDir, "chat-db");

          yield* createLegacyPglite046Fixture(dataDir);
          yield* fs.writeFileString(markerPath(path, dataDir), "runtime=professional-desktop-pglite-inprocess\n");
          const result = yield* ensureCompatibleChatDbDataDir(dataDir).pipe(Effect.exit);

          pipe(result, Exit.isFailure, assertTrue);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(true);
          expect(yield* fs.exists(path.join(dataDir, "PG_VERSION"))).toBe(true);
          expect(yield* backupNames(rootDir, "chat-db")).toEqual([]);
        }),
        { timeout: 90_000 }
      );

      it.effect(
        "preserves an unmarked data dir that opens with the in-process driver",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-compatible-" });
          const dataDir = path.join(rootDir, "chat-db");

          yield* createPgliteFixture(dataDir);
          const shouldMarkDataDir = yield* ensureCompatibleChatDbDataDir(dataDir);

          expect(shouldMarkDataDir).toBe(true);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(false);
          yield* markCompatibleChatDbDataDir(dataDir);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(true);
          expect(yield* readPgliteFixture(dataDir)).toEqual(["keep me"]);
          expect(yield* backupNames(rootDir, "chat-db")).toEqual([]);
        }),
        { timeout: 90_000 }
      );

      it.effect(
        "fails closed instead of moving aside a prior PGlite 0.4 data dir",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-pglite-046-" });
          const dataDir = path.join(rootDir, "chat-db");

          yield* createLegacyPglite046Fixture(dataDir);
          const result = yield* ensureCompatibleChatDbDataDir(dataDir).pipe(Effect.exit);

          pipe(result, Exit.isFailure, assertTrue);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(false);
          expect(yield* fs.exists(path.join(dataDir, "PG_VERSION"))).toBe(true);
          expect(yield* backupNames(rootDir, "chat-db")).toEqual([]);
        }),
        { timeout: 90_000 }
      );

      it.effect(
        "moves a populated non-PGlite data dir aside without a premature marker",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-legacy-" });
          const dataDir = path.join(rootDir, "chat-db");

          yield* fs.makeDirectory(dataDir, { recursive: true });
          yield* fs.writeFileString(path.join(dataDir, "legacy.txt"), "legacy contents");

          const shouldMarkDataDir = yield* ensureCompatibleChatDbDataDir(dataDir);

          const backups = yield* backupNames(rootDir, "chat-db");
          expect(shouldMarkDataDir).toBe(true);
          expect(backups).toHaveLength(1);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(false);
          expect(yield* fs.readFileString(path.join(rootDir, backups[0]!, "legacy.txt"))).toBe("legacy contents");
          yield* markCompatibleChatDbDataDir(dataDir);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(true);
        })
      );

      it.effect(
        "restores a populated unreadable directory before interrupted scope cleanup",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const entered = yield* Deferred.make<string>();
          const modeBeforeCleanup = yield* Deferred.make<number>();
          const child = yield* Effect.gen(function* () {
            const rootDir = yield* Effect.acquireRelease(
              fs.makeTempDirectory({ prefix: "beep-chat-db-unreadable-interrupt-" }),
              (root) =>
                Effect.gen(function* () {
                  const dataDir = path.join(root, "chat-db");
                  const mode = (yield* fs.stat(dataDir)).mode & 0o777;
                  yield* Deferred.succeed(modeBeforeCleanup, mode);
                  // Observe the permission bracket first, then guarantee cleanup even
                  // when a mutation removes its restoration finalizer.
                  yield* fs.chmod(dataDir, 0o700);
                  yield* fs.remove(root, { recursive: true });
                }).pipe(Effect.orDie)
            );
            const dataDir = path.join(rootDir, "chat-db");
            yield* fs.makeDirectory(dataDir);
            yield* fs.writeFileString(path.join(dataDir, "legacy.txt"), "legacy contents");
            return yield* withUnreadableDataDir(
              dataDir,
              Deferred.succeed(entered, rootDir).pipe(Effect.andThen(Effect.never))
            );
          }).pipe(Effect.scoped, Effect.forkChild);

          const rootDir = yield* Deferred.await(entered);
          strictEqual((yield* fs.stat(path.join(rootDir, "chat-db"))).mode & 0o777, 0);
          assertTrue(yield* fs.exists(rootDir));
          yield* Fiber.interrupt(child);
          strictEqual(yield* Deferred.await(modeBeforeCleanup), 0o700);
          assertFalse(yield* fs.exists(rootDir));
        })
      );

      it.effect(
        "fails instead of moving an unreadable data dir",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-unreadable-" });
          const dataDir = path.join(rootDir, "chat-db");

          yield* fs.makeDirectory(dataDir, { recursive: true });
          yield* fs.writeFileString(path.join(dataDir, "legacy.txt"), "legacy contents");
          const result = yield* withUnreadableDataDir(
            dataDir,
            ensureCompatibleChatDbDataDir(dataDir).pipe(Effect.exit)
          );

          pipe(result, Exit.isFailure, assertTrue);
          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(false);
          expect(yield* backupNames(rootDir, "chat-db")).toEqual([]);
        })
      );
    });

    describe("PgliteDrizzleLive", () => {
      it.effect(
        "writes the compatibility marker after the production boot layer migrates",
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-chat-db-production-layer-" });
          const dataDir = path.join(rootDir, "chat-db");

          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(false);

          yield* PgliteDrizzleLive.pipe(
            Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CHAT_DB_PATH: dataDir }))),
            Layer.build,
            Effect.asVoid,
            Effect.scoped
          );

          expect(yield* fs.exists(markerPath(path, dataDir))).toBe(true);
          yield* Effect.gen(function* () {
            const context = yield* Layer.build(makeBundledPgliteLayer({ dataDir, relaxedDurability: true }));
            const sql = Context.get(context, SqlClient.SqlClient).withoutTransforms();
            yield* sql`SELECT id FROM workspace_thread LIMIT 0`;
          }).pipe(Effect.scoped);
        }),
        { timeout: 90_000 }
      );
    });
  }
);
