/**
 * Runtime configuration for the Firecrawl scrape driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity";
import { URLStr } from "@beep/schema";
import * as Bool from "effect/Boolean";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

const $I = $FirecrawlId.create("Firecrawl.config");

/**
 * Default Firecrawl API origin.
 *
 * **Example** (Log the default API origin)
 *
 * ```ts
 * import { FIRECRAWL_API_URL } from "@beep/firecrawl"
 *
 * console.log(FIRECRAWL_API_URL) // "https://api.firecrawl.dev"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FIRECRAWL_API_URL = "https://api.firecrawl.dev";

/**
 * 1Password reference that names the Firecrawl API key.
 *
 * **Details**
 *
 * The value is a reference, never the key. Callers resolve it at runtime through the
 * PATH `op` shim and pass the resulting redacted value to {@link FirecrawlConfigInput}.
 *
 * **Example** (Log the key reference)
 *
 * ```ts
 * import { FIRECRAWL_API_KEY_REFERENCE } from "@beep/firecrawl"
 *
 * console.log(FIRECRAWL_API_KEY_REFERENCE.startsWith("op://")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FIRECRAWL_API_KEY_REFERENCE = "op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY";

/**
 * Default upper bound, in bytes, on one retained scrape response body.
 *
 * **Example** (Log the default response bound)
 *
 * ```ts
 * import { FIRECRAWL_MAX_RESPONSE_BYTES } from "@beep/firecrawl"
 *
 * console.log(FIRECRAWL_MAX_RESPONSE_BYTES) // 20000000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FIRECRAWL_MAX_RESPONSE_BYTES = 20_000_000;

const NormalizedFirecrawlApiUrl = S.String.check(
  S.makeFilter(
    (value) => Bool.and(URLStr.is(value), Bool.not(Str.endsWith("/")(value))),
    $I.annote("NormalizedFirecrawlApiUrlCheck", {
      title: "Normalized Firecrawl API URL",
      description: "A valid Firecrawl API origin without trailing slashes.",
      message: "Firecrawl API URL must be a URL without a trailing slash",
      arbitraryConstraint: { patterns: [{ source: "^https://[a-z]{1,12}\\.example$", flags: "" }] },
    })
  )
);

const FirecrawlApiUrl = S.String.pipe(
  S.decodeTo(
    NormalizedFirecrawlApiUrl,
    SchemaTransformation.transform({ decode: Str.replace(/\/+$/, ""), encode: identity })
  ),
  S.withConstructorDefault(Effect.succeed(FIRECRAWL_API_URL)),
  S.withDecodingDefaultTypeKey(Effect.succeed(FIRECRAWL_API_URL))
);

const MaxResponseBytes = S.Int.check(S.isGreaterThan(0)).pipe(
  S.withConstructorDefault(Effect.succeed(FIRECRAWL_MAX_RESPONSE_BYTES)),
  S.withDecodingDefaultTypeKey(Effect.succeed(FIRECRAWL_MAX_RESPONSE_BYTES))
);

/**
 * Runtime configuration accepted by {@link Firecrawl.makeLayer}.
 *
 * **Example** (Create config with a redacted key)
 *
 * ```ts
 * import * as Redacted from "effect/Redacted";
 * import { FirecrawlConfigInput } from "@beep/firecrawl"
 *
 * const config = FirecrawlConfigInput.make({ apiKey: Redacted.make("fc-test") })
 * console.log(config.apiUrl) // "https://api.firecrawl.dev"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class FirecrawlConfigInput extends S.Opaque<FirecrawlConfigInput, { readonly brand: unique symbol }>()(
  S.Struct({
    apiKey: S.String.pipe(S.RedactedFromValue).annotateKey({
      description: "Firecrawl API key, held redacted for the bearer authorization header.",
    }),
    apiUrl: FirecrawlApiUrl.annotateKey({
      description: "Firecrawl API origin with trailing slash normalization.",
    }),
    maxResponseBytes: MaxResponseBytes.annotateKey({
      description: "Largest scrape response body retained before the stream is cancelled.",
    }),
  }).pipe(
    $I.annoteSchema("FirecrawlConfigInput", {
      description: "Typed configuration for the Firecrawl driver: key, origin and response bound.",
    })
  )
) {}

/**
 * Configuration accepted when the key is resolved lazily.
 *
 * **Example** (Create keyless config)
 *
 * ```ts
 * import { FirecrawlOptions } from "@beep/firecrawl"
 *
 * console.log(FirecrawlOptions.make({}).maxResponseBytes) // 20000000
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class FirecrawlOptions extends S.Opaque<FirecrawlOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    apiUrl: FirecrawlApiUrl.annotateKey({ description: "Firecrawl API origin." }),
    maxResponseBytes: MaxResponseBytes.annotateKey({ description: "Largest retained scrape response body." }),
  }).pipe(
    $I.annoteSchema("FirecrawlOptions", {
      description: "Firecrawl origin and response bound for a layer whose key is resolved on first use.",
    })
  )
) {}
