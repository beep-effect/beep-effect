/**
 * Public CodeMode schemas and Effect-native runtime construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import {
  NonNegativeInt,
  PosInt,
  SchemaUtils,
} from "@beep/schema";
import { A, O } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type * as Toolkit from "effect/unstable/ai/Toolkit";
import { executeWithLimits } from "./interpreter/Interpreter.execute.ts";
import {
  type Services,
  type ToolDescription,
} from "./Codemode.tool-runtime.ts";
import * as ToolRuntime from "./Codemode.tool-runtime.ts";
import {
  encodeResultModel,
  type Result,
} from "./Codemode.result.ts";

export { DataValue } from "./Codemode.data.ts";
export {
  Diagnostic,
  DiagnosticLocation,
  DiagnosticModel,
  FailureModel,
  Result,
  ResultModel,
  SuccessModel,
} from "./Codemode.result.ts";

const $I = $ScratchpadId.create("codemode/Codemode.service");

/**
 * Resource budgets accepted at the application boundary.
 *
 * **Gotchas**
 *
 * Omitted fields decode to `O.none()` via `withNoneDefault`. That is an explicit
 * Option-owned "no limit", not an unlimited numeric sentinel.
 *
 * **Example** (Decode omitted vs present limits)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const omitted = S.decodeUnknownSync(CodeMode.ExecutionLimits)({})
 * const bounded = S.decodeUnknownSync(CodeMode.ExecutionLimits)({ timeoutMs: 5_000 })
 *
 * console.log(O.isNone(omitted.timeoutMs)) // true
 * console.log(O.isSome(bounded.timeoutMs)) // true
 * ```
 *
 * @see {@link resolveExecutionLimits} for decoding unknown application input into this model.
 * @category models
 * @since 0.0.0
 */
