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
 * Tagged Effect Request constructor for a single embedding.
 *
 * **Example** (Build a tagged embed request)
 *
 * ```ts
 * import { ProviderMetadata } from "@effect-ontology/Service/EmbeddingProvider"
 * import { EmbedTextRequest } from "@effect-ontology/Service/EmbeddingRequest"
 *
 * const request = EmbedTextRequest({
 *   text: "Ada founded Acme.",
 *   taskType: "search_document",
 *   metadata: ProviderMetadata.make({ providerId: "nomic", modelId: "nomic-v1", dimension: 768 })
 * })
 * console.log(request._tag) // "EmbedTextRequest"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const EmbedTextRequest = Request.tagged<EmbedTextRequest>("EmbedTextRequest");

/**
 * Build the batch-window deduplication key for an embedding request.
 *
 * **Details**
 *
 * Format is `providerId::modelId::taskType::text`. Requests that share this
 * key collapse inside the resolver window.
 *
 * **Example** (Hash a tagged request)
 *
 * ```ts
 * import { ProviderMetadata } from "@effect-ontology/Service/EmbeddingProvider"
 * import { EmbedTextRequest, embedRequestHash } from "@effect-ontology/Service/EmbeddingRequest"
 *
 * const request = EmbedTextRequest({
 *   text: "Ada founded Acme.",
 *   taskType: "search_document",
 *   metadata: ProviderMetadata.make({ providerId: "nomic", modelId: "nomic-v1", dimension: 768 })
 * })
 * console.log(embedRequestHash(request)) // "nomic::nomic-v1::search_document::Ada founded Acme."
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const embedRequestHash = (req: EmbedTextRequest): string =>
  `${req.metadata.providerId}::${req.metadata.modelId}::${req.taskType}::${req.text}`;
