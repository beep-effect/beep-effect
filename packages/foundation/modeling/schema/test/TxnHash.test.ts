import { CryptoTxnHash } from "@beep/schema/CryptoTxnHash";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeUnknownCryptoTxnHashSync = S.decodeUnknownSync(CryptoTxnHash);
const CryptoTxnHashPayload = S.Struct({ txnHash: CryptoTxnHash });
const decodeCryptoTxnHashPayloadSync = S.decodeSync(CryptoTxnHashPayload);

const evmCryptoTxnHash = "0xabababababababababababababababababababababababababababababababab";
const bitcoinCryptoTxnHash = "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
const solanaSignature = "2YeNeP1Xwhs2QCXnqvbDHktoF5v2ZDByARS2fWeiW5x8oENhfydKP6pwhQ8SarrG3Nhb3AeFMiwD38oj24uqC9um";

describe("CryptoTxnHash", () => {
  it("accepts canonical EVM, Bitcoin, and Solana transaction identifiers", () => {
    expect(decodeUnknownCryptoTxnHashSync(evmCryptoTxnHash)).toBe(evmCryptoTxnHash);
    expect(decodeUnknownCryptoTxnHashSync(bitcoinCryptoTxnHash)).toBe(bitcoinCryptoTxnHash);
    expect(decodeUnknownCryptoTxnHashSync(solanaSignature)).toBe(solanaSignature);
  });

  it("rejects malformed EVM transaction hashes", () => {
    expect(() => decodeUnknownCryptoTxnHashSync(Str.toUpperCase(evmCryptoTxnHash))).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
    expect(() => decodeUnknownCryptoTxnHashSync(`0x${Str.repeat("ab", 31)}`)).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
    expect(() => decodeUnknownCryptoTxnHashSync(`0x${Str.repeat("ag", 32)}`)).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
  });

  it("rejects malformed Bitcoin transaction hashes", () => {
    expect(() => decodeUnknownCryptoTxnHashSync(Str.toUpperCase(bitcoinCryptoTxnHash))).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
    expect(() => decodeUnknownCryptoTxnHashSync(Str.slice(2)(bitcoinCryptoTxnHash))).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
    expect(() => decodeUnknownCryptoTxnHashSync(`g${Str.slice(1)(bitcoinCryptoTxnHash)}`)).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
  });

  it("rejects malformed Solana transaction signatures", () => {
    expect(() => decodeUnknownCryptoTxnHashSync("3ELeRTTg5W5hAYaEFznzFV1jknNFkjHqS8ytwvQEQP1Z")).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
    expect(() => decodeUnknownCryptoTxnHashSync("O0Il")).toThrow(
      "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
    );
  });

  it("reports nested field failures at the transaction hash key", () => {
    expect(() => decodeCryptoTxnHashPayloadSync({ txnHash: "invalid" })).toThrow(`at ["txnHash"]`);
  });
});
