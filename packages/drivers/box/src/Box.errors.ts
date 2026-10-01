/**
 * Typed technical errors for the Box driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { Effect, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { BoxMethodName } from "./_generated/Box.models.gen.ts";
import { BOX_SDK_VERSION } from "./internal/Box.constants.ts";
import type { BoxMethodName as BoxMethodNameType } from "./_generated/Box.models.gen.ts";

const $I = $BoxId.create("Box.errors");

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
 * **Example** (Check transport reason match)
 *
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
  SchemaUtils.withLiteralKitStatics(BoxErrorReasonBase)
);

/**
 * Type for {@link BoxErrorReason}.
 *
 * **Example** (Assign reason type value)
 *
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

const BoxConflictResourceType = LiteralKit(["file", "folder", "web_link"]).pipe(
  $I.annoteSchema("BoxConflictResourceType", {
    description: "Closed Box resource classifications retained from conflict diagnostics.",
  })
);

const BoxProviderResourceId = S.String.check(
  S.isPattern(/^[0-9]{1,32}$/u, {
    identifier: $I`BoxProviderResourceIdPattern`,
    title: "Box provider resource id",
    description: "One to 32 decimal digits identifying a Box resource without carrying its name.",
    message: "Expected a Box provider resource id",
  })
).pipe(
  $I.annoteSchema("BoxProviderResourceId", {
    description: "Numeric Box resource identifier safe to retain in driver diagnostics.",
  })
);

const BoxApiFailureConflict = S.Struct({
  id: BoxProviderResourceId,
  type: BoxConflictResourceType,
}).pipe(
  $I.annoteSchema("BoxApiFailureConflict", {
    description: "Safe identity-only projection of a Box conflict resource.",
  })
);

const BoxApiFailureContextValues = S.Struct({
  conflictCount: S.Natural,
  conflicts: S.Array(BoxApiFailureConflict),
}).pipe(
  $I.annoteSchema("BoxApiFailureContextValues", {
    description: "Closed conflict summary retained from Box API failure context.",
  })
);

/**
 * Sanitized context copied from Box API failures.
 *
 * **Example** (Make failure context values)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoxApiFailureContext } from "@beep/box"
 *
 * const context = BoxApiFailureContext.make({
 *   values: { conflictCount: S.Natural.make(1), conflicts: [{ id: "123", type: "file" }] }
 * })
 * console.log(context.values.conflictCount)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxApiFailureContext extends S.Class<BoxApiFailureContext>($I`BoxApiFailureContext`)(
  {
    values: BoxApiFailureContextValues,
  },
  $I.annote("BoxApiFailureContext", {
    description: "Strict conflict-only projection copied from a Box API failure.",
  })
) {}

const BoxErrorCode = S.String.check(
  S.isPattern(/^[a-z][a-z0-9_]{0,127}$/u, {
    identifier: $I`BoxErrorCodePattern`,
    title: "Box error code",
    description: "Bounded lowercase classification syntax used by Box API error codes.",
    message: "Expected a Box error code",
  })
).pipe(
  $I.annoteSchema("BoxErrorCode", {
    description: "Bounded Box API error classification safe to retain in diagnostics.",
  })
);

const BoxRequestId = S.String.check(
  S.isPattern(/^[A-Za-z0-9._:-]{1,200}$/u, {
    identifier: $I`BoxRequestIdPattern`,
    title: "Box request id",
    description: "Bounded technical identifier syntax accepted for Box request correlation.",
    message: "Expected a Box request id",
  })
).pipe(
  $I.annoteSchema("BoxRequestId", {
    description: "Technical Box request identifier safe to retain in diagnostics.",
  })
);

const BoxSdkVersion = S.Literal(BOX_SDK_VERSION).pipe(
  $I.annoteSchema("BoxSdkVersion", {
    description: "Exact Box SDK version used by this driver build.",
  })
);

const BoxRedactedHelpUrl = S.Literal("redacted").pipe(
  $I.annoteSchema("BoxRedactedHelpUrl", {
    description: "Fixed marker replacing provider help URLs in Box errors.",
  })
);

const BoxErrorCauseBase = LiteralKit([
  "AbortError",
  "BlockedHostError",
  "BoxSdkError",
  "BoxSdkShapeError",
  "ConfigError",
  "Error",
  "RangeError",
  "SchemaError",
  "String",
  "SyntaxError",
  "TypeError",
  "Unknown",
]);

const BoxErrorCause = BoxErrorCauseBase.pipe(
  $I.annoteSchema("BoxErrorCause", {
    description: "Closed error-class classification retained without provider or schema issue text.",
  }),
  SchemaUtils.withLiteralKitStatics(BoxErrorCauseBase)
);

const decodeBoxErrorCauseOption = S.decodeUnknownOption(BoxErrorCause);

type BoxErrorCause = typeof BoxErrorCause.Type;

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
  })
);

const BoxErrorContextFields = {
  cause: S.OptionFromOptionalKey(BoxErrorCause).pipe(S.withConstructorDefault(Effect.succeedNone)),
  code: S.OptionFromOptionalKey(BoxErrorCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
  context: S.OptionFromOptionalKey(BoxApiFailureContext).pipe(S.withConstructorDefault(Effect.succeedNone)),
  helpUrl: S.OptionFromOptionalKey(BoxRedactedHelpUrl).pipe(S.withConstructorDefault(Effect.succeedNone)),
  method: S.OptionFromOptionalKey(BoxMethodName).pipe(S.withConstructorDefault(Effect.succeedNone)),
  requestId: S.OptionFromOptionalKey(BoxRequestId).pipe(S.withConstructorDefault(Effect.succeedNone)),
  status: S.OptionFromOptionalKey(BoxHttpStatusCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
} satisfies S.Struct.Fields;

/**
 * Options used when constructing Box driver errors.
 *
 * **Example** (Make options with method)
 *
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
    ...BoxErrorContextFields,
    sdkVersion: S.OptionFromOptionalKey(BoxSdkVersion).pipe(S.withConstructorDefault(Effect.succeedNone)),
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

const BoxErrorDiagnosticFields = {
  cause: S.OptionFromOptionalKey(BoxErrorCause).pipe(S.withConstructorDefault(Effect.succeedNone)),
  code: S.OptionFromOptionalKey(BoxErrorCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
  context: S.OptionFromOptionalKey(BoxApiFailureContext).pipe(S.withConstructorDefault(Effect.succeedNone)),
  method: S.OptionFromOptionalKey(BoxMethodName).pipe(S.withConstructorDefault(Effect.succeedNone)),
  provider: S.Literal("box"),
  reason: BoxErrorReason,
  requestId: S.OptionFromOptionalKey(BoxRequestId).pipe(S.withConstructorDefault(Effect.succeedNone)),
  sdkVersion: S.OptionFromOptionalKey(BoxSdkVersion).pipe(S.withConstructorDefault(Effect.succeedNone)),
  status: S.OptionFromOptionalKey(BoxHttpStatusCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
} satisfies S.Struct.Fields;

/**
 * Explicit safe projection of a Box driver error for logging and serialization.
 *
 * **Example** (Inspect a safe diagnostic)
 *
 * ```ts
 * import { BoxError } from "@beep/box"
 *
 * const diagnostic = BoxError.toDiagnostic(BoxError.fromReason("transport"))
 * console.log(diagnostic.provider)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class BoxErrorDiagnostic extends S.Class<BoxErrorDiagnostic>($I`BoxErrorDiagnostic`)(
  BoxErrorDiagnosticFields,
  $I.annote("BoxErrorDiagnostic", {
    description: "Schema-backed Box error projection containing only approved diagnostic classifications.",
  })
) {}

/**
 * Technical failure raised by the Box driver boundary.
 *
 * **Example** (Create error from reason)
 *
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
export class BoxError extends S.TaggedError<BoxError>($I`BoxError`)(
  "BoxError",
  {
    ...BoxErrorContextFields,
    reason: BoxErrorReason,
    sdkVersion: BoxSdkVersion.pipe(
      S.optionalKey,
      S.withConstructorDefault(Effect.succeed<typeof BOX_SDK_VERSION>(BOX_SDK_VERSION)),
      S.withDecodingDefaultTypeKey(Effect.succeed<typeof BOX_SDK_VERSION>(BOX_SDK_VERSION))
    ),
  },
  $I.annoteError<BoxError>("BoxError", {
    description: "Sanitized technical failure raised by the Box driver boundary.",
  })
) {
  /**
   * Create a Box driver error from a redacted reason.
   *
   * **Example** (Create error from config)
   *
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
    const input = BoxErrorOptionsInput.make({ ...options });
    return BoxError.make({
      reason,
      cause: pipe(O.fromUndefinedOr(input.cause), O.map(causeLabel)),
      code: pipe(O.fromUndefinedOr(input.code), O.filter(S.is(BoxErrorCode))),
      context: O.fromUndefinedOr(input.context),
      helpUrl: O.none(),
      method: O.fromUndefinedOr(input.method),
      requestId: pipe(O.fromUndefinedOr(input.requestId), O.filter(S.is(BoxRequestId))),
      status: pipe(O.fromUndefinedOr(input.status), O.filter(S.is(BoxHttpStatusCode))),
      ...O.getSomesStruct({
        sdkVersion: pipe(O.fromUndefinedOr(input.sdkVersion), O.filter(S.is(BoxSdkVersion))),
      }),
    });
  };

  /**
   * Project a Box error to the closed diagnostic schema used by serializers.
   *
   * **Example** (Project an error)
   *
   * ```ts
   * import { BoxError } from "@beep/box"
   *
   * const diagnostic = BoxError.toDiagnostic(BoxError.fromReason("sdk thrown"))
   * console.log(diagnostic.reason)
   * ```
   *
   * @category diagnostics
   * @since 0.0.0
   */
  static readonly toDiagnostic = (error: BoxError): BoxErrorDiagnostic =>
    BoxErrorDiagnostic.make({
      cause: error.cause,
      code: error.code,
      context: error.context,
      method: error.method,
      provider: "box",
      reason: error.reason,
      requestId: error.requestId,
      sdkVersion: O.fromUndefinedOr(error.sdkVersion),
      status: error.status,
    });

  /**
   * Convert an unknown SDK throw into a sanitized Box driver error.
   *
   * **Example** (Sanitize unknown SDK throw)
   *
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
    const requestId = pipe(responseInfo, O.flatMap(readString("requestId")));
    const status = pipe(responseInfo, O.flatMap(readHttpStatusCode("statusCode")));

    return BoxError.fromReason(reasonFromUnknown(cause), {
      cause: causeLabel(cause),
      method,
      ...O.getSomesStruct({
        code,
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

  override get message(): string {
    return this.reason;
  }

  override toString(): string {
    return `${this._tag}: ${this.message}`;
  }

  override toJSON(): BoxErrorDiagnostic {
    return BoxError.toDiagnostic(this);
  }
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

const isFiniteNumber = S.is(S.Finite);

const readNumber =
  (key: PropertyKey) =>
  (value: unknown): O.Option<number> =>
    pipe(readProperty(key)(value), O.filter(isFiniteNumber));

const readHttpStatusCode =
  (key: PropertyKey) =>
  (value: unknown): O.Option<number> =>
    pipe(readNumber(key)(value), O.filter(S.is(BoxHttpStatusCode)));

const responseInfoFromUnknown = (cause: unknown): O.Option<unknown> => readProperty("responseInfo")(cause);

const decodeApiFailureConflict = S.decodeUnknownResult(BoxApiFailureConflict);

const readContextInfo = (value: unknown): O.Option<BoxApiFailureContext> =>
  pipe(
    readProperty("contextInfo")(value),
    O.flatMap(readProperty("conflicts")),
    O.filter((conflicts): conflicts is ReadonlyArray<unknown> => A.isArray(conflicts)),
    O.map((conflicts) =>
      BoxApiFailureContext.make({
        values: {
          conflictCount: S.Natural.make(A.length(conflicts)),
          conflicts: A.filterMap(conflicts, (conflict) => decodeApiFailureConflict(conflict)),
        },
      })
    )
  );

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- driver-local cause labeling retains only closed error classifications
const causeLabel = (cause: unknown): BoxErrorCause =>
  pipe(
    O.firstSomeOf([
      P.isString(cause) ? decodeBoxErrorCauseOption(cause) : O.none(),
      pipe(readString("_tag")(cause), O.flatMap(decodeBoxErrorCauseOption)),
      pipe(readString("name")(cause), O.flatMap(decodeBoxErrorCauseOption)),
    ]),
    O.getOrElse(() => (P.isString(cause) ? "String" : "Unknown"))
  );

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
