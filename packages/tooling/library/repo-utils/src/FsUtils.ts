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
import { Glob as SharedGlob, layer as SharedGlobLayer } from "@beep/utils/Glob";
import * as O from "@beep/utils/Option";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
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
