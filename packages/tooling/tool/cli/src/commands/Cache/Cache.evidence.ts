/**
 * Bounded immutable file verification shared by Cache evidence consumers.
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheEvidenceReference } from "@beep/repo-configs/cache";

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
