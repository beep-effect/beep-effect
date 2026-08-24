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
 * Provides the execution failure service capability.
 *
 * **Example** (Inspect execution failure)
 *
 * ```ts
 * import { ExecutionFailure } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * console.log(ExecutionFailure)
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
 * Constructs the make execution deduplicator value from its declared inputs.
 *
 * **Example** (Inspect make execution deduplicator)
 *
 * ```ts
 * import { makeExecutionDeduplicator } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * console.log(makeExecutionDeduplicator)
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

  const complete = Effect.fn("ExecutionDeduplicator.complete")(function* (key: string, result: KnowledgeGraph) {
    const handle = yield* Ref.modify(map, (handles) =>
      O.match(HashMap.get(handles, key), {
        onNone: () => [O.none<ExecutionHandle>(), handles],
        onSome: (existing) => {
          const updated: ExecutionHandle = { ...existing, status: "completed" };
          return [O.some(updated), HashMap.set(handles, key, updated)];
        },
      })
    );
    if (O.isSome(handle)) {
      yield* Deferred.succeed(handle.value.deferred, result);
      yield* Effect.logInfo(`Execution completed key=${key}`);
    }
  });

  const fail = Effect.fn("ExecutionDeduplicator.fail")(function* (key: string, error: ExecutionFailure) {
    const handle = yield* Ref.modify(map, (handles) =>
      O.match(HashMap.get(handles, key), {
        onNone: () => [O.none<ExecutionHandle>(), handles],
        onSome: (existing) => {
          const updated: ExecutionHandle = { ...existing, status: "failed" };
          return [O.some(updated), HashMap.set(handles, key, updated)];
        },
      })
    );
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
 * Provides the execution deduplicator service capability.
 *
 * **Example** (Inspect execution deduplicator)
 *
 * ```ts
 * import { ExecutionDeduplicator } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * console.log(ExecutionDeduplicator)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ExecutionDeduplicator extends Context.Service<ExecutionDeduplicator>()($I`ExecutionDeduplicator`, {
  make: makeExecutionDeduplicator,
}) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * Provides the Effect layer for execution deduplicator live dependencies.
 *
 * **Example** (Inspect execution deduplicator live)
 *
 * ```ts
 * import { ExecutionDeduplicatorLive } from "@effect-ontology/Service/ExecutionDeduplicator"
 *
 * console.log(ExecutionDeduplicatorLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExecutionDeduplicatorLive = ExecutionDeduplicator.Default;
