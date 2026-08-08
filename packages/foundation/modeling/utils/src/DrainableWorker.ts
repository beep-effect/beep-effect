/**
 * Scoped queue worker utilities with drain tracking.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, TxQueue, TxRef } from "effect";
import type * as Scope from "effect/Scope";

/**
 * Queue-backed worker handle that can be drained before a scoped shutdown.
 *
 * **Example** (Define drainable worker shape)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { DrainableWorker } from "@beep/utils/DrainableWorker"
 *
 * const worker: DrainableWorker<string> = {
 *   drain: Effect.void,
 *   enqueue: (item) => Effect.log(item)
 * }
 *
 * console.log(worker.drain)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface DrainableWorker<A> {
  /**
   * Resolves when the queue is empty and the worker is idle (not processing).
   */
  readonly drain: Effect.Effect<void>;
  /**
   * Enqueue a work item and track it for `drain()`.
   *
   * This wraps `Queue.offer` so drain state is updated atomically with the
   * enqueue path instead of inferring it from queue internals.
   */
  readonly enqueue: (item: A) => Effect.Effect<void>;
}

/**
 * Create a drainable worker that processes items from an unbounded queue.
 *
 * **Details**
 *
 * The worker is forked into the current scope and will be interrupted when
 * the scope closes. A finalizer shuts down the queue.
 *
 * **Example** (Process items with drainable worker)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import { makeDrainableWorker } from "@beep/utils/DrainableWorker"
 *
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const processed = yield* Ref.make<Array<string>>([])
 *     const worker = yield* makeDrainableWorker((item: string) =>
 *       Ref.update(processed, (items) => [...items, item])
 *     )
 *     yield* worker.enqueue("compile-docs")
 *     yield* worker.drain
 *     return yield* Ref.get(processed)
 *   })
 * )
 *
 * Effect.runPromise(program).then((items) => console.log(items))
 * ```
 *
 * @effects Forks a scoped background fiber, allocates an unbounded queue, runs
 * `process` for each queued item, and shuts the queue down when the enclosing
 * scope closes.
 * @category concurrency
 * @since 0.0.0
 */
export const makeDrainableWorker = Effect.fn("makeDrainableWorker")(function* <A, E, R>(
  process: (item: A) => Effect.Effect<void, E, R>
): Effect.fn.Return<DrainableWorker<A>, never, Scope.Scope | R> {
  const queue = yield* Effect.acquireRelease(TxQueue.unbounded<A>(), TxQueue.shutdown);
  const outstanding = yield* TxRef.make(0);

  yield* TxQueue.take(queue).pipe(
    Effect.tap((a) =>
      Effect.ensuring(
        process(a),
        TxRef.update(outstanding, (n) => n - 1)
      )
    ),
    Effect.forever,
    Effect.forkScoped
  );

  const drain: DrainableWorker<A>["drain"] = TxRef.get(outstanding).pipe(
    Effect.tap((n) => (n > 0 ? Effect.txRetry : Effect.void)),
    Effect.tx
  );

  const enqueue = (element: A): Effect.Effect<boolean, never, never> =>
    TxQueue.offer(queue, element).pipe(
      Effect.tap(() => TxRef.update(outstanding, (n) => n + 1)),
      Effect.tx
    );

  return { enqueue, drain } satisfies DrainableWorker<A>;
});
