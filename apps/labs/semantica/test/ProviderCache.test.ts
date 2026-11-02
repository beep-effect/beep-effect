// @vitest-environment node

import { ANTHROPIC_DEFAULT_MODEL } from "@beep/anthropic";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Response from "effect/ai/Response";
import * as Clock from "effect/Clock";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import {
  ActiveModelIdentityLive,
  AnthropicExtractionLanguageModelLive,
  AnthropicExtractionModelIdentity,
  CachingLanguageModelLive,
  ReplayLanguageModelLive,
  replayGenerateText,
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

const BunPlatformLive = Layer.merge(BunServices.layer, BunCrypto.layer);

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
const encodeProviderCacheEntryPrettyJson = S.encodeEffect(ProviderCacheEntryPrettyJson);
const encodeProviderCacheEntry = Effect.fn("ProviderCacheTest.encodeProviderCacheEntry")((entry: ProviderCacheEntry) =>
  encodeProviderCacheEntryPrettyJson(entry)
);
const CacheTestServices = Layer.mergeAll(BunPlatformLive, TestClock.layer());

const makeCacheWaitProbe = Effect.fn("ProviderCacheTest.makeWaitProbe")(function* (fs: FileSystem.FileSystem) {
  const clock = yield* TestClock.testClockWith(Effect.succeed);
  const retries = yield* Queue.unbounded<Duration.Duration>();
  const delays = yield* Ref.make(A.empty<number>());
  const phase = yield* Ref.make("waiting for contender filesystem activity");
  const observedFileSystem = FileSystem.FileSystem.of({
    ...fs,
    exists: Effect.fn("ProviderCacheTest.existsCompleted")((path) =>
      fs.exists(path).pipe(Effect.tap(() => Ref.set(phase, "filesystem exists completed")))
    ),
    readFileString: Effect.fn("ProviderCacheTest.readFileStringCompleted")((path, encoding) =>
      fs.readFileString(path, encoding).pipe(Effect.tap(() => Ref.set(phase, "filesystem read completed")))
    ),
  });
  const observedClock = Clock.Clock.of({
    ...clock,
    sleep: Effect.fn("ProviderCacheTest.observeRetrySleep")(function* (duration: Duration.Duration) {
      // rc.117 TestClock registers its timer before its first suspension. Starting
      // this child immediately makes the queue notification a registered-timer barrier.
      const sleeper = yield* Effect.forkChild(clock.sleep(duration), { startImmediately: true });
      yield* Ref.update(delays, A.append(Duration.toMillis(duration)));
      yield* Ref.set(phase, "retry timer registered");
      yield* Queue.offer(retries, duration);
      yield* Fiber.join(sleeper);
    }),
  });
  const drive = Effect.fn("ProviderCacheTest.driveRegisteredRetries")(function* <E = never>(
    fiber: Fiber.Fiber<unknown, unknown>,
    scenario: string,
    afterAdvance: Effect.Effect<void, E> = Effect.void
  ) {
    yield* Effect.gen(function* () {
      while (true) {
        const next = yield* Effect.raceFirst(
          Queue.take(retries).pipe(Effect.asSome),
          Fiber.await(fiber).pipe(Effect.as(O.none<Duration.Duration>()))
        );
        if (O.isNone(next)) return;
        expect(A.length(yield* Ref.get(delays)), "production lock-wait retry limit").toBeLessThanOrEqual(7);
        yield* clock.adjust(next.value);
        yield* afterAdvance;
      }
    }).pipe(
      Effect.timeoutOrElse({
        duration: "4 seconds",
        orElse: Effect.fn("ProviderCacheTest.watchdog")(function* () {
          const lastPhase = yield* Ref.get(phase);
          const retryDelays = yield* Ref.get(delays);
          return yield* Effect.die(
            new Error(
              "Provider cache " +
                scenario +
                " watchdog: " +
                lastPhase +
                "; retries=" +
                retryDelays.length +
                "; delays-ms=" +
                A.join(
                  A.map(retryDelays, (delay) => `${delay}`),
                  ","
                )
            )
          );
        }),
      }),
      TestClock.withLive
    );
  });
  return { clock: observedClock, fileSystem: observedFileSystem, delays, drive };
});
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

const CompetingStage = S.Struct({
  json: S.String,
  publishOnRead: S.Int,
  reads: S.Int,
  promotions: S.Int,
});
type CompetingStage = typeof CompetingStage.Type;

// One cache directory and one sequenced filesystem serve every competing-stage case;
// each case registers its own target, so concurrent cases never share a stage.
class CompetingStageProbe extends Context.Service<
  CompetingStageProbe,
  {
    readonly cacheDirectory: string;
    readonly stages: Ref.Ref<HashMap.HashMap<string, CompetingStage>>;
  }
>()("@beep/semantica/test/ProviderCache.test/CompetingStageProbe") {}

const CompetingStageProbeLive = Layer.effect(
  CompetingStageProbe,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return CompetingStageProbe.of({
      cacheDirectory: yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-competing-stage-" }),
      stages: yield* Ref.make(HashMap.empty<string, CompetingStage>()),
    });
  })
);

