import { Sha256Hex } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Crypto, Effect, Equal, Layer, Match, Order, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as EmbeddingModel from "effect/unstable/ai/EmbeddingModel";
import { LabConfig, RuntimeMode } from "@/runtime/Config";
import { contentDigest, sha256TextSync } from "@/schema/Digest";
import { ModelIdentity } from "@/schema/Model";
import { DegradedEmbedding, EmbeddingBatch, EmbeddingVector } from "@/schema/Projection";
import { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";
import { ActiveEmbeddingIdentity, Embedder } from "@/services/Embedder";
import { ProviderCache } from "@/services/ProviderCache";
import type { PosInt } from "@beep/schema";
import type { EmbeddingInput } from "@/schema/Projection";

const EmbeddingVectorJson = S.fromJsonString(EmbeddingVector).pipe(
  SchemaUtils.withCodecStatics(["encodeEffect", "decodeEffect"])
);
const modelEquivalence = S.toEquivalence(ModelIdentity);
const vectorOrder = Order.mapInput(Order.String, (vector: EmbeddingVector) => vector.chunk);
const degradedOrder = Order.mapInput(Order.String, (degraded: DegradedEmbedding) => degraded.chunk);

const EMBEDDING_INPUT_ARTIFACT_HASH = Sha256Hex.make(
  "ef6cde7cc67e079a9a698268a31556afc576be71e79d97a12c57424ed0dbbd67"
);

type CacheResolution =
  | { readonly _tag: "Hit"; readonly vector: EmbeddingVector }
  | {
      readonly _tag: "Miss";
      readonly input: EmbeddingInput;
      readonly key: ProviderCacheKey;
    }
  | { readonly _tag: "Degraded"; readonly degraded: DegradedEmbedding };
type CacheMiss = Extract<CacheResolution, { readonly _tag: "Miss" }>;
type GeneratedEmbedding = Result.Result<EmbeddingVector, DegradedEmbedding>;

const degraded = (
  input: EmbeddingInput,
  model: ModelIdentity,
  reason: DegradedEmbedding["reason"],
  detail: string
): DegradedEmbedding =>
  DegradedEmbedding.make({
    chunk: input.chunk,
    detail,
    model,
    reason,
  });

const makeKey = (input: EmbeddingInput, model: ModelIdentity): ProviderCacheKey =>
  ProviderCacheKey.make({
    inputDigest: Sha256Hex.make(input.chunk),
    model,
    requestKind: "embed",
    schemaVersion: "provider-cache/v1",
  });

const cachedVector = Effect.fn("Embedder.cachedVector")(function* (
  input: EmbeddingInput,
  model: ModelIdentity,
  key: ProviderCacheKey,
  cache: ProviderCache["Service"]
) {
  return yield* cache.lookup(key).pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.succeed<CacheResolution>({
          _tag: "Degraded",
          degraded: degraded(input, model, "cache-corrupt", "The embedding cache entry could not be read safely."),
        }),
      onSuccess: O.match({
        onNone: () =>
          Effect.succeed<CacheResolution>({
            _tag: "Miss",
            input,
            key,
          }),
        onSome: (entry) =>
          EmbeddingVectorJson.decodeEffect(entry.response).pipe(
            Effect.match({
              onFailure: () =>
                ({
                  _tag: "Degraded",
                  degraded: degraded(
                    input,
                    model,
                    "cache-corrupt",
                    "The cached embedding response did not satisfy its schema."
                  ),
                }) satisfies CacheResolution,
              onSuccess: (vector) =>
                (Str.Equivalence(vector.chunk, input.chunk) && modelEquivalence(vector.model, model)
                  ? { _tag: "Hit", vector }
                  : {
                      _tag: "Degraded",
                      degraded: degraded(
                        input,
                        model,
                        "cache-corrupt",
                        "The cached embedding identity did not match its request key."
                      ),
                    }) satisfies CacheResolution,
            })
          ),
      }),
    })
  );
});

