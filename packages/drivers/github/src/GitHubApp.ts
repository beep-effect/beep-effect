/**
 * GitHub App authentication: minting, revoking and identifying installation
 * tokens, and a client layer that authenticates as an app installation.
 *
 * **Details**
 *
 * This is the only module in the package that imports a JWT signer, so a
 * consumer that already holds a token imports `GitHubClient` and never links
 * it. The option and credential records here are service options rather than
 * wire data: their functions and `Redacted` values keep the encoded side equal
 * to the decoded side, and every member takes the plain `Encoded` shape.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import githubAppJwt from "universal-github-app-jwt";
import { GitHubClient, makeClientShape } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { GitHubGraphQLError } from "./GraphQL.ts";
import { numericId } from "./internal/ids.ts";
import { FetchFunction, RetryPolicySchema } from "./internal/octokit.ts";
import type * as Scope from "effect/Scope";
import type { GitHubClientShape } from "./GitHubClient.ts";
import type { GraphQLDocument } from "./GraphQL.ts";
import type * as Rest from "./Rest.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $GithubId.create("GitHubApp");

/**
 * A GitHub App call failed.
 *
 * **Details**
 *
 * Distinct from `GitHubError` because "I could not obtain credentials" and "the
 * API call failed" are different problems with different fixes: the first is a
 * misconfigured app, a wrong private key or a missing installation; the second
 * is the request that used the credentials.
 *
 * **Example** (Describe a credential failure)
 *
 * ```ts
 * import { GitHubAppError } from "@beep/github/GitHubApp";
 *
 * const error = GitHubAppError.make({ kind: "jwt", reason: "invalid key" });
 * console.log(error.message) // GitHub App jwt failed: invalid key
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitHubAppError extends S.TaggedError<GitHubAppError, { readonly brand: unique symbol }>(
  $I`GitHubAppError`
)(
  "GitHubAppError",
  {
    /** Which step failed. */
    kind: S.Literals(["jwt", "token", "revoke", "identity", "installation"]).pipe(
      $I.annoteKey("GitHubAppError.kind", { description: "Which step failed." })
    ),
    /** Human-readable cause. */
    reason: S.String.pipe($I.annoteKey("GitHubAppError.reason", { description: "Human-readable cause." })),
    /** The underlying failure, when there is one. */
    cause: S.optionalKey(S.Defect()).pipe(
      $I.annoteKey("GitHubAppError.cause", { description: "The underlying failure, when there is one." })
    ),
  },
  $I.annoteError<GitHubAppError>("GitHubAppError", { description: "A GitHub App call failed." })
) {
  /**
   * Formats the failed authentication step and its human-readable cause.
   *
   * **Example** (Read the formatted app failure)
   *
   * ```ts
   * import { GitHubAppError } from "@beep/github/GitHubApp";
   *
   * console.log(GitHubAppError.make({ kind: "jwt", reason: "invalid key" }).message) // GitHub App jwt failed: invalid key
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return `GitHub App ${this.kind} failed: ${this.reason}`;
  }

  /**
   * Constructs a failure for a specific GitHub App authentication step.
   *
   * **Example** (Construct an app failure)
   *
   * ```ts
   * import { GitHubAppError } from "@beep/github/GitHubApp";
   *
   * console.log(GitHubAppError.of("token", "missing installation").kind) // token
   * ```
   *
   * @internal
   * @category constructors
   * @since 0.0.0
   */
  static of(kind: GitHubAppError["kind"], reason: string, cause?: unknown): GitHubAppError {
    return GitHubAppError.make({ kind, reason, ...O.getSomesStruct({ cause: O.fromUndefinedOr(cause) }) });
  }
}

const AppCredentialsFields = {
  /** The app id or client id. */
  appId: S.String.pipe($I.annoteKey("AppCredentials.appId", { description: "The app id or client id." })),
  /**
   * The app's private key, in PEM.
   *
   * **Gotchas**
   *
   * PKCS#1 (an `RSA PRIVATE KEY` PEM block, which is what github.com hands
   * you) is converted to PKCS#8 automatically **on Node**. On a runtime without
   * `node:crypto` a PKCS#1 key fails with an explicit `kind: "jwt"` error, and
   * the fix is to convert the key once with
   * `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt`. This constraint is
   * inherited from the JWT signer and is identical to `@octokit/auth-app`'s.
   */
  privateKey: S.Redacted(S.String).pipe(
    $I.annoteKey("AppCredentials.privateKey", { description: "The app's private key, in PEM." })
  ),
};

