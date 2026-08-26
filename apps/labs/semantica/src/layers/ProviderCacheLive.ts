import { Crypto, Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { LabConfig } from "@/runtime/Config";
import { contentDigest } from "@/schema/Digest";
import { ProviderCacheCorrupt } from "@/schema/Errors";
import { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";
import { ProviderCache } from "@/services/ProviderCache";

const ProviderCacheEntryJson = S.fromJsonString(ProviderCacheEntry);
const ProviderCacheEntryPrettyJson = S.fromJsonString(ProviderCacheEntry, { space: 2 });
const providerKeyEquivalence = S.toEquivalence(ProviderCacheKey);
const providerEntryEquivalence = S.toEquivalence(ProviderCacheEntry);

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

        yield* fs
          .makeDirectory(lock)
          .pipe(Effect.mapError(() => corrupt("The provider cache write lock could not be acquired.")));
        yield* Effect.gen(function* () {
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
 * @category layers
 * @since 0.0.0
 */
export const ProviderCacheLive = Layer.effect(ProviderCache, makeProviderCache);
