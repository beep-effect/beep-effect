import { GitHubClient, makeClientShape } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import { GraphQLDocument } from "@beep/github/GraphQL";
import { RateLimitSnapshot } from "@beep/github/Resilience";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { scriptedFetch } from "./support/fixtures.ts";

const DefectMessage = S.Struct({ message: S.String });

const doc = GraphQLDocument.make({ name: "probe", document: "query { viewer { login } }", response: S.String })<
  Record<string, never>
>();
const denied = GitHubError.notFound("probe", "missing");
const params = { owner: "o", repo: "r" };

describe("GitHubClient coverage", () => {
  it.effect("every unstubbed function identifies itself", () =>
    Effect.sync(() => {
      const client = GitHubClient.makeTest();
      assert.throws(
        () => client.request("GET /repos/{owner}/{repo}", params),
        /request\(\) was called but not stubbed/
      );
      assert.throws(
        () => client.requestDecoded("GET /probe", {}, S.String),
        /requestDecoded\(\) was called but not stubbed/
      );
      assert.throws(
        () => client.paginate("GET /repos/{owner}/{repo}/commits", params),
        /paginate\(\) was called but not stubbed/
      );
      assert.throws(
        () => client.paginateStream("GET /repos/{owner}/{repo}/commits", params),
        /paginateStream\(\) was called but not stubbed/
      );
      assert.throws(() => client.graphql(doc, {}), /graphql\(\) was called but not stubbed/);
    })
  );

  it.layer(GitHubClient.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("test layer defaults to no rate-limit snapshot", () =>
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        const rateLimit1 = yield* client.rateLimit;
        assertNone(rateLimit1);
      })
    );
  });

  const snapshot = RateLimitSnapshot.make({ limit: 100, remaining: 99, resetEpochSeconds: 10 });
  it.layer(
    GitHubClient.layerTest({
      request: dual(2, (_route: string, _params: unknown) => Effect.fail(denied)),
      requestDecoded: dual(3, <A, I>(_route: string, _params: unknown, schema: S.Codec<A, I>) =>
        S.decodeUnknownEffect(schema)("decoded").pipe(Effect.orDie)
      ),
      paginate: dual(
        (args) => P.isString(args[0]),
        (_route: string, _params: unknown, _options?: unknown) => Effect.succeed([])
      ),
      paginateStream: dual(
        (args) => P.isString(args[0]),
        (_route: string, _params: unknown, _options?: unknown) => Stream.empty
      ),
      graphql: dual(2, <A, V extends Record<string, unknown>>(document: GraphQLDocument<A, V>, _variables: V) =>
        document.decode("graphql").pipe(Effect.orDie)
      ),
      rateLimit: Effect.succeedSome(snapshot),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("test layer preserves all provided members", () =>
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        const flip2 = yield* Effect.flip(client.request("DELETE /repos/{owner}/{repo}", params));
        assert.strictEqual(flip2, denied);
        const requestDecoded3 = yield* client.requestDecoded("GET /probe", {}, S.String);
        assert.strictEqual(requestDecoded3, "decoded");
        const paginate4 = yield* client.paginate("GET /repos/{owner}/{repo}/commits", params);
        assert.deepStrictEqual(paginate4, []);
        const resultCollect = yield* Stream.runCollect(
          client.paginateStream("GET /repos/{owner}/{repo}/commits", params)
        );
        assert.deepStrictEqual(resultCollect, []);
        const graphql5 = yield* client.graphql(doc, {});
        assert.strictEqual(graphql5, "graphql");
        const rateLimit6 = yield* client.rateLimit;
        assertSome(rateLimit6, snapshot);
      })
    );
  });

  it.layer(GitHubClient.layerFixture({ requestDecoded: { "GET /probe": denied } }), { timeout: "30 seconds" })((it) => {
    it.effect("decoded fixtures return recorded errors unchanged", () =>
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        const error = yield* Effect.flip(client.requestDecoded("GET /probe", {}, S.String));
        assert.strictEqual(error, denied);
      })
    );
  });

  it.layer(GitHubClient.layerFixture({ unstubbed: "empty" }), { timeout: "30 seconds" })((it) => {
    it.effect("missing decoded fixture fails in empty mode", () =>
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        const error = yield* Effect.flip(client.requestDecoded("GET /probe", {}, S.String));
        assert.strictEqual(error.kind, "notFound");
        assert.strictEqual(error.operation, "GitHubClient.requestDecoded");
        assert.include(error.reason, "GET /probe");
      })
    );
  });
});

describe("GitHubClient remaining fixture paths", () => {
  it.effect("omitting retry constructs a working default-policy client", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([{ status: 200, body: "ok" }]);
      const client = yield* makeClientShape({ fetch: script.fetch });
      const requestDecoded7 = yield* client.requestDecoded("GET /probe", {}, S.String);
      assert.strictEqual(requestDecoded7, "ok");
      assert.strictEqual(script.calls.length, 1);
    })
  );

  it.layer(GitHubClient.layerFixture({ unstubbed: "fail" }), { timeout: "30 seconds" })((it) => {
    it.effect("missing pagination in fail mode is a typed notFound", () =>
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        const error = yield* Effect.flip(client.paginate("GET /repos/{owner}/{repo}/commits", params));
        assert.strictEqual(error.kind, "notFound");
        assert.strictEqual(error.operation, "GitHubClient.paginate");
      })
    );
  });

  it.layer(GitHubClient.layerFixture({}), { timeout: "30 seconds" })((it) => {
    it.effect("missing pagination and GraphQL fixtures die naming their operations", () =>
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        for (const [operation, effect] of [
          [
            "GitHubClient.paginate",
            client.paginate("GET /repos/{owner}/{repo}/commits", params).pipe(Effect.asVoid, Effect.orDie),
          ],
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
      })
    );
  });

  it.layer(GitHubClient.layerFixture({ requestDecoded: { "GET /probe": 42 }, graphql: { probe: 42 } }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("malformed REST and GraphQL fixtures become operation-specific decode failures", () =>
      Effect.gen(function* () {
        const client = yield* GitHubClient;
        const rest = yield* Effect.flip(client.requestDecoded("GET /probe", {}, S.String));
        assert.strictEqual(rest.kind, "decode");
        assert.strictEqual(rest.operation, "GET /probe");
        assert.strictEqual(rest.reason, "fixture did not match its schema");
        const graphql = yield* Effect.flip(client.graphql(doc, {}));
        assert.strictEqual(graphql.kind, "decode");
        assert.strictEqual(graphql.operation, "probe");
        assert.strictEqual(graphql.reason, "fixture did not match its schema");
      })
    );
  });
});