/**
 * The credentials that identify a GitHub App.
 *
 * **Details**
 *
 * `appId` accepts either the numeric app id or the newer client id — GitHub
 * accepts both as the JWT issuer, and this package does not care which you use.
 * The private key stays `Redacted` on both sides of the schema, so the members
 * that take credentials accept {@link AppCredentials.Encoded} and a caller
 * passes an object literal.
 *
 * **Example** (Describe app credentials)
 *
 * ```ts
 * import { AppCredentials } from "@beep/github/GitHubApp";
 * import * as Redacted from "effect/Redacted";
 *
 * const credentials = AppCredentials.make({ appId: "12345", privateKey: Redacted.make("example PEM") });
 * console.log(credentials.appId) // 12345
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class AppCredentials extends S.Opaque<AppCredentials, { readonly brand: unique symbol }>()(
  S.Struct(AppCredentialsFields).pipe(
    $I.annoteSchema("AppCredentials", { description: "The credentials that identify a GitHub App." })
  )
) {}

/**
 * Companion types for {@link AppCredentials}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppCredentials {
  /**
   * The plain, unbranded credentials every app member accepts.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AppCredentials.Encoded;
}

/**
 * What to mint an installation token for.
 *
 * **Details**
 *
 * The app credentials plus how to find the installation. Discovery from
 * `owner` costs a JWT mint plus a paginated walk of `GET /app/installations`,
 * so supplying `installationId` is strictly cheaper. When both are omitted and
 * the app has exactly one installation, that one is used; with several, the
 * failure names them.
 *
 * **Example** (Request a token for a known installation)
 *
 * ```ts
 * import { TokenRequest } from "@beep/github/GitHubApp";
 * import * as Redacted from "effect/Redacted";
 *
 * const request = TokenRequest.make({
 *   appId: "12345",
 *   privateKey: Redacted.make("example PEM"),
 *   installationId: 42,
 * });
 * console.log(request.installationId) // 42
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TokenRequest extends S.Opaque<TokenRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    ...AppCredentialsFields,
    /** The installation. Discovered from `owner` when omitted. */
    installationId: S.optionalKey(S.Int).pipe(
      $I.annoteKey("TokenRequest.installationId", {
        description: "The installation. Discovered from `owner` when omitted.",
      })
    ),
    /** The account whose installation to use, when `installationId` is omitted. */
    owner: S.optionalKey(S.String).pipe(
      $I.annoteKey("TokenRequest.owner", {
        description: "The account whose installation to use, when `installationId` is omitted.",
      })
    ),
  }).pipe($I.annoteSchema("TokenRequest", { description: "What to mint an installation token for." }))
) {}

/**
 * Companion types for {@link TokenRequest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TokenRequest {
  /**
   * The plain, unbranded request `token`, `scopedToken` and `clientLayer` accept.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TokenRequest.Encoded;
}

/**
 * An installation access token and what GitHub said about it.
 *
 * **Details**
 *
 * Encodable on purpose. A GitHub Actions step persists one across the
 * `pre`/`main`/`post` process boundary through `GITHUB_STATE`, and
 * `Schema.encodeUnknownEffect` produces JSON with the token as a plain string
 * and `expiresAt` as an ISO instant. A `Redacted` cannot survive serialization
 * by design, so masking the encoded value is the caller's job — Actions calls
 * `::add-mask::`.
 *
 * **Example** (Decode installation metadata)
 *
 * ```ts
 * import { InstallationToken } from "@beep/github/GitHubApp";
 * import * as S from "effect/Schema";
 *
 * const token = S.decodeUnknownSync(InstallationToken)({
 *   token: "example-token", expiresAt: "2030-01-01T00:00:00.000Z",
 *   installationId: 42, permissions: {}, appSlug: "my-app",
 * });
 * console.log(token.installationId) // 42
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class InstallationToken extends S.Class<InstallationToken, { readonly brand: unique symbol }>(
  $I`InstallationToken`
)(
  {
    /** The token. Decodes to `Redacted`, encodes back to the raw string. */
    token: S.RedactedFromValue(S.String).pipe(
      $I.annoteKey("InstallationToken.token", {
        description: "The token. Decodes to `Redacted`, encodes back to the raw string.",
      })
    ),
    /** When GitHub will stop accepting it — about an hour out. */
    expiresAt: S.DateTimeUtcFromString.pipe(
      $I.annoteKey("InstallationToken.expiresAt", {
        description: "When GitHub will stop accepting it — about an hour out.",
      })
    ),
    /** The installation it is scoped to. */
    installationId: S.Int.pipe(
      $I.annoteKey("InstallationToken.installationId", { description: "The installation it is scoped to." })
    ),
    /** The permissions GitHub actually granted, which may be narrower than requested. */
    permissions: S.Record(S.String, S.String).pipe(
      $I.annoteKey("InstallationToken.permissions", {
        description: "The permissions GitHub actually granted, which may be narrower than requested.",
      })
    ),
    /** The app's slug, when identity was resolved. */
    appSlug: S.optionalKey(S.String).pipe(
      $I.annoteKey("InstallationToken.appSlug", { description: "The app's slug, when identity was resolved." })
    ),
    /** The app's bot user id, when identity was resolved. */
    appUserId: S.optionalKey(S.Int).pipe(
      $I.annoteKey("InstallationToken.appUserId", { description: "The app's bot user id, when identity was resolved." })
    ),
    /** The app's display name, when identity was resolved. */
    appName: S.optionalKey(S.String).pipe(
      $I.annoteKey("InstallationToken.appName", { description: "The app's display name, when identity was resolved." })
    ),
  },
  $I.annote("InstallationToken", { description: "An installation access token and what GitHub said about it." })
) {
  /**
   * Whether this token is spent, `skew` before its stated expiry.
   *
   * **Details**
   *
   * `skew` defaults to one minute, so a token is treated as spent slightly early
   * rather than answering 401 mid-request.
   *
   * **Example** (Check the default expiry margin)
   *
   * ```ts
   * import { InstallationToken } from "@beep/github/GitHubApp";
   * import * as S from "effect/Schema";
   *
   * const token = S.decodeUnknownSync(InstallationToken)({
   *   token: "example-token", expiresAt: "2030-01-01T00:00:00.000Z",
   *   installationId: 42, permissions: {}, appSlug: "my-app",
   * });
   * console.log(token.isExpired(Date.parse("2029-12-31T23:59:00.000Z"))) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  isExpired(nowMillis: number, skew: Duration.Duration = DEFAULT_SKEW): boolean {
    return DateTime.toEpochMillis(this.expiresAt) - Duration.toMillis(skew) <= nowMillis;
  }

  /**
   * The committer identity a commit made with this token should carry.
   *
   * **Example** (Derive the token committer)
   *
   * ```ts
   * import { InstallationToken } from "@beep/github/GitHubApp";
   * import * as S from "effect/Schema";
   *
   * const token = S.decodeUnknownSync(InstallationToken)({
   *   token: "example-token", expiresAt: "2030-01-01T00:00:00.000Z",
   *   installationId: 42, permissions: {}, appSlug: "my-app",
   * });
   * console.log(token.botIdentity().name) // my-app[bot]
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  botIdentity(): BotIdentity {
    return this.appSlug === undefined
      ? BotIdentity.githubActions
      : BotIdentity.forApp({
          appSlug: this.appSlug,
          ...O.getSomesStruct({ appUserId: O.fromUndefinedOr(this.appUserId) }),
        });
  }
}

/** Re-mint a minute before GitHub would start refusing the token. */
const DEFAULT_SKEW = Duration.seconds(60);

/** A git author address: one `@`, a dotted domain, and no whitespace. */
const CommitEmail = S.String.check(S.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)).pipe(
  $I.annoteSchema("CommitEmail", { description: "A git author address." })
);

