/**
 * Voyage AI Embedding Provider
 *
 * HTTP-based provider for Voyage AI embeddings API.
 * Supports voyage-3, voyage-3.5-lite, voyage-code-3, voyage-law-2.
 *
 * Uses Effect Platform HTTP patterns:
 * - `HttpClientResponse.matchStatus` for status-based routing
 * - `HttpClientResponse.schemaBodyJson` for typed body parsing
 * - `HttpClient.retryTransient` for automatic retry of 429/5xx errors
 * - Respects `Retry-After` header from rate limit responses
 *
 * @see https://docs.voyageai.com/docs/embeddings
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Duration, Effect, Layer, Order, Redacted, Schedule, Schema } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import {
  EmbeddingError,
  EmbeddingInvalidResponseError,
  EmbeddingRateLimitError,
  EmbeddingTimeoutError,
} from "../Domain/Error/Embedding.ts";
import { ConfigService } from "./Config.ts";
import type { EmbeddingProviderMethods, EmbeddingRequest, ProviderMetadata } from "./EmbeddingProvider.ts";
import { cosineSimilarity, EmbeddingProvider } from "./EmbeddingProvider.ts";
import { EmbeddingRateLimiter } from "./EmbeddingRateLimiter.ts";

// =============================================================================
// Constants
// =============================================================================

/**
 * Voyage API endpoint
 */
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

/**
 * Voyage model dimensions
 *
 * @since 0.0.0
 * @category constants
 */
export const VOYAGE_MODELS: Record<string, number> = {
  "voyage-3": 1024,
  "voyage-3.5-lite": 512,
  "voyage-code-3": 1024,
  "voyage-finance-2": 1024,
  "voyage-multilingual-2": 1024,
  "voyage-law-2": 1024,
};

/**
 * Default Voyage model
 */
export const DEFAULT_VOYAGE_MODEL = "voyage-3.5-lite";

/**
 * Default timeout in milliseconds
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Default retry configuration for transient errors
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Default initial retry delay in milliseconds
 */
export const DEFAULT_INITIAL_RETRY_DELAY_MS = 1_000;

/**
 * Default retry-after value when header is missing (in seconds)
 */
export const DEFAULT_RETRY_AFTER_SECONDS = 60;

// =============================================================================
// Response Schema
// =============================================================================

const VoyageEmbeddingData = Schema.Struct({
  object: Schema.Literal("embedding"),
  embedding: Schema.Array(Schema.Finite),
  index: NonNegativeInt,
});

const VoyageUsage = Schema.Struct({
  total_tokens: NonNegativeInt,
});

const VoyageResponseSchema = Schema.Struct({
  // Note: `object` field is optional - Voyage API may omit it
  object: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  data: Schema.Array(VoyageEmbeddingData),
  model: Schema.String,
  usage: VoyageUsage,
});

/**
 * Voyage error response schema
 * API returns { "detail": "error message" } for non-2xx responses
 */
const VoyageErrorSchema = Schema.Struct({
  detail: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});

// =============================================================================
// Error Mapping & Helpers
// =============================================================================

/**
 * Parse Retry-After header value to milliseconds
 *
 * @internal
 */
