import type * as Scope from "effect/Scope";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import githubAppJwt from "universal-github-app-jwt";
import type { GitHubClientShape } from "./GitHubClient.ts";
import { GitHubClient, makeClientShape } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { GitHubGraphQLError } from "./GraphQL.ts";
import { numericId } from "./internal/ids.ts";
import type { RetryPolicy } from "./Resilience.ts";

/**
 * A GitHub App call failed.
 *
 * @remarks
 * Distinct from `GitHubError` because "I could not obtain credentials" and "the
 * API call failed" are different problems with different fixes: the first is a
 * misconfigured app, a wrong private key or a missing installation; the second
 * is the request that used the credentials.
 *
 * @public
 */
export class GitHubAppError extends S.TaggedError<GitHubAppError>()("GitHubAppError", {
	/** Which step failed. */
	kind: S.Literals(["jwt", "token", "revoke", "identity", "installation"]),
	/** Human-readable cause. */
	reason: S.String,
	/** The underlying failure, when there is one. */
	cause: S.optionalKey(S.Defect()),
}) {
	override get message(): string {
		return `GitHub App ${this.kind} failed: ${this.reason}`;
	}

	/** @internal */
	static of(kind: GitHubAppError["kind"], reason: string, cause?: unknown): GitHubAppError {
		return GitHubAppError.make({ kind, reason, ...(cause !== undefined ? { cause } : {}) });
	}
}

/**
 * The credentials that identify a GitHub App.
 *
 * @remarks
 * `appId` accepts either the numeric app id or the newer client id — GitHub
 * accepts both as the JWT issuer, and this package does not care which you use.
 *
 * @public
 */
