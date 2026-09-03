/**
 * Voyage AI Embedding Provider
 *
 * **Details**
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
 * @see {@link https://docs.voyageai.com/docs/embeddings} for the embeddings API reference.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { Duration, Effect, Inspectable, Layer, Match, Number as Num, Order, Redacted, Schedule } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { Milliseconds } from "../Domain/Error/Base.ts";
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

const $I = $ScratchpadId.create("effect-ontology/Service/VoyageEmbeddingProvider");

// =============================================================================
// Constants
// =============================================================================

/**
 * Voyage API endpoint
 */
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

/**
 * Supported Voyage embedding model identifiers.
 *
 * **Example** (Inspect voyage models)
 *
 * ```ts
 * import { VoyageModel } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * console.log(VoyageModel.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VoyageModel = LiteralKit([
  "voyage-3",
  "voyage-3.5-lite",
  "voyage-code-3",
  "voyage-finance-2",
  "voyage-multilingual-2",
  "voyage-law-2",
]).pipe(
  SchemaUtils.withCodecStatics(["decodeUnknownEffect"]),
  $I.annoteSchema("VoyageModel", {
    description: "Voyage embedding models with known output dimensions.",
  })
);

/** Runtime model identifier accepted by {@link VoyageModel}.
 *
 * **Example** (Use a Voyage model)
 *
 * ```ts
 * import type { VoyageModel } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * const model: VoyageModel = "voyage-3.5-lite"
 * console.log(model)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type VoyageModel = typeof VoyageModel.Type;

/**
 * Known output dimension for every supported Voyage model.
 *
 * **Example** (Inspect Voyage dimensions)
 *
 * ```ts
 * import { VOYAGE_MODELS } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * console.log(VOYAGE_MODELS["voyage-3.5-lite"])
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VOYAGE_MODELS: Record<VoyageModel, PosInt> = {
  "voyage-3": PosInt.make(1024),
  "voyage-3.5-lite": PosInt.make(512),
  "voyage-code-3": PosInt.make(1024),
  "voyage-finance-2": PosInt.make(1024),
  "voyage-multilingual-2": PosInt.make(1024),
  "voyage-law-2": PosInt.make(1024),
};

/**
 * Default Voyage model
 *
 * **Example** (Inspect default voyage model)
 *
 * ```ts
 * import { DEFAULT_VOYAGE_MODEL } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * console.log(DEFAULT_VOYAGE_MODEL)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_VOYAGE_MODEL: VoyageModel = VoyageModel.Enum["voyage-3.5-lite"];

/**
 * Default timeout in milliseconds
 *
 * **Example** (Inspect default timeout ms)
 *
 * ```ts
 * import { DEFAULT_TIMEOUT } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * console.log(DEFAULT_TIMEOUT)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_TIMEOUT = Duration.seconds(30);

/**
 * Default retry configuration for transient errors
 *
 * **Example** (Inspect default max retries)
 *
 * ```ts
 * import { DEFAULT_MAX_RETRIES } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * console.log(DEFAULT_MAX_RETRIES)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Default initial retry delay.
 *
 * **Example** (Inspect default initial retry delay ms)
 *
 * ```ts
 * import { DEFAULT_INITIAL_RETRY_DELAY } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMillis(DEFAULT_INITIAL_RETRY_DELAY))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_INITIAL_RETRY_DELAY = Duration.seconds(1);

/**
 * Default retry-after value when the response header is missing.
 *
 * **Example** (Inspect default retry after seconds)
 *
 * ```ts
 * import { DEFAULT_RETRY_AFTER } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(DEFAULT_RETRY_AFTER))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_RETRY_AFTER = Duration.minutes(1);

// =============================================================================
// Response Schema
// =============================================================================

const VoyageEmbeddingData = S.Struct({
  object: S.Literal("embedding"),
  embedding: S.Array(S.Finite),
  index: NonNegativeInt,
});

const VoyageUsage = S.Struct({
  total_tokens: NonNegativeInt,
});

const VoyageResponseSchema = S.Struct({
  // Note: `object` field is optional - Voyage API may omit it
  object: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  data: S.Array(VoyageEmbeddingData),
  model: S.String,
  usage: VoyageUsage,
});

/**
 * Voyage error response schema
 * API returns { "detail": "error message" } for non-2xx responses
 */
const VoyageErrorSchema = S.Struct({
  detail: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});

