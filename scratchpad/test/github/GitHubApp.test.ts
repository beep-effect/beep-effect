import * as Base64 from "effect/encoding/Base64";
import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as Exit from "effect/Exit";
import * as Context from "effect/Context";
import type { GitHubAppError } from "../../effected/github/GitHubApp.ts";
import { assertNone } from "@effect/vitest/utils";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";
import { AppIdentity, BotIdentity, GitHubApp, InstallationToken } from "../../effected/github/GitHubApp.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { RetryPolicy } from "../../effected/github/Resilience.ts";
import type { Reply } from "./fixtures.ts";
import { scriptedFetch } from "./fixtures.ts";

/**
 * A real PKCS#8 RSA key, generated once. The JWT signer performs genuine RS256
 * signing, so there is nothing to stub — and this is what proves the signer
 * works at all, which a stubbed one could not.
 */
const keyPair = await crypto.subtle.generateKey(
	{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
	true,
	["sign", "verify"],
);
const keyBytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
const privateKey = "-----BEGIN PRIVATE KEY-----\n" + Base64.encode(keyBytes) + "\n-----END PRIVATE KEY-----";

const CREDENTIALS = { appId: "Iv1.test", privateKey: Redacted.make(privateKey) };

const NO_RETRY = RetryPolicy.none;

class ScopedClient extends Context.Service<
	ScopedClient,
	{
		readonly client: GitHubClient["Service"];
		readonly close: Effect.Effect<void>;
	}
>()("@beep/scratchpad/test/github/GitHubApp.test/ScopedClient") {}

// The hook acquires the client; these lifecycle tests close its child scope before asserting revocation.
const scopedClientLayer = (script: ReturnType<typeof scriptedFetch>) =>
	Layer.effect(
		ScopedClient,
		Effect.gen(function* () {
			const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
			const context = yield* Layer.buildWithScope(
				GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY }),
				scope,
			);
			return { client: Context.get(context, GitHubClient), close: Scope.close(scope, Exit.void) };
		}),
	);

/** An installation-token payload as GitHub sends it. */
const tokenReply = (options: { expiresAt?: string; token?: string } = {}): Reply => ({
	status: 201,
	body: {
		token: options.token ?? "ghs_installation",
		expires_at: options.expiresAt ?? "2099-01-01T00:00:00Z",
		permissions: { contents: "write", metadata: "read" },
	},
});

const withApp = <A, E>(
	name: string,
	replies: ReadonlyArray<Reply>,
	use: (
		app: GitHubApp["Service"],
		script: ReturnType<typeof scriptedFetch>,
	) => Effect.Effect<A, E, import("effect/Scope").Scope>,
): void => {
	const script = scriptedFetch(replies);
	it.layer(GitHubApp.layerWith({ fetch: script.fetch, retry: NO_RETRY }), { timeout: "30 seconds" })((it) => {
		it.effect(name, () => Effect.flatMap(GitHubApp, (app) => use(app, script)));
	});
};

