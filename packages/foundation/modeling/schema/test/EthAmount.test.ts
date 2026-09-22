import { EthAmount } from "@beep/schema/EthAmount";
import { describe, expect, it } from "@effect/vitest";
import { BigDecimal, Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownEthAmountEffect = S.decodeUnknownEffect(EthAmount);
const encodeEthAmountEffect = S.encodeEffect(EthAmount);

describe("EthAmount", () => {
  it.effect(
    "decodes non-negative ETH JSON numbers into BigDecimal",
    Effect.fnUntraced(function* () {
      const amount = yield* decodeUnknownEthAmountEffect(7.220045);

      expect(BigDecimal.format(amount)).toBe("7.220045");
    })
  );

  it.effect(
    "encodes decoded ETH amounts back to JSON numbers",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeEthAmountEffect(yield* decodeUnknownEthAmountEffect(24));

      expect(encoded).toBe(24);
    })
  );

  it.effect(
    "rejects negative ETH amounts",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownEthAmountEffect(-0.000001));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("EthAmount must be greater than or equal to 0");
      }
    })
  );
});
