/**
 * Embedding Layer Composition
 *
 * Provides configured embedding service based on EMBEDDING_PROVIDER config.
 * Handles dynamic provider selection between Nomic (local) and Voyage (API).
 *
 * @since 2.0.0
 * @module Runtime/EmbeddingLayers
 */

import type { HttpClient } from "effect/unstable/http"
import { FetchHttpClient } from "effect/unstable/http"
import { Effect, Layer } from "effect"
import { ConfigService, ConfigServiceDefault } from "../Service/Config.ts"
import { EmbeddingCache } from "../Service/EmbeddingCache.ts"
import type { EmbeddingProvider } from "../Service/EmbeddingProvider.ts"
import type { EmbeddingRateLimiter } from "../Service/EmbeddingRateLimiter.ts"
import {
  EmbeddingRateLimiterLocal,
  EmbeddingRateLimiterVoyage,
  makeEmbeddingRateLimiter
} from "../Service/EmbeddingRateLimiter.ts"
import { NomicEmbeddingProviderDefault, NomicEmbeddingProviderLive } from "../Service/NomicEmbeddingProvider.ts"
import type { NomicNlpService } from "../Service/NomicNlp.ts"
import { NomicNlpServiceLive } from "../Service/NomicNlp.ts"
import { VoyageEmbeddingProviderDefault, VoyageEmbeddingProviderLive } from "../Service/VoyageEmbeddingProvider.ts"
import { MetricsService } from "../Telemetry/Metrics.ts"

// =============================================================================
// Provider Selection
// =============================================================================

/**
 * Dynamic provider selection based on config
 *
 * Selects between NomicEmbeddingProvider and VoyageEmbeddingProvider
 * based on EMBEDDING_PROVIDER config value.
 *
 * Note: Uses Layer.unwrap with proper type annotation for the union
 * of all possible layer requirements.
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingProviderFromConfig: Layer.Layer<
  EmbeddingProvider,
  never,
  ConfigService | NomicNlpService | EmbeddingRateLimiter | HttpClient.HttpClient
> = Layer.unwrap(
  Effect.gen(function*() {
    const config = yield* ConfigService
    const configLayer = Layer.succeed(ConfigService, config)

    // Select the provider based on config, then provide ConfigService to it
    // CRITICAL: The returned layer needs ConfigService, so we provide it here
    //
    // Requirements after providing ConfigService:
    // - Nomic: NomicNlpService
    // - Voyage: EmbeddingRateLimiter | HttpClient.HttpClient
    // Union: NomicNlpService | EmbeddingRateLimiter | HttpClient.HttpClient
    if (config.embedding.provider === "voyage") {
      return VoyageEmbeddingProviderLive.pipe(
        Layer.provide(configLayer)
      ) as Layer.Layer<
        EmbeddingProvider,
        never,
        NomicNlpService | EmbeddingRateLimiter | HttpClient.HttpClient
      >
    } else {
      return NomicEmbeddingProviderLive.pipe(
        Layer.provide(configLayer)
      ) as Layer.Layer<
        EmbeddingProvider,
        never,
        NomicNlpService | EmbeddingRateLimiter | HttpClient.HttpClient
      >
    }
  })
)

/**
 * Dynamic rate limiter based on config values
 *
 * Uses EMBEDDING_RATE_LIMIT_RPM and EMBEDDING_MAX_CONCURRENT from config.
 * Falls back to provider defaults if not specified.
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingRateLimiterFromConfig: Layer.Layer<EmbeddingRateLimiter, never, ConfigService> = Layer
  .unwrap(
    Effect.gen(function*() {
      const config = yield* ConfigService
      const { maxConcurrent, provider, rateLimitRpm } = config.embedding

      // Use config values to create rate limiter
      return makeEmbeddingRateLimiter({
        provider,
        requestsPerMinute: rateLimitRpm,
        maxConcurrent
      })
    })
  )

// =============================================================================
// Composed Layers
// =============================================================================

/**
 * Nomic embedding infrastructure
 *
 * Complete local embedding stack with in-memory cache.
 *
 * @since 2.0.0
 * @category Layers
 */
export const NomicEmbeddingInfrastructure: Layer.Layer<
  EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache,
  never,
  ConfigService
> = Layer.mergeAll(
  NomicEmbeddingProviderDefault,
  EmbeddingRateLimiterLocal,
  EmbeddingCache.Default
)

/**
 * Voyage embedding infrastructure
 *
 * Complete Voyage API embedding stack with rate limiting and cache.
 *
 * @since 2.0.0
 * @category Layers
 */
export const VoyageEmbeddingInfrastructure: Layer.Layer<
  EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache,
  never,
  ConfigService
> = Layer.mergeAll(
  VoyageEmbeddingProviderDefault.pipe(Layer.provide(EmbeddingRateLimiterVoyage)),
  EmbeddingRateLimiterVoyage,
  EmbeddingCache.Default
)

/**
 * Config-driven embedding infrastructure
 *
 * Automatically selects provider based on EMBEDDING_PROVIDER config.
 * Use this for production deployments.
 *
 * Dependency chain:
 * - EmbeddingProviderFromConfig needs: ConfigService | NomicNlpService | EmbeddingRateLimiter | HttpClient
 * - NomicNlpServiceLive needs: ConfigService
 * - EmbeddingRateLimiterFromConfig needs: ConfigService
 * - FetchHttpClient.layer needs: nothing
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingInfrastructure: Layer.Layer<
  EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache,
  never,
  ConfigService
> = EmbeddingProviderFromConfig.pipe(
  Layer.provideMerge(EmbeddingRateLimiterFromConfig),
  Layer.provideMerge(EmbeddingCache.Default),
  Layer.provideMerge(FetchHttpClient.layer),
  Layer.provideMerge(NomicNlpServiceLive)
) as Layer.Layer<EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache, never, ConfigService>

/**
 * Complete embedding infrastructure with all dependencies
 *
 * Self-contained layer that includes ConfigService.
 * May fail with ConfigError if environment is not properly configured.
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingInfrastructureDefault = EmbeddingInfrastructure.pipe(
  Layer.provideMerge(MetricsService.Default),
  Layer.provide(ConfigServiceDefault)
)
