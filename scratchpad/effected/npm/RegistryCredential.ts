import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Redacted from "effect/Redacted";
import * as Base64 from "effect/encoding/Base64";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effected/npm/RegistryCredential");

/**
 * A basic-auth username contains the credential separator.
 *
 * **Example** (Inspecting a rejected username)
 * ```ts
 * import { InvalidBasicAuthUsernameError } from "./RegistryCredential.ts";
 * const error = InvalidBasicAuthUsernameError.make({ message: "A basic-auth username cannot contain a colon" });
 * error.message;
 * ```
 *
 * @category errors
 * @since 0.0.0
 * @public
 */
export class InvalidBasicAuthUsernameError extends S.TaggedError<InvalidBasicAuthUsernameError>($I`InvalidBasicAuthUsernameError`)(
	"InvalidBasicAuthUsernameError",
	{ message: S.String },
	$I.annote("InvalidBasicAuthUsernameError", { description: "A basic-auth username contains the credential separator." }),
) {}

/**
 * A bearer token — npm's `_authToken`, and the form every modern registry
 * documents first.
 *
 * @public
 */
export const TokenCredential = S.Struct({
	kind: S.Literal("token").annotateKey({ description: "Bearer-token authentication." }),
	/** The token, verbatim. Never written to argv. */
	token: S.Redacted(S.String).annotateKey({ description: "The redacted bearer token, never written to argv." }),
}).annotate($I.annote("TokenCredential", { description: "A structural bearer-token credential boundary." }));
export type TokenCredential = typeof TokenCredential.Type;

/**
 * HTTP basic auth — npm's `_auth`, carried as the **already-encoded** blob.
 *
 * **Details**
 *
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
export const BasicCredential = S.Struct({
	kind: S.Literal("basic").annotateKey({ description: "HTTP basic authentication." }),
	/** Base64 of `user:password`, exactly as it belongs in an npmrc `_auth`. */
	encoded: S.Redacted(S.String).annotateKey({ description: "Redacted base64 of user:password, used verbatim." }),
}).annotate($I.annote("BasicCredential", { description: "A structural encoded basic-auth credential boundary." }));
export type BasicCredential = typeof BasicCredential.Type;

/**
 * How to authenticate to a registry.
 *
 * **Details**
 *
 * Both npmrc spellings npm supports for a registry, as a closed union so the
 * npmrc key and the HTTP scheme are chosen together. A read probe and a publish
 * that disagreed about the scheme would authenticate differently against the
 * same registry, which is the class of bug this union exists to make
 * unrepresentable.
 *
 * @public
 */
export const RegistryCredential = S.Union([TokenCredential, BasicCredential]).pipe(
	S.annotate($I.annote("RegistryCredential", { description: "The credential kind determines both npmrc key and HTTP scheme." })),
	S.toTaggedUnion("kind"),
);
export type RegistryCredential = typeof RegistryCredential.Type;

/**
 * A {@link BasicCredential} from a username and password, encoding for you.
 *
 * **Details**
 *
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
 * @returns An Effect producing the encoded credential or failing with InvalidBasicAuthUsernameError.
 * @public
 */
export const basicCredentialFromPair = Effect.fn("RegistryCredential.basicCredentialFromPair")((
	username: string,
	password: Redacted.Redacted<string>,
): Effect.Effect<BasicCredential, InvalidBasicAuthUsernameError> => Effect.suspend(() => {
	if (Str.includes(":")(username)) {
		// The separator is positional and unescapable: refuse a mis-split pair.
		return Effect.fail(InvalidBasicAuthUsernameError.make({ message: "A basic-auth username cannot contain a colon" }));
	}
	return Effect.succeed(BasicCredential.make({
		kind: "basic",
		encoded: Redacted.make(Base64.encode(`${username}:${Redacted.value(password)}`)),
	}));
}));
