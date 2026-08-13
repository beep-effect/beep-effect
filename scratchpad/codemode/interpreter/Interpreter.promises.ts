import { $ScratchpadId } from "@beep/identity";
import  { SafeObject } from "@beep/schema/SafeObject";
import { A, O, P, pipe, Eq } from "@beep/utils";
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  MutableHashMap,
  MutableHashSet,
  MutableRef,
  Order,
  Scope,
} from "effect"
import * as S from "effect/Schema";
import { DiagnosticModel } from "../Codemode.result.ts"
import {
  type AstNode,
  InterpreterFailure,
  InterpreterRuntimeError,
  ProgramThrow,
  PromiseCapabilityFunction,
  PromiseInstanceMethodName,
  PromiseInstanceMethodReference,
  PromiseMethodName,
  PromiseMethodReference,
  RuntimeReference,
} from "./Interpreter.model.ts"
import { caughtErrorValue, normalizeError } from "./Interpreter.errors.ts"
import { applyCollectionCallback, isSupportedCallback, type CallbackRunner, type SupportedCallback } from "./Interpreter.methods.ts"
import { typeofValue } from "./Interpreter.references.ts"
import { createAggregateErrorValue } from "../stdlib/StdLib.value.ts"
import { CodeModePromise } from "../Codemode.values.ts"
import type { SyncIteratorRunner } from "./Interpreter.iterator.ts"

const $I = $ScratchpadId.create("codemode/interpreter/Interpreter.promises");

const failureFromCause = (
  cause: Cause.Cause<InterpreterFailure>
): InterpreterFailure => {
  const squashed = Cause.squash(cause);
  return InterpreterFailure.is(squashed)
    ? squashed
    : InterpreterRuntimeError.new(normalizeError(squashed).message);
};

// Observation only controls rejection reporting; program completion interrupts all promise work.
export class PromiseRuntime<R> {
  private readonly active = MutableHashSet.empty<CodeModePromise>()
  private readonly ids = MutableHashMap.empty<CodeModePromise, number>()
  private readonly observed = MutableHashSet.empty<CodeModePromise>()
  private readonly failures = MutableHashMap.empty<number, DiagnosticModel>()
  private nextID = 0
  private readonly scope: Scope.Scope;

  constructor(scope: Scope.Scope) {
    this.scope = scope;
  }

  create(effect: Effect.Effect<unknown, InterpreterFailure, R>): Effect.Effect<CodeModePromise, never, R> {
    return Effect.suspend(() => {
      // Allocate before forking so reruns get distinct IDs and diagnostics retain creation order.
      const id = this.nextID++
      return Effect.map(Effect.forkIn(effect, this.scope, { startImmediately: true }), (fiber) => {
        const promise = CodeModePromise.new(fiber)
        MutableHashSet.add(this.active, promise)
        MutableHashMap.set(this.ids, promise, id)
        fiber.addObserver((exit) => {
          MutableHashSet.remove(this.active, promise)
          if (
            Exit.isSuccess(exit) ||
            Cause.hasInterruptsOnly(exit.cause) ||
            MutableHashSet.has(this.observed, promise)
          ) {
            MutableHashMap.remove(this.ids, promise)
            return
          }
          const failure = normalizeError(Cause.squash(exit.cause))
          MutableHashMap.set(this.failures, id, DiagnosticModel.make({
            ...failure,
            message: `Unhandled rejection from an un-awaited promise: ${failure.message}`,
          }))
        })
        return promise
      })
    })
  }

  // Observation must be recorded when responsibility transfers, before the consumer fiber runs.
  markObserved(promise: CodeModePromise): void {
    MutableHashSet.add(this.observed, promise)
    const id = MutableHashMap.get(this.ids, promise)
    MutableHashMap.remove(this.ids, promise)
    if (O.isSome(id)) MutableHashMap.remove(this.failures, id.value)
  }

  await(promise: CodeModePromise): Effect.Effect<Exit.Exit<unknown, InterpreterFailure>> {
    return Fiber.await(promise.fiber)
  }

  fork(effect: Effect.Effect<unknown, InterpreterFailure, R>): Effect.Effect<void, never, R> {
    return Effect.asVoid(Effect.forkIn(effect, this.scope, { startImmediately: true }))
  }

