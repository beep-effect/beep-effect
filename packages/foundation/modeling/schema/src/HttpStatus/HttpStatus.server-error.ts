/**
 * Server-error HTTP status schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { $I } from "./HttpStatus.shared.ts";

// =============================================================================
// 5XX Status Codes - Server Errors
// =============================================================================

/**
 * 500 “Internal Server Error” – This is a generic error that indicates the
 * server encountered an unexpected condition and can’t fulfill the request.
 * The server tells you there is something wrong, but it is not sure what the
 * problem is. Usually, the issue stems from the website configuration on
 * the client’s side. Read this tutorial on {@link https://www.siteground.com/kb/internal_server_error_500/ | what an “HTTP Error 500 –
 * Internal Server Error” is and how to fix it} for more information.
 *
 * **Example** (Log InternalServerError literal)
 *
 * ```ts import.meta.vitest name="Log InternalServerError literal"
 * import { InternalServerError } from "@beep/schema/HttpStatus"
 *
 * console.log(InternalServerError.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const InternalServerError = S.Literal(500).pipe(
  $I.annoteSchema("InternalServerError", {
    description:
      "500 “Internal Server Error” – This is a generic error that indicates the\nserver encountered an unexpected condition and can’t fulfill the request.\nThe server tells you there is something wrong, but it is not sure what the\nproblem is. Usually, the issue stems from the website configuration on\nthe client’s side. Read this tutorial on {@link https://www.siteground.com/kb/internal_server_error_500/ | what an “HTTP Error 500 –\nInternal Server Error” is and how to fix it} for more information.",
    emoji: "💣",
  })
);

/**
 * {@inheritDoc InternalServerError}
 * @category validation
 * @since 0.0.0
 */
export type InternalServerError = typeof InternalServerError.Type;

/**
 * 501 “Not Implemented” – The server doesn’t support the request method or
 * doesn’t have the ability to fulfill the request.
 *
 * **Example** (Log NotImplemented literal)
 *
 * ```ts import.meta.vitest name="Log NotImplemented literal"
 * import { NotImplemented } from "@beep/schema/HttpStatus"
 *
 * console.log(NotImplemented.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NotImplemented = S.Literal(501).pipe(
  $I.annoteSchema("NotImplemented", {
    description:
      "501 “Not Implemented” – The server doesn’t support the request method or doesn’t have the ability to fulfill the request.",
    emoji: "📭",
  })
);

/**
 * {@inheritDoc NotImplemented}
 * @category validation
 * @since 0.0.0
 */
export type NotImplemented = typeof NotImplemented.Type;

/**
 * 502 “Bad Gateway” – This error indicates that the server acted as a gateway
 * or a proxy and received an invalid response from the upstream server. This
 * is the official description, but various factors can cause this error. Find
 * out more about the HTTP 502 “Bad Gateway” error and how to fix it here.
 *
 * **Example** (Log BadGateway literal)
 *
 * ```ts import.meta.vitest name="Log BadGateway literal"
 * import { BadGateway } from "@beep/schema/HttpStatus"
 *
 * console.log(BadGateway.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BadGateway = S.Literal(502).pipe(
  $I.annoteSchema("BadGateway", {
    description:
      "502 “Bad Gateway” – This error indicates that the server acted as a gateway\nor a proxy and received an invalid response from the upstream server. This\nis the official description, but various factors can cause this error. Find\nout more about the HTTP 502 “Bad Gateway” error and how to fix it here.",
    emoji: "🚧",
  })
);

/**
 * {@inheritDoc BadGateway}
 * @category validation
 * @since 0.0.0
 */
export type BadGateway = typeof BadGateway.Type;

