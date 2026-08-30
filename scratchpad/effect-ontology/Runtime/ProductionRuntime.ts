/**
 * Runtime: Production Runtime
 *
 * **Details**
 *
 * Layer composition for production deployment.
 * Provides all services with correct dependency order.
 *
 * **Gotchas**
 *
 * `LanguageModel.LanguageModel` must be provided separately by the application
 * (for example from `@effect/ai-anthropic` or `@effect/ai-openai`). Use
 * {@link makeLanguageModelLayer} to create it from ConfigService.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { URLStr } from "@beep/schema";
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic";
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import { Effect, Layer, Match } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import type { AppConfig } from "../Service/Config.ts";
import { ConfigService } from "../Service/Config.ts";
import { EntityExtractor, MentionExtractor, RelationExtractor } from "../Service/Extraction.ts";
import { Grounder } from "../Service/Grounder.ts";
import {
  CentralRateLimiterServiceLive,
  StageTimeoutServiceLive,
  TokenBudgetServiceLive,
} from "../Service/LlmControl/index.ts";
import { makeTracingLayer } from "../Telemetry/Tracing.ts";
import { HealthCheckService } from "./HealthCheck.ts";
import { ExtractionRouter } from "./HttpServer.ts";
import { LlmSemaphoreService } from "./LlmSemaphore.ts";
import { RateLimitedAnthropicClientLayer, RateLimitedOpenAiClientLayer } from "./RateLimitedLanguageModel.ts";
import { DEFAULT_SHUTDOWN_CONFIG, ShutdownError, ShutdownService } from "./Shutdown.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/ProductionRuntime");

export {
  CentralRateLimiterService,
  StageTimeoutService,
  TokenBudgetService,
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

/**
 *  Error raised when configuration selects an unavailable Effect v4 AI adapter.
 *
 * **Example** (Construct an unsupported-provider failure)
 *
 * ```ts
 * import { UnsupportedLlmProviderError } from "@effect-ontology/Runtime/ProductionRuntime"
 *
 * const error = UnsupportedLlmProviderError.make({ provider: "google" })
 * console.log(error.provider) // "google"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnsupportedLlmProviderError extends S.TaggedError<UnsupportedLlmProviderError>(
  $I`UnsupportedLlmProviderError`
)(
  "UnsupportedLlmProviderError",
  {
    provider: S.tag("google").annotateKey({
      description: "Configured LLM provider without an available Effect AI adapter.",
    }),
  },
  $I.annote("UnsupportedLlmProviderError", {
    description: "Failure raised when configuration selects an unsupported LLM provider adapter.",
  })
) {}

const selectLanguageModelLayer = Match.type<AppConfig>().pipe(
  Match.when({ llm: { provider: "anthropic" } }, (config) => {
    const client = AnthropicClient.layer({ apiKey: config.llm.apiKey }).pipe(Layer.provide(FetchHttpClient.layer));
    return Effect.succeed(
      AnthropicLanguageModel.layer({ model: config.llm.model }).pipe(
        Layer.provide(RateLimitedAnthropicClientLayer.pipe(Layer.provide(client)))
      )
    );
  }),
  Match.when({ llm: { provider: "openai" } }, (config) => {
    const client = OpenAiClient.layer({ apiKey: config.llm.apiKey }).pipe(Layer.provide(FetchHttpClient.layer));
    return Effect.succeed(
      OpenAiLanguageModel.layer({ model: config.llm.model }).pipe(
        Layer.provide(RateLimitedOpenAiClientLayer.pipe(Layer.provide(client)))
      )
    );
  }),
  Match.orElse(() => UnsupportedLlmProviderError.make({ provider: "google" }))
);

/**
 * Create LanguageModel layer with ConfigService
 *
 * **Details**
 *
 * Reads LLM provider configuration from ConfigService and creates
 * the appropriate LanguageModel layer with API key from environment.
 * Only loads the API key for the configured provider.
 *
 * This is a Layer that depends on ConfigService and provides LanguageModel.
 *
 * **Gotchas**
 *
 * The returned layer still requires ConfigService. Extraction layers compose
 * it internally; a raw HTTP server does not.
 *
 * **Example** (Select Anthropic or OpenAI from ConfigService)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { ExtractionLayersLive, makeLanguageModelLayer } from "@effect-ontology/Runtime/ProductionRuntime"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const closed = makeLanguageModelLayer.pipe(Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)))
 * console.log(closed)
 * ```
 *
 * @returns Layer providing LanguageModel (with all dependencies satisfied)
 * @category layers
 * @since 0.0.0
 */
