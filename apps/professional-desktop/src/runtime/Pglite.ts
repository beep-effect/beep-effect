/**
 * In-process PGlite database provisioning for the desktop chat sidecar.
 *
 * cspell:words initdb
 *
 * Boots a file-backed {@link https://pglite.dev | PGlite} instance in-process via
 * `@beep/pglite`, then layers the repo's
 * {@link PostgresDrizzle} composition on top so every sidecar repository (the
 * Drizzle ThreadStore, the Drizzle usage-record sink) runs against the same
 * embedded database the integration tests prove. The sidecar's generated
 * migration bundle is applied in-memory on boot before the data directory is
 * marked compatible.
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

import * as NodeURL from "node:url";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { profilePhase } from "@beep/observability/PhaseProfiler";
import { makeLayer as makePgliteLayer } from "@beep/pglite";
import { makeDrizzleLayer } from "@beep/postgres";
import { OpaqueUnknown } from "@beep/schema/Opaque";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import btreeGistBundlePath from "../../../../node_modules/@electric-sql/pglite/dist/btree_gist.tar.gz" with {
  type: "file",
};
import initdbWasmPath from "../../../../node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };
import pgliteDataPath from "../../../../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import pgliteWasmPath from "../../../../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import { migrateOnBoot } from "./Migrations.ts";
import type { PgliteClientOptions } from "@beep/pglite";
import type { PostgresDrizzle } from "@beep/postgres";
import type * as Context from "effect/Context";
import type * as Crypto from "effect/Crypto";

const $I = $ProfessionalDesktopId.create("runtime/Pglite");

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
  Config.withDefault(NodeURL.fileURLToPath(new URL("../../../../.beep/professional-desktop/chat-db", import.meta.url)))
);

/**
 * Marker written into data directories already opened by the in-process
 * desktop PGlite runtime.
 *
 * **Details**
 *
 * The `v<N>` suffix is part of the on-disk compatibility contract for the
 * embedded `@beep/pglite` / `@electric-sql/pglite` line. Bump the marker
 * whenever that storage compatibility contract changes.
 *
 * **Example** (Checking marker prefix)
 *
 * ```ts
 * import { ChatDbCompatibilityMarker } from "@/runtime/Pglite"
 *
 * console.log(ChatDbCompatibilityMarker.startsWith(".beep-pglite")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ChatDbCompatibilityMarker = ".beep-pglite-inprocess-v2";

const PgliteDataDirRequiredEntries = ["PG_VERSION", "base", "global"] as const;

const ChatDbIncompatibleRecoveryMessage =
  "Existing CHAT_DB_PATH looks like a PGlite data directory but cannot be opened by the bundled in-process runtime. The directory was left in place; export it with the prior desktop build before importing into a fresh current data dir, or reset by moving the old chat-db directory aside and starting with an empty CHAT_DB_PATH.";

const ViteFileSystemPrefix = "/@fs/";

/**
 * Failure raised when the bundled PGlite runtime cannot open an existing data directory.
 *
 * **Example** (Create a compatibility failure)
 *
 * ```ts
 * import { IncompatiblePgliteDataDir } from "@/runtime/Pglite"
 *
 * const error = IncompatiblePgliteDataDir.make({
 *   cause: new Error("unsupported data format"),
 *   dataDir: "/data/chat-db",
 *   recovery: "Export with the prior desktop build."
 * })
 * console.log(error.dataDir)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IncompatiblePgliteDataDir extends S.TaggedError<IncompatiblePgliteDataDir>($I`IncompatiblePgliteDataDir`)(
  "IncompatiblePgliteDataDir",
  {
    cause: OpaqueUnknown.annotateKey({
      description: "Failure raised while probing the existing PGlite data directory.",
    }),
    dataDir: S.String.annotateKey({ description: "PGlite data directory that failed the compatibility probe." }),
    recovery: S.String.annotateKey({ description: "Operator guidance for safely recovering the incompatible data." }),
  },
  $I.annoteError<IncompatiblePgliteDataDir>("IncompatiblePgliteDataDir", {
    description: "An existing PGlite data directory cannot be opened by the bundled in-process runtime.",
  })
) {}

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
    ["runtime=professional-desktop-pglite-inprocess", "version=2", `createdAtMillis=${createdAtMillis}`, ""].join("\n")
  );
});

/**
 * Mark a data directory after the in-process PGlite runtime has opened it.
 *
 * **Example** (Marking data directory)
 *
 * ```ts
 * import { markCompatibleChatDbDataDir } from "@/runtime/Pglite"
 * import * as Effect from "effect/Effect";
 * const program = markCompatibleChatDbDataDir("/tmp/example-chat-db")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Creates the data directory and writes its compatibility marker.
 * @category resource-management
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
    yield* Layer.build(makeBundledPgliteLayer({ dataDir })).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          yield* sql`SELECT 1`;
        }).pipe(Effect.provide(context))
      ),
      Effect.scoped,
      Effect.catchCause((cause) =>
        logRedactedCause(
          cause,
          LogRedactedCauseOptions.make({
            message: "existing PGlite chat db data dir cannot be opened by the current in-process runtime",
            level: "Error",
            attributes: {
              component: "professional-desktop",
              recovery: "manual_export_or_reset_required",
              subsystem: "pglite",
            },
          })
        ).pipe(
          Effect.andThen(
            Effect.fail(
              IncompatiblePgliteDataDir.make({
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
 * **Details**
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
 * **Example** (Ensuring directory compatibility)
 *
 * ```ts
 * import { ensureCompatibleChatDbDataDir } from "@/runtime/Pglite"
 * import * as Effect from "effect/Effect";
 * const program = ensureCompatibleChatDbDataDir("/tmp/example-chat-db")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Inspects and may create or quarantine a PGlite data directory.
 * @category resource-management
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
    if (A.isArrayEmpty(entries)) {
      return true;
    }

    if (hasPgliteDataDirShape(entries)) {
      yield* assertCanOpenInProcessPgliteDataDir(dataDir);
      yield* Effect.logInfo("existing chat db data dir preserved for in-process PGlite compatibility").pipe(
        Effect.annotateLogs({
          component: "professional-desktop",
          data_dir_state: "preserved",
        })
      );
      return true;
    }

    const backupPath = `${dataDir}.pre-inprocess-${yield* Clock.currentTimeMillis}`;
    yield* fs.rename(dataDir, backupPath);
    yield* fs.makeDirectory(dataDir, { recursive: true });
    yield* Effect.logWarning("chat db data dir moved for in-process PGlite compatibility").pipe(
      Effect.annotateLogs({
        component: "professional-desktop",
        data_dir_state: "moved_to_backup",
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
  })),
  profilePhase({ phase: "professional_desktop.pglite.compile_binary_assets" })
);

const DataDirPlatformLive = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);

// The bundled migrations issue `CREATE EXTENSION btree_gist` (the epistemic
// bitemporal edge exclusion constraint), so the extension has to be registered
// on every PGlite instance this app opens — the compatibility probe as much as
// the live database. Caller-supplied extensions merge on top rather than
// replace.
//
// The bundle rides a `type: "file"` asset import rather than the
// `@electric-sql/pglite/contrib/btree_gist` export: that export resolves its
// tarball relative to its own module URL, which does not exist inside the
// compiled sidecar's single-file executable. PGlite's extension loader reads
// `file://` bundles through node:fs, which cannot open the executable's
// embedded `$bunfs` assets either, so the bytes are materialized once per boot
// into a private unpredictable temp directory and PGlite is handed that URL.
// Exclusive creation prevents another local process from pre-positioning or
// swapping the loadable extension path.
const materializeBtreeGistBundle = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = yield* Effect.promise(() => Bun.file(toBunFileSystemPath(btreeGistBundlePath)).arrayBuffer());
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-professional-desktop-btree-gist-" });
  const target = path.join(directory, "btree_gist.tar.gz");
  yield* fs.writeFile(target, new Uint8Array(bytes), { flag: "wx", mode: 0o600 });
  return NodeURL.pathToFileURL(target);
});

/**
 * Build a PGlite layer with the desktop sidecar's bundled binary assets and
 * bundled extensions.
 *
 * **Example** (Building bundled PGlite layer)
 *
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
export const makeBundledPgliteLayer = (options: PgliteClientOptions = {}) =>
  Layer.unwrap(
    Effect.map(
      Effect.all([PgliteBinaryAssets, materializeBtreeGistBundle], { concurrency: "unbounded" }),
      ([assets, btreeGistBundleUrl]) =>
        makePgliteLayer({
          ...options,
          ...assets,
          extensions: { btree_gist: btreeGistBundleUrl, ...options.extensions },
        })
    )
  );

/**
 * Live {@link PostgresDrizzle} layer over a file-backed in-process PGlite
 * database, with the sidecar migrations applied on boot. This is the shared
 * database every sidecar repository (the Drizzle ThreadStore, the Drizzle
 * usage-record sink) runs against.
 *
 * **Example** (Verifying Layer type)
 *
 * ```ts
 * import { PgliteDrizzleLive } from "@/runtime/Pglite"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(PgliteDrizzleLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PgliteDrizzleLive: Layer.Layer<PostgresDrizzle, never, Crypto.Crypto> = Layer.unwrap(
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
).pipe(Layer.provide(DataDirPlatformLive), Layer.orDie);
