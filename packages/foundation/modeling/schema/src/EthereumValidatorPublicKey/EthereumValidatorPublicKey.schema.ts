/**
 * Branded schema for canonical Ethereum validator public keys.
 *
 * Accepts lowercase `0x`-prefixed compressed BLS12-381 public keys.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { flow, Redacted } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("EthereumValidatorPublicKey");

const ethereumValidatorPublicKeyPattern = /^0x[0-9a-f]{96}$/;

const EthereumValidatorPublicKeyChecks = S.makeFilterGroup(
  [
    S.isPattern(ethereumValidatorPublicKeyPattern, {
      identifier: $I`EthereumValidatorPublicKeyPatternCheck`,
      title: "Ethereum Validator Public Key Pattern",
      description: "A lowercase 0x-prefixed 48-byte compressed BLS12-381 public key.",
      message: "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key",
    }),
  ],
  {
    identifier: $I`EthereumValidatorPublicKeyChecks`,
    title: "EthereumValidatorPublicKey",
    description: "Checks for canonical Ethereum validator public keys.",
  }
);

/**
 * Branded schema for canonical Ethereum validator public keys.
 *
 * @example
 * ```ts
 * import { EthereumValidatorPublicKey } from "@beep/schema/EthereumValidatorPublicKey"
 * import * as S from "effect/Schema"
 *
 * const key = S.decodeUnknownSync(EthereumValidatorPublicKey)(
 *   "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(key)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const EthereumValidatorPublicKey = S.String.check(EthereumValidatorPublicKeyChecks)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^0x[0-9a-f]{96}$/),
  })
  .pipe(
    S.brand("EthereumValidatorPublicKey"),
    $I.annoteSchema("EthereumValidatorPublicKey", {
      description: "Canonical lowercase 0x-prefixed compressed Ethereum validator public key.",
    })
  );

/**
 * Type for {@link EthereumValidatorPublicKey}.
 *
 * @example
 * ```ts
 * import { EthereumValidatorPublicKey } from "@beep/schema/EthereumValidatorPublicKey"
 * import * as S from "effect/Schema"
 *
 * const key: EthereumValidatorPublicKey = S.decodeUnknownSync(EthereumValidatorPublicKey)(
 *   "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(key)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EthereumValidatorPublicKey = typeof EthereumValidatorPublicKey.Type;

/**
 * Redacted schema for canonical Ethereum validator public keys.
 *
 * @example
 * ```ts
 * import { EthereumValidatorPublicKeyRedacted } from "@beep/schema/EthereumValidatorPublicKey"
 *
 * const key = EthereumValidatorPublicKeyRedacted.makeRedacted(
 *   "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(key)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const EthereumValidatorPublicKeyRedacted = EthereumValidatorPublicKey.pipe(
  S.RedactedFromValue,
  SchemaUtils.withStatics(() => ({
    makeRedacted: flow(EthereumValidatorPublicKey.make, Redacted.make),
  })),
  $I.annoteSchema("EthereumValidatorPublicKeyRedacted", {
    description: "Redacted canonical lowercase 0x-prefixed compressed Ethereum validator public key.",
  })
);

/**
 * Type for {@link EthereumValidatorPublicKeyRedacted}.
 *
 * @example
 * ```ts
 * import { EthereumValidatorPublicKeyRedacted } from "@beep/schema/EthereumValidatorPublicKey"
 *
 * const key: EthereumValidatorPublicKeyRedacted = EthereumValidatorPublicKeyRedacted.makeRedacted(
 *   "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(key)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EthereumValidatorPublicKeyRedacted = typeof EthereumValidatorPublicKeyRedacted.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { EthereumValidatorPublicKey as Schema, EthereumValidatorPublicKeyRedacted as Redacted };
