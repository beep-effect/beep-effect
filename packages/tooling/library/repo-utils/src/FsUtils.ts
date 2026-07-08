/**
 * Filesystem utility service for common monorepo operations.
 *
 * Provides effectful wrappers around glob matching, JSON file I/O,
 * path existence checks, and file/directory type queries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { A, thunkFalse } from "@beep/utils";
import { Glob as SharedGlob, layer as SharedGlobLayer } from "@beep/utils/Glob";
import * as O from "@beep/utils/Option";
import { Context, Effect, FileSystem, Layer, MutableHashSet, Order, Path } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { DomainError, NoSuchFileError } from "./errors/index.js";
import { jsonStringifyPretty } from "./JsonUtils.js";

const $I = $RepoUtilsId.create("FsUtils");
const decodeJsonString = S.decodeUnknownOption(S.fromJsonString(S.Json));

/**
 * Options for glob matching operations.
 *
 * @example
 * ```ts
 * import { GlobOptions } from "@beep/repo-utils/FsUtils"
 * const options = GlobOptions.make({
 *   cwd: "src",
 *   ignore: ["*.test.ts"]
 * })
 * console.log(options.cwd)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GlobOptions extends S.Class<GlobOptions>($I`GlobOptions`)(
  {
    absolute: S.optionalKey(S.Boolean).annotateKey({
      description: "Return absolute file paths when true.",
    }),
    cwd: S.optionalKey(S.String).annotateKey({
      description: "Directory used as the glob search root.",
    }),
    dot: S.optionalKey(S.Boolean).annotateKey({
      description: "Include dotfiles and dot-directories in glob results when true.",
    }),
    ignore: S.optionalKey(S.Union([S.String, S.Array(S.String)])).annotateKey({
      description: "One or more glob patterns excluded from the search.",
    }),
  },
  $I.annote("GlobOptions", {
    description: "Optional glob matching controls used by FsUtils path queries.",
  })
) {}

/**
 * Shape of the FsUtils service.
 *
 * @example
 * ```ts
 * import type { FsUtilsShape } from "@beep/repo-utils/FsUtils"
 * const methodName = "readJson" satisfies keyof FsUtilsShape
 * console.log(methodName)
 * ```
 * @category models
 * @since 0.0.0
 */
export interface FsUtilsShape {
  /**
   * Verify that a path exists on disk, or fail with `NoSuchFileError`.
   *
   * @since 0.0.0
   */
  readonly existsOrThrow: (filePath: string) => Effect.Effect<void, NoSuchFileError>;

  /**
   * Get the parent directory of a path.
   *
   * @since 0.0.0
   */
  readonly getParentDirectory: (filePath: string) => Effect.Effect<string>;
  /**
   * Match files and directories using glob patterns.
   *
   * @since 0.0.0
   */
  readonly glob: (
    pattern: string | ReadonlyArray<string>,
    options?: undefined | GlobOptions
  ) => Effect.Effect<ReadonlyArray<string>, DomainError>;

  /**
   * Match only files (not directories) using glob patterns.
   *
   * @since 0.0.0
   */
  readonly globFiles: (
    pattern: string | ReadonlyArray<string>,
    options?: undefined | GlobOptions
  ) => Effect.Effect<ReadonlyArray<string>, DomainError>;

  /**
   * Check whether a path is a directory.
   *
   * @since 0.0.0
   */
  readonly isDirectory: (filePath: string) => Effect.Effect<boolean, NoSuchFileError>;

  /**
   * Check whether a path is a regular file.
   *
   * @since 0.0.0
   */
  readonly isFile: (filePath: string) => Effect.Effect<boolean, NoSuchFileError>;

  /**
   * Read a file, apply a transform to its content, and write back only if the
   * content actually changed.
   *
   * @since 0.0.0
   */
  readonly modifyFile: (
    filePath: string,
    transform: (content: string) => string
  ) => Effect.Effect<boolean, NoSuchFileError | DomainError>;

  /**
   * Read and parse a JSON file.
   *
   * Returns `Option.none` when the file content is not valid JSON, while
   * missing-file failures remain in the error channel.
   *
   * @since 0.0.0
   */
  readonly readJson: (filePath: string) => Effect.Effect<O.Option<S.Json>, NoSuchFileError>;

  /**
   * Resolve a path to its canonical absolute form.
   *
   * @since 0.0.0
   */
  readonly realPath: (filePath: string) => Effect.Effect<string, NoSuchFileError>;

  /**
   * Write a value as JSON to a file with 2-space indentation and trailing newline.
   *
   * @since 0.0.0
   */
  readonly writeJson: (filePath: string, json: unknown) => Effect.Effect<void, DomainError>;
}

