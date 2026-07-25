import type { SafeObject } from "@beep/schema/SafeObject";
import { A, O, P, Str, pipe } from "@beep/utils";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import {
  DiagnosticKind,
  type AstNode,
  formatLocation,
  InterpreterFailure,
  InterpreterRuntimeError,
  sourceLocation,
} from "./Interpreter.model.ts";
import type { Diagnostic } from "../Codemode.service.ts";
import { ToolError } from "../Codemode.tool-error.ts";
import { copyOut, ToolRuntimeError } from "../Codemode.tool-runtime.ts";
import { type SyncIteratorRunner } from "./Interpreter.iterator.ts";
import { containsRuntimeReference } from "./Interpreter.references.ts";
import {
  coerceToString,
  createAggregateErrorValue,
  createErrorValue,
  errorConstructors,
} from "../stdlib/index.ts";

const makeDiagnostic = (
  kind: DiagnosticKind,
  message: string,
  location?: Diagnostic["location"],
  suggestions?: ReadonlyArray<string>
): Diagnostic => ({
  kind,
  message,
  ...(P.isUndefined(location) ? {} : { location }),
  ...(P.isUndefined(suggestions) ? {} : { suggestions }),
});

/** Normalizes an interpreter, Toolkit, guest, or host failure to public data. */
export const normalizeError = (error: unknown): Diagnostic => {
  if (InterpreterFailure.guards.InterpreterRuntimeError(error)) {
    const node = O.getOrUndefined(error.node);
    return makeDiagnostic(
      error.kind,
      `${error.message}${formatLocation(node)}`,
      P.isUndefined(node?.loc)
        ? undefined
        : sourceLocation(node),
      O.getOrUndefined(error.suggestions)
    );
  }
  if (ToolRuntimeError.is(error)) {
    return makeDiagnostic(
      error.kind,
      error.message,
      undefined,
      A.isReadonlyArrayNonEmpty(error.suggestions) ? error.suggestions : undefined
    );
  }
  if (S.is(ToolError)(error)) return makeDiagnostic("ToolFailure", error.message);
  if (InterpreterFailure.guards.ProgramThrow(error)) {
    const value = error.value;
    const message = containsRuntimeReference(value)
      ? "a non-data value"
      : P.isString(value)
        ? value
        : P.isObject(value) && P.hasProperty(value, "message") && P.isString(value.message)
          ? value.message
          : pipe(
              S.encodeUnknownResult(S.UnknownFromJsonString)(copyOut(value, "json")),
              Result.getOrElse(() => globalThis.String(value))
            );
    return makeDiagnostic("ExecutionFailure", `Uncaught: ${message}`);
  }
  if (error instanceof RangeError && pipe(error.message, Str.toLowerCase, Str.includes("call stack"))) {
    return makeDiagnostic("ExecutionFailure", "Execution exceeded the maximum nesting depth.");
  }
  if (P.isError(error)) {
    return makeDiagnostic(error.name === "SyntaxError" ? "ParseError" : "ExecutionFailure", error.message);
  }
  return makeDiagnostic("ExecutionFailure", globalThis.String(error));
};

/** Converts a host-side failure into the guest Error object representation. */
export const caughtErrorValue = (thrown: unknown): unknown => {
  if (InterpreterFailure.guards.ProgramThrow(thrown)) return thrown.value;
  if (InterpreterFailure.guards.InterpreterRuntimeError(thrown)) {
    return createErrorValue(thrown.errorName, thrown.message);
  }
  const name = P.isError(thrown) && S.is(errorConstructors)(thrown.name) ? thrown.name : "Error";
  return createErrorValue(name, normalizeError(thrown).message);
};

/** Constructs one guest Error value. */
export const constructErrorValue = (name: string, args: ReadonlyArray<unknown>): SafeObject =>
  createErrorValue(name, P.isUndefined(args[0]) ? "" : coerceToString(args[0]));

/** Constructs one guest AggregateError value. */
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
