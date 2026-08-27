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
import { LiteralKit } from "@beep/schema";
import type { Effect } from "effect";
import { Context } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
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
 * **Example** (Recognize a query task)
 *
 * ```ts
 * import { EmbeddingTaskType } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * console.log(EmbeddingTaskType.is.search_query("search_query")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EmbeddingTaskType = LiteralKit(["search_query", "search_document", "clustering", "classification"]).pipe(
  $I.annoteSchema("EmbeddingTaskType", {
    description: "Embedding task semantics supported across configured providers.",
  })
);

/**
 * Runtime value accepted by {@link EmbeddingTaskType}.
 *
 * **Example** (Use a clustering task value)
 *
 * ```ts
 * import type { EmbeddingTaskType } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * const task: EmbeddingTaskType = "clustering"
 * console.log(task) // "clustering"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingTaskType = typeof EmbeddingTaskType.Type;

/**
 * Embedding vector type
 *
 * **Example** (Validate a finite vector)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Embedding } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * console.log(S.is(Embedding)([0.1, 0.2])) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Embedding = S.Array(S.Finite).pipe(
  $I.annoteSchema("Embedding", {
    description: "Finite numeric vector returned by an embedding provider.",
  })
);

/**
 * Runtime vector decoded by {@link Embedding}.
 *
 * **Example** (Inspect a decoded vector)
 *
 * ```ts
 * import type { Embedding } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * const vector: Embedding = [0.1, 0.2]
 * console.log(vector.length) // 2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Embedding = typeof Embedding.Type;

/**
 * Embedding request for batching
 *
 *
 * **Example** (Create an embedding request)
 *
 * ```ts
 * import { EmbeddingRequest } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * console.log(EmbeddingRequest.make({ text: "Ada", taskType: "search_query" }).taskType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class EmbeddingRequest extends S.Class<EmbeddingRequest>($I`EmbeddingRequest`)(
  {
    text: S.String,
    taskType: EmbeddingTaskType,
  },
  $I.annote("EmbeddingRequest", {
    description: "Text paired with the provider-specific semantic embedding task.",
  })
) {}

/**
 * Provider metadata for cache key generation and configuration
 *
 *
 * **Example** (Create provider metadata)
 *
 * ```ts
 * import { ProviderMetadata } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * const metadata = ProviderMetadata.make({ providerId: "nomic", modelId: "nomic-v1", dimension: 768 })
 * console.log(metadata.dimension) // 768
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class ProviderMetadata extends S.Class<ProviderMetadata>($I`ProviderMetadata`)(
  {
    providerId: LiteralKit(["nomic", "voyage", "openai"]),
    modelId: S.NonEmptyString,
    dimension: S.Finite.check(
      S.isGreaterThan(0, {
        message: "Embedding dimension must be greater than zero.",
      })
    ),
  },
  $I.annote("ProviderMetadata", {
    description: "Stable provider, model, and positive native vector dimension metadata.",
  })
) {}

/**
 * EmbeddingProvider service interface
 *
 * **Details**
 *
 * Providers implement this interface to expose their embedding capabilities.
 * The service layer handles caching, deduplication, and batching.
 *
 * **Example** (Implement a deterministic provider)
 *
 * ```ts
 * import { ProviderMetadata } from "@effect-ontology/Service/EmbeddingProvider"
 * import type { EmbeddingProviderMethods } from "@effect-ontology/Service/EmbeddingProvider"
 * import * as Effect from "effect/Effect"
 *
 * const provider: EmbeddingProviderMethods = {
 *   metadata: ProviderMetadata.make({ providerId: "nomic", modelId: "demo", dimension: 2 }),
 *   embedBatch: () => Effect.succeed([[1, 0]]),
 *   cosineSimilarity: () => 1
 * }
 * console.log(provider.metadata.dimension) // 2
 * ```
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
 * Context tag for a provider-agnostic embedding implementation.
 *
 * **Example** (Embed with a test provider)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import {
 *   EmbeddingProvider,
 *   EmbeddingRequest,
 *   ProviderMetadata,
 *   cosineSimilarity
 * } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * const TestProvider = Layer.succeed(EmbeddingProvider, {
 *   metadata: ProviderMetadata.make({ providerId: "nomic", modelId: "demo", dimension: 2 }),
 *   embedBatch: (requests) => Effect.succeed(requests.map(() => [1, 0])),
 *   cosineSimilarity
 * })
 *
 * const length = Effect.runSync(
 *   Effect.gen(function* () {
 *     const provider = yield* EmbeddingProvider
 *     const embeddings = yield* provider.embedBatch([
 *       EmbeddingRequest.make({ text: "Ada founded Acme.", taskType: "search_document" })
 *     ])
 *     return embeddings[0]?.length ?? 0
 *   }).pipe(Effect.provide(TestProvider), Effect.orDie)
 * )
 * console.log(length) // 2
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EmbeddingProvider extends Context.Service<EmbeddingProvider, EmbeddingProviderMethods>()(
  $I`EmbeddingProvider`
) {}

/**
 * Compute cosine similarity between two finite embedding vectors.
 *
 * **Details**
 *
 * Pure math extracted from provider implementations so cache, fallback, and
 * NLP layers can share one scoring function.
 *
 * **Gotchas**
 *
 * Unequal lengths, empty vectors, and zero-norm vectors return `0` rather than
 * failing. Treat that `0` as incomparable, not as geometric orthogonality.
 *
 * **Example** (Score aligned and degenerate pairs)
 *
 * ```ts
 * import { cosineSimilarity } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * console.log(cosineSimilarity([1, 0], [1, 0])) // 1
 * console.log(cosineSimilarity([1, 0], [1])) // 0
 * console.log(cosineSimilarity([0, 0], [1, 0])) // 0
 * ```
 *
 * @category utilities
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
