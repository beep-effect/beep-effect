/**
 * In-process PGlite database provisioning for the desktop chat sidecar.
 *
 * cspell:words initdb
 *
 * Boots a file-backed {@link https://pglite.dev | PGlite} instance in-process via
 * the `@beep/pglite` driver (which wraps `@effect/sql-pglite` and aliases the
 * client under the `@effect/sql-pg` PgClient tag), then layers the repo's
 * {@link PostgresDrizzle} composition on top so every sidecar repository (the
 * Drizzle ThreadStore, the Drizzle usage-record sink) runs against the same
 * embedded database the integration tests prove. The sidecar's bundled Drizzle
 * migrations are applied on boot before the data directory is marked compatible.
 *
 * Operational note: `CHAT_DB_PATH` is owned by this sidecar build's bundled
 * PGlite runtime. Existing unmarked PGlite-looking directories are opened with
 * the in-process runtime before they are marked compatible. If that probe
 * fails, startup fails closed and leaves the directory untouched so an older
 * socket-bridge store is not silently reset.
 *
 * The PGlite instance is owned by the layer {@link Scope}: it is acquired and
 * released (`pglite.close()`) by `@beep/pglite` when the runtime scope closes, so
 * the sidecar leaves no open database handle behind. Provisioning failures are
 * unrecoverable at boot, so they are promoted to defects (`Layer.orDie`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="../assets.d.ts" />

import { fileURLToPath } from "node:url";
import * as Pglite from "@beep/pglite";
import { makeDrizzleLayer } from "@beep/postgres";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { Clock, Config, Data, Effect, FileSystem, Layer, Path } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import initdbWasmPath from "../../../../node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };
import pgliteDataPath from "../../../../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import pgliteWasmPath from "../../../../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import { migrateOnBoot } from "./Migrations.js";
import type { PostgresDrizzle } from "@beep/postgres";
import type { Context } from "effect";

// Bun resolves `type: "file"` imports while compiling the sidecar executable;
// Vite exposes the same files through `/@fs/` during integration tests.

/**
 * Directory PGlite persists into, resolved from the environment.
 *
 * `CHAT_DB_PATH` defaults to a repo-local `.beep/professional-desktop/chat-db`
 * so dev runs are durable without extra setup; the packaged Tauri app points it
 * at its data directory.
 *
 * @category configuration
 * @since 0.0.0
 */
const ChatDbDataDir = Config.string("CHAT_DB_PATH").pipe(
  Config.withDefault(fileURLToPath(new URL("../../../../.beep/professional-desktop/chat-db", import.meta.url)))
);

/**
 * Marker written into data directories already opened by the in-process
 * desktop PGlite runtime.
 *
 * The `v1` suffix is part of the on-disk compatibility contract for the
 * embedded `@effect/sql-pglite` / `@electric-sql/pglite` line. Bump the marker
 * whenever that storage compatibility contract changes.
 *
 * @example
 * ```ts
 * import { ChatDbCompatibilityMarker } from "@/runtime/Pglite"
 *
 * console.log(ChatDbCompatibilityMarker) // ".beep-pglite-inprocess-v1"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ChatDbCompatibilityMarker = ".beep-pglite-inprocess-v1";

const PgliteDataDirRequiredEntries = ["PG_VERSION", "base", "global"] as const;

const ChatDbIncompatibleRecoveryMessage =
  "Existing CHAT_DB_PATH looks like a PGlite data directory but cannot be opened by the bundled in-process runtime. The directory was left in place; export it with the prior desktop build before importing into a fresh current data dir, or reset by moving the old chat-db directory aside and starting with an empty CHAT_DB_PATH.";

const ViteFileSystemPrefix = "/@fs/";

class IncompatiblePgliteDataDir extends Data.TaggedError("IncompatiblePgliteDataDir")<{
  readonly cause: unknown;
  readonly dataDir: string;
  readonly recovery: string;
}> {}

const pathExists = (fs: FileSystem.FileSystem, target: string): Effect.Effect<boolean> =>
  fs.exists(target).pipe(Effect.orElseSucceed(() => false));

const hasPgliteDataDirShape = (entries: ReadonlyArray<string>): boolean =>
  PgliteDataDirRequiredEntries.every((entry) => entries.includes(entry));

const writeCompatibilityMarker = Effect.fn("ProfessionalDesktop.Pglite.writeCompatibilityMarker")(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dataDir: string
) {
  yield* fs.makeDirectory(dataDir, { recursive: true });
  const createdAtMillis = yield* Clock.currentTimeMillis;
  yield* fs.writeFileString(
    path.join(dataDir, ChatDbCompatibilityMarker),
    ["runtime=professional-desktop-pglite-inprocess", "version=1", `createdAtMillis=${createdAtMillis}`, ""].join("\n")
  );
});

/**
 * Mark a data directory after the in-process PGlite runtime has opened it.
 *
 * @example
 * ```ts
 * import { markCompatibleChatDbDataDir } from "@/runtime/Pglite"
 *
 * const program = markCompatibleChatDbDataDir("/tmp/example-chat-db")
 * console.log(program)
 * ```
 *
 * @category runtime
 * @since 0.0.0
 */
