import { GitHubError } from "@beep/github/GitHubError";
import { GitHubGraphQLError } from "@beep/github/GraphQL";
import { makeTransport } from "@beep/github/internal/octokit";
import { RateLimitSnapshot, RetryPolicy } from "@beep/github/Resilience";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import { Octokit } from "@octokit/core";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { linkNext, rateLimitHeaders, scriptedFetch } from "./support/fixtures.ts";
import type { Transport } from "@beep/github/internal/octokit";
import type { OctokitResponse } from "@octokit/types";
import type { Reply } from "./support/fixtures.ts";

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
      { once: true }
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
    })
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
      })
    );
  }
});

describe("transport thrown headers and classification", () => {
  for (const seconds of ["9007199254741", "1e308"]) {
    for (const mode of ["retry-after", "reset"] as const) {
      it.effect(`returns typed REST and GraphQL HTTP failures for oversized ${mode} ${seconds}`, () =>
        Effect.gen(function* () {
          const headers =
            mode === "retry-after"
              ? { "retry-after": seconds }
              : { "x-ratelimit-remaining": "0", "x-ratelimit-reset": seconds };
          const script = scriptedFetch([{ status: 429, body: { message: "limited" }, headers }]);
          const transport = yield* makeTransport({ retry: RetryPolicy.default, fetch: script.fetch });
          const rest = yield* transport.request<unknown>("rest", "/answer", {}).pipe(Effect.flip);
          assert.strictEqual(rest._tag, "GitHubError");
          assert.strictEqual(rest.kind, "rateLimited");
          assert.strictEqual(rest.status, 429);
          assert.strictEqual(rest.retryAfterMillis, Number.MAX_SAFE_INTEGER);
          assert.isTrue(S.is(S.Int)(rest.retryAfterMillis));
          assert.isDefined(rest.cause);
          assert.isFalse(RetryPolicy.default.retries(rest));
          assert.strictEqual(script.count(), 1);
          const graphqlResult = yield* transport
            .graphql("graphql", "query { viewer { login } }", {})
            .pipe(Effect.result);
          const graphql = yield* graphqlResult.pipe(Effect.fromResult, Effect.flip, Effect.orDie);
          assertFailure(graphqlResult, graphql);
          assert.strictEqual(graphql._tag, "GitHubGraphQLError");
          assert.strictEqual(graphql.kind, "rateLimited");
          assert.strictEqual(graphql.retryAfterMillis, Number.MAX_SAFE_INTEGER);
          assert.isTrue(S.is(S.Int)(graphql.retryAfterMillis));
          assert.isDefined(graphql.cause);
          assert.isFalse(RetryPolicy.default.retries(graphql));
          assert.strictEqual(script.count(), 2);
        })
      );
    }
  }

  it.effect("captures top-level headers from an HTTP-200 GraphQL error response", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([
        {
          status: 200,
          body: { data: { viewer: null }, errors: [{ message: "missing", type: "NOT_FOUND" }] },
          headers: rateLimitHeaders({ remaining: 12, limit: 5000, resetEpochSeconds: 1_700_000_090 }),
        },
      ]);
      const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
      const result = yield* transport.graphql("viewer", "query { viewer { login } }", {}).pipe(Effect.result);
      const error = yield* result.pipe(Effect.fromResult, Effect.flip, Effect.orDie);
      assertFailure(result, error);
      assert.strictEqual(error.kind, "notFound");
      assert.strictEqual(error.errors[0]?.message, "missing");
      assert.isDefined(error.cause);
      const snapshot = yield* transport.rateLimit;
      assertSome(snapshot, RateLimitSnapshot.make({ remaining: 12, limit: 5000, resetEpochSeconds: 1_700_000_090 }));
      assert.strictEqual(script.count(), 1);
    })
  );

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
        const rateLimit1 = yield* transport.rateLimit;
        assertNone(rateLimit1);
      })
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
      const rateLimit2 = yield* transport.rateLimit;
      assertNone(rateLimit2);
    })
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
    })
  );
});

const priorSnapshot = RateLimitSnapshot.make({ remaining: 12, limit: 5000, resetEpochSeconds: 1_700_000_000 });

/** The seed reply that records {@link priorSnapshot}, when the case retains one. */
const seedReplies = (retained: boolean): ReadonlyArray<Reply> =>
  retained ? [{ status: 200, body: {}, headers: rateLimitHeaders(priorSnapshot) }] : [];

