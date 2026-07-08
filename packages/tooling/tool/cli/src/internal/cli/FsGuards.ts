/**
 * Shared, error-parameterised filesystem guards and hashing helpers for
 * repo-cli command services.
 *
 * @remarks
 * The Files and Corpus command services carry near-identical directory
 * validation, overwrite preflight, rename, path-segment, byte-comparison,
 * deduplication, unique-name, and SHA-256 helpers, each raising its own tagged
 * error. These reproductions accept the failing error as a constructor
 * argument so a command keeps its own error type, and consolidate hashing onto
 * the {@link https://en.wikipedia.org/wiki/SHA-2 SHA-256} `Sha256HexFromBytes`
 * schema from `@beep/schema` (adapters add any `sha256:` prefix themselves).
 * Multi-argument helpers expose dual data-first / data-last call signatures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256HexFromBytes } from "@beep/schema";
import { A, pipe, Str } from "@beep/utils";
import { Effect, FileSystem, HashSet, MutableHashSet, Path } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { Sha256Hex } from "@beep/schema";
import type * as Crypto from "effect/Crypto";

const decodeSha256FromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);

const isSafePathSegment = (value: string): boolean =>
  value !== "." && value !== ".." && !pipe(value, Str.includes("/")) && !pipe(value, Str.includes("\\"));

// Result of a unique-name allocation: the free name and the updated used set.
// Kept module-local (not an exported schema) because `usedTargetNames` is a
// live `HashSet` accumulator threaded through allocation, not a decodable data
// model — effect/Schema has no `HashSet` combinator to model it faithfully.
type UniqueNameAllocation = {
  readonly targetName: string;
  readonly usedTargetNames: HashSet.HashSet<string>;
};

/**
 * Error constructor bundle for {@link validateDirectory}.
 *
 * @category models
 * @since 0.0.0
 */
export interface ValidateDirectoryErrors<E> {
  readonly onNotDirectory: (directory: string) => E;
  readonly onRealPathError: (cause: unknown, directory: string) => E;
  readonly onStatError: (cause: unknown, directory: string) => E;
}

/**
 * Options bundle for {@link preflightOverwritableFile}.
 *
 * @category models
 * @since 0.0.0
 */
export interface PreflightOverwritableFileOptions<E> {
  readonly description: string;
  readonly onInspectError: (cause: unknown, filePath: string, description: string) => E;
  readonly onRefuseNonFile: (filePath: string, description: string) => E;
  readonly onRefuseOverwrite: (filePath: string, description: string) => E;
  readonly onStatError: (cause: unknown, filePath: string, description: string) => E;
  readonly overwrite: boolean;
}

/**
 * Options bundle carrying the failure constructor for {@link validatePathSegment}.
 *
 * @category models
 * @since 0.0.0
 */
export interface ValidatePathSegmentOptions<E> {
  readonly onInvalid: (label: string, value: string) => E;
}

/**
 * Options bundle carrying the failure constructor for {@link renameOrFail}.
 *
 * @category models
 * @since 0.0.0
 */
export interface RenameOrFailOptions<E> {
  readonly onError: (cause: unknown, sourcePath: string, targetPath: string) => E;
}

/**
 * Structural equality of two byte arrays.
 *
 * @param left - The first byte array.
 * @param right - The second byte array.
 * @returns `true` when both arrays have identical length and contents.
 * @example
 * ```ts
 * import { bytesEqual } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * console.log(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])))
 * console.log(bytesEqual(new Uint8Array([2]))(new Uint8Array([1])))
 * ```
 * @category comparison
 * @since 0.0.0
 */
export const bytesEqual: {
  (left: Uint8Array, right: Uint8Array): boolean;
  (right: Uint8Array): (left: Uint8Array) => boolean;
} = dual(2, (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
});

/**
 * Drop records whose `sha256` digest has already been seen, preserving order.
 *
 * @param records - The records to deduplicate by digest.
 * @returns The first record per digest and the number skipped.
 * @example
 * ```ts
 * import { dedupeBySha256 } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const result = dedupeBySha256([{ sha256: "a" }, { sha256: "a" }, { sha256: "b" }])
 * console.log(result.duplicatesSkipped)
 * ```
 * @category deduplication
 * @since 0.0.0
 */
export const dedupeBySha256 = <A extends { readonly sha256: string }>(
  records: ReadonlyArray<A>
): { readonly duplicatesSkipped: number; readonly kept: ReadonlyArray<A> } => {
  const seen = MutableHashSet.empty<string>();
  const kept = A.filter(records, (record) => {
    if (MutableHashSet.has(seen, record.sha256)) {
      return false;
    }
    MutableHashSet.add(seen, record.sha256);
    return true;
  });
  return { duplicatesSkipped: A.length(records) - A.length(kept), kept };
};

