import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import type * as Config from "effect/Config";
import { assertNone, assertSome, assertExitFailure } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import { pullFixture, repositoryFixture } from "./fixtures.ts";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { GraphQLDocument } from "../../effected/github/GraphQL.ts";
import { RateLimitSnapshot, RetryPolicy } from "../../effected/github/Resilience.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import type { Reply } from "./fixtures.ts";
import { linkNext, rateLimitHeaders, scriptedFetch } from "./fixtures.ts";

const TOKEN = Redacted.make("ghs_test");

/** No sleeping between retries, so retry counts are testable without a clock. */
const INSTANT_RETRY = RetryPolicy.make({
	maxRetries: 2,
	baseDelay: Duration.zero,
	maxDelay: Duration.zero,
	respectRetryAfter: false,
	maxServerAdvisedDelay: Duration.zero,
});

const withClient = <A, E>(
	name: string,
	replies: ReadonlyArray<Reply>,
	use: (client: GitHubClient["Service"], script: ReturnType<typeof scriptedFetch>) => Effect.Effect<A, E>,
	options: { retry?: RetryPolicy | "off" } = {},
): void => {
	const script = scriptedFetch(replies);
	const layer = GitHubClient.layerFromToken({ token: TOKEN, fetch: script.fetch, retry: options.retry ?? "off" });
	it.layer(layer, { timeout: "30 seconds" })((it) => {
		it.effect(name, () => Effect.flatMap(GitHubClient, (client) => use(client, script)));
	});
};

describe("GitHubClient.request", () => {
	withClient(
		"returns the route's typed data",
		[{ status: 200, body: { default_branch: "main", node_id: "R_1" } }],
		(client) =>
			Effect.gen(function* () {
				const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
				// `default_branch` is typed as string by the route alone — no cast.
				assert.strictEqual(repo.default_branch, "main");
				assert.strictEqual(repo.node_id, "R_1");
			}),
	);

	withClient("sends the route's method and interpolated path", [{ status: 200, body: {} }], (client, script) =>
		Effect.gen(function* () {
			yield* client.request("GET /repos/{owner}/{repo}", { owner: "acme", repo: "widget" });
			assert.strictEqual(script.calls[0]?.method, "GET");
			assert.include(script.calls[0]?.url ?? "", "/repos/acme/widget");
		}),
	);

	withClient("authenticates with the token", [{ status: 200, body: {} }], (client, script) =>
		Effect.gen(function* () {
			yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
			assert.strictEqual(script.calls[0]?.headers.authorization, "token ghs_test");
		}),
	);

	withClient("classifies a 404 as notFound", [{ status: 404, body: { message: "Not Found" } }], (client) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }));
			assert.strictEqual(error.kind, "notFound");
			assert.strictEqual(error.status, 404);
			assert.strictEqual(error.operation, "GET /repos/{owner}/{repo}");
		}),
	);

	withClient(
		"classifies a 422 saying already-exists structurally",
		[{ status: 422, body: { message: "Validation Failed", errors: [{ message: "Reference already exists" }] } }],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					client.request("POST /repos/{owner}/{repo}/git/refs", { owner: "o", repo: "r", ref: "x", sha: "y" }),
				);
				assert.strictEqual(error.kind, "alreadyExists");
			}),
	);

	withClient(
		"classifies the releases endpoint's code-only duplicate as alreadyExists and carries the entry",
		[
			{
				status: 422,
				body: {
					message: "Validation Failed",
					errors: [{ resource: "Release", code: "already_exists", field: "tag_name" }],
				},
			},
		],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					client.request("POST /repos/{owner}/{repo}/releases", { owner: "o", repo: "r", tag_name: "v1.0.0" }),
				);
				assert.strictEqual(error.kind, "alreadyExists");
				assert.deepStrictEqual(
					error.validation?.map((entry) => ({ ...entry })),
					[{ resource: "Release", field: "tag_name", code: "already_exists" }],
				);
			}),
	);

	{
		const cases = (["missing", "missing_field", "invalid", "unprocessable", "custom"] as const).map((code) => ({
			code,
			script: scriptedFetch([
				{
					status: 422,
					body: { message: "Validation Failed", errors: [{ resource: "Release", code, field: "tag_name" }] },
				},
			]),
		}));
		class ValidationClients extends Context.Service<
			ValidationClients,
			ReadonlyArray<{ readonly code: (typeof cases)[number]["code"]; readonly client: GitHubClient["Service"] }>
		>()("@beep/scratchpad/test/github/GitHubClient.test/ValidationClients") {}
		it.layer(
			Layer.effect(
				ValidationClients,
				Effect.forEach(cases, ({ code, script }) =>
					Layer.build(GitHubClient.layerFromToken({ token: TOKEN, fetch: script.fetch, retry: "off" })).pipe(
						Effect.map((context) => ({ code, client: Context.get(context, GitHubClient) })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("classifies every other documented validation code as rejected, keeping the code inspectable", () =>
				Effect.gen(function* () {
					const clients = yield* ValidationClients;
					yield* Effect.forEach(
						clients,
						({ code, client }) =>
							Effect.gen(function* () {
								const error = yield* Effect.flip(
									client.request("POST /repos/{owner}/{repo}/releases", { owner: "o", repo: "r", tag_name: "v1" }),
								);
								assert.strictEqual(error.kind, "rejected", code);
								assert.isFalse(error.retryable, code);
								assert.isTrue(GitHubError.hasValidationCode(code)(error), code);
								assert.isFalse(GitHubError.hasValidationCode("already_exists")(error), code);
							}),
						{ discard: true },
					);
				}),
			);
		});
	}

	withClient(
		"leaves validation absent on a prose-only 422",
		[{ status: 422, body: { message: "Update is not a fast forward" } }],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					client.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
						owner: "o",
						repo: "r",
						ref: "heads/x",
						sha: "y",
					}),
				);
				assert.strictEqual(error.kind, "rejected");
				assert.isUndefined(error.validation);
			}),
	);

	withClient(
		"records rate-limit headers off a successful response",
		[{ status: 200, body: {}, headers: rateLimitHeaders({ remaining: 4_321, resetEpochSeconds: 1_700_000_090 }) }],
		(client) =>
			Effect.gen(function* () {
				assertNone(yield* client.rateLimit);
				yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
				const snapshot = yield* client.rateLimit;
				assertSome(
					snapshot,
					RateLimitSnapshot.make({ remaining: 4_321, limit: 5_000, resetEpochSeconds: 1_700_000_090 }),
				);
			}),
	);

	withClient(
		"records rate-limit headers off a FAILED response too",
		[
			{
				status: 403,
				body: { message: "rate limited" },
				headers: rateLimitHeaders({ remaining: 0, resetEpochSeconds: 1_700_000_090 }),
			},
		],
		(client) =>
			Effect.gen(function* () {
				yield* Effect.flip(client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }));
				const snapshot = yield* client.rateLimit;
				assertSome(snapshot, O.getOrThrow(snapshot));
				assert.isTrue(snapshot.value.isExhausted);
			}),
	);
});

