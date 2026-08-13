/**
 * Runtime: Production Runtime
 *
 * Layer composition for production deployment.
 * Provides all services with correct dependency order.
 *
 * **Note**: LanguageModel.LanguageModel must be provided separately
 * by the application (e.g., from @effect/ai-anthropic or @effect/ai-openai).
 * Use `makeLanguageModelLayer()` helper to create it from ConfigService.
 *
 * @since 2.0.0
 * @module Runtime/ProductionRuntime
 */

import {AnthropicClient, AnthropicLanguageModel} from "@effect/ai-anthropic";
import {OpenAiClient, OpenAiLanguageModel} from "@effect/ai-openai";
import {Data, Effect, Layer} from "effect";
import {FetchHttpClient} from "effect/unstable/http";
import {ConfigService} from "../Service/Config.ts";
import {
  EntityExtractor,
  MentionExtractor,
  RelationExtractor
} from "../Service/Extraction.ts";
import {Grounder} from "../Service/Grounder.ts";
import {
  CentralRateLimiterServiceLive,
  StageTimeoutServiceLive,
  TokenBudgetServiceLive,
} from "../Service/LlmControl/index.ts";
import {makeTracingLayer} from "../Telemetry/Tracing.ts";
import {HealthCheckService} from "./HealthCheck.ts";
import {ExtractionRouter} from "./HttpServer.ts";
import {LlmSemaphoreService} from "./LlmSemaphore.ts";
import {RateLimitedLanguageModelLayer} from "./RateLimitedLanguageModel.ts";
import {
  DEFAULT_SHUTDOWN_CONFIG,
  ShutdownError,
  ShutdownService
} from "./Shutdown.ts";

export {
  CentralRateLimiterService, StageTimeoutService, TokenBudgetService
} from "../Service/LlmControl/index.ts";
// Re-export new infrastructure components
// Re-export LLM Control services
export {
  CentralRateLimiterServiceLive,
  DEFAULT_SHUTDOWN_CONFIG,
  ExtractionRouter,
  HealthCheckService,
  LlmSemaphoreService,
  ShutdownError,
  ShutdownService,
  StageTimeoutServiceLive,
  TokenBudgetServiceLive,
};

/** Error raised when configuration selects an unavailable Effect v4 AI adapter. */
export class UnsupportedLlmProviderError extends Data.TaggedError("UnsupportedLlmProviderError")<{
  readonly provider: string;
}> {
}

/**
 * Create LanguageModel layer with ConfigService
 *
 * Reads LLM provider configuration from ConfigService and creates
 * the appropriate LanguageModel layer with API key from environment.
 * Only loads the API key for the configured provider.
 *
 * This is a Layer that depends on ConfigService and provides LanguageModel.
 *
 * @returns Layer providing LanguageModel (with all dependencies satisfied)
 *
 * @example
 * ```typescript
 * const layers = ProductionLayers.pipe(
 *   Layer.provide(makeLanguageModelLayer())
 * )
 * ```
 *
 * @since 2.0.0
 */
export const makeLanguageModelLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ConfigService;

    switch (config.llm.provider) {
      case "anthropic": {
        return AnthropicLanguageModel.layer({model: config.llm.model}).pipe(
          Layer.provide(AnthropicClient.layer({apiKey: config.llm.apiKey}).pipe(Layer.provide(FetchHttpClient.layer)))
        );
      }

      case "openai": {
        return OpenAiLanguageModel.layer({model: config.llm.model}).pipe(
          Layer.provide(OpenAiClient.layer({apiKey: config.llm.apiKey}).pipe(Layer.provide(FetchHttpClient.layer)))
        );
      }

      case "google": {
        return yield* new UnsupportedLlmProviderError({provider: config.llm.provider});
      }

      default: {
        // Default to Anthropic
        return AnthropicLanguageModel.layer({model: config.llm.model}).pipe(
          Layer.provide(AnthropicClient.layer({apiKey: config.llm.apiKey}).pipe(Layer.provide(FetchHttpClient.layer)))
        );
      }
    }
  })
);

/**
 * Rate-limited LanguageModel layer
 *
 * Composes the base LanguageModel with rate limiting.
 * All LLM calls go through the rate limiter automatically.
 *
 * @since 2.0.0
 */
export const RateLimitedLlmLayer = RateLimitedLanguageModelLayer.pipe(Layer.provide(makeLanguageModelLayer));

/**
 * Production extraction layers with rate-limited LLM
 *
 * Provides all extraction services:
 * - EntityExtractor
 * - MentionExtractor
 * - RelationExtractor
 * - Grounder
 *
 * All services use the rate-limited LanguageModel automatically.
 *
 * @since 2.0.0
 */
export const ExtractionLayersLive = Layer.mergeAll(
  EntityExtractor.Default,
  MentionExtractor.Default,
  RelationExtractor.Default,
  Grounder.Default
).pipe(Layer.provide(RateLimitedLlmLayer));

/**
 * OpenTelemetry tracing layer for Jaeger export
 *
 * Exports spans to Jaeger via OTLP HTTP protocol.
 * Run Jaeger locally with: docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
 * View traces at: http://localhost:16686
 *
 * @example
 * ```typescript
 * // Use in production
 * const layers = ExtractionLayersLive.pipe(
 *   Layer.provide(TracingLive)
 * )
 * ```
 *
 * @since 2.0.0
 */
export const TracingLive = makeTracingLayer({
  serviceName: "effect-ontology-extraction",
  otlpEndpoint: "http://localhost:4318/v1/traces",
  enabled: true,
}).pipe(Layer.provide(FetchHttpClient.layer));

/**
 * Production layers with tracing
 *
 * Full production layer composition including:
 * - All extraction services
 * - Rate-limited LLM
 * - OpenTelemetry tracing to Jaeger
 *
 * @since 2.0.0
 */
export const ProductionLayersWithTracing = Layer.mergeAll(ExtractionLayersLive, TracingLive);

/**
 * Production infrastructure layers
 *
 * Complete production infrastructure including:
 * - All extraction services with rate-limited LLM
 * - Health check service (liveness/readiness/deep probes)
 * - LLM semaphore for concurrency control
 * - OpenTelemetry tracing to Jaeger
 *
 * Does NOT include HTTP server layer - compose separately
 * based on your runtime (Bun, Node, etc.)
 *
 * @example
 * ```typescript
 * import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
 *
 * const ServerLive = HttpServerLive.pipe(
 *   Layer.provideMerge(ProductionInfrastructure),
 *   Layer.provideMerge(BunHttpServer.layer({ port: 8080 })),
 *   Layer.provideMerge(ConfigService.Default)
 * )
 *
 * BunRuntime.runMain(Layer.launch(ServerLive))
 * ```
 *
 * @since 2.0.0
 */
/**
 * LLM Control layer stack
 *
 * Provides fine-grained control over LLM API usage:
 * - TokenBudgetService: Per-stage token budgets
 * - StageTimeoutService: Soft/hard timeouts per stage
 * - CentralRateLimiterService: Rate limiting with circuit breaker
 *
 * @since 2.0.0
 */
export const LlmControlLive = Layer.mergeAll(
  TokenBudgetServiceLive,
  StageTimeoutServiceLive,
  CentralRateLimiterServiceLive
);

export const ProductionInfrastructure = Layer.mergeAll(
  ExtractionLayersLive,
  HealthCheckService.Default,
  LlmSemaphoreService.Default,
  LlmControlLive,
  TracingLive
);
