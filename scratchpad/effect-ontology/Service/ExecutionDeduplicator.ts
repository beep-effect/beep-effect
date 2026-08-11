/**
 * Service: Execution Deduplicator
 *
 * Deduplicates concurrent in-flight requests for the same idempotency key.
 *
 * @since 2.0.0
 * @module Service/ExecutionDeduplicator
 */

import { Clock, Deferred, Effect, HashMap, Option, Ref, Context, Layer } from "effect"
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/ExecutionDeduplicator");

// =============================================================================
// Types
// =============================================================================

export interface ExecutionHandle {
  readonly status: "running" | "completed" | "failed"
  readonly deferred: Deferred.Deferred<KnowledgeGraph, Error>
  readonly startedAt: number
}

// =============================================================================
// Implementation
// =============================================================================

export const makeExecutionDeduplicator = Effect.gen(function*() {
  const map = yield* Ref.make(HashMap.empty<string, ExecutionHandle>())

  return {
    /**
     * Get existing handle or create new one atomically.
     * Uses Ref.modify for atomic check-and-set to prevent race conditions.
     */
    getOrCreate: (key: string) =>
      Effect.gen(function*() {
        // First check if handle exists (atomic read)
        const existing = yield* Ref.get(map).pipe(
          Effect.map((m) => HashMap.get(m, key))
        )

        if (Option.isSome(existing)) {
          yield* Effect.logInfo(`Reusing in-flight execution key=${key}`)
          return { handle: existing.value, isNew: false }
        }

        // Create new handle
        const deferred = yield* Deferred.make<KnowledgeGraph, Error>()
        const now = yield* Clock.currentTimeMillis
        const handle: ExecutionHandle = {
          status: "running",
          deferred,
          startedAt: now
        }

        // Atomic insert - use modify to handle race where another fiber may have inserted
        const result = yield* Ref.modify(map, (m) => {
          const raceExisting = HashMap.get(m, key)
          if (Option.isSome(raceExisting)) {
            // Another fiber beat us - return existing handle
            return [{ handle: raceExisting.value, isNew: false }, m]
          }
          // We won - insert our handle (HashMap.set returns new immutable map)
          return [{ handle, isNew: true }, HashMap.set(m, key, handle)]
        })

        if (result.isNew) {
          yield* Effect.logInfo(`Created new execution key=${key}`)
        } else {
          yield* Effect.logInfo(`Reusing in-flight execution (race) key=${key}`)
        }
        return result
      }),

    /**
     * Mark execution as completed and notify waiters.
     * Updates status atomically in Ref.
     */
    complete: (key: string, result: KnowledgeGraph) =>
      Effect.gen(function*() {
        // Atomically update status and get the handle
        const handle = yield* Ref.modify(map, (m) => {
          const existing = HashMap.get(m, key)
          if (Option.isNone(existing)) return [Option.none<ExecutionHandle>(), m]

          // Immutable update with HashMap.set
          const updated: ExecutionHandle = { ...existing.value, status: "completed" }
          return [Option.some(updated), HashMap.set(m, key, updated)]
        })

        // Notify waiters outside of Ref.modify (Deferred operations are safe)
        if (Option.isSome(handle)) {
          yield* Deferred.succeed(handle.value.deferred, result)
          yield* Effect.logInfo(`Execution completed key=${key}`)
        }
      }),

    /**
     * Mark execution as failed and notify waiters.
     * Updates status atomically in Ref.
     */
    fail: (key: string, error: Error) =>
      Effect.gen(function*() {
        // Atomically update status and get the handle
        const handle = yield* Ref.modify(map, (m) => {
          const existing = HashMap.get(m, key)
          if (Option.isNone(existing)) return [Option.none<ExecutionHandle>(), m]

          // Immutable update with HashMap.set
          const updated: ExecutionHandle = { ...existing.value, status: "failed" }
          return [Option.some(updated), HashMap.set(m, key, updated)]
        })

        // Notify waiters outside of Ref.modify
        if (Option.isSome(handle)) {
          yield* Deferred.fail(handle.value.deferred, error)
          yield* Effect.logInfo(`Execution failed key=${key} error=${error.message}`)
        }
      }),

    /**
     * Remove handle from registry.
     */
    cleanup: (key: string) =>
      Effect.gen(function*() {
        yield* Ref.update(map, (m) => HashMap.remove(m, key))
        yield* Effect.logDebug(`Cleaned up execution handle key=${key}`)
      })
  }
})

export class ExecutionDeduplicator extends Context.Service<ExecutionDeduplicator>()(
  $I`ExecutionDeduplicator`,
  {
    make: makeExecutionDeduplicator,
  }
) {
    static readonly Default = Layer.effect(this, this.make);
}

export const ExecutionDeduplicatorLive = ExecutionDeduplicator.Default