describe("GitHubClient retry", () => {
	withClient(
		"retries a 500 and succeeds",
		[
			{ status: 500, body: { message: "boom" } },
			{ status: 200, body: { default_branch: "main" } },
		],
		(client, script) =>
			Effect.gen(function* () {
				const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
				assert.strictEqual(repo.default_branch, "main");
				assert.strictEqual(script.count(), 2);
			}),
		{ retry: INSTANT_RETRY },
	);

	withClient(
		"gives up after maxRetries and surfaces the failure",
		[{ status: 503, body: { message: "down" } }],
		(client, script) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }));
				assert.strictEqual(error.kind, "transport");
				assert.strictEqual(script.count(), 3, "one attempt plus two retries");
			}),
		{ retry: INSTANT_RETRY },
	);

	withClient(
		"never retries a 404",
		[{ status: 404, body: { message: "Not Found" } }],
		(client, script) =>
			Effect.gen(function* () {
				yield* Effect.flip(client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }));
				assert.strictEqual(script.count(), 1);
			}),
		{ retry: INSTANT_RETRY },
	);

	withClient(
		"never retries a permission denial",
		[{ status: 403, body: { message: "Resource not accessible by integration" } }],
		(client, script) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }));
				assert.strictEqual(error.kind, "unauthorized");
				assert.strictEqual(script.count(), 1);
			}),
		{ retry: INSTANT_RETRY },
	);

	withClient(
		"does not retry at all when retry is off",
		[{ status: 500, body: { message: "boom" } }],
		(client, script) =>
			Effect.gen(function* () {
				yield* Effect.flip(client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }));
				assert.strictEqual(script.count(), 1);
			}),
	);
});

