/**
 * Rate-limited Effect AI provider clients.
 *
 * **Details**
 *
 * Rate limiting and circuit breaking live below `LanguageModel.make`, where
 * provider operations have the concrete `AiError` failure channel. This keeps
 * operational failures typed instead of converting them to defects or widening
 * the generic high-level language-model contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicClient } from "@effect/ai-anthropic";
import { OpenAiClient } from "@effect/ai-openai";
import { PosInt } from "@beep/schema/Int";
import { Clock, DateTime, Duration, Effect, Layer, Ref, Stream } from "effect";
import * as O from "effect/Option";
import { AiError } from "effect/unstable/ai";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import { ConfigService } from "../Service/Config.ts";
import { LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { makeCircuitBreaker } from "./CircuitBreaker.ts";

interface ProviderRateLimit {
  readonly perSecond: number;
  readonly perMinute: number;
}

interface AiProtection {
  readonly protect: <A, R>(
    method: string,
    effect: Effect.Effect<A, AiError.AiError, R>
  ) => Effect.Effect<A, AiError.AiError, R>;
  readonly observeStream: <A, R>(
    method: string,
    stream: Stream.Stream<A, AiError.AiError, R>
  ) => Stream.Stream<A, AiError.AiError, R>;
}

const RATE_LIMITS: Readonly<Record<string, ProviderRateLimit>> = {
  anthropic: { perSecond: 2, perMinute: 20 },
  openai: { perSecond: 3, perMinute: 30 },
  google: { perSecond: 2, perMinute: 20 },
};

const makeAiProtection = Effect.fn("RateLimitedAiClient.makeProtection")(function* () {
  const config = yield* ConfigService;
  const limiter = yield* RateLimiter.make;
  const circuitBreaker = yield* makeCircuitBreaker({
    maxFailures: PosInt.make(5),
    resetTimeout: Duration.minutes(2),
    successThreshold: PosInt.make(2),
  });
  const callCount = yield* Ref.make(0);
  const rateLimit = RATE_LIMITS[config.llm.provider] ?? { perSecond: 2, perMinute: 20 };

  const toAiError = (method: string, description: string, cause: unknown): AiError.AiError =>
    AiError.AiError.make({
      module: "RateLimitedAiClient",
      method,
      reason: AiError.UnknownError.make({ description, metadata: { cause } }),
    });

  const protectCircuit = <A, R>(
    method: string,
    effect: Effect.Effect<A, AiError.AiError, R>
  ): Effect.Effect<A, AiError.AiError, R> =>
    circuitBreaker.protect(effect).pipe(
      Effect.catchTag("CircuitOpenError", (error) => {
        const lastFailure = O.match(error.lastFailureTime, {
          onNone: () => "unknown",
          onSome: (timestamp) => DateTime.formatIso(DateTime.makeUnsafe(timestamp)),
        });
        return Effect.fail(
          toAiError(
            method,
            `Circuit breaker is open. Last failure: ${lastFailure}. Reset timeout: ${error.resetTimeoutMs}ms`,
            error
          )
        );
      })
    );

  const acquire = Effect.fn("RateLimitedAiClient.acquire")(function* (method: string) {
    const startedAt = yield* Clock.currentTimeMillis;
    const perSecond = yield* limiter
      .consume({
        key: `${config.llm.provider}:per-second`,
        limit: rateLimit.perSecond,
        window: "1 second",
        algorithm: "fixed-window",
        onExceeded: "delay",
      })
      .pipe(Effect.mapError((error) => toAiError(method, `Rate limiter failed before ${method}`, error)));
    const perMinute = yield* limiter
      .consume({
        key: `${config.llm.provider}:per-minute`,
        limit: rateLimit.perMinute,
        window: "1 minute",
        algorithm: "fixed-window",
        onExceeded: "delay",
      })
      .pipe(Effect.mapError((error) => toAiError(method, `Rate limiter failed before ${method}`, error)));
    const delay = Duration.max(perSecond.delay, perMinute.delay);
    if (!Duration.isZero(delay)) {
      yield* Effect.sleep(delay);
    }
    const completedAt = yield* Clock.currentTimeMillis;
    const waitMs = Number(completedAt - startedAt);
    yield* Effect.annotateCurrentSpan(LlmAttributes.RATE_LIMITER_WAIT_MS, waitMs);
    return waitMs;
  });

  const protect = <A, R>(
    method: string,
    effect: Effect.Effect<A, AiError.AiError, R>
  ): Effect.Effect<A, AiError.AiError, R> =>
    Effect.gen(function* () {
      const callId = yield* Ref.updateAndGet(callCount, (count) => count + 1);
      const waitMs = yield* acquire(method);
      const modelStartedAt = yield* Clock.currentTimeMillis;
      const result = yield* protectCircuit(method, effect);
      const modelCompletedAt = yield* Clock.currentTimeMillis;
      const modelDurationMs = Number(modelCompletedAt - modelStartedAt);
      yield* Effect.logDebug("LLM provider call completed", {
        provider: config.llm.provider,
        method,
        callId,
        waitMs,
        modelDurationMs,
      });
      yield* Effect.annotateCurrentSpan(LlmAttributes.LLM_CALL_ID, callId);
      yield* Effect.annotateCurrentSpan(LlmAttributes.LLM_METHOD, method);
      return result;
    }).pipe(
      Effect.withSpan(`llm.provider.${method}`, {
        attributes: {
          [LlmAttributes.PROVIDER]: config.llm.provider,
          [LlmAttributes.MODEL]: config.llm.model,
        },
      })
    );

  const observeStream = <A, R>(
    method: string,
    stream: Stream.Stream<A, AiError.AiError, R>
  ): Stream.Stream<A, AiError.AiError, R> =>
    stream.pipe(Stream.catch((error) => Stream.fromEffect(protectCircuit(`${method}.stream`, Effect.fail(error)))));

  yield* Effect.logInfo("Dual provider rate limiter initialized", {
    provider: config.llm.provider,
    perSecond: rateLimit.perSecond,
    perMinute: rateLimit.perMinute,
  });

  const protection: AiProtection = { observeStream, protect };
  return protection;
});

/**
 *  Rate-limited Anthropic client adapter used before `AnthropicLanguageModel.make`.
 *
 * **Example** (Inspect rate limited anthropic client layer)
 *
 * ```ts
 * import { RateLimitedAnthropicClientLayer } from "@effect-ontology/Runtime/RateLimitedLanguageModel"
 *
 * console.log(RateLimitedAnthropicClientLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RateLimitedAnthropicClientLayer = Layer.effect(
  AnthropicClient.AnthropicClient,
  Effect.gen(function* () {
    const base = yield* AnthropicClient.AnthropicClient;
    const protection = yield* makeAiProtection();
    const createMessageStream: AnthropicClient.Service["createMessageStream"] = (options) =>
      protection
        .protect("anthropic.createMessageStream", base.createMessageStream(options))
        .pipe(
          Effect.map(([response, stream]) => [
            response,
            protection.observeStream("anthropic.createMessageStream", stream),
          ])
        );
    return {
      ...base,
      createMessage: (options: Parameters<typeof base.createMessage>[0]) =>
        protection.protect("anthropic.createMessage", base.createMessage(options)),
      createMessageStream,
    } satisfies AnthropicClient.Service;
  })
).pipe(Layer.provide(RateLimiter.layerStoreMemory));

/**
 *  Rate-limited OpenAI client adapter used before `OpenAiLanguageModel.make`.
 *
 * **Example** (Inspect rate limited open ai client layer)
 *
 * ```ts
 * import { RateLimitedOpenAiClientLayer } from "@effect-ontology/Runtime/RateLimitedLanguageModel"
 *
 * console.log(RateLimitedOpenAiClientLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RateLimitedOpenAiClientLayer = Layer.effect(
  OpenAiClient.OpenAiClient,
  Effect.gen(function* () {
    const base = yield* OpenAiClient.OpenAiClient;
    const protection = yield* makeAiProtection();
    const createResponseStream: OpenAiClient.Service["createResponseStream"] = (options) =>
      protection
        .protect("openai.createResponseStream", base.createResponseStream(options))
        .pipe(
          Effect.map(([response, stream]) => [
            response,
            protection.observeStream("openai.createResponseStream", stream),
          ])
        );
    return {
      ...base,
      createResponse: (options: Parameters<typeof base.createResponse>[0]) =>
        protection.protect("openai.createResponse", base.createResponse(options)),
      createResponseStream,
      createEmbedding: (options: Parameters<typeof base.createEmbedding>[0]) =>
        protection.protect("openai.createEmbedding", base.createEmbedding(options)),
    } satisfies OpenAiClient.Service;
  })
).pipe(Layer.provide(RateLimiter.layerStoreMemory));
