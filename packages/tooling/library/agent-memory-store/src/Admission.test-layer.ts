/**
 * In-memory admission test layer.
 *
 * **Details**
 *
 * Each build of {@link makeAdmissionTestLayer} opens a fresh private
 * `":memory:"` SQLite database through `@beep/sqlite` and provides admission
 * together with the memory log it writes, so every test that provides it gets
 * an isolated store and can read the log admission wrote.
 *
 * **Gotchas**
 *
 * The driver imports `bun:sqlite`: building this layer outside Bun fails with
 * a `MemoryLogError` whose operation is `"loadDriver"`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Layer from "effect/Layer";
import { makeAdmissionLayer } from "./Admission.layer.ts";
import { MemoryLogLayer, makeMemorySqlClientLayer } from "./MemoryLog.layer.ts";
import type { Admission } from "./Admission.service.ts";
import type { MemoryLogError } from "./AgentMemoryStore.errors.ts";
import type { MemoryLog } from "./MemoryLog.service.ts";
import type { StatusFields } from "./StatusField.models.ts";

/**
 * Admission and the memory log over a fresh in-memory SQLite database per
 * build.
 *
 * **Example** (Build an isolated admission store)
 *
 * ```ts
 * import { Admission, makeAdmissionTestLayer, StatusFields } from "@beep/agent-memory-store"
 * import * as Context from "effect/Context"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const context = yield* Layer.build(makeAdmissionTestLayer(StatusFields.make({ lifecycles: [] })))
 *   const admission = Context.get(context, Admission)
 *   return yield* admission.held
 * })
 * console.log(program)
 * ```
 *
 * @param statusFields - The status lifecycles admission applies.
 * @returns A layer providing admission and its memory log.
 * @category layers
 * @since 0.0.0
 */
export const makeAdmissionTestLayer = (
  statusFields: StatusFields
): Layer.Layer<Admission | MemoryLog, MemoryLogError> =>
  makeAdmissionLayer(statusFields).pipe(
    Layer.provideMerge(MemoryLogLayer),
    Layer.provide(makeMemorySqlClientLayer({ filename: ":memory:" }))
  );
