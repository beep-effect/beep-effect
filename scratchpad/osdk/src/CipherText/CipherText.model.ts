/**
 * Encrypted property values: the cipher text envelope and the shapes of encryption and decryption.
 *
 * **Details**
 *
 * A cipher text property holds a string the platform encrypted with a cipher
 * channel. On the wire that string is an envelope,
 * `CIPHER::<channelRid>::<ciphertext>::CIPHER`, which names the channel that
 * can decrypt it. {@link CipherText} parses the envelope so the channel is a
 * field instead of a substring. Plaintext only ever appears in the encryption
 * request and the decryption result, and it decodes into a `Redacted` value.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { MappedLiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";

const $I = $ScratchpadId.create("osdk/CipherText/CipherText.model");

// -----------------------------------------------------------------------------
// Channels
// -----------------------------------------------------------------------------

/**
 * Resource identifier of a cipher channel, the key holder that encrypts and decrypts values.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CipherChannelRid = S.NonEmptyString.pipe(
  S.brand("CipherChannelRid"),
  $I.annoteSchema("CipherChannelRid", {
    description: "Resource identifier of a cipher channel, the key holder that encrypts and decrypts values.",
  })
);

/**
 * Runtime type of {@link CipherChannelRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type CipherChannelRid = typeof CipherChannelRid.Type;

/**
 * Which cipher channel re-encrypts a value when it is updated: the one it already uses or the property's default.
 *
 * **Details**
 *
 * `preferExisting` (the platform default) reuses the channel named by the
 * current cipher text and falls back to the property's default channel.
 * `preferDefault` is the mirror image. `existingOnly` fails when the current
 * value is not already encrypted, and `defaultOnly` fails when the property
 * has no default channel.
 *
 * **Example** (Decode the wire enum into the domain literal)
 *
 * ```ts import.meta.vitest name="Decode the wire enum into the domain literal"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CipherChannelStrategy } from "@beep/scratchpad/osdk/src/CipherText/index"
 *
 * const strategy = await Effect.runPromise(S.decodeUnknownEffect(CipherChannelStrategy)("PREFER_EXISTING"))
 * const isStrict = CipherChannelStrategy.To.match(strategy, {
 *   preferExisting: () => false,
 *   preferDefault: () => false,
 *   existingOnly: () => true,
 *   defaultOnly: () => true,
 * })
 * const facts = [strategy, isStrict]
 * facts // => ["preferExisting", false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CipherChannelStrategy = MappedLiteralKit([
  ["PREFER_EXISTING", "preferExisting"],
  ["PREFER_DEFAULT", "preferDefault"],
  ["EXISTING_ONLY", "existingOnly"],
  ["DEFAULT_ONLY", "defaultOnly"],
]).pipe(
  $I.annoteSchema("CipherChannelStrategy", {
    description: "Which cipher channel re-encrypts a value on update: its existing one or the property's default.",
  })
);

/**
 * Runtime type of {@link CipherChannelStrategy}.
 *
 * @category models
 * @since 0.0.0
 */
export type CipherChannelStrategy = typeof CipherChannelStrategy.Type;

// -----------------------------------------------------------------------------
// Envelope
// -----------------------------------------------------------------------------

const envelopeChannelPattern = /^[^:]+$/;

const EnvelopeChannelCheck = S.isPattern(
  envelopeChannelPattern,
  $I.annote("CipherTextEnvelopeChannelCheck", {
    title: "Cipher Text Envelope Channel",
    description: "A cipher channel identifier without a colon, so the envelope's `::` separators stay unambiguous.",
    message: "Expected a cipher channel identifier that contains no colon",
  })
);

/**
 * Value of a cipher text property, decoded from its envelope string into the channel and the encrypted payload.
 *
 * **Details**
 *
 * The encoded side is exactly the wire string
 * `CIPHER::<channelRid>::<ciphertext>::CIPHER`. The payload is opaque: it is
 * kept verbatim and may itself contain colons.
 *
 * **Example** (Read the channel out of an envelope)
 *
 * ```ts import.meta.vitest name="Read the channel out of an envelope"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CipherText } from "@beep/scratchpad/osdk/src/CipherText/index"
 *
 * const envelope = "CIPHER::ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a::AAAAkdB7::CIPHER"
 * const value = await Effect.runPromise(S.decodeUnknownEffect(CipherText)(envelope))
 * const wire = await Effect.runPromise(S.encodeEffect(CipherText)(value))
 * const facts = [value.channel, value.ciphertext, wire === envelope]
 * facts // => ["ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a", "AAAAkdB7", true]
 * ```
 *
 * @invariant `channel` contains no colon and `ciphertext` is not empty, so an envelope parses exactly one way.
 * @category codecs
 * @since 0.0.0
 */
