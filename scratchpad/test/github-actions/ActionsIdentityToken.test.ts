import { assert, describe, it } from "@effect/vitest";
import { IdentityToken, IdentityTokenError } from "../../effected/sbom/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import {
	ActionsIdentityToken,
	OidcClaims,
	OidcTokenError,
	OidcTokenIssuer,
} from "../../effected/github-actions/index.ts";
import { assertExitFailure } from "@effect/vitest/utils";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";

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
	{
		it.layer(ActionsIdentityToken.layer.pipe(Layer.provide(OidcTokenIssuer.layerFor(CLAIMS))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("serves sbom's IdentityToken from the runner's OIDC issuer", () =>
				Effect.gen(function* () {
					const identity = yield* IdentityToken;
					const token = yield* identity.token("sigstore");
					// `layerFor` answers with a real decodable JWT built from the claims,
					// so the value crossing the seam is a token, not a placeholder. The
					// value that crossed the seam stays OPAQUE: `Redacted` is
					// Equal-by-value, so the comparison never declassifies `token` —
					// only the locally built fixture is opened for the format check.
					const expected = OidcTokenIssuer.unsignedTokenFor(CLAIMS);
					assert.include(Redacted.value(expected), ".");
					assert.isTrue(Equal.equals(token, expected));
				}),
			);
		});
	}

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
					}),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("forwards the audience to the issuer verbatim", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(IdentityToken, (identity) => identity.token("sigstore"));
					// The audience is the caller's (`SigstoreSigner` asks for `sigstore`
					// itself); the adapter must pass it through rather than defaulting it.
					assert.deepStrictEqual(audiences, ["sigstore"]);
				}),
			);
		});
	}

	{
		it.layer(
			ActionsIdentityToken.layer.pipe(
				Layer.provide(
					OidcTokenIssuer.layerTest({
						token: () =>
							Effect.fail(OidcTokenError.make({ reason: "unavailable", detail: "ACTIONS_ID_TOKEN_REQUEST_URL" })),
					}),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("rewraps an issuer failure as IdentityTokenError, keeping the audience and the cause", () =>
				Effect.gen(function* () {
					const identity = yield* IdentityToken;
					const error = yield* Effect.flip(identity.token("sigstore"));
					assert.instanceOf(error, IdentityTokenError);
					assert.strictEqual(error.audience, "sigstore");
					// The original OidcTokenError survives structurally, so "why did the
					// runner decline" (missing `id-token: write`) is still readable.
					assert.instanceOf(error.cause, OidcTokenError);
					const cause = error.cause;
					if (!S.is(OidcTokenError)(cause)) {
						assert.fail("expected the original OidcTokenError");
					}
					assert.strictEqual(cause.reason, "unavailable");
				}),
			);
		});
	}

	{
		it.layer(ActionsIdentityToken.layer.pipe(Layer.provide(OidcTokenIssuer.layerTest())), { timeout: "30 seconds" })(
			(it) => {
				it.effect("an unstubbed issuer member still dies loudly through the adapter", () =>
					Effect.gen(function* () {
						const identity = yield* IdentityToken;
						const exit = yield* Effect.exit(identity.token("sigstore"));
						// The die-loudly default survives the bridge AS A DEFECT: a bare
						// Failure check would also pass for a typed fail, which is exactly
						// what the double must not degrade to.
						assertExitFailure(
							exit,
							Cause.die(
								UnstubbedMemberError.make({
									message: "OidcTokenIssuer.makeTest: token() was called but not stubbed — pass a `token` override.",
								}),
							),
						);
						assert.isTrue(Cause.hasDies(exit.cause));
					}),
				);
			},
		);
	}
});
