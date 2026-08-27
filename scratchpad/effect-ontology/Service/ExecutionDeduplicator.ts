/**
 * Service: Execution Deduplicator
 *
 * **Details**
 *
 * Deduplicates concurrent in-flight requests for the same idempotency key.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, Deferred, Effect, HashMap, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ExecutionDeduplicator");

/**
 * Failure of a deduplicated in-flight execution.
 *
 * **Example** (Construct an execution failure)
 *
 * ```ts
 * import { ExecutionFailure } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * const error = ExecutionFailure.make({
 *   message: "Extractor timed out"
 * })
 * console.log(error._tag) // "ExecutionFailure"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExecutionFailure extends S.TaggedError<ExecutionFailure>($I`ExecutionFailure`)(
  "ExecutionFailure",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable execution failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying execution defect.",
    }),
  },
  $I.annote("ExecutionFailure", {
    description: "Failure of a deduplicated in-flight execution.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Describes the execution handle data exposed by this module.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ExecutionHandle {
  readonly status: "running" | "completed" | "failed";
  readonly deferred: Deferred.Deferred<KnowledgeGraph, ExecutionFailure>;
  readonly startedAt: number;
}

/**
 * Build the in-memory get-or-create map used by {@link ExecutionDeduplicator}.
 *
 * **Example** (Share an in-flight handle)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeExecutionDeduplicator } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * const reused = Effect.runSync(
 *   Effect.gen(function* () {
 *     const dedupe = yield* makeExecutionDeduplicator
 *     yield* dedupe.getOrCreate("extract-ada")
 *     const second = yield* dedupe.getOrCreate("extract-ada")
 *     return second.isNew
 *   })
 * )
 * console.log(reused) // false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeExecutionDeduplicator = Effect.gen(function* () {
  const map = yield* Ref.make(HashMap.empty<string, ExecutionHandle>());

  const getOrCreate = Effect.fn("ExecutionDeduplicator.getOrCreate")(function* (key: string) {
    const existing = yield* Ref.get(map).pipe(Effect.map((handles) => HashMap.get(handles, key)));
    if (O.isSome(existing)) {
      yield* Effect.logInfo(`Reusing in-flight execution key=${key}`);
      return { handle: existing.value, isNew: false };
    }

    const deferred = yield* Deferred.make<KnowledgeGraph, ExecutionFailure>();
    const handle: ExecutionHandle = {
      status: "running",
      deferred,
      startedAt: yield* Clock.currentTimeMillis,
    };
    const result = yield* Ref.modify(
      map,
      (
        handles
      ): readonly [
        { readonly handle: ExecutionHandle; readonly isNew: boolean },
        HashMap.HashMap<string, ExecutionHandle>,
      ] => {
        const raceExisting = HashMap.get(handles, key);
        return O.match(raceExisting, {
          onNone: () => [{ handle, isNew: true }, HashMap.set(handles, key, handle)],
          onSome: (raceHandle) => [{ handle: raceHandle, isNew: false }, handles],
        });
      }
    );
    yield* Effect.logInfo(
      result.isNew ? `Created new execution key=${key}` : `Reusing in-flight execution (race) key=${key}`
    );
    return result;
  });

  const transitionHandle = Effect.fn("ExecutionDeduplicator.transitionHandle")(
    (key: string, status: ExecutionHandle["status"]) =>
      Ref.modify(map, (handles) =>
        O.match(HashMap.get(handles, key), {
          onNone: () => [O.none<ExecutionHandle>(), handles],
          onSome: (existing) => {
            const updated: ExecutionHandle = { ...existing, status };
            return [O.some(updated), HashMap.set(handles, key, updated)];
          },
        })
      )
  );

  const complete = Effect.fn("ExecutionDeduplicator.complete")(function* (key: string, result: KnowledgeGraph) {
    const handle = yield* transitionHandle(key, "completed");
    if (O.isSome(handle)) {
      yield* Deferred.succeed(handle.value.deferred, result);
      yield* Effect.logInfo(`Execution completed key=${key}`);
    }
  });

  const fail = Effect.fn("ExecutionDeduplicator.fail")(function* (key: string, error: ExecutionFailure) {
    const handle = yield* transitionHandle(key, "failed");
    if (O.isSome(handle)) {
      yield* Deferred.fail(handle.value.deferred, error);
      yield* Effect.logInfo(`Execution failed key=${key} error=${error.message}`);
    }
  });

  const cleanup = Effect.fn("ExecutionDeduplicator.cleanup")(function* (key: string) {
    yield* Ref.update(map, HashMap.remove(key));
    yield* Effect.logDebug(`Cleaned up execution handle key=${key}`);
  });

  return { getOrCreate, complete, fail, cleanup };
});

/**
 * Context tag that shares in-flight executions by idempotency key.
 *
 * **Example** (Reuse a running extraction)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExecutionDeduplicator } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * const reused = Effect.runSync(
 *   Effect.gen(function* () {
 *     const dedupe = yield* ExecutionDeduplicator
 *     yield* dedupe.getOrCreate("extract-ada")
 *     const second = yield* dedupe.getOrCreate("extract-ada")
 *     return second.isNew
 *   }).pipe(Effect.provide(ExecutionDeduplicator.Default))
 * )
 * console.log(reused) // false
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ExecutionDeduplicator extends Context.Service<ExecutionDeduplicator>()($I`ExecutionDeduplicator`, {
  make: makeExecutionDeduplicator,
}) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * Live alias for {@link ExecutionDeduplicator.Default}.
 *
 * **Example** (Provide the live deduplicator)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExecutionDeduplicator, ExecutionDeduplicatorLive } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * const created = Effect.runSync(
 *   Effect.gen(function* () {
 *     const dedupe = yield* ExecutionDeduplicator
 *     const first = yield* dedupe.getOrCreate("extract-ada")
 *     return first.isNew
 *   }).pipe(Effect.provide(ExecutionDeduplicatorLive))
 * )
 * console.log(created) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExecutionDeduplicatorLive = ExecutionDeduplicator.Default;
