/**
 * Runtime configuration models for the xAI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XaiId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { Str } from "@beep/utils";
import { identity, SchemaTransformation } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $XaiId.create("XAi.config");
const normalizeXAiBaseUrl = Str.replace(/\/+$/, "");
const isUrlWithProtocol =
  (protocols: ReadonlyArray<string>) =>
  (value: unknown): value is string => {
    if (!URLStr.is(value)) {
      return false;
    }
    return protocols.includes(new URL(value).protocol);
  };
const isXAiHttpBaseUrl = isUrlWithProtocol(["http:", "https:"]);
const isXAiWebSocketBaseUrl = isUrlWithProtocol(["ws:", "wss:"]);

/**
 * xAI HTTP API base URL normalized without trailing slashes.
 *
 * @example
 * ```ts
 * import { XAiHttpBaseUrl } from "@beep/xai"
 * import * as S from "effect/Schema"
 *
 * const url = S.decodeUnknownSync(XAiHttpBaseUrl)("https://api.x.ai/")
 * console.log(url) // "https://api.x.ai"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const XAiHttpBaseUrl = S.NonEmptyString.check(
  S.makeFilter(isXAiHttpBaseUrl, {
    message: "xAI HTTP base URL must be an absolute http(s) URL.",
  })
).pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: normalizeXAiBaseUrl,
      encode: identity,
    })
  ),
  $I.annoteSchema("XAiHttpBaseUrl", {
    description: "xAI HTTP API base URL normalized without trailing slashes.",
    toArbitrary: () => (fc) => fc.webUrl().map(normalizeXAiBaseUrl),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * xAI WebSocket API base URL normalized without trailing slashes.
 *
 * @example
 * ```ts
 * import { XAiWebSocketBaseUrl } from "@beep/xai"
 * import * as S from "effect/Schema"
 *
 * const url = S.decodeUnknownSync(XAiWebSocketBaseUrl)("wss://api.x.ai/")
 * console.log(url) // "wss://api.x.ai"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const XAiWebSocketBaseUrl = S.NonEmptyString.check(
  S.makeFilter(isXAiWebSocketBaseUrl, {
    message: "xAI WebSocket base URL must be an absolute ws(s) URL.",
  })
).pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: normalizeXAiBaseUrl,
      encode: identity,
    })
  ),
  $I.annoteSchema("XAiWebSocketBaseUrl", {
    description: "xAI WebSocket API base URL normalized without trailing slashes.",
    toArbitrary: () => (fc) => fc.webUrl().map((url) => normalizeXAiBaseUrl(url.replace(/^https?:/, "wss:"))),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Default xAI inference API base URL.
 *
 * @example
 * ```ts
 * import { XAI_API_URL } from "@beep/xai"
 *
 * const hostname = new URL(XAI_API_URL).hostname
 * console.log(hostname) // "api.x.ai"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const XAI_API_URL = "https://api.x.ai";

/**
 * Default xAI management API base URL.
 *
 * @example
 * ```ts
 * import { XAI_MANAGEMENT_API_URL } from "@beep/xai"
 *
 * const hostname = new URL(XAI_MANAGEMENT_API_URL).hostname
 * console.log(hostname) // "management-api.x.ai"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const XAI_MANAGEMENT_API_URL = "https://management-api.x.ai";

/**
 * Default xAI WebSocket API base URL.
 *
 * @example
 * ```ts
 * import { XAI_WEBSOCKET_URL } from "@beep/xai"
 *
 * const protocol = new URL(XAI_WEBSOCKET_URL).protocol
 * console.log(protocol) // "wss:"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const XAI_WEBSOCKET_URL = "wss://api.x.ai";

/**
 * Runtime configuration accepted by {@link XAi.makeLayer}.
 *
 * @example
 * ```ts
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 * import { XAiConfigInput } from "@beep/xai"
 *
 * const config = XAiConfigInput.make({
 *   apiKey: O.some(Redacted.make("test-key")),
 *   managementApiKey: O.some(Redacted.make("management-test-key"))
 * })
 *
 * console.log(config)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class XAiConfigInput extends S.Class<XAiConfigInput>($I`XAiConfigInput`)(
  {
    apiKey: S.OptionFromOptionalKey(S.String.pipe(S.RedactedFromValue)).pipe(SchemaUtils.withNoneDefault),
    apiUrl: XAiHttpBaseUrl.pipe(SchemaUtils.withKeyDefaults(XAI_API_URL)),
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())),
    managementApiKey: S.OptionFromOptionalKey(S.String.pipe(S.RedactedFromValue)).pipe(SchemaUtils.withNoneDefault),
    managementApiUrl: XAiHttpBaseUrl.pipe(SchemaUtils.withKeyDefaults(XAI_MANAGEMENT_API_URL)),
    websocketUrl: XAiWebSocketBaseUrl.pipe(SchemaUtils.withKeyDefaults(XAI_WEBSOCKET_URL)),
  },
  $I.annote("XAiConfigInput", {
    description: "Runtime configuration accepted by the xAI driver layer.",
  })
) {}
