/**
 * Embedding Fallback Service
 *
 * **Details**
 *
 * Provides circuit breaker protection and automatic provider fallback.
 * When the primary provider (Voyage) fails, automatically falls back to
 * secondary provider (Nomic).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Effect, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import { EmbeddingError } from "../Domain/Error/Embedding.ts";
import { CircuitOpenError } from "../Runtime/CircuitBreaker.ts";
import { ConfigService } from "./Config.ts";
import type { EmbeddingCircuitBreakerService } from "./EmbeddingCircuitBreaker.ts";
import { EmbeddingCircuitBreaker, EmbeddingProviderId } from "./EmbeddingCircuitBreaker.ts";
import type { Embedding, EmbeddingProviderMethods, EmbeddingRequest } from "./EmbeddingProvider.ts";
import { cosineSimilarity, EmbeddingProvider } from "./EmbeddingProvider.ts";
import { EmbeddingRateLimiter, EmbeddingRateLimiterVoyage } from "./EmbeddingRateLimiter.ts";
import { NomicNlpService } from "./NomicNlp.ts";
import { makeVoyageProvider, VoyageModel } from "./VoyageEmbeddingProvider.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingFallback");

// =============================================================================
// Types
// =============================================================================

/**
 * Fallback chain configuration
 *
 *
 * **Example** (Create a fallback chain)
 *
 * ```ts
 * import { FallbackChainConfig } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * console.log(FallbackChainConfig.make({ providers: ["voyage", "nomic"], logFallbacks: true }).providers.length) // 2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class FallbackChainConfig extends S.Class<FallbackChainConfig>($I`FallbackChainConfig`)(
  {
    providers: S.Array(EmbeddingProviderId),
    logFallbacks: S.Boolean,
  },
  $I.annote("FallbackChainConfig", {
    description: "Ordered embedding providers and fallback-switch logging policy.",
  })
) {}

/**
 * Active provider tracking for observability
 *
 *
 * **Example** (Create active-provider state)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ActiveProviderInfo } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * const info = ActiveProviderInfo.make({ currentProvider: "voyage", fallbackCount: 0 })
 * console.log(O.isNone(info.lastFallbackReason)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class ActiveProviderInfo extends S.Class<ActiveProviderInfo>($I`ActiveProviderInfo`)(
  {
    currentProvider: EmbeddingProviderId,
    fallbackCount: S.Int.check(S.isGreaterThanOrEqualTo(0, { message: "Fallback count must be non-negative." })),
    lastFallbackReason: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ActiveProviderInfo", {
    description: "Current embedding provider, fallback count, and optional last fallback reason.",
  })
) {}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default fallback chain: Voyage -> Nomic
 *
 * **Example** (Inspect default fallback chain)
 *
 * ```ts
 * import { DEFAULT_FALLBACK_CHAIN } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * console.log(DEFAULT_FALLBACK_CHAIN)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_FALLBACK_CHAIN = FallbackChainConfig.make({
  providers: ["voyage", "nomic"],
  logFallbacks: true,
});

// =============================================================================
// Service
// =============================================================================

/**
 * Make embedding provider methods with circuit breaker protection
 *
 * @internal
 */
const makeProtectedProvider = (
  providerId: EmbeddingProviderId,
  provider: EmbeddingProviderMethods,
  circuitBreaker: EmbeddingCircuitBreakerService
): EmbeddingProviderMethods => ({
  metadata: provider.metadata,
  embedBatch: (requests) =>
    circuitBreaker.protect(providerId, provider.embedBatch(requests)).pipe(
      // Map CircuitOpenError to EmbeddingError
      Effect.catchTag("CircuitOpenError", (circuitError) =>
        Effect.fail(
          EmbeddingError.make({
            message: `Circuit breaker open for ${providerId}: retry after ${circuitError.retryAfterMs}ms`,
            provider: providerId,
            cause: O.some(circuitError),
          })
        )
      )
    ),
  cosineSimilarity: provider.cosineSimilarity,
});

