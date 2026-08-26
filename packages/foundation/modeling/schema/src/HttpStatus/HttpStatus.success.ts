/**
 * Success HTTP status schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import { $I } from "./HttpStatus.shared.ts";

// =============================================================================
// 2XX Status Codes - Success
// =============================================================================

/**
 * 200 “OK” – The response for a successful HTTP request. The result will depend on the type of request.
 *
 * **Example** (Log Ok literal value)
 *
 * ```ts import.meta.vitest name="Log Ok literal value"
 * import { Ok } from "@beep/schema/HttpStatus"
 *
 * console.log(Ok.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Ok = S.Literal(200).pipe(
  $I.annoteSchema("Ok", {
    description:
      "200 “OK” – The response for a successful HTTP request. The result will depend on the type of request.",
    emoji: "✅",
  })
);

/**
 * {@inheritDoc Ok}
 * @category validation
 * @since 0.0.0
 */
export type Ok = typeof Ok.Type;

/**
 * 201 “Created” – The request was fulfilled, and the server created a new resource.
 *
 * **Example** (Log Created literal value)
 *
 * ```ts import.meta.vitest name="Log Created literal value"
 * import { Created } from "@beep/schema/HttpStatus"
 *
 * console.log(Created.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Created = S.Literal(201).pipe(
  $I.annoteSchema("Created", {
    description: "201 “Created” – The request was fulfilled, and the server created a new resource.",
    emoji: "📝",
  })
);

/**
 * {@inheritDoc Created}
 * @category validation
 * @since 0.0.0
 */
export type Created = typeof Created.Type;

/**
 * 202 “Accepted” – The server accepted the request but has not yet finished
 * processing it. The request might be fulfilled or rejected, but the outcome
 * is still undetermined.
 *
 * **Example** (Log Accepted literal value)
 *
 * ```ts import.meta.vitest name="Log Accepted literal value"
 * import { Accepted } from "@beep/schema/HttpStatus"
 *
 * console.log(Accepted.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Accepted = S.Literal(202).pipe(
  $I.annoteSchema("Accepted", {
    description:
      "202 “Accepted” – The server accepted the request but has not yet finished\nprocessing it. The request might be fulfilled or rejected, but the outcome\nis still undetermined.",
    emoji: "🔄",
  })
);

/**
 * {@inheritDoc Accepted}
 * @category validation
 * @since 0.0.0
 */
export type Accepted = typeof Accepted.Type;

/**
 * 203 “Non-Authoritative Information” – A code that usually appears when a
 * proxy service is used. The proxy server received a 200 “OK” status code
 * from the origin server and returns a modified version of the origin’s
 * response.
 *
 * **Example** (Log NonAuthoritativeInformation literal)
 *
 * ```ts import.meta.vitest name="Log NonAuthoritativeInformation literal"
 * import { NonAuthoritativeInformation } from "@beep/schema/HttpStatus"
 *
 * console.log(NonAuthoritativeInformation.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonAuthoritativeInformation = S.Literal(203).pipe(
  $I.annoteSchema("NonAuthoritativeInformation", {
    description:
      "203 “Non-Authoritative Information” – A code that usually appears when a\nproxy service is used. The proxy server received a 200 “OK” status code\nfrom the origin server and returns a modified version of the origin’s\nresponse.",
    emoji: "📋",
  })
);

/**
 * {@inheritDoc NonAuthoritativeInformation}
 * @category validation
 * @since 0.0.0
 */
export type NonAuthoritativeInformation = typeof NonAuthoritativeInformation.Type;

/**
 * 204 “No Content” – The server fulfilled the request but won’t return any
 * content.
 *
 * **Example** (Log NoContent literal value)
 *
 * ```ts import.meta.vitest name="Log NoContent literal value"
 * import { NoContent } from "@beep/schema/HttpStatus"
 *
 * console.log(NoContent.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NoContent = S.Literal(204).pipe(
  $I.annoteSchema("NoContent", {
    description: "204 “No Content” – The server fulfilled the request but won’t return any content.",
    emoji: "💭",
  })
);

/**
 * {@inheritDoc NoContent}
 * @category validation
 * @since 0.0.0
 */
export type NoContent = typeof NoContent.Type;

/**
 * 205 “Reset Content” – The server fulfilled the request, and it won’t return
 * any content but asks the client (browser) to reset the document view.
 *
 * **Example** (Log ResetContent literal value)
 *
 * ```ts import.meta.vitest name="Log ResetContent literal value"
 * import { ResetContent } from "@beep/schema/HttpStatus"
 *
 * console.log(ResetContent.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ResetContent = S.Literal(205).pipe(
  $I.annoteSchema("ResetContent", {
    description:
      "205 “Reset Content” – The server fulfilled the request, and it won’t return\nany content but asks the client (browser) to reset the document view.",
    emoji: "♻️",
  })
);

/**
 * {@inheritDoc ResetContent}
 * @category validation
 * @since 0.0.0
 */
export type ResetContent = typeof ResetContent.Type;

