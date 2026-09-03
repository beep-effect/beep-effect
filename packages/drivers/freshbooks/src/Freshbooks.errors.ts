/**
 * Typed technical errors for the FreshBooks driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FreshbooksId } from "@beep/identity";
import { Defect, LiteralKit } from "@beep/schema";
import { O } from "@beep/utils";
import { Effect, flow, pipe, Result } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import { FreshbooksUrl } from "./Freshbooks.config.ts";

const $I = $FreshbooksId.create("Freshbooks.errors");
const FreshbooksHttpStatus = S.Int.check(S.isGreaterThanOrEqualTo(100), S.isLessThanOrEqualTo(599)).pipe(
  $I.annoteSchema("FreshbooksHttpStatus", {
    description: "Integer HTTP status code recorded in FreshBooks driver errors.",
  })
);

/**
 * Technical error reasons emitted by the FreshBooks driver.
 *
 * `token refresh` is the single-use refresh-token rotation failure class,
 * kept distinct from ordinary `config` so callers can detect a stranded
 * refresh token and trigger re-authorization.
 *
 * **Example** (Decode transport reason)
 *
 * ```ts
 * import { FreshbooksErrorReason } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeSync(FreshbooksErrorReason)("transport")
 * console.log(reason) // "transport"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const FreshbooksErrorReason = LiteralKit([
  "config",
  "token refresh",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
]).pipe(
  $I.annoteSchema("FreshbooksErrorReason", {
    description: "Redacted technical error reasons emitted by the FreshBooks API driver.",
  })
);

/**
 * Type for {@link FreshbooksErrorReason}.
 *
 * **Example** (Assign token refresh reason type)
 *
 * ```ts
 * import type { FreshbooksErrorReason as FreshbooksErrorReasonType } from "@beep/freshbooks"
 *
 * const reason: FreshbooksErrorReasonType = "token refresh"
 * console.log(reason) // "token refresh"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type FreshbooksErrorReason = typeof FreshbooksErrorReason.Type;

/**
 * Technical failure raised by the FreshBooks driver boundary.
 *
 * **Example** (Create error with resource context)
 *
 * ```ts
 * import { FreshbooksError } from "@beep/freshbooks"
 *
 * const error = FreshbooksError.fromReason("transport", {
 *   resource: "invoices",
 *   url: "https://api.freshbooks.com/accounting/account/ABC123/invoices/invoices"
 * })
 *
 * console.log(error.reason) // "transport"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FreshbooksError extends S.TaggedError<FreshbooksError>($I`FreshbooksError`)(
  "FreshbooksError",
  {
    cause: S.optionalKey(S.String).annotateKey({
      description: "Redacted cause label derived from a native or HTTP client error.",
    }),
    reason: FreshbooksErrorReason.annotateKey({
      description: "Redacted technical error reason.",
    }),
    resource: S.optionalKey(S.NonEmptyString).annotateKey({
      description: "FreshBooks resource name associated with the failed request.",
    }),
    status: S.optionalKey(FreshbooksHttpStatus).annotateKey({
      description: "HTTP response status code associated with the failure.",
    }),
    url: S.optionalKey(FreshbooksUrl).annotateKey({
      description: "FreshBooks API URL associated with the failed request.",
    }),
  },
  $I.annoteError<FreshbooksError>("FreshbooksError", {
    description: "Redacted technical failure raised by the FreshBooks API driver boundary.",
  })
) {
  /**
   * Create a FreshBooks driver error.
   *
   * **Example** (Create error with status)
   *
   * ```ts
   * import { FreshbooksError } from "@beep/freshbooks"
   *
   * const error = FreshbooksError.fromReason("response status", { status: 401 })
   * console.log(error.status) // 401
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: FreshbooksErrorReason, options: FreshbooksErrorOptions = {}): FreshbooksError =>
    FreshbooksError.make({
      reason,
      ...O.getSomesStruct({
        cause: causeFromUnknown(options.cause),
        resource: O.fromUndefinedOr(options.resource),
        status: O.fromUndefinedOr(options.status),
        url: O.fromUndefinedOr(options.url),
      }),
    });

  /**
   * Create a failed Effect containing a FreshBooks driver error.
   *
   * **Example** (Failed Effect from reason)
   *
   * ```ts
   * import { FreshbooksError } from "@beep/freshbooks"
   *
   * const effect = FreshbooksError.failEffectFromReason("transport")
   * console.log(effect)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failEffectFromReason = flow(this.fromReason, Effect.fail);

  /**
   * Create a thunk returning a failed Effect containing a FreshBooks driver error.
   *
   * **Example** (Thunk returning failed Effect)
   *
   * ```ts
   * import { FreshbooksError } from "@beep/freshbooks"
   *
   * const thunk = FreshbooksError.failEffectFromReasonThunk("token refresh")
   * console.log(thunk)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failEffectFromReasonThunk = flow(this.failEffectFromReason, (effect) => () => effect);
}

/**
 * Options used when constructing FreshBooks driver errors.
 *
 * **Example** (Make options with status)
 *
 * ```ts
 * import { FreshbooksErrorOptions } from "@beep/freshbooks"
 *
 * const options = FreshbooksErrorOptions.make({
 *   resource: "payments",
 *   status: 429
 * })
 *
 * console.log(options.status) // 429
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FreshbooksErrorOptions extends S.Class<FreshbooksErrorOptions>($I`FreshbooksErrorOptions`)(
  {
    cause: S.optionalKey(Defect({ includeStack: true })).annotateKey({
      description: "Original native or third-party defect when one was available.",
    }),
    resource: S.optionalKey(S.NonEmptyString).annotateKey({
      description: "FreshBooks resource name associated with the failure.",
    }),
    status: S.optionalKey(FreshbooksHttpStatus).annotateKey({
      description: "HTTP response status code associated with the failure.",
    }),
    url: S.optionalKey(FreshbooksUrl).annotateKey({
      description: "FreshBooks API URL associated with the failure.",
    }),
  },
  $I.annote("FreshbooksErrorOptions", {
    description: "Options for configuring FreshbooksError instances.",
  })
) {}

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- safe reflection keeps unknown API causes inside the FreshBooks boundary
const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      () => undefined
    )
  );
};

const readString = (value: unknown, key: PropertyKey): O.Option<string> =>
  O.filter(readProperty(value, key), P.isString);

const safeBoolean = (evaluate: () => boolean): boolean => Result.getOrElse(Result.try(evaluate), () => false);

const httpClientCauseLabel = (cause: unknown): O.Option<string> =>
  safeBoolean(() => HttpClientError.isHttpClientError(cause))
    ? pipe(
        readProperty(cause, "reason"),
        O.flatMap((reason) => readString(reason, "_tag")),
        O.map((tag) => `HttpClientError:${tag}`)
      )
    : O.none();

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- FreshBooks cause normalization preserves provider-specific HTTP labels
const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        httpClientCauseLabel(cause),
        readString(cause, "_tag"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);
