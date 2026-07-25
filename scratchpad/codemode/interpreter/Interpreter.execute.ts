import { parse } from "acorn"
import { A, O, P, Str, pipe } from "@beep/utils";
import { Cause, Effect, Result as Rs, Scope } from "effect"
import * as S from "effect/Schema";
import type * as Toolkit from "effect/unstable/ai/Toolkit";
import { DiagnosticCategory, ModuleKind, ScriptTarget, flattenDiagnosticMessageText, transpileModule } from "typescript"
import type { DataValue, Diagnostic, ExecuteOptions, ResolvedExecutionLimits, Result } from "../Codemode.service.ts"
import { copyIn, copyOut, ToolRuntime, type Services } from "../Codemode.tool-runtime.ts"
import { normalizeError } from "./Interpreter.errors.ts"
import { DiagnosticKind, InterpreterRuntimeError, ProgramNode } from "./Interpreter.model.ts"
import { PromiseRuntime } from "./Interpreter.promises.ts"
import { Interpreter } from "./Interpreter.runtime.ts"

export const executeWithLimits = <ToolkitType extends Toolkit.Toolkit<any>>(
  options: ExecuteOptions<ToolkitType>,
  limits: ResolvedExecutionLimits,
  preparedIndex?: ReadonlyArray<ToolRuntime.SearchEntry>,
): Effect.Effect<Result, never, Services<ToolkitType>> => {
  if (Str.isEmpty(Str.trim(options.code))) {
    return Effect.succeed({
      ok: false,
      error: { kind: "ParseError", message: "Code cannot be empty." },
      toolCalls: [],
    })
  }

  // Allocate execution state inside suspension so reused Effects never share it.
  return Effect.suspend(() => {
    const toolkit = options.toolkit ?? ToolRuntime.emptyToolkit;
    const logs: Array<string> = []
    const logged = () => (A.isReadonlyArrayNonEmpty(logs) ? { logs: A.copy(logs) } : {})
    // Set only after copy-out so timeouts cannot report invalid values as completed.
    let returned: { value: DataValue; promises: PromiseRuntime<Services<ToolkitType>> } | undefined
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
          const result = copyOut(copyIn(value, "Execution result"), "nullify") as DataValue
          returned = { value: result, promises }
          const warnings = yield* promises.interrupt()
          const toolCalls = yield* tools.calls;
          return {
            ok: true,
            value: result,
            ...(A.isReadonlyArrayNonEmpty(warnings) ? { warnings } : {}),
            ...logged(),
            toolCalls,
          } satisfies Result
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
                    return {
                      ok: false,
                      error: { kind: "TimeoutExceeded", message: `Execution timed out after ${timeoutMs}ms.` },
                      ...logged(),
                      toolCalls,
                    } satisfies Result
                  }
                  // Keep the timeout warning first so truncation preserves it.
                  return {
                    ok: true,
                    value: returned.value,
                    warnings: [
                      {
                        kind: "TimeoutExceeded",
                        message: `The program returned, but background work was still running at the ${timeoutMs}ms timeout and was interrupted. Await all started promises.`,
                      },
                      ...returned.promises.diagnostics(),
                    ],
                    ...logged(),
                    toolCalls,
                  } satisfies Result
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
              return {
                ok: false,
                error: normalizeError(Cause.squash(cause)),
                ...logged(),
                toolCalls,
              } satisfies Result;
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

// Warnings have a separate budget so result data cannot starve diagnostics.
const boundOutput = (result: Result, maxOutputBytes: number): Result => {
  let truncated = false

  let value: DataValue = null
  let valueBytes = 0
  if (result.ok) {
    const serialized = pipe(
      S.encodeUnknownResult(S.UnknownFromJsonString)(result.value),
      Rs.getOrElse(() => "null")
    );
    const bytes = utf8ByteLength(serialized)
    if (bytes > maxOutputBytes) {
      truncated = true
      value = `${utf8Truncate(serialized, maxOutputBytes)} [result truncated: ${bytes} bytes exceeds the ${maxOutputBytes}-byte output limit; return a smaller value]`
      valueBytes = maxOutputBytes
    } else {
      value = result.value
      valueBytes = bytes
    }
  }

  const warnings = result.ok ? (result.warnings ?? []) : []
  const keptWarnings: Array<Diagnostic> = []
  let warningBytes = 0
  for (const warning of warnings) {
    const bytes =
      utf8ByteLength(
        pipe(
          S.encodeUnknownResult(S.UnknownFromJsonString)(warning),
          Rs.getOrElse(() => "null")
        )
      ) + 1
    if (warningBytes + bytes > maxOutputBytes) break
    warningBytes += bytes
    keptWarnings.push(warning)
  }
  if (keptWarnings.length < warnings.length) {
    truncated = true
    keptWarnings.push({
      kind: "Truncated",
      message: `${warnings.length - keptWarnings.length} additional warnings omitted by the output limit.`,
    })
  }

  const logs = result.logs ?? []
  const kept: Array<string> = []
  const logBudget = Math.max(0, maxOutputBytes - valueBytes)
  let logBytes = 0
  for (const line of logs) {
    const lineBytes = utf8ByteLength(line) + 1
    if (logBytes + lineBytes > logBudget) break
    logBytes += lineBytes
    kept.push(line)
  }
  if (kept.length < logs.length) {
    truncated = true
    kept.push(`[logs truncated: showing ${kept.length} of ${logs.length} lines]`)
  }

  if (!truncated) return result
  const warningsPart = keptWarnings.length > 0 ? { warnings: keptWarnings } : {}
  const logsPart = kept.length > 0 ? { logs: kept } : {}
  return result.ok
    ? {
        ok: true,
        value,
        ...warningsPart,
        ...logsPart,
        truncated: true,
        toolCalls: result.toolCalls,
      }
    : { ok: false, error: result.error, ...logsPart, truncated: true, toolCalls: result.toolCalls }
}
