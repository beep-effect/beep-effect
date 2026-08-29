import { Unknown } from "@beep/schema/Unknown";
import type { SafeObject } from "@beep/schema/SafeObject";
import { PosInt } from "@beep/schema";
import { A, O, P, Str, pipe } from "@beep/utils";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import {
  ErrorConstructorName,
  type AstNode,
  formatLocation,
  InterpreterFailure,
  InterpreterRuntimeError,
  sourceLocation,
} from "./Interpreter.model.ts";
import {
  DiagnosticLocation,
  DiagnosticModel,
} from "../Codemode.result.ts";
import { ToolError } from "../Codemode.tool-error.ts";
import { copyOut, ToolRuntimeError } from "../Codemode.tool-runtime.ts";
import { type SyncIteratorRunner } from "./Interpreter.iterator.ts";
import { containsRuntimeReference } from "./Interpreter.references.ts";
import {
  coerceToString,
  createAggregateErrorValue,
  createErrorValue,
} from "../stdlib/index.ts";

const renderUnknown = (
  value: unknown,
  property?: "name" | "message"
): string =>
  pipe(
    Result.try(() =>
      globalThis.String(
        P.isUndefined(property)
          ? value
          : P.isObject(value)
            ? Reflect.get(value, property)
            : undefined
      )
    ),
    Result.getOrElse(() => "<unprintable>")
  );

/** Normalizes an interpreter, Toolkit, guest, or host failure. */
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

/** Converts a host-side failure into the guest Error object representation. */
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

/** Constructs one guest Error value. */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const constructErrorValue = (name: ErrorConstructorName, args: ReadonlyArray<unknown>): SafeObject =>
  createErrorValue(name, P.isUndefined(args[0]) ? "" : coerceToString(args[0]));

/** Constructs one guest AggregateError value. */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
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
        return createAggregateErrorValue(
          errors,
          P.isUndefined(args[1]) ? "" : coerceToString(args[1])
        );
      }
      errors.push(step.value);
    }
  });
