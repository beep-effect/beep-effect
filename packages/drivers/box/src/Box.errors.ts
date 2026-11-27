/**
 * Typed technical errors for the Box driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
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
  S.isPattern(
    /^[0-9]{1,32}$/u,
    $I.annote("BoxProviderResourceIdPattern", {
      title: "Box provider resource id",
      description: "One to 32 decimal digits identifying a Box resource without carrying its name.",
      message: "Expected a Box provider resource id",
    })
  )
).pipe(
  $I.annoteSchema("BoxProviderResourceId", {
    description: "Numeric Box resource identifier safe to retain in driver diagnostics.",
  })
);

const BoxContentSha1 = S.String.check(
  S.isPattern(
    /^[0-9a-f]{40}$/u,
    $I.annote("BoxContentSha1Pattern", {
      title: "Box content SHA-1",
      description: "Forty lowercase hexadecimal digits: the content hash Box reports for a file.",
      message: "Expected a lowercase hexadecimal SHA-1",
    })
  )
).pipe(
  $I.annoteSchema("BoxContentSha1", {
    description: "Lowercase hexadecimal SHA-1 content hash safe to retain in driver diagnostics.",
  })
);

/**
 * Sanitized projection of one item named by a Box `item_name_in_use` conflict.
 *
 * **Details**
 *
 * Only the provider id, the resource type, and, for files, the content `sha1`
 * and byte `size` are retained. The item name, etag, sequence id, file version,
 * path, and every other provider field are dropped. `sha1` and `size` are
 * `None` for folders and whenever Box omits them or sends a value that is not a
 * lowercase 40-digit hexadecimal hash or a non-negative integer.
 *
 * Box sends `context_info.conflicts` as an array for a folder-create conflict
 * and documents a single object for a file-upload conflict. The SDK does not
 * normalize either: `box-node-sdk` 10.17.0 `lib/networking/boxNetworkClient.js`
 * lines 302-304 copy the raw `context_info` map onto
 * `BoxApiError.responseInfo.contextInfo` without deserializing it (line 353),
 * so the camel-cased `contextInfo` holds the wire payload with its original
 * keys. The SDK's own `ConflictErrorContextInfoField`
 * (`lib/schemas/conflictError.d.ts` lines 4-9) types `conflicts` as an array
 * and its deserializer (`lib/schemas/conflictError.js` lines 32-36) rejects
 * anything else, but that deserializer is never applied on the error path. The
 * driver therefore accepts both shapes and always exposes an array.
 *
 * **Example** (Describe a conflicting file)
 *
 * ```ts
 * import { BoxApiFailureConflict } from "@beep/box"
 * import * as O from "effect/Option"
 *
 * const conflict = BoxApiFailureConflict.make({
 *   id: "123",
 *   sha1: O.some("da39a3ee5e6b4b0d3255bfef95601890afd80709"),
 *   size: O.some(0),
 *   type: "file"
 * })
 * console.log(O.isSome(conflict.sha1))
 * ```
 *
 * @see {@link https://developer.box.com/reference/post-files-content} for the upload conflict response.
 * @category errors
 * @since 0.0.0
 */
