/**
 * Shared, error-parameterised filesystem guards and hashing helpers for
 * repo-cli command services.
 *
 * **Details**
 *
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

import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { Defect, LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { A, pipe, Str } from "@beep/utils";
import { Effect, FileSystem, HashSet, MutableHashSet, Path } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { Sha256Hex } from "@beep/schema";
import type * as Crypto from "effect/Crypto";

const $I = $RepoCliId.create("internal/cli/FsGuards");

const decodeSha256FromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);

const FsGuardFailureReason = LiteralKit([
  "outside-root",
  "symlink",
  "root-not-directory",
  "parent-not-directory",
  "target-not-file",
  "filesystem-failure",
]).pipe(
  $I.annoteSchema("FsGuardFailureReason", {
    description: "Why a contained filesystem read or write was refused.",
  })
);

class ContainedTarget extends S.Class<ContainedTarget>($I`ContainedTarget`)(
  {
    parent: S.NonEmptyString,
    root: S.NonEmptyString,
    target: S.NonEmptyString,
  },
  $I.annote("ContainedTarget", {
    description: "Resolved root, parent, and target paths for one contained filesystem operation.",
  })
) {}

/**
 * Typed refusal from a root-contained, no-follow filesystem operation.
 *
 * **Details**
 *
 * The error identifies the allowed root, requested target, path entry that
 * failed inspection, and a stable failure reason. A platform cause is kept
 * when the refusal came from the filesystem rather than path policy.
 *
 * **Example** (Inspect the error tag)
 *
 * ```ts
 * import { FsGuardError } from "@beep/repo-cli/test/Cli"
 * import * as O from "effect/Option"
 *
 * const error = FsGuardError.make({
 *   cause: O.none(),
 *   message: "refused",
 *   path: "/repo/link",
 *   reason: "symlink",
 *   root: "/repo",
 *   target: "/repo/link"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FsGuardError extends S.TaggedError<FsGuardError>($I`FsGuardError`)(
  "FsGuardError",
  {
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true })),
    message: S.String,
    path: S.String,
    reason: FsGuardFailureReason,
    root: S.String,
    target: S.String,
  },
  $I.annoteError<FsGuardError>("FsGuardError", {
    description: "Typed refusal from a root-contained filesystem operation that never accepts symlink entries.",
  })
) {}

/**
 * Result of a contained string read without following path symlinks.
 *
 * **Details**
 *
 * `exists` distinguishes a missing target from an entry that exists but
 * cannot be read as a text file. `contents` is `None` for either case.
 *
 * **Example** (Represent a missing file)
 *
 * ```ts
 * import { ContainedFileRead } from "@beep/repo-cli/test/Cli"
 * import * as O from "effect/Option"
 *
 * const result = ContainedFileRead.make({ exists: false, contents: O.none() })
 * console.log(result.exists)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContainedFileRead extends S.Class<ContainedFileRead>($I`ContainedFileRead`)(
  {
    contents: S.Option(S.String),
    exists: S.Boolean,
  },
  $I.annote("ContainedFileRead", {
    description: "Existence and optional text content from a contained no-follow file read.",
  })
) {}

const fsGuardError = (
  root: string,
  target: string,
  entryPath: string,
  reason: typeof FsGuardFailureReason.Type,
  message: string,
  cause?: unknown
): FsGuardError =>
  FsGuardError.make({
    cause: O.fromUndefinedOr(cause),
    message,
    path: entryPath,
    reason,
    root,
    target,
  });

const inspectEntryNoFollow = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  root: string,
  target: string,
  entryPath: string
): Effect.fn.Return<O.Option<FileSystem.File.Type>, FsGuardError> {
  const link = yield* fs.readLink(entryPath).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (link) {
    return O.some("SymbolicLink");
  }

  return yield* fs.stat(entryPath).pipe(
    Effect.map((info) => O.some(info.type)),
    Effect.catch((cause) =>
      Eq.equals(cause.reason._tag, "NotFound")
        ? Effect.succeed(O.none<FileSystem.File.Type>())
        : Effect.fail(
            fsGuardError(
              root,
              target,
              entryPath,
              "filesystem-failure",
              `Failed to inspect filesystem entry "${entryPath}" without following links.`,
              cause
            )
          )
    )
  );
});

const failForSymlink = (root: string, target: string, entryPath: string): Effect.Effect<never, FsGuardError> =>
  Effect.fail(
    fsGuardError(
      root,
      target,
      entryPath,
      "symlink",
      `Refused filesystem access because "${entryPath}" is a symbolic link beneath "${root}".`
    )
  );

const requireDirectory = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  root: string,
  target: string,
  directory: string,
  reason: "root-not-directory" | "parent-not-directory"
): Effect.fn.Return<void, FsGuardError> {
  const kind = yield* inspectEntryNoFollow(fs, root, target, directory);
  if (O.isSome(kind) && Eq.equals(kind.value, "SymbolicLink")) {
    return yield* failForSymlink(root, target, directory);
  }
  if (O.isNone(kind) || !Eq.equals(kind.value, "Directory")) {
    return yield* fsGuardError(
      root,
      target,
      directory,
      reason,
      `Required directory "${directory}" is missing or is not a directory.`
    );
  }
});

const ensureParentDirectory = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  prepared: ContainedTarget,
  directory: string,
  createMissing: boolean
): Effect.fn.Return<boolean, FsGuardError> {
  const kind = yield* inspectEntryNoFollow(fs, prepared.root, prepared.target, directory);
  if (O.isSome(kind)) {
    if (Eq.equals(kind.value, "SymbolicLink")) {
      return yield* failForSymlink(prepared.root, prepared.target, directory);
    }
    if (!Eq.equals(kind.value, "Directory")) {
      return yield* fsGuardError(
        prepared.root,
        prepared.target,
        directory,
        "parent-not-directory",
        `Refused filesystem access because parent entry "${directory}" is not a directory.`
      );
    }
    return true;
  }
  if (!createMissing) {
    return false;
  }
  yield* fs
    .makeDirectory(directory)
    .pipe(
      Effect.mapError((cause) =>
        fsGuardError(
          prepared.root,
          prepared.target,
          directory,
          "filesystem-failure",
          `Failed to create contained directory "${directory}".`,
          cause
        )
      )
    );
  yield* requireDirectory(fs, prepared.root, prepared.target, directory, "parent-not-directory");
  return true;
});

const ensureParentDirectories = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  prepared: ContainedTarget,
  createMissing: boolean
): Effect.fn.Return<boolean, FsGuardError> {
  const relative = path.relative(prepared.root, prepared.parent);
  const segments = A.filter(Str.split(relative, path.sep), Str.isNonEmpty);
  let current = prepared.root;

  for (const segment of segments) {
    current = path.join(current, segment);
    const ready = yield* ensureParentDirectory(fs, prepared, current, createMissing);
    if (!ready) {
      return false;
    }
  }

  return true;
});

const prepareContainedTarget = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  expectedRoot: string,
  requestedTarget: string,
  createParents: boolean
): Effect.fn.Return<O.Option<ContainedTarget>, FsGuardError> {
  const root = path.resolve(expectedRoot);
  const target = path.resolve(root, requestedTarget);
  if (!isResolvedPathWithinRoot(path, { root, candidate: target }) || Eq.equals(root, target)) {
    return yield* fsGuardError(
      root,
      target,
      target,
      "outside-root",
      `Refused filesystem access because "${target}" is not a file path contained by "${root}".`
    );
  }

  yield* requireDirectory(fs, root, target, root, "root-not-directory");
  const parent = path.dirname(target);
  const prepared = ContainedTarget.make({ parent, root, target });
  const parentReady = yield* ensureParentDirectories(fs, path, prepared, createParents);
  if (!parentReady) {
    return O.none();
  }

  const canonicalRoot = yield* fs
    .realPath(root)
    .pipe(
      Effect.mapError((cause) =>
        fsGuardError(root, target, root, "filesystem-failure", `Failed to canonicalize allowed root "${root}".`, cause)
      )
    );
  const canonicalParent = yield* fs
    .realPath(parent)
    .pipe(
      Effect.mapError((cause) =>
        fsGuardError(
          root,
          target,
          parent,
          "filesystem-failure",
          `Failed to canonicalize target parent "${parent}".`,
          cause
        )
      )
    );
  if (!isResolvedPathWithinRoot(path, { root: canonicalRoot, candidate: canonicalParent })) {
    return yield* fsGuardError(
      root,
      target,
      parent,
      "outside-root",
      `Refused filesystem access because parent "${canonicalParent}" escapes allowed root "${canonicalRoot}".`
    );
  }

  return O.some(prepared);
});

const requirePreparedContainedTarget = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  expectedRoot: string,
  target: string
): Effect.fn.Return<ContainedTarget, FsGuardError> {
  const prepared = yield* prepareContainedTarget(fs, path, expectedRoot, target, true);
  if (O.isSome(prepared)) {
    return prepared.value;
  }

  const root = path.resolve(expectedRoot);
  const resolvedTarget = path.resolve(expectedRoot, target);
  return yield* fsGuardError(
    root,
    resolvedTarget,
    path.dirname(resolvedTarget),
    "parent-not-directory",
    `Target parent for "${target}" could not be prepared.`
  );
});

const requireWritableTarget = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  prepared: ContainedTarget
): Effect.fn.Return<void, FsGuardError> {
  const kind = yield* inspectEntryNoFollow(fs, prepared.root, prepared.target, prepared.target);
  if (O.isNone(kind) || Eq.equals(kind.value, "File")) {
    return;
  }
  if (Eq.equals(kind.value, "SymbolicLink")) {
    return yield* failForSymlink(prepared.root, prepared.target, prepared.target);
  }
  return yield* fsGuardError(
    prepared.root,
    prepared.target,
    prepared.target,
    "target-not-file",
    `Refused filesystem write because target "${prepared.target}" is not a regular file.`
  );
});

const writePreparedFileString = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  prepared: ContainedTarget,
  contents: string
): Effect.fn.Return<string, FsGuardError> {
  yield* requireWritableTarget(fs, prepared);

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const temporaryPath = yield* fs
        .makeTempFileScoped({ directory: prepared.parent, prefix: `.${path.basename(prepared.target)}.safe-write-` })
        .pipe(
          Effect.mapError((cause) =>
            fsGuardError(
              prepared.root,
              prepared.target,
              prepared.parent,
              "filesystem-failure",
              `Failed to allocate a temporary file beneath "${prepared.parent}".`,
              cause
            )
          )
        );
      yield* fs
        .writeFileString(temporaryPath, contents)
        .pipe(
          Effect.mapError((cause) =>
            fsGuardError(
              prepared.root,
              prepared.target,
              temporaryPath,
              "filesystem-failure",
              `Failed to write temporary file "${temporaryPath}".`,
              cause
            )
          )
        );

      const checked = yield* prepareContainedTarget(fs, path, prepared.root, prepared.target, false);
      if (O.isNone(checked)) {
        return yield* fsGuardError(
          prepared.root,
          prepared.target,
          prepared.parent,
          "parent-not-directory",
          `Target parent "${prepared.parent}" disappeared before the guarded write could commit.`
        );
      }
      yield* requireWritableTarget(fs, checked.value);
      yield* fs
        .rename(temporaryPath, checked.value.target)
        .pipe(
          Effect.mapError((cause) =>
            fsGuardError(
              checked.value.root,
              checked.value.target,
              checked.value.target,
              "filesystem-failure",
              `Failed to atomically replace contained target "${checked.value.target}".`,
              cause
            )
          )
        );
      return checked.value.target;
    })
  );
});

const makeContainedFileStringOperation = (
  name: string,
  operation: (
    fs: FileSystem.FileSystem,
    path: Path.Path,
    prepared: ContainedTarget,
    contents: string
  ) => Effect.Effect<string, FsGuardError>
) =>
  Effect.fn(name)(function* (
    expectedRoot: string,
    target: string,
    contents: string
  ): Effect.fn.Return<string, FsGuardError, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const prepared = yield* requirePreparedContainedTarget(fs, path, expectedRoot, target);
    return yield* operation(fs, path, prepared, contents);
  });

/**
 * Write text atomically to a symlink-free path contained by an expected root.
 *
 * **Details**
 *
 * The guard rejects lexical escapes, symlinked parent entries, and a symlink
 * at the final target. Missing parents are created one component at a time,
 * then the content is written to a private temporary file beside the target
 * and promoted with an atomic rename.
 *
 * **Gotchas**
 *
 * Effect's portable filesystem API has no directory-handle-relative rename.
 * The helper rechecks the path immediately before promotion, but callers that
 * grant another principal concurrent rename access to the destination still
 * need an operating-system permission boundary.
 *
 * **Example** (Build a guarded write)
 *
 * ```ts
 * import { writeContainedFileString } from "@beep/repo-cli/test/Cli"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(writeContainedFileString("/repo", "/repo/report.txt", "ready\n")))
 * ```
 *
 * @param expectedRoot - Root that owns the write authority.
 * @param target - Absolute or root-relative target path.
 * @param contents - Complete text to replace the target with.
 * @returns The resolved target path after the atomic write.
 * @category filesystem
 * @since 0.0.0
 */
