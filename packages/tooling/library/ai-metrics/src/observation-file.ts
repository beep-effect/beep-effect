/**
 * Bounded observation input and shared private-file metadata checks.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";

/**
 * Read strict UTF-8 through a byte ceiling before parsing.
 *
 * **Details**
 *
 * Reads at most maxBytes plus one sentinel byte. The caller supplies a finite trusted byte ceiling, path authorization and safe errors; private file data is excluded from error causes. This performs no ownership or inode check and does not establish a stable snapshot.
 *
 * **Example** (Inspect the bounded metadata reader)
 *
 * ```ts
 * import { readBoundedMetadata } from "@beep/repo-ai-metrics/observation-file"
 * console.log(typeof readBoundedMetadata)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const readBoundedMetadata: {
  <E>(
    maxBytes: number,
    errors: { readonly readFailed: E; readonly oversize: E; readonly encodingFailed: E }
  ): (path: string) => Effect.Effect<string, E, FileSystem.FileSystem>;
  <E>(
    path: string,
    maxBytes: number,
    errors: { readonly readFailed: E; readonly oversize: E; readonly encodingFailed: E }
  ): Effect.Effect<string, E, FileSystem.FileSystem>;
} = dual(
  3,
  Effect.fn("AiMetrics.readBoundedMetadata")(function* <E>(
    path: string,
    maxBytes: number,
    errors: { readonly readFailed: E; readonly oversize: E; readonly encodingFailed: E }
  ) {
    const fs = yield* FileSystem.FileSystem;
    const chunks = yield* fs.stream(path, { bytesToRead: maxBytes + 1 }).pipe(
      Stream.runCollect,
      Effect.mapError(() => errors.readFailed)
    );
    const length = A.reduce(chunks, 0, (total, chunk) => total + chunk.byteLength);
    if (length > maxBytes) return yield* Effect.fail(errors.oversize);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      catch: () => errors.encodingFailed,
    });
  })
);

/**
 * Test regular-file type, exact private mode, owner and single-link metadata.
 *
 * **Details**
 *
 * This checks supplied metadata only. Callers must obtain it through their owned lstat or pinned handle and separately enforce canonical paths, inode stability, locks and size bounds. Missing owner or link counts fail closed.
 *
 * **Example** (Inspect the private-file metadata predicate)
 *
 * ```ts
 * import { isPrivateObservationFile } from "@beep/repo-ai-metrics/observation-file"
 * console.log(typeof isPrivateObservationFile)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPrivateObservationFile: {
  (uid: number): (info: FileSystem.File.Info) => boolean;
  (info: FileSystem.File.Info, uid: number): boolean;
} = dual(
  2,
  (info: FileSystem.File.Info, uid: number) =>
    info.type === "File" &&
    (info.mode & 0o777) === 0o600 &&
    O.contains(info.uid, uid) &&
    O.contains(info.nlink, BigInt(1))
);