export class BoxApiFailureConflict extends S.Class<BoxApiFailureConflict, { readonly brand: unique symbol }>(
  $I`BoxApiFailureConflict`
)(
  {
    id: BoxProviderResourceId,
    type: BoxConflictResourceType,
    sha1: S.OptionFromOptionalKey(BoxContentSha1).pipe(S.withConstructorDefault(Effect.succeedNone)),
    size: S.OptionFromOptionalKey(S.Natural).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("BoxApiFailureConflict", {
    description: "Safe id, type, content hash, and size projection of a Box conflict resource.",
  })
) {}

const BoxApiFailureContextValues = S.Struct({
  conflictCount: S.Natural,
  conflicts: S.Array(BoxApiFailureConflict),
}).pipe(
  $I.annoteSchema("BoxApiFailureContextValues", {
    description: "Closed conflict summary retained from Box API failure context.",
  })
);

/**
 * **Details**
 *
 * `conflicts` is always an array: a single-object `context_info.conflicts`
 * (the documented file-upload shape) is normalized to a one-element list.
 * `conflictCount` counts the entries Box sent; `conflicts` holds those that
 * carried a usable id and type, each as a {@link BoxApiFailureConflict}.
 *
 * **Example** (Make failure context values)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoxApiFailureConflict, BoxApiFailureContext } from "@beep/box"
 *
 * const context = BoxApiFailureContext.make({
 *   values: {
 *     conflictCount: S.Natural.make(1),
 *     conflicts: [BoxApiFailureConflict.make({ id: "123", type: "file" })]
 *   }
 * })
 * console.log(context.values.conflictCount)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxApiFailureContext extends S.Class<BoxApiFailureContext, { readonly brand: unique symbol }>(
  $I`BoxApiFailureContext`
)(
  {
    values: BoxApiFailureContextValues,
  },
  $I.annote("BoxApiFailureContext", {
    description: "Strict conflict-only projection copied from a Box API failure.",
  })
) {}

const BoxErrorCode = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9_]{0,127}$/u,
    $I.annote("BoxErrorCodePattern", {
      title: "Box error code",
      description: "Bounded lowercase classification syntax used by Box API error codes.",
      message: "Expected a Box error code",
    })
  )
).pipe(
  $I.annoteSchema("BoxErrorCode", {
    description: "Bounded Box API error classification safe to retain in diagnostics.",
  })
);

const BoxRequestId = S.String.check(
  S.isPattern(
    /^[A-Za-z0-9._:-]{1,200}$/u,
    $I.annote("BoxRequestIdPattern", {
      title: "Box request id",
      description: "Bounded technical identifier syntax accepted for Box request correlation.",
      message: "Expected a Box request id",
    })
  )
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
      S.isGreaterThanOrEqualTo(
        100,
        $I.annote("BoxHttpStatusCodeMinimumCheck", {
          title: "Box HTTP status code minimum",
          description: "Box HTTP status codes must be at least 100.",
          message: "Expected an HTTP status code greater than or equal to 100",
        })
      ),
      S.isLessThanOrEqualTo(
        599,
        $I.annote("BoxHttpStatusCodeMaximumCheck", {
          title: "Box HTTP status code maximum",
          description: "Box HTTP status codes must be less than or equal to 599.",
          message: "Expected an HTTP status code less than or equal to 599",
        })
      ),
    ],
    $I.annote("BoxHttpStatusCodeChecks", {
      title: "Box HTTP status code",
      description: "Numeric HTTP status code range accepted by the Box driver.",
    })
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
export class BoxErrorOptions extends S.Opaque<BoxErrorOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...BoxErrorContextFields,
    sdkVersion: S.OptionFromOptionalKey(BoxSdkVersion).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("BoxErrorOptions", {
      description: "Sanitized options for constructing Box driver errors.",
    })
  )
) {}

/**
 * **Example** (Attach request details to a rate-limit failure)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { BoxError, BoxErrorOptionsInput } from "@beep/box/Box.errors"
 *
 * const error = BoxError.fromReason(
 *   "response status",
 *   BoxErrorOptionsInput.make({ method: "files.getFileById", status: 429, requestId: "a1b2c3d4" })
 * )
 *
 * console.log(O.getOrUndefined(error.status)) // => 429
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxErrorOptionsInput extends S.Opaque<BoxErrorOptionsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    cause: S.Unknown.pipe(S.optionalKey),
    code: S.String.pipe(S.optionalKey),
    context: BoxApiFailureContext.pipe(S.optionalKey),
    helpUrl: S.String.pipe(S.optionalKey),
    method: BoxMethodName.pipe(S.optionalKey),
    requestId: S.String.pipe(S.optionalKey),
    sdkVersion: S.String.pipe(S.optionalKey),
    status: S.Finite.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxErrorOptionsInput", {
      description: "Raw option input accepted by BoxError.fromReason before schema-owned normalization.",
    })
  )
) {}

const BoxErrorDiagnosticFields = {
  cause: S.OptionFromOptionalKey(BoxErrorCause).pipe(S.withConstructorDefault(Effect.succeedNone)),
  code: S.OptionFromOptionalKey(BoxErrorCode).pipe(S.withConstructorDefault(Effect.succeedNone)),
  context: S.OptionFromOptionalKey(BoxApiFailureContext).pipe(S.withConstructorDefault(Effect.succeedNone)),
  method: S.OptionFromOptionalKey(BoxMethodName).pipe(S.withConstructorDefault(Effect.succeedNone)),
  provider: S.tag("box"),
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
export class BoxErrorDiagnostic extends S.Opaque<BoxErrorDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct(BoxErrorDiagnosticFields).pipe(
    $I.annoteSchema("BoxErrorDiagnostic", {
      description: "Schema-backed Box error projection containing only approved diagnostic classifications.",
    })
  )
) {}

/**
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { BoxError, BoxErrorOptionsInput } from "@beep/box"
 *
 * const error = BoxError.fromReason(
 *   "transport",
 *   BoxErrorOptionsInput.make({ method: "files.getFileById" })
 * )
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BoxError extends S.TaggedError<BoxError, { readonly brand: unique symbol }>($I`BoxError`)(
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
  static readonly fromReason = (
    reason: BoxErrorReason,
    options: BoxErrorOptionsInput = BoxErrorOptionsInput.make({})
  ): BoxError => {
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

    return BoxError.fromReason(
      reasonFromUnknown(cause),
      BoxErrorOptionsInput.make({
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
      })
    );
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
const isBoxContentSha1 = S.is(BoxContentSha1);
const isNatural = S.is(S.Natural);

const readApiFailureConflict = (conflict: unknown) =>
  decodeApiFailureConflict({
    ...O.getSomesStruct({
      id: readProperty("id")(conflict),
      type: readProperty("type")(conflict),
    }),
    ...O.getSomesStruct({
      sha1: pipe(readString("sha1")(conflict), O.filter(isBoxContentSha1)),
      size: pipe(readNumber("size")(conflict), O.filter(isNatural)),
    }),
  });

const conflictEntries = (conflicts: unknown): O.Option<ReadonlyArray<unknown>> =>
  A.isArray(conflicts) ? O.some(conflicts) : P.isObject(conflicts) ? O.some(A.of(conflicts)) : O.none();

const readContextInfo = (value: unknown): O.Option<BoxApiFailureContext> =>
  pipe(
    readProperty("contextInfo")(value),
    O.flatMap(readProperty("conflicts")),
    O.flatMap(conflictEntries),
    O.map((conflicts) =>
      BoxApiFailureContext.make({
        values: {
          conflictCount: S.Natural.make(A.length(conflicts)),
          conflicts: A.filterMap(conflicts, readApiFailureConflict),
        },
      })
    )
  );

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
