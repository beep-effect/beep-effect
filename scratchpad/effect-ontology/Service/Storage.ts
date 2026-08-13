import type { PathSafetyError } from "@beep/file-processing/PathSafety";
import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety";
import { $ScratchpadId } from "@beep/identity";
import { Storage } from "@google-cloud/storage";
import { Context, Data, Effect, FileSystem, Layer, Path } from "effect";
import * as Clock from "effect/Clock";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import type { PlatformError } from "effect/PlatformError";
import { SystemError } from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { KeyValueStore } from "effect/unstable/persistence";
import { ConfigService } from "./Config.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Storage");

const localStorageAbsoluteKeyPattern = /^(?:[\\/]|[A-Za-z]:[\\/])/u;
const localStorageDotSegmentPattern = /(?:^|[\\/])\.{1,2}(?:[\\/]|$)/u;

const LocalStorageKey = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter((value: string) => !localStorageAbsoluteKeyPattern.test(value), {
        identifier: $I`LocalStorageKeyRelativeCheck`,
        title: "Local Storage Key Is Relative",
        description: "A local storage key without a POSIX, UNC, or Windows drive root.",
        message: "Local storage key must be relative to the configured storage root.",
      }),
      S.makeFilter((value: string) => !localStorageDotSegmentPattern.test(value), {
        identifier: $I`LocalStorageKeyDotSegmentCheck`,
        title: "Local Storage Key Has No Dot Segments",
        description: "A local storage key without current-directory or parent-directory path segments.",
        message: 'Local storage key must not contain "." or ".." path segments.',
      }),
    ],
    {
      identifier: $I`LocalStorageKeyChecks`,
      title: "Local Storage Key",
      description: "A non-empty, relative local storage key without dot path segments.",
    }
  )
).pipe(
  $I.annoteSchema("LocalStorageKey", {
    description: "A non-empty, relative local storage key without current-directory or parent-directory segments.",
  })
);

const isLocalStorageKey = S.is(LocalStorageKey);

/**
 * Result of getWithGeneration - includes content and version for optimistic locking
 */
export interface ObjectWithGeneration {
  readonly content: string;
  readonly generation: string;
}

/**
 * Error thrown when setIfGenerationMatch fails due to concurrent modification
 */
export class GenerationMismatchError extends Data.TaggedError("GenerationMismatchError")<{
  readonly key: string;
  readonly expectedGeneration: string;
  readonly actualGeneration?: string;
}> {}

/**
 * StorageService interface extending KeyValueStore
 * Adds `list` capability and optimistic locking for concurrent writes
 */
export interface StorageServiceMethods extends KeyValueStore.KeyValueStore {
  readonly list: (prefix: string) => Effect.Effect<Array<string>, SystemError | PlatformError>;

  /**
   * Get an object along with its generation for optimistic locking
   * @returns None if object doesn't exist, Some with content and generation if it does
   */
  readonly getWithGeneration: (
    key: string
  ) => Effect.Effect<O.Option<ObjectWithGeneration>, SystemError | PlatformError>;

  /**
   * Set an object only if its generation matches the expected value
   * @param generation - Expected generation (from previous getWithGeneration)
   * @returns Fails with GenerationMismatchError if generation doesn't match
   */
  readonly setIfGenerationMatch: (
    key: string,
    value: string,
    generation: string
  ) => Effect.Effect<void, SystemError | PlatformError | GenerationMismatchError>;

  /**
   * Get a signed URL for direct access to the object (GCS only)
   * @param key - Object key
   * @param expiresInSeconds - URL expiry time (default: 3600 = 1 hour)
   * @returns Signed URL or None if not supported (e.g., local storage)
   */
  readonly getSignedUrl: (
    key: string,
    expiresInSeconds?: number
  ) => Effect.Effect<O.Option<string>, SystemError | PlatformError>;

  /**
   * Whether this storage backend supports signed URLs
   */
  readonly supportsSignedUrls: boolean;
}

export class StorageService extends Context.Service<StorageService, StorageServiceMethods>()($I`StorageService`) {}

export interface StorageConfigValue {
  readonly type: "local" | "gcs" | "memory";
  readonly bucketName?: string; // Required for GCS
  readonly localPath?: string; // Required for Local
  readonly pathPrefix?: string;
}

export class StorageConfig extends Context.Service<StorageConfig, StorageConfigValue>()($I`StorageConfig`) {}