export const writeContainedFileString = makeContainedFileStringOperation(
  "RepoCli.FsGuards.writeContainedFileString",
  writePreparedFileString
);

const appendPreparedFileString = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  prepared: ContainedTarget,
  contents: string
): Effect.fn.Return<string, FsGuardError> {
  let kind = yield* inspectEntryNoFollow(fs, prepared.root, prepared.target, prepared.target);
  if (O.isNone(kind)) {
    const created = yield* fs.writeFileString(prepared.target, contents, { flag: "ax" }).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (cause) =>
        Eq.equals(cause.reason._tag, "AlreadyExists")
          ? Effect.succeed(false)
          : Effect.fail(
              fsGuardError(
                prepared.root,
                prepared.target,
                prepared.target,
                "filesystem-failure",
                `Failed to exclusively create append target "${prepared.target}".`,
                cause
              )
            )
      )
    );
    if (created) {
      return prepared.target;
    }
    kind = yield* inspectEntryNoFollow(fs, prepared.root, prepared.target, prepared.target);
  }
  if (O.isSome(kind) && Eq.equals(kind.value, "SymbolicLink")) {
    return yield* failForSymlink(prepared.root, prepared.target, prepared.target);
  }
  if (O.isNone(kind) || !Eq.equals(kind.value, "File")) {
    return yield* fsGuardError(
      prepared.root,
      prepared.target,
      prepared.target,
      "target-not-file",
      `Refused filesystem append because target "${prepared.target}" is not a regular file.`
    );
  }

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const temporaryDirectory = yield* fs
        .makeTempDirectoryScoped({
          directory: prepared.parent,
          prefix: `.${path.basename(prepared.target)}.safe-append-`,
        })
        .pipe(
          Effect.mapError((cause) =>
            fsGuardError(
              prepared.root,
              prepared.target,
              prepared.parent,
              "filesystem-failure",
              `Failed to allocate a temporary directory beneath "${prepared.parent}".`,
              cause
            )
          )
        );
      const checked = yield* prepareContainedTarget(fs, path, prepared.root, prepared.target, false);
      if (O.isNone(checked)) {
        return yield* fsGuardError(
          prepared.root,
          prepared.target,
          prepared.parent,
          "parent-not-directory",
          `Target parent "${prepared.parent}" disappeared before the guarded append could commit.`
        );
      }
      yield* requireWritableTarget(fs, checked.value);
      const aliasPath = path.join(temporaryDirectory, "target");
      yield* fs
        .link(checked.value.target, aliasPath)
        .pipe(
          Effect.mapError((cause) =>
            fsGuardError(
              checked.value.root,
              checked.value.target,
              aliasPath,
              "filesystem-failure",
              `Failed to create a no-follow alias for append target "${checked.value.target}".`,
              cause
            )
          )
        );
      const aliasKind = yield* inspectEntryNoFollow(fs, checked.value.root, checked.value.target, aliasPath);
      if (O.isNone(aliasKind) || !Eq.equals(aliasKind.value, "File")) {
        return yield* fsGuardError(
          checked.value.root,
          checked.value.target,
          aliasPath,
          O.exists(aliasKind, (entryKind) => Eq.equals(entryKind, "SymbolicLink")) ? "symlink" : "target-not-file",
          `Refused filesystem append because alias "${aliasPath}" is not a regular file.`
        );
      }
      yield* fs
        .writeFileString(aliasPath, contents, { flag: "a" })
        .pipe(
          Effect.mapError((cause) =>
            fsGuardError(
              checked.value.root,
              checked.value.target,
              aliasPath,
              "filesystem-failure",
              `Failed to append through no-follow alias "${aliasPath}".`,
              cause
            )
          )
        );
      return checked.value.target;
    })
  );
});