export class ExecutionLimits extends S.Class<ExecutionLimits>($I`ExecutionLimits`)(
  {
    timeoutMs: S.OptionFromOptionalKey(PosInt).pipe(SchemaUtils.withNoneDefault),
    maxToolCalls: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
    maxOutputBytes: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExecutionLimits", {
    description: "Optional per-execution limits decoded once into Effect Option values.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ExecutionLimits);
}

/**
 * Typed boundary failure raised when execution limits cannot be decoded.
 *
 * **Gotchas**
 *
 * {@link InvalidExecutionLimits.new} always uses the frozen message
 * `Execution limits must contain safe non-negative integers; timeoutMs must be at least 1.`
 *
 * **Example** (Construct the typed limits failure)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 *
 * const error = CodeMode.InvalidExecutionLimits.new({ timeoutMs: 0 })
 *
 * console.log(CodeMode.InvalidExecutionLimits.is(error)) // true
 * console.log(error.message.startsWith("Execution limits must contain")) // true
 * ```
 *
 * @see {@link resolveExecutionLimits} for the decoder that raises this error.
 * @category errors
 * @since 0.0.0
 */
export class InvalidExecutionLimits extends S.TaggedError<InvalidExecutionLimits>($I`InvalidExecutionLimits`)(
  "InvalidExecutionLimits",
  {
    message: S.String,
    cause: S.OptionFromOptionalKey(S.Defect()).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("InvalidExecutionLimits", {
    description: "Execution limits failed schema validation.",
  })
) {
  static readonly new = (cause: unknown): InvalidExecutionLimits =>
    InvalidExecutionLimits.make({
      message: "Execution limits must contain safe non-negative integers; timeoutMs must be at least 1.",
      cause: O.some(cause),
    });
}

/**
 * Options for one CodeMode execution, including the guest source string.
 *
 * @see {@link Options} for the reusable subset that omits `code`.
 * @see {@link execute} for the one-shot runner that consumes this type.
 * @category type-level
 * @since 0.0.0
 */
export type ExecuteOptions<
  ToolkitType extends Toolkit.Toolkit<any> = typeof import("effect/unstable/ai/Toolkit").empty,
> = {
  readonly code: string;
  readonly toolkit?: ToolkitType;
  readonly limits?: unknown;
  readonly onToolCallStart?: ToolRuntime.ToolCallHooks<Services<ToolkitType>>["onToolCallStart"];
  readonly onToolCallEnd?: ToolRuntime.ToolCallHooks<Services<ToolkitType>>["onToolCallEnd"];
};

/**
 * Configuration shared by {@link execute} and {@link make}, omitting `code`.
 *
 * @see {@link ExecuteOptions} for the one-shot shape that adds the guest source string.
 * @category type-level
 * @since 0.0.0
 */
export type Options<
  ToolkitType extends Toolkit.Toolkit<any> = typeof import("effect/unstable/ai/Toolkit").empty,
> = Omit<
  ExecuteOptions<ToolkitType>,
  "code"
>;

/**
 * Reusable confined runtime over one Effect AI Toolkit.
 *
 * @see {@link make} for the constructor that decodes limits once and returns this runtime.
 * @category type-level
 * @since 0.0.0
 */
export type Runtime<R = never> = {
  readonly catalog: () => ReadonlyArray<ToolDescription>;
  readonly execute: (code: string) => Effect.Effect<Result, never, R>;
};

/**
 * Decodes raw application limits into the Option-owned core model.
 *
 * **Gotchas**
 *
 * `undefined` is decoded as `{}`, so omitted fields become `O.none()` rather
 * than leaving the decoder uninvoked.
 *
 * **Example** (Decode missing application limits)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * Effect.runPromise(CodeMode.resolveExecutionLimits(undefined)).then((limits) => {
 *   console.log(O.isNone(limits.timeoutMs)) // true
 * })
 * ```
 *
 * @see {@link ExecutionLimits} for the Option-owned model this decoder produces.
 * @see {@link InvalidExecutionLimits} for the typed failure when decoding fails.
 * @category decoding
 * @since 0.0.0
 */
export const resolveExecutionLimits = (
  limits?: unknown
): Effect.Effect<ExecutionLimits, InvalidExecutionLimits> =>
  ExecutionLimits.decodeEffect(limits ?? {}).pipe(
    Effect.mapError(InvalidExecutionLimits.new)
  );

/**
 * Executes one Effect-native CodeMode program, preparing the toolkit per call.
 *
 * **Gotchas**
 *
 * The error channel is only {@link InvalidExecutionLimits}. Prefer {@link make}
 * when the toolkit should be prepared once and reused. {@link make} also
 * surfaces {@link ToolRuntime.ToolRuntimeError}.
 *
 * **Example** (Run a one-shot program)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import { Effect } from "effect"
 *
 * Effect.runPromise(CodeMode.execute({ code: "return 1 + 1" })).then((result) => {
 *   console.log(result.ok) // true
 *   if (result.ok) console.log(result.value) // 2
 * })
 * ```
 *
 * @see {@link make} for a reusable runtime that decodes limits and prepares the toolkit once.
 * @category factories
 * @since 0.0.0
 */
export const execute = <
  ToolkitType extends Toolkit.Toolkit<any> = typeof import("effect/unstable/ai/Toolkit").empty,
>(
  options: ExecuteOptions<ToolkitType>
): Effect.Effect<Result, InvalidExecutionLimits, Services<ToolkitType>> =>
  Effect.flatMap(resolveExecutionLimits(options.limits), (limits) =>
    executeWithLimits(options, limits).pipe(Effect.flatMap(encodeResultModel))
  );

/**
 * Creates a reusable Effect-native runtime over a Toolkit.
 *
 * **Gotchas**
 *
 * Limits are decoded once and the toolkit is `ToolRuntime.prepare`d before the
 * returned {@link Runtime} can execute. The error channel is
 * {@link InvalidExecutionLimits} | {@link ToolRuntime.ToolRuntimeError}.
 * This constructor is not {@link ToolRuntime.make}, which builds execution-local
 * Toolkit adapter state. Omitting `toolkit` uses {@link ToolRuntime.emptyToolkit}.
 *
 * **Example** (Make a runtime, then execute)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import { Effect } from "effect"
 *
 * Effect.runPromise(
 *   Effect.gen(function* () {
 *     const runtime = yield* CodeMode.make({})
 *     return yield* runtime.execute("return 1 + 1")
 *   })
 * ).then((result) => {
 *   console.log(result.ok) // true
 * })
 * ```
 *
 * @see {@link execute} for the one-shot runner that prepares the toolkit per call.
 * @see {@link ToolRuntime.make} for the execution-local Toolkit adapter constructor.
 * @see {@link ToolRuntime.emptyToolkit} for the default toolkit when none is provided.
 * @category factories
 * @since 0.0.0
 */
export const make = <
  ToolkitType extends Toolkit.Toolkit<any> = typeof import("effect/unstable/ai/Toolkit").empty,
>(
  options: Options<ToolkitType>
): Effect.Effect<Runtime<Services<ToolkitType>>, InvalidExecutionLimits | ToolRuntime.ToolRuntimeError> =>
  Effect.gen(function* () {
    const limits = yield* resolveExecutionLimits(options.limits);
    const toolkit = options.toolkit ?? ToolRuntime.emptyToolkit;
    const prepared = yield* Effect.fromResult(ToolRuntime.prepare(toolkit));
    return {
      catalog: () => A.copy(prepared.catalog),
      execute: (code) =>
        executeWithLimits({ ...options, toolkit, code }, limits, prepared.searchIndex).pipe(
          Effect.flatMap(encodeResultModel)
        ),
    };
  });
