/**
 * Limit-aware entry that parses, evaluates, copies out, times out, and truncates
 * a guest CodeMode program.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Unknown } from "@beep/schema/Unknown";
import { parse } from "acorn"
import { A, O, P, Str, pipe } from "@beep/utils";
import { Cause, Effect, Result as Rs, Scope } from "effect"
import * as S from "effect/Schema";
import type * as Toolkit from "effect/unstable/ai/Toolkit";
import { DiagnosticCategory, ModuleKind, ScriptTarget, flattenDiagnosticMessageText, transpileModule } from "typescript"
import type {
  ExecuteOptions,
  ExecutionLimits,
} from "../Codemode.service.ts"
import {
  DiagnosticModel,
  FailureModel,
  ResultModel,
  SuccessModel,
} from "../Codemode.result.ts"
import {
  DataValue,
  type DataValue as DataValueType,
} from "../Codemode.data.ts"
import { copyIn, copyOut, type Services } from "../Codemode.tool-runtime.ts"
import * as ToolRuntime from "../Codemode.tool-runtime.ts"
import { normalizeError } from "./Interpreter.errors.ts"
import {
  DiagnosticKind,
  InterpreterRuntimeError,
  ProgramNode,
  tryInterpreter,
} from "./Interpreter.model.ts"
import { PromiseRuntime } from "./Interpreter.promises.ts"
import { Interpreter } from "./Interpreter.runtime.ts"

/**
 * Parses TypeScript, evaluates it in a confined interpreter, copies the result
 * out as data, then applies timeout and output-byte budgets.
 *
 * **Gotchas**
 *
 * Empty trimmed `code` short-circuits to a `FailureModel` `ParseError` and never
 * allocates runtime state. Execution state is allocated inside `Effect.suspend`
 * so a reused Effect does not share logs or tool state. TypeScript is wrapped as
 * `async function __codemode__() { ... }` before Acorn parse; {@link sourceLocation}
 * later undoes that wrapper. Copy-out uses `"nullify"` and is recorded *before*
 * timeout inspection, so a timeout after a successful return is a `SuccessModel`
 * whose first warning is `TimeoutExceeded` rather than a failure. Truncation
 * keeps that timeout warning first, and warnings have a separate byte budget so
 * result data cannot starve diagnostics. The last top-level
 * `ExpressionStatement` is the program result.
 *
 * **Example** (Evaluate a tiny program to a SuccessModel value)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import { Effect } from "effect"
 * import { executeWithLimits } from "../../../codemode/interpreter/Interpreter.execute.ts"
 *
 * const result = await Effect.runPromise(
 *   executeWithLimits({ code: "1 + 1" }, CodeMode.ExecutionLimits.make({})),
 * )
 *
 * console.log(
 *   CodeMode.ResultModel.match(result, {
 *     Success: (success) => success.value,
 *     Failure: (failure) => failure.error.message,
 *   }),
 * )
 * // 2
 * ```
 *
 * @see {@link Interpreter} for evaluation, builtin shadowing, and implicit async adoption.
 * @see {@link PromiseRuntime} for un-awaited rejection diagnostics interrupted on completion.
 * @see {@link ResultModel} for the encoded success-or-failure result.
 * @category workflows
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const executeWithLimits = <ToolkitType extends Toolkit.Toolkit<any>>(
  options: ExecuteOptions<ToolkitType>,
  limits: ExecutionLimits,
  preparedIndex?: ReadonlyArray<ToolRuntime.SearchEntry>,
): Effect.Effect<ResultModel, never, Services<ToolkitType>> => {
  if (Str.isEmpty(Str.trim(options.code))) {
    return Effect.succeed(
      FailureModel.make({
        error: DiagnosticModel.new("ParseError", "Code cannot be empty."),
        logs: O.none(),
        truncated: O.none(),
        toolCalls: A.empty(),
      })
    )
  }

  // Allocate execution state inside suspension so reused Effects never share it.
  return Effect.suspend(() => {
    const toolkit = options.toolkit ?? ToolRuntime.emptyToolkit;
    const logs = A.empty<string>()
    const logged = () =>
      A.isReadonlyArrayNonEmpty(logs) ? O.some(A.copy(logs)) : O.none<ReadonlyArray<string>>()
    // Set only after copy-out so timeouts cannot report invalid values as completed.
    let returned: { value: DataValueType; promises: PromiseRuntime<Services<ToolkitType>> } | undefined
    let toolRuntime: ToolRuntime.ToolRuntime<Services<ToolkitType>> | undefined

    const base = Effect.acquireUseRelease(
      Scope.make("parallel"),
      (scope) =>
        Effect.gen(function* () {
          const prepared = P.isUndefined(preparedIndex)
            ? yield* Effect.fromResult(ToolRuntime.prepare(toolkit))
            : ToolRuntime.DiscoveryPlan.new(A.empty(), preparedIndex);
          const handlers = yield* toolkit;
          const tools = yield* ToolRuntime.make(
            toolkit,
            handlers as never,
            limits.maxToolCalls,
            prepared.searchIndex,
            {
              ...(P.isUndefined(options.onToolCallStart)
                ? {}
                : { onToolCallStart: options.onToolCallStart }),
              ...(P.isUndefined(options.onToolCallEnd)
                ? {}
                : { onToolCallEnd: options.onToolCallEnd }),
            }
          );
          toolRuntime = tools;
          const program = yield* parseProgram(options.code)
          const promises = new PromiseRuntime<Services<ToolkitType>>(scope)
          const interpreter = new Interpreter<Services<ToolkitType>>(
            tools.execute,
            tools.search,
            tools.keys,
            promises,
            logs,
          )
          const value = yield* interpreter.run(program)
          const copied = yield* Effect.fromResult(
            tryInterpreter(
              () => copyOut(copyIn(value, "Execution result"), "nullify")
            )
          )
          const result = yield* S.decodeUnknownEffect(DataValue)(copied).pipe(
            Effect.mapError((cause) =>
              InterpreterRuntimeError.new(
                `Execution result is not a data value: ${cause.message}`,
                undefined,
                DiagnosticKind.Enum.InvalidDataValue
              )
            )
          )
          returned = { value: result, promises }
          const warnings = yield* promises.interrupt()
          const toolCalls = yield* tools.calls;
          return SuccessModel.make({
            value: result,
            warnings: A.isReadonlyArrayNonEmpty(warnings) ? O.some(warnings) : O.none(),
            logs: logged(),
            truncated: O.none(),
            toolCalls,
          })
        }),
      (scope, exit) => Scope.close(scope, exit),
    )
    const operation = pipe(
      limits.timeoutMs,
      O.match({
        onNone: () => base,
        onSome: (timeoutMs) =>
          base.pipe(
            Effect.timeoutOrElse({
              duration: timeoutMs,
              orElse:
                Effect.fnUntraced(function* () {
                  const toolCalls = P.isUndefined(toolRuntime)
                    ? A.empty()
                    : yield* toolRuntime.calls;
                  if (P.isUndefined(returned)) {
                    return FailureModel.make({
                      error: DiagnosticModel.new(
                        "TimeoutExceeded",
                        `Execution timed out after ${timeoutMs}ms.`
                      ),
                      logs: logged(),
                      truncated: O.none(),
                      toolCalls,
                    })
                  }
                  // Keep the timeout warning first so truncation preserves it.
                  return SuccessModel.make({
                    value: returned.value,
                    warnings: O.some([
                      DiagnosticModel.new(
                        "TimeoutExceeded",
                        `The program returned, but background work was still running at the ${timeoutMs}ms timeout and was interrupted. Await all started promises.`
                      ),
                      ...returned.promises.diagnostics(),
                    ]),
                    logs: logged(),
                    truncated: O.none(),
                    toolCalls,
                  })
                }),
            }),
          ),
      })
    );

    return operation.pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.interrupt
          : Effect.gen(function* () {
              const toolCalls = P.isUndefined(toolRuntime)
                ? A.empty()
                : yield* toolRuntime.calls;
              return FailureModel.make({
                error: normalizeError(Cause.squash(cause)),
                logs: logged(),
                truncated: O.none(),
                toolCalls,
              });
            }),
      ),
      Effect.map((result) =>
        pipe(
          limits.maxOutputBytes,
          O.match({
            onNone: () => result,
            onSome: (maxOutputBytes) => boundOutput(result, maxOutputBytes),
          })
        )
      ),
    )
  })
}

const parseProgram = (code: string): Effect.Effect<ProgramNode, InterpreterRuntimeError> =>
  Effect.gen(function* () {
    const transpiled = yield* Effect.try({
      try: () =>
        transpileModule(`async function __codemode__() {\n${code}\n}`, {
          reportDiagnostics: true,
          compilerOptions: {
            target: ScriptTarget.ESNext,
            module: ModuleKind.ESNext,
          },
        }),
      catch: (cause) =>
        InterpreterRuntimeError.new(
          `Failed to transpile TypeScript: ${P.isError(cause) ? cause.message : globalThis.String(cause)}`,
          undefined,
          DiagnosticKind.Enum.ParseError
        ),
    });
    const diagnostic = A.findFirst(
      transpiled.diagnostics ?? A.empty(),
      (item) => item.category === DiagnosticCategory.Error
    );
    if (O.isSome(diagnostic)) {
      return yield* InterpreterRuntimeError.new(
        `Failed to parse TypeScript: ${flattenDiagnosticMessageText(diagnostic.value.messageText, "\n")}`,
        undefined,
        DiagnosticKind.Enum.ParseError
      );
    }
    const bodyStart = pipe(
      transpiled.outputText,
      Str.indexOf("{"),
      O.getOrElse(() => -1)
    ) + 1;
    const bodyEnd = pipe(
      transpiled.outputText,
      Str.lastIndexOf("}"),
      O.getOrElse(() => Str.length(transpiled.outputText))
    );
    const executableCode = pipe(transpiled.outputText, Str.slice(bodyStart, bodyEnd));
    const parsed = yield* Effect.try({
      try: () =>
        parse(executableCode, {
          ecmaVersion: "latest",
          sourceType: "script",
          allowReturnOutsideFunction: true,
          allowAwaitOutsideFunction: true,
          locations: true,
        }),
      catch: (cause) =>
        InterpreterRuntimeError.new(
          P.isError(cause) ? cause.message : globalThis.String(cause),
          undefined,
          DiagnosticKind.Enum.ParseError
        ),
    });
    return yield* S.decodeUnknownEffect(ProgramNode)(parsed).pipe(
      Effect.mapError((cause) =>
        InterpreterRuntimeError.new(
          `Failed to decode script as a Program node: ${cause.message}`,
          undefined,
          DiagnosticKind.Enum.ParseError
        )
      )
    );
  });

const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength

// Drop a replacement character produced by truncating inside a UTF-8 sequence.
const utf8Truncate = (value: string, maxBytes: number): string => {
  const bytes = new TextEncoder().encode(value)
  if (bytes.byteLength <= maxBytes) return value
  const text = new TextDecoder("utf-8").decode(bytes.slice(0, Math.max(0, maxBytes)))
  return text.endsWith("\uFFFD") ? text.slice(0, -1) : text
}

const boundLogs = (logs: ReadonlyArray<string>, maxBytes: number) => {
  const kept = A.empty<string>()
  let bytes = 0
  for (const line of logs) {
    const lineBytes = utf8ByteLength(line) + 1
    if (bytes + lineBytes > maxBytes) break
    bytes += lineBytes
    kept.push(line)
  }
  const truncated = A.length(kept) < A.length(logs)
  if (truncated) {
    kept.push(`[logs truncated: showing ${A.length(kept)} of ${A.length(logs)} lines]`)
  }
  return { kept, truncated }
}

const boundFailureDiagnostic = (
  diagnostic: DiagnosticModel,
  maxOutputBytes: number,
) => {
  const serialized = pipe(
    S.encodeUnknownResult(DiagnosticModel)(diagnostic),
    Rs.flatMap(Unknown.encodeUnknownResultFromJsonString),
    Rs.getOrElse(() => "null")
  )
  const bytes = utf8ByteLength(serialized)
  if (bytes <= maxOutputBytes) {
    return { diagnostic, bytes, truncated: false }
  }
  return {
    diagnostic: DiagnosticModel.new(
      diagnostic.kind,
      `${utf8Truncate(diagnostic.message, maxOutputBytes)} [error truncated: ${bytes} bytes exceeds the ${maxOutputBytes}-byte output limit]`,
      O.getOrUndefined(diagnostic.location),
    ),
    bytes: maxOutputBytes,
    truncated: true,
  }
}

// Warnings have a separate budget so result data cannot starve diagnostics.
const boundOutput = (result: ResultModel, maxOutputBytes: number): ResultModel =>
  ResultModel.match(result, {
    Success: (success) => {
      const serialized = pipe(
        Unknown.encodeUnknownResultFromJsonString(success.value),
        Rs.getOrElse(() => "null")
      )
      const bytes = utf8ByteLength(serialized)
      const valueTruncated = bytes > maxOutputBytes
      const value: DataValueType = valueTruncated
        ? `${utf8Truncate(serialized, maxOutputBytes)} [result truncated: ${bytes} bytes exceeds the ${maxOutputBytes}-byte output limit; return a smaller value]`
        : success.value
      const valueBytes = valueTruncated ? maxOutputBytes : bytes

      const warnings = O.getOrElse(success.warnings, A.empty)
      const keptWarnings = A.empty<DiagnosticModel>()
      let warningBytes = 0
      for (const warning of warnings) {
        const warningJson = pipe(
          S.encodeUnknownResult(DiagnosticModel)(warning),
          Rs.flatMap(Unknown.encodeUnknownResultFromJsonString),
          Rs.getOrElse(() => "null")
        )
        const warningSize = utf8ByteLength(warningJson) + 1
        if (warningBytes + warningSize > maxOutputBytes) break
        warningBytes += warningSize
        keptWarnings.push(warning)
      }
      const warningsTruncated = A.length(keptWarnings) < A.length(warnings)
      if (warningsTruncated) {
        keptWarnings.push(
          DiagnosticModel.new(
            "Truncated",
            `${A.length(warnings) - A.length(keptWarnings)} additional warnings omitted by the output limit.`
          )
        )
      }

      const logs = boundLogs(
        O.getOrElse(success.logs, A.empty),
        Math.max(0, maxOutputBytes - valueBytes)
      )
      if (!valueTruncated && !warningsTruncated && !logs.truncated) return success
      return SuccessModel.make({
        value,
        warnings: A.isReadonlyArrayNonEmpty(keptWarnings) ? O.some(keptWarnings) : O.none(),
        logs: A.isReadonlyArrayNonEmpty(logs.kept) ? O.some(logs.kept) : O.none(),
        truncated: O.some(true),
        toolCalls: success.toolCalls,
      })
    },
    Failure: (failure) => {
      const error = boundFailureDiagnostic(failure.error, maxOutputBytes)
      const logs = boundLogs(
        O.getOrElse(failure.logs, A.empty),
        Math.max(0, maxOutputBytes - error.bytes)
      )
      if (!error.truncated && !logs.truncated) return failure
      return FailureModel.make({
        error: error.diagnostic,
        logs: A.isReadonlyArrayNonEmpty(logs.kept) ? O.some(logs.kept) : O.none(),
        truncated: O.some(true),
        toolCalls: failure.toolCalls,
      })
    },
  })
