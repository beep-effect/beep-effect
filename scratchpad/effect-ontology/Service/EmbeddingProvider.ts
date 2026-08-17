/**
 * EmbeddingProvider - Provider-agnostic embedding interface
 *
 * **Details**
 *
 * Abstracts over Nomic (local), Voyage (API), and future providers.
 * Enables dynamic provider selection based on configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { Effect } from "effect";
import { Context } from "effect";
import { dual } from "effect/Function";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingProvider");

/**
 * Task types for embeddings
 *
 * **Details**
 *
 * Voyage-compatible superset:
 * - search_query: For query text (optimized for search)
 * - search_document: For document text (optimized for indexing)
 * - clustering: For clustering tasks
 * - classification: For classification tasks
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingTaskType = "search_query" | "search_document" | "clustering" | "classification";

/**
 * Embedding vector type
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type Embedding = ReadonlyArray<number>;

/**
 * Embedding request for batching
 *
 *
 * **Example** (Use the EmbeddingRequest contract)
 *
 * ```ts
 * import type { EmbeddingRequest } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * const acceptsEmbeddingRequest = (_value: EmbeddingRequest): void => undefined
 *
 * console.log(acceptsEmbeddingRequest)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingRequest {
  readonly text: string;
  readonly taskType: EmbeddingTaskType;
}

/**
 * Provider metadata for cache key generation and configuration
 *
 *
 * **Example** (Use the ProviderMetadata contract)
 *
 * ```ts
 * import type { ProviderMetadata } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * const acceptsProviderMetadata = (_value: ProviderMetadata): void => undefined
 *
 * console.log(acceptsProviderMetadata)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ProviderMetadata {
  /**
   * Provider identifier (nomic, voyage, openai)
   */
  readonly providerId: "nomic" | "voyage" | "openai";

  /**
   * Model identifier (e.g., "voyage-3.5-lite", "nomic-embed-text-v1.5")
   */
  readonly modelId: string;

  /**
   * Native embedding dimension (e.g., 512, 768, 1024)
   */
  readonly dimension: number;
}

/**
 * EmbeddingProvider service interface
 *
 * **Details**
 *
 * Providers implement this interface to expose their embedding capabilities.
 * The service layer handles caching, deduplication, and batching.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingProviderMethods {
  /**
   * Get provider metadata (used for cache key generation)
   */
  readonly metadata: ProviderMetadata;

  /**
   * Embed a batch of texts
   *
   * Providers should implement efficient batching internally.
   * Results must be returned in the same order as inputs.
   *
   * @param requests - Array of embedding requests
   * @returns Array of embedding vectors in input order
   */
  readonly embedBatch: (
    requests: ReadonlyArray<EmbeddingRequest>
  ) => Effect.Effect<ReadonlyArray<Embedding>, AnyEmbeddingError>;

  /**
   * Compute cosine similarity between two vectors
   *
   * Pure function for computing vector similarity.
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score between -1 and 1
   */
  readonly cosineSimilarity: (a: Embedding, b: Embedding) => number;
}

/**
 * EmbeddingProvider service tag
 *
 * **Example** (Inspect embedding provider)
 *
 * ```ts
 * import { EmbeddingProvider } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * console.log(EmbeddingProvider)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EmbeddingProvider extends Context.Service<EmbeddingProvider, EmbeddingProviderMethods>()(
  $I`EmbeddingProvider`
) {}

/**
 * Compute cosine similarity between two vectors
 *
 * **Details**
 *
 * Extracted as a utility function since it's pure math and doesn't
 * depend on the provider. Can be shared across implementations.
 *
 * **Example** (Inspect cosine similarity)
 *
 * ```ts
 * import { cosineSimilarity } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * console.log(cosineSimilarity)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const cosineSimilarity: {
  (b: Embedding): (a: Embedding) => number;
  (a: Embedding, b: Embedding): number;
} = dual(2, (a: Embedding, b: Embedding): number => {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
});
