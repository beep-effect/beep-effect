/**
 * Bridges host diagnostics and guest Error objects for the confined interpreter.
 *
 * Public execution surfaces consume {@link normalizeError}. Guest `try/catch`
 * bindings consume {@link caughtErrorValue}. `new Error` / `new AggregateError`
 * dispatch through the constructors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PosInt } from "@beep/schema";
import type { SafeObject } from "@beep/schema/SafeObject";
import { Unknown } from "@beep/schema/Unknown";
import { A, O, P, pipe, Str } from "@beep/utils";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { DiagnosticLocation, DiagnosticModel } from "../Codemode.result.ts";
import { ToolError } from "../Codemode.tool-error.ts";
import { copyOut, ToolRuntimeError } from "../Codemode.tool-runtime.ts";
import { coerceToString, createAggregateErrorValue, createErrorValue } from "../stdlib/index.ts";
import type { SyncIteratorRunner } from "./Interpreter.iterator.ts";
import {
  type AstNode,
  ErrorConstructorName,
  formatLocation,
  InterpreterFailure,
  InterpreterRuntimeError,
  sourceLocation,
} from "./Interpreter.model.ts";
import { containsRuntimeReference } from "./Interpreter.references.ts";

const renderUnknown = (value: unknown, property?: "name" | "message"): string =>
  pipe(
    Result.try(() =>
      globalThis.String(P.isUndefined(property) ? value : P.isObject(value) ? Reflect.get(value, property) : undefined)
    ),
    Result.getOrElse(() => "<unprintable>")
  );

/**
 * Maps an interpreter, Toolkit, guest, or host failure onto a public diagnostic.
 *
 * **Gotchas**
 *
 * Host `RangeError` messages that mention a call stack become
 * `"Execution exceeded the maximum nesting depth."`. A {@link ProgramThrow} of a
 * runtime reference renders as `"a non-data value"` rather than leaking the
 * branded handle. This helper never throws: encoding failures fall back to an
 * `ExecutionFailure` diagnostic.
 *
 * **Example** (Rewrite a host call-stack RangeError)
 *
 * ```ts
 * import { normalizeError } from "../../../codemode/interpreter/Interpreter.errors.ts"
 * import { InterpreterRuntimeError } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const nested = normalizeError(new RangeError("Maximum call stack size exceeded"))
 * console.log(nested.message)
 * // Execution exceeded the maximum nesting depth.
 *
 * const runtime = normalizeError(InterpreterRuntimeError.new("Unknown identifier 'x'."))
 * console.log(runtime.kind)
 * // ExecutionFailure
 * ```
 *
 * @see {@link caughtErrorValue} for the guest `try/catch` Error object instead of a diagnostic.
 * @see {@link ProgramThrow} for guest-thrown values that stay data until this helper renders them.
 * @category error-handling
 * @since 0.0.0
 */
export const normalizeError = (error: unknown): DiagnosticModel =>
  pipe(
    Result.try(() => {
      if (InterpreterFailure.guards.InterpreterRuntimeError(error)) {
        const node = O.getOrUndefined(error.node);
        const location = P.isUndefined(node?.loc) ? undefined : sourceLocation(node);
        return DiagnosticModel.new(
          error.kind,
          `${error.message}${formatLocation(node)}`,
          P.isUndefined(location)
            ? undefined
            : DiagnosticLocation.make({
                line: PosInt.make(location.line),
                column: PosInt.make(location.column),
              }),
          O.getOrUndefined(error.suggestions)
        );
      }
      if (ToolRuntimeError.is(error)) {
        return DiagnosticModel.new(
          error.kind,
          error.message,
          undefined,
          A.isReadonlyArrayNonEmpty(error.suggestions) ? error.suggestions : undefined
        );
      }
      if (ToolError.is(error)) return DiagnosticModel.new("ToolFailure", error.message);
      if (InterpreterFailure.guards.ProgramThrow(error)) {
        const value = error.value;
        const message = containsRuntimeReference(value)
          ? "a non-data value"
          : P.isString(value)
            ? value
            : P.isObject(value) && P.hasProperty(value, "message") && P.isString(value.message)
              ? value.message
              : pipe(
                  Unknown.encodeUnknownResultFromJsonString(copyOut(value, "json")),
                  Result.getOrElse(() => renderUnknown(value))
                );
        return DiagnosticModel.new("ExecutionFailure", `Uncaught: ${message}`);
      }
      if (P.isError(error)) {
        const name = renderUnknown(error, "name");
        const message = renderUnknown(error, "message");
        if (error instanceof RangeError && pipe(message, Str.toLowerCase, Str.includes("call stack"))) {
          return DiagnosticModel.new("ExecutionFailure", "Execution exceeded the maximum nesting depth.");
        }
        return DiagnosticModel.new(name === "SyntaxError" ? "ParseError" : "ExecutionFailure", message);
      }
      return DiagnosticModel.new("ExecutionFailure", renderUnknown(error));
    }),
    Result.getOrElse(() => DiagnosticModel.new("ExecutionFailure", renderUnknown(error)))
  );

