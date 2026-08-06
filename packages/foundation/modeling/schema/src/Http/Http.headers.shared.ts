/**
 * HTTP header schema helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { cast } from "@beep/utils/Function";
import { Effect, identity, Option, Result, SchemaIssue, SchemaTransformation } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("Http/headers");

/**
 * Schema for a single string header value or repeated string values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfStrOrStr } from "../../src/Http/Http.headers.shared.ts"
 *
 * console.log(S.decodeUnknownSync(ArrayOfStrOrStr)(["a", "b"]).length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArrayOfStrOrStr = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("ArrayOfStrOrStr", {
    description: "A string or array of strings.",
  })
);

/**
 * Type for a single string header value or repeated string values.
 *
 * @example
 * ```ts
 * import type { ArrayOfStrOrStr } from "../../src/Http/Http.headers.shared.ts"
 *
 * const values: ArrayOfStrOrStr = ["a", "b"]
 * console.log(values.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayOfStrOrStr = typeof ArrayOfStrOrStr.Type;

/**
 * Schema for values accepted where a URL-like header value is expected.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { StringOrUrl } from "../../src/Http/Http.headers.shared.ts"
 *
 * console.log(S.decodeUnknownSync(StringOrUrl)("https://example.com"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StringOrUrl = S.Union([S.String, S.URL]).pipe(
  $I.annoteSchema("StringOrUrl", {
    description: "A string or URL.",
  })
);

/**
 * Type for values accepted where a URL-like header value is expected.
 *
 * @example
 * ```ts
 * import type { StringOrUrl } from "../../src/Http/Http.headers.shared.ts"
 *
 * const value: StringOrUrl = "https://example.com"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StringOrUrl = typeof StringOrUrl.Type;

/**
 * Schema for non-negative integer HTTP `max-age` values measured in seconds.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HeaderMaxAgeSeconds } from "../../src/Http/Http.headers.shared.ts"
 *
 * const seconds = S.decodeUnknownSync(HeaderMaxAgeSeconds)(86400)
 * console.log(seconds)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HeaderMaxAgeSeconds = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("HeaderMaxAgeSeconds", {
    description: "A non-negative integer HTTP max-age value measured in seconds.",
  })
);

/**
 * Type for non-negative integer HTTP `max-age` values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HeaderMaxAgeSeconds } from "../../src/Http/Http.headers.shared.ts"
 * import type { HeaderMaxAgeSeconds as HeaderMaxAgeSecondsType } from "../../src/Http/Http.headers.shared.ts"
 *
 * const seconds: HeaderMaxAgeSecondsType = S.decodeUnknownSync(HeaderMaxAgeSeconds)(86400)
 * console.log(seconds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HeaderMaxAgeSeconds = typeof HeaderMaxAgeSeconds.Type;

/**
 * Schema that normalizes a string or URL into an encoded absolute URL string.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EncodedStrictURIFromStrOrURL } from "../../src/Http/Http.headers.shared.ts"
 *
 * const uri = S.decodeUnknownSync(EncodedStrictURIFromStrOrURL)("https://example.com/docs")
 * console.log(uri)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EncodedStrictURIFromStrOrURL = StringOrUrl.pipe(
  S.decodeTo(
    S.String.pipe(S.brand("EncodedStrictURIFromStrOrURL")),
    SchemaTransformation.transformOrFail({
      decode: (input) =>
        Effect.try({
          try: () => new URL(String(input)).toString(),
          catch: (cause) =>
            new SchemaIssue.InvalidValue({
              message: P.isError(cause) ? cause.message : "Expected a valid absolute URL.",
            }),
        }),
      encode: (uri) => Effect.succeed(identity(uri)),
    })
  ),
  $I.annoteSchema("EncodedStrictURIFromStrOrURL", {
    description: "A destructively transformed encoded strict URI string from a string or URL.",
  }),
  SchemaUtils.withStatics((self) => ({
    decodeResult: S.decodeUnknownResult(self),
  }))
);

/**
 * Type for encoded absolute URL strings.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EncodedStrictURIFromStrOrURL } from "../../src/Http/Http.headers.shared.ts"
 * import type { EncodedStrictURIFromStrOrURL as EncodedStrictURIFromStrOrURLType } from "../../src/Http/Http.headers.shared.ts"
 *
 * const uri: EncodedStrictURIFromStrOrURLType = S.decodeUnknownSync(EncodedStrictURIFromStrOrURL)(
 *   "https://example.com/docs"
 * )
 * console.log(uri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EncodedStrictURIFromStrOrURL = typeof EncodedStrictURIFromStrOrURL.Type;

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Encodes a string or URL as a normalized absolute URL string.
 *
 * @example
 * ```ts
 * import { encodeStrictURI } from "../../src/Http/Http.headers.shared.ts"
 *
 * console.log(encodeStrictURI("https://example.com/docs"))
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeStrictURI = (value: StringOrUrl): EncodedStrictURIFromStrOrURL =>
  Result.getOrThrowWith(EncodedStrictURIFromStrOrURL.decodeResult(value), schemaIssueToError);

/**
 * Wraps a single value in an array while preserving arrays.
 *
 * @example
 * ```ts
 * import { wrapArray } from "../../src/Http/Http.headers.shared.ts"
 *
 * console.log(wrapArray("cache-control").length)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const wrapArray = <T>(value: T | ReadonlyArray<T>): readonly T[] =>
  A.isArray(value) ? cast(value) : cast(A.make(value));

/**
 * Model for a rendered HTTP response header.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ResponseHeader } from "../../src/Http/Http.headers.shared.ts"
 *
 * const header = ResponseHeader.make({ name: "X-Test", value: O.some("ok") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResponseHeader extends S.Class<ResponseHeader>($I`ResponseHeader`)(
  {
    name: S.String,
    value: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ResponseHeader", {
    description: "A response header.",
  })
) {}

/**
 * Creates an encoder that always fails for one-way header schemas.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeHeaderEncodeForbidden } from "../../src/Http/Http.headers.shared.ts"
 *
 * const result = Effect.runSyncExit(makeHeaderEncodeForbidden("DemoHeader")("value"))
 * console.log(result._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeHeaderEncodeForbidden =
  <A>(schemaName: string): ((header: A) => Effect.Effect<never, SchemaIssue.Issue>) =>
  (): Effect.Effect<never, SchemaIssue.Issue> =>
    Effect.fail(
      new SchemaIssue.Forbidden({
        message: `Encoding ${schemaName} back to the original input is not supported`,
      })
    );

/**
 * @category constructors
 * @since 0.0.0
 */
const makeResponseHeader: {
  (name: string, value: string): ResponseHeader;
  (value: string): (name: string) => ResponseHeader;
} = dual(
  2,
  (name: string, value: string): ResponseHeader =>
    ResponseHeader.make({
      name,
      value: Option.some(value),
    })
);

/**
 * Creates a response header when a value is present.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { makeResponseHeaderOption } from "../../src/Http/Http.headers.shared.ts"
 *
 * const header = makeResponseHeaderOption("X-Test", O.some("ok"))
 * console.log(O.isSome(header))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeResponseHeaderOption: {
  (name: string, value: Option.Option<string>): Option.Option<ResponseHeader>;
  (value: Option.Option<string>): (name: string) => Option.Option<ResponseHeader>;
} = dual(
  2,
  (name: string, value: Option.Option<string>): Option.Option<ResponseHeader> =>
    Option.map(value, (headerValue) => makeResponseHeader(name, headerValue))
);
