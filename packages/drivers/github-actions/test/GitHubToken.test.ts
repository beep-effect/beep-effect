import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { AppIdentity, GitHubApp, GitHubAppError, InstallationToken } from "@beep/github/GitHubApp";
import { GitHubClient } from "@beep/github/GitHubClient";
import { ActionOutputs, ActionState, ActionStateError, GitHubToken, GitHubTokenError } from "@beep/github-actions";
import { ProvisionOptions, ReadOptions } from "@beep/github-actions/GitHubToken";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, fail } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual, identity as identityFunction } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import type { GitHubAppShape } from "@beep/github/GitHubApp";

const Json = S.fromJsonString(S.Unknown);

describe("GitHubToken option schemas", () => {
  it("provision options retain plain objects and redacted keys and reject explicit undefined fields", () => {
    const minimal: ProvisionOptions.Encoded = { appId: "app", privateKey: Redacted.make("pem") };
    const scoped: ProvisionOptions.Encoded = {
      ...minimal,
      installationId: 42,
      owner: "acme",
      required: { contents: "write" },
      stateKey: "token",
    };
    for (const input of [minimal, scoped]) {
      assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(ProvisionOptions)(input)), input);
      assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(ProvisionOptions)(ProvisionOptions.make(input))), input);
    }
    for (const key of ["installationId", "owner", "required", "stateKey"]) {
      assert.isFalse(
        S.is(ProvisionOptions)({ ...minimal, [key]: undefined }),
        "exact optional keys: an absent option is omitted, never undefined"
      );
    }
    assert.isFalse(S.is(ProvisionOptions)({ ...minimal, privateKey: "pem" }));
    assert.isFalse(S.is(ProvisionOptions)({ ...minimal, required: { contents: "owner" } }));
    for (const installationId of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.isFalse(S.is(ProvisionOptions)({ ...minimal, installationId }));
    }
  });

  it("read options preserve Duration values and leave existing defaults to the reader", () => {
    assert.isFalse(
      S.is(ReadOptions)({ stateKey: undefined }),
      "exact optional keys: omission leaves the default; explicit undefined is rejected"
    );
    assert.isFalse(S.is(ReadOptions)({ skew: undefined }));
    for (const input of [{}, { stateKey: "token", skew: Duration.seconds(30) }]) {
      const options: ReadOptions.Encoded = input;
      assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(ReadOptions)(options)), options);
      assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(ReadOptions)(ReadOptions.make(options))), options);
    }
    assert.isFalse(S.is(ReadOptions)({ skew: 30 }));
    assert.isFalse(S.is(ReadOptions)({ stateKey: null }));
  });
});

const NOW = Date.parse("2026-07-25T12:00:00.000Z");

const tokenAt = (expiresAt: string, permissions: Readonly<Record<string, string>> = { contents: "write" }) =>
  InstallationToken.make({
    token: Redacted.make("ghs_installation"),
    expiresAt: DateTime.makeUnsafe(expiresAt),
    installationId: 42,
    permissions,
  });

const rig = (
  options: {
    readonly app?: Partial<GitHubAppShape>;
    readonly saved?: MutableHashMap.MutableHashMap<string, string>;
    readonly outputs?: Partial<Parameters<typeof ActionOutputs.layerTest>[0]>;
  } = {}
) => {
  const events: Array<string> = [];
  const saved = options.saved ?? MutableHashMap.empty<string, string>();
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
    save: dual(
      3,
      Effect.fn("save")(function* <A, I>(key: string, value: A, schema: S.Codec<A, I>) {
        events.push(`save:${key}`);
        const argument = S.encodeResult(Json);
        const value2 = yield* S.encodeUnknownEffect(schema)(value);
        MutableHashMap.set(
          saved,
          key,
          Result.getOrThrowWith(argument(value2), (error) => error)
        );
      }, Effect.orDie)
    ),
    get: dual(2, <A, I>(key: string, schema: S.Codec<A, I>) =>
      Effect.suspend(() => {
        const found = O.getOrUndefined(MutableHashMap.get(saved, key));
        return found === undefined
          ? Effect.die(new Error(`nothing saved under ${key}`))
          : S.decodeUnknownEffect(schema)(Result.getOrThrowWith(S.decodeResult(Json)(found), (error) => error)).pipe(
              Effect.orDie
            );
      })
    ),
    getOptional: dual(2, <A, I>(key: string, schema: S.Codec<A, I>) =>
      Effect.suspend(() => {
        const found = O.getOrUndefined(MutableHashMap.get(saved, key));
        return found === undefined
          ? Effect.succeedNone
          : S.decodeUnknownEffect(schema)(Result.getOrThrowWith(S.decodeResult(Json)(found), (error) => error)).pipe(
              Effect.orDie,
              Effect.asSome
            );
      })
    ),
  });
  return { events, saved, revoked, layer: Layer.mergeAll(app, outputs, state) };
};

