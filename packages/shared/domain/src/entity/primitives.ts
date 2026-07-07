/**
 * Shared-domain primitive schemas used by BaseEntity and entity schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as S from "effect/Schema";
import type { Sha256Hex as Sha256HexType } from "@beep/schema/Sha256";

const $I = $SharedDomainId.create("entity/primitives");
const base64UrlPattern = /^[A-Za-z0-9_-]+$/u;
const stableTokenPattern = /^[A-Za-z][A-Za-z0-9._:-]*$/u;

const Base64UrlToken = S.NonEmptyString.check(
  S.isPattern(base64UrlPattern, {
    identifier: $I`Base64UrlTokenPattern`,
    title: "Base64url token pattern",
    description: "Base64url text using alphanumeric characters, underscore, and hyphen.",
    message: "Expected base64url text",
  })
).pipe(
  $I.annoteSchema("Base64UrlToken", {
    description: "Base64url text used by shared cryptographic primitives.",
  })
);

const StableToken = S.NonEmptyString.check(
  S.isPattern(stableTokenPattern, {
    identifier: $I`StableTokenPattern`,
    title: "Stable token pattern",
    description: "Stable non-whitespace token beginning with a letter.",
    message: "Expected a stable token beginning with a letter",
  })
).pipe(
  $I.annoteSchema("StableToken", {
    description: "Stable non-whitespace token used by shared entity primitives.",
  })
);

/**
 * SHA-256 digest encoded as lowercase hexadecimal text.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Sha256 } from "@beep/shared-domain/entity/primitives"
 * import { Str } from "@beep/utils"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const hash = yield* S.decodeUnknownEffect(Sha256)(Str.repeat("a", 64))
 *   return hash
 * })
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const Sha256 = Sha256Hex;

/**
 * Runtime type for {@link Sha256}.
 *
 * @example
 * ```ts
 * import type { Sha256 } from "@beep/shared-domain/entity/primitives"
 *
 * const printHash = (hash: Sha256) => console.log(hash)
 * console.log(printHash)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Sha256 = Sha256HexType;

/**
 * Ed25519 signature encoded as base64url text.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Ed25519Signature } from "@beep/shared-domain/entity/primitives"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const signature = yield* S.decodeUnknownEffect(Ed25519Signature)("signature")
 *   return signature
 * })
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const Ed25519Signature = Base64UrlToken.pipe(
  S.brand("Ed25519Signature"),
  $I.annoteSchema("Ed25519Signature", {
    description: "Base64url-encoded Ed25519 signature.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link Ed25519Signature}.
 *
 * @example
 * ```ts
 * import type { Ed25519Signature } from "@beep/shared-domain/entity/primitives"
 *
 * const printSignature = (signature: Ed25519Signature) => console.log(signature)
 * console.log(printSignature)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Ed25519Signature = typeof Ed25519Signature.Type;

/**
 * Stable encryption-key identifier.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { EncryptionKeyId } from "@beep/shared-domain/entity/primitives"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const keyId = yield* S.decodeUnknownEffect(EncryptionKeyId)("key")
 *   return keyId
 * })
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const EncryptionKeyId = StableToken.pipe(
  S.brand("EncryptionKeyId"),
  $I.annoteSchema("EncryptionKeyId", {
    description: "Stable identifier for a key used to encrypt persisted entity data.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link EncryptionKeyId}.
 *
 * @example
 * ```ts
 * import type { EncryptionKeyId } from "@beep/shared-domain/entity/primitives"
 *
 * const printKeyId = (keyId: EncryptionKeyId) => console.log(keyId)
 * console.log(printKeyId)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EncryptionKeyId = typeof EncryptionKeyId.Type;

/**
 * Hybrid logical clock token.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { HybridLogicalClock } from "@beep/shared-domain/entity/primitives"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const clock = yield* S.decodeUnknownEffect(HybridLogicalClock)("clock")
 *   return clock
 * })
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const HybridLogicalClock = StableToken.pipe(
  S.brand("HybridLogicalClock"),
  $I.annoteSchema("HybridLogicalClock", {
    description: "Hybrid logical clock token used for local-first synchronization.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link HybridLogicalClock}.
 *
 * @example
 * ```ts
 * import type { HybridLogicalClock } from "@beep/shared-domain/entity/primitives"
 *
 * const printClock = (clock: HybridLogicalClock) => console.log(clock)
 * console.log(printClock)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type HybridLogicalClock = typeof HybridLogicalClock.Type;

/**
 * Vector-clock map keyed by replica or device identifier.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { VectorClock } from "@beep/shared-domain/entity/primitives"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const clock = yield* S.decodeUnknownEffect(VectorClock)({ replica: 1 })
 *   return clock
 * })
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const VectorClock = S.Record(S.NonEmptyString, NonNegativeInt).pipe(
  S.brand("VectorClock"),
  $I.annoteSchema("VectorClock", {
    description: "Vector clock map used to reason about distributed entity updates.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link VectorClock}.
 *
 * @example
 * ```ts
 * import type { VectorClock } from "@beep/shared-domain/entity/primitives"
 *
 * const printClock = (clock: VectorClock) => console.log(clock)
 * console.log(printClock)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type VectorClock = typeof VectorClock.Type;
