/**
 * Wink layer composition helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { Layer } from "effect";
import { WinkEngineLive as WinkEngineLiveService, WinkEngine as WinkEngineService } from "./Wink.service.ts";
import { WinkCorpusManagerLive as WinkCorpusManagerLiveService } from "./WinkCorpus.service.ts";
import { WinkEngineRefLive as WinkEngineRefLiveService } from "./WinkEngineRef.service.ts";
import { WinkSimilarityLive as WinkSimilarityLiveService } from "./WinkSimilarity.service.ts";
import {
  WinkTokenizationLive as WinkTokenizationLiveService,
  WinkTokenization as WinkTokenizationService,
} from "./WinkTokenization.service.ts";
import { WinkUtilsLive as WinkUtilsLiveService } from "./WinkUtils.service.ts";
import { WinkVectorizerLive as WinkVectorizerLiveService } from "./WinkVectorizer.service.ts";

/**
 * Live layer bundle for the engine-backed tokenization surface.
 *
 * **Example** (Token count via layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Tokenization } from "@beep/nlp-processing/Core"
 * import { WinkLayerLive } from "@beep/wink"
 *
 * const count = Effect.gen(function* () {
 *   const tokenization = yield* Tokenization
 *   return yield* tokenization.tokenCount("Wink tokenizes this sentence.")
 * })
 *
 * Effect.runPromise(count.pipe(Effect.provide(WinkLayerLive))).then(console.log)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkLayerLive = WinkTokenizationService.pipe(Layer.provideMerge(WinkEngineLiveService));

const WinkEngineBackedLive = Layer.mergeAll(WinkTokenizationService, WinkVectorizerLiveService).pipe(
  Layer.provideMerge(WinkEngineLiveService)
);

const WinkLayerCoreLive = Layer.mergeAll(WinkEngineBackedLive, WinkSimilarityLiveService, WinkUtilsLiveService);

const WinkLayerSharedLive = WinkEngineRefLiveService.pipe(Layer.provideMerge(WinkLayerCoreLive));

/**
 * Full live wink layer bundle including corpus management and shared utilities.
 *
 * **Example** (Create corpus with full layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkCorpusManager } from "@beep/wink"
 * import { WinkLayerAllLive } from "@beep/wink"
 *
 * const create = Effect.gen(function* () {
 *   const corpus = yield* WinkCorpusManager
 *   return yield* corpus.createCorpus({ corpusId: "docs" })
 * })
 *
 * Effect.runPromise(create.pipe(Effect.provide(WinkLayerAllLive))).then((summary) =>
 *   console.log(summary.corpusId)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkLayerAllLive = WinkCorpusManagerLiveService.pipe(Layer.provideMerge(WinkLayerSharedLive));

/**
 * Live layer for stateful corpus indexing and query services.
 *
 * **Example** (Merge engine and similarity)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { WinkCorpusManagerLive, WinkEngineLive, WinkSimilarityLive } from "@beep/wink"
 *
 * const runnable = WinkCorpusManagerLive.pipe(
 *   Layer.provideMerge(Layer.mergeAll(WinkEngineLive, WinkSimilarityLive))
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkCorpusManagerLive = WinkCorpusManagerLiveService;
/**
 * Service tag for direct access to the underlying wink runtime.
 *
 * **Example** (Direct engine token count)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkEngine, WinkEngineLive } from "@beep/wink"
 *
 * const count = Effect.gen(function* () {
 *   const engine = yield* WinkEngine
 *   return yield* engine.getWinkTokenCount("Direct wink engine access.")
 * })
 *
 * Effect.runPromise(count.pipe(Effect.provide(WinkEngineLive))).then(console.log)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const WinkEngine = WinkEngineService;
/**
 * Live layer that initializes `wink-nlp` with the English lite web model.
 *
 * **Example** (Read engine its helpers)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkEngine, WinkEngineLive } from "@beep/wink"
 *
 * const readHelpers = Effect.gen(function* () {
 *   const engine = yield* WinkEngine
 *   return yield* engine.its
 * })
 *
 * Effect.runPromise(readHelpers.pipe(Effect.provide(WinkEngineLive))).then((its) =>
 *   console.log(typeof its.normal)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkEngineLive = WinkEngineLiveService;
/**
 * Live layer for compatibility access to the shared wink engine state ref.
 *
 * **Example** (Access shared engine ref)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { WinkEngineRef } from "@beep/wink"
 * import { WinkEngineLive, WinkEngineRefLive } from "@beep/wink"
 *
 * const readRef = Effect.gen(function* () {
 *   const ref = yield* WinkEngineRef
 *   return ref.getRef()
 * })
 *
 * const runnable = readRef.pipe(Effect.provide(WinkEngineRefLive.pipe(Layer.provide(WinkEngineLive))))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkEngineRefLive = WinkEngineRefLiveService;
/**
 * Live layer for wink-backed vector, set, and bag-of-words similarity.
 *
 * **Example** (Provide similarity service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkSimilarity } from "@beep/wink"
 * import { WinkSimilarityLive } from "@beep/wink"
 *
 * const program = Effect.gen(function* () {
 *   const similarity = yield* WinkSimilarity
 *   return similarity
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(WinkSimilarityLive))).then((service) =>
 *   console.log(typeof service.vectorCosine)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkSimilarityLive = WinkSimilarityLiveService;
/**
 * Engine-dependent layer that implements the core tokenization service.
 *
 * **Example** (Wire engine into tokenization)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { WinkEngineLive, WinkTokenization } from "@beep/wink"
 *
 * const runnable = WinkTokenization.pipe(Layer.provide(WinkEngineLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkTokenization = WinkTokenizationService;
/**
 * Live tokenization layer with the wink engine already provided.
 *
 * **Example** (Tokenize with live layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Tokenization } from "@beep/nlp-processing/Core"
 * import { WinkTokenizationLive } from "@beep/wink"
 *
 * const program = Effect.gen(function* () {
 *   const tokenization = yield* Tokenization
 *   return yield* tokenization.tokenize("Tokenize this.")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(WinkTokenizationLive))).then((tokens) =>
 *   console.log(tokens.length)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkTokenizationLive = WinkTokenizationLiveService;
/**
 * Live layer for `wink-nlp-utils` string and token helper wrappers.
 *
 * **Example** (Remove extra spaces helper)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WinkUtils } from "@beep/wink"
 * import { WinkUtilsLive } from "@beep/wink"
 *
 * const program = Effect.gen(function* () {
 *   const utils = yield* WinkUtils
 *   return yield* utils.removeExtraSpaces("too    much")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(WinkUtilsLive))).then(console.log)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkUtilsLive = WinkUtilsLiveService;
/**
 * Live layer for BM25 vectorization backed by the wink engine.
 *
 * **Example** (Read vectorizer config)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { WinkVectorizer } from "@beep/wink"
 * import { WinkEngineLive, WinkVectorizerLive } from "@beep/wink"
 *
 * const readConfig = Effect.gen(function* () {
 *   const vectorizer = yield* WinkVectorizer
 *   return yield* vectorizer.getConfig
 * })
 *
 * const runnable = readConfig.pipe(Effect.provide(WinkVectorizerLive.pipe(Layer.provide(WinkEngineLive))))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkVectorizerLive = WinkVectorizerLiveService;