// =============================================================================
// Error Mapping & Helpers
// =============================================================================

/**
 * Parse Retry-After header value to milliseconds
 *
 * @internal
 */
const parseRetryAfter = (response: HttpClientResponse.HttpClientResponse): Duration.Duration =>
  O.fromNullishOr(response.headers["retry-after"]).pipe(
    O.flatMap(Num.parse),
    O.filter((seconds) => seconds >= 0),
    O.map(Duration.seconds),
    O.getOrElse(() => DEFAULT_RETRY_AFTER)
  );

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
const mapVoyageError = (error: unknown, timeout: Duration.Duration): AnyEmbeddingError => {
  // Check for specific error types by their _tag property
  if (P.isObject(error) && "_tag" in error) {
    const tagged = error;

    if (tagged._tag === "TimeoutError") {
      return EmbeddingTimeoutError.make({
        message: "Voyage API timeout",
        provider: "voyage",
        timeoutMs: Milliseconds.make(Duration.toMillis(timeout)),
      });
    }

    if (tagged._tag === "ResponseError" && P.hasProperty(tagged, "status") && P.isNumber(tagged.status)) {
      if (tagged.status === 429) {
        return EmbeddingRateLimitError.make({
          message: "Voyage API rate limit exceeded",
          provider: "voyage",
          retryAfterMs: O.some(Milliseconds.make(Duration.toMillis(DEFAULT_RETRY_AFTER))),
        });
      }
      return EmbeddingError.make({
        message: `Voyage API error: status ${tagged.status}`,
        provider: "voyage",
        cause: O.some(error),
      });
    }

    if (P.hasProperty(tagged, "_tag") && tagged._tag === "ParseError") {
      const message = P.hasProperty(tagged, "message") && P.isString(tagged.message) ? tagged.message : "parse error";
      return EmbeddingInvalidResponseError.make({
        message: `Invalid Voyage response: ${message}`,
        provider: "voyage",
      });
    }
  }

  return EmbeddingError.make({
    message: Inspectable.toStringUnknown(error),
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
 * **Example** (Configure a Voyage provider)
 *
 * ```ts
 * import { Duration, Effect, Redacted } from "effect"
 * import { VoyageProviderConfig } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * const config = VoyageProviderConfig.make({
 *   apiKey: Redacted.make("sk-test"),
 *   timeout: Duration.seconds(10)
 * })
 * console.log(config.model)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class VoyageProviderConfig extends S.Class<VoyageProviderConfig>($I`VoyageProviderConfig`)(
  {
    apiKey: S.Redacted(S.NonEmptyString),
    model: VoyageModel.pipe(SchemaUtils.withKeyDefaults(DEFAULT_VOYAGE_MODEL)),
    timeout: S.Duration.pipe(SchemaUtils.withKeyDefaults(DEFAULT_TIMEOUT)),
  },
  $I.annote("VoyageProviderConfig", {
    description: "Secret API credential, supported model, and request timeout for Voyage embeddings.",
  })
) {}

/**
 * Constructor input accepted by {@link VoyageProviderConfig}.
 *
 * **Example** (Reference Voyage provider input)
 *
 * ```ts
 * import { Duration, Effect, Redacted } from "effect"
 * import type { VoyageProviderConfigInput } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * const input: VoyageProviderConfigInput = {
 *   apiKey: Redacted.make("sk-test"),
 *   timeout: Duration.seconds(10)
 * }
 * console.log(input.timeout)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type VoyageProviderConfigInput = (typeof VoyageProviderConfig)["~type.make.in"];

/**
 * Create VoyageEmbeddingProvider with explicit config
 *
 * **Example** (Inspect make voyage provider)
 *
 * ```ts
 * import { Duration, Effect, Redacted } from "effect"
 * import { makeVoyageProvider, VoyageProviderConfig } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * const provider = makeVoyageProvider(
 *   VoyageProviderConfig.make({
 *     apiKey: Redacted.make("sk-test"),
 *     timeout: Duration.seconds(10)
 *   })
 * )
 * console.log(Effect.isEffect(provider)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeVoyageProvider = Effect.fn("makeVoyageProvider")(function* (
  input: VoyageProviderConfigInput
): Effect.fn.Return<EmbeddingProviderMethods, never, HttpClient.HttpClient | EmbeddingRateLimiter> {
  const httpClient = yield* HttpClient.HttpClient;
  const rateLimiter = yield* EmbeddingRateLimiter;

  const config = VoyageProviderConfig.make(input);
  const model = config.model;
  const timeout = config.timeout;
  const timeoutMs = Duration.toMillis(timeout);
  const dimension = VOYAGE_MODELS[model];

  const metadata: ProviderMetadata = {
    providerId: "voyage",
    modelId: model,
    dimension,
  };

  /**
   * Map task type to Voyage input_type
   */
  const mapInputType = Match.type<string>().pipe(
    Match.when("search_query", (): "query" => "query"),
    Match.orElse((): "document" => "document")
  );

  /**
   * Retry schedule for transient errors (429, 5xx)
   * Uses exponential backoff with jitter, respects rate limiter
   */
  const retrySchedule = Schedule.max([
    Schedule.exponential(DEFAULT_INITIAL_RETRY_DELAY),
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
              EmbeddingRateLimitError.make({
                message: `Voyage API rate limit: ${O.getOrElse(errorBody.detail, () => "rate limit exceeded")}`,
                provider: "voyage",
                retryAfterMs: O.some(Milliseconds.make(Duration.toMillis(parseRetryAfter(res)))),
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

  return {
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
              Authorization: `Bearer ${Redacted.value(config.apiKey)}`,
              "Content-Type": "application/json",
            }),
            HttpClientRequest.bodyJsonUnsafe({
              input: texts,
              model,
              input_type: inputType,
            })
          );

          // Execute request with timeout and proper response handling
          return yield* httpClient.execute(request).pipe(
            // Map HTTP client errors (network, connection) to embedding errors
            Effect.mapError((e) => mapVoyageError(e, timeout)),
            Effect.timeout(timeout),
            Effect.catchTag("TimeoutError", () =>
              Effect.fail(
                EmbeddingTimeoutError.make({
                  message: "Voyage API timeout",
                  provider: "voyage",
                  timeoutMs: Milliseconds.make(timeoutMs),
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
        }),
        () => rateLimiter.release
      ),

    cosineSimilarity,
  };
});

/**
 * VoyageEmbeddingProvider layer using ConfigService
 *
 * **Details**
 *
 * Requires EMBEDDING_VOYAGE_API_KEY to be set.
 *
 * **Example** (Inspect voyage embedding provider live)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingProvider } from "@effect-ontology/Service/EmbeddingProvider"
 * import { VoyageEmbeddingProviderLive } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* EmbeddingProvider
 *   return provider.metadata.providerId
 * }).pipe(Effect.provide(VoyageEmbeddingProviderLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VoyageEmbeddingProviderLive: Layer.Layer<
  EmbeddingProvider,
  AnyEmbeddingError,
  ConfigService | EmbeddingRateLimiter | HttpClient.HttpClient
> = Layer.effect(
  EmbeddingProvider,
  Effect.gen(function* () {
    const config = yield* ConfigService;

    // Get API key from config (will be added in Config.ts update)
    const apiKey = yield* Effect.fromOption(config.embedding.voyageApiKey, () =>
      EmbeddingError.make({
        message: "EMBEDDING_VOYAGE_API_KEY is required for the Voyage provider",
        provider: "voyage",
      })
    );
    const model = yield* VoyageModel.decodeUnknownEffect(config.embedding.voyageModel).pipe(
      Effect.mapError((cause) =>
        EmbeddingError.make({
          message: `Unsupported Voyage embedding model: ${config.embedding.voyageModel}`,
          provider: "voyage",
          cause: O.some(cause),
        })
      )
    );

    return yield* makeVoyageProvider({
      apiKey,
      model,
      timeout: config.embedding.timeout,
    });
  })
);

/**
 * Complete Voyage provider with HTTP client
 *
 * **Example** (Inspect voyage embedding provider default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EmbeddingProvider } from "@effect-ontology/Service/EmbeddingProvider"
 * import { VoyageEmbeddingProviderDefault } from "@effect-ontology/Service/VoyageEmbeddingProvider"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* EmbeddingProvider
 *   return provider.metadata.providerId
 * }).pipe(Effect.provide(VoyageEmbeddingProviderDefault))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VoyageEmbeddingProviderDefault: Layer.Layer<
  EmbeddingProvider,
  AnyEmbeddingError,
  ConfigService | EmbeddingRateLimiter
> = VoyageEmbeddingProviderLive.pipe(Layer.provide(FetchHttpClient.layer));
