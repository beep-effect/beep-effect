/**
 * Runtime configuration models for the Sanity driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SanityId } from "@beep/identity";
import { Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

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
 * **Example** (Logging default API version)
 *
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

const sanityConfigInputHeadersDefault = R.empty();
/**
 * **Example** (Creating config with make)
 *
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
export class SanityConfigInput extends S.Opaque<SanityConfigInput, { readonly brand: unique symbol }>()(
  S.Struct({
    apiHost: SanityApiHost.pipe(
      S.withConstructorDefault(Effect.succeed(SANITY_API_HOST)),
      S.annotateKey({
        description: "Sanity API base URL; defaults to the first-party API host.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(SANITY_API_HOST))
    ),
    apiToken: S.optionalKey(S.String.pipe(S.RedactedFromValue)).annotateKey({
      description: "Optional Sanity API bearer token used for authenticated requests.",
    }),
    apiVersion: SanityApiVersion.pipe(
      S.withConstructorDefault(Effect.succeed(SANITY_API_VERSION)),
      S.annotateKey({
        description: "Sanity API version date used in content API paths.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(SANITY_API_VERSION))
    ),
    dataset: S.optionalKey(SanityDataset).annotateKey({
      description: "Sanity dataset name used in content API paths.",
    }),
    headers: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed(sanityConfigInputHeadersDefault)),
      S.annotateKey({
        description: "Additional HTTP headers included on Sanity content API requests.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(sanityConfigInputHeadersDefault))
    ),
    projectId: S.optionalKey(SanityProjectId).annotateKey({
      description: "Sanity project id used to scope first-party API hosts.",
    }),
  }).pipe(
    $I.annoteSchema("SanityConfigInput", {
      description: "Runtime configuration accepted by the Sanity API driver layer.",
    })
  )
) {}
