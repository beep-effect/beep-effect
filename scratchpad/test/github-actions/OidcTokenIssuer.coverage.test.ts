import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { OidcTokenError, OidcTokenIssuer } from "../../effected/github-actions/OidcTokenIssuer.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
describe("OidcTokenIssuer coverage", () => {
  it.effect("every token error explains its reason with optional status and detail", () => Effect.sync(() => {
    assert.strictEqual(OidcTokenError.make({ reason: "unavailable" }).message, "The runner published no OIDC token service; the workflow needs `permissions: id-token: write`");
    assert.strictEqual(OidcTokenError.make({ reason: "requestFailed" }).message, "The OIDC token request failed");
    assert.strictEqual(OidcTokenError.make({ reason: "requestFailed", status: 401 }).message, "The OIDC token request failed with status 401");
    assert.strictEqual(OidcTokenError.make({ reason: "malformedResponse" }).message, "The OIDC token service answered with an unexpected shape");
    assert.strictEqual(OidcTokenError.make({ reason: "malformedToken" }).message, "The OIDC token is not a decodable JWT");
    assert.strictEqual(OidcTokenError.make({ reason: "malformedToken", detail: "bad payload" }).message, "The OIDC token is not a decodable JWT: bad payload");
    assert.strictEqual(OidcTokenError.make({ reason: "missingClaims" }).message, "The OIDC token is missing claims a provenance statement needs");
  }));
  it.layer(OidcTokenIssuer.layerTest(), { timeout: "5 seconds" })((it) => {
    it.effect("unstubbed claims die naming the missing override", () => Effect.gen(function* () {
      const issuer = yield* OidcTokenIssuer;
      assertExitFailure(yield* Effect.exit(issuer.claims()), Cause.die(UnstubbedMemberError.make({ message: "OidcTokenIssuer.makeTest: claims() was called but not stubbed — pass a `claims` override." })));
    }));
  });
});
