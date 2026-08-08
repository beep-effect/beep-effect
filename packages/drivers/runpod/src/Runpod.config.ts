/**
 * Runtime configuration models for the Runpod driver.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $RunpodId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { SchemaGetter } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RunpodId.create("Runpod.config");
const normalizeConfigUrl = Str.replace(/\/+$/, "");

/**
 * Runpod configuration URL normalized without trailing slashes.
 *
 * **Example** (Normalize URL without trailing slash)
 *
 * ```ts
 * import { RunpodConfigUrl } from "@beep/runpod"
 *
 * const url = RunpodConfigUrl.fromUnknown("https://rest.runpod.io/v1/")
 * console.log(url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunpodConfigUrl = S.String.pipe(
  S.decodeTo(S.String.check(URLStr.filter), {
    decode: SchemaGetter.transform(normalizeConfigUrl),
    encode: SchemaGetter.transform(normalizeConfigUrl),
  }),
  $I.annoteSchema("RunpodConfigUrl", {
    description: "Validated Runpod configuration URL with trailing slash separators removed.",
    toArbitrary: () => (fc) => fc.webUrl().map(normalizeConfigUrl),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link RunpodConfigUrl}.
 *
 * **Example** (Type annotation for config URL)
 *
 * ```ts
 * import { RunpodConfigUrl } from "@beep/runpod"
 *
 * const url: RunpodConfigUrl = RunpodConfigUrl.fromUnknown("https://rest.runpod.io/v1/")
 * console.log(url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RunpodConfigUrl = typeof RunpodConfigUrl.Type;

/**
 * Default Runpod REST API v1 base URL.
 *
 * **Example** (Log default API base URL)
 *
 * ```ts
 * import { RUNPOD_API_URL } from "@beep/runpod"
 *
 * console.log(RUNPOD_API_URL)
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const RUNPOD_API_URL = "https://rest.runpod.io/v1";

/**
 * Default Runpod documentation index URL for LLM-oriented docs.
 *
 * **Example** (Log default docs index URL)
 *
 * ```ts
 * import { RUNPOD_DOCS_INDEX_URL } from "@beep/runpod"
 *
 * console.log(RUNPOD_DOCS_INDEX_URL)
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const RUNPOD_DOCS_INDEX_URL = "https://docs.runpod.io/llms.txt";

/**
 * Runtime configuration accepted by {@link Runpod.makeLayer}.
 *
 * **Example** (Build runtime config input)
 *
 * ```ts
 * import { RunpodConfigInput } from "@beep/runpod"
 *
 * const config = RunpodConfigInput.make({
 *   apiUrl: "https://rest.runpod.io/v1",
 *   headers: { "x-client": "beep" }
 * })
 * console.log(config.apiUrl)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodConfigInput extends S.Class<RunpodConfigInput>($I`RunpodConfigInput`)(
  {
    apiKey: S.optionalKey(S.String.pipe(S.RedactedFromValue)),
    apiUrl: RunpodConfigUrl.pipe(SchemaUtils.withKeyDefaults(RUNPOD_API_URL)),
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())),
  },
  $I.annote("RunpodConfigInput", {
    description: "Runtime configuration accepted by the Runpod REST API driver layer.",
  })
) {}

/**
 * Runtime configuration accepted by {@link RunpodDocs.makeLayer}.
 *
 * **Example** (Build docs config input)
 *
 * ```ts
 * import { RunpodDocsConfigInput } from "@beep/runpod"
 *
 * const config = RunpodDocsConfigInput.make({
 *   indexUrl: "https://docs.runpod.io/llms.txt"
 * })
 * console.log(config.indexUrl)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class RunpodDocsConfigInput extends S.Class<RunpodDocsConfigInput>($I`RunpodDocsConfigInput`)(
  {
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())),
    indexUrl: RunpodConfigUrl.pipe(SchemaUtils.withKeyDefaults(RUNPOD_DOCS_INDEX_URL)),
  },
  $I.annote("RunpodDocsConfigInput", {
    description: "Runtime configuration accepted by the Runpod documentation index driver layer.",
  })
) {}
