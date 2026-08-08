/**
 * Runtime configuration models and constants for the keyless eCFR driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EcfrId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EcfrId.create("Ecfr.config");

/**
 * Default eCFR API origin shared by the admin, search, and versioner families.
 *
 * **Example** (Log default API URL)
 *
 * ```ts
 * import { ECFR_API_URL } from "@beep/ecfr"
 *
 * console.log(ECFR_API_URL)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ECFR_API_URL = "https://www.ecfr.gov";

/**
 * Conservative self-imposed request budget for the keyless eCFR API.
 *
 * **Example** (Log rate limit budget)
 *
 * ```ts
 * import { ECFR_RATE_LIMIT } from "@beep/ecfr"
 *
 * console.log(ECFR_RATE_LIMIT)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ECFR_RATE_LIMIT = 60;

/**
 * Rate-limit window paired with {@link ECFR_RATE_LIMIT}.
 *
 * **Example** (Log rate limit window)
 *
 * ```ts
 * import { ECFR_RATE_LIMIT_WINDOW } from "@beep/ecfr"
 *
 * console.log(ECFR_RATE_LIMIT_WINDOW)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ECFR_RATE_LIMIT_WINDOW = "1 minute";

/**
 * Runtime configuration accepted by {@link Ecfr.makeLayer}.
 *
 * **Example** (Make config with apiUrl)
 *
 * ```ts
 * import { EcfrConfigInput } from "@beep/ecfr"
 *
 * const config = EcfrConfigInput.make({ apiUrl: "https://www.ecfr.gov" })
 * console.log(config.apiUrl)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcfrConfigInput extends S.Class<EcfrConfigInput>($I`EcfrConfigInput`)(
  {
    apiUrl: S.String.pipe(
      SchemaUtils.withKeyDefaults(ECFR_API_URL),
      S.annotateKey({
        description: "Base origin for the eCFR admin, search, and versioner API families.",
      })
    ),
  },
  $I.annote("EcfrConfigInput", {
    description: "Runtime configuration accepted by the keyless eCFR driver layer.",
  })
) {}
