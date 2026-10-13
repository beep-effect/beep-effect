import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { GitHubClient, makeClientShape } from "../../effected/github/GitHubClient.ts";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { GraphQLDocument } from "../../effected/github/GraphQL.ts";
import { scriptedFetch } from "./fixtures.ts";
import { RateLimitSnapshot } from "../../effected/github/Resilience.ts";

const DefectMessage = S.Struct({ message: S.String });

const doc = GraphQLDocument.make({ name: "probe", document: "query { viewer { login } }", response: S.String })<Record<string, never>>();
const denied = GitHubError.notFound("probe", "missing");
const params = { owner: "o", repo: "r" };

describe("GitHubClient coverage", () => {
  it.effect("every unstubbed function identifies itself", () => Effect.sync(() => {
    const client = GitHubClient.makeTest();
    assert.throws(() => client.request("GET /repos/{owner}/{repo}", params), /request\(\) was called but not stubbed/);
    assert.throws(() => client.requestDecoded("GET /probe", {}, S.String), /requestDecoded\(\) was called but not stubbed/);
    assert.throws(() => client.paginate("GET /repos/{owner}/{repo}/commits", params), /paginate\(\) was called but not stubbed/);
    assert.throws(() => client.paginateStream("GET /repos/{owner}/{repo}/commits", params), /paginateStream\(\) was called but not stubbed/);
    assert.throws(() => client.graphql(doc, {}), /graphql\(\) was called but not stubbed/);
  }));

  it.layer(GitHubClient.layerTest(), { timeout: "30 seconds" })((it) => {
  it.effect("test layer defaults to no rate-limit snapshot", () => Effect.gen(function* () {
    const client = yield* GitHubClient;
    assertNone(yield* client.rateLimit);
  }));
  });

  const snapshot = RateLimitSnapshot.make({ limit: 100, remaining: 99, resetEpochSeconds: 10 });
  it.layer(GitHubClient.layerTest({
    request: () => Effect.fail(denied),
    requestDecoded: (_route, _params, schema) => S.decodeUnknownEffect(schema)("decoded").pipe(Effect.orDie),
    paginate: () => Effect.succeed([]), paginateStream: () => Stream.empty,
    graphql: (document) => document.decode("graphql").pipe(Effect.orDie), rateLimit: Effect.succeedSome(snapshot),
  }), { timeout: "30 seconds" })((it) => {
  it.effect("test layer preserves all provided members", () => Effect.gen(function* () {
    const client = yield* GitHubClient;
    assert.strictEqual(yield* Effect.flip(client.request("DELETE /repos/{owner}/{repo}", params)), denied);
    assert.strictEqual(yield* client.requestDecoded("GET /probe", {}, S.String), "decoded");
    assert.deepStrictEqual(yield* client.paginate("GET /repos/{owner}/{repo}/commits", params), []);
    assert.deepStrictEqual(yield* Stream.runCollect(client.paginateStream("GET /repos/{owner}/{repo}/commits", params)), []);
    assert.strictEqual(yield* client.graphql(doc, {}), "graphql");
    assertSome(yield* client.rateLimit, snapshot);
  }));
  });

  it.layer(GitHubClient.layerFixture({ requestDecoded: { "GET /probe": denied } }), { timeout: "30 seconds" })((it) => {
  it.effect("decoded fixtures return recorded errors unchanged", () => Effect.gen(function* () {
    const client = yield* GitHubClient;
    const error = yield* Effect.flip(client.requestDecoded("GET /probe", {}, S.String));
    assert.strictEqual(error, denied);
  }));
  });

  it.layer(GitHubClient.layerFixture({ unstubbed: "empty" }), { timeout: "30 seconds" })((it) => {
  it.effect("missing decoded fixture fails in empty mode", () => Effect.gen(function* () {
    const client = yield* GitHubClient;
    const error = yield* Effect.flip(client.requestDecoded("GET /probe", {}, S.String));
    assert.strictEqual(error.kind, "notFound");
    assert.strictEqual(error.operation, "GitHubClient.requestDecoded");
    assert.include(error.reason, "GET /probe");
  }));
  });
});


describe("GitHubClient remaining fixture paths", () => {
  it.effect("omitting retry constructs a working default-policy client", () => Effect.gen(function* () {
    const script = scriptedFetch([{ status: 200, body: "ok" }]);
    const client = yield* makeClientShape({ fetch: script.fetch });
    assert.strictEqual(yield* client.requestDecoded("GET /probe", {}, S.String), "ok");
    assert.strictEqual(script.calls.length, 1);
  }));

  it.layer(GitHubClient.layerFixture({ unstubbed: "fail" }), { timeout: "30 seconds" })((it) => {
    it.effect("missing pagination in fail mode is a typed notFound", () => Effect.gen(function* () {
      const client = yield* GitHubClient;
      const error = yield* Effect.flip(client.paginate("GET /repos/{owner}/{repo}/commits", params));
      assert.strictEqual(error.kind, "notFound");
      assert.strictEqual(error.operation, "GitHubClient.paginate");
    }));
  });

  it.layer(GitHubClient.layerFixture({}), { timeout: "30 seconds" })((it) => {
    it.effect("missing pagination and GraphQL fixtures die naming their operations", () => Effect.gen(function* () {
      const client = yield* GitHubClient;
      for (const [operation, effect] of [
        ["GitHubClient.paginate", client.paginate("GET /repos/{owner}/{repo}/commits", params).pipe(Effect.asVoid, Effect.orDie)],
        ["GitHubClient.layerFixture", client.graphql(doc, {}).pipe(Effect.asVoid, Effect.orDie)],
      ] as const) {
        const exit = yield* Effect.exit(effect);
        if (Exit.isFailure(exit)) {
          const die = yield* exit.cause.pipe(Cause.findDie, Effect.fromResult);
          assertExitFailure(exit, Cause.die(die.defect));
          const defect = yield* S.decodeUnknownEffect(DefectMessage)(die.defect);
          assert.include(defect.message, operation);
          assert.include(defect.message, "no");
        } else {
          assert.fail("Missing fixtures must die");
        }
      }
    }));
  });

  it.layer(GitHubClient.layerFixture({ requestDecoded: { "GET /probe": 42 }, graphql: { probe: 42 } }), { timeout: "30 seconds" })((it) => {
    it.effect("malformed REST and GraphQL fixtures become operation-specific decode failures", () => Effect.gen(function* () {
      const client = yield* GitHubClient;
      const rest = yield* Effect.flip(client.requestDecoded("GET /probe", {}, S.String));
      assert.strictEqual(rest.kind, "decode");
      assert.strictEqual(rest.operation, "GET /probe");
      assert.strictEqual(rest.reason, "fixture did not match its schema");
      const graphql = yield* Effect.flip(client.graphql(doc, {}));
      assert.strictEqual(graphql.kind, "decode");
      assert.strictEqual(graphql.operation, "probe");
      assert.strictEqual(graphql.reason, "fixture did not match its schema");
    }));
  });
});
