/**
 * Runtime configuration models and constants for the Microsoft 365 (Graph) driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { NonNegativeInt, SchemaUtils, URLStr } from "@beep/schema";
import { O } from "@beep/utils";
import { HashSet, pipe, SchemaGetter } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $M365Id.create("M365.config");

/**
 * Microsoft Graph base URL pinned to the stable `v1.0` endpoint.
 *
 * The driver never targets `beta` in product code (surface drift / no SLA).
 *
 * @example
 * ```ts
 * import { GRAPH_API_BASE_URL } from "@beep/m365"
 *
 * const drivesUrl = new URL(`${GRAPH_API_BASE_URL}/me/drives`)
 * console.log(drivesUrl.pathname) // "/v1.0/me/drives"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0";

/**
 * Default Microsoft identity platform authority host.
 *
 * @example
 * ```ts
 * import { DEFAULT_AUTHORITY_HOST } from "@beep/m365"
 *
 * const authority = new URL(`${DEFAULT_AUTHORITY_HOST}/common`)
 * console.log(authority.hostname) // "login.microsoftonline.com"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_AUTHORITY_HOST = "https://login.microsoftonline.com";

/**
 * Default loopback redirect URI for the delegated authorization-code + PKCE flow.
 *
 * AAD allows any port for `http://localhost` / `http://127.0.0.1` loopback
 * redirects (RFC 8252); the host-owned interactive authorizer binds the port.
 *
 * @example
 * ```ts
 * import { DEFAULT_REDIRECT_URI } from "@beep/m365"
 *
 * const redirect = new URL(DEFAULT_REDIRECT_URI)
 * console.log(redirect.protocol) // "http:"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_REDIRECT_URI = "http://localhost";

/**
 * Default throttle-retry budget honored on `429` / `503` responses.
 *
 * @example
 * ```ts
 * import { DEFAULT_MAX_RETRIES } from "@beep/m365"
 *
 * const retryBudgetAllowsThrottleReplay = DEFAULT_MAX_RETRIES >= 3
 * console.log(retryBudgetAllowsThrottleReplay) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Delegated Graph read scopes requested in v1.
 *
 * Least-privilege for read-only ingest; `offline_access` enables silent refresh.
 *
 * @example
 * ```ts
 * import { M365_READ_SCOPES } from "@beep/m365"
 *
 * console.log(M365_READ_SCOPES.includes("Files.Read.All")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const M365_READ_SCOPES = [
  "offline_access",
  "User.Read",
  "Files.Read.All",
  "Sites.Read.All",
  "Mail.Read",
  "Calendars.Read",
] as const;

/**
 * Write scopes reserved for a future write-back phase. v1 NEVER requests these.
 *
 * The service shape is write-ready (verbs/scopes are extensible), but the v1
 * scope set is read-only by construction — see {@link M365ConfigInput}.
 *
 * @example
 * ```ts
 * import { M365_RESERVED_WRITE_SCOPES } from "@beep/m365"
 *
 * console.log(M365_RESERVED_WRITE_SCOPES.includes("Mail.Send")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const M365_RESERVED_WRITE_SCOPES = [
  "Files.ReadWrite.All",
  "Sites.ReadWrite.All",
  "Mail.Send",
  "Calendars.ReadWrite",
] as const;

const reservedWriteScopes = HashSet.make(...M365_RESERVED_WRITE_SCOPES);

const requestsNoWriteScope = (scopes: ReadonlyArray<string>): boolean =>
  A.every(scopes, (scope) => !HashSet.has(reservedWriteScopes, scope));

const normalizeBaseUrl = Str.replace(/\/+$/, "");
const makeNormalizedUrl = (value: string): URLStr => URLStr.make(normalizeBaseUrl(value));
const isNormalizedConfigUrl = (value: unknown): value is URLStr =>
  URLStr.is(value) && Str.Equivalence(normalizeBaseUrl(value), value);

const normalizedConfigUrlFilter = S.makeFilter(isNormalizedConfigUrl, {
  identifier: $I`M365NormalizedConfigUrl`,
  title: "M365 normalized configuration URL",
  description: "A valid Microsoft 365 configuration URL without trailing slash separators.",
  message: "Microsoft 365 configuration URLs must be valid and normalized without trailing slash separators.",
});

const M365ConfigUrl = S.String.pipe(
  S.decodeTo(S.String.check(normalizedConfigUrlFilter), {
    decode: SchemaGetter.transform(normalizeBaseUrl),
    encode: SchemaGetter.transform(normalizeBaseUrl),
  }),
  $I.annoteSchema("M365ConfigUrl", {
    description: "Normalized Microsoft 365 configuration URL with trailing slash separators removed.",
  })
);

/**
 * Runtime configuration accepted by the Microsoft 365 driver layers.
 *
 * Public-client (delegated, auth-code + PKCE) configuration. `tenantId` and
 * `clientId` are not secrets; `clientSecret` is reserved (and `S.Redacted`) for
 * a future confidential-client path and is unused by the v1 public-client flow.
 * This is an application-boundary input the host constructs: constant-default
 * fields (`scopes`, `redirectUri`, `graphBaseUrl`, `maxRetries`) carry their
 * defaults in the schema, so the host may omit them and {@link resolveM365Config}
 * only derives `authority` and folds the genuinely-absent fields into `Option`.
 *
 * Requested `scopes` may not include any {@link M365_RESERVED_WRITE_SCOPES}
 * entry — read-only by construction.
 *
 * @example
 * ```ts
 * import { M365ConfigInput } from "@beep/m365"
 *
 * const config = M365ConfigInput.make({
 *   tenantId: "common",
 *   clientId: "00000000-0000-0000-0000-000000000000"
 * })
 *
 * console.log(config.tenantId) // "common"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ConfigInput extends S.Class<M365ConfigInput>($I`M365ConfigInput`)(
  {
    tenantId: S.NonEmptyString.annotateKey({
      description: "Entra tenant id (a GUID, `common`, `organizations`, or `consumers`).",
    }),
    clientId: S.NonEmptyString.annotateKey({
      description: "Entra application (public client) id used for the delegated PKCE flow.",
    }),
    authority: S.OptionFromOptionalKey(M365ConfigUrl).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Full normalized authority URL; defaults to `${DEFAULT_AUTHORITY_HOST}/${tenantId}` when omitted.",
    }),
    clientSecret: S.OptionFromOptionalKey(S.NonEmptyString.pipe(S.RedactedFromValue))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Reserved confidential-client secret; redacted and unused by the v1 public-client flow.",
      }),
    graphBaseUrl: M365ConfigUrl.pipe(SchemaUtils.withKeyDefaults(makeNormalizedUrl(GRAPH_API_BASE_URL))).annotateKey({
      description: "Graph base URL override; defaults to the pinned v1.0 endpoint.",
    }),
    maxRetries: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(DEFAULT_MAX_RETRIES))).annotateKey({
      description: "Throttle-retry budget honored on 429/503; defaults to DEFAULT_MAX_RETRIES.",
    }),
    redirectUri: M365ConfigUrl.pipe(SchemaUtils.withKeyDefaults(makeNormalizedUrl(DEFAULT_REDIRECT_URI))).annotateKey({
      description: "Loopback redirect URI base for the interactive authorizer; defaults to http://localhost.",
    }),
    scopes: S.Array(S.NonEmptyString)
      .check(
        S.makeFilter(requestsNoWriteScope, {
          identifier: $I`M365ReadOnlyScopes`,
          title: "M365 read-only scopes",
          description: "v1 requests delegated read scopes only; reserved write scopes must not be requested.",
          message: "Reserved write scope requested; the v1 Microsoft 365 driver is read-only.",
        })
      )
      .pipe(SchemaUtils.withKeyDefaults(M365_READ_SCOPES))
      .annotateKey({
        description: "Requested delegated scopes; defaults to M365_READ_SCOPES. Reserved write scopes are rejected.",
      }),
    tokenCachePath: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Filesystem path for the encrypted MSAL token cache; in-memory cache when omitted.",
    }),
  },
  $I.annote("M365ConfigInput", {
    description: "Runtime configuration accepted by the Microsoft 365 Graph driver layers.",
  })
) {}

/**
 * Resolved Microsoft 365 configuration with defaults applied. Internal model
 * shared by the auth and service layers; absence is modeled as `Option`.
 *
 * @example
 * ```ts
 * import { M365ConfigInput, resolveM365Config } from "@beep/m365"
 *
 * const resolved = resolveM365Config(
 *   M365ConfigInput.make({ tenantId: "common", clientId: "client-id" })
 * )
 *
 * console.log(resolved.graphBaseUrl) // "https://graph.microsoft.com/v1.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedM365Config extends S.Class<ResolvedM365Config>($I`ResolvedM365Config`)(
  {
    tenantId: S.NonEmptyString.annotateKey({ description: "Resolved Entra tenant id." }),
    clientId: S.NonEmptyString.annotateKey({ description: "Resolved Entra public-client application id." }),
    authority: URLStr.annotateKey({ description: "Resolved normalized authority URL." }),
    scopes: S.Array(S.NonEmptyString).annotateKey({ description: "Resolved delegated read scopes." }),
    redirectUri: URLStr.annotateKey({ description: "Resolved normalized loopback redirect URI base." }),
    graphBaseUrl: URLStr.annotateKey({ description: "Resolved Graph base URL (normalized, no trailing slash)." }),
    maxRetries: NonNegativeInt.annotateKey({ description: "Resolved throttle-retry budget." }),
    tokenCachePath: S.Option(S.NonEmptyString).annotateKey({
      description: "Resolved encrypted token-cache path, if persistence is configured.",
    }),
    clientSecret: S.NonEmptyString.pipe(S.Redacted, S.Option).annotateKey({
      description: "Resolved reserved confidential-client secret, if supplied.",
    }),
  },
  $I.annote("ResolvedM365Config", {
    description: "Resolved Microsoft 365 driver configuration with defaults applied.",
  })
) {}

/**
 * Apply defaults to {@link M365ConfigInput}, producing a {@link ResolvedM365Config}.
 *
 * @example
 * ```ts
 * import { M365ConfigInput, resolveM365Config } from "@beep/m365"
 *
 * const resolved = resolveM365Config(
 *   M365ConfigInput.make({ tenantId: "common", clientId: "client-id" })
 * )
 *
 * console.log(resolved.graphBaseUrl) // "https://graph.microsoft.com/v1.0"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const resolveM365Config = (input: M365ConfigInput): ResolvedM365Config =>
  ResolvedM365Config.make({
    tenantId: input.tenantId,
    clientId: input.clientId,
    authority: pipe(
      input.authority,
      O.map(makeNormalizedUrl),
      O.getOrElse(() => makeNormalizedUrl(`${DEFAULT_AUTHORITY_HOST}/${input.tenantId}`))
    ),
    scopes: input.scopes,
    redirectUri: makeNormalizedUrl(input.redirectUri),
    graphBaseUrl: makeNormalizedUrl(input.graphBaseUrl),
    maxRetries: input.maxRetries,
    tokenCachePath: input.tokenCachePath,
    clientSecret: input.clientSecret,
  });
