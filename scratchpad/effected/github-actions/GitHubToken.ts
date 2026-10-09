import { $ScratchpadId } from "@beep/identity/packages";
import type { BotIdentity, GitHubAppShape, PermissionLevel, RetryPolicy } from "../github/index.ts";
import { GitHubApp, GitHubClient, InstallationToken, TokenPermissions } from "../github/index.ts";
import type * as Redacted from "effect/Redacted";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { ActionStateError } from "./ActionState.ts";
import { ActionState } from "./ActionState.ts";
import { Secret } from "./Secret.ts";

const $I = $ScratchpadId.create("effected/github-actions/GitHubToken");

/**
 * Raised when the token an earlier phase persisted cannot be used.
 *
 * @public
 */
export class GitHubTokenError extends S.TaggedError<GitHubTokenError>($I`GitHubTokenError`)("GitHubTokenError", {
	/**
	 * One reason, deliberately: everything else that can go wrong here already
	 * has an owner — persistence is an `ActionStateError`, minting is a
	 * `GitHubAppError`, and scope verification is a `TokenPermissionError`.
	 */
	reason: S.Literals(["expired"]).annotateKey({ description: "One reason, deliberately: everything else that can go wrong here already has an owner — persistence is an `ActionStateError`, minting is a `GitHubAppError`, and scope verification is a `TokenPermissionError`." }),
	/** When GitHub stopped accepting it, ISO-8601. */
	expiresAt: S.String.annotateKey({ description: "When GitHub stopped accepting it, ISO-8601." }),
}, $I.annote("GitHubTokenError", { description: "Raised when the token an earlier phase persisted cannot be used." })) {
	override get message(): string {
		return `The installation token persisted by an earlier phase expired at ${this.expiresAt}. An installation token lives about an hour and no later phase can re-mint one, so a long-running phase must provision its own.`;
	}
}

/** The default `GITHUB_STATE` key the token is filed under. */
const DEFAULT_KEY = "githubToken";

/**
 * What to mint a token for.
 *
 * @public
 */
export interface ProvisionOptions {
	/** The app id or client id. */
	readonly appId: string;
	/** The app's private key, in PEM. */
	readonly privateKey: Redacted.Redacted<string>;
	/** The installation. Discovered from `owner`, or from the app's only installation, when omitted. */
	readonly installationId?: number | undefined;
	/** The account whose installation to use, when `installationId` is omitted. */
	readonly owner?: string | undefined;
	/**
	 * The permissions the action needs.
	 *
	 * @remarks
	 * Verified against what GitHub actually granted, which can be narrower than
	 * what was asked for. Checked **before** the token is persisted, so a
	 * workflow with a misconfigured installation fails at `pre` with a message
	 * naming the missing permission rather than in the middle of `main` with a
	 * `403` on one request.
	 */
	readonly required?: Readonly<Record<string, PermissionLevel>> | undefined;
	/** The `GITHUB_STATE` key. One default, so `pre` and `post` agree without saying so. */
	readonly stateKey?: string | undefined;
}

/** Where to read a persisted token from. @public */
export interface ReadOptions {
	/** The `GITHUB_STATE` key. */
	readonly stateKey?: string | undefined;
	/**
	 * How long before the stated expiry to treat the token as spent.
	 *
	 * @remarks
	 * A minute by default. The window exists because the check and the request
	 * it guards are not the same instant.
	 */
	readonly skew?: Duration.Duration | undefined;
}

/** How to build a client from a persisted token. @public */
export interface ClientLayerOptions extends ReadOptions {
	/** Retry behavior. Defaults to the client's own policy; `"off"` disables it. */
	readonly retry?: RetryPolicy | "off" | undefined;
	/** A GitHub Enterprise API root. */
	readonly baseUrl?: string | undefined;
	/** Appended to octokit's own user agent. */
	readonly userAgent?: string | undefined;
	/** A replacement for the global `fetch`. */
	readonly fetch?: typeof globalThis.fetch | undefined;
}

/**
 * Resolve the app's identity onto a minted token, degrading rather than failing.
 *
 * @remarks
 * The identity is what makes a commit say `my-app[bot]` instead of
 * `github-actions[bot]`. It is worth a request and it is **not** worth an
 * action: a `GET /app` hiccup must not fail a release, so the failure is logged
 * and the token comes back without the identity fields. `botIdentity()` then
 * falls back on its own.
 *
 * The installation token is supplied to the lookup on purpose:
 * `GET /users/{slug}[bot]` rejects an app JWT, so without one the request runs
 * unauthenticated against GitHub's sixty-per-hour-per-IP limit.
 */
