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
import { keccak_256 } from "@noble/hashes/sha3.js";
import { base58, bech32, bech32m } from "@scure/base";
import { Encoding, flow, Redacted, Result } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("CryptoWalletAddress");

const evmCryptoWalletAddressPattern = /^0x[0-9a-fA-F]{40}$/;

const isBech32Like = (input: string): input is `${string}1${string}` => Str.includes("1")(input);

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
};

const decodeCanonicalBase58 = (input: string): O.Option<Uint8Array> =>
  Result.match(
    Result.try(() => base58.decode(input)),
    {
      onFailure: () => O.none(),
      onSuccess: (decoded) => (base58.encode(decoded) === input ? O.some(decoded) : O.none()),
    }
  );

const isCanonicalEvmCryptoWalletAddress = (input: string): boolean => {
  if (!evmCryptoWalletAddressPattern.test(input)) {
    return false;
  }

  const address = Str.slice(2)(input);
  const lowercaseCryptoWalletAddress = Str.toLowerCase(address);

  if (address === lowercaseCryptoWalletAddress) {
    return true;
  }

  const checksum = Encoding.encodeHex(keccak_256(new TextEncoder().encode(lowercaseCryptoWalletAddress)));

  for (let index = 0; index < address.length; index += 1) {
    const character = address[index]!;
    const lowercaseCharacter = Str.toLowerCase(character);
    const uppercaseCharacter = Str.toUpperCase(character);

    if (Eq.equals(lowercaseCharacter, uppercaseCharacter)) {
      continue;
    }

    const checksumNibble = Number.parseInt(checksum[index]!, 16);
    const shouldBeUppercase = checksumNibble >= 8;

    if (shouldBeUppercase ? character !== uppercaseCharacter : character !== lowercaseCharacter) {
      return false;
    }
  }

  return true;
};

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

  return equalBytes(checksum, expectedChecksum);
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
  isCanonicalEvmCryptoWalletAddress,
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
