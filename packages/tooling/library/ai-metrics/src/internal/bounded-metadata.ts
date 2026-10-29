/** Bounded metadata input; never attach private paths or contents to boundary errors. */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Stream from "effect/Stream";

/**
 * Read strict UTF-8 through a byte ceiling before parsing.
 *
 * **Example**
 * ```ts
 * const sentinelBytes = 1
 * console.log(sentinelBytes)
 * ```
 * **Details** Caller-owned errors keep private file data out of diagnostic causes.
 * @category utilities
 * @since 0.0.0
 */
export const readBoundedMetadata = Effect.fn("AiMetrics.readBoundedMetadata")(function* <E>(
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
});
