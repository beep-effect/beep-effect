/**
 * Runtime configuration models and constants for the Microsoft 365 (Graph) driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { URLStr } from "@beep/schema";
import { O } from "@beep/utils";
import { Effect, HashSet, pipe, SchemaGetter } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $M365Id.create("M365.config");

/**
 * Microsoft Graph base URL pinned to the stable `v1.0` endpoint.
 *
 * **Details**
 *
 * The driver never targets `beta` in product code (surface drift / no SLA).
 *
 * **Example** (Build Graph drives URL)
 *
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
 * **Example** (Build authority host URL)
 *
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
 * **Details**
 *
 * AAD allows any port for `http://localhost` / `http://127.0.0.1` loopback
 * redirects (RFC 8252); the host-owned interactive authorizer binds the port.
 *
 * **Example** (Parse default redirect URI)
 *
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
 * **Example** (Check retry budget threshold)
 *
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
 * **Details**
 *
 * Least-privilege for read-only ingest; `offline_access` enables silent refresh.
 *
 * **Example** (Check Files.Read.All scope)
 *
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
 * **Details**
 *
 * The service shape is write-ready (verbs/scopes are extensible), but the v1
 * scope set is read-only by construction — see {@link M365ConfigInput}.
 *
 * **Example** (Check Mail.Send write scope)
 *
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
  arbitraryConstraint: { patterns: [{ source: "^https://[a-z]{1,12}\\.example(?:/[a-z0-9]{1,12})?$", flags: "" }] },
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

const m365ConfigInputGraphBaseUrlDefault = makeNormalizedUrl(GRAPH_API_BASE_URL);
const m365ConfigInputMaxRetriesDefault = S.Natural.make(DEFAULT_MAX_RETRIES);
const m365ConfigInputRedirectUriDefault = makeNormalizedUrl(DEFAULT_REDIRECT_URI);
/**
 * Runtime configuration accepted by the Microsoft 365 driver layers.
 *
 * **Details**
 *
 * Public-client (delegated, auth-code + PKCE) configuration. `tenantId` and
 * `clientId` are not secrets; confidential credentials belong to the separate
 * app-only lane ({@link M365AppOnlyConfigInput}) and cannot be supplied here.
 * This is an application-boundary input the host constructs: constant-default
 * fields (`scopes`, `redirectUri`, `graphBaseUrl`, `maxRetries`) carry their
 * defaults in the schema, so the host may omit them and {@link resolveM365Config}
 * only derives `authority` and folds the genuinely-absent fields into `Option`.
 *
 * Requested `scopes` may not include any {@link M365_RESERVED_WRITE_SCOPES}
 * entry — read-only by construction.
 *
 * **Example** (Create minimal config input)
 *
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
    authority: S.OptionFromOptionalKey(M365ConfigUrl).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Full normalized authority URL; defaults to `${DEFAULT_AUTHORITY_HOST}/${tenantId}` when omitted.",
    }),
    graphBaseUrl: M365ConfigUrl.pipe(
      S.withConstructorDefault(Effect.succeed(m365ConfigInputGraphBaseUrlDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(m365ConfigInputGraphBaseUrlDefault))
    ).annotateKey({
      description: "Graph base URL override; defaults to the pinned v1.0 endpoint.",
    }),
    maxRetries: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(m365ConfigInputMaxRetriesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(m365ConfigInputMaxRetriesDefault))
    ).annotateKey({
      description: "Throttle-retry budget honored on 429/503; defaults to DEFAULT_MAX_RETRIES.",
    }),
    redirectUri: M365ConfigUrl.pipe(
      S.withConstructorDefault(Effect.succeed(m365ConfigInputRedirectUriDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(m365ConfigInputRedirectUriDefault))
    ).annotateKey({
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
      .pipe(
        S.withConstructorDefault(Effect.succeed(M365_READ_SCOPES)),
        S.withDecodingDefaultTypeKey(Effect.succeed(M365_READ_SCOPES))
      )
      .annotateKey({
        description: "Requested delegated scopes; defaults to M365_READ_SCOPES. Reserved write scopes are rejected.",
      }),
    tokenCachePath: S.OptionFromOptionalKey(S.NonEmptyString)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
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
 * **Example** (Resolve config with defaults)
 *
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
    maxRetries: S.Natural.annotateKey({ description: "Resolved throttle-retry budget." }),
    tokenCachePath: S.Option(S.NonEmptyString).annotateKey({
      description: "Resolved encrypted token-cache path, if persistence is configured.",
    }),
  },
  $I.annote("ResolvedM365Config", {
    description: "Resolved Microsoft 365 driver configuration with defaults applied.",
  })
) {}

/**
 * Apply defaults to {@link M365ConfigInput}, producing a {@link ResolvedM365Config}.
 *
 * **Example** (Apply config defaults)
 *
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
  });

/**
 * Certificate credential for the app-only lane: the production credential.
 *
 * **Details**
 *
 * `thumbprintSha256` is the hex SHA-256 thumbprint of the certificate uploaded
 * to the Entra app registration; `privateKey` is its PEM private key, resolved
 * at runtime from a protected store and never written to configuration files.
 *
 * **Example** (Make certificate credential)
 *
 * ```ts
 * import { M365CertificateCredential } from "@beep/m365"
 * import { Redacted } from "effect"
 *
 * const credential = M365CertificateCredential.make({
 *   privateKey: Redacted.make("pem-private-key-from-a-protected-store"),
 *   thumbprintSha256: "AB12"
 * })
 * console.log(credential._tag) // "M365CertificateCredential"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365CertificateCredential extends S.TaggedClass<M365CertificateCredential>($I`M365CertificateCredential`)(
  "M365CertificateCredential",
  {
    privateKey: S.NonEmptyString.pipe(S.RedactedFromValue).annotateKey({
      description: "PEM private key of the registered certificate; redacted.",
    }),
    thumbprintSha256: S.NonEmptyString.annotateKey({
      description: "Hex SHA-256 thumbprint of the registered certificate.",
    }),
  },
  $I.annote("M365CertificateCredential", {
    description: "Certificate credential for the Microsoft 365 app-only lane.",
  })
) {}

/**
 * Client-secret credential for the app-only lane: a dev/test fallback only.
 *
 * **Gotchas**
 *
 * Microsoft discourages client secrets for production daemons. Use
 * {@link M365CertificateCredential} for any unattended service.
 *
 * **Example** (Make client-secret credential)
 *
 * ```ts
 * import { M365ClientSecretCredential } from "@beep/m365"
 * import { Redacted } from "effect"
 *
 * const credential = M365ClientSecretCredential.make({ clientSecret: Redacted.make("dev-secret") })
 * console.log(credential._tag) // "M365ClientSecretCredential"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ClientSecretCredential extends S.TaggedClass<M365ClientSecretCredential>(
  $I`M365ClientSecretCredential`
)(
  "M365ClientSecretCredential",
  {
    clientSecret: S.NonEmptyString.pipe(S.RedactedFromValue).annotateKey({
      description: "Entra client secret; redacted. Dev/test fallback only.",
    }),
  },
  $I.annote("M365ClientSecretCredential", {
    description: "Client-secret credential for the Microsoft 365 app-only lane (dev/test fallback).",
  })
) {}

/**
 * Credential accepted by the app-only lane.
 *
 * **Example** (Read credential tag)
 *
 * ```ts
 * import type { M365AppOnlyCredential } from "@beep/m365"
 *
 * const tag = (credential: M365AppOnlyCredential) => credential._tag
 * console.log(tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365AppOnlyCredential = S.Union([M365CertificateCredential, M365ClientSecretCredential]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("M365AppOnlyCredential", {
    description: "Credential accepted by the Microsoft 365 app-only lane; the certificate is primary.",
  })
);

/**
 * Type for {@link M365AppOnlyCredential}.
 *
 * **Example** (Type a credential)
 *
 * ```ts
 * import type { M365AppOnlyCredential } from "@beep/m365"
 *
 * const isCertificate = (credential: M365AppOnlyCredential) => credential._tag === "M365CertificateCredential"
 * console.log(isCertificate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365AppOnlyCredential = typeof M365AppOnlyCredential.Type;

/**
 * Runtime configuration for the app-only (confidential client) lane.
 *
 * **Details**
 *
 * The lane has no scopes, redirect URI or user token cache: it always requests
 * the Graph `/.default` scope with the client-credentials grant, and what it
 * may reach is decided by the role assignments on the service principal. It
 * can never call `/me` routes, so every mailbox verb needs a `userId`.
 *
 * **Example** (Create app-only config input)
 *
 * ```ts
 * import { M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365"
 * import { Redacted } from "effect"
 *
 * const config = M365AppOnlyConfigInput.make({
 *   clientId: "00000000-0000-0000-0000-000000000000",
 *   credential: M365CertificateCredential.make({
 *     privateKey: Redacted.make("pem-private-key-from-a-protected-store"),
 *     thumbprintSha256: "AB12"
 *   }),
 *   tenantId: "11111111-1111-1111-1111-111111111111"
 * })
 *
 * console.log(config.maxRetries) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365AppOnlyConfigInput extends S.Class<M365AppOnlyConfigInput>($I`M365AppOnlyConfigInput`)(
  {
    tenantId: S.NonEmptyString.annotateKey({
      description: "Entra tenant id (a GUID or verified domain); multi-tenant aliases are not valid for app-only.",
    }),
    clientId: S.NonEmptyString.annotateKey({
      description: "Entra application (confidential client) id.",
    }),
    credential: M365AppOnlyCredential.annotateKey({
      description: "Certificate (production) or client-secret (dev/test) credential.",
    }),
    authority: S.OptionFromOptionalKey(M365ConfigUrl).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Full normalized authority URL; defaults to `${DEFAULT_AUTHORITY_HOST}/${tenantId}` when omitted.",
    }),
    graphBaseUrl: M365ConfigUrl.pipe(
      S.withConstructorDefault(Effect.succeed(m365ConfigInputGraphBaseUrlDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(m365ConfigInputGraphBaseUrlDefault))
    ).annotateKey({
      description: "Graph base URL override; defaults to the pinned v1.0 endpoint.",
    }),
    maxRetries: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(m365ConfigInputMaxRetriesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(m365ConfigInputMaxRetriesDefault))
    ).annotateKey({
      description: "Throttle-retry budget honored on 429/503; defaults to DEFAULT_MAX_RETRIES.",
    }),
  },
  $I.annote("M365AppOnlyConfigInput", {
    description: "Runtime configuration for the Microsoft 365 app-only (confidential client) lane.",
  })
) {}

/**
 * Resolve the authority URL of an {@link M365AppOnlyConfigInput}.
 *
 * **Example** (Default authority)
 *
 * ```ts
 * import { M365AppOnlyConfigInput, M365ClientSecretCredential, resolveM365AppOnlyAuthority } from "@beep/m365"
 * import { Redacted } from "effect"
 *
 * const authority = resolveM365AppOnlyAuthority(
 *   M365AppOnlyConfigInput.make({
 *     clientId: "client-id",
 *     credential: M365ClientSecretCredential.make({ clientSecret: Redacted.make("dev-secret") }),
 *     tenantId: "tenant-id"
 *   })
 * )
 *
 * console.log(authority) // "https://login.microsoftonline.com/tenant-id"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const resolveM365AppOnlyAuthority = (input: M365AppOnlyConfigInput): URLStr =>
  pipe(
    input.authority,
    O.map(makeNormalizedUrl),
    O.getOrElse(() => makeNormalizedUrl(`${DEFAULT_AUTHORITY_HOST}/${input.tenantId}`))
  );

/**
 * The single scope the app-only lane requests: the `/.default` scope of the
 * configured Graph origin.
 *
 * **Example** (Default Graph scope)
 *
 * ```ts
 * import { m365AppOnlyScope } from "@beep/m365"
 *
 * console.log(m365AppOnlyScope("https://graph.microsoft.com/v1.0")) // "https://graph.microsoft.com/.default"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const m365AppOnlyScope = (graphBaseUrl: string): string => `${new URL(graphBaseUrl).origin}/.default`;
