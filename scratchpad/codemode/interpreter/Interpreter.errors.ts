import type { SafeObject } from "@beep/schema/SafeObject";
import { PosInt } from "@beep/schema";
import { A, O, P, Str, pipe } from "@beep/utils";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import {
  DiagnosticKind,
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

const makeDiagnosticModel = (
  kind: DiagnosticKind,
  message: string,
  location?: ReturnType<typeof sourceLocation>,
  suggestions?: ReadonlyArray<string>
): DiagnosticModel =>
  DiagnosticModel.new(
    kind,
    message,
    P.isUndefined(location)
      ? undefined
      : DiagnosticLocation.make({
          line: PosInt.make(location.line),
          column: PosInt.make(location.column),
        }),
    suggestions
  );

/** Normalizes an interpreter, Toolkit, guest, or host failure. */
export const normalizeError = (error: unknown): DiagnosticModel => {
  if (InterpreterFailure.guards.InterpreterRuntimeError(error)) {
    const node = O.getOrUndefined(error.node);
    return makeDiagnosticModel(
      error.kind,
      `${error.message}${formatLocation(node)}`,
      P.isUndefined(node?.loc)
        ? undefined
        : sourceLocation(node),
      O.getOrUndefined(error.suggestions)
    );
  }
  if (ToolRuntimeError.is(error)) {
    return makeDiagnosticModel(
      error.kind,
      error.message,
      undefined,
      A.isReadonlyArrayNonEmpty(error.suggestions) ? error.suggestions : undefined
    );
  }
  if (ToolError.is(error)) return makeDiagnosticModel("ToolFailure", error.message);
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
    return makeDiagnosticModel("ExecutionFailure", `Uncaught: ${message}`);
  }
  if (error instanceof RangeError && pipe(error.message, Str.toLowerCase, Str.includes("call stack"))) {
    return makeDiagnosticModel("ExecutionFailure", "Execution exceeded the maximum nesting depth.");
  }
  if (P.isError(error)) {
    return makeDiagnosticModel(error.name === "SyntaxError" ? "ParseError" : "ExecutionFailure", error.message);
  }
  return makeDiagnosticModel("ExecutionFailure", globalThis.String(error));
};

/** Converts a host-side failure into the guest Error object representation. */
export const caughtErrorValue = (thrown: unknown): unknown => {
  if (InterpreterFailure.guards.ProgramThrow(thrown)) return thrown.value;
  if (InterpreterFailure.guards.InterpreterRuntimeError(thrown)) {
    return createErrorValue(thrown.errorName, thrown.message);
  }
  const name = P.isError(thrown) && S.is(ErrorConstructorName)(thrown.name) ? thrown.name : "Error";
  return createErrorValue(name, normalizeError(thrown).message);
};

/** Constructs one guest Error value. */
export const constructErrorValue = (name: ErrorConstructorName, args: ReadonlyArray<unknown>): SafeObject =>
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
