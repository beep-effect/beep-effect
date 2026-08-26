/**
 * Extended client-error HTTP status schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { $I } from "./HttpStatus.shared.ts";

/**
 * 421 “Misdirected Request” – The request was directed to a server unable to
 * produce a response.
 *
 * **Example** (Log MisdirectedRequest literal)
 *
 * ```ts import.meta.vitest name="Log MisdirectedRequest literal"
 * import { MisdirectedRequest } from "@beep/schema/HttpStatus"
 *
 * console.log(MisdirectedRequest.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const MisdirectedRequest = S.Literal(421).pipe(
  $I.annoteSchema("MisdirectedRequest", {
    description: "421 “Misdirected Request” – The request was directed to a server unable to\nproduce a response.",
    emoji: "🔂",
  })
);

/**
 * {@inheritDoc MisdirectedRequest}
 * @category validation
 * @since 0.0.0
 */
export type MisdirectedRequest = typeof MisdirectedRequest.Type;

/**
 * 422 “Unprocessable Entity” – The request from the client is well-formed but
 * it contains semantic errors that prevent the server from processing a
 * response. If you stumble upon this error, check out our article about the
 * 422 Error Code.
 *
 * **Example** (Log UnprocessableEntity literal)
 *
 * ```ts import.meta.vitest name="Log UnprocessableEntity literal"
 * import { UnprocessableEntity } from "@beep/schema/HttpStatus"
 *
 * console.log(UnprocessableEntity.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const UnprocessableEntity = S.Literal(422).pipe(
  $I.annoteSchema("UnprocessableEntity", {
    description:
      "422 “Unprocessable Entity” – The request from the client is well-formed but\nit contains semantic errors that prevent the server from processing a\nresponse. If you stumble upon this error, check out our article about the\n422 Error Code.",
    emoji: "💩",
  })
);

/**
 * {@inheritDoc UnprocessableEntity}
 * @category validation
 * @since 0.0.0
 */
export type UnprocessableEntity = typeof UnprocessableEntity.Type;

/**
 * 423 “Locked” – The resource that is being accessed is locked.
 *
 * **Example** (Log Locked literal)
 *
 * ```ts import.meta.vitest name="Log Locked literal"
 * import { Locked } from "@beep/schema/HttpStatus"
 *
 * console.log(Locked.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Locked = S.Literal(423).pipe(
  $I.annoteSchema("Locked", {
    description: "423 “Locked” – The resource that is being accessed is locked.",
    emoji: "🔒",
  })
);

/**
 * {@inheritDoc Locked}
 * @category validation
 * @since 0.0.0
 */
export type Locked = typeof Locked.Type;

/**
 * 424 “Failed Dependency” – The request failed because it depended on another
 * request that failed as well.
 *
 * **Example** (Log FailedDependency literal)
 *
 * ```ts import.meta.vitest name="Log FailedDependency literal"
 * import { FailedDependency } from "@beep/schema/HttpStatus"
 *
 * console.log(FailedDependency.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const FailedDependency = S.Literal(424).pipe(
  $I.annoteSchema("FailedDependency", {
    description:
      "424 “Failed Dependency” – The request failed because it depended on another\nrequest that failed as well.",
    emoji: "🧶",
  })
);

/**
 * {@inheritDoc FailedDependency}
 * @category validation
 * @since 0.0.0
 */
export type FailedDependency = typeof FailedDependency.Type;

/**
 * 425 “Too Early” – This error indicates that the server is unwilling to risk
 * processing a request that might be replayed.
 *
 * **Example** (Log TooEarly literal)
 *
 * ```ts import.meta.vitest name="Log TooEarly literal"
 * import { TooEarly } from "@beep/schema/HttpStatus"
 *
 * console.log(TooEarly.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TooEarly = S.Literal(425).pipe(
  $I.annoteSchema("TooEarly", {
    description:
      "425 “Too Early” – This error indicates that the server is unwilling to risk\nprocessing a request that might be replayed.",
    emoji: "⏱",
  })
);

/**
 * {@inheritDoc TooEarly}
 * @category validation
 * @since 0.0.0
 */
export type TooEarly = typeof TooEarly.Type;

/**
 * 426 “Upgrade Required” – The server refuses the request using the current
 * protocols as indicated by the upgrade header sent in response. It is willing
 * to accept the request if the client upgrades to another protocol.
 *
 * **Example** (Log UpgradeRequired literal)
 *
 * ```ts import.meta.vitest name="Log UpgradeRequired literal"
 * import { UpgradeRequired } from "@beep/schema/HttpStatus"
 *
 * console.log(UpgradeRequired.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const UpgradeRequired = S.Literal(426).pipe(
  $I.annoteSchema("UpgradeRequired", {
    description:
      "426 “Upgrade Required” – The server refuses the request using the current\nprotocols as indicated by the upgrade header sent in response. It is willing\nto accept the request if the client upgrades to another protocol.",
    emoji: "📤",
  })
);

/**
 * {@inheritDoc UpgradeRequired}
 * @category validation
 * @since 0.0.0
 */
