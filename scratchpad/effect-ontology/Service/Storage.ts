import { FileSystem, Path } from "effect"
import { KeyValueStore } from "effect/unstable/persistence"
import { SystemError } from "effect/PlatformError"
import { Storage } from "@google-cloud/storage"
import { Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "./Config.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/Storage");

/**
 * Result of getWithGeneration - includes content and version for optimistic locking
 */
export interface ObjectWithGeneration {
  readonly content: string
  readonly generation: string
}

/**
 * Error thrown when setIfGenerationMatch fails due to concurrent modification
 */
export class GenerationMismatchError extends Error {
  readonly _tag = "GenerationMismatchError" as const
  readonly key: string
  readonly expectedGeneration: string
  readonly actualGeneration: string | undefined
  constructor(key: string, expectedGeneration: string, actualGeneration?: string) {
    super(
      `Generation mismatch for ${key}: expected ${expectedGeneration}${
        actualGeneration ? `, got ${actualGeneration}` : ""
      }`
    )
    this.key = key
    this.expectedGeneration = expectedGeneration
    this.actualGeneration = actualGeneration
    this.name = "GenerationMismatchError"
  }
}

/**
 * StorageService interface extending KeyValueStore
 * Adds `list` capability and optimistic locking for concurrent writes
 */
export interface StorageService extends KeyValueStore.KeyValueStore {
  readonly list: (prefix: string) => Effect.Effect<Array<string>, SystemError>

  /**
   * Get an object along with its generation for optimistic locking
   * @returns None if object doesn't exist, Some with content and generation if it does
   */
  readonly getWithGeneration: (key: string) => Effect.Effect<Option.Option<ObjectWithGeneration>, SystemError>

  /**
   * Set an object only if its generation matches the expected value
   * @param generation - Expected generation (from previous getWithGeneration)
   * @returns Fails with GenerationMismatchError if generation doesn't match
   */
  readonly setIfGenerationMatch: (
    key: string,
    value: string,
    generation: string
  ) => Effect.Effect<void, SystemError | GenerationMismatchError>

  /**
   * Get a signed URL for direct access to the object (GCS only)
   * @param key - Object key
   * @param expiresInSeconds - URL expiry time (default: 3600 = 1 hour)
   * @returns Signed URL or None if not supported (e.g., local storage)
   */
  readonly getSignedUrl: (
    key: string,
    expiresInSeconds?: number
  ) => Effect.Effect<Option.Option<string>, SystemError>

  /**
   * Whether this storage backend supports signed URLs
   */
  readonly supportsSignedUrls: boolean
}

export const StorageService = Context.Service<StorageService>($I`StorageService`)

export interface StorageConfig {
  readonly type: "local" | "gcs" | "memory"
  readonly bucketName?: string // Required for GCS
  readonly localPath?: string // Required for Local
  readonly pathPrefix?: string
}

export const StorageConfig = Context.Service<StorageConfig>($I`StorageConfig`)

// --- GCS Implementation ---