export const markCompatibleChatDbDataDir = Effect.fn("ProfessionalDesktop.Pglite.markCompatibleChatDbDataDir")(
  function* (dataDir: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* writeCompatibilityMarker(fs, path, dataDir);
  }
);

const assertCanOpenInProcessPgliteDataDir = Effect.fn("ProfessionalDesktop.Pglite.assertCanOpenInProcessPgliteDataDir")(
  function* (dataDir: string) {
    yield* Effect.scoped(
      Layer.build(makeBundledPgliteLayer({ dataDir })).pipe(
        Effect.flatMap((context) =>
          Effect.gen(function* () {
            const sql = (yield* SqlClient.SqlClient).withoutTransforms();
            yield* sql`SELECT 1`;
          }).pipe(Effect.provide(context))
        )
      )
    ).pipe(
      Effect.catchCause((cause) =>
        Effect.logError("existing PGlite chat db data dir cannot be opened by the current in-process runtime").pipe(
          Effect.annotateLogs({
            cause,
            component: "professional-desktop",
            dataDir,
            recovery: ChatDbIncompatibleRecoveryMessage,
          }),
          Effect.andThen(
            Effect.fail(
              new IncompatiblePgliteDataDir({
                cause,
                dataDir,
                recovery: ChatDbIncompatibleRecoveryMessage,
              })
            )
          )
        )
      )
    );
  }
);

/**
 * Ensure a desktop chat database directory is safe for the current in-process
 * PGlite runtime.
 *
 * Fresh directories are prepared. Already-marked and unmarked PGlite-looking
 * directories are first opened through the new driver; compatible stores are
 * retained, while stores that fail the probe are left untouched and fail boot
 * with a recovery log. Populated directories that do not look like PGlite are
 * moved aside with a timestamped backup before a fresh data dir is created. The
 * returned boolean tells the caller whether to write
 * {@link ChatDbCompatibilityMarker} after the real in-process PGlite layer opens
 * and its migrations apply successfully. Unreadable directories fail boot
 * instead of being quarantined.
 *
 * @example
 * ```ts
 * import { ensureCompatibleChatDbDataDir } from "@/runtime/Pglite"
 *
 * const program = ensureCompatibleChatDbDataDir("/tmp/example-chat-db")
 * console.log(program)
 * ```
 *
 * @category runtime
 * @since 0.0.0
 */