/**
 * Create fallback embedding provider layer
 *
 * **Details**
 *
 * Wraps providers with circuit breaker protection and fallback logic.
 *
 * **Example** (Inspect embedding provider fallback live)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingProvider } from "@effect-ontology/Service/EmbeddingProvider"
 * import { EmbeddingProviderFallbackLive } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* EmbeddingProvider
 *   return provider.metadata.providerId
 * }).pipe(Effect.provide(EmbeddingProviderFallbackLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingProviderFallbackLive: Layer.Layer<
  EmbeddingProvider,
  AnyEmbeddingError,
  ConfigService | EmbeddingCircuitBreaker | EmbeddingRateLimiter | HttpClient.HttpClient | NomicNlpService
> = Layer.effect(
  EmbeddingProvider,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const circuitBreaker = yield* EmbeddingCircuitBreaker;
    const rateLimiter = yield* EmbeddingRateLimiter;
    const httpClient = yield* HttpClient.HttpClient;
    const nomicNlp = yield* NomicNlpService;

    // Track which provider is currently active
    const activeProviderRef = yield* Ref.make(
      ActiveProviderInfo.make({
        currentProvider: "voyage",
        fallbackCount: 0,
      })
    );

    // Create Voyage provider if API key is configured
    const voyageApiKey = O.getOrNull(config.embedding.voyageApiKey);
    const voyageModel = yield* VoyageModel.decodeUnknownEffect(config.embedding.voyageModel).pipe(
      Effect.mapError((cause) =>
        EmbeddingError.make({
          message: `Unsupported Voyage embedding model: ${config.embedding.voyageModel}`,
          provider: "voyage",
          cause: O.some(cause),
        })
      )
    );

    const voyageProvider: EmbeddingProviderMethods | null = P.isNotNull(voyageApiKey)
      ? yield* makeVoyageProvider({
          apiKey: voyageApiKey,
          model: voyageModel,
          timeout: config.embedding.timeout,
        }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient),
          Effect.provideService(EmbeddingRateLimiter, rateLimiter)
        )
      : null;

    // Create Nomic provider (wraps NomicNlpService)
    const nomicProvider: EmbeddingProviderMethods = {
      metadata: {
        providerId: "nomic",
        modelId: "nomic-embed-text-v1.5",
        dimension: 768,
      },
      embedBatch: (requests: ReadonlyArray<EmbeddingRequest>) =>
        Effect.forEach(
          requests,
          (req) =>
            nomicNlp.embed(req.text, req.taskType === "search_query" ? "search_query" : "search_document").pipe(
              Effect.mapError((e) =>
                EmbeddingError.make({
                  message: `Nomic embedding error: ${e.message}`,
                  provider: "nomic",
                  cause: O.some(e),
                })
              )
            ),
          { concurrency: 1 }
        ),
      cosineSimilarity,
    };

    // Protect providers with circuit breakers
    const protectedVoyage = P.isNotNull(voyageProvider)
      ? makeProtectedProvider("voyage", voyageProvider, circuitBreaker)
      : null;
    const protectedNomic = makeProtectedProvider("nomic", nomicProvider, circuitBreaker);

    // Provider order based on config
    const primaryProvider = protectedVoyage ?? protectedNomic;
    const fallbackProvider = P.isNotNull(protectedVoyage) ? protectedNomic : null;

    /**
     * Get error reason string from an error
     */
    const getErrorReason = (error: AnyEmbeddingError): string =>
      CircuitOpenError.is(error) ? "circuit_open" : EmbeddingError.is(error) ? error._tag : "unknown";

    /**
     * Execute request with fallback logic
     */
    const executeWithFallback = (
      requests: ReadonlyArray<EmbeddingRequest>
    ): Effect.Effect<ReadonlyArray<Embedding>, AnyEmbeddingError> =>
      primaryProvider.embedBatch(requests).pipe(
        Effect.catch((primaryError) => {
          // No fallback provider - propagate the error
          if (P.isNull(fallbackProvider)) {
            return Effect.fail(primaryError);
          }

          const reason = getErrorReason(primaryError);

          // Log fallback and update tracking
          return Ref.update(
            activeProviderRef,
            (info): ActiveProviderInfo =>
              ActiveProviderInfo.make({
                currentProvider: "nomic",
                fallbackCount: info.fallbackCount + 1,
                lastFallbackReason: O.some(reason),
              })
          ).pipe(
            Effect.tap(() =>
              Effect.logWarning(
                `Embedding provider fallback triggered: ${primaryProvider.metadata.providerId} -> nomic`,
                { reason, requestCount: requests.length }
              )
            ),
            Effect.flatMap(() =>
              fallbackProvider.embedBatch(requests).pipe(
                Effect.mapError((fallbackError) =>
                  EmbeddingError.make({
                    message:
                      `Both primary and fallback providers failed. ` +
                      `Primary: ${reason}, Fallback: ${getErrorReason(fallbackError)}`,
                    provider: "fallback",
                    cause: O.some(fallbackError),
                  })
                )
              )
            )
          );
        })
      );

    // Return provider methods with fallback
    const methods: EmbeddingProviderMethods = {
      metadata: primaryProvider.metadata,
      embedBatch: executeWithFallback,
      cosineSimilarity,
    };

    return methods;
  })
);

/**
 * Complete fallback provider with all dependencies
 *
 * **Details**
 *
 * Includes HTTP client, Nomic NLP, circuit breaker, and rate limiter.
 *
 * **Example** (Inspect embedding provider fallback default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingProvider } from "@effect-ontology/Service/EmbeddingProvider"
 * import { EmbeddingProviderFallbackDefault } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* EmbeddingProvider
 *   return provider.metadata.providerId
 * }).pipe(Effect.provide(EmbeddingProviderFallbackDefault))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingProviderFallbackDefault: Layer.Layer<
  EmbeddingProvider,
  AnyEmbeddingError,
  ConfigService | NomicNlpService
> = EmbeddingProviderFallbackLive.pipe(
  Layer.provide(EmbeddingCircuitBreaker.Default),
  Layer.provide(EmbeddingRateLimiterVoyage),
  Layer.provide(FetchHttpClient.layer)
);
