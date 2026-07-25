/**
 * Public CodeMode schemas and Effect-native runtime construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import {
  NonEmptyTrimmedStr,
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
import { DiagnosticKind } from "./interpreter/Interpreter.model.ts";
import { ToolRuntime, type Services, type ToolDescription } from "./Codemode.tool-runtime.ts";

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
  static readonly new = (
    timeoutMs?: number,
    maxToolCalls?: number,
    maxOutputBytes?: number
  ): ExecutionLimits =>
    ExecutionLimits.make({
      timeoutMs: O.map(O.fromNullishOr(timeoutMs), PosInt.make),
      maxToolCalls: O.map(O.fromNullishOr(maxToolCalls), NonNegativeInt.make),
      maxOutputBytes: O.map(O.fromNullishOr(maxOutputBytes), NonNegativeInt.make),
    });
}

/**
 * Limits in the numeric representation consumed by the evaluator.
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedExecutionLimits extends S.Class<ResolvedExecutionLimits>($I`ResolvedExecutionLimits`)(
  {
    timeoutMs: S.Option(PosInt).pipe(SchemaUtils.withNoneDefault),
    maxToolCalls: S.Option(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
    maxOutputBytes: S.Option(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ResolvedExecutionLimits", {
    description: "Validated execution limits represented without nullish core values.",
  })
) {
  static readonly new = (
    timeoutMs: O.Option<PosInt>,
    maxToolCalls: O.Option<NonNegativeInt>,
    maxOutputBytes: O.Option<NonNegativeInt>
  ): ResolvedExecutionLimits => ResolvedExecutionLimits.make({ timeoutMs, maxToolCalls, maxOutputBytes });
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

/** A JSON value that can cross the confined interpreter boundary. */
export const DataValue = S.Json.pipe(
  $I.annoteSchema("DataValue", {
    description: "A JSON value returned across the CodeMode execution boundary.",
  })
);

/** Runtime type for {@link DataValue}. */
export type DataValue = typeof DataValue.Type;

/** Schema for a host tool input containing CodeMode source. */
export class Input extends S.Class<Input>($I`Input`)(
  { code: S.String },
  $I.annote("Input", {
    description: "Source for one CodeMode program.",
  })
) {
  static readonly new = (code: string): Input => Input.make({ code });
}

/**
 * Location attached to a diagnostic.
 *
 * @category models
 * @since 0.0.0
 */
export class DiagnosticLocation extends S.Class<DiagnosticLocation>($I`DiagnosticLocation`)(
  {
    line: NonNegativeInt,
    column: NonNegativeInt,
  },
  $I.annote("DiagnosticLocation", {
    description: "One-based source location in user-provided CodeMode source.",
  })
) {
  static readonly new = (line: number, column: number): DiagnosticLocation =>
    DiagnosticLocation.make({
      line: NonNegativeInt.make(line),
      column: NonNegativeInt.make(column),
    });
}

const diagnosticFields = <const Kind extends DiagnosticKind>(kind: Kind) => ({
  kind: S.tag(kind),
  message: S.String,
  location: S.OptionFromOptionalKey(DiagnosticLocation).pipe(SchemaUtils.withNoneDefault),
  suggestions: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});

const diagnosticProps = (
  message: string,
  location?: DiagnosticLocation,
  suggestions?: ReadonlyArray<string>
) => ({
  message,
  location: O.fromNullishOr(location),
  suggestions: O.fromNullishOr(suggestions),
});

