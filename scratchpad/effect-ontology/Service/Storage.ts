/**
 * Public effect-ontology APIs for service/storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { PathSafetyError } from "@beep/file-processing/PathSafety";
import {
  resolvePathWithinCanonicalRoot,
  writeFileWithinCanonicalRootAtomically,
} from "@beep/file-processing/PathSafety";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Storage } from "@google-cloud/storage";
import {
  Clock,
  Context,
  DateTime,
  Duration,
  Effect,
  FileSystem,
  Inspectable,
  Layer,
  Match,
  MutableHashMap,
  Path,
  Semaphore,
} from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import type { PlatformError } from "effect/PlatformError";
import { SystemError } from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { KeyValueStore } from "effect/unstable/persistence";
import { sha256SyncFull } from "../Utils/Hash.ts";
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

const GcsGeneration = S.String.check(
  S.isPattern(/^(?:0|[1-9][0-9]*)$/u, {
    identifier: $I`GcsGenerationPatternCheck`,
    title: "GCS Generation",
    description: "A canonical non-negative decimal GCS generation string.",
    message: "GCS generation must be zero or a non-zero decimal integer without leading zeros.",
  })
).pipe(
  $I.annoteSchema("GcsGeneration", {
    description: "A canonical decimal GCS generation preserved as text for exact 64-bit preconditions.",
  })
);

const decodeGcsGeneration = S.decodeEffect(GcsGeneration);

const isLocalStorageKey = S.is(LocalStorageKey);

/**
 * Result of getWithGeneration - includes content and version for optimistic locking
 *
 *
 * **Example** (Use the ObjectWithGeneration contract)
 *
 * ```ts
 * import type { ObjectWithGeneration } from "@effect-ontology/Service/Storage"
 *
 * const acceptsObjectWithGeneration = (_value: ObjectWithGeneration): void => undefined
 *
 * console.log(acceptsObjectWithGeneration)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class ObjectWithGeneration extends S.Class<ObjectWithGeneration>($I`ObjectWithGeneration`)(
  {
    content: S.String,
    generation: S.NonEmptyString,
  },
  $I.annote("ObjectWithGeneration", {
    description: "Stored text together with the backend generation used for optimistic locking.",
  })
) {}

/**
 * Error thrown when setIfGenerationMatch fails due to concurrent modification
 *
 * **Example** (Inspect generation mismatch error)
 *
 * ```ts
 * import { GenerationMismatchError } from "@effect-ontology/Service/Storage"
 *
 * console.log(GenerationMismatchError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GenerationMismatchError extends S.TaggedError<GenerationMismatchError>($I`GenerationMismatchError`)(
  "GenerationMismatchError",
  {
    key: S.NonEmptyString.annotateKey({
      description: "Storage key whose optimistic generation check failed.",
    }),
    expectedGeneration: S.NonEmptyString.annotateKey({
      description: "Generation expected by the conditional write.",
    }),
    actualGeneration: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Observed storage generation when it was available.",
      })
    ),
  },
  $I.annote("GenerationMismatchError", {
    description: "Optimistic-lock failure caused by a changed storage generation.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * StorageService interface extending KeyValueStore
 * Adds `list` capability and optimistic locking for concurrent writes
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface StorageServiceMethods extends KeyValueStore.KeyValueStore {
  /** Read text content while representing a missing key explicitly. */
  readonly getOption: (key: string) => Effect.Effect<O.Option<string>, KeyValueStore.KeyValueStoreError>;

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
   * @param expiresIn - URL expiry duration (default: one hour)
   * @returns Signed URL or None if not supported (e.g., local storage)
   */
  readonly getSignedUrl: (
    key: string,
    expiresIn?: Duration.Duration
  ) => Effect.Effect<O.Option<string>, SystemError | PlatformError>;

  /**
   * Whether this storage backend supports signed URLs
   */
  readonly supportsSignedUrls: boolean;
}

