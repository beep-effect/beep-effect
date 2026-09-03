/**
 * Guest Promise scheduling, observation, and constructor/static/instance dispatch.
 *
 * **Details**
 *
 * Observation controls un-awaited rejection reporting; program completion
 * interrupts all remaining promise work via {@link PromiseRuntime.interrupt}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SafeObject } from "@beep/schema/SafeObject";
import { A, Eq, O, P, pipe } from "@beep/utils";
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
  type Scope,
} from "effect";
import * as S from "effect/Schema";
import { DiagnosticModel } from "../Codemode.result.ts";
import { CodeModePromise, makeEmptySafeObject } from "../Codemode.values.ts";
import { createAggregateErrorValue } from "../stdlib/StdLib.value.ts";
import { caughtErrorValue, normalizeError } from "./Interpreter.errors.ts";
import type { SyncIteratorRunner } from "./Interpreter.iterator.ts";
import {
  applyCollectionCallback,
  type CallbackRunner,
  isSupportedCallback,
  type SupportedCallback,
} from "./Interpreter.methods.ts";
import {
  type AstNode,
  InterpreterFailure,
  InterpreterRuntimeError,
  ProgramThrow,
  PromiseCapabilityFunction,
  PromiseInstanceMethodName,
  type PromiseInstanceMethodReference,
  PromiseMethodName,
  type PromiseMethodReference,
  RuntimeReference,
} from "./Interpreter.model.ts";
import { typeofValue } from "./Interpreter.references.ts";

const $I = $ScratchpadId.create("codemode/interpreter/Interpreter.promises");

const failureFromCause = (cause: Cause.Cause<InterpreterFailure>): InterpreterFailure => {
  const squashed = Cause.squash(cause);
  return InterpreterFailure.is(squashed) ? squashed : InterpreterRuntimeError.new(normalizeError(squashed).message);
};

/**
 * Per-execution registry of guest promises, observation, and interruption.
 *
 * **Gotchas**
 *
 * Observation only controls rejection reporting; program completion interrupts
 * all promise work. Missing {@link PromiseRuntime.markObserved} turns an awaited
 * rejection into `"Unhandled rejection from an un-awaited promise"`. IDs are
 * allocated before forking so reruns get distinct diagnostics in creation
 * order. Observation must be recorded when responsibility transfers, before the
 * consumer fiber runs. {@link PromiseRuntime.interrupt} loops
 * `Fiber.interruptAll` until the active set is empty because a straggler can
 * create promises before its interruption lands.
 *
 * **Example** (Create, observe, and await a settled promise)
 *
 * ```ts
 * import { Effect, Exit, Scope } from "effect"
 * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
 *
 * const program = Effect.gen(function* () {
 *   const scope = yield* Scope.make()
 *   const runtime = new PromiseRuntime<never>(scope)
 *   const promise = yield* runtime.create(Effect.succeed(1))
 *   runtime.markObserved(promise)
 *   const exit = yield* runtime.await(promise)
 *   yield* runtime.interrupt()
 *   return Exit.isSuccess(exit) ? exit.value : exit
 * })
 *
 * console.log(await Effect.runPromise(program))
 * // 1
 * ```
 *
 * @see {@link executeWithLimits} for the timeout path that calls `interrupt()`.
 * @see {@link constructPromise} for `new Promise(executor)` construction.
 * @see {@link resolvePromise} for adopting thenables into this runtime.
 * @category services
 * @since 0.0.0
 */
export class PromiseRuntime<R> {
  private readonly active = MutableHashSet.empty<CodeModePromise>();
  private readonly ids = MutableHashMap.empty<CodeModePromise, number>();
  private readonly observed = MutableHashSet.empty<CodeModePromise>();
  private readonly failures = MutableHashMap.empty<number, DiagnosticModel>();
  private nextID = 0;
  private readonly scope: Scope.Scope;

  constructor(scope: Scope.Scope) {
    this.scope = scope;
  }