/**
 * Who a bot commits as.
 *
 * **Details**
 *
 * A **pure class**, not a `GitHubApp` service member: a synchronous method on
 * the service shape would be required in every `Layer.mock` and would silently
 * degrade every partial double to a full implementation. Get one from
 * `InstallationToken.botIdentity` or `AppIdentity.botIdentity`.
 *
 * **Example** (Identify the Actions bot)
 *
 * ```ts
 * import { BotIdentity } from "@beep/github/GitHubApp";
 *
 * console.log(BotIdentity.githubActions.name) // github-actions[bot]
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class BotIdentity extends S.Class<BotIdentity, { readonly brand: unique symbol }>($I`BotIdentity`)(
  {
    /** The git author/committer name, e.g. `"my-app[bot]"`. */
    name: S.String.pipe(
      $I.annoteKey("BotIdentity.name", { description: 'The git author/committer name, e.g. `"my-app[bot]"`.' })
    ),
    /** The no-reply address GitHub attributes to that account. */
    email: CommitEmail.pipe(
      $I.annoteKey("BotIdentity.email", { description: "The no-reply address GitHub attributes to that account." })
    ),
  },
  $I.annote("BotIdentity", { description: "Who a bot commits as." })
) {
  /**
   * The identity for an app, given whatever of its identity is known.
   *
   * **Example** (Build an app bot address)
   *
   * ```ts
   * import { BotIdentity } from "@beep/github/GitHubApp";
   *
   * console.log(BotIdentity.forApp({ appSlug: "my-app", appUserId: 123 }).email) // 123+my-app[bot]@users.noreply.github.com
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static forApp(source: { readonly appSlug: string; readonly appUserId?: number | undefined }): BotIdentity {
    const name = `${source.appSlug}[bot]`;
    return BotIdentity.make({
      name,
      email:
        source.appUserId === undefined
          ? `${name}@users.noreply.github.com`
          : `${source.appUserId}+${name}@users.noreply.github.com`,
    });
  }

  /**
   * The well-known identity of the `github-actions` bot.
   *
   * **Example** (Read the Actions bot email)
   *
   * ```ts
   * import { BotIdentity } from "@beep/github/GitHubApp";
   *
   * console.log(BotIdentity.githubActions.email) // 41898282+github-actions[bot]@users.noreply.github.com
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly githubActions: BotIdentity = BotIdentity.make({
    name: "github-actions[bot]",
    email: "41898282+github-actions[bot]@users.noreply.github.com",
  });

  /**
   * The DCO sign-off trailer for this identity.
   *
   * **Details**
   *
   * `Signed-off-by: name <email>` — DCO 1.1's fixed casing and spacing, with
   * only the email in angle brackets, rendered by the type that owns the
   * data. Commits created
   * through the Git Data API bypass `git commit -s`, so no porcelain adds
   * the trailer, and a hand-built one that is subtly wrong fails late as a
   * red DCO check on someone else's pull request. Whether a missing
   * identity falls back to {@link BotIdentity.githubActions} stays the
   * caller's policy.
   *
   * **Example** (Render a DCO trailer)
   *
   * ```ts
   * import { BotIdentity } from "@beep/github/GitHubApp";
   *
   * console.log(BotIdentity.forApp({ appSlug: "my-app" }).signoff) // Signed-off-by: my-app[bot] <my-app[bot]@users.noreply.github.com>
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  get signoff(): string {
    return `Signed-off-by: ${this.name} <${this.email}>`;
  }
}

/**
 * What GitHub knows about the app itself.
 *
 * **Example** (Construct app identity metadata)
 *
 * ```ts
 * import { AppIdentity } from "@beep/github/GitHubApp";
 *
 * const app = AppIdentity.make({ slug: "my-app", name: "My App" });
 * console.log(app.slug) // my-app
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class AppIdentity extends S.Class<AppIdentity, { readonly brand: unique symbol }>($I`AppIdentity`)(
  {
    /** The URL slug, e.g. `"my-app"`. */
    slug: S.String.pipe($I.annoteKey("AppIdentity.slug", { description: 'The URL slug, e.g. `"my-app"`.' })),
    /** The display name. */
    name: S.String.pipe($I.annoteKey("AppIdentity.name", { description: "The display name." })),
    /** The bot user's numeric id, when it could be resolved. */
    userId: S.optionalKey(S.Int).pipe(
      $I.annoteKey("AppIdentity.userId", { description: "The bot user's numeric id, when it could be resolved." })
    ),
  },
  $I.annote("AppIdentity", { description: "What GitHub knows about the app itself." })
) {
  /**
   * The committer identity for this app.
   *
   * **Example** (Derive the app committer name)
   *
   * ```ts
   * import { AppIdentity } from "@beep/github/GitHubApp";
   *
   * const app = AppIdentity.make({ slug: "my-app", name: "My App" });
   * console.log(app.botIdentity().name) // my-app[bot]
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  botIdentity(): BotIdentity {
    return BotIdentity.forApp({
      appSlug: this.slug,
      ...O.getSomesStruct({ appUserId: O.fromUndefinedOr(this.userId) }),
    });
  }
}

/**
 * One installation of the app.
 *
 * **Example** (Identify an installation)
 *
 * ```ts
 * import { Installation } from "@beep/github/GitHubApp";
 *
 * console.log(Installation.make({ id: 42, account: "my-org" }).account) // my-org
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class Installation extends S.Opaque<Installation, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The installation id, which is what a token is minted against. */
    id: S.Int.pipe(
      $I.annoteKey("Installation.id", { description: "The installation id, which is what a token is minted against." })
    ),
    /** The account the app is installed on, when GitHub reported one. */
    account: S.optionalKey(S.String).pipe(
      $I.annoteKey("Installation.account", {
        description: "The account the app is installed on, when GitHub reported one.",
      })
    ),
  }).pipe($I.annoteSchema("Installation", { description: "One installation of the app." }))
) {}

