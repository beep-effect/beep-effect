import { $ScratchpadId } from "@beep/identity/packages";
import type * as Scope from "effect/Scope";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import githubAppJwt from "universal-github-app-jwt";
import type { GitHubClientShape } from "./GitHubClient.ts";
import { GitHubClient, makeClientShape } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { GitHubGraphQLError } from "./GraphQL.ts";
import { numericId } from "./internal/ids.ts";
import type { RetryPolicy } from "./Resilience.ts";

const $I = $ScratchpadId.create("effected/github/GitHubApp");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

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
 * import { GitHubAppError } from "@beep/scratchpad/effected/github/GitHubApp";
 *
 * const error = GitHubAppError.make({ kind: "jwt", reason: "invalid key" });
 * console.log(error.message) // GitHub App jwt failed: invalid key
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitHubAppError extends S.TaggedError<GitHubAppError>($I`GitHubAppError`)("GitHubAppError", {
	/** Which step failed. */
	kind: S.Literals(["jwt", "token", "revoke", "identity", "installation"]).annotateKey({ description: "Which step failed." }),
	/** Human-readable cause. */
	reason: S.String.annotateKey({ description: "Human-readable cause." }),
	/** The underlying failure, when there is one. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, when there is one." }),
}, $I.annote("GitHubAppError", { description: "A GitHub App call failed." })) {
	/**
	 * Formats the failed authentication step and its human-readable cause.
	 *
	 * **Example** (Read the formatted app failure)
	 *
	 * ```ts
	 * import { GitHubAppError } from "@beep/scratchpad/effected/github/GitHubApp";
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
	 * import { GitHubAppError } from "@beep/scratchpad/effected/github/GitHubApp";
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

/**
 * The credentials that identify a GitHub App.
 *
 * **Details**
 *
 * `appId` accepts either the numeric app id or the newer client id — GitHub
 * accepts both as the JWT issuer, and this package does not care which you use.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface AppCredentials {
	/** The app id or client id. */
	readonly appId: string;
	/**
  * The app's private key, in PEM.
  *
  * **Gotchas**
  *
  * PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`, which is what github.com hands
  * you) is converted to PKCS#8 automatically **on Node**. On a runtime without
  * `node:crypto` a PKCS#1 key fails with an explicit `kind: "jwt"` error, and
  * the fix is to convert the key once with
  * `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt`. This constraint is
  * inherited from the JWT signer and is identical to `@octokit/auth-app`'s.
  */
	readonly privateKey: Redacted.Redacted<string>;
}

/**
 * What to mint an installation token for.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface TokenRequest extends AppCredentials {
	/** The installation. Discovered from `owner` when omitted. */
	readonly installationId?: number | undefined;
	/**
  * The account whose installation to use, when `installationId` is omitted.
  *
  * **Details**
  *
  * Discovery costs a JWT mint plus a paginated walk of `GET /app/installations`,
  * so supplying `installationId` is strictly cheaper. When both are omitted and
  * the app has exactly one installation, that one is used; with several, the
  * failure names them.
  */
	readonly owner?: string | undefined;
}

