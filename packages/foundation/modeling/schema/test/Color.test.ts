import * as Color from "@beep/schema/Color";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("Color", () => {
  it("normalizes shorthand and canonical hex inputs", () => {
    expect(S.decodeUnknownSync(Color.NormalizeHexColor)("#abc")).toBe("#aabbcc");
    expect(S.decodeUnknownSync(Color.NormalizeHexColor)("#AABBCC")).toBe("#aabbcc");
  });

  it("round-trips RGB and OKLCH conversion branches", () => {
    const black = S.decodeUnknownSync(Color.HexToRgb)("#000");
    const white = S.decodeUnknownSync(Color.HexToRgb)("#fff");

    expect(black).toMatchObject({ r: 0, g: 0, b: 0 });
    expect(white).toMatchObject({ r: 1, g: 1, b: 1 });
    expect(S.decodeUnknownSync(Color.RgbToHex)({ r: -1, g: 0.5, b: 2 })).toBe("#0080ff");

    const blueOklch = S.decodeUnknownSync(Color.RgbToOklch)({ r: 0, g: 0, b: 1 });
    const redOklch = S.decodeUnknownSync(Color.RgbToOklch)({ r: 1, g: 0, b: 0 });

    expect(blueOklch.h).toBeGreaterThan(0);
    expect(redOklch.h).toBeGreaterThan(0);
    expect(S.decodeUnknownSync(Color.OklchToHex)(blueOklch)).toBe("#0000ff");
    expect(S.decodeUnknownSync(Color.OklchToRgb)({ l: 0.001, c: 0, h: 0 }).r).toBeGreaterThanOrEqual(0);
  });

  it("generates scales and color helper outputs for both light and dark modes", () => {
    const darkScale = S.decodeUnknownSync(Color.GenerateScale)({ seed: "#3b82f6", isDark: true });
    const lightScale = S.decodeUnknownSync(Color.GenerateScale)({ seed: "#3b82f6", isDark: false });
    const darkNeutral = S.decodeUnknownSync(Color.GenerateNeutralScale)({ seed: "#3b82f6", isDark: true });
    const lightNeutral = S.decodeUnknownSync(Color.GenerateNeutralScale)({ seed: "#3b82f6", isDark: false });
    const darkAlpha = S.decodeUnknownSync(Color.GenerateAlphaScale)({ scale: darkScale, isDark: true });
    const lightAlpha = S.decodeUnknownSync(Color.GenerateAlphaScale)({ scale: lightScale, isDark: false });

    expect(darkScale).toHaveLength(12);
    expect(lightScale).toHaveLength(12);
    expect(darkNeutral).toHaveLength(12);
    expect(lightNeutral).toHaveLength(12);
    expect(darkAlpha).toHaveLength(12);
    expect(lightAlpha).toHaveLength(12);
    expect(S.decodeUnknownSync(Color.MixColors)({ color1: "#000", color2: "#fff", amount: 0.5 })).toMatch(
      /^#[0-9a-f]{6}$/
    );
    expect(S.decodeUnknownSync(Color.Lighten)({ color: "#000", amount: 1 })).toBe("#ffffff");
    expect(S.decodeUnknownSync(Color.Darken)({ color: "#fff", amount: 1 })).toBe("#000000");
    expect(S.decodeUnknownSync(Color.WithAlpha)({ color: "#336699", alpha: 0.25 })).toBe("rgba(51, 102, 153, 0.25)");
  });

  it("canonical hex colors round-trip losslessly through RGB", () => {
    const hexArbitrary = S.toArbitrary(Color.HexColor);
    const decodeRgb = S.decodeUnknownSync(Color.HexToRgb);
    const encodeHex = S.decodeUnknownSync(Color.RgbToHex);

    fc.assert(
      fc.property(hexArbitrary, (hex) => {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        const rgb = decodeRgb(hex);
        expect(encodeHex({ r: rgb.r, g: rgb.g, b: rgb.b })).toBe(hex);
      }),
      fcRuns(50)
    );
  });

  it("derives only bounded color amounts from the source schema", () => {
    const amountArbitrary = S.toArbitrary(Color.ColorAmount);
    const encode = S.encodeSync(Color.ColorAmount);
    const decode = S.decodeUnknownSync(Color.ColorAmount);

    fc.assert(
      fc.property(amountArbitrary, (amount) => {
        expect(amount).toBeGreaterThanOrEqual(0);
        expect(amount).toBeLessThanOrEqual(1);
        expect(decode(encode(amount))).toBe(amount);
      }),
      fcRuns(25)
    );
  });
});
