import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { makeTransport } from "../../../effected/github/internal/octokit.ts";
import { RateLimitSnapshot, RetryPolicy } from "../../../effected/github/Resilience.ts";
import { rateLimitHeaders, scriptedFetch } from "../fixtures.ts";

for (const thrown of [null, "offline", { status: 404, message: "missing" }, { response: null }]) {
  it.effect(`classifies a throwable without response headers: ${String(thrown)}`, () => Effect.gen(function* () {
    const script = scriptedFetch([{ status: 200, body: {} }]);
    const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
    const error = yield* transport.request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } }).pipe(Effect.flip);
    assert.strictEqual(error.operation, "probe");
    assert.strictEqual(error.cause, thrown);
    assertNone(yield* transport.rateLimit);
    assert.strictEqual(script.count(), 0);
  }));
}

for (const response of [undefined, null, 42, [], {}, { headers: null }, { headers: 42 }, { headers: "invalid" }, { headers: () => ({}) }]) {
  it.effect(`falls back to top-level headers when nested headers are unusable: ${String(response)}`, () => Effect.gen(function* () {
    const script = scriptedFetch([{ status: 200, body: {} }]);
    const thrown = { status: 404, message: "missing", response, headers: rateLimitHeaders({ remaining: 12 }) };
    const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
    const error = yield* transport.request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } }).pipe(Effect.flip);
    assert.strictEqual(error.cause, thrown);
    assert.strictEqual(error.kind, "notFound");
    assertSome(yield* transport.rateLimit, RateLimitSnapshot.make({ remaining: 12, limit: 5000, resetEpochSeconds: 1_700_000_000 }));
  }));
}

it.effect("keeps usable nested headers ahead of top-level headers", () => Effect.gen(function* () {
  const script = scriptedFetch([{ status: 200, body: {} }]);
  const thrown = { status: 404, response: { headers: rateLimitHeaders({ remaining: 8 }) }, headers: rateLimitHeaders({ remaining: 12 }) };
  const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
  yield* transport.request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } }).pipe(Effect.flip);
  assertSome(yield* transport.rateLimit, RateLimitSnapshot.make({ remaining: 8, limit: 5000, resetEpochSeconds: 1_700_000_000 }));
}));

for (const headers of [[], Object.assign([], rateLimitHeaders({ remaining: 8 }))]) {
  it.effect("rejects nested array headers without falling back to valid top-level headers", () => Effect.gen(function* () {
    const script = scriptedFetch([{ status: 200, body: {} }]);
    const thrown = { status: 404, response: { headers }, headers: rateLimitHeaders({ remaining: 12 }) };
    const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
    const error = yield* transport.request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } }).pipe(Effect.flip);
    assert.strictEqual(error.cause, thrown);
    assertNone(yield* transport.rateLimit);
  }));
}

for (const headers of [null, 42, [], Object.assign([], rateLimitHeaders({ remaining: 8 }))]) {
  it.effect(`rejects unusable top-level headers: ${String(headers)}`, () => Effect.gen(function* () {
    const script = scriptedFetch([{ status: 200, body: {} }]);
    const thrown = { status: 404, headers };
    const transport = yield* makeTransport({ retry: RetryPolicy.none, fetch: script.fetch });
    yield* transport.request("probe", "/probe", { request: { hook: () => Promise.reject(thrown) } }).pipe(Effect.flip);
    assertNone(yield* transport.rateLimit);
  }));
}
