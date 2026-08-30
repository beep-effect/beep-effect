/**
 * Hash Utilities
 *
 * **Details**
 *
 * Content-addressable hashing for cache keys.
 * Uses WebCrypto API for cross-platform compatibility (Node.js & Browser).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $ScratchpadId } from "@beep/identity";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { dual2, dual3 } from "./Dual.ts";

const $I = $ScratchpadId.create("effect-ontology/Utils/Hash");

/**
 * Describes a failed WebCrypto digest operation.
 *
 * **Example** (Inspect the operation)
 *
 * ```ts
 * import { HashingError } from "@effect-ontology/Utils/Hash"
 *
 * const error = HashingError.make({ operation: "sha256", cause: "WebCrypto unavailable" })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HashingError extends S.TaggedError<HashingError>($I`HashingError`)(
  "HashingError",
  {
    operation: S.Literals(["sha256", "sha256-bytes"]),
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("HashingError", {
    description: "Failure while computing a SHA-256 digest through WebCrypto.",
  })
) {}

/**
 * Convert Uint8Array to hex string
 */
const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return A.join(
    A.map(A.fromIterable(bytes), (byte) => Str.padStart(2, "0")(byte.toString(16))),
    ""
  );
};

/**
 * Computes a full SHA-256 hex digest of a string through WebCrypto.
 *
 * **Details**
 *
 * Works in Node.js and browsers. The returned hex is 64 characters.
 *
 * **Example** (Hash a string through WebCrypto)
 *
 * ```ts
 * import { sha256, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const hex = await Effect.runPromise(sha256("ada lovelace"))
 * console.log(hex.length) // 64
 * console.log(hex === sha256SyncFull("ada lovelace")) // true
 * ```
 *
 * @see {@link sha256SyncFull} for the Node-only synchronous full digest.
 * @category utilities
 * @since 0.0.0
 */
export const sha256 = (input: string): Effect.Effect<string, HashingError> =>
  Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then(toHex),
    catch: (cause) => HashingError.make({ operation: "sha256", cause }),
  });

/**
 * Builds an embedding cache key as SHA-256(`text::taskType`).
 *
 * **Details**
 *
 * The `::` separator keeps `"ab" + "cd"` from colliding with `"a" + "bcd"`.
 *
 * **Example** (Hash an embedding lookup key)
 *
 * ```ts
 * import { hashEmbeddingKey, hashEmbeddingKeySync } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const hex = await Effect.runPromise(hashEmbeddingKey("Ada Lovelace", "search_document"))
 * console.log(hex === hashEmbeddingKeySync("Ada Lovelace", "search_document")) // true
 * console.log(hex.length) // 64
 * ```
 *
 * @see {@link hashEmbeddingKeySync} for the Node-only synchronous twin.
 * @see {@link hashVersionedEmbeddingKey} when provider, model, and dimension must enter the key.
 * @category utilities
 * @since 0.0.0
 */
export const hashEmbeddingKey = dual2(
  (text: string, taskType: string): Effect.Effect<string, HashingError> => sha256(`${text}::${taskType}`)
);

/**
 * Computes a full SHA-256 hex digest of a string through Node `crypto`.
 *
 * **Gotchas**
 *
 * Node `crypto` only. Do not call this from a browser; use {@link sha256}.
 *
 * **Example** (Hash a string on the server)
 *
 * ```ts
 * import { sha256Sync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 *
 * const full = sha256SyncFull("ada lovelace")
 * console.log(full.length) // 64
 * console.log(sha256Sync("ada lovelace") === full.slice(0, 16)) // true
 * ```
 *
 * @returns Hex-encoded SHA-256 digest (64 characters).
 * @see {@link sha256} for the WebCrypto Effect twin.
 * @see {@link sha256Sync} for the truncated 16-character digest.
 * @category utilities
 * @since 0.0.0
 */
export const sha256SyncFull = (input: string): string => createHash("sha256").update(input).digest("hex");

/**
 * Computes a truncated SHA-256 hex digest of a string through Node `crypto`.
 *
 * **Gotchas**
 *
 * Node `crypto` only. Do not call this from a browser; use {@link sha256}.
 * Truncation is the first 16 hex characters of {@link sha256SyncFull}.
 *
 * **Example** (Take the 16-character digest)
 *
 * ```ts
 * import { sha256Sync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 *
 * const truncated = sha256Sync("ada lovelace")
 * console.log(truncated.length) // 16
 * console.log(truncated === sha256SyncFull("ada lovelace").slice(0, 16)) // true
 * ```
 *
 * @returns First 16 hex characters of the SHA-256 digest.
 * @see {@link sha256SyncFull} for the untruncated 64-character digest.
 * @see {@link sha256} for the WebCrypto Effect twin.
 * @category utilities
 * @since 0.0.0
 */
export const sha256Sync = (input: string): string => sha256SyncFull(input).slice(0, 16);

