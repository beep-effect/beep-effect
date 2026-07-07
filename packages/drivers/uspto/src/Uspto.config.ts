/**
 * Runtime configuration models for the USPTO Open Data Portal driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { identity, SchemaTransformation } from "effect";
import * as S from "effect/Schema";

const $I = $UsptoId.create("Uspto.config");

/**
 * Default USPTO Open Data Portal API base URL.
 *
 * @example
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

const stripTrailingSlash = (url: string): string => (url.endsWith("/") ? url.slice(0, -1) : url);

const UsptoApiUrl = S.String.pipe(
  S.decodeTo(
    S.String,
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
 * @example
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
