import {
  AppIdentity,
  assertPermissions,
  BotIdentity,
  GitHubApp,
  GitHubAppOptions,
  InstallationToken,
} from "@beep/github/GitHubApp";
import { GitHubClient } from "@beep/github/GitHubClient";
import { RateLimitSink, RetryPolicy } from "@beep/github/Resilience";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Base64 from "effect/encoding/Base64";
import * as Fiber from "effect/Fiber";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";
import * as TestClock from "effect/testing/TestClock";
import { rateLimitHeaders, scriptedFetch } from "./support/fixtures.ts";
import type { GitHubAppError } from "@beep/github/GitHubApp";
import type { RateLimitObservation, RateLimitSinkShape } from "@beep/github/Resilience";
import type { Reply } from "./support/fixtures.ts";

const realRs256KeyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const keyBytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", realRs256KeyPair.privateKey));
// decision: test-pem-banner-is-assembled
const pemBanner = (edge: "BEGIN" | "END"): string => `-----${edge} PRIVATE KEY-----`;
const privateKey = `${pemBanner("BEGIN")}\n${Base64.encode(keyBytes)}\n${pemBanner("END")}`;

const CREDENTIALS = { appId: "Iv1.test", privateKey: Redacted.make(privateKey) };

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

const REVIEWER_SCOPE = {
  repositories: ["beep-effect"],
  permissions: { checks: "write", pull_requests: "write", issues: "write", contents: "read", metadata: "read" },
} as const;

const NO_RETRY = RetryPolicy.none;

class ScopedClient extends Context.Service<
  ScopedClient,
  {
    readonly client: GitHubClient["Service"];
    readonly close: Effect.Effect<void>;
  }
>()("@beep/github/test/GitHubApp.test/ScopedClient") {}

const scopedClientLayer = (script: ReturnType<typeof scriptedFetch>) =>
  Layer.effect(
    ScopedClient,
    Effect.gen(function* () {
      const childScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
      const context = yield* Layer.buildWithScope(
        GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY }),
        childScope
      );
      return { client: Context.get(context, GitHubClient), close: Scope.close(childScope, Exit.void) };
    })
  );

const tokenReply = (options: { expiresAt?: string; token?: string } = {}): Reply => ({
  status: 201,
  body: {
    token: options.token ?? "ghs_installation",
    expires_at: options.expiresAt ?? "2099-01-01T00:00:00Z",
    permissions: { contents: "write", metadata: "read" },
  },
});

const revokeOfSpentToken: Reply = { status: 204 };
const revokeOnScopeClose: Reply = { status: 204 };

