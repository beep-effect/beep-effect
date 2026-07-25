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
  TaggedErrorClass,
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
 * @category errors
 * @since 0.0.0
 */
export class InvalidExecutionLimits extends TaggedErrorClass<InvalidExecutionLimits>($I`InvalidExecutionLimits`)(
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

/** Options for one CodeMode execution. */
export type ExecuteOptions<
  ToolkitType extends Toolkit.Toolkit<any> = typeof import("effect/unstable/ai/Toolkit").empty,
> = {
  readonly code: string;
  readonly toolkit?: ToolkitType;
  readonly limits?: unknown;
  readonly onToolCallStart?: ToolRuntime.ToolCallHooks<Services<ToolkitType>>["onToolCallStart"];
  readonly onToolCallEnd?: ToolRuntime.ToolCallHooks<Services<ToolkitType>>["onToolCallEnd"];
};

/** Configuration shared by {@link execute} and {@link make}. */
export type Options<
  ToolkitType extends Toolkit.Toolkit<any> = typeof import("effect/unstable/ai/Toolkit").empty,
> = Omit<
  ExecuteOptions<ToolkitType>,
  "code"
>;

/** Reusable confined runtime over one Effect AI Toolkit. */
export type Runtime<R = never> = {
  readonly catalog: () => ReadonlyArray<ToolDescription>;
  readonly execute: (code: string) => Effect.Effect<Result, never, R>;
};

/** Decodes raw application limits into the Option-owned core model. */
export const resolveExecutionLimits = (
  limits?: unknown
): Effect.Effect<ExecutionLimits, InvalidExecutionLimits> =>
  ExecutionLimits.decodeEffect(limits ?? {}).pipe(
    Effect.mapError(InvalidExecutionLimits.new)
  );

/** Executes one Effect-native CodeMode program. */
export const execute = <
  ToolkitType extends Toolkit.Toolkit<any> = typeof import("effect/unstable/ai/Toolkit").empty,
>(
  options: ExecuteOptions<ToolkitType>
): Effect.Effect<Result, InvalidExecutionLimits, Services<ToolkitType>> =>
  Effect.flatMap(resolveExecutionLimits(options.limits), (limits) =>
    executeWithLimits(options, limits).pipe(Effect.flatMap(encodeResultModel))
  );

/** Creates a reusable Effect-native runtime over a Toolkit. */
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
