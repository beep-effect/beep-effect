import { resolveIsMobile } from "@beep/ui/hooks/useMobile";
import { getStepFactor, numberToString, toNumber } from "@beep/ui/hooks/useNumberInput";
import { pipe } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";

describe("@beep/ui hooks/useNumberInput", () => {
  describe("toNumber", () => {
    it("parses editable numeric text", () => {
      expect(O.getOrUndefined(toNumber("12.5"))).toBe(12.5);
    });

    it("returns undefined for empty and invalid values", () => {
      expect(O.getOrUndefined(toNumber(""))).toBeUndefined();
      expect(O.getOrUndefined(toNumber("nope"))).toBeUndefined();
      expect(O.getOrUndefined(toNumber(undefined))).toBeUndefined();
    });
  });

  describe("numberToString", () => {
    it("formats values with fixed precision", () => {
      expect(numberToString(12.345, 2)).toBe("12.35");
    });

    it("returns an empty string when the value is missing", () => {
      expect(numberToString(undefined, 2)).toBe("");
    });
  });

  describe("getStepFactor", () => {
    it("supports data-first usage", () => {
      expect(getStepFactor({ shiftKey: true }, 2, { precision: 0 })).toBe(20);
      expect(getStepFactor({ ctrlKey: true }, 2, { precision: 2 })).toBe(0.2);
    });

    it("supports data-last usage", () => {
      expect(pipe({ metaKey: true }, getStepFactor(5, { precision: 2 }))).toBe(0.5);
    });

    it("falls back to the base step when fine-grained scaling would be rounded away", () => {
      expect(getStepFactor({ ctrlKey: true }, 0.001, { precision: 2 })).toBe(0.001);
    });
  });

  describe("resolveIsMobile", () => {
    it("unwraps the mobile Option without coercing the container object", () => {
      expect(resolveIsMobile(O.some(true))).toBe(true);
      expect(resolveIsMobile(O.some(false))).toBe(false);
      expect(resolveIsMobile(O.none())).toBe(false);
    });
  });
});