/**
 * Service tag for `FsUtils`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FsUtils } from "@beep/repo-utils/FsUtils"
 * const program = Effect.gen(function* () {
 *   const fsUtils = yield* FsUtils
 *   return fsUtils
 * })
 * console.log(program)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FsUtils extends Context.Service<FsUtils, FsUtilsShape>()($I`FsUtils`) {}

/**
 * Live layer for `FsUtils` that uses the platform `FileSystem` and `Path`
 * services.
 *
 * @example
 * ```ts
 * import { Layer } from "effect"
 * import { FsUtilsLive } from "@beep/repo-utils/FsUtils"
 * const layer = Layer.provideMerge(FsUtilsLive, Layer.empty)
 * console.log(layer)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const FsUtilsLive: Layer.Layer<FsUtils, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
  FsUtils,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const globUtils = yield* SharedGlob;
    const path = yield* Path.Path;

    const runGlob: (
      pattern: string | ReadonlyArray<string>,
      options?: undefined | (GlobOptions & { readonly nodir?: undefined | boolean })
    ) => Effect.Effect<ReadonlyArray<string>, DomainError> = Effect.fnUntraced(function* (pattern, options) {
      const sharedGlobOptions = {
        ...O.getSomesStruct({ absolute: O.fromUndefinedOr(options?.absolute) }),
        ...O.getSomesStruct({ cwd: O.fromUndefinedOr(options?.cwd) }),
        ...O.getSomesStruct({ dot: O.fromUndefinedOr(options?.dot) }),
        ...O.getSomesStruct({ ignore: O.fromUndefinedOr(options?.ignore) }),
        ...O.getSomesStruct({ nodir: O.fromUndefinedOr(options?.nodir) }),
      };

      return yield* globUtils
        .glob(pattern, sharedGlobOptions)
        .pipe(
          Effect.mapError((error) =>
            DomainError.make({ cause: error, message: `Glob failed for pattern "${String(pattern)}"` })
          )
        );
    });

    const globFiles: FsUtilsShape["globFiles"] = Effect.fnUntraced(function* (pattern, options) {
      return yield* runGlob(pattern, { ...options, nodir: true });
    });

    const readJson: FsUtilsShape["readJson"] = Effect.fn(function* (filePath) {
      return yield* fs.readFileString(filePath).pipe(
        Effect.mapError((e) => NoSuchFileError.make({ path: filePath, message: `Failed to read file: ${e.message}` })),
        Effect.map(decodeJsonString)
      );
    });

    const writeJson: FsUtilsShape["writeJson"] = Effect.fn(function* (filePath, json) {
      const content = yield* jsonStringifyPretty(json);
      yield* fs
        .writeFileString(filePath, `${content}\n`)
        .pipe(Effect.mapError((e) => DomainError.make({ cause: e, message: `Failed to write JSON to "${filePath}"` })));
    });

    const modifyFile: FsUtilsShape["modifyFile"] = Effect.fn(function* (filePath, transform) {
      const original = yield* fs
        .readFileString(filePath)
        .pipe(
          Effect.mapError((e) =>
            NoSuchFileError.make({ path: filePath, message: `Failed to read file for modification: ${e.message}` })
          )
        );
      const transformed = transform(original);
      if (transformed === original) {
        return false;
      }
      yield* fs
        .writeFileString(filePath, transformed)
        .pipe(
          Effect.mapError((e) => DomainError.make({ cause: e, message: `Failed to write modified file "${filePath}"` }))
        );
      return true;
    });

    const realPath: FsUtilsShape["realPath"] = Effect.fn(function* (filePath) {
      return yield* fs.realPath(filePath).pipe(
        Effect.mapError((e) =>
          NoSuchFileError.make({
            path: filePath,
            message: `Failed to resolve canonical path for "${filePath}": ${e.message}`,
          })
        )
      );
    });

    const existsOrThrow: FsUtilsShape["existsOrThrow"] = Effect.fn(function* (filePath) {
      const exists = yield* fs
        .exists(filePath)
        .pipe(
          Effect.mapError(() =>
            NoSuchFileError.make({ path: filePath, message: `Unable to check existence of "${filePath}"` })
          )
        );
      if (!exists) {
        return yield* NoSuchFileError.make({
          path: filePath,
          message: `Path does not exist: "${filePath}"`,
        });
      }
    });

    const statOrFail: (filePath: string) => Effect.Effect<FileSystem.File.Info, NoSuchFileError> = Effect.fnUntraced(
      function* (filePath) {
        return yield* fs
          .stat(filePath)
          .pipe(
            Effect.mapError(() => NoSuchFileError.make({ path: filePath, message: `Failed to stat "${filePath}"` }))
          );
      }
    );

    const isDirectory: FsUtilsShape["isDirectory"] = Effect.fnUntraced(function* (filePath) {
      const info = yield* statOrFail(filePath);
      return info.type === "Directory";
    });

    const isFile: FsUtilsShape["isFile"] = Effect.fnUntraced(function* (filePath) {
      const info = yield* statOrFail(filePath);
      return info.type === "File";
    });

    const getParentDirectory: FsUtilsShape["getParentDirectory"] = Effect.fnUntraced(function* (filePath) {
      yield* Effect.void;
      return path.dirname(filePath);
    });

    return FsUtils.of({
      glob: runGlob,
      globFiles,
      readJson,
      writeJson,
      modifyFile,
      realPath,
      existsOrThrow,
      isDirectory,
      isFile,
      getParentDirectory,
    });
  })
).pipe(Layer.provideMerge(SharedGlobLayer));

/**
 * How {@link walkFiles} treats symbolic links encountered during traversal.
 *
 * @remarks
 * - `"follow"` resolves link targets via `stat` and imposes no cycle guard —
 *   the lightest mode, matching plain recursive `readDirectory` walkers.
 * - `"skip-symlinks"` excludes every symlinked entry (file or directory) before
 *   `stat`, so links are neither traversed nor emitted.
 * - `"guard-cycles"` canonicalizes each directory with `realPath` and refuses to
 *   re-enter a directory already visited, protecting against symlink loops while
 *   still emitting the traversal (non-canonical) paths.
 * @example
 * ```ts
 * import type { WalkFilesSymlinkGuard } from "@beep/repo-utils/FsUtils"
 * const guard = "guard-cycles" satisfies WalkFilesSymlinkGuard
 * console.log(guard)
 * ```
 * @category models
 * @since 0.0.0
 */
