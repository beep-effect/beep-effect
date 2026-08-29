import {
  ANTHROPIC_DEFAULT_MODEL,
  ANTHROPIC_MODEL_ENV,
  AnthropicLanguageModelLive,
  AnthropicLanguageModelOptions,
  makeAnthropicLanguageModelLayer,
} from "@beep/anthropic";
import { $SemanticaId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { XAi, XAiLanguageModel } from "@beep/xai";
import { Config, Crypto, Effect, Layer, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as AiError from "effect/unstable/ai/AiError";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { LabConfig, RuntimeMode } from "@/runtime/Config";
import { contentDigest, sha256TextSync } from "@/schema/Digest";
import { ModelRevisionUnpinned, ProviderUnavailable } from "@/schema/Errors";
import { ModelIdentity } from "@/schema/Model";
import { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";
import { ActiveModelIdentity } from "@/services/LanguageModel";
import { ProviderCache } from "@/services/ProviderCache";
import type * as Prompt from "effect/unstable/ai/Prompt";
import type { ProviderCacheCorrupt } from "@/schema/Errors";
import type { TaskType } from "@/schema/Model";

const utf8Encoder = new TextEncoder();
const $I = $SemanticaId.create("layers/LanguageModelLive");
const XAI_MODEL_SETTING = "SEMANTICA_XAI_MODEL" as const;
const pinnedModelIdPattern =
  /(?:^claude-(?:opus|sonnet|haiku)-\d+-\d+(?:-\d{8})?$|^grok-\d+(?:\.\d+)+(?:-[a-z0-9]+)*$|(?:^|[-_.])20(?:\d{6}|\d{2}-\d{2}-\d{2})(?:$|[-_.])|(?:^|[-_.])v\d+(?:[._-]\d+)*(?:$|[-_.])|@\d+(?:[._-]\d+)*(?:$|[-_.])|:\d{4}(?:[._-]\d+)*(?:$|[-_.]))/u;
const PinnedModelId = S.NonEmptyString.check(
  S.isPattern(pinnedModelIdPattern, {
    identifier: $I`PinnedModelIdCheck`,
    title: "Pinned model identifier",
    description: "Requires a dated id or an explicit immutable version segment.",
    message: "Expected a model id with an explicit date or version segment.",
  })
).pipe(
  $I.annoteSchema("PinnedModelId", {
    description: "Hosted model identifier that exposes an explicit immutable revision segment.",
  })
);
const isPinnedModelId = S.is(PinnedModelId);

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
 * **Example** (Flatten a text prompt)
 *
 * ```ts
 * import { promptText } from "@/layers/LanguageModelLive"
 * import * as Prompt from "effect/unstable/ai/Prompt"
 *
 * console.log(promptText(Prompt.make("hello"))) // "hello"
 * ```
 *
 * @category encoding
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
 * **Example** (Create a replay lookup)
 *
 * ```ts
 * import { replayGenerateText } from "@/layers/LanguageModelLive"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(replayGenerateText("cached prompt"))) // true
 * ```
 *
 * @category services
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
    // An empty generation (for example an API-level refusal) can never become a
    // cache entry: the entry schema requires non-empty text, and replay must
    // not reproduce an unusable response as success.
    if (Str.isEmpty(response.text)) {
      return yield* AiError.AiError.make({
        method: "generateText",
        module: "SemanticaProviderCache",
        reason: AiError.UnknownError.make({
          description: `The live provider returned an empty generation (finish reason: ${response.finishReason}).`,
        }),
      });
    }
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
 * **Example** (Wrap a model layer)
 *
 * ```ts
 * import { CachingLanguageModelLive } from "@/layers/LanguageModelLive"
 * import { Effect, Layer, Stream } from "effect"
 * import * as LanguageModel from "effect/unstable/ai/LanguageModel"
 *
 * const inner = Layer.succeed(LanguageModel.LanguageModel, LanguageModel.make({
 *   generateText: () => Effect.never,
 *   streamText: () => Stream.empty
 * }))
 * console.log(Layer.isLayer(CachingLanguageModelLive(inner))) // true
 * ```
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
 * **Example** (Inspect the replay layer)
 *
 * ```ts
 * import { ReplayLanguageModelLive } from "@/layers/LanguageModelLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ReplayLanguageModelLive)) // true
 * ```
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
 * Selects the cache-writing or cache-only model adapter from runtime mode.
 *
 * **Gotchas**
 *
 * Provider acquisition stays lazy, so replay never reads live credentials.
 *
 * **Example** (Select a runtime model layer)
 *
 * ```ts
 * import { LanguageModelRuntimeLive } from "@/layers/LanguageModelLive"
 * import { Effect, Layer, Stream } from "effect"
 * import * as LanguageModel from "effect/unstable/ai/LanguageModel"
 *
 * const live = Layer.effect(LanguageModel.LanguageModel, LanguageModel.make({
 *   generateText: () => Effect.never,
 *   streamText: () => Stream.empty
 * }))
 * console.log(Layer.isLayer(LanguageModelRuntimeLive(live))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LanguageModelRuntimeLive = <E, R>(live: Layer.Layer<LanguageModel.LanguageModel, E, R>) =>
  Layer.unwrap(
    LabConfig.pipe(
      Effect.map((config) =>
        RuntimeMode.$match(config.mode, {
          live: () => CachingLanguageModelLive(live),
          replay: () => ReplayLanguageModelLive,
        })
      )
    )
  );

/**
 * Supplies the cache identity paired with a provider model Layer.
 *
 * **Example** (Provide a dated test identity)
 *
 * ```ts
 * import { ActiveModelIdentityLive } from "@/layers/LanguageModelLive"
 * import { ModelIdentity } from "@/schema/Model"
 * import { Sha256Hex } from "@beep/schema"
 * import { Layer } from "effect"
 *
 * const identity = ModelIdentity.make({
 *   artifactHash: Sha256Hex.make("0".repeat(64)),
 *   name: "stub-20260826",
 *   provider: "xai",
 *   revision: "stub-20260826",
 *   taskType: "gold-proposal"
 * })
 * console.log(Layer.isLayer(ActiveModelIdentityLive(identity))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ActiveModelIdentityLive = (identity: ModelIdentity) => Layer.succeed(ActiveModelIdentity, identity);

/**
 * Requires a dated or explicitly versioned model id and retains it verbatim as
 * the revision.
 *
 * @category models
 * @since 0.0.0
 */
const modelRevision = Effect.fn("LanguageModel.modelRevision")(function* (
  model: string,
  setting: ModelRevisionUnpinned["setting"]
) {
  if (!isPinnedModelId(model)) {
    return yield* ModelRevisionUnpinned.make({
      message: `Configure ${setting} with an explicitly versioned model id.`,
      model,
      setting,
    });
  }
  return model;
});

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
  taskType: TaskType,
  setting: ModelRevisionUnpinned["setting"]
) =>
  modelRevision(model, setting).pipe(
    Effect.map((revision) =>
      ModelIdentity.make({
        artifactHash,
        name: model,
        provider,
        revision,
        taskType,
      })
    )
  );

/**
 * Builds the pinned Anthropic extraction identity used by C0.
 *
 * **Example** (Build an extraction identity)
 *
 * ```ts
 * import { AnthropicExtractionModelIdentity } from "@/layers/LanguageModelLive"
 * import { Sha256Hex } from "@beep/schema"
 * import { Effect } from "effect"
 * import * as Str from "effect/String"
 *
 * const identity = Effect.runSync(AnthropicExtractionModelIdentity({
 *   artifactHash: Sha256Hex.make(Str.repeat(64)("a")),
 *   model: "stub-extractor-20260826"
 * }))
 * console.log(identity.taskType) // "extraction"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AnthropicExtractionModelIdentity = (options: {
  readonly artifactHash: ModelIdentity["artifactHash"];
  readonly model: string;
}) => makeModelIdentity("anthropic", options.model, options.artifactHash, "extraction", ANTHROPIC_MODEL_ENV);

/**
 * Raw xAI provider Layer for the gold proposer.
 *
 * **Example** (Create a pinned xAI provider layer)
 *
 * ```ts
 * import { XAiGoldProviderLive } from "@/layers/LanguageModelLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(XAiGoldProviderLive("grok-4-20260826"))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const XAiGoldProviderLive = (model: string) => XAiLanguageModel.layer({ model }).pipe(Layer.provide(XAi.layer));

/**
 * Cache identity Layer paired with the xAI gold proposer.
 *
 * **Example** (Create a pinned xAI identity layer)
 *
 * ```ts
 * import { XAiGoldModelIdentityLive } from "@/layers/LanguageModelLive"
 * import { Sha256Hex } from "@beep/schema"
 * import { Layer } from "effect"
 *
 * const layer = XAiGoldModelIdentityLive({
 *   artifactHash: Sha256Hex.make("0".repeat(64)),
 *   model: "grok-4-20260826"
 * })
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const XAiGoldModelIdentityLive = (options: {
  readonly artifactHash: ModelIdentity["artifactHash"];
  readonly model: string;
}) =>
  Layer.effect(
    ActiveModelIdentity,
    makeModelIdentity("xai", options.model, options.artifactHash, "gold-proposal", XAI_MODEL_SETTING)
  );

/**
 * Raw Anthropic language-model Layer pinned to the exact configured extractor id.
 *
 * **Details**
 *
 * The driver receives `LabConfig.extractorModel` directly, so provider requests
 * and the active cache identity cannot select different model defaults.
 *
 * **Example** (Inspect the provider layer)
 *
 * ```ts
 * import { AnthropicExtractionProviderLive } from "@/layers/LanguageModelLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(AnthropicExtractionProviderLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AnthropicExtractionProviderLive = Layer.unwrap(
  LabConfig.pipe(
    Effect.map((config) =>
      makeAnthropicLanguageModelLayer(AnthropicLanguageModelOptions.make({ model: config.extractorModel }))
    )
  )
);

/**
 * Live xAI gold-proposal model over the immutable cache boundary.
 *
 * **Example** (Create a cached xAI gold layer)
 *
 * ```ts
 * import { XAiGoldLanguageModelLive } from "@/layers/LanguageModelLive"
 * import { Sha256Hex } from "@beep/schema"
 * import { Layer } from "effect"
 *
 * const layer = XAiGoldLanguageModelLive({
 *   artifactHash: Sha256Hex.make("0".repeat(64)),
 *   model: "grok-4-20260826"
 * })
 * console.log(Layer.isLayer(layer)) // true
 * ```
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
 * **Details**
 *
 * Acquisition reads `AI_ANTHROPIC_MODEL`, validates that the selected id is
 * revision-pinned, and exposes the same identity used by the cache adapter.
 *
 * **Example** (Create the extraction layer)
 *
 * ```ts
 * import { AnthropicExtractionLanguageModelLive } from "@/layers/LanguageModelLive"
 * import { Sha256Hex } from "@beep/schema"
 * import { Layer } from "effect"
 *
 * const layer = AnthropicExtractionLanguageModelLive(Sha256Hex.make("0".repeat(64)))
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AnthropicExtractionLanguageModelLive = (artifactHash: ModelIdentity["artifactHash"]) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const model = yield* Config.nonEmptyString(ANTHROPIC_MODEL_ENV).pipe(Config.withDefault(ANTHROPIC_DEFAULT_MODEL));
      const identity = Layer.effect(ActiveModelIdentity, AnthropicExtractionModelIdentity({ artifactHash, model }));
      const languageModel = CachingLanguageModelLive(AnthropicLanguageModelLive).pipe(Layer.provide(identity));
      return Layer.merge(languageModel, identity);
    })
  );
