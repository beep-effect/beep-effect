import { CurrencyCode, CurrencyName, isCurrencyCode, USD } from "@beep/schema/CurrencyCode";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeCurrencyCodeSync = S.decodeSync(CurrencyCode);
const decodeCurrencyNameSync = S.decodeSync(CurrencyName);
const decodeUnknownCurrencyCodeSync = S.decodeUnknownSync(CurrencyCode);

describe("CurrencyCode", () => {
  it("decodes ISO 4217 literals from generated @beep/data values", () => {
    expect(decodeCurrencyCodeSync("USD")).toBe("USD");
    expect(decodeCurrencyCodeSync("EUR")).toBe("EUR");
    expect(CurrencyCode.Options).toContain("USD");
    expect(USD).toBe("USD");
  });

  it("exports a generated currency-name literal schema", () => {
    expect(decodeCurrencyNameSync("US Dollar")).toBe("US Dollar");
    expect(CurrencyName.Options).toContain("Euro");
  });

  it("rejects unknown currency codes", () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("usd")).toBe(false);
    expect(() => decodeUnknownCurrencyCodeSync("ZZZ")).toThrow();
  });
});
