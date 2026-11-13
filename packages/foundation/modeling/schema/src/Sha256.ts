/**
 * Branded schemas and transformation codecs for lowercase SHA-256 hex digests.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";

const $I = $SchemaId.create("Sha256");

const sha256HexLowercaseRegExp = /^[0-9a-f]+$/;

const Sha256HexChecks = S.makeFilterGroup([
  S.isBetweenLength(64, 64, {
    title: "isSha256HexLength",
    description: "a SHA-256 hex digest with exactly 64 characters",
    message: "SHA-256 digest must be exactly 64 characters long",
  }),
  S.isPattern(sha256HexLowercaseRegExp, {
    title: "isLowercaseHex",
    description: "a lowercase hexadecimal string",
    message: "SHA-256 digest must contain only lowercase hexadecimal characters",
  }),
]);

const computeSha256Hex = Effect.fn("computeSha256Hex")(function* (
  input: Uint8Array
): Effect.fn.Return<string, never, Digest.Digest> {
  const digestService = yield* Digest.Digest;
  const digest = yield* digestService.digest(Digest.sha256, Uint8Array.from(input));

  return Hex.encode(digest);
});

/**
 * Branded schema for canonical lowercase SHA-256 hex digests (64 hex characters).
 *
 * **Example** (Decode empty SHA-256 digest)
 *
 * ```ts import.meta.vitest name="Decode empty SHA-256 digest"
 * import * as S from "effect/Schema"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const digest = S.decodeUnknownSync(Sha256Hex)(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * digest.length // => 64
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Sha256Hex = S.String.check(Sha256HexChecks).pipe(
  S.brand("Sha256Hex"),
  $I.annoteSchema("Sha256Hex", {
    description: "A canonical lowercase SHA-256 hex digest.",
  })
);

/**
 * Type for {@link Sha256Hex}.
 *
 * **Example** (Annotate decoded SHA-256 type)
 *
 * ```ts import.meta.vitest name="Annotate decoded SHA-256 type"
 * import * as S from "effect/Schema"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const hash: Sha256Hex = S.decodeUnknownSync(Sha256Hex)(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * hash.length // => 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sha256Hex = typeof Sha256Hex.Type;

const SHA256_DIGEST_PREFIX = "sha256:";

/**
 * Branded schema for a self-describing SHA-256 digest: the `sha256:` algorithm
 * prefix followed by a {@link Sha256Hex}.
 *
 * **Details**
 *
 * This is the one grammar for a digest that names its algorithm. A domain
 * digest is this schema with a brand of its own on top, so its encoded form is
 * the same string and any domain digest is also a `Sha256PrefixedDigest`. The string
 * carries no encoding version: the schema that names what was hashed owns
 * that, so two digests of the same bytes are always equal. A bare
 * {@link Sha256Hex} stays valid wherever it is stored.
 *
 * **Example** (Decode a prefixed digest)
 *
 * ```ts import.meta.vitest name="Decode a prefixed digest"
 * import * as S from "effect/Schema"
 * import { Sha256PrefixedDigest } from "@beep/schema/Sha256"
 *
 * const digest = S.decodeUnknownSync(Sha256PrefixedDigest)(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * digest.length // => 71
 * ```
 *
 * **Example** (Brand a domain digest over the grammar)
 *
 * ```ts import.meta.vitest name="Brand a domain digest over the grammar"
 * import * as S from "effect/Schema"
 * import { Sha256PrefixedDigest } from "@beep/schema/Sha256"
 *
 * const ReceiptDigest = Sha256PrefixedDigest.pipe(S.brand("ReceiptDigest"))
 * const receipt = S.decodeUnknownSync(ReceiptDigest)(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * const general: Sha256PrefixedDigest = receipt
 * general.slice(0, 7) // => "sha256:"
 * ```
 *
 * @see {@link Sha256PrefixedDigestFromHex} to convert from and to the bare hex form.
 * @category validation
 * @since 0.0.0
 */
export const Sha256PrefixedDigest = S.TemplateLiteral([SHA256_DIGEST_PREFIX, Sha256Hex]).pipe(
  S.brand("Sha256PrefixedDigest"),
  $I.annoteSchema("Sha256PrefixedDigest", {
    description: "A self-describing SHA-256 digest: the sha256: prefix followed by 64 lowercase hex characters.",
  })
);

