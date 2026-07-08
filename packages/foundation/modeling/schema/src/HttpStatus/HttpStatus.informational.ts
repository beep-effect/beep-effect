/**
 * Informational HTTP status schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import { $I } from "./HttpStatus.shared.ts";

// =============================================================================
// 1XX Status Codes - Informational
// =============================================================================

/**
 * 100 “Continue” – The server has received the headers of the request.
 * It now tells your browser to proceed with sending the body of the request.
 *
 * @example
 * ```ts
 * import { Continue } from "@beep/schema/HttpStatus"
 *
 * console.log(Continue.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Continue = S.Literal(100).pipe(
  $I.annoteSchema("Continue", {
    description:
      "100 “Continue” – The server has received the headers of the request.\nIt now tells your browser to proceed with sending the body of the request.",
    emoji: "🏁",
  })
);

/**
 * {@inheritDoc Continue}
 *
 * @example
 * ```ts
 * import type { Continue } from "@beep/schema/HttpStatus"
 *
 * const status: Continue = 100
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type Continue = typeof Continue.Type;

/**
 * 101 “Switching Protocols” – The requesting client (browser) asked the server to
 * change the protocols, and the server fulfilled the request.
 *
 * @example
 * ```ts
 * import { SwitchingProtocols } from "@beep/schema/HttpStatus"
 *
 * console.log(SwitchingProtocols.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const SwitchingProtocols = S.Literal(101).pipe(
  $I.annoteSchema("SwitchingProtocols", {
    description:
      "101 “Switching Protocols” – The requesting client (browser) asked the server\nto change the protocols, and the server fulfilled the request.",
    emoji: "🔌",
  })
);

/**
 * {@inheritDoc SwitchingProtocols}
 *
 * @example
 * ```ts
 * import type { SwitchingProtocols } from "@beep/schema/HttpStatus"
 *
 * const status: SwitchingProtocols = 101
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type SwitchingProtocols = typeof SwitchingProtocols.Type;

/**
 * 102 “Processing” – This is a response mainly associated with WebDAV
 * requests, which may take a longer time to be completed. It indicates that
 * the server has received the request and is currently processing it.
 *
 * @example
 * ```ts
 * import { Processing } from "@beep/schema/HttpStatus"
 *
 * console.log(Processing.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Processing = S.Literal(102).pipe(
  $I.annoteSchema("Processing", {
    description:
      "102 “Processing” – This is a response mainly associated with WebDAV\nrequests, which may take a longer time to be completed. It indicates that\nthe server has received the request and is currently processing it.",
    emoji: "⚙️",
  })
);

/**
 * {@inheritDoc Processing}
 *
 * @example
 * ```ts
 * import type { Processing } from "@beep/schema/HttpStatus"
 *
 * const status: Processing = 102
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type Processing = typeof Processing.Type;

/**
 * 103 “Early Hints” – The server returns some response headers before the
 * final HTTP response is sent.
 *
 * @example
 * ```ts
 * import { EarlyHints } from "@beep/schema/HttpStatus"
 *
 * console.log(EarlyHints.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const EarlyHints = S.Literal(103).pipe(
  $I.annoteSchema("EarlyHints", {
    description:
      "103 “Early Hints” – The server returns some response headers before the\nfinal HTTP response is sent.",
    emoji: "💡",
  })
);

/**
 * {@inheritDoc EarlyHints}
 *
 * @example
 * ```ts
 * import type { EarlyHints } from "@beep/schema/HttpStatus"
 *
 * const status: EarlyHints = 103
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type EarlyHints = typeof EarlyHints.Type;

/**
 * 1XX codes are informational responses from the website’s server. They do not
 * generate content and only update clients on the progress of their requests.
 * This information is sent in the headers of the HTTP response.
 *
 * @example
 * ```ts
 * import { HttpStatus1XX } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatus1XX.Pairs.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const HttpStatus1XX = MappedLiteralKit([
  ["Continue", Continue.literal],
  ["SwitchingProtocols", SwitchingProtocols.literal],
  ["Processing", Processing.literal],
  ["EarlyHints", EarlyHints.literal],
]).pipe(
  $I.annoteSchema("HttpStatus1XX", {
    description:
      "1XX codes are informational responses from the website’s server. They do not\ngenerate content and only update clients on the progress of their requests.\nThis information is sent in the headers of the HTTP response.",
  })
);

/**
 * A namespace for {@link HttpStatus1XX} to contain the Encoded type
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpStatus1XX } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus1XX.Encoded = "Continue"
 * const status = S.decodeUnknownSync(HttpStatus1XX)(encoded)
 * console.log(status) // 100
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export declare namespace HttpStatus1XX {
  /**
   * The encoded type of {@link HttpStatus1XX}
   *
   * @category validation
   * @since 0.0.0
   */
  export type Encoded = typeof HttpStatus1XX.Encoded;
}

/**
 * {@inheritDoc HttpStatus1XX}
 *
 * @example
 * ```ts
 * import type { HttpStatus1XX } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatus1XX = 100
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HttpStatus1XX = typeof HttpStatus1XX.Type;