  /**
   * Forks a guest effect into a {@link CodeModePromise}, allocating its diagnostic id first.
   *
   * **Example** (Create a settled promise)
   *
   * ```ts
   * import { Effect, Scope } from "effect"
   * import { CodeModePromise } from "../../../codemode/Codemode.values.ts"
   * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
   *
   * const promise = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const scope = yield* Scope.make()
   *     return yield* new PromiseRuntime<never>(scope).create(Effect.succeed(1))
   *   }),
   * )
   * console.log(CodeModePromise.is(promise))
   * // true
   * ```
   *
   * @since 0.0.0
   */
  create(effect: Effect.Effect<unknown, InterpreterFailure, R>): Effect.Effect<CodeModePromise, never, R> {
    return Effect.suspend(() => {
      // Allocate before forking so reruns get distinct IDs and diagnostics retain creation order.
      const id = this.nextID++;
      return Effect.map(Effect.forkIn(effect, this.scope, { startImmediately: true }), (fiber) => {
        const promise = CodeModePromise.new(fiber);
        MutableHashSet.add(this.active, promise);
        MutableHashMap.set(this.ids, promise, id);
        fiber.addObserver((exit) => {
          MutableHashSet.remove(this.active, promise);
          if (
            Exit.isSuccess(exit) ||
            Cause.hasInterruptsOnly(exit.cause) ||
            MutableHashSet.has(this.observed, promise)
          ) {
            MutableHashMap.remove(this.ids, promise);
            return;
          }
          const failure = normalizeError(Cause.squash(exit.cause));
          MutableHashMap.set(
            this.failures,
            id,
            DiagnosticModel.make({
              ...failure,
              message: `Unhandled rejection from an un-awaited promise: ${failure.message}`,
            })
          );
        });
        return promise;
      });
    });
  }

  /**
   * Records that a consumer now owns this promise so an awaited rejection is not an unhandled diagnostic.
   *
   * Observation must be recorded when responsibility transfers, before the consumer fiber runs.
   *
   * **Example** (Observe before awaiting)
   *
   * ```ts
   * import { Effect, Exit, Scope } from "effect"
   * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
   *
   * const exit = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const scope = yield* Scope.make()
   *     const runtime = new PromiseRuntime<never>(scope)
   *     const promise = yield* runtime.create(Effect.succeed("ready"))
   *     runtime.markObserved(promise)
   *     return yield* runtime.await(promise)
   *   }),
   * )
   * console.log(Exit.isSuccess(exit) ? exit.value : exit)
   * // ready
   * ```
   *
   * @since 0.0.0
   */
  // Observation must be recorded when responsibility transfers, before the consumer fiber runs.
  markObserved(promise: CodeModePromise): void {
    MutableHashSet.add(this.observed, promise);
    const id = MutableHashMap.get(this.ids, promise);
    MutableHashMap.remove(this.ids, promise);
    if (O.isSome(id)) MutableHashMap.remove(this.failures, id.value);
  }

  /**
   * Awaits the fiber backing a guest promise and returns its exit.
   *
   * **Example** (Await a successful promise)
   *
   * ```ts
   * import { Effect, Exit, Scope } from "effect"
   * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
   *
   * const exit = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const scope = yield* Scope.make()
   *     const runtime = new PromiseRuntime<never>(scope)
   *     const promise = yield* runtime.create(Effect.succeed(7))
   *     runtime.markObserved(promise)
   *     return yield* runtime.await(promise)
   *   }),
   * )
   * console.log(Exit.isSuccess(exit) ? exit.value : exit)
   * // 7
   * ```
   *
   * @since 0.0.0
   */
  await(promise: CodeModePromise): Effect.Effect<Exit.Exit<unknown, InterpreterFailure>> {
    return Fiber.await(promise.fiber);
  }