const withApp = <A, E>(
  name: string,
  replies: ReadonlyArray<Reply>,
  use: (
    app: GitHubApp["Service"],
    script: ReturnType<typeof scriptedFetch>
  ) => Effect.Effect<A, E, import("effect/Scope").Scope>
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
      assert.strictEqual(script.count(), 1, "a known installation id needs no discovery");
      assert.include(script.calls[0]?.url ?? "", "/app/installations/42/access_tokens");
    })
  );

  withApp("returns a typed token error for a null mint response", [{ status: 201, body: null }], (app) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(app.token({ ...CREDENTIALS, installationId: 42 }));
      assert.strictEqual(error._tag, "GitHubAppError");
      assert.strictEqual(error.kind, "token");
    })
  );

  for (const [field, body] of [
    ["fractional installation id", { id: 1.5, account: { login: "acme" } }],
    ["invalid account login", { id: 1, account: { login: 42 } }],
    ["null installation", null],
    ["invalid account object", { id: 1, account: "acme" }],
  ] as const) {
    withApp(`returns a typed installation error for ${field}`, [{ status: 200, body: [body] }], (app) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(app.installations(CREDENTIALS));
        assert.strictEqual(error._tag, "GitHubAppError");
        assert.strictEqual(error.kind, "installation");
      })
    );
  }

  withApp(
    "preserves own __proto__ and ordinary string grants during token normalization",
    [
      {
        status: 201,
        body: {
          token: "ghs_permissions",
          expires_at: "2099-01-01T00:00:00Z",
          permissions: R.fromEntries([
            ["__proto__", "read"],
            ["contents", "write"],
            ["metadata", "read"],
            ["invalid", 42],
          ]),
        },
      },
    ],
    (app) =>
      Effect.gen(function* () {
        const token = yield* app.token({ ...CREDENTIALS, installationId: 42 });
        assert.isTrue(R.has(token.permissions, "__proto__"), "the special grant must be an own property");
        assert.deepStrictEqual(R.get(token.permissions, "__proto__"), O.some("read"));
        assert.deepStrictEqual(R.get(token.permissions, "contents"), O.some("write"));
        assert.deepStrictEqual(R.get(token.permissions, "metadata"), O.some("read"));
        assert.isFalse(R.has(token.permissions, "invalid"));
      })
  );

  withApp("authenticates the mint with a JWT bearer, not a token", [tokenReply()], (app, script) =>
    Effect.gen(function* () {
      yield* app.token({ ...CREDENTIALS, installationId: 42 });
      const authorization = script.calls[0]?.headers.authorization ?? "";
      assert.isTrue(Str.startsWith("bearer ")(authorization), authorization);
      assert.lengthOf(
        pipe(authorization, Str.slice("bearer ".length), Str.split(".")),
        3,
        "octokit auth-token emits bearer for a three-segment JWT, so no separate auth strategy exists"
      );
    })
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
        const token = yield* app.token({ ...CREDENTIALS, owner: "acme" });
        assert.strictEqual(
          token.installationId,
          7,
          "owner matching is case-insensitive; GitHub login casing is display casing"
        );
        assert.include(script.calls[1]?.url ?? "", "/app/installations/7/access_tokens");
      })
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
      })
  );

  withApp(
    "uses the sole installation when neither id nor owner is given",
    [{ status: 200, body: [{ id: 5, account: { login: "solo" } }] }, tokenReply()],
    (app) =>
      Effect.gen(function* () {
        const token = yield* app.token(CREDENTIALS);
        assert.strictEqual(token.installationId, 5);
      })
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
      })
  );

  withApp("reports no installations honestly", [{ status: 200, body: [] }], (app) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(app.token(CREDENTIALS));
      assert.include(error.reason, "no installations");
    })
  );

  withApp("surfaces a mint rejection as a token failure", [{ status: 404, body: { message: "Not Found" } }], (app) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(app.token({ ...CREDENTIALS, installationId: 42 }));
      assert.strictEqual(error.kind, "token");
      assert.strictEqual(error._tag, "GitHubAppError");
    })
  );

  withApp("fails as a jwt error on an unusable private key", [tokenReply()], (app) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        app.token({ appId: "x", privateKey: Redacted.make("not a key"), installationId: 1 })
      );
      assert.strictEqual(error.kind, "jwt");
    })
  );
});

describe("GitHubApp.revoke and scopedToken", () => {
  withApp("returns undefined after an HTTP 204 revocation", [{ status: 204 }], (app) =>
    Effect.gen(function* () {
      const value = yield* app.revoke(Redacted.make("ghs_installation"));
      assert.strictEqual(value, undefined);
    })
  );

  withApp("revokes with a token credential, not a bearer", [{ status: 204 }], (app, script) =>
    Effect.gen(function* () {
      yield* app.revoke(Redacted.make("ghs_installation"));
      assert.strictEqual(script.calls[0]?.method, "DELETE");
      assert.include(script.calls[0]?.url ?? "", "/installation/token");
      assert.strictEqual(script.calls[0]?.headers.authorization, "token ghs_installation");
    })
  );

  withApp("scopedToken revokes when the scope closes", [tokenReply(), { status: 204 }], (app, script) =>
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const token = yield* app.scopedToken({ ...CREDENTIALS, installationId: 42 });
          assert.strictEqual(Redacted.value(token.token), "ghs_installation");
          assert.strictEqual(script.count(), 1, "not revoked while the scope is open");
        })
      );
      assert.strictEqual(script.count(), 2);
      assert.strictEqual(script.calls[1]?.method, "DELETE");
    })
  );

  withApp(
    "a failed revoke does not fail the scope: revocation of an hour-long token is best-effort",
    [tokenReply(), { status: 500, body: { message: "boom" } }],
    (app) => app.scopedToken({ ...CREDENTIALS, installationId: 42 }).pipe(Effect.asVoid)
  );
});

