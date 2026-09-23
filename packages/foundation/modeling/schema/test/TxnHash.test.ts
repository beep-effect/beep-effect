import { CryptoTxnHash } from "@beep/schema/CryptoTxnHash";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownCryptoTxnHashEffect = S.decodeUnknownEffect(CryptoTxnHash);
const CryptoTxnHashPayload = S.Struct({ txnHash: CryptoTxnHash });
const decodeCryptoTxnHashPayloadEffect = S.decodeEffect(CryptoTxnHashPayload);

const evmCryptoTxnHash = "0xabababababababababababababababababababababababababababababababab";
const bitcoinCryptoTxnHash = "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
const solanaSignature = "2YeNeP1Xwhs2QCXnqvbDHktoF5v2ZDByARS2fWeiW5x8oENhfydKP6pwhQ8SarrG3Nhb3AeFMiwD38oj24uqC9um";

describe("CryptoTxnHash", () => {
  it.effect(
    "accepts canonical EVM, Bitcoin, and Solana transaction identifiers",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownCryptoTxnHashEffect(evmCryptoTxnHash)).toBe(evmCryptoTxnHash);
      expect(yield* decodeUnknownCryptoTxnHashEffect(bitcoinCryptoTxnHash)).toBe(bitcoinCryptoTxnHash);
      expect(yield* decodeUnknownCryptoTxnHashEffect(solanaSignature)).toBe(solanaSignature);
    })
  );

  it.effect(
    "rejects malformed EVM transaction hashes",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownCryptoTxnHashEffect(Str.toUpperCase(evmCryptoTxnHash)));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure2 = yield* Effect.result(decodeUnknownCryptoTxnHashEffect(`0x${Str.repeat("ab", 31)}`));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure3 = yield* Effect.result(decodeUnknownCryptoTxnHashEffect(`0x${Str.repeat("ag", 32)}`));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
    })
  );

  it.effect(
    "rejects malformed Bitcoin transaction hashes",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.result(decodeUnknownCryptoTxnHashEffect(Str.toUpperCase(bitcoinCryptoTxnHash)));
      expect(Result.isFailure(failure4)).toBe(true);
      if (Result.isFailure(failure4)) {
        expect(failure4.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure5 = yield* Effect.result(decodeUnknownCryptoTxnHashEffect(Str.slice(2)(bitcoinCryptoTxnHash)));
      expect(Result.isFailure(failure5)).toBe(true);
      if (Result.isFailure(failure5)) {
        expect(failure5.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure6 = yield* Effect.result(decodeUnknownCryptoTxnHashEffect(`g${Str.slice(1)(bitcoinCryptoTxnHash)}`));
      expect(Result.isFailure(failure6)).toBe(true);
      if (Result.isFailure(failure6)) {
        expect(failure6.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
    })
  );

  it.effect(
    "rejects malformed Solana transaction signatures",
    Effect.fnUntraced(function* () {
      const failure7 = yield* Effect.result(
        decodeUnknownCryptoTxnHashEffect("3ELeRTTg5W5hAYaEFznzFV1jknNFkjHqS8ytwvQEQP1Z")
      );
      expect(Result.isFailure(failure7)).toBe(true);
      if (Result.isFailure(failure7)) {
        expect(failure7.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure8 = yield* Effect.result(decodeUnknownCryptoTxnHashEffect("O0Il"));
      expect(Result.isFailure(failure8)).toBe(true);
      if (Result.isFailure(failure8)) {
        expect(failure8.failure.message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
    })
  );

  it.effect(
    "reports nested field failures at the transaction hash key",
    Effect.fnUntraced(function* () {
      const failure9 = yield* Effect.result(decodeCryptoTxnHashPayloadEffect({ txnHash: "invalid" }));
      expect(Result.isFailure(failure9)).toBe(true);
      if (Result.isFailure(failure9)) {
        expect(failure9.failure.message).toContain(`at ["txnHash"]`);
      }
    })
  );
});