const makeGcsStore = (config: StorageConfig) =>
  Effect.gen(function*() {
    if (!config.bucketName) {
      return yield* Effect.fail(new Error("bucketName is required for GCS storage"))
    }

    // Log GCS client creation (it doesn't have explicit close)
    yield* Effect.logDebug("Creating GCS Storage client", { bucket: config.bucketName })

    const storage = new Storage()
    const bucket = storage.bucket(config.bucketName)
    const prefix = config.pathPrefix ?? ""

    const toPath = (key: string) => `${prefix}/${key}`.replace(/\/+/g, "/").replace(/^\//, "")

    const handleError = (method: string, key: string, cause: unknown) => {
      let reason: SystemError["reason"] = "Unknown"
      let message: string

      // Handle different error types
      if (cause instanceof Error) {
        message = cause.message
      } else if (typeof cause === "object" && cause !== null) {
        // GCS errors may be plain objects with message/errors properties
        const obj = cause as Record<string, unknown>
        if (typeof obj.message === "string") {
          message = obj.message
        } else if (Array.isArray(obj.errors)) {
          // GCS batch errors have an errors array
          message = obj.errors.map((e: unknown) =>
            typeof e === "object" && e !== null && "message" in e
              ? String((e as { message: unknown }).message)
              : String(e)
          ).join("; ")
        } else {
          message = JSON.stringify(cause)
        }
      } else {
        message = String(cause)
      }

      if (cause instanceof Error) {
        // Use type guard to safely access .code property (GCS errors have numeric HTTP status codes)
        const code = "code" in cause && typeof (cause as { code?: unknown }).code === "number"
          ? (cause as { code: number }).code
          : undefined
        if (code !== undefined) {
          switch (code) {
            case 404:
              reason = "NotFound"
              break
            case 403:
              reason = "PermissionDenied"
              break
            case 409:
              reason = "AlreadyExists"
              break
            case 400:
              reason = "InvalidData"
              break
            case 408:
            case 503:
            case 504:
              reason = "Busy"
              break
          }
        }
      }

      return new SystemError({
        module: "KeyValueStore",
        method,
        reason,
        pathOrDescriptor: key,
        description: message
      })
    }

    const impl = KeyValueStore.make({
      get: (key) =>
        Effect.tryPromise({
          try: async () => {
            const file = bucket.file(toPath(key))
            const [exists] = await file.exists()
            if (!exists) return Option.none()
            const [content] = await file.download()
            return Option.some(content.toString("utf-8"))
          },
          catch: (e) => handleError("get", key, e)
        }),
      getUint8Array: (key) =>
        Effect.tryPromise({
          try: async () => {
            const file = bucket.file(toPath(key))
            const [exists] = await file.exists()
            if (!exists) return Option.none()
            const [content] = await file.download()
            return Option.some(new Uint8Array(content))
          },
          catch: (e) => handleError("getUint8Array", key, e)
        }),
      set: (key, value) =>
        Effect.tryPromise({
          try: async () => {
            const content = typeof value === "string" ? value : Buffer.from(value)
            await bucket.file(toPath(key)).save(content)
          },
          catch: (e) => handleError("set", key, e)
        }),
      remove: (key) =>
        Effect.tryPromise({
          try: async () => {
            const file = bucket.file(toPath(key))
            const [exists] = await file.exists()
            if (exists) await file.delete()
          },
          catch: (e) => handleError("remove", key, e)
        }),
      clear: Effect.tryPromise({
        try: async () => await bucket.deleteFiles({ prefix: prefix || undefined }),
        catch: (e) => handleError("clear", prefix, e)
      }),
      size: Effect.tryPromise({
        try: async () => {
          const [files] = await bucket.getFiles({ prefix: prefix || undefined })
          return files.length
        },
        catch: (e) => handleError("size", prefix, e)
      })
    })

    return {
      ...impl,
      list: (listPrefix) =>
        Effect.tryPromise({
          try: async () => {
            const fullPrefix = toPath(listPrefix)
            const [files] = await bucket.getFiles({ prefix: fullPrefix })
            return files.map((f) => f.name.replace(prefix ? prefix + "/" : "", ""))
          },
          catch: (e) => handleError("list", listPrefix, e)
        }),
      getWithGeneration: (key) =>
        Effect.tryPromise({
          try: async () => {
            const file = bucket.file(toPath(key))
            const [exists] = await file.exists()
            if (!exists) return Option.none()

            // Get file content and metadata in parallel
            const [[content], [metadata]] = await Promise.all([
              file.download(),
              file.getMetadata()
            ])

            // GCS generation is a numeric string that increments on each write
            const generation = String(metadata.generation)
            return Option.some({
              content: content.toString("utf-8"),
              generation
            })
          },
          catch: (e) => handleError("getWithGeneration", key, e)
        }),
      setIfGenerationMatch: (key, value, expectedGeneration) =>
        Effect.tryPromise({
          try: async () => {
            const file = bucket.file(toPath(key))
            await file.save(value, {
              preconditionOpts: {
                ifGenerationMatch: Number(expectedGeneration)
              }
            })
          },
          catch: (e) => {
            // Check if this is a precondition failed error (HTTP 412)
            if (e instanceof Error && "code" in e && (e as { code?: number }).code === 412) {
              return new GenerationMismatchError(key, expectedGeneration)
            }
            return handleError("setIfGenerationMatch", key, e)
          }
        }),
      getSignedUrl: (key, expiresInSeconds = 3600) =>
        Effect.tryPromise({
          try: async () => {
            const file = bucket.file(toPath(key))
            const [exists] = await file.exists()
            if (!exists) return Option.none()

            const [signedUrl] = await file.getSignedUrl({
              version: "v4",
              action: "read",
              expires: Date.now() + expiresInSeconds * 1000
            })
            return Option.some(signedUrl)
          },
          catch: (e) => handleError("getSignedUrl", key, e)
        }),
      supportsSignedUrls: true
    } as StorageService
  })

// --- Local Filesystem Implementation ---

const makeLocalStore = (config: StorageConfig) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const basePath = config.localPath ?? "./output"
    const globalPrefix = config.pathPrefix ?? ""

    // If key is absolute path, use it directly; otherwise join with basePath
    const resolvePath = (key: string) => key.startsWith("/") ? key : path.join(basePath, globalPrefix, key)

    const ensureDir = (filePath: string) => fs.makeDirectory(path.dirname(filePath), { recursive: true })

    const impl = KeyValueStore.make({
      get: (key) =>
        Effect.gen(function*() {
          const p = resolvePath(key)
          const exists = yield* fs.exists(p)
          if (!exists) return Option.none()
          return Option.some(yield* fs.readFileString(p))
        }),
      getUint8Array: (key) =>
        Effect.gen(function*() {
          const p = resolvePath(key)
          const exists = yield* fs.exists(p)
          if (!exists) return Option.none()
          return Option.some(yield* fs.readFile(p))
        }),
      set: (key, value) =>
        Effect.gen(function*() {
          const p = resolvePath(key)
          yield* ensureDir(p)
          if (typeof value === "string") {
            yield* fs.writeFileString(p, value)
          } else {
            yield* fs.writeFile(p, value)
          }
        }),
      remove: (key) =>
        Effect.gen(function*() {
          const p = resolvePath(key)
          if (yield* fs.exists(p)) {
            yield* fs.remove(p)
          }
        }),
      clear: Effect.gen(function*() {
        const p = path.join(basePath, globalPrefix)
        if (yield* fs.exists(p)) {
          yield* fs.remove(p, { recursive: true })
          yield* fs.makeDirectory(p, { recursive: true })
        }
      }),
      size: Effect.gen(function*() {
        const p = path.join(basePath, globalPrefix)
        if (!(yield* fs.exists(p))) return 0
        // Calculate total size by walking directory tree
        const walkAndSum = (dir: string): Effect.Effect<number, never, never> =>
          Effect.gen(function*() {
            const entries = yield* fs.readDirectory(dir).pipe(
              Effect.catch(() => Effect.succeed([] as ReadonlyArray<string>))
            )
            let totalSize = 0
            for (const entry of entries) {
              const entryPath = path.join(dir, entry)
              const stat = yield* fs.stat(entryPath).pipe(Effect.catch(() => Effect.succeed(null)))
              if (stat === null) continue
              if (stat.type === "Directory") {
                totalSize += yield* walkAndSum(entryPath)
              } else {
                // stat.size is a Size type (number), use Number() to ensure plain number
                totalSize += Number(stat.size)
              }
            }
            return totalSize
          })
        return yield* walkAndSum(p)
      })
    })

    // Recursive walk helper for list() - defined outside to avoid closure issues
    const walkDirRecursive = (
      currentDir: string,
      relativePath: string
    ): Effect.Effect<Array<string>> =>
      Effect.gen(function*() {
        const entries = yield* fs.readDirectory(currentDir).pipe(
          Effect.catch(() => Effect.succeed([] as ReadonlyArray<string>))
        )
        const results: Array<string> = []

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry)
          const entryRelativePath = relativePath ? `${relativePath}/${entry}` : entry
          const stat = yield* fs.stat(fullPath).pipe(Effect.orElseSucceed(() => null))

          if (stat === null) continue

          if (stat.type === "Directory") {
            const subResults = yield* walkDirRecursive(fullPath, entryRelativePath)
            for (const r of subResults) results.push(r)
          } else {
            results.push(entryRelativePath)
          }
        }
        return results
      })

    return {
      ...impl,
      // Recursive list to match GCS behavior - returns full relative paths
      list: (prefix) =>
        Effect.gen(function*() {
          const dir = path.join(basePath, globalPrefix, prefix)
          if (!(yield* fs.exists(dir))) return []
          return yield* walkDirRecursive(dir, "")
        }),
      getWithGeneration: (key) =>
        Effect.gen(function*() {
          const p = resolvePath(key)
          const exists = yield* fs.exists(p)
          if (!exists) return Option.none()

          const content = yield* fs.readFileString(p)
          const stat = yield* fs.stat(p)
          // Use mtime as generation for local filesystem
          // stat.mtime is Option<Date>, fallback to current time if None
          const mtime = Option.getOrElse(stat.mtime, () => new Date())
          const generation = String(mtime.getTime())
          return Option.some({ content, generation })
        }),
      setIfGenerationMatch: (key, value, expectedGeneration) =>
        Effect.gen(function*() {
          const p = resolvePath(key)
          const exists = yield* fs.exists(p)

          if (exists) {
            const stat = yield* fs.stat(p)
            // stat.mtime is Option<Date>, fallback to current time if None
            const mtime = Option.getOrElse(stat.mtime, () => new Date())
            const currentGeneration = String(mtime.getTime())
            if (currentGeneration !== expectedGeneration) {
              return yield* Effect.fail(
                new GenerationMismatchError(key, expectedGeneration, currentGeneration)
              )
            }
          }

          yield* ensureDir(p)
          yield* fs.writeFileString(p, value)
        }),
      // Local filesystem doesn't support signed URLs
      getSignedUrl: () => Effect.succeed(Option.none()),
      supportsSignedUrls: false
    } as StorageService
  })

