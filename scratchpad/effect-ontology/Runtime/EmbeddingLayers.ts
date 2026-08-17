/**
 * Embedding Layer Composition
 *
 * **Details**
 *
 * Provides configured embedding service based on EMBEDDING_PROVIDER config.
 * Handles dynamic provider selection between Nomic (local) and Voyage (API).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import type { HttpClient } from "effect/unstable/http";
import { FetchHttpClient } from "effect/unstable/http";
import { ConfigService, ConfigServiceDefault } from "../Service/Config.ts";
import { EmbeddingCache } from "../Service/EmbeddingCache.ts";
import type { EmbeddingProvider } from "../Service/EmbeddingProvider.ts";
import type { EmbeddingRateLimiter } from "../Service/EmbeddingRateLimiter.ts";
import {
  EmbeddingRateLimiterLocal,
  EmbeddingRateLimiterVoyage,
  makeEmbeddingRateLimiter,
} from "../Service/EmbeddingRateLimiter.ts";
import { NomicEmbeddingProviderDefault, NomicEmbeddingProviderLive } from "../Service/NomicEmbeddingProvider.ts";
import type { NomicNlpService } from "../Service/NomicNlp.ts";
import { NomicNlpServiceLive } from "../Service/NomicNlp.ts";
import { VoyageEmbeddingProviderDefault, VoyageEmbeddingProviderLive } from "../Service/VoyageEmbeddingProvider.ts";
import { MetricsService } from "../Telemetry/Metrics.ts";

// =============================================================================
// Provider Selection
// =============================================================================

/**
 * Dynamic provider selection based on config
 *
 * **Details**
 *
 * Selects between NomicEmbeddingProvider and VoyageEmbeddingProvider
 * based on EMBEDDING_PROVIDER config value.
 *
 * Note: Uses Layer.unwrap with proper type annotation for the union
 * of all possible layer requirements.
 *
 * **Example** (Inspect embedding provider from config)
 *
 * ```ts
 * import { EmbeddingProviderFromConfig } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(EmbeddingProviderFromConfig)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingProviderFromConfig: Layer.Layer<
  EmbeddingProvider,
  never,
  ConfigService | NomicNlpService | EmbeddingRateLimiter | HttpClient.HttpClient
> = Layer.unwrap<
  EmbeddingProvider,
  never,
  NomicNlpService | EmbeddingRateLimiter | HttpClient.HttpClient,
  never,
  ConfigService
>(
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const configLayer = Layer.succeed(ConfigService, config);

    // Select the provider based on config, then provide ConfigService to it
    // CRITICAL: The returned layer needs ConfigService, so we provide it here
    //
    // Requirements after providing ConfigService:
    // - Nomic: NomicNlpService
    // - Voyage: EmbeddingRateLimiter | HttpClient.HttpClient
    // Union: NomicNlpService | EmbeddingRateLimiter | HttpClient.HttpClient
    if (config.embedding.provider === "voyage") {
      return VoyageEmbeddingProviderLive.pipe(Layer.provide(configLayer));
    } else {
      return NomicEmbeddingProviderLive.pipe(Layer.provide(configLayer));
    }
  })
);

/**
 * Dynamic rate limiter based on config values
 *
 * **Details**
 *
 * Uses EMBEDDING_RATE_LIMIT_RPM and EMBEDDING_MAX_CONCURRENT from config.
 * Falls back to provider defaults if not specified.
 *
 * **Example** (Inspect embedding rate limiter from config)
 *
 * ```ts
 * import { EmbeddingRateLimiterFromConfig } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(EmbeddingRateLimiterFromConfig)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingRateLimiterFromConfig: Layer.Layer<EmbeddingRateLimiter, never, ConfigService> = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const { maxConcurrent, provider, rateLimitRpm } = config.embedding;

    // Use config values to create rate limiter
    return makeEmbeddingRateLimiter({
      provider,
      requestsPerMinute: rateLimitRpm,
      maxConcurrent,
    });
  })
);

// =============================================================================
// Composed Layers
// =============================================================================

/**
 * Nomic embedding infrastructure
 *
 * **Details**
 *
 * Complete local embedding stack with in-memory cache.
 *
 * **Example** (Inspect nomic embedding infrastructure)
 *
 * ```ts
 * import { NomicEmbeddingInfrastructure } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(NomicEmbeddingInfrastructure)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicEmbeddingInfrastructure: Layer.Layer<
  EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache,
  never,
  ConfigService
> = Layer.mergeAll(NomicEmbeddingProviderDefault, EmbeddingRateLimiterLocal, EmbeddingCache.Default);

/**
 * Voyage embedding infrastructure
 *
 * **Details**
 *
 * Complete Voyage API embedding stack with rate limiting and cache.
 *
 * **Example** (Inspect voyage embedding infrastructure)
 *
 * ```ts
 * import { VoyageEmbeddingInfrastructure } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(VoyageEmbeddingInfrastructure)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VoyageEmbeddingInfrastructure: Layer.Layer<
  EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache,
  never,
  ConfigService
> = Layer.mergeAll(
  VoyageEmbeddingProviderDefault.pipe(Layer.provide(EmbeddingRateLimiterVoyage)),
  EmbeddingRateLimiterVoyage,
  EmbeddingCache.Default
);

/**
 * Config-driven embedding infrastructure
 *
 * **Details**
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
 * **Example** (Inspect embedding infrastructure)
 *
 * ```ts
 * import { EmbeddingInfrastructure } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(EmbeddingInfrastructure)
 * ```
 *
 * @category layers
 * @since 0.0.0
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
);

/**
 * Complete embedding infrastructure with all dependencies
 *
 * **Details**
 *
 * Self-contained layer that includes ConfigService.
 * May fail with ConfigError if environment is not properly configured.
 *
 * **Example** (Inspect embedding infrastructure default)
 *
 * ```ts
 * import { EmbeddingInfrastructureDefault } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(EmbeddingInfrastructureDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingInfrastructureDefault = EmbeddingInfrastructure.pipe(
  Layer.provideMerge(MetricsService.Default),
  Layer.provide(ConfigServiceDefault)
);