/**
 * Synchronous Node twin of {@link hashEmbeddingKey}.
 *
 * **Example** (Hash an embedding key on the server)
 *
 * ```ts
 * import { hashEmbeddingKeySync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 *
 * const hex = hashEmbeddingKeySync("Ada Lovelace", "search_query")
 * console.log(hex === sha256SyncFull("Ada Lovelace::search_query")) // true
 * ```
 *
 * @see {@link hashEmbeddingKey} for the WebCrypto Effect twin.
 * @see {@link hashVersionedEmbeddingKeySync} when provider metadata must enter the key.
 * @category utilities
 * @since 0.0.0
 */
export const hashEmbeddingKeySync = dual2((text: string, taskType: string): string =>
  sha256SyncFull(`${text}::${taskType}`)
);

/**
 * Provider, model, and dimension that version an embedding cache key.
 *
 * @see {@link hashVersionedEmbeddingKey} for the Effect constructor that consumes this metadata.
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingKeyMetadata {
  readonly providerId: string;
  readonly modelId: string;
  readonly dimension: number;
}

/**
 * Builds a versioned embedding cache key as
 * SHA-256(`providerId::modelId::dimension::taskType::text`).
 *
 * **Details**
 *
 * Provider, model, and dimension keep nomic/voyage, 768/1024, and model
 * upgrades from sharing cache entries.
 *
 * **Example** (Hash a versioned embedding key)
 *
 * ```ts
 * import { hashVersionedEmbeddingKey, hashVersionedEmbeddingKeySync } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const metadata = { providerId: "nomic", modelId: "nomic-embed-text-v1.5", dimension: 768 }
 * const hex = await Effect.runPromise(
 *   hashVersionedEmbeddingKey("Ada Lovelace", "search_document", metadata)
 * )
 * console.log(hex === hashVersionedEmbeddingKeySync("Ada Lovelace", "search_document", metadata)) // true
 * ```
 *
 * @see {@link hashVersionedEmbeddingKeySync} for the Node-only synchronous twin.
 * @see {@link hashEmbeddingKey} when provider metadata is not part of the collision domain.
 * @category utilities
 * @since 0.0.0
 */
export const hashVersionedEmbeddingKey = dual3(
  (text: string, taskType: string, metadata: EmbeddingKeyMetadata): Effect.Effect<string, HashingError> =>
    sha256(`${metadata.providerId}::${metadata.modelId}::${metadata.dimension}::${taskType}::${text}`)
);

/**
 * Synchronous Node twin of {@link hashVersionedEmbeddingKey}.
 *
 * **Example** (Hash a versioned key on the server)
 *
 * ```ts
 * import { hashVersionedEmbeddingKeySync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 *
 * const metadata = { providerId: "voyage", modelId: "voyage-3", dimension: 1024 }
 * const hex = hashVersionedEmbeddingKeySync("Ada Lovelace", "search_query", metadata)
 * console.log(hex === sha256SyncFull("voyage::voyage-3::1024::search_query::Ada Lovelace")) // true
 * ```
 *
 * @see {@link hashVersionedEmbeddingKey} for the WebCrypto Effect twin.
 * @category utilities
 * @since 0.0.0
 */
export const hashVersionedEmbeddingKeySync = dual3(
  (text: string, taskType: string, metadata: EmbeddingKeyMetadata): string =>
    sha256SyncFull(`${metadata.providerId}::${metadata.modelId}::${metadata.dimension}::${taskType}::${text}`)
);

/**
 * Computes a full SHA-256 hex digest of bytes through WebCrypto.
 *
 * **Example** (Hash bytes through WebCrypto)
 *
 * ```ts
 * import { sha256Bytes, sha256BytesSync } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const bytes = new TextEncoder().encode("ada")
 * const hex = await Effect.runPromise(sha256Bytes(bytes))
 * console.log(hex.length) // 64
 * console.log(hex === sha256BytesSync(bytes)) // true
 * ```
 *
 * @see {@link sha256BytesSync} for the Node-only synchronous twin.
 * @category utilities
 * @since 0.0.0
 */
export const sha256Bytes = (bytes: BufferSource): Effect.Effect<string, HashingError> =>
  Effect.tryPromise({
    try: () => globalThis.crypto.subtle.digest("SHA-256", bytes).then(toHex),
    catch: (cause) => HashingError.make({ operation: "sha256-bytes", cause }),
  });

/**
 * Computes a full SHA-256 hex digest of bytes through Node `crypto`.
 *
 * **Gotchas**
 *
 * Node `crypto` only. Do not call this from a browser; use {@link sha256Bytes}.
 *
 * **Example** (Hash bytes on the server)
 *
 * ```ts
 * import { sha256BytesSync } from "@effect-ontology/Utils/Hash"
 *
 * const hex = sha256BytesSync(new TextEncoder().encode("ada"))
 * console.log(hex.length) // 64
 * ```
 *
 * @see {@link sha256Bytes} for the WebCrypto Effect twin.
 * @category utilities
 * @since 0.0.0
 */
export const sha256BytesSync = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
