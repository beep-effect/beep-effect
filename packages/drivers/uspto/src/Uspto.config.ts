/**
 * Runtime configuration models for the USPTO Open Data Portal driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { identity, SchemaTransformation } from "effect";
import * as Bool from "effect/Boolean";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $UsptoId.create("Uspto.config");

/**
 * Default USPTO Open Data Portal API base URL.
 *
 * **Example** (Log default API URL)
 *
 * ```ts
 * import { USPTO_API_URL } from "@beep/uspto"
 *
 * console.log(USPTO_API_URL)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const USPTO_API_URL = "https://api.uspto.gov";

const stripTrailingSlash = Str.replace(/\/+$/, "");
const NormalizedUsptoApiUrl = S.String.check(
  S.makeFilter((value) => Bool.and(URLStr.is(value), Bool.not(Str.endsWith("/")(value))), {
    identifier: $I`NormalizedUsptoApiUrlCheck`,
    title: "Normalized USPTO API URL",
    description: "A valid USPTO API base URL without trailing slashes.",
    message: "USPTO API URL must not end with a slash",
  })
);

const UsptoApiUrl = S.String.pipe(
  S.decodeTo(
    NormalizedUsptoApiUrl,
    SchemaTransformation.transform({
      decode: stripTrailingSlash,
      encode: identity,
    })
  ),
  SchemaUtils.withKeyDefaults(USPTO_API_URL)
);

/**
 * Runtime configuration accepted by {@link Uspto.makeLayer}.
 *
 * **Example** (Create config with redacted key)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import { UsptoConfigInput } from "@beep/uspto"
 *
 * const config = UsptoConfigInput.make({ apiKey: Redacted.make("test-key") })
 * console.log(config)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class UsptoConfigInput extends S.Class<UsptoConfigInput>($I`UsptoConfigInput`)(
  {
    apiKey: S.optionalKey(S.String.pipe(S.RedactedFromValue)).annotateKey({
      description: "USPTO API key used for authenticated Open Data Portal requests.",
    }),
    apiUrl: UsptoApiUrl.annotateKey({
      description: "USPTO Open Data Portal API base URL with trailing slash normalization.",
    }),
  },
  $I.annote("UsptoConfigInput", {
    description: "Typed configuration for the USPTO Open Data Portal driver: API key and base URL.",
  })
) {}
