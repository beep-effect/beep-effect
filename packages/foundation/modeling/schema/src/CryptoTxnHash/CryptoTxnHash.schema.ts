/**
 * Branded schema for canonical mainnet blockchain transaction identifiers.
 *
 * Supports EVM, Bitcoin, and Solana families.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { flow, Redacted } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { decodeCanonicalBase58 } from "../internal/crypto.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("CryptoTxnHash");

const evmCryptoTxnHashPattern = /^0x[0-9a-f]{64}$/;
const bitcoinCryptoTxnHashPattern = /^[0-9a-f]{64}$/;

const isCanonicalSolanaSignature = (input: string): boolean =>
  O.exists(decodeCanonicalBase58(input), (decoded) => decoded.length === 64);

const isCanonicalCryptoTxnHash = (input: string): boolean =>
  evmCryptoTxnHashPattern.test(input) || bitcoinCryptoTxnHashPattern.test(input) || isCanonicalSolanaSignature(input);

const CryptoTxnHashChecks = S.makeFilterGroup(
  [
    S.makeFilter(isCanonicalCryptoTxnHash, {
      identifier: $I`CryptoTxnHashFormatCheck`,
      title: "Transaction Hash Format",
      description: "A canonical mainnet EVM, Bitcoin, or Solana transaction identifier.",
      message: "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier",
    }),
  ],
  {
    identifier: $I`CryptoTxnHashChecks`,
    title: "CryptoTxnHash",
    description: "Checks for canonical mainnet transaction identifiers across EVM, Bitcoin, and Solana families.",
  }
);

/**
 * Branded schema for canonical mainnet blockchain transaction identifiers.
 *
 * @example
 * ```ts
 * import { CryptoTxnHash } from "@beep/schema/CryptoTxnHash"
 * import * as S from "effect/Schema"
 *
 * const hash = S.decodeUnknownSync(CryptoTxnHash)(
 *   "0x0000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(hash)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const CryptoTxnHash = S.NonEmptyString.check(CryptoTxnHashChecks).pipe(
  S.brand("CryptoTxnHash"),
  $I.annoteSchema("CryptoTxnHash", {
    description: "Canonical mainnet transaction identifier for supported EVM, Bitcoin, and Solana networks.",
  })
);

/**
 * Type for {@link CryptoTxnHash}.
 *
 * @example
 * ```ts
 * import { CryptoTxnHash } from "@beep/schema/CryptoTxnHash"
 * import * as S from "effect/Schema"
 *
 * const hash: CryptoTxnHash = S.decodeUnknownSync(CryptoTxnHash)(
 *   "0x0000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(hash)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type CryptoTxnHash = typeof CryptoTxnHash.Type;

/**
 * Redacted schema for canonical mainnet blockchain transaction identifiers.
 *
 * @example
 * ```ts
 * import { CryptoTxnHashRedacted } from "@beep/schema/CryptoTxnHash"
 *
 * const hash = CryptoTxnHashRedacted.makeRedacted(
 *   "0x0000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(hash)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const CryptoTxnHashRedacted = CryptoTxnHash.pipe(
  S.RedactedFromValue,
  SchemaUtils.withStatics(() => ({
    makeRedacted: flow(CryptoTxnHash.make, Redacted.make),
  })),
  $I.annoteSchema("CryptoTxnHashRedacted", {
    description: "Redacted canonical mainnet transaction identifier for supported EVM, Bitcoin, and Solana networks.",
  })
);

/**
 * Type for {@link CryptoTxnHashRedacted}.
 *
 * @example
 * ```ts
 * import { CryptoTxnHashRedacted } from "@beep/schema/CryptoTxnHash"
 *
 * const hash: CryptoTxnHashRedacted = CryptoTxnHashRedacted.makeRedacted(
 *   "0x0000000000000000000000000000000000000000000000000000000000000000"
 * )
 * console.log(hash)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type CryptoTxnHashRedacted = typeof CryptoTxnHashRedacted.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { CryptoTxnHash as Schema, CryptoTxnHashRedacted as Redacted };
