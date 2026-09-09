/**
 * Bounded immutable file verification shared by Cache evidence consumers.
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Effect, Path } from "effect";
import * as S from "effect/Schema";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheEvidenceReference } from "@beep/repo-configs/cache";

/**
 * Read a required contained experiment artifact within its byte bound.
 *
 * **Example** (Plan a bounded file read)
 *
 * ```ts
 * import { readCacheExperimentBytes } from "@beep/repo-cli/test/Cache"
 * import { Effect } from "effect"
 * console.assert(Effect.isEffect(readCacheExperimentBytes("/repo", "fixture.txt", 4096)))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readCacheExperimentBytes = Effect.fn("CacheEvidence.readExperimentBytes")(function* (
  root: string,
  relative: string,
  limit = 1024 * 1024
) {
  const read = yield* readContainedFileBytesNoFollow(root, relative, NonNegativeInt.make(limit));
  return yield* read.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new(`Required bounded experiment artifact is missing: ${relative}`))
  );
});

/**
 * Decode experiment bytes without silently replacing malformed UTF-8.
 *
 * **Example** (Decode exact UTF-8 bytes)
 *
 * ```ts
 * import { decodeCacheExperimentText } from "@beep/repo-cli/test/Cache"
 * import { Effect } from "effect"
 * console.assert(Effect.isEffect(decodeCacheExperimentText(new TextEncoder().encode("fixture"))))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const decodeCacheExperimentText = (bytes: Uint8Array) =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => CacheCommandError.new("Experiment artifact contains invalid UTF-8."),
  });

/**
 * Hash an exact executable with the shared no-follow, 128 MiB read bound.
 *
 * **Example** (Plan executable identity verification)
 *
 * ```ts
 * import { hashCacheExperimentExecutable } from "@beep/repo-cli/test/Cache"
 * import { Effect } from "effect"
 * console.assert(Effect.isEffect(hashCacheExperimentExecutable("/tools/turbo")))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const hashCacheExperimentExecutable = Effect.fn("CacheEvidence.hashExperimentExecutable")(function* (
  executable: string
) {
  const path = yield* Path.Path;
  return yield* readCacheExperimentBytes(path.dirname(executable), executable, 128 * 1024 * 1024).pipe(
    Effect.flatMap(S.decodeEffect(Sha256HexFromBytes))
  );
});

/**
 * Read at most eight MiB from a contained regular file and verify its original bytes.
 *
 * **Details**
 *
 * The shared filesystem guard rejects symlink traversal. This checks file
 * integrity only; the caller owns decoding and the evidence's meaning.
 *
 * **Example** (Keep verification lazy)
 *
 * ```ts
 * import { readCacheEvidenceBytes } from "@beep/repo-cli/test/Cache"
 * import type { CacheEvidenceReference } from "@beep/repo-configs/cache"
 * const plan = (reference: CacheEvidenceReference) => readCacheEvidenceBytes("/repo", reference)
 * console.assert(typeof plan === "function")
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readCacheEvidenceBytes = Effect.fn("CacheEvidence.readBytes")(function* (
  root: string,
  reference: CacheEvidenceReference
) {
  const read = yield* readContainedFileBytesNoFollow(root, reference.path, NonNegativeInt.make(8 * 1024 * 1024));
  const bytes = yield* read.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new("Required qualification evidence is missing."))
  );
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  if (digest !== reference.sha256) return yield* CacheCommandError.new("Qualification evidence digest mismatch.");
  return bytes;
}, CacheCommandError.mapError("Cannot verify qualification evidence bytes."));
