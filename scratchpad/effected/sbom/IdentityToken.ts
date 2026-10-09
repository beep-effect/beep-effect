// The inverted OIDC contract.
//
// Signing needs a workload identity token. Issuing one needs the Actions
// runtime — `ACTIONS_ID_TOKEN_REQUEST_URL`, the runner's token service, a
// platform HTTP client — which lives in `@effected/github-actions`, an
// integrated package with a required `@effect/platform-node` peer. Taking that
// edge would drag a platform peer into every consumer that only wanted to emit
// an SBOM.
//
// So the dependency is inverted, as with `@effected/npm`'s `CatalogResolver`
// and `@effected/commands`' `LocalExec`: this package declares the narrow
// contract it needs, github-actions ships the layer that implements it
// (`ActionsIdentityToken.layer`, over its `OidcTokenIssuer`), and a consumer
// already holding a token uses `IdentityToken.layerStatic`.

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

/**
 * Raised when an identity token cannot be obtained.
 *
 * @remarks
 * The audience is on the error because "which audience" is the first thing a
 * caller checks when an exchange is refused — a token minted for the wrong one
 * fails at the certificate authority, far from here.
 *
 * @public
 */
export class IdentityTokenError extends S.TaggedError<IdentityTokenError>()("IdentityTokenError", {
	/** The audience the token was requested for. */
	audience: S.String,
	/** The underlying failure, preserved structurally. */
	cause: S.Defect(),
}) {
	override get message(): string {
		return `Could not obtain an identity token for the "${this.audience}" audience`;
	}
}

/**
 * The contract: one method, one audience, one redacted token.
 *
 * @remarks
 * Deliberately smaller than any issuer's own surface. An implementation may
 * cache, may decode claims, may do neither — none of that is this package's
 * business, and a wider contract would make github-actions' issuer the only
 * thing that could satisfy it.
 *
 * @public
 */
export interface IdentityTokenShape {
	/** A workload identity token for `audience`. */
	readonly token: (audience: string) => Effect.Effect<Redacted.Redacted<string>, IdentityTokenError>;
}

/** The token every double answers with unless a test says otherwise. */
const TEST_TOKEN = "test-identity-token";

/**
 * A source of workload identity tokens (OIDC), the input `SigstoreSigner` needs
 * to obtain a signing certificate.
 *
 * @remarks
 * In GitHub Actions, provide `ActionsIdentityToken.layer` from
 * `@effected/github-actions`. A consumer that already holds a token uses
 * {@link (IdentityToken:class).layerStatic}; tests use
 * {@link (IdentityToken:class).layerTest}.
 *
 * @example
 * ```ts
 * import { IdentityToken, SigstoreSigner } from "./index.ts";
 * import { Layer } from "effect";
 *
 * const token = process.env.OIDC_TOKEN ?? "";
 * const layer = SigstoreSigner.layer.pipe(Layer.provide(IdentityToken.layerStatic(token)));
 * ```
 *
 * @public
 */
export class IdentityToken extends Context.Service<IdentityToken, IdentityTokenShape>()(
	"@beep/scratchpad/effected/sbom/IdentityToken",
) {
	/**
	 * A layer answering with a token the caller already holds.
	 *
	 * @remarks
	 * For a consumer that obtained a token by some other route — a CI system
	 * that is not GitHub Actions, or a script that exchanged one itself. The
	 * audience is **ignored**, so it is the caller's job to have minted the token
	 * for the audience it will be used with; a layer cannot check that, and
	 * pretending otherwise would be theatre.
	 */
	static readonly layerStatic = (token: Redacted.Redacted<string> | string): Layer.Layer<IdentityToken> =>
		Layer.succeed(IdentityToken, {
			token: Effect.fn("IdentityToken.token")(() =>
				Effect.succeed(typeof token === "string" ? Redacted.make(token) : token),
			),
		});

	/**
	 * An in-memory double.
	 *
	 * @remarks
	 * Unlike {@link (SigstoreSigner:class).makeTest}, this one **answers** rather than
	 * dying: a fabricated OIDC token is a real answer to "give me a token" in a
	 * test, where a fabricated signature would be a lie about cryptography.
	 */
	static readonly makeTest = (overrides: Partial<IdentityTokenShape> = {}): IdentityTokenShape => ({
		token: overrides.token ?? (() => Effect.succeed(Redacted.make(TEST_TOKEN))),
	});

	/** {@link (IdentityToken:class).makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<IdentityTokenShape> = {}): Layer.Layer<IdentityToken> =>
		Layer.succeed(IdentityToken, IdentityToken.makeTest(overrides));
}