/**
 * Provides the storage service service capability.
 *
 * **Example** (Inspect storage service)
 *
 * ```ts
 * import { StorageService } from "@effect-ontology/Service/Storage"
 *
 * console.log(StorageService)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StorageService extends Context.Service<StorageService, StorageServiceMethods>()($I`StorageService`) {}

/**
 * Describes the storage config value data exposed by this module.
 *
 *
 * **Example** (Use the StorageConfigValue contract)
 *
 * ```ts
 * import type { StorageConfigValue } from "@effect-ontology/Service/Storage"
 *
 * const acceptsStorageConfigValue = (_value: StorageConfigValue): void => undefined
 *
 * console.log(acceptsStorageConfigValue)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
/**
 * Supported object-storage backend identifiers.
 *
 * **Example** (Inspect storage backends)
 *
 * ```ts
 * import { StorageBackend } from "@effect-ontology/Service/Storage"
 *
 * console.log(StorageBackend.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StorageBackend = LiteralKit(["local", "gcs", "memory"]).pipe(
  $I.annoteSchema("StorageBackend", {
    description: "Supported object-storage backend implementations.",
  })
);

/**
 * Runtime value accepted by {@link StorageBackend}.
 *
 * **Example** (Use a storage backend)
 *
 * ```ts
 * import type { StorageBackend } from "@effect-ontology/Service/Storage"
 *
 * const backend: StorageBackend = "memory"
 * console.log(backend)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type StorageBackend = typeof StorageBackend.Type;

/**
 * Backend selection and backend-specific storage locations.
 *
 * **Example** (Inspect storage configuration)
 *
 * ```ts
 * import { StorageConfigValue } from "@effect-ontology/Service/Storage"
 *
 * console.log(StorageConfigValue)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StorageConfigValue extends S.Class<StorageConfigValue>($I`StorageConfigValue`)(
  {
    type: StorageBackend,
    bucketName: S.optionalKey(S.NonEmptyString),
    localPath: S.optionalKey(S.NonEmptyString),
    pathPrefix: S.optionalKey(S.String),
  },
  $I.annote("StorageConfigValue", {
    description: "Backend selection and backend-specific object-storage location settings.",
  })
) {}

/**
 * Provides the storage config service capability.
 *
 * **Example** (Inspect storage config)
 *
 * ```ts
 * import { StorageConfig } from "@effect-ontology/Service/Storage"
 *
 * console.log(StorageConfig)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
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
  const systemErrorReason = Match.type<number | undefined>().pipe(
    Match.when(404, (): SystemError["_tag"] => "NotFound"),
    Match.when(403, (): SystemError["_tag"] => "PermissionDenied"),
    Match.when(409, (): SystemError["_tag"] => "AlreadyExists"),
    Match.when(400, (): SystemError["_tag"] => "InvalidData"),
    Match.when(408, (): SystemError["_tag"] => "Busy"),
    Match.when(503, (): SystemError["_tag"] => "Busy"),
    Match.when(504, (): SystemError["_tag"] => "Busy"),
    Match.orElse((): SystemError["_tag"] => "Unknown")
  );
  const handleError = (method: string, key: string, cause: unknown) => {
    const messageOf = (value: unknown): O.Option<string> =>
      P.isObject(value) && P.hasProperty(value, "message") && P.isString(value.message)
        ? O.some(value.message)
        : O.none();
    const message = O.getOrElse(messageOf(cause), () =>
      P.isObject(cause) && P.hasProperty(cause, "errors") && A.isArray(cause.errors)
        ? A.join(
            A.map(cause.errors, (error) => O.getOrElse(messageOf(error), () => Inspectable.toStringUnknown(error))),
            "; "
          )
        : Inspectable.toStringUnknown(cause)
    );
    const code = P.isObject(cause) && P.hasProperty(cause, "code") && P.isNumber(cause.code) ? cause.code : undefined;
    const reason = systemErrorReason(code);
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
  const service: StorageServiceMethods = {
    ...impl,
    getOption: (key) => impl.get(key).pipe(Effect.map(O.fromUndefinedOr)),
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
        generation: Inspectable.toStringUnknown(metadata.generation),
      });
    }),
    setIfGenerationMatch: Effect.fn("Storage.gcs.setIfGenerationMatch")(function* (
      key: string,
      value: string,
      expectedGeneration: string
    ) {
      const exactGeneration = yield* decodeGcsGeneration(expectedGeneration).pipe(
        Effect.mapError(
          (cause) =>
            new SystemError({
              _tag: "InvalidData",
              module: "KeyValueStore",
              method: "setIfGenerationMatch",
              pathOrDescriptor: key,
              description: Inspectable.toStringUnknown(cause),
            })
        )
      );
      yield* Effect.tryPromise({
        try: () =>
          bucket.file(toPath(key)).save(value, {
            preconditionOpts: {
              ifGenerationMatch: exactGeneration,
            },
          }),
        catch: (e) => {
          if (P.isObject(e) && P.hasProperty(e, "code") && e.code === 412) {
            return GenerationMismatchError.make({ key, expectedGeneration });
          }
          return handleError("setIfGenerationMatch", key, e);
        },
      });
    }),
    getSignedUrl: Effect.fn("getSignedUrl")(function* (key: string, expiresIn: Duration.Duration = Duration.hours(1)) {
      const expires = (yield* Clock.currentTimeMillis) + Duration.toMillis(expiresIn);
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
  };
  return service;
});

// --- Local Filesystem Implementation ---

/**
 * Local filesystem security boundary.
 *
 * Caller-controlled keys are validated and resolved against a pinned canonical
 * root before each adapter operation. Traversal, absolute keys, stable symlink
 * escapes, and root or prefix replacement that resolves outside the pinned
 * boundary fail closed.
 *
 * This portable path-based adapter does not defend against another principal
 * renaming path components between resolution and use. Deployments must ensure
 * that untrusted principals cannot mutate the configured root's parent entry or
 * any directory beneath the root while an operation is running.
 */