/**
 * Append text through the contained no-follow write path.
 *
 * **Details**
 *
 * A missing target is created with exclusive append mode, which refuses a
 * pre-existing symlink. For an existing regular file, the helper creates a
 * private hard-link alias beside the target, verifies that alias is still a
 * regular file, and appends through it. The append never opens the predictable
 * target pathname.
 *
 * **Gotchas**
 *
 * Effect's portable filesystem API has no directory-handle-relative link.
 * The parent and target are rechecked immediately before alias creation, but
 * an operating-system permission boundary is still required against a
 * principal that can concurrently rename parent entries.
 *
 * **Example** (Build a guarded append)
 *
 * ```ts
 * import { appendContainedFileString } from "@beep/repo-cli/test/Cli"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(appendContainedFileString("/repo", "/repo/events.ndjson", "{}\n")))
 * ```
 *
 * @param expectedRoot - Root that owns the append authority.
 * @param target - Absolute or root-relative target path.
 * @param contents - Text to append.
 * @returns The resolved target path after the atomic replacement.
 * @category filesystem
 * @since 0.0.0
 */
export const appendContainedFileString = makeContainedFileStringOperation(
  "RepoCli.FsGuards.appendContainedFileString",
  appendPreparedFileString
);

/**
 * Read text from a contained path while rejecting symlinked entries.
 *
 * **Details**
 *
 * Missing parents or targets return `exists: false`. Existing entries that
 * are not readable text files return `exists: true` with no contents, while a
 * symlink at any traversed component fails with {@link FsGuardError}.
 *
 * **Example** (Build a guarded read)
 *
 * ```ts
 * import { readContainedFileStringNoFollow } from "@beep/repo-cli/test/Cli"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readContainedFileStringNoFollow("/repo", "/repo/receipt.json")))
 * ```
 *
 * @param expectedRoot - Root that owns the read authority.
 * @param target - Absolute or root-relative target path.
 * @returns Existence plus optional text contents.
 * @category filesystem
 * @since 0.0.0
 */
