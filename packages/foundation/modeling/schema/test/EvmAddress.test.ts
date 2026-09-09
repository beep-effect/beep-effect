import { EvmAddress } from "@beep/schema/EvmAddress";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeUnknownEvmAddressSync = S.decodeUnknownSync(EvmAddress);

const evmLowercase = "0x52908400098527886e0f7030069857d2e4169ee7";
const evmChecksummed = "0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE";

describe("EvmAddress", () => {
  it("accepts lowercase and checksummed canonical EVM addresses", () => {
    expect(decodeUnknownEvmAddressSync(evmLowercase)).toBe(evmLowercase);
    expect(decodeUnknownEvmAddressSync(evmChecksummed)).toBe(evmChecksummed);
  });

  it("rejects malformed or non-EVM addresses", () => {
    expect(() => decodeUnknownEvmAddressSync(Str.toUpperCase(evmChecksummed))).toThrow(
      "EvmAddress must be a canonical mainnet EVM address"
    );
    expect(() => decodeUnknownEvmAddressSync("52908400098527886e0f7030069857d2e4169ee7")).toThrow(
      "EvmAddress must be a canonical mainnet EVM address"
    );
    expect(() => decodeUnknownEvmAddressSync("bc1qqypqxpq9qcrsszg2pvxq6rs0zqg3yyc5fcj4z3")).toThrow(
      "EvmAddress must be a canonical mainnet EVM address"
    );
  });
});
