/**
 * Typed technical errors for the FreshBooks driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FreshbooksId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { O } from "@beep/utils";
import { Effect } from "effect";
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

// Reduce an unknown thrown cause to a short, non-sensitive label. Kept as one
// self-contained reducer (rather than a chain of reflection helpers) so the
// boundary stays compact and does not leak raw API payloads.
const readTag = (value: unknown, key: string): O.Option<string> =>
  P.isObject(value) ? O.filter(O.fromNullishOr(Reflect.get(value, key) as unknown), P.isString) : O.none();

const causeLabel = (cause: unknown): O.Option<string> => {
  if (P.isUndefined(cause)) {
    return O.none();
  }
  if (HttpClientError.isHttpClientError(cause)) {
    return O.map(readTag(cause.reason, "_tag"), (tag) => `HttpClientError:${tag}`);
  }
  return O.firstSomeOf([
    readTag(cause, "_tag"),
    readTag(cause, "name"),
    P.isString(cause) ? O.some("String") : O.none(),
  ]);
};

// Diagnostic options for FreshbooksError.fromReason. Internal: the driver
// constructs errors through the static below, so consumers never name this.
type FreshbooksErrorOptions = {
  readonly cause?: unknown;
  readonly resource?: string;
  readonly status?: number;
  readonly url?: string;
};

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
   * Create a FreshBooks driver error, deriving a redacted cause label from an
   * optional thrown cause.
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
        cause: causeLabel(options.cause),
        resource: O.fromUndefinedOr(options.resource),
        status: O.fromUndefinedOr(options.status),
        url: O.fromUndefinedOr(options.url),
      }),
    });

  /**
   * Fail an Effect with a FreshBooks driver error built from a reason.
   *
   * **Example** (Fail an Effect from a reason)
   *
   * ```ts
   * import { FreshbooksError } from "@beep/freshbooks"
   *
   * const effect = FreshbooksError.failFromReason("token refresh")
   * console.log(effect)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failFromReason = (
    reason: FreshbooksErrorReason,
    options: FreshbooksErrorOptions = {}
  ): Effect.Effect<never, FreshbooksError> => Effect.fail(FreshbooksError.fromReason(reason, options));
}
