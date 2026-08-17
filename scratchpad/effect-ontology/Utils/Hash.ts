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
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { dual2, dual3 } from "./Dual.ts";

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
 * Compute SHA-256 hash of a string using WebCrypto API
 *
 * **Details**
 *
 * Works in both Node.js and browser environments.
 *
 * **Example** (Inspect sha256)
 *
 * ```ts
 * import { sha256 } from "@effect-ontology/Utils/Hash"
 *
 * console.log(sha256)
 * ```
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash
 * @category utilities
 * @since 0.0.0
 */
export const sha256 = (input: string): Effect.Effect<string> =>
  Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then(toHex));

/**
 * Generate a cache key for embedding lookups
 *
 * **Details**
 *
 * Creates a deterministic SHA-256 hash from text and task type.
 * Uses "::" separator to prevent collision between similar inputs.
 *
 * **Example** (Inspect hash embedding key)
 *
 * ```ts
 * import { hashEmbeddingKey } from "@effect-ontology/Utils/Hash"
 *
 * console.log(hashEmbeddingKey)
 * ```
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type (e.g., "search_document", "search_query")
 * @returns SHA-256 hash for cache lookup
 * @category utilities
 * @since 0.0.0
 */
export const hashEmbeddingKey = dual2(
  (text: string, taskType: string): Effect.Effect<string> => sha256(`${text}::${taskType}`)
);

/**
 * Synchronous SHA-256 hash of a string (full length)
 *
 * **Details**
 *
 * For server-side use only. Uses Node.js crypto module.
 * Falls back to a simple hash in browser (should not be called in browser).
 *
 * **Example** (Inspect sha256 sync full)
 *
 * ```ts
 * import { sha256SyncFull } from "@effect-ontology/Utils/Hash"
 *
 * console.log(sha256SyncFull)
 * ```
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash (full 64 chars)
 * @category utilities
 * @since 0.0.0
 */
export const sha256SyncFull = (input: string): string => createHash("sha256").update(input).digest("hex");

/**
 * Synchronous SHA-256 hash of a string (truncated to 16 chars)
 *
 * **Details**
 *
 * For server-side use only. Uses Node.js crypto module.
 * Falls back to a simple hash in browser (should not be called in browser).
 *
 * **Example** (Inspect sha256 sync)
 *
 * ```ts
 * import { sha256Sync } from "@effect-ontology/Utils/Hash"
 *
 * console.log(sha256Sync)
 * ```
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash (first 16 chars for brevity)
 * @category utilities
 * @since 0.0.0
 */
export const sha256Sync = (input: string): string => sha256SyncFull(input).slice(0, 16);

/**
 * Synchronous version of hashEmbeddingKey for pure contexts
 *
 * **Example** (Inspect hash embedding key sync)
 *
 * ```ts
 * import { hashEmbeddingKeySync } from "@effect-ontology/Utils/Hash"
 *
 * console.log(hashEmbeddingKeySync)
 * ```
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type
 * @returns SHA-256 hash for cache lookup
 * @category utilities
 * @since 0.0.0
 */
export const hashEmbeddingKeySync = dual2((text: string, taskType: string): string =>
  sha256SyncFull(`${text}::${taskType}`)
);

/**
 * Provider metadata for versioned cache keys
 *
 * **Example** (Reference EmbeddingKeyMetadata fields)
 *
 * ```ts
 * import type { EmbeddingKeyMetadata } from "@effect-ontology/Utils/Hash"
 *
 * const embeddingKeyMetadataFields: ReadonlyArray<keyof EmbeddingKeyMetadata> = ["providerId", "modelId", "dimension"]
 *
 * console.log(embeddingKeyMetadataFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingKeyMetadata {
  readonly providerId: string;
  readonly modelId: string;
  readonly dimension: number;
}

/**
 * Generate versioned cache key for embeddings
 *
 * **Details**
 *
 * Includes provider, model, and dimension to prevent collisions when:
 * - Switching providers (nomic -> voyage)
 * - Changing models (voyage-3 -> voyage-3.5-lite)
 * - Using different dimensions (768 vs 1024)
 *
 * Format: SHA-256(providerId::modelId::dimension::taskType::text)
 *
 * **Example** (Inspect hash versioned embedding key)
 *
 * ```ts
 * import { hashVersionedEmbeddingKey } from "@effect-ontology/Utils/Hash"
 *
 * console.log(hashVersionedEmbeddingKey)
 * ```
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type
 * @param metadata - Provider metadata (providerId, modelId, dimension)
 * @returns Effect yielding SHA-256 hash for cache lookup
 * @category utilities
 * @since 0.0.0
 */
export const hashVersionedEmbeddingKey = dual3(
  (text: string, taskType: string, metadata: EmbeddingKeyMetadata): Effect.Effect<string> =>
    sha256(`${metadata.providerId}::${metadata.modelId}::${metadata.dimension}::${taskType}::${text}`)
);

/**
 * Synchronous version of hashVersionedEmbeddingKey for pure contexts
 *
 * **Example** (Inspect hash versioned embedding key sync)
 *
 * ```ts
 * import { hashVersionedEmbeddingKeySync } from "@effect-ontology/Utils/Hash"
 *
 * console.log(hashVersionedEmbeddingKeySync)
 * ```
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type
 * @param metadata - Provider metadata (providerId, modelId, dimension)
 * @returns SHA-256 hash for cache lookup
 * @category utilities
 * @since 0.0.0
 */
export const hashVersionedEmbeddingKeySync = dual3(
  (text: string, taskType: string, metadata: EmbeddingKeyMetadata): string =>
    sha256SyncFull(`${metadata.providerId}::${metadata.modelId}::${metadata.dimension}::${taskType}::${text}`)
);

/**
 * Compute SHA-256 hash of bytes using WebCrypto API
 *
 * **Details**
 *
 * Works in both Node.js and browser environments.
 *
 * **Example** (Inspect sha256 bytes)
 *
 * ```ts
 * import { sha256Bytes } from "@effect-ontology/Utils/Hash"
 *
 * console.log(sha256Bytes)
 * ```
 *
 * @param bytes - Uint8Array to hash
 * @returns Hex-encoded SHA-256 hash
 * @category utilities
 * @since 0.0.0
 */
export const sha256Bytes = (bytes: BufferSource): Effect.Effect<string> =>
  Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", bytes).then(toHex));

/**
 * Synchronous SHA-256 hash of bytes
 *
 * **Details**
 *
 * For server-side use only. Uses Node.js crypto module.
 *
 * **Example** (Inspect sha256 bytes sync)
 *
 * ```ts
 * import { sha256BytesSync } from "@effect-ontology/Utils/Hash"
 *
 * console.log(sha256BytesSync)
 * ```
 *
 * @param bytes - Uint8Array to hash
 * @returns Hex-encoded SHA-256 hash
 * @category utilities
 * @since 0.0.0
 */
export const sha256BytesSync = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
