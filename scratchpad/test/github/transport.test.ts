import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import { Octokit } from "@octokit/core";
import type { OctokitResponse } from "@octokit/types";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { GitHubGraphQLError } from "../../effected/github/GraphQL.ts";
import { RetryPolicy } from "../../effected/github/Resilience.ts";
import { makeTransport } from "../../effected/github/internal/octokit.ts";
import { linkNext, rateLimitHeaders, scriptedFetch } from "./fixtures.ts";
const AnswerResponse = S.Struct({ answer: S.Finite });

const pendingFetch = () => {
	const started = Promise.withResolvers<RequestInit | undefined>();
	const pending = Promise.withResolvers<Response>();
	let aborts = 0;
	const fetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		started.resolve(init);
		init?.signal?.addEventListener(
			"abort",
			() => {
				aborts += 1;
				pending.reject(init.signal?.reason);
			},
			{ once: true },
		);
		return pending.promise;
	};
	fetch.preconnect = globalThis.fetch.preconnect;
	return { fetch, started: Effect.promise(() => started.promise), aborts: () => aborts };
};

describe("transport typed boundary and routes", () => {
	it.effect("retains the caller's free response type and supports unknown decoding", () =>
		Effect.gen(function* () {
			const script = scriptedFetch([{ status: 200, body: { answer: 42 } }]);
			const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
			const response: OctokitResponse<{ readonly answer: number }> = yield* transport.request<{
				readonly answer: number;
			}>("typed", "GET /answer", {});
			const answer: number = response.data.answer;
			assert.strictEqual(answer, 42);
			const unknownResponse: OctokitResponse<unknown> = yield* transport.request<unknown>("decoded", "/answer", {});
			const decoded = yield* S.decodeUnknownEffect(AnswerResponse)(unknownResponse.data);
			assert.strictEqual(decoded.answer, 42);
		}),
	);

	const routes: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
		["GET /repos/{owner}/{repo}", { owner: "o", repo: "r", q: "a b" }],
		["/repos/:owner/:repo", { owner: "o", repo: "r" }],
		["get /repos/{owner}/{repo}", { owner: "o", repo: "r" }],
		["POST /ignored", { method: "GET", url: "/repos/{owner}/{repo}", owner: "o", repo: "r" }],
		["GET /ignored", { method: undefined, url: undefined, q: "kept" }],
		["GET  /ignored", { q: "kept" }],
		["GET /answer ignored", { q: "kept" }],
		["OPTIONS /answer", { data: { answer: 42 } }],
		["GET https://example.invalid/answer", { headers: { "X-Custom": "yes" }, request: { redirect: "manual" } }],
	];
	for (const [route, params] of routes) {
		it.effect(`preserves Octokit route parsing and precedence: ${route}`, () =>
			Effect.gen(function* () {
				const expected = scriptedFetch([{ status: 200, body: {} }]);
				const actual = scriptedFetch([{ status: 200, body: {} }]);
				const octokit = new Octokit({
					baseUrl: "https://enterprise.invalid/api/v3",
					userAgent: "transport-test",
					request: { fetch: expected.fetch },
				});
				yield* Effect.promise(() => octokit.request(route, { ...params }));
				const transport = yield* makeTransport({
					retry: RetryPolicy.none,
					baseUrl: "https://enterprise.invalid/api/v3",
					userAgent: "transport-test",
					fetch: actual.fetch,
				});
				yield* transport.request<unknown>("route", route, params);
				assert.deepStrictEqual(actual.calls, expected.calls);
			}),
		);
	}
});

describe("transport thrown headers and classification", () => {
	for (const headers of [undefined, null, 42, "headers", [], ["x-ratelimit-remaining"], () => ({})]) {
		it.effect(`ignores malformed thrown headers: ${String(headers)}`, () =>
			Effect.gen(function* () {
				const script = scriptedFetch([{ status: 200, body: {} }]);
				const thrown = { status: 404, message: "missing", response: { headers } };
				const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
				const result = yield* transport
					.request<unknown>("malformed", "/answer", { request: { hook: () => Promise.reject(thrown) } })
					.pipe(Effect.flip);
				assert.strictEqual(result.cause, thrown);
				assert.strictEqual(result.kind, "notFound");
				assertNone(yield* transport.rateLimit);
			}),
		);
	}

	it.effect("rejects array headers even when they carry custom rate-limit properties", () =>
		Effect.gen(function* () {
			const headers = Object.assign([], rateLimitHeaders({ remaining: 12 }));
			const script = scriptedFetch([{ status: 200, body: {} }]);
			const thrown = { status: 404, message: "missing", response: { headers } };
			const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
			yield* transport
				.request<unknown>("array", "/answer", { request: { hook: () => Promise.reject(thrown) } })
				.pipe(Effect.flip);
			assertNone(yield* transport.rateLimit);
		}),
	);

	it.effect("preserves original REST and GraphQL classification payloads and valid headers", () =>
		Effect.gen(function* () {
			const headers = rateLimitHeaders({ remaining: 12 });
			const thrown = { status: 404, message: "missing", response: { headers, data: { message: "missing" } } };
			const script = scriptedFetch([{ status: 200, body: {} }]);
			const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
			const request = { hook: () => Promise.reject(thrown) };
			const rest = yield* transport.request<unknown>("rest", "/answer", { request }).pipe(Effect.flip);
			assert.deepStrictEqual(rest, GitHubError.fromOctokit("rest", thrown, 0));
			assert.strictEqual(rest.cause, thrown);
			const graphqlResult = yield* transport
				.graphql("graphql", "query { viewer { login } }", { request })
				.pipe(Effect.result);
			assertFailure(graphqlResult, GitHubGraphQLError.fromThrowable("graphql", thrown, 0));
			const graphql = graphqlResult.failure;
			assert.deepStrictEqual(graphql, GitHubGraphQLError.fromThrowable("graphql", thrown, 0));
			assert.strictEqual(graphql.cause, thrown);
			const snapshot = yield* transport.rateLimit;
			assertSome(snapshot, O.getOrThrow(snapshot));
			assert.strictEqual(snapshot.value.remaining, 12);
		}),
	);
});