/** Parse diagnostic. */
export class ParseErrorDiagnostic extends S.Class<ParseErrorDiagnostic>($I`ParseErrorDiagnostic`)(
  diagnosticFields("ParseError"),
  $I.annote("ParseErrorDiagnostic", { description: "CodeMode source could not be parsed." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): ParseErrorDiagnostic => ParseErrorDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Unsupported-syntax diagnostic. */
export class UnsupportedSyntaxDiagnostic extends S.Class<UnsupportedSyntaxDiagnostic>(
  $I`UnsupportedSyntaxDiagnostic`
)(
  diagnosticFields("UnsupportedSyntax"),
  $I.annote("UnsupportedSyntaxDiagnostic", { description: "Parsed syntax is outside the supported subset." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): UnsupportedSyntaxDiagnostic => UnsupportedSyntaxDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Unknown-tool diagnostic. */
export class UnknownToolDiagnostic extends S.Class<UnknownToolDiagnostic>($I`UnknownToolDiagnostic`)(
  diagnosticFields("UnknownTool"),
  $I.annote("UnknownToolDiagnostic", { description: "A requested tool or namespace does not exist." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): UnknownToolDiagnostic => UnknownToolDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Invalid tool-input diagnostic. */
export class InvalidToolInputDiagnostic extends S.Class<InvalidToolInputDiagnostic>($I`InvalidToolInputDiagnostic`)(
  diagnosticFields("InvalidToolInput"),
  $I.annote("InvalidToolInputDiagnostic", { description: "A tool call failed parameter decoding." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): InvalidToolInputDiagnostic => InvalidToolInputDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Invalid tool-output diagnostic. */
export class InvalidToolOutputDiagnostic extends S.Class<InvalidToolOutputDiagnostic>($I`InvalidToolOutputDiagnostic`)(
  diagnosticFields("InvalidToolOutput"),
  $I.annote("InvalidToolOutputDiagnostic", { description: "A tool returned a value outside its result schema." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): InvalidToolOutputDiagnostic => InvalidToolOutputDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Invalid data-value diagnostic. */
export class InvalidDataValueDiagnostic extends S.Class<InvalidDataValueDiagnostic>($I`InvalidDataValueDiagnostic`)(
  diagnosticFields("InvalidDataValue"),
  $I.annote("InvalidDataValueDiagnostic", { description: "A value cannot cross the plain-data boundary." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): InvalidDataValueDiagnostic => InvalidDataValueDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Tool-call-limit diagnostic. */
export class ToolCallLimitExceededDiagnostic extends S.Class<ToolCallLimitExceededDiagnostic>(
  $I`ToolCallLimitExceededDiagnostic`
)(
  diagnosticFields("ToolCallLimitExceeded"),
  $I.annote("ToolCallLimitExceededDiagnostic", { description: "Execution exhausted its tool-call budget." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): ToolCallLimitExceededDiagnostic =>
    ToolCallLimitExceededDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Timeout diagnostic. */
export class TimeoutExceededDiagnostic extends S.Class<TimeoutExceededDiagnostic>($I`TimeoutExceededDiagnostic`)(
  diagnosticFields("TimeoutExceeded"),
  $I.annote("TimeoutExceededDiagnostic", { description: "Execution exhausted its wall-clock budget." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): TimeoutExceededDiagnostic => TimeoutExceededDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Host-tool-failure diagnostic. */
export class ToolFailureDiagnostic extends S.Class<ToolFailureDiagnostic>($I`ToolFailureDiagnostic`)(
  diagnosticFields("ToolFailure"),
  $I.annote("ToolFailureDiagnostic", { description: "A host tool failed during execution." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): ToolFailureDiagnostic => ToolFailureDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** General execution diagnostic. */
export class ExecutionFailureDiagnostic extends S.Class<ExecutionFailureDiagnostic>($I`ExecutionFailureDiagnostic`)(
  diagnosticFields("ExecutionFailure"),
  $I.annote("ExecutionFailureDiagnostic", { description: "Guest evaluation failed." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): ExecutionFailureDiagnostic => ExecutionFailureDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/** Output-truncation diagnostic. */
export class TruncatedDiagnostic extends S.Class<TruncatedDiagnostic>($I`TruncatedDiagnostic`)(
  diagnosticFields("Truncated"),
  $I.annote("TruncatedDiagnostic", { description: "Output was truncated to remain inside its byte budget." })
) {
  static readonly new = (
    message: string,
    location?: DiagnosticLocation,
    suggestions?: ReadonlyArray<string>
  ): TruncatedDiagnostic => TruncatedDiagnostic.make(diagnosticProps(message, location, suggestions));
}

/**
 * Internal tagged diagnostic model.
 *
 * @category models
 * @since 0.0.0
 */
export const DiagnosticModel = S.Union([
  ParseErrorDiagnostic,
  UnsupportedSyntaxDiagnostic,
  UnknownToolDiagnostic,
  InvalidToolInputDiagnostic,
  InvalidToolOutputDiagnostic,
  InvalidDataValueDiagnostic,
  ToolCallLimitExceededDiagnostic,
  TimeoutExceededDiagnostic,
  ToolFailureDiagnostic,
  ExecutionFailureDiagnostic,
  TruncatedDiagnostic,
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DiagnosticModel", {
    description: "Schema-owned tagged union of every CodeMode diagnostic.",
  })
);

/** Runtime type for {@link DiagnosticModel}. */
export type DiagnosticModel = typeof DiagnosticModel.Type;

/** Wire-compatible encoded diagnostic schema. */
export const Diagnostic = S.toEncoded(DiagnosticModel).pipe(
  $I.annoteSchema("Diagnostic", {
    description: "A normalized diagnostic safe to return across an application boundary.",
  })
);

/** Runtime type for {@link Diagnostic}. */
export type Diagnostic = typeof Diagnostic.Type;

/** One tool call admitted during execution. */
export class ToolCallSchema extends S.Class<ToolCallSchema>($I`ToolCallSchema`)(
  { name: NonEmptyTrimmedStr },
  $I.annote("ToolCallSchema", {
    description: "Canonical name of one admitted tool call.",
  })
) {
  static readonly new = (name: string): ToolCallSchema =>
    ToolCallSchema.make({ name: NonEmptyTrimmedStr.make(name) });
}

/** Successful internal result model. */
export class SuccessModel extends S.Class<SuccessModel>($I`SuccessModel`)(
  {
    ok: S.Literal(true),
    value: DataValue,

    warnings: DiagnosticModel.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    logs: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    truncated: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    toolCalls: S.Array(ToolCallSchema),
  },
  $I.annote("SuccessModel", {
    description: "Successful execution before Option fields are encoded for the wire.",
  })
) {
  static readonly new = (
    value: DataValue,
    toolCalls: ReadonlyArray<ToolCallSchema>,
    warnings?: ReadonlyArray<DiagnosticModel>,
    logs?: ReadonlyArray<string>,
    truncated?: boolean
  ): SuccessModel =>
    SuccessModel.make({
      ok: true,
      value,
      warnings: O.fromNullishOr(warnings),
      logs: O.fromNullishOr(logs),
      truncated: O.fromNullishOr(truncated),
      toolCalls,
    });
}

/** Failed internal result model. */
export class FailureModel extends S.Class<FailureModel>($I`FailureModel`)(
  {
    ok: S.Literal(false),
    error: DiagnosticModel,
    logs: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    truncated: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    toolCalls: S.Array(ToolCallSchema),
  },
  $I.annote("FailureModel", {
    description: "Failed execution before Option fields are encoded for the wire.",
  })
) {
  static readonly new = (
    error: DiagnosticModel,
    toolCalls: ReadonlyArray<ToolCallSchema>,
    logs?: ReadonlyArray<string>,
    truncated?: boolean
  ): FailureModel =>
    FailureModel.make({
      ok: false,
      error,
      logs: O.fromNullishOr(logs),
      truncated: O.fromNullishOr(truncated),
      toolCalls,
    });
}

/** Internal result schema. */
export const ResultModel = S.Union([SuccessModel, FailureModel]).pipe(
  $I.annoteSchema("ResultModel", {
    description: "Schema-owned success or failure model.",
  })
);

/** Wire-compatible result schema. */
export const Result = S.toEncoded(ResultModel).pipe(
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

const decodeExecutionLimits = S.decodeUnknownEffect(ExecutionLimits);

/** Decodes raw application limits into the Option-owned core model. */
export const resolveExecutionLimits = (
  limits?: unknown
): Effect.Effect<ResolvedExecutionLimits, InvalidExecutionLimits> =>
  decodeExecutionLimits(limits ?? {}).pipe(
    Effect.mapError(InvalidExecutionLimits.new),
    Effect.map((decoded) =>
      ResolvedExecutionLimits.new(decoded.timeoutMs, decoded.maxToolCalls, decoded.maxOutputBytes)
    )
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