export const ensureCompatibleChatDbDataDir = Effect.fn("ProfessionalDesktop.Pglite.ensureCompatibleChatDbDataDir")(
  function* (dataDir: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const markerPath = path.join(dataDir, ChatDbCompatibilityMarker);
    const dataDirExists = yield* pathExists(fs, dataDir);
    const markerExists = dataDirExists ? yield* pathExists(fs, markerPath) : false;

    if (markerExists) {
      yield* assertCanOpenInProcessPgliteDataDir(dataDir);
      return false;
    }

    if (!dataDirExists) {
      yield* fs.makeDirectory(dataDir, { recursive: true });
      return true;
    }

    const entries = yield* fs.readDirectory(dataDir);
    if (entries.length === 0) {
      return true;
    }

    if (hasPgliteDataDirShape(entries)) {
      yield* assertCanOpenInProcessPgliteDataDir(dataDir);
      yield* Effect.logInfo("existing chat db data dir preserved for in-process PGlite compatibility").pipe(
        Effect.annotateLogs({
          component: "professional-desktop",
          dataDir,
        })
      );
      return true;
    }

    const backupPath = `${dataDir}.pre-inprocess-${yield* Clock.currentTimeMillis}`;
    yield* fs.rename(dataDir, backupPath);
    yield* fs.makeDirectory(dataDir, { recursive: true });
    yield* Effect.logWarning("chat db data dir moved for in-process PGlite compatibility").pipe(
      Effect.annotateLogs({
        backupPath,
        component: "professional-desktop",
        dataDir,
      })
    );
    return true;
  }
);

/**
 * Live in-process PGlite client layer (file-backed), exposed under the
 * `@effect/sql-pg` PgClient / generic SqlClient tags so the Drizzle composition
 * binds to it. Provisioning failures are promoted to defects (`Layer.orDie`).
 *
 * @category layers
 * @since 0.0.0
 */
const toBunFileSystemPath = (path: string): string =>
  path.startsWith(ViteFileSystemPrefix) ? `/${path.slice(ViteFileSystemPrefix.length)}` : path;

const compileWasmFile = (path: string): Effect.Effect<WebAssembly.Module> =>
  Effect.promise(() => Bun.file(toBunFileSystemPath(path)).arrayBuffer()).pipe(
    Effect.flatMap((bytes) => Effect.promise(() => WebAssembly.compile(bytes)))
  );

const PgliteBinaryAssets = Effect.all([compileWasmFile(pgliteWasmPath), compileWasmFile(initdbWasmPath)], {
  concurrency: "unbounded",
}).pipe(
  Effect.map(([pgliteWasmModule, initdbWasmModule]) => ({
    fsBundle: Bun.file(toBunFileSystemPath(pgliteDataPath)),
    initdbWasmModule,
    pgliteWasmModule,
  }))
);

/**
 * Build a PGlite layer with the desktop sidecar's bundled binary assets.
 *
 * @example
 * ```ts
 * import { makeBundledPgliteLayer } from "@/runtime/Pglite"
 *
 * const layer = makeBundledPgliteLayer({ dataDir: "/tmp/example-chat-db" })
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeBundledPgliteLayer = (options: Pglite.PgliteClientOptions = {}) =>
  Layer.unwrap(Effect.map(PgliteBinaryAssets, (assets) => Pglite.makeLayer({ ...options, ...assets })));

const MigrationPlatformLive = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);

/**
 * Live {@link PostgresDrizzle} layer over a file-backed in-process PGlite
 * database, with the sidecar migrations applied on boot. This is the shared
 * database every sidecar repository (the Drizzle ThreadStore, the Drizzle
 * usage-record sink) runs against.
 *
 * @example
 * ```ts
 * import { PgliteDrizzleLive } from "@/runtime/Pglite"
 *
 * console.log(PgliteDrizzleLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgliteDrizzleLive: Layer.Layer<PostgresDrizzle> = Layer.unwrap(
  Effect.gen(function* () {
    const dataDir = yield* ChatDbDataDir;
    const shouldMarkDataDir = yield* ensureCompatibleChatDbDataDir(dataDir);
    const markAfterMigration = shouldMarkDataDir ? markCompatibleChatDbDataDir(dataDir) : Effect.void;

    return makeDrizzleLayer().pipe(
      Layer.tap((context: Context.Context<PostgresDrizzle>) =>
        Effect.provide(migrateOnBoot, context).pipe(Effect.andThen(markAfterMigration))
      ),
      Layer.provide(makeBundledPgliteLayer({ dataDir }))
    );
  })
).pipe(Layer.provide(MigrationPlatformLive), Layer.orDie);
