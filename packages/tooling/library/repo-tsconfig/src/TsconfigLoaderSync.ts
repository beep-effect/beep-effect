/**
 * The synchronous escape hatch over the async loader pipeline: consumers in
 * sync-only host APIs (bundler plugin hooks, config factories) supply their
 * OWN file and path operations, this module adapts them into the core
 * `FileSystem`/`Path` services, and the UNCHANGED `TsconfigLoader` pipeline
 * runs under `Effect.runSyncExit` — zero logic duplication, no `node:*`
 * import, no posix assumption. Windows correctness comes from the consumer
 * passing a win32-appropriate `path` implementation (`node:path` on Windows,
 * or `node:path/win32` explicitly).
 *
 * **Details**
 *
 * Failure contract: exactly the async pipeline's typed errors, thrown —
 * `TsconfigParseError`, `TsconfigExtendsError`, or a `PlatformError` wrapping
 * what the consumer's `readFile` threw. Defects rethrow as-is; a caller never
 * sees a fiber-failure wrapper. The services are built per call from the
 * consumer's functions (plain service values via `Effect.provideService`, not
 * layers, so there is no memoization to poison across calls with different
 * options).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoTsconfigId } from "@beep/identity/packages";
import * as ByteSize from "effect/ByteSize";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { dual, identity } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { TsconfigLoader } from "./TsconfigLoader.ts";
import type { CompilerOptions } from "@beep/tsconfig/CompilerOptions";
import type { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
import type { TsconfigJson } from "@beep/tsconfig/TsconfigJson";

const $I = $RepoTsconfigId.create("TsconfigLoaderSync");

class UnsupportedPathOperationError extends S.TaggedError<
  UnsupportedPathOperationError,
  { readonly brand: unique symbol }
>($I`UnsupportedPathOperationError`)(
  "UnsupportedPathOperationError",
  { message: S.String },
  $I.annoteError<UnsupportedPathOperationError>("UnsupportedPathOperationError", {
    description: "A path operation outside the synchronous loader adapter's supported operations was invoked.",
  })
) {}

/**
 * The synchronous file operations {@link TsconfigLoaderSync} needs, supplied by the consumer.
 *
 * **Details**
 *
 * Node's built-ins satisfy it directly. `readFile` returns the file's text and
 * may throw on failure (a missing file, a permission error); the throw is wrapped
 * in a `PlatformError` and rethrown through the loader's typed channel. Pass
 * `realPath` (Node: `realpathSync`) to get tsc's symlink resolution for package
 * `extends` targets; without it a package target is used as found. Supply
 * `isFile` to skip directories during target resolution; it defaults to `exists`.
 *
 * **Example** (Adapt Node file operations)
 *
 * ```ts
 * import type { SyncFileSystem } from "@beep/repo-tsconfig/TsconfigLoaderSync";
 * import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
 *
 * const fileSystem: SyncFileSystem = {
 *   exists: existsSync,
 *   readFile: (p) => readFileSync(p, "utf8"),
 *   realPath: realpathSync,
 *   isFile: (p) => {
 *       try { return statSync(p).isFile(); } catch { return false; }
 *     },
 * };
 * console.log(typeof fileSystem.readFile) // function
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SyncFileSystem {
  /**
   * Whether an entry exists at `path` (files and directories).
   *
   * @since 0.0.0
   */
  readonly exists: (path: string) => boolean;
  /**
   * Whether `path` is a file, following symlinks; return false for missing paths and directories.
   * Optional; defaults to `exists` for compatibility with existing adapters. Supply this capability
   * for tsc's directory fallthrough. May throw; the throw surfaces as a `PlatformError`.
   *
   * @since 0.0.0
   */
  readonly isFile?: ((path: string) => boolean) | undefined;
  /**
   * Read the file at `path` as text. May throw; the throw surfaces as a `PlatformError`.
   *
   * @since 0.0.0
   */
  readonly readFile: (path: string) => string;
  /**
   * Resolve `path` to its real location (Node: `realpathSync`). Optional; when it is absent the
   * loader keeps package-resolved `extends` targets as found, so a target reached through a
   * `node_modules` symlink resolves its own relative `extends` from the link's directory. May
   * throw; the throw surfaces as a `PlatformError`.
   *
   * @since 0.0.0
   */
  readonly realPath?: ((path: string) => string) | undefined;
}

