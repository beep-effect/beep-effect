/**
 * Unofficial HTTP status aggregate schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import { $I } from "./HttpStatus.shared.ts";
import {
  ClientClosedRequest,
  InvalidSslCertificate,
  LoginTimeout,
  RequestHeaderFieldsTooLargeShopify,
  RequestHeaderTooLarge,
  SslCertificateError,
  SslCertificateRequired,
  SslHandshakeFailed,
  WebServerIsDown,
  WebServerReturnedAnUnknownError,
} from "./HttpStatus.unofficial.ts";

/**
 * The codes above are officially recognized by IANA, but different platforms
 * use unofficial HTTP codes to indicate specific problems related to their
 * services. The following codes are used in some of the most popular online
 * services.
 *
 * **Example** (Log unofficial pairs length)
 *
 * ```ts import.meta.vitest name="Log unofficial pairs length"
 * import { HttpStatusUnofficial } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatusUnofficial.Pairs.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpStatusUnofficial = MappedLiteralKit([
  ["RequestHeaderFieldsTooLargeShopify", RequestHeaderFieldsTooLargeShopify.literal],
  ["LoginTimeout", LoginTimeout.literal],
  ["RequestHeaderTooLarge", RequestHeaderTooLarge.literal],
  ["SslCertificateError", SslCertificateError.literal],
  ["SslCertificateRequired", SslCertificateRequired.literal],
  ["ClientClosedRequest", ClientClosedRequest.literal],
  ["WebServerReturnedAnUnknownError", WebServerReturnedAnUnknownError.literal],
  ["WebServerIsDown", WebServerIsDown.literal],
  ["SslHandshakeFailed", SslHandshakeFailed.literal],
  ["InvalidSslCertificate", InvalidSslCertificate.literal],
]).pipe(
  $I.annoteSchema("HttpStatusUnofficial", {
    description:
      "The codes above are officially recognized by IANA, but different platforms\nuse unofficial HTTP codes to indicate specific problems related to their\nservices. The following codes are used in some of the most popular online\nservices.",
  })
);

/**
 * A namespace for {@link HttpStatusUnofficial} to contain the Encoded type
 *
 * **Example** (Decode unofficial status code)
 *
 * ```ts import.meta.vitest name="Decode unofficial status code"
 * import * as S from "effect/Schema"
 * import { HttpStatusUnofficial } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatusUnofficial.Encoded = "RequestHeaderFieldsTooLargeShopify"
 * const status = S.decodeUnknownSync(HttpStatusUnofficial)(encoded)
 * status // => 430
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export declare namespace HttpStatusUnofficial {
  /**
   * The encoded type of {@link HttpStatusUnofficial}
   *
   * @category validation
   * @since 0.0.0
   */
  export type Encoded = typeof HttpStatusUnofficial.Encoded;
}

/**
 * {@inheritDoc HttpStatusUnofficial}
 * @category validation
 * @since 0.0.0
 */
export type HttpStatusUnofficial = typeof HttpStatusUnofficial.Type;
