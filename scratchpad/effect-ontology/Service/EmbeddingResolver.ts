/**
 * Batched Request Resolver for Embeddings
 *
 * Collects multiple EmbedTextRequest into batches and resolves
 * them with a single provider call.
 *
 * @since 2.0.0
 * @module Service/EmbeddingResolver
 */

import { Array, Effect, Exit, Request, RequestResolver } from "effect"
import type { EmbeddingProviderMethods, EmbeddingTaskType } from "./EmbeddingProvider.ts"
import type { EmbedTextRequest } from "./EmbeddingRequest.ts"

/**
 * Default maximum batch size for embedding requests
 *
 * Voyage API limit is 128 texts per request.
 *
 * @since 2.0.0
 * @category Constants
 */
export const DEFAULT_MAX_BATCH_SIZE = 128

/**
 * Create a batched resolver for embedding requests
 *
 * Features:
 * - Groups requests by taskType for optimal batching (Voyage requires same input_type per batch)
 * - Chunks into maxBatchSize to respect API limits
 * - Completes each request with corresponding result
 * - Propagates errors to all requests in failed batch
 *
 * @param provider - The embedding provider to use
 * @param maxBatchSize - Maximum requests per batch (default: 128)
 * @returns RequestResolver for EmbedTextRequest
 *
 * @since 2.0.0
 * @category Constructors
 */
export const makeEmbeddingResolver = (
  provider: EmbeddingProviderMethods,
  maxBatchSize: number = DEFAULT_MAX_BATCH_SIZE
): RequestResolver.RequestResolver<EmbedTextRequest, never> =>
  RequestResolver.makeBatched((requests: ReadonlyArray<EmbedTextRequest>) =>
    Effect.gen(function*() {
      if (requests.length === 0) return

      // Group by taskType for optimal batching (Voyage requires same input_type per batch)
      const grouped = Array.groupBy(requests as Array<EmbedTextRequest>, (r) => r.taskType)

      for (const [_taskType, batch] of Object.entries(grouped)) {
        // Chunk into maxBatchSize (Voyage limit: 128 texts)
        const chunks = Array.chunksOf(batch, maxBatchSize)

        for (const chunk of chunks) {
          if (chunk.length === 0) continue
          yield* processChunk(provider, chunk)
        }
      }
    })
  ).pipe(RequestResolver.batchN(maxBatchSize))

/**
 * Process a single chunk of embedding requests
 *
 * @internal
 */
const processChunk = (
  provider: EmbeddingProviderMethods,
  chunk: ReadonlyArray<EmbedTextRequest>
): Effect.Effect<void, never, never> =>
  provider
    .embedBatch(
      chunk.map((r) => ({
        text: r.text,
        taskType: r.taskType as EmbeddingTaskType
      }))
    )
    .pipe(
      Effect.matchEffect({
        onSuccess: (embeddings) =>
          Effect.forEach(
            chunk,
            (req, i) => Request.complete(req, Exit.succeed(embeddings[i])),
            { discard: true }
          ),
        onFailure: (error) =>
          Effect.forEach(
            chunk,
            (req) => Request.complete(req, Exit.fail(error)),
            { discard: true }
          )
      })
    )
