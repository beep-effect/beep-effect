/**
 * Resource client-error HTTP status schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { $I } from "./HttpStatus.shared.ts";

/**
 * 410 “Gone” – The requested resource is not available and will not be
 * available in the future. It is not replaced with a new resource on a new
 * address so clients are expected to remove any links and cache related to the
 * resource. For example, search engines should remove the resource’s
 * information from their databases.
 *
 * @example
 * ```ts
 * import { Gone } from "@beep/schema/HttpStatus"
 *
 * console.log(Gone.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Gone = S.Literal(410).pipe(
  $I.annoteSchema("Gone", {
    description:
      "410 “Gone” – The requested resource is not available and will not be\navailable in the future. It is not replaced with a new resource on a new\naddress so clients are expected to remove any links and cache related to the\nresource. For example, search engines should remove the resource’s\ninformation from their databases.",
    emoji: "💨",
  })
);

/**
 * {@inheritDoc Gone}
 *
 * @example
 * ```ts
 * import type { Gone } from "@beep/schema/HttpStatus"
 *
 * const status: Gone = 410
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type Gone = typeof Gone.Type;

/**
 * 411 “Length Required” – The length of the request’s content is not specified
 * and the resource on the server requires it.
 *
 * @example
 * ```ts
 * import { LengthRequired } from "@beep/schema/HttpStatus"
 *
 * console.log(LengthRequired.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const LengthRequired = S.Literal(411).pipe(
  $I.annoteSchema("LengthRequired", {
    description:
      "411 “Length Required” – The length of the request’s content is not specified\nand the resource on the server requires it.",
    emoji: "📏",
  })
);

/**
 * {@inheritDoc LengthRequired}
 *
 * @example
 * ```ts
 * import type { LengthRequired } from "@beep/schema/HttpStatus"
 *
 * const status: LengthRequired = 411
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type LengthRequired = typeof LengthRequired.Type;

/**
 * 412 “Precondition failed” – The headers of the request specify certain
 * preconditions that the server fails to meet.
 *
 * @example
 * ```ts
 * import { PreconditionFailed } from "@beep/schema/HttpStatus"
 *
 * console.log(PreconditionFailed.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const PreconditionFailed = S.Literal(412).pipe(
  $I.annoteSchema("PreconditionFailed", {
    description:
      "412 “Precondition failed” – The headers of the request specify certain\npreconditions that the server fails to meet.",
    emoji: "🛑",
  })
);

/**
 * {@inheritDoc PreconditionFailed}
 *
 * @example
 * ```ts
 * import type { PreconditionFailed } from "@beep/schema/HttpStatus"
 *
 * const status: PreconditionFailed = 412
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type PreconditionFailed = typeof PreconditionFailed.Type;

/**
 * 413 “Payload too large” – The request is larger than the limits specified on
 * the server, thus the server can not process the request.
 * You may see this error on your WordPress site when you try to upload a file
 * and its size exceeds the upload limit of your website. If you encounter this
 * problem, read this guide about the “413 Entity Too Large” Error in
 * WordPress.
 *
 * @example
 * ```ts
 * import { PayloadTooLarge } from "@beep/schema/HttpStatus"
 *
 * console.log(PayloadTooLarge.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const PayloadTooLarge = S.Literal(413).pipe(
  $I.annoteSchema("PayloadTooLarge", {
    description:
      "413 “Payload too large” – The request is larger than the limits specified on\nthe server, thus the server can not process the request.\nYou may see this error on your WordPress site when you try to upload a file\nand its size exceeds the upload limit of your website. If you encounter this\nproblem, read this guide about the “413 Entity Too Large” Error in\nWordPress.",
    emoji: "🗃",
  })
);

/**
 * {@inheritDoc PayloadTooLarge}
 *
 * @example
 * ```ts
 * import type { PayloadTooLarge } from "@beep/schema/HttpStatus"
 *
 * const status: PayloadTooLarge = 413
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type PayloadTooLarge = typeof PayloadTooLarge.Type;

/**
 * 414 “URI Too Long” – The length of the URI is too long and the server can’t
 * process it. Usually, this is the result of a GET request containing too much
 * data and therefore must be changed to a POST request.
 *
 * @example
 * ```ts
 * import { UriTooLong } from "@beep/schema/HttpStatus"
 *
 * console.log(UriTooLong.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const UriTooLong = S.Literal(414).pipe(
  $I.annoteSchema("UriTooLong", {
    description:
      "414 “URI Too Long” – The length of the URI is too long and the server can’t\nprocess it. Usually, this is the result of a GET request containing too much\ndata and therefore must be changed to a POST request.",
    emoji: "🆖",
  })
);

/**
 * {@inheritDoc UriTooLong}
 *
 * @example
 * ```ts
 * import type { UriTooLong } from "@beep/schema/HttpStatus"
 *
 * const status: UriTooLong = 414
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type UriTooLong = typeof UriTooLong.Type;

/**
 * 415 “Unsupported Media Type” – The request contains a media type that the
 * server doesn’t support. For instance, you try to upload an image file in
 * .jpg format, but the server doesn’t support it.
 *
 * @example
 * ```ts
 * import { UnsupportedMediaType } from "@beep/schema/HttpStatus"
 *
 * console.log(UnsupportedMediaType.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const UnsupportedMediaType = S.Literal(415).pipe(
  $I.annoteSchema("UnsupportedMediaType", {
    description:
      "415 “Unsupported Media Type” – The request contains a media type that the\nserver doesn’t support. For instance, you try to upload an image file in\n.jpg format, but the server doesn’t support it.",
    emoji: "📼",
  })
);

/**
 * {@inheritDoc UnsupportedMediaType}
 *
 * @example
 * ```ts
 * import type { UnsupportedMediaType } from "@beep/schema/HttpStatus"
 *
 * const status: UnsupportedMediaType = 415
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type UnsupportedMediaType = typeof UnsupportedMediaType.Type;

/**
 * 416 “Range Not Satisfiable” – The request asked for a portion of the
 * resource that the server can’t provide. This error can occur when your
 * browser asks for a portion of a file that is outside of the end of the file.
 *
 * @example
 * ```ts
 * import { RangeNotSatisfiable } from "@beep/schema/HttpStatus"
 *
 * console.log(RangeNotSatisfiable.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const RangeNotSatisfiable = S.Literal(416).pipe(
  $I.annoteSchema("RangeNotSatisfiable", {
    description:
      "416 “Range Not Satisfiable” – The request asked for a portion of the\nresource that the server can’t provide. This error can occur when your\nbrowser asks for a portion of a file that is outside of the end of the file.",
    emoji: "📐",
  })
);

/**
 * {@inheritDoc RangeNotSatisfiable}
 *
 * @example
 * ```ts
 * import type { RangeNotSatisfiable } from "@beep/schema/HttpStatus"
 *
 * const status: RangeNotSatisfiable = 416
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type RangeNotSatisfiable = typeof RangeNotSatisfiable.Type;

/**
 * 417 “Expectation Failed” – The server fails to meet the requirements set in
 * the request’s expected header field.
 *
 * @example
 * ```ts
 * import { ExpectationFailed } from "@beep/schema/HttpStatus"
 *
 * console.log(ExpectationFailed.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ExpectationFailed = S.Literal(417).pipe(
  $I.annoteSchema("ExpectationFailed", {
    description:
      "417 “Expectation Failed” – The server fails to meet the requirements set in\nthe request’s expected header field.",
    emoji: "🤔",
  })
);

/**
 * {@inheritDoc ExpectationFailed}
 *
 * @example
 * ```ts
 * import type { ExpectationFailed } from "@beep/schema/HttpStatus"
 *
 * const status: ExpectationFailed = 417
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type ExpectationFailed = typeof ExpectationFailed.Type;

/**
 * 418 “I’m a teapot.” – This error is returned by teapots requested to brew
 * coffee. It is an April’s Fool joke dating back to 1998.
 *
 * @example
 * ```ts
 * import { ImATeapot } from "@beep/schema/HttpStatus"
 *
 * console.log(ImATeapot.literal)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ImATeapot = S.Literal(418).pipe(
  $I.annoteSchema("ImATeapot", {
    description:
      "418 “I’m a teapot.” – This error is returned by teapots requested to brew\ncoffee. It is an April’s Fool joke dating back to 1998.",
    emoji: "🍵",
  })
);

/**
 * {@inheritDoc ImATeapot}
 *
 * @example
 * ```ts
 * import type { ImATeapot } from "@beep/schema/HttpStatus"
 *
 * const status: ImATeapot = 418
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export type ImATeapot = typeof ImATeapot.Type;
