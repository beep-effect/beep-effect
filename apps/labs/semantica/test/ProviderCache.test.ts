// @vitest-environment node

import * as BunServices from "@effect/platform-bun/BunServices";
import { ConfigProvider, Effect, FileSystem, Layer, Ref, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { describe, expect, it } from "vitest";
import {
  ActiveModelIdentityLive,
  CachingLanguageModelLive,
  ReplayLanguageModelLive,
  replayGenerateText,
} from "@/layers/LanguageModelLive";
import { RuntimeLayer } from "@/runtime/Layer";
import { contentDigest, sha256TextSync } from "@/schema/Digest";
import { ProviderCacheCorrupt, ProviderUnavailable } from "@/schema/Errors";
import { ModelIdentity } from "@/schema/Model";
import { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";
import { ActiveModelIdentity } from "@/services/LanguageModel";
import { ProviderCache } from "@/services/ProviderCache";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const model = ModelIdentity.make({
  artifactHash: sha256TextSync("provider-cache-test-artifact"),
  name: "stub-2026-08-26",
  provider: "xai",
  revision: "2026-08-26",
  taskType: "gold-proposal",
});

const makeKey = (prompt: string): ProviderCacheKey =>
  ProviderCacheKey.make({
    inputDigest: sha256TextSync(prompt),
    model,
    requestKind: "generate-text",
    schemaVersion: "provider-cache/v1",
  });

const makeStubLanguageModel = (calls: Ref.Ref<number>) =>
  Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () =>
        Ref.updateAndGet(calls, (count) => count + 1).pipe(
          Effect.map((count) => [Response.makePart("text", { text: `stub-response-${count}` })])
        ),
      streamText: () => Stream.empty,
    })
  );

describe("C0 provider cache and language-model boundary", () => {
  it("is write-once, caches misses, replays hits, and keeps offline misses typed", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const cacheDirectory = yield* fs.makeTempDirectoryScoped({
              prefix: "semantica-provider-cache-",
            });
            const runtime = RuntimeLayer.pipe(
              Layer.provide(
                ConfigProvider.layer(
                  ConfigProvider.fromEnv({
                    env: { SEMANTICA_PROVIDER_CACHE_DIR: cacheDirectory },
                  })
                )
              )
            );

            yield* provideScopedLayer(runtime)(
              Effect.gen(function* () {
                const cache = yield* ProviderCache;
                const key = makeKey("write-once");
                const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
                const entry = ProviderCacheEntry.make({
                  cacheKey,
                  key,
                  response: "alpha",
                  responseDigest: sha256TextSync("alpha"),
                });
                yield* cache.store(entry);
                yield* cache.store(entry);
                expect(yield* cache.lookup(key)).toEqual(O.some(entry));

                const conflict = ProviderCacheEntry.make({
                  cacheKey,
                  key,
                  response: "beta",
                  responseDigest: sha256TextSync("beta"),
                });
                const conflictError = yield* cache.store(conflict).pipe(Effect.flip);
                expect(conflictError).toBeInstanceOf(ProviderCacheCorrupt);

                const raceKey = makeKey("concurrent write-once");
                const raceCacheKey = yield* contentDigest(ProviderCacheKey)(raceKey);
                const raceResults = yield* Effect.all(
                  A.map(["left", "right"], (response) =>
                    cache
                      .store(
                        ProviderCacheEntry.make({
                          cacheKey: raceCacheKey,
                          key: raceKey,
                          response,
                          responseDigest: sha256TextSync(response),
                        })
                      )
                      .pipe(Effect.result)
                  ),
                  { concurrency: "unbounded" }
                );
                expect(A.filter(raceResults, Result.isSuccess)).toHaveLength(1);
                expect(A.filter(raceResults, Result.isFailure)).toHaveLength(1);

                const calls = yield* Ref.make(0);
                const identity = ActiveModelIdentityLive(model);
                const caching = makeStubLanguageModel(calls).pipe(CachingLanguageModelLive, Layer.provide(identity));
                const responses = yield* provideScopedLayer(caching)(
                  Effect.gen(function* () {
                    const languageModel = yield* LanguageModel.LanguageModel;
                    const first = yield* languageModel.generateText({ prompt: "cached prompt" });
                    const second = yield* languageModel.generateText({ prompt: "cached prompt" });
                    return [first.text, second.text] as const;
                  })
                );
                expect(responses).toEqual(["stub-response-1", "stub-response-1"]);
                expect(yield* calls.pipe(Ref.get)).toBe(1);

                const replay = ReplayLanguageModelLive.pipe(Layer.provide(identity));
                const replayed = yield* provideScopedLayer(replay)(
                  LanguageModel.LanguageModel.pipe(
                    Effect.flatMap((languageModel) => languageModel.generateText({ prompt: "cached prompt" })),
                    Effect.map((response) => response.text)
                  )
                );
                expect(replayed).toBe("stub-response-1");

                const miss = yield* replayGenerateText("uncached prompt").pipe(
                  Effect.provideService(ActiveModelIdentity, model),
                  Effect.flip
                );
                expect(miss).toBeInstanceOf(ProviderUnavailable);
                if (miss._tag === "ProviderUnavailable") {
                  expect(miss.offline).toBe(true);
                }
              })
            );
          })
        )
      )
    ));
});
