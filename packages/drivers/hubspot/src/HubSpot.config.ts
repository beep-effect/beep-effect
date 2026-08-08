/**
 * Runtime configuration models for the HubSpot driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $HubspotId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { Str } from "@beep/utils";
import { identity, SchemaTransformation } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $HubspotId.create("HubSpot.config");
const normalizeHubSpotBaseUrl = Str.replace(/\/+$/, "");
const isHubSpotUrl = (value: unknown): value is string => P.isString(value) && URLStr.is(value);

/**
 * HubSpot-compatible absolute URL string.
 *
 * **Example** (Decode HubSpot absolute URL)
 *
 * ```ts
 * import { HubSpotUrl } from "@beep/hubspot"
 * import * as S from "effect/Schema"
 *
 * const url = S.decodeUnknownSync(HubSpotUrl)("https://api.hubapi.com")
 * console.log(url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HubSpotUrl = S.NonEmptyString.check(
  S.makeFilter(isHubSpotUrl, {
    message: "HubSpot URL must be an absolute URL string.",
  })
).pipe(
  $I.annoteSchema("HubSpotUrl", {
    description: "Absolute URL string accepted by the HubSpot driver.",
    toArbitrary: () => (fc) => fc.webUrl(),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * HubSpot API base URL normalized without trailing slashes.
 *
 * **Example** (Normalize trailing slash URL)
 *
 * ```ts
 * import { HubSpotBaseUrl } from "@beep/hubspot"
 * import * as S from "effect/Schema"
 *
 * const url = S.decodeUnknownSync(HubSpotBaseUrl)("https://api.hubapi.com/")
 * console.log(url) // "https://api.hubapi.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HubSpotBaseUrl = S.String.pipe(
  S.decodeTo(
    HubSpotUrl,
    SchemaTransformation.transform({
      decode: normalizeHubSpotBaseUrl,
      encode: identity,
    })
  ),
  $I.annoteSchema("HubSpotBaseUrl", {
    description: "HubSpot API base URL normalized without trailing slashes.",
    toArbitrary: () => (fc) => fc.webUrl().map(normalizeHubSpotBaseUrl),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link HubSpotBaseUrl}.
 *
 * **Example** (Type annotated base URL)
 *
 * ```ts
 * import { HubSpotBaseUrl } from "@beep/hubspot"
 * import * as S from "effect/Schema"
 *
 * const url: HubSpotBaseUrl = S.decodeUnknownSync(HubSpotBaseUrl)("https://api.hubapi.com/")
 * console.log(url) // "https://api.hubapi.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HubSpotBaseUrl = typeof HubSpotBaseUrl.Type;

/**
 * Non-empty HubSpot account identifier.
 *
 * **Example** (Decode HubSpot account ID)
 *
 * ```ts
 * import { HubSpotAccountId } from "@beep/hubspot"
 * import * as S from "effect/Schema"
 *
 * const accountId = S.decodeUnknownSync(HubSpotAccountId)("12345")
 * console.log(accountId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HubSpotAccountId = S.NonEmptyString.pipe(
  $I.annoteSchema("HubSpotAccountId", {
    description: "Non-empty HubSpot account identifier.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Default HubSpot Forms API base URL.
 *
 * **Example** (Log Forms API URL)
 *
 * ```ts
 * import { HUBSPOT_FORMS_API_URL } from "@beep/hubspot"
 *
 * console.log(HUBSPOT_FORMS_API_URL) // "https://api.hsforms.com"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HUBSPOT_FORMS_API_URL = "https://api.hsforms.com";

/**
 * Default HubSpot CRM API base URL.
 *
 * **Example** (Log CRM API URL)
 *
 * ```ts
 * import { HUBSPOT_CRM_API_URL } from "@beep/hubspot"
 *
 * console.log(HUBSPOT_CRM_API_URL) // "https://api.hubapi.com"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HUBSPOT_CRM_API_URL = "https://api.hubapi.com";

/**
 * Runtime configuration accepted by {@link HubSpot.makeLayer}.
 *
 * **Example** (Create config with make)
 *
 * ```ts
 * import { HubSpotConfigInput } from "@beep/hubspot"
 *
 * const config = HubSpotConfigInput.make({
 *   accountId: "12345",
 *   formsApiUrl: "https://api.hsforms.com"
 * })
 *
 * console.log(config.accountId) // "12345"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HubSpotConfigInput extends S.Class<HubSpotConfigInput>($I`HubSpotConfigInput`)(
  {
    accountId: S.optionalKey(HubSpotAccountId).annotateKey({
      description: "HubSpot account id used in secure Forms API submission URLs.",
    }),
    accessToken: S.optionalKey(S.String.pipe(S.RedactedFromValue)).annotateKey({
      description: "Optional redacted private-app access token used for authenticated HubSpot requests.",
    }),
    crmApiUrl: HubSpotBaseUrl.pipe(SchemaUtils.withKeyDefaults(HUBSPOT_CRM_API_URL)).annotateKey({
      description: "Base URL for HubSpot CRM API requests.",
    }),
    formsApiUrl: HubSpotBaseUrl.pipe(SchemaUtils.withKeyDefaults(HUBSPOT_FORMS_API_URL)).annotateKey({
      description: "Base URL for HubSpot secure Forms API submissions.",
    }),
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Additional HTTP headers merged into HubSpot API requests.",
    }),
  },
  $I.annote("HubSpotConfigInput", {
    description: "Runtime configuration accepted by the HubSpot API driver layer.",
  })
) {}
