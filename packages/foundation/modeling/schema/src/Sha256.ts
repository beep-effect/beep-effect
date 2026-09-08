/**
 * Branded schemas and transformation codecs for lowercase SHA-256 hex digests.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { Crypto, Effect, Encoding, SchemaGetter, SchemaIssue } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Sha256");

const sha256HexLowercaseRegExp = /^[0-9a-f]+$/;

const Sha256HexChecks = S.makeFilterGroup([
  S.isLengthBetween(64, 64, {
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
): Effect.fn.Return<string, SchemaIssue.Issue, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto.digest("SHA-256", Uint8Array.from(input)).pipe(
    Effect.mapError(
      (cause) =>
        new SchemaIssue.InvalidValue({
          message: cause.message,
        })
    )
  );

  return Encoding.encodeHex(digest);
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
export const Sha256Hex = S.String.check(Sha256HexChecks)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^[0-9a-f]{64}$/),
  })
  .pipe(
    S.brand("Sha256Hex"),
    $I.annoteSchema("Sha256Hex", {
      description: "A canonical lowercase SHA-256 hex digest.",
    }),
    SchemaUtils.withCodecStatics(["encodeEffect", "decodeEffect"])
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

/**
 * One-way schema that decodes a byte array into a canonical lowercase SHA-256
 * hex digest. Encoding back is intentionally forbidden.
 *
 * **Example** (Hash empty bytes to hex)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
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
    decode: SchemaGetter.transformOrFail(computeSha256Hex),
    encode: SchemaGetter.forbidden(() => "Encoding Sha256Hex back to original bytes is not supported"),
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeEffect: S.decodeEffect(schema),
  })),
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
 * import { Effect } from "effect"
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
 * import { Effect } from "effect"
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
 * import { Effect } from "effect"
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
