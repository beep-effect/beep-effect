/**
 * SHA-256 hex digests for stable identity strings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import * as Crypto from "effect/Crypto";
import * as Encoding from "effect/Encoding";
import type * as PlatformError from "effect/PlatformError";

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
): Effect.fn.Return<string, PlatformError.PlatformError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  return Encoding.encodeHex(yield* crypto.digest("SHA-256", new TextEncoder().encode(text)));
});
