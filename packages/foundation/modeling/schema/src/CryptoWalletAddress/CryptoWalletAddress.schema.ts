/**
 * Branded schema for canonical mainnet blockchain wallet addresses.
 *
 * Supports EVM, Bitcoin, and Solana families.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bech32, bech32m } from "@scure/base";
import { flow, Redacted } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { bytesEqual, decodeCanonicalBase58, isCanonicalEvmAddress } from "../internal/crypto.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("CryptoWalletAddress");

const isBech32Like = (input: string): input is `${string}1${string}` => Str.includes("1")(input);

const isCanonicalBitcoinBase58CryptoWalletAddress = (input: string): boolean => {
  const decoded = decodeCanonicalBase58(input);

  if (O.isNone(decoded) || decoded.value.length !== 25) {
    return false;
  }

  const bytes = decoded.value;
  const version = bytes[0];

  if (version !== 0x00 && version !== 0x05) {
    return false;
  }

  const payload = bytes.subarray(0, 21);
  const checksum = bytes.subarray(21);
  const expectedChecksum = sha256(sha256(payload)).subarray(0, 4);

  return bytesEqual(checksum, expectedChecksum);
};

const isCanonicalBitcoinWitnessCryptoWalletAddress = (input: string): boolean => {
  if (!Str.startsWith("bc1")(input) || input !== Str.toLowerCase(input) || !isBech32Like(input)) {
    return false;
  }

  try {
    const decoded = bech32.decode(input);

    if (decoded.prefix !== "bc" || A.isReadonlyArrayEmpty(decoded.words)) {
      return false;
    }

    const [version, ...programWords] = decoded.words;

    if (version !== 0) {
      return false;
    }

    const program = bech32.fromWords(programWords);

    return program.length === 20 || program.length === 32;
  } catch {}

  try {
    const decoded = bech32m.decode(input);

    if (decoded.prefix !== "bc" || A.isReadonlyArrayEmpty(decoded.words)) {
      return false;
    }

    const [version, ...programWords] = decoded.words;

    if (version !== 1) {
      return false;
    }

    const program = bech32m.fromWords(programWords);

    return program.length === 32;
  } catch {
    return false;
  }
};

const isCanonicalBitcoinCryptoWalletAddress = (input: string): boolean =>
  isCanonicalBitcoinBase58CryptoWalletAddress(input) || isCanonicalBitcoinWitnessCryptoWalletAddress(input);

const isCanonicalSolanaCryptoWalletAddress = (input: string): boolean => {
  const decoded = decodeCanonicalBase58(input);

  return O.exists(decoded, (bytes) => bytes.length === 32);
};

const isCanonicalCryptoWalletAddress = P.some([
  isCanonicalEvmAddress,
  isCanonicalBitcoinCryptoWalletAddress,
  isCanonicalSolanaCryptoWalletAddress,
]);
const CryptoWalletAddressChecks = S.makeFilterGroup(
  [
    S.makeFilter(isCanonicalCryptoWalletAddress, {
      identifier: $I`CryptoWalletAddressFormatCheck`,
      title: "CryptoWalletAddress Format",
      description: "A canonical mainnet EVM, Bitcoin, or Solana wallet address.",
      message: "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address",
    }),
  ],
  {
    identifier: $I`CryptoWalletAddressChecks`,
    title: "CryptoWalletAddress",
    description: "Checks for canonical mainnet wallet addresses across EVM, Bitcoin, and Solana families.",
  }
);

/**
 * Branded schema for canonical mainnet blockchain wallet addresses.
 *
 * @example
 * ```ts
 * import { CryptoWalletAddress } from "@beep/schema/CryptoWalletAddress"
 * import * as S from "effect/Schema"
 *
 * const address = S.decodeUnknownSync(CryptoWalletAddress)("0x0000000000000000000000000000000000000000")
 * console.log(address)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const CryptoWalletAddress = S.NonEmptyString.check(CryptoWalletAddressChecks).pipe(
  S.brand("CryptoWalletAddress"),
  $I.annoteSchema("CryptoWalletAddress", {
    description: "Canonical mainnet wallet address for supported EVM, Bitcoin, and Solana networks.",
  })
);

/**
 * Type for {@link CryptoWalletAddress}.
 *
 * @since 0.0.0
 * @category models
 */
export type CryptoWalletAddress = typeof CryptoWalletAddress.Type;

/**
 * Redacted Branded schema for canonical mainnet blockchain wallet addresses.
 *
 * @example
 * ```ts
 * import { CryptoWalletAddressRedacted } from "@beep/schema/CryptoWalletAddress"
 *
 * const address = CryptoWalletAddressRedacted.makeRedacted("0x0000000000000000000000000000000000000000")
 * console.log(address)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const CryptoWalletAddressRedacted = CryptoWalletAddress.pipe(
  S.RedactedFromValue,
  SchemaUtils.withStatics(() => ({
    makeRedacted: flow(CryptoWalletAddress.make, Redacted.make),
  })),
  $I.annoteSchema("CryptoWalletAddressRedacted", {
    description: "Redacted Canonical mainnet wallet address for supported" + " EVM," + " Bitcoin, and Solana networks.",
  })
);

/**
 * Type for {@link CryptoWalletAddressRedacted}.
 *
 * @since 0.0.0
 * @category models
 */
export type CryptoWalletAddressRedacted = typeof CryptoWalletAddressRedacted.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { CryptoWalletAddress as Schema, CryptoWalletAddressRedacted as Redacted };
