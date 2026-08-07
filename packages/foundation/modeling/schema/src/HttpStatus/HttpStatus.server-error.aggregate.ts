/**
 * Server-error HTTP status aggregate schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import {
  BadGateway,
  GatewayTimeout,
  HttpVersionNotSupported,
  InsufficientStorage,
  InternalServerError,
  LoopDetected,
  NetworkAuthenticationRequired,
  NotExtended,
  NotImplemented,
  ServiceUnavailable,
  VariantAlsoNegotiates,
} from "./HttpStatus.server-error.ts";
import { $I } from "./HttpStatus.shared.ts";

/**
 * The 5XX HTTP codes indicate that there is a problem on the website’s server
 * that prevents it from processing a request. Like the 4XX codes, you
 * will see an error page on your browser when a 5XX error is triggered.
 *
 * **Example** (Count 5XX status pairs)
 *
 * ```ts
 * import { HttpStatus5XX } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatus5XX.Pairs.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpStatus5XX = MappedLiteralKit([
  ["InternalServerError", InternalServerError.literal],
  ["NotImplemented", NotImplemented.literal],
  ["BadGateway", BadGateway.literal],
  ["ServiceUnavailable", ServiceUnavailable.literal],
  ["GatewayTimeout", GatewayTimeout.literal],
  ["HttpVersionNotSupported", HttpVersionNotSupported.literal],
  ["VariantAlsoNegotiates", VariantAlsoNegotiates.literal],
  ["InsufficientStorage", InsufficientStorage.literal],
  ["LoopDetected", LoopDetected.literal],
  ["NotExtended", NotExtended.literal],
  ["NetworkAuthenticationRequired", NetworkAuthenticationRequired.literal],
]).pipe(
  $I.annoteSchema("HttpStatus5XX", {
    description:
      "The 5XX HTTP codes indicate that there is a problem on the website’s server that prevents it from processing a request. Like the 4XX codes, you will see an error page on your browser when a 5XX error is triggered.",
  })
);

/**
 * A namespace for {@link HttpStatus5XX} to contain the Encoded type
 *
 * **Example** (Decode 5XX encoded name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpStatus5XX } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus5XX.Encoded = "InternalServerError"
 * const status = S.decodeUnknownSync(HttpStatus5XX)(encoded)
 * console.log(status) // 500
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export declare namespace HttpStatus5XX {
  /**
   * The encoded type of {@link HttpStatus5XX}
   *
   * @category validation
   * @since 0.0.0
   */
  export type Encoded = typeof HttpStatus5XX.Encoded;
}

/**
 * {@inheritDoc HttpStatus5XX}
 *
 * **Example** (Annotate 5XX status type)
 *
 * ```ts
 * import type { HttpStatus5XX } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatus5XX = 500
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HttpStatus5XX = typeof HttpStatus5XX.Type;
