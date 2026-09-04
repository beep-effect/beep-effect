/**
 * In-memory implementation of Effect's `FileSystem` service.
 *
 * This module provides an isolated virtual POSIX filesystem for tests and
 * programs that need filesystem behavior without host filesystem I/O. It
 * supports files, directories, links, descriptors, temporary resources, globbing,
 * and file watching through the standard `FileSystem` service.
 *
 * @since 0.0.0
 */
import type * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as internal from "./internal/memoryFileSystem.ts"
import type * as Layer from "effect/Layer"

/**
 * Creates a `FileSystem` service backed by a fresh in-memory volume.
 *
 * **When to use**
 *
 * Use when you need to construct and provide an isolated filesystem explicitly.
 *
 * **Example** (Write and read a file directly)
 *
 * ```ts
 * import * as MemoryFileSystem from "@beep/scratchpad/MemoryFileSystem/MemoryFileSystem"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make
 *   yield* fs.writeFileString("/note.txt", "stored in memory")
 *   return yield* fs.readFileString("/note.txt")
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // stored in memory
 * ```
 *
 * @see {@link layer} for providing the service as a Layer.
 * @category constructors
 * @since 0.0.0
 */
export const make: Effect.Effect<FileSystem.FileSystem> = internal.make

/**
 * Provides an isolated in-memory implementation of `FileSystem.FileSystem`.
 *
 * **When to use**
 *
 * Use when you need an in-memory filesystem as a dependency for a test or program.
 *
 * **Gotchas**
 *
 * Reusing this layer value shares one volume through layer memoization. Construct
 * a new layer or make the layer fresh when each consumer needs an isolated volume.
 *
 * **Example** (Provide a filesystem dependency)
 *
 * ```ts
 * import * as MemoryFileSystem from "@beep/scratchpad/MemoryFileSystem/MemoryFileSystem"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   yield* fs.writeFileString("/result.txt", "provided by the layer")
 *   return yield* fs.readFileString("/result.txt")
 * })
 *
 * Effect.runPromise(Effect.provide(program, MemoryFileSystem.layer)).then(console.log)
 * // provided by the layer
 * ```
 *
 * @see {@link make} for constructing the service directly.
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<FileSystem.FileSystem> = internal.layer