export type WalkFilesSymlinkGuard = "follow" | "skip-symlinks" | "guard-cycles";

/**
 * Options controlling a {@link walkFiles} traversal.
 *
 * @example
 * ```ts
 * import * as A from "effect/Array"
 * import type { WalkFilesOptions } from "@beep/repo-utils/FsUtils"
 * const options = {
 *   skipDirectories: ["node_modules", "dist", "build", ".turbo"],
 *   include: (_filePath, name) => A.some([".ts", ".tsx"], (ext) => name.endsWith(ext)),
 * } satisfies WalkFilesOptions
 * console.log(options.skipDirectories)
 * ```
 * @category models
 * @since 0.0.0
 */
export interface WalkFilesOptions {
  /**
   * Predicate deciding whether a regular file is emitted, receiving the joined
   * child path and the bare entry name. Defaults to including every file.
   *
   * @since 0.0.0
   */
  readonly include?: undefined | ((filePath: string, name: string) => boolean);
  /**
   * Directory base names to prune from the traversal, matched by exact equality
   * against each directory entry name (not a glob or substring).
   *
   * @since 0.0.0
   */
  readonly skipDirectories?: undefined | ReadonlyArray<string>;
  /**
   * Symbolic-link handling strategy. Defaults to `"follow"`.
   *
   * @since 0.0.0
   */
  readonly symlinkGuard?: undefined | WalkFilesSymlinkGuard;
}

const includeAllFiles = (_filePath: string, _name: string): boolean => true;

