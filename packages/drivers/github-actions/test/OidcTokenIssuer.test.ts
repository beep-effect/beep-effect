import { ActionEnvironment, OidcClaims, OidcTokenIssuer } from "@beep/github-actions";
import { UnstubbedMemberError } from "@beep/utils/TestDouble";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Json = S.fromJsonString(S.Unknown);
const WorkflowClaim = S.Struct({ job_workflow_ref: S.optionalKey(S.String) });

const TOKEN_ENV = {
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-bearer",
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.example/?api-version=2.0",
};

const CLAIMS = OidcClaims.make({
  iss: "https://token.actions.githubusercontent.com",
  ref: "refs/heads/main",
  sha: "0000000000000000000000000000000000000000",
  repository: "acme/example",
  event_name: "push",
  job_workflow_ref: "acme/example/.github/workflows/release.yml@refs/heads/main",
  workflow_ref: "acme/example/.github/workflows/release.yml@refs/heads/main",
  repository_id: "1",
  repository_owner_id: "2",
  runner_environment: "github-hosted",
  run_id: "3",
  run_attempt: "1",
});

const jwtFor = (claims: unknown, signature = "sig"): string => {
  const segment = (value: unknown): string =>
    Buffer.from(
      Result.getOrThrowWith(S.encodeResult(Json)(value), (error) => error),
      "utf8"
    ).toString("base64url");
  return `${segment({ alg: "RS256", typ: "JWT" })}.${segment(claims)}.${signature}`;
};

const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(
    Result.getOrThrowWith(S.encodeResult(Json)(body), (error) => error),
    { status: 200, headers: { "content-type": "application/json" }, ...init }
  );

const live = (fake: typeof globalThis.fetch, env: Record<string, string> = TOKEN_ENV) =>
  OidcTokenIssuer.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        ActionEnvironment.layerTest(env),
        FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fake)))
      )
    )
  );

