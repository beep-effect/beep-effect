/**
 * Runtime configuration models for the Sanity driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SanityId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Str } from "@beep/utils";
import { identity, SchemaTransformation } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $SanityId.create("Sanity.config");

const SANITY_API_HOST = "https://api.sanity.io";
const normalizeSanityApiHost = Str.replace(/\/+$/, "");

const SanityApiHost = S.String.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: normalizeSanityApiHost,
      encode: identity,
    })
  ),
  $I.annoteSchema("SanityApiHost", {
    description: "Sanity API base URL normalized without trailing slashes.",
  })
);

const SanityProjectId = S.String.check(S.isPattern(/^[a-z0-9][a-z0-9-]*$/u)).pipe(
  $I.annoteSchema("SanityProjectId", {
    description: "Sanity project id safe for use as a first-party Sanity API subdomain.",
  })
);

const SanityDataset = S.String.check(S.isPattern(/^[A-Za-z0-9_-]+$/u)).pipe(
  $I.annoteSchema("SanityDataset", {
    description: "Sanity dataset name accepted in first-party API paths.",
  })
);

const SanityApiVersion = S.String.check(S.isPattern(/^\d{4}-\d{2}-\d{2}$/u)).pipe(
  $I.annoteSchema("SanityApiVersion", {
    description: "Date-shaped Sanity API version string.",
  })
);

/**
 * Default Sanity API version used when callers do not provide one.
 *
 * @example
 * ```ts
 * import { SANITY_API_VERSION } from "@beep/sanity"
 *
 * console.log(SANITY_API_VERSION) // "2025-05-14"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SANITY_API_VERSION = "2025-05-14";

/**
 * Runtime configuration accepted by {@link Sanity.makeLayer}.
 *
 * @example
 * ```ts
 * import { SANITY_API_VERSION, SanityConfigInput } from "@beep/sanity"
 *
 * const config = SanityConfigInput.make({
 *   apiVersion: SANITY_API_VERSION,
 *   dataset: "production",
 *   projectId: "content-project"
 * })
 *
 * console.log(config.dataset) // "production"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SanityConfigInput extends S.Class<SanityConfigInput>($I`SanityConfigInput`)(
  {
    apiHost: SanityApiHost.pipe(SchemaUtils.withKeyDefaults(SANITY_API_HOST)).annotateKey({
      description: "Sanity API base URL; defaults to the first-party API host.",
    }),
    apiToken: S.optionalKey(S.String.pipe(S.RedactedFromValue)).annotateKey({
      description: "Optional Sanity API bearer token used for authenticated requests.",
    }),
    apiVersion: SanityApiVersion.pipe(SchemaUtils.withKeyDefaults(SANITY_API_VERSION)).annotateKey({
      description: "Sanity API version date used in content API paths.",
    }),
    dataset: S.optionalKey(SanityDataset).annotateKey({
      description: "Sanity dataset name used in content API paths.",
    }),
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Additional HTTP headers included on Sanity content API requests.",
    }),
    projectId: S.optionalKey(SanityProjectId).annotateKey({
      description: "Sanity project id used to scope first-party API hosts.",
    }),
  },
  $I.annote("SanityConfigInput", {
    description: "Runtime configuration accepted by the Sanity API driver layer.",
  })
) {}
