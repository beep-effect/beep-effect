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
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Storage } from "@google-cloud/storage";
import {
  Clock,
  Context,
  Duration,
  Effect,
  FileSystem,
  Inspectable,
  Layer,
  Match,
  MutableHashMap,
  Path,
  Schedule,
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
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlError from "effect/unstable/sql/SqlError";
import { sha256SyncFull } from "../Utils/Hash.ts";
import { ConfigService } from "./Config.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Storage");

const localStorageAbsoluteKeyPattern = /^(?:[\\/]|[A-Za-z]:[\\/])/u;
const localStorageDotSegmentPattern = /(?:^|[\\/])\.{1,2}(?:[\\/]|$)/u;
const localStorageMetadataDirectoryName = ".effect-ontology-storage";
const localStorageMetadataSegmentPattern = /(?:^|[\\/])\.effect-ontology-storage(?:[\\/]|$)/u;
const localStorageMutationDatabaseName = "mutation.sqlite";
const localStorageMutationRetryDelay = Duration.millis(5);
const localStorageMutationRetryAttempts = 200;

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
      S.makeFilter((value: string) => !localStorageMetadataSegmentPattern.test(value), {
        identifier: $I`LocalStorageKeyMetadataCheck`,
        title: "Local Storage Key Is Outside Metadata Namespace",
        description: "A local storage key that does not use the storage service's reserved metadata directory.",
        message: `Local storage key must not contain the reserved "${localStorageMetadataDirectoryName}" segment.`,
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

const LocalGenerationRecord = S.TaggedUnion({
  Present: {
    generation: Sha256Hex,
    contentHash: Sha256Hex,
  },
  Absent: {
    generation: Sha256Hex,
  },
}).pipe(
  $I.annoteSchema("LocalGenerationRecord", {
    description: "Durable generation authority for a present or deleted local storage object.",
  })
);

const LocalGenerationRecordJson = S.fromJsonString(LocalGenerationRecord).pipe(
  $I.annoteSchema("LocalGenerationRecordJson", {
    description: "JSON representation persisted for a local storage generation record.",
  })
);
const decodeLocalGenerationRecord = S.decodeEffect(LocalGenerationRecordJson);
const encodeLocalGenerationRecord = S.encodeEffect(LocalGenerationRecordJson);
type LocalGenerationRecord = typeof LocalGenerationRecord.Type;

const isLocalStorageKey = S.is(LocalStorageKey);

/**
 * Result of getWithGeneration - includes content and version for optimistic locking
 *
 * **Example** (Read content with a generation)
 *
 * ```ts
 * import { ObjectWithGeneration } from "@effect-ontology/Service/Storage"
 *
 * const object = ObjectWithGeneration.make({
 *   content: "Ada founded Acme.",
 *   generation: "1"
 * })
 * console.log(object.generation) // "1"
 * ```
 *
 * @category models
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
 * **Example** (Construct a generation mismatch)
 *
 * ```ts
 * import { GenerationMismatchError } from "@effect-ontology/Service/Storage"
 * import * as O from "effect/Option"
 *
 * const error = GenerationMismatchError.make({
 *   key: "docs/ada.txt",
 *   expectedGeneration: "1",
 *   actualGeneration: O.some("2")
 * })
 * console.log(error._tag) // "GenerationMismatchError"
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
 * **Details**
 *
 * This extends Effect's live `KeyValueStore` protocol with executable storage
 * operations, so it cannot be represented as a data schema.
 *
 * @category services
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
 * **Example** (Put and get a document)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { StorageService, StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const text = Effect.runSync(
 *   Effect.gen(function* () {
 *     const storage = yield* StorageService
 *     yield* storage.set("docs/ada.txt", "Ada founded Acme.")
 *     return yield* storage.getOption("docs/ada.txt")
 *   }).pipe(Effect.provide(StorageServiceTest), Effect.orDie)
 * )
 * console.log(O.getOrElse(text, () => "")) // "Ada founded Acme."
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
 * **Example** (Select the memory backend)
 *
 * ```ts
 * import type { StorageConfigValue } from "@effect-ontology/Service/Storage"
 *
 * const config: StorageConfigValue = { type: "memory" }
 * console.log(config.type) // "memory"
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
 * **Example** (Configure in-memory storage)
 *
 * ```ts
 * import { StorageConfigValue } from "@effect-ontology/Service/Storage"
 *
 * const config = StorageConfigValue.make({ type: "memory" })
 * console.log(config.type) // "memory"
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
 * **Example** (Provide storage config)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { StorageConfig, StorageConfigValue } from "@effect-ontology/Service/Storage"
 *
 * const type = Effect.runSync(
 *   Effect.gen(function* () {
 *     const config = yield* StorageConfig
 *     return config.type
 *   }).pipe(Effect.provide(Layer.succeed(StorageConfig, StorageConfigValue.make({ type: "memory" }))))
 * )
 * console.log(type) // "memory"
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

const prepareLocalStore = Effect.fn("Storage.prepareLocalStore")(function* (config: StorageConfigValue) {
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
  const metadataDirectory = yield* resolvePathWithinCanonicalRoot({
    canonicalRoot,
    candidate: localStorageMetadataDirectoryName,
  });
  yield* fs.makeDirectory(metadataDirectory, { recursive: true, mode: 0o700 });
  const databasePath = yield* resolvePathWithinCanonicalRoot({
    canonicalRoot,
    candidate: path.join(localStorageMetadataDirectoryName, localStorageMutationDatabaseName),
  });
  return { canonicalRoot, databasePath };
});

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
const makeLocalStore = Effect.fn("makeLocalStore")(function* (config: StorageConfigValue, canonicalRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const globalPrefix = config.pathPrefix ?? "";
  const sql = yield* SqlClient.SqlClient;
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
  const generationDirectory = yield* resolveContainedPath(path.join(localStorageMetadataDirectoryName, "generations"));
  yield* fs.makeDirectory(generationDirectory, { recursive: true, mode: 0o700 });

  const metadataDecodeError = (key: string, cause: unknown) =>
    new SystemError({
      _tag: "InvalidData",
      module: "KeyValueStore",
      method: "readGenerationRecord",
      pathOrDescriptor: key,
      description: Inspectable.toStringUnknown(cause),
      cause,
    });
  const transactionError = (method: string, pathOrDescriptor: string, cause: SqlError.SqlError) =>
    new SystemError({
      _tag: P.isTagged(cause.reason, "LockTimeoutError") ? "Busy" : "Unknown",
      module: "KeyValueStore",
      method,
      pathOrDescriptor,
      description: cause.message,
      cause,
    });
  const isSqlLockTimeout = (cause: unknown): cause is SqlError.SqlError =>
    SqlError.isSqlError(cause) && P.isTagged(cause.reason, "LockTimeoutError");
  const withMutationTransaction = Effect.fnUntraced(function* <A, E, R>(
    method: string,
    pathOrDescriptor: string,
    effect: Effect.Effect<A, E, R>
  ): Effect.fn.Return<A, E | SystemError, R> {
    return yield* sql.withTransaction(effect).pipe(
      Effect.retry({
        while: isSqlLockTimeout,
        schedule: Schedule.spaced(localStorageMutationRetryDelay),
        times: localStorageMutationRetryAttempts,
      }),
      Effect.catchIf(SqlError.isSqlError, (cause) => Effect.fail(transactionError(method, pathOrDescriptor, cause)))
    );
  });
  const generationRecordCandidate = Effect.fnUntraced(function* (key: string) {
    const resolved = yield* resolvePath(key).pipe(Effect.mapError(localPathError("generationRecordCandidate", key)));
    const storageIdentity = path.relative(canonicalRoot, resolved);
    return path.join(localStorageMetadataDirectoryName, "generations", `${sha256SyncFull(storageIdentity)}.json`);
  });
  const readGenerationRecord = Effect.fnUntraced(function* (key: string) {
    const candidate = yield* generationRecordCandidate(key);
    const resolved = yield* resolveContainedPath(candidate).pipe(
      Effect.mapError(localPathError("readGenerationRecord", key))
    );
    if (!(yield* fs.exists(resolved))) return O.none<LocalGenerationRecord>();
    const encoded = yield* fs.readFileString(resolved);
    return O.some(
      yield* decodeLocalGenerationRecord(encoded).pipe(Effect.mapError((cause) => metadataDecodeError(key, cause)))
    );
  });
  const writeGenerationRecord = Effect.fnUntraced(function* (key: string, record: LocalGenerationRecord) {
    const candidate = yield* generationRecordCandidate(key);
    const encoded = yield* encodeLocalGenerationRecord(record).pipe(
      Effect.mapError((cause) => metadataDecodeError(key, cause))
    );
    yield* writeFileWithinCanonicalRootAtomically({
      canonicalRoot,
      candidate,
      bytes: new TextEncoder().encode(encoded),
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.catchTag("PathSafetyError", (cause) => Effect.fail(localPathError("writeGenerationRecord", key)(cause)))
    );
  });
  const generationOfRecord = (record: LocalGenerationRecord): string =>
    LocalGenerationRecord.match(record, {
      Present: (present) => present.generation,
      Absent: (absent) => absent.generation,
    });
  const previousGeneration = (record: O.Option<LocalGenerationRecord>): string =>
    O.getOrElse(O.map(record, generationOfRecord), () => "0");
  const makePresentGeneration = (previous: O.Option<LocalGenerationRecord>, content: string): LocalGenerationRecord => {
    const contentHash = Sha256Hex.make(sha256SyncFull(content));
    return LocalGenerationRecord.cases.Present.make({
      contentHash,
      generation: Sha256Hex.make(sha256SyncFull(`${previousGeneration(previous)}:present:${contentHash}`)),
    });
  };
  const makeAbsentGeneration = (previous: O.Option<LocalGenerationRecord>): LocalGenerationRecord =>
    LocalGenerationRecord.cases.Absent.make({
      generation: Sha256Hex.make(sha256SyncFull(`${previousGeneration(previous)}:absent`)),
    });
  const advancePresentGeneration = Effect.fnUntraced(function* (key: string, content: string) {
    const record = makePresentGeneration(yield* readGenerationRecord(key), content);
    yield* writeGenerationRecord(key, record);
    return record;
  });
  const advanceAbsentGeneration = Effect.fnUntraced(function* (key: string) {
    const record = makeAbsentGeneration(yield* readGenerationRecord(key));
    yield* writeGenerationRecord(key, record);
    return record;
  });
  const reconcilePresentGeneration = Effect.fnUntraced(function* (key: string, content: string) {
    const previous = yield* readGenerationRecord(key);
    const contentHash = Sha256Hex.make(sha256SyncFull(content));
    const matching = previous.pipe(
      O.filter(LocalGenerationRecord.guards.Present),
      O.filter((present) => Eq.equals(present.contentHash, contentHash))
    );
    if (O.isSome(matching)) return matching.value;
    const record = makePresentGeneration(previous, content);
    yield* writeGenerationRecord(key, record);
    return record;
  });

  const walkDirRecursive = Effect.fn("Storage.walkDirRecursive")(function* (
    currentDir: string,
    relativePath: string
  ): Effect.fn.Return<Array<string>, PlatformError | SystemError> {
    const entries = yield* fs.readDirectory(currentDir).pipe(Effect.orElseSucceed(() => []));
    const results: Array<string> = [];
    for (const entry of entries) {
      if (Eq.equals(relativePath, "") && Eq.equals(entry, localStorageMetadataDirectoryName)) continue;
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
      return yield* withMutationTransaction(
        "set",
        key,
        Effect.gen(function* () {
          const bytes = P.isString(value) ? new TextEncoder().encode(value) : value;
          const content = P.isString(value) ? value : new TextDecoder().decode(value);
          yield* writePath("set", key, bytes);
          yield* advancePresentGeneration(key, content);
        })
      ).pipe(Effect.mapError(localKvError("set", key)));
    }),
    remove: Effect.fn("Storage.local.remove")(function* (key) {
      return yield* withMutationTransaction(
        "remove",
        key,
        Effect.gen(function* () {
          const resolved = yield* resolvePath(key);
          if (yield* fs.exists(resolved)) {
            yield* fs.remove(resolved);
            yield* advanceAbsentGeneration(key);
          }
        })
      ).pipe(Effect.mapError(localKvError("remove", key)));
    }),
    clear: withMutationTransaction(
      "clear",
      globalPrefix,
      Effect.gen(function* () {
        const checkedRoot = yield* resolveContainedPath(".");
        if (!(yield* fs.exists(checkedRoot))) {
          yield* fs.makeDirectory(checkedRoot, { recursive: true });
          return;
        }
        const files = yield* walkDirRecursive(checkedRoot, "");
        for (const file of files) {
          yield* fs.remove(yield* resolvePath(file));
          yield* advanceAbsentGeneration(file);
        }
        const entries = yield* fs.readDirectory(checkedRoot);
        for (const entry of entries) {
          if (Eq.equals(entry, localStorageMetadataDirectoryName)) continue;
          const entryPath = path.join(checkedRoot, entry);
          const checkedEntry = yield* resolveContainedPath(entryPath);
          yield* fs.remove(checkedEntry, { recursive: true });
        }
      })
    ).pipe(Effect.mapError(localKvError("clear", globalPrefix))),
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
      return yield* withMutationTransaction(
        "getWithGeneration",
        key,
        Effect.gen(function* () {
          const resolved = yield* resolvePath(key).pipe(Effect.mapError(localPathError("getWithGeneration", key)));
          if (!(yield* fs.exists(resolved))) return O.none();
          const content = yield* fs.readFileString(resolved);
          const record = yield* reconcilePresentGeneration(key, content);
          return O.some({ content, generation: record.generation });
        })
      );
    }),
    setIfGenerationMatch: Effect.fn("Storage.local.setIfGenerationMatch")(function* (
      key: string,
      value: string,
      expectedGeneration: string
    ) {
      yield* withMutationTransaction(
        "setIfGenerationMatch",
        key,
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
            yield* advancePresentGeneration(key, value);
            return;
          }
          const content = yield* fs.readFileString(resolved);
          const currentGeneration = (yield* reconcilePresentGeneration(key, content)).generation;
          if (!Eq.equals(currentGeneration, expectedGeneration)) {
            return yield* GenerationMismatchError.make({
              key,
              expectedGeneration,
              actualGeneration: O.some(currentGeneration),
            });
          }
          yield* writePath("setIfGenerationMatch", key, new TextEncoder().encode(value));
          yield* advancePresentGeneration(key, value);
        })
      );
    }),
    getSignedUrl: (_key: string) => Effect.succeedNone,
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
    getSignedUrl: () => Effect.succeedNone,
    supportsSignedUrls: false,
  };
  return service;
});

// --- Layer Definition ---

const makeLocalStorageServiceLayer = (config: StorageConfigValue) =>
  Layer.unwrap(
    prepareLocalStore(config).pipe(
      Effect.map(({ canonicalRoot, databasePath }) =>
        Layer.effect(StorageService, makeLocalStore(config, canonicalRoot)).pipe(
          Layer.provide(
            SqliteClient.layer({
              filename: databasePath,
              busyTimeout: Duration.zero,
            })
          )
        )
      )
    )
  );

/**
 * Provides the Effect layer for storage service live dependencies.
 *
 * **Example** (Compose get against the live layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ConfigServiceDefault } from "@effect-ontology/Service/Config"
 * import { StorageService, StorageServiceLive } from "@effect-ontology/Service/Storage"
 *
 * const program = Effect.gen(function* () {
 *   const storage = yield* StorageService
 *   return yield* storage.getOption("docs/ada.txt")
 * }).pipe(Effect.provide(StorageServiceLive), Effect.provide(ConfigServiceDefault))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StorageServiceLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const { bucket, localPath, prefix, type } = config.storage;

    // Adapter for internal storage config
    const storageConfig = StorageConfigValue.make({
      type,
      ...(O.isSome(bucket) ? { bucketName: bucket.value } : {}),
      ...(O.isSome(localPath) ? { localPath: localPath.value } : {}),
      pathPrefix: prefix,
    });

    return StorageBackend.$match(type, {
      gcs: () => Layer.effect(StorageService, makeGcsStore(storageConfig)),
      local: () => makeLocalStorageServiceLayer(storageConfig),
      memory: () => Layer.effect(StorageService, makeMemoryStore),
    });
  })
);

/**
 * In-memory storage layer for testing
 * Does not require ConfigService
 *
 * **Example** (Round-trip a document in memory)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { StorageService, StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const text = Effect.runSync(
 *   Effect.gen(function* () {
 *     const storage = yield* StorageService
 *     yield* storage.set("docs/ada.txt", "Ada founded Acme.")
 *     return yield* storage.getOption("docs/ada.txt")
 *   }).pipe(Effect.provide(StorageServiceTest), Effect.orDie)
 * )
 * console.log(O.getOrElse(text, () => "")) // "Ada founded Acme."
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StorageServiceTest = Layer.effect(StorageService, makeMemoryStore);