  diagnostics(): Array<DiagnosticModel> {
    return pipe(
      this.failures,
      A.fromIterable,
      A.sort(
        Order.mapInput(
          Order.Number,
          ([id]: readonly [number, DiagnosticModel]) => id
        )
      ),
      A.map(([, failure]) => failure)
    )
  }

  // Re-check because a straggler can create promises before its interruption lands.
  interrupt(): Effect.Effect<Array<DiagnosticModel>> {
    const self = this
    return Effect.gen(function* () {
      while (MutableHashSet.size(self.active) > 0) {
        yield* Fiber.interruptAll(
          pipe(
            self.active,
            A.fromIterable,
            A.map((promise) => promise.fiber)
          )
        )
      }
      return self.diagnostics()
    })
  }
}

export const selfResolutionError = (node?: AstNode): InterpreterRuntimeError =>
  InterpreterRuntimeError.new("Chaining cycle detected: a promise cannot resolve with itself.", node).as("TypeError")

export type PromiseIdentity = MutableRef.MutableRef<O.Option<CodeModePromise>>

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const resolvePromiseValue = <R>(
  runner: CallbackRunner<R>,
  value: unknown,
  node: AstNode,
  own: O.Option<PromiseIdentity> = O.none(),
): Effect.Effect<unknown, InterpreterFailure, R> => {
  if (
    O.exists(
      own,
      (identity) => O.exists(MutableRef.get(identity), Eq.equals(value)),
    )
  ) return Effect.fail(selfResolutionError(node))
  if (CodeModePromise.is(value)) return runner.settlePromise(value)
  if (P.isNull(value) || !P.isObjectKeyword(value) || !P.hasProperty(value, "then")) return Effect.succeed(value)
  const then = SafeObject.make(value).then
  if (typeofValue(then) !== "function") return Effect.succeed(value)

  return Effect.gen(function* () {
    // Promise resolution invokes a thenable's method in a later job.
    yield* Effect.yieldNow
    const deferred = Deferred.makeUnsafe<unknown, InterpreterFailure>()
    const resolve = PromiseCapabilityFunction.new((result) => {
      Deferred.doneUnsafe(deferred, Exit.succeed(result))
    })
    const reject = PromiseCapabilityFunction.new((reason) => {
      Deferred.doneUnsafe(deferred, Exit.fail(ProgramThrow.new(reason)))
    })
    const executed = yield* Effect.exit(runner.invokeCallable(then, [resolve, reject], node))
    if (!Exit.isSuccess(executed)) {
      if (Cause.hasInterruptsOnly(executed.cause)) return yield* Effect.failCause(executed.cause)
      Deferred.doneUnsafe(deferred, Exit.fail(failureFromCause(executed.cause)))
    }
    return yield* resolvePromiseValue(runner, yield* Deferred.await(deferred), node, own)
  })
}

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const resolvePromise = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  value: unknown,
  node: AstNode,
): Effect.Effect<CodeModePromise, never, R> => {
  if (CodeModePromise.is(value)) return Effect.succeed(value)
  const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none())
  return Effect.map(promises.create(resolvePromiseValue(runner, value, node, O.some(identity))), (promise) => {
    MutableRef.set(identity, O.some(promise))
    return promise
  })
}

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const invokePromiseMethod = <R>(
  runner: CallbackRunner<R> & SyncIteratorRunner<R>,
  promises: PromiseRuntime<R>,
  ref: PromiseMethodReference,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const fromIterable = (
    name: PromiseMethodReference["name"],
    settle: (
      items: ReadonlyArray<CodeModePromise>
    ) => Effect.Effect<unknown, InterpreterFailure, R>,
  ): Effect.Effect<CodeModePromise, never, R> =>
    promises.create(
      Effect.gen(function* () {
        const cursor = yield* runner.syncIterator(args[0], node)
        if (P.isUndefined(cursor)) {
          throw InterpreterRuntimeError.new(
            `Promise.${name} expects an array or other synchronous iterable.`,
            node,
          ).as("TypeError")
        }

        const items = A.empty<CodeModePromise>()
        while (true) {
          const step = yield* cursor.next
          if (step.done) break
          const item = yield* resolvePromise(runner, promises, step.value, node)
          promises.markObserved(item)
          items.push(item)
        }

        return yield* settle(items)
      }),
    )

  return PromiseMethodName.$match(ref.name, {
    resolve: () => resolvePromise(runner, promises, args[0], node),
    reject: () => promises.create(Effect.fail(ProgramThrow.new(args[0]))),
    all: () =>
      fromIterable(
        ref.name,
        (items) =>
          settleAfterTurn(
            Effect.all(
              A.map(items, (item) => Effect.flatten(promises.await(item))),
              { concurrency: "unbounded" },
            ),
          ),
      ),
    allSettled: () =>
      fromIterable(
        ref.name,
        (items) =>
          Effect.gen(function* () {
            const outcomes = A.empty<unknown>()
            for (const item of items) {
              const exit = yield* promises.await(item)
              if (Exit.isSuccess(exit)) {
                outcomes.push(
                  Object.assign(
                    SafeObject.make(Object.create(null)),
                    { status: "fulfilled", value: exit.value },
                  ),
                )
                continue
              }
              if (Cause.hasInterruptsOnly(exit.cause)) return yield* Effect.failCause(exit.cause)
              outcomes.push(
                Object.assign(SafeObject.make(Object.create(null)), {
                  status: "rejected",
                  reason: caughtErrorValue(Cause.squash(exit.cause)),
                }),
              )
            }
            yield* Effect.yieldNow
            return outcomes
          }),
      ),
    race: () =>
      fromIterable(
        ref.name,
        (items) =>
          A.isReadonlyArrayEmpty(items)
            ? Effect.fail(
              InterpreterRuntimeError.new(
                "Promise.race([]) would never settle; provide at least one promise or value.",
                node,
              ),
            )
            : settleAfterTurn(
              Effect.flatten(
                Effect.raceAll(A.map(items, (item) => promises.await(item))),
              ),
            ),
      ),
    any: () =>
      fromIterable(
        ref.name,
        (items) => {
          const flipped = A.map(items, (item) =>
            Effect.flatMap(
              promises.await(item),
              (
                exit
              ): Effect.Effect<unknown, PromiseAnyFulfilled | InterpreterFailure> => {
                if (Exit.isSuccess(exit)) return Effect.fail(PromiseAnyFulfilled.new(exit.value))
                if (Cause.hasInterruptsOnly(exit.cause)) return Effect.failCause(exit.cause)
                return Effect.succeed(caughtErrorValue(Cause.squash(exit.cause)))
              },
            )
          )

          return settleAfterTurn(
            Effect.all(flipped, { concurrency: "unbounded" }).pipe(
              Effect.flatMap((reasons) =>
                Effect.fail(ProgramThrow.new(createAggregateErrorValue(reasons, "All promises were rejected"))),
              ),
              Effect.catch((error) =>
                PromiseAnyFulfilled.is(error) ? Effect.succeed(error.value) : Effect.fail(error),
              ),
            ),
          )
        },
      ),
  })
}

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const invokePromiseInstanceMethod = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  ref: PromiseInstanceMethodReference,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<CodeModePromise, never, R> => {
  promises.markObserved(ref.promise)
  return PromiseInstanceMethodName.$match(ref.name, {
    then: () => {
      const method = `Promise.prototype.${ref.name}`
      return chainReaction(
        runner,
        promises,
        ref.promise,
        reactionHandler(args[0], method, node),
        reactionHandler(args[1], method, node),
        method,
        node,
      )
    },
    catch: () => {
      const method = `Promise.prototype.${ref.name}`
      return chainReaction(
        runner,
        promises,
        ref.promise,
        O.none(),
        reactionHandler(args[0], method, node),
        method,
        node,
      )
    },
    finally: () => {
      const method = `Promise.prototype.${ref.name}`
      return chainFinally(
        runner,
        promises,
        ref.promise,
        reactionHandler(args[0], method, node),
        method,
        node,
      )
    },
  })
}

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const constructPromise = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  executor: unknown,
  node: AstNode,
): Effect.Effect<CodeModePromise, InterpreterFailure, R> => {
  if (!RuntimeReference.guards.CodeModeFunction(executor)) {
    throw InterpreterRuntimeError.new(
      "new Promise(...) expects an executor function (e.g. new Promise((resolve, reject) => { ... })).",
      node,
    ).as("TypeError")
  }
  return Effect.gen(function* () {
    const deferred = Deferred.makeUnsafe<unknown, InterpreterFailure>()
    const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none())
    const promise = yield* promises.create(
      Effect.flatMap(
        Deferred.await(deferred),
        (value) => resolvePromiseValue(runner, value, node, O.some(identity)),
      ),
    )
    MutableRef.set(identity, O.some(promise))
    const resolve = PromiseCapabilityFunction.new((value) => {
      Deferred.doneUnsafe(deferred, Exit.succeed(value))
    })
    const reject = PromiseCapabilityFunction.new((value) => {
      Deferred.doneUnsafe(deferred, Exit.fail(ProgramThrow.new(value)))
    })
    const executed = yield* Effect.exit(runner.invokeFunction(executor, [resolve, reject]))
    if (!Exit.isSuccess(executed)) {
      if (Cause.hasInterruptsOnly(executed.cause)) return yield* Effect.failCause(executed.cause)
      Deferred.doneUnsafe(deferred, Exit.fail(failureFromCause(executed.cause)))
    }
    return promise
  })
}

