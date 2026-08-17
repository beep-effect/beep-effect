/**
 * Batched Request Resolver for Embeddings
 *
 * **Details**
 *
 * Collects multiple EmbedTextRequest into batches and resolves
 * them with a single provider call.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Exit, Request, RequestResolver } from "effect";
import * as A from "effect/Array";
import { dual2 } from "../Utils/Dual.ts";
import type { EmbeddingProviderMethods, EmbeddingTaskType } from "./EmbeddingProvider.ts";
import type { EmbedTextRequest } from "./EmbeddingRequest.ts";

/**
 * Default maximum batch size for embedding requests
 *
 * **Details**
 *
 * Voyage API limit is 128 texts per request.
 *
 * **Example** (Inspect default max batch size)
 *
 * ```ts
 * import { DEFAULT_MAX_BATCH_SIZE } from "@effect-ontology/Service/EmbeddingResolver"
 *
 * console.log(DEFAULT_MAX_BATCH_SIZE)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_MAX_BATCH_SIZE = 128;

/**
 * Create a batched resolver for embedding requests
 *
 * **Details**
 *
 * Features:
 * - Groups requests by taskType for optimal batching (Voyage requires same input_type per batch)
 * - Chunks into maxBatchSize to respect API limits
 * - Completes each request with corresponding result
 * - Propagates errors to all requests in failed batch
 *
 * **Example** (Inspect make embedding resolver)
 *
 * ```ts
 * import { makeEmbeddingResolver } from "@effect-ontology/Service/EmbeddingResolver"
 *
 * console.log(makeEmbeddingResolver)
 * ```
 *
 * @param provider - The embedding provider to use
 * @param maxBatchSize - Maximum requests per batch (default: 128)
 * @returns RequestResolver for EmbedTextRequest
 * @category constructors
 * @since 0.0.0
 */
export const makeEmbeddingResolver = dual2(
  (provider: EmbeddingProviderMethods, maxBatchSize: number): RequestResolver.RequestResolver<EmbedTextRequest> =>
    RequestResolver.makeGrouped<EmbedTextRequest, EmbeddingTaskType>({
      key: (entry) => entry.request.taskType,
      resolver: (entries) =>
        Effect.forEach(A.chunksOf(entries, maxBatchSize), (chunk) => processChunk(provider, chunk), { discard: true }),
    }).pipe(RequestResolver.batchN(maxBatchSize))
);

/**
 * Process a single chunk of embedding requests
 *
 * @internal
 */
const processChunk = (
  provider: EmbeddingProviderMethods,
  chunk: ReadonlyArray<Request.Entry<EmbedTextRequest>>
): Effect.Effect<void, never, never> =>
  provider
    .embedBatch(
      A.map(chunk, (entry) => ({
        text: entry.request.text,
        taskType: entry.request.taskType,
      }))
    )
    .pipe(
      Effect.matchEffect({
        onSuccess: (embeddings) =>
          Effect.forEach(chunk, (entry, i) => Request.complete(entry, Exit.succeed(embeddings[i])), { discard: true }),
        onFailure: (error) =>
          Effect.forEach(chunk, (entry) => Request.complete(entry, Exit.fail(error)), { discard: true }),
      })
    );
