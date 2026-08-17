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

import { Effect, Layer, Redacted, Ref } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import { EmbeddingError } from "../Domain/Error/Embedding.ts";
import { CircuitOpenError } from "../Runtime/CircuitBreaker.ts";
import { ConfigService } from "./Config.ts";
import type { EmbeddingCircuitBreakerService, EmbeddingProviderId } from "./EmbeddingCircuitBreaker.ts";
import { EmbeddingCircuitBreaker } from "./EmbeddingCircuitBreaker.ts";
import type { Embedding, EmbeddingProviderMethods, EmbeddingRequest } from "./EmbeddingProvider.ts";
import { cosineSimilarity, EmbeddingProvider } from "./EmbeddingProvider.ts";
import { EmbeddingRateLimiter, EmbeddingRateLimiterVoyage } from "./EmbeddingRateLimiter.ts";
import { NomicNlpService } from "./NomicNlp.ts";
import { makeVoyageProvider } from "./VoyageEmbeddingProvider.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Fallback chain configuration
 *
 *
 * **Example** (Use the FallbackChainConfig contract)
 *
 * ```ts
 * import type { FallbackChainConfig } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * const acceptsFallbackChainConfig = (_value: FallbackChainConfig): void => undefined
 *
 * console.log(acceptsFallbackChainConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface FallbackChainConfig {
  /** Order of providers to try */
  readonly providers: ReadonlyArray<EmbeddingProviderId>;
  /** Whether to log provider switches */
  readonly logFallbacks: boolean;
}

/**
 * Active provider tracking for observability
 *
 *
 * **Example** (Use the ActiveProviderInfo contract)
 *
 * ```ts
 * import type { ActiveProviderInfo } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * const acceptsActiveProviderInfo = (_value: ActiveProviderInfo): void => undefined
 *
 * console.log(acceptsActiveProviderInfo)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ActiveProviderInfo {
  readonly currentProvider: EmbeddingProviderId;
  readonly fallbackCount: number;
  readonly lastFallbackReason: string | null;
}

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
export const DEFAULT_FALLBACK_CHAIN: FallbackChainConfig = {
  providers: ["voyage", "nomic"],
  logFallbacks: true,
};

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
 * import { EmbeddingProviderFallbackLive } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * console.log(EmbeddingProviderFallbackLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingProviderFallbackLive: Layer.Layer<
  EmbeddingProvider,
  never,
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
    const activeProviderRef = yield* Ref.make<ActiveProviderInfo>({
      currentProvider: "voyage",
      fallbackCount: 0,
      lastFallbackReason: null,
    });

    // Create Voyage provider if API key is configured
    const voyageApiKeyStr = O.map(config.embedding.voyageApiKey, Redacted.value).pipe(O.getOrNull);

    const voyageProvider: EmbeddingProviderMethods | null = P.isNotNull(voyageApiKeyStr)
      ? yield* makeVoyageProvider({
          apiKey: voyageApiKeyStr,
          model: config.embedding.voyageModel ?? "voyage-3.5-lite",
          timeoutMs: config.embedding.timeoutMs ?? 30_000,
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
            (info): ActiveProviderInfo => ({
              currentProvider: "nomic",
              fallbackCount: info.fallbackCount + 1,
              lastFallbackReason: reason,
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
 * import { EmbeddingProviderFallbackDefault } from "@effect-ontology/Service/EmbeddingFallback"
 *
 * console.log(EmbeddingProviderFallbackDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingProviderFallbackDefault: Layer.Layer<EmbeddingProvider, never, ConfigService | NomicNlpService> =
  EmbeddingProviderFallbackLive.pipe(
    Layer.provide(EmbeddingCircuitBreaker.Default),
    Layer.provide(EmbeddingRateLimiterVoyage),
    Layer.provide(FetchHttpClient.layer)
  );