describe("GitHubApp.token", () => {
	withApp("mints an installation token against a known installation", [tokenReply()], (app, script) =>
		Effect.gen(function* () {
			const token = yield* app.token({ ...CREDENTIALS, installationId: 42 });
			assert.strictEqual(Redacted.value(token.token), "ghs_installation");
			assert.strictEqual(token.installationId, 42);
			assert.deepStrictEqual({ ...token.permissions }, { contents: "write", metadata: "read" });
			// One call: a known installation id needs no discovery.
			assert.strictEqual(script.count(), 1);
			assert.include(script.calls[0]?.url ?? "", "/app/installations/42/access_tokens");
		}),
	);

	withApp("authenticates the mint with a JWT bearer, not a token", [tokenReply()], (app, script) =>
		Effect.gen(function* () {
			yield* app.token({ ...CREDENTIALS, installationId: 42 });
			const authorization = script.calls[0]?.headers.authorization ?? "";
			// octokit's auth-token emits `bearer` for a three-segment JWT and
			// `token` otherwise, which is exactly the distinction the app and
			// installation credentials need — so no separate auth strategy exists.
			assert.isTrue(authorization.startsWith("bearer "), authorization);
			assert.lengthOf(authorization.slice("bearer ".length).split("."), 3);
		}),
	);

	withApp(
		"discovers the installation for an owner",
		[
			{
				status: 200,
				body: [
					{ id: 7, account: { login: "Acme" } },
					{ id: 9, account: { login: "other" } },
				],
			},
			tokenReply(),
		],
		(app, script) =>
			Effect.gen(function* () {
				// Case-insensitive: GitHub's login casing is display casing.
				const token = yield* app.token({ ...CREDENTIALS, owner: "acme" });
				assert.strictEqual(token.installationId, 7);
				assert.include(script.calls[1]?.url ?? "", "/app/installations/7/access_tokens");
			}),
	);

	withApp(
		"names the available installations when the owner has none",
		[{ status: 200, body: [{ id: 7, account: { login: "acme" } }] }],
		(app) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(app.token({ ...CREDENTIALS, owner: "nobody" }));
				assert.strictEqual(error.kind, "installation");
				assert.include(error.reason, "nobody");
				assert.include(error.reason, "acme");
			}),
	);

	withApp(
		"uses the sole installation when neither id nor owner is given",
		[{ status: 200, body: [{ id: 5, account: { login: "solo" } }] }, tokenReply()],
		(app) =>
			Effect.gen(function* () {
				const token = yield* app.token(CREDENTIALS);
				assert.strictEqual(token.installationId, 5);
			}),
	);

	withApp(
		"refuses to guess between several installations",
		[
			{
				status: 200,
				body: [
					{ id: 1, account: { login: "a" } },
					{ id: 2, account: { login: "b" } },
				],
			},
		],
		(app) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(app.token(CREDENTIALS));
				assert.strictEqual(error.kind, "installation");
				assert.include(error.reason, "2 installations");
			}),
	);

	withApp("reports no installations honestly", [{ status: 200, body: [] }], (app) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(app.token(CREDENTIALS));
			assert.include(error.reason, "no installations");
		}),
	);

	withApp("surfaces a mint rejection as a token failure", [{ status: 404, body: { message: "Not Found" } }], (app) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(app.token({ ...CREDENTIALS, installationId: 42 }));
			assert.strictEqual(error.kind, "token");
			assert.strictEqual(error._tag, "GitHubAppError");
		}),
	);

	withApp("fails as a jwt error on an unusable private key", [tokenReply()], (app) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				app.token({ appId: "x", privateKey: Redacted.make("not a key"), installationId: 1 }),
			);
			assert.strictEqual(error.kind, "jwt");
		}),
	);
});

describe("GitHubApp.revoke and scopedToken", () => {
	withApp("returns undefined after an HTTP 204 revocation", [{ status: 204 }], (app) =>
		Effect.gen(function* () {
			const value = yield* app.revoke(Redacted.make("ghs_installation"));
			assert.strictEqual(value, undefined);
		}),
	);

	withApp("revokes with a token credential, not a bearer", [{ status: 204 }], (app, script) =>
		Effect.gen(function* () {
			yield* app.revoke(Redacted.make("ghs_installation"));
			assert.strictEqual(script.calls[0]?.method, "DELETE");
			assert.include(script.calls[0]?.url ?? "", "/installation/token");
			assert.strictEqual(script.calls[0]?.headers.authorization, "token ghs_installation");
		}),
	);

	withApp("scopedToken revokes when the scope closes", [tokenReply(), { status: 204 }], (app, script) =>
		Effect.gen(function* () {
			yield* Effect.scoped(
				Effect.gen(function* () {
					const token = yield* app.scopedToken({ ...CREDENTIALS, installationId: 42 });
					assert.strictEqual(Redacted.value(token.token), "ghs_installation");
					assert.strictEqual(script.count(), 1, "not revoked while the scope is open");
				}),
			);
			assert.strictEqual(script.count(), 2);
			assert.strictEqual(script.calls[1]?.method, "DELETE");
		}),
	);

	withApp(
		"a failed revoke does not fail the scope",
		[tokenReply(), { status: 500, body: { message: "boom" } }],
		(app) =>
			// Best-effort by design: a token GitHub would not revoke expires on its
			// own within the hour, and failing the caller's program over it is worse.
			app.scopedToken({ ...CREDENTIALS, installationId: 42 }).pipe(Effect.asVoid),
	);
});