/**
 * An installation access token and what GitHub said about it.
 *
 * **Details**
 *
 * Encodable on purpose. `@effected/github-actions` persists one across the
 * `pre`/`main`/`post` process boundary through `GITHUB_STATE`, and
 * `Schema.encodeUnknownEffect` produces JSON with the token as a plain string
 * and `expiresAt` as an ISO instant. A `Redacted` cannot survive serialization
 * by design, so masking the encoded value is the caller's job — Actions calls
 * `::add-mask::`.
 *
 * **Example** (Decode installation metadata)
 *
 * ```ts
 * import { InstallationToken } from "@beep/scratchpad/effected/github/GitHubApp";
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
export class InstallationToken extends S.Class<InstallationToken>($I`InstallationToken`)({
	/** The token. Decodes to `Redacted`, encodes back to the raw string. */
	token: S.RedactedFromValue(S.String).annotateKey({ description: "The token. Decodes to `Redacted`, encodes back to the raw string." }),
	/** When GitHub will stop accepting it — about an hour out. */
	expiresAt: S.DateTimeUtcFromString.annotateKey({ description: "When GitHub will stop accepting it — about an hour out." }),
	/** The installation it is scoped to. */
	installationId: S.Int.annotateKey({ description: "The installation it is scoped to." }),
	/** The permissions GitHub actually granted, which may be narrower than requested. */
	permissions: S.Record(S.String, S.String).annotateKey({ description: "The permissions GitHub actually granted, which may be narrower than requested." }),
	/** The app's slug, when identity was resolved. */
	appSlug: S.optionalKey(S.String).annotateKey({ description: "The app's slug, when identity was resolved." }),
	/** The app's bot user id, when identity was resolved. */
	appUserId: S.optionalKey(S.Int).annotateKey({ description: "The app's bot user id, when identity was resolved." }),
	/** The app's display name, when identity was resolved. */
	appName: S.optionalKey(S.String).annotateKey({ description: "The app's display name, when identity was resolved." }),
}, $I.annote("InstallationToken", { description: "An installation access token and what GitHub said about it." })) {
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
	 * import { InstallationToken } from "@beep/scratchpad/effected/github/GitHubApp";
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
	 * import { InstallationToken } from "@beep/scratchpad/effected/github/GitHubApp";
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
 * import { BotIdentity } from "@beep/scratchpad/effected/github/GitHubApp";
 *
 * console.log(BotIdentity.githubActions.name) // github-actions[bot]
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class BotIdentity extends S.Class<BotIdentity>($I`BotIdentity`)({
	/** The git author/committer name, e.g. `"my-app[bot]"`. */
	name: S.String.annotateKey({ description: "The git author/committer name, e.g. `\"my-app[bot]\"`." }),
	/** The no-reply address GitHub attributes to that account. */
	email: S.String.annotateKey({ description: "The no-reply address GitHub attributes to that account." }),
}, $I.annote("BotIdentity", { description: "Who a bot commits as." })) {
	/**
	 * The identity for an app, given whatever of its identity is known.
	 *
	 * **Example** (Build an app bot address)
	 *
	 * ```ts
	 * import { BotIdentity } from "@beep/scratchpad/effected/github/GitHubApp";
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
	 * import { BotIdentity } from "@beep/scratchpad/effected/github/GitHubApp";
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
	 * import { BotIdentity } from "@beep/scratchpad/effected/github/GitHubApp";
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
 * import { AppIdentity } from "@beep/scratchpad/effected/github/GitHubApp";
 *
 * const app = AppIdentity.make({ slug: "my-app", name: "My App" });
 * console.log(app.slug) // my-app
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class AppIdentity extends S.Class<AppIdentity>($I`AppIdentity`)({
	/** The URL slug, e.g. `"my-app"`. */
	slug: S.String.annotateKey({ description: "The URL slug, e.g. `\"my-app\"`." }),
	/** The display name. */
	name: S.String.annotateKey({ description: "The display name." }),
	/** The bot user's numeric id, when it could be resolved. */
	userId: S.optionalKey(S.Int).annotateKey({ description: "The bot user's numeric id, when it could be resolved." }),
}, $I.annote("AppIdentity", { description: "What GitHub knows about the app itself." })) {
	/**
	 * The committer identity for this app.
	 *
	 * **Example** (Derive the app committer name)
	 *
	 * ```ts
	 * import { AppIdentity } from "@beep/scratchpad/effected/github/GitHubApp";
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
 * import { Installation } from "@beep/scratchpad/effected/github/GitHubApp";
 *
 * console.log(Installation.make({ id: 42, account: "my-org" }).account) // my-org
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class Installation extends S.Class<Installation>($I`Installation`)({
	/** The installation id, which is what a token is minted against. */
	id: S.Int.annotateKey({ description: "The installation id, which is what a token is minted against." }),
	/** The account the app is installed on, when GitHub reported one. */
	account: S.optionalKey(S.String).annotateKey({ description: "The account the app is installed on, when GitHub reported one." }),
}, $I.annote("Installation", { description: "One installation of the app." })) {}