describe("GitHubApp.identity", () => {
  for (const [field, body] of [
    ["wrong-type name", { slug: "my-app", name: 42 }],
    ["wrong-type slug", { slug: 42, name: "My App" }],
    ["missing name", { slug: "my-app" }],
  ] as const) {
    withApp(`returns a typed identity error for ${field}`, [{ status: 200, body }], (app, script) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(app.identity(CREDENTIALS));
        assert.strictEqual(error._tag, "GitHubAppError");
        assert.strictEqual(error.kind, "identity");
        assert.strictEqual(script.count(), 1, "reject app fields before the bot lookup");
      })
    );
  }

  for (const [field, body] of [
    ["fractional bot id", { id: 1.5 }],
    ["wrong-type bot id", { id: "7" }],
    ["null bot", null],
  ] as const) {
    withApp(
      `returns a typed identity error for ${field}`,
      [
        { status: 200, body: { slug: "my-app", name: "My App" } },
        { status: 200, body },
      ],
      (app) =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(app.identity(CREDENTIALS));
          assert.strictEqual(error._tag, "GitHubAppError");
          assert.strictEqual(error.kind, "identity");
        })
    );
  }

  withApp(
    "defaults a missing slug and keeps the bot HTTP failure fallback",
    [
      { status: 200, body: { name: "My App" } },
      { status: 403, body: { message: "forbidden" } },
    ],
    (app) =>
      Effect.gen(function* () {
        const identity = yield* app.identity(CREDENTIALS);
        assert.strictEqual(identity.slug, "");
        assert.strictEqual(identity.name, "My App");
        assert.strictEqual(identity.userId, undefined);
      })
  );

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
        assert.strictEqual(
          script.calls[1]?.headers.authorization,
          "token ghs_x",
          "the bot-user lookup rejects an app JWT, so it bears the installation token"
        );
      })
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
      })
  );

  withApp("surfaces a failure to read the app itself", [{ status: 401, body: { message: "Bad credentials" } }], (app) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(app.identity(CREDENTIALS));
      assert.strictEqual(error.kind, "identity");
    })
  );
});