const CompetingStageCacheLive = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const { cacheDirectory, stages } = yield* CompetingStageProbe;
    const sequencedFileSystem = FileSystem.FileSystem.of({
      ...fs,
      exists: Effect.fn("ProviderCacheTest.publishCompetingEntryOnRead")(function* (candidate) {
        const stage = yield* Ref.modify(stages, (current) =>
          O.match(HashMap.get(current, candidate), {
            onNone: () => [O.none(), current] as const,
            onSome: (value) => {
              const next = { ...value, reads: value.reads + 1 };
              return [O.some(next), HashMap.set(current, candidate, next)] as const;
            },
          })
        );
        if (O.isSome(stage) && stage.value.reads === stage.value.publishOnRead) {
          yield* fs.writeFileString(candidate, `${stage.value.json}\n`);
        }
        return yield* fs.exists(candidate);
      }),
      rename: Effect.fn("ProviderCacheTest.observeCompetingStagePromotion")(function* (from, to) {
        yield* Ref.update(
          stages,
          HashMap.modify(to, (value) => ({ ...value, promotions: value.promotions + 1 }))
        );
        return yield* fs.rename(from, to);
      }),
    });
    return providerCacheTestRuntime(cacheDirectory, sequencedFileSystem);
  })
);

const CompetingStageServices = CompetingStageCacheLive.pipe(
  Layer.provideMerge(CompetingStageProbeLive),
  Layer.provideMerge(BunPlatformLive)
);

