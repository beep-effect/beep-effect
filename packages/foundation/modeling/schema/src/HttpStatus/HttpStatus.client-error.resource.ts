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
 * **Example** (Log Gone literal)
 *
 * ```ts import.meta.vitest name="Log Gone literal"
 * import { Gone } from "@beep/schema/HttpStatus"
 *
 * console.log(Gone.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type Gone = typeof Gone.Type;

/**
 * 411 “Length Required” – The length of the request’s content is not specified
 * and the resource on the server requires it.
 *
 * **Example** (Log LengthRequired literal)
 *
 * ```ts import.meta.vitest name="Log LengthRequired literal"
 * import { LengthRequired } from "@beep/schema/HttpStatus"
 *
 * console.log(LengthRequired.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type LengthRequired = typeof LengthRequired.Type;

/**
 * 412 “Precondition failed” – The headers of the request specify certain
 * preconditions that the server fails to meet.
 *
 * **Example** (Log PreconditionFailed literal)
 *
 * ```ts import.meta.vitest name="Log PreconditionFailed literal"
 * import { PreconditionFailed } from "@beep/schema/HttpStatus"
 *
 * console.log(PreconditionFailed.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
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
 * **Example** (Log PayloadTooLarge literal)
 *
 * ```ts import.meta.vitest name="Log PayloadTooLarge literal"
 * import { PayloadTooLarge } from "@beep/schema/HttpStatus"
 *
 * console.log(PayloadTooLarge.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type PayloadTooLarge = typeof PayloadTooLarge.Type;

/**
 * 414 “URI Too Long” – The length of the URI is too long and the server can’t
 * process it. Usually, this is the result of a GET request containing too much
 * data and therefore must be changed to a POST request.
 *
 * **Example** (Log UriTooLong literal)
 *
 * ```ts import.meta.vitest name="Log UriTooLong literal"
 * import { UriTooLong } from "@beep/schema/HttpStatus"
 *
 * console.log(UriTooLong.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type UriTooLong = typeof UriTooLong.Type;

/**
 * 415 “Unsupported Media Type” – The request contains a media type that the
 * server doesn’t support. For instance, you try to upload an image file in
 * .jpg format, but the server doesn’t support it.
 *
 * **Example** (Log UnsupportedMediaType literal)
 *
 * ```ts import.meta.vitest name="Log UnsupportedMediaType literal"
 * import { UnsupportedMediaType } from "@beep/schema/HttpStatus"
 *
 * console.log(UnsupportedMediaType.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type UnsupportedMediaType = typeof UnsupportedMediaType.Type;

/**
 * 416 “Range Not Satisfiable” – The request asked for a portion of the
 * resource that the server can’t provide. This error can occur when your
 * browser asks for a portion of a file that is outside of the end of the file.
 *
 * **Example** (Log RangeNotSatisfiable literal)
 *
 * ```ts import.meta.vitest name="Log RangeNotSatisfiable literal"
 * import { RangeNotSatisfiable } from "@beep/schema/HttpStatus"
 *
 * console.log(RangeNotSatisfiable.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type RangeNotSatisfiable = typeof RangeNotSatisfiable.Type;

/**
 * 417 “Expectation Failed” – The server fails to meet the requirements set in
 * the request’s expected header field.
 *
 * **Example** (Log ExpectationFailed literal)
 *
 * ```ts import.meta.vitest name="Log ExpectationFailed literal"
 * import { ExpectationFailed } from "@beep/schema/HttpStatus"
 *
 * console.log(ExpectationFailed.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type ExpectationFailed = typeof ExpectationFailed.Type;

/**
 * 418 “I’m a teapot.” – This error is returned by teapots requested to brew
 * coffee. It is an April’s Fool joke dating back to 1998.
 *
 * **Example** (Log ImATeapot literal)
 *
 * ```ts import.meta.vitest name="Log ImATeapot literal"
 * import { ImATeapot } from "@beep/schema/HttpStatus"
 *
 * console.log(ImATeapot.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * @category validation
 * @since 0.0.0
 */
export type ImATeapot = typeof ImATeapot.Type;
