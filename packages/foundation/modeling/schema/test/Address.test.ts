import { CryptoWalletAddress } from "@beep/schema/CryptoWalletAddress";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, bech32, bech32m } from "@scure/base";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownCryptoWalletAddressEffect = S.decodeUnknownEffect(CryptoWalletAddress);
const CryptoWalletAddressPayload = S.Struct({ address: CryptoWalletAddress });
const decodeCryptoWalletAddressPayloadEffect = S.decodeEffect(CryptoWalletAddressPayload);

const evmLowercase = "0x52908400098527886e0f7030069857d2e4169ee7";
const evmChecksummed = "0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE";
const bitcoinP2pkh = "16L5yRNPTuciSgXGHqYwn9N6NeoKqopAu";
const bitcoinP2sh = "31nM1WuowNDzocNxPPW9NQWJEtwWpjfcLj";
const bitcoinWitness = "bc1qqypqxpq9qcrsszg2pvxq6rs0zqg3yyc5fcj4z3";
const bitcoinTaproot = "bc1ppy9qkrqdpc83qygjzv2p29shrqv35xcur50p7gppyg3jgffxyu5qus9dw3";
const solanaCryptoWalletAddress = "3ELeRTTg5W5hAYaEFznzFV1jknNFkjHqS8ytwvQEQP1Z";

const makeBitcoinBase58CheckAddress = (version: number): string => {
  const payload = new Uint8Array(21);
  payload[0] = version;
  payload.fill(1, 1);

  const checksum = sha256(sha256(payload)).subarray(0, 4);
  const encoded = new Uint8Array(25);
  encoded.set(payload, 0);
  encoded.set(checksum, 21);

  return base58.encode(encoded);
};

const bitcoinP2wsh = bech32.encode("bc", [0, ...bech32.toWords(new Uint8Array(32).fill(1))]);
const bitcoinBase58UnsupportedVersion = makeBitcoinBase58CheckAddress(0x06);
const bitcoinWitnessEmptyProgram = bech32.encode("bc", []);
const bitcoinWitnessUnsupportedVersion = bech32.encode("bc", [1, ...bech32.toWords(new Uint8Array(20).fill(1))]);
const bitcoinTaprootUnsupportedVersion = bech32m.encode("bc", [0, ...bech32m.toWords(new Uint8Array(32).fill(1))]);

describe("CryptoWalletAddress", () => {
  it.effect(
    "accepts canonical EVM addresses",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownCryptoWalletAddressEffect(evmLowercase)).toBe(evmLowercase);
      expect(yield* decodeUnknownCryptoWalletAddressEffect(evmChecksummed)).toBe(evmChecksummed);
    })
  );

  it.effect(
    "accepts canonical Bitcoin addresses",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownCryptoWalletAddressEffect(bitcoinP2pkh)).toBe(bitcoinP2pkh);
      expect(yield* decodeUnknownCryptoWalletAddressEffect(bitcoinP2sh)).toBe(bitcoinP2sh);
      expect(yield* decodeUnknownCryptoWalletAddressEffect(bitcoinWitness)).toBe(bitcoinWitness);
      expect(yield* decodeUnknownCryptoWalletAddressEffect(bitcoinP2wsh)).toBe(bitcoinP2wsh);
      expect(yield* decodeUnknownCryptoWalletAddressEffect(bitcoinTaproot)).toBe(bitcoinTaproot);
    })
  );

  it.effect(
    "accepts canonical Solana addresses",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownCryptoWalletAddressEffect(solanaCryptoWalletAddress)).toBe(solanaCryptoWalletAddress);
    })
  );

  it.effect(
    "rejects malformed EVM addresses",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownCryptoWalletAddressEffect(Str.toUpperCase(evmChecksummed)));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure2 = yield* Effect.result(
        decodeUnknownCryptoWalletAddressEffect("52908400098527886e0f7030069857d2e4169ee7")
      );
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure3 = yield* Effect.result(
        decodeUnknownCryptoWalletAddressEffect("0x52908400098527886E0F7030069857D2E4169Ee7")
      );
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
    })
  );

  it.effect(
    "rejects malformed Bitcoin addresses",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.result(
        decodeUnknownCryptoWalletAddressEffect("tb1qqypqxpq9qcrsszg2pvxq6rs0zqg3yyc5f8j3j2")
      );
      expect(Result.isFailure(failure4)).toBe(true);
      if (Result.isFailure(failure4)) {
        expect(failure4.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure5 = yield* Effect.result(
        decodeUnknownCryptoWalletAddressEffect("bc1qQypqxpq9qcrsszg2pvxq6rs0zqg3yyc5fcj4z3")
      );
      expect(Result.isFailure(failure5)).toBe(true);
      if (Result.isFailure(failure5)) {
        expect(failure5.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure6 = yield* Effect.result(
        decodeUnknownCryptoWalletAddressEffect("16L5yRNPTuciSgXGHqYwn9N6NeoKqopAv")
      );
      expect(Result.isFailure(failure6)).toBe(true);
      if (Result.isFailure(failure6)) {
        expect(failure6.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure7 = yield* Effect.result(decodeUnknownCryptoWalletAddressEffect(bitcoinBase58UnsupportedVersion));
      expect(Result.isFailure(failure7)).toBe(true);
      if (Result.isFailure(failure7)) {
        expect(failure7.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure8 = yield* Effect.result(decodeUnknownCryptoWalletAddressEffect(bitcoinWitnessEmptyProgram));
      expect(Result.isFailure(failure8)).toBe(true);
      if (Result.isFailure(failure8)) {
        expect(failure8.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure9 = yield* Effect.result(decodeUnknownCryptoWalletAddressEffect(bitcoinWitnessUnsupportedVersion));
      expect(Result.isFailure(failure9)).toBe(true);
      if (Result.isFailure(failure9)) {
        expect(failure9.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure10 = yield* Effect.result(decodeUnknownCryptoWalletAddressEffect(bitcoinTaprootUnsupportedVersion));
      expect(Result.isFailure(failure10)).toBe(true);
      if (Result.isFailure(failure10)) {
        expect(failure10.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
    })
  );

  it.effect(
    "rejects malformed Solana addresses",
    Effect.fnUntraced(function* () {
      const failure11 = yield* Effect.result(
        decodeUnknownCryptoWalletAddressEffect(
          "2YeNeP1Xwhs2QCXnqvbDHktoF5v2ZDByARS2fWeiW5x8oENhfydKP6pwhQ8SarrG3Nhb3AeFMiwD38oj24uqC9um"
        )
      );
      expect(Result.isFailure(failure11)).toBe(true);
      if (Result.isFailure(failure11)) {
        expect(failure11.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
      const failure12 = yield* Effect.result(decodeUnknownCryptoWalletAddressEffect("O0Il"));
      expect(Result.isFailure(failure12)).toBe(true);
      if (Result.isFailure(failure12)) {
        expect(failure12.failure.message).toContain(
          "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
        );
      }
    })
  );

  it.effect(
    "reports nested field failures at the address key",
    Effect.fnUntraced(function* () {
      const failure13 = yield* Effect.result(decodeCryptoWalletAddressPayloadEffect({ address: "invalid" }));
      expect(Result.isFailure(failure13)).toBe(true);
      if (Result.isFailure(failure13)) {
        expect(failure13.failure.message).toContain(`at ["address"]`);
      }
    })
  );
});