/**
 * Transport settings for the app's own API calls.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface GitHubAppOptions {
	/** A GitHub Enterprise API root. */
	readonly baseUrl?: string | undefined;
	/** Appended to octokit's user agent. */
	readonly userAgent?: string | undefined;
	/** Retry behavior for the app's own calls. */
	readonly retry?: RetryPolicy | "off" | undefined;
	/** A replacement `fetch`, for tests and proxies. */
	readonly fetch?: typeof globalThis.fetch | undefined;
}

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
 * would make every token-only consumer link the signer. The kit has this shape
 * already — `@effected/workspaces` ships `localExecLayer`, which builds
 * `@effected/commands`' service, for the same reason.
 *
 * The JWT signer is `universal-github-app-jwt` — zero dependencies, and
 * `@octokit/auth-app`'s own JWT dependency.
 *
 * **Example** (Count repositories accessible to an app installation)
 *
 * ```ts
 * import { GitHubApp } from "@beep/scratchpad/effected/github/GitHubApp";
 * import { GitHubClient } from "@beep/scratchpad/effected/github/GitHubClient";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* GitHubClient;
 *   const accessible = yield* client.request("GET /installation/repositories", { per_page: 1 });
 *   return accessible.total_count;
 * });
 *
 * // Mints an installation token on build, re-mints before expiry, revokes on release.
 * const layer = GitHubApp.clientLayer({
 *   appId: "12345",
 *   privateKey: Redacted.make("-----BEGIN PRIVATE KEY-----\n..."),
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
	 * import { GitHubApp } from "@beep/scratchpad/effected/github/GitHubApp";
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
	 * import { GitHubApp } from "@beep/scratchpad/effected/github/GitHubApp";
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
	static readonly layerWith = (options: GitHubAppOptions): Layer.Layer<GitHubApp> =>
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
	 * import { GitHubApp } from "@beep/scratchpad/effected/github/GitHubApp";
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
	static readonly clientLayer = (
		request: TokenRequest,
		options: GitHubAppOptions = {},
	): Layer.Layer<GitHubClient, GitHubAppError> =>
		Layer.effect(
			GitHubClient,
			Effect.flatMap(GitHubApp, (app) => makeRotatingClient(app, request, options)),
		).pipe(Layer.provide(GitHubApp.layerWith(options)));

	/**
	 * An in-memory double; unstubbed members die naming themselves.
	 *
	 * **Example** (Stub installation discovery)
	 *
	 * ```ts
	 * import { GitHubApp } from "@beep/scratchpad/effected/github/GitHubApp";
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
	 * import { GitHubApp } from "@beep/scratchpad/effected/github/GitHubApp";
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
  * Mint an installation token.
  *
  * **Details**
  *
  * `installationId` is used when given; otherwise the installation is
  * discovered from `owner`, or from the app's only installation.
  */
	readonly token: (request: TokenRequest) => Effect.Effect<InstallationToken, GitHubAppError>;
	/**
  * Mint a token that is revoked, best-effort, when the scope closes.
  *
  * **Details**
  *
  * Mints through `token` and releases through `revoke`.
  */
	readonly scopedToken: (request: TokenRequest) => Effect.Effect<InstallationToken, GitHubAppError, Scope.Scope>;
	/**
	 * Revoke a token now.
	 */
	readonly revoke: (token: Redacted.Redacted<string>) => Effect.Effect<void, GitHubAppError>;
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
		request: AppCredentials & { readonly installationToken?: Redacted.Redacted<string> | undefined },
	) => Effect.Effect<AppIdentity, GitHubAppError>;
	/** Every installation of the app. */
	readonly installations: (credentials: AppCredentials) => Effect.Effect<ReadonlyArray<Installation>, GitHubAppError>;
}

const unstubbed = (member: string): never => {
	throw UnstubbedError.make({ message: `GitHubApp.makeTest: ${member}() was called but not stubbed — pass an override.` });
};

