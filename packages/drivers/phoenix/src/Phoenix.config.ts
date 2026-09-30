/**
 * Runtime configuration models for the Phoenix driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PhoenixId } from "@beep/identity";
import { URLStr } from "@beep/schema";
import { Effect, SchemaGetter } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PhoenixId.create("Phoenix.config");
const normalizePhoenixBaseUrl = Str.replace(/\/+$/, "");
const makePhoenixBaseUrl = (value: string): URLStr => URLStr.make(normalizePhoenixBaseUrl(value));
const isNormalizedPhoenixBaseUrl = (value: unknown): value is URLStr =>
  URLStr.is(value) && Str.Equivalence(normalizePhoenixBaseUrl(value), value);

const normalizedPhoenixBaseUrlFilter = S.makeFilter(isNormalizedPhoenixBaseUrl, {
  identifier: $I`PhoenixNormalizedBaseUrl`,
  title: "Phoenix normalized base URL",
  description: "A valid Phoenix API base URL without trailing slash separators.",
  message: "Phoenix API base URLs must be valid and normalized without trailing slash separators.",
  arbitraryConstraint: { patterns: [{ source: "^https://[a-z]{1,12}\\.example(?:/[a-z0-9]{1,12})?$", flags: "" }] },
});

const PhoenixBaseUrl = S.String.pipe(
  S.decodeTo(S.String.check(normalizedPhoenixBaseUrlFilter), {
    decode: SchemaGetter.transform(normalizePhoenixBaseUrl),
    encode: SchemaGetter.transform(normalizePhoenixBaseUrl),
  }),
  $I.annoteSchema("PhoenixBaseUrl", {
    description: "Phoenix API base URL normalized without trailing slashes.",
  })
);

/**
 * Default Phoenix HTTP API base URL.
 *
 * **Example** (Log default API URL)
 *
 * ```ts
 * import { PHOENIX_API_URL } from "@beep/phoenix"
 *
 * console.log(PHOENIX_API_URL)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PHOENIX_API_URL = "http://localhost:6006";

const phoenixConfigInputBaseUrlDefault = makePhoenixBaseUrl(PHOENIX_API_URL);
const phoenixConfigInputHeadersDefault = R.empty();
/**
 * Runtime configuration accepted by {@link Phoenix.makeLayer}.
 *
 * **Example** (Create config with make)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 * import { PhoenixConfigInput } from "@beep/phoenix"
 *
 * const config = PhoenixConfigInput.make({
 *   apiKey: O.some(Redacted.make("test-key")),
 *   baseUrl: "https://phoenix.test"
 * })
 *
 * console.log(config.baseUrl)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixConfigInput extends S.Class<PhoenixConfigInput>($I`PhoenixConfigInput`)(
  {
    apiKey: S.OptionFromOptionalKey(S.NonEmptyString.pipe(S.RedactedFromValue))
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Optional Phoenix API key used to build the Authorization header.",
      }),
    baseUrl: PhoenixBaseUrl.pipe(
      S.withConstructorDefault(Effect.succeed(phoenixConfigInputBaseUrlDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(phoenixConfigInputBaseUrlDefault))
    ).annotateKey({
      description: "Phoenix API base URL accepted by the SDK client.",
    }),
    headers: S.Record(S.String, S.String)
      .pipe(
        S.withConstructorDefault(Effect.succeed(phoenixConfigInputHeadersDefault)),
        S.withDecodingDefaultTypeKey(Effect.succeed(phoenixConfigInputHeadersDefault))
      )
      .annotateKey({
        description: "Additional Phoenix API request headers.",
      }),
  },
  $I.annote("PhoenixConfigInput", {
    description: "Runtime configuration accepted by the Phoenix API driver layer.",
  })
) {}
