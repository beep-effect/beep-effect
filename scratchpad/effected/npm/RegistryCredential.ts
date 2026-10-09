import { Redacted } from "effect";
import * as Base64 from "effect/encoding/Base64";

/**
 * A bearer token — npm's `_authToken`, and the form every modern registry
 * documents first.
 *
 * @public
 */
export interface TokenCredential {
	readonly kind: "token";
	/** The token, verbatim. Never written to argv. */
	readonly token: Redacted.Redacted<string>;
}

/**
 * HTTP basic auth — npm's `_auth`, carried as the **already-encoded** blob.
 *
 * @remarks
 * The credential is base64 of `user:password`, and this type deliberately holds
 * it **encoded rather than as a pair**, because that is what npm itself stores
 * and what registry configuration in the wild already contains. npm assigns the
 * `_auth` value straight to the `Authorization: Basic …` header with no decode
 * step; splitting it back into a pair in order to re-encode it would mean
 * decoding a secret for no purpose, and is lossy in principle for a password
 * containing `:`.
 *
 * {@link basicCredentialFromPair} exists for the caller who genuinely holds a
 * pair — but this shape is the primitive, not that one.
 *
 * @public
 */
export interface BasicCredential {
	readonly kind: "basic";
	/** Base64 of `user:password`, exactly as it belongs in an npmrc `_auth`. */
	readonly encoded: Redacted.Redacted<string>;
}

/**
 * How to authenticate to a registry.
 *
 * @remarks
 * Both npmrc spellings npm supports for a registry, as a closed union so the
 * npmrc key and the HTTP scheme are chosen together. A read probe and a publish
 * that disagreed about the scheme would authenticate differently against the
 * same registry, which is the class of bug this union exists to make
 * unrepresentable.
 *
 * @public
 */
export type RegistryCredential = TokenCredential | BasicCredential;

/**
 * A {@link BasicCredential} from a username and password, encoding for you.
 *
 * @remarks
 * A convenience over the primitive, for the caller that holds a pair rather
 * than a blob. Prefer carrying the encoded form end to end where the
 * configuration already has one.
 *
 * The password stays `Redacted` on the way in and the result stays `Redacted`
 * on the way out, so the pair is never materialized in a loggable value.
 *
 * @param username - The user half. A `:` here is not representable in basic
 *   auth and is refused rather than silently corrupting the credential.
 * @param password - The password half.
 * @returns The encoded credential.
 * @throws RangeError - when `username` contains a `:`.
 *
 * @public
 */
export const basicCredentialFromPair = (username: string, password: Redacted.Redacted<string>): BasicCredential => {
	if (username.includes(":")) {
		// The separator is positional and unescapable: a colon in the user half
		// would re-split into a different pair on the server. Failing loudly beats
		// minting a credential that authenticates as someone else.
		throw new RangeError("A basic-auth username cannot contain a colon");
	}
	return {
		kind: "basic",
		encoded: Redacted.make(Base64.encode(`${username}:${Redacted.value(password)}`)),
	};
};
