// The inverted OIDC contract.
//
// The whole point of declaring this here rather than importing an issuer is
// that the signing path becomes testable with no Actions runtime, no HTTP
// client and no platform peer — which is what every test in this file, and the
// signer's whole suite, relies on.

import { IdentityToken, IdentityTokenError } from "@beep/sbom";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

/** One instance, so a test can assert identity rather than equality. */
const HELD = Redacted.make("held-token");

describe("IdentityToken.layerStatic", () => {
  it.layer(IdentityToken.layerStatic("held-token"), { timeout: "10 seconds" })("with a plain string", (it) => {
    it.effect("answers with a token the caller already holds", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const token = yield* identity.token("sigstore");
        assert.strictEqual(Redacted.value(token), "held-token");
      })
    );

    it.effect("ignores the audience, because it cannot honour one", () =>
      Effect.gen(function* () {
        // Documented rather than pretended: a static token was minted before this
        // layer existed, and a layer that filtered by audience would be claiming
        // a check it cannot perform.
        const identity = yield* IdentityToken;
        const first = yield* identity.token("sigstore");
        const second = yield* identity.token("something-else");
        assert.strictEqual(Redacted.value(first), Redacted.value(second));
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
        // Identity, not equality: the layer must hand back the very value it was
        // given. A `Redacted.value` round trip through a string would compare
        // equal and would be a declassification this package promises not to do.
        const identity = yield* IdentityToken;
        assert.strictEqual(yield* identity.token("sigstore"), HELD);
      })
    );
  });
});

describe("IdentityToken doubles", () => {
  it.layer(IdentityToken.layerTest(), { timeout: "10 seconds" })("the default double", (it) => {
    it.effect("answers rather than dying — a test token is a real answer", () =>
      Effect.gen(function* () {
        // Contrast the deferred signer's `SigstoreSigner.makeTest`, which dies: a
        // fabricated OIDC token is a legitimate test answer, a fabricated
        // signature is a lie.
        const identity = yield* IdentityToken;
        assert.strictEqual(Redacted.value(yield* identity.token("sigstore")), "test-identity-token");
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