// --- In-Memory Implementation ---

const makeMemoryStore = Effect.sync(() => {
  const store = new Map<string, string | Uint8Array>()
  const generations = new Map<string, number>()

  const getGeneration = (key: string): string => String(generations.get(key) ?? 0)
  const incrementGeneration = (key: string): void => {
    const current = generations.get(key) ?? 0
    generations.set(key, current + 1)
  }

  const kv = KeyValueStore.make({
    get: (key) =>
      Effect.sync(() => {
        const val = store.get(key)
        if (!val) return Option.none()
        return typeof val === "string" ? Option.some(val) : Option.some(new TextDecoder().decode(val))
      }),
    getUint8Array: (key) =>
      Effect.sync(() => {
        const val = store.get(key)
        if (!val) return Option.none()
        return typeof val === "string" ? Option.some(new TextEncoder().encode(val)) : Option.some(val)
      }),
    set: (key, value) =>
      Effect.sync(() => {
        store.set(key, value)
        incrementGeneration(key)
      }),
    remove: (key) =>
      Effect.sync(() => {
        store.delete(key)
        generations.delete(key)
      }),
    clear: Effect.sync(() => {
      store.clear()
      generations.clear()
    }),
    size: Effect.sync(() => store.size)
  })

  return {
    ...kv,
    list: (prefix) => Effect.sync(() => Array.from(store.keys()).filter((k) => k.startsWith(prefix))),
    getWithGeneration: (key) =>
      Effect.sync(() => {
        const val = store.get(key)
        if (!val) return Option.none()
        const content = typeof val === "string" ? val : new TextDecoder().decode(val)
        return Option.some({ content, generation: getGeneration(key) })
      }),
    setIfGenerationMatch: (key, value, expectedGeneration) =>
      Effect.suspend(() => {
        const currentGeneration = getGeneration(key)
        if (store.has(key) && currentGeneration !== expectedGeneration) {
          return Effect.fail(new GenerationMismatchError(key, expectedGeneration, currentGeneration))
        }
        store.set(key, value)
        incrementGeneration(key)
        return Effect.void
      }),
    // Memory store doesn't support signed URLs
    getSignedUrl: () => Effect.succeed(Option.none()),
    supportsSignedUrls: false
  } as StorageService
})

// --- Layer Definition ---

export const StorageServiceLive = Layer.effect(
  StorageService,
  Effect.gen(function*() {
    const config = yield* ConfigService
    const { bucket, localPath, prefix, type } = config.storage

    // Adapter for internal storage config
    const storageConfig: StorageConfig = {
      type,
      bucketName: Option.getOrUndefined(bucket),
      localPath: Option.getOrUndefined(localPath),
      pathPrefix: prefix
    }

    if (type === "gcs") {
      return yield* makeGcsStore(storageConfig)
    } else if (type === "local") {
      return yield* makeLocalStore(storageConfig)
    } else {
      return yield* makeMemoryStore
    }
  })
)

/**
 * In-memory storage layer for testing
 * Does not require ConfigService
 */
export const StorageServiceTest = Layer.effect(StorageService, makeMemoryStore)
