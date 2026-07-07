/**
 * Internal crypto address validation primitives.
 *
 * @since 0.0.0
 */

import { keccak_256 } from "@noble/hashes/sha3.js";
import { base58 } from "@scure/base";
import { Encoding, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const evmAddressPattern = /^0x[0-9a-fA-F]{40}$/;

/**
 * Decode base58 text only when it round-trips to the canonical spelling.
 *
 * @category guards
 * @since 0.0.0
 */
export const decodeCanonicalBase58 = (input: string): O.Option<Uint8Array> =>
  Result.match(
    Result.try(() => base58.decode(input)),
    {
      onFailure: O.none,
      onSuccess: (decoded) => (base58.encode(decoded) === input ? O.some(decoded) : O.none()),
    }
  );

/**
 * Compare byte arrays by length and byte value.
 *
 * @category guards
 * @since 0.0.0
 */
export const bytesEqual: {
  (right: Uint8Array): (left: Uint8Array) => boolean;
  (left: Uint8Array, right: Uint8Array): boolean;
} = dual(
  2,
  (left: Uint8Array, right: Uint8Array): boolean =>
    left.byteLength === right.byteLength &&
    pipe(
      A.zipWith(left, right, Eq.equals),
      A.every((isEqual) => isEqual)
    )
);

/**
 * Validate lowercase or EIP-55 checksummed EVM address text.
 *
 * @category guards
 * @since 0.0.0
 */
export const isCanonicalEvmAddress = (input: string): boolean => {
  if (!evmAddressPattern.test(input)) {
    return false;
  }

  const addressBody = Str.slice(2)(input);
  const lowercaseAddressBody = Str.toLowerCase(addressBody);

  if (addressBody === lowercaseAddressBody) {
    return true;
  }

  const checksum = Encoding.encodeHex(keccak_256(new TextEncoder().encode(lowercaseAddressBody)));

  for (let index = 0; index < addressBody.length; index += 1) {
    const character = addressBody[index]!;
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