describe("GitHubApp.identity", () => {
	withApp(
		"resolves slug, name and bot user id",
		[
			{ status: 200, body: { slug: "my-app", name: "My App", id: 1 } },
			{ status: 200, body: { id: 987654, login: "my-app[bot]" } },
		],
		(app, script) =>
			Effect.gen(function* () {
				const identity = yield* app.identity({ ...CREDENTIALS, installationToken: Redacted.make("ghs_x") });
				assert.deepStrictEqual(identity, AppIdentity.make({ slug: "my-app", name: "My App", userId: 987654 }));
				// The bot-user lookup rejects an app JWT, so it bears the
				// installation token when one is supplied.
				assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_x");
			}),
	);

	withApp(
		"degrades to slug and name when the bot user cannot be read",
		[
			{ status: 200, body: { slug: "my-app", name: "My App", id: 1 } },
			{ status: 403, body: { message: "rate limited" } },
		],
		(app) =>
			Effect.gen(function* () {
				const identity = yield* app.identity(CREDENTIALS);
				assert.strictEqual(identity.slug, "my-app");
				assert.strictEqual(identity.userId, undefined);
			}),
	);

	withApp("surfaces a failure to read the app itself", [{ status: 401, body: { message: "Bad credentials" } }], (app) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(app.identity(CREDENTIALS));
			assert.strictEqual(error.kind, "identity");
		}),
	);
});