/** Make the seed request so the prior snapshot is recorded, when the case retains one. */
const seedPrior = Effect.fnUntraced(function* (transport: Transport, retained: boolean) {
  if (!retained) return;
  yield* transport.request("seed", "/seed", {});
  const rateLimit3 = yield* transport.rateLimit;
  assertSome(rateLimit3, priorSnapshot);
});

/** The snapshot survives an invalid reset only when an earlier response recorded it. */
const assertRetainedSnapshot = Effect.fnUntraced(function* (transport: Transport, retained: boolean) {
  const snapshot = yield* transport.rateLimit;
  if (retained) assertSome(snapshot, priorSnapshot);
  else assertNone(snapshot);
});

const deliversPayload = Effect.fnUntraced(function* (transport: Transport, mode: "request" | "pagination") {
  if (mode === "pagination") {
    const source = transport.pageSource<{ readonly answer: number }>("pages", "GET /answers", {});
    const next4 = yield* source.next;
    assertSome(next4, [{ answer: 42 }]);
    const next5 = yield* source.next;
    assertNone(next5);
    return;
  }
  const response = yield* transport.request<{ readonly answer: number }>("answer", "/answer", {});
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(response.data, { answer: 42 });
});

const limitedOperation = (
  transport: Transport,
  mode: "request" | "pagination" | "graphql"
): Effect.Effect<unknown, GitHubError | GitHubGraphQLError> => {
  if (mode === "pagination") return transport.pageSource<unknown>("limited", "GET /answers", {}).next;
  if (mode === "graphql") return transport.graphql("limited", "query { viewer { login } }", {});
  return transport.request("limited", "/answer", {});
};

const assertLimited = (error: GitHubError | GitHubGraphQLError, mode: "request" | "pagination" | "graphql"): void => {
  assert.strictEqual(error._tag, mode === "graphql" ? "GitHubGraphQLError" : "GitHubError");
  assert.strictEqual(error.kind, "rateLimited");
  if (error._tag === "GitHubError") assert.strictEqual(error.status, 429);
  assert.strictEqual(error.operation, "limited");
  assert.strictEqual(error.reason, "limited");
  assert.strictEqual(error.retryAfterMillis, Number.MAX_SAFE_INTEGER);
  assert.isDefined(error.cause);
  assert.isFalse(RetryPolicy.default.retries(error));
};

const invalidResetHeaders = (reset: string) => ({
  "x-ratelimit-remaining": "0",
  "x-ratelimit-limit": "5000",
  "x-ratelimit-reset": reset,
});

/** Every invalid reset, each with and without a snapshot recorded beforehand. */
const snapshotCases = A.flatMap(["9007199254740992", "1e308"], (reset) =>
  A.map([false, true], (retained) => ({ reset, retained, headers: invalidResetHeaders(reset) }))
);

const deliveryCases = A.flatMap(snapshotCases, (snapshotCase) =>
  A.map(["request", "pagination"] as const, (mode) => ({ ...snapshotCase, mode }))
);

const failureCases = A.flatMap(snapshotCases, (snapshotCase) =>
  A.map(["request", "pagination", "graphql"] as const, (mode) => ({ ...snapshotCase, mode }))
);

/** A paginated read answers a page array; a single request answers the object itself. */
const answerBody = (mode: "request" | "pagination"): unknown =>
  mode === "pagination" ? [{ answer: 42 }] : { answer: 42 };

