/**
 * SHA-256 hex digests for stable identity strings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";

/**
 * Hash UTF-8 text with SHA-256 and return the digest as lowercase hex.
 *
 * **Example** (Detect a hash effect)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { sha256Hex } from "@beep/repo-utils/Sha256Hex"
 *
 * console.log(Effect.isEffect(sha256Hex("beep"))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sha256Hex = Effect.fn("RepoUtils.sha256Hex")(function* (
  text: string
): Effect.fn.Return<string, never, Digest.Digest> {
  const crypto = yield* Digest.Digest;
  return Hex.encode(yield* crypto.digest(Digest.sha256, new TextEncoder().encode(text)));
});
