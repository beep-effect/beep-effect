import type { SafeObject } from "@beep/schema/SafeObject";
import { A, O, P, Str, pipe } from "@beep/utils";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import {
  DiagnosticKind,
  type AstNode,
  formatLocation,
  type InterpreterFailure,
  InterpreterRuntimeError,
  ProgramThrow,
  sourceLocation,
} from "./Interpreter.model.ts";
import {
  DiagnosticModel,
  DiagnosticLocation,
  ExecutionFailureDiagnostic,
  InvalidDataValueDiagnostic,
  InvalidToolInputDiagnostic,
  InvalidToolOutputDiagnostic,
  ParseErrorDiagnostic,
  TimeoutExceededDiagnostic,
  ToolCallLimitExceededDiagnostic,
  ToolFailureDiagnostic,
  TruncatedDiagnostic,
  UnknownToolDiagnostic,
  UnsupportedSyntaxDiagnostic,
  type Diagnostic,
} from "../Codemode.service.ts";
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

const toWireDiagnostic = (model: DiagnosticModel): Diagnostic =>
  pipe(
    S.encodeUnknownResult(DiagnosticModel)(model),
    Result.getOrElse((): Diagnostic => ({
      kind: "ExecutionFailure",
      message: model.message,
    }))
  );

const makeDiagnostic = (
  kind: DiagnosticKind,
  message: string,
  location?: DiagnosticLocation,
  suggestions?: ReadonlyArray<string>
): Diagnostic =>
  toWireDiagnostic(
    DiagnosticKind.$match(kind, {
      ParseError: () => ParseErrorDiagnostic.new(message, location, suggestions),
      UnsupportedSyntax: () => UnsupportedSyntaxDiagnostic.new(message, location, suggestions),
      UnknownTool: () => UnknownToolDiagnostic.new(message, location, suggestions),
      InvalidToolInput: () => InvalidToolInputDiagnostic.new(message, location, suggestions),
      InvalidToolOutput: () => InvalidToolOutputDiagnostic.new(message, location, suggestions),
      InvalidDataValue: () => InvalidDataValueDiagnostic.new(message, location, suggestions),
      ToolCallLimitExceeded: () => ToolCallLimitExceededDiagnostic.new(message, location, suggestions),
      TimeoutExceeded: () => TimeoutExceededDiagnostic.new(message, location, suggestions),
      ToolFailure: () => ToolFailureDiagnostic.new(message, location, suggestions),
      ExecutionFailure: () => ExecutionFailureDiagnostic.new(message, location, suggestions),
      Truncated: () => TruncatedDiagnostic.new(message, location, suggestions),
    })
  );

/** Normalizes an interpreter, Toolkit, guest, or host failure to public data. */
export const normalizeError = (error: unknown): Diagnostic => {
  if (S.is(InterpreterRuntimeError)(error)) {
    const node = O.getOrUndefined(error.node);
    return makeDiagnostic(
      error.kind,
      `${error.message}${formatLocation(node)}`,
      P.isUndefined(node?.loc)
        ? undefined
        : DiagnosticLocation.new(sourceLocation(node).line, sourceLocation(node).column),
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
  if (S.is(ProgramThrow)(error)) {
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
  if (S.is(ProgramThrow)(thrown)) return thrown.value;
  if (S.is(InterpreterRuntimeError)(thrown)) return createErrorValue(thrown.errorName, thrown.message);
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
