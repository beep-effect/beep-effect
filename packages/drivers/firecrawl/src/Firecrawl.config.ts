/**
 * Runtime configuration models for the Firecrawl driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $FirecrawlId.create("Firecrawl.config");

/**
 * Default Firecrawl API base URL used by the live driver layer.
 *
 * @example
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
 * @example
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
    apiUrl: S.optionalKey(S.String),
    backoffFactor: S.optionalKey(S.Number),
    maxRetries: S.optionalKey(S.Number),
    timeoutMs: S.optionalKey(S.Number),
  },
  $I.annote("FirecrawlConfigInput", {
    description: "Runtime configuration accepted by the Firecrawl technical driver layer.",
  })
) {}