describe("transport invalid rate-limit snapshots", () => {
  for (const { reset, retained, headers, mode } of deliveryCases) {
    it.effect(`delivers ${mode} payloads with invalid reset ${reset}, prior snapshot ${retained}`, () =>
      Effect.gen(function* () {
        const script = scriptedFetch([...seedReplies(retained), { status: 200, body: answerBody(mode), headers }]);
        const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
        yield* seedPrior(transport, retained);
        yield* deliversPayload(transport, mode);
        yield* assertRetainedSnapshot(transport, retained);
        assert.strictEqual(script.count(), A.length(seedReplies(retained)) + 1);
      })
    );
  }
  for (const { reset, retained, headers, mode } of failureCases) {
    it.effect(`classifies ${mode} HTTP failures with invalid reset ${reset}, prior snapshot ${retained}`, () =>
      Effect.gen(function* () {
        const script = scriptedFetch([
          ...seedReplies(retained),
          { status: 429, body: { message: "limited" }, headers },
        ]);
        const transport = yield* makeTransport({ retry: RetryPolicy.default, fetch: script.fetch });
        yield* seedPrior(transport, retained);
        const error = yield* limitedOperation(transport, mode).pipe(Effect.flip, Effect.orDie);
        assertLimited(error, mode);
        yield* assertRetainedSnapshot(transport, retained);
        assert.strictEqual(script.count(), A.length(seedReplies(retained)) + 1);
      })
    );
  }
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
      const next6 = yield* source.next;
      assertNone(next6);
      const next7 = yield* source.next;
      assertNone(next7);
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
    })
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
        octokit.graphql<unknown>(document, { ...variables, request: { fetch: expected.fetch, redirect: "manual" } })
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
    })
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
      })
    );
  }
});

// A write GitHub may already have applied is not repeated on an ambiguous failure: the 502 stands for a
// request that reached GitHub and lost its response. Reads, and writes GitHub refused by rate limit,
// still retry.
describe("transport write retry safety", () => {
  const twoRetries = RetryPolicy.make({
    ...RetryPolicy.none,
    maxRetries: 2,
    baseDelay: Duration.zero,
    maxDelay: Duration.zero,
  });
  const lostResponse: Reply = { status: 502, body: { message: "Bad Gateway" } };
  const replyMutation = `mutation ($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) { comment { id } }
}`;

  for (const route of ["POST /repos/acme/widget/issues/7/comments", "PATCH /repos/acme/widget/issues/comments/9"]) {
    it.effect(`sends ${route} once when the response is lost`, () =>
      Effect.gen(function* () {
        const script = scriptedFetch([lostResponse, { status: 201, body: { id: 1 } }]);
        const transport = yield* makeTransport({ retry: twoRetries, fetch: script.fetch });
        const error = yield* transport.request("write", route, { body: "hello" }).pipe(Effect.flip);
        assert.strictEqual(error.kind, "transport");
        assert.strictEqual(script.count(), 1);
      })
    );
  }

  it.effect("retries a read after a server error", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([lostResponse, { status: 200, body: { id: 1 } }]);
      const transport = yield* makeTransport({ retry: twoRetries, fetch: script.fetch });
      yield* transport.request("read", "GET /repos/acme/widget/issues/7", {});
      assert.strictEqual(script.count(), 2);
    })
  );

  it.effect("retries a write GitHub refused by rate limit", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([
        { status: 429, body: { message: "slow down" }, headers: { "retry-after": "0" } },
        { status: 201, body: { id: 1 } },
      ]);
      const transport = yield* makeTransport({ retry: twoRetries, fetch: script.fetch });
      yield* transport.request("write", "POST /repos/acme/widget/issues/7/comments", { body: "hello" });
      assert.strictEqual(script.count(), 2);
    })
  );

  it.effect("posts a review-thread reply once when the response is lost", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([lostResponse, { status: 200, body: { data: { ok: true } } }]);
      const transport = yield* makeTransport({ retry: twoRetries, fetch: script.fetch });
      const error = yield* transport
        .graphql("reply", replyMutation, { threadId: "PRRT_1", body: "Fixed." })
        .pipe(Effect.flip, Effect.orDie);
      assert.strictEqual(error.kind, "transport");
      assert.strictEqual(script.count(), 1);
    })
  );

  it.effect("treats a mutation after a fragment as a write", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([lostResponse, { status: 200, body: { data: { ok: true } } }]);
      const transport = yield* makeTransport({ retry: twoRetries, fetch: script.fetch });
      const document = `fragment Id on Node { id }\n${replyMutation}`;
      const error = yield* transport.graphql("reply", document, {}).pipe(Effect.flip, Effect.orDie);
      assert.strictEqual(error.kind, "transport");
      assert.strictEqual(script.count(), 1);
    })
  );

  it.effect("retries a GraphQL query after a server error", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([lostResponse, { status: 200, body: { data: { ok: true } } }]);
      const transport = yield* makeTransport({ retry: twoRetries, fetch: script.fetch });
      yield* transport.graphql("read", "query { viewer { login } }", {});
      assert.strictEqual(script.count(), 2);
    })
  );
});
