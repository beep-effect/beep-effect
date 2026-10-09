import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, fail } from "@effect/vitest/utils";
import * as Exit from "effect/Exit";
import type { GitHubAppShape } from "../../effected/github/index.ts";
import {
  AppIdentity,
  GitHubApp,
  GitHubAppError,
  GitHubClient,
  InstallationToken,
} from "../../effected/github/index.ts";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { TestClock } from "effect/testing";
import {
  ActionOutputs,
  ActionState,
  ActionStateError,
  GitHubToken,
  GitHubTokenError,
} from "../../effected/github-actions/index.ts";

const Json = S.fromJsonString(S.Unknown);

/** A fixed instant to reason about expiry from — the clock starts at the epoch otherwise. */
const NOW = Date.parse("2026-07-25T12:00:00.000Z");

const tokenAt = (expiresAt: string, permissions: Readonly<Record<string, string>> = { contents: "write" }) =>
  InstallationToken.make({
    token: Redacted.make("ghs_installation"),
    expiresAt: DateTime.makeUnsafe(expiresAt),
    installationId: 42,
    permissions,
  });

/**
 * The three doubles, each recording exactly what the member-usage table says
 * this bridge touches.
 */
const rig = (
  options: {
    readonly app?: Partial<GitHubAppShape>;
    readonly saved?: Map<string, string>;
    readonly outputs?: Partial<Parameters<typeof ActionOutputs.layerTest>[0]>;
  } = {}
) => {
  const events: Array<string> = [];
  const saved = options.saved ?? new Map<string, string>();
  const revoked: Array<string> = [];

  const app = GitHubApp.layerTest({
    revoke: (token) =>
      Effect.suspend(() => {
        events.push("revoke");
        revoked.push(Redacted.value(token));
        return Effect.void;
      }),
    ...options.app,
  });
  const outputs = ActionOutputs.layerTest({
    setSecret: (value) =>
      Effect.suspend(() => {
        events.push(`mask:${value}`);
        return Effect.void;
      }),
    ...options.outputs,
  });
  const state = ActionState.layerTest({
    save: Effect.fn("save")(function* (key, value, schema) {
      events.push(`save:${key}`);
      saved.set(
        key,
        Result.getOrThrowWith(S.encodeResult(Json)(yield* S.encodeUnknownEffect(schema)(value)), (error) => error)
      );
    }, Effect.orDie),
    get: (key, schema) =>
      Effect.suspend(() => {
        const found = saved.get(key);
        return found === undefined
          ? Effect.die(new Error(`nothing saved under ${key}`))
          : S.decodeUnknownEffect(schema)(Result.getOrThrowWith(S.decodeResult(Json)(found), (error) => error)).pipe(
              Effect.orDie
            );
      }),
    getOptional: (key, schema) =>
      Effect.suspend(() => {
        const found = saved.get(key);
        return found === undefined
          ? Effect.succeedNone
          : S.decodeUnknownEffect(schema)(Result.getOrThrowWith(S.decodeResult(Json)(found), (error) => error)).pipe(
              Effect.orDie,
              Effect.asSome
            );
      }),
  });
  return { events, saved, revoked, layer: Layer.mergeAll(app, outputs, state) };
};

const CREDENTIALS = { appId: "123456", privateKey: Redacted.make("-----BEGIN PRIVATE KEY-----") };

const identity = (userId?: number): AppIdentity =>
  AppIdentity.make({ slug: "my-app", name: "My App", ...(userId === undefined ? {} : { userId }) });

