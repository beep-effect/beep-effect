/**
 * Runtime: Rate-Limited Language Model Layer
 *
 * Wraps LanguageModel.LanguageModel with rate limiting to prevent API quota exhaustion.
 * Uses Effect's built-in RateLimiter with token-bucket algorithm.
 *
 * Implements dual rate limiting:
 * - Per-second burst protection (max 2 concurrent starts)
 * - Per-minute sustained rate (max 20 RPM)
 *
 * This layer sits between the base LanguageModel provider and consuming services,
 * ensuring all LLM calls are automatically rate limited.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Clock, DateTime, Duration, Effect, Layer, Stream } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import type { NoExcessProperties } from "effect/Types";
import type { Response } from "effect/unstable/ai";
import { AiError, LanguageModel } from "effect/unstable/ai";
import type * as Tool from "effect/unstable/ai/Tool";
import type * as Toolkit from "effect/unstable/ai/Toolkit";
import { flow } from "effect/Function";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import { ConfigService } from "../Service/Config.ts";
import { LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { CircuitOpenError, makeCircuitBreaker } from "./CircuitBreaker.ts";

/**
 * Rate limit configurations per provider
 *
 * Uses very conservative values to avoid socket errors from API rate limiting.
 * Dual limits: per-second (burst) and per-minute (sustained).
 *
 * @internal
 */
const RATE_LIMITS: Record<
  string,
  {
    perSecond: number;
    perMinute: number;
  }
> = {
  // Anthropic: Very conservative - 2/sec burst, 20/min sustained
  anthropic: { perSecond: 2, perMinute: 20 },
  // OpenAI: Slightly higher limits
  openai: { perSecond: 3, perMinute: 30 },
  // Google: Similar to Anthropic
  google: { perSecond: 2, perMinute: 20 },
};

/**
 * Create a rate-limited LanguageModel layer
 *
 * Wraps the base LanguageModel with rate limiting based on provider configuration.
 * All LLM methods (generateObject, generateText, streamText) are wrapped.
 *
 * **Example** (Use callCount)
 * ```ts
 * // In ProductionRuntime
 * const layers = ExtractionLayersLive.pipe(
 *   Layer.provide(RateLimitedLanguageModelLayer),
 *   Layer.provide(makeLanguageModelLayer)
 * )
 * ```
 *
 * @since 0.0.0
 */
/**
 * Track LLM call statistics for observability
 */
let callCount = 0;