/**
 * Allocate a filesystem name that does not collide with an in-use set,
 * suffixing `_NN` on collision.
 *
 * @param stem - The base file name without extension.
 * @param extension - The extension (including any leading dot) to append.
 * @param usedNames - The set of already-allocated names.
 * @returns The free name and the set updated to include it.
 * @example
 * ```ts
 * import { HashSet } from "effect"
 * import { allocateUniqueName } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const first = allocateUniqueName("photo", ".webp", HashSet.make("photo.webp"))
 * console.log(first.targetName)
 * ```
 * @category naming
 * @since 0.0.0
 */
export const allocateUniqueName: {
  (stem: string, extension: string, usedNames: HashSet.HashSet<string>): UniqueNameAllocation;
  (extension: string, usedNames: HashSet.HashSet<string>): (stem: string) => UniqueNameAllocation;
} = dual(3, (stem: string, extension: string, usedNames: HashSet.HashSet<string>): UniqueNameAllocation => {
  let suffix = 0;
  let targetName = `${stem}${extension}`;

  while (HashSet.has(usedNames, targetName)) {
    suffix += 1;
    targetName = `${stem}_${Str.padStart(2, "0")(`${suffix}`)}${extension}`;
  }

  return {
    targetName,
    usedTargetNames: HashSet.add(usedNames, targetName),
  };
});

/**
 * Hash a file's bytes into a canonical lowercase SHA-256 hex digest.
 *
 * @remarks
 * Reads the whole file and decodes through the `Sha256HexFromBytes` schema,
 * so it requires `Crypto.Crypto`. The returned digest is the bare hex string;
 * callers that persist a `sha256:` prefix add it themselves.
 *
 * @param filePath - The file to hash.
 * @param onError - Builds the caller's error from a read or hashing failure.
 * @returns The lowercase hex digest of the file's contents.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { hashFileSha256 } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const onError = (cause: unknown) => new Error(`hash failed: ${cause}`)
 * console.log(Effect.isEffect(hashFileSha256("/tmp/example.txt", onError)))
 * console.log(Effect.isEffect(hashFileSha256(onError)("/tmp/example.txt")))
 * ```
 * @category hashing
 * @since 0.0.0
 */
export const hashFileSha256: {
  <E>(
    filePath: string,
    onError: (cause: unknown, filePath: string) => E
  ): Effect.Effect<Sha256Hex, E, FileSystem.FileSystem | Crypto.Crypto>;
  <E>(
    onError: (cause: unknown, filePath: string) => E
  ): (filePath: string) => Effect.Effect<Sha256Hex, E, FileSystem.FileSystem | Crypto.Crypto>;
} = dual(
  2,
  <E>(
    filePath: string,
    onError: (cause: unknown, filePath: string) => E
  ): Effect.Effect<Sha256Hex, E, FileSystem.FileSystem | Crypto.Crypto> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const bytes = yield* fs.readFile(filePath).pipe(Effect.mapError((cause) => onError(cause, filePath)));
      return yield* decodeSha256FromBytes(bytes).pipe(Effect.mapError((cause) => onError(cause, filePath)));
    }).pipe(Effect.withSpan("RepoCli.FsGuards.hashFileSha256"))
);