/**
 * 503 “Service Unavailable” – The server can’t handle the request. This is
 * usually a temporary condition caused by overload or ongoing maintenance on
 * the server. Read this guide on what the HTTP 503 “Service Unavailable” error
 * is and how to fix it.
 *
 * **Example** (Log ServiceUnavailable literal)
 *
 * ```ts import.meta.vitest name="Log ServiceUnavailable literal"
 * import { ServiceUnavailable } from "@beep/schema/HttpStatus"
 *
 * console.log(ServiceUnavailable.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ServiceUnavailable = S.Literal(503).pipe(
  $I.annoteSchema("ServiceUnavailable", {
    description:
      "503 “Service Unavailable” – The server can’t handle the request. This is\nusually a temporary condition caused by overload or ongoing maintenance on\nthe server. Read this guide on what the HTTP 503 “Service Unavailable” error\nis and how to fix it.",
    emoji: "🚨",
  })
);

/**
 * {@inheritDoc ServiceUnavailable}
 * @category validation
 * @since 0.0.0
 */
export type ServiceUnavailable = typeof ServiceUnavailable.Type;

/**
 * 504 “Gateway Timeout” – The server acted as a gateway and did not receive a
 * timely response from the upstream server. In most cases, this error is
 * caused by PHP scripts that don’t finish in time and exceed the server’s
 * max_execution_time PHP variable timeout limit, hence the server terminates
 * the connection. See more details in this article about the HTTP 504
 * “Gateway Timeout” and how to fix it.
 *
 * **Example** (Log GatewayTimeout literal)
 *
 * ```ts import.meta.vitest name="Log GatewayTimeout literal"
 * import { GatewayTimeout } from "@beep/schema/HttpStatus"
 *
 * console.log(GatewayTimeout.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const GatewayTimeout = S.Literal(504).pipe(
  $I.annoteSchema("GatewayTimeout", {
    description:
      "504 “Gateway Timeout” – The server acted as a gateway and did not receive a\ntimely response from the upstream server. In most cases, this error is\ncaused by PHP scripts that don’t finish in time and exceed the server’s\nmax_execution_time PHP variable timeout limit, hence the server terminates\nthe connection. See more details in this article about the HTTP 504\n“Gateway Timeout” and how to fix it.",
    emoji: "⏲",
  })
);

/**
 * {@inheritDoc GatewayTimeout}
 * @category validation
 * @since 0.0.0
 */
export type GatewayTimeout = typeof GatewayTimeout.Type;

/**
 * 505 “HTTP Version Not Supported” – The server doesn’t support the HTTP
 * protocol version used in the request.
 *
 * **Example** (Log HttpVersionNotSupported literal)
 *
 * ```ts import.meta.vitest name="Log HttpVersionNotSupported literal"
 * import { HttpVersionNotSupported } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpVersionNotSupported.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpVersionNotSupported = S.Literal(505).pipe(
  $I.annoteSchema("HttpVersionNotSupported", {
    description:
      "505 “HTTP Version Not Supported” – The server doesn’t support the HTTP\nprotocol version used in the request.",
    emoji: "🕯",
  })
);

/**
 * {@inheritDoc HttpVersionNotSupported}
 * @category validation
 * @since 0.0.0
 */
export type HttpVersionNotSupported = typeof HttpVersionNotSupported.Type;

/**
 * 506 “Variant Also Negotiates” – This error occurs when the client and the
 * server enter into Transparent Content Negotiation, which allows the client
 * to retrieve the best variant of a resource when the server supports multiple
 * versions. However, there is a misconfiguration, and the chosen resource also
 * prompts content negotiation that causes a closed loop.
 *
 * **Example** (Log VariantAlsoNegotiates literal)
 *
 * ```ts import.meta.vitest name="Log VariantAlsoNegotiates literal"
 * import { VariantAlsoNegotiates } from "@beep/schema/HttpStatus"
 *
 * console.log(VariantAlsoNegotiates.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const VariantAlsoNegotiates = S.Literal(506).pipe(
  $I.annoteSchema("VariantAlsoNegotiates", {
    description:
      "506 “Variant Also Negotiates” – This error occurs when the client and the\nserver enter into Transparent Content Negotiation, which allows the client\nto retrieve the best variant of a resource when the server supports multiple\nversions. However, there is a misconfiguration, and the chosen resource also\nprompts content negotiation that causes a closed loop.",
    emoji: "☢️",
  })
);

/**
 * {@inheritDoc VariantAlsoNegotiates}
 * @category validation
 * @since 0.0.0
 */
