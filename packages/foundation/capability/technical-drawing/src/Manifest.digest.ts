/**
 * SHA-256 digests of the bytes a render manifest, an approval record or a
 * review round records.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { Sha256Hex } from "./Manifest.schemas.ts";

/**
 * Hash bytes into a lowercase hex SHA-256 digest with Web Crypto.
 *
 * **Details**
 *
 * The bytes are copied before hashing, so a view over a larger buffer hashes
 * only the bytes it covers.
 *
 * **Example** (Hash the empty byte string)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { sha256Hex } from "@beep/technical-drawing"
 *
 * const digest = await Effect.runPromise(sha256Hex(new Uint8Array()))
 * console.log(digest) // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sha256Hex = (bytes: Uint8Array): Effect.Effect<Sha256Hex> =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", bytes.slice().buffer)).pipe(
    Effect.map((digest) => Sha256Hex.make(Hex.encode(new Uint8Array(digest))))
  );
