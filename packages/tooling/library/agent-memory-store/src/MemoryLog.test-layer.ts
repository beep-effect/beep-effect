/**
 * In-memory memory log test layer.
 *
 * **Details**
 *
 * Each build of {@link MemoryLogTestLayer} opens a fresh private `":memory:"`
 * SQLite database through `@beep/sqlite`, so every test that provides it gets
 * an isolated log. Tests that need a database file use
 * {@link makeMemoryLogSqliteLayer} with a temporary filename.
 *
 * **Gotchas**
 *
 * The driver imports `bun:sqlite`: building this layer outside Bun fails with
 * a `MemoryLogError` whose operation is `"loadDriver"`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeMemoryLogSqliteLayer } from "./MemoryLog.layer.ts";
import type * as Layer from "effect/Layer";
import type { MemoryLogError } from "./AgentMemoryStore.errors.ts";
import type { MemoryLog } from "./MemoryLog.service.ts";

/**
 * Memory log over a fresh in-memory SQLite database per build.
 *
 * **Example** (Build an isolated test log)
 *
 * ```ts
 * import { MemoryLog, MemoryLogTestLayer } from "@beep/agent-memory-store"
 * import * as Context from "effect/Context"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const context = yield* Layer.build(MemoryLogTestLayer)
 *   const log = Context.get(context, MemoryLog)
 *   return yield* log.cursor
 * })
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MemoryLogTestLayer: Layer.Layer<MemoryLog, MemoryLogError> = makeMemoryLogSqliteLayer({
  filename: ":memory:",
});
