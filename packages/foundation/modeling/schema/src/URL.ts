/**
 * A module housing URL related schemas
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { O } from "@beep/utils";
import { Brand } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";
import { NonEmptyTrimmedStr } from "./String.ts";

const $I = $SchemaId.create("URL");

const isURLStr = (u: unknown): u is URLStr =>
  S.is(NonEmptyTrimmedStr)(u) && O.isSome(S.decodeOption(S.URLFromString)(u));

const filterURLStr = S.makeFilter(isURLStr, {
  message: "URL must be a valid URL encoded string",
});

const urlStr = Brand.check<URLStr>(filterURLStr);

/**
 * A branded schema for URL-encoded strings validated against `new URL()`.
 *
 * **Example** (Decode URL-encoded string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { URLStr } from "@beep/schema/URL"
 *
 * const url = S.decodeUnknownSync(URLStr)("https://example.com")
 * console.log(url)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const URLStr = NonEmptyTrimmedStr.annotate({
  toArbitrary: () => (fc) => fc.webUrl().map(urlStr),
}).pipe(
  S.fromBrand("URLStr", urlStr),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    filter: filterURLStr,
    is: isURLStr,
    make: urlStr,
  })),
  $I.annoteSchema("URLStr", {
    description: "A URL encoded as a string",
    toArbitrary: () => (fc) => fc.webUrl().map(urlStr),
  })
);

/**
 * Type for {@link URLStr}.
 *
 * **Example** (Type annotated URL string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { URLStr } from "@beep/schema/URL"
 *
 * const endpoint: URLStr = S.decodeUnknownSync(URLStr)("https://api.example.com")
 * console.log(endpoint)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type URLStr = Brand.Branded<NonEmptyTrimmedStr, "URLStr">;

const filterHttpsUrl = S.makeFilter(
  (input: unknown): input is `https://${string}` => {
    const urlOpt = S.decodeUnknownOption(S.URLFromString)(input);

    if (O.isNone(urlOpt)) return false;

    const url = urlOpt.value;

    return url.protocol === "https:";
  },
  {
    message: "URL must use the https protocol",
  }
);

/**
 * Branded schema for absolute URL strings that use the `https:` protocol.
 *
 * **Example** (Decode HTTPS URL string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpsUrl } from "@beep/schema/URL"
 *
 * const secureUrl = S.decodeUnknownSync(HttpsUrl)("https://example.com")
 * console.log(secureUrl)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpsUrl = S.String.pipe(
  S.check(filterHttpsUrl),
  S.brand("HttpsUrl"),
  $I.annoteSchema("HttpsUrl", {
    description: "An absolute URL string constrained to the https protocol.",
  })
);

/**
 * Type for {@link HttpsUrl}.
 *
 * **Example** (Type annotated HTTPS URL)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HttpsUrl } from "@beep/schema/URL"
 *
 * const secureUrl: HttpsUrl = S.decodeUnknownSync(HttpsUrl)("https://api.example.com")
 * console.log(secureUrl)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HttpsUrl = typeof HttpsUrl.Type;

/**
 * Namespace members for {@link HttpsUrl}.
 *
 * **Example** (Satisfy Encoded type)
 *
 * ```ts
 * import { HttpsUrl } from "@beep/schema/URL"
 *
 * const encoded = "https://example.com" satisfies HttpsUrl.Encoded
 * console.log(encoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HttpsUrl {
  /**
   * Encoded representation accepted by {@link HttpsUrl}.
   *
   * **Example** (Satisfy Encoded type)
   *
   * ```ts
   * import { HttpsUrl } from "@beep/schema/URL"
   *
   * const encoded = "https://example.com" satisfies HttpsUrl.Encoded
   * console.log(encoded)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof HttpsUrl.Encoded;
}