/** Mint an app JWT. The only cryptography in this package, and it is a leaf call. */
const mintJwt = (credentials: AppCredentials): Effect.Effect<Redacted.Redacted<string>, GitHubAppError> =>
	Effect.tryPromise({
		try: () => githubAppJwt({ id: credentials.appId, privateKey: Redacted.value(credentials.privateKey) }),
		catch: (error) =>
			GitHubAppError.of("jwt", error instanceof Error ? error.message : "could not sign the app JWT", error),
	}).pipe(Effect.map((result) => Redacted.make(result.token)));

/** A client speaking as the app itself. */
const asApp = (
	credentials: AppCredentials,
	options: GitHubAppOptions,
): Effect.Effect<GitHubClientShape, GitHubAppError> =>
	Effect.flatMap(mintJwt(credentials), (jwt) => makeClientShape({ ...options, token: jwt }));

/** A client speaking as a holder of `token`, or as nobody when there is none. */
const asBearer = (
	token: Redacted.Redacted<string> | undefined,
	options: GitHubAppOptions,
): Effect.Effect<GitHubClientShape> => makeClientShape({ ...options, token: token ?? Redacted.make("") });

const appFailure = (kind: GitHubAppError["kind"]) => (error: GitHubError) =>
	Effect.fail(GitHubAppError.of(kind, error.reason, error));

function makeApp(options: GitHubAppOptions): Effect.Effect<GitHubAppShape> {
	return Effect.sync(() => {
		const installations = Effect.fn("GitHubApp.installations")(function* (credentials: AppCredentials) {
			const client = yield* asApp(credentials, options);
			const raw = yield* client.paginate("GET /app/installations", {}).pipe(Effect.catch(appFailure("installation")));
			return raw.map((entry) =>
				Installation.make({
					id: numericId(entry.id),
					...(entry.account !== null && entry.account !== undefined && "login" in entry.account
						? { account: entry.account.login }
						: {}),
				}),
			);
		});

		const resolveInstallationId = (request: TokenRequest): Effect.Effect<number, GitHubAppError> =>
			request.installationId !== undefined
				? Effect.succeed(request.installationId)
				: Effect.gen(function* () {
						const all = yield* installations(request);
						if (request.owner !== undefined) {
							const wanted = request.owner.toLowerCase();
							const match = all.find((entry) => entry.account?.toLowerCase() === wanted);
							if (match !== undefined) return match.id;
							return yield*
								GitHubAppError.of(
									"installation",
									`the app is not installed on ${request.owner} (installed on: ${all.map((entry) => entry.account ?? entry.id).join(", ") || "nothing"})`,
								);
						}
						const only = all[0];
						if (all.length === 1 && only !== undefined) return only.id;
						return yield*
							GitHubAppError.of(
								"installation",
								all.length === 0
									? "the app has no installations"
									: `the app has ${all.length} installations; pass installationId or owner`,
							);
					});

		const token = Effect.fn("GitHubApp.token")(function* (request: TokenRequest) {
			const installationId = yield* resolveInstallationId(request);
			const client = yield* asApp(request, options);
			const minted = yield* client
				.request("POST /app/installations/{installation_id}/access_tokens", { installation_id: installationId })
				.pipe(Effect.catch(appFailure("token")));
			return yield* S.decodeEffect(InstallationToken)({
				token: minted.token,
				expiresAt: minted.expires_at,
				installationId,
				permissions: normalizePermissions(minted.permissions),
			}).pipe(
				Effect.catchTag("SchemaError", (error) =>
					Effect.fail(GitHubAppError.of("token", "GitHub returned an unexpected token payload", error)),
				),
			);
		});

		const revoke = Effect.fn("GitHubApp.revoke")(function* (value: Redacted.Redacted<string>) {
			const client = yield* asBearer(value, options);
			yield* client.request("DELETE /installation/token", {}).pipe(Effect.catch(appFailure("revoke")));
		});

		const scopedToken = (request: TokenRequest): Effect.Effect<InstallationToken, GitHubAppError, Scope.Scope> =>
			Effect.acquireRelease(token(request), (minted) => minted.token.pipe(revoke, Effect.ignore));

		const identity = Effect.fn("GitHubApp.identity")(function* (
			request: AppCredentials & { readonly installationToken?: Redacted.Redacted<string> | undefined },
		) {
			const appClient = yield* asApp(request, options);
			const app = yield* appClient.request("GET /app", {}).pipe(Effect.catch(appFailure("identity")));
			if (app === null) {
				return yield*GitHubAppError.of("identity", "GET /app returned no app");
			}
			const slug = app.slug ?? "";
			const name = app.name;
			// `GET /users/{slug}[bot]` rejects an app JWT, so this bears the
			// installation token when one was supplied and otherwise runs
			// unauthenticated — 60 requests per hour per IP.
			const userClient = yield* asBearer(request.installationToken, options);
			const user = yield* userClient.request("GET /users/{username}", { username: `${slug}[bot]` }).pipe(Effect.option);
			return AppIdentity.make({
				slug,
				name,
				...(O.isSome(user) ? { userId: numericId(user.value.id) } : {}),
			});
		});

		return { token, scopedToken, revoke, identity, installations };
	});
}

