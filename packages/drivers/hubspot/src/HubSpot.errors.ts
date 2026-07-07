/**
 * Typed technical errors for the HubSpot driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $HubspotId } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { O, thunkUndefined } from "@beep/utils";
import { Effect, flow, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import { HubSpotUrl } from "./HubSpot.config.ts";

const $I = $HubspotId.create("HubSpot.errors");
const HubSpotHttpStatus = S.Int.check(S.isGreaterThanOrEqualTo(100), S.isLessThanOrEqualTo(599)).pipe(
  $I.annoteSchema("HubSpotHttpStatus", {
    description: "Integer HTTP status code recorded in HubSpot driver errors.",
  })
);

/**
 * Technical error reasons emitted by the HubSpot driver.
 *
 * @example
 * ```ts
 * import { HubSpotErrorReason } from "@beep/hubspot"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeSync(HubSpotErrorReason)("transport")
 * console.log(reason) // "transport"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const HubSpotErrorReason = LiteralKit([
  "config",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
]).pipe(
  $I.annoteSchema("HubSpotErrorReason", {
    description: "Redacted technical error reasons emitted by the HubSpot API driver.",
  })
);

/**
 * Type for {@link HubSpotErrorReason}.
 *
 * @example
 * ```ts
 * import type { HubSpotErrorReason as HubSpotErrorReasonType } from "@beep/hubspot"
 *
 * const reason: HubSpotErrorReasonType = "response status"
 * console.log(reason) // "response status"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type HubSpotErrorReason = typeof HubSpotErrorReason.Type;

/**
 * Technical failure raised by the HubSpot driver boundary.
 *
 * @example
 * ```ts
 * import { HubSpotError } from "@beep/hubspot"
 *
 * const error = HubSpotError.fromReason("transport", {
 *   formGuid: "form-guid",
 *   url: "https://api.hsforms.com/submissions/v3/integration/secure/submit/12345/form-guid"
 * })
 *
 * console.log(error.reason) // "transport"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HubSpotError extends TaggedErrorClass<HubSpotError>($I`HubSpotError`)(
  "HubSpotError",
  {
    cause: S.optionalKey(S.String).annotateKey({
      description: "Redacted cause label derived from a native or HTTP client error.",
    }),
    email: S.optionalKey(S.String).annotateKey({
      description: "Submitted email text preserved for diagnostic context.",
    }),
    formGuid: S.optionalKey(S.NonEmptyString).annotateKey({
      description: "HubSpot form GUID associated with the failed request.",
    }),
    reason: HubSpotErrorReason.annotateKey({
      description: "Redacted technical error reason.",
    }),
    status: S.optionalKey(HubSpotHttpStatus).annotateKey({
      description: "HTTP response status code associated with the failure.",
    }),
    url: S.optionalKey(HubSpotUrl).annotateKey({
      description: "HubSpot API URL associated with the failed request.",
    }),
  },
  $I.annote("HubSpotError", {
    description: "Redacted technical failure raised by the HubSpot API driver boundary.",
  })
) {
  /**
   * Create a HubSpot driver error.
   *
   * @example
   * ```ts
   * import { HubSpotError } from "@beep/hubspot"
   *
   * const error = HubSpotError.fromReason("response status", { status: 401 })
   * console.log(error.status) // 401
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: HubSpotErrorReason, options: HubSpotErrorOptions = {}): HubSpotError =>
    HubSpotError.make({
      reason,
      ...O.getSomesStruct({
        cause: causeFromUnknown(options.cause),
        email: O.fromUndefinedOr(options.email),
        formGuid: O.fromUndefinedOr(options.formGuid),
        status: O.fromUndefinedOr(options.status),
        url: O.fromUndefinedOr(options.url),
      }),
    });

  /**
   * Create a failed Effect containing a HubSpot driver error.
   *
   * @example
   * ```ts
   * import { HubSpotError } from "@beep/hubspot"
   *
   * const effect = HubSpotError.failEffectFromReason("transport")
   * console.log(effect)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failEffectFromReason = flow(this.fromReason, Effect.fail);

  /**
   * Create a thunk returning a failed Effect containing a HubSpot driver error.
   *
   * @example
   * ```ts
   * import { HubSpotError } from "@beep/hubspot"
   *
   * const thunk = HubSpotError.failEffectFromReasonThunk("transport")
   * console.log(thunk)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failEffectFromReasonThunk = flow(this.failEffectFromReason, (effect) => () => effect);
}

/**
 * Options used when constructing HubSpot driver errors.
 *
 * @example
 * ```ts
 * import { HubSpotErrorOptions } from "@beep/hubspot"
 *
 * const options = HubSpotErrorOptions.make({
 *   formGuid: "form-guid",
 *   status: 429
 * })
 *
 * console.log(options.status) // 429
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HubSpotErrorOptions extends S.Class<HubSpotErrorOptions>($I`HubSpotErrorOptions`)(
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({
      description: "Original native or third-party defect when one was available.",
    }),
    email: S.optionalKey(S.String).annotateKey({
      description: "Submitted email text preserved for diagnostic context.",
    }),
    formGuid: S.optionalKey(S.NonEmptyString).annotateKey({
      description: "HubSpot form GUID associated with the failure.",
    }),
    status: S.optionalKey(HubSpotHttpStatus).annotateKey({
      description: "HTTP response status code associated with the failure.",
    }),
    url: S.optionalKey(HubSpotUrl).annotateKey({
      description: "HubSpot API URL associated with the failure.",
    }),
  },
  $I.annote("HubSpotErrorOptions", {
    description: "Options for configuring HubSpotError instances.",
  })
) {}

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication
const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      thunkUndefined
    )
  );
};

const readString: {
  (value: unknown, key: PropertyKey): O.Option<string>;
  (key: PropertyKey): (value: unknown) => O.Option<string>;
} = dual(2, (value: unknown, key: PropertyKey): O.Option<string> => O.filter(readProperty(value, key), P.isString));

const safeBoolean = (evaluate: () => boolean): boolean => Result.getOrElse(Result.try(evaluate), () => false);

const httpClientCauseLabel = (cause: unknown): O.Option<string> =>
  safeBoolean(() => HttpClientError.isHttpClientError(cause))
    ? pipe(
        readProperty(cause, "reason"),
        O.flatMap(readString("_tag")),
        O.map((tag) => `HttpClientError:${tag}`)
      )
    : O.none();

const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        httpClientCauseLabel(cause),
        readString(cause, "_tag"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);
