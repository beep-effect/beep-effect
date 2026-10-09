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

import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/sbom/IdentityToken");

/**
 * Raised when an identity token cannot be obtained.
 *
 * **Details**
 *
 * The audience is on the error because "which audience" is the first thing a
 * caller checks when an exchange is refused — a token minted for the wrong one
 * fails at the certificate authority, far from here.
 *
 * **Example** (Inspect an identity exchange failure)
 *
 * ```ts
 * import { IdentityTokenError } from "@beep/scratchpad/effected/sbom/IdentityToken";
 *
 * const error = IdentityTokenError.make({ audience: "sigstore", cause: "refused" });
 * console.log(error.message) // Could not obtain an identity token for the "sigstore" audience
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class IdentityTokenError extends S.TaggedError<IdentityTokenError>($I`IdentityTokenError`)("IdentityTokenError", {
	/** The audience the token was requested for. */
	audience: S.String.annotateKey({ description: "The audience the token was requested for." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("IdentityTokenError", { description: "Raised when an identity token cannot be obtained." })) {
	/**
	 * Explains which audience could not obtain a workload identity token.
	 *
	 * **Example** (Identify the refused audience)
	 *
	 * ```ts
	 * import { IdentityTokenError } from "@beep/scratchpad/effected/sbom/IdentityToken";
	 *
	 * console.log(IdentityTokenError.make({ audience: "sigstore", cause: "refused" }).message) // Could not obtain an identity token for the "sigstore" audience
	 * ```
	 *
	 * @since 0.0.0
	 */
	override get message(): string {
		return `Could not obtain an identity token for the "${this.audience}" audience`;
	}
}

/**
 * The contract: one method, one audience, one redacted token.
 *
 * **Details**
 *
 * Deliberately smaller than any issuer's own surface. An implementation may
 * cache, may decode claims, may do neither — none of that is this package's
 * business, and a wider contract would make github-actions' issuer the only
 * thing that could satisfy it.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface IdentityTokenShape {
	/**
	 * A workload identity token for `audience`.
	 *
	 * **Example** (Request a redacted workload token)
	 *
	 * ```ts
	 * import { IdentityToken } from "@beep/scratchpad/effected/sbom/IdentityToken";
	 * import * as Effect from "effect/Effect";
	 * import * as Redacted from "effect/Redacted";
	 *
	 * const token = Effect.runSync(IdentityToken.makeTest().token("sigstore"));
	 * console.log(Redacted.isRedacted(token)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	readonly token: (audience: string) => Effect.Effect<Redacted.Redacted<string>, IdentityTokenError>;
}

/** The token every double answers with unless a test says otherwise. */
const TEST_TOKEN = "test-identity-token";

/**
 * A source of workload identity tokens (OIDC), the input `SigstoreSigner` needs
 * to obtain a signing certificate.
 *
 * **Details**
 *
 * In GitHub Actions, provide `ActionsIdentityToken.layer` from
 * `@effected/github-actions`. A consumer that already holds a token uses
 * {@link (IdentityToken:class).layerStatic}; tests use
 * {@link (IdentityToken:class).layerTest}.
 *
 * **Example** (Provide a static identity token to the Sigstore signer)
 *
 * ```ts
 * import { IdentityToken } from "@beep/scratchpad/effected/sbom/IdentityToken";
 * import { SigstoreSigner } from "@beep/scratchpad/effected/sbom/SigstoreSigner";
 * import * as Layer from "effect/Layer";
 *
 * const token = "example-oidc-token";
 * const layer = SigstoreSigner.layer.pipe(Layer.provide(IdentityToken.layerStatic(token)));
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class IdentityToken extends Context.Service<IdentityToken, IdentityTokenShape>()(
	$I`IdentityToken`,
) {
	/**
	 * A layer answering with a token the caller already holds.
	 *
	 * **Gotchas**
	 *
	 * For a consumer that obtained a token by some other route — a CI system
	 * that is not GitHub Actions, or a script that exchanged one itself. The
	 * audience is **ignored**, so it is the caller's job to have minted the token
	 * for the audience it will be used with; a layer cannot check that, and
	 * pretending otherwise would be theatre.
	 *
	 * **Example** (Provide a token already minted for Sigstore)
	 *
	 * ```ts
	 * import { IdentityToken } from "@beep/scratchpad/effected/sbom/IdentityToken";
	 * import * as Effect from "effect/Effect";
	 * import * as Redacted from "effect/Redacted";
	 *
	 * const program = Effect.gen(function* () {
	 *   const issuer = yield* IdentityToken;
	 *   return Redacted.isRedacted(yield* issuer.token("sigstore"));
	 * });
	 * console.log(Effect.runSync(program.pipe(Effect.provide(IdentityToken.layerStatic("example-token"))))) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly layerStatic = (token: Redacted.Redacted<string> | string): Layer.Layer<IdentityToken> =>
		Layer.succeed(IdentityToken, {
			token: Effect.fn("IdentityToken.token")(() =>
				Effect.succeed(P.isString(token) ? Redacted.make(token) : token),
			),
		});

	/**
	 * An in-memory double.
	 *
	 * **Details**
	 *
	 * Unlike {@link (SigstoreSigner:class).makeTest}, this one **answers** rather than
	 * dying: a fabricated OIDC token is a real answer to "give me a token" in a
	 * test, where a fabricated signature would be a lie about cryptography.
	 *
	 * **Example** (Inspect the default token double)
	 *
	 * ```ts
	 * import { IdentityToken } from "@beep/scratchpad/effected/sbom/IdentityToken";
	 * import * as Effect from "effect/Effect";
	 * import * as Redacted from "effect/Redacted";
	 *
	 * const token = Effect.runSync(IdentityToken.makeTest().token("sigstore"));
	 * console.log(Redacted.isRedacted(token)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<IdentityTokenShape> = {}): IdentityTokenShape => ({
		token: overrides.token ?? (() => Effect.succeed(Redacted.make(TEST_TOKEN))),
	});

	/**
	 * {@link (IdentityToken:class).makeTest} behind a `Layer`.
	 *
	 * **Example** (Supply the in-memory issuer through a layer)
	 *
	 * ```ts
	 * import { IdentityToken } from "@beep/scratchpad/effected/sbom/IdentityToken";
	 * import * as Effect from "effect/Effect";
	 * import * as Redacted from "effect/Redacted";
	 *
	 * const program = Effect.gen(function* () {
	 *   const issuer = yield* IdentityToken;
	 *   return Redacted.isRedacted(yield* issuer.token("sigstore"));
	 * });
	 * console.log(Effect.runSync(program.pipe(Effect.provide(IdentityToken.layerTest())))) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly layerTest = (overrides: Partial<IdentityTokenShape> = {}): Layer.Layer<IdentityToken> =>
		Layer.succeed(IdentityToken, IdentityToken.makeTest(overrides));
}