describe("GitHubApp.clientLayer", () => {
  for (const blockedMethod of ["DELETE", "POST", "GET"] as const) {
    const script = scriptedFetch([
      tokenReply({ expiresAt: "1970-01-01T00:00:00Z", token: "ghs_first" }),
      { status: 204 },
      tokenReply({ token: "ghs_second" }),
      { status: 200, body: { default_branch: "main" } },
      { status: 204 },
    ]);
    const started = Deferred.makeUnsafe<AbortSignal>();
    let calls = 0;
    let blocked = false;
    function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      calls += 1;
      if (
        calls > 1 &&
        !blocked &&
        init?.method === blockedMethod &&
        init.signal !== undefined &&
        init.signal !== null
      ) {
        blocked = true;
        const signal = init.signal;
        Deferred.doneUnsafe(started, Effect.succeed(signal));
        const unansweredRequest = Promise.withResolvers<Response>();
        if (signal.aborted) unansweredRequest.reject(signal.reason);
        else signal.addEventListener("abort", () => unansweredRequest.reject(signal.reason), { once: true });
        return unansweredRequest.promise;
      }
      return script.fetch(input, init);
    }
    fetch.preconnect = globalThis.fetch.preconnect;

    it.layer(scopedClientLayer({ ...script, fetch }), { timeout: "30 seconds" })((it) => {
      it.effect(`interrupts blocked ${blockedMethod} during refresh and retains token cleanup ownership`, () =>
        Effect.gen(function* () {
          const { client, close } = yield* ScopedClient;
          const requesting = yield* client
            .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
            .pipe(Effect.forkChild);
          const signal = yield* Deferred.await(started);
          yield* Fiber.interrupt(requesting);
          assert.isTrue(signal.aborted, "cancellation must abort the blocked HTTP request");
          const await1 = yield* Fiber.await(requesting);
          assert.isTrue(Exit.hasInterrupts(await1), "the requesting fiber must terminate");
          const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
          assert.strictEqual(repo.default_branch, "main", "a later request acquires the released rotation permit");
          yield* close;
          assert.deepStrictEqual(
            A.map(script.calls, (call) => call.method),
            ["POST", "DELETE", "POST", "GET", "DELETE"],
            "an acquired replacement is reused rather than minted again"
          );
          assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_first");
          assert.strictEqual(script.calls[3]?.headers.authorization, "token ghs_second");
          assert.strictEqual(script.calls[4]?.headers.authorization, "token ghs_second");
        })
      );
    });
  }

  for (const blockedMethod of ["DELETE", "POST"] as const) {
    const script = scriptedFetch([
      tokenReply({ expiresAt: "1970-01-01T00:00:00Z", token: "ghs_first" }),
      { status: 204 },
    ]);
    const started = Deferred.makeUnsafe<AbortSignal>();
    let calls = 0;
    let blocked = false;
    function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      calls += 1;
      if (
        calls > 1 &&
        !blocked &&
        init?.method === blockedMethod &&
        init.signal !== undefined &&
        init.signal !== null
      ) {
        blocked = true;
        const signal = init.signal;
        Deferred.doneUnsafe(started, Effect.succeed(signal));
        const unansweredRequest = Promise.withResolvers<Response>();
        if (signal.aborted) unansweredRequest.reject(signal.reason);
        else signal.addEventListener("abort", () => unansweredRequest.reject(signal.reason), { once: true });
        return unansweredRequest.promise;
      }
      return script.fetch(input, init);
    }
    fetch.preconnect = globalThis.fetch.preconnect;

    it.layer(scopedClientLayer({ ...script, fetch }), { timeout: "30 seconds" })((it) => {
      it.effect(`scope closure aborts blocked ${blockedMethod} rotation before final revocation`, () =>
        Effect.gen(function* () {
          const { client, close } = yield* ScopedClient;
          const requesting = yield* client
            .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
            .pipe(Effect.forkChild);
          const signal = yield* Deferred.await(started);
          const waiting = yield* client
            .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
            .pipe(Effect.forkChild);
          yield* close;
          assert.isTrue(signal.aborted, "scope cleanup must abort the active rotation without caller cancellation");
          const await2 = yield* Fiber.await(requesting);
          assert.isTrue(Exit.hasInterrupts(await2), "the active request must terminate");
          const await3 = yield* Fiber.await(waiting);
          assert.isTrue(Exit.hasInterrupts(await3), "queued refreshes must stop after closure");
          assert.deepStrictEqual(
            A.map(script.calls, (call) => call.method),
            ["POST", "DELETE"]
          );
          assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_first");
          assert.strictEqual(calls, 3, "only the observed initial credential is revoked, with one blocked attempt");
        })
      );
    });
  }

  {
    const script = scriptedFetch([
      tokenReply({ expiresAt: "1970-01-01T00:00:00Z", token: "ghs_first" }),
      { status: 204 },
      tokenReply({ token: "ghs_observed" }),
      { status: 204 },
    ]);
    let armed = false;
    function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      armed = armed || (script.count() === 2 && init?.method === "POST");
      return script.fetch(input, init);
    }
    fetch.preconnect = globalThis.fetch.preconnect;
    const cancelOnMint = Tracer.make({
      span(options) {
        const span = Tracer.nativeTracer.span(options);
        if (options.name !== "GitHubApp.token") return span;
        const end = span.end.bind(span);
        span.end = (endTime, exit) => {
          if (armed) Fiber.getCurrent()?.interruptUnsafe();
          end(endTime, exit);
        };
        return span;
      },
    });
    it.layer(scopedClientLayer({ ...script, fetch }), { timeout: "30 seconds" })((it) => {
      it.effect("revokes a received replacement when cancellation lands as its mint completes", () =>
        Effect.gen(function* () {
          const { client, close } = yield* ScopedClient;
          const requesting = yield* client
            .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
            .pipe(Effect.provideService(Tracer.Tracer, cancelOnMint), Effect.forkChild);
          const await4 = yield* Fiber.await(requesting);
          assert.isTrue(Exit.hasInterrupts(await4), "the requesting fiber must terminate");
          assert.strictEqual(script.count(), 3, "the replacement HTTP response was received before cancellation");
          yield* close;
          assert.deepStrictEqual(
            A.map(script.calls, (call) => call.method),
            ["POST", "DELETE", "POST", "DELETE"],
            "uninterruptible span ends deliver the interrupt after decoding, before the rotation hands the token on"
          );
          assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_first");
          assert.strictEqual(
            script.calls[3]?.headers.authorization,
            "token ghs_observed",
            "only the credential the mint already owns is revoked"
          );
        })
      );
    });
  }

  it.effect("revokes an observed credential when initial token decoding rejects the response", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([
        tokenReply({ token: "ghs_invalid_expiry", expiresAt: "not a date" }),
        { status: 204 },
      ]);
      const acquisitionScope = yield* Scope.make();
      const result = yield* Layer.buildWithScope(
        GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY }),
        acquisitionScope
      ).pipe(Effect.flip);
      yield* Scope.close(acquisitionScope, Exit.void);
      assert.strictEqual(result._tag, "GitHubAppError");
      assert.strictEqual(result.kind, "token");
      assert.deepStrictEqual(
        A.map(script.calls, (call) => call.method),
        ["POST", "DELETE"]
      );
      assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_invalid_expiry");
    })
  );

  const withClientLayer = <A, E>(
    name: string,
    replies: ReadonlyArray<Reply>,
    use: (client: GitHubClient["Service"], script: ReturnType<typeof scriptedFetch>) => Effect.Effect<A, E>
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
      })
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
        })
      );
    });
  }

  it.effect(
    "re-mints a token that has expired, revoking the old one",
    () => {
      const expiresAt = DateTime.toDateUtc(DateTime.makeUnsafe(0)).toISOString();
      const script = scriptedFetch([
        tokenReply({ expiresAt, token: "ghs_first" }),
        revokeOfSpentToken,
        tokenReply({ expiresAt: "2099-01-01T00:00:00Z", token: "ghs_second" }),
        { status: 200, body: { default_branch: "main" } },
        revokeOnScopeClose,
      ]);
      return Effect.gen(function* () {
        const context = yield* Layer.build(
          GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY })
        );
        const client = Context.get(context, GitHubClient);
        yield* TestClock.adjust(Duration.seconds(1));
        yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
        assert.strictEqual(
          script.calls[1]?.method,
          "DELETE",
          "the spent token is revoked before the replacement is minted"
        );
        assert.strictEqual(script.calls[3]?.headers.authorization, "token ghs_second");
      });
    },
    30_000
  );

  {
    const script = scriptedFetch([{ status: 401, body: { message: "Bad credentials" } }]);
    class ConstructionError extends Context.Service<ConstructionError, GitHubAppError>()(
      "@beep/github/test/GitHubApp.test/ConstructionError"
    ) {}
    it.layer(
      Layer.effect(
        ConstructionError,
        Layer.build(
          GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY })
        ).pipe(Effect.flip)
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("fails layer construction with a GitHubAppError when credentials are bad", () =>
        Effect.gen(function* () {
          const error = yield* ConstructionError;
          assert.strictEqual(
            error._tag,
            "GitHubAppError",
            "construction names what is wrong, not an opaque auth failure on first use"
          );
          assert.strictEqual(error.kind, "token");
        })
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
            { concurrency: 2 }
          );
          yield* close;
          assert.deepStrictEqual(
            A.map(values, (value) => value.default_branch),
            ["main", "main"]
          );
          assert.strictEqual(script.count(), 6, "one initial mint, one rotation, two reads and two revocations");
          assert.deepStrictEqual(
            A.map(script.calls, (call) => call.method),
            ["POST", "DELETE", "POST", "GET", "GET", "DELETE"]
          );
          assert.strictEqual(script.calls[1]?.headers.authorization, "token ghs_first");
          assert.strictEqual(script.calls[3]?.headers.authorization, "token ghs_second");
          assert.strictEqual(script.calls[4]?.headers.authorization, "token ghs_second");
          assert.strictEqual(script.calls[5]?.headers.authorization, "token ghs_second");
        })
      );
    });
  }
});

