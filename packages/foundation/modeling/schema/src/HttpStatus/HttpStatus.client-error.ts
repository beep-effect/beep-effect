/**
 * Client-error HTTP status aggregate schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import {
  BadRequest,
  Conflict,
  Forbidden,
  MethodNotAllowed,
  NotAcceptable,
  NotFound,
  PaymentRequired,
  ProxyAuthenticationRequired,
  RequestTimeout,
  Unauthorized,
} from "./HttpStatus.client-error.core.ts";
import {
  FailedDependency,
  Locked,
  MisdirectedRequest,
  PreconditionRequired,
  RequestHeaderFieldsTooLarge,
  TooEarly,
  TooManyRequests,
  UnavailableForLegalReasons,
  UnprocessableEntity,
  UpgradeRequired,
} from "./HttpStatus.client-error.extended.ts";
import {
  ExpectationFailed,
  Gone,
  ImATeapot,
  LengthRequired,
  PayloadTooLarge,
  PreconditionFailed,
  RangeNotSatisfiable,
  UnsupportedMediaType,
  UriTooLong,
} from "./HttpStatus.client-error.resource.ts";
import { $I } from "./HttpStatus.shared.ts";

/**
 * The 4XX codes are HTTP error status codes. They define errors as invalid
 * requests from your browser that the website’s server can’t process.
 * The problem may be a syntax error in the request, a non-existent URL, wrong
 * credentials, etc. Your browser will usually produce a page with a particular
 * error code.
 *
 * **Example** (Log pairs length)
 *
 * ```ts
 * import { HttpStatus4XX } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatus4XX.Pairs.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpStatus4XX = MappedLiteralKit([
  ["BadRequest", BadRequest.literal],
  ["Unauthorized", Unauthorized.literal],
  ["PaymentRequired", PaymentRequired.literal],
  ["Forbidden", Forbidden.literal],
  ["NotFound", NotFound.literal],
  ["MethodNotAllowed", MethodNotAllowed.literal],
  ["NotAcceptable", NotAcceptable.literal],
  ["ProxyAuthenticationRequired", ProxyAuthenticationRequired.literal],
  ["RequestTimeout", RequestTimeout.literal],
  ["Conflict", Conflict.literal],
  ["Gone", Gone.literal],
  ["LengthRequired", LengthRequired.literal],
  ["PreconditionFailed", PreconditionFailed.literal],
  ["PayloadTooLarge", PayloadTooLarge.literal],
  ["UriTooLong", UriTooLong.literal],
  ["UnsupportedMediaType", UnsupportedMediaType.literal],
  ["RangeNotSatisfiable", RangeNotSatisfiable.literal],
  ["ExpectationFailed", ExpectationFailed.literal],
  ["ImATeapot", ImATeapot.literal],
  ["MisdirectedRequest", MisdirectedRequest.literal],
  ["UnprocessableEntity", UnprocessableEntity.literal],
  ["Locked", Locked.literal],
  ["FailedDependency", FailedDependency.literal],
  ["TooEarly", TooEarly.literal],
  ["UpgradeRequired", UpgradeRequired.literal],
  ["PreconditionRequired", PreconditionRequired.literal],
  ["TooManyRequests", TooManyRequests.literal],
  ["RequestHeaderFieldsTooLarge", RequestHeaderFieldsTooLarge.literal],
  ["UnavailableForLegalReasons", UnavailableForLegalReasons.literal],
]).pipe(
  $I.annoteSchema("HttpStatus4XX", {
    description:
      "The 4XX codes are HTTP error status codes. " +
      "They define errors as invalid requests from your browser that " +
      "the website’s server can’t process. The problem may be a syntax error " +
      "in the request, a non-existent URL, wrong credentials, etc. Your " +
      "browser will usually produce a page with a particular error code.",
  })
);

/**
 * A namespace for {@link HttpStatus4XX} to contain the Encoded type
 *
 * **Example** (Decode Encoded BadRequest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpStatus4XX } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus4XX.Encoded = "BadRequest"
 * const status = S.decodeUnknownSync(HttpStatus4XX)(encoded)
 * console.log(status) // 400
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export declare namespace HttpStatus4XX {
  /**
   * The encoded type of {@link HttpStatus4XX}
   *
   * @category validation
   * @since 0.0.0
   */
  export type Encoded = typeof HttpStatus4XX.Encoded;
}

/**
 * {@inheritDoc HttpStatus4XX}
 * @category validation
 * @since 0.0.0
 */
export type HttpStatus4XX = typeof HttpStatus4XX.Type;
