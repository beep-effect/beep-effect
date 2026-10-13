import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import { GitHubGraphQLError, GraphQLDocument } from "../../effected/github/GraphQL.ts";

describe("GraphQL classification coverage", () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly input: unknown;
    readonly kind: GitHubGraphQLError["kind"];
    readonly reason: string;
    readonly retryable: boolean;
  }> = [
    { name: "null throwable", input: null, kind: "transport", reason: "null", retryable: true },
    { name: "undefined throwable", input: undefined, kind: "transport", reason: "undefined", retryable: true },
    { name: "primitive throwable", input: "offline", kind: "transport", reason: "offline", retryable: true },
    { name: "invalid status and message", input: { status: "404", message: 42 }, kind: "transport", reason: "[object Object]", retryable: true },
    { name: "non-array errors", input: { errors: {}, message: "offline" }, kind: "transport", reason: "offline", retryable: true },
    { name: "empty errors", input: { errors: [], message: "offline" }, kind: "transport", reason: "offline", retryable: true },
    { name: "ignored primitive entries", input: { errors: [null, undefined, 42, "bad"], message: "offline" }, kind: "transport", reason: "offline", retryable: true },
    { name: "malformed entry", input: { errors: [{ message: 42, type: 42 }] }, kind: "rejected", reason: "[object Object]", retryable: false },
    { name: "array entry", input: { errors: [[]] }, kind: "transport", reason: "[object Object]", retryable: true },
    { name: "duplicate prose", input: { status: 500, message: "Branch ALREADY EXISTS" }, kind: "alreadyExists", reason: "Branch ALREADY EXISTS", retryable: false },
    { name: "duplicate entry overrides not found", input: { status: 404, errors: [{ message: "branch Already Exists", type: "NOT_FOUND" }] }, kind: "alreadyExists", reason: "branch Already Exists", retryable: false },
    { name: "not found entry", input: { errors: [{ message: "missing", type: "NOT_FOUND" }] }, kind: "notFound", reason: "missing", retryable: false },
    { name: "forbidden entry", input: { errors: [{ message: "forbidden", type: "FORBIDDEN" }] }, kind: "unauthorized", reason: "forbidden", retryable: false },
    { name: "unauthorized entry", input: { errors: [{ message: "unauthorized", type: "UNAUTHORIZED" }] }, kind: "unauthorized", reason: "unauthorized", retryable: false },
    { name: "rate limit entry", input: { errors: [{ message: "limited", type: "RATE_LIMITED" }] }, kind: "rateLimited", reason: "limited", retryable: true },
    { name: "unclassified entry", input: { errors: [{ message: "invalid" }] }, kind: "rejected", reason: "invalid", retryable: false },
    { name: "HTTP not found", input: { status: 404, message: "missing" }, kind: "notFound", reason: "missing", retryable: false },
    { name: "HTTP unauthorized", input: { status: 401, message: "credentials" }, kind: "unauthorized", reason: "credentials", retryable: false },
    { name: "HTTP rate limited", input: { status: 429, message: "limited" }, kind: "rateLimited", reason: "limited", retryable: true },
    { name: "HTTP forbidden without advice", input: { status: 403, message: "forbidden" }, kind: "unauthorized", reason: "forbidden", retryable: false },
    { name: "HTTP forbidden with advice", input: { status: 403, headers: { "retry-after": "2" }, message: "limited" }, kind: "rateLimited", reason: "limited", retryable: true },
    { name: "HTTP server failure", input: { status: 500, message: "server" }, kind: "transport", reason: "server", retryable: true },
    { name: "HTTP rejected", input: { status: 422, message: "invalid" }, kind: "rejected", reason: "invalid", retryable: false },
  ];
  for (const sample of cases) {
    it.effect(sample.name, () => Effect.sync(() => {
      const error = GitHubGraphQLError.fromThrowable("query", sample.input, 0);
      assert.strictEqual(error.kind, sample.kind);
      assert.strictEqual(error.reason, sample.reason);
      assert.strictEqual(error.message, `query failed: ${sample.reason}`);
      assert.strictEqual(error.retryable, sample.retryable);
      assert.strictEqual(error.cause, sample.input);
    }));
  }

  it.effect("preserves valid entries in order and joins their messages", () => Effect.sync(() => {
    const error = GitHubGraphQLError.fromThrowable("query", {
      errors: [null, { message: "first", type: "CUSTOM" }, { message: "second" }, { message: "third", type: 7 }],
    }, 0);
    assert.strictEqual(error.reason, "first; second; third");
    assert.deepStrictEqual(A.map(error.errors, (entry) => ({ message: entry.message, type: entry.type })), [
      { message: "first", type: "CUSTOM" }, { message: "second", type: undefined }, { message: "third", type: undefined },
    ]);
  }));

  it.effect("reads response headers when top-level headers are invalid", () => Effect.sync(() => {
    const error = GitHubGraphQLError.fromThrowable("query", {
      status: 403, headers: null, response: { headers: { "retry-after": "3" } },
    }, 0);
    assert.strictEqual(error.kind, "rateLimited");
    assert.strictEqual(error.retryAfterMillis, 3000);
    const topLevel = GitHubGraphQLError.fromThrowable("query", {
      status: 403, headers: { "retry-after": "2" }, response: { headers: { "retry-after": "3" } },
    }, 0);
    assert.strictEqual(topLevel.retryAfterMillis, 2000);
  }));

  it.effect("decode failures retain an optional cause and never retry", () => Effect.sync(() => {
    const cause = { detail: "invalid payload" };
    const withCause = GitHubGraphQLError.decode("query", "bad response", cause);
    const withoutCause = GitHubGraphQLError.decode("query", "bad response");
    assert.strictEqual(withCause.cause, cause);
    assert.strictEqual(withoutCause.cause, undefined);
    assert.strictEqual(withCause.kind, "decode");
    assert.strictEqual(withCause.retryable, false);
    assert.deepStrictEqual(withCause.errors, []);
    assert.strictEqual(withCause.message, "query failed: bad response");
  }));
});