// --- GCS Implementation ---

const makeGcsStore = Effect.fn("makeGcsStore")(function* (config: StorageConfigValue) {
  if (P.isUndefined(config.bucketName)) {
    return yield* new SystemError({
      _tag: "InvalidData",
      module: "KeyValueStore",
      method: "makeGcsStore",
      pathOrDescriptor: "bucketName",
      description: "bucketName is required for GCS storage",
    });
  }
  yield* Effect.logDebug("Creating GCS Storage client", { bucket: config.bucketName });
  const storage = new Storage();
  const bucket = storage.bucket(config.bucketName);
  const prefix = config.pathPrefix ?? "";
  const toPath = (key: string) => `${prefix}/${key}`.replace(/\/+/g, "/").replace(/^\//, "");
  const handleError = (method: string, key: string, cause: unknown) => {
    let reason: SystemError["_tag"] = "Unknown";
    let message: string;
    if (cause instanceof Error) {
      message = cause.message;
    } else if (typeof cause === "object" && cause !== null) {
      const obj = cause as Record<string, unknown>;
      if (typeof obj.message === "string") {
        message = obj.message;
      } else if (Array.isArray(obj.errors)) {
        message = obj.errors
          .map((e: unknown) =>
            typeof e === "object" && e !== null && "message" in e
              ? String(
                  (
                    e as {
                      message: unknown;
                    }
                  ).message
                )
              : String(e)
          )
          .join("; ");
      } else {
        message = String(cause);
      }
    } else {
      message = String(cause);
    }
    if (cause instanceof Error) {
      const code =
        "code" in cause &&
        typeof (
          cause as {
            code?: unknown;
          }
        ).code === "number"
          ? (
              cause as {
                code: number;
              }
            ).code
          : undefined;
      if (code !== undefined) {
        switch (code) {
          case 404:
            reason = "NotFound";
            break;
          case 403:
            reason = "PermissionDenied";
            break;
          case 409:
            reason = "AlreadyExists";
            break;
          case 400:
            reason = "InvalidData";
            break;
          case 408:
          case 503:
          case 504:
            reason = "Busy";
            break;
        }
      }
    }
    return new SystemError({
      _tag: reason,
      module: "KeyValueStore",
      method,
      pathOrDescriptor: key,
      description: message,
    });
  };
  const handleKvError = (method: string, key: string, cause: unknown) =>
    new KeyValueStore.KeyValueStoreError({
      method,
      key,
      message: handleError(method, key, cause).message,
      cause,
    });
  const tryKvPromise = <A>(method: string, key: string, evaluate: () => PromiseLike<A>) =>
    Effect.tryPromise({
      try: evaluate,
      catch: (cause) => handleKvError(method, key, cause),
    });
  const tryStoragePromise = <A>(method: string, key: string, evaluate: () => PromiseLike<A>) =>
    Effect.tryPromise({
      try: evaluate,
      catch: (cause) => handleError(method, key, cause),
    });
  const impl = KeyValueStore.make({
    get: Effect.fn("Storage.gcs.get")(function* (key) {
      const file = bucket.file(toPath(key));
      const [exists] = yield* tryKvPromise("get", key, () => file.exists());
      if (!exists) return undefined;
      const [content] = yield* tryKvPromise("get", key, () => file.download());
      return content.toString("utf-8");
    }),
    getUint8Array: Effect.fn("Storage.gcs.getUint8Array")(function* (key) {
      const file = bucket.file(toPath(key));
      const [exists] = yield* tryKvPromise("getUint8Array", key, () => file.exists());
      if (!exists) return undefined;
      const [content] = yield* tryKvPromise("getUint8Array", key, () => file.download());
      return new Uint8Array(content);
    }),
    set: Effect.fn("Storage.gcs.set")(function* (key, value) {
      const content = P.isString(value) ? value : Buffer.from(value);
      yield* tryKvPromise("set", key, () => bucket.file(toPath(key)).save(content));
    }),
    remove: Effect.fn("Storage.gcs.remove")(function* (key) {
      const file = bucket.file(toPath(key));
      const [exists] = yield* tryKvPromise("remove", key, () => file.exists());
      if (exists) {
        yield* tryKvPromise("remove", key, () => file.delete());
      }
    }),
    clear: tryKvPromise("clear", prefix, () => bucket.deleteFiles(P.isTruthy(prefix) ? { prefix } : {})).pipe(
      Effect.asVoid
    ),
    size: tryKvPromise("size", prefix, () => bucket.getFiles(P.isTruthy(prefix) ? { prefix } : {})).pipe(
      Effect.map(([files]) => files.length)
    ),
  });
  return {
    ...impl,
    list: (listPrefix) =>
      tryStoragePromise("list", listPrefix, () => bucket.getFiles({ prefix: toPath(listPrefix) })).pipe(
        Effect.map(([files]) => files.map((file) => file.name.replace(P.isTruthy(prefix) ? `${prefix}/` : "", "")))
      ),
    getWithGeneration: Effect.fn("Storage.gcs.getWithGeneration")(function* (key) {
      const file = bucket.file(toPath(key));
      const [exists] = yield* tryStoragePromise("getWithGeneration", key, () => file.exists());
      if (!exists) return O.none();
      const [[content], [metadata]] = yield* tryStoragePromise("getWithGeneration", key, () =>
        Promise.all([file.download(), file.getMetadata()])
      );
      return O.some({
        content: content.toString("utf-8"),
        generation: String(metadata.generation),
      });
    }),
    setIfGenerationMatch: (key, value, expectedGeneration) =>
      Effect.tryPromise({
        try: () =>
          bucket.file(toPath(key)).save(value, {
            preconditionOpts: {
              ifGenerationMatch: Number(expectedGeneration),
            },
          }),
        catch: (e) => {
          if (
            e instanceof Error &&
            "code" in e &&
            (
              e as {
                code?: number;
              }
            ).code === 412
          ) {
            return new GenerationMismatchError({ key, expectedGeneration });
          }
          return handleError("setIfGenerationMatch", key, e);
        },
      }),
    getSignedUrl: Effect.fn("getSignedUrl")(function* (key: string, expiresInSeconds: number = 3600) {
      const expires = (yield* Clock.currentTimeMillis) + expiresInSeconds * 1000;
      const file = bucket.file(toPath(key));
      const [exists] = yield* tryStoragePromise("getSignedUrl", key, () => file.exists());
      if (!exists) return O.none();
      const [signedUrl] = yield* tryStoragePromise("getSignedUrl", key, () =>
        file.getSignedUrl({
          version: "v4",
          action: "read",
          expires,
        })
      );
      return O.some(signedUrl);
    }),
    supportsSignedUrls: true,
  } as StorageServiceMethods;
});

// --- Local Filesystem Implementation ---

const makeLocalStore = Effect.fn("makeLocalStore")(function* (config: StorageConfigValue) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const basePath = config.localPath ?? "./output";
  const globalPrefix = config.pathPrefix ?? "";
  yield* fs.makeDirectory(basePath, { recursive: true });
  const canonicalBasePath = yield* fs.realPath(basePath);
  const prefixCandidate = P.isTruthy(globalPrefix) ? globalPrefix : ".";
  const resolveStorageRoot = () =>
    resolvePathWithinCanonicalRoot({
      canonicalRoot: canonicalBasePath,
      candidate: prefixCandidate,
    });
  const prefixedRoot = yield* resolveStorageRoot();
  yield* fs.makeDirectory(prefixedRoot, { recursive: true });
  const canonicalRoot = yield* resolveStorageRoot();
  const resolveContainedPath = (candidate: string) =>
    resolvePathWithinCanonicalRoot({
      canonicalRoot,
      candidate,
    }).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
  const ensureDir = (filePath: string) => fs.makeDirectory(path.dirname(filePath), { recursive: true });
  const localKvError = (method: string, key: string) => (cause: unknown) =>
    new KeyValueStore.KeyValueStoreError({ method, key, message: String(cause), cause });
  const localPathError = (method: string, key: string) => (cause: PathSafetyError | SystemError) =>
    new SystemError({
      _tag: "InvalidData",
      module: "KeyValueStore",
      method,
      pathOrDescriptor: key,
      description: cause.message,
    });
  const resolvePath = Effect.fnUntraced(function* (key: string) {
    if (path.isAbsolute(key) || !isLocalStorageKey(key)) {
      return yield* new SystemError({
        _tag: "InvalidData",
        module: "KeyValueStore",
        method: "resolvePath",
        pathOrDescriptor: key,
        description: 'Local storage keys must be non-empty, relative, and contain no "." or ".." path segments.',
      });
    }
    return yield* resolveContainedPath(key);
  });

  const walkDirRecursive = Effect.fn("Storage.walkDirRecursive")(function* (
    currentDir: string,
    relativePath: string
  ): Effect.fn.Return<Array<string>, PlatformError | SystemError> {
    const entries = yield* fs.readDirectory(currentDir).pipe(Effect.orElseSucceed(() => []));
    const results: Array<string> = [];
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry);
      const fullPath = yield* resolveContainedPath(entryPath).pipe(
        Effect.mapError(localPathError("walkDirRecursive", entryPath))
      );
      const entryRelativePath = P.isTruthy(relativePath) ? `${relativePath}/${entry}` : entry;
      const stat = yield* fs.stat(fullPath).pipe(Effect.option);
      if (O.isNone(stat)) continue;
      if (stat.value.type === "Directory") {
        results.push(...(yield* walkDirRecursive(fullPath, entryRelativePath)));
      } else {
        results.push(entryRelativePath);
      }
    }
    return results;
  });

  const impl = KeyValueStore.make({
    get: (key) =>
      Effect.gen(function* () {
        const resolved = yield* resolvePath(key);
        if (!(yield* fs.exists(resolved))) return undefined;
        return yield* fs.readFileString(resolved);
      }).pipe(Effect.mapError(localKvError("get", key))),
    getUint8Array: (key) =>
      Effect.gen(function* () {
        const resolved = yield* resolvePath(key);
        if (!(yield* fs.exists(resolved))) return undefined;
        return yield* fs.readFile(resolved);
      }).pipe(Effect.mapError(localKvError("getUint8Array", key))),
    set: (key, value) =>
      Effect.gen(function* () {
        const resolved = yield* resolvePath(key);
        yield* ensureDir(resolved);
        if (typeof value === "string") {
          yield* fs.writeFileString(resolved, value);
        } else {
          yield* fs.writeFile(resolved, value);
        }
      }).pipe(Effect.mapError(localKvError("set", key))),
    remove: (key) =>
      Effect.gen(function* () {
        const resolved = yield* resolvePath(key);
        if (yield* fs.exists(resolved)) yield* fs.remove(resolved);
      }).pipe(Effect.mapError(localKvError("remove", key))),
    clear: Effect.gen(function* () {
      const checkedRoot = yield* resolveContainedPath(".");
      if (!(yield* fs.exists(checkedRoot))) {
        yield* fs.makeDirectory(checkedRoot, { recursive: true });
        return;
      }
      const entries = yield* fs.readDirectory(checkedRoot);
      for (const entry of entries) {
        const entryPath = path.join(checkedRoot, entry);
        const checkedEntry = yield* resolveContainedPath(entryPath);
        yield* fs.remove(checkedEntry, { recursive: true });
      }
    }).pipe(Effect.mapError(localKvError("clear", globalPrefix))),
    size: Effect.gen(function* () {
      const checkedRoot = yield* resolveContainedPath(".");
      if (!(yield* fs.exists(checkedRoot))) return 0;
      const files = yield* walkDirRecursive(checkedRoot, "");
      let totalSize = 0;
      for (const file of files) {
        const stat = yield* fs.stat(yield* resolvePath(file));
        totalSize += Number(stat.size);
      }
      return totalSize;
    }).pipe(Effect.mapError(localKvError("size", globalPrefix))),
  });

  return {
    ...impl,
    list: Effect.fn("Storage.local.list")(function* (prefix: string) {
      const dir = yield* (P.isTruthy(prefix) ? resolvePath(prefix) : resolveContainedPath(".")).pipe(
        Effect.mapError(localPathError("list", prefix))
      );
      if (!(yield* fs.exists(dir))) return [];
      return yield* walkDirRecursive(dir, "");
    }),
    getWithGeneration: Effect.fn("Storage.local.getWithGeneration")(function* (key: string) {
      const resolved = yield* resolvePath(key).pipe(Effect.mapError(localPathError("getWithGeneration", key)));
      if (!(yield* fs.exists(resolved))) return O.none();
      const content = yield* fs.readFileString(resolved);
      const stat = yield* fs.stat(resolved);
      const generation = O.match(stat.mtime, {
        onNone: () => String(stat.size),
        onSome: (mtime) => String(mtime.getTime()),
      });
      return O.some({ content, generation });
    }),
    setIfGenerationMatch: Effect.fn("Storage.local.setIfGenerationMatch")(function* (
      key: string,
      value: string,
      expectedGeneration: string
    ) {
      const resolved = yield* resolvePath(key).pipe(Effect.mapError(localPathError("setIfGenerationMatch", key)));
      if (yield* fs.exists(resolved)) {
        const stat = yield* fs.stat(resolved);
        const currentGeneration = O.match(stat.mtime, {
          onNone: () => String(stat.size),
          onSome: (mtime) => String(mtime.getTime()),
        });
        if (currentGeneration !== expectedGeneration) {
          return yield* new GenerationMismatchError({ key, expectedGeneration, actualGeneration: currentGeneration });
        }
      }
      yield* ensureDir(resolved);
      yield* fs.writeFileString(resolved, value);
    }),
    getSignedUrl: (_key: string) => Effect.succeed(O.none()),
    supportsSignedUrls: false,
  } satisfies StorageServiceMethods;
});

