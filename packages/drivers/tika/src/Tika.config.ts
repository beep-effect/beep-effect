/**
 * Runtime configuration models and constants for the Tika driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TikaId } from "@beep/identity";
import { PosInt, SchemaUtils, URLStr } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { SchemaGetter } from "effect";
import * as S from "effect/Schema";

const $I = $TikaId.create("Tika.config");

const defaultTimeoutMillis = 120_000;
const trailingSlashPattern = /\/+$/u;
const httpProtocols = ["http:", "https:"];

const carriesQueryOrFragment = (url: string): boolean => {
  const parsed = new URL(url);
  return Str.isNonEmpty(parsed.search) || Str.isNonEmpty(parsed.hash);
};

const hasHttpProtocol = (url: string): boolean => A.contains(httpProtocols, new URL(url).protocol);

// Endpoint paths are appended verbatim (`${baseUrl}/rmeta/text`), so a trailing
// slash would yield `//rmeta/text` and a query or fragment would swallow the
// endpoint path entirely. Normalize the former, reject the latter.
//
// The scheme is restricted to http(s) because Tika Server is reached over HTTP
// (SPEC "Tika Server over HTTP"); it also keeps trailing-slash stripping
// identity-preserving, which is not true of opaque URLs such as `A:/`.
const TikaServerBaseUrl = URLStr.pipe(
  S.check(
    S.makeFilter((url: string) => (hasHttpProtocol(url) ? true : "must use the http or https scheme"), {
      identifier: $I`TikaServerBaseUrlProtocolCheck`,
      title: "Tika Server Base URL Protocol",
      description: "Checks that the Tika Server base URL uses the http or https scheme.",
    })
  ),
  S.check(
    S.makeFilter((url: string) => (carriesQueryOrFragment(url) ? "must not carry a query string or fragment" : true), {
      identifier: $I`TikaServerBaseUrlEndpointCheck`,
      title: "Tika Server Base URL",
      description: "Checks that the Tika Server base URL carries no query string or fragment.",
    })
  ),
  S.decode({
    decode: SchemaGetter.transform((url: URLStr) => URLStr.make(Str.replace(trailingSlashPattern, "")(url))),
    encode: SchemaGetter.passthrough(),
  }),
  // Piped after the transform so it guards the decoded value: decoding strips
  // the slash and then satisfies this, while `TikaServerEngineConfig.make` —
  // which runs type-side checks but not transformations — is rejected outright
  // instead of silently producing `//rmeta/text`.
  S.check(
    S.makeFilter((url: string) => (trailingSlashPattern.test(url) ? "must not end with a trailing slash" : true), {
      identifier: $I`TikaServerBaseUrlTrailingSlashCheck`,
      title: "Tika Server Base URL Trailing Slash",
      description: "Checks that the normalized Tika Server base URL carries no trailing slash.",
    })
  ),
  $I.annoteSchema("TikaServerBaseUrl", {
    description: "Tika Server base URL: http(s) only, no trailing slash, no query string, and no fragment.",
    // Generated from components so every value is already normalized. Filtering
    // URLStr's arbitrary would reject nearly everything it produces.
    toArbitrary: () => (fc) =>
      fc
        .tuple(
          fc.constantFrom("http", "https"),
          fc.stringMatching(/^[a-z][a-z0-9-]{0,15}(?:\.[a-z][a-z0-9-]{0,15}){0,2}$/),
          fc.oneof(
            fc.constant(""),
            fc.integer({ min: 1, max: 65_535 }).map((port) => `:${port}`)
          ),
          fc
            .array(fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,10}$/), { maxLength: 3 })
            .map((segments) => (A.isReadonlyArrayEmpty(segments) ? "" : `/${A.join(segments, "/")}`))
        )
        .map(([scheme, host, port, path]) => URLStr.make(`${scheme}://${host}${port}${path}`)),
  })
);

/**
 * Engine name reported by every Tika engine descriptor and operation error.
 *
 * **Example** (Log engine name constant)
 *
 * ```ts
 * import { TIKA_ENGINE_NAME } from "@beep/tika"
 *
 * console.log(TIKA_ENGINE_NAME) // "apache-tika"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TIKA_ENGINE_NAME = "apache-tika";

/**
 * Default Tika Server base URL.
 *
 * **Details**
 *
 * Tika Server is an external sidecar listening on its stock port, not a repo
 * dev server, so the portless naming convention does not apply to it.
 *
 * **Example** (Log default server URL)
 *
 * ```ts
 * import { TIKA_SERVER_URL } from "@beep/tika"
 *
 * console.log(TIKA_SERVER_URL) // "http://localhost:9998"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TIKA_SERVER_URL = "http://localhost:9998";

/**
 * Environment variable read for the Tika Server base URL.
 *
 * **Example** (Log base URL env name)
 *
 * ```ts
 * import { BEEP_TIKA_BASE_URL_ENV } from "@beep/tika"
 *
 * console.log(BEEP_TIKA_BASE_URL_ENV) // "BEEP_TIKA_BASE_URL"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BEEP_TIKA_BASE_URL_ENV = "BEEP_TIKA_BASE_URL";

/**
 * Environment variable read for the per-file Tika Server extraction timeout.
 *
 * **Example** (Log timeout env name)
 *
 * ```ts
 * import { BEEP_TIKA_TIMEOUT_MILLIS_ENV } from "@beep/tika"
 *
 * console.log(BEEP_TIKA_TIMEOUT_MILLIS_ENV) // "BEEP_TIKA_TIMEOUT_MILLIS"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BEEP_TIKA_TIMEOUT_MILLIS_ENV = "BEEP_TIKA_TIMEOUT_MILLIS";

/**
 * Environment variable read for the Tika Server materialized-text budget.
 *
 * **Example** (Log max output env name)
 *
 * ```ts
 * import { BEEP_TIKA_MAX_OUTPUT_BYTES_ENV } from "@beep/tika"
 *
 * console.log(BEEP_TIKA_MAX_OUTPUT_BYTES_ENV) // "BEEP_TIKA_MAX_OUTPUT_BYTES"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BEEP_TIKA_MAX_OUTPUT_BYTES_ENV = "BEEP_TIKA_MAX_OUTPUT_BYTES";

/**
 * Configuration for the Tika Server HTTP engine.
 *
 * **Details**
 *
 * `maxOutputBytes` is the driver-level ceiling on the Tika Server response
 * body — JSON envelope, metadata, and extracted text together — enforced while
 * the body streams. An absent value means unbounded, and a per-operation
 * `maxMaterializedBytes` narrows it further.
 *
 * **Example** (Make default engine config)
 *
 * ```ts
 * import { TikaServerEngineConfig } from "@beep/tika"
 *
 * const config = TikaServerEngineConfig.make({})
 * console.log(config.baseUrl) // "http://localhost:9998"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class TikaServerEngineConfig extends S.Class<TikaServerEngineConfig>($I`TikaServerEngineConfig`)(
  {
    baseUrl: TikaServerBaseUrl.pipe(SchemaUtils.withKeyDefaults(URLStr.make(TIKA_SERVER_URL))).annotateKey({
      description:
        "Base URL of the Tika Server instance serving /version and /rmeta/text; trailing slashes are stripped and query strings or fragments are rejected.",
    }),
    maxOutputBytes: S.OptionFromOptionalKey(PosInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Driver-level ceiling in bytes on the whole Tika Server response body, metadata included; absent means unbounded.",
      })
    ),
    timeoutMillis: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(defaultTimeoutMillis))).annotateKey({
      description: "Per-file Tika Server extraction timeout in milliseconds.",
    }),
  },
  $I.annote("TikaServerEngineConfig", {
    description: "Configuration for the Tika Server HTTP engine: base URL, per-file timeout, and output budget.",
  })
) {}