describe("C0 provider cache and language-model boundary", () => {
  it.layer(BunPlatformLive, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("is write-once, caches misses, replays hits, and keeps offline misses typed", () =>
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
            assertSome(yield* cache.lookup(key), entry);

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
            assertSome(yield* cache.lookup(orphanKey), orphanEntry);
            pipe(yield* fs.exists(orphanLock), assertFalse);

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
              pipe(miss.offline, assertTrue);
            }
          })
        );
      })
    );
  });

  it.effect("fails typed on an empty live generation and stores nothing", () =>
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
  );

  it.layer(CacheTestServices, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("lets a contender observe a healthy slow winner within the lock wait window", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-slow-winner-" });
        const probe = yield* makeCacheWaitProbe(fs);
        const runtime = providerCacheTestRuntime(cacheDirectory, probe.fileSystem);

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
              Effect.forkChild({ startImmediately: true })
            );
            const contender = yield* cache
              .store(entry)
              .pipe(Effect.provideService(Clock.Clock, probe.clock), Effect.forkChild);
            yield* probe.drive(
              contender,
              "healthy slow winner",
              Effect.gen(function* () {
                if ((yield* probe.clock.currentTimeMillis) >= 2000) yield* Fiber.join(winner);
              })
            );
            yield* Fiber.join(contender);
            yield* Fiber.join(winner);

            assertSome(yield* cache.lookup(key), entry);
          })
        );
      })
    );
  });

  it.layer(BunPlatformLive, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("lets exactly one contender reclaim a stale lock and reconciles the loser with its published entry", () =>
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
                  Ref.update(reclaimLosses, (count) => count + 1).pipe(Effect.andThen(Deferred.await(winnerPublished)))
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
        pipe(yield* fs.exists(lock), assertFalse);
        expect(yield* fs.readFileString(target)).toBe(`${yield* encodeProviderCacheEntry(entry)}\n`);
      })
    );
  });

  it.layer(BunPlatformLive, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect.each([
      ["restores the displaced replacement", false],
      ["preserves a newer replacement when rename-back is blocked", true],
    ] as const)("handles a replacement swap before reclaim rename: %s", ([_scenario, blockRenameBack]) =>
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
    );
  });

  it.layer(BunPlatformLive, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("abandons stale-lock recovery when the sampled owner is replaced before deletion", () =>
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
        pipe(yield* fs.exists(lock), assertTrue);
      })
    );
  });

  it.layer(BunPlatformLive, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("does not publish after its acquired lock is stolen and reconciles with the winner", () =>
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
        pipe(yield* fs.exists(lock), assertTrue);
        expect(yield* fs.readFileString(target)).toBe(`${json}\n`);
      })
    );
  });

  it.layer(CacheTestServices, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("fails with a lock wait timeout after the live-lock retry window expires", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cacheDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-cache-timeout-" });
        const probe = yield* makeCacheWaitProbe(fs);
        const runtime = providerCacheTestRuntime(cacheDirectory, probe.fileSystem);

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
            const contender = yield* cache
              .store(entry)
              .pipe(Effect.provideService(Clock.Clock, probe.clock), Effect.flip, Effect.forkChild);
            yield* probe.drive(contender, "live-lock timeout");
            expect(yield* Ref.get(probe.delays)).toEqual([200, 400, 800, 1600, 3200, 6400, 12800]);
            const error = yield* Fiber.join(contender);

            expect(error).toBeInstanceOf(ProviderCacheCorrupt);
            expect(error.message).toBe(
              "Timed out waiting for the live provider cache write lock to promote its entry."
            );
            pipe(yield* fs.exists(lock), assertTrue);
          })
        );
      })
    );
  });

  // The concurrent write-once races above interleave on the real filesystem, so a
  // contender reaches the competing entry at whichever store stage the scheduler
  // allows. Each stage is driven here by publishing the competing entry on a fixed
  // read of the target, so every outcome is covered whatever path a race takes.
  it.layer(CompetingStageServices, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect.each([
      ["while the live lock blocks acquisition", true, 2, O.none<string>()],
      ["after the contender acquires the lock", false, 2, O.none<string>()],
      ["while the contender waits on the live lock", true, 3, O.none<string>()],
      [
        "while the live lock blocks acquisition",
        true,
        2,
        O.some("A conflicting response already exists for this provider cache key."),
      ],
      [
        "after the contender acquires the lock",
        false,
        2,
        O.some("A conflicting provider cache write won the atomic promotion race."),
      ],
      [
        "while the contender waits on the live lock",
        true,
        3,
        O.some("A live provider cache writer stored different content for this key."),
      ],
    ] as const)(
      "reconciles a competing entry published %s (live lock %s, publish on target read %s, conflict %o)",
      ([_stage, liveLock, publishOnRead, conflict]) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { cacheDirectory, stages } = yield* CompetingStageProbe;
          const cache = yield* ProviderCache;
          const key = makeKey(`competing entry ${publishOnRead} ${liveLock} ${O.isSome(conflict)}`);
          const cacheKey = yield* contentDigest(ProviderCacheKey)(key);
          const makeEntry = (response: string) =>
            ProviderCacheEntry.make({ cacheKey, key, response, responseDigest: sha256TextSync(response) });
          const entry = makeEntry("contender");
          const competing = O.isSome(conflict) ? makeEntry("competing-writer") : entry;
          const target = path.join(cacheDirectory, `${cacheKey}.json`);
          const lock = `${target}.lock`;
          const competingJson = yield* encodeProviderCacheEntry(competing);
          if (liveLock) {
            yield* fs.makeDirectory(lock);
            yield* fs.writeFileString(path.join(lock, "owner.pid"), `${process.pid}\n`);
          }
          yield* Ref.update(
            stages,
            HashMap.set(target, CompetingStage.make({ json: competingJson, publishOnRead, reads: 0, promotions: 0 }))
          );

          const stored = yield* cache.store(entry).pipe(Effect.result);

          assertSome(
            HashMap.get(yield* Ref.get(stages), target),
            CompetingStage.make({ json: competingJson, publishOnRead, reads: publishOnRead, promotions: 0 })
          );
          expect(yield* fs.readFileString(target)).toBe(`${competingJson}\n`);
          expect(yield* fs.exists(lock)).toBe(liveLock);
          expect(
            Result.match(stored, {
              onFailure: (error) => O.some(error.message),
              onSuccess: () => O.none<string>(),
            })
          ).toEqual(conflict);
        })
    );
  });
  it.effect.each([
    [{ AI_ANTHROPIC_API_KEY: "test-key", AI_ANTHROPIC_MODEL: "claude-test-20260826" }, "claude-test-20260826"],
    [{ AI_ANTHROPIC_API_KEY: "test-key" }, ANTHROPIC_DEFAULT_MODEL],
  ] as const)("acquires the Anthropic extraction layer with model identity %s", ([env, expectedModel]) =>
    Effect.gen(function* () {
      const layer = AnthropicExtractionLanguageModelLive(model.artifactHash).pipe(
        Layer.provide(BunPlatformLive),
        Layer.provide(noOpProviderCache),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
      );
      const identity = yield* provideScopedLayer(layer)(ActiveModelIdentity);

      expect(identity.name).toBe(expectedModel);
      expect(identity.revision).toBe(expectedModel);
      expect(identity.provider).toBe("anthropic");
      expect(identity.taskType).toBe("extraction");
    })
  );

  it.effect.each(["claude-test-20260826", "claude-build-v2", "claude-build@3", "claude-build:2026"])(
    "retains an explicit model revision verbatim for %s",
    (modelId) =>
      Effect.gen(function* () {
        const identity = yield* AnthropicExtractionModelIdentity({ artifactHash: model.artifactHash, model: modelId });

        expect(identity.name).toBe(modelId);
        expect(identity.revision).toBe(modelId);
        expect(identity.provider).toBe("anthropic");
      })
  );

  it.effect("refuses an unversioned Anthropic override with AI_ANTHROPIC_MODEL", () =>
    Effect.gen(function* () {
      const layer = AnthropicExtractionLanguageModelLive(model.artifactHash).pipe(
        Layer.provide(BunPlatformLive),
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
  );
});
