/**
 * Nomic Embedding Provider
 *
 * **Details**
 *
 * Wraps existing NomicNlpService as EmbeddingProvider interface.
 * Enables local inference via Transformers.js.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer, Match } from "effect";
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
const mapTaskType = (taskType: string): NomicTaskType =>
  Match.value(taskType).pipe(
    Match.when("search_query", (): NomicTaskType => "search_query"),
    Match.when("clustering", (): NomicTaskType => "clustering"),
    Match.when("classification", (): NomicTaskType => "classification"),
    Match.orElse((): NomicTaskType => "search_document")
  );

/**
 * Create NomicEmbeddingProvider from NomicNlpService
 *
 * **Example** (Inspect nomic embedding provider live)
 *
 * ```ts
 * import { NomicEmbeddingProviderLive } from "@effect-ontology/Service/NomicEmbeddingProvider"
 *
 * console.log(NomicEmbeddingProviderLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
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
          if (A.isReadonlyArrayEmpty(requests)) {
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
 * **Details**
 *
 * Includes NomicNlpService layer.
 *
 * **Example** (Inspect nomic embedding provider default)
 *
 * ```ts
 * import { NomicEmbeddingProviderDefault } from "@effect-ontology/Service/NomicEmbeddingProvider"
 *
 * console.log(NomicEmbeddingProviderDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicEmbeddingProviderDefault: Layer.Layer<EmbeddingProvider, never, ConfigService> =
  NomicEmbeddingProviderLive.pipe(Layer.provide(NomicNlpServiceLive));
