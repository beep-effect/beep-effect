import { fcRuns } from "@beep/fc-runs";
import * as Color from "@beep/schema/Color";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeColorDarkenSync = S.decodeSync(Color.Darken);
const decodeColorGenerateAlphaScaleSync = S.decodeSync(Color.GenerateAlphaScale);
const decodeColorGenerateNeutralScaleSync = S.decodeSync(Color.GenerateNeutralScale);
const decodeColorGenerateScaleSync = S.decodeSync(Color.GenerateScale);
const decodeColorHexToRgbSync = S.decodeSync(Color.HexToRgb);
const decodeColorLightenSync = S.decodeSync(Color.Lighten);
const decodeColorMixColorsSync = S.decodeSync(Color.MixColors);
const decodeColorNormalizeHexColorSync = S.decodeSync(Color.NormalizeHexColor);
const decodeColorOklchToHexSync = S.decodeSync(Color.OklchToHex);
const decodeColorOklchToRgbSync = S.decodeSync(Color.OklchToRgb);
const decodeColorRgbToHexSync = S.decodeSync(Color.RgbToHex);
const decodeColorRgbToOklchSync = S.decodeSync(Color.RgbToOklch);
const decodeColorWithAlphaSync = S.decodeSync(Color.WithAlpha);
const decodeUnknownColorColorAmountSync = S.decodeUnknownSync(Color.ColorAmount);
const decodeUnknownColorHexToRgbSync = S.decodeUnknownSync(Color.HexToRgb);
const decodeUnknownColorRgbToHexSync = S.decodeUnknownSync(Color.RgbToHex);
const encodeColorColorAmountSync = S.encodeSync(Color.ColorAmount);

describe("Color", () => {
  it("normalizes shorthand and canonical hex inputs", () => {
    expect(decodeColorNormalizeHexColorSync("#abc")).toBe("#aabbcc");
    expect(decodeColorNormalizeHexColorSync("#AABBCC")).toBe("#aabbcc");
  });

  it("round-trips RGB and OKLCH conversion branches", () => {
    const black = decodeColorHexToRgbSync("#000");
    const white = decodeColorHexToRgbSync("#fff");

    expect(black).toMatchObject({ r: 0, g: 0, b: 0 });
    expect(white).toMatchObject({ r: 1, g: 1, b: 1 });
    expect(decodeColorRgbToHexSync({ r: -1, g: 0.5, b: 2 })).toBe("#0080ff");

    const blueOklch = decodeColorRgbToOklchSync({ r: 0, g: 0, b: 1 });
    const redOklch = decodeColorRgbToOklchSync({ r: 1, g: 0, b: 0 });

    expect(blueOklch.h).toBeGreaterThan(0);
    expect(redOklch.h).toBeGreaterThan(0);
    expect(decodeColorOklchToHexSync(blueOklch)).toBe("#0000ff");
    expect(decodeColorOklchToRgbSync({ l: 0.001, c: 0, h: 0 }).r).toBeGreaterThanOrEqual(0);
  });

  it("generates scales and color helper outputs for both light and dark modes", () => {
    const darkScale = decodeColorGenerateScaleSync({ seed: "#3b82f6", isDark: true });
    const lightScale = decodeColorGenerateScaleSync({ seed: "#3b82f6", isDark: false });
    const darkNeutral = decodeColorGenerateNeutralScaleSync({ seed: "#3b82f6", isDark: true });
    const lightNeutral = decodeColorGenerateNeutralScaleSync({ seed: "#3b82f6", isDark: false });
    const darkAlpha = decodeColorGenerateAlphaScaleSync({ scale: darkScale, isDark: true });
    const lightAlpha = decodeColorGenerateAlphaScaleSync({ scale: lightScale, isDark: false });

    expect(darkScale).toHaveLength(12);
    expect(lightScale).toHaveLength(12);
    expect(darkNeutral).toHaveLength(12);
    expect(lightNeutral).toHaveLength(12);
    expect(darkAlpha).toHaveLength(12);
    expect(lightAlpha).toHaveLength(12);
    expect(decodeColorMixColorsSync({ color1: "#000", color2: "#fff", amount: 0.5 })).toMatch(/^#[0-9a-f]{6}$/);
    expect(decodeColorLightenSync({ color: "#000", amount: 1 })).toBe("#ffffff");
    expect(decodeColorDarkenSync({ color: "#fff", amount: 1 })).toBe("#000000");
    expect(decodeColorWithAlphaSync({ color: "#336699", alpha: 0.25 })).toBe("rgba(51, 102, 153, 0.25)");
  });

  it("canonical hex colors round-trip losslessly through RGB", () => {
    const hexArbitrary = Arbitrary.schema(Color.HexColor);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([hexArbitrary]),
          ([hex]) => {
            expect(hex).toMatch(/^#[0-9a-f]{6}$/);
            const rgb = decodeUnknownColorHexToRgbSync(hex);
            expect(decodeUnknownColorRgbToHexSync({ r: rgb.r, g: rgb.g, b: rgb.b })).toBe(hex);

            return true;
          },
          fcRuns(50)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });

  it("derives only bounded color amounts from the source schema", () => {
    const amountArbitrary = Arbitrary.schema(Color.ColorAmount);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([amountArbitrary]),
          ([amount]) => {
            expect(amount).toBeGreaterThanOrEqual(0);
            expect(amount).toBeLessThanOrEqual(1);
            expect(decodeUnknownColorColorAmountSync(encodeColorColorAmountSync(amount))).toBe(amount);

            return true;
          },
          fcRuns(25)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