/**
 * 206 “Partial Content” – The server returns only a portion of the requested
 * resources because your browser uses “range headers”. These headers allow
 * browsers to resume downloads or split downloads into multiple simultaneous
 * streams.
 *
 * **Example** (Log PartialContent literal value)
 *
 * ```ts import.meta.vitest name="Log PartialContent literal value"
 * import { PartialContent } from "@beep/schema/HttpStatus"
 *
 * console.log(PartialContent.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PartialContent = S.Literal(206).pipe(
  $I.annoteSchema("PartialContent", {
    description:
      "206 “Partial Content” – The server returns only a portion of the requested\nresources because your browser uses “range headers”. These headers allow\nbrowsers to resume downloads or split downloads into multiple simultaneous\nstreams.",
    emoji: "✂️",
  })
);

/**
 * {@inheritDoc PartialContent}
 * @category validation
 * @since 0.0.0
 */
export type PartialContent = typeof PartialContent.Type;

/**
 * 207 “Multi-Status” – A code associated with WebDav when a compound request
 * is made. The server returns a message containing an array of response codes
 * for all sub-requests.
 *
 * **Example** (Log MultiStatus literal value)
 *
 * ```ts import.meta.vitest name="Log MultiStatus literal value"
 * import { MultiStatus } from "@beep/schema/HttpStatus"
 *
 * console.log(MultiStatus.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const MultiStatus = S.Literal(207).pipe(
  $I.annoteSchema("MultiStatus", {
    description:
      "207 “Multi-Status” – A code associated with WebDav when a compound request\nis made. The server returns a message containing an array of response codes\nfor all sub-requests.",
    emoji: "🗂️",
  })
);

/**
 * {@inheritDoc MultiStatus}
 * @category validation
 * @since 0.0.0
 */
export type MultiStatus = typeof MultiStatus.Type;

/**
 * 208 “Already Reported” (WebDav) – This code indicates that the internal
 * members of a DAV binding were already enumerated in a previous part of the
 * response and will not be enumerated again.
 *
 * **Example** (Log AlreadyReported literal value)
 *
 * ```ts import.meta.vitest name="Log AlreadyReported literal value"
 * import { AlreadyReported } from "@beep/schema/HttpStatus"
 *
 * console.log(AlreadyReported.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const AlreadyReported = S.Literal(208).pipe(
  $I.annoteSchema("AlreadyReported", {
    description:
      "208 “Already Reported” (WebDav) – This code indicates that the internal\nmembers of a DAV binding were already enumerated in a previous part of the\nresponse and will not be enumerated again.",
    emoji: "☑️",
  })
);

/**
 * {@inheritDoc AlreadyReported}
 * @category validation
 * @since 0.0.0
 */
export type AlreadyReported = typeof AlreadyReported.Type;

/**
 * 226 “IM Used” – The server fulfilled the request, and the response is a
 * representation of the result of one or more instance manipulations applied
 * to the current instance.
 *
 * **Example** (Log ImUsed literal value)
 *
 * ```ts import.meta.vitest name="Log ImUsed literal value"
 * import { ImUsed } from "@beep/schema/HttpStatus"
 *
 * console.log(ImUsed.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ImUsed = S.Literal(226).pipe(
  $I.annoteSchema("ImUsed", {
    description:
      "226 “IM Used” – The server fulfilled the request, and the response is a\nrepresentation of the result of one or more instance manipulations applied\nto the current instance.",
    emoji: "🪄",
  })
);

/**
 * {@inheritDoc ImUsed}
 * @category validation
 * @since 0.0.0
 */
export type ImUsed = typeof ImUsed.Type;

/**
 * The 2XX codes are the best responses you can receive. They indicate that the
 * request was recognized by the server, was accepted, and is being processed.
 *
 * **Example** (Count HttpStatus2XX pairs)
 *
 * ```ts import.meta.vitest name="Count HttpStatus2XX pairs"
 * import { HttpStatus2XX } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatus2XX.Pairs.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpStatus2XX = MappedLiteralKit([
  ["Ok", Ok.literal],
  ["Created", Created.literal],
  ["Accepted", Accepted.literal],
  ["NonAuthoritativeInformation", NonAuthoritativeInformation.literal],
  ["NoContent", NoContent.literal],
  ["ResetContent", ResetContent.literal],
  ["PartialContent", PartialContent.literal],
  ["MultiStatus", MultiStatus.literal],
  ["AlreadyReported", AlreadyReported.literal],
  ["ImUsed", ImUsed.literal],
]).pipe(
  $I.annoteSchema("HttpStatus2XX", {
    description:
      "The 2XX codes are the best responses you can receive. They indicate that the\nrequest was recognized by the server, was accepted, and is being processed.",
  })
);

/**
 * A namespace for {@link HttpStatus2XX} to contain the Encoded type
 *
 * **Example** (Decode encoded Ok status)
 *
 * ```ts import.meta.vitest name="Decode encoded Ok status"
 * import * as S from "effect/Schema"
 * import { HttpStatus2XX } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus2XX.Encoded = "Ok"
 * const status = S.decodeUnknownSync(HttpStatus2XX)(encoded)
 * status // => 200
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export declare namespace HttpStatus2XX {
  /**
   * The encoded type of {@link HttpStatus2XX}
   *
   * @category validation
   * @since 0.0.0
   */
  export type Encoded = typeof HttpStatus2XX.Encoded;
}

/**
 * {@inheritDoc HttpStatus2XX}
 * @category validation
 * @since 0.0.0
 */
export type HttpStatus2XX = typeof HttpStatus2XX.Type;
