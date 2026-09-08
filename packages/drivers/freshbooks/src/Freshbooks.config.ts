/**
 * Runtime configuration models and identity namespaces for the FreshBooks
 * driver.
 *
 * FreshBooks uses two distinct identity namespaces — an `account_id` string on
 * accounting endpoints and an integer `business_id` on time-tracking and
 * project endpoints. They are modeled as separate schema types here; nothing
 * in the driver accepts a generic "freshbooks id".
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FreshbooksId } from "@beep/identity";
import { SchemaUtils, URLStr } from "@beep/schema";
import { Str } from "@beep/utils";
import { identity, SchemaTransformation } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $FreshbooksId.create("Freshbooks.config");
const normalizeFreshbooksBaseUrl = Str.replace(/\/+$/, "");
const isFreshbooksUrl = (value: unknown): value is string => P.isString(value) && URLStr.is(value);
// FreshBooks requires an exact-match HTTPS redirect URI with no query string
// (CAPTURE addenda / AGENTS §OAuth mechanics). Enforce https + no-query +
// no-fragment at decode so an invalid callback is rejected on config resolution
// rather than only when FreshBooks refuses the authorization exchange.
const isHttpsNoQueryRedirect = (value: unknown): value is string => {
  if (!P.isString(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.search === "" && url.hash === "";
  } catch {
    return false;
  }
};
const FreshbooksRedirectUri = S.NonEmptyString.check(
  S.makeFilter(isHttpsNoQueryRedirect, {
    message: "FreshBooks redirect URI must be an exact-match HTTPS URL with no query string or fragment.",
  })
).pipe(
  $I.annoteSchema("FreshbooksRedirectUri", {
    description: "Exact-match HTTPS redirect URI (no query or fragment) registered for the OAuth application.",
    toArbitrary: () => (fc) =>
      fc.constantFrom("https://localhost:8443/callback", "https://app.example.com/oauth/callback"),
  })
);

/**
 * Default FreshBooks REST API base URL.
 *
 * **Example** (Log API base URL)
 *
 * ```ts
 * import { FRESHBOOKS_API_URL } from "@beep/freshbooks"
 *
 * console.log(FRESHBOOKS_API_URL) // "https://api.freshbooks.com"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FRESHBOOKS_API_URL = "https://api.freshbooks.com";

/**
 * Default FreshBooks OAuth authorization host.
 *
 * **Example** (Log auth host)
 *
 * ```ts
 * import { FRESHBOOKS_AUTH_URL } from "@beep/freshbooks"
 *
 * console.log(FRESHBOOKS_AUTH_URL) // "https://auth.freshbooks.com"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FRESHBOOKS_AUTH_URL = "https://auth.freshbooks.com";

/**
 * FreshBooks-compatible absolute URL string.
 *
 * **Example** (Decode FreshBooks absolute URL)
 *
 * ```ts
 * import { FreshbooksUrl } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const url = S.decodeUnknownSync(FreshbooksUrl)("https://api.freshbooks.com")
 * console.log(url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FreshbooksUrl = S.NonEmptyString.check(
  S.makeFilter(isFreshbooksUrl, {
    message: "FreshBooks URL must be an absolute URL string.",
  })
).pipe(
  $I.annoteSchema("FreshbooksUrl", {
    description: "Absolute URL string accepted by the FreshBooks driver.",
    toArbitrary: () => (fc) => fc.webUrl(),
  })
);

/**
 * Type for {@link FreshbooksUrl}.
 *
 * **Example** (Assign FreshBooks URL type)
 *
 * ```ts
 * import type { FreshbooksUrl as FreshbooksUrlType } from "@beep/freshbooks"
 *
 * const url: FreshbooksUrlType = "https://api.freshbooks.com"
 * console.log(url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksUrl = typeof FreshbooksUrl.Type;

/**
 * FreshBooks API base URL normalized without trailing slashes.
 *
 * **Example** (Normalize trailing slash URL)
 *
 * ```ts
 * import { FreshbooksBaseUrl } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const url = S.decodeUnknownSync(FreshbooksBaseUrl)("https://api.freshbooks.com/")
 * console.log(url) // "https://api.freshbooks.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FreshbooksBaseUrl = S.String.pipe(
  S.decodeTo(
    FreshbooksUrl,
    SchemaTransformation.transform({
      decode: normalizeFreshbooksBaseUrl,
      encode: identity,
    })
  ),
  $I.annoteSchema("FreshbooksBaseUrl", {
    description: "FreshBooks API base URL normalized without trailing slashes.",
    toArbitrary: () => (fc) => fc.webUrl().map(normalizeFreshbooksBaseUrl),
  })
);

/**
 * Type for {@link FreshbooksBaseUrl}.
 *
 * **Example** (Type annotated base URL)
 *
 * ```ts
 * import { FreshbooksBaseUrl } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const url: FreshbooksBaseUrl = S.decodeUnknownSync(FreshbooksBaseUrl)("https://api.freshbooks.com/")
 * console.log(url) // "https://api.freshbooks.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksBaseUrl = typeof FreshbooksBaseUrl.Type;

/**
 * FreshBooks accounting-namespace account identifier (a string such as
 * `ABC123`, used on every `/accounting/...` endpoint).
 *
 * **Example** (Decode FreshBooks account id)
 *
 * ```ts
 * import { FreshbooksAccountId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const accountId = S.decodeUnknownSync(FreshbooksAccountId)("ABC123")
 * console.log(accountId) // "ABC123"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FreshbooksAccountId = S.NonEmptyString.pipe(
  S.brand("FreshbooksAccountId"),
  $I.annoteSchema("FreshbooksAccountId", {
    description: "FreshBooks accounting-namespace account identifier (a string).",
  })
);

/**
 * Type for {@link FreshbooksAccountId}.
 *
 * **Example** (Assign account id type)
 *
 * ```ts
 * import { FreshbooksAccountId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const accountId: FreshbooksAccountId = S.decodeUnknownSync(FreshbooksAccountId)("ABC123")
 * console.log(accountId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksAccountId = typeof FreshbooksAccountId.Type;

/**
 * FreshBooks business-namespace identifier (an integer, used on
 * `/timetracking/...` and `/projects/...` endpoints). Distinct from
 * {@link FreshbooksAccountId}; the two are never interchangeable.
 *
 * **Example** (Decode FreshBooks business id)
 *
 * ```ts
 * import { FreshbooksBusinessId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const businessId = S.decodeUnknownSync(FreshbooksBusinessId)(240340)
 * console.log(businessId) // 240340
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FreshbooksBusinessId = S.Int.check(S.isGreaterThan(0)).pipe(
  S.brand("FreshbooksBusinessId"),
  $I.annoteSchema("FreshbooksBusinessId", {
    description: "FreshBooks business-namespace identifier (a positive integer).",
  })
);

/**
 * Type for {@link FreshbooksBusinessId}.
 *
 * **Example** (Assign business id type)
 *
 * ```ts
 * import { FreshbooksBusinessId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const businessId: FreshbooksBusinessId = S.decodeUnknownSync(FreshbooksBusinessId)(240340)
 * console.log(businessId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksBusinessId = typeof FreshbooksBusinessId.Type;

/**
 * Runtime configuration accepted by {@link Freshbooks.makeLayer}.
 *
 * The OAuth `clientId` / `clientSecret` and the initial redacted refresh token
 * resolve from the recorded 1Password references at runtime; they are never
 * embedded here.
 *
 * **Example** (Create config with make)
 *
 * ```ts
 * import { FreshbooksConfigInput } from "@beep/freshbooks"
 * import { Redacted } from "effect"
 *
 * const config = FreshbooksConfigInput.make({
 *   clientId: "dev-client-id",
 *   clientSecret: Redacted.make("dev-client-secret"),
 *   redirectUri: "https://localhost:8443/callback"
 * })
 *
 * console.log(config.clientId) // "dev-client-id"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksConfigInput extends S.Class<FreshbooksConfigInput>($I`FreshbooksConfigInput`)(
  {
    clientId: S.NonEmptyString.annotateKey({
      description: "FreshBooks OAuth application client id.",
    }),
    clientSecret: S.String.pipe(S.RedactedFromValue).annotateKey({
      description: "Redacted FreshBooks OAuth application client secret.",
    }),
    redirectUri: FreshbooksRedirectUri.annotateKey({
      description: "Exact-match HTTPS redirect URI (no query or fragment) registered for the OAuth application.",
    }),
    apiUrl: FreshbooksBaseUrl.pipe(SchemaUtils.withKeyDefaults(FRESHBOOKS_API_URL)).annotateKey({
      description: "Base URL for FreshBooks REST API requests.",
    }),
    authUrl: FreshbooksBaseUrl.pipe(SchemaUtils.withKeyDefaults(FRESHBOOKS_AUTH_URL)).annotateKey({
      description: "Base URL for FreshBooks OAuth authorization.",
    }),
    headers: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Additional HTTP headers merged into FreshBooks API requests.",
    }),
  },
  $I.annote("FreshbooksConfigInput", {
    description: "Runtime configuration accepted by the FreshBooks API driver layer.",
  })
) {}
