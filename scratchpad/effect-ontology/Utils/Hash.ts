/**
 * Hash Utilities
 *
 * **Details**
 *
 * Content-addressable hashing for cache keys.
 * Uses the platform-provided Effect Crypto service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect } from "effect";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { dual2, dual3 } from "./Dual.ts";

const $I = $ScratchpadId.create("effect-ontology/Utils/Hash");

/**
 * Describes a failed Effect Crypto digest operation.
 *
 * **Example** (Inspect the operation)
 *
 * ```ts
 * import { HashingError } from "@effect-ontology/Utils/Hash"
 *
 * const error = HashingError.make({ operation: "sha256", cause: "Crypto service unavailable" })
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
    description: "Failure while computing a SHA-256 digest through the Effect Crypto service.",
  })
) {}

/**
 * Computes a full SHA-256 hex digest of a string through the Effect Crypto service.
 *
 * **Details**
 *
 * Requires the platform Crypto service. The returned lowercase hex is 64 characters.
 *
 * **Example** (Hash a string through the Effect Crypto service)
 *
 * ```ts
 * import { sha256, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const hex = (yield* sha256("ada lovelace"))
 *   console.log(hex.length) // 64
 *   console.log(hex === (yield* sha256SyncFull("ada lovelace"))) // true
 * })
 * console.log(program)
 * ```
 *
 * @see {@link sha256SyncFull} for the Effect-returning compatibility full digest.
 * @category utilities
 * @since 0.0.0
 */
export const sha256 = Effect.fn("Hash.sha256")(function* (input: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", new TextEncoder().encode(input))
    .pipe(Effect.mapError((cause) => HashingError.make({ operation: "sha256", cause })));
  return Hex.encode(digest);
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
 * const program = Effect.gen(function* () {
 *   const hex = (yield* hashEmbeddingKey("Ada Lovelace", "search_document"))
 *   console.log(hex === (yield* hashEmbeddingKeySync("Ada Lovelace", "search_document"))) // true
 *   console.log(hex.length) // 64
 * })
 * console.log(program)
 * ```
 *
 * @see {@link hashEmbeddingKeySync} for the Effect-returning compatibility twin.
 * @see {@link hashVersionedEmbeddingKey} when provider, model, and dimension must enter the key.
 * @category utilities
 * @since 0.0.0
 */
export const hashEmbeddingKey = dual2(
  Effect.fn("Hash.hashEmbeddingKey")(function* (text: string, taskType: string) {
    return yield* sha256(`${text}::${taskType}`);
  })
);

/**
 * Computes a full SHA-256 hex digest of a string through the Effect Crypto service.
 *
 * **Gotchas**
 *
 * Returns an Effect requiring Crypto.Crypto; the legacy Sync suffix is retained for compatibility.
 *
 * **Example** (Hash a string on the server)
 *
 * ```ts
 * import { sha256Sync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const full = yield* sha256SyncFull("ada lovelace")
 *   console.log(full.length) // 64
 *   console.log((yield* sha256Sync("ada lovelace")) === full.slice(0, 16)) // true
 * })
 * console.log(program)
 * ```
 *
 * @returns An Effect producing a hex-encoded SHA-256 digest (64 characters).
 * @see {@link sha256} for the primary Effect constructor.
 * @see {@link sha256Sync} for the truncated 16-character digest.
 * @category utilities
 * @since 0.0.0
 */
export const sha256SyncFull = sha256;

/**
 * Computes a truncated SHA-256 hex digest of a string through the Effect Crypto service.
 *
 * **Gotchas**
 *
 * Returns an Effect requiring Crypto.Crypto; the legacy Sync suffix is retained for compatibility.
 * Truncation is the first 16 hex characters of {@link sha256SyncFull}.
 *
 * **Example** (Take the 16-character digest)
 *
 * ```ts
 * import { sha256Sync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const truncated = yield* sha256Sync("ada lovelace")
 *   console.log(truncated.length) // 16
 *   console.log(truncated === (yield* sha256SyncFull("ada lovelace")).slice(0, 16)) // true
 * })
 * console.log(program)
 * ```
 *
 * @returns An Effect producing the first 16 hex characters of the SHA-256 digest.
 * @see {@link sha256SyncFull} for the untruncated 64-character digest.
 * @see {@link sha256} for the primary Effect constructor.
 * @category utilities
 * @since 0.0.0
 */
export const sha256Sync = Effect.fn("Hash.sha256Sync")(function* (input: string) {
  return Str.slice(0, 16)(yield* sha256(input));
});

/**
 * Effect-returning compatibility alias of {@link hashEmbeddingKey}.
 *
 * **Example** (Hash an embedding key on the server)
 *
 * ```ts
 * import { hashEmbeddingKeySync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const hex = yield* hashEmbeddingKeySync("Ada Lovelace", "search_query")
 *   console.log(hex === (yield* sha256SyncFull("Ada Lovelace::search_query"))) // true
 * })
 * console.log(program)
 * ```
 *
 * @see {@link hashEmbeddingKey} for the primary Effect constructor.
 * @see {@link hashVersionedEmbeddingKeySync} when provider metadata must enter the key.
 * @category utilities
 * @since 0.0.0
 */
export const hashEmbeddingKeySync = hashEmbeddingKey;

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
 * const program = Effect.gen(function* () {
 *   const metadata = { providerId: "nomic", modelId: "nomic-embed-text-v1.5", dimension: 768 }
 *   const hex = (yield*
 *     hashVersionedEmbeddingKey("Ada Lovelace", "search_document", metadata)
 *   )
 *   console.log(hex === (yield* hashVersionedEmbeddingKeySync("Ada Lovelace", "search_document", metadata))) // true
 * })
 * console.log(program)
 * ```
 *
 * @see {@link hashVersionedEmbeddingKeySync} for the Effect-returning compatibility twin.
 * @see {@link hashEmbeddingKey} when provider metadata is not part of the collision domain.
 * @category utilities
 * @since 0.0.0
 */