/**
 * The synchronous path operations {@link TsconfigLoaderSync} needs, supplied by the consumer.
 *
 * **Details**
 *
 * Deliberately a structural subset of `node:path`, so the built-in module
 * (and its `win32` / `posix` variants, or a Bun / Deno equivalent) satisfies
 * it verbatim. The loader passes these through untouched — Windows correctness
 * comes from supplying a win32-appropriate implementation, not from anything here.
 *
 * **Example** (Supply Node path operations)
 *
 * ```ts
 * import type { TsconfigLoaderSyncOptions } from "@beep/repo-tsconfig/TsconfigLoaderSync";
 * import { existsSync, readFileSync } from "node:fs";
 * import * as path from "node:path";
 *
 * const options: TsconfigLoaderSyncOptions = {
 *   fileSystem: { exists: existsSync, readFile: (p) => readFileSync(p, "utf8") },
 *   path, // node:path IS a SyncPath
 * };
 * console.log(options.path.basename("tsconfig.json")) // tsconfig.json
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SyncPath {
  /**
   * The final segment of `p` (like `path.basename`).
   *
   * @since 0.0.0
   */
  readonly basename: (p: string) => string;
  /**
   * The directory portion of `p` (like `path.dirname`).
   *
   * @since 0.0.0
   */
  readonly dirname: (p: string) => string;
  /**
   * Whether `p` is absolute under this implementation's convention.
   *
   * @since 0.0.0
   */
  readonly isAbsolute: (p: string) => boolean;
  /**
   * Join segments with the implementation's separator (like `path.join`).
   *
   * @since 0.0.0
   */
  readonly join: (...segments: ReadonlyArray<string>) => string;
  /**
   * Resolve segments to an absolute path (rightmost-wins, like `path.resolve`).
   *
   * @since 0.0.0
   */
  readonly resolve: (...segments: ReadonlyArray<string>) => string;
}

/**
 * The consumer-supplied operations backing one {@link TsconfigLoaderSync}
 * call: the file operations and the path implementation.
 *
 * **Details**
 *
 * Both are required —
 * this package never imports `node:*` and never assumes posix, so the
 * platform binding is entirely the caller's.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface TsconfigLoaderSyncOptions {
  /**
   * The synchronous file operations (Node: `existsSync` / `readFileSync`).
   *
   * @since 0.0.0
   */
  readonly fileSystem: SyncFileSystem;
  /**
   * The synchronous path implementation (Node: the `node:path` module itself).
   *
   * @since 0.0.0
   */
  readonly path: SyncPath;
}

const unsupported = (member: string): never => {
  throw UnsupportedPathOperationError.make({
    message: `Path.${member} is not supported by TsconfigLoaderSync — its SyncPath adapter only carries resolve/dirname/join/isAbsolute/basename`,
  });
};

const makePathService = (path: SyncPath): Path.Path =>
  Path.Path.of({
    [Path.TypeId]: Path.TypeId,
    get sep(): string {
      return unsupported("sep");
    },
    basename: (p: string) => path.basename(p),
    dirname: (p: string) => path.dirname(p),
    extname: () => unsupported("extname"),
    format: () => unsupported("format"),
    fromFileUrl: () => unsupported("fromFileUrl"),
    isAbsolute: (p: string) => path.isAbsolute(p),
    join: (...segments: ReadonlyArray<string>) => path.join(...segments),
    normalize: () => unsupported("normalize"),
    parse: () => unsupported("parse"),
    relative: () => unsupported("relative"),
    resolveWithin: () => unsupported("resolveWithin"),
    resolve: (...segments: ReadonlyArray<string>) => path.resolve(...segments),
    toFileUrl: () => unsupported("toFileUrl"),
    toNamespacedPath: () => unsupported("toNamespacedPath"),
  });

