import { CryptoWalletAddress } from "@beep/schema/CryptoWalletAddress";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, bech32, bech32m } from "@scure/base";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as S from "effect/Schema";

const failureMessage = <A>(exit: Exit.Exit<A, S.SchemaError>): string =>
  pipe(exit, Exit.findErrorOption, Option.getOrThrow).message;

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
      const failure1 = yield* Effect.exit(decodeUnknownCryptoWalletAddressEffect(Str.toUpperCase(evmChecksummed)));
      pipe(failure1, Exit.hasFails, assertTrue);
      expect(failureMessage(failure1)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure2 = yield* Effect.exit(
        decodeUnknownCryptoWalletAddressEffect("52908400098527886e0f7030069857d2e4169ee7")
      );
      pipe(failure2, Exit.hasFails, assertTrue);
      expect(failureMessage(failure2)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure3 = yield* Effect.exit(
        decodeUnknownCryptoWalletAddressEffect("0x52908400098527886E0F7030069857D2E4169Ee7")
      );
      pipe(failure3, Exit.hasFails, assertTrue);
      expect(failureMessage(failure3)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
    })
  );

  it.effect(
    "rejects malformed Bitcoin addresses",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.exit(
        decodeUnknownCryptoWalletAddressEffect("tb1qqypqxpq9qcrsszg2pvxq6rs0zqg3yyc5f8j3j2")
      );
      pipe(failure4, Exit.hasFails, assertTrue);
      expect(failureMessage(failure4)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure5 = yield* Effect.exit(
        decodeUnknownCryptoWalletAddressEffect("bc1qQypqxpq9qcrsszg2pvxq6rs0zqg3yyc5fcj4z3")
      );
      pipe(failure5, Exit.hasFails, assertTrue);
      expect(failureMessage(failure5)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure6 = yield* Effect.exit(decodeUnknownCryptoWalletAddressEffect("16L5yRNPTuciSgXGHqYwn9N6NeoKqopAv"));
      pipe(failure6, Exit.hasFails, assertTrue);
      expect(failureMessage(failure6)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure7 = yield* Effect.exit(decodeUnknownCryptoWalletAddressEffect(bitcoinBase58UnsupportedVersion));
      pipe(failure7, Exit.hasFails, assertTrue);
      expect(failureMessage(failure7)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure8 = yield* Effect.exit(decodeUnknownCryptoWalletAddressEffect(bitcoinWitnessEmptyProgram));
      pipe(failure8, Exit.hasFails, assertTrue);
      expect(failureMessage(failure8)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure9 = yield* Effect.exit(decodeUnknownCryptoWalletAddressEffect(bitcoinWitnessUnsupportedVersion));
      pipe(failure9, Exit.hasFails, assertTrue);
      expect(failureMessage(failure9)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure10 = yield* Effect.exit(decodeUnknownCryptoWalletAddressEffect(bitcoinTaprootUnsupportedVersion));
      pipe(failure10, Exit.hasFails, assertTrue);
      expect(failureMessage(failure10)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
    })
  );

  it.effect(
    "rejects malformed Solana addresses",
    Effect.fnUntraced(function* () {
      const failure11 = yield* Effect.exit(
        decodeUnknownCryptoWalletAddressEffect(
          "2YeNeP1Xwhs2QCXnqvbDHktoF5v2ZDByARS2fWeiW5x8oENhfydKP6pwhQ8SarrG3Nhb3AeFMiwD38oj24uqC9um"
        )
      );
      pipe(failure11, Exit.hasFails, assertTrue);
      expect(failureMessage(failure11)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
      const failure12 = yield* Effect.exit(decodeUnknownCryptoWalletAddressEffect("O0Il"));
      pipe(failure12, Exit.hasFails, assertTrue);
      expect(failureMessage(failure12)).toContain(
        "CryptoWalletAddress must be a canonical mainnet EVM, Bitcoin, or Solana wallet address"
      );
    })
  );

  it.effect(
    "reports nested field failures at the address key",
    Effect.fnUntraced(function* () {
      const failure13 = yield* Effect.exit(decodeCryptoWalletAddressPayloadEffect({ address: "invalid" }));
      pipe(failure13, Exit.hasFails, assertTrue);
      expect(failureMessage(failure13)).toContain(`at ["address"]`);
    })
  );
});