export const readContainedFileStringNoFollow = Effect.fn("RepoCli.FsGuards.readContainedFileStringNoFollow")(function* (
  expectedRoot: string,
  target: string
): Effect.fn.Return<ContainedFileRead, FsGuardError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const prepared = yield* prepareContainedTarget(fs, path, expectedRoot, target, false);
  if (O.isNone(prepared)) {
    return ContainedFileRead.make({ contents: O.none(), exists: false });
  }

  const kind = yield* inspectEntryNoFollow(fs, prepared.value.root, prepared.value.target, prepared.value.target);
  if (O.isNone(kind)) {
    return ContainedFileRead.make({ contents: O.none(), exists: false });
  }
  if (Eq.equals(kind.value, "SymbolicLink")) {
    return yield* failForSymlink(prepared.value.root, prepared.value.target, prepared.value.target);
  }
  const contents = Eq.equals(kind.value, "File")
    ? yield* Effect.option(fs.readFileString(prepared.value.target))
    : O.none<string>();
  return ContainedFileRead.make({ contents, exists: true });
});

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
 * **Example** (Dual call signature equality)
 *
 * ```ts
 * import { bytesEqual } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * console.log(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])))
 * console.log(bytesEqual(new Uint8Array([2]))(new Uint8Array([1])))
 * ```
 *
 * @param left - The first byte array.
 * @param right - The second byte array.
 * @returns `true` when both arrays have identical length and contents.
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
 * **Example** (Skip duplicate digests)
 *
 * ```ts
 * import { dedupeBySha256 } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const result = dedupeBySha256([{ sha256: "a" }, { sha256: "a" }, { sha256: "b" }])
 * console.log(result.duplicatesSkipped)
 * ```
 *
 * @param records - The records to deduplicate by digest.
 * @returns The first record per digest and the number skipped.
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
 * Allocate a filesystem name that does not collide case-insensitively with an
 * in-use set, suffixing `_NN` on collision.
 *
 * **Example** (Suffix on name collision)
 *
 * ```ts
 * import { HashSet } from "effect"
 * import { allocateUniqueName } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const first = allocateUniqueName("photo", ".webp", HashSet.make("photo.webp"))
 * console.log(first.targetName)
 * ```
 *
 * @param stem - The base file name without extension.
 * @param extension - The extension (including any leading dot) to append.
 * @param usedNames - The set of already-allocated names.
 * @returns The free name and the set updated to include it.
 * @category naming
 * @since 0.0.0
 */