const identified = (
	app: GitHubAppShape,
	options: ProvisionOptions,
	minted: InstallationToken,
): Effect.Effect<InstallationToken> =>
	Effect.gen(function* () {
		const resolved = yield* Effect.result(
			app.identity({
				appId: options.appId,
				privateKey: options.privateKey,
				installationToken: minted.token,
			}),
		);
		if (Result.isFailure(resolved)) {
			yield* Effect.logWarning(
				`Could not resolve the app's identity; commits will be attributed to github-actions[bot]: ${resolved.failure.message}`,
			);
			return minted;
		}
		const identity = resolved.success;
		return InstallationToken.make({
			token: minted.token,
			expiresAt: minted.expiresAt,
			installationId: minted.installationId,
			permissions: minted.permissions,
			appSlug: identity.slug,
			appName: identity.name,
			// Never an explicit `undefined` on an `optionalKey` field: the class
			// factory validates on construction and refuses one.
			...(identity.userId === undefined ? {} : { appUserId: identity.userId }),
		});
	});

/**
 * The GitHub App token lifecycle, shaped like a workflow.
 *
 * @remarks
 * One of the two seams between this package and `@effected/github` — mint in
 * `pre`, use in `main`, revoke in `post`. The three phases are **three separate processes**, so
 * nothing survives between them except what `GITHUB_STATE` carries, which is
 * why this is a persistence problem rather than a `Scope`.
 *
 * That is also why `GitHubApp.scopedToken` is the wrong primitive here and
 * `GitHubApp.clientLayer` is a different thing entirely: both revoke when their
 * scope closes, and the scope closes at the end of `pre` — before `main` has
 * run a single request.
 *
 * **The token lives about an hour, and no later phase can re-mint one.** The
 * credentials that could are the app's private key, and persisting *that*
 * through `GITHUB_STATE` — a plaintext file by GitHub's protocol — would trade
 * a one-hour token for a permanent one. So the contract is stated rather than
 * worked around: {@link GitHubToken.read} fails typed when the persisted
 * token is spent, and a phase that can outlive the hour calls
 * {@link GitHubToken.provision} itself.
 *
 * Every member's `R` says exactly which services it needs, and this table says
 * which parts of each it touches, so a partial double is built from the
 * documentation rather than from a stack trace:
 *
 * | Member | `ActionState` | `ActionOutputs` | `GitHubApp` |
 * | --- | --- | --- | --- |
 * | `provision` | `save` | `setSecret` | `token`, `identity`, `revoke` |
 * | `read` | `get` | — | — |
 * | `botIdentity` | `get` | — | — |
 * | `clientLayer` | `get` | — | — |
 * | `dispose` | `getOptional` | — | `revoke` |
 *
 * @example
 * ```ts
 * import { GitHubToken } from "./index.ts";
 * import { Effect, Redacted } from "effect";
 *
 * const pre = Effect.gen(function* () {
 *   return yield* GitHubToken.provision({
 *     appId: "123456",
 *     privateKey: Redacted.make(pem),
 *     owner: "acme",
 *     required: { contents: "write", pull_requests: "write" },
 *   });
 * });
 * ```
 *
 * @public
 */
export class GitHubToken {
	private constructor() {}

	/**
	 * Mint a token, verify its scopes, mask it and persist it for later phases.
	 *
	 * @remarks
	 * An `acquireUseRelease`, and the release arm is the load-bearing part: if
	 * scope verification or persistence fails, the minted token is **revoked**
	 * rather than left live until GitHub expires it. A workflow that retries a
	 * failing `pre` would otherwise leave an hour's worth of unreferenced write
	 * tokens behind, each of which is a credential nobody is tracking.
	 *
	 * The masking happens **before** the persistence, through
	 * {@link Secret.forRunnerFile}, so the ordering is structural rather than
	 * remembered: `GITHUB_STATE` is plaintext by protocol, and the runner's log
	 * filter is the only defense available.
	 */
	static readonly provision = Effect.fn("GitHubToken.provision")(function* (options: ProvisionOptions) {
		const app = yield* GitHubApp;
		const state = yield* ActionState;
		const key = options.stateKey ?? DEFAULT_KEY;
		return yield* Effect.acquireUseRelease(
			app.token({
				appId: options.appId,
				privateKey: options.privateKey,
				...(options.installationId === undefined ? {} : { installationId: options.installationId }),
				...(options.owner === undefined ? {} : { owner: options.owner }),
			}),
			(minted) =>
				Effect.gen(function* () {
					if (options.required !== undefined) {
						// Pure — no service, no request. The permissions GitHub granted
						// came back with the token.
						yield* TokenPermissions.fromGitHub(minted.permissions).assertSufficient(options.required);
					}
					yield* Secret.forRunnerFile(minted.token);
					const enriched = yield* identified(app, options, minted);
					yield* state.save(key, enriched, InstallationToken);
					return enriched;
				}),
			(minted, exit) =>
				Exit.isSuccess(exit)
					? Effect.void
					: // Ignored, and that is deliberate: the action is already failing for
						// a reason the caller needs to see, and replacing it with "revocation
						// failed" would hide it.
						Effect.ignore(app.revoke(minted.token)),
		);
	});

