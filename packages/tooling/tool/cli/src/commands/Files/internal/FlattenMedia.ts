/**
 * Recursive media flattening planning and mutation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isPathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { walkFiles } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Cause, Console, Effect, Exit, FileSystem, HashSet, Path } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { allocateUniqueName } from "../../../internal/cli/FsGuards.ts";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";
import { hasSkippedFiles, mediaKindFromExtension } from "../Files.media.ts";
import { decodeFlattenMediaOptions, FlattenMediaSummary } from "./FlattenMedia.schemas.ts";
import { validateDirectory } from "./Validation.ts";
import type { FlattenMediaOptions } from "./FlattenMedia.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/FlattenMedia");

class FlattenMediaTarget extends S.Class<FlattenMediaTarget>($I`FlattenMediaTarget`)(
  {
    canonicalDirectory: S.String,
    destinationDevice: S.Finite,
    destinationExisted: S.Boolean,
    directory: S.String,
  },
  $I.annote("FlattenMediaTarget", {
    description: "Resolved flatten-media destination with its canonical path and filesystem device.",
  })
) {}

class FlattenMediaDirectories extends S.Class<FlattenMediaDirectories>($I`FlattenMediaDirectories`)(
  {
    destinationDevice: S.Finite,
    destinationDirectory: S.String,
    destinationExisted: S.Boolean,
    sourceDirectory: S.String,
  },
  $I.annote("FlattenMediaDirectories", {
    description: "Validated, non-overlapping source and destination directories for flatten-media.",
  })
) {}

class FlattenMediaPlanEntry extends S.Class<FlattenMediaPlanEntry>($I`FlattenMediaPlanEntry`)(
  {
    sourcePath: S.String,
    sourceRelativePath: S.String,
    targetName: S.String,
    targetPath: S.String,
  },
  $I.annote("FlattenMediaPlanEntry", {
    description: "One recursive media source paired with its collision-safe flat destination.",
  })
) {}

class FlattenMediaPlan extends S.Class<FlattenMediaPlan>($I`FlattenMediaPlan`)(
  {
    collisionCount: S.Finite,
    destinationDevice: S.Finite,
    destinationDirectory: S.String,
    destinationExisted: S.Boolean,
    entries: S.Array(FlattenMediaPlanEntry),
    skippedCount: S.Finite,
    sourceDirectory: S.String,
  },
  $I.annote("FlattenMediaPlan", {
    description: "Deterministic recursive media move plan and its preflight metadata.",
  })
) {}

const canonicalizeFlattenMediaTarget = Effect.fn("Files.canonicalizeFlattenMediaTarget")(function* (
  outDir: string
): Effect.fn.Return<FlattenMediaTarget, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.resolve(outDir);
  let candidate = directory;

  while (true) {
    const exists = yield* fs
      .exists(candidate)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect flatten-media output path", candidate, { cause })
        )
      );

    if (exists) {
      const info = yield* fs
        .stat(candidate)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to stat flatten-media output path", candidate, { cause })
          )
        );

      if (!Eq.equals(info.type, "Directory")) {
        return yield* FilesCommandError.make({
          message: `Expected --out-dir and its existing ancestors to be directories: "${candidate}"`,
        });
      }

      const canonicalCandidate = yield* fs
        .realPath(candidate)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to resolve flatten-media output path", candidate, { cause })
          )
        );
      const relativeSuffix = path.relative(candidate, directory);

      return FlattenMediaTarget.make({
        canonicalDirectory: Str.equivalence(relativeSuffix, "")
          ? canonicalCandidate
          : path.resolve(canonicalCandidate, relativeSuffix),
        destinationDevice: info.dev,
        destinationExisted: Str.equivalence(candidate, directory),
        directory,
      });
    }

    const parent = path.dirname(candidate);
    if (Str.equivalence(parent, candidate)) {
      return yield* FilesCommandError.make({
        message: `Failed to find an existing ancestor for --out-dir "${directory}".`,
      });
    }
    candidate = parent;
  }
});

const validateFlattenMediaDirectories = Effect.fn("Files.validateFlattenMediaDirectories")(function* (
  options: FlattenMediaOptions
): Effect.fn.Return<FlattenMediaDirectories, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const { canonicalDir, directory } = yield* validateDirectory(options.dir);
  const target = yield* canonicalizeFlattenMediaTarget(options.outDir);

  if (
    isPathWithinRoot(canonicalDir, target.canonicalDirectory) ||
    isPathWithinRoot(target.canonicalDirectory, canonicalDir)
  ) {
    return yield* FilesCommandError.make({
      message: `Refusing to flatten media across overlapping source/output trees: "${directory}" and "${target.directory}"`,
    });
  }

  return FlattenMediaDirectories.make({
    destinationDevice: target.destinationDevice,
    destinationDirectory: target.directory,
    destinationExisted: target.destinationExisted,
    sourceDirectory: directory,
  });
});

const buildFlattenMediaPlan = Effect.fn("Files.buildFlattenMediaPlan")(function* (
  directories: FlattenMediaDirectories
): Effect.fn.Return<FlattenMediaPlan, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const existingNames = directories.destinationExisted
    ? yield* fs.readDirectory(directories.destinationDirectory).pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to read flatten-media output directory", directories.destinationDirectory, {
            cause,
          })
        )
      )
    : A.empty<string>();
  const sourcePaths = yield* walkFiles(directories.sourceDirectory, {
    symlinkGuard: "skip-symlinks",
  }).pipe(
    Effect.mapError((cause) =>
      FilesCommandError.new(cause, `Failed to recursively scan "${directories.sourceDirectory}" for media files.`)
    )
  );
  let collisionCount = 0;
  let entries = A.empty<FlattenMediaPlanEntry>();
  let skippedCount = 0;
  let usedNames = HashSet.fromIterable(existingNames);

  for (const sourcePath of sourcePaths) {
    const sourceName = path.basename(sourcePath);
    const extension = path.extname(sourceName);
    const mediaKind = mediaKindFromExtension(extension);

    if (O.isNone(mediaKind)) {
      skippedCount += 1;
      continue;
    }

    const allocation = allocateUniqueName(path.basename(sourceName, extension), extension, usedNames);
    usedNames = allocation.usedTargetNames;
    if (!Str.equivalence(sourceName, allocation.targetName)) {
      collisionCount += 1;
    }

    entries = A.append(
      entries,
      FlattenMediaPlanEntry.make({
        sourcePath,
        sourceRelativePath: path.relative(directories.sourceDirectory, sourcePath),
        targetName: allocation.targetName,
        targetPath: path.join(directories.destinationDirectory, allocation.targetName),
      })
    );
  }

  return FlattenMediaPlan.make({
    collisionCount,
    destinationDevice: directories.destinationDevice,
    destinationDirectory: directories.destinationDirectory,
    destinationExisted: directories.destinationExisted,
    entries,
    skippedCount,
    sourceDirectory: directories.sourceDirectory,
  });
});

const ensureFlattenMediaTargetAvailable = Effect.fn("Files.ensureFlattenMediaTargetAvailable")(function* (
  targetPath: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(targetPath)
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to inspect flatten-media target", targetPath, { cause }))
    );

  if (exists) {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite an existing flatten-media target: "${targetPath}"`,
    });
  }
});

const preflightFlattenMediaPlan = Effect.fn("Files.preflightFlattenMediaPlan")(function* (
  plan: FlattenMediaPlan
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;

  for (const entry of plan.entries) {
    const info = yield* fs
      .stat(entry.sourcePath)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to stat flatten-media source file", entry.sourcePath, { cause })
        )
      );

    if (!Eq.equals(info.type, "File")) {
      return yield* FilesCommandError.make({
        message: `Expected flatten-media source to remain a regular file: "${entry.sourcePath}"`,
      });
    }

    if (!Eq.equals(info.dev, plan.destinationDevice)) {
      return yield* FilesCommandError.make({
        message: `Cannot move "${entry.sourcePath}" to "${plan.destinationDirectory}" with rename-only semantics because they are on different filesystems.`,
      });
    }

    yield* ensureFlattenMediaTargetAvailable(entry.targetPath);
  }
});

const renderFlattenMediaCause = (cause: Cause.Cause<FilesCommandError>): string => {
  const error = Cause.findErrorOption(cause);
  return O.isSome(error) ? error.value.message : Cause.pretty(cause);
};

const moveFlattenMediaPath = Effect.fn("Files.moveFlattenMediaPath")(function* (
  sourcePath: string,
  targetPath: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .rename(sourcePath, targetPath)
    .pipe(
      Effect.mapError((cause) =>
        FilesCommandError.new(cause, `Failed to move flatten-media source "${sourcePath}" to "${targetPath}".`)
      )
    );
});

const moveFlattenMediaEntry = Effect.fn("Files.moveFlattenMediaEntry")(function* (
  entry: FlattenMediaPlanEntry
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  yield* ensureFlattenMediaTargetAvailable(entry.targetPath);
  yield* moveFlattenMediaPath(entry.sourcePath, entry.targetPath);
});

const rollbackFlattenMediaEntries = Effect.fn("Files.rollbackFlattenMediaEntries")(function* (
  completed: ReadonlyArray<FlattenMediaPlanEntry>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem> {
  let failures = A.empty<string>();

  for (const entry of A.reverse(completed)) {
    const restored = yield* Effect.exit(
      ensureFlattenMediaTargetAvailable(entry.sourcePath).pipe(
        Effect.andThen(moveFlattenMediaPath(entry.targetPath, entry.sourcePath))
      )
    );

    if (Exit.isFailure(restored)) {
      failures = A.append(failures, renderFlattenMediaCause(restored.cause));
    }
  }

  return failures;
});

const createFlattenMediaDestination = Effect.fn("Files.createFlattenMediaDestination")(function* (
  plan: FlattenMediaPlan
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  if (plan.destinationExisted) {
    return;
  }

  yield* fs.makeDirectory(path.dirname(plan.destinationDirectory), { recursive: true }).pipe(
    Effect.mapError((cause) =>
      formatPlatformError("Failed to create flatten-media output parent directory", plan.destinationDirectory, {
        cause,
      })
    )
  );

  const created = yield* Effect.exit(
    fs.makeDirectory(plan.destinationDirectory).pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create flatten-media output directory", plan.destinationDirectory, {
          cause,
        })
      )
    )
  );

  if (Exit.isFailure(created)) {
    const inspected = yield* Effect.exit(
      fs.stat(plan.destinationDirectory).pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect concurrently created output directory", plan.destinationDirectory, {
            cause,
          })
        )
      )
    );

    if (Exit.isSuccess(inspected) && Eq.equals(inspected.value.type, "Directory")) {
      return;
    }

    return yield* Effect.failCause(created.cause);
  }
});

const flattenMediaRecoveryMessage = (
  completed: ReadonlyArray<FlattenMediaPlanEntry>,
  recoveryFailures: ReadonlyArray<string>
): string => {
  if (A.isReadonlyArrayNonEmpty(recoveryFailures)) {
    return `Rollback incomplete: ${A.join("; ")(recoveryFailures)}`;
  }
  return A.isReadonlyArrayNonEmpty(completed)
    ? "Completed moves were restored."
    : "No earlier moves required rollback.";
};

const recoverFlattenMediaFailure = Effect.fn("Files.recoverFlattenMediaFailure")(function* (
  destinationDirectory: string,
  completed: ReadonlyArray<FlattenMediaPlanEntry>,
  cause: Cause.Cause<FilesCommandError>
): Effect.fn.Return<never, FilesCommandError, FileSystem.FileSystem> {
  const recoveryFailures = yield* rollbackFlattenMediaEntries(completed);

  if (A.isReadonlyArrayNonEmpty(recoveryFailures)) {
    yield* Effect.logWarning({
      message: "files flatten-media recovery was incomplete",
      destinationDirectory,
      failures: recoveryFailures,
    });
  }

  const originalError = Cause.findErrorOption(cause);
  if (O.isNone(originalError)) {
    return yield* Effect.failCause(cause);
  }

  return yield* FilesCommandError.make({
    cause: originalError.value,
    message: `${originalError.value.message} ${flattenMediaRecoveryMessage(completed, recoveryFailures)}`,
  });
});

const applyFlattenMediaPlan = Effect.fn("Files.applyFlattenMediaPlan")(function* (
  plan: FlattenMediaPlan
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  return yield* Effect.uninterruptibleMask(
    Effect.fnUntraced(function* (restore) {
      yield* createFlattenMediaDestination(plan);
      let completed = A.empty<FlattenMediaPlanEntry>();

      for (const entry of plan.entries) {
        const moved = yield* Effect.exit(
          restore(
            Effect.uninterruptible(
              moveFlattenMediaEntry(entry).pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    completed = A.append(completed, entry);
                  })
                )
              )
            )
          )
        );

        if (Exit.isFailure(moved)) {
          return yield* recoverFlattenMediaFailure(plan.destinationDirectory, completed, moved.cause);
        }
      }
    })
  );
});

const logFlattenMediaPlan = Effect.fn("Files.logFlattenMediaPlan")(function* (plan: FlattenMediaPlan) {
  yield* Effect.forEach(plan.entries, (entry) => Console.log(`${entry.sourceRelativePath} -> ${entry.targetName}`), {
    discard: true,
  });
});

const makeFlattenMediaSummary = (plan: FlattenMediaPlan, dryRun: boolean, movedCount: number): FlattenMediaSummary =>
  FlattenMediaSummary.make({
    collisionCount: plan.collisionCount,
    destinationDirectory: plan.destinationDirectory,
    dryRun,
    movedCount,
    plannedCount: A.length(plan.entries),
    skippedCount: plan.skippedCount,
    sourceDirectory: plan.sourceDirectory,
  });

/**
 * Validate, plan, preview, and apply a recursive media flattening operation.
 *
 * @internal
 * @effects Recursively reads source directories and moves selected files unless dry-run is enabled.
 * @example
 * ```ts
 * import { FlattenMediaOptions } from "@beep/repo-cli/commands/Files"
 * import { runFlattenMediaFiles } from "@beep/repo-cli/commands/Files/internal/FlattenMedia"
 * import { Effect } from "effect"
 *
 * const program = runFlattenMediaFiles(FlattenMediaOptions.make({
 *   dir: "./raw",
 *   outDir: "./flat"
 * }))
 * console.log(Effect.isEffect(program))
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runFlattenMediaFiles = Effect.fn("Files.runFlattenMediaFiles")(function* (
  options: FlattenMediaOptions
): Effect.fn.Return<FlattenMediaSummary, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const decodedOptions = yield* decodeFlattenMediaOptions(options).pipe(
    FilesCommandError.mapError(
      "Invalid flatten-media options. Expected --dir, --out-dir, and a boolean --dry-run flag."
    )
  );
  const directories = yield* validateFlattenMediaDirectories(decodedOptions);
  const plan = yield* buildFlattenMediaPlan(directories);
  const plannedCount = A.length(plan.entries);

  if (!A.isReadonlyArrayNonEmpty(plan.entries)) {
    yield* Console.log(
      `files flatten-media: 0 media file(s) found beneath "${plan.sourceDirectory}"; nothing to move.`
    );
    if (hasSkippedFiles(plan.skippedCount)) {
      yield* Console.log(`files flatten-media: skipped ${plan.skippedCount} non-media file(s).`);
    }
    return makeFlattenMediaSummary(plan, decodedOptions.dryRun, 0);
  }

  yield* preflightFlattenMediaPlan(plan);
  yield* Console.log(
    `files flatten-media: ${plannedCount} media file(s) planned from "${plan.sourceDirectory}" to "${plan.destinationDirectory}".`
  );
  if (hasSkippedFiles(plan.collisionCount)) {
    yield* Console.log(`files flatten-media: resolved ${plan.collisionCount} filename collision(s).`);
  }
  if (hasSkippedFiles(plan.skippedCount)) {
    yield* Console.log(`files flatten-media: skipped ${plan.skippedCount} non-media file(s).`);
  }
  yield* logFlattenMediaPlan(plan);

  if (decodedOptions.dryRun) {
    yield* Console.log("files flatten-media: dry run; no directory created and no files moved.");
    return makeFlattenMediaSummary(plan, true, 0);
  }

  yield* applyFlattenMediaPlan(plan);
  yield* Console.log(`files flatten-media: moved ${plannedCount} media file(s).`);
  return makeFlattenMediaSummary(plan, false, plannedCount);
});
