import {
  complement,
  FIFTY,
  format,
  fromDecimal,
  HUNDRED,
  isFull,
  isPercentage,
  isZero,
  Percentage,
  TWENTY,
  toDecimal,
  ZERO,
} from "@beep/schema/Percentage";
import { describe, expect, it } from "@effect/vitest";

describe("Percentage", () => {
  it("exposes only the selected schema guard", () => {
    expect(Percentage.is(0)).toBe(true);
    expect(Percentage.is(100)).toBe(true);
    expect(isPercentage(50.5)).toBe(true);
    expect(isPercentage(-1)).toBe(false);
    expect(isPercentage(101)).toBe(false);
    expect(Reflect.has(Percentage, "decodeEffect")).toBe(false);
  });

  it("converts, classifies, complements, and formats percentage values", () => {
    expect(toDecimal(FIFTY)).toBe(0.5);
    expect(fromDecimal(0.75)).toBe(75);
    expect(isZero(ZERO)).toBe(true);
    expect(isZero(TWENTY)).toBe(false);
    expect(isFull(HUNDRED)).toBe(true);
    expect(isFull(FIFTY)).toBe(false);
    expect(complement(TWENTY)).toBe(80);
    expect(format(FIFTY, 0)).toBe("50%");
    expect(format(FIFTY, undefined)).toBe("50.00%");
  });
});
