import { Effect, Exit } from "effect"
import type { AstNode, InterpreterFailure } from "./Interpreter.model.ts"

export type IteratorCursor<R> = {
  readonly next: Effect.Effect<{ readonly done: boolean; readonly value: unknown }, InterpreterFailure, R>
  readonly close: Effect.Effect<void, InterpreterFailure, R>
}

export type SyncIteratorRunner<R> = {
  readonly syncIterator: (value: unknown, node: AstNode) => Effect.Effect<IteratorCursor<R> | undefined, InterpreterFailure, R>
}

export const preserveConsumerError = <A, R>(
  cursor: IteratorCursor<R>,
  effect: Effect.Effect<A, InterpreterFailure, R>,
): Effect.Effect<A, InterpreterFailure, R> =>
  Effect.flatMap(Effect.exit(effect), (exit) =>
    Exit.isSuccess(exit)
      ? Effect.succeed(exit.value)
      : Effect.andThen(Effect.exit(cursor.close), Effect.failCause(exit.cause)),
  )