describe("GitHubApp.token down-scope", () => {
  withApp("sends no body when the request narrows nothing", [tokenReply()], (app, script) =>
    Effect.gen(function* () {
      yield* app.token({ ...CREDENTIALS, installationId: 42 });
      assert.strictEqual(
        script.calls[0]?.body,
        undefined,
        "the plain mint is byte-identical to the pre-down-scoping wire"
      );
    })
  );

  withApp(
    "sends permissions and repositories as the access_tokens body",
    [
      {
        status: 201,
        body: {
          token: "ghs_scoped",
          expires_at: "2099-01-01T00:00:00Z",
          permissions: { ...REVIEWER_SCOPE.permissions },
          repository_selection: "selected",
        },
      },
    ],
    (app, script) =>
      Effect.gen(function* () {
        const token = yield* app.token({ ...CREDENTIALS, installationId: 42, ...REVIEWER_SCOPE });
        assert.strictEqual(Redacted.value(token.token), "ghs_scoped");
        assert.strictEqual(script.count(), 1);
        assert.strictEqual(script.calls[0]?.method, "POST");
        assert.include(script.calls[0]?.url ?? "", "/app/installations/42/access_tokens");
        const value5 = yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}");
        assert.deepStrictEqual(value5, {
          repositories: ["beep-effect"],
          permissions: { ...REVIEWER_SCOPE.permissions },
        });
        yield* assertPermissions(token, REVIEWER_SCOPE.permissions);
      })
  );

  withApp("sends repository ids under GitHub's spelling", [tokenReply()], (app, script) =>
    Effect.gen(function* () {
      yield* app.token({ ...CREDENTIALS, installationId: 42, repositoryIds: [1, 2] });
      const value6 = yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}");
      assert.deepStrictEqual(value6, {
        repository_ids: [1, 2],
      });
    })
  );

  withApp(
    "fails closed when GitHub grants less than was required",
    [
      {
        status: 201,
        body: {
          token: "ghs_narrowed",
          expires_at: "2099-01-01T00:00:00Z",
          permissions: { pull_requests: "write", issues: "write", contents: "read", metadata: "read" },
        },
      },
    ],
    (app) =>
      Effect.gen(function* () {
        const token = yield* app.token({ ...CREDENTIALS, installationId: 42, ...REVIEWER_SCOPE });
        const error = yield* Effect.flip(
          assertPermissions(token, { ...REVIEWER_SCOPE.permissions, contents: "write" })
        );
        assert.strictEqual(error._tag, "TokenPermissionError");
        assert.strictEqual(error.kind, "insufficient");
        assert.deepStrictEqual(
          A.map(error.result.missing, (gap) => `${gap.permission}:${gap.required}`),
          ["checks:write", "contents:write"],
          "GitHub intersects the request with the installation: no checks, contents only read"
        );
        const kept = yield* assertPermissions({ contents: "read" })(token);
        assert.strictEqual(kept, token, "narrower than asked is accepted when the caller needs only what was granted");
      })
  );

  withApp("refuses repositories by both name and id before any call", [tokenReply()], (app, script) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        app.token({ ...CREDENTIALS, installationId: 42, repositories: ["beep-effect"], repositoryIds: [1] })
      );
      assert.strictEqual(error._tag, "GitHubAppError");
      assert.strictEqual(error.kind, "request");
      assert.include(error.reason, "pass repositories or repositoryIds, not both");
      assert.strictEqual(script.count(), 0, "an invalid request never signs a JWT or reaches GitHub");
    })
  );

  for (const [field, request] of [
    ["an owner-qualified repository name", { repositories: ["beep-effect/beep-effect"] }],
    ["an empty repository name", { repositories: [""] }],
    ["a permission name GitHub would not spell that way", { permissions: { "Pull-Requests": "write" } }],
    ["a fractional repository id", { repositoryIds: [1.5] }],
  ] as const) {
    withApp(`refuses ${field}`, [tokenReply()], (app, script) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(app.token({ ...CREDENTIALS, installationId: 42, ...request }));
        assert.strictEqual(error.kind, "request");
        assert.include(error.reason, "invalid token request");
        assert.strictEqual(script.count(), 0);
      })
    );
  }

  withApp("scopedToken mints through the same body builder", [tokenReply(), { status: 204 }], (app, script) =>
    Effect.gen(function* () {
      yield* Effect.scoped(app.scopedToken({ ...CREDENTIALS, installationId: 42, ...REVIEWER_SCOPE }));
      const value7 = yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}");
      assert.deepStrictEqual(value7, {
        repositories: ["beep-effect"],
        permissions: { ...REVIEWER_SCOPE.permissions },
      });
      assert.strictEqual(script.calls[1]?.method, "DELETE");
    })
  );
});

