/**
 * Filesystem utility service for common monorepo operations.
 *
 * Provides effectful wrappers around glob matching, JSON file I/O,
 * path existence checks, and file/directory type queries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { $RepoUtilsId } from "@beep/identity/packages";
import { A, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { compileAndExpand } from "@beep/walker/Expand";
import { Walker } from "@beep/walker/Walker";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DomainError, NoSuchFileError } from "./errors/index.ts";
import { jsonStringifyPretty } from "./JsonUtils.ts";

const $I = $RepoUtilsId.create("FsUtils");
const decodeJsonString = S.decodeUnknownOption(S.fromJsonString(S.Json));

/**
 * Options for glob matching operations.
 *
 * **Example** (Creating GlobOptions with ignore)
 *
 * ```ts
 * import { GlobOptions } from "@beep/repo-utils/FsUtils"
 * const options = GlobOptions.make({
 *   cwd: "src",
 *   ignore: ["*.test.ts"]
 * })
 * console.log(options.cwd)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GlobOptions extends S.Opaque<GlobOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    absolute: S.optionalKey(S.Boolean).annotateKey({
      description: "Return absolute file paths when true.",
    }),
    cwd: S.optionalKey(S.String).annotateKey({
      description: "Directory used as the glob search root.",
    }),
    dot: S.optionalKey(S.Boolean).annotateKey({
      description: "Include dotfiles and dot-directories in glob results when true.",
    }),
    followSymlinks: S.optionalKey(S.Boolean).annotateKey({
      description: "Descend into symlinked directories, with a per-branch cycle guard, when true.",
    }),
    ignore: S.optionalKey(S.Union([S.String, S.Array(S.String)])).annotateKey({
      description: "One or more glob patterns excluded from the search.",
    }),
  }).pipe(
    $I.annoteSchema("GlobOptions", {
      description: "Optional glob matching controls used by FsUtils path queries.",
    })
  )
) {}

// Ignore patterns always match dot segments, as the picomatch post-filter they replace did.
const ignoreDialect = GlobPatternOptions.make({ dot: true });

// A `**/<name>/**` ignore excludes every directory named `<name>`, so the walk can prune it outright.
const prunableIgnore = /^\*\*\/([^/*?[\]{}()!+@\\]+)\/\*\*$/;

// The directory names the walk never enters: the `<name>` of each `**/<name>/**` ignore.
// Any other ignore shape prunes nothing, so the walker's own `node_modules`/`.git`
// default never silently applies.
const pruneFromIgnores: (ignores: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.flatMap(
    flow(
      Str.match(prunableIgnore),
      O.flatMapNullishOr((match) => match[1]),
      O.toArray
    )
  ),
  A.dedupe
);

// A leading `./` and repeated slashes carry no meaning in a glob, so they never reach the walk or its results.
const normalizeSource: (source: string) => string = flow(Str.replace(/\/{2,}/g, "/"), Str.replace(/^(?:\.\/)+/, ""));

// A leading-`!` pattern in the include list excludes what it names, as in fast-glob and npm workspaces.
const isExclusion = Str.startsWith("!");

// Each ignore compiles as itself and as everything below it (`p` OR `p/**`), trailing slash dropped.
const compileIgnores = Effect.fnUntraced(function* (ignores: ReadonlyArray<string>) {
  const sources = A.flatMap(ignores, (ignore) => {
    const base = Str.replace(/\/+$/, "")(normalizeSource(ignore));
    return [base, `${base}/**`];
  });
  return yield* Effect.forEach(sources, (source) => GlobPattern.compile(source, ignoreDialect));
});

// Where one include pattern walks from, and the prefix its walk-relative matches are reported under.
type WalkAnchor = {
  readonly cwd: string;
  readonly prefix: string;
  readonly pattern: string;
};

// The compiled ignores of one call: relative ones match the reported path, absolute ones the absolute path.
type IgnoreSets = {
  readonly relative: ReadonlyArray<GlobPattern>;
  readonly absolute: ReadonlyArray<GlobPattern>;
};

// The leading run of `../` segments a pattern climbs out of `cwd` with, or `""`.
const leadingClimb: (source: string) => string = flow(
  Str.match(/^(?:\.\.\/)+/),
  O.flatMapNullishOr((match) => match[0]),
  O.getOrElse(() => "")
);

// An absolute pattern walks from its filesystem root and yields absolute paths; a pattern that
// starts by climbing out of `cwd` (`../`) walks from the directory it climbs to and keeps the climb
// in its results; any other pattern walks from `cwd` itself.
const anchorOf = (path: Path.Path, cwd: string, source: string): WalkAnchor => {
  const prefix = path.isAbsolute(source) ? path.parse(source).root : leadingClimb(source);
  return { cwd: path.resolve(cwd, prefix), prefix, pattern: Str.slice(prefix.length)(source) };
};

const compileIgnoreSets = Effect.fnUntraced(function* (path: Path.Path, ignores: ReadonlyArray<string>) {
  const relative = yield* compileIgnores(A.filter(ignores, (ignore) => !path.isAbsolute(ignore)));
  const absolute = yield* compileIgnores(A.filter(ignores, path.isAbsolute));
  return { relative, absolute } satisfies IgnoreSets;
});

const isIgnored = (path: Path.Path, ignores: IgnoreSets, anchor: WalkAnchor, match: string): boolean => {
  const reported = path.isAbsolute(anchor.prefix) ? match : `${anchor.prefix}${match}`;
  const absolute = path.resolve(anchor.cwd, match);
  return (
    A.some(ignores.relative, (ignore) => ignore.matches(reported)) ||
    A.some(ignores.absolute, (ignore) => ignore.matches(absolute))
  );
};

// The include patterns of a call, and its ignores with every leading-`!` include folded in.
const splitPatterns = (
  pattern: string | ReadonlyArray<string>,
  ignore: undefined | string | ReadonlyArray<string>
): { readonly includes: ReadonlyArray<string>; readonly ignores: ReadonlyArray<string> } => {
  const sources = A.map(A.ensure(pattern), normalizeSource);
  return {
    includes: A.filter(sources, (source) => !isExclusion(source)),
    ignores: A.appendAll(A.ensure(ignore ?? A.empty<string>()), A.map(A.filter(sources, isExclusion), Str.slice(1))),
  };
};

// A relative pattern needs a real directory to walk from; a missing or non-directory cwd fails.
const requireDirectory = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, cwd: string) {
  const info = yield* fs.stat(cwd);
  if (info.type !== "Directory") {
    return yield* DomainError.make({ message: `Glob cwd "${cwd}" is not a directory` });
  }
});

/**
 * Shape of the FsUtils service.
 *
 * **Example** (Checking FsUtilsShape method keys)
 *
 * ```ts
 * import type { FsUtilsShape } from "@beep/repo-utils/FsUtils"
 * const methodName = "readJson" satisfies keyof FsUtilsShape
 * console.log(methodName)
 * ```
 *
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
   * Match files (never directories) using glob patterns.
   *
   * **Details**
   *
   * Each pattern compiles under the `@beep/glob` minimatch dialect and expands
   * with the `@beep/walker` descent over the provided `FileSystem`. A leading
   * `./` and repeated slashes are dropped, a leading-`!` pattern excludes what
   * it names, a pattern that starts with `../` walks from the directory it
   * climbs to and keeps the climb in its results, and an absolute pattern
   * yields absolute paths. Ignore patterns exclude a match and everything below
   * it; an absolute ignore is matched against the absolute path. Results are
   * deduplicated and sorted, and symlinked directories are entered only under
   * `followSymlinks`.
   *
   * **Gotchas**
   *
   * A relative pattern fails with `DomainError` when `cwd` is missing or not a
   * directory, as does an unreadable directory the walk must enter or a walk
   * deeper than 256 levels. A symlink to a file matches like the file.
   *
   * @since 0.0.0
   */
  readonly globFiles: (
    pattern: string | ReadonlyArray<string>,
    options?: undefined | typeof GlobOptions.Encoded
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
 * **Example** (Yielding FsUtils service)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { FsUtils } from "@beep/repo-utils/FsUtils"
 * const program = Effect.gen(function* () {
 *   const fsUtils = yield* FsUtils
 *   return fsUtils
 * })
 * console.log(program)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FsUtils extends Context.Service<FsUtils, FsUtilsShape>()($I`FsUtils`) {}

/**
 * Live layer for `FsUtils` that uses the platform `FileSystem` and `Path`
 * services.
 *
 * **Example** (Providing FsUtilsLive layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import { FsUtilsLive } from "@beep/repo-utils/FsUtils"
 * const layer = Layer.provideMerge(FsUtilsLive, Layer.empty)
 * console.log(layer)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const FsUtilsLive: Layer.Layer<FsUtils, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
  FsUtils,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const platform = yield* Effect.context<FileSystem.FileSystem | Path.Path>();

    const globFiles: FsUtilsShape["globFiles"] = Effect.fn("FsUtils.globFiles")(
      function* (pattern, options = {}) {
        const cwd = path.resolve(options.cwd ?? ".");
        const { includes, ignores } = splitPatterns(pattern, options.ignore);
        const ignoreSets = yield* compileIgnoreSets(path, ignores);
        const expandSettings = {
          glob: { dot: options.dot ?? false },
          prune: pruneFromIgnores(A.filter(ignores, (ignore) => !path.isAbsolute(ignore))),
          followSymlinks: options.followSymlinks ?? false,
          onUnreadable: "fail" as const,
        };
        if (A.some(includes, (include) => !path.isAbsolute(include))) yield* requireDirectory(fs, cwd);

        const expandOne = Effect.fnUntraced(function* (source: string) {
          const anchor = anchorOf(path, cwd, source);
          const matches = yield* compileAndExpand(anchor.pattern, { ...expandSettings, cwd: anchor.cwd });
          return pipe(
            matches,
            A.filter((match) => !isIgnored(path, ignoreSets, anchor, match)),
            A.map((match) => `${anchor.prefix}${match}`)
          );
        });

        const matched = A.flatten(yield* Effect.forEach(includes, expandOne).pipe(Effect.provide(platform)));
        const resolved = options.absolute === true ? A.map(matched, (match) => path.resolve(cwd, match)) : matched;
        return pipe(resolved, A.dedupe, A.sort(Order.String));
      },
      (effect, pattern) =>
        Effect.mapError(effect, (cause) =>
          DomainError.make({ cause, message: `Glob failed for pattern "${String(pattern)}"` })
        )
    );

    const readJson: FsUtilsShape["readJson"] = Effect.fn(function* (filePath) {
      return yield* fs.readFileString(filePath).pipe(
        Effect.mapBoth({
          onFailure: (e) => NoSuchFileError.make({ path: filePath, message: `Failed to read file: ${e.message}` }),
          onSuccess: decodeJsonString,
        })
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
);

/**
 * Check whether a path exists on disk, never failing.
 *
 * **Gotchas**
 *
 * Collapses the repeated `fs.exists(...).pipe(Effect.orElseSucceed(...))`
 * composition into a single helper: any underlying platform failure is treated
 * as "does not exist" and reported as `false`, so the success channel is total.
 *
 * **Example** (Checking path existence safely)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { exists } from "@beep/repo-utils/FsUtils"
 *
 * const program = exists("package.json")
 * console.log(Effect.map(program, (present) => (present ? "found" : "absent")))
 * ```
 *
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
 * **Details**
 *
 * Traversal starts at the resolved `startDir` (inclusive) and climbs the
 * `@beep/walker` `Walker.ascend` chain toward the resolved `stopAt` boundary. The boundary is
 * exclusive — a `package.json` located exactly at `stopAt`, or above it, yields
 * `Option.none`. Reaching the filesystem root before the boundary also yields
 * `Option.none` rather than failing. Callers that want a fallback (for example
 * the repository root) compose `Option.getOrElse`; callers that treat a miss as
 * an error branch on the `None`.
 *
 * **Example** (Finding package dir with fallback)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { pipe } from "effect/Function";
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
 *
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
    // `Walker.ascend` stops at its ceiling inclusively; this lookup excludes the boundary itself.
    const dirs = A.filter(
      yield* Walker.ascend(path.resolve(startDir), { stopAt: boundary }),
      (dir) => dir !== boundary
    );
    const manifest = yield* Walker.findUpward(dirs, (dir) => [path.join(dir, "package.json")]);
    return O.map(manifest, path.dirname);
  })
);
