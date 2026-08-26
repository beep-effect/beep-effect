import {
  Clock,
  Crypto,
  DateTime,
  Duration,
  Effect,
  FileSystem,
  Layer,
  Number as N,
  Path,
  Result,
  Schedule,
} from "effect";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LabConfig } from "@/runtime/Config";
import { contentDigest } from "@/schema/Digest";
import { ProviderCacheCorrupt } from "@/schema/Errors";
import { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";
import { ProviderCache } from "@/services/ProviderCache";

const ProviderCacheEntryJson = S.fromJsonString(ProviderCacheEntry);
const ProviderCacheEntryPrettyJson = S.fromJsonString(ProviderCacheEntry, { space: 2 });
const providerKeyEquivalence = S.toEquivalence(ProviderCacheKey);
const providerEntryEquivalence = S.toEquivalence(ProviderCacheEntry);
const staleLockAge = Duration.seconds(60);
const competingWriterSchedule = Schedule.exponential(Duration.millis(200)).pipe(Schedule.upTo({ times: 7 }));
const pendingWriterMessage = "The live provider cache writer has not promoted its entry yet.";
const lockWaitTimeoutMessage = "Timed out waiting for the live provider cache write lock to promote its entry.";

const corrupt = (message: string): ProviderCacheCorrupt => ProviderCacheCorrupt.make({ message });

const makeProviderCache = Effect.gen(function* () {
  const config = yield* LabConfig;
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const cacheKey = Effect.fn("ProviderCache.cacheKey")((key: ProviderCacheKey) =>
    contentDigest(ProviderCacheKey)(key).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(() => corrupt("The provider cache key could not be encoded."))
    )
  );

  const lookup = Effect.fn("ProviderCache.lookup")(function* (key: ProviderCacheKey) {
    const digest = yield* cacheKey(key);
    const entryPath = path.join(config.providerCacheDirectory, `${digest}.json`);
    const exists = yield* fs
      .exists(entryPath)
      .pipe(Effect.mapError(() => corrupt("The provider cache directory could not be inspected.")));
    if (!exists) {
      return O.none<ProviderCacheEntry>();
    }
    const json = yield* fs
      .readFileString(entryPath)
      .pipe(Effect.mapError(() => corrupt("A provider cache entry could not be read.")));
    const entry = yield* S.decodeEffect(ProviderCacheEntryJson)(json).pipe(
      Effect.mapError(() => corrupt("A provider cache entry failed schema or digest validation."))
    );
    if (!providerKeyEquivalence(entry.key, key)) {
      return yield* corrupt("A provider cache file contains a different key than its requested digest.");
    }
    return O.some(entry);
  });

  const processIsAlive = Effect.fn("ProviderCache.processIsAlive")((pid: number) =>
    Effect.try({
      try: () => {
        process.kill(pid, 0);
        return true;
      },
      catch: (cause): "alive" | "dead" =>
        P.hasProperty(cause, "code") && P.isString(cause.code) && Str.Equivalence(cause.code, "EPERM")
          ? "alive"
          : "dead",
    }).pipe(
      Effect.match({
        onFailure: (status) => Str.Equivalence(status, "alive"),
        onSuccess: () => true,
      })
    )
  );

  const parseOwnerPid = (text: string): O.Option<number> =>
    N.parse(Str.trim(text)).pipe(
      O.filter((pid) => N.isGreaterThan(pid, 0)),
      O.filter((pid) => N.Equivalence(N.remainder(pid, 1), 0))
    );

  const lockIsStale = Effect.fn("ProviderCache.lockIsStale")(function* (lock: string, ownerPath: string) {
    const info = yield* fs.stat(lock).pipe(Effect.option);
    const modified = O.flatMap(info, (value) => value.mtime);
    if (O.isNone(modified)) {
      return false;
    }
    const now = yield* Clock.currentTimeMillis;
    const age = now - DateTime.toEpochMillis(DateTime.fromDateUnsafe(modified.value));
    if (!N.isGreaterThan(age, Duration.toMillis(staleLockAge))) {
      return false;
    }
    const owner = yield* fs.readFileString(ownerPath).pipe(Effect.option);
    const pid = O.flatMap(owner, parseOwnerPid);
    return yield* O.match(pid, {
      onNone: () => Effect.succeed(true),
      onSome: (value) => processIsAlive(value).pipe(Effect.map(Bool.not)),
    });
  });

  const reconcileCompetingWrite = Effect.fn("ProviderCache.reconcileCompetingWrite")((entry: ProviderCacheEntry) =>
    lookup(entry.key).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.fail(corrupt(pendingWriterMessage)),
          onSome: (stored) =>
            providerEntryEquivalence(stored, entry)
              ? Effect.void
              : Effect.fail(corrupt("A live provider cache writer stored different content for this key.")),
        })
      )
    )
  );

  const awaitCompetingWrite = Effect.fn("ProviderCache.awaitCompetingWrite")(function* (entry: ProviderCacheEntry) {
    const waited = yield* reconcileCompetingWrite(entry).pipe(
      Effect.retry({
        schedule: competingWriterSchedule,
        while: (error) => Str.Equivalence(error.message, pendingWriterMessage),
      }),
      Effect.result
    );
    if (Result.isSuccess(waited)) {
      return;
    }
    if (!Str.Equivalence(waited.failure.message, pendingWriterMessage)) {
      return yield* waited.failure;
    }
    const finalLookup = yield* reconcileCompetingWrite(entry).pipe(Effect.result);
    if (Result.isSuccess(finalLookup)) {
      return;
    }
    if (!Str.Equivalence(finalLookup.failure.message, pendingWriterMessage)) {
      return yield* finalLookup.failure;
    }
    return yield* corrupt(lockWaitTimeoutMessage);
  });

  const tryAcquireLock = (lock: string): Effect.Effect<boolean> =>
    fs.makeDirectory(lock).pipe(Effect.result, Effect.map(Result.isSuccess));

  const acquireLock = Effect.fn("ProviderCache.acquireLock")(function* (
    entry: ProviderCacheEntry,
    lock: string,
    ownerPath: string
  ) {
    if (yield* tryAcquireLock(lock)) {
      return true;
    }

    const current = yield* lookup(entry.key);
    if (O.isSome(current)) {
      if (providerEntryEquivalence(current.value, entry)) {
        return false;
      }
      return yield* corrupt("A conflicting response already exists for this provider cache key.");
    }

    if (!(yield* lockIsStale(lock, ownerPath))) {
      yield* awaitCompetingWrite(entry);
      return false;
    }

    yield* fs
      .remove(lock, { force: true, recursive: true })
      .pipe(Effect.mapError(() => corrupt("A stale provider cache write lock could not be removed.")));
    if (yield* tryAcquireLock(lock)) {
      return true;
    }
    yield* awaitCompetingWrite(entry);
    return false;
  });

  const store = Effect.fn("ProviderCache.store")(function* (entry: ProviderCacheEntry) {
    const existing = yield* lookup(entry.key);
    if (O.isSome(existing)) {
      if (providerEntryEquivalence(existing.value, entry)) {
        return;
      }
      return yield* corrupt("A conflicting response already exists for this provider cache key.");
    }

    const json = yield* S.encodeEffect(ProviderCacheEntryPrettyJson)(entry).pipe(
      Effect.mapError(() => corrupt("The provider cache entry could not be encoded."))
    );
    yield* fs
      .makeDirectory(config.providerCacheDirectory, { recursive: true })
      .pipe(Effect.mapError(() => corrupt("The provider cache directory could not be created.")));
    const target = path.join(config.providerCacheDirectory, `${entry.cacheKey}.json`);
    const lock = `${target}.lock`;
    const ownerPath = path.join(lock, "owner.pid");
    yield* Effect.scoped(
      Effect.gen(function* () {
        const temporary = yield* fs
          .makeTempFileScoped({
            directory: config.providerCacheDirectory,
            prefix: `.${entry.cacheKey}.`,
            suffix: ".tmp",
          })
          .pipe(Effect.mapError(() => corrupt("A temporary provider cache file could not be allocated.")));
        yield* fs
          .writeFileString(temporary, `${json}\n`)
          .pipe(Effect.mapError(() => corrupt("A temporary provider cache entry could not be written.")));

        const acquired = yield* acquireLock(entry, lock, ownerPath);
        if (!acquired) {
          return;
        }
        yield* Effect.gen(function* () {
          yield* fs
            .writeFileString(ownerPath, `${process.pid}\n`)
            .pipe(Effect.mapError(() => corrupt("The provider cache lock owner could not be recorded.")));
          const current = yield* lookup(entry.key);
          if (O.exists(current, (stored) => providerEntryEquivalence(stored, entry))) {
            return;
          }
          if (O.isSome(current)) {
            return yield* corrupt("A conflicting provider cache write won the atomic promotion race.");
          }
          yield* fs
            .rename(temporary, target)
            .pipe(Effect.mapError(() => corrupt("The provider cache entry could not be promoted atomically.")));
        }).pipe(Effect.ensuring(fs.remove(lock, { force: true, recursive: true }).pipe(Effect.ignore)));
      })
    );
  });

  return ProviderCache.of({ lookup, store });
});

/**
 * JSON-file provider cache using a write lock and atomic temp-file rename.
 *
 * **Example** (Inspect the cache layer)
 *
 * ```ts
 * import { ProviderCacheLive } from "@/layers/ProviderCacheLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ProviderCacheLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProviderCacheLive = Layer.effect(ProviderCache, makeProviderCache);
