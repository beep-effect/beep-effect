import { EvmAddress } from "@beep/schema/EvmAddress";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownEvmAddressEffect = S.decodeUnknownEffect(EvmAddress);

const evmLowercase = "0x52908400098527886e0f7030069857d2e4169ee7";
const evmChecksummed = "0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE";

describe("EvmAddress", () => {
  it.effect(
    "accepts lowercase and checksummed canonical EVM addresses",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownEvmAddressEffect(evmLowercase)).toBe(evmLowercase);
      expect(yield* decodeUnknownEvmAddressEffect(evmChecksummed)).toBe(evmChecksummed);
    })
  );

  it.effect(
    "rejects malformed or non-EVM addresses",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownEvmAddressEffect(Str.toUpperCase(evmChecksummed)));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("EvmAddress must be a canonical mainnet EVM address");
      }
      const failure2 = yield* Effect.result(decodeUnknownEvmAddressEffect("52908400098527886e0f7030069857d2e4169ee7"));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("EvmAddress must be a canonical mainnet EVM address");
      }
      const failure3 = yield* Effect.result(
        decodeUnknownEvmAddressEffect("bc1qqypqxpq9qcrsszg2pvxq6rs0zqg3yyc5fcj4z3")
      );
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain("EvmAddress must be a canonical mainnet EVM address");
      }
    })
  );
});
