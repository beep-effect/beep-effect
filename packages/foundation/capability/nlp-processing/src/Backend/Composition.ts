/**
 * Backend composition - combinators that treat {@link NLPBackend}s as composable
 * morphisms.
 *
 * - {@link withFallback}: try a primary backend, fall back to a secondary on
 *   failure (per operation); the composed capabilities are the union.
 * - {@link withCaching}: memoize each text-keyed operation behind an `effect/Cache`
 *   with a capacity bound and TTL.
 * - {@link selectByCapability}: pick the first backend supporting a capability.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * `withCaching` is a real per-operation `effect/Cache`. `backends.find(...)`
 * becomes `effect/Array` `A.findFirst` (returning `Option`).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { PosInt, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Cache, Duration, Effect } from "effect";
import { dual, flow } from "effect/Function";
import * as S from "effect/Schema";
import * as Obs from "../internal/observability.ts";
import { NLPBackend } from "./NLPBackend.ts";
import type * as EffectCache from "effect/Cache";
import type * as O from "effect/Option";
import type { BackendCapabilities, NLPBackendShape } from "./NLPBackend.ts";

const $I = $NlpProcessingId.create("Backend/Composition");

const backendOperationAttributes = (
  operation: string,
  backend: NLPBackendShape,
  extra: Record<string, string> = {}
): Record<string, string> => ({
  backend: backend.name,
  operation,
  ...extra,
});

const fallbackOperation = <A, E, R>(
  operation: string,
  primary: NLPBackendShape,
  secondary: NLPBackendShape,
  primaryEffect: Effect.Effect<A, E, R>,
  secondaryEffect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => {
  const attributes = {
    operation,
    primary_backend: primary.name,
    secondary_backend: secondary.name,
  };
  return primaryEffect.pipe(
    Effect.catchCause(flow(Obs.recordNlpBackendFallback(attributes), Effect.andThen(secondaryEffect))),
    Obs.trackNlpDuration(`nlp.backend.fallback.${operation}`, attributes)
  );
};

const cachedGet = <A, E, R>(
  cache: EffectCache.Cache<string, A, E, R>,
  operation: string,
  backend: NLPBackendShape,
  key: string,
  capacity: number,
  timeToLive: Duration.Duration
): Effect.Effect<A, E, R> => {
  const attributes = backendOperationAttributes(operation, backend, {
    cache_capacity: `${capacity}`,
    cache_ttl_ms: `${Duration.toMillis(timeToLive)}`,
  });
  return Effect.gen(function* () {
    const hit = yield* Cache.has(cache, key);
    yield* Obs.recordNlpCacheLookup(hit, attributes);
    return yield* Cache.get(cache, key);
  }).pipe(Obs.trackNlpDuration(`nlp.backend.cached.${operation}`, attributes));
};

/**
 * Compose two backends so each operation falls back to a secondary backend.
 *
 * **Details**
 *
 * The wrapper catches any failure from the primary operation and retries the
 * same operation on the secondary backend. Advertised capabilities are the
 * boolean union of both inputs, so capability selection can see the composed
 * surface.
 *
 * **Example** (Primary secondary fallback composition)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { withFallback } from "@beep/nlp-processing/Backend/Composition"
 * import { notSupported } from "@beep/nlp-processing/Backend/NLPBackend"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const capabilities = {
 *   constituencyParsing: false,
 *   coreferenceResolution: false,
 *   dependencyParsing: false,
 *   lemmatization: false,
 *   ner: false,
 *   posTagging: false,
 *   relationExtraction: false,
 *   sentencization: false,
 *   tokenization: true
 * }
 * const primary: NLPBackendShape = {
 *   name: "primary",
 *   capabilities,
 *   tokenize: () => Effect.fail(notSupported("primary", "tokenize")),
 *   sentencize: () => Effect.succeed([]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * const secondary: NLPBackendShape = { ...primary, name: "secondary", tokenize: (text) => Effect.succeed([text]) }
 * console.log(withFallback(primary, secondary).name) // "primary+secondary"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withFallback: {
  (primary: NLPBackendShape, secondary: NLPBackendShape): NLPBackendShape;
  (secondary: NLPBackendShape): (primary: NLPBackendShape) => NLPBackendShape;
} = dual(2, (primary: NLPBackendShape, secondary: NLPBackendShape): NLPBackendShape => {
  const capabilities: BackendCapabilities = {
    constituencyParsing: primary.capabilities.constituencyParsing || secondary.capabilities.constituencyParsing,
    coreferenceResolution: primary.capabilities.coreferenceResolution || secondary.capabilities.coreferenceResolution,
    dependencyParsing: primary.capabilities.dependencyParsing || secondary.capabilities.dependencyParsing,
    lemmatization: primary.capabilities.lemmatization || secondary.capabilities.lemmatization,
    ner: primary.capabilities.ner || secondary.capabilities.ner,
    posTagging: primary.capabilities.posTagging || secondary.capabilities.posTagging,
    relationExtraction: primary.capabilities.relationExtraction || secondary.capabilities.relationExtraction,
    sentencization: primary.capabilities.sentencization || secondary.capabilities.sentencization,
    tokenization: primary.capabilities.tokenization || secondary.capabilities.tokenization,
  };

  return NLPBackend.of({
    capabilities,
    name: `${primary.name}+${secondary.name}`,
    tokenize: Effect.fn("FallbackBackend.tokenize")(function* (text: string) {
      return yield* fallbackOperation("tokenize", primary, secondary, primary.tokenize(text), secondary.tokenize(text));
    }),
    sentencize: Effect.fn("FallbackBackend.sentencize")(function* (text: string) {
      return yield* fallbackOperation(
        "sentencize",
        primary,
        secondary,
        primary.sentencize(text),
        secondary.sentencize(text)
      );
    }),
    posTag: Effect.fn("FallbackBackend.posTag")(function* (text: string) {
      return yield* fallbackOperation("posTag", primary, secondary, primary.posTag(text), secondary.posTag(text));
    }),
    lemmatize: Effect.fn("FallbackBackend.lemmatize")(function* (text: string) {
      return yield* fallbackOperation(
        "lemmatize",
        primary,
        secondary,
        primary.lemmatize(text),
        secondary.lemmatize(text)
      );
    }),
    extractEntities: Effect.fn("FallbackBackend.extractEntities")(function* (text: string) {
      return yield* fallbackOperation(
        "extractEntities",
        primary,
        secondary,
        primary.extractEntities(text),
        secondary.extractEntities(text)
      );
    }),
    parseDependencies: Effect.fn("FallbackBackend.parseDependencies")(function* (sentence: string) {
      return yield* fallbackOperation(
        "parseDependencies",
        primary,
        secondary,
        primary.parseDependencies(sentence),
        secondary.parseDependencies(sentence)
      );
    }),
    extractRelations: Effect.fn("FallbackBackend.extractRelations")(function* (text: string) {
      return yield* fallbackOperation(
        "extractRelations",
        primary,
        secondary,
        primary.extractRelations(text),
        secondary.extractRelations(text)
      );
    }),
  });
});

/**
 * Cache settings for memoized backend composition.
 *
 * **Example** (Caching options capacity TTL)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { PosInt } from "@beep/schema"
 * import type { CachingOptions } from "@beep/nlp-processing/Backend/Composition"
 *
 * const options: CachingOptions = { capacity: PosInt.make(64), timeToLive: Duration.minutes(5) }
 * console.log(options.capacity) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachingOptions extends S.Class<CachingOptions>($I`CachingOptions`)(
  {
    capacity: SchemaUtils.withKeyDefaults(PosInt, PosInt.make(1024)),
    timeToLive: SchemaUtils.withKeyDefaults(S.Duration, Duration.minutes(10)),
  },
  $I.annote("CachingOptions", {
    description: "Cache settings for memoized backend composition.",
  })
) {}

/**
 * Wrap a backend with per-operation `effect/Cache` memoization.
 *
 * **Details**
 *
 * Each backend operation gets its own cache keyed by the input text or sentence.
 * The wrapper preserves the backend's capability bitmap and renames it as
 * `cached(<name>)`.
 *
 * **Example** (Memoized backend tokenize cache)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PosInt } from "@beep/schema"
 * import { withCaching } from "@beep/nlp-processing/Backend/Composition"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: true,
 *     tokenization: true
 *   },
 *   tokenize: (text) => Effect.succeed(text.split(" ")),
 *   sentencize: (text) => Effect.succeed([text]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * const program = Effect.flatMap(withCaching(backend, { capacity: PosInt.make(16) }), (cached) =>
 *   cached.tokenize("typed effects")
 * )
 * Effect.runPromise(program).then(console.log) // ["typed", "effects"]
 * ```
 *
 * @effects Allocates per-operation `effect/Cache` instances when the wrapper
 * effect runs; operations on the returned backend read and populate those
 * caches through `Cache.get`.
 * @category combinators
 * @since 0.0.0
 */
