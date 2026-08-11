/**
 * Nomic Embedding Provider
 *
 * Wraps existing NomicNlpService as EmbeddingProvider interface.
 * Enables local inference via Transformers.js.
 *
 * @since 2.0.0
 * @module Service/NomicEmbeddingProvider
 */

import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { EmbeddingError } from "../Domain/Error/Embedding.ts";
import { ConfigService } from "./Config.ts";
import type { EmbeddingProviderMethods, EmbeddingRequest, ProviderMetadata } from "./EmbeddingProvider.ts";
import { cosineSimilarity, EmbeddingProvider } from "./EmbeddingProvider.ts";
import type { NomicTaskType } from "./NomicNlp.ts";
import { NomicNlpService, NomicNlpServiceLive } from "./NomicNlp.ts";

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
      return "search_query";
    case "search_document":
      return "search_document";
    case "clustering":
      return "clustering";
    case "classification":
      return "classification";
    default:
      return "search_document";
  }
};

/**
 * Create NomicEmbeddingProvider from NomicNlpService
 *
 * @since 2.0.0
 * @category Layers
 */
export const NomicEmbeddingProviderLive: Layer.Layer<EmbeddingProvider, never, NomicNlpService | ConfigService> =
  Layer.effect(
    EmbeddingProvider,
    Effect.gen(function* () {
      const nomic = yield* NomicNlpService;
      const config = yield* ConfigService;

      const metadata: ProviderMetadata = {
        providerId: "nomic",
        modelId: config.embedding.transformersModelId,
        dimension: config.embedding.dimension,
      };

      const embedBatch: EmbeddingProviderMethods["embedBatch"] = Effect.fn("NomicEmbeddingProvider.embedBatch")(
        function* (requests: ReadonlyArray<EmbeddingRequest>) {
          if (requests.length === 0) {
            return [];
          }
          const taskType = mapTaskType(requests[0].taskType);
          const texts = A.map(requests, (request) => request.text);
          return yield* nomic.embedBatch(texts, taskType, config.embedding.dimension);
        },
        Effect.mapError((error) =>
          EmbeddingError.make({
            message: error.message,
            provider: "nomic",
            cause: O.some(error.cause),
          })
        )
      );

      const methods: EmbeddingProviderMethods = {
        metadata,
        embedBatch,
        cosineSimilarity,
      };

      return methods;
    })
  );

/**
 * Complete Nomic provider with all dependencies
 *
 * Includes NomicNlpService layer.
 *
 * @since 2.0.0
 * @category Layers
 */
export const NomicEmbeddingProviderDefault: Layer.Layer<EmbeddingProvider, never, ConfigService> =
  NomicEmbeddingProviderLive.pipe(Layer.provide(NomicNlpServiceLive));