const parseRetryAfterMs = (response: HttpClientResponse.HttpClientResponse): number => {
  const retryAfter = response.headers["retry-after"];
  if (P.isTruthy(retryAfter)) {
    const seconds = parseInt(retryAfter, 10);
    if (!Number.isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return DEFAULT_RETRY_AFTER_SECONDS * 1000;
};

/**
 * Check if HTTP status code is transient (retryable)
 *
 * @internal
 */
/**
 * Map HTTP/parsing errors to embedding errors using Effect.catchTag pattern
 *
 * @internal
 */
const mapVoyageError = (error: unknown, timeoutMs: number): AnyEmbeddingError => {
  // Check for specific error types by their _tag property
  if (error !== null && typeof error === "object" && "_tag" in error) {
    const tagged = error as { _tag: string; status?: number; message?: string };

    if (tagged._tag === "TimeoutError") {
      return EmbeddingTimeoutError.fromUnknown({
        message: "Voyage API timeout",
        provider: "voyage",
        timeoutMs,
      });
    }

    if (tagged._tag === "ResponseError" && typeof tagged.status === "number") {
      if (tagged.status === 429) {
        return EmbeddingRateLimitError.fromUnknown({
          message: "Voyage API rate limit exceeded",
          provider: "voyage",
          retryAfterMs: DEFAULT_RETRY_AFTER_SECONDS * 1000,
        });
      }
      return EmbeddingError.make({
        message: `Voyage API error: status ${tagged.status}`,
        provider: "voyage",
        cause: O.some(error),
      });
    }

    if (tagged._tag === "ParseError") {
      return EmbeddingInvalidResponseError.make({
        message: `Invalid Voyage response: ${tagged.message ?? "parse error"}`,
        provider: "voyage",
      });
    }
  }

  return EmbeddingError.make({
    message: error instanceof Error ? error.message : String(error),
    provider: "voyage",
    cause: O.some(error),
  });
};

// =============================================================================
// Provider Implementation
// =============================================================================

/**
 * Voyage embedding provider configuration
 *
 * @since 0.0.0
 * @category type-level
 */
export interface VoyageProviderConfig {
  /** Voyage API key */
  readonly apiKey: string;
  /** Model to use (default: voyage-3.5-lite) */
  readonly model?: string;
  /** Request timeout in ms (default: 30000) */
  readonly timeoutMs?: number;
}

/**
 * Create VoyageEmbeddingProvider with explicit config
 *
 * @since 0.0.0
 * @category constructors
 */
export const makeVoyageProvider = Effect.fn("makeVoyageProvider")(function* (
  config: VoyageProviderConfig
): Effect.fn.Return<EmbeddingProviderMethods, never, HttpClient.HttpClient | EmbeddingRateLimiter> {
  const httpClient = yield* HttpClient.HttpClient;
  const rateLimiter = yield* EmbeddingRateLimiter;

  const model = config.model ?? DEFAULT_VOYAGE_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dimension = VOYAGE_MODELS[model] ?? 512;

  const metadata: ProviderMetadata = {
    providerId: "voyage",
    modelId: model,
    dimension,
  };

  /**
   * Map task type to Voyage input_type
   */
  const mapInputType = (taskType: string): "query" | "document" => {
    switch (taskType) {
      case "search_query":
        return "query";
      default:
        return "document";
    }
  };

  /**
   * Retry schedule for transient errors (429, 5xx)
   * Uses exponential backoff with jitter, respects rate limiter
   */
  const retrySchedule = Schedule.max([
    Schedule.exponential(Duration.millis(DEFAULT_INITIAL_RETRY_DELAY_MS)),
    Schedule.recurs(DEFAULT_MAX_RETRIES),
  ]).pipe(Schedule.jittered);

  /**
   * Process HTTP response using matchStatus for proper status-based routing
   */
  const processResponse = (
    response: HttpClientResponse.HttpClientResponse
  ): Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, AnyEmbeddingError> =>
    HttpClientResponse.matchStatus(response, {
      // Success: parse with schema
      "2xx": (res) =>
        HttpClientResponse.schemaBodyJson(VoyageResponseSchema)(res).pipe(
          Effect.map((parsed) => {
            // Sort by index to maintain order (API may return out of order)
            const sorted = A.sortWith(parsed.data, (datum) => datum.index, Order.Number);
            return A.map(sorted, (datum) => datum.embedding);
          }),
          Effect.mapError((e) =>
            EmbeddingInvalidResponseError.make({
              message: `Invalid Voyage response: ${e.message}`,
              provider: "voyage",
            })
          )
        ),

      // Rate limit: parse error body and include retry-after
      429: (res) =>
        HttpClientResponse.schemaBodyJson(VoyageErrorSchema)(res).pipe(
          Effect.orElseSucceed(() => ({ detail: O.none<string>() })),
          Effect.flatMap((errorBody) =>
            Effect.fail(
              EmbeddingRateLimitError.fromUnknown({
                message: `Voyage API rate limit: ${O.getOrElse(errorBody.detail, () => "rate limit exceeded")}`,
                provider: "voyage",
                retryAfterMs: parseRetryAfterMs(res),
              })
            )
          )
        ),

      // Server errors (5xx): transient, include status in message
      "5xx": (res) =>
        HttpClientResponse.schemaBodyJson(VoyageErrorSchema)(res).pipe(
          Effect.orElseSucceed(() => ({ detail: O.none<string>() })),
          Effect.flatMap((errorBody) =>
            Effect.fail(
              EmbeddingError.make({
                message: `Voyage API server error (${res.status}): ${O.getOrElse(errorBody.detail, () => "internal error")}`,
                provider: "voyage",
              })
            )
          )
        ),

      // Client errors (4xx except 429): non-retryable
      "4xx": (res) =>
        HttpClientResponse.schemaBodyJson(VoyageErrorSchema)(res).pipe(
          Effect.orElseSucceed(() => ({ detail: O.none<string>() })),
          Effect.flatMap((errorBody) =>
            Effect.fail(
              EmbeddingError.make({
                message: `Voyage API error (${res.status}): ${O.getOrElse(errorBody.detail, () => "client error")}`,
                provider: "voyage",
              })
            )
          )
        ),

      // Fallback for unexpected status codes
      orElse: (res) =>
        Effect.fail(
          EmbeddingError.make({
            message: `Voyage API unexpected status: ${res.status}`,
            provider: "voyage",
          })
        ),
    });

  const methods: EmbeddingProviderMethods = {
    metadata,

    embedBatch: (requests: ReadonlyArray<EmbeddingRequest>) =>
      Effect.acquireUseRelease(
        rateLimiter.acquire,
        Effect.fn("VoyageEmbeddingProvider.embedBatch")(function* () {
          if (requests.length === 0) {
            return [];
          }

          const inputType = mapInputType(requests[0].taskType);
          const texts = A.map(requests, (request) => request.text);

          // Build request (pure value, not Effect)
          // Note: bodyUnsafeJson is synchronous and returns HttpClientRequest directly,
          // unlike bodyJson which returns Effect<HttpClientRequest, HttpBodyError>
          const request = HttpClientRequest.post(VOYAGE_API_URL).pipe(
            HttpClientRequest.setHeaders({
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            }),
            HttpClientRequest.bodyJsonUnsafe({
              input: texts,
              model,
              input_type: inputType,
            })
          );

          // Execute request with timeout and proper response handling
          const embeddings = yield* httpClient.execute(request).pipe(
            // Map HTTP client errors (network, connection) to embedding errors
            Effect.mapError((e) => mapVoyageError(e, timeoutMs)),
            Effect.timeout(Duration.millis(timeoutMs)),
            Effect.catchTag("TimeoutError", () =>
              Effect.fail(
                EmbeddingTimeoutError.fromUnknown({
                  message: "Voyage API timeout",
                  provider: "voyage",
                  timeoutMs,
                })
              )
            ),
            Effect.flatMap(processResponse),
            // Retry transient errors (429, 5xx) with exponential backoff
            Effect.retry({
              schedule: retrySchedule,
              while: (error) =>
                error._tag === "EmbeddingRateLimitError" ||
                (error._tag === "EmbeddingError" && Str.includes("server error")(error.message)),
            })
          );

          return embeddings;
        }),
        () => rateLimiter.release
      ),

    cosineSimilarity,
  };

  return methods;
});

/**
 * VoyageEmbeddingProvider layer using ConfigService
 *
 * Requires EMBEDDING_VOYAGE_API_KEY to be set.
 *
 * @since 0.0.0
 * @category layers
 */
export const VoyageEmbeddingProviderLive: Layer.Layer<
  EmbeddingProvider,
  never,
  ConfigService | EmbeddingRateLimiter | HttpClient.HttpClient
> = Layer.effect(
  EmbeddingProvider,
  Effect.gen(function* () {
    const config = yield* ConfigService;

    // Get API key from config (will be added in Config.ts update)
    const apiKeyOption = config.embedding.voyageApiKey;
    const apiKey = apiKeyOption._tag === "Some" ? Redacted.value(apiKeyOption.value) : "";

    if (P.not(P.isTruthy)(apiKey)) {
      yield* Effect.logWarning("EMBEDDING_VOYAGE_API_KEY not set, Voyage provider may fail");
    }

    const model = config.embedding.voyageModel ?? DEFAULT_VOYAGE_MODEL;
    const timeoutMs = config.embedding.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return yield* makeVoyageProvider({ apiKey, model, timeoutMs });
  })
);

/**
 * Complete Voyage provider with HTTP client
 *
 * @since 0.0.0
 * @category layers
 */
export const VoyageEmbeddingProviderDefault: Layer.Layer<
  EmbeddingProvider,
  never,
  ConfigService | EmbeddingRateLimiter
> = VoyageEmbeddingProviderLive.pipe(Layer.provide(FetchHttpClient.layer));