describe("GitHubClient.paginate", () => {
	const page = (numbers: ReadonlyArray<number>, next?: string): Reply => ({
		status: 200,
		body: numbers.map((number) => ({ number })),
		...(next !== undefined ? { headers: linkNext(next) } : {}),
	});

	withClient(
		"follows Link headers across pages",
		[
			page([1, 2], "https://api.github.com/repositories/1/pulls?page=2"),
			page([3, 4], "https://api.github.com/repositories/1/pulls?page=3"),
			page([5]),
		],
		(client, script) =>
			Effect.gen(function* () {
				const pulls = yield* client.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" });
				assert.deepStrictEqual(
					pulls.map((pull) => pull.number),
					[1, 2, 3, 4, 5],
				);
				assert.strictEqual(script.count(), 3);
			}),
	);

	withClient(
		"stops issuing requests at maxPages",
		[
			page([1, 2], "https://api.github.com/repositories/1/pulls?page=2"),
			page([3, 4], "https://api.github.com/repositories/1/pulls?page=3"),
			page([5]),
		],
		(client, script) =>
			Effect.gen(function* () {
				const pulls = yield* client.paginate(
					"GET /repos/{owner}/{repo}/pulls",
					{ owner: "o", repo: "r" },
					PageOptions.make({ maxPages: 2 }),
				);
				assert.lengthOf(pulls, 4);
				assert.strictEqual(script.count(), 2, "the third page must never be requested");
			}),
	);

	withClient("requests the caller's page size", [page([1])], (client, script) =>
		Effect.gen(function* () {
			yield* client.paginate(
				"GET /repos/{owner}/{repo}/pulls",
				{ owner: "o", repo: "r" },
				PageOptions.make({ perPage: 25 }),
			);
			assert.strictEqual(script.queryOf(0).get("per_page"), "25");
		}),
	);

	withClient("defaults to GitHub's maximum page size", [page([1])], (client, script) =>
		Effect.gen(function* () {
			yield* client.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" });
			assert.strictEqual(script.queryOf(0).get("per_page"), "100");
		}),
	);

	withClient("lets an explicit parameter override the default page size", [page([1])], (client, script) =>
		Effect.gen(function* () {
			yield* client.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r", per_page: 7 });
			assert.strictEqual(script.queryOf(0).get("per_page"), "7");
		}),
	);

	withClient(
		"surfaces a mid-walk failure as a typed error",
		[page([1, 2], "https://api.github.com/repositories/1/pulls?page=2"), { status: 500, body: { message: "boom" } }],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(client.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" }));
				assert.strictEqual(error.kind, "transport");
			}),
	);

	withClient(
		"retries a failed page without skipping it",
		[
			page([1, 2], "https://api.github.com/repositories/1/pulls?page=2"),
			{ status: 500, body: { message: "boom" } },
			page([3, 4]),
		],
		(client, script) =>
			Effect.gen(function* () {
				const pulls = yield* client.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" });
				// The retried page must be page two, not page three: octokit's cursor
				// only advances on success, which is what makes per-page retry safe.
				assert.deepStrictEqual(
					pulls.map((pull) => pull.number),
					[1, 2, 3, 4],
				);
				assert.strictEqual(script.count(), 3);
			}),
		{ retry: INSTANT_RETRY },
	);

	withClient(
		"stream form stops the walk when the consumer stops",
		[
			page([1, 2], "https://api.github.com/repositories/1/pulls?page=2"),
			page([3, 4], "https://api.github.com/repositories/1/pulls?page=3"),
			page([5]),
		],
		(client, script) =>
			Effect.gen(function* () {
				const first = yield* Stream.runCollect(
					client.paginateStream("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" }).pipe(Stream.take(3)),
				);
				assert.lengthOf(first, 3);
				assert.isBelow(script.count(), 3, "pages beyond the taken items must not be fetched");
			}),
	);
});

