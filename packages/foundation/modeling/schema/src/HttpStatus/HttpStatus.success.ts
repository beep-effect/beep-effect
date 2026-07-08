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
 * @example
 * ```ts
 * import { Ok } from "@beep/schema/HttpStatus"
 *
 * console.log(Ok.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { Ok } from "@beep/schema/HttpStatus"
 *
 * const status: Ok = 200
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type Ok = typeof Ok.Type;

/**
 * 201 “Created” – The request was fulfilled, and the server created a new resource.
 *
 * @example
 * ```ts
 * import { Created } from "@beep/schema/HttpStatus"
 *
 * console.log(Created.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Created = S.Literal(201).pipe(
  $I.annoteSchema("Created", {
    description: "201 “Created” – The request was fulfilled, and the server created a new resource.",
    emoji: "📝",
  })
);

/**
 * {@inheritDoc Created}
 *
 * @example
 * ```ts
 * import type { Created } from "@beep/schema/HttpStatus"
 *
 * const status: Created = 201
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type Created = typeof Created.Type;

/**
 * 202 “Accepted” – The server accepted the request but has not yet finished
 * processing it. The request might be fulfilled or rejected, but the outcome
 * is still undetermined.
 *
 * @example
 * ```ts
 * import { Accepted } from "@beep/schema/HttpStatus"
 *
 * console.log(Accepted.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { Accepted } from "@beep/schema/HttpStatus"
 *
 * const status: Accepted = 202
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type Accepted = typeof Accepted.Type;

/**
 * 203 “Non-Authoritative Information” – A code that usually appears when a
 * proxy service is used. The proxy server received a 200 “OK” status code
 * from the origin server and returns a modified version of the origin’s
 * response.
 *
 * @example
 * ```ts
 * import { NonAuthoritativeInformation } from "@beep/schema/HttpStatus"
 *
 * console.log(NonAuthoritativeInformation.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { NonAuthoritativeInformation } from "@beep/schema/HttpStatus"
 *
 * const status: NonAuthoritativeInformation = 203
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type NonAuthoritativeInformation = typeof NonAuthoritativeInformation.Type;

/**
 * 204 “No Content” – The server fulfilled the request but won’t return any
 * content.
 *
 * @example
 * ```ts
 * import { NoContent } from "@beep/schema/HttpStatus"
 *
 * console.log(NoContent.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const NoContent = S.Literal(204).pipe(
  $I.annoteSchema("NoContent", {
    description: "204 “No Content” – The server fulfilled the request but won’t return any content.",
    emoji: "💭",
  })
);

/**
 * {@inheritDoc NoContent}
 *
 * @example
 * ```ts
 * import type { NoContent } from "@beep/schema/HttpStatus"
 *
 * const status: NoContent = 204
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type NoContent = typeof NoContent.Type;

/**
 * 205 “Reset Content” – The server fulfilled the request, and it won’t return
 * any content but asks the client (browser) to reset the document view.
 *
 * @example
 * ```ts
 * import { ResetContent } from "@beep/schema/HttpStatus"
 *
 * console.log(ResetContent.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { ResetContent } from "@beep/schema/HttpStatus"
 *
 * const status: ResetContent = 205
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type ResetContent = typeof ResetContent.Type;

/**
 * 206 “Partial Content” – The server returns only a portion of the requested
 * resources because your browser uses “range headers”. These headers allow
 * browsers to resume downloads or split downloads into multiple simultaneous
 * streams.
 *
 * @example
 * ```ts
 * import { PartialContent } from "@beep/schema/HttpStatus"
 *
 * console.log(PartialContent.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { PartialContent } from "@beep/schema/HttpStatus"
 *
 * const status: PartialContent = 206
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type PartialContent = typeof PartialContent.Type;

/**
 * 207 “Multi-Status” – A code associated with WebDav when a compound request
 * is made. The server returns a message containing an array of response codes
 * for all sub-requests.
 *
 * @example
 * ```ts
 * import { MultiStatus } from "@beep/schema/HttpStatus"
 *
 * console.log(MultiStatus.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { MultiStatus } from "@beep/schema/HttpStatus"
 *
 * const status: MultiStatus = 207
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type MultiStatus = typeof MultiStatus.Type;

/**
 * 208 “Already Reported” (WebDav) – This code indicates that the internal
 * members of a DAV binding were already enumerated in a previous part of the
 * response and will not be enumerated again.
 *
 * @example
 * ```ts
 * import { AlreadyReported } from "@beep/schema/HttpStatus"
 *
 * console.log(AlreadyReported.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { AlreadyReported } from "@beep/schema/HttpStatus"
 *
 * const status: AlreadyReported = 208
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type AlreadyReported = typeof AlreadyReported.Type;

/**
 * 226 “IM Used” – The server fulfilled the request, and the response is a
 * representation of the result of one or more instance manipulations applied
 * to the current instance.
 *
 * @example
 * ```ts
 * import { ImUsed } from "@beep/schema/HttpStatus"
 *
 * console.log(ImUsed.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 *
 * @example
 * ```ts
 * import type { ImUsed } from "@beep/schema/HttpStatus"
 *
 * const status: ImUsed = 226
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type ImUsed = typeof ImUsed.Type;

/**
 * The 2XX codes are the best responses you can receive. They indicate that the
 * request was recognized by the server, was accepted, and is being processed.
 *
 * @example
 * ```ts
 * import { HttpStatus2XX } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatus2XX.Pairs.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpStatus2XX } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus2XX.Encoded = "Ok"
 * const status = S.decodeUnknownSync(HttpStatus2XX)(encoded)
 * console.log(status) // 200
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
 *
 * @example
 * ```ts
 * import type { HttpStatus2XX } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatus2XX = 200
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type HttpStatus2XX = typeof HttpStatus2XX.Type;
