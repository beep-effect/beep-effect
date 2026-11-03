import { makeTransport } from "@beep/github/internal/octokit";
import { RateLimitSnapshot, RetryPolicy } from "@beep/github/Resilience";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { rateLimitHeaders, scriptedFetch } from "../support/fixtures.ts";

for (const field of ["x-ratelimit-remaining", "x-ratelimit-limit", "x-ratelimit-reset"]) {
  for (const value of ["9007199254740992", "1e308"]) {
    for (const retained of [false, true]) {
      it.effect(`ignores invalid complete snapshot ${field}=${value}, prior snapshot ${retained}`, () =>
        Effect.gen(function* () {
          const prior = RateLimitSnapshot.make({ remaining: 12, limit: 5000, resetEpochSeconds: 1_700_000_000 });
          const refreshed = RateLimitSnapshot.make({ remaining: 8, limit: 5000, resetEpochSeconds: 1_700_000_090 });
          const headers = { ...rateLimitHeaders({ remaining: 0 }), [field]: value };
          const script = scriptedFetch([
            ...(retained ? [{ status: 200, body: {}, headers: rateLimitHeaders(prior) }] : []),
            { status: 200, body: { answer: 42 }, headers },
            {
              status: 200,
              body: { data: { viewer: null }, errors: [{ message: "missing", type: "NOT_FOUND" }] },
              headers,
            },
            { status: 200, body: {}, headers: rateLimitHeaders(refreshed) },
          ]);
          const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
          if (retained) {
            yield* transport.request("seed", "/seed", {});
            const rateLimit1 = yield* transport.rateLimit;
            assertSome(rateLimit1, prior);
          }
          const response = yield* transport.request("answer", "/answer", {});
          assert.deepStrictEqual(response.data, { answer: 42 });
          const rateLimit2 = yield* transport.rateLimit;
          assert.deepStrictEqual(rateLimit2, retained ? O.some(prior) : O.none());
          const error = yield* transport
            .graphql("viewer", "query { viewer { login } }", {})
            .pipe(Effect.flip, Effect.orDie);
          assert.strictEqual(error._tag, "GitHubGraphQLError");
          assert.strictEqual(error.kind, "notFound");
          assert.strictEqual(error.reason, "missing");
          assert.strictEqual(error.errors[0]?.message, "missing");
          assert.isDefined(error.cause);
          const rateLimit3 = yield* transport.rateLimit;
          assert.deepStrictEqual(rateLimit3, retained ? O.some(prior) : O.none());
          yield* transport.request("refresh", "/refresh", {});
          const rateLimit4 = yield* transport.rateLimit;
          assertSome(rateLimit4, refreshed);
          assert.strictEqual(script.count(), retained ? 4 : 3);
        })
      );
    }
  }
}

for (const thrown of [null, "offline", { status: 404, message: "missing" }, { response: null }]) {
  it.effect(`classifies a throwable without response headers: ${String(thrown)}`, () =>
    Effect.gen(function* () {
      const script = scriptedFetch([{ status: 200, body: {} }]);
      const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
      const error = yield* transport
        .request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } })
        .pipe(Effect.flip);
      assert.strictEqual(error.operation, "probe");
      assert.strictEqual(error.cause, thrown);
      const rateLimit5 = yield* transport.rateLimit;
      assertNone(rateLimit5);
      assert.strictEqual(script.count(), 0);
    })
  );
}

for (const response of [
  undefined,
  null,
  42,
  [],
  {},
  { headers: null },
  { headers: 42 },
  { headers: "invalid" },
  { headers: () => ({}) },
]) {
  it.effect(`falls back to top-level headers when nested headers are unusable: ${String(response)}`, () =>
    Effect.gen(function* () {
      const script = scriptedFetch([{ status: 200, body: {} }]);
      const thrown = { status: 404, message: "missing", response, headers: rateLimitHeaders({ remaining: 12 }) };
      const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
      const error = yield* transport
        .request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } })
        .pipe(Effect.flip);
      assert.strictEqual(error.cause, thrown);
      assert.strictEqual(error.kind, "notFound");
      const rateLimit6 = yield* transport.rateLimit;
      assertSome(rateLimit6, RateLimitSnapshot.make({ remaining: 12, limit: 5000, resetEpochSeconds: 1_700_000_000 }));
    })
  );
}

it.effect("keeps usable nested headers ahead of top-level headers", () =>
  Effect.gen(function* () {
    const script = scriptedFetch([{ status: 200, body: {} }]);
    const thrown = {
      status: 404,
      response: { headers: rateLimitHeaders({ remaining: 8 }) },
      headers: rateLimitHeaders({ remaining: 12 }),
    };
    const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
    yield* transport.request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } }).pipe(Effect.flip);
    const rateLimit7 = yield* transport.rateLimit;
    assertSome(rateLimit7, RateLimitSnapshot.make({ remaining: 8, limit: 5000, resetEpochSeconds: 1_700_000_000 }));
  })
);

for (const headers of [[], Object.assign([], rateLimitHeaders({ remaining: 8 }))]) {
  it.effect("rejects nested array headers without falling back to valid top-level headers", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([{ status: 200, body: {} }]);
      const thrown = { status: 404, response: { headers }, headers: rateLimitHeaders({ remaining: 12 }) };
      const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
      const error = yield* transport
        .request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } })
        .pipe(Effect.flip);
      assert.strictEqual(error.cause, thrown);
      const rateLimit8 = yield* transport.rateLimit;
      assertNone(rateLimit8);
    })
  );
}

for (const headers of [null, 42, [], Object.assign([], rateLimitHeaders({ remaining: 8 }))]) {
  it.effect(`rejects unusable top-level headers: ${String(headers)}`, () =>
    Effect.gen(function* () {
      const script = scriptedFetch([{ status: 200, body: {} }]);
      const thrown = { status: 404, headers };
      const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
      yield* transport
        .request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } })
        .pipe(Effect.flip);
      const rateLimit9 = yield* transport.rateLimit;
      assertNone(rateLimit9);
    })
  );
}
