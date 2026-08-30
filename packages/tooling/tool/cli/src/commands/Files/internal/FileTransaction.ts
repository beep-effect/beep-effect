/**
 * Shared filesystem transaction primitives for internal file commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";

const $I = $RepoCliId.create("commands/Files/internal/FileTransaction");

const targetCandidateExists = Effect.fn("Files.targetCandidateExists")(function* (
  candidate: string,
  description: string
): Effect.fn.Return<boolean, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const isSymbolicLink = yield* fs.readLink(candidate).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (isSymbolicLink) return true;
  return yield* fs
    .exists(candidate)
    .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to inspect ${description}`, candidate, { cause })));
});

/**
 * Mutable transaction state for one staged file and its optional prior target.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class StagedFileCommitRecord extends S.Class<StagedFileCommitRecord>($I`StagedFileCommitRecord`)(
  {
    backedUp: S.Boolean.pipe(S.mutableKey),
    backupPath: S.String,
    committed: S.Boolean.pipe(S.mutableKey),
    description: S.String,
    stagedPath: S.String,
    targetPath: S.String,
  },
  $I.annote("StagedFileCommitRecord", {
    description: "Mutable commit progress and immutable paths for one staged filesystem replacement.",
  })
) {}

/**
 * Resolves a target through its nearest existing ancestor without creating it.
 *
 * **Example** (Prepare target canonicalization)
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * const operation = canonicalizeFileTargetPath("/tmp/report.json", "report path")
 * console.log(Effect.isEffect(operation))
 * // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const canonicalizeFileTargetPath = Effect.fn("Files.canonicalizeFileTargetPath")(function* (
  targetPath: string,
  description: string
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolvedTarget = path.resolve(targetPath);
  let candidate = resolvedTarget;

  while (true) {
    const exists = yield* targetCandidateExists(candidate, description);
    if (exists) {
      const canonicalCandidate = yield* fs
        .realPath(candidate)
        .pipe(
          Effect.mapError((cause) => formatPlatformError(`Failed to resolve ${description}`, candidate, { cause }))
        );
      const relativeSuffix = path.relative(candidate, resolvedTarget);
      return relativeSuffix === "" ? canonicalCandidate : path.resolve(canonicalCandidate, relativeSuffix);
    }

    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return yield* FilesCommandError.make({
        message: `Failed to find an existing ancestor for ${description} "${resolvedTarget}".`,
      });
    }
    candidate = parent;
  }
});

/**
 * Moves an existing target into a staged transaction's backup slot.
 *
 * **Example** (Prepare a backup operation)
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * const operation = backupStagedFileTarget({
 *   backedUp: false,
 *   backupPath: "/tmp/previous",
 *   committed: false,
 *   description: "report",
 *   stagedPath: "/tmp/staged",
 *   targetPath: "/tmp/report.json",
 * })
 * console.log(Effect.isEffect(operation))
 * // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const backupStagedFileTarget = Effect.fn("Files.backupStagedFileTarget")(function* (
  record: StagedFileCommitRecord
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.uninterruptible(
    Effect.gen(function* () {
      yield* fs
        .rename(record.targetPath, record.backupPath)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError(`Failed to back up existing ${record.description}`, record.targetPath, { cause })
          )
        );
      record.backedUp = true;
    })
  );
});

/**
 * Atomically moves a staged file into its final target and records the commit.
 *
 * **Example** (Prepare a staged rename)
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * const operation = commitStagedFileByRename(
 *   {
 *     backedUp: false,
 *     backupPath: "/tmp/previous",
 *     committed: false,
 *     description: "report",
 *     stagedPath: "/tmp/staged",
 *     targetPath: "/tmp/report.json",
 *   },
 *   "Failed to commit",
 * )
 * console.log(Effect.isEffect(operation))
 * // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const commitStagedFileByRename = Effect.fn("Files.commitStagedFileByRename")(function* (
  record: StagedFileCommitRecord,
  failureAction: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.uninterruptible(
    Effect.gen(function* () {
      yield* fs
        .rename(record.stagedPath, record.targetPath)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError(`${failureAction} ${record.description}`, record.targetPath, { cause })
          )
        );
      record.committed = true;
    })
  );
});