const storeVector = Effect.fn("Embedder.storeVector")(function* (
  input: EmbeddingInput,
  key: ProviderCacheKey,
  vector: EmbeddingVector,
  cache: ProviderCache["Service"]
): Effect.fn.Return<Result.Result<EmbeddingVector, DegradedEmbedding>, never, Crypto.Crypto> {
  const response = yield* EmbeddingVectorJson.encodeEffect(vector).pipe(Effect.orDie);
  const cacheKey = yield* contentDigest(ProviderCacheKey)(key).pipe(Effect.orDie);
  return yield* cache
    .store(
      ProviderCacheEntry.make({
        cacheKey,
        key,
        response,
        responseDigest: sha256TextSync(response),
      })
    )
    .pipe(
      Effect.match({
        onFailure: () =>
          Result.fail(
            degraded(input, vector.model, "cache-corrupt", "The live embedding could not be stored immutably.")
          ),
        onSuccess: () => Result.succeed(vector),
      })
    );
});

const providerBatch = Effect.fn("Embedder.providerBatch")(function* (
  inputs: ReadonlyArray<EmbeddingInput>,
  keys: ReadonlyArray<ProviderCacheKey>,
  model: ModelIdentity,
  provider: EmbeddingModel.Service,
  cache: ProviderCache["Service"]
): Effect.fn.Return<ReadonlyArray<Result.Result<EmbeddingVector, DegradedEmbedding>>, never, Crypto.Crypto> {
  const response = yield* provider.embedMany(A.map(inputs, (input) => input.text)).pipe(
    Effect.match({
      onFailure: () =>
        Result.fail(
          A.map(inputs, (input) => degraded(input, model, "provider-failed", "The embedding provider request failed."))
        ),
      onSuccess: Result.succeed,
    })
  );
  if (Result.isFailure(response)) {
    return A.map(response.failure, Result.fail);
  }
  const dimension = O.getOrThrow(model.dimension);
  return yield* Effect.forEach(
    A.zip(A.zip(inputs, keys), response.success.embeddings),
    Effect.fnUntraced(function* ([[input, key], embedding]) {
      if (!Equal.equals(A.length(embedding.vector), dimension)) {
        return Result.fail(
          degraded(
            input,
            model,
            "dimension-mismatch",
            "The embedding provider returned a vector whose width differs from the frozen identity."
          )
        );
      }
      const vector = yield* A.match(embedding.vector, {
        onEmpty: () =>
          Effect.succeed(
            Result.fail(degraded(input, model, "response-invalid", "The embedding provider returned an empty vector."))
          ),
        onNonEmpty: (values) =>
          S.decodeEffect(S.toType(EmbeddingVector))(
            EmbeddingVector.make({
              chunk: input.chunk,
              model,
              values,
            })
          ).pipe(
            Effect.match({
              onFailure: () =>
                Result.fail(
                  degraded(input, model, "response-invalid", "The embedding provider returned invalid numeric values.")
                ),
              onSuccess: Result.succeed,
            })
          ),
      });
      return yield* Result.match(vector, {
        onFailure: (failure) => Effect.succeed(Result.fail(failure)),
        onSuccess: (valid) => storeVector(input, key, valid, cache),
      });
    }),
    { concurrency: 1 }
  );
});

const makeEmbedder = Effect.fn("Embedder.make")(function* (provider: O.Option<EmbeddingModel.Service>) {
  const cache = yield* ProviderCache;
  const crypto = yield* Crypto.Crypto;
  const model = yield* ActiveEmbeddingIdentity;
  const mode = (yield* LabConfig).mode;

  return Embedder.of({
    embed: Effect.fn("Embedder.embed")(function* (inputs) {
      const resolutions = yield* Effect.forEach(
        inputs,
        (input) => cachedVector(input, model, makeKey(input, model), cache),
        { concurrency: 16 }
      );
      const hits = A.getSomes(
        A.map(resolutions, (resolution) =>
          Match.value(resolution).pipe(
            Match.tagsExhaustive({
              Degraded: O.none<EmbeddingVector>,
              Hit: ({ vector }) => O.some(vector),
              Miss: O.none<EmbeddingVector>,
            })
          )
        )
      );
      const initialDegraded = A.getSomes(
        A.map(resolutions, (resolution) =>
          Match.value(resolution).pipe(
            Match.tagsExhaustive({
              Degraded: ({ degraded: value }) => O.some(value),
              Hit: O.none<DegradedEmbedding>,
              Miss: O.none<DegradedEmbedding>,
            })
          )
        )
      );
      const misses = A.filter(resolutions, (resolution): resolution is CacheMiss => resolution._tag === "Miss");
      const generatedEffect: Effect.Effect<ReadonlyArray<GeneratedEmbedding>> = RuntimeMode.$match(mode, {
        live: () =>
          provider.pipe(
            O.match({
              onNone: () =>
                Effect.succeed(
                  A.map(misses, ({ input }) =>
                    Result.fail(
                      degraded(input, model, "provider-failed", "The live embedding provider layer is unavailable.")
                    )
                  )
                ),
              onSome: (live) =>
                Effect.forEach(
                  A.chunksOf(misses, 256),
                  (batch) =>
                    providerBatch(
                      A.map(batch, (item) => item.input),
                      A.map(batch, (item) => item.key),
                      model,
                      live,
                      cache
                    ).pipe(Effect.provideService(Crypto.Crypto, crypto)),
                  { concurrency: 1 }
                ).pipe(Effect.map(A.flatten)),
            })
          ),
        replay: () =>
          Effect.succeed(
            A.map(misses, ({ input }) =>
              Result.fail(
                degraded(input, model, "cache-miss", "The requested embedding is absent from the offline cache.")
              )
            )
          ),
      });
      const generated = yield* generatedEffect;
      const vectors = A.sort(A.appendAll(hits, A.getSuccesses(generated)), vectorOrder);
      const degradedValues = A.sort(A.appendAll(initialDegraded, A.getFailures(generated)), degradedOrder);
      return EmbeddingBatch.make({ degraded: degradedValues, vectors });
    }),
  });
});

