/**
 * Service: Execution Deduplicator
 *
 * Deduplicates concurrent in-flight requests for the same idempotency key.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, Data, Deferred, Effect, HashMap, Layer, Option, Ref } from "effect";
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ExecutionDeduplicator");

export class ExecutionFailure extends Data.TaggedError("ExecutionFailure")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface ExecutionHandle {
  readonly status: "running" | "completed" | "failed";
  readonly deferred: Deferred.Deferred<KnowledgeGraph, ExecutionFailure>;
  readonly startedAt: number;
}

export const makeExecutionDeduplicator = Effect.gen(function* () {
  const map = yield* Ref.make(HashMap.empty<string, ExecutionHandle>());

  const getOrCreate = Effect.fn("ExecutionDeduplicator.getOrCreate")(function* (key: string) {
    const existing = yield* Ref.get(map).pipe(Effect.map((handles) => HashMap.get(handles, key)));
    if (Option.isSome(existing)) {
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
        return Option.match(raceExisting, {
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
      Option.match(HashMap.get(handles, key), {
        onNone: () => [Option.none<ExecutionHandle>(), handles],
        onSome: (existing) => {
          const updated: ExecutionHandle = { ...existing, status: "completed" };
          return [Option.some(updated), HashMap.set(handles, key, updated)];
        },
      })
    );
    if (Option.isSome(handle)) {
      yield* Deferred.succeed(handle.value.deferred, result);
      yield* Effect.logInfo(`Execution completed key=${key}`);
    }
  });

  const fail = Effect.fn("ExecutionDeduplicator.fail")(function* (key: string, error: ExecutionFailure) {
    const handle = yield* Ref.modify(map, (handles) =>
      Option.match(HashMap.get(handles, key), {
        onNone: () => [Option.none<ExecutionHandle>(), handles],
        onSome: (existing) => {
          const updated: ExecutionHandle = { ...existing, status: "failed" };
          return [Option.some(updated), HashMap.set(handles, key, updated)];
        },
      })
    );
    if (Option.isSome(handle)) {
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

export class ExecutionDeduplicator extends Context.Service<ExecutionDeduplicator>()($I`ExecutionDeduplicator`, {
  make: makeExecutionDeduplicator,
}) {
  static readonly Default = Layer.effect(this, this.make);
}

export const ExecutionDeduplicatorLive = ExecutionDeduplicator.Default;