export type VariantAlsoNegotiates = typeof VariantAlsoNegotiates.Type;

/**
 * 507 “Insufficient Storage” (WebDAV) – The server is unable to store the
 * representation required to complete the request.
 *
 * **Example** (Log InsufficientStorage literal)
 *
 * ```ts import.meta.vitest name="Log InsufficientStorage literal"
 * import { InsufficientStorage } from "@beep/schema/HttpStatus"
 *
 * console.log(InsufficientStorage.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const InsufficientStorage = S.Literal(507).pipe(
  $I.annoteSchema("InsufficientStorage", {
    description:
      "507 “Insufficient Storage” (WebDAV) – The server is unable to store the\nrepresentation required to complete the request.",
    emoji: "💯",
  })
);

/**
 * {@inheritDoc InsufficientStorage}
 * @category validation
 * @since 0.0.0
 */
export type InsufficientStorage = typeof InsufficientStorage.Type;

/**
 * 508 “Loop Detected” (WebDAV) – The server detected an infinite loop while
 * processing the request.
 *
 * **Example** (Log LoopDetected literal)
 *
 * ```ts import.meta.vitest name="Log LoopDetected literal"
 * import { LoopDetected } from "@beep/schema/HttpStatus"
 *
 * console.log(LoopDetected.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const LoopDetected = S.Literal(508).pipe(
  $I.annoteSchema("LoopDetected", {
    description: "508 “Loop Detected” (WebDAV) – The server detected an infinite loop while\nprocessing the request.",
    emoji: "➰",
  })
);

/**
 * {@inheritDoc LoopDetected}
 * @category validation
 * @since 0.0.0
 */
export type LoopDetected = typeof LoopDetected.Type;

/**
 * 510 “Not Extended” – Further extensions to the request are required for the
 * server to fulfill it. This code is now deprecated.
 *
 * **Example** (Log NotExtended literal)
 *
 * ```ts import.meta.vitest name="Log NotExtended literal"
 * import { NotExtended } from "@beep/schema/HttpStatus"
 *
 * console.log(NotExtended.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NotExtended = S.Literal(510).pipe(
  $I.annoteSchema("NotExtended", {
    description:
      "510 “Not Extended” – Further extensions to the request are required for the\nserver to fulfill it. This code is now deprecated.",
    emoji: "🏗",
  })
);

/**
 * {@inheritDoc NotExtended}
 * @category validation
 * @since 0.0.0
 */
export type NotExtended = typeof NotExtended.Type;

/**
 * 511 “Network Authentication Required” – This response is sent when you need
 * to be authenticated so the network can send your request to a server. Most
 * commonly, it is seen when trying to use a Wi-Fi network, and you need to
 * agree to its Terms of Agreement.
 *
 * **Example** (Log NetworkAuthenticationRequired literal)
 *
 * ```ts import.meta.vitest name="Log NetworkAuthenticationRequired literal"
 * import { NetworkAuthenticationRequired } from "@beep/schema/HttpStatus"
 *
 * console.log(NetworkAuthenticationRequired.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NetworkAuthenticationRequired = S.Literal(511).pipe(
  $I.annoteSchema("NetworkAuthenticationRequired", {
    description:
      "511 “Network Authentication Required” – This response is sent when you need\nto be authenticated so the network can send your request to a server. Most\ncommonly, it is seen when trying to use a Wi-Fi network, and you need to\nagree to its Terms of Agreement.",
    emoji: "🔑",
  })
);

/**
 * {@inheritDoc NetworkAuthenticationRequired}
 * @category validation
 * @since 0.0.0
 */
export type NetworkAuthenticationRequired = typeof NetworkAuthenticationRequired.Type;