// Settle one reaction turn after the deciding member, after its existing reactions.
const settleAfterTurn = <A, E, R>(body: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.flatMap(Effect.exit(body), (exit) => Effect.andThen(Effect.yieldNow, exit))

class PromiseAnyFulfilled extends S.TaggedClass<PromiseAnyFulfilled>($I`PromiseAnyFulfilled`)(
  "PromiseAnyFulfilled",
  {
    value: S.Unknown,
  },
  $I.annote("PromiseAnyFulfilled", {
    description: "Internal short-circuit marker for Promise.any fulfillment.",
  })
) {
  static readonly is = S.is(PromiseAnyFulfilled);

  static readonly new = (value: unknown): PromiseAnyFulfilled => PromiseAnyFulfilled.make({ value });
}

const reactionHandler = (
  value: unknown,
  method: string,
  node: AstNode,
): O.Option<SupportedCallback> => {
  if (isSupportedCallback(value)) return O.some(value)
  if (typeofValue(value) === "function") {
    throw InterpreterRuntimeError.new(
      `${method} cannot use this callable as a handler; wrap it in an arrow function, e.g. (value) => tools.ns.tool(value).`,
      node,
    )
  }
  return O.none()
}

// Teardown bypasses handlers; settled reactions yield once so handlers never run inline.
const reactionExit = <R>(
  promises: PromiseRuntime<R>,
  source: CodeModePromise,
): Effect.Effect<Exit.Exit<unknown, InterpreterFailure>, InterpreterFailure, R> =>
  Effect.gen(function* () {
    const exit = yield* promises.await(source)
    if (!Exit.isSuccess(exit) && Cause.hasInterruptsOnly(exit.cause)) return yield* Effect.failCause(exit.cause)
    yield* Effect.yieldNow
    return exit
  })

const chainReaction = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  source: CodeModePromise,
  onFulfilled: O.Option<SupportedCallback>,
  onRejected: O.Option<SupportedCallback>,
  method: string,
  node: AstNode,
): Effect.Effect<CodeModePromise, never, R> => {
  const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none())
  const body = Effect.gen(function* () {
    const exit = yield* reactionExit(promises, source)
    const handler = Exit.isSuccess(exit) ? onFulfilled : onRejected
    if (O.isNone(handler)) return yield* exit
    const input = Exit.isSuccess(exit) ? exit.value : caughtErrorValue(Cause.squash(exit.cause))
    const result = yield* applyCollectionCallback(runner, handler.value, method, node)([input])
    return yield* resolvePromiseValue(runner, result, node, O.some(identity))
  })
  return Effect.map(promises.create(body), (derived) => {
    MutableRef.set(identity, O.some(derived))
    return derived
  })
}

const chainFinally = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  source: CodeModePromise,
  cleanup: O.Option<SupportedCallback>,
  method: string,
  node: AstNode,
): Effect.Effect<CodeModePromise, never, R> =>
  promises.create(
    Effect.gen(function* () {
      const exit = yield* reactionExit(promises, source)
      if (O.isSome(cleanup)) {
        const result = yield* applyCollectionCallback(runner, cleanup.value, method, node)([])
        const intermediate = yield* promises.create(
          Effect.gen(function* () {
            yield* runner.settlePromise(yield* resolvePromise(runner, promises, result, node))
            return yield* exit
          }),
        )
        return yield* runner.settlePromise(intermediate)
      }
      return yield* exit
    }),
  )
