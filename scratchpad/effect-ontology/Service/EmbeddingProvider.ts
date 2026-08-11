/**
 * EmbeddingProvider - Provider-agnostic embedding interface
 *
 * Abstracts over Nomic (local), Voyage (API), and future providers.
 * Enables dynamic provider selection based on configuration.
 *
 * @since 2.0.0
 * @module Service/EmbeddingProvider
 */

import { $ScratchpadId } from "@beep/identity";
import type { Effect } from "effect";
import { Context } from "effect";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingProvider");

/**
 * Task types for embeddings
 *
 * Voyage-compatible superset:
 * - search_query: For query text (optimized for search)
 * - search_document: For document text (optimized for indexing)
 * - clustering: For clustering tasks
 * - classification: For classification tasks
 *
 * @since 2.0.0
 * @category Types
 */
export type EmbeddingTaskType = "search_query" | "search_document" | "clustering" | "classification";

/**
 * Embedding vector type
 *
 * @since 2.0.0
 * @category Types
 */
export type Embedding = ReadonlyArray<number>;

/**
 * Embedding request for batching
 *
 * @since 2.0.0
 * @category Types
 */
export interface EmbeddingRequest {
  readonly text: string;
  readonly taskType: EmbeddingTaskType;
}

/**
 * Provider metadata for cache key generation and configuration
 *
 * @since 2.0.0
 * @category Types
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
 * Providers implement this interface to expose their embedding capabilities.
 * The service layer handles caching, deduplication, and batching.
 *
 * @since 2.0.0
 * @category Service
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
 * @since 2.0.0
 * @category Service
 */
export class EmbeddingProvider extends Context.Service<EmbeddingProvider, EmbeddingProviderMethods>()(
  $I`EmbeddingProvider`
) {}

/**
 * Compute cosine similarity between two vectors
 *
 * Extracted as a utility function since it's pure math and doesn't
 * depend on the provider. Can be shared across implementations.
 *
 * @since 2.0.0
 * @category Utilities
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const cosineSimilarity = (a: Embedding, b: Embedding): number => {
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
};
