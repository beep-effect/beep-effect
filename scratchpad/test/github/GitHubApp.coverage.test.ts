import { assert, describe, it, vi } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Base64 from "effect/encoding/Base64";
import { AppIdentity, GitHubApp, GitHubAppError } from "../../effected/github/GitHubApp.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { GraphQLDocument } from "../../effected/github/GraphQL.ts";
import { RetryPolicy } from "../../effected/github/Resilience.ts";
import { scriptedFetch, type Reply } from "./fixtures.ts";

const key = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", key.privateKey));
const credentials = { appId: "Iv1.test", privateKey: Redacted.make(`-----BEGIN PRIVATE KEY-----\n${Base64.encode(bytes)}\n-----END PRIVATE KEY-----`) };
const request = { ...credentials, installationId: 42 };
const minted = (permissions: unknown = {}) => ({ status: 201, body: { token: "ghs_test", expires_at: "2099-01-01T00:00:00Z", permissions } });
const withApp = <A, E>(name: string, replies: ReadonlyArray<Reply>, use: (app: GitHubApp["Service"]) => Effect.Effect<A, E>): void => {
  const script = scriptedFetch(replies);
  it.layer(GitHubApp.layerWith({ fetch: script.fetch, retry: RetryPolicy.none }), { timeout: "30 seconds" })(name, (it) => {
    it.effect(name, () => Effect.flatMap(GitHubApp, use));
  });
};

describe("GitHubApp uncovered contracts", () => {
  it.effect("every unstubbed operation names itself", () => Effect.sync(() => {
    const app = GitHubApp.makeTest();
    assert.throws(() => app.token(request), /token\(\) was called/);
    assert.throws(() => app.scopedToken(request), /scopedToken\(\) was called/);
    assert.throws(() => app.revoke(Redacted.make("token")), /revoke\(\) was called/);
    assert.throws(() => app.identity(credentials), /identity\(\) was called/);
    assert.throws(() => app.installations(credentials), /installations\(\) was called/);
    assert.strictEqual(GitHubAppError.of("jwt", "bad").message, "GitHub App jwt failed: bad");
  }));
  it.layer(GitHubApp.layerTest(), { timeout: "30 seconds" })("default test layer", (it) => {
    it.effect("provides unstubbed members", () => Effect.gen(function* () {
      const app = yield* GitHubApp;
      assert.throws(() => app.identity(credentials), /not stubbed/);
    }));
  });
  withApp("malformed token is a typed token error", [{ status: 201, body: { token: 7, expires_at: "invalid" } }], (app) => Effect.gen(function* () {
    const error = yield* Effect.flip(app.token(request));
    assert.strictEqual(error.kind, "token");
    assert.strictEqual(error.reason, "GitHub returned an unexpected token payload");
  }));
  for (const permissions of [null, ["read", 42], { contents: "write", invalid: 42 }]) {
    withApp(`permissions normalize ${JSON.stringify(permissions)}`, [minted(permissions)], (app) => Effect.gen(function* () {
      const token = yield* app.token(request);
      assert.deepStrictEqual(token.permissions, permissions === null ? {} : Array.isArray(permissions) ? { "0": "read" } : { contents: "write" });
    }));
  }
  for (const installations of [[], [{ id: 7, account: null }]]) {
    withApp(`missing owner in ${JSON.stringify(installations)}`, [{ status: 200, body: installations }], (app) => Effect.gen(function* () {
      const error = yield* Effect.flip(app.token({ ...credentials, owner: "missing" }));
      assert.strictEqual(error.kind, "installation");
      assert.strictEqual(error.reason, `the app is not installed on missing (installed on: ${installations.length === 0 ? "nothing" : "7"})`);
    }));
  }
  withApp("null app identity is typed", [{ status: 200, body: null }], (app) => Effect.gen(function* () {
    const error = yield* Effect.flip(app.identity(credentials));
    assert.strictEqual(error.reason, "GET /app returned no app");
  }));
  withApp("missing slug uses the empty slug", [{ status: 200, body: { name: "App" } }, { status: 200, body: { id: 9 } }], (app) => Effect.gen(function* () {
    assert.deepStrictEqual(yield* app.identity(credentials), AppIdentity.make({ slug: "", name: "App", userId: 9 }));
  }));
  withApp("non Error signing failure has a useful fallback", [], (app) => Effect.gen(function* () {
    const spy = vi.spyOn(crypto.subtle, "sign").mockRejectedValueOnce("signer rejected");
    try {
      const error = yield* Effect.flip(app.token(request));
      assert.strictEqual(error.kind, "jwt");
      assert.strictEqual(error.reason, "could not sign the app JWT");
      assert.strictEqual(error.cause, "signer rejected");
    } finally { spy.mockRestore(); }
  }));
});

const doc = GraphQLDocument.make({ name: "viewer", document: "query { viewer { login } }", response: S.Struct({ viewer: S.Struct({ login: S.String }) }) })<Record<string, never>>();
const params = { owner: "o", repo: "r" };
const script = scriptedFetch([minted(), { status: 200, body: { default_branch: "main" } }, { status: 200, body: [{ id: 1 }] }, { status: 200, body: [{ id: 2 }] }, { status: 200, body: { data: { viewer: { login: "bot" } } } }, { status: 204 }]);
it.layer(GitHubApp.clientLayer(request, { fetch: script.fetch, retry: RetryPolicy.none }), { timeout: "30 seconds" })("rotating client forwards", (it) => {
  it.effect("decodes, paginates, streams and executes GraphQL with the held token", () => Effect.gen(function* () {
    const client = yield* GitHubClient;
    assertNone(yield* client.rateLimit);
    assert.deepStrictEqual(yield* client.requestDecoded("GET /repos/{owner}/{repo}", params, S.Struct({ default_branch: S.String })), { default_branch: "main" });
    assert.strictEqual((yield* client.paginate("GET /repos/{owner}/{repo}/issues", params)).length, 1);
    assert.strictEqual((yield* Stream.runCollect(client.paginateStream("GET /repos/{owner}/{repo}/issues", params))).length, 1);
    assert.deepStrictEqual(yield* client.graphql(doc, {}), { viewer: { login: "bot" } });
    for (const call of script.calls.slice(1)) assert.strictEqual(call.headers.authorization, "token ghs_test");
  }));
});
for (const graphql of [false, true]) {
  const script = scriptedFetch([{ status: 201, body: { token: "ghs_expired", expires_at: "1970-01-01T00:00:00Z" } }, { status: 204 }, { status: 401, body: { message: "Bad credentials" } }, { status: 204 }]);
  it.layer(GitHubApp.clientLayer(request, { fetch: script.fetch, retry: RetryPolicy.none }), { timeout: "30 seconds" })(`rotation failure ${graphql}`, (it) => {
    it.effect("reports authentication failure in the caller's error channel", () => Effect.gen(function* () {
      const client = yield* GitHubClient;
      if (graphql) {
        const error = yield* Effect.flip(client.graphql(doc, {}));
        assert.strictEqual(error._tag, "GitHubGraphQLError");
        assert.strictEqual(error.kind, "unauthorized");
        assert.strictEqual(error.operation, "GitHubApp.clientLayer");
      } else {
        const error = yield* Effect.flip(client.request("GET /repos/{owner}/{repo}", params));
        assert.strictEqual(error._tag, "GitHubError");
        assert.strictEqual(error.kind, "unauthorized");
      }
    }));
  });
}