/**
 * Recursively collect regular files beneath `root`, pruning skipped directories
 * and applying a file predicate, with deterministic sorted output.
 *
 * @remarks
 * Consolidates the hand-rolled recursive `readDirectory` walkers scattered
 * across repo tooling: each re-typed its own `node_modules`/`dist`/`build`/
 * `.turbo` skip list, extension filter, symlink policy, and ordering. The
 * returned paths are the joined traversal paths (never canonicalized), sorted
 * once as a flat list by lexicographic path order via `Order.String` — not
 * sorted per directory level. A missing `root` yields an empty array rather than
 * a failure. Directory reads and `stat` failures surface as {@link DomainError}.
 * See {@link WalkFilesSymlinkGuard} for the symlink modes.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { walkFiles } from "@beep/repo-utils/FsUtils"
 *
 * const program = walkFiles("packages/example/src", {
 *   skipDirectories: ["node_modules", "dist"],
 *   include: (_filePath, name) => name.endsWith(".ts"),
 * })
 * const collect = Effect.map(program, (files) => files.length)
 * console.log(collect)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const walkFiles: (
  root: string,
  options?: undefined | WalkFilesOptions
) => Effect.Effect<ReadonlyArray<string>, DomainError, FileSystem.FileSystem | Path.Path> = Effect.fn(function* (
  root,
  options: WalkFilesOptions = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skipDirectories = options.skipDirectories ?? A.empty<string>();
  const include = options.include ?? includeAllFiles;
  const symlinkGuard: WalkFilesSymlinkGuard = options.symlinkGuard ?? "follow";
  const visited = MutableHashSet.empty<string>();

  const rootExists = yield* fs.exists(root).pipe(Effect.orElseSucceed(thunkFalse));
  if (!rootExists) {
    return A.empty<string>();
  }

  if (symlinkGuard === "guard-cycles") {
    const canonicalRoot = yield* fs.realPath(root).pipe(Effect.orElseSucceed(() => root));
    MutableHashSet.add(visited, canonicalRoot);
  }

  const visit: (current: string) => Effect.Effect<ReadonlyArray<string>, DomainError> = Effect.fnUntraced(
    function* (current) {
      const entries = yield* fs
        .readDirectory(current)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to read directory "${current}"`)));
      let files = A.empty<string>();

      for (const entry of entries) {
        const childPath = path.join(current, entry);

        if (symlinkGuard === "skip-symlinks") {
          const link = yield* fs.readLink(childPath).pipe(Effect.option);
          if (O.isSome(link)) {
            continue;
          }
        }

        const info = yield* fs
          .stat(childPath)
          .pipe(Effect.mapError(DomainError.newCause(`Failed to stat "${childPath}"`)));

        if (info.type === "Directory") {
          if (A.contains(skipDirectories, entry)) {
            continue;
          }
          if (symlinkGuard === "guard-cycles") {
            const canonical = yield* fs.realPath(childPath).pipe(Effect.orElseSucceed(() => childPath));
            if (MutableHashSet.has(visited, canonical)) {
              continue;
            }
            MutableHashSet.add(visited, canonical);
          }
          files = A.appendAll(files, yield* visit(childPath));
          continue;
        }

        if (info.type === "File" && include(childPath, entry)) {
          files = A.append(files, childPath);
        }
      }

      return files;
    }
  );

  return A.sort(yield* visit(root), Order.String);
});

/**
 * Check whether a path exists on disk, never failing.
 *
 * @remarks
 * Collapses the repeated `fs.exists(...).pipe(Effect.orElseSucceed(...))`
 * composition into a single helper: any underlying platform failure is treated
 * as "does not exist" and reported as `false`, so the success channel is total.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { exists } from "@beep/repo-utils/FsUtils"
 *
 * const program = exists("package.json")
 * console.log(Effect.map(program, (present) => (present ? "found" : "absent")))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const exists: (filePath: string) => Effect.Effect<boolean, never, FileSystem.FileSystem> = Effect.fn(
  function* (filePath) {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.exists(filePath).pipe(Effect.orElseSucceed(thunkFalse));
  }
);

/**
 * Walk upward from `startDir` to find the nearest directory containing a
 * `package.json`, bounded by `stopAt`.
 *
 * @remarks
 * Traversal starts at `startDir` (inclusive) and climbs via `dirname` while the
 * current directory differs from the resolved `stopAt` boundary. The boundary is
 * exclusive — a `package.json` located exactly at `stopAt`, or above it, yields
 * `Option.none`. Reaching the filesystem root before the boundary also yields
 * `Option.none` rather than failing. Callers that want a fallback (for example
 * the repository root) compose `Option.getOrElse`; callers that treat a miss as
 * an error branch on the `None`.
 * @example
 * ```ts
 * import { Effect, pipe } from "effect"
 * import * as O from "effect/Option"
 * import { findNearestPackageDir } from "@beep/repo-utils/FsUtils"
 *
 * // data-first
 * const owning = findNearestPackageDir("packages/example/src/nested", "packages")
 * // data-last (subject piped in), resolving the repo root as the fallback owner
 * const resolved = pipe(
 *   "packages/example/src/nested",
 *   findNearestPackageDir("packages"),
 *   Effect.map(O.getOrElse(() => "."))
 * )
 * console.log([owning, resolved])
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const findNearestPackageDir: {
  (startDir: string, stopAt: string): Effect.Effect<O.Option<string>, never, FileSystem.FileSystem | Path.Path>;
  (stopAt: string): (startDir: string) => Effect.Effect<O.Option<string>, never, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (startDir: string, stopAt: string) {
    const path = yield* Path.Path;
    const boundary = path.resolve(stopAt);
    let current = path.resolve(startDir);

    while (current !== boundary) {
      const hasPackageJson = yield* exists(path.join(current, "package.json"));
      if (hasPackageJson) {
        return O.some(current);
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return O.none<string>();
      }
      current = parent;
    }

    return O.none<string>();
  })
);
