/**
 * Typed technical errors for the Box driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import { JsonObject, LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { pipe, Result } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { BoxMethodName } from "./_generated/Box.models.gen.ts";
import { BOX_SDK_VERSION } from "./internal/Box.constants.ts";
import type { BoxMethodName as BoxMethodNameType } from "./_generated/Box.models.gen.ts";

const $I = $BoxId.create("Box.errors");

// Shared driver codec-statics idiom; drivers are independent and have no in-family home — future foundation capability candidate.
// fallow-ignore-next-line code-duplication
const withLiteralKitCodecStatics = <Sch extends S.Top & S.ConstraintDecoder<unknown>>(
  schema: Sch
): Sch & {
  readonly decodeOption: (input: unknown) => O.Option<Sch["Type"]>;
  readonly fromUnknown: (input: unknown) => Sch["Type"];
} =>
  SchemaUtils.withStatics((self: Sch) => ({
    decodeOption: S.decodeUnknownOption(self),
    fromUnknown: S.decodeUnknownSync(self),
  }))(schema);

const BoxErrorReasonBase = LiteralKit([
  "config",
  "request encoding",
  "response decoding",
  "response status",
  "sdk shape",
  "sdk thrown",
  "stream",
  "transport",
]);

/**
 * Technical error reasons emitted by the Box driver.
 *
 * @example
 * ```ts
 * import { BoxErrorReason } from "@beep/box"
 *
 * console.log(BoxErrorReason.is.transport("transport"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxErrorReason = BoxErrorReasonBase.pipe(
  $I.annoteSchema("BoxErrorReason", {
    description: "Redacted technical error reasons emitted by the Box driver.",
  }),
  withLiteralKitCodecStatics,
  SchemaUtils.withLiteralKitStatics(BoxErrorReasonBase)
);

/**
 * Type for {@link BoxErrorReason}.
 *
 * @example
 * ```ts
 * import type { BoxErrorReason } from "@beep/box"
 *
 * const reason: BoxErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoxErrorReason = typeof BoxErrorReason.Type;

/**
 * Sanitized context copied from Box API failures.
 *
 * @example
 * ```ts
 * import { BoxApiFailureContext } from "@beep/box"
 *
 * const context = BoxApiFailureContext.make({ values: { reason: "invalid" } })
 * console.log(context.values)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxApiFailureContext extends S.Class<BoxApiFailureContext>($I`BoxApiFailureContext`)(
  {
    // JSON-only so the sanitized context round-trips deterministically across the
    // driver boundary. `S.Unknown` here let arbitrary non-serializable values
    // (Errors, functions, symbols) leak into a wire-crossing error, whose
    // encode/decode equivalence depended on host-sensitive structural `Equal`.
    values: JsonObject,
  },
  $I.annote("BoxApiFailureContext", {
    description: "Sanitized JSON key-value context copied from a Box API failure.",
  })
) {}

const BoxHttpStatusCode = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(100, {
        identifier: $I`BoxHttpStatusCodeMinimumCheck`,
        title: "Box HTTP status code minimum",
        description: "Box HTTP status codes must be at least 100.",
        message: "Expected an HTTP status code greater than or equal to 100",
      }),
      S.isLessThanOrEqualTo(599, {
        identifier: $I`BoxHttpStatusCodeMaximumCheck`,
        title: "Box HTTP status code maximum",
        description: "Box HTTP status codes must be less than or equal to 599.",
        message: "Expected an HTTP status code less than or equal to 599",
      }),
    ],
    {
      identifier: $I`BoxHttpStatusCodeChecks`,
      title: "Box HTTP status code",
      description: "Numeric HTTP status code range accepted by the Box driver.",
    }
  )
).pipe(
  $I.annoteSchema("BoxHttpStatusCode", {
    description: "Numeric HTTP status code accepted by the Box driver.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Options used when constructing Box driver errors.
 *
 * @example
 * ```ts
 * import { BoxErrorOptions } from "@beep/box"
 * import * as O from "effect/Option"
 *
 * const options = BoxErrorOptions.make({ method: O.some("files.getFileById") })
 * console.log(O.getOrUndefined(options.method))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxErrorOptions extends S.Class<BoxErrorOptions>($I`BoxErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    code: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    context: S.OptionFromOptionalKey(BoxApiFailureContext).pipe(SchemaUtils.withNoneDefault),
    helpUrl: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    method: S.OptionFromOptionalKey(BoxMethodName).pipe(SchemaUtils.withNoneDefault),
    requestId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sdkVersion: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    status: S.OptionFromOptionalKey(BoxHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BoxErrorOptions", {
    description: "Sanitized options for constructing Box driver errors.",
  })
) {}

class BoxErrorOptionsInput extends S.Class<BoxErrorOptionsInput>($I`BoxErrorOptionsInput`)(
  {
    cause: S.Unknown.pipe(S.optionalKey),
    code: S.String.pipe(S.optionalKey),
    context: BoxApiFailureContext.pipe(S.optionalKey),
    helpUrl: S.String.pipe(S.optionalKey),
    method: BoxMethodName.pipe(S.optionalKey),
    requestId: S.String.pipe(S.optionalKey),
    sdkVersion: S.String.pipe(S.optionalKey),
    status: S.Finite.pipe(S.optionalKey),
  },
  $I.annote("BoxErrorOptionsInput", {
    description: "Raw option input accepted by BoxError.fromReason before schema-owned normalization.",
  })
) {}

/**
 * Technical failure raised by the Box driver boundary.
 *
 * @example
 * ```ts
 * import { BoxError } from "@beep/box"
 *
 * const error = BoxError.fromReason("transport", { method: "files.getFileById" })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxError extends TaggedErrorClass<BoxError>($I`BoxError`)(
  "BoxError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    code: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    context: S.OptionFromOptionalKey(BoxApiFailureContext).pipe(SchemaUtils.withNoneDefault),
    helpUrl: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    method: S.OptionFromOptionalKey(BoxMethodName).pipe(SchemaUtils.withNoneDefault),
    reason: BoxErrorReason,
    requestId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sdkVersion: S.String.pipe(S.optionalKey, SchemaUtils.withKeyDefaults(BOX_SDK_VERSION)),
    status: S.OptionFromOptionalKey(BoxHttpStatusCode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BoxError", {
    description: "Sanitized technical failure raised by the Box driver boundary.",
  })
) {
  /**
   * Create a Box driver error from a redacted reason.
   *
   * @example
   * ```ts
   * import { BoxError } from "@beep/box"
   *
   * const error = BoxError.fromReason("config")
   * console.log(error.reason)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: BoxErrorReason, options: BoxErrorOptionsInput = {}): BoxError => {
    const input = BoxErrorOptionsInput.make(options);
    return BoxError.make({
      reason,
      cause: pipe(O.fromUndefinedOr(input.cause), O.map(causeLabelFromInput)),
      code: O.fromUndefinedOr(input.code),
      context: O.fromUndefinedOr(input.context),
      helpUrl: O.fromUndefinedOr(input.helpUrl),
      method: O.fromUndefinedOr(input.method),
      requestId: O.fromUndefinedOr(input.requestId),
      status: pipe(O.fromUndefinedOr(input.status), O.filter(BoxHttpStatusCode.is)),
      ...O.getSomesStruct({
        sdkVersion: O.fromUndefinedOr(input.sdkVersion),
      }),
    });
  };

  /**
   * Convert an unknown SDK throw into a sanitized Box driver error.
   *
   * @example
   * ```ts
   * import { BoxError } from "@beep/box"
   * import * as O from "effect/Option"
   *
   * const error = BoxError.fromUnknown("files.getFileById", "boom")
   * console.log(O.getOrUndefined(error.method))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromUnknown = (method: BoxMethodNameType, cause: unknown): BoxError => {
    const responseInfo = responseInfoFromUnknown(cause);
    const code = pipe(responseInfo, O.flatMap(readString("code")));
    const context = pipe(responseInfo, O.flatMap(readContextInfo));
    const helpUrl = pipe(responseInfo, O.flatMap(readString("helpUrl")));
    const requestId = pipe(responseInfo, O.flatMap(readString("requestId")));
    const status = pipe(responseInfo, O.flatMap(readHttpStatusCode("statusCode")));

    return BoxError.fromReason(reasonFromUnknown(cause), {
      cause: causeLabel(cause),
      method,
      ...O.getSomesStruct({
        code,
        helpUrl,
        requestId,
      }),
      ...O.getSomesStruct({
        context,
      }),
      ...O.getSomesStruct({
        status,
      }),
    });
  };
}

const readProperty =
  (key: PropertyKey) =>
  (value: unknown): O.Option<unknown> =>
    P.isObject(value)
      ? O.fromUndefinedOr(
          Result.getOrElse(
            Result.try(() => Reflect.get(value, key)),
            () => undefined
          )
        )
      : O.none();

const readString =
  (key: PropertyKey) =>
  (value: unknown): O.Option<string> =>
    pipe(readProperty(key)(value), O.filter(P.isString));

const isFiniteNumber = (value: unknown): value is number => P.isNumber(value) && Number.isFinite(value);

const readNumber =
  (key: PropertyKey) =>
  (value: unknown): O.Option<number> =>
    pipe(readProperty(key)(value), O.filter(isFiniteNumber));

const readHttpStatusCode =
  (key: PropertyKey) =>
  (value: unknown): O.Option<number> =>
    pipe(readNumber(key)(value), O.filter(BoxHttpStatusCode.is));

const responseInfoFromUnknown = (cause: unknown): O.Option<unknown> => readProperty("responseInfo")(cause);

const decodeApiFailureContext = S.decodeUnknownOption(BoxApiFailureContext);

const readContextInfo = (value: unknown): O.Option<BoxApiFailureContext> =>
  pipe(
    readProperty("contextInfo")(value),
    O.filter(P.isObject),
    // Total: non-JSON contextInfo sanitizes to `None` rather than throwing on the error path.
    O.flatMap((contextInfo) => decodeApiFailureContext({ values: contextInfo }))
  );

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication
const causeLabel = (cause: unknown): string =>
  pipe(
    O.firstSomeOf([readString("_tag")(cause), readString("name")(cause), readString("code")(cause)]),
    // shared driver boundary idiom; no in-family home; future foundation capability candidate.
    // fallow-ignore-next-line code-duplication
    O.getOrElse(() => (P.isString(cause) ? "String" : "Unknown"))
  );

const causeLabelFromInput = (cause: unknown): string => (P.isString(cause) ? cause : causeLabel(cause));

const isBoxSdkShapeError = P.isTagged("BoxSdkShapeError");

const sdkThrownReason = (cause: unknown): BoxErrorReason => (isBoxSdkShapeError(cause) ? "sdk shape" : "sdk thrown");

const reasonFromUnknown = (cause: unknown): BoxErrorReason =>
  pipe(
    responseInfoFromUnknown(cause),
    O.match({
      onNone: () => sdkThrownReason(cause),
      onSome: () => "response status",
    })
  );
