/**
 * Typed, schema-backed errors for the PACER driver boundary.
 *
 * Two error families mirror PACER's two error models: {@link PacerAuthError}
 * carries the body-level `loginResult` code from the Authentication API (which
 * returns failures as HTTP 200), while {@link PacerPclError} carries the HTTP
 * status from the PCL Case Locator API. {@link PacerConfigError} covers missing
 * or unreadable configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as HttpStatus from "@beep/schema/HttpStatus";
import { O } from "@beep/utils";
import { Match } from "effect";
import * as S from "effect/Schema";

const $I = $PacerId.create("pacer/Pacer.errors");

/**
 * Failure reasons for the PACER Authentication API.
 *
 * **Example** (Log invalid credentials reason)
 *
 * ```ts
 * import { PacerAuthErrorReason } from "@beep/pacer"
 *
 * console.log(PacerAuthErrorReason.Enum["invalid-credentials"])
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PacerAuthErrorReason = LiteralKit([
  "invalid-credentials",
  "redaction-flag-required",
  "login-failed",
  "search-privilege-denied",
  "transport",
  "response-decoding",
]).pipe(
  $I.annoteSchema("PacerAuthErrorReason", {
    description: "Reasons the PACER cso-auth / cso-logout flow can fail.",
  })
);

/**
 * Type for {@link PacerAuthErrorReason}.
 *
 * **Example** (Type alias for auth reason)
 *
 * ```ts
 * import { PacerAuthErrorReason } from "@beep/pacer"
 * import type { PacerAuthErrorReason as PacerAuthErrorReasonType } from "@beep/pacer"
 *
 * const reason: PacerAuthErrorReasonType = PacerAuthErrorReason.Enum["invalid-credentials"]
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PacerAuthErrorReason = typeof PacerAuthErrorReason.Type;

const PacerAuthErrorFields = {
  reason: PacerAuthErrorReason,
  loginResult: S.optionalKey(S.String),
  description: S.optionalKey(S.String),
  cause: S.optionalKey(S.String),
} satisfies S.Struct.Fields;
const samePacerAuthErrorFields = S.toEquivalence(S.TaggedStruct("PacerAuthError", PacerAuthErrorFields));
const samePacerAuthError = (self: PacerAuthError, that: PacerAuthError): boolean =>
  samePacerAuthErrorFields(self, that);

/**
 * Failure raised by the PACER Authentication boundary.
 *
 * **Example** (Create error from login result)
 *
 * ```ts
 * import { PacerAuthError } from "@beep/pacer"
 *
 * const error = PacerAuthError.fromLoginResult("13")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PacerAuthError extends S.TaggedError<PacerAuthError>($I`PacerAuthError`)(
  "PacerAuthError",
  PacerAuthErrorFields,
  $I.annoteClass<S.declare<PacerAuthError>, readonly [S.TaggedStruct<"PacerAuthError", typeof PacerAuthErrorFields>]>(
    "PacerAuthError",
    {
      description: "Typed failure from the PACER cso-auth / cso-logout flow.",
      toEquivalence: () => samePacerAuthError,
    }
  )
) {
  /**
   * Build an auth error directly from a `loginResult` code + `errorDescription`.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromLoginResult = (loginResult: string, errorDescription?: string): PacerAuthError => {
    const reason: PacerAuthErrorReason =
      loginResult === "1" ? "redaction-flag-required" : loginResult === "13" ? "invalid-credentials" : "login-failed";
    return PacerAuthError.make({
      reason,
      loginResult,
      ...O.getSomesStruct({ description: O.fromUndefinedOr(errorDescription) }),
    });
  };

  /**
   * Build an auth error from a reason and optional sanitized context.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: PacerAuthErrorReason,
    options: {
      readonly cause?: string;
      readonly description?: string;
    } = {}
  ): PacerAuthError =>
    PacerAuthError.make({
      reason,
      ...O.getSomesStruct({
        cause: O.fromUndefinedOr(options.cause),
        description: O.fromUndefinedOr(options.description),
      }),
    });
}

/**
 * Failure reasons for the PCL Case Locator API, mapped from HTTP status codes.
 *
 * **Example** (Log too-many-requests reason)
 *
 * ```ts
 * import { PacerPclErrorReason } from "@beep/pacer"
 *
 * console.log(PacerPclErrorReason.Enum["too-many-requests"])
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PacerPclErrorReason = LiteralKit([
  "bad-request",
  "unauthorized",
  "not-found",
  "invalid-parameter",
  "too-many-requests",
  "server-error",
  "transport",
  "response-decoding",
]).pipe(
  $I.annoteSchema("PacerPclErrorReason", {
    description: "Reasons a PCL search can fail, mirroring PACER's HTTP status codes.",
  })
);

/**
 * Type for {@link PacerPclErrorReason}.
 *
 * **Example** (Type alias for PCL reason)
 *
 * ```ts
 * import { PacerPclErrorReason } from "@beep/pacer"
 * import type { PacerPclErrorReason as PacerPclErrorReasonType } from "@beep/pacer"
 *
 * const reason: PacerPclErrorReasonType = PacerPclErrorReason.Enum["too-many-requests"]
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PacerPclErrorReason = typeof PacerPclErrorReason.Type;

const PacerPclErrorFields = {
  reason: PacerPclErrorReason,
  status: S.optionalKey(NonNegativeInt),
  description: S.optionalKey(S.String),
  cause: S.optionalKey(S.String),
} satisfies S.Struct.Fields;
const samePacerPclErrorFields = S.toEquivalence(S.TaggedStruct("PacerPclError", PacerPclErrorFields));
const samePacerPclError = (self: PacerPclError, that: PacerPclError): boolean => samePacerPclErrorFields(self, that);

/**
 * Failure raised by the PCL Case Locator boundary.
 *
 * **Example** (Create error from HTTP status)
 *
 * ```ts
 * import { PacerPclError } from "@beep/pacer"
 *
 * const error = PacerPclError.fromStatus(406)
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PacerPclError extends S.TaggedError<PacerPclError>($I`PacerPclError`)(
  "PacerPclError",
  PacerPclErrorFields,
  $I.annoteClass<S.declare<PacerPclError>, readonly [S.TaggedStruct<"PacerPclError", typeof PacerPclErrorFields>]>(
    "PacerPclError",
    {
      description: "Typed failure from a PCL Case Locator search.",
      toEquivalence: () => samePacerPclError,
    }
  )
) {
  /**
   * Map a PCL HTTP status code to a typed error.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromStatus = (status: number, description?: string): PacerPclError =>
    PacerPclError.make({
      reason: Match.value(status).pipe(
        Match.when(HttpStatus.BadRequest.literal, () => PacerPclErrorReason.Enum["bad-request"]),
        Match.when(HttpStatus.Unauthorized.literal, () => PacerPclErrorReason.Enum.unauthorized),
        Match.when(HttpStatus.NotFound.literal, () => PacerPclErrorReason.Enum["not-found"]),
        Match.when(HttpStatus.NotAcceptable.literal, () => PacerPclErrorReason.Enum["invalid-parameter"]),
        Match.when(HttpStatus.TooManyRequests.literal, () => PacerPclErrorReason.Enum["too-many-requests"]),
        Match.orElse(() => PacerPclErrorReason.Enum["server-error"])
      ),
      status: NonNegativeInt.make(status),
      ...O.getSomesStruct({ description: O.fromUndefinedOr(description) }),
    });

  /**
   * Build a PCL error from a reason and optional sanitized context.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: PacerPclErrorReason,
    options: {
      readonly cause?: string;
      readonly status?: number;
    } = {}
  ): PacerPclError =>
    PacerPclError.make({
      reason,
      ...O.getSomesStruct({
        cause: O.fromUndefinedOr(options.cause),
        status: O.fromUndefinedOr(options.status).pipe(O.map(NonNegativeInt.make)),
      }),
    });
}

const PacerConfigErrorFields = {
  cause: S.optionalKey(S.String),
} satisfies S.Struct.Fields;
const samePacerConfigErrorFields = S.toEquivalence(S.TaggedStruct("PacerConfigError", PacerConfigErrorFields));
const samePacerConfigError = (self: PacerConfigError, that: PacerConfigError): boolean =>
  samePacerConfigErrorFields(self, that);

/**
 * Failure raised while loading PACER configuration / secrets.
 *
 * **Example** (Make config error with message)
 *
 * ```ts
 * import { PacerConfigError } from "@beep/pacer"
 *
 * const error = PacerConfigError.make_("missing PACER_USERNAME")
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PacerConfigError extends S.TaggedError<PacerConfigError>($I`PacerConfigError`)(
  "PacerConfigError",
  PacerConfigErrorFields,
  $I.annoteClass<
    S.declare<PacerConfigError>,
    readonly [S.TaggedStruct<"PacerConfigError", typeof PacerConfigErrorFields>]
  >("PacerConfigError", {
    description: "Missing or unreadable PACER configuration / secret.",
    toEquivalence: () => samePacerConfigError,
  })
) {
  /**
   * Build a config error with optional sanitized context.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make_ = (cause?: string): PacerConfigError =>
    PacerConfigError.make(
      O.getSomesStruct({
        cause: O.fromUndefinedOr(cause),
      })
    );
}