/**
 * Type for {@link Sha256PrefixedDigest}.
 *
 * **Example** (Annotate a prefixed digest)
 *
 * ```ts import.meta.vitest name="Annotate a prefixed digest"
 * import * as S from "effect/Schema"
 * import { Sha256PrefixedDigest } from "@beep/schema/Sha256"
 *
 * const digest: Sha256PrefixedDigest = S.decodeUnknownSync(Sha256PrefixedDigest)(
 *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * digest.slice(0, 7) // => "sha256:"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sha256PrefixedDigest = typeof Sha256PrefixedDigest.Type;

// The codec's two directions run between the bare digest and the template's
// encoded side; the target schema then brands what `decode` produced.
const prefixSha256Hex = (hex: Sha256Hex): `${typeof SHA256_DIGEST_PREFIX}${string}` => `${SHA256_DIGEST_PREFIX}${hex}`;

const unprefixSha256Digest = (digest: `${typeof SHA256_DIGEST_PREFIX}${string}`): Sha256Hex =>
  Sha256Hex.make(Str.slice(SHA256_DIGEST_PREFIX.length)(digest));

/**
 * Two-way codec between a bare {@link Sha256Hex} and its self-describing
 * {@link Sha256PrefixedDigest} form: decoding adds the `sha256:` prefix and encoding
 * removes it.
 *
 * **Example** (Prefix a bare hex digest and strip it again)
 *
 * ```ts import.meta.vitest name="Prefix a bare hex digest and strip it again"
 * import * as S from "effect/Schema"
 * import { Sha256PrefixedDigestFromHex } from "@beep/schema/Sha256"
 *
 * const hex = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const digest = S.decodeUnknownSync(Sha256PrefixedDigestFromHex)(hex)
 * digest // => "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * S.encodeSync(Sha256PrefixedDigestFromHex)(digest) // => hex
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Sha256PrefixedDigestFromHex = Sha256Hex.pipe(
  S.decodeTo(Sha256PrefixedDigest, {
    decode: SchemaGetter.transform(prefixSha256Hex),
    encode: SchemaGetter.transform(unprefixSha256Digest),
  }),
  $I.annoteSchema("Sha256PrefixedDigestFromHex", {
    description: "A codec that adds the sha256: prefix to a bare lowercase SHA-256 hex digest and removes it again.",
  })
);

/**
 * Type for {@link Sha256PrefixedDigestFromHex}.
 *
 * **Example** (Annotate a digest decoded from hex)
 *
 * ```ts import.meta.vitest name="Annotate a digest decoded from hex"
 * import * as S from "effect/Schema"
 * import { Sha256PrefixedDigestFromHex } from "@beep/schema/Sha256"
 *
 * const digest: Sha256PrefixedDigestFromHex = S.decodeUnknownSync(Sha256PrefixedDigestFromHex)(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * digest.length // => 71
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sha256PrefixedDigestFromHex = typeof Sha256PrefixedDigestFromHex.Type;

/**
 * One-way schema that decodes a byte array into a canonical lowercase SHA-256
 * hex digest. Encoding back is intentionally forbidden.
 *
 * **Example** (Hash empty bytes to hex)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema"
 * import { Sha256HexFromBytes } from "@beep/schema/Sha256"
 *
 * const digest = await Effect.runPromise(
 *   S.decodeUnknownEffect(Sha256HexFromBytes)(new Uint8Array()).pipe(Effect.provide(BunCrypto.layer))
 * )
 * console.log(digest) // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Sha256HexFromBytes = S.Uint8Array.pipe(
  S.decodeTo(Sha256Hex, {
    decode: SchemaGetter.transformEffect(computeSha256Hex),
    encode: SchemaGetter.forbidden(() => "Encoding Sha256Hex back to original bytes is not supported"),
  }),
  $I.annoteSchema("Sha256HexFromBytes", {
    description: "A one-way schema that hashes bytes into a canonical lowercase SHA-256 hex digest.",
  })
);

/**
 * Type for {@link Sha256HexFromBytes}.
 *
 * **Example** (Annotate hash from empty bytes)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema"
 * import { Sha256HexFromBytes } from "@beep/schema/Sha256"
 *
 * const hash: Sha256HexFromBytes = await Effect.runPromise(
 *   S.decodeUnknownEffect(Sha256HexFromBytes)(new Uint8Array()).pipe(Effect.provide(BunCrypto.layer))
 * )
 * console.log(hash.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sha256HexFromBytes = typeof Sha256HexFromBytes.Type;

/**
 * One-way schema that decodes a hex-encoded byte string into a canonical
 * lowercase SHA-256 hex digest via {@link Sha256HexFromBytes}.
 *
 * **Example** (Hash hex-encoded hello bytes)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema"
 * import { Sha256HexFromHexBytes } from "@beep/schema/Sha256"
 *
 * const digest = await Effect.runPromise(
 *   S.decodeUnknownEffect(Sha256HexFromHexBytes)("68656c6c6f").pipe(Effect.provide(BunCrypto.layer))
 * )
 * console.log(digest) // "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Sha256HexFromHexBytes = S.Uint8ArrayFromHex.pipe(
  S.decodeTo(Sha256HexFromBytes),
  $I.annoteSchema("Sha256HexFromHexBytes", {
    description: "A one-way schema that hashes hex-encoded bytes into a canonical lowercase SHA-256 hex digest.",
  })
);

/**
 * Type for {@link Sha256HexFromHexBytes}.
 *
 * **Example** (Annotate hash from hex bytes)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema"
 * import { Sha256HexFromHexBytes } from "@beep/schema/Sha256"
 *
 * const hash: Sha256HexFromHexBytes = await Effect.runPromise(
 *   S.decodeUnknownEffect(Sha256HexFromHexBytes)("68656c6c6f").pipe(Effect.provide(BunCrypto.layer))
 * )
 * console.log(hash.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sha256HexFromHexBytes = typeof Sha256HexFromHexBytes.Type;