export interface AppCredentials {
	/** The app id or client id. */
	readonly appId: string;
	/**
	 * The app's private key, in PEM.
	 *
	 * @remarks
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
 */
export interface TokenRequest extends AppCredentials {
	/** The installation. Discovered from `owner` when omitted. */
	readonly installationId?: number | undefined;
	/**
	 * The account whose installation to use, when `installationId` is omitted.
	 *
	 * @remarks
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
 * @remarks
 * Encodable on purpose. `@effected/github-actions` persists one across the
 * `pre`/`main`/`post` process boundary through `GITHUB_STATE`, and
 * `Schema.encodeUnknownEffect` produces JSON with the token as a plain string
 * and `expiresAt` as an ISO instant. A `Redacted` cannot survive serialization
 * by design, so masking the encoded value is the caller's job — Actions calls
 * `::add-mask::`.
 *
 * @public
 */
export class InstallationToken extends S.Class<InstallationToken>("InstallationToken")({
	/** The token. Decodes to `Redacted`, encodes back to the raw string. */
	token: S.RedactedFromValue(S.String),
	/** When GitHub will stop accepting it — about an hour out. */
	expiresAt: S.DateTimeUtcFromString,
	/** The installation it is scoped to. */
	installationId: S.Int,
	/** The permissions GitHub actually granted, which may be narrower than requested. */
	permissions: S.Record(S.String, S.String),
	/** The app's slug, when identity was resolved. */
	appSlug: S.optionalKey(S.String),
	/** The app's bot user id, when identity was resolved. */
	appUserId: S.optionalKey(S.Int),
	/** The app's display name, when identity was resolved. */
	appName: S.optionalKey(S.String),
}) {
	/**
	 * Whether this token is spent, `skew` before its stated expiry.
	 *
	 * @remarks
	 * `skew` defaults to one minute, so a token is treated as spent slightly early
	 * rather than answering 401 mid-request.
	 */
	isExpired(nowMillis: number, skew: Duration.Duration = DEFAULT_SKEW): boolean {
		return DateTime.toEpochMillis(this.expiresAt) - Duration.toMillis(skew) <= nowMillis;
	}

	/** The committer identity a commit made with this token should carry. */
	botIdentity(): BotIdentity {
		return this.appSlug === undefined
			? BotIdentity.githubActions
			: BotIdentity.forApp({
					appSlug: this.appSlug,
					...(this.appUserId !== undefined ? { appUserId: this.appUserId } : {}),
				});
	}
}

/** Re-mint a minute before GitHub would start refusing the token. */
const DEFAULT_SKEW = Duration.seconds(60);

/**
 * Who a bot commits as.
 *
 * @remarks
 * A **pure class**, not a `GitHubApp` service member: a synchronous method on
 * the service shape would be required in every `Layer.mock` and would silently
 * degrade every partial double to a full implementation. Get one from
 * `InstallationToken.botIdentity` or `AppIdentity.botIdentity`.
 *
 * @public
 */
export class BotIdentity extends S.Class<BotIdentity>("BotIdentity")({
	/** The git author/committer name, e.g. `"my-app[bot]"`. */
	name: S.String,
	/** The no-reply address GitHub attributes to that account. */
	email: S.String,
}) {
	/** The identity for an app, given whatever of its identity is known. */
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

	/** The well-known identity of the `github-actions` bot. */
	static readonly githubActions: BotIdentity = BotIdentity.make({
		name: "github-actions[bot]",
		email: "41898282+github-actions[bot]@users.noreply.github.com",
	});

	/**
	 * The DCO sign-off trailer for this identity.
	 *
	 * @remarks
	 * `Signed-off-by: name <email>` — DCO 1.1's fixed casing and spacing, with
	 * only the email in angle brackets, rendered by the type that owns the
	 * data. Commits created
	 * through the Git Data API bypass `git commit -s`, so no porcelain adds
	 * the trailer, and a hand-built one that is subtly wrong fails late as a
	 * red DCO check on someone else's pull request. Whether a missing
	 * identity falls back to {@link BotIdentity.githubActions} stays the
	 * caller's policy.
	 */
	get signoff(): string {
		return `Signed-off-by: ${this.name} <${this.email}>`;
	}
}

/**
 * What GitHub knows about the app itself.
 *
 * @public
 */
export class AppIdentity extends S.Class<AppIdentity>("AppIdentity")({
	/** The URL slug, e.g. `"my-app"`. */
	slug: S.String,
	/** The display name. */
	name: S.String,
	/** The bot user's numeric id, when it could be resolved. */
	userId: S.optionalKey(S.Int),
}) {
	/** The committer identity for this app. */
	botIdentity(): BotIdentity {
		return BotIdentity.forApp({
			appSlug: this.slug,
			...(this.userId !== undefined ? { appUserId: this.userId } : {}),
		});
	}
}

/**
 * One installation of the app.
 *
 * @public
 */
export class Installation extends S.Class<Installation>("Installation")({
	/** The installation id, which is what a token is minted against. */
	id: S.Int,
	/** The account the app is installed on, when GitHub reported one. */
	account: S.optionalKey(S.String),
}) {}

/**
 * Transport settings for the app's own API calls.
 *
 * @public
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
 * @remarks
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
 * @example
 * ```ts
 * import { GitHubApp, GitHubClient } from "./index.ts";
 * import { Effect, Redacted } from "effect";
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
 * Effect.runPromise(Effect.provide(program, layer));
 * ```
 *
 * @public
 */
export class GitHubApp extends Context.Service<GitHubApp, GitHubAppShape>()("@beep/scratchpad/effected/github/GitHubApp") {
	/** The default transport. Bind it once; layers are memoized by reference. */
	static readonly layer: Layer.Layer<GitHubApp> = Layer.effect(this, makeApp({}));

	/**
	 * A transport with custom settings.
	 *
	 * @remarks
	 * Parameterized, so **bind the result to a `const`** and reuse it. Calling
	 * this at two provide sites builds two instances, because layers are
	 * memoized by reference.
	 */
	static readonly layerWith = (options: GitHubAppOptions): Layer.Layer<GitHubApp> =>
		Layer.effect(GitHubApp, makeApp(options));

