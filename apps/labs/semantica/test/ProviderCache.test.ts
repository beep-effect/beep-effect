// @vitest-environment node

import { ANTHROPIC_DEFAULT_MODEL } from "@beep/anthropic";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import {
  ConfigProvider,
  Deferred,
  Duration,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Path,
  Ref,
  Result,
  Stream,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { describe, expect, it } from "vitest";
import {
  ActiveModelIdentityLive,
  AnthropicExtractionLanguageModelLive,
  CachingLanguageModelLive,
  ReplayLanguageModelLive,
  replayGenerateText,
  XAiGoldModelIdentityLive,
} from "@/layers/LanguageModelLive";
import { ProviderCacheLive } from "@/layers/ProviderCacheLive";
import { LabConfigLive } from "@/runtime/Config";
import { RuntimeLayer } from "@/runtime/Layer";
import { contentDigest, sha256TextSync } from "@/schema/Digest";
import { ModelRevisionUnpinned, ProviderCacheCorrupt, ProviderUnavailable } from "@/schema/Errors";
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
  revision: "stub-2026-08-26",
  taskType: "gold-proposal",
});

const makeKey = (prompt: string): ProviderCacheKey =>
  ProviderCacheKey.make({
    inputDigest: sha256TextSync(prompt),
    model,
    requestKind: "generate-text",
    schemaVersion: "provider-cache/v1",
  });

const ProviderCacheEntryPrettyJson = S.fromJsonString(ProviderCacheEntry, { space: 2 });
const encodeProviderCacheEntry = Effect.fn("ProviderCacheTest.encodeProviderCacheEntry")((entry: ProviderCacheEntry) =>
  S.encodeEffect(ProviderCacheEntryPrettyJson)(entry)
);
const CacheTestServices = Layer.mergeAll(BunServices.layer, TestClock.layer());

const advanceCacheClockUntilSettled = Effect.fn("ProviderCacheTest.advanceClockUntilSettled")(function* (
  fiber: Fiber.Fiber<unknown, unknown>
) {
  yield* Effect.findFirst(A.range(1, 100), () =>
    fiber.pollUnsafe() === undefined
      ? TestClock.adjust(Duration.seconds(4)).pipe(
          Effect.andThen(TestClock.withLive(Effect.sleep(Duration.millis(10)))),
          Effect.andThen(Effect.sync(() => fiber.pollUnsafe() !== undefined))
        )
      : Effect.succeed(true)
  );
  expect(fiber.pollUnsafe(), "Provider cache contender did not settle after 100 virtual clock advances.").toBeDefined();
});

const providerCacheRuntime = (cacheDirectory: string) =>
  RuntimeLayer.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: { SEMANTICA_PROVIDER_CACHE_DIR: cacheDirectory },
        })
      )
    )
  );

const providerCacheTestRuntime = (cacheDirectory: string, fileSystem: FileSystem.FileSystem) =>
  ProviderCacheLive.pipe(
    Layer.provide(Layer.succeed(FileSystem.FileSystem, fileSystem)),
    Layer.provide(
      LabConfigLive.pipe(
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnv({
              env: { SEMANTICA_PROVIDER_CACHE_DIR: cacheDirectory },
            })
          )
        )
      )
    )
  );

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

const noOpProviderCache = Layer.succeed(
  ProviderCache,
  ProviderCache.of({
    lookup: Effect.fn("ProviderCache.lookup")(() => Effect.succeedNone),
    store: Effect.fn("ProviderCache.store")(() => Effect.void),
  })
);

