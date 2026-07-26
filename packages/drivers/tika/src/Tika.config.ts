/**
 * Runtime configuration models and constants for the Tika driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TikaId } from "@beep/identity";
import { PosInt, SchemaUtils, URLStr } from "@beep/schema";
import { Str } from "@beep/utils";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

const $I = $TikaId.create("Tika.config");

const defaultTimeoutMillis = 120_000;
const trailingSlashPattern = /\/+$/u;

const carriesQueryOrFragment = (url: string): boolean => {
  const parsed = new URL(url);
  return Str.isNonEmpty(parsed.search) || Str.isNonEmpty(parsed.hash);
};

// Endpoint paths are appended verbatim (`${baseUrl}/rmeta/text`), so a trailing
// slash would yield `//rmeta/text` and a query or fragment would swallow the
// endpoint path entirely. Normalize the former, reject the latter.
const TikaServerBaseUrl = URLStr.pipe(
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
  })
);

/**
 * Engine name reported by every Tika engine descriptor and operation error.
 *
 * @example
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
 * Tika Server is an external sidecar listening on its stock port, not a repo
 * dev server, so the portless naming convention does not apply to it.
 *
 * @example
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
 * @example
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
 * @example
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
 * @example
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
 * `maxOutputBytes` is the driver-level ceiling on the Tika Server response
 * body — JSON envelope, metadata, and extracted text together — enforced while
 * the body streams. An absent value means unbounded, and a per-operation
 * `maxMaterializedBytes` narrows it further.
 *
 * @example
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