const makeLocalStore = Effect.fn("makeLocalStore")(function* (config: StorageConfigValue) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const mutationGate = yield* Semaphore.make(1);
  const generationTokens = MutableHashMap.empty<string, string>();
  let generationSequence = 0;
  const assignGeneration = (key: string, content: string): void => {
    generationSequence += 1;
    MutableHashMap.set(generationTokens, key, `local-${generationSequence}-${sha256SyncFull(content)}`);
  };
  const generationFromSnapshot = (content: string, stat: FileSystem.File.Info): string =>
    sha256SyncFull(
      `${content}:${stat.dev}:${O.getOrElse(stat.ino, () => 0)}:${O.match(stat.mtime, {
        onNone: () => "missing",
        onSome: (mtime) => `${DateTime.toEpochMillis(DateTime.fromDateUnsafe(mtime))}`,
      })}:${stat.size}`
    );
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
  const localKvError = (method: string, key: string) => (cause: unknown) =>
    new KeyValueStore.KeyValueStoreError({
      method,
      key,
      message: Inspectable.toStringUnknown(cause),
      cause,
    });
  const localPathError = (method: string, key: string) => (cause: PathSafetyError | SystemError) =>
    new SystemError({
      _tag: "InvalidData",
      module: "KeyValueStore",
      method,
      pathOrDescriptor: key,
      description: cause.message,
    });
  const validateKey = Effect.fnUntraced(function* (key: string) {
    if (path.isAbsolute(key) || !isLocalStorageKey(key)) {
      return yield* new SystemError({
        _tag: "InvalidData",
        module: "KeyValueStore",
        method: "resolvePath",
        pathOrDescriptor: key,
        description: 'Local storage keys must be non-empty, relative, and contain no "." or ".." path segments.',
      });
    }
  });
  const resolvePath = Effect.fnUntraced(function* (key: string) {
    yield* validateKey(key);
    return yield* resolveContainedPath(key);
  });
  const writePath = Effect.fnUntraced(function* (method: string, key: string, bytes: Uint8Array) {
    yield* validateKey(key);
    yield* writeFileWithinCanonicalRootAtomically({
      canonicalRoot,
      candidate: key,
      bytes,
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.catchTag("PathSafetyError", (cause) => Effect.fail(localPathError(method, key)(cause)))
    );
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
    get: Effect.fn("Storage.local.get")(function* (key) {
      return yield* Effect.gen(function* () {
        const resolved = yield* resolvePath(key);
        if (!(yield* fs.exists(resolved))) return undefined;
        return yield* fs.readFileString(resolved);
      }).pipe(Effect.mapError(localKvError("get", key)));
    }),
    getUint8Array: Effect.fn("Storage.local.getUint8Array")(function* (key) {
      return yield* Effect.gen(function* () {
        const resolved = yield* resolvePath(key);
        if (!(yield* fs.exists(resolved))) return undefined;
        return yield* fs.readFile(resolved);
      }).pipe(Effect.mapError(localKvError("getUint8Array", key)));
    }),
    set: Effect.fn("Storage.local.set")(function* (key, value) {
      return yield* mutationGate
        .withPermits(1)(
          Effect.gen(function* () {
            const bytes = P.isString(value) ? new TextEncoder().encode(value) : value;
            yield* writePath("set", key, bytes);
            assignGeneration(key, P.isString(value) ? value : new TextDecoder().decode(value));
          })
        )
        .pipe(Effect.mapError(localKvError("set", key)));
    }),
    remove: Effect.fn("Storage.local.remove")(function* (key) {
      return yield* mutationGate
        .withPermits(1)(
          Effect.gen(function* () {
            const resolved = yield* resolvePath(key);
            if (yield* fs.exists(resolved)) {
              yield* fs.remove(resolved);
              assignGeneration(key, "removed");
            }
          })
        )
        .pipe(Effect.mapError(localKvError("remove", key)));
    }),
    clear: mutationGate
      .withPermits(1)(
        Effect.gen(function* () {
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
        })
      )
      .pipe(Effect.mapError(localKvError("clear", globalPrefix))),
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
    getOption: (key) => impl.get(key).pipe(Effect.map(O.fromUndefinedOr)),
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
      const generation = O.getOrElse(MutableHashMap.get(generationTokens, key), () =>
        generationFromSnapshot(content, stat)
      );
      return O.some({ content, generation });
    }),
    setIfGenerationMatch: Effect.fn("Storage.local.setIfGenerationMatch")(function* (
      key: string,
      value: string,
      expectedGeneration: string
    ) {
      yield* mutationGate.withPermits(1)(
        Effect.gen(function* () {
          const resolved = yield* resolvePath(key).pipe(Effect.mapError(localPathError("setIfGenerationMatch", key)));
          if (!(yield* fs.exists(resolved))) {
            if (!Eq.equals(expectedGeneration, "0")) {
              return yield* GenerationMismatchError.make({
                key,
                expectedGeneration,
                actualGeneration: O.none(),
              });
            }
            yield* writePath("setIfGenerationMatch", key, new TextEncoder().encode(value));
            assignGeneration(key, value);
            return;
          }
          const stat = yield* fs.stat(resolved);
          const content = yield* fs.readFileString(resolved);
          const currentGeneration = O.getOrElse(MutableHashMap.get(generationTokens, key), () =>
            generationFromSnapshot(content, stat)
          );
          if (!Eq.equals(currentGeneration, expectedGeneration)) {
            return yield* GenerationMismatchError.make({
              key,
              expectedGeneration,
              actualGeneration: O.some(currentGeneration),
            });
          }
          yield* writePath("setIfGenerationMatch", key, new TextEncoder().encode(value));
          assignGeneration(key, value);
        })
      );
    }),
    getSignedUrl: (_key: string) => Effect.succeed(O.none()),
    supportsSignedUrls: false,
  } satisfies StorageServiceMethods;
});