const trySync = <A>(
  method: string,
  path: string,
  operation: (path: string) => A
): Effect.Effect<A, PlatformError.PlatformError> =>
  Effect.try({
    try: () => operation(path),
    catch: (cause) =>
      PlatformError.systemError({ _tag: "Unknown", module: "FileSystem", method, pathOrDescriptor: path, cause }),
  });

const makeFileSystemService = (fileSystem: SyncFileSystem): FileSystem.FileSystem => {
  const realPath = O.getOrElse(O.fromUndefinedOr(fileSystem.realPath), () => identity<string>);
  const isFile = O.getOrElse(O.fromUndefinedOr(fileSystem.isFile), () => fileSystem.exists);
  return FileSystem.makeNoop({
    stat: (path) =>
      Effect.map(
        trySync("stat", path, isFile),
        (file): FileSystem.File.Info => ({
          type: file ? "File" : "Unknown",
          mtime: O.none(),
          atime: O.none(),
          birthtime: O.none(),
          dev: BigInt(0),
          ino: O.none(),
          mode: 0,
          nlink: O.none(),
          uid: O.none(),
          gid: O.none(),
          rdev: O.none(),
          size: ByteSize.bytes(0),
          blksize: O.none(),
          blocks: O.none(),
        })
      ),
    exists: (path) => Effect.sync(() => fileSystem.exists(path)),
    readFileString: (path) => trySync("readFileString", path, fileSystem.readFile),
    realPath: (path) => trySync("realPath", path, realPath),
  });
};

const runWith: {
  <A, E>(options: TsconfigLoaderSyncOptions, effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>): A;
  <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>): (options: TsconfigLoaderSyncOptions) => A;
} = dual(
  2,
  <A, E>(options: TsconfigLoaderSyncOptions, effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>): A => {
    const exit = Effect.runSyncExit(
      effect.pipe(
        Effect.provideService(FileSystem.FileSystem, makeFileSystemService(options.fileSystem)),
        Effect.provideService(Path.Path, makePathService(options.path))
      )
    );
    if (Exit.isSuccess(exit)) return exit.value;
    const failure = Cause.findErrorOption(exit.cause);
    if (O.isSome(failure)) throw failure.value;
    const defect = Cause.findDefect(exit.cause);
    if (Result.isSuccess(defect)) throw defect.success;
    throw Cause.squash(exit.cause);
  }
);

const load: {
  (configPath: string, options: TsconfigLoaderSyncOptions): TsconfigJson.Type;
  (options: TsconfigLoaderSyncOptions): (configPath: string) => TsconfigJson.Type;
} = dual(
  2,
  (configPath: string, options: TsconfigLoaderSyncOptions): TsconfigJson.Type =>
    runWith(options, TsconfigLoader.load(configPath))
);

const resolve: {
  (configPath: string, options: TsconfigLoaderSyncOptions): ResolvedTsconfig;
  (options: TsconfigLoaderSyncOptions): (configPath: string) => ResolvedTsconfig;
} = dual(
  2,
  (configPath: string, options: TsconfigLoaderSyncOptions): ResolvedTsconfig =>
    runWith(options, TsconfigLoader.resolve(configPath))
);

const compilerOptions: {
  (configPath: string, options: TsconfigLoaderSyncOptions): CompilerOptions.Type;
  (options: TsconfigLoaderSyncOptions): (configPath: string) => CompilerOptions.Type;
} = dual(
  2,
  (configPath: string, options: TsconfigLoaderSyncOptions): CompilerOptions.Type =>
    resolve(configPath, options).compilerOptions
);