	/**
	 * The token an earlier phase persisted.
	 *
	 * @remarks
	 * Fails with {@link GitHubTokenError} when it is spent, and with
	 * {@link ActionStateError} when no token was persisted. Without that check a
	 * `main` phase that outlived the hour would simply start answering `401` with
	 * no explanation — the hardest failure in this lifecycle to diagnose from a
	 * workflow log.
	 */
	static readonly read = Effect.fn("GitHubToken.read")(function* (options: ReadOptions = {}) {
		const state = yield* ActionState;
		const token = yield* state.get(options.stateKey ?? DEFAULT_KEY, InstallationToken);
		const now = yield* DateTime.now;
		if (token.isExpired(DateTime.toEpochMillis(now), options.skew)) {
			return yield* GitHubTokenError.make({ reason: "expired", expiresAt: DateTime.formatIso(token.expiresAt) });
		}
		return token;
	});

	/**
	 * The committer identity a commit made with the persisted token should carry.
	 *
	 * @remarks
	 * Pure once the token is in hand — the identity fields travel with it — so
	 * this costs one state read and no request.
	 */
	static readonly botIdentity = Effect.fn("GitHubToken.botIdentity")(function* (options: ReadOptions = {}) {
		return (yield* GitHubToken.read(options)).botIdentity() satisfies BotIdentity;
	});

	/**
	 * A client built from the persisted token.
	 *
	 * @remarks
	 * Built with `GitHubClient.layerFromToken` rather than through `GitHubApp`,
	 * and the difference matters: the App path links a JWT signer and needs the
	 * private key, neither of which a later phase has or should have. This path
	 * needs only the token the `pre` phase already minted.
	 *
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 */
	static readonly clientLayer = (
		options: ClientLayerOptions = {},
	): Layer.Layer<GitHubClient, ActionStateError | GitHubTokenError, ActionState> =>
		Layer.unwrap(
			Effect.map(GitHubToken.read(options), (token) =>
				GitHubClient.layerFromToken({
					token: token.token,
					...(options.retry === undefined ? {} : { retry: options.retry }),
					...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
					...(options.userAgent === undefined ? {} : { userAgent: options.userAgent }),
					...(options.fetch === undefined ? {} : { fetch: options.fetch }),
				}),
			),
		);

	/**
	 * Revoke the persisted token, if there is one.
	 *
	 * @remarks
	 * `getOptional`, so a `post` phase that runs after a `pre` that never got as
	 * far as provisioning is a **no-op rather than a failure** — which is the
	 * common shape of a workflow that failed early, and the last thing it needs
	 * is a second failure on the way out.
	 *
	 * An already-expired token is not revoked either: GitHub has already stopped
	 * accepting it, so the request would fail and the only thing it could
	 * accomplish is turning a successful run into a failed one.
	 */
	static readonly dispose = Effect.fn("GitHubToken.dispose")(function* (options: ReadOptions = {}) {
		const app = yield* GitHubApp;
		const state = yield* ActionState;
		const found = yield* state.getOptional(options.stateKey ?? DEFAULT_KEY, InstallationToken);
		if (O.isNone(found)) {
			return;
		}
		const now = yield* DateTime.now;
		if (found.value.isExpired(DateTime.toEpochMillis(now), Duration.zero)) {
			yield* Effect.logDebug("The installation token had already expired; nothing to revoke.");
			return;
		}
		yield* app.revoke(found.value.token);
	});
}