describe("GitHubClient.requestDecoded", () => {
	const Payload = S.Struct({ id: S.Int, name: S.String });

	withClient(
		"decodes an undocumented route through its schema",
		[{ status: 200, body: { id: 7, name: "seven" } }],
		(client) =>
			Effect.gen(function* () {
				const value = yield* client.requestDecoded("GET /preview/thing", {}, Payload);
				assert.deepStrictEqual(value, { id: 7, name: "seven" });
			}),
	);

	withClient(
		"fails as a decode error when the payload does not match",
		[{ status: 200, body: { id: "not a number" } }],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(client.requestDecoded("GET /preview/thing", {}, Payload));
				assert.strictEqual(error.kind, "decode");
				assert.strictEqual(error._tag, "GitHubError", "a SchemaError must never escape");
			}),
	);

	withClient("forwards custom headers", [{ status: 200, body: { id: 1, name: "x" } }], (client, script) =>
		Effect.gen(function* () {
			yield* client.requestDecoded(
				"GET /preview/thing",
				{ headers: { "x-github-api-version": "2026-03-10" } },
				Payload,
			);
			assert.strictEqual(script.calls[0]?.headers["x-github-api-version"], "2026-03-10");
		}),
	);
});

describe("GitHubClient.graphql", () => {
	const Viewer = GraphQLDocument.make({
		name: "viewerLogin",
		document: "query { viewer { login } }",
		response: S.Struct({ viewer: S.Struct({ login: S.String }) }),
	})<Record<string, never>>();

	withClient(
		"decodes the document's response",
		[{ status: 200, body: { data: { viewer: { login: "octocat" } } } }],
		(client) =>
			Effect.gen(function* () {
				const result = yield* client.graphql(Viewer, {});
				assert.strictEqual(result.viewer.login, "octocat");
			}),
	);

	withClient(
		"names the document, not the transport, in the error",
		[{ status: 401, body: { message: "Bad credentials" } }],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(client.graphql(Viewer, {}));
				assert.strictEqual(error.operation, "viewerLogin");
				assert.strictEqual(error.kind, "unauthorized");
			}),
	);

	withClient(
		"carries GraphQL's own error list",
		[{ status: 200, body: { data: null, errors: [{ message: "Project already exists", type: "UNPROCESSABLE" }] } }],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(client.graphql(Viewer, {}));
				assert.lengthOf(error.errors, 1);
				assert.strictEqual(error.errors[0]?.message, "Project already exists");
				assert.strictEqual(error.kind, "alreadyExists", "the discriminant a consumer had to grep for");
			}),
	);

	withClient(
		"fails as a decode error when the response does not match",
		[{ status: 200, body: { data: { viewer: { login: 42 } } } }],
		(client) =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(client.graphql(Viewer, {}));
				assert.strictEqual(error.kind, "decode");
				assert.strictEqual(error._tag, "GitHubGraphQLError");
			}),
	);
});

describe("GitHubClient.layerFromConfig", () => {
	{
		const script = scriptedFetch([{ status: 200, body: { default_branch: "main" } }]);
		const layer = GitHubClient.layerFromConfig({ fetch: script.fetch, retry: "off" }).pipe(
			Layer.provide(
				Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { GITHUB_TOKEN: "ghs_cfg" } })),
			),
		);
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("reads GITHUB_TOKEN through the ambient ConfigProvider", () =>
				Effect.gen(function* () {
					const client = yield* GitHubClient;
					const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
					assert.strictEqual(repo.default_branch, "main");
					assert.strictEqual(script.calls[0]?.headers.authorization, "token ghs_cfg");
				}),
			);
		});
	}
	{
		class ConstructionError extends Context.Service<ConstructionError, Config.ConfigError>()(
			"@beep/scratchpad/test/github/GitHubClient.test/ConstructionError",
		) {}
		const layer = GitHubClient.layerFromConfig().pipe(
			Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} }))),
		);
		it.layer(Layer.effect(ConstructionError, Layer.build(layer).pipe(Effect.flip)), { timeout: "30 seconds" })((it) => {
			it.effect("fails with a ConfigError when no token is configured", () =>
				Effect.gen(function* () {
					const error = yield* ConstructionError;
					// No configured token fails construction rather than producing a wire failure.
					assert.strictEqual(error._tag, "ConfigError");
				}),
			);
		});
	}
	{
		const script = scriptedFetch([{ status: 200, body: {} }]);
		const layer = GitHubClient.layerFromConfig({ name: "MY_TOKEN", fetch: script.fetch, retry: "off" }).pipe(
			Layer.provide(
				Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { MY_TOKEN: "ghs_named" } })),
			),
		);
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("reads a caller-named key", () =>
				Effect.gen(function* () {
					const client = yield* GitHubClient;
					yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
					assert.strictEqual(script.calls[0]?.headers.authorization, "token ghs_named");
				}),
			);
		});
	}
});

