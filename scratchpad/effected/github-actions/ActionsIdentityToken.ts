import { IdentityToken, IdentityTokenError } from "../sbom/index.ts";
import { Effect, Layer } from "effect";
import { OidcTokenIssuer } from "./OidcTokenIssuer.ts";

/**
 * Serves `@effected/sbom`'s `IdentityToken` contract from the runner's own OIDC
 * token service, so signing an SBOM inside a workflow needs no further wiring.
 *
 * @remarks
 * `@effected/sbom` declares `IdentityToken` — one method, one audience,
 * one redacted token — precisely so that signing does not drag the Actions
 * runtime into every consumer that only wants to emit an SBOM. This is the
 * layer that closes the inversion from the other side: it serves that contract
 * from the runner's own OIDC token service ({@link OidcTokenIssuer}), the same
 * arrangement as `@effected/workspaces` implementing `@effected/commands`'
 * `LocalExec`.
 *
 * The audience is forwarded verbatim. `SigstoreSigner` asks its identity
 * contract for the `sigstore` audience itself (`SIGSTORE_OIDC_AUDIENCE` is the
 * signing protocol's requirement, owned there), so nothing here — and nothing
 * in a consumer — needs to spell it.
 *
 * An `OidcTokenError` is rewrapped as `IdentityTokenError` with the
 * original preserved structurally in `cause`, so a refused exchange still says
 * which audience it was minting for **and** why the runner declined —
 * `reason: "unavailable"` almost always means the workflow is missing
 * `permissions: id-token: write`.
 *
 * @example
 * ```ts
 * import { ActionsIdentityToken, OidcTokenIssuer } from "./index.ts";
 * import { SigstoreSigner } from "../sbom/index.ts";
 * import { Layer } from "effect";
 *
 * const signing = SigstoreSigner.layer.pipe(
 *   Layer.provide(ActionsIdentityToken.layer),
 *   Layer.provide(OidcTokenIssuer.layer),
 * );
 * ```
 *
 * @public
 */
export class ActionsIdentityToken {
	private constructor() {}

	/**
	 * `IdentityToken` served by the runner's OIDC token service.
	 *
	 * @remarks
	 * Requires {@link OidcTokenIssuer} rather than composing
	 * `OidcTokenIssuer.layer` in, so an action that already wired the issuer —
	 * every action using `ActionRuntime.layer` has its requirements at hand —
	 * does not construct a second one.
	 */
	static readonly layer: Layer.Layer<IdentityToken, never, OidcTokenIssuer> = Layer.effect(
		IdentityToken,
		Effect.map(OidcTokenIssuer, (issuer) => ({
			token: (audience: string) =>
				issuer.token(audience).pipe(Effect.mapError((cause) => IdentityTokenError.make({ audience, cause }))),
		})),
	);
}