describe("GraphQLDocument coverage", () => {
  it.effect("keeps metadata, defaults variables to identity and decodes the declared response", () => Effect.gen(function* () {
    const document = GraphQLDocument.make({ name: "count", document: "query { count }", response: S.Struct({ count: S.FiniteFromString }) })<{ owner: string }>();
    const variables = { owner: "octocat" };
    assert.strictEqual(document.name, "count");
    assert.strictEqual(document.document, "query { count }");
    assert.strictEqual(document.encodeVariables(variables), variables);
    assert.strictEqual(document.encodeVariables, identity);
    assert.deepStrictEqual(yield* document.decode({ count: "42" }), { count: 42 });
    const invalid = yield* document.decode({ count: "invalid" }).pipe(Effect.mapError(S.isSchemaError), Effect.result);
    assertFailure(invalid, true);
  }));

  it.effect("uses an explicit variable encoder", () => Effect.gen(function* () {
    const document = GraphQLDocument.make({ name: "echo", document: "query Echo", response: S.String })<{ owner: string }>((variables) => ({ login: variables.owner }));
    assert.deepStrictEqual(document.encodeVariables({ owner: "octocat" }), { login: "octocat" });
    assert.strictEqual(yield* document.decode("response"), "response");
  }));

  it.effect("retains the custom encoder and its returned reference", () => Effect.sync(() => {
    const variables = { owner: "octocat" };
    const encoded = { login: "octocat" };
    const encode = (input: typeof variables) => {
      assert.strictEqual(input, variables);
      return encoded;
    };
    const document = GraphQLDocument.make({ name: "echo", document: "query Echo", response: S.String })<typeof variables>(encode);
    assert.strictEqual(document.encodeVariables, encode);
    assert.strictEqual(document.encodeVariables(variables), encoded);
  }));
});

describe("GraphQL throwable boundary regressions", () => {
  it.effect("ignores arrays with named throwable, header and error-entry properties", () => Effect.sync(() => {
    const samples = [
      { input: Object.assign([], { status: 404, message: "missing" }), kind: "transport" },
      { input: { status: 403, headers: Object.assign([], { "retry-after": "2" }) }, kind: "unauthorized" },
      { input: { status: 403, response: Object.assign([], { headers: { "retry-after": "2" } }) }, kind: "unauthorized" },
      { input: { status: 403, response: { headers: Object.assign([], { "retry-after": "2" }) } }, kind: "unauthorized" },
      { input: { errors: [Object.assign([], { message: "missing", type: "NOT_FOUND" })] }, kind: "transport" },
    ];
    for (const sample of samples) {
      const error = GitHubGraphQLError.fromThrowable("arrays", sample.input, 0);
      assert.strictEqual(error.kind, sample.kind);
      assert.strictEqual(error.retryAfterMillis, undefined);
      assert.deepStrictEqual(error.errors, []);
      assert.strictEqual(error.cause, sample.input);
    }
  }));

  it.effect("retains ordinary object errors and headers", () => Effect.sync(() => {
    const original = { errors: [{ message: "limited", type: "RATE_LIMITED" }], headers: { "retry-after": "2" } };
    const error = GitHubGraphQLError.fromThrowable("objects", original, 0);
    assert.strictEqual(error.kind, "rateLimited");
    assert.strictEqual(error.reason, "limited");
    assert.strictEqual(error.errors[0]?.type, "RATE_LIMITED");
    assert.strictEqual(error.retryAfterMillis, 2000);
    assert.strictEqual(error.cause, original);
  }));

  for (const original of [{ toString: null }, { errors: [{ message: 42, toString: null }] }]) {
    it.effect(`keeps an uncoercible ${"errors" in original ? "entry" : "throwable"} in the typed channel`, () => Effect.sync(() => {
      const error = GitHubGraphQLError.fromThrowable("coercion", original, 0);
      assert.strictEqual(error.kind, "errors" in original ? "rejected" : "transport");
      assert.strictEqual(error.reason, "Unable to describe GitHub GraphQL failure");
      assert.strictEqual(error.cause, original);
      if ("errors" in original) assert.strictEqual(error.errors[0]?.message, error.reason);
    }));
  }

  it.effect("preserves successful custom coercion descriptions", () => Effect.sync(() => {
    const original = { toString: () => "offline" };
    const error = GitHubGraphQLError.fromThrowable("coercion", original, 0);
    assert.strictEqual(error.reason, "offline");
    assert.strictEqual(error.cause, original);
    const withEntry = { errors: [{ message: 42, toString: () => "entry detail" }] };
    const entryError = GitHubGraphQLError.fromThrowable("coercion", withEntry, 0);
    assert.strictEqual(entryError.reason, "entry detail");
    assert.strictEqual(entryError.errors[0]?.message, "entry detail");
    assert.strictEqual(entryError.cause, withEntry);
  }));
});