export class CipherText extends S.Opaque<CipherText, { readonly brand: unique symbol }>()(
  S.TemplateLiteralParser([
    "CIPHER::",
    S.String.check(S.isPattern(envelopeChannelPattern)),
    "::",
    S.NonEmptyString,
    "::CIPHER",
  ]).pipe(
    S.decodeTo(
      S.Struct({
        channel: CipherChannelRid.check(EnvelopeChannelCheck).annotateKey({
          description: "Cipher channel that encrypted the payload and can decrypt it.",
        }),
        ciphertext: S.NonEmptyString.annotateKey({
          description: "The encrypted payload, opaque to everything but its cipher channel.",
        }),
      }),
      SchemaTransformation.transform({
        decode: ([, channel, , ciphertext]) => ({ channel, ciphertext }),
        encode: ({ channel, ciphertext }) => Tuple.make("CIPHER::", channel, "::", ciphertext, "::CIPHER"),
      })
    ),
    $I.annoteSchema("CipherText", {
      description: "Value of a cipher text property: the cipher channel and the payload it encrypted.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Encryption and decryption
// -----------------------------------------------------------------------------

/**
 * A value before encryption or after decryption, decoded into a `Redacted` value.
 *
 * **Details**
 *
 * Plaintext is the one thing a cipher text property exists to protect, so it
 * never appears as a bare string in the domain. Unwrap it with
 * `Redacted.value` at the point of use.
 *
 * **Example** (Keep plaintext out of formatted output)
 *
 * ```ts import.meta.vitest name="Keep plaintext out of formatted output"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 * import * as S from "effect/Schema"
 * import { Plaintext } from "@beep/scratchpad/osdk/src/CipherText/index"
 *
 * const plaintext = await Effect.runPromise(S.decodeUnknownEffect(Plaintext)("555-01-0199"))
 * const views = [`${plaintext}`, Redacted.value(plaintext)]
 * views // => ["<redacted>", "555-01-0199"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Plaintext = S.RedactedFromValue(S.String).pipe(
  $I.annoteSchema("Plaintext", {
    description: "A value before encryption or after decryption; a secret that must never be logged.",
  })
);

/**
 * Runtime type of {@link Plaintext}.
 *
 * @category models
 * @since 0.0.0
 */
export type Plaintext = typeof Plaintext.Type;

/**
 * Request to encrypt a value with a cipher channel.
 *
 * **Example** (Encode an encryption request)
 *
 * ```ts import.meta.vitest name="Encode an encryption request"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 * import * as S from "effect/Schema"
 * import { EncryptionRequest } from "@beep/scratchpad/osdk/src/CipherText/index"
 *
 * const request = EncryptionRequest.make({ plaintext: Redacted.make("555-01-0199") })
 * const wire = await Effect.runPromise(S.encodeEffect(EncryptionRequest)(request))
 * wire // => { plaintext: "555-01-0199" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EncryptionRequest extends S.Opaque<EncryptionRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    plaintext: Plaintext.annotateKey({ description: "The value to encrypt." }),
  }).pipe($I.annoteSchema("EncryptionRequest", { description: "Request to encrypt a value with a cipher channel." }))
) {}

/**
 * Result of an encryption: the cipher text to store on a property.
 *
 * **Example** (Decode an encryption result)
 *
 * ```ts import.meta.vitest name="Decode an encryption result"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EncryptionResult } from "@beep/scratchpad/osdk/src/CipherText/index"
 *
 * const result = await Effect.runPromise(
 *   S.decodeUnknownEffect(EncryptionResult)({
 *     ciphertext: "CIPHER::ri.bellaso.main.cipher-channel.6d2ae41e-2d55-4b4b-a5dc-b3d22a8b0f2a::AAAAkdB7::CIPHER",
 *   })
 * )
 * result.ciphertext.ciphertext // => "AAAAkdB7"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EncryptionResult extends S.Opaque<EncryptionResult, { readonly brand: unique symbol }>()(
  S.Struct({
    // The encrypted value, ready to store on a cipher text property.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    ciphertext: CipherText,
  }).pipe(
    $I.annoteSchema("EncryptionResult", {
      description: "Result of an encryption: the cipher text to store on a property.",
    })
  )
) {}

/**
 * Result of a decryption: the original value.
 *
 * **Details**
 *
 * A decryption that fails is an error of the request, not a variant of this
 * record, so a decoded result always carries plaintext.
 *
 * **Example** (Decode a decryption result)
 *
 * ```ts import.meta.vitest name="Decode a decryption result"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 * import * as S from "effect/Schema"
 * import { DecryptionResult } from "@beep/scratchpad/osdk/src/CipherText/index"
 *
 * const result = await Effect.runPromise(S.decodeUnknownEffect(DecryptionResult)({ plaintext: "555-01-0199" }))
 * Redacted.value(result.plaintext) // => "555-01-0199"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DecryptionResult extends S.Opaque<DecryptionResult, { readonly brand: unique symbol }>()(
  S.Struct({
    plaintext: Plaintext.annotateKey({ description: "The decrypted value." }),
  }).pipe($I.annoteSchema("DecryptionResult", { description: "Result of a decryption: the original value." }))
) {}
