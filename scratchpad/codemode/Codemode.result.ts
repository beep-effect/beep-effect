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
import { DiagnosticKind } from "./interpreter/Interpreter.model.ts";
import { ToolCall } from "./Codemode.tool-runtime.ts";
import { DataValue } from "./Codemode.data.ts";

const $I = $ScratchpadId.create("codemode/Codemode.result");

/** One-based source location attached to a diagnostic. */
export class DiagnosticLocation extends S.Class<DiagnosticLocation>($I`DiagnosticLocation`)(
  {
    line: PosInt,
    column: PosInt,
  },
  $I.annote("DiagnosticLocation", {
    description: "One-based source location in user-provided CodeMode source.",
  })
) {}

/** Internal schema-owned diagnostic. */
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

/** Runtime type for {@link ResultModel}. */
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

/** Wire-compatible result schema. */
export const Result = S.toEncoded(ResultCodec).pipe(
  $I.annoteSchema("Result", {
    description: "Structured success or diagnostic returned by CodeMode execution.",
  })
);

/** Runtime type for {@link Result}. */
export type Result = typeof Result.Type;

/** Encodes one internal result at the public boundary. */
export const encodeResultModel = (result: ResultModel): Effect.Effect<Result> =>
  S.encodeEffect(ResultCodec)(result).pipe(Effect.orDie);
