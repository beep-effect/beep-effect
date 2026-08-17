/**
 * Effect Request API for Embedding Batching
 *
 * **Details**
 *
 * Uses Effect.Request and RequestResolver for automatic:
 * - Request deduplication (same text+taskType+provider)
 * - Batch window collection
 * - Type-safe request/response handling
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Request } from "effect";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { Embedding, EmbeddingTaskType, ProviderMetadata } from "./EmbeddingProvider.ts";

/**
 * Request to embed a single text
 *
 * **Details**
 *
 * Uses Request.tagged for automatic batching via RequestResolver.
 * Requests with the same properties are deduplicated automatically.
 *
 *
 * **Example** (Use the EmbedTextRequest contract)
 *
 * ```ts
 * import type { EmbedTextRequest } from "@effect-ontology/Service/EmbeddingRequest"
 *
 * const acceptsEmbedTextRequest = (_value: EmbedTextRequest): void => undefined
 *
 * console.log(acceptsEmbedTextRequest)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbedTextRequest extends Request.Request<Embedding, AnyEmbeddingError> {
  readonly _tag: "EmbedTextRequest";
  readonly text: string;
  readonly taskType: EmbeddingTaskType;
  readonly metadata: ProviderMetadata;
}

/**
 * EmbedTextRequest constructor
 *
 * **Example** (Inspect embed text request)
 *
 * ```ts
 * import { EmbedTextRequest } from "@effect-ontology/Service/EmbeddingRequest"
 *
 * console.log(EmbedTextRequest)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const EmbedTextRequest = Request.tagged<EmbedTextRequest>("EmbedTextRequest");

/**
 * Generate a unique hash for an embedding request
 *
 * **Details**
 *
 * Used for request deduplication within a batch window.
 * Format: providerId::modelId::taskType::text
 *
 * **Example** (Inspect embed request hash)
 *
 * ```ts
 * import { embedRequestHash } from "@effect-ontology/Service/EmbeddingRequest"
 *
 * console.log(embedRequestHash)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const embedRequestHash = (req: EmbedTextRequest): string =>
  `${req.metadata.providerId}::${req.metadata.modelId}::${req.taskType}::${req.text}`;
