/**
 * Durable publication helpers shared by append-only repository journals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { Effect, FileSystem, Path } from "effect";
import { QualitySchedulerError } from "./QualityScheduler.schemas.ts";

const textEncoder = new TextEncoder();

/**
 * Publish complete journal text without truncating the currently visible file.
 *
 * **Details**
 *
 * The helper writes and syncs a sibling staging file, renames it over the
 * target, and then best-effort syncs the parent directory. A failed operation
 * removes only the unpublished staging file.
 *
 * **Example** (Construct an atomic journal publication)
 *
 * ```ts
 * import { publishJournalTextAtomically } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(publishJournalTextAtomically("/tmp/journal.ndjson", "{}\n", "journal")))
 * // true
 * ```
 *
 * @param targetPath - Published journal path replaced by the atomic rename.
 * @param content - Complete replacement text written to the staging sibling.
 * @param label - Human-readable journal label used in typed error messages.
 * @param beforePublish - Fence checked after staging and immediately before the rename.
 * @returns An effect that completes after the file rename and directory sync attempt.
 * @category utilities
 * @since 0.0.0
 */
export const publishJournalTextAtomically = Effect.fn("JournalFile.publishTextAtomically")(function* (
  targetPath: string,
  content: string,
  label: string,
  beforePublish: Effect.Effect<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> = Effect.void
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stagingPath = `${targetPath}.staging-${process.pid}-${randomUUID()}`;
  yield* Effect.ensuring(
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const file = yield* fs.open(stagingPath, { flag: "w" });
          yield* file.writeAll(textEncoder.encode(content));
          yield* file.sync;
        })
      ).pipe(Effect.mapError(QualitySchedulerError.new(`Failed to stage ${label} "${targetPath}".`)));
      yield* beforePublish;
      yield* fs
        .rename(stagingPath, targetPath)
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to publish ${label} "${targetPath}".`)));
      yield* Effect.scoped(
        fs.open(path.dirname(targetPath), { flag: "r" }).pipe(Effect.flatMap((directory) => directory.sync))
      ).pipe(Effect.ignore);
    }),
    fs.remove(stagingPath, { force: true }).pipe(Effect.ignore)
  );
});
