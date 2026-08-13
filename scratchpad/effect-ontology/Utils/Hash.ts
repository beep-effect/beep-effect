/**
 * Hash Utilities
 *
 * Content-addressable hashing for cache keys.
 * Uses WebCrypto API for cross-platform compatibility (Node.js & Browser).
 *
 * @since 2.0.0
 * @module Utils/Hash
 */

import { Effect } from "effect";
import { dual2, dual3 } from "./Dual.ts";

/**
 * Convert Uint8Array to hex string
 */
const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Compute SHA-256 hash of a string using WebCrypto API
 *
 * Works in both Node.js and browser environments.
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @since 2.0.0
 * @category Hash
 */
export const sha256 = (input: string): Effect.Effect<string> =>
  Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then(toHex));

/**
 * Generate a cache key for embedding lookups
 *
 * Creates a deterministic SHA-256 hash from text and task type.
 * Uses "::" separator to prevent collision between similar inputs.
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type (e.g., "search_document", "search_query")
 * @returns SHA-256 hash for cache lookup
 *
 * @since 2.0.0
 * @category Hash
 */
export const hashEmbeddingKey = dual2(
  (text: string, taskType: string): Effect.Effect<string> => sha256(`${text}::${taskType}`)
);

/**
 * Synchronous SHA-256 hash of a string (full length)
 *
 * For server-side use only. Uses Node.js crypto module.
 * Falls back to a simple hash in browser (should not be called in browser).
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash (full 64 chars)
 *
 * @since 2.0.0
 * @category Hash
 */
export const sha256SyncFull = (input: string): string => {
  // For synchronous use cases that only run on Node.js
  // Use dynamic import to avoid bundling in browser
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require("node:crypto");
    return createHash("sha256").update(input).digest("hex");
  } catch {
    // Fallback: return a padded simple hash for browser (should not be called in browser)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, "0");
  }
};

/**
 * Synchronous SHA-256 hash of a string (truncated to 16 chars)
 *
 * For server-side use only. Uses Node.js crypto module.
 * Falls back to a simple hash in browser (should not be called in browser).
 *
 * @param input - String to hash
 * @returns Hex-encoded SHA-256 hash (first 16 chars for brevity)
 *
 * @since 2.0.0
 * @category Hash
 */
export const sha256Sync = (input: string): string => sha256SyncFull(input).slice(0, 16);

/**
 * Synchronous version of hashEmbeddingKey for pure contexts
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type
 * @returns SHA-256 hash for cache lookup
 *
 * @since 2.0.0
 * @category Hash
 */
export const hashEmbeddingKeySync = dual2((text: string, taskType: string): string =>
  sha256SyncFull(`${text}::${taskType}`)
);

/**
 * Provider metadata for versioned cache keys
 *
 * @since 2.0.0
 * @category Types
 */
export interface EmbeddingKeyMetadata {
  readonly providerId: string;
  readonly modelId: string;
  readonly dimension: number;
}

/**
 * Generate versioned cache key for embeddings
 *
 * Includes provider, model, and dimension to prevent collisions when:
 * - Switching providers (nomic -> voyage)
 * - Changing models (voyage-3 -> voyage-3.5-lite)
 * - Using different dimensions (768 vs 1024)
 *
 * Format: SHA-256(providerId::modelId::dimension::taskType::text)
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type
 * @param metadata - Provider metadata (providerId, modelId, dimension)
 * @returns Effect yielding SHA-256 hash for cache lookup
 *
 * @since 2.0.0
 * @category Hash
 */
export const hashVersionedEmbeddingKey = dual3(
  (text: string, taskType: string, metadata: EmbeddingKeyMetadata): Effect.Effect<string> =>
    sha256(`${metadata.providerId}::${metadata.modelId}::${metadata.dimension}::${taskType}::${text}`)
);

/**
 * Synchronous version of hashVersionedEmbeddingKey for pure contexts
 *
 * @param text - Text to embed
 * @param taskType - Embedding task type
 * @param metadata - Provider metadata (providerId, modelId, dimension)
 * @returns SHA-256 hash for cache lookup
 *
 * @since 2.0.0
 * @category Hash
 */
export const hashVersionedEmbeddingKeySync = dual3(
  (text: string, taskType: string, metadata: EmbeddingKeyMetadata): string =>
    sha256SyncFull(`${metadata.providerId}::${metadata.modelId}::${metadata.dimension}::${taskType}::${text}`)
);

/**
 * Compute SHA-256 hash of bytes using WebCrypto API
 *
 * Works in both Node.js and browser environments.
 *
 * @param bytes - Uint8Array to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @since 2.0.0
 * @category Hash
 */
export const sha256Bytes = (bytes: BufferSource): Effect.Effect<string> =>
  Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", bytes).then(toHex));

/**
 * Synchronous SHA-256 hash of bytes
 *
 * For server-side use only. Uses Node.js crypto module.
 *
 * @param bytes - Uint8Array to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @since 2.0.0
 * @category Hash
 */
export const sha256BytesSync = (bytes: Uint8Array): string => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require("node:crypto");
    return createHash("sha256").update(bytes).digest("hex");
  } catch {
    // Fallback: use WebCrypto async (this path shouldn't happen in practice)
    throw new Error("sha256BytesSync requires Node.js crypto module");
  }
};