describe("GitHubApp.clientLayer", () => {
	const withClientLayer = <A, E>(
		name: string,
		replies: ReadonlyArray<Reply>,
		use: (client: GitHubClient["Service"], script: ReturnType<typeof scriptedFetch>) => Effect.Effect<A, E>,
	): void => {
		const script = scriptedFetch(replies);
		it.layer(GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY }), {
			timeout: "30 seconds",
		})((it) => {
			it.effect(name, () => Effect.flatMap(GitHubClient, (client) => use(client, script)));
		});
	};

	withClientLayer(
		"mints on build and authenticates requests with the installation token",
		[tokenReply(), { status: 200, body: { default_branch: "main" } }, { status: 204 }],
		(client, script) =>
			Effect.gen(function* () {
				const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
				assert.strictEqual(repo.default_branch, "main");
				assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_installation");
			}),
	);

	{
		const script = scriptedFetch([tokenReply(), { status: 200, body: {} }, { status: 204 }]);
		it.layer(scopedClientLayer(script), { timeout: "30 seconds" })((it) => {
			it.effect("revokes the token when the layer's scope closes", () =>
				Effect.gen(function* () {
					const { client, close } = yield* ScopedClient;
					yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
					yield* close;
					const last = script.calls[script.count() - 1];
					assert.strictEqual(last?.method, "DELETE", "the layer must not leave live credentials behind");
					assert.include(last?.url ?? "", "/installation/token");
				}),
			);
		});
	}

	{
		const expiresAt = DateTime.toDateUtc(DateTime.makeUnsafe(0)).toISOString();
		const script = scriptedFetch([
			tokenReply({ expiresAt, token: "ghs_first" }),
			{ status: 204 }, // revoke of the first
			tokenReply({ expiresAt: "2099-01-01T00:00:00Z", token: "ghs_second" }),
			{ status: 200, body: { default_branch: "main" } },
			{ status: 204 }, // revoke on scope close
		]);
		it.layer(GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY }), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("re-mints a token that has expired, revoking the old one", () =>
				Effect.gen(function* () {
					const client = yield* GitHubClient;
					// This one-test layer owns its TestClock; no sibling test observes the adjustment.
					yield* TestClock.adjust(Duration.seconds(1));
					yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
					assert.strictEqual(
						script.calls[1]?.method,
						"DELETE",
						"the spent token is revoked before the replacement is minted",
					);
					assert.strictEqual(script.calls[3]?.headers.authorization, "token ghs_second");
				}),
			);
		});
	}

	{
		const script = scriptedFetch([{ status: 401, body: { message: "Bad credentials" } }]);
		class ConstructionError extends Context.Service<ConstructionError, GitHubAppError>()(
			"@beep/scratchpad/test/github/GitHubApp.test/ConstructionError",
		) {}
		it.layer(
			Layer.effect(
				ConstructionError,
				Layer.build(
					GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY }),
				).pipe(Effect.flip),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("fails layer construction with a GitHubAppError when credentials are bad", () =>
				Effect.gen(function* () {
					const error = yield* ConstructionError;
					// At construction the caller gets the App error, which says what is
					// actually wrong — not an opaque authorization failure on first use.
					assert.strictEqual(error._tag, "GitHubAppError");
					assert.strictEqual(error.kind, "token");
				}),
			);
		});
	}

	{
		const script = scriptedFetch([
			tokenReply({ expiresAt: "1970-01-01T00:00:00Z", token: "ghs_first" }),
			{ status: 204 },
			tokenReply({ token: "ghs_second" }),
			{ status: 200, body: { default_branch: "main" } },
			{ status: 200, body: { default_branch: "main" } },
			{ status: 204 },
		]);
		it.layer(scopedClientLayer(script), { timeout: "30 seconds" })((it) => {
			it.effect("concurrent expired-token requests share one replacement and revoke every minted token", () =>
				Effect.gen(function* () {
					const { client, close } = yield* ScopedClient;
					const values = yield* Effect.all(
						[
							client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }),
							client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }),
						],
						{ concurrency: 2 },
					);
					yield* close;
					assert.deepStrictEqual(
						values.map((value) => value.default_branch),
						["main", "main"],
					);
					assert.strictEqual(script.count(), 6, "one initial mint, one rotation, two reads and two revocations");
					assert.deepStrictEqual(
						script.calls.map((call) => call.method),
						["POST", "DELETE", "POST", "GET", "GET", "DELETE"],
					);
					assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_first");
					assert.strictEqual(script.calls[3]?.headers.authorization, "token ghs_second");
					assert.strictEqual(script.calls[4]?.headers.authorization, "token ghs_second");
					assert.strictEqual(script.calls[5]?.headers.authorization, "token ghs_second");
				}),
			);
		});
	}
});

describe("InstallationToken", () => {
	const token = InstallationToken.make({
		token: Redacted.make("ghs_x"),
		expiresAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
		installationId: 1,
		permissions: { contents: "write" },
	});

	it("is expired once the clock passes its expiry, minus the skew", () => {
		const expiry = DateTime.toEpochMillis(token.expiresAt);
		assert.isFalse(token.isExpired(expiry - 120_000));
		assert.isTrue(token.isExpired(expiry - 30_000), "the skew re-mints before GitHub starts refusing");
		assert.isTrue(token.isExpired(expiry + 1));
	});

	it("honors a caller-supplied skew", () => {
		const expiry = DateTime.toEpochMillis(token.expiresAt);
		assert.isTrue(token.isExpired(expiry - 120_000, Duration.minutes(5)));
	});

	it.effect("encodes to JSON a process boundary can carry", () =>
		Effect.gen(function* () {
			// @effected/github-actions persists this through GITHUB_STATE, which is
			// plaintext by GitHub's protocol — hence the raw string on the wire.
			const encoded = yield* S.encodeUnknownEffect(InstallationToken)(token);
			assert.deepStrictEqual(encoded, {
				token: "ghs_x",
				expiresAt: "2026-01-01T00:00:00.000Z",
				installationId: 1,
				permissions: { contents: "write" },
			});
			const decoded = yield* S.decodeEffect(InstallationToken)(encoded);
			assert.strictEqual(Redacted.value(decoded.token), "ghs_x");
			assert.isTrue(DateTime.toEpochMillis(decoded.expiresAt) === DateTime.toEpochMillis(token.expiresAt));
		}),
	);

	it("derives the github-actions identity when the app is unidentified", () => {
		assert.deepStrictEqual(token.botIdentity(), BotIdentity.githubActions);
	});

	it("derives the app's identity when it is known", () => {
		const identified = InstallationToken.make({ ...token, appSlug: "my-app", appUserId: 42 });
		assert.deepStrictEqual(
			identified.botIdentity(),
			BotIdentity.make({ name: "my-app[bot]", email: "42+my-app[bot]@users.noreply.github.com" }),
		);
	});
});