/**
 * Transport settings for the app's own API calls.
 *
 * **Details**
 *
 * Service options rather than wire data: `fetch` is a function and `retry` a
 * constructed policy, so every field's encoded side equals its decoded side
 * and the layers take {@link GitHubAppOptions.Encoded}.
 *
 * **Example** (Disable retries for app calls)
 *
 * ```ts
 * import { GitHubAppOptions } from "@beep/github/GitHubApp";
 *
 * console.log(GitHubAppOptions.make({ retry: "off" }).retry) // off
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitHubAppOptions extends S.Opaque<GitHubAppOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** A GitHub Enterprise API root. */
    baseUrl: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitHubAppOptions.baseUrl", { description: "A GitHub Enterprise API root." })
    ),
    /** A replacement `fetch`, for tests and proxies. */
    fetch: S.optionalKey(FetchFunction).pipe(
      $I.annoteKey("GitHubAppOptions.fetch", { description: "A replacement `fetch`, for tests and proxies." })
    ),
    /** Retry behavior for the app's own calls. */
    retry: S.optionalKey(S.Union([RetryPolicySchema, S.Literal("off")])).pipe(
      $I.annoteKey("GitHubAppOptions.retry", { description: "Retry behavior for the app's own calls." })
    ),
    /** Appended to octokit's user agent. */
    userAgent: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitHubAppOptions.userAgent", { description: "Appended to octokit's user agent." })
    ),
  }).pipe($I.annoteSchema("GitHubAppOptions", { description: "Transport settings for the app's own API calls." }))
) {}

/**
 * Companion types for {@link GitHubAppOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GitHubAppOptions {
  /**
   * The plain, unbranded settings the app layers accept.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GitHubAppOptions.Encoded;
}

/**
 * Build the app service shape; `observe` sees every minted credential.
 *
 * **Details**
 *
 * Declared above {@link GitHubApp} because the class's `layer` static calls it
 * while the class is being defined.
 */
