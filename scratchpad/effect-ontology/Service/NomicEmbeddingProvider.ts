/**
 * Nomic Embedding Provider
 *
 * Wraps existing NomicNlpService as EmbeddingProvider interface.
 * Enables local inference via Transformers.js.
 *
 * @since 2.0.0
 * @module Service/NomicEmbeddingProvider
 */

import { Effect, Layer } from "effect"
import { EmbeddingError } from "../Domain/Error/Embedding.ts"
import { ConfigService } from "./Config.ts"
import {
  cosineSimilarity,
  EmbeddingProvider,
  type EmbeddingProviderMethods,
  type EmbeddingRequest,
  type ProviderMetadata
} from "./EmbeddingProvider.ts"
import { NomicNlpService, NomicNlpServiceLive, type NomicTaskType } from "./NomicNlp.ts"
import * as O from "effect/Option";

/**
 * Map EmbeddingTaskType to NomicTaskType
 *
 * Both use the same values, but this makes the mapping explicit.
 *
 * @internal
 */
const mapTaskType = (taskType: string): NomicTaskType => {
  switch (taskType) {
    case "search_query":
      return "search_query"
    case "search_document":
      return "search_document"
    case "clustering":
      return "clustering"
    case "classification":
      return "classification"
    default:
      return "search_document"
  }
}

/**
 * Create NomicEmbeddingProvider from NomicNlpService
 *
 * @since 2.0.0
 * @category Layers
 */
export const NomicEmbeddingProviderLive: Layer.Layer<
  EmbeddingProvider,
  never,
  NomicNlpService | ConfigService
> = Layer.effect(
  EmbeddingProvider,
  Effect.gen(function*() {
    const nomic = yield* NomicNlpService
    const config = yield* ConfigService

    const metadata: ProviderMetadata = {
      providerId: "nomic",
      modelId: config.embedding.transformersModelId,
      dimension: config.embedding.dimension
    }

    const methods: EmbeddingProviderMethods = {
      metadata,

      embedBatch: (requests: ReadonlyArray<EmbeddingRequest>) =>
        Effect.gen(function*() {
          if (requests.length === 0) {
            return []
          }

          // Use first request's taskType for the batch
          // (Nomic doesn't require same type per batch, but it's more consistent)
          const taskType = mapTaskType(requests[0].taskType)
          const texts = requests.map((r) => r.text)

          const embeddings = yield* nomic.embedBatch(texts, taskType, config.embedding.dimension)

          return embeddings
        }).pipe(
          Effect.mapError(
            (error) =>
              EmbeddingError.make({
                message: error.message,
                provider: "nomic",
                cause: O.some(error.cause)
              })
          )
        ),

      cosineSimilarity
    }

    return methods
  })
)

/**
 * Complete Nomic provider with all dependencies
 *
 * Includes NomicNlpService layer.
 *
 * @since 2.0.0
 * @category Layers
 */
export const NomicEmbeddingProviderDefault: Layer.Layer<EmbeddingProvider, never, ConfigService> =
  NomicEmbeddingProviderLive.pipe(Layer.provide(NomicNlpServiceLive))
