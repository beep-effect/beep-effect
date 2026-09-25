import { CryptoTxnHash } from "@beep/schema/CryptoTxnHash";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
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
      const failure1 = yield* Effect.exit(decodeUnknownCryptoTxnHashEffect(Str.toUpperCase(evmCryptoTxnHash)));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure2 = yield* Effect.exit(decodeUnknownCryptoTxnHashEffect(`0x${Str.repeat("ab", 31)}`));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure3 = yield* Effect.exit(decodeUnknownCryptoTxnHashEffect(`0x${Str.repeat("ag", 32)}`));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
    })
  );

  it.effect(
    "rejects malformed Bitcoin transaction hashes",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.exit(decodeUnknownCryptoTxnHashEffect(Str.toUpperCase(bitcoinCryptoTxnHash)));
      pipe(failure4, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure4)) {
        expect(pipe(failure4.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure5 = yield* Effect.exit(decodeUnknownCryptoTxnHashEffect(Str.slice(2)(bitcoinCryptoTxnHash)));
      pipe(failure5, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure5)) {
        expect(pipe(failure5.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure6 = yield* Effect.exit(decodeUnknownCryptoTxnHashEffect(`g${Str.slice(1)(bitcoinCryptoTxnHash)}`));
      pipe(failure6, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure6)) {
        expect(pipe(failure6.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
    })
  );

  it.effect(
    "rejects malformed Solana transaction signatures",
    Effect.fnUntraced(function* () {
      const failure7 = yield* Effect.exit(
        decodeUnknownCryptoTxnHashEffect("3ELeRTTg5W5hAYaEFznzFV1jknNFkjHqS8ytwvQEQP1Z")
      );
      pipe(failure7, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure7)) {
        expect(pipe(failure7.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
      const failure8 = yield* Effect.exit(decodeUnknownCryptoTxnHashEffect("O0Il"));
      pipe(failure8, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure8)) {
        expect(pipe(failure8.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "CryptoTxnHash must be a canonical mainnet EVM, Bitcoin, or Solana transaction identifier"
        );
      }
    })
  );

  it.effect(
    "reports nested field failures at the transaction hash key",
    Effect.fnUntraced(function* () {
      const failure9 = yield* Effect.exit(decodeCryptoTxnHashPayloadEffect({ txnHash: "invalid" }));
      pipe(failure9, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure9)) {
        expect(pipe(failure9.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`at ["txnHash"]`);
      }
    })
  );
});