const makeApp: {
  (
    options: GitHubAppOptions.Encoded,
    observe?: (credential: Redacted.Redacted<string>) => Effect.Effect<void>
  ): Effect.Effect<GitHubAppShape>;
  (
    observe?: (credential: Redacted.Redacted<string>) => Effect.Effect<void>
  ): (options: GitHubAppOptions.Encoded) => Effect.Effect<GitHubAppShape>;
} = dual(
  (args) => P.isObjectKeyword(args[0]) && !P.isFunction(args[0]),
  (
    options: GitHubAppOptions.Encoded,
    observe: (credential: Redacted.Redacted<string>) => Effect.Effect<void> = () => Effect.void
  ): Effect.Effect<GitHubAppShape> =>
    Effect.sync(() => {
      const installations = Effect.fn("GitHubApp.installations")(function* (credentials: AppCredentials.Encoded) {
        const client = yield* asApp(credentials, options);
        const raw = yield* client.paginate("GET /app/installations", {}).pipe(Effect.catch(appFailure("installation")));
        return yield* Effect.forEach(
          raw,
          Effect.fnUntraced(
            function* (entry) {
              const wire = yield* S.decodeEffect(InstallationResponse)(entry);
              return yield* S.decodeEffect(Installation)({
                id: numericId(wire.id),
                ...O.getSomesStruct({ account: O.fromNullishOr(wire.account?.login) }),
              });
            },
            Effect.mapError(decodeFailure("installation"))
          )
        );
      });

      const resolveInstallationId = (request: TokenRequest.Encoded): Effect.Effect<number, GitHubAppError> =>
        request.installationId !== undefined
          ? Effect.succeed(request.installationId)
          : Effect.gen(function* () {
              const all = yield* installations(request);
              if (request.owner !== undefined) {
                const wanted = Str.toLowerCase(request.owner);
                const match = A.findFirst(
                  all,
                  (entry) => entry.account !== undefined && Str.toLowerCase(entry.account) === wanted
                );
                if (O.isSome(match)) return match.value.id;
                return yield* GitHubAppError.of(
                  "installation",
                  `the app is not installed on ${request.owner} (installed on: ${
                    pipe(
                      all,
                      A.map((entry) => entry.account ?? String(entry.id)),
                      A.join(", ")
                    ) || "nothing"
                  })`
                );
              }
              const only = all[0];
              if (all.length === 1 && only !== undefined) return only.id;
              return yield* GitHubAppError.of(
                "installation",
                all.length === 0
                  ? "the app has no installations"
                  : `the app has ${all.length} installations; pass installationId or owner`
              );
            });

      const token = Effect.fn("GitHubApp.token")((request: TokenRequest.Encoded) =>
        Effect.uninterruptibleMask(
          Effect.fnUntraced(function* (restore) {
            const installationId = yield* restore(resolveInstallationId(request));
            const client = yield* restore(asApp(request, options));
            const minted = yield* restore(
              client
                .request("POST /app/installations/{installation_id}/access_tokens", { installation_id: installationId })
                .pipe(Effect.catch(appFailure("token")))
            );
            // Only the HTTP wait is restored above. Own a received string credential
            // while masked, even if its other fields fail decoding or decoding yields.
            const observed = S.decodeOption(ObservedCredential)(minted);
            if (O.isSome(observed)) yield* observe(Redacted.make(observed.value.token));
            return yield* restore(
              Effect.gen(function* () {
                const wire = yield* S.decodeEffect(TokenResponse)(minted);
                return yield* S.decodeEffect(InstallationToken)({
                  token: wire.token,
                  expiresAt: wire.expires_at,
                  installationId,
                  permissions: normalizePermissions(wire.permissions),
                });
              }).pipe(Effect.mapError(decodeFailure("token")))
            );
          })
        )
      );

      const revoke = Effect.fn("GitHubApp.revoke")(function* (value: Redacted.Redacted<string>) {
        const client = yield* asBearer(value, options);
        yield* client.request("DELETE /installation/token", {}).pipe(Effect.catch(appFailure("revoke")));
      });

      const scopedToken = (
        request: TokenRequest.Encoded
      ): Effect.Effect<InstallationToken, GitHubAppError, Scope.Scope> =>
        Effect.acquireRelease(token(request), (minted) => minted.token.pipe(revoke, Effect.ignore));

      const identity = Effect.fn("GitHubApp.identity")(function* (
        request: AppCredentials.Encoded & { readonly installationToken?: Redacted.Redacted<string> | undefined }
      ) {
        const appClient = yield* asApp(request, options);
        const app = yield* appClient.request("GET /app", {}).pipe(Effect.catch(appFailure("identity")));
        if (app === null) {
          return yield* GitHubAppError.of("identity", "GET /app returned no app");
        }
        const wire = yield* S.decodeEffect(IdentityResponse)(app).pipe(Effect.mapError(decodeFailure("identity")));
        const slug = wire.slug ?? "";
        const name = wire.name;
        // `GET /users/{slug}[bot]` rejects an app JWT, so this bears the
        // installation token when one was supplied and otherwise runs
        // unauthenticated — 60 requests per hour per IP.
        const userClient = yield* asBearer(request.installationToken, options);
        const user = yield* userClient
          .request("GET /users/{username}", { username: `${slug}[bot]` })
          .pipe(Effect.option);
        const bot = O.isSome(user)
          ? O.some(yield* S.decodeEffect(BotResponse)(user.value).pipe(Effect.mapError(decodeFailure("identity"))))
          : O.none();
        return yield* S.decodeEffect(AppIdentity)({
          slug,
          name,
          ...O.getSomesStruct({ userId: O.map(bot, (value) => numericId(value.id)) }),
        }).pipe(Effect.mapError(decodeFailure("identity")));
      });

      return { token, scopedToken, revoke, identity, installations };
    })
);