export const allocateUniqueName: {
  (stem: string, extension: string, usedNames: HashSet.HashSet<string>): UniqueNameAllocation;
  (extension: string, usedNames: HashSet.HashSet<string>): (stem: string) => UniqueNameAllocation;
} = dual(3, (stem: string, extension: string, usedNames: HashSet.HashSet<string>): UniqueNameAllocation => {
  let suffix = 0;
  let targetName = `${stem}${extension}`;
  const normalizedUsedNames = HashSet.map(usedNames, Str.toLowerCase);

  while (HashSet.has(normalizedUsedNames, Str.toLowerCase(targetName))) {
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
 * **Details**
 *
 * Reads the whole file and decodes through the `Sha256HexFromBytes` schema,
 * so it requires `Crypto.Crypto`. The returned digest is the bare hex string;
 * callers that persist a `sha256:` prefix add it themselves.
 *
 * **Example** (Dual hashing call signatures)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { hashFileSha256 } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const onError = (cause: unknown) => new Error(`hash failed: ${cause}`)
 * console.log(Effect.isEffect(hashFileSha256("/tmp/example.txt", onError)))
 * console.log(Effect.isEffect(hashFileSha256(onError)("/tmp/example.txt")))
 * ```
 *
 * @param filePath - The file to hash.
 * @param onError - Builds the caller's error from a read or hashing failure.
 * @returns The lowercase hex digest of the file's contents.
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
 * **Example** (Reject traversal segments)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { validatePathSegment } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const options = { onInvalid: (label: string, value: string) => new Error(`${label}: ${value}`) }
 * console.log(Effect.isEffect(validatePathSegment("source", "..", options)))
 * console.log(Effect.isEffect(validatePathSegment("..", options)("source")))
 * ```
 *
 * @param label - The caller-facing label for the segment.
 * @param value - The candidate segment.
 * @param options - Bundle carrying `onInvalid`, which builds the caller's error.
 * @returns A void effect, failing when `value` is `.`, `..`, or contains a
 *   path separator.
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
 * **Example** (Dual directory validation)
 *
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
 *
 * @param dir - The directory path to validate.
 * @param errors - Constructors for the stat, non-directory, and realpath
 *   failures.
 * @returns The resolved and canonical directory paths.
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
 * **Example** (Refuse overwrite without flag)
 *
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
 *
 * @param filePath - The output path to preflight.
 * @param options - Overwrite flag, description, and the inspect/refuse/stat/
 *   non-file error constructors.
 * @returns A void effect that fails when the write would be refused.
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
 * **Example** (Dual rename call signatures)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { renameOrFail } from "@beep/repo-cli/internal/cli/FsGuards"
 *
 * const options = { onError: (cause: unknown) => new Error(`rename: ${cause}`) }
 * console.log(Effect.isEffect(renameOrFail("/tmp/a", "/tmp/b", options)))
 * console.log(Effect.isEffect(renameOrFail("/tmp/b", options)("/tmp/a")))
 * ```
 *
 * @param sourcePath - The current path.
 * @param targetPath - The destination path.
 * @param options - Bundle carrying `onError`, which builds the caller's error.
 * @returns A void effect that fails when the rename cannot complete.
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