describe("GitHubClient.makeTest", () => {
	{
		it.layer(
			GitHubClient.layerFixture({
				request: { "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture({ default_branch: "trunk" })) },
			}),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("answers a stubbed member", () =>
				Effect.gen(function* () {
					const fixture = yield* GitHubClient;
					const double = GitHubClient.makeTest({ request: fixture.request });
					const repo = yield* double.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
					assert.strictEqual(repo.default_branch, "trunk");
				}),
			);
		});
	}

	it("dies loudly on an unstubbed member rather than fabricating an answer", () => {
		const double = GitHubClient.makeTest({});
		assert.throws(
			() => double.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" }),
			/was called but not stubbed/,
		);
	});

	it.effect("reports no rate-limit observation by default", () =>
		Effect.gen(function* () {
			assertNone(yield* GitHubClient.makeTest({}).rateLimit);
		}),
	);
});

describe("GitHubClient.layerFixture", () => {
	{
		const requested: Array<RecordedCall> = [];
		const items = Array.from({ length: 250 }, (_, index) => ({ number: index }));
		const layer = GitHubClient.layerFixture({
			paginate: { "GET /repos/{owner}/{repo}/pulls": Result.succeed(items.map(pullFixture)) },
			requested,
		});
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("pages a recorded collection through the LIVE pagination engine", () =>
				Effect.gen(function* () {
					const pulls = yield* Effect.flatMap(GitHubClient, (client) =>
						client.paginate(
							"GET /repos/{owner}/{repo}/pulls",
							{ owner: "o", repo: "r" },
							PageOptions.make({ perPage: 100, maxPages: 2 }),
						),
					);
					// The double it replaces returned every recorded page regardless of what
					// the caller asked for, which made this assertion impossible to write.
					assert.lengthOf(pulls, 200);
					assert.deepStrictEqual(requested, [
						{
							kind: "paginate",
							route: "GET /repos/{owner}/{repo}/pulls",
							params: { owner: "o", repo: "r" },
							perPage: 100,
						},
					]);
				}),
			);
		});
	}

	{
		const requested: Array<RecordedCall> = [];
		const layer = GitHubClient.layerFixture({
			request: { "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture({ default_branch: "main" })) },
			requested,
		});
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("records a request call WITH its params, not only paginated reads", () =>
				Effect.gen(function* () {
					// Before this, `request` named its params `_params` and never appended,
					// so a suite whose methods all go through `request` could assert nothing
					// about them — the gap that made a consumer hand-roll its own harness.
					yield* Effect.flatMap(GitHubClient, (client) =>
						client.request("GET /repos/{owner}/{repo}", { owner: "acme", repo: "widgets" }),
					);
					assert.deepStrictEqual(requested, [
						{
							kind: "request",
							route: "GET /repos/{owner}/{repo}",
							params: { owner: "acme", repo: "widgets" },
						},
					]);
				}),
			);
		});
	}

	{
		const layer = GitHubClient.layerFixture({
			request: { "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture({ default_branch: "main" })) },
		});
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("answers a recorded single request", () =>
				Effect.gen(function* () {
					const repo = yield* Effect.flatMap(GitHubClient, (client) =>
						client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }),
					);
					assert.strictEqual(repo.default_branch, "main");
				}),
			);
		});
	}

	{
		it.layer(GitHubClient.layerFixture({}), { timeout: "30 seconds" })((it) => {
			it.effect("DIES by default when a route has no recorded fixture", () =>
				Effect.gen(function* () {
					// A missing fixture is test wiring, not a domain condition. It must not
					// enter the error channel, because a consumer that catches GitHubError
					// per resource would absorb it into a different execution path and the
					// assertion would fail for a new reason with nothing naming a fixture.
					const exit = yield* Effect.exit(
						Effect.flatMap(GitHubClient, (client) =>
							client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }),
						),
					);
					assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
					assert.include(String(exit), "no fixture for GET /repos/{owner}/{repo}");
					// Proves it is a defect, not a typed failure: catching the error channel
					// must NOT absorb it.
					const stillDies = yield* Effect.exit(
						Effect.flatMap(GitHubClient, (client) =>
							client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }),
						).pipe(Effect.catchTag("GitHubError", () => Effect.succeed("absorbed"))),
					);
					assertExitFailure(stillDies, stillDies.pipe(Exit.getCause, O.getOrThrow));
				}),
			);
		});
	}

	{
		const requested: Array<RecordedCall> = [];
		const doc = GraphQLDocument.make({
			name: "ProbeDocument",
			document: "query ProbeDocument($login:String!){ user(login:$login){ id } }",
			response: S.Struct({ user: S.Struct({ id: S.String }) }),
		})<{ readonly login: string }>();
		it.layer(
			GitHubClient.layerFixture({
				graphql: { ProbeDocument: { user: { id: "U_1" } } },
				requested,
			}),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("records a graphql call under the document name, with its variables", () =>
				Effect.gen(function* () {
					// The graphql surface records too, keyed by document name rather than a
					// route. Nothing asserted it, so the recorder's claim to cover "every
					// call" rested on three of four surfaces.
					yield* Effect.flatMap(GitHubClient, (client) => client.graphql(doc, { login: "acme" }));
					assert.deepStrictEqual(requested, [{ kind: "graphql", route: "ProbeDocument", params: { login: "acme" } }]);
				}),
			);
		});
	}

	{
		const requested: Array<RecordedCall> = [];
		it.layer(
			GitHubClient.layerFixture({
				paginate: { "GET /repos/{owner}/{repo}/pulls": Result.fail(GitHubError.notFound("read", "pulls")) },
				requested,
			}),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("records a paginated read that FAILS, so a suite can tell it apart from one never made", () =>
				Effect.gen(function* () {
					// Every other surface records before its checks; paginate used to record
					// after, so a stubbed-error read left `requested` empty and a suite could
					// not distinguish "not called" from "called and failed" — the one case
					// the error-as-response fixture is for.
					yield* Effect.flip(
						Effect.flatMap(GitHubClient, (client) =>
							client.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" }),
						),
					);
					assert.lengthOf(requested, 1);
					assert.strictEqual(requested[0]?.kind, "paginate");
					assert.deepStrictEqual(requested[0]?.params, { owner: "o", repo: "r" });
				}),
			);
		});
	}

	{
		it.layer(
			GitHubClient.layerFixture({
				request: { "GET /repos/{owner}/{repo}": Result.fail(GitHubError.notFound("read", "repo o/r")) },
			}),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("a recorded GitHubError IS the response, which is how a 404 is stubbed deliberately", () =>
				Effect.gen(function* () {
					// The mechanism the `unstubbed` docstring's advice depends on: absence
					// means unwired, a recorded error means "this route fails, and here is
					// why". Without this, "prefer stubbing the 404 explicitly" was advice
					// with nothing behind it.
					const error = yield* Effect.flip(
						Effect.flatMap(GitHubClient, (client) =>
							client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }),
						),
					);
					assert.instanceOf(error, GitHubError);
					assert.strictEqual(error.kind, "notFound");
				}),
			);
		});
	}

	{
		it.layer(GitHubClient.layerFixture({ unstubbed: "fail" }), { timeout: "30 seconds" })((it) => {
			it.effect('unstubbed: "fail" restores the typed notFound, for a suite whose subject is 404 handling', () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						Effect.flatMap(GitHubClient, (client) =>
							client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" }),
						),
					);
					assert.instanceOf(error, GitHubError);
					assert.strictEqual(error.kind, "notFound");
				}),
			);
		});
	}

	{
		it.layer(GitHubClient.layerFixture({ unstubbed: "empty" }), { timeout: "30 seconds" })((it) => {
			it.effect('unstubbed: "empty" serves an empty value, for a suite whose subject is decisions', () =>
				Effect.gen(function* () {
					const items = yield* Effect.flatMap(GitHubClient, (client) =>
						client.paginate("GET /repos/{owner}/{repo}/pulls", { owner: "o", repo: "r" }),
					);
					assert.lengthOf(items, 0);
				}),
			);
		});
	}

	{
		const snapshot = RateLimitSnapshot.make({ remaining: 10, limit: 5000, resetEpochSeconds: 1 });
		it.layer(GitHubClient.layerFixture({ rateLimit: snapshot }), { timeout: "30 seconds" })((it) => {
			it.effect("serves a recorded rate-limit snapshot", () =>
				Effect.gen(function* () {
					const observed = yield* Effect.flatMap(GitHubClient, (client) => client.rateLimit);
					assertSome(observed, snapshot);
				}),
			);
		});
	}
});