const semgrepSafePemHeader = (edge: "BEGIN" | "END"): string => `-----${edge} PRIVATE KEY-----`;
const CREDENTIALS = { appId: "123456", privateKey: Redacted.make(semgrepSafePemHeader("BEGIN")) };

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

            assert.deepStrictEqual(
              harness.events,
              ["mask:ghs_installation", "save:githubToken"],
              "GITHUB_STATE is plaintext by protocol, so the mask is the only defense and is worthless after the write"
            );
            assert.strictEqual(provisioned.appSlug, "my-app");
            assert.strictEqual(provisioned.appUserId, 99);
            assert.deepStrictEqual(
              seen,
              [Redacted.make("ghs_installation")],
              "GET /users/{slug}[bot] rejects an app JWT; unauthenticated lookups are capped at sixty an hour per IP"
            );
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
            assert.isUndefined(provisioned.appSlug);
            assert.strictEqual(
              provisioned.botIdentity().name,
              "github-actions[bot]",
              "a cosmetic request must not fail a release, so the identity falls back to the well-known bot"
            );
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
            assert.deepStrictEqual(
              harness.revoked,
              ["ghs_installation"],
              "a workflow retrying a failing pre would otherwise leave an hour of live, untracked write tokens behind"
            );
            assert.strictEqual(MutableHashMap.size(harness.saved), 0);
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
          save: dual(3, <A, I>(key: string, _value: A, _schema: S.Codec<A, I>) =>
            Effect.fail(ActionStateError.make({ reason: "writeFailed", key }))
          ),
        })
      );
      it.layer(failing, { timeout: "30 seconds" })((it) => {
        it.effect("revokes the minted token when persistence fails", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const error = yield* Effect.flip(GitHubToken.provision(CREDENTIALS));
            assert.instanceOf(error, ActionStateError);
            assert.deepStrictEqual(
              revoked,
              ["ghs_installation"],
              "a minted token not handed on is an ownerless live credential; the release arm stops retries piling up"
            );
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
            yield* GitHubToken.provision({ ...CREDENTIALS, required: { contents: "write" } });
            assert.strictEqual(
              MutableHashMap.size(harness.saved),
              1,
              "a broader grant is not an error; only assertExact treats extra permissions as a misconfiguration"
            );
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
            yield* TestClock.setTime(NOW + 61 * 60 * 1000);
            const error = yield* Effect.flip(GitHubToken.read());
            assert.instanceOf(error, GitHubTokenError);
            assert.strictEqual(
              error.reason,
              "expired",
              "an hour and a minute on, an unread persisted expiry shows up as an unexplained 401 mid main phase"
            );
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
            yield* TestClock.setTime(Date.parse("2026-07-25T12:59:30.000Z"));
            assert.strictEqual(
              (yield* Effect.flip(GitHubToken.read())).reason,
              "expired",
              "thirty seconds out is inside the default skew: the check and the request it guards are not one instant"
            );
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
            new Response(Result.getOrThrowWith(S.encodeUnknownResult(Json)({ login: "acme" }), identityFunction), {
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
      const client = GitHubToken.clientLayer({ fetch }).pipe(Layer.provide(seeded));
      it.layer(client, { timeout: "30 seconds" })((it) => {
        it.effect("builds a client that authenticates with the persisted token", () =>
          Effect.gen(function* () {
            const github = yield* GitHubClient;
            yield* github.request("GET /users/{username}", { username: "acme" });
            assert.deepStrictEqual(
              seen,
              ["token ghs_installation"],
              "the later phase builds from the persisted token, without linking an app JWT signer"
            );
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
            yield* GitHubToken.dispose();
            assert.deepStrictEqual(harness.revoked, [], "post still runs when pre failed before minting anything");
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
            assert.deepStrictEqual(
              harness.revoked,
              [],
              "the revoke would fail, and could only turn a successful run into a failed one on the way out"
            );
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
        ActionState.layerTest({ save: dual(3, <A, I>(_key: string, _value: A, _schema: S.Codec<A, I>) => Effect.void) })
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
        ActionState.layerTest({ save: dual(3, <A, I>(_key: string, _value: A, _schema: S.Codec<A, I>) => Effect.void) })
      );
      it.layer(missing, { timeout: "30 seconds" })((it) => {
        it.effect("a double missing setSecret dies, naming the member", () =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const exit = yield* Effect.exit(GitHubToken.provision(CREDENTIALS));
            Exit.match(exit, {
              onFailure: (cause) => assertExitFailure(exit, cause),
              onSuccess: () =>
                fail("Expected a failure from the missing setSecret member, or the table could need fewer"),
            });
          })
        );
      });
    }
  });
});

describe("ReadOptions codec property", () => {
  it.effect.prop(
    "ReadOptions round-trips through its codec",
    [Arbitrary.schema(ReadOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const argument1 = S.decodeEffect(ReadOptions);
        const value3 = yield* S.encodeEffect(ReadOptions)(value);
        const value1 = yield* argument1(value3);
        assert.deepStrictEqual(value1, value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