	/**
	 * A {@link GitHubClient} authenticated as an app installation.
	 *
	 * @remarks
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
	 */
	static readonly clientLayer = (
		request: TokenRequest,
		options: GitHubAppOptions = {},
	): Layer.Layer<GitHubClient, GitHubAppError> =>
		Layer.effect(
			GitHubClient,
			Effect.flatMap(GitHubApp, (app) => makeRotatingClient(app, request, options)),
		).pipe(Layer.provide(GitHubApp.layerWith(options)));

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<GitHubAppShape> = {}): GitHubAppShape => ({
		token: overrides.token ?? (() => unstubbed("token")),
		scopedToken: overrides.scopedToken ?? (() => unstubbed("scopedToken")),
		revoke: overrides.revoke ?? (() => unstubbed("revoke")),
		identity: overrides.identity ?? (() => unstubbed("identity")),
		installations: overrides.installations ?? (() => unstubbed("installations")),
	});

	/** {@link GitHubApp.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<GitHubAppShape> = {}): Layer.Layer<GitHubApp> =>
		Layer.succeed(GitHubApp, GitHubApp.makeTest(overrides));
}

/**
 * The app-authentication surface.
 *
 * @remarks
 * Every member is a function returning an `Effect`, so a partial double stays
 * partial. `installations` takes credentials rather than being an
 * `Effect`-valued property because the credentials are per-call, not per-layer.
 *
 * @public
 */
export interface GitHubAppShape {
	/**
	 * Mint an installation token.
	 *
	 * @remarks
	 * `installationId` is used when given; otherwise the installation is
	 * discovered from `owner`, or from the app's only installation.
	 */
	readonly token: (request: TokenRequest) => Effect.Effect<InstallationToken, GitHubAppError>;
	/**
	 * Mint a token that is revoked, best-effort, when the scope closes.
	 *
	 * @remarks
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
	 * @remarks
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
	throw new Error(`GitHubApp.makeTest: ${member}() was called but not stubbed — pass an override.`);
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
			return yield* client.request("DELETE /installation/token", {}).pipe(Effect.catch(appFailure("revoke")));
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
	if (typeof raw !== "object" || raw === null) return {};
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof value === "string") out[key] = value;
	}
	return out;
};

/**
 * A client shape that re-mints its installation token before it expires.
 *
 * @remarks
 * The rotation is invisible to a caller: each member resolves the current
 * client first, and "current" means "minted, and not within a minute of
 * expiry". Rotating revokes the token it replaces, so at most one live token
 * exists at a time and the scope's release revokes the last of them.
 */
const makeRotatingClient = (
	app: GitHubAppShape,
	request: TokenRequest,
	options: GitHubAppOptions,
): Effect.Effect<GitHubClientShape, GitHubAppError, Scope.Scope> =>
	Effect.gen(function* () {
		const held = yield* Ref.make(O.none<{ token: InstallationToken; client: GitHubClientShape }>());

		const revokeHeld = Effect.flatMap(Ref.get(held), (current) =>
			O.isSome(current) ? Effect.ignore(app.revoke(current.value.token.token)) : Effect.void,
		);

		const rotate = Effect.gen(function* () {
			yield* revokeHeld;
			const minted = yield* app.token(request);
			const client = yield* makeClientShape({ ...options, token: minted.token });
			yield* Ref.set(held, O.some({ token: minted, client }));
			return client;
		});

		// Mint eagerly so a misconfigured app fails at layer construction, where
		// the error is a `GitHubAppError` a caller can read, rather than on the
		// first request as an opaque authorization failure.
		yield* rotate;
		yield* Effect.addFinalizer(() => revokeHeld);

		/** The live client, re-minting first if the held token is spent. */
		const fresh: Effect.Effect<GitHubClientShape, GitHubAppError> = Effect.gen(function* () {
			const now = yield* Clock.currentTimeMillis;
			const state = yield* Ref.get(held);
			if (O.isSome(state) && !state.value.token.isExpired(now)) return state.value.client;
			return yield* rotate;
		});

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
