import { EthereumValidatorPublicKey } from "@beep/schema/EthereumValidatorPublicKey";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeUnknownEthereumValidatorPublicKeySync = S.decodeUnknownSync(EthereumValidatorPublicKey);

const validPublicKey =
  "0x94c4002c93ce4911ae929129e444413f0b05ee5b97e5a99a95b609a0e61318332cfd601fc48e3853bf5a1cdd2be5f572";

describe("EthereumValidatorPublicKey", () => {
  it("accepts canonical lowercase validator public keys", () => {
    expect(decodeUnknownEthereumValidatorPublicKeySync(validPublicKey)).toBe(validPublicKey);
  });

  it("rejects malformed validator public keys", () => {
    expect(() => decodeUnknownEthereumValidatorPublicKeySync(Str.toUpperCase(validPublicKey))).toThrow(
      "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
    );
    expect(() => decodeUnknownEthereumValidatorPublicKeySync(`0x${Str.repeat("ab", 47)}`)).toThrow(
      "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
    );
    expect(() => decodeUnknownEthereumValidatorPublicKeySync(`0x${Str.repeat("ag", 48)}`)).toThrow(
      "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
    );
  });
});