describe("transport cancellation", () => {
	it.effect("retains pagination options, retries the current page, normalizes and completes", () =>
		Effect.gen(function* () {
			const script = scriptedFetch([
				{ status: 500, body: { message: "retry" } },
				{
					status: 200,
					body: { total_count: 2, items: [{ id: 1 }] },
					headers: linkNext("https://api.github.com/answers?page=2"),
				},
				{ status: 200, body: { total_count: 2, items: [{ id: 2 }] } },
			]);
			const unused = scriptedFetch([{ status: 400 }]);
			const signals: Array<AbortSignal | null | undefined> = [];
			const redirects: Array<RequestInit["redirect"]> = [];
			const fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
				signals.push(init?.signal);
				redirects.push(init?.redirect);
				return script.fetch(input, init);
			};
			fetch.preconnect = globalThis.fetch.preconnect;
			const originalSignal = yield* Effect.abortSignal;
			const transport = yield* makeTransport({
				token: Redacted.make("ghs_test"),
				retry: RetryPolicy.make({
					...RetryPolicy.none,
					maxRetries: 1,
					baseDelay: Duration.zero,
					maxDelay: Duration.zero,
				}),
				fetch: unused.fetch,
			});
			const source = transport.pageSource<{ readonly id: number }>("pages", "GET /answers", {
				request: { fetch, redirect: "manual", signal: originalSignal },
			});
			const first = yield* source.next;
			const second = yield* source.next;
			assertSome(first, O.getOrThrow(first));
			assertSome(second, O.getOrThrow(second));
			assert.strictEqual(first.value[0]?.id, 1);
			assert.strictEqual(second.value[0]?.id, 2);
			assertNone(yield* source.next);
			assertNone(yield* source.next);
			assert.strictEqual(unused.count(), 0);
			assert.strictEqual(script.count(), 3);
			assert.strictEqual(script.calls[0]?.url, script.calls[1]?.url);
			assert.strictEqual(script.queryOf(2).get("page"), "2");
			assert.deepStrictEqual(redirects, ["manual", "manual", "manual"]);
			for (const signal of signals) {
				assert.ok(signal);
				assert.notStrictEqual(signal, originalSignal);
			}
			assert.notStrictEqual(signals[0], signals[1]);
			assert.notStrictEqual(signals[1], signals[2]);
			assert.strictEqual(script.calls[2]?.headers.authorization, "token ghs_test");
		}),
	);

	it.effect("preserves GraphQL variables, defaults and request options", () =>
		Effect.gen(function* () {
			const expected = scriptedFetch([{ status: 200, body: { data: { answer: 42 } } }]);
			const actual = scriptedFetch([{ status: 200, body: { data: { answer: 42 } } }]);
			const unused = scriptedFetch([{ status: 400 }]);
			const document = "query Answer($id: ID!) { node(id: $id) { id } }";
			const octokit = new Octokit({ baseUrl: "https://enterprise.invalid/api/v3", request: { fetch: unused.fetch } });
			const variables = { id: "node", operationName: "Answer", headers: { "X-Custom": "yes" } };
			const oracle = yield* Effect.promise(() =>
				octokit.graphql<unknown>(document, { ...variables, request: { fetch: expected.fetch, redirect: "manual" } }),
			);
			const transport = yield* makeTransport({
				retry: RetryPolicy.none,
				baseUrl: "https://enterprise.invalid/api/v3",
				fetch: unused.fetch,
			});
			const result = yield* transport.graphql("answer", document, {
				...variables,
				request: { fetch: actual.fetch, redirect: "manual" },
			});
			assert.deepStrictEqual(result, oracle);
			assert.deepStrictEqual(actual.calls, expected.calls);
			assert.strictEqual(unused.count(), 0);
		}),
	);

	for (const mode of ["request", "pagination", "graphql"] as const) {
		it.effect(`aborts a pending ${mode} fetch when interrupted`, () =>
			Effect.gen(function* () {
				const pending = pendingFetch();
				const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: pending.fetch });
				const operation =
					mode === "pagination"
						? transport.pageSource<unknown>("page", "GET /answers", {}).next
						: mode === "graphql"
							? transport.graphql("graphql", "query { viewer { login } }", {})
							: transport.request<unknown>("request", "GET /answer", {});
				const fiber = yield* Effect.forkChild(operation);
				const init = yield* pending.started;
				yield* Fiber.interrupt(fiber);
				assert.ok(init?.signal);
				assert.strictEqual(init.signal.aborted, true);
				assert.strictEqual(pending.aborts(), 1);
			}),
		);
	}
});
