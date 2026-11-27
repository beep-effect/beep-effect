import { ActionsIdentityToken, OidcClaims, OidcTokenError, OidcTokenIssuer } from "@beep/github-actions";
import { IdentityToken, IdentityTokenError } from "@beep/sbom/IdentityToken";
import { UnstubbedMemberError } from "@beep/utils/TestDouble";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

const CLAIMS = OidcClaims.make({
  iss: "https://token.actions.githubusercontent.com",
  ref: "refs/heads/main",
  sha: "abc123",
  repository: "owner/repo",
  event_name: "push",
  job_workflow_ref: "owner/repo/.github/workflows/release.yml@refs/heads/main",
  workflow_ref: "owner/repo/.github/workflows/release.yml@refs/heads/main",
  repository_id: "1",
  repository_owner_id: "2",
  runner_environment: "github-hosted",
  run_id: "3",
  run_attempt: "1",
});
describe("ActionsIdentityToken", () => {
  it.layer(ActionsIdentityToken.layer.pipe(Layer.provide(OidcTokenIssuer.layerFor(CLAIMS))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("serves sbom's IdentityToken from the runner's OIDC issuer", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const token = yield* identity.token("sigstore");
        const expected = OidcTokenIssuer.unsignedTokenFor(CLAIMS);
        assert.include(
          Redacted.value(expected),
          ".",
          "layerFor answers a real decodable JWT built from the claims; only this local fixture is opened"
        );
        assert.isTrue(
          Equal.equals(token, expected),
          "Redacted is Equal-by-value, so comparing never declassifies the token that crossed the seam"
        );
      })
    );
  });

  {
    const audiences: Array<string | undefined> = [];
    it.layer(
      ActionsIdentityToken.layer.pipe(
        Layer.provide(
          OidcTokenIssuer.layerTest({
            token: (audience) =>
              Effect.suspend(() => {
                audiences.push(audience);
                return Effect.succeed(Redacted.make("issued"));
              }),
          })
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("forwards the audience to the issuer verbatim", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(IdentityToken, (identity) => identity.token("sigstore"));
          assert.deepStrictEqual(
            audiences,
            ["sigstore"],
            "the audience is the caller's (SigstoreSigner asks for sigstore); the adapter passes it, never defaults it"
          );
        })
      );
    });
  }
  it.layer(
    ActionsIdentityToken.layer.pipe(
      Layer.provide(
        OidcTokenIssuer.layerTest({
          token: () =>
            Effect.fail(OidcTokenError.make({ reason: "unavailable", detail: "ACTIONS_ID_TOKEN_REQUEST_URL" })),
        })
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("rewraps an issuer failure as IdentityTokenError, keeping the audience and the cause", () =>
      Effect.gen(function* () {
        const identity = yield* IdentityToken;
        const error = yield* Effect.flip(identity.token("sigstore"));
        assert.instanceOf(error, IdentityTokenError);
        assert.strictEqual(error.audience, "sigstore");
        assert.instanceOf(
          error.cause,
          OidcTokenError,
          "the OidcTokenError survives, so why the runner declined (missing id-token: write) stays readable"
        );
        const cause = error.cause;
        if (!S.is(OidcTokenError)(cause)) {
          assert.fail("expected the original OidcTokenError");
        }
        assert.strictEqual(cause.reason, "unavailable");
      })
    );
  });
  it.layer(ActionsIdentityToken.layer.pipe(Layer.provide(OidcTokenIssuer.layerTest())), { timeout: "30 seconds" })(
    (it) => {
      it.effect("an unstubbed issuer member still dies loudly through the adapter", () =>
        Effect.gen(function* () {
          const identity = yield* IdentityToken;
          const exit = yield* Effect.exit(identity.token("sigstore"));
          assertExitFailure(
            exit,
            Cause.die(
              UnstubbedMemberError.make({
                message: "OidcTokenIssuer.makeTest: token() was called but not stubbed — pass a `token` override.",
              })
            )
          );
          assert.isTrue(
            Cause.hasDies(exit.cause),
            "the die-loudly default crosses the bridge as a defect; a bare Failure check would pass a typed fail"
          );
        })
      );
    }
  );
});
