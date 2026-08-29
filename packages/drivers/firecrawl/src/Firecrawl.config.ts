/**
 * Runtime configuration models for the Firecrawl driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { isNonNegative, isPositive } from "@beep/schema/Number";
import { URLStr } from "@beep/schema/URL";
import { identity, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $FirecrawlId.create("Firecrawl.config");

const normalizeBaseUrl = Str.replace(/\/+$/, "");

const hasNoTrailingSlash = S.makeFilter((value: string): value is string => !Str.endsWith("/")(value), {
  identifier: $I`FirecrawlApiUrlNoTrailingSlash`,
  title: "Firecrawl API URL trailing slash",
  description: "Firecrawl API base URLs are stored without trailing slashes.",
  message: "Expected a Firecrawl API URL without trailing slashes",
});

const FirecrawlApiUrlBase = S.String.check(URLStr.filter).check(hasNoTrailingSlash);

/**
 * Firecrawl API base URL decoded by the driver configuration schema.
 *
 * **Example** (Decode Firecrawl API URL)
 *
 * ```ts
 * import { FirecrawlApiUrl } from "@beep/firecrawl"
 * import * as S from "effect/Schema"
 *
 * const url = S.decodeUnknownSync(FirecrawlApiUrl)("https://api.firecrawl.dev/")
 * console.log(url)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlApiUrl = S.String.pipe(
  S.decodeTo(
    FirecrawlApiUrlBase,
    SchemaTransformation.transform({
      decode: normalizeBaseUrl,
      encode: identity,
    })
  ),
  $I.annoteSchema("FirecrawlApiUrl", {
    description: "Firecrawl API base URL with trailing slashes normalized away at the schema boundary.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link FirecrawlApiUrl}.
 *
 * **Example** (Type annotate API URL)
 *
 * ```ts
 * import type { FirecrawlApiUrl } from "@beep/firecrawl"
 *
 * const url: FirecrawlApiUrl = "https://api.firecrawl.dev"
 * console.log(url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlApiUrl = typeof FirecrawlApiUrl.Type;

const FirecrawlBackoffFactor = S.Finite.check(isPositive).pipe(
  $I.annoteSchema("FirecrawlBackoffFactor", {
    description: "Positive finite retry backoff multiplier accepted by the Firecrawl SDK client.",
  })
);

const FirecrawlRetryCount = S.Int.check(isNonNegative).pipe(
  $I.annoteSchema("FirecrawlRetryCount", {
    description: "Non-negative integer retry count accepted by the Firecrawl SDK client.",
  })
);

const FirecrawlTimeoutMs = S.Int.check(isPositive).pipe(
  $I.annoteSchema("FirecrawlTimeoutMs", {
    description: "Positive integer timeout in milliseconds accepted by the Firecrawl SDK client.",
  })
);

/**
 * Default Firecrawl API base URL used by the live driver layer.
 *
 * **Example** (Log default API URL)
 *
 * ```ts
 * import { FIRECRAWL_API_URL } from "@beep/firecrawl"
 *
 * console.log(FIRECRAWL_API_URL)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FIRECRAWL_API_URL = "https://api.firecrawl.dev";

/**
 * Runtime configuration accepted by {@link Firecrawl.makeLayer}.
 *
 * **Example** (Make config with API key)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import { FirecrawlConfigInput } from "@beep/firecrawl"
 *
 * const config = FirecrawlConfigInput.make({
 *   apiKey: Redacted.make("fc-test-key")
 * })
 *
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlConfigInput extends S.Class<FirecrawlConfigInput>($I`FirecrawlConfigInput`)(
  {
    apiKey: S.optionalKey(S.String.pipe(S.RedactedFromValue)),
    apiUrl: FirecrawlApiUrl.pipe(SchemaUtils.withKeyDefaults(FIRECRAWL_API_URL)),
    backoffFactor: S.OptionFromOptionalKey(FirecrawlBackoffFactor).pipe(SchemaUtils.withNoneDefault),
    maxRetries: S.OptionFromOptionalKey(FirecrawlRetryCount).pipe(SchemaUtils.withNoneDefault),
    timeoutMs: S.OptionFromOptionalKey(FirecrawlTimeoutMs).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FirecrawlConfigInput", {
    description: "Runtime configuration accepted by the Firecrawl technical driver layer.",
  })
) {}