export const withCaching = Effect.fn("withCaching")(function* (
  backend: NLPBackendShape,
  options: (typeof CachingOptions)["~type.make.in"] = {}
): Effect.fn.Return<NLPBackendShape> {
  const { capacity, timeToLive } = CachingOptions.make(options);
  const tokenizeCache = yield* Cache.make({
    capacity,
    lookup: backend.tokenize,
    timeToLive,
  });
  const sentencizeCache = yield* Cache.make({
    capacity,
    lookup: backend.sentencize,
    timeToLive,
  });
  const posTagCache = yield* Cache.make({
    capacity,
    lookup: backend.posTag,
    timeToLive,
  });
  const lemmatizeCache = yield* Cache.make({
    capacity,
    lookup: backend.lemmatize,
    timeToLive,
  });
  const entitiesCache = yield* Cache.make({
    capacity,
    lookup: backend.extractEntities,
    timeToLive,
  });
  const dependenciesCache = yield* Cache.make({
    capacity,
    lookup: backend.parseDependencies,
    timeToLive,
  });
  const relationsCache = yield* Cache.make({
    capacity,
    lookup: backend.extractRelations,
    timeToLive,
  });

  return NLPBackend.of({
    capabilities: backend.capabilities,
    name: `cached(${backend.name})`,
    tokenize: Effect.fn("CachedBackend.tokenize")(function* (text: string) {
      return yield* cachedGet(tokenizeCache, "tokenize", backend, text, capacity, timeToLive);
    }),
    sentencize: Effect.fn("CachedBackend.sentencize")(function* (text: string) {
      return yield* cachedGet(sentencizeCache, "sentencize", backend, text, capacity, timeToLive);
    }),
    posTag: Effect.fn("CachedBackend.posTag")(function* (text: string) {
      return yield* cachedGet(posTagCache, "posTag", backend, text, capacity, timeToLive);
    }),
    lemmatize: Effect.fn("CachedBackend.lemmatize")(function* (text: string) {
      return yield* cachedGet(lemmatizeCache, "lemmatize", backend, text, capacity, timeToLive);
    }),
    extractEntities: Effect.fn("CachedBackend.extractEntities")(function* (text: string) {
      return yield* cachedGet(entitiesCache, "extractEntities", backend, text, capacity, timeToLive);
    }),
    parseDependencies: Effect.fn("CachedBackend.parseDependencies")(function* (sentence: string) {
      return yield* cachedGet(dependenciesCache, "parseDependencies", backend, sentence, capacity, timeToLive);
    }),
    extractRelations: Effect.fn("CachedBackend.extractRelations")(function* (text: string) {
      return yield* cachedGet(relationsCache, "extractRelations", backend, text, capacity, timeToLive);
    }),
  });
});

/**
 * Select the first backend whose capability bitmap enables a requested feature.
 *
 * **Details**
 *
 * The input order is the preference order. This is useful before building a
 * layer when a caller has several concrete engines but only one operation
 * requires a specialized capability.
 *
 * **Example** (Select backend by capability)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { selectByCapability } from "@beep/nlp-processing/Backend/Composition"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "tokenizer",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: true,
 *     tokenization: true
 *   },
 *   tokenize: (text) => Effect.succeed(text.split(" ")),
 *   sentencize: (text) => Effect.succeed([text]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * console.log(O.map(selectByCapability([backend], "tokenization"), (selected) => selected.name))
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const selectByCapability: {
  (backends: ReadonlyArray<NLPBackendShape>, capability: keyof BackendCapabilities): O.Option<NLPBackendShape>;
  (capability: keyof BackendCapabilities): (backends: ReadonlyArray<NLPBackendShape>) => O.Option<NLPBackendShape>;
} = dual(
  2,
  (backends: ReadonlyArray<NLPBackendShape>, capability: keyof BackendCapabilities): O.Option<NLPBackendShape> =>
    A.findFirst(backends, (backend) => backend.capabilities[capability])
);