describe("GitHubApp.clientLayer down-scope and refresh", () => {
  it.effect(
    "threads the down-scope into every mint and refreshes refreshSkew before expiry",
    () => {
      const script = scriptedFetch([
        tokenReply({ expiresAt: "1970-01-01T00:10:00Z", token: "ghs_first" }),
        { status: 200, body: { default_branch: "main" } },
        { status: 200, body: { default_branch: "main" } },
        revokeOfSpentToken,
        tokenReply({ expiresAt: "2099-01-01T00:00:00Z", token: "ghs_second" }),
        { status: 200, body: { default_branch: "main" } },
        revokeOnScopeClose,
      ]);
      return Effect.gen(function* () {
        const context = yield* Layer.build(
          GitHubApp.clientLayer(
            { ...CREDENTIALS, installationId: 42, ...REVIEWER_SCOPE },
            { fetch: script.fetch, retry: NO_RETRY, refreshSkew: Duration.minutes(5) }
          )
        );
        const client = Context.get(context, GitHubClient);
        const read = client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
        yield* read;
        yield* TestClock.adjust(Duration.minutes(4));
        yield* read;
        assert.strictEqual(script.count(), 3, "four minutes in, the token has six minutes left and is kept");
        yield* TestClock.adjust(Duration.minutes(2));
        yield* read;
        assert.deepStrictEqual(
          A.map(script.calls, (call) => call.method),
          ["POST", "GET", "GET", "DELETE", "POST", "GET"],
          "the first token is revoked five minutes ahead of its expiry, then re-minted"
        );
        assert.strictEqual(script.calls[2]?.headers.authorization, "token ghs_first");
        assert.strictEqual(script.calls[3]?.headers.authorization, "token ghs_first");
        assert.strictEqual(script.calls[5]?.headers.authorization, "token ghs_second");
        const scopedBody = { repositories: ["beep-effect"], permissions: { ...REVIEWER_SCOPE.permissions } };
        const value8 = yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}");
        assert.deepStrictEqual(value8, scopedBody);
        const value9 = yield* S.decodeEffect(JsonObject)(script.calls[4]?.body ?? "{}");
        assert.deepStrictEqual(value9, scopedBody);
      });
    },
    30_000
  );

  it.effect("refuses a refresh skew at or past thirty minutes before any request", () => {
    const script = scriptedFetch([]);
    return Effect.gen(function* () {
      const failure = yield* GitHubApp.clientLayer(
        { ...CREDENTIALS, installationId: 42 },
        { fetch: script.fetch, retry: NO_RETRY, refreshSkew: Duration.minutes(30) }
      ).pipe(Layer.build, Effect.flip);
      assert.strictEqual(failure.kind, "request");
      assert.lengthOf(script.calls, 0);
    });
  });

  it("bounds the refresh skew in the options schema", () => {
    const isOptions = S.is(GitHubAppOptions);
    assert.isTrue(isOptions(GitHubAppOptions.make({ refreshSkew: Duration.minutes(5) })));
    assert.isFalse(isOptions({ refreshSkew: Duration.hours(1) }));
  });

  it.effect("keeps the one-minute default skew when refreshSkew is omitted", () => {
    const script = scriptedFetch([
      tokenReply({ expiresAt: "1970-01-01T00:10:00Z", token: "ghs_first" }),
      { status: 200, body: { default_branch: "main" } },
    ]);
    return Effect.gen(function* () {
      const context = yield* Layer.build(
        GitHubApp.clientLayer({ ...CREDENTIALS, installationId: 42 }, { fetch: script.fetch, retry: NO_RETRY })
      );
      const client = Context.get(context, GitHubClient);
      yield* TestClock.adjust(Duration.minutes(6));
      yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
      assert.deepStrictEqual(
        A.map(script.calls, (call) => call.method),
        ["POST", "GET"],
        "a five-minute skew would have rotated here; the default does not"
      );
    });
  });

  it.effect("concurrent requests on a live token mint once", () =>
    Effect.gen(function* () {
      const script = scriptedFetch([
        tokenReply({ token: "ghs_shared" }),
        { status: 200, body: { default_branch: "main" } },
        { status: 200, body: { default_branch: "main" } },
        { status: 200, body: { default_branch: "main" } },
      ]);
      const context = yield* Layer.build(
        GitHubApp.clientLayer(
          { ...CREDENTIALS, installationId: 42, ...REVIEWER_SCOPE },
          { fetch: script.fetch, retry: NO_RETRY }
        )
      );
      const client = Context.get(context, GitHubClient);
      const read = client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
      yield* Effect.all([read, read, read], { concurrency: "unbounded" });
      assert.deepStrictEqual(
        A.map(script.calls, (call) => call.method),
        ["POST", "GET", "GET", "GET"]
      );
      assert.lengthOf(
        A.filter(script.calls, (call) => call.method === "POST"),
        1,
        "the permit serializes refresh checks, so a live token is never re-minted"
      );
    })
  );
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
      const encoded = yield* S.encodeUnknownEffect(InstallationToken)(token);
      assert.deepStrictEqual(
        encoded,
        {
          token: "ghs_x",
          expiresAt: "2026-01-01T00:00:00.000Z",
          installationId: 1,
          permissions: { contents: "write" },
        },
        "GITHUB_STATE is plaintext by protocol, so the token is a raw string on the wire"
      );
      const decoded = yield* S.decodeEffect(InstallationToken)(encoded);
      assert.strictEqual(Redacted.value(decoded.token), "ghs_x");
      assert.isTrue(DateTime.toEpochMillis(decoded.expiresAt) === DateTime.toEpochMillis(token.expiresAt));
    })
  );

  it.effect.prop(
    "round-trips every schema-derived token through its JSON boundary",
    [Arbitrary.schema(InstallationToken)],
    Effect.fnUntraced(function* ([generated]) {
      const encoded = yield* S.encodeEffect(InstallationToken)(generated);
      const decoded = yield* S.decodeEffect(InstallationToken)(encoded);
      const value10 = yield* S.encodeEffect(InstallationToken)(decoded);
      assert.deepStrictEqual(value10, encoded, "re-encoding the decoded value reproduces the wire form exactly");
      assert.strictEqual(Redacted.value(decoded.token), Redacted.value(generated.token));
    })
  );

  it("derives the github-actions identity when the app is unidentified", () => {
    assert.deepStrictEqual(token.botIdentity(), BotIdentity.githubActions);
  });

  it("derives the app's identity when it is known", () => {
    const identified = InstallationToken.make({ ...token, appSlug: "my-app", appUserId: 42 });
    assert.deepStrictEqual(
      identified.botIdentity(),
      BotIdentity.make({ name: "my-app[bot]", email: "42+my-app[bot]@users.noreply.github.com" })
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
    assert.instanceOf(
      BotIdentity.forApp({ appSlug: "x" }),
      BotIdentity,
      "a consumer rendering a committer line needs none of the service machinery"
    );
  });

  it("renders its own DCO sign-off trailer", () => {
    assert.strictEqual(
      BotIdentity.githubActions.signoff,
      "Signed-off-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
      "Git Data API commits bypass git commit -s, so the trailer follows DCO 1.1 exactly"
    );
    assert.strictEqual(
      BotIdentity.forApp({ appSlug: "my-app", appUserId: 42 }).signoff,
      "Signed-off-by: my-app[bot] <42+my-app[bot]@users.noreply.github.com>"
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
    })
  );

  it("dies loudly on an unstubbed member", () => {
    assert.throws(() => GitHubApp.makeTest({}).token(CREDENTIALS), /was called but not stubbed/);
  });
  it.layer(GitHubApp.layerTest({ installations: () => Effect.succeed([]) }), { timeout: "30 seconds" })((it) => {
    it.effect("layerTest provides the double", () =>
      Effect.gen(function* () {
        const observed = yield* Effect.flatMap(GitHubApp, (app) => app.installations(CREDENTIALS));
        assert.deepStrictEqual(observed, []);
      })
    );
  });
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
      })
  );
});