export type UpgradeRequired = typeof UpgradeRequired.Type;

/**
 * 428 “Precondition Required” – The server requires the request to be
 * conditional. In most cases, this response is used to prevent conflicts when
 * a client uses the GET method to request a resource, modifies it, and then
 * uses PUT to upload the new version while another party may have also altered
 * the same resource.
 *
 * **Example** (Log PreconditionRequired literal)
 *
 * ```ts import.meta.vitest name="Log PreconditionRequired literal"
 * import { PreconditionRequired } from "@beep/schema/HttpStatus"
 *
 * console.log(PreconditionRequired.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PreconditionRequired = S.Literal(428).pipe(
  $I.annoteSchema("PreconditionRequired", {
    description:
      "428 “Precondition Required” – The server requires the request to be\nconditional. In most cases, this response is used to prevent conflicts when\na client uses the GET method to request a resource, modifies it, and then\nuses PUT to upload the new version while another party may have also altered\nthe same resource.",
    emoji: "⛓",
  })
);

/**
 * {@inheritDoc PreconditionRequired}
 * @category validation
 * @since 0.0.0
 */
export type PreconditionRequired = typeof PreconditionRequired.Type;

/**
 * 429 “Too many requests” – The server responds with this code when the user
 * agent has sent too many requests in the given time and has exceeded the rate
 * limit.
 * You may see this error on your WordPress website if bad bots or scripts
 * attempt to access the dashboard. In that case, changing the login URL is
 * recommended which can be easily done from the Login Security settings of the
 * Security Optimizer plugin.
 * You may also see this error when you try to install a Let’s Encrypt SSL, but
 * you’ve accumulated too many failed requests. For more information, read this
 * guide: Let’s Encrypt errors “429 Too Many Requests”, “No Domains
 * Authorized,” and “Certificate is not for the chosen domain.”
 *
 * **Example** (Log TooManyRequests literal)
 *
 * ```ts import.meta.vitest name="Log TooManyRequests literal"
 * import { TooManyRequests } from "@beep/schema/HttpStatus"
 *
 * console.log(TooManyRequests.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TooManyRequests = S.Literal(429).pipe(
  $I.annoteSchema("TooManyRequests", {
    description:
      "429 “Too many requests” – The server responds with this code when the user\nagent has sent too many requests in the given time and has exceeded the rate\nlimit.\nYou may see this error on your WordPress website if bad bots or scripts\nattempt to access the dashboard. In that case, changing the login URL is\nrecommended which can be easily done from the Login Security settings of the\nSecurity Optimizer plugin.\nYou may also see this error when you try to install a Let’s Encrypt SSL, but\nyou’ve accumulated too many failed requests. For more information, read this\nguide: Let’s Encrypt errors “429 Too Many Requests”, “No Domains\nAuthorized,” and “Certificate is not for the chosen domain.”",
    emoji: "🌋",
  })
);

/**
 * {@inheritDoc TooManyRequests}
 * @category validation
 * @since 0.0.0
 */
export type TooManyRequests = typeof TooManyRequests.Type;

/**
 * 431 “Request Header Fields Too Large” – The server can’t process the request
 * because its individual header fields or all combined header fields are too
 * large. The client may submit a new request if the size is reduced.
 *
 * **Example** (Log header fields literal)
 *
 * ```ts import.meta.vitest name="Log header fields literal"
 * import { RequestHeaderFieldsTooLarge } from "@beep/schema/HttpStatus"
 *
 * console.log(RequestHeaderFieldsTooLarge.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const RequestHeaderFieldsTooLarge = S.Literal(431).pipe(
  $I.annoteSchema("RequestHeaderFieldsTooLarge", {
    description:
      "431 “Request Header Fields Too Large” – The server can’t process the request\nbecause its individual header fields or all combined header fields are too\nlarge. The client may submit a new request if the size is reduced.",
    emoji: "🤮",
  })
);

/**
 * {@inheritDoc RequestHeaderFieldsTooLarge}
 * @category validation
 * @since 0.0.0
 */
export type RequestHeaderFieldsTooLarge = typeof RequestHeaderFieldsTooLarge.Type;

/**
 * 451 “Unavailable for Legal Reasons” – The client requests a resource for
 * which the server is legally bound to deny access, such as a web page
 * censored by the government.
 *
 * **Example** (Log legal reasons literal)
 *
 * ```ts import.meta.vitest name="Log legal reasons literal"
 * import { UnavailableForLegalReasons } from "@beep/schema/HttpStatus"
 *
 * console.log(UnavailableForLegalReasons.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const UnavailableForLegalReasons = S.Literal(451).pipe(
  $I.annoteSchema("UnavailableForLegalReasons", {
    description:
      "451 “Unavailable for Legal Reasons” – The client requests a resource for\nwhich the server is legally bound to deny access, such as a web page\ncensored by the government.",
    emoji: "⚖️",
  })
);

/**
 * {@inheritDoc UnavailableForLegalReasons}
 * @category validation
 * @since 0.0.0
 */
export type UnavailableForLegalReasons = typeof UnavailableForLegalReasons.Type;
