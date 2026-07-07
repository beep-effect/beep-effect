/**
 * Runtime configuration models and constants for the GovInfo driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GovinfoId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $GovinfoId.create("Govinfo.config");

/**
 * Default GovInfo REST API base URL (official, public-domain source).
 *
 * @example
 * ```ts
 * import { GOVINFO_API_URL } from "@beep/govinfo"
 *
 * console.log(GOVINFO_API_URL)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GOVINFO_API_URL = "https://api.govinfo.gov";

/**
 * api.data.gov query-parameter name carrying the GovInfo API key.
 *
 * @example
 * ```ts
 * import { GOVINFO_API_KEY_PARAM } from "@beep/govinfo"
 *
 * console.log(GOVINFO_API_KEY_PARAM)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GOVINFO_API_KEY_PARAM = "api_key";

/**
 * Environment variable read for the GovInfo api.data.gov API key.
 *
 * @example
 * ```ts
 * import { GOVINFO_API_KEY_ENV } from "@beep/govinfo"
 *
 * console.log(GOVINFO_API_KEY_ENV)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GOVINFO_API_KEY_ENV = "GOVINFO_API_KEY";

/**
 * Default api.data.gov hourly request budget for a keyed GovInfo client.
 *
 * @example
 * ```ts
 * import { GOVINFO_RATE_LIMIT } from "@beep/govinfo"
 *
 * console.log(GOVINFO_RATE_LIMIT)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GOVINFO_RATE_LIMIT = 1000;

/**
 * Default rate-limit window matching the api.data.gov hourly budget.
 *
 * @example
 * ```ts
 * import { GOVINFO_RATE_LIMIT_WINDOW } from "@beep/govinfo"
 *
 * console.log(GOVINFO_RATE_LIMIT_WINDOW)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GOVINFO_RATE_LIMIT_WINDOW = "1 hour";

/**
 * Default response cache time-to-live for repeated identical searches.
 *
 * @example
 * ```ts
 * import { GOVINFO_CACHE_TTL } from "@beep/govinfo"
 *
 * console.log(GOVINFO_CACHE_TTL)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GOVINFO_CACHE_TTL = "5 minutes";

/**
 * Runtime configuration accepted by {@link Govinfo.makeLayer}.
 *
 * @example
 * ```ts
 * import { GovinfoConfigInput } from "@beep/govinfo"
 * import { URLStr } from "@beep/schema"
 *
 * const config = GovinfoConfigInput.make({
 *   apiUrl: URLStr.make("https://api.govinfo.gov")
 * })
 * console.log(config.apiUrl)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GovinfoConfigInput extends S.Class<GovinfoConfigInput>($I`GovinfoConfigInput`)(
  {
    apiKey: S.OptionFromOptionalKey(S.String.pipe(S.RedactedFromValue)).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional redacted api.data.gov API key used for keyed GovInfo requests.",
      })
    ),
    apiUrl: URLStr.pipe(SchemaUtils.withKeyDefaults(URLStr.make(GOVINFO_API_URL))).annotateKey({
      description: "Base URL for GovInfo REST API requests.",
    }),
  },
  $I.annote("GovinfoConfigInput", {
    description: "Runtime configuration accepted by the GovInfo REST API driver layer.",
  })
) {}
