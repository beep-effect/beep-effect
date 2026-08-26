import { ANTHROPIC_DEFAULT_MODEL, ANTHROPIC_MODEL_ENV, AnthropicLanguageModelLive } from "@beep/anthropic";
import { Sha256HexFromBytes } from "@beep/schema";
import { XAi, XAiLanguageModel } from "@beep/xai";
import { Config, Crypto, Effect, Layer, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as AiError from "effect/unstable/ai/AiError";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { contentDigest, sha256TextSync } from "@/schema/Digest";
import { ProviderUnavailable } from "@/schema/Errors";
import { ModelIdentity } from "@/schema/Model";
import { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";
import { ActiveModelIdentity } from "@/services/LanguageModel";
import { ProviderCache } from "@/services/ProviderCache";
import type * as Prompt from "effect/unstable/ai/Prompt";
import type { ProviderCacheCorrupt } from "@/schema/Errors";
import type { TaskType } from "@/schema/Model";

const utf8Encoder = new TextEncoder();

const textParts = (message: Prompt.Message): ReadonlyArray<string> => {
  if (message.role === "system") {
    return [message.content];
  }
  const texts: Array<string> = [];
  for (const part of message.content) {
    if (part.type === "text") {
      texts.push(part.text);
    }
  }
  return texts;
};

/**
 * Reduces an Effect AI prompt to the exact text used by the C0 cache key.
 *
 * **Gotchas**
 *
 * C0 callers use text-only prompts. Text parts from multiple messages are
 * separated by one newline; non-text parts are deliberately excluded.
 *
 * @category caching
 * @since 0.0.0
 */
export const promptText = (prompt: Prompt.Prompt): string => A.join(A.flatMap(prompt.content, textParts), "\n");

const hashText = Effect.fn("LanguageModelCache.hashText")((text: string) =>
  Sha256HexFromBytes.decodeEffect(utf8Encoder.encode(text)).pipe(Effect.orDie)
);

const makeKey = Effect.fn("LanguageModelCache.makeKey")(function* (model: ModelIdentity, prompt: string) {
  return ProviderCacheKey.make({
    inputDigest: yield* hashText(prompt),
    model,
    requestKind: "generate-text",
    schemaVersion: "provider-cache/v1",
  });
});

const makeOfflineMiss = Effect.fn("LanguageModelCache.makeOfflineMiss")(function* (key: ProviderCacheKey) {
  const cacheKey = yield* contentDigest(ProviderCacheKey)(key).pipe(Effect.orDie);
  return ProviderUnavailable.make({
    cacheKey,
    message: "The requested provider response is absent from the offline cache.",
    offline: true,
  });
});

const lookupCachedResponse = Effect.fn("LanguageModelCache.lookupCachedResponse")(function* (
  prompt: string
): Effect.fn.Return<
  Result.Result<string, ProviderCacheKey>,
  ProviderCacheCorrupt,
  ActiveModelIdentity | Crypto.Crypto | ProviderCache
> {
  const model = yield* ActiveModelIdentity;
  const cache = yield* ProviderCache;
  const key = yield* makeKey(model, prompt);
  return (yield* cache.lookup(key)).pipe(
    O.match({
      onNone: () => Result.fail(key),
      onSome: (entry) => Result.succeed(entry.response),
    })
  );
});

/**
 * Reads one text generation from the immutable provider cache.
 *
 * **Details**
 *
 * This typed boundary preserves `ProviderUnavailable { offline: true }` for a
 * replay miss. The Effect AI adapter translates it to `AiError` only because
 * the installed v4 `LanguageModel.Service` fixes its provider error channel.
 *
 * @category caching
 * @since 0.0.0
 */
export const replayGenerateText = Effect.fn("LanguageModelCache.replayGenerateText")(function* (
  prompt: string
): Effect.fn.Return<
  string,
  ProviderCacheCorrupt | ProviderUnavailable,
  ActiveModelIdentity | Crypto.Crypto | ProviderCache
> {
  return yield* (yield* lookupCachedResponse(prompt)).pipe(
    Result.match({
      onFailure: (key) => makeOfflineMiss(key).pipe(Effect.flatMap(Effect.fail)),
      onSuccess: Effect.succeed,
    })
  );
});

const cachedGenerateText = Effect.fn("LanguageModelCache.cachedGenerateText")(function* (
  inner: LanguageModel.Service,
  prompt: string
): Effect.fn.Return<
  string,
  AiError.AiError | ProviderCacheCorrupt,
  ActiveModelIdentity | Crypto.Crypto | ProviderCache
> {
  const onCacheMiss = Effect.fn("LanguageModelCache.cachedGenerateText.onCacheMiss")(function* (key: ProviderCacheKey) {
    const cache = yield* ProviderCache;
    const response = yield* inner.generateText({ prompt });
    const cacheKey = yield* contentDigest(ProviderCacheKey)(key).pipe(Effect.orDie);
    yield* cache.store(
      ProviderCacheEntry.make({
        cacheKey,
        key,
        response: response.text,
        responseDigest: sha256TextSync(response.text),
      })
    );
    return response.text;
  });
  return yield* (yield* lookupCachedResponse(prompt)).pipe(
    Result.match({
      onFailure: onCacheMiss,
      onSuccess: Effect.succeed,
    })
  );
});

const toAiError = (error: ProviderCacheCorrupt | ProviderUnavailable): AiError.AiError =>
  AiError.AiError.make({
    method: "generateText",
    module: "SemanticaProviderCache",
    reason: AiError.UnknownError.make({ description: error.message }),
  });

const toAdapterError = (error: AiError.AiError | ProviderCacheCorrupt | ProviderUnavailable): AiError.AiError =>
  AiError.isAiError(error) ? error : toAiError(error);

const makeGenerateTextAdapter = Effect.fn("LanguageModelCache.makeGenerateTextAdapter")(function* (
  generateText: (
    prompt: string
  ) => Effect.Effect<
    string,
    AiError.AiError | ProviderCacheCorrupt | ProviderUnavailable,
    ActiveModelIdentity | Crypto.Crypto | ProviderCache
  >
) {
  const model = yield* ActiveModelIdentity;
  const crypto = yield* Crypto.Crypto;
  const cache = yield* ProviderCache;
  return yield* LanguageModel.make({
    generateText: (options) =>
      generateText(options.prompt.pipe(promptText)).pipe(
        Effect.provideService(ActiveModelIdentity, model),
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.provideService(ProviderCache, cache),
        Effect.map((text) => [Response.makePart("text", { text })]),
        Effect.mapError(toAdapterError)
      ),
    streamText: () => Stream.empty,
  });
});

const makeCachingAdapter = Effect.gen(function* () {
  const inner = yield* LanguageModel.LanguageModel;
  return yield* makeGenerateTextAdapter((prompt) => cachedGenerateText(inner, prompt));
});

const makeReplayAdapter = makeGenerateTextAdapter(replayGenerateText);

/**
 * Wraps a live Effect AI model with immutable generate-text caching.
 *
 * **Gotchas**
 *
 * The C0 consumers (LangExtract and the gold proposer) read only
 * `GenerateTextResponse.text`; replay therefore stores and reconstructs only
 * text. Streaming and tool-bearing requests are outside this boundary.
 *
 * @category layers
 * @since 0.0.0
 */
export const CachingLanguageModelLive = <E, R>(
  inner: Layer.Layer<LanguageModel.LanguageModel, E, R>
): Layer.Layer<LanguageModel.LanguageModel, E, ActiveModelIdentity | Crypto.Crypto | ProviderCache | R> =>
  Layer.effect(LanguageModel.LanguageModel, makeCachingAdapter).pipe(Layer.provide(inner));

/**
 * Cache-only Effect AI language model.
 *
 * @category layers
 * @since 0.0.0
 */
export const ReplayLanguageModelLive: Layer.Layer<
  LanguageModel.LanguageModel,
  never,
  ActiveModelIdentity | Crypto.Crypto | ProviderCache
> = Layer.effect(LanguageModel.LanguageModel, makeReplayAdapter);

/**
 * Supplies the cache identity paired with a provider model Layer.
 *
 * @category layers
 * @since 0.0.0
 */
export const ActiveModelIdentityLive = (identity: ModelIdentity) => Layer.succeed(ActiveModelIdentity, identity);

/**
 * Extracts a dated model suffix when present, otherwise returns
 * `unversioned`.
 *
 * @category models
 * @since 0.0.0
 */
const modelRevision = (model: string): string =>
  O.flatMap(Str.match(/(?:^|[-_])(\d{4}-\d{2}-\d{2}|\d{8})(?:$|[-_])/)(model), (match) =>
    O.fromUndefinedOr(match[1])
  ).pipe(O.getOrElse(() => "unversioned"));

/**
 * Builds the cache identity for a pinned provider prompt artifact.
 *
 * @category models
 * @since 0.0.0
 */
const makeModelIdentity = (
  provider: "anthropic" | "xai",
  model: string,
  artifactHash: ModelIdentity["artifactHash"],
  taskType: TaskType
): ModelIdentity =>
  ModelIdentity.make({
    artifactHash,
    name: model,
    provider,
    revision: modelRevision(model),
    taskType,
  });

/**
 * Raw xAI provider Layer for the gold proposer.
 *
 * @category layers
 * @since 0.0.0
 */
export const XAiGoldProviderLive = (model: string) => XAiLanguageModel.layer({ model }).pipe(Layer.provide(XAi.layer));

/**
 * Cache identity Layer paired with the xAI gold proposer.
 *
 * @category layers
 * @since 0.0.0
 */
export const XAiGoldModelIdentityLive = (options: {
  readonly artifactHash: ModelIdentity["artifactHash"];
  readonly model: string;
}) => ActiveModelIdentityLive(makeModelIdentity("xai", options.model, options.artifactHash, "gold-proposal"));

/**
 * Live xAI gold-proposal model over the immutable cache boundary.
 *
 * @category layers
 * @since 0.0.0
 */
export const XAiGoldLanguageModelLive = (options: {
  readonly artifactHash: ModelIdentity["artifactHash"];
  readonly model: string;
}) =>
  CachingLanguageModelLive(XAiGoldProviderLive(options.model)).pipe(Layer.provide(XAiGoldModelIdentityLive(options)));

/**
 * Live Anthropic extraction model over the immutable cache boundary.
 *
 * @category layers
 * @since 0.0.0
 */
export const AnthropicExtractionLanguageModelLive = (artifactHash: ModelIdentity["artifactHash"]) =>
  Layer.unwrap(
    Config.nonEmptyString(ANTHROPIC_MODEL_ENV).pipe(
      Config.withDefault(ANTHROPIC_DEFAULT_MODEL),
      Effect.map((model) =>
        CachingLanguageModelLive(AnthropicLanguageModelLive).pipe(
          Layer.provide(ActiveModelIdentityLive(makeModelIdentity("anthropic", model, artifactHash, "extraction")))
        )
      )
    )
  );