/**
 * GitHub App authentication: mint, revoke and identify.
 *
 * **Details**
 *
 * **This is the only module in the package that imports a JWT signer**, which is
 * what makes the tree-shaking invariant structural rather than aspirational: a
 * consumer that authenticates with a token it already holds imports
 * `GitHubClient` and never reaches this module or its dependency.
 *
 * That constraint is also why the App-authenticated **client** layer lives here
 * as {@link GitHubApp.clientLayer} rather than as a third static on
 * `GitHubClient`: statics on one class share one module, and putting it there
 * would make every token-only consumer link the signer.
 *
 * The JWT signer is `universal-github-app-jwt` — zero dependencies, and
 * `@octokit/auth-app`'s own JWT dependency.
 *
 * **Example** (Count repositories accessible to an app installation)
 *
 * ```ts
 * import { GitHubApp } from "@beep/github/GitHubApp";
 * import { GitHubClient } from "@beep/github/GitHubClient";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* GitHubClient;
 *   const accessible = yield* client.request("GET /installation/repositories", { per_page: 1 });
 *   return accessible.total_count;
 * });
 *
 * // The app's PEM private key; load the real value from your secret store.
 * const appPrivateKeyPem = "<PEM private key from your secret store>"
 *
 * // Mints an installation token on build, re-mints before expiry, revokes on release.
 * const layer = GitHubApp.clientLayer({
 *   appId: "12345",
 *   privateKey: Redacted.make(appPrivateKeyPem),
 *   owner: "my-org",
 * });
 *
 * console.log(Effect.isEffect(Effect.provide(program, layer))) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class GitHubApp extends Context.Service<GitHubApp, GitHubAppShape>()($I`GitHubApp`) {
  /**
   * The default transport. Bind it once; layers are memoized by reference.
   *
   * **Example** (Reuse the default app transport)
   *
   * ```ts
   * import { GitHubApp } from "@beep/github/GitHubApp";
   *
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitHubApp.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<GitHubApp> = Layer.effect(this, makeApp({}));

  /**
   * A transport with custom settings.
   *
   * **Gotchas**
   *
   * Parameterized, so **bind the result to a `const`** and reuse it. Calling
   * this at two provide sites builds two instances, because layers are
   * memoized by reference.
   *
   * **Example** (Bind a custom app transport)
   *
   * ```ts
   * import { GitHubApp } from "@beep/github/GitHubApp";
   *
   * import * as Layer from "effect/Layer";
   *
   * const layer = GitHubApp.layerWith({ retry: "off" });
   * console.log(Layer.isLayer(layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerWith = (options: GitHubAppOptions.Encoded): Layer.Layer<GitHubApp> =>
    Layer.effect(GitHubApp, makeApp(options));

  /**
   * A {@link GitHubClient} authenticated as an app installation.
   *
   * **Details**
   *
   * The token's lifetime is the layer's scope: it is minted on build and
   * **revoked on release**, best-effort, so a workflow does not leave live
   * credentials behind. It is also **re-minted automatically** a minute before
   * it expires, so a long-running program does not start answering 401 when
   * the hour ends.
   *
   * Building the layer mints the first token, so a misconfigured app fails
   * construction with `GitHubAppError`. After that, a failure to obtain
   * credentials surfaces to the caller as a
   * `GitHubError { kind: "unauthorized" }` carrying the `GitHubAppError` as its
   * cause: from a request's point of view, "could not authenticate" is an
   * authorization failure, and widening every method's error channel to say so
   * would tax every caller for a case only this layer can produce.
   *
   * **Example** (Construct an installation client layer)
   *
   * ```ts
   * import { GitHubApp } from "@beep/github/GitHubApp";
   *
   * import * as Layer from "effect/Layer";
   * import * as Redacted from "effect/Redacted";
   *
   * const layer = GitHubApp.clientLayer({
   *   appId: "12345", privateKey: Redacted.make("example PEM"), installationId: 42,
   * });
   * console.log(Layer.isLayer(layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly clientLayer: {
    (request: TokenRequest.Encoded, options?: GitHubAppOptions.Encoded): Layer.Layer<GitHubClient, GitHubAppError>;
    (options?: GitHubAppOptions.Encoded): (request: TokenRequest.Encoded) => Layer.Layer<GitHubClient, GitHubAppError>;
  } = dual(
    (args) => P.hasProperty(args[0], "appId"),
    (
      request: TokenRequest.Encoded,
      options: GitHubAppOptions.Encoded = {}
    ): Layer.Layer<GitHubClient, GitHubAppError> => Layer.effect(GitHubClient, makeRotatingClient(request, options))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub installation discovery)
   *
   * ```ts
   * import { GitHubApp } from "@beep/github/GitHubApp";
   *
   * import * as Effect from "effect/Effect";
   * import * as Redacted from "effect/Redacted";
   *
   * const app = GitHubApp.makeTest({ installations: () => Effect.succeed([]) });
   * const program = app.installations({ appId: "12345", privateKey: Redacted.make("test-key") });
   * console.log(Effect.runSync(program).length) // 0
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<GitHubAppShape> = {}): GitHubAppShape => ({
    token: overrides.token ?? (() => unstubbed("token")),
    scopedToken: overrides.scopedToken ?? (() => unstubbed("scopedToken")),
    revoke: overrides.revoke ?? (() => unstubbed("revoke")),
    identity: overrides.identity ?? (() => unstubbed("identity")),
    installations: overrides.installations ?? (() => unstubbed("installations")),
  });

  /**
   * {@link GitHubApp.makeTest} behind a `Layer`.
   *
   * **Example** (Provide an app test double)
   *
   * ```ts
   * import { GitHubApp } from "@beep/github/GitHubApp";
   *
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitHubApp.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<GitHubAppShape> = {}): Layer.Layer<GitHubApp> =>
    Layer.succeed(GitHubApp, GitHubApp.makeTest(overrides));
}

/**
 * The app-authentication surface.
 *
 * **Details**
 *
 * Every member is a function returning an `Effect`, so a partial double stays
 * partial. `installations` takes credentials rather than being an
 * `Effect`-valued property because the credentials are per-call, not per-layer.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface GitHubAppShape {
  /**
   * Resolve the app's slug, name and bot user id.
   *
   * **Gotchas**
   *
   * Supply `installationToken` when you have one: `GET /users/{slug}[bot]`
   * rejects an app JWT, so without it the lookup runs unauthenticated at
   * GitHub's 60-requests-per-hour-per-IP limit.
   */
  readonly identity: (
    request: AppCredentials.Encoded & { readonly installationToken?: Redacted.Redacted<string> | undefined }
  ) => Effect.Effect<AppIdentity, GitHubAppError>;
  /** Every installation of the app. */
  readonly installations: (
    credentials: AppCredentials.Encoded
  ) => Effect.Effect<ReadonlyArray<Installation>, GitHubAppError>;
  /**
   * Revoke a token now.
   */
  readonly revoke: (token: Redacted.Redacted<string>) => Effect.Effect<void, GitHubAppError>;
  /**
   * Mint a token that is revoked, best-effort, when the scope closes.
   *
   * **Details**
   *
   * Mints through `token` and releases through `revoke`.
   */
  readonly scopedToken: (
    request: TokenRequest.Encoded
  ) => Effect.Effect<InstallationToken, GitHubAppError, Scope.Scope>;
  /**
   * Mint an installation token.
   *
   * **Details**
   *
   * `installationId` is used when given; otherwise the installation is
   * discovered from `owner`, or from the app's only installation.
   */
  readonly token: (request: TokenRequest.Encoded) => Effect.Effect<InstallationToken, GitHubAppError>;
}

