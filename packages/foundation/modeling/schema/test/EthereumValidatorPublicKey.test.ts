import { EthereumValidatorPublicKey } from "@beep/schema/EthereumValidatorPublicKey";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownEthereumValidatorPublicKeyEffect = S.decodeUnknownEffect(EthereumValidatorPublicKey);

const validPublicKey =
  "0x94c4002c93ce4911ae929129e444413f0b05ee5b97e5a99a95b609a0e61318332cfd601fc48e3853bf5a1cdd2be5f572";

describe("EthereumValidatorPublicKey", () => {
  it.effect(
    "accepts canonical lowercase validator public keys",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownEthereumValidatorPublicKeyEffect(validPublicKey)).toBe(validPublicKey);
    })
  );

  it.effect(
    "rejects malformed validator public keys",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(
        decodeUnknownEthereumValidatorPublicKeyEffect(Str.toUpperCase(validPublicKey))
      );
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain(
          "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
        );
      }
      const failure2 = yield* Effect.result(decodeUnknownEthereumValidatorPublicKeyEffect(`0x${Str.repeat("ab", 47)}`));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain(
          "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
        );
      }
      const failure3 = yield* Effect.result(decodeUnknownEthereumValidatorPublicKeyEffect(`0x${Str.repeat("ag", 48)}`));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain(
          "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
        );
      }
    })
  );
});
