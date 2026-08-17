/**
 * Effect Request API for Embedding Batching
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
 * Uses Request.tagged for automatic batching via RequestResolver.
 * Requests with the same properties are deduplicated automatically.
 *
 * @since 0.0.0
 * @category type-level
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
 * @since 0.0.0
 * @category constructors
 */
export const EmbedTextRequest = Request.tagged<EmbedTextRequest>("EmbedTextRequest");

/**
 * Generate a unique hash for an embedding request
 *
 * Used for request deduplication within a batch window.
 * Format: providerId::modelId::taskType::text
 *
 * @since 0.0.0
 * @category utilities
 */
export const embedRequestHash = (req: EmbedTextRequest): string =>
  `${req.metadata.providerId}::${req.metadata.modelId}::${req.taskType}::${req.text}`;
