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
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import { ConfigService, ConfigServiceDefault } from "../Service/Config.ts";
import { EmbeddingCache } from "../Service/EmbeddingCache.ts";
import type { EmbeddingProvider } from "../Service/EmbeddingProvider.ts";
import type { EmbeddingRateLimiter } from "../Service/EmbeddingRateLimiter.ts";
import {
  EmbeddingRateLimiterLocal,
  EmbeddingRateLimiterVoyage,
  makeEmbeddingRateLimiter,
} from "../Service/EmbeddingRateLimiter.ts";
import { NomicEmbeddingProviderDefault } from "../Service/NomicEmbeddingProvider.ts";
import { VoyageEmbeddingProviderDefault } from "../Service/VoyageEmbeddingProvider.ts";
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
 * Uses Layer.unwrap so the provider is selected once ConfigService is available.
 *
 * **Gotchas**
 *
 * The unwrapped Nomic or Voyage layer still needs ConfigService internally, so
 * this constructor provides it from the surrounding ConfigService. After that
 * unwrap, leftover requirements depend on the selected vendor: Nomic needs
 * `NomicNlpService`, while Voyage needs `EmbeddingRateLimiter` or `HttpClient`.
 *
 * **Example** (Keep ConfigService as a remaining requirement)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { EmbeddingProviderFromConfig } from "@effect-ontology/Runtime/EmbeddingLayers"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const closed = EmbeddingProviderFromConfig.pipe(Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)))
 * console.log(closed !== EmbeddingProviderFromConfig) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingProviderFromConfig: Layer.Layer<EmbeddingProvider, AnyEmbeddingError, ConfigService> =
  Layer.unwrap<EmbeddingProvider, AnyEmbeddingError, never, never, ConfigService>(
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
        return VoyageEmbeddingProviderDefault.pipe(
          Layer.provide(EmbeddingRateLimiterFromConfig.pipe(Layer.provide(configLayer))),
          Layer.provide(configLayer)
        );
      } else {
        return NomicEmbeddingProviderDefault.pipe(Layer.provide(configLayer));
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
 * **Example** (Select rate-limit settings from ConfigService)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { EmbeddingRateLimiterFromConfig } from "@effect-ontology/Runtime/EmbeddingLayers"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const closed = EmbeddingRateLimiterFromConfig.pipe(Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)))
 * console.log(closed !== EmbeddingRateLimiterFromConfig) // true
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
 * **Example** (Compose the local Nomic embedding stack)
 *
 * ```ts
 * import { NomicEmbeddingInfrastructure, VoyageEmbeddingInfrastructure } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(NomicEmbeddingInfrastructure !== VoyageEmbeddingInfrastructure) // true
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
 * **Example** (Compose the Voyage API embedding stack)
 *
 * ```ts
 * import { NomicEmbeddingInfrastructure, VoyageEmbeddingInfrastructure } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(VoyageEmbeddingInfrastructure !== NomicEmbeddingInfrastructure) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VoyageEmbeddingInfrastructure: Layer.Layer<
  EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache,
  AnyEmbeddingError,
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
 * **Example** (Select Nomic or Voyage from EMBEDDING_PROVIDER)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { EmbeddingInfrastructure, NomicEmbeddingInfrastructure } from "@effect-ontology/Runtime/EmbeddingLayers"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const closed = EmbeddingInfrastructure.pipe(Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)))
 * console.log(closed)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingInfrastructure: Layer.Layer<
  EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache,
  AnyEmbeddingError,
  ConfigService
> = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const configLayer = Layer.succeed(ConfigService, config);
    return (config.embedding.provider === "voyage" ? VoyageEmbeddingInfrastructure : NomicEmbeddingInfrastructure).pipe(
      Layer.provide(configLayer)
    );
  })
);

/**
 * Complete embedding infrastructure with all dependencies
 *
 * **Details**
 *
 * Self-contained layer that includes ConfigService.
 * May fail with ConfigError if environment is not properly configured.
 *
 * **Example** (Provide ConfigService into the embedding stack)
 *
 * ```ts
 * import { EmbeddingInfrastructure, EmbeddingInfrastructureDefault } from "@effect-ontology/Runtime/EmbeddingLayers"
 *
 * console.log(EmbeddingInfrastructureDefault !== EmbeddingInfrastructure) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingInfrastructureDefault = EmbeddingInfrastructure.pipe(
  Layer.provideMerge(MetricsService.Default),
  Layer.provide(ConfigServiceDefault)
);