describe("GitHubToken", () => {
  describe("provision", () => {
    {
      const seen: Array<Redacted.Redacted<string> | undefined> = [];
      const harness = rig({
        app: {
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: (request) =>
            Effect.suspend(() => {
              seen.push(request.installationToken);
              return Effect.succeed(identity(99));
            }),
        },
      });
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("masks the token BEFORE it is persisted", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const provisioned = yield* GitHubToken.provision(CREDENTIALS);

            // `GITHUB_STATE` is a plaintext file by GitHub's protocol, so the mask
            // is the only defense — and it is worth nothing if it lands after the
            // write. The ordering is the assertion.
            assert.deepStrictEqual(harness.events, ["mask:ghs_installation", "save:githubToken"]);
            assert.strictEqual(provisioned.appSlug, "my-app");
            assert.strictEqual(provisioned.appUserId, 99);
            // The lookup is authenticated with the installation token on purpose:
            // `GET /users/{slug}[bot]` rejects an app JWT, and the unauthenticated
            // fallback is rate-limited to sixty per hour per IP.
            assert.deepStrictEqual(seen, [Redacted.make("ghs_installation")]);
          })
        );
      });
    }

    {
      const harness = rig({
        app: {
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: () => Effect.succeed(identity(99)),
        },
      });
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("persists the enriched token, so a later phase can read the identity", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            yield* GitHubToken.provision(CREDENTIALS);
            const identityInPost = yield* GitHubToken.botIdentity();
            assert.strictEqual(identityInPost.name, "my-app[bot]");
            assert.strictEqual(identityInPost.email, "99+my-app[bot]@users.noreply.github.com");
          })
        );
      });
    }

    {
      const harness = rig({
        app: {
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: () => Effect.fail(GitHubAppError.of("identity", "GET /app answered 502")),
        },
      });
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("degrades when the identity lookup fails, rather than failing the action", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const provisioned = yield* GitHubToken.provision(CREDENTIALS);
            // A cosmetic request must not fail a release. The commit identity falls
            // back to the well-known bot instead.
            assert.isUndefined(provisioned.appSlug);
            assert.strictEqual(provisioned.botIdentity().name, "github-actions[bot]");
            assert.deepStrictEqual(harness.events, ["mask:ghs_installation", "save:githubToken"]);
          })
        );
      });
    }

    {
      const harness = rig({
        app: { token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z", { contents: "read" })) },
      });
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("revokes the minted token when the granted scopes are insufficient", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const error = yield* Effect.flip(
              GitHubToken.provision({ ...CREDENTIALS, required: { contents: "write" } })
            );
            assert.strictEqual(error._tag, "TokenPermissionError");
            // Defense in depth: a workflow that retries a failing `pre` would
            // otherwise leave an hour of unreferenced write tokens behind, each one
            // a live credential nobody is tracking.
            assert.deepStrictEqual(harness.revoked, ["ghs_installation"]);
            assert.strictEqual(harness.saved.size, 0);
          })
        );
      });
    }

    {
      const revoked: Array<string> = [];
      const failing = Layer.mergeAll(
        GitHubApp.layerTest({
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: () => Effect.succeed(identity()),
          revoke: (token) =>
            Effect.suspend(() => {
              revoked.push(Redacted.value(token));
              return Effect.void;
            }),
        }),
        ActionOutputs.layerTest({ setSecret: () => Effect.void }),
        ActionState.layerTest({
          save: (key) => Effect.fail(ActionStateError.make({ reason: "writeFailed", key })),
        })
      );
      it.layer(failing, { timeout: "30 seconds" })((it) => {
        it.effect("revokes the minted token when persistence fails", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const error = yield* Effect.flip(GitHubToken.provision(CREDENTIALS));
            assert.instanceOf(error, ActionStateError);
            // A token that was minted and then not handed on is a live credential
            // with no owner. The release arm is what stops the retry loop from
            // accumulating them.
            assert.deepStrictEqual(revoked, ["ghs_installation"]);
          })
        );
      });
    }

    {
      const harness = rig({
        app: {
          token: () =>
            Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z", { contents: "write", pull_requests: "write" })),
          identity: () => Effect.succeed(identity()),
        },
      });
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("checks the scopes GitHub granted, not the ones asked for", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            // Satisfied, and a broader grant is not an error — only `assertExact`
            // treats extra permissions as a misconfiguration.
            yield* GitHubToken.provision({ ...CREDENTIALS, required: { contents: "write" } });
            assert.strictEqual(harness.saved.size, 1);
          })
        );
      });
    }
  });

  describe("reading it back in a later phase", () => {
    const persisted = (expiresAt: string) => {
      const harness = rig({
        app: {
          token: () => Effect.succeed(tokenAt(expiresAt)),
          identity: () => Effect.succeed(identity()),
        },
      });
      return {
        ...harness,
        seed: GitHubToken.provision(CREDENTIALS),
      };
    };

    {
      const harness = persisted("2026-07-25T13:00:00.000Z");
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("hands back a token that is still good", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            yield* harness.seed;
            const token = yield* GitHubToken.read();
            assert.strictEqual(token.installationId, 42);
          })
        );
      });
    }

    {
      const harness = persisted("2026-07-25T13:00:00.000Z");
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("fails typed once the token is spent, rather than answering 401 later", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            yield* harness.seed;
            // An hour and a minute later. The package this replaces persisted the
            // expiry and read it nowhere, so this case presented as an
            // unexplained 401 in the middle of a long `main` phase.
            yield* TestClock.setTime(NOW + 61 * 60 * 1000);
            const error = yield* Effect.flip(GitHubToken.read());
            assert.instanceOf(error, GitHubTokenError);
            assert.strictEqual(error.reason, "expired");
            assert.include(error.message, "2026-07-25T13:00:00");
          })
        );
      });
    }

    {
      const harness = persisted("2026-07-25T13:00:00.000Z");
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("treats the last minute before expiry as spent, and the skew is adjustable", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            yield* harness.seed;
            // Thirty seconds out: inside the default skew, because the check and the
            // request it guards are not the same instant.
            yield* TestClock.setTime(Date.parse("2026-07-25T12:59:30.000Z"));
            assert.strictEqual((yield* Effect.flip(GitHubToken.read())).reason, "expired");
            const token = yield* GitHubToken.read({ skew: Duration.zero });
            assert.strictEqual(token.installationId, 42);
          })
        );
      });
    }

    {
      const harness = persisted("2026-07-25T13:00:00.000Z");
      const seen: Array<string | null> = [];
      const fetch: typeof globalThis.fetch = Object.assign(
        (_input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
          seen.push(new Headers(init?.headers).get("authorization"));
          return Promise.resolve(
            new Response(JSON.stringify({ login: "acme" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            })
          );
        },
        { preconnect: () => {} }
      );
      const seeded = Layer.effect(
        ActionState,
        Effect.gen(function* () {
          yield* TestClock.setTime(NOW);
          yield* GitHubToken.provision(CREDENTIALS);
          return yield* ActionState;
        })
      ).pipe(Layer.provide(harness.layer));
      // The later phase builds from the persisted token, without linking an app JWT signer.
      const client = GitHubToken.clientLayer({ fetch }).pipe(Layer.provide(seeded));
      it.layer(client, { timeout: "30 seconds" })((it) => {
        it.effect("builds a client that authenticates with the persisted token", () =>
          Effect.gen(function* () {
            const github = yield* GitHubClient;
            yield* github.request("GET /users/{username}", { username: "acme" });
            assert.deepStrictEqual(seen, ["token ghs_installation"]);
          })
        );
      });
    }
  });

  describe("dispose", () => {
    {
      const harness = rig();
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("is a no-op when no earlier phase provisioned anything", () =>
          Effect.gen(function* () {
            // `post` still runs when `pre` failed before minting anything.
            yield* GitHubToken.dispose();
            assert.deepStrictEqual(harness.revoked, []);
          })
        );
      });
    }

    {
      const harness = rig({
        app: {
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: () => Effect.succeed(identity()),
        },
      });
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("revokes a token that is still live", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            yield* GitHubToken.provision(CREDENTIALS);
            yield* GitHubToken.dispose();
            assert.deepStrictEqual(harness.revoked, ["ghs_installation"]);
          })
        );
      });
    }

    {
      const harness = rig({
        app: {
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: () => Effect.succeed(identity()),
        },
      });
      it.layer(harness.layer, { timeout: "30 seconds" })((it) => {
        it.effect("does not revoke a token GitHub has already expired", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            yield* GitHubToken.provision(CREDENTIALS);
            yield* TestClock.setTime(NOW + 2 * 60 * 60 * 1000);
            yield* GitHubToken.dispose();
            // The request would fail, and the only thing it could accomplish is
            // turning a successful run into a failed one on the way out.
            assert.deepStrictEqual(harness.revoked, []);
          })
        );
      });
    }
  });

  describe("the member-usage table is executable", () => {
    {
      const exact = Layer.mergeAll(
        GitHubApp.layerTest({
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: () => Effect.succeed(identity()),
          revoke: () => Effect.void,
        }),
        ActionOutputs.layerTest({ setSecret: () => Effect.void }),
        ActionState.layerTest({ save: () => Effect.void })
      );
      it.layer(exact, { timeout: "30 seconds" })((it) => {
        it.effect("a double supplying exactly the documented members satisfies provision", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const provisioned = yield* GitHubToken.provision(CREDENTIALS);
            assert.strictEqual(provisioned.installationId, 42);
          })
        );
      });
    }

    {
      const missing = Layer.mergeAll(
        GitHubApp.layerTest({
          token: () => Effect.succeed(tokenAt("2026-07-25T13:00:00.000Z")),
          identity: () => Effect.succeed(identity()),
          revoke: () => Effect.void,
        }),
        ActionOutputs.layerTest(),
        ActionState.layerTest({ save: () => Effect.void })
      );
      it.layer(missing, { timeout: "30 seconds" })((it) => {
        it.effect("a double missing setSecret dies, naming the member", () =>
          Effect.gen(function* () {
            // The control for the table above: without it, "exactly these members"
            // could be true of a double that needed fewer.
            yield* TestClock.setTime(NOW);
            const exit = yield* Effect.exit(GitHubToken.provision(CREDENTIALS));
            Exit.match(exit, {
              onFailure: (cause) => assertExitFailure(exit, cause),
              onSuccess: () => fail("Expected a failure from the missing setSecret member"),
            });
          })
        );
      });
    }
  });
});