export const RateLimitedLanguageModelLayer = Layer.effect(
  LanguageModel.LanguageModel,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const baseLlm = yield* LanguageModel.LanguageModel;
    // Get rate limit config for the current provider
    const rateLimitConfig = RATE_LIMITS[config.llm.provider] ?? { perSecond: 2, perMinute: 20 };

    const limiter = yield* RateLimiter.make;

    // Compose both rate limiters - request must pass both
    const rateLimiter = <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ): Effect.Effect<A, E | RateLimiter.RateLimiterError, R> =>
      Effect.gen(function* () {
        const perSecond = yield* limiter.consume({
          key: `${config.llm.provider}:per-second`,
          limit: rateLimitConfig.perSecond,
          window: "1 second",
          algorithm: "fixed-window",
          onExceeded: "delay",
        });
        const perMinute = yield* limiter.consume({
          key: `${config.llm.provider}:per-minute`,
          limit: rateLimitConfig.perMinute,
          window: "1 minute",
          algorithm: "fixed-window",
          onExceeded: "delay",
        });
        const delay = Duration.max(perSecond.delay, perMinute.delay);
        if (!Duration.isZero(delay)) yield* Effect.sleep(delay);
        return yield* effect;
      });

    yield* Effect.logInfo("Dual rate limiter initialized", {
      provider: config.llm.provider,
      perSecond: rateLimitConfig.perSecond,
      perMinute: rateLimitConfig.perMinute,
    });

    // Initialize Circuit Breaker
    // This provides a safety valve for when the API is failing repeatedly
    const circuitBreaker = yield* makeCircuitBreaker({
      maxFailures: 5, // Open after 5 consecutive failures
      resetTimeout: Duration.minutes(2), // Wait 2 minutes before testing recovery
      successThreshold: 2, // Require 2 successful calls to close circuit
    });

    // Helper to wrap LLM calls with rate limiting and observability
    const withRateLimit = <A, E, R>(
      method: string,
      effect: Effect.Effect<A, AiError.AiError | E, R>
    ): Effect.Effect<A, AiError.AiError | E, R> => {
      const callId = ++callCount;

      return Clock.currentTimeMillis.pipe(
        Effect.tap((_startTime) =>
          Effect.logDebug("LLM call queued", {
            provider: config.llm.provider,
            method,
            callId,
          })
        ),
        Effect.flatMap((startTime) =>
          // Apply protection layers:
          // 1. Circuit Breaker (fail fast if API is down)
          // 2. Rate Limiter (wait for token)
          circuitBreaker
            .protect(
              rateLimiter(effect).pipe(
                Effect.catchTag("RateLimiterError", (error) =>
                  Effect.fail(
                    AiError.AiError.make({
                      module: "RateLimitedLanguageModel",
                      method,
                      reason: AiError.UnknownError.make({
                        description: `Rate limiter failed for ${method}`,
                        metadata: { method, cause: error },
                      }),
                    })
                  )
                )
              )
            )
            .pipe(
              // Convert CircuitOpenError to AiError.UnknownError
              // This maintains compatibility with LanguageModel error channel (E must extend AiError)
              // while preserving circuit breaker state information
              Effect.catchIf(CircuitOpenError.is, (circuitError) => {
                const lastFailureStr = O.match(circuitError.lastFailureTime, {
                  onNone: () => "unknown",
                  onSome: flow(DateTime.makeUnsafe, DateTime.formatIso),
                });
                return AiError.AiError.make({
                  module: "RateLimitedLanguageModel",
                  method: `${method} (circuit breaker)`,
                  reason: AiError.UnknownError.make({
                    description: `Circuit breaker is open. Last failure: ${lastFailureStr}. Reset timeout: ${circuitError.resetTimeoutMs}ms`,
                    metadata: { cause: circuitError },
                  }),
                });
              }),
              Effect.tap((_result) =>
                Clock.currentTimeMillis.pipe(
                  Effect.flatMap((endTime) => {
                    const waitMs = Number(endTime - startTime);
                    return Effect.all([
                      Effect.logDebug("LLM call completed", {
                        provider: config.llm.provider,
                        method,
                        callId,
                        rateLimiterWaitMs: waitMs,
                      }),
                      Effect.annotateCurrentSpan(LlmAttributes.RATE_LIMITER_WAIT_MS, waitMs),
                      Effect.annotateCurrentSpan(LlmAttributes.LLM_CALL_ID, callId),
                      Effect.annotateCurrentSpan(LlmAttributes.LLM_METHOD, method),
                    ]);
                  })
                )
              )
            )
        ),
        Effect.withSpan(`llm.${method}`, {
          attributes: {
            [LlmAttributes.PROVIDER]: config.llm.provider,
            [LlmAttributes.MODEL]: config.llm.model,
          },
        })
      );
    };

    // Return wrapped LanguageModel with all methods rate-limited
    const generateObject = <
      ObjectEncoded extends Record<string, any>,
      StructuredOutputSchema extends S.Encoder<ObjectEncoded, unknown>,
      Options extends NoExcessProperties<LanguageModel.GenerateObjectOptions<any, StructuredOutputSchema>, Options>,
      Tools extends Record<string, Tool.Any> = {},
    >(
      options: Options & LanguageModel.GenerateObjectOptions<Tools, StructuredOutputSchema>
    ): Effect.Effect<
      LanguageModel.GenerateObjectResponse<Tools, StructuredOutputSchema["Type"]>,
      LanguageModel.ExtractError<Options>,
      StructuredOutputSchema["DecodingServices"] | LanguageModel.ExtractServices<Options>
    > =>
      withRateLimit(
        "generateObject",
        baseLlm.generateObject<ObjectEncoded, StructuredOutputSchema, Options, Tools>(options)
      );

    type GenerateTextOptionsWithoutToolkit = Omit<LanguageModel.GenerateTextOptions<{}>, "toolkit"> & {
      readonly toolkit?: undefined;
    };

    function generateText<Options extends NoExcessProperties<GenerateTextOptionsWithoutToolkit, Options>>(
      options: Options & GenerateTextOptionsWithoutToolkit
    ): Effect.Effect<
      LanguageModel.GenerateTextResponse<{}>,
      LanguageModel.ExtractError<Options>,
      LanguageModel.ExtractServices<Options>
    >;
    function generateText<
      Tools extends Record<string, Tool.Any>,
      Options extends NoExcessProperties<
        LanguageModel.GenerateTextOptions<Tools> & { readonly toolkit: LanguageModel.ToolkitInput<Tools> },
        Options
      >,
    >(
      options: Options &
        LanguageModel.GenerateTextOptions<Tools> & { readonly toolkit: LanguageModel.ToolkitInput<Tools> }
    ): Effect.Effect<
      LanguageModel.GenerateTextResponse<Tools>,
      LanguageModel.ExtractError<Options>,
      LanguageModel.ExtractServices<Options>
    >;
    function generateText<
      Options extends { readonly toolkit: LanguageModel.ToolkitOption<any> } & NoExcessProperties<
        LanguageModel.GenerateTextOptions<any>,
        Options
      >,
    >(
      options: Options &
        LanguageModel.GenerateTextOptions<LanguageModel.ExtractTools<Options>> & {
          readonly toolkit: Options["toolkit"];
        }
    ): Effect.Effect<
      LanguageModel.GenerateTextResponse<LanguageModel.ExtractTools<Options>>,
      LanguageModel.ExtractError<Options>,
      LanguageModel.ExtractServices<Options>
    >;
    function generateText<Tools extends Record<string, Tool.Any>, E, R>(
      options: Omit<LanguageModel.GenerateTextOptions<Tools>, "toolkit"> & {
        readonly toolkit?: LanguageModel.ToolkitInput<Tools, E, R>;
      }
    ) {
      const toolkit = options.toolkit;
      if (P.isUndefined(toolkit)) {
        const withoutToolkit = {
          prompt: options.prompt,
          ...(P.isNotUndefined(options.concurrency) ? { concurrency: options.concurrency } : {}),
          ...(P.isNotUndefined(options.disableToolCallResolution)
            ? { disableToolCallResolution: options.disableToolCallResolution }
            : {}),
          ...(P.isString(options.toolChoice) ? { toolChoice: options.toolChoice } : {}),
        } satisfies GenerateTextOptionsWithoutToolkit;
        return withRateLimit("generateText", baseLlm.generateText<GenerateTextOptionsWithoutToolkit>(withoutToolkit));
      }
      const toolkitInput: LanguageModel.ToolkitInput<Tools, E, R> = toolkit;
      const generateWithToolkit = (resolvedToolkit: Toolkit.WithHandler<Tools>) => {
        const withToolkit = { ...options, toolkit: resolvedToolkit };
        return baseLlm.generateText<Tools, typeof withToolkit>(withToolkit);
      };
      const isToolkitWithHandler = (
        input: LanguageModel.ToolkitInput<Tools, E, R>
      ): input is Toolkit.WithHandler<Tools> => P.not(Effect.isEffect)(input);
      if (isToolkitWithHandler(toolkitInput)) {
        return withRateLimit("generateText", generateWithToolkit(toolkitInput));
      }
      const isToolkitEffect = (
        input: LanguageModel.ToolkitInput<Tools, E, R>
      ): input is Effect.Effect<Toolkit.WithHandler<Tools>, E, R> => Effect.isEffect(input);
      if (isToolkitEffect(toolkitInput)) {
        return withRateLimit("generateText", toolkitInput.pipe(Effect.flatMap(generateWithToolkit)));
      }
      return Effect.die("Invalid language model toolkit input");
    }

    function streamText<Options extends NoExcessProperties<GenerateTextOptionsWithoutToolkit, Options>>(
      options: Options & GenerateTextOptionsWithoutToolkit
    ): Stream.Stream<
      Response.StreamPart<{}>,
      LanguageModel.ExtractError<Options>,
      LanguageModel.ExtractServices<Options>
    >;
    function streamText<
      Tools extends Record<string, Tool.Any>,
      Options extends NoExcessProperties<
        LanguageModel.GenerateTextOptions<Tools> & { readonly toolkit: LanguageModel.ToolkitInput<Tools> },
        Options
      >,
    >(
      options: Options &
        LanguageModel.GenerateTextOptions<Tools> & { readonly toolkit: LanguageModel.ToolkitInput<Tools> }
    ): Stream.Stream<
      Response.StreamPart<Tools>,
      LanguageModel.ExtractError<Options>,
      LanguageModel.ExtractServices<Options>
    >;
    function streamText<
      Options extends { readonly toolkit: LanguageModel.ToolkitOption<any> } & NoExcessProperties<
        LanguageModel.GenerateTextOptions<any>,
        Options
      >,
    >(
      options: Options &
        LanguageModel.GenerateTextOptions<LanguageModel.ExtractTools<Options>> & {
          readonly toolkit: Options["toolkit"];
        }
    ): Stream.Stream<
      Response.StreamPart<LanguageModel.ExtractTools<Options>>,
      LanguageModel.ExtractError<Options>,
      LanguageModel.ExtractServices<Options>
    >;
    function streamText(options: LanguageModel.GenerateTextOptions<Record<string, Tool.Any>>) {
      if (P.isUndefined(options.toolkit)) {
        const withoutToolkit = {
          prompt: options.prompt,
          ...(P.isNotUndefined(options.concurrency) ? { concurrency: options.concurrency } : {}),
          ...(P.isNotUndefined(options.disableToolCallResolution)
            ? { disableToolCallResolution: options.disableToolCallResolution }
            : {}),
          ...(P.isString(options.toolChoice) ? { toolChoice: options.toolChoice } : {}),
        } satisfies GenerateTextOptionsWithoutToolkit;
        return Stream.unwrap(
          withRateLimit(
            "streamText",
            Effect.sync(() => baseLlm.streamText<GenerateTextOptionsWithoutToolkit>(withoutToolkit))
          )
        );
      }
      const withToolkit = { ...options, toolkit: options.toolkit };
      return Stream.unwrap(
        withRateLimit(
          "streamText",
          Effect.sync(() => baseLlm.streamText<Record<string, Tool.Any>, typeof withToolkit>(withToolkit))
        )
      );
    }

    const service: LanguageModel.Service = {
      generateObject,
      generateText,
      // streamText returns a Stream, so we rate-limit the stream creation
      streamText,
    };
    return service;
  })
).pipe(Layer.provide(RateLimiter.layerStoreMemory));