describe("OidcTokenIssuer", () => {
  describe("requesting a token", () => {
    for (const [base, expected] of [
      ["https://token.actions.example/", "https://token.actions.example/?audience=sigstore"],
      ["https://token.actions.example/#runner", "https://token.actions.example/?audience=sigstore#runner"],
      [
        "https://token.actions.example/?api-version=2.0#runner",
        "https://token.actions.example/?api-version=2.0&audience=sigstore#runner",
      ],
    ] as const) {
      const seen: Array<string> = [];
      const fake: typeof globalThis.fetch = Object.assign(
        (input: Parameters<typeof globalThis.fetch>[0]) => {
          seen.push(String(input));
          return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
        },
        { preconnect: () => {} }
      );
      it.layer(live(fake, { ...TOKEN_ENV, ACTIONS_ID_TOKEN_REQUEST_URL: base }), { timeout: "30 seconds" })((it) => {
        it.effect(`places the audience in the query for ${base}`, () =>
          Effect.gen(function* () {
            yield* (yield* OidcTokenIssuer).token("sigstore");
            assert.deepStrictEqual(seen, [expected]);
          })
        );
      });
    }

    {
      const seen: Array<{ url: string; authorization: string | null }> = [];
      const fake: typeof globalThis.fetch = Object.assign(
        (input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
          seen.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
          return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
        },
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("authenticates with the runner's bearer token", () =>
          Effect.gen(function* () {
            const token = yield* (yield* OidcTokenIssuer).token();

            assert.strictEqual(seen[0]?.authorization, "Bearer runner-bearer");
            assert.strictEqual(seen[0]?.url, TOKEN_ENV.ACTIONS_ID_TOKEN_REQUEST_URL);
            assert.include(Redacted.value(token), ".");
          })
        );
      });
    }

    {
      const seen: Array<string> = [];
      const fake: typeof globalThis.fetch = Object.assign(
        (input: Parameters<typeof globalThis.fetch>[0]) => {
          seen.push(String(input));
          return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
        },
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("appends the audience with & because the runner's url already has a query", () =>
          Effect.gen(function* () {
            yield* (yield* OidcTokenIssuer).token("sigstore");

            assert.strictEqual(
              seen[0],
              `${TOKEN_ENV.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=sigstore`,
              "a ? would start a second query string, and the runner would bind the token to the wrong audience or none"
            );
          })
        );
      });
    }

    {
      const seen: Array<string> = [];
      const fake: typeof globalThis.fetch = Object.assign(
        (input: Parameters<typeof globalThis.fetch>[0]) => {
          seen.push(String(input));
          return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
        },
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("url-encodes an audience that needs it", () =>
          Effect.gen(function* () {
            yield* (yield* OidcTokenIssuer).token("https://example.test/a b");
            assert.include(seen[0] ?? "", "audience=https%3A%2F%2Fexample.test%2Fa%20b");
          })
        );
      });
    }

    {
      const seen: Array<string> = [];
      const fake: typeof globalThis.fetch = Object.assign(
        (input: Parameters<typeof globalThis.fetch>[0]) => {
          seen.push(String(input));
          return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
        },
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("sends no audience parameter at all when none is asked for", () =>
          Effect.gen(function* () {
            yield* (yield* OidcTokenIssuer).token();
            assert.notInclude(
              seen[0] ?? "",
              "audience",
              "the runner's default audience is not the empty string, so an audience= parameter changes the token"
            );
          })
        );
      });
    }
  });

  describe("failure paths", () => {
    {
      const seen: Array<string> = [];
      const fake: typeof globalThis.fetch = Object.assign(
        (input: Parameters<typeof globalThis.fetch>[0]) => {
          seen.push(String(input));
          return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
        },
        { preconnect: () => {} }
      );
      it.layer(live(fake, { ...TOKEN_ENV, ACTIONS_ID_TOKEN_REQUEST_URL: "not a URL" }), { timeout: "30 seconds" })(
        (it) => {
          it.effect("an invalid audience request URL fails typed before any request", () =>
            Effect.gen(function* () {
              const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token("sigstore")));
              assert.strictEqual(error.reason, "requestFailed");
              assert.isDefined(error.cause);
              assert.deepStrictEqual(seen, []);
            })
          );
        }
      );
    }

    {
      const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: jwtFor(CLAIMS) })), {
        preconnect: () => {},
      });

      it.layer(live(fake, {}), { timeout: "30 seconds" })((it) => {
        it.effect("fails typed when the workflow did not grant id-token: write", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()));
            assert.strictEqual(error.reason, "unavailable");
            assert.include(error.message, "id-token: write");
          })
        );
      });
    }

    {
      const fake: typeof globalThis.fetch = Object.assign(
        () => Promise.resolve(new Response("nope", { status: 403 })),
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("fails typed on a non-2xx status, carrying it", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()));
            assert.strictEqual(error.reason, "requestFailed");
            assert.strictEqual(error.status, 403);
          })
        );
      });
    }

    {
      const fake: typeof globalThis.fetch = Object.assign(() => Promise.reject(new Error("connection reset")), {
        preconnect: () => {},
      });

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("fails typed when the transport itself fails", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()));
            assert.strictEqual(error.reason, "requestFailed");
          })
        );
      });
    }

    {
      const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ token: "wrong-key" })), {
        preconnect: () => {},
      });

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("fails typed when the envelope is the wrong shape", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()));
            assert.strictEqual(error.reason, "malformedResponse");
          })
        );
      });
    }

    {
      const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: "not-a-jwt" })), {
        preconnect: () => {},
      });

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("fails typed when the token is not a three-segment JWT", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()));
            assert.strictEqual(error.reason, "malformedToken");
            assert.include(error.message, "three segments");
          })
        );
      });
    }

    {
      const fake: typeof globalThis.fetch = Object.assign(
        () => Promise.resolve(json({ value: "aaa.!!!not-base64!!!.ccc" })),
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("fails typed when the payload is not base64url JSON", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()));
            assert.strictEqual(error.reason, "malformedToken");
          })
        );
      });
    }

    {
      const fake: typeof globalThis.fetch = Object.assign(
        () => Promise.resolve(json({ value: jwtFor({ iss: "https://x", ref: "main" }) })),
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("fails typed when the claims a provenance statement needs are absent", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()));
            assert.strictEqual(error.reason, "missingClaims");
          })
        );
      });
    }
  });

  describe("claims", () => {
    {
      const fake: typeof globalThis.fetch = Object.assign(
        () => Promise.resolve(json({ value: jwtFor(CLAIMS, "not-a-real-signature") })),
        { preconnect: () => {} }
      );

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("decodes the runner's claims without verifying the signature", () =>
          Effect.gen(function* () {
            const claims = yield* (yield* OidcTokenIssuer).claims();
            assert.deepStrictEqual(claims, CLAIMS);
          })
        );
      });
    }

    {
      const urlSafe = OidcClaims.make({ ...CLAIMS, ref: "refs/heads/~~~??>>>" });
      const token = jwtFor(urlSafe);
      const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: token })), {
        preconnect: () => {},
      });

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("decodes a payload whose base64url alphabet differs from base64", () =>
          Effect.gen(function* () {
            assert.match(
              Str.split(token, ".")[1] ?? "",
              /[-_]/,
              "real tokens hit - and _ constantly; a corpus without them passes a decoder that rejects them"
            );
            const claims = yield* (yield* OidcTokenIssuer).claims();
            assert.strictEqual(claims.ref, "refs/heads/~~~??>>>");
          })
        );
      });
    }

    {
      const padded = OidcClaims.make({ ...CLAIMS, run_id: "31415926535" });
      const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: jwtFor(padded) })), {
        preconnect: () => {},
      });

      it.layer(live(fake), { timeout: "30 seconds" })((it) => {
        it.effect("decodes a payload whose base64url needs padding", () =>
          Effect.gen(function* () {
            const claims = yield* (yield* OidcTokenIssuer).claims();
            assert.strictEqual(
              claims.run_id,
              "31415926535",
              "lengths off a multiple of four are the common case; a padding-demanding decoder fails most tokens"
            );
          })
        );
      });
    }
  });

  describe("test doubles", () => {
    it.layer(OidcTokenIssuer.layerFor(CLAIMS), { timeout: "30 seconds" })((it) => {
      it.effect("layerFor makes the provenance path reachable: the token really decodes", () =>
        Effect.gen(function* () {
          const issuer = yield* OidcTokenIssuer;
          const token = yield* issuer.token();
          const payload = Str.split(Redacted.value(token), ".")[1] ?? "";
          const decoded = Result.getOrThrowWith(
            S.decodeResult(Json)(Buffer.from(payload, "base64url").toString("utf8")),
            (error) => error
          );
          if (!S.is(WorkflowClaim)(decoded)) {
            assert.fail("expected workflow claims");
          }
          assert.strictEqual(
            decoded.job_workflow_ref,
            CLAIMS.job_workflow_ref,
            "a provenance builder decodes the token itself and must get the claims the service reports"
          );
          const claims1 = yield* issuer.claims();
          assert.deepStrictEqual(claims1, CLAIMS);
        })
      );
    });
    it.layer(OidcTokenIssuer.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("an unstubbed member dies loudly", () =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()));
          assertExitFailure(
            exit,
            Cause.die(
              UnstubbedMemberError.make({
                message: "OidcTokenIssuer.makeTest: token() was called but not stubbed — pass a `token` override.",
              })
            )
          );
        })
      );
    });
  });
});
