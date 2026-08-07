/**
 * Redirection HTTP status schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { MappedLiteralKit } from "../MappedLiteralKit/index.ts";
import { $I } from "./HttpStatus.shared.ts";

// =============================================================================
// 3XX Status Codes - Redirection
// =============================================================================

/**
 * 300 “Multiple Choices” – The server presents the client with a choice of
 * multiple resources to choose from. The status code is applied when you use
 * your browser to download files and you are given a choice of file extension,
 * or when you are presented with options for word-sense disambiguation.
 *
 * **Example** (Log MultipleChoices literal)
 *
 * ```ts
 * import { MultipleChoices } from "@beep/schema/HttpStatus"
 *
 * console.log(MultipleChoices.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const MultipleChoices = S.Literal(300).pipe(
  $I.annoteSchema("MultipleChoices", {
    description:
      "300 “Multiple Choices” – The server presents the client with a choice " +
      "of\nmultiple resources to choose from. The status code is applied when " +
      "you use\nyour browser to download files and you are given a choice of " +
      "file extension,\nor when you are presented with options for word-sense " +
      "disambiguation.",
    emoji: "🔀",
  })
);

/**
 * {@inheritDoc MultipleChoices}
 *
 * **Example** (Assign MultipleChoices type)
 *
 * ```ts
 * import type { MultipleChoices } from "@beep/schema/HttpStatus"
 *
 * const status: MultipleChoices = 300
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type MultipleChoices = typeof MultipleChoices.Type;

/**
 * 301 “Moved Permanently” – This is the code for a permanent redirect. It means that the URL of the requested resource is permanently replaced with a new address, and search engines should update the URL in their databases.
 * You learn more about it from our article on 301 redirects.
 *
 * **Example** (Log MovedPermanently literal)
 *
 * ```ts
 * import { MovedPermanently } from "@beep/schema/HttpStatus"
 *
 * console.log(MovedPermanently.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const MovedPermanently = S.Literal(301).pipe(
  $I.annoteSchema("MovedPermanently", {
    description:
      "301 “Moved Permanently” – This is the code for a permanent redirect. It means that the URL of the requested resource is permanently replaced with a new address, and search engines should update the URL in their databases.\nYou learn more about it from our article on 301 redirects.",
    emoji: "🚚",
  })
);

/**
 * {@inheritDoc MovedPermanently}
 *
 * **Example** (Assign MovedPermanently type)
 *
 * ```ts
 * import type { MovedPermanently } from "@beep/schema/HttpStatus"
 *
 * const status: MovedPermanently = 301
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type MovedPermanently = typeof MovedPermanently.Type;

/**
 * 302 “Found” – Previously, this code was known as “Moved temporarily”. It
 * instructs browsers that the requested resource is moved temporarily to a new
 * URL, but the new address may be changed again in the future. Thus, the
 * original URL should still be used by the client. The code is used for
 * temporary redirects.
 *
 * **Example** (Log Found literal)
 *
 * ```ts
 * import { Found } from "@beep/schema/HttpStatus"
 *
 * console.log(Found.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Found = S.Literal(302).pipe(
  $I.annoteSchema("Found", {
    description:
      "302 “Found” – Previously, this code was known as “Moved temporarily”. It\ninstructs browsers that the requested resource is moved temporarily to a new\nURL, but the new address may be changed again in the future. Thus, the\noriginal URL should still be used by the client. The code is used for\ntemporary redirects.",
    emoji: "🔎",
  })
);

/**
 * {@inheritDoc Found}
 *
 * **Example** (Assign Found type)
 *
 * ```ts
 * import type { Found } from "@beep/schema/HttpStatus"
 *
 * const status: Found = 302
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type Found = typeof Found.Type;

/**
 * 303 “See Other” – The server instructs the client that it found the
 * resource, but it has to be retrieved on another URL with a GET request.
 *
 * **Example** (Log SeeOther literal)
 *
 * ```ts
 * import { SeeOther } from "@beep/schema/HttpStatus"
 *
 * console.log(SeeOther.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SeeOther = S.Literal(303).pipe(
  $I.annoteSchema("SeeOther", {
    description:
      "303 “See Other” – The server instructs the client that it found the\nresource, but it has to be retrieved on another URL with a GET request.",
    emoji: "📨",
  })
);

/**
 * {@inheritDoc SeeOther}
 *
 * **Example** (Assign SeeOther type)
 *
 * ```ts
 * import type { SeeOther } from "@beep/schema/HttpStatus"
 *
 * const status: SeeOther = 303
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SeeOther = typeof SeeOther.Type;

/**
 * 304 “Not Modified” – The server informs your browser that the resource
 * hasn’t been altered since the last time you requested it. Your browser can
 * keep using the cached version it already stores locally. Clearing the
 * browser cache usually solves this error.
 *
 * **Example** (Log NotModified literal)
 *
 * ```ts
 * import { NotModified } from "@beep/schema/HttpStatus"
 *
 * console.log(NotModified.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NotModified = S.Literal(304).pipe(
  $I.annoteSchema("NotModified", {
    description:
      "304 “Not Modified” – The server informs your browser that the resource\nhasn’t been altered since the last time you requested it. Your browser can\nkeep using the cached version it already stores locally. Clearing the\nbrowser cache usually solves this error.",
    emoji: "💠",
  })
);

/**
 * {@inheritDoc NotModified}
 *
 * **Example** (Assign NotModified type)
 *
 * ```ts
 * import type { NotModified } from "@beep/schema/HttpStatus"
 *
 * const status: NotModified = 304
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type NotModified = typeof NotModified.Type;

/**
 * 305 “Use Proxy” – The requested resource is available only through a proxy.
 * This code is now deprecated and browsers disregard it.
 *
 * **Example** (Log UseProxy literal)
 *
 * ```ts
 * import { UseProxy } from "@beep/schema/HttpStatus"
 *
 * console.log(UseProxy.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const UseProxy = S.Literal(305).pipe(
  $I.annoteSchema("UseProxy", {
    description:
      "305 “Use Proxy” – The requested resource is available only through a proxy.\nThis code is now deprecated and browsers disregard it.",
    emoji: "🔁",
  })
);

/**
 * {@inheritDoc UseProxy}
 *
 * **Example** (Assign UseProxy type)
 *
 * ```ts
 * import type { UseProxy } from "@beep/schema/HttpStatus"
 *
 * const status: UseProxy = 305
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type UseProxy = typeof UseProxy.Type;

/**
 * 306 “Switch Proxy” – This code is no longer in use. It means that the
 * following requests should use the specified proxy.
 *
 * **Example** (Log SwitchProxy literal)
 *
 * ```ts
 * import { SwitchProxy } from "@beep/schema/HttpStatus"
 *
 * console.log(SwitchProxy.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SwitchProxy = S.Literal(306).pipe(
  $I.annoteSchema("SwitchProxy", {
    description:
      "306 “Switch Proxy” – This code is no longer in use. It means that the\nfollowing requests should use the specified proxy.",
    emoji: "🔃",
  })
);

/**
 * {@inheritDoc SwitchProxy}
 *
 * **Example** (Assign SwitchProxy type)
 *
 * ```ts
 * import type { SwitchProxy } from "@beep/schema/HttpStatus"
 *
 * const status: SwitchProxy = 306
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SwitchProxy = typeof SwitchProxy.Type;

/**
 * 307 “Temporary redirect” – This is the new code for temporary redirects that
 * replaced the HTTP 302 code. It specifies that the requested resource has
 * moved to another URL. Unlike the HTTP 302 code, the HTTP 307 code doesn’t
 * allow the HTTP method to be changed. For example, if the first request was
 * GET, the second request should be GET as well.
 *
 * **Example** (Log TemporaryRedirect literal)
 *
 * ```ts
 * import { TemporaryRedirect } from "@beep/schema/HttpStatus"
 *
 * console.log(TemporaryRedirect.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TemporaryRedirect = S.Literal(307).pipe(
  $I.annoteSchema("TemporaryRedirect", {
    description:
      "307 “Temporary redirect” – This is the new code for temporary redirects that\nreplaced the HTTP 302 code. It specifies that the requested resource has\nmoved to another URL. Unlike the HTTP 302 code, the HTTP 307 code doesn’t\nallow the HTTP method to be changed. For example, if the first request was\nGET, the second request should be GET as well.",
    emoji: "ℹ️",
  })
);

/**
 * {@inheritDoc TemporaryRedirect}
 *
 * **Example** (Assign TemporaryRedirect type)
 *
 * ```ts
 * import type { TemporaryRedirect } from "@beep/schema/HttpStatus"
 *
 * const status: TemporaryRedirect = 307
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type TemporaryRedirect = typeof TemporaryRedirect.Type;

/**
 * 308 “Permanent Redirect” – The requested resource is permanently moved to
 * another URL and all future requests must be redirected to the new address.
 * The code is similar to the HTTP 302 code, the only difference being that it
 * doesn’t allow browsers to change the type of HTTP request.
 *
 * **Example** (Log PermanentRedirect literal)
 *
 * ```ts
 * import { PermanentRedirect } from "@beep/schema/HttpStatus"
 *
 * console.log(PermanentRedirect.literal)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PermanentRedirect = S.Literal(308).pipe(
  $I.annoteSchema("PermanentRedirect", {
    description:
      "308 “Permanent Redirect” – The requested resource is permanently moved to\nanother URL and all future requests must be redirected to the new address.\nThe code is similar to the HTTP 302 code, the only difference being that it\ndoesn’t allow browsers to change the type of HTTP request.",
    emoji: "🆕",
  })
);

/**
 * {@inheritDoc PermanentRedirect}
 *
 * **Example** (Assign PermanentRedirect type)
 *
 * ```ts
 * import type { PermanentRedirect } from "@beep/schema/HttpStatus"
 *
 * const status: PermanentRedirect = 308
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type PermanentRedirect = typeof PermanentRedirect.Type;

/**
 * 3XX codes specify that there will be a redirection. {@link https://www.siteground.com/kb/domain-redirects/ | Redirects} are
 * commonly
 * used when a resource is moved to a new address. The different 3XX codes instruct
 * browsers on how the redirect must be performed.
 *
 * **Example** (Count 3XX status pairs)
 *
 * ```ts
 * import { HttpStatus3XX } from "@beep/schema/HttpStatus"
 *
 * console.log(HttpStatus3XX.Pairs.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpStatus3XX = MappedLiteralKit([
  ["MultipleChoices", MultipleChoices.literal],
  ["MovedPermanently", MovedPermanently.literal],
  ["Found", Found.literal],
  ["SeeOther", SeeOther.literal],
  ["NotModified", NotModified.literal],
  ["UseProxy", UseProxy.literal],
  ["SwitchProxy", SwitchProxy.literal],
  ["TemporaryRedirect", TemporaryRedirect.literal],
  ["PermanentRedirect", PermanentRedirect.literal],
]).pipe(
  $I.annoteSchema("HttpStatus3XX", {
    description:
      "3XX codes specify that there will be a redirection. {@link https://www.siteground.com/kb/domain-redirects/ | Redirects} are\ncommonly\nused when a resource is moved to a new address. The different 3XX codes instruct\nbrowsers on how the redirect must be performed.",
  })
);

/**
 * {@inheritDoc HttpStatus3XX}
 *
 * **Example** (Assign HttpStatus3XX type)
 *
 * ```ts
 * import type { HttpStatus3XX } from "@beep/schema/HttpStatus"
 *
 * const status: HttpStatus3XX = 300
 * console.log(status)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HttpStatus3XX = typeof HttpStatus3XX.Type;

/**
 * A namespace for {@link HttpStatus3XX} to contain the Encoded type
 *
 * **Example** (Decode encoded 3XX name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpStatus3XX } from "@beep/schema/HttpStatus"
 *
 * const encoded: HttpStatus3XX.Encoded = "MultipleChoices"
 * const status = S.decodeUnknownSync(HttpStatus3XX)(encoded)
 * console.log(status) // 300
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export declare namespace HttpStatus3XX {
  /**
   * The encoded type of {@link HttpStatus3XX}
   *
   * @category validation
   * @since 0.0.0
   */
  export type Encoded = typeof HttpStatus3XX.Encoded;
}