const unstubbed = unstubbedFor({ service: "GitHubApp" });

/** Mint an app JWT. The only cryptography in this package, and it is a leaf call. */
const mintJwt = (credentials: AppCredentials.Encoded): Effect.Effect<Redacted.Redacted<string>, GitHubAppError> =>
  Effect.tryPromise({
    try: () => githubAppJwt({ id: credentials.appId, privateKey: Redacted.value(credentials.privateKey) }),
    catch: (error) =>
      GitHubAppError.of("jwt", error instanceof Error ? error.message : "could not sign the app JWT", error),
  }).pipe(Effect.map((result) => Redacted.make(result.token)));

/** A client speaking as the app itself. */
const asApp: {
  (
    credentials: AppCredentials.Encoded,
    options: GitHubAppOptions.Encoded
  ): Effect.Effect<GitHubClientShape, GitHubAppError>;
  (
    options: GitHubAppOptions.Encoded
  ): (credentials: AppCredentials.Encoded) => Effect.Effect<GitHubClientShape, GitHubAppError>;
} = dual(
  2,
  (
    credentials: AppCredentials.Encoded,
    options: GitHubAppOptions.Encoded
  ): Effect.Effect<GitHubClientShape, GitHubAppError> =>
    Effect.flatMap(mintJwt(credentials), (jwt) => makeClientShape({ ...options, token: jwt }))
);

/** A client speaking as a holder of `token`, or as nobody when there is none. */
const asBearer: {
  (token: Redacted.Redacted<string> | undefined, options: GitHubAppOptions.Encoded): Effect.Effect<GitHubClientShape>;
  (
    options: GitHubAppOptions.Encoded
  ): (token: Redacted.Redacted<string> | undefined) => Effect.Effect<GitHubClientShape>;
} = dual(
  2,
  (token: Redacted.Redacted<string> | undefined, options: GitHubAppOptions.Encoded): Effect.Effect<GitHubClientShape> =>
    makeClientShape({ ...options, token: token ?? Redacted.make("") })
);

const appFailure = (kind: GitHubAppError["kind"]) => (error: GitHubError) =>
  Effect.fail(GitHubAppError.of(kind, error.reason, error));

// Selected wire fields are decoded before projection; unrelated response fields stay ignored.
const InstallationResponse = S.Struct({
  id: S.Union([S.Finite, S.BigInt]),
  account: S.Struct({ login: S.optionalKey(S.String) }).pipe(S.NullOr, S.optionalKey),
}).pipe($I.annoteSchema("InstallationResponse", { description: "Selected GitHub installation fields." }));
const IdentityResponse = S.Struct({
  slug: S.String.pipe(S.NullOr, S.optionalKey),
  name: S.String,
}).pipe($I.annoteSchema("IdentityResponse", { description: "Selected GitHub App identity fields." }));
const BotResponse = S.Struct({ id: S.Union([S.Finite, S.BigInt]) }).pipe(
  $I.annoteSchema("BotResponse", { description: "The GitHub App bot identifier." })
);
const ObservedCredential = S.Struct({ token: S.String }).pipe(
  $I.annoteSchema("ObservedCredential", { description: "A received credential that can be revoked." })
);
const TokenResponse = S.Struct({
  token: S.String,
  expires_at: S.String,
  permissions: S.optionalKey(S.Unknown),
}).pipe($I.annoteSchema("TokenResponse", { description: "Selected installation-token response fields." }));

const decodeFailure = (kind: GitHubAppError["kind"]) => (error: S.SchemaError) =>
  GitHubAppError.of(kind, `GitHub returned an unexpected ${kind} payload`, error);

/** GitHub's permission values are strings; anything else is not a permission. */
const normalizePermissions = (raw: unknown): Record<string, string> => {
  if (!P.isObjectOrArray(raw)) return {};
  const entries = P.isObject(raw) ? R.toEntries(raw) : R.toEntries<keyof typeof raw & string, unknown>(raw);
  return R.fromEntries(A.filter(entries, (entry): entry is [string, string] => P.isString(entry[1])));
};

/**
 * A client shape that re-mints its installation token before it expires.
 *
 * **Details**
 *
 * The rotation is invisible to a caller: each member resolves the current
 * client first, and "current" means "minted, and not within a minute of
 * expiry". Rotating revokes the token it replaces, so at most one live token
 * exists at a time and the scope's release revokes the last of them.
 */