  /**
   * Forks work into the runtime scope without registering a guest promise handle.
   *
   * **Example** (Fork a side-effect job)
   *
   * ```ts
   * import { Effect, MutableRef, Scope } from "effect"
   * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
   *
   * const seen = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const scope = yield* Scope.make()
   *     const flag = MutableRef.make(false)
   *     yield* new PromiseRuntime<never>(scope).fork(Effect.sync(() => MutableRef.set(flag, true)))
   *     yield* Effect.yieldNow
   *     return MutableRef.get(flag)
   *   }),
   * )
   * console.log(seen)
   * // true
   * ```
   *
   * @since 0.0.0
   */
  fork(effect: Effect.Effect<unknown, InterpreterFailure, R>): Effect.Effect<void, never, R> {
    return Effect.asVoid(Effect.forkIn(effect, this.scope, { startImmediately: true }));
  }

  /**
   * Returns unhandled-rejection diagnostics in promise-creation order.
   *
   * **Example** (Read an un-awaited rejection)
   *
   * ```ts
   * import { Effect, Scope } from "effect"
   * import { InterpreterRuntimeError } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
   *
   * const messages = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const scope = yield* Scope.make()
   *     const runtime = new PromiseRuntime<never>(scope)
   *     yield* runtime.create(Effect.fail(InterpreterRuntimeError.new("boom")))
   *     yield* Effect.yieldNow
   *     return runtime.diagnostics().map((diagnostic) => diagnostic.message)
   *   }),
   * )
   * console.log(messages[0]?.includes("Unhandled rejection"))
   * // true
   * ```
   *
   * @since 0.0.0
   */
  diagnostics(): Array<DiagnosticModel> {
    return pipe(
      this.failures,
      A.fromIterable,
      A.sort(Order.mapInput(Order.Number, ([id]: readonly [number, DiagnosticModel]) => id)),
      A.map(([, failure]) => failure)
    );
  }

  /**
   * Interrupts every active guest promise, looping until the live set is empty, then returns diagnostics.
   *
   * **Example** (Interrupt leftover work)
   *
   * ```ts
   * import { Effect, Scope } from "effect"
   * import { PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
   *
   * const leftover = await Effect.runPromise(
   *   Effect.gen(function* () {
   *     const scope = yield* Scope.make()
   *     const runtime = new PromiseRuntime<never>(scope)
   *     yield* runtime.create(Effect.never)
   *     return yield* runtime.interrupt()
   *   }),
   * )
   * console.log(leftover.length)
   * // 0
   * ```
   *
   * @since 0.0.0
   */
  // Re-check because a straggler can create promises before its interruption lands.
  interrupt(): Effect.Effect<Array<DiagnosticModel>> {
    const self = this;
    return Effect.gen(function* () {
      while (MutableHashSet.size(self.active) > 0) {
        yield* Fiber.interruptAll(
          pipe(
            self.active,
            A.fromIterable,
            A.map((promise) => promise.fiber)
          )
        );
      }
      return self.diagnostics();
    });
  }
}

/**
 * TypeError raised when a promise would resolve with itself.
 *
 * **Example** (Inspect the cycle TypeError)
 *
 * ```ts
 * import { selfResolutionError } from "../../../codemode/interpreter/Interpreter.promises.ts"
 *
 * const error = selfResolutionError({ type: "CallExpression" })
 * console.log(error.errorName, error.message)
 * // TypeError Chaining cycle detected: a promise cannot resolve with itself.
 * ```
 *
 * @see {@link resolvePromiseValue} for the thenable walk that raises this error.
 * @category constructors
 * @since 0.0.0
 */
export const selfResolutionError = (node?: AstNode): InterpreterRuntimeError =>
  InterpreterRuntimeError.new("Chaining cycle detected: a promise cannot resolve with itself.", node).as("TypeError");

/**
 * Mutable slot used to detect a promise resolving with its own handle.
 *
 * @see {@link resolvePromiseValue} for the self-resolution check that reads this ref.
 * @see {@link resolvePromise} for the allocation that fills the slot after create.
 * @category type-level
 * @since 0.0.0
 */
