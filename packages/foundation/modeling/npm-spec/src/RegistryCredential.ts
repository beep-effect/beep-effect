/**
 * The closed registry auth union: a bearer token or an encoded basic-auth pair.
 *
 * **Details**
 *
 * Registry reads and publishes share this vocabulary. The token and the base64
 * `user:password` value are both `Redacted`, so a logged credential never
 * prints its secret.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $NpmSpecId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import { dual } from "effect/Function";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $NpmSpecId.create("RegistryCredential");

/**
 * A basic-auth username contains the credential separator.
 *
 * **Example** (Inspecting a rejected username)
 * ```ts
 * import { InvalidBasicAuthUsernameError } from "@beep/npm-spec/RegistryCredential";
 * const error = InvalidBasicAuthUsernameError.make({ message: "A basic-auth username cannot contain a colon" });
 * console.log(error.message) // A basic-auth username cannot contain a colon
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidBasicAuthUsernameError extends S.TaggedError<
  InvalidBasicAuthUsernameError,
  { readonly brand: unique symbol }
>($I`InvalidBasicAuthUsernameError`)(
  "InvalidBasicAuthUsernameError",
  { message: S.String },
  $I.annoteError<InvalidBasicAuthUsernameError>("InvalidBasicAuthUsernameError", {
    description: "A basic-auth username contains the credential separator.",
  })
) {}

/**
 * A bearer token — npm's `_authToken`, and the form every modern registry
 * documents first.
 * **Example** (Construct a redacted bearer credential)
 *
 * ```ts
 * import { TokenCredential } from "@beep/npm-spec/RegistryCredential";
 * import * as Redacted from "effect/Redacted";
 *
 * const credential = TokenCredential.make({ kind: "token", token: Redacted.make("example-token") });
 * console.log(credential.kind) // token
 * ```
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class TokenCredential extends S.Opaque<TokenCredential, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("token").pipe($I.annoteKey("TokenCredential.kind", { description: "Bearer-token authentication." })),
    /** The token, verbatim. Never written to argv. */
    token: S.Redacted(S.String).pipe(
      $I.annoteKey("TokenCredential.token", { description: "The redacted bearer token, never written to argv." })
    ),
  }).pipe($I.annoteSchema("TokenCredential", { description: "A structural bearer-token credential boundary." }))
) {}

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
 *
 * **Example** (Carry an already encoded basic credential)
 *
 * ```ts
 * import { BasicCredential } from "@beep/npm-spec/RegistryCredential";
 * import * as Redacted from "effect/Redacted";
 *
 * const credential = BasicCredential.make({ kind: "basic", encoded: Redacted.make("dXNlcjpwYXNz") });
 * console.log(credential.kind) // basic
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class BasicCredential extends S.Opaque<BasicCredential, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("basic").pipe($I.annoteKey("BasicCredential.kind", { description: "HTTP basic authentication." })),
    /** Base64 of `user:password`, exactly as it belongs in an npmrc `_auth`. */
    encoded: S.Redacted(S.String).pipe(
      $I.annoteKey("BasicCredential.encoded", { description: "Redacted base64 of user:password, used verbatim." })
    ),
  }).pipe($I.annoteSchema("BasicCredential", { description: "A structural encoded basic-auth credential boundary." }))
) {}

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
 *
 * **Example** (Recognize the bearer authentication case)
 *
 * ```ts
 * import { RegistryCredential, TokenCredential } from "@beep/npm-spec/RegistryCredential";
 * import * as Redacted from "effect/Redacted";
 *
 * const credential = TokenCredential.make({ kind: "token", token: Redacted.make("example-token") });
 * console.log(RegistryCredential.guards.token(credential)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const RegistryCredential = S.Union([TokenCredential, BasicCredential]).pipe(
  $I.annoteSchema("RegistryCredential", {
    description: "The credential kind determines both npmrc key and HTTP scheme.",
  }),
  S.toTaggedUnion("kind")
);
/**
 * Decoded registry authentication case accepted by {@link RegistryCredential}.
 *
 * @see {@link RegistryCredential} for the runtime schema and credential representation.
 * @category type-level
 * @since 0.0.0
 */
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
 * **Example** (Encode a username and redacted password)
 *
 * ```ts
 * import { basicCredentialFromPair } from "@beep/npm-spec/RegistryCredential";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
 *
 * const credential = Effect.runSync(basicCredentialFromPair("user", Redacted.make("pass:word")));
 * console.log(credential.kind) // basic
 * ```
 *
 * @param username - The user half. A `:` here is not representable in basic
 *   auth and is refused rather than silently corrupting the credential.
 * @param password - The password half.
 * @returns An Effect producing the encoded credential or failing with InvalidBasicAuthUsernameError.
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const basicCredentialFromPair: {
  (
    username: string,
    password: Redacted.Redacted<string>
  ): Effect.Effect<BasicCredential, InvalidBasicAuthUsernameError>;
  (
    password: Redacted.Redacted<string>
  ): (username: string) => Effect.Effect<BasicCredential, InvalidBasicAuthUsernameError>;
} = dual(
  2,
  Effect.fn("RegistryCredential.basicCredentialFromPair")(
    (
      username: string,
      password: Redacted.Redacted<string>
    ): Effect.Effect<BasicCredential, InvalidBasicAuthUsernameError> =>
      Effect.suspend(() => {
        const colonWouldMisSplitThePositionalUnescapableSeparator = Str.includes(":")(username);
        if (colonWouldMisSplitThePositionalUnescapableSeparator) {
          return Effect.fail(
            InvalidBasicAuthUsernameError.make({ message: "A basic-auth username cannot contain a colon" })
          );
        }
        return Effect.succeed(
          BasicCredential.make({
            kind: "basic",
            encoded: Redacted.make(Base64.encode(`${username}:${Redacted.value(password)}`)),
          })
        );
      })
  )
);
