import { IdentityToken, IdentityTokenError } from "@beep/sbom";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const HELD = Redacted.make("held-token");

describe("IdentityToken.layerStatic", () => {
  it.layer(IdentityToken.layerStatic("held-token"), { timeout: "10 seconds" })("with a plain string", (it) => {
    it.effect("answers with a token the caller already holds", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const token = yield* identity.token("sigstore");
        assert.strictEqual(
          Redacted.value(token),
          "held-token",
          "a held token answers with no Actions runtime, HTTP client or platform peer"
        );
      })
    );

    it.effect("ignores the audience, because it cannot honour one", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const first = yield* identity.token("sigstore");
        const second = yield* identity.token("something-else");
        assert.strictEqual(
          Redacted.value(first),
          Redacted.value(second),
          "a static token was minted before this layer, so filtering by audience would claim an unperformed check"
        );
      })
    );

    it.effect("keeps the token redacted — printing it does not leak it", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const token = yield* identity.token("sigstore");
        assert.notInclude(String(token), "held-token");
      })
    );
  });

  it.layer(IdentityToken.layerStatic(HELD), { timeout: "10 seconds" })("with an already-redacted token", (it) => {
    it.effect("accepts an already-redacted token without unwrapping and rewrapping it", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const token1 = yield* identity.token("sigstore");
        assert.strictEqual(
          token1,
          HELD,
          "identity, not equality: a Redacted.value round trip would compare equal and declassify the token"
        );
      })
    );
  });
});

describe("IdentityToken doubles", () => {
  it.layer(IdentityToken.layerTest(), { timeout: "10 seconds" })("the default double", (it) => {
    it.effect("answers rather than dying — a test token is a real answer", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const token2 = yield* identity.token("sigstore");
        assert.strictEqual(
          Redacted.value(token2),
          "test-identity-token",
          "a fabricated OIDC token is a legitimate test answer, where a fabricated signature would be a lie"
        );
      })
    );
  });

  it.layer(
    IdentityToken.layerTest({
      token: (audience) => Effect.fail(IdentityTokenError.make({ audience, cause: new Error("nope") })),
    }),
    { timeout: "10 seconds" }
  )("an override for the failure path", (it) => {
    it.effect("take an override for the failure path", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const error = yield* Effect.flip(identity.token("sigstore"));
        assert.instanceOf(error, IdentityTokenError);
        assert.strictEqual(error.audience, "sigstore");
      })
    );
  });
});

describe("IdentityTokenError", () => {
  it("names the audience, because that is the first thing to check", () => {
    const error = IdentityTokenError.make({ audience: "sigstore", cause: new Error("403") });
    assert.include(error.message, "sigstore");
    assert.strictEqual(error._tag, "IdentityTokenError");
  });
});