export const hashVersionedEmbeddingKey = dual3(
  Effect.fn("Hash.hashVersionedEmbeddingKey")(function* (
    text: string,
    taskType: string,
    metadata: EmbeddingKeyMetadata
  ) {
    return yield* sha256(`${metadata.providerId}::${metadata.modelId}::${metadata.dimension}::${taskType}::${text}`);
  })
);

/**
 * Effect-returning compatibility alias of {@link hashVersionedEmbeddingKey}.
 *
 * **Example** (Hash a versioned key on the server)
 *
 * ```ts
 * import { hashVersionedEmbeddingKeySync, sha256SyncFull } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const metadata = { providerId: "voyage", modelId: "voyage-3", dimension: 1024 }
 *   const hex = yield* hashVersionedEmbeddingKeySync("Ada Lovelace", "search_query", metadata)
 *   console.log(hex === (yield* sha256SyncFull("voyage::voyage-3::1024::search_query::Ada Lovelace"))) // true
 * })
 * console.log(program)
 * ```
 *
 * @see {@link hashVersionedEmbeddingKey} for the primary Effect constructor.
 * @category utilities
 * @since 0.0.0
 */
export const hashVersionedEmbeddingKeySync = hashVersionedEmbeddingKey;

/**
 * Computes a full SHA-256 hex digest of bytes through the Effect Crypto service.
 *
 * **Example** (Hash bytes through the Effect Crypto service)
 *
 * ```ts
 * import { sha256Bytes, sha256BytesSync } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const bytes = new TextEncoder().encode("ada")
 *   const hex = (yield* sha256Bytes(bytes))
 *   console.log(hex.length) // 64
 *   console.log(hex === (yield* sha256BytesSync(bytes))) // true
 * })
 * console.log(program)
 * ```
 *
 * @see {@link sha256BytesSync} for the Effect-returning compatibility twin.
 * @category utilities
 * @since 0.0.0
 */
export const sha256Bytes = Effect.fn("Hash.sha256Bytes")(function* (bytes: BufferSource) {
  const crypto = yield* Crypto.Crypto;
  const input = ArrayBuffer.isView(bytes)
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new Uint8Array(bytes);
  const digest = yield* crypto
    .digest("SHA-256", input)
    .pipe(Effect.mapError((cause) => HashingError.make({ operation: "sha256-bytes", cause })));
  return Hex.encode(digest);
});

/**
 * Computes a full SHA-256 hex digest of bytes through the Effect Crypto service.
 *
 * **Gotchas**
 *
 * Returns an Effect requiring Crypto.Crypto; the legacy Sync suffix is retained for compatibility.
 *
 * **Example** (Hash bytes on the server)
 *
 * ```ts
 * import { sha256BytesSync } from "@effect-ontology/Utils/Hash"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const hex = yield* sha256BytesSync(new TextEncoder().encode("ada"))
 *   console.log(hex.length) // 64
 * })
 * console.log(program)
 * ```
 *
 * @see {@link sha256Bytes} for the primary Effect constructor.
 * @category utilities
 * @since 0.0.0
 */
export const sha256BytesSync = sha256Bytes;