const makeRotatingClient: {
  (
    request: TokenRequest.Encoded,
    options: GitHubAppOptions.Encoded
  ): Effect.Effect<GitHubClientShape, GitHubAppError, Scope.Scope>;
  (
    options: GitHubAppOptions.Encoded
  ): (request: TokenRequest.Encoded) => Effect.Effect<GitHubClientShape, GitHubAppError, Scope.Scope>;
} = dual(
  2,
  Effect.fn("GitHubApp.makeRotatingClient")(function* (
    request: TokenRequest.Encoded,
    options: GitHubAppOptions.Encoded
  ): Effect.fn.Return<GitHubClientShape, GitHubAppError, Scope.Scope> {
    const held = yield* Ref.make(O.none<{ token: InstallationToken; client: GitHubClientShape }>());
    const owned = yield* Ref.make(O.none<Redacted.Redacted<string>>());
    const app = yield* makeApp(options, (credential) => Ref.set(owned, O.some(credential)));
    const inFlight = yield* Ref.make(O.none<Fiber.Fiber<GitHubClientShape, GitHubAppError>>());
    const closed = yield* Ref.make(false);
    const rotation = yield* Semaphore.make(1);

    const revokeHeld = Effect.flatMap(Ref.get(owned), (current) =>
      O.isSome(current) ? Effect.ignore(app.revoke(current.value)) : Effect.void
    );

    const rotate = Effect.uninterruptibleMask(
      Effect.fnUntraced(function* (restore) {
        yield* restore(revokeHeld);
        yield* Ref.set(owned, O.none());
        const minted = yield* restore(app.token(request));
        // The mint observer already owns the raw credential before decoding.
        // Ownership stays masked across this handoff to client construction.
        const client = yield* restore(makeClientShape({ ...options, token: minted.token }));
        yield* Ref.set(held, O.some({ token: minted, client }));
        return client;
      })
    );

    /** The live client, re-minting first if the held token is spent. */
    const refresh = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const state = yield* Ref.get(held);
      if (O.isSome(state) && !state.value.token.isExpired(now)) return state.value.client;
      return yield* rotate;
    });
    const fresh = Effect.uninterruptibleMask(
      Effect.fnUntraced(function* (restore) {
        if (yield* Ref.get(closed)) return yield* Effect.interrupt;
        const fiber = yield* Effect.forkChild(refresh, { uninterruptible: false });
        yield* Ref.set(inFlight, O.some(fiber));
        return yield* restore(Fiber.join(fiber)).pipe(
          Effect.ensuring(Fiber.interrupt(fiber)),
          Effect.ensuring(Ref.set(inFlight, O.none()))
        );
      })
    ).pipe(rotation.withPermits(1));

    // Closing never waits for the rotation permit: prevent new work, stop and
    // join the active child, then revoke the credential it last transferred.
    yield* Effect.addFinalizer(
      Effect.fnUntraced(function* () {
        yield* Ref.set(closed, true);
        const active = yield* Ref.get(inFlight);
        if (O.isSome(active)) yield* Fiber.interrupt(active.value);
        yield* revokeHeld;
        yield* Ref.set(owned, O.none());
      })
    );

    // Mint eagerly so bad credentials fail layer construction in the App channel.
    yield* fresh;

    // A credential failure is reported in the channel the caller is already
    // handling: "could not authenticate" IS an authorization failure from a
    // request's point of view, and widening every method's error type to add a
    // GitHubAppError would tax every caller for a case only this layer can
    // produce.
    const current: Effect.Effect<GitHubClientShape, GitHubError> = fresh.pipe(
      Effect.catchTag("GitHubAppError", (error) =>
        Effect.fail(
          GitHubError.make({
            kind: "unauthorized",
            operation: "GitHubApp.clientLayer",
            reason: error.reason,
            cause: error,
          })
        )
      )
    );

    const currentForGraphQL: Effect.Effect<GitHubClientShape, GitHubGraphQLError> = fresh.pipe(
      Effect.catchTag("GitHubAppError", (error) =>
        Effect.fail(
          GitHubGraphQLError.make({
            kind: "unauthorized",
            operation: "GitHubApp.clientLayer",
            reason: error.reason,
            errors: [],
            cause: error,
          })
        )
      )
    );

    return {
      request: dual(
        2,
        <R extends Rest.Route>(route: R, params: Rest.Params<R>): Effect.Effect<Rest.Data<R>, GitHubError> =>
          Effect.flatMap(current, (client) => client.request(route, params))
      ),
      requestDecoded: dual(
        3,
        <A, I>(
          route: string,
          params: Record<string, unknown> & Rest.RequestExtras.Encoded,
          schema: S.Codec<A, I>
        ): Effect.Effect<A, GitHubError> =>
          Effect.flatMap(current, (client) => client.requestDecoded(route, params, schema))
      ),
      paginate: dual(
        (args) => P.isString(args[0]),
        <R extends Rest.PaginatingRoute>(
          route: R,
          params: Rest.Params<R>,
          pageOptions?: PageOptions
        ): Effect.Effect<ReadonlyArray<Rest.Item<R>>, GitHubError> =>
          Effect.flatMap(current, (client) => client.paginate(route, params, pageOptions))
      ),
      paginateStream: dual(
        (args) => P.isString(args[0]),
        <R extends Rest.PaginatingRoute>(
          route: R,
          params: Rest.Params<R>,
          pageOptions?: PageOptions
        ): Stream.Stream<Rest.Item<R>, GitHubError> =>
          Stream.unwrap(Effect.map(current, (client) => client.paginateStream(route, params, pageOptions)))
      ),
      graphql: dual(
        2,
        <A, V extends Record<string, unknown>>(
          document: GraphQLDocument<A, V>,
          variables: V
        ): Effect.Effect<A, GitHubGraphQLError> =>
          Effect.flatMap(currentForGraphQL, (client) => client.graphql(document, variables))
      ),
      rateLimit: Effect.flatMap(Ref.get(held), (state) => O.getOrThrow(state).client.rateLimit),
    } satisfies GitHubClientShape;
  })
);
