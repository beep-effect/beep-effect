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
import { A, O, P } from "@beep/utils";
import { Effect, SchemaGetter } from "effect";
import * as S from "effect/Schema";
import type * as Toolkit from "effect/unstable/ai/Toolkit";
import { executeWithLimits } from "./interpreter/Interpreter.execute.ts";
import { DiagnosticKind } from "./interpreter/Interpreter.model.ts";
import {
  ToolCall,
  type Services,
  type ToolDescription,
} from "./Codemode.tool-runtime.ts";
import * as ToolRuntime from "./Codemode.tool-runtime.ts";
import { DataValue } from "./Codemode.data.ts";

export { DataValue } from "./Codemode.data.ts";

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

/**
 * Location attached to a diagnostic.
 *
 * @category models
 * @since 0.0.0
 */
export class DiagnosticLocation extends S.Class<DiagnosticLocation>($I`DiagnosticLocation`)(
  {
    line: PosInt,
    column: PosInt,
  },
  $I.annote("DiagnosticLocation", {
    description: "One-based source location in user-provided CodeMode source.",
  })
) {}

/**
 * Internal diagnostic model.
 *
 * @category models
 * @since 0.0.0
 */
export class DiagnosticModel extends S.Class<DiagnosticModel>($I`DiagnosticModel`)(
  {
    kind: DiagnosticKind,
    message: S.String,
    location: S.OptionFromOptionalKey(DiagnosticLocation).pipe(SchemaUtils.withNoneDefault),
    suggestions: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("DiagnosticModel", {
    description: "Schema-owned CodeMode diagnostic with a finite kind domain.",
  })
) {
  static readonly new = (
    kind: DiagnosticKind,
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): DiagnosticModel =>
    DiagnosticModel.make({
      kind,
      message,
      location: O.fromNullishOr(location),
      suggestions: O.fromNullishOr(suggestions),
    });
}

/** Wire-compatible encoded diagnostic schema. */
export const Diagnostic = S.toEncoded(DiagnosticModel).pipe(
  $I.annoteSchema("Diagnostic", {
    description: "A normalized diagnostic safe to return across an application boundary.",
  })
);

/** Runtime type for {@link Diagnostic}. */
export type Diagnostic = typeof Diagnostic.Type;

/** Successful internal result model. */
export class SuccessModel extends S.TaggedClass<SuccessModel>($I`SuccessModel`)(
  "Success",
  {
    value: DataValue,
    warnings: DiagnosticModel.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    logs: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    truncated: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    toolCalls: S.Array(ToolCall),
  },
  $I.annote("SuccessModel", {
    description: "Successful execution before Option fields are encoded for the wire.",
  })
) {}

/** Failed internal result model. */
export class FailureModel extends S.TaggedClass<FailureModel>($I`FailureModel`)(
  "Failure",
  {
    error: DiagnosticModel,
    logs: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    truncated: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    toolCalls: S.Array(ToolCall),
  },
  $I.annote("FailureModel", {
    description: "Failed execution before Option fields are encoded for the wire.",
  })
) {}

/** Internal result schema. */
export const ResultModel = S.Union([SuccessModel, FailureModel]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ResultModel", {
    description: "Schema-owned success or failure model.",
  }),
  SchemaUtils.withCodecStatics
);

const ResultWire = S.Union([
  S.Struct({
    ok: S.Literal(true),
    value: DataValue,
    warnings: Diagnostic.pipe(S.Array, S.optionalKey),
    logs: S.String.pipe(S.Array, S.optionalKey),
    truncated: S.optionalKey(S.Boolean),
    toolCalls: ToolCall.pipe(S.toEncoded, S.Array),
  }),
  S.Struct({
    ok: S.Literal(false),
    error: Diagnostic,
    logs: S.String.pipe(S.Array, S.optionalKey),
    truncated: S.optionalKey(S.Boolean),
    toolCalls: ToolCall.pipe(S.toEncoded, S.Array),
  }),
]);

const ResultCodec = ResultWire.pipe(
  S.decodeTo(ResultModel, {
    decode: SchemaGetter.transform((result) =>
      result.ok
        ? {
            _tag: "Success" as const,
            value: result.value,
            ...(P.isUndefined(result.warnings) ? {} : { warnings: result.warnings }),
            ...(P.isUndefined(result.logs) ? {} : { logs: result.logs }),
            ...(P.isUndefined(result.truncated) ? {} : { truncated: result.truncated }),
            toolCalls: result.toolCalls,
          }
        : {
            _tag: "Failure" as const,
            error: result.error,
            ...(P.isUndefined(result.logs) ? {} : { logs: result.logs }),
            ...(P.isUndefined(result.truncated) ? {} : { truncated: result.truncated }),
            toolCalls: result.toolCalls,
          }
    ),
    encode: SchemaGetter.transform((result) => {
      if (result._tag === "Success") {
        return {
          ok: true,
          value: result.value,
          ...(P.isUndefined(result.warnings) ? {} : { warnings: result.warnings }),
          ...(P.isUndefined(result.logs) ? {} : { logs: result.logs }),
          ...(P.isUndefined(result.truncated) ? {} : { truncated: result.truncated }),
          toolCalls: result.toolCalls,
        };
      }
      return {
        ok: false,
        error: result.error,
        ...(P.isUndefined(result.logs) ? {} : { logs: result.logs }),
        ...(P.isUndefined(result.truncated) ? {} : { truncated: result.truncated }),
        toolCalls: result.toolCalls,
      };
    }),
  })
);

/** Wire-compatible result schema. */
export const Result = S.toEncoded(ResultCodec).pipe(
  $I.annoteSchema("Result", {
    description: "Structured success or diagnostic returned by CodeMode execution.",
  })
);

/** Runtime type for {@link Result}. */
export type Result = typeof Result.Type;

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
  Effect.flatMap(resolveExecutionLimits(options.limits), (limits) => executeWithLimits(options, limits));

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
      execute: (code) => executeWithLimits({ ...options, toolkit, code }, limits, prepared.searchIndex),
    };
  });