/** GitHub's permission values are strings; anything else is not a permission. */
const normalizePermissions = (raw: unknown): Record<string, string> => {
	if (!P.isObjectOrArray(raw)) return {};
	const out: Record<string, string> = {};
	const entries = P.isObject(raw) ? R.toEntries(raw) : R.toEntries<keyof typeof raw & string, unknown>(raw);
	for (const [key, value] of entries) {
		if (P.isString(value)) out[key] = value;
	}
	return out;
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
const makeRotatingClient = Effect.fn("makeRotatingClient")(function* (
	app: GitHubAppShape,
	request: TokenRequest,
	options: GitHubAppOptions,
): Effect.fn.Return<GitHubClientShape, GitHubAppError, Scope.Scope> {
	const held = yield* Ref.make(O.none<{ token: InstallationToken; client: GitHubClientShape }>());
	const rotation = yield* Semaphore.make(1);

	const revokeHeld = Effect.flatMap(Ref.get(held), (current) =>
		O.isSome(current) ? Effect.ignore(app.revoke(current.value.token.token)) : Effect.void,
	);

	const rotate = Effect.gen(function* () {
		yield* revokeHeld;
		const minted = yield* app.token(request);
		const client = yield* makeClientShape({ ...options, token: minted.token });
		yield* Ref.set(held, O.some({ token: minted, client }));
		return client;
	}).pipe(Effect.uninterruptible);

	// Mint eagerly so a misconfigured app fails at layer construction, where
	// the error is a `GitHubAppError` a caller can read, rather than on the
	// first request as an opaque authorization failure.
	yield* Effect.acquireRelease(rotate, () => revokeHeld.pipe(rotation.withPermits(1)));

	/** The live client, re-minting first if the held token is spent. */
	const fresh: Effect.Effect<GitHubClientShape, GitHubAppError> = Effect.gen(function* () {
		const now = yield* Clock.currentTimeMillis;
		const state = yield* Ref.get(held);
		if (O.isSome(state) && !state.value.token.isExpired(now)) return state.value.client;
		return yield* rotate;
	}).pipe(rotation.withPermits(1));

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
}),
			),
		),
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
}),
			),
		),
	);

	return {
		request: (route, params) => Effect.flatMap(current, (client) => client.request(route, params)),
		requestDecoded: (route, params, schema) =>
			Effect.flatMap(current, (client) => client.requestDecoded(route, params, schema)),
		paginate: (route, params, pageOptions) =>
			Effect.flatMap(current, (client) => client.paginate(route, params, pageOptions)),
		paginateStream: (route, params, pageOptions) =>
			Stream.unwrap(Effect.map(current, (client) => client.paginateStream(route, params, pageOptions))),
		graphql: (document, variables) =>
			Effect.flatMap(currentForGraphQL, (client) => client.graphql(document, variables)),
		rateLimit: Effect.flatMap(Ref.get(held), (state) =>
			O.isSome(state) ? state.value.client.rateLimit : Effect.succeedNone,
		),
	} satisfies GitHubClientShape;
});