describe("GitHubApp rate-limit observations", () => {
  const LABEL = "app:1/42";
  const headers = rateLimitHeaders({ remaining: 4_000, limit: 5_000, resource: "core" });

  const collecting = Effect.fnUntraced(function* () {
    const seen = yield* Ref.make<ReadonlyArray<RateLimitObservation>>([]);
    const sink: RateLimitSinkShape = { record: (observation) => Ref.update(seen, A.append(observation)) };
    const projected = Ref.get(seen).pipe(
      Effect.map(A.map((observation) => [observation.credential, O.getOrUndefined(observation.budgetLabel)] as const))
    );
    return { sink, projected };
  });

  it.effect("the JWT client and the installation client both carry the caller's label, unchanged", () =>
    Effect.gen(function* () {
      const { sink, projected } = yield* collecting();
      const script = scriptedFetch([
        { ...tokenReply(), headers },
        { status: 200, body: { default_branch: "main" }, headers },
        { status: 204 },
      ]);
      const context = yield* Layer.build(
        GitHubApp.clientLayer(
          { ...CREDENTIALS, installationId: 42 },
          { fetch: script.fetch, retry: NO_RETRY, budgetLabel: LABEL }
        )
      ).pipe(Effect.provideService(RateLimitSink, sink));
      const client = Context.get(context, GitHubClient);
      yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
      const observed = yield* projected;
      assert.deepStrictEqual(observed, [
        ["app-jwt", LABEL],
        ["token", LABEL],
      ]);
    })
  );

  for (const [name, installationToken, credential] of [
    ["without an installation token is unauthenticated", undefined, "unauthenticated"],
    ["with an installation token is a token", Redacted.make("ghs_x"), "token"],
  ] as const) {
    it.effect(`the bot-user lookup ${name}`, () =>
      Effect.gen(function* () {
        const { sink, projected } = yield* collecting();
        const script = scriptedFetch([
          { status: 200, body: { slug: "my-app", name: "My App", id: 1 }, headers },
          { status: 200, body: { id: 987654, login: "my-app[bot]" }, headers },
        ]);
        const context = yield* Layer.build(
          GitHubApp.layerWith({ fetch: script.fetch, retry: NO_RETRY, budgetLabel: LABEL })
        );
        const app = Context.get(context, GitHubApp);
        yield* app
          .identity({ ...CREDENTIALS, ...(installationToken === undefined ? {} : { installationToken }) })
          .pipe(Effect.provideService(RateLimitSink, sink));
        const observed = yield* projected;
        assert.deepStrictEqual(observed, [
          ["app-jwt", LABEL],
          [credential, LABEL],
        ]);
      })
    );
  }
});