describe("C0 provider cache and language-model boundary", () => {
  it("is write-once, caches misses, replays hits, and keeps offline misses typed", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
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

                const identicalRaceKey = makeKey("concurrent identical write-once");
                const identicalRaceCacheKey = yield* contentDigest(ProviderCacheKey)(identicalRaceKey);
                const identicalRaceEntry = ProviderCacheEntry.make({
                  cacheKey: identicalRaceCacheKey,
                  key: identicalRaceKey,
                  response: "same",
                  responseDigest: sha256TextSync("same"),
                });
                const identicalRaceResults = yield* Effect.all(
                  A.map([cache.store(identicalRaceEntry), cache.store(identicalRaceEntry)], Effect.result),
                  { concurrency: "unbounded" }
                );
                expect(A.filter(identicalRaceResults, Result.isSuccess)).toHaveLength(2);

                const orphanKey = makeKey("orphaned lock");
                const orphanCacheKey = yield* contentDigest(ProviderCacheKey)(orphanKey);
                const orphanEntry = ProviderCacheEntry.make({
                  cacheKey: orphanCacheKey,
                  key: orphanKey,
                  response: "recovered",
                  responseDigest: sha256TextSync("recovered"),
                });
                const orphanLock = path.join(cacheDirectory, `${orphanCacheKey}.json.lock`);
                yield* fs.makeDirectory(orphanLock);
                yield* fs.utimes(orphanLock, 0, 0);
                yield* cache.store(orphanEntry);
                expect(yield* cache.lookup(orphanKey)).toEqual(O.some(orphanEntry));
                expect(yield* fs.exists(orphanLock)).toBe(false);

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

  it("fails typed on an empty live generation and stores nothing", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const stored = yield* Ref.make(0);
        const trackingCache = Layer.succeed(
          ProviderCache,
          ProviderCache.of({
            lookup: Effect.fn("ProviderCache.lookup")(() => Effect.succeedNone),
            store: Effect.fn("ProviderCache.store")(() => Ref.update(stored, (count) => count + 1)),
          })
        );
        const emptyModel = Layer.effect(
          LanguageModel.LanguageModel,
          LanguageModel.make({
            generateText: () => Effect.succeed([Response.makePart("text", { text: Str.empty })]),
            streamText: () => Stream.empty,
          })
        );
        const caching = emptyModel.pipe(
          CachingLanguageModelLive,
          Layer.provide(ActiveModelIdentityLive(model)),
          Layer.provide(trackingCache),
          Layer.provide(BunCrypto.layer)
        );
        const failure = yield* provideScopedLayer(caching)(
          LanguageModel.LanguageModel.pipe(
            Effect.flatMap((languageModel) => languageModel.generateText({ prompt: "empty generation prompt" })),
            Effect.flip
          )
        );
        expect(String(failure)).toContain("empty generation");
        expect(yield* Ref.get(stored)).toBe(0);
      })
    ));

  it("lets a contender observe a healthy slow winner within the lock wait window", () =>
    Effect.runPromise(
      provideScopedLayer(CacheTestServices)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-slow-winner-" });
            const runtime = providerCacheRuntime(cacheDirectory);

            yield* provideScopedLayer(runtime)(
              Effect.gen(function* () {
                const cache = yield* ProviderCache;
                const key = makeKey("healthy slow winner");
                const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
                const entry = ProviderCacheEntry.make({
                  cacheKey,
                  key,
                  response: "slow-winner",
                  responseDigest: sha256TextSync("slow-winner"),
                });
                const target = path.join(cacheDirectory, `${cacheKey}.json`);
                const lock = `${target}.lock`;
                yield* fs.makeDirectory(lock);
                yield* fs.writeFileString(path.join(lock, "owner.pid"), `${process.pid}\n`);
                const json = yield* encodeProviderCacheEntry(entry);
                const winner = yield* Effect.sleep(Duration.seconds(2)).pipe(
                  Effect.andThen(fs.writeFileString(target, `${json}\n`)),
                  Effect.andThen(fs.remove(lock, { force: true, recursive: true })),
                  Effect.forkChild
                );
                const contender = yield* cache.store(entry).pipe(Effect.forkChild);
                yield* TestClock.withLive(Effect.sleep(Duration.millis(10)));
                yield* advanceCacheClockUntilSettled(contender);
                yield* Fiber.join(contender);
                yield* Fiber.join(winner);

                expect(yield* cache.lookup(key)).toEqual(O.some(entry));
              })
            );
          })
        )
      )
    ));

  it("lets exactly one contender reclaim a stale lock and reconciles the loser with its published entry", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-reclaim-race-" });
            const key = makeKey("two stale lock reclaim contenders");
            const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
            const entry = ProviderCacheEntry.make({
              cacheKey,
              key,
              response: "single-reclaim-winner",
              responseDigest: sha256TextSync("single-reclaim-winner"),
            });
            const target = path.join(cacheDirectory, `${cacheKey}.json`);
            const lock = `${target}.lock`;
            const ownerPath = path.join(lock, "owner.pid");
            yield* fs.makeDirectory(lock);
            yield* fs.writeFileString(ownerPath, "0\n");
            yield* fs.utimes(lock, 0, 0);

            const reclaimAttempts = yield* Ref.make(0);
            const reclaimWins = yield* Ref.make(0);
            const reclaimLosses = yield* Ref.make(0);
            const competingWriteReads = yield* Ref.make(0);
            const tombstones = yield* Ref.make(A.empty<string>());
            const secondReclaimReady = yield* Deferred.make<void>();
            const firstReclaimWon = yield* Deferred.make<void>();
            const winnerPublished = yield* Deferred.make<void>();
            const racingFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("ProviderCacheTest.observeReclaimLoserReconciliation")(
                function* (candidate, encoding) {
                  if (Str.Equivalence(candidate, target) && (yield* Ref.get(reclaimLosses)) > 0) {
                    yield* Ref.update(competingWriteReads, (count) => count + 1);
                  }
                  return yield* fs.readFileString(candidate, encoding);
                }
              ),
              rename: Effect.fn("ProviderCacheTest.coordinateSingleWinnerReclaim")(function* (from, to) {
                if (!Str.Equivalence(from, lock)) {
                  yield* fs.rename(from, to);
                  if (Str.Equivalence(to, target)) {
                    yield* Deferred.succeed(winnerPublished, undefined);
                  }
                  return;
                }

                const attempt = yield* Ref.updateAndGet(reclaimAttempts, (count) => count + 1);
                yield* Ref.update(tombstones, A.append(to));
                if (attempt === 1) {
                  yield* Deferred.await(secondReclaimReady);
                  yield* fs.rename(from, to);
                  yield* Ref.update(reclaimWins, (count) => count + 1);
                  yield* Deferred.succeed(firstReclaimWon, undefined);
                  return;
                }

                yield* Deferred.succeed(secondReclaimReady, undefined);
                yield* Deferred.await(firstReclaimWon);
                yield* fs
                  .rename(from, to)
                  .pipe(
                    Effect.tapError(() =>
                      Ref.update(reclaimLosses, (count) => count + 1).pipe(
                        Effect.andThen(Deferred.await(winnerPublished))
                      )
                    )
                  );
              }),
            });

            const results = yield* provideScopedLayer(providerCacheTestRuntime(cacheDirectory, racingFileSystem))(
              ProviderCache.pipe(
                Effect.flatMap((cache) =>
                  Effect.all([cache.store(entry).pipe(Effect.result), cache.store(entry).pipe(Effect.result)], {
                    concurrency: "unbounded",
                  })
                )
              )
            );

            const reclaimedPaths = yield* Ref.get(tombstones);
            expect(A.filter(results, Result.isSuccess)).toHaveLength(2);
            expect(yield* Ref.get(reclaimAttempts)).toBe(2);
            expect(yield* Ref.get(reclaimWins)).toBe(1);
            expect(yield* Ref.get(reclaimLosses)).toBe(1);
            expect(yield* Ref.get(competingWriteReads)).toBe(1);
            expect(reclaimedPaths).toEqual(
              expect.arrayContaining([`${lock}.reclaim-${process.pid}-1`, `${lock}.reclaim-${process.pid}-2`])
            );
            expect(yield* Effect.forEach(reclaimedPaths, fs.exists)).toEqual([false, false]);
            expect(yield* fs.exists(lock)).toBe(false);
            expect(yield* fs.readFileString(target)).toBe(`${yield* encodeProviderCacheEntry(entry)}\n`);
          })
        )
      )
    ));

  it.each([
    ["restores the displaced replacement", false],
    ["preserves a newer replacement when rename-back is blocked", true],
  ] as const)("handles a replacement swap before reclaim rename: %s", (_scenario, blockRenameBack) =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-reclaim-swap-" });
            const key = makeKey(`replacement swap before reclaim ${blockRenameBack}`);
            const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
            const entry = ProviderCacheEntry.make({
              cacheKey,
              key,
              response: "replacement-winner",
              responseDigest: sha256TextSync("replacement-winner"),
            });
            const target = path.join(cacheDirectory, `${cacheKey}.json`);
            const lock = `${target}.lock`;
            const ownerPath = path.join(lock, "owner.pid");
            const displacedOwner = `${process.pid}\n`;
            const newerOwner = `${process.ppid}\n`;
            const json = yield* encodeProviderCacheEntry(entry);
            yield* fs.makeDirectory(lock);
            yield* fs.writeFileString(ownerPath, "0\n");
            yield* fs.utimes(lock, 0, 0);

            const reclaimSwaps = yield* Ref.make(0);
            const renameBackAttempts = yield* Ref.make(0);
            const replacementLockRemovals = yield* Ref.make(0);
            const tombstoneRemovals = yield* Ref.make(0);
            const promotionAttempts = yield* Ref.make(0);
            const tombstones = yield* Ref.make(A.empty<string>());
            const racingFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("ProviderCacheTest.blockReclaimRenameBack")(function* (candidate, encoding) {
                const content = yield* fs.readFileString(candidate, encoding);
                if (blockRenameBack && Str.startsWith(`${lock}.reclaim-`)(candidate)) {
                  yield* fs.makeDirectory(lock);
                  yield* fs.writeFileString(ownerPath, newerOwner);
                }
                return content;
              }),
              remove: Effect.fn("ProviderCacheTest.observeReplacementLockRemoval")((candidate, options) => {
                if (Str.Equivalence(candidate, lock)) {
                  return Ref.update(replacementLockRemovals, (count) => count + 1).pipe(
                    Effect.andThen(fs.remove(candidate, options))
                  );
                }
                if (Str.startsWith(`${lock}.reclaim-`)(candidate)) {
                  return Ref.update(tombstoneRemovals, (count) => count + 1).pipe(
                    Effect.andThen(fs.remove(candidate, options))
                  );
                }
                return fs.remove(candidate, options);
              }),
              rename: Effect.fn("ProviderCacheTest.swapReplacementBeforeReclaim")(function* (from, to) {
                if (Str.Equivalence(from, lock)) {
                  yield* fs.remove(lock, { force: true, recursive: true });
                  yield* fs.makeDirectory(lock);
                  yield* fs.writeFileString(ownerPath, displacedOwner);
                  yield* fs.writeFileString(target, `${json}\n`);
                  yield* Ref.update(reclaimSwaps, (count) => count + 1);
                  yield* Ref.update(tombstones, A.append(to));
                  yield* fs.rename(from, to);
                  return;
                }
                if (Str.Equivalence(to, lock) && Str.startsWith(`${lock}.reclaim-`)(from)) {
                  yield* Ref.update(renameBackAttempts, (count) => count + 1);
                }
                if (Str.Equivalence(to, target)) {
                  yield* Ref.update(promotionAttempts, (count) => count + 1);
                }
                yield* fs.rename(from, to);
              }),
            });

            yield* provideScopedLayer(providerCacheTestRuntime(cacheDirectory, racingFileSystem))(
              ProviderCache.pipe(Effect.flatMap((cache) => cache.store(entry)))
            );

            const reclaimedPaths = yield* Ref.get(tombstones);
            expect(yield* Ref.get(reclaimSwaps)).toBe(1);
            expect(yield* Ref.get(renameBackAttempts)).toBe(1);
            expect(yield* Ref.get(replacementLockRemovals)).toBe(0);
            expect(yield* Ref.get(tombstoneRemovals)).toBe(blockRenameBack ? 1 : 0);
            expect(yield* Ref.get(promotionAttempts)).toBe(0);
            expect(yield* fs.readFileString(ownerPath)).toBe(blockRenameBack ? newerOwner : displacedOwner);
            expect(yield* Effect.forEach(reclaimedPaths, fs.exists)).toEqual([false]);
            expect(yield* fs.readFileString(target)).toBe(`${json}\n`);
          })
        )
      )
    )
  );

  it("abandons stale-lock recovery when the sampled owner is replaced before deletion", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-owner-swap-" });
            const key = makeKey("stale owner replaced before deletion");
            const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
            const entry = ProviderCacheEntry.make({
              cacheKey,
              key,
              response: "replacement-winner",
              responseDigest: sha256TextSync("replacement-winner"),
            });
            const target = path.join(cacheDirectory, `${cacheKey}.json`);
            const lock = `${target}.lock`;
            const ownerPath = path.join(lock, "owner.pid");
            const replacementOwner = `${process.pid}\n`;
            const json = yield* encodeProviderCacheEntry(entry);
            yield* fs.makeDirectory(lock);
            yield* fs.writeFileString(ownerPath, "0\n");
            yield* fs.utimes(lock, 0, 0);

            let ownerReads = 0;
            let lockRemovalAttempts = 0;
            const racingFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("ProviderCacheTest.swapOwnerBeforeDelete")(function* (candidate, encoding) {
                if (Str.Equivalence(candidate, ownerPath)) {
                  ownerReads += 1;
                  if (ownerReads === 2) {
                    yield* fs.writeFileString(ownerPath, replacementOwner);
                    yield* fs.writeFileString(target, `${json}\n`);
                  }
                }
                return yield* fs.readFileString(candidate, encoding);
              }),
              remove: Effect.fn("ProviderCacheTest.observeStaleLockRemove")((candidate, options) => {
                if (Str.Equivalence(candidate, lock)) {
                  lockRemovalAttempts += 1;
                }
                return fs.remove(candidate, options);
              }),
            });

            yield* provideScopedLayer(providerCacheTestRuntime(cacheDirectory, racingFileSystem))(
              ProviderCache.pipe(Effect.flatMap((cache) => cache.store(entry)))
            );

            expect(ownerReads).toBe(2);
            expect(lockRemovalAttempts).toBe(0);
            expect(yield* fs.readFileString(ownerPath)).toBe(replacementOwner);
            expect(yield* fs.exists(lock)).toBe(true);
          })
        )
      )
    ));

  it("does not publish after its acquired lock is stolen and reconciles with the winner", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-stolen-lock-" });
            const key = makeKey("lock stolen before promotion");
            const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
            const entry = ProviderCacheEntry.make({
              cacheKey,
              key,
              response: "stolen-lock-winner",
              responseDigest: sha256TextSync("stolen-lock-winner"),
            });
            const target = path.join(cacheDirectory, `${cacheKey}.json`);
            const lock = `${target}.lock`;
            const ownerPath = path.join(lock, "owner.pid");
            const replacementOwner = `${process.pid + 1}\n`;
            const json = yield* encodeProviderCacheEntry(entry);

            let ownerReads = 0;
            let lockRemovalAttempts = 0;
            let promotionAttempts = 0;
            const racingFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("ProviderCacheTest.stealLockBeforePromotion")(function* (candidate, encoding) {
                if (Str.Equivalence(candidate, ownerPath)) {
                  ownerReads += 1;
                  if (ownerReads === 1) {
                    yield* fs.remove(lock, { force: true, recursive: true });
                    yield* fs.makeDirectory(lock);
                    yield* fs.writeFileString(ownerPath, replacementOwner);
                    yield* fs.writeFileString(target, `${json}\n`);
                  }
                }
                return yield* fs.readFileString(candidate, encoding);
              }),
              remove: Effect.fn("ProviderCacheTest.observeStolenLockRemove")((candidate, options) => {
                if (Str.Equivalence(candidate, lock)) {
                  lockRemovalAttempts += 1;
                }
                return fs.remove(candidate, options);
              }),
              rename: Effect.fn("ProviderCacheTest.observeStolenLockPromotion")((from, to) => {
                if (Str.Equivalence(to, target)) {
                  promotionAttempts += 1;
                }
                return fs.rename(from, to);
              }),
            });

            yield* provideScopedLayer(providerCacheTestRuntime(cacheDirectory, racingFileSystem))(
              ProviderCache.pipe(Effect.flatMap((cache) => cache.store(entry)))
            );

            expect(ownerReads).toBe(2);
            expect(lockRemovalAttempts).toBe(0);
            expect(promotionAttempts).toBe(0);
            expect(yield* fs.readFileString(ownerPath)).toBe(replacementOwner);
            expect(yield* fs.exists(lock)).toBe(true);
            expect(yield* fs.readFileString(target)).toBe(`${json}\n`);
          })
        )
      )
    ));

  it("fails with a lock wait timeout after the live-lock retry window expires", () =>
    Effect.runPromise(
      provideScopedLayer(CacheTestServices)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-timeout-" });
            const runtime = providerCacheRuntime(cacheDirectory);

            yield* provideScopedLayer(runtime)(
              Effect.gen(function* () {
                const cache = yield* ProviderCache;
                const key = makeKey("live lock timeout");
                const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
                const entry = ProviderCacheEntry.make({
                  cacheKey,
                  key,
                  response: "never-promoted",
                  responseDigest: sha256TextSync("never-promoted"),
                });
                const lock = path.join(cacheDirectory, `${cacheKey}.json.lock`);
                yield* fs.makeDirectory(lock);
                yield* fs.writeFileString(path.join(lock, "owner.pid"), `${process.pid}\n`);
                const contender = yield* cache.store(entry).pipe(Effect.flip, Effect.forkChild);
                yield* TestClock.withLive(Effect.sleep(Duration.millis(10)));
                yield* advanceCacheClockUntilSettled(contender);
                const error = yield* Fiber.join(contender);

                expect(error).toBeInstanceOf(ProviderCacheCorrupt);
                expect(error.message).toBe(
                  "Timed out waiting for the live provider cache write lock to promote its entry."
                );
                expect(yield* fs.exists(lock)).toBe(true);
              })
            );
          })
        )
      )
    ));

  it.each([
    [{ AI_ANTHROPIC_API_KEY: "test-key", AI_ANTHROPIC_MODEL: "claude-test-20260826" }, "claude-test-20260826"],
    [{ AI_ANTHROPIC_API_KEY: "test-key" }, ANTHROPIC_DEFAULT_MODEL],
  ] as const)("acquires the Anthropic extraction layer with model identity %s", (env, expectedModel) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const layer = AnthropicExtractionLanguageModelLive(model.artifactHash).pipe(
          Layer.provide(BunServices.layer),
          Layer.provide(noOpProviderCache),
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
        );
        const identity = yield* provideScopedLayer(layer)(ActiveModelIdentity);

        expect(identity.name).toBe(expectedModel);
        expect(identity.revision).toBe(expectedModel);
        expect(identity.provider).toBe("anthropic");
        expect(identity.taskType).toBe("extraction");
      })
    )
  );

  it("refuses unversioned xAI proposal identities with the pinning setting", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* provideScopedLayer(
          XAiGoldModelIdentityLive({ artifactHash: model.artifactHash, model: "grok-4" })
        )(ActiveModelIdentity).pipe(Effect.flip);

        expect(error).toBeInstanceOf(ModelRevisionUnpinned);
        expect(error).toMatchObject({
          _tag: "ModelRevisionUnpinned",
          model: "grok-4",
          setting: "SEMANTICA_XAI_MODEL",
        });
      })
    ));

  it.each(["grok-test-20260826", "grok-build-v2", "grok-build@3", "grok-build:2026", "grok-4.6"])(
    "retains an explicit model revision verbatim for %s",
    (modelId) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const identity = yield* provideScopedLayer(
            XAiGoldModelIdentityLive({ artifactHash: model.artifactHash, model: modelId })
          )(ActiveModelIdentity);

          expect(identity.name).toBe(modelId);
          expect(identity.revision).toBe(modelId);
        })
      )
  );

  it("refuses an unversioned Anthropic override with AI_ANTHROPIC_MODEL", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const layer = AnthropicExtractionLanguageModelLive(model.artifactHash).pipe(
          Layer.provide(BunServices.layer),
          Layer.provide(noOpProviderCache),
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromEnv({
                env: { AI_ANTHROPIC_API_KEY: "test-key", AI_ANTHROPIC_MODEL: "claude-latest" },
              })
            )
          )
        );
        const error = yield* provideScopedLayer(layer)(ActiveModelIdentity).pipe(Effect.flip);

        expect(error).toBeInstanceOf(ModelRevisionUnpinned);
        expect(error).toMatchObject({
          _tag: "ModelRevisionUnpinned",
          model: "claude-latest",
          setting: "AI_ANTHROPIC_MODEL",
        });
      })
    ));
});