/**
 * Converts a host-side failure into the Error object a guest `catch` binding sees.
 *
 * **Details**
 *
 * A {@link ProgramThrow} unwraps to the original guest value. An
 * {@link InterpreterRuntimeError} becomes a branded guest Error named after
 * `errorName`. Other failures reuse {@link normalizeError} only for the message
 * string, then construct a guest Error — they never publish a
 * {@link DiagnosticModel} into the program.
 *
 * **Example** (Unwrap a guest throw vs wrap a runtime error)
 *
 * ```ts
 * import { caughtErrorValue } from "../../../codemode/interpreter/Interpreter.errors.ts"
 * import {
 *   InterpreterRuntimeError,
 *   ProgramThrow,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(caughtErrorValue(ProgramThrow.new("boom")))
 * // boom
 *
 * const wrapped = caughtErrorValue(InterpreterRuntimeError.new("nope").as("TypeError"))
 * console.log(Reflect.get(Object(wrapped), "name"), Reflect.get(Object(wrapped), "message"))
 * // TypeError nope
 * ```
 *
 * @see {@link normalizeError} for the public diagnostic path used outside guest catch.
 * @see {@link constructErrorValue} for `new Error(...)` construction.
 * @category mapping
 * @since 0.0.0
 */
export const caughtErrorValue = (thrown: unknown): unknown =>
  pipe(
    Result.try(() => {
      if (InterpreterFailure.guards.ProgramThrow(thrown)) return thrown.value;
      if (InterpreterFailure.guards.InterpreterRuntimeError(thrown)) {
        return createErrorValue(thrown.errorName, thrown.message);
      }
      const renderedName = P.isError(thrown) ? renderUnknown(thrown, "name") : "Error";
      const name = S.is(ErrorConstructorName)(renderedName) ? renderedName : "Error";
      return createErrorValue(name, normalizeError(thrown).message);
    }),
    Result.getOrElse(() => createErrorValue("Error", normalizeError(thrown).message))
  );

/**
 * Builds one branded guest Error from a constructor name and `new` arguments.
 *
 * **Details**
 *
 * `args[0]` is coerced to the message string. A missing first argument becomes
 * an empty message, matching `new Error()`.
 *
 * **Example** (Construct a TypeError message)
 *
 * ```ts
 * import { constructErrorValue } from "../../../codemode/interpreter/Interpreter.errors.ts"
 *
 * const error = constructErrorValue("TypeError", ["not a function"])
 * console.log(error.name, error.message)
 * // TypeError not a function
 * ```
 *
 * @see {@link constructAggregateErrorValue} for `new AggregateError` which consumes a sync iterable.
 * @see {@link caughtErrorValue} for wrapping an already-thrown host failure.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Error constructor name and arguments are co-primary inputs for a newly allocated guest error.
export const constructErrorValue = (name: ErrorConstructorName, args: ReadonlyArray<unknown>): SafeObject =>
  createErrorValue(name, P.isUndefined(args[0]) ? "" : coerceToString(args[0]));

/**
 * Builds one branded guest AggregateError from a synchronous iterable of errors.
 *
 * **Gotchas**
 *
 * The first argument must be a synchronous iterable. Async iterables and
 * non-iterables fail with TypeError `"expects a synchronous iterable of errors"`.
 * `args[1]` is the optional message and defaults to `""`.
 *
 * **Example** (Collect a synchronous iterable of guest errors)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { constructAggregateErrorValue } from "../../../codemode/interpreter/Interpreter.errors.ts"
 *
 * const runner = {
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
 * const error = await Effect.runPromise(
 *   constructAggregateErrorValue(
 *     runner,
 *     [["first", "second"], "batch failed"],
 *     { type: "NewExpression" },
 *   ),
 * )
 * console.log(error.name, error.message, error.errors)
 * // AggregateError batch failed [ "first", "second" ]
 * ```
 *
 * @see {@link constructErrorValue} for ordinary `new Error` construction.
 * @see {@link SyncIteratorRunner} for the cursor producer that classifies the first argument.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Aggregate members, message, options, and interpreter context are co-primary construction inputs.
export const constructAggregateErrorValue = <R>(
  runner: SyncIteratorRunner<R>,
  args: ReadonlyArray<unknown>,
  node: AstNode
): Effect.Effect<SafeObject, InterpreterFailure, R> =>
  Effect.gen(function* () {
    const cursor = yield* runner.syncIterator(args[0], node);
    if (P.isUndefined(cursor)) {
      return yield* InterpreterRuntimeError.new(
        "new AggregateError(...) expects a synchronous iterable of errors.",
        node
      ).as("TypeError");
    }
    const errors = A.empty<unknown>();
    while (true) {
      const step = yield* cursor.next;
      if (step.done) {
        return createAggregateErrorValue(errors, P.isUndefined(args[1]) ? "" : coerceToString(args[1]));
      }
      errors.push(step.value);
    }
  });
