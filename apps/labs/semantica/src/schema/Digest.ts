import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { Effect, Encoding, Result, Struct } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { canonicalJson } from "@/corpus/Canonical";
import type { Crypto } from "effect";

const utf8Encoder = new TextEncoder();

const sha256CanonicalEffect = (value: unknown) =>
  Sha256HexFromBytes.decodeEffect(utf8Encoder.encode(canonicalJson(value)));

const sha256CanonicalSync = (value: unknown): Sha256Hex =>
  Sha256Hex.make(Encoding.encodeHex(sha256(utf8Encoder.encode(canonicalJson(value)))));

type DigestEffect<Type> = Type extends unknown
  ? (value: Type) => Effect.Effect<Sha256Hex, S.SchemaError, Crypto.Crypto>
  : never;

type DigestResult<Type> = Type extends unknown ? (value: Type) => Result.Result<Sha256Hex, S.SchemaError> : never;

/**
 * Encodes a schema value, canonicalizes its wire form, and hashes the result.
 *
 * **Example** (Build a content digest effect)
 *
 * ```ts
 * import { contentDigest } from "@/schema/Digest"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const digest = contentDigest(S.Struct({ a: S.Number }))({ a: 1 })
 * console.log(Effect.isEffect(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contentDigest = <Type, Encoded>(schema: S.Codec<Type, Encoded, never, never>) =>
  Effect.fn("SemanticaSchema.contentDigest")((value: Type) =>
    S.encodeEffect(schema)(value).pipe(Effect.flatMap(sha256CanonicalEffect))
  );

/**
 * Encodes an object while omitting one wire field from the digest preimage.
 *
 * **Details**
 *
 * The field is removed only after schema encoding, so transforms and `Option`
 * wire forms remain part of the canonical preimage.
 *
 * **Example** (Exclude a self digest)
 *
 * ```ts
 * import { digestOmitting } from "@/schema/Digest"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Report = S.Struct({ value: S.Number, digest: S.String })
 * const digest = digestOmitting(Report, "digest")({ value: 1, digest: "pending" })
 * console.log(Effect.isEffect(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const digestOmitting: {
  <Encoded extends object, Key extends keyof Encoded>(
    field: Key
  ): <Type>(schema: S.Codec<Type, Encoded, never, never>) => DigestEffect<Type>;
  <Type, Encoded extends object, Key extends keyof Encoded>(
    schema: S.Codec<Type, Encoded, never, never>,
    field: Key
  ): DigestEffect<Type>;
} = dual(
  2,
  <Type, Encoded extends object, Key extends keyof Encoded>(schema: S.Codec<Type, Encoded, never, never>, field: Key) =>
    Effect.fn("SemanticaSchema.digestOmitting")((value: Type) =>
      S.encodeEffect(schema)(value).pipe(
        Effect.map((encoded) => Struct.omit(encoded, [field])),
        Effect.flatMap(sha256CanonicalEffect)
      )
    )
);

/**
 * Synchronous noble-hashes twin used only by schema refinements.
 *
 * **Gotchas**
 *
 * Application workflows should use {@link contentDigest}; this form exists so
 * pure `Schema.check` predicates can verify content-addressed fields.
 *
 * **Example** (Inspect a synchronous digest result)
 *
 * ```ts
 * import { contentDigestSync } from "@/schema/Digest"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = contentDigestSync(S.Struct({ a: S.Number }))({ a: 1 })
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contentDigestSync =
  <Type, Encoded>(schema: S.Codec<Type, Encoded, never, never>) =>
  (value: Type): Result.Result<Sha256Hex, S.SchemaError> =>
    Result.map(S.encodeResult(schema)(value), sha256CanonicalSync);

/**
 * Synchronous field-omitting digest twin used by self-digest refinements.
 *
 * **Gotchas**
 *
 * Application workflows should use {@link digestOmitting}; this form is
 * reserved for pure schema checks.
 *
 * **Example** (Hash a report body without its digest)
 *
 * ```ts
 * import { digestOmittingSync } from "@/schema/Digest"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Report = S.Struct({ value: S.Number, digest: S.String })
 * const result = digestOmittingSync(Report, "digest")({ value: 1, digest: "pending" })
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const digestOmittingSync: {
  <Encoded extends object, Key extends keyof Encoded>(
    field: Key
  ): <Type>(schema: S.Codec<Type, Encoded, never, never>) => DigestResult<Type>;
  <Type, Encoded extends object, Key extends keyof Encoded>(
    schema: S.Codec<Type, Encoded, never, never>,
    field: Key
  ): DigestResult<Type>;
} = dual(
  2,
  <Type, Encoded extends object, Key extends keyof Encoded>(schema: S.Codec<Type, Encoded, never, never>, field: Key) =>
    (value: Type): Result.Result<Sha256Hex, S.SchemaError> =>
      Result.map(S.encodeResult(schema)(value), (encoded) => sha256CanonicalSync(Struct.omit(encoded, [field])))
);

/**
 * Hashes exact UTF-8 text without JSON quoting for digest refinements.
 *
 * **Example** (Hash exact response text)
 *
 * ```ts
 * import { sha256TextSync } from "@/schema/Digest"
 *
 * console.log(sha256TextSync("response").length) // 64
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const sha256TextSync = (text: string): Sha256Hex =>
  Sha256Hex.make(Encoding.encodeHex(sha256(utf8Encoder.encode(text))));
