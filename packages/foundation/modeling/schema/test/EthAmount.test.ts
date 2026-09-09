import { EthAmount } from "@beep/schema/EthAmount";
import { describe, expect, it } from "@effect/vitest";
import { BigDecimal } from "effect";
import * as S from "effect/Schema";

const decodeUnknownEthAmountSync = S.decodeUnknownSync(EthAmount);
const encodeEthAmountSync = S.encodeSync(EthAmount);

describe("EthAmount", () => {
  it("decodes non-negative ETH JSON numbers into BigDecimal", () => {
    const amount = decodeUnknownEthAmountSync(7.220045);

    expect(BigDecimal.format(amount)).toBe("7.220045");
  });

  it("encodes decoded ETH amounts back to JSON numbers", () => {
    const encoded = encodeEthAmountSync(decodeUnknownEthAmountSync(24));

    expect(encoded).toBe(24);
  });

  it("rejects negative ETH amounts", () => {
    expect(() => decodeUnknownEthAmountSync(-0.000001)).toThrow("EthAmount must be greater than or equal to 0");
  });
});
