/**
 * Internal tagged execution results and their public wire codec.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { PosInt, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { Effect, SchemaGetter } from "effect";
import * as S from "effect/Schema";
import { DataValue } from "./Codemode.data.ts";
import { ToolCall } from "./Codemode.tool-runtime.ts";
import { DiagnosticKind } from "./interpreter/Interpreter.model.ts";

const $I = $ScratchpadId.create("codemode/Codemode.result");

/**
 * One-based source location attached to a diagnostic.
 *
 * **Example** (Construct a parse location)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import * as S from "effect/Schema"
 *
 * const location = S.decodeSync(CodeMode.DiagnosticLocation)({ line: 1, column: 1 })
 *
 * console.log(location.line) // 1
 * console.log(location.column) // 1
 * ```
 *
 * @category diagnostics
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
 * Schema-owned diagnostic with a finite kind domain.
 *
 * **Example** (Construct an internal parse diagnostic)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 *
 * const diagnostic = CodeMode.DiagnosticModel.new(
 *   "ParseError",
 *   "Code cannot be empty."
 * )
 *
 * console.log(diagnostic.kind) // "ParseError"
 * console.log(diagnostic.message) // "Code cannot be empty."
 * ```
 *
 * @see {@link Diagnostic} for the encoded wire schema returned across the application boundary.
 * @category diagnostics
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

/**
 * Encoded diagnostic schema safe to return across an application boundary.
 *
 * **Example** (Decode a wire diagnostic)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import * as S from "effect/Schema"
 *
 * const diagnostic = S.decodeUnknownSync(CodeMode.Diagnostic)({
 *   kind: "ParseError",
 *   message: "Code cannot be empty.",
 * })
 *
 * console.log(diagnostic.kind) // "ParseError"
 * ```
 *
 * @see {@link DiagnosticModel} for the internal Option-owned diagnostic this schema encodes.
 * @category diagnostics
 * @since 0.0.0
 */
export const Diagnostic = S.toEncoded(DiagnosticModel).pipe(
  $I.annoteSchema("Diagnostic", {
    description: "A normalized diagnostic safe to return across an application boundary.",
  })
);

/**
 * Encoded diagnostic value produced by {@link Diagnostic}.
 *
 * @see {@link Diagnostic} for the runtime wire schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Diagnostic = typeof Diagnostic.Type;

/**
 * Successful internal result before Option fields are encoded for the wire.
 *
 * **Example** (Construct a successful internal result)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 *
 * const success = CodeMode.SuccessModel.make({
 *   value: "done",
 *   toolCalls: [],
 * })
 *
 * console.log(success._tag) // "Success"
 * console.log(success.value) // "done"
 * ```
 *
 * @see {@link ResultModel} for the tagged union that includes this success variant.
 * @category models
 * @since 0.0.0
 */
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

/**
 * Failed internal result before Option fields are encoded for the wire.
 *
 * **Example** (Construct a failed internal result)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 *
 * const failure = CodeMode.FailureModel.make({
 *   error: CodeMode.DiagnosticModel.new("ParseError", "Code cannot be empty."),
 *   toolCalls: [],
 * })
 *
 * console.log(failure._tag) // "Failure"
 * console.log(failure.error.kind) // "ParseError"
 * ```
 *
 * @see {@link ResultModel} for the tagged union that includes this failure variant.
 * @category models
 * @since 0.0.0
 */
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

/**
 * Internal tagged union of success and failure models.
 *
 * **Example** (Recognize a success member)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 *
 * const model = CodeMode.SuccessModel.make({
 *   value: 1,
 *   toolCalls: [],
 * })
 *
 * console.log(CodeMode.ResultModel.is(model)) // true
 * console.log(model._tag) // "Success"
 * ```
 *
 * @see {@link Result} for the public `ok` boolean wire schema this union encodes to.
 * @category models
 * @since 0.0.0
 */
export const ResultModel = S.Union([SuccessModel, FailureModel]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ResultModel", {
    description: "Schema-owned success or failure model.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded internal result produced by {@link ResultModel}.
 *
 * @see {@link ResultModel} for the runtime tagged union and membership guard.
 * @category type-level
 * @since 0.0.0
 */
export type ResultModel = typeof ResultModel.Type;

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

const SuccessTag: "Success" = "Success";
const FailureTag: "Failure" = "Failure";

const ResultCodec = ResultWire.pipe(
  S.decodeTo(ResultModel, {
    decode: SchemaGetter.transform((result) =>
      result.ok
        ? {
            _tag: SuccessTag,
            value: result.value,
            ...(P.isUndefined(result.warnings) ? {} : { warnings: result.warnings }),
            ...(P.isUndefined(result.logs) ? {} : { logs: result.logs }),
            ...(P.isUndefined(result.truncated) ? {} : { truncated: result.truncated }),
            toolCalls: result.toolCalls,
          }
        : {
            _tag: FailureTag,
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

/**
 * Public wire schema for a CodeMode execution result.
 *
 * **Details**
 *
 * The wire shape uses `ok: true | false`. Do not pass this encoded form into
 * {@link ResultModel}, which discriminates on `_tag: "Success" | "Failure"`.
 *
 * **Example** (Decode a successful wire result)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownSync(CodeMode.Result)({
 *   ok: true,
 *   value: "done",
 *   toolCalls: [],
 * })
 *
 * console.log(result.ok) // true
 * ```
 *
 * @see {@link ResultModel} for the internal `_tag` union used before encoding.
 * @category models
 * @since 0.0.0
 */
export const Result = S.toEncoded(ResultCodec).pipe(
  $I.annoteSchema("Result", {
    description: "Structured success or diagnostic returned by CodeMode execution.",
  })
);

/**
 * Encoded execution result produced by {@link Result}.
 *
 * @see {@link Result} for the runtime wire schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Result = typeof Result.Type;

/**
 * Encodes one internal result at the public `ok` boolean boundary.
 *
 * **Gotchas**
 *
 * Encode failure leaves the typed error channel via `Effect.orDie` and becomes
 * a defect, not a typed execution-limits error.
 *
 * **Example** (Encode a success model)
 *
 * ```ts
 * import { CodeMode } from "@beep/scratchpad/codemode"
 * import { encodeResultModel } from "../../../codemode/Codemode.result.ts"
 * import { Effect } from "effect"
 *
 * const model = CodeMode.SuccessModel.make({
 *   value: "done",
 *   toolCalls: [],
 * })
 *
 * Effect.runPromise(encodeResultModel(model)).then((wire) => {
 *   console.log(wire.ok) // true
 * })
 * ```
 *
 * @see {@link ResultModel} for the internal tagged union this function consumes.
 * @see {@link Result} for the public wire schema this function produces.
 * @category encoding
 * @since 0.0.0
 */
export const encodeResultModel = (result: ResultModel): Effect.Effect<Result> =>
  S.encodeEffect(ResultCodec)(result).pipe(Effect.orDie);