describe("BotIdentity", () => {
	it("builds the full identity from slug and user id", () => {
		const identity = BotIdentity.forApp({ appSlug: "my-app", appUserId: 42 });
		assert.strictEqual(identity.name, "my-app[bot]");
		assert.strictEqual(identity.email, "42+my-app[bot]@users.noreply.github.com");
	});

	it("omits the numeric prefix when the user id is unknown", () => {
		assert.strictEqual(BotIdentity.forApp({ appSlug: "my-app" }).email, "my-app[bot]@users.noreply.github.com");
	});

	it("knows the well-known github-actions identity", () => {
		assert.strictEqual(BotIdentity.githubActions.email, "41898282+github-actions[bot]@users.noreply.github.com");
	});

	it("is reachable with no layer, no client and no credentials", () => {
		// The point of moving it off the service shape: a consumer rendering a
		// committer line needs none of the machinery.
		assert.instanceOf(BotIdentity.forApp({ appSlug: "x" }), BotIdentity);
	});

	it("renders its own DCO sign-off trailer", () => {
		// Git Data API commits bypass `git commit -s`, so the trailer has no
		// porcelain to come from — and a hand-built one that is subtly wrong
		// surfaces as a red DCO check on someone else's PR. DCO 1.1's exact
		// casing, spacing and angle brackets, from the type that owns the data.
		assert.strictEqual(
			BotIdentity.githubActions.signoff,
			"Signed-off-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
		);
		assert.strictEqual(
			BotIdentity.forApp({ appSlug: "my-app", appUserId: 42 }).signoff,
			"Signed-off-by: my-app[bot] <42+my-app[bot]@users.noreply.github.com>",
		);
	});
});

describe("AppIdentity", () => {
	it("derives a bot identity", () => {
		const identity = AppIdentity.make({ slug: "my-app", name: "My App", userId: 7 });
		assert.strictEqual(identity.botIdentity().email, "7+my-app[bot]@users.noreply.github.com");
	});
});

describe("GitHubApp.makeTest", () => {
	it.effect("answers a stubbed member", () =>
		Effect.gen(function* () {
			const double = GitHubApp.makeTest({
				identity: () => Effect.succeed(AppIdentity.make({ slug: "s", name: "n" })),
			});
			const identity = yield* double.identity(CREDENTIALS);
			assert.strictEqual(identity.slug, "s");
		}),
	);

	it("dies loudly on an unstubbed member", () => {
		assert.throws(() => GitHubApp.makeTest({}).token(CREDENTIALS), /was called but not stubbed/);
	});

	{
		it.layer(GitHubApp.layerTest({ installations: () => Effect.succeed([]) }), { timeout: "30 seconds" })((it) => {
			it.effect("layerTest provides the double", () =>
				Effect.gen(function* () {
					const observed = yield* Effect.flatMap(GitHubApp, (app) => app.installations(CREDENTIALS));
					assert.deepStrictEqual(observed, []);
				}),
			);
		});
	}
});

describe("Option is not needed to read a missing installation account", () => {
	withApp(
		"keeps an installation with no account",
		[{ status: 200, body: [{ id: 3, account: null }] }, tokenReply()],
		(app) =>
			Effect.gen(function* () {
				const all = yield* app.installations(CREDENTIALS);
				assert.strictEqual(all[0]?.id, 3);
				assert.strictEqual(all[0]?.account, undefined);
				assertNone(O.fromUndefinedOr(all[0]?.account));
			}),
	);
});