export const makeLanguageModelLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ConfigService;

    return yield* selectLanguageModelLayer(config);
  })
);

/**
 * Production extraction layers with rate-limited LLM
 *
 * **Details**
 *
 * Provides all extraction services:
 * - EntityExtractor
 * - MentionExtractor
 * - RelationExtractor
 * - Grounder
 *
 * All services use the rate-limited LanguageModel automatically.
 *
 * **Example** (Compose extractors onto the language-model layer)
 *
 * ```ts
 * import { ExtractionLayersLive, makeLanguageModelLayer } from "@effect-ontology/Runtime/ProductionRuntime"
 *
 * console.log(ExtractionLayersLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionLayersLive = Layer.mergeAll(
  EntityExtractor.Default,
  MentionExtractor.Default,
  RelationExtractor.Default,
  Grounder.Default
).pipe(Layer.provide(makeLanguageModelLayer));

/**
 * OpenTelemetry tracing layer for Jaeger export
 *
 * **Details**
 *
 * Exports spans to Jaeger via OTLP HTTP at `https://localhost:4318/v1/traces`.
 * Run Jaeger locally with: docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
 * View traces at: https://localhost:16686
 *
 * **Example** (Export traces to local Jaeger)
 *
 * ```ts
 * import { ExtractionLayersLive, TracingLive } from "@effect-ontology/Runtime/ProductionRuntime"
 *
 * console.log(TracingLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TracingLive = makeTracingLayer({
  serviceName: "effect-ontology-extraction",
  otlpEndpoint: URLStr.make("https://localhost:4318/v1/traces"),
  enabled: true,
}).pipe(Layer.provide(FetchHttpClient.layer));

/**
 * Production layers with tracing
 *
 * **Details**
 *
 * Full production layer composition including:
 * - All extraction services
 * - Rate-limited LLM
 * - OpenTelemetry tracing to Jaeger
 *
 * **Example** (Merge extraction with tracing)
 *
 * ```ts
 * import { ExtractionLayersLive, ProductionLayersWithTracing } from "@effect-ontology/Runtime/ProductionRuntime"
 *
 * console.log(ProductionLayersWithTracing !== ExtractionLayersLive) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProductionLayersWithTracing = Layer.mergeAll(ExtractionLayersLive, TracingLive);

/**
 * LLM Control layer stack
 *
 * **Details**
 *
 * Provides fine-grained control over LLM API usage:
 * - TokenBudgetService: Per-stage token budgets
 * - StageTimeoutService: Soft/hard timeouts per stage
 * - CentralRateLimiterService: Rate limiting with circuit breaker
 *
 * **Example** (Merge token budget, stage timeout, and rate limiter)
 *
 * ```ts
 * import { ExtractionLayersLive, LlmControlLive } from "@effect-ontology/Runtime/ProductionRuntime"
 *
 * console.log(LlmControlLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LlmControlLive = Layer.mergeAll(
  TokenBudgetServiceLive,
  StageTimeoutServiceLive,
  CentralRateLimiterServiceLive
);

/**
 * Production extraction, health, semaphore, LLM-control, and tracing stack.
 *
 * **Details**
 *
 * Does not include the HTTP server layer — compose that separately for Bun or
 * Node.
 *
 * **Gotchas**
 *
 * `LanguageModel.LanguageModel` is not included. Provide {@link makeLanguageModelLayer}
 * or an application-owned adapter before launching extractors.
 *
 * **Example** (Launch HTTP on Bun beside production infrastructure)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { BunHttpServer } from "@effect/platform-bun"
 * import { HttpServerLive } from "@effect-ontology/Runtime/HttpServer"
 * import { ProductionInfrastructure } from "@effect-ontology/Runtime/ProductionRuntime"
 * import { ConfigServiceDefault } from "@effect-ontology/Service/Config"
 *
 * const ServerLive = HttpServerLive.pipe(
 *   Layer.provideMerge(ProductionInfrastructure),
 *   Layer.provideMerge(BunHttpServer.layer({ port: 8080 })),
 *   Layer.provideMerge(ConfigServiceDefault)
 * )
 * console.log(ServerLive !== ProductionInfrastructure) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProductionInfrastructure = Layer.mergeAll(
  ExtractionLayersLive,
  HealthCheckService.Default,
  LlmSemaphoreService.Default,
  LlmControlLive,
  TracingLive
);
