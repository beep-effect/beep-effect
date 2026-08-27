/**
 * Guest iterator consumption helpers for collection adapters.
 *
 * {@link invokeArrayFrom} and {@link invokeGroupBy} obtain a
 * {@link IteratorCursor} through {@link SyncIteratorRunner} and use
 * {@link preserveConsumerError} so mapper failures stay visible after close.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect, Exit } from "effect";
import { dual } from "effect/Function";
import type { AstNode, InterpreterFailure } from "./Interpreter.model.ts";

/**
 * Pull-based cursor over a guest synchronous iterable.
 *
 * `next` yields `{ done, value }` steps. `close` releases the underlying
 * iterator and must be treated as best-effort when a consumer already failed.
 *
 * @see {@link preserveConsumerError} for failure cleanup that discards close errors.
 * @see {@link SyncIteratorRunner} for the producer that returns this cursor or `undefined`.
 * @category type-level
 * @since 0.0.0
 */
export type IteratorCursor<R> = {
  readonly next: Effect.Effect<{ readonly done: boolean; readonly value: unknown }, InterpreterFailure, R>;
  readonly close: Effect.Effect<void, InterpreterFailure, R>;
};

/**
 * Capability that opens a synchronous iterator cursor for a guest value.
 *
 * Returns `undefined` when the value is not a supported synchronous iterable so
 * callers can fall back to array-like paths.
 *
 * @see {@link IteratorCursor} for the cursor contract returned on success.
 * @see {@link invokeArrayFrom} for a call site that consumes this runner.
 * @category type-level
 * @since 0.0.0
 */
export type SyncIteratorRunner<R> = {
  readonly syncIterator: (
    value: unknown,
    node: AstNode
  ) => Effect.Effect<IteratorCursor<R> | undefined, InterpreterFailure, R>;
};

/**
 * Runs a consumer effect against a cursor and keeps the consumer `Cause` if it fails.
 *
 * **Gotchas**
 *
 * On consumer failure this helper `Effect.exit`s `cursor.close` and then
 * `Effect.failCause`s the original consumer cause. Close errors are discarded.
 * Do not `andThen(close, fail(consumer))` in the opposite order or a close
 * TypeError will mask the callback that actually failed.
 *
 * **Example** (Keep the mapper TypeError after a failing close)
 *
 * ```ts
 * import { Cause, Effect, Exit } from "effect"
 * import { preserveConsumerError } from "../../../codemode/interpreter/Interpreter.iterator.ts"
 * import {
 *   InterpreterFailure,
 *   InterpreterRuntimeError,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const cursor = {
 *   next: Effect.succeed({ done: true, value: undefined }),
 *   close: Effect.fail(InterpreterRuntimeError.new("close failed")),
 * }
 *
 * const exit = await Effect.runPromise(
 *   Effect.exit(
 *     preserveConsumerError(
 *       cursor,
 *       Effect.fail(InterpreterRuntimeError.new("mapper failed")),
 *     ),
 *   ),
 * )
 *
 * const failure = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
 * console.log(
 *   InterpreterFailure.guards.InterpreterRuntimeError(failure) ? failure.message : failure,
 * )
 * // mapper failed
 * ```
 *
 * @see {@link SyncIteratorRunner} for cursor production.
 * @see {@link invokeArrayFrom} for the collection call site that relies on this order.
 * @category error-handling
 * @since 0.0.0
 */
export const preserveConsumerError: {
  <A, R>(
    effect: Effect.Effect<A, InterpreterFailure, R>
  ): (cursor: IteratorCursor<R>) => Effect.Effect<A, InterpreterFailure, R>;
  <A, R>(
    cursor: IteratorCursor<R>,
    effect: Effect.Effect<A, InterpreterFailure, R>
  ): Effect.Effect<A, InterpreterFailure, R>;
} = dual(
  2,
  <A, R>(
    cursor: IteratorCursor<R>,
    effect: Effect.Effect<A, InterpreterFailure, R>
  ): Effect.Effect<A, InterpreterFailure, R> =>
    Effect.flatMap(Effect.exit(effect), (exit) =>
      Exit.isSuccess(exit)
        ? Effect.succeed(exit.value)
        : Effect.andThen(Effect.exit(cursor.close), Effect.failCause(exit.cause))
    )
);
