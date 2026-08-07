/**
 * Core client-error HTTP status schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { $I } from "./HttpStatus.shared.ts";

// =============================================================================
// 4XX Status Codes - Client Errors
// =============================================================================

/**
 * 400 “Bad Request” – The server can’t return a valid response due to an error
 * from the client’s side. Common causes are URLs with invalid syntax, deceptive
 * request routing, large file size, etc.
 *
 * **Example** (Log BadRequest literal)
 *
 * ```ts
 * import { BadRequest } from "@beep/schema/HttpStatus"
 *
 * console.log(BadRequest.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BadRequest = S.Literal(400).pipe(
  $I.annoteSchema("BadRequest", {
    description:
      "400 “Bad Request” – The server can’t return a valid response due to an error\nfrom the client’s side. Common causes are URLs with invalid syntax, deceptive\nrequest routing, large file size, etc.",
    emoji: "🚫",
  })
);

/**
 * {@inheritDoc BadRequest}
 *
 * **Example** (Assign BadRequest type)
 *
 * ```ts
 * import type { BadRequest } from "@beep/schema/HttpStatus"
 *
 * const status: BadRequest = 400
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type BadRequest = typeof BadRequest.Type;

/**
 * 401 “Unauthorized” – This error appears when the client fails to provide
 * valid credentials and the response from the server includes a
 * WWW-Authenticate header. You will likely see this error when you try to
 * access password-protected URLs and don’t have the correct login information.
 * If you experience this problem, check this guide for
 * {@link https://www.siteground.com/kb/error-401/
 * | troubleshooting the HTTP 401 error.}
 *
 * **Example** (Log Unauthorized literal)
 *
 * ```ts
 * import { Unauthorized } from "@beep/schema/HttpStatus"
 *
 * console.log(Unauthorized.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Unauthorized = S.Literal(401).pipe(
  $I.annoteSchema("Unauthorized", {
    description:
      "401 “Unauthorized” – This error appears when the client fails to " +
      "provide\nvalid credentials and the response from the server includes " +
      "a\nWWW-Authenticate header. You will likely see this error when you " +
      "try to\naccess password-protected URLs and don’t have " +
      "the correct login information.\nIf you experience this problem," +
      " check this guide " +
      "for\n{@link https://www.siteground.com/kb/error-401/\n| " +
      "troubleshooting the HTTP 401 error.}",
    emoji: "🔐",
  })
);

/**
 * {@inheritDoc Unauthorized}
 *
 * **Example** (Assign Unauthorized type)
 *
 * ```ts
 * import type { Unauthorized } from "@beep/schema/HttpStatus"
 *
 * const status: Unauthorized = 401
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type Unauthorized = typeof Unauthorized.Type;

/**
 * 402 “Payment Required” – This is not a standard code however it is reserved
 * to be used in the future by payment systems. The purpose of the code is to
 * indicate that the content is not available due to a failed payment.
 *
 * **Example** (Log PaymentRequired literal)
 *
 * ```ts
 * import { PaymentRequired } from "@beep/schema/HttpStatus"
 *
 * console.log(PaymentRequired.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PaymentRequired = S.Literal(402).pipe(
  $I.annoteSchema("PaymentRequired", {
    description:
      "402 “Payment Required” – This is not a standard code however it is reserved\nto be used in the future by payment systems. The purpose of the code is to\nindicate that the content is not available due to a failed payment.",
    emoji: "💰",
  })
);

/**
 * {@inheritDoc PaymentRequired}
 *
 * **Example** (Assign PaymentRequired type)
 *
 * ```ts
 * import type { PaymentRequired } from "@beep/schema/HttpStatus"
 *
 * const status: PaymentRequired = 402
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type PaymentRequired = typeof PaymentRequired.Type;

/**
 * 403 “Forbidden” – The error indicates that the server denies access to the
 * user agent that doesn’t have permission to access the resources. This error
 * is similar to HTTP code 401, but the difference is that in this case, the
 * identity of the user agent is known.
 * Typical causes of this error are restrictive rules from the website’s
 * server, insufficient permissions for the website’s files and folders, etc.
 * For more information, read this article about the HTTP 403 error and how to
 * fix it.
 *
 * **Example** (Log Forbidden literal)
 *
 * ```ts
 * import { Forbidden } from "@beep/schema/HttpStatus"
 *
 * console.log(Forbidden.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Forbidden = S.Literal(403).pipe(
  $I.annoteSchema("Forbidden", {
    description:
      "403 “Forbidden” – The error indicates that the server denies access to the\nuser agent that doesn’t have permission to access the resources. This error\nis similar to HTTP code 401, but the difference is that in this case, the\nidentity of the user agent is known.\nTypical causes of this error are restrictive rules from the website’s\nserver, insufficient permissions for the website’s files and folders, etc.\nFor more information, read this article about the HTTP 403 error and how to\nfix it.",
    emoji: "⛔",
  })
);

/**
 * {@inheritDoc Forbidden}
 *
 * **Example** (Assign Forbidden type)
 *
 * ```ts
 * import type { Forbidden } from "@beep/schema/HttpStatus"
 *
 * const status: Forbidden = 403
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type Forbidden = typeof Forbidden.Type;

/**
 * 404 “Not found” – This is the most frequent error users see online. It means
 * that the server can’t find the requested resource. Usually, the cause is
 * that the URL you’re trying to access doesn’t exist.
 * The error could also be caused by a website misconfiguration. Read the
 * following guide for troubleshooting the HTTP error 404.
 *
 * **Example** (Log NotFound literal)
 *
 * ```ts
 * import { NotFound } from "@beep/schema/HttpStatus"
 *
 * console.log(NotFound.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NotFound = S.Literal(404).pipe(
  $I.annoteSchema("NotFound", {
    description:
      "404 “Not found” – This is the most frequent error users see online. It means\nthat the server can’t find the requested resource. Usually, the cause is\nthat the URL you’re trying to access doesn’t exist.\nThe error could also be caused by a website misconfiguration. Read the\nfollowing guide for troubleshooting the HTTP error 404.",
    emoji: "❓",
  })
);

/**
 * {@inheritDoc NotFound}
 *
 * **Example** (Assign NotFound type)
 *
 * ```ts
 * import type { NotFound } from "@beep/schema/HttpStatus"
 *
 * const status: NotFound = 404
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type NotFound = typeof NotFound.Type;

/**
 * 405 “Method Not Allowed” – The server understands the requested method, but
 * the target resource doesn’t support it.
 *
 * **Example** (Log MethodNotAllowed literal)
 *
 * ```ts
 * import { MethodNotAllowed } from "@beep/schema/HttpStatus"
 *
 * console.log(MethodNotAllowed.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const MethodNotAllowed = S.Literal(405).pipe(
  $I.annoteSchema("MethodNotAllowed", {
    description:
      "405 “Method Not Allowed” – The server understands the requested method, but\nthe target resource doesn’t support it.",
    emoji: "❗",
  })
);

/**
 * {@inheritDoc MethodNotAllowed}
 *
 * **Example** (Assign MethodNotAllowed type)
 *
 * ```ts
 * import type { MethodNotAllowed } from "@beep/schema/HttpStatus"
 *
 * const status: MethodNotAllowed = 405
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type MethodNotAllowed = typeof MethodNotAllowed.Type;

/**
 * 406 “Not Acceptable” – The requested resource generated content that doesn’t
 * meet the criteria of the user-agent who requested it.
 *
 * **Example** (Log NotAcceptable literal)
 *
 * ```ts
 * import { NotAcceptable } from "@beep/schema/HttpStatus"
 *
 * console.log(NotAcceptable.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NotAcceptable = S.Literal(406).pipe(
  $I.annoteSchema("NotAcceptable", {
    description:
      "406 “Not Acceptable” – The requested resource generated content that doesn’t\nmeet the criteria of the user-agent who requested it.",
    emoji: "🛡",
  })
);

/**
 * {@inheritDoc NotAcceptable}
 *
 * **Example** (Assign NotAcceptable type)
 *
 * ```ts
 * import type { NotAcceptable } from "@beep/schema/HttpStatus"
 *
 * const status: NotAcceptable = 406
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type NotAcceptable = typeof NotAcceptable.Type;

/**
 * 407 “Proxy Authentication Required” – There is a proxy server used in the
 * communication between the browser and the server and it requires
 * authentication.
 *
 * **Example** (Log ProxyAuthenticationRequired literal)
 *
 * ```ts
 * import { ProxyAuthenticationRequired } from "@beep/schema/HttpStatus"
 *
 * console.log(ProxyAuthenticationRequired.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ProxyAuthenticationRequired = S.Literal(407).pipe(
  $I.annoteSchema("ProxyAuthenticationRequired", {
    description:
      "407 “Proxy Authentication Required” – There is a proxy server used in the\ncommunication between the browser and the server and it requires\nauthentication.",
    emoji: "🔩",
  })
);

/**
 * {@inheritDoc ProxyAuthenticationRequired}
 *
 * **Example** (Assign ProxyAuthenticationRequired type)
 *
 * ```ts
 * import type { ProxyAuthenticationRequired } from "@beep/schema/HttpStatus"
 *
 * const status: ProxyAuthenticationRequired = 407
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ProxyAuthenticationRequired = typeof ProxyAuthenticationRequired.Type;

/**
 * 408 “Request Timeout” – The server closed due to a time-out while waiting
 * for a request from your browser. In some cases, servers may send this
 * message on an idle connection even without any previous request from the
 * client.
 * It should be noted that servers may close the connection without sending a
 * message.
 *
 * **Example** (Log RequestTimeout literal)
 *
 * ```ts
 * import { RequestTimeout } from "@beep/schema/HttpStatus"
 *
 * console.log(RequestTimeout.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const RequestTimeout = S.Literal(408).pipe(
  $I.annoteSchema("RequestTimeout", {
    description:
      "408 “Request Timeout” – The server closed due to a time-out while waiting\nfor a request from your browser. In some cases, servers may send this\nmessage on an idle connection even without any previous request from the\nclient.\nIt should be noted that servers may close the connection without sending a\nmessage.",
    emoji: "⌛️",
  })
);

/**
 * {@inheritDoc RequestTimeout}
 *
 * **Example** (Assign RequestTimeout type)
 *
 * ```ts
 * import type { RequestTimeout } from "@beep/schema/HttpStatus"
 *
 * const status: RequestTimeout = 408
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type RequestTimeout = typeof RequestTimeout.Type;

/**
 * 409 “Conflict” – This error occurs when a request can not be processed due
 * to a conflict in the current state of the resource on the server. An example
 * of this error is when multiple edits of the same file are submitted to the
 * server and the edits conflict with each other.
 *
 * **Example** (Log Conflict literal)
 *
 * ```ts
 * import { Conflict } from "@beep/schema/HttpStatus"
 *
 * console.log(Conflict.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Conflict = S.Literal(409).pipe(
  $I.annoteSchema("Conflict", {
    description:
      "409 “Conflict” – This error occurs when a request can not be processed due\nto a conflict in the current state of the resource on the server. An example\nof this error is when multiple edits of the same file are submitted to the\nserver and the edits conflict with each other.",
    emoji: "💥",
  })
);

/**
 * {@inheritDoc Conflict}
 *
 * **Example** (Assign Conflict type)
 *
 * ```ts
 * import type { Conflict } from "@beep/schema/HttpStatus"
 *
 * const status: Conflict = 409
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type Conflict = typeof Conflict.Type;