export type PromiseIdentity = MutableRef.MutableRef<O.Option<CodeModePromise>>;

/**
 * Settles a thenable or guest promise down to a non-thenable value.
 *
 * **Gotchas**
 *
 * Self-resolution against `own` fails with {@link selfResolutionError}. A
 * thenable's `then` method is invoked in a later job (`Effect.yieldNow`) so it
 * never runs inline. Plain non-thenable values succeed immediately.
 *
 * **Example** (Pass a plain value through)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { resolvePromiseValue } from "../../../codemode/interpreter/Interpreter.promises.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed(undefined),
 *   settlePromise: () => Effect.succeed(undefined),
 * }
 *
 * console.log(
 *   await Effect.runPromise(resolvePromiseValue(runner, 41, { type: "Identifier" })),
 * )
 * // 41
 * ```
 *
 * @see {@link resolvePromise} for wrapping the settled value in a {@link CodeModePromise}.
 * @see {@link selfResolutionError} for the cycle TypeError this helper raises.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Interpreter dispatch uses co-primary reference/arguments/AST/runtime inputs; a data-last overload would misstate the protocol.
export const resolvePromiseValue = <R>(
  runner: CallbackRunner<R>,
  value: unknown,
  node: AstNode,
  own: O.Option<PromiseIdentity> = O.none()
): Effect.Effect<unknown, InterpreterFailure, R> => {
  if (O.exists(own, (identity) => O.exists(MutableRef.get(identity), Eq.equals(value))))
    return Effect.fail(selfResolutionError(node));
  if (CodeModePromise.is(value)) return runner.settlePromise(value);
  if (P.isNull(value) || !P.isObjectKeyword(value) || !P.hasProperty(value, "then")) return Effect.succeed(value);
  const then = SafeObject.make(value).then;
  if (typeofValue(then) !== "function") return Effect.succeed(value);

  return Effect.gen(function* () {
    // Promise resolution invokes a thenable's method in a later job.
    yield* Effect.yieldNow;
    const deferred = Deferred.makeUnsafe<unknown, InterpreterFailure>();
    const resolve = PromiseCapabilityFunction.new((result) => {
      Deferred.doneUnsafe(deferred, Exit.succeed(result));
    });
    const reject = PromiseCapabilityFunction.new((reason) => {
      Deferred.doneUnsafe(deferred, Exit.fail(ProgramThrow.new(reason)));
    });
    const executed = yield* Effect.exit(runner.invokeCallable(then, [resolve, reject], node));
    if (!Exit.isSuccess(executed)) {
      if (Cause.hasInterruptsOnly(executed.cause)) return yield* Effect.failCause(executed.cause);
      Deferred.doneUnsafe(deferred, Exit.fail(failureFromCause(executed.cause)));
    }
    return yield* resolvePromiseValue(runner, yield* Deferred.await(deferred), node, own);
  });
};

/**
 * Adopts an existing guest promise or wraps a value in a new one.
 *
 * **Example** (Wrap a number in a guest promise)
 *
 * ```ts
 * import { Effect, Scope } from "effect"
 * import { CodeModePromise } from "../../../codemode/Codemode.values.ts"
 * import {
 *   PromiseRuntime,
 *   resolvePromise,
 * } from "../../../codemode/interpreter/Interpreter.promises.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed(undefined),
 *   settlePromise: () => Effect.succeed(undefined),
 * }
 *
 * const wrapped = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const scope = yield* Scope.make()
 *     return yield* resolvePromise(
 *       runner,
 *       new PromiseRuntime<never>(scope),
 *       1,
 *       { type: "CallExpression" },
 *     )
 *   }),
 * )
 * console.log(CodeModePromise.is(wrapped))
 * // true
 * ```
 *
 * @see {@link resolvePromiseValue} for the thenable walk used before forking.
 * @see {@link constructPromise} for `new Promise(executor)` which also fills a {@link PromiseIdentity}.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Interpreter dispatch uses co-primary reference/arguments/AST/runtime inputs; a data-last overload would misstate the protocol.
export const resolvePromise = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  value: unknown,
  node: AstNode
): Effect.Effect<CodeModePromise, never, R> => {
  if (CodeModePromise.is(value)) return Effect.succeed(value);
  const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none());
  return Effect.map(promises.create(resolvePromiseValue(runner, value, node, O.some(identity))), (promise) => {
    MutableRef.set(identity, O.some(promise));
    return promise;
  });
};

/**
 * Dispatches a static `Promise.*` method on the guest Promise namespace.
 *
 * **Gotchas**
 *
 * `Promise.race([])` fails with `"Promise.race([]) would never settle"` instead
 * of hanging. Iterable arguments must be synchronous; async iterables TypeError.
 * Members are observed as they are collected so un-awaited diagnostics do not
 * fire for values `all`/`race` already owns.
 *
 * **Example** (Reject an empty Promise.race)
 *
 * ```ts
 * import { Cause, Effect, Exit, Scope } from "effect"
 * import {
 *   invokePromiseMethod,
 *   PromiseRuntime,
 * } from "../../../codemode/interpreter/Interpreter.promises.ts"
 * import {
 *   InterpreterFailure,
 *   PromiseMethodReference,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { CodeModePromise } from "../../../codemode/Codemode.values.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed(undefined),
 *   settlePromise: () => Effect.succeed(undefined),
 *   syncIterator: (value: unknown) => {
 *     if (!Array.isArray(value)) return Effect.succeed(undefined)
 *     let index = 0
 *     const items = value
 *     return Effect.succeed({
 *       next: Effect.sync(() => {
 *         if (index >= items.length) return { done: true, value: undefined }
 *         const current = items[index]
 *         index += 1
 *         return { done: false, value: current }
 *       }),
 *       close: Effect.void,
 *     })
 *   },
 * }
 *
 * const message = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const scope = yield* Scope.make()
 *     const promises = new PromiseRuntime<never>(scope)
 *     const promise = yield* invokePromiseMethod(
 *       runner,
 *       promises,
 *       PromiseMethodReference.new("race"),
 *       [[]],
 *       { type: "CallExpression" },
 *     )
 *     if (!CodeModePromise.is(promise)) throw new TypeError("Expected Promise.race to return a guest promise")
 *     promises.markObserved(promise)
 *     const exit = yield* promises.await(promise)
 *     const failure = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
 *     return InterpreterFailure.guards.InterpreterRuntimeError(failure)
 *       ? failure.message
 *       : failure
 *   }),
 * )
 * console.log(message)
 * // Promise.race([]) would never settle; provide at least one promise or value.
 * ```
 *
 * @see {@link invokePromiseInstanceMethod} for `.then` / `.catch` / `.finally`.
 * @see {@link resolvePromise} for `Promise.resolve`.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Interpreter dispatch uses co-primary reference/arguments/AST/runtime inputs; a data-last overload would misstate the protocol.
export const invokePromiseMethod = <R>(
  runner: CallbackRunner<R> & SyncIteratorRunner<R>,
  promises: PromiseRuntime<R>,
  ref: PromiseMethodReference,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const fromIterable = (
    name: PromiseMethodReference["name"],
    settle: (items: ReadonlyArray<CodeModePromise>) => Effect.Effect<unknown, InterpreterFailure, R>
  ): Effect.Effect<CodeModePromise, never, R> =>
    promises.create(
      Effect.gen(function* () {
        const cursor = yield* runner.syncIterator(args[0], node);
        if (P.isUndefined(cursor)) {
          throw InterpreterRuntimeError.new(`Promise.${name} expects an array or other synchronous iterable.`, node).as(
            "TypeError"
          );
        }

        const items = A.empty<CodeModePromise>();
        while (true) {
          const step = yield* cursor.next;
          if (step.done) break;
          const item = yield* resolvePromise(runner, promises, step.value, node);
          promises.markObserved(item);
          items.push(item);
        }

        return yield* settle(items);
      })
    );

  return PromiseMethodName.$match(ref.name, {
    resolve: () => resolvePromise(runner, promises, args[0], node),
    reject: () => promises.create(Effect.fail(ProgramThrow.new(args[0]))),
    all: () =>
      fromIterable(ref.name, (items) =>
        settleAfterTurn(
          Effect.all(
            A.map(items, (item) => Effect.flatten(promises.await(item))),
            { concurrency: "unbounded" }
          )
        )
      ),
    allSettled: () =>
      fromIterable(ref.name, (items) =>
        Effect.gen(function* () {
          const outcomes = A.empty<unknown>();
          for (const item of items) {
            const exit = yield* promises.await(item);
            if (Exit.isSuccess(exit)) {
              const outcome = makeEmptySafeObject();
              Reflect.set(outcome, "status", "fulfilled");
              Reflect.set(outcome, "value", exit.value);
              outcomes.push(outcome);
              continue;
            }
            if (Cause.hasInterruptsOnly(exit.cause)) return yield* Effect.failCause(exit.cause);
            const outcome = makeEmptySafeObject();
            Reflect.set(outcome, "status", "rejected");
            Reflect.set(outcome, "reason", caughtErrorValue(Cause.squash(exit.cause)));
            outcomes.push(outcome);
          }
          yield* Effect.yieldNow;
          return outcomes;
        })
      ),
    race: () =>
      fromIterable(ref.name, (items) =>
        A.isReadonlyArrayEmpty(items)
          ? Effect.fail(
              InterpreterRuntimeError.new(
                "Promise.race([]) would never settle; provide at least one promise or value.",
                node
              )
            )
          : settleAfterTurn(Effect.flatten(Effect.raceAll(A.map(items, (item) => promises.await(item)))))
      ),
    any: () =>
      fromIterable(ref.name, (items) => {
        const flipped = A.map(items, (item) =>
          Effect.flatMap(
            promises.await(item),
            (exit): Effect.Effect<unknown, PromiseAnyFulfilled | InterpreterFailure> => {
              if (Exit.isSuccess(exit)) return Effect.fail(PromiseAnyFulfilled.new(exit.value));
              if (Cause.hasInterruptsOnly(exit.cause)) return Effect.failCause(exit.cause);
              return Effect.succeed(caughtErrorValue(Cause.squash(exit.cause)));
            }
          )
        );

        return settleAfterTurn(
          Effect.all(flipped, { concurrency: "unbounded" }).pipe(
            Effect.flatMap((reasons) =>
              Effect.fail(ProgramThrow.new(createAggregateErrorValue(reasons, "All promises were rejected")))
            ),
            Effect.catchIf(PromiseAnyFulfilled.is, (error) => Effect.succeed(error.value))
          )
        );
      }),
  });
};

/**
 * Dispatches `.then`, `.catch`, or `.finally` on a guest promise.
 *
 * **Gotchas**
 *
 * The source promise is marked observed before chaining. Reaction handlers
 * never run inline: settled reactions yield once, and teardown (interrupt)
 * bypasses handlers. Arbitrary host callables cannot be handlers; wrap them in
 * an arrow {@link CodeModeFunction}.
 *
 * **Example** (Bind then onto a guest promise)
 *
 * ```ts
 * import { Effect, Fiber, Scope } from "effect"
 * import {
 *   invokePromiseInstanceMethod,
 *   PromiseRuntime,
 * } from "../../../codemode/interpreter/Interpreter.promises.ts"
 * import { PromiseInstanceMethodReference } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { CodeModePromise } from "../../../codemode/Codemode.values.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed("recovered"),
 *   settlePromise: (promise: CodeModePromise) =>
 *     Effect.flatMap(Fiber.await(promise.fiber), (exit) => exit),
 * }
 *
 * const chained = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const scope = yield* Scope.make()
 *     const promises = new PromiseRuntime<never>(scope)
 *     const source = yield* promises.create(Effect.succeed(1))
 *     return yield* invokePromiseInstanceMethod(
 *       runner,
 *       promises,
 *       PromiseInstanceMethodReference.new(source, "then"),
 *       [undefined, undefined],
 *       { type: "CallExpression" },
 *     )
 *   }),
 * )
 * console.log(CodeModePromise.is(chained))
 * // true
 * ```
 *
 * @see {@link applyCollectionCallback} for the handler admission used by reactions.
 * @see {@link invokePromiseMethod} for static `Promise.*` methods.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Interpreter dispatch uses co-primary reference/arguments/AST/runtime inputs; a data-last overload would misstate the protocol.
export const invokePromiseInstanceMethod = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  ref: PromiseInstanceMethodReference,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<CodeModePromise, never, R> => {
  promises.markObserved(ref.promise);
  return PromiseInstanceMethodName.$match(ref.name, {
    // biome-ignore lint/suspicious/noThenProperty: This is a match-handler key for the guest Promise.prototype.then operation, not a thenable result.
    then: () => {
      const method = `Promise.prototype.${ref.name}`;
      return chainReaction(
        runner,
        promises,
        ref.promise,
        reactionHandler(args[0], method, node),
        reactionHandler(args[1], method, node),
        method,
        node
      );
    },
    catch: () => {
      const method = `Promise.prototype.${ref.name}`;
      return chainReaction(
        runner,
        promises,
        ref.promise,
        O.none(),
        reactionHandler(args[0], method, node),
        method,
        node
      );
    },
    finally: () => {
      const method = `Promise.prototype.${ref.name}`;
      return chainFinally(runner, promises, ref.promise, reactionHandler(args[0], method, node), method, node);
    },
  });
};

/**
 * Constructs a guest promise from a {@link CodeModeFunction} executor.
 *
 * **Gotchas**
 *
 * The executor check throws synchronously — it does not `Effect.fail`. Wrapping
 * this helper in `Effect.try` is required if the caller might pass a non-function.
 * A valid executor receives resolve/reject {@link PromiseCapabilityFunction}s
 * and the resulting promise identity is filled before the executor runs so
 * self-resolution can be detected.
 *
 * **Example** (Reject a non-function executor synchronously)
 *
 * ```ts
 * import { Effect, Scope } from "effect"
 * import { constructPromise, PromiseRuntime } from "../../../codemode/interpreter/Interpreter.promises.ts"
 * import { InterpreterFailure } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed(undefined),
 *   settlePromise: () => Effect.succeed(undefined),
 * }
 *
 * const scope = await Effect.runPromise(Scope.make())
 * try {
 *   constructPromise(runner, new PromiseRuntime<never>(scope), 1, { type: "NewExpression" })
 * } catch (error) {
 *   console.log(
 *     InterpreterFailure.guards.InterpreterRuntimeError(error) ? error.message : error,
 *   )
 * }
 * // new Promise(...) expects an executor function (e.g. new Promise((resolve, reject) => { ... })).
 * ```
 *
 * @see {@link selfResolutionError} for the cycle TypeError resolve-with-self raises later.
 * @see {@link resolvePromiseValue} for how resolve arguments are adopted.
 * @throws InterpreterRuntimeError TypeError when `executor` is not a {@link CodeModeFunction}.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Promise executor, AST node, and runtime are co-primary inputs for a newly allocated guest promise.
export const constructPromise = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  executor: unknown,
  node: AstNode
): Effect.Effect<CodeModePromise, InterpreterFailure, R> => {
  if (!RuntimeReference.guards.CodeModeFunction(executor)) {
    throw InterpreterRuntimeError.new(
      "new Promise(...) expects an executor function (e.g. new Promise((resolve, reject) => { ... })).",
      node
    ).as("TypeError");
  }
  return Effect.gen(function* () {
    const deferred = Deferred.makeUnsafe<unknown, InterpreterFailure>();
    const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none());
    const promise = yield* promises.create(
      Effect.flatMap(Deferred.await(deferred), (value) => resolvePromiseValue(runner, value, node, O.some(identity)))
    );
    MutableRef.set(identity, O.some(promise));
    const resolve = PromiseCapabilityFunction.new((value) => {
      Deferred.doneUnsafe(deferred, Exit.succeed(value));
    });
    const reject = PromiseCapabilityFunction.new((value) => {
      Deferred.doneUnsafe(deferred, Exit.fail(ProgramThrow.new(value)));
    });
    const executed = yield* Effect.exit(runner.invokeFunction(executor, [resolve, reject]));
    if (!Exit.isSuccess(executed)) {
      if (Cause.hasInterruptsOnly(executed.cause)) return yield* Effect.failCause(executed.cause);
      Deferred.doneUnsafe(deferred, Exit.fail(failureFromCause(executed.cause)));
    }
    return promise;
  });
};

// Settle one reaction turn after the deciding member, after its existing reactions.
const settleAfterTurn = <A, E, R>(body: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.flatMap(Effect.exit(body), (exit) => Effect.andThen(Effect.yieldNow, exit));

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

const reactionHandler = (value: unknown, method: string, node: AstNode): O.Option<SupportedCallback> => {
  if (isSupportedCallback(value)) return O.some(value);
  if (typeofValue(value) === "function") {
    throw InterpreterRuntimeError.new(
      `${method} cannot use this callable as a handler; wrap it in an arrow function, e.g. (value) => tools.ns.tool(value).`,
      node
    );
  }
  return O.none();
};

// Teardown bypasses handlers; settled reactions yield once so handlers never run inline.
const reactionExit = <R>(
  promises: PromiseRuntime<R>,
  source: CodeModePromise
): Effect.Effect<Exit.Exit<unknown, InterpreterFailure>, InterpreterFailure, R> =>
  Effect.gen(function* () {
    const exit = yield* promises.await(source);
    if (!Exit.isSuccess(exit) && Cause.hasInterruptsOnly(exit.cause)) return yield* Effect.failCause(exit.cause);
    yield* Effect.yieldNow;
    return exit;
  });

const chainReaction = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  source: CodeModePromise,
  onFulfilled: O.Option<SupportedCallback>,
  onRejected: O.Option<SupportedCallback>,
  method: string,
  node: AstNode
): Effect.Effect<CodeModePromise, never, R> => {
  const identity = MutableRef.make<O.Option<CodeModePromise>>(O.none());
  const body = Effect.gen(function* () {
    const exit = yield* reactionExit(promises, source);
    const handler = Exit.isSuccess(exit) ? onFulfilled : onRejected;
    if (O.isNone(handler)) return yield* exit;
    const input = Exit.isSuccess(exit) ? exit.value : caughtErrorValue(Cause.squash(exit.cause));
    const result = yield* applyCollectionCallback(runner, handler.value, method, node)([input]);
    return yield* resolvePromiseValue(runner, result, node, O.some(identity));
  });
  return Effect.map(promises.create(body), (derived) => {
    MutableRef.set(identity, O.some(derived));
    return derived;
  });
};

const chainFinally = <R>(
  runner: CallbackRunner<R>,
  promises: PromiseRuntime<R>,
  source: CodeModePromise,
  cleanup: O.Option<SupportedCallback>,
  method: string,
  node: AstNode
): Effect.Effect<CodeModePromise, never, R> =>
  promises.create(
    Effect.gen(function* () {
      const exit = yield* reactionExit(promises, source);
      if (O.isSome(cleanup)) {
        const result = yield* applyCollectionCallback(runner, cleanup.value, method, node)([]);
        const intermediate = yield* promises.create(
          Effect.gen(function* () {
            yield* runner.settlePromise(yield* resolvePromise(runner, promises, result, node));
            return yield* exit;
          })
        );
        return yield* runner.settlePromise(intermediate);
      }
      return yield* exit;
    })
  );