const LiveEmbedder = Layer.effect(
  Embedder,
  EmbeddingModel.EmbeddingModel.pipe(Effect.flatMap((provider) => makeEmbedder(O.some(provider))))
);

const ReplayEmbedder = Layer.effect(Embedder, makeEmbedder(O.none()));

/**
 * Supplies the frozen identity paired with the OpenAI embedding Layer.
 *
 * **Example** (Inspect the identity Layer constructor)
 *
 * ```ts
 * import { ActiveEmbeddingIdentityLive } from "@/layers/EmbedderLive"
 *
 * console.log(typeof ActiveEmbeddingIdentityLive) // "function"
 * ```
 *
 * @param identity - Frozen dimension-carrying OpenAI model identity.
 * @returns A Layer providing the active embedding identity.
 * @category layers
 * @since 0.0.0
 */
export const ActiveEmbeddingIdentityLive = (identity: ModelIdentity) =>
  Layer.succeed(ActiveEmbeddingIdentity, identity);

/**
 * Builds the OpenAI identity that must equal the committed G-projection model.
 *
 * **Example** (Inspect the identity constructor)
 *
 * ```ts
 * import { OpenAiEmbeddingIdentity } from "@/layers/EmbedderLive"
 *
 * console.log(typeof OpenAiEmbeddingIdentity) // "function"
 * ```
 *
 * @param options - Frozen model name, revision, and positive vector dimension.
 * @returns The complete OpenAI embedding model identity.
 * @category models
 * @since 0.0.0
 */
export const OpenAiEmbeddingIdentity = (options: {
  readonly dimension: PosInt;
  readonly model: string;
  readonly revision: string;
}): ModelIdentity =>
  ModelIdentity.make({
    artifactHash: EMBEDDING_INPUT_ARTIFACT_HASH,
    dimension: O.some(options.dimension),
    name: options.model,
    provider: "openai",
    revision: options.revision,
    taskType: "embedding",
  });

/**
 * Selects live cache-writing or cache-only embedding behavior from runtime mode.
 *
 * **Gotchas**
 *
 * Replay does not acquire the live provider Layer, so network credentials are
 * never read during `--offline` execution.
 *
 * **Example** (Inspect the runtime Layer constructor)
 *
 * ```ts
 * import { EmbedderRuntimeLive } from "@/layers/EmbedderLive"
 *
 * console.log(typeof EmbedderRuntimeLive) // "function"
 * ```
 *
 * @param live - Credential-reading OpenAI embedding Layer acquired only in live mode.
 * @returns A mode-selected cached embedding service Layer.
 * @category layers
 * @since 0.0.0
 */
export const EmbedderRuntimeLive = <E, R>(
  live: Layer.Layer<EmbeddingModel.EmbeddingModel | EmbeddingModel.Dimensions, E, R>
) =>
  Layer.unwrap(
    LabConfig.pipe(
      Effect.map((config) =>
        RuntimeMode.$match(config.mode, {
          live: () => LiveEmbedder.pipe(Layer.provide(live)),
          replay: () => ReplayEmbedder,
        })
      )
    )
  );