/**
 * The synchronous tsconfig.json loader facade: the {@link TsconfigLoader}
 * pipeline run under `Effect.runSyncExit` against consumer-supplied
 * {@link SyncFileSystem} and {@link SyncPath} operations. For sync-only host
 * APIs (bundler plugin hooks, config factories); everything else should use
 * {@link TsconfigLoader} with real platform layers.
 *
 * **Gotchas**
 *
 * The two adapters treat unsupported members asymmetrically: a `Path` member
 * the loader pipeline never calls throws a named defect on contact, while a
 * `FileSystem` member outside the four overridden here (`exists`,
 * `readFileString`, `realPath`, `stat`) inherits `FileSystem.makeNoop`'s typed `NotFound`
 * failure. A loader change that starts using a new filesystem operation
 * therefore surfaces as a `NotFound` rather than a defect — extend the
 * adapter when that happens.
 *
 * **Example** (Resolve with Node platform operations)
 *
 * ```ts
 * import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
 * import * as path from "node:path";
 * import { TsconfigLoaderSync } from "@beep/repo-tsconfig/TsconfigLoaderSync";
 *
 * // `realPath` follows package symlinks; `isFile` skips directory targets.
 * const resolved = TsconfigLoaderSync.resolve("./tsconfig.json", {
 * 	fileSystem: { exists: existsSync, readFile: (p) => readFileSync(p, "utf8"), realPath: realpathSync,
 *     isFile: (p) => {
 *       try { return statSync(p).isFile(); } catch { return false; }
 *     } },
 * 	path,
 * });
 * console.log(typeof resolved.compilerOptions) // object
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class TsconfigLoaderSync {
  private constructor() {}

  /**
   * {@link TsconfigLoader.load}, synchronously: read and decode one config
   * file through the consumer-supplied operations. Throws
   * `TsconfigParseError` or a `PlatformError` — the async pipeline's exact
   * typed failures.
   *
   * **Example** (Read a config from supplied text)
   *
   * ```ts
   * import { TsconfigLoaderSync } from "@beep/repo-tsconfig/TsconfigLoaderSync";
   * import * as path from "node:path/posix";
   *
   * const config = TsconfigLoaderSync.load("/project/tsconfig.json", {
   *   fileSystem: {
   *     exists: (p) => p === "/project/tsconfig.json",
   *     readFile: () => '{"compilerOptions":{"target":"ES2022"}}',
   *   },
   *   path,
   * });
   * console.log(config.compilerOptions?.target) // es2022
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly load = load;

  /**
   * {@link TsconfigLoader.resolve}, synchronously: the full load -\>
   * extends -\> merge -\> `${configDir}` pipeline through the
   * consumer-supplied operations. Throws `TsconfigParseError`,
   * `TsconfigExtendsError` or a `PlatformError` — the async pipeline's exact
   * typed failures.
   *
   * **Example** (Resolve a config from supplied text)
   *
   * ```ts
   * import { TsconfigLoaderSync } from "@beep/repo-tsconfig/TsconfigLoaderSync";
   * import * as path from "node:path/posix";
   *
   * const config = TsconfigLoaderSync.resolve("/project/tsconfig.json", {
   *   fileSystem: {
   *     exists: (p) => p === "/project/tsconfig.json",
   *     readFile: () => '{"compilerOptions":{"target":"ES2022"}}',
   *   },
   *   path,
   * });
   * console.log(config.configPath) // /project/tsconfig.json
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly resolve = resolve;

  /**
   * {@link TsconfigLoader.compilerOptions}, synchronously: resolve the full
   * `extends` chain and project out the merged `compilerOptions`. Throws
   * the same typed failures as {@link TsconfigLoaderSync.resolve}.
   *
   * **Example** (Read effective options from supplied text)
   *
   * ```ts
   * import { TsconfigLoaderSync } from "@beep/repo-tsconfig/TsconfigLoaderSync";
   * import * as path from "node:path/posix";
   *
   * const config = TsconfigLoaderSync.compilerOptions("/project/tsconfig.json", {
   *   fileSystem: {
   *     exists: (p) => p === "/project/tsconfig.json",
   *     readFile: () => '{"compilerOptions":{"target":"ES2022"}}',
   *   },
   *   path,
   * });
   * console.log(config.target) // es2022
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly compilerOptions = compilerOptions;
}