/**
 * Validate a path segment is a single, non-traversal name.
 *
 * @param label - The caller-facing label for the segment.
 * @param value - The candidate segment.
 * @param options - Bundle carrying `onInvalid`, which builds the caller's error.
 * @returns A void effect, failing when `value` is `.`, `..`, or contains a
 *   path separator.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { validatePathSegment } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const options = { onInvalid: (label: string, value: string) => new Error(`${label}: ${value}`) }
 * console.log(Effect.isEffect(validatePathSegment("source", "..", options)))
 * console.log(Effect.isEffect(validatePathSegment("..", options)("source")))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const validatePathSegment: {
  <E>(label: string, value: string, options: ValidatePathSegmentOptions<E>): Effect.Effect<void, E>;
  <E>(value: string, options: ValidatePathSegmentOptions<E>): (label: string) => Effect.Effect<void, E>;
} = dual(
  3,
  <E>(label: string, value: string, options: ValidatePathSegmentOptions<E>): Effect.Effect<void, E> =>
    isSafePathSegment(value) ? Effect.void : Effect.fail(options.onInvalid(label, value))
);

/**
 * Resolve, stat, and canonicalise a directory path.
 *
 * @param dir - The directory path to validate.
 * @param errors - Constructors for the stat, non-directory, and realpath
 *   failures.
 * @returns The resolved and canonical directory paths.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { validateDirectory } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const errors = {
 *   onStatError: (cause: unknown) => new Error(`stat: ${cause}`),
 *   onNotDirectory: (dir: string) => new Error(`not a directory: ${dir}`),
 *   onRealPathError: (cause: unknown) => new Error(`realpath: ${cause}`),
 * }
 * console.log(Effect.isEffect(validateDirectory("./assets", errors)))
 * console.log(Effect.isEffect(validateDirectory(errors)("./assets")))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const validateDirectory: {
  <E>(
    dir: string,
    errors: ValidateDirectoryErrors<E>
  ): Effect.Effect<{ readonly canonicalDir: string; readonly directory: string }, E, FileSystem.FileSystem | Path.Path>;
  <E>(
    errors: ValidateDirectoryErrors<E>
  ): (
    dir: string
  ) => Effect.Effect<
    { readonly canonicalDir: string; readonly directory: string },
    E,
    FileSystem.FileSystem | Path.Path
  >;
} = dual(
  2,
  <E>(
    dir: string,
    errors: ValidateDirectoryErrors<E>
  ): Effect.Effect<
    { readonly canonicalDir: string; readonly directory: string },
    E,
    FileSystem.FileSystem | Path.Path
  > =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = path.resolve(dir);
      const stat = yield* fs.stat(directory).pipe(Effect.mapError((cause) => errors.onStatError(cause, directory)));

      if (stat.type !== "Directory") {
        return yield* Effect.fail(errors.onNotDirectory(directory));
      }

      const canonicalDir = yield* fs
        .realPath(directory)
        .pipe(Effect.mapError((cause) => errors.onRealPathError(cause, directory)));

      return { canonicalDir, directory };
    }).pipe(Effect.withSpan("RepoCli.FsGuards.validateDirectory"))
);

/**
 * Refuse to overwrite an existing path unless the caller opted in and the
 * target is a regular file.
 *
 * @param filePath - The output path to preflight.
 * @param options - Overwrite flag, description, and the inspect/refuse/stat/
 *   non-file error constructors.
 * @returns A void effect that fails when the write would be refused.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { preflightOverwritableFile } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const options = {
 *   overwrite: false,
 *   description: "manifest",
 *   onInspectError: (cause: unknown) => new Error(`inspect: ${cause}`),
 *   onRefuseOverwrite: (path: string) => new Error(`refuse: ${path}`),
 *   onStatError: (cause: unknown) => new Error(`stat: ${cause}`),
 *   onRefuseNonFile: (path: string) => new Error(`non-file: ${path}`),
 * }
 * console.log(Effect.isEffect(preflightOverwritableFile("/tmp/out.json", options)))
 * console.log(Effect.isEffect(preflightOverwritableFile(options)("/tmp/out.json")))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const preflightOverwritableFile: {
  <E>(filePath: string, options: PreflightOverwritableFileOptions<E>): Effect.Effect<void, E, FileSystem.FileSystem>;
  <E>(
    options: PreflightOverwritableFileOptions<E>
  ): (filePath: string) => Effect.Effect<void, E, FileSystem.FileSystem>;
} = dual(
  2,
  <E>(filePath: string, options: PreflightOverwritableFileOptions<E>): Effect.Effect<void, E, FileSystem.FileSystem> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const exists = yield* fs
        .exists(filePath)
        .pipe(Effect.mapError((cause) => options.onInspectError(cause, filePath, options.description)));

      if (!exists) {
        return;
      }

      if (!options.overwrite) {
        return yield* Effect.fail(options.onRefuseOverwrite(filePath, options.description));
      }

      const stat = yield* fs
        .stat(filePath)
        .pipe(Effect.mapError((cause) => options.onStatError(cause, filePath, options.description)));

      if (stat.type !== "File") {
        return yield* Effect.fail(options.onRefuseNonFile(filePath, options.description));
      }
    }).pipe(Effect.withSpan("RepoCli.FsGuards.preflightOverwritableFile"))
);

/**
 * Rename a path, mapping a platform failure to the caller's error.
 *
 * @param sourcePath - The current path.
 * @param targetPath - The destination path.
 * @param options - Bundle carrying `onError`, which builds the caller's error.
 * @returns A void effect that fails when the rename cannot complete.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { renameOrFail } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const options = { onError: (cause: unknown) => new Error(`rename: ${cause}`) }
 * console.log(Effect.isEffect(renameOrFail("/tmp/a", "/tmp/b", options)))
 * console.log(Effect.isEffect(renameOrFail("/tmp/b", options)("/tmp/a")))
 * ```
 * @category filesystem
 * @since 0.0.0
 */
export const renameOrFail: {
  <E>(
    sourcePath: string,
    targetPath: string,
    options: RenameOrFailOptions<E>
  ): Effect.Effect<void, E, FileSystem.FileSystem>;
  <E>(
    targetPath: string,
    options: RenameOrFailOptions<E>
  ): (sourcePath: string) => Effect.Effect<void, E, FileSystem.FileSystem>;
} = dual(
  3,
  <E>(
    sourcePath: string,
    targetPath: string,
    options: RenameOrFailOptions<E>
  ): Effect.Effect<void, E, FileSystem.FileSystem> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs
        .rename(sourcePath, targetPath)
        .pipe(Effect.mapError((cause) => options.onError(cause, sourcePath, targetPath)));
    }).pipe(Effect.withSpan("RepoCli.FsGuards.renameOrFail"))
);