// --- In-Memory Implementation ---

const makeMemoryStore = Effect.sync(() => {
  const store = MutableHashMap.empty<string, string | Uint8Array>();
  const generations = MutableHashMap.empty<string, number>();

  const getGeneration = (key: string): string => String(O.getOrElse(MutableHashMap.get(generations, key), () => 0));
  const incrementGeneration = (key: string): void => {
    const current = O.getOrElse(MutableHashMap.get(generations, key), () => 0);
    MutableHashMap.set(generations, key, current + 1);
  };

  const kv = KeyValueStore.make({
    get: (key) =>
      Effect.sync(() => {
        const val = O.getOrUndefined(MutableHashMap.get(store, key));
        if (P.isUndefined(val)) return undefined;
        return typeof val === "string" ? val : new TextDecoder().decode(val);
      }),
    getUint8Array: (key) =>
      Effect.sync(() => {
        const val = O.getOrUndefined(MutableHashMap.get(store, key));
        if (P.isUndefined(val)) return undefined;
        return typeof val === "string" ? new TextEncoder().encode(val) : val;
      }),
    set: (key, value) =>
      Effect.sync(() => {
        MutableHashMap.set(store, key, value);
        incrementGeneration(key);
      }),
    remove: (key) =>
      Effect.sync(() => {
        MutableHashMap.remove(store, key);
        MutableHashMap.remove(generations, key);
      }),
    clear: Effect.sync(() => {
      MutableHashMap.clear(store);
      MutableHashMap.clear(generations);
    }),
    size: Effect.sync(() => MutableHashMap.size(store)),
  });

  return {
    ...kv,
    list: (prefix) => Effect.sync(() => Array.from(MutableHashMap.keys(store)).filter((k) => k.startsWith(prefix))),
    getWithGeneration: (key) =>
      Effect.sync(() => {
        const val = O.getOrUndefined(MutableHashMap.get(store, key));
        if (P.isUndefined(val)) return O.none();
        const content = typeof val === "string" ? val : new TextDecoder().decode(val);
        return O.some({ content, generation: getGeneration(key) });
      }),
    setIfGenerationMatch: (key, value, expectedGeneration) =>
      Effect.suspend(() => {
        const currentGeneration = getGeneration(key);
        if (MutableHashMap.has(store, key) && currentGeneration !== expectedGeneration) {
          return Effect.fail(
            new GenerationMismatchError({ key, expectedGeneration, actualGeneration: currentGeneration })
          );
        }
        MutableHashMap.set(store, key, value);
        incrementGeneration(key);
        return Effect.void;
      }),
    // Memory store doesn't support signed URLs
    getSignedUrl: () => Effect.succeed(O.none()),
    supportsSignedUrls: false,
  } as StorageServiceMethods;
});

// --- Layer Definition ---

export const StorageServiceLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const { bucket, localPath, prefix, type } = config.storage;

    // Adapter for internal storage config
    const storageConfig: StorageConfigValue = {
      type,
      ...(O.isSome(bucket) ? { bucketName: bucket.value } : {}),
      ...(O.isSome(localPath) ? { localPath: localPath.value } : {}),
      pathPrefix: prefix,
    };

    if (type === "gcs") {
      return yield* makeGcsStore(storageConfig);
    } else if (type === "local") {
      return yield* makeLocalStore(storageConfig);
    } else {
      return yield* makeMemoryStore;
    }
  })
);

/**
 * In-memory storage layer for testing
 * Does not require ConfigService
 */
export const StorageServiceTest = Layer.effect(StorageService, makeMemoryStore);
