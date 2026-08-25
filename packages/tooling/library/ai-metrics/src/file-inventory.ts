/**
 * Shared filesystem inventory traversal for AI metrics storage trees.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit } from "@beep/schema";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $RepoAiMetricsId.create("file-inventory");
const AiMetricsFileInventoryOperation = LiteralKit(["inspect", "read"]).pipe(
  $I.annoteSchema("AiMetricsFileInventoryOperation", {
    description: "Filesystem operation that failed during AI metrics file inventory traversal.",
  })
);

/**
 * Failure to inspect a file or read a directory while building an AI metrics file inventory.
 *
 * **Example** (Construct a file inventory error)
 *
 * ```ts
 * import { AiMetricsFileInventoryError } from "@beep/repo-ai-metrics/file-inventory"
 *
 * const error = AiMetricsFileInventoryError.make({
 *   cause: new Error("permission denied"),
 *   operation: "inspect"
 * })
 *
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsFileInventoryError extends S.TaggedError<AiMetricsFileInventoryError>(
  $I`AiMetricsFileInventoryError`
)(
  "AiMetricsFileInventoryError",
  {
    cause: Defect({ includeStack: true }),
    operation: AiMetricsFileInventoryOperation,
  },
  $I.annoteError<AiMetricsFileInventoryError>("AiMetricsFileInventoryError", {
    description: "Failure to inspect a file or read a directory in an AI metrics storage tree.",
  })
) {}

/**
 * Recursively list regular files under an AI metrics directory with their file information.
 *
 * **Example** (List an inventory root)
 *
 * ```ts
 * import { listAiMetricsDirectoryFileInfo } from "@beep/repo-ai-metrics"
 *
 * const files = listAiMetricsDirectoryFileInfo("/tmp/ai-metrics")
 * ```
 *
 * @param root - Directory or regular file to inventory.
 * @returns An Effect yielding absolute file paths paired with their file information.
 * @category utilities
 * @since 0.0.0
 */
export const listAiMetricsDirectoryFileInfo = Effect.fn("AiMetrics.fileInventory.listDirectoryFileInfo")(function* (
  root: string
): Effect.fn.Return<
  ReadonlyArray<readonly [absolutePath: string, info: FileSystem.File.Info]>,
  AiMetricsFileInventoryError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const walk = Effect.fnUntraced(function* (
    currentPath: string
  ): Effect.fn.Return<
    ReadonlyArray<readonly [absolutePath: string, info: FileSystem.File.Info]>,
    AiMetricsFileInventoryError,
    FileSystem.FileSystem | Path.Path
  > {
    const info = yield* fs
      .stat(currentPath)
      .pipe(Effect.mapError((cause) => AiMetricsFileInventoryError.make({ cause, operation: "inspect" })));
    if (info.type === "File") {
      return [[currentPath, info] as const];
    }
    if (info.type !== "Directory") {
      return A.empty<readonly [absolutePath: string, info: FileSystem.File.Info]>();
    }

    const entries = yield* fs
      .readDirectory(currentPath)
      .pipe(Effect.mapError((cause) => AiMetricsFileInventoryError.make({ cause, operation: "read" })));
    const nested = yield* Effect.forEach(entries, (entry) => walk(path.join(currentPath, entry)), {
      concurrency: 8,
    });
    return A.flatten(nested);
  });

  return yield* walk(root);
});