// --- In-Memory Implementation ---

const makeMemoryStore = Effect.sync(() => {
  const store = MutableHashMap.empty<string, string | Uint8Array>();
  const generations = MutableHashMap.empty<string, number>();

  const getGeneration = (key: string): string => `${O.getOrElse(MutableHashMap.get(generations, key), () => 0)}`;
  const incrementGeneration = (key: string): void => {
    const current = O.getOrElse(MutableHashMap.get(generations, key), () => 0);
    MutableHashMap.set(generations, key, current + 1);
  };

  const kv = KeyValueStore.make({
    get: (key) =>
      Effect.sync(() => {
        const val = O.getOrUndefined(MutableHashMap.get(store, key));
        if (P.isUndefined(val)) return undefined;
        return P.isString(val) ? val : new TextDecoder().decode(val);
      }),
    getUint8Array: (key) =>
      Effect.sync(() => {
        const val = O.getOrUndefined(MutableHashMap.get(store, key));
        if (P.isUndefined(val)) return undefined;
        return P.isString(val) ? new TextEncoder().encode(val) : val;
      }),
    set: (key, value) =>
      Effect.sync(() => {
        MutableHashMap.set(store, key, value);
        incrementGeneration(key);
      }),
    remove: (key) =>
      Effect.sync(() => {
        MutableHashMap.remove(store, key);
        incrementGeneration(key);
      }),
    clear: Effect.sync(() => {
      for (const key of MutableHashMap.keys(store)) {
        incrementGeneration(key);
      }
      MutableHashMap.clear(store);
    }),
    size: Effect.sync(() => MutableHashMap.size(store)),
  });

  const service: StorageServiceMethods = {
    ...kv,
    getOption: (key) => kv.get(key).pipe(Effect.map(O.fromUndefinedOr)),
    list: (prefix) =>
      Effect.sync(() => store.pipe(MutableHashMap.keys, A.fromIterable, A.filter(Str.startsWith(prefix)))),
    getWithGeneration: (key) =>
      Effect.sync(() => {
        const val = O.getOrUndefined(MutableHashMap.get(store, key));
        if (P.isUndefined(val)) return O.none();
        const content = P.isString(val) ? val : new TextDecoder().decode(val);
        return O.some({ content, generation: getGeneration(key) });
      }),
    setIfGenerationMatch: (key, value, expectedGeneration) =>
      Effect.suspend(() => {
        const currentGeneration = getGeneration(key);
        const hasCurrent = MutableHashMap.has(store, key);
        if (
          (!hasCurrent && !Eq.equals(expectedGeneration, "0")) ||
          (hasCurrent && !Eq.equals(currentGeneration, expectedGeneration))
        ) {
          return Effect.fail(
            GenerationMismatchError.make({
              key,
              expectedGeneration,
              actualGeneration: hasCurrent ? O.some(currentGeneration) : O.none(),
            })
          );
        }
        MutableHashMap.set(store, key, value);
        incrementGeneration(key);
        return Effect.void;
      }),
    // Memory store doesn't support signed URLs
    getSignedUrl: () => Effect.succeed(O.none()),
    supportsSignedUrls: false,
  };
  return service;
});

// --- Layer Definition ---

/**
 * Provides the Effect layer for storage service live dependencies.
 *
 * **Example** (Inspect storage service live)
 *
 * ```ts
 * import { StorageServiceLive } from "@effect-ontology/Service/Storage"
 *
 * console.log(StorageServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
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
 *
 * **Example** (Inspect storage service test)
 *
 * ```ts
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * console.log(StorageServiceTest)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StorageServiceTest = Layer.effect(StorageService, makeMemoryStore);
