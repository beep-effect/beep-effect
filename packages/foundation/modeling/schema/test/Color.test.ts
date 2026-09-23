import { fcRuns } from "@beep/fc-runs";
import * as Color from "@beep/schema/Color";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeColorDarken = S.decodeUnknownEffect(Color.Darken);
const decodeColorGenerateAlphaScale = S.decodeUnknownEffect(Color.GenerateAlphaScale);
const decodeColorGenerateNeutralScale = S.decodeUnknownEffect(Color.GenerateNeutralScale);
const decodeColorGenerateScale = S.decodeUnknownEffect(Color.GenerateScale);
const decodeColorHexToRgb = S.decodeUnknownEffect(Color.HexToRgb);
const decodeColorLighten = S.decodeUnknownEffect(Color.Lighten);
const decodeColorMixColors = S.decodeUnknownEffect(Color.MixColors);
const decodeColorNormalizeHexColor = S.decodeUnknownEffect(Color.NormalizeHexColor);
const decodeColorOklchToHex = S.decodeUnknownEffect(Color.OklchToHex);
const decodeColorOklchToRgb = S.decodeUnknownEffect(Color.OklchToRgb);
const decodeColorRgbToHex = S.decodeUnknownEffect(Color.RgbToHex);
const decodeColorRgbToOklch = S.decodeUnknownEffect(Color.RgbToOklch);
const decodeColorWithAlpha = S.decodeUnknownEffect(Color.WithAlpha);
const decodeUnknownColorColorAmount = S.decodeUnknownEffect(Color.ColorAmount);
const decodeUnknownColorHexToRgb = S.decodeUnknownEffect(Color.HexToRgb);
const decodeUnknownColorRgbToHex = S.decodeUnknownEffect(Color.RgbToHex);
const encodeColorColorAmount = S.encodeEffect(Color.ColorAmount);

describe("Color", () => {
  it.effect(
    "normalizes shorthand and canonical hex inputs",
    Effect.fnUntraced(function* () {
      expect(yield* decodeColorNormalizeHexColor("#abc")).toBe("#aabbcc");
      expect(yield* decodeColorNormalizeHexColor("#AABBCC")).toBe("#aabbcc");
    })
  );

  it.effect(
    "round-trips RGB and OKLCH conversion branches",
    Effect.fnUntraced(function* () {
      const black = yield* decodeColorHexToRgb("#000");
      const white = yield* decodeColorHexToRgb("#fff");

      expect(black).toMatchObject({ r: 0, g: 0, b: 0 });
      expect(white).toMatchObject({ r: 1, g: 1, b: 1 });
      expect(yield* decodeColorRgbToHex({ r: -1, g: 0.5, b: 2 })).toBe("#0080ff");

      const blueOklch = yield* decodeColorRgbToOklch({ r: 0, g: 0, b: 1 });
      const redOklch = yield* decodeColorRgbToOklch({ r: 1, g: 0, b: 0 });

      expect(blueOklch.h).toBeGreaterThan(0);
      expect(redOklch.h).toBeGreaterThan(0);
      expect(yield* decodeColorOklchToHex(blueOklch)).toBe("#0000ff");
      expect((yield* decodeColorOklchToRgb({ l: 0.001, c: 0, h: 0 })).r).toBeGreaterThanOrEqual(0);
    })
  );

  it.effect(
    "generates scales and color helper outputs for both light and dark modes",
    Effect.fnUntraced(function* () {
      const darkScale = yield* decodeColorGenerateScale({ seed: "#3b82f6", isDark: true });
      const lightScale = yield* decodeColorGenerateScale({ seed: "#3b82f6", isDark: false });
      const darkNeutral = yield* decodeColorGenerateNeutralScale({ seed: "#3b82f6", isDark: true });
      const lightNeutral = yield* decodeColorGenerateNeutralScale({ seed: "#3b82f6", isDark: false });
      const darkAlpha = yield* decodeColorGenerateAlphaScale({ scale: darkScale, isDark: true });
      const lightAlpha = yield* decodeColorGenerateAlphaScale({ scale: lightScale, isDark: false });

      expect(darkScale).toHaveLength(12);
      expect(lightScale).toHaveLength(12);
      expect(darkNeutral).toHaveLength(12);
      expect(lightNeutral).toHaveLength(12);
      expect(darkAlpha).toHaveLength(12);
      expect(lightAlpha).toHaveLength(12);
      expect(yield* decodeColorMixColors({ color1: "#000", color2: "#fff", amount: 0.5 })).toMatch(/^#[0-9a-f]{6}$/);
      expect(yield* decodeColorLighten({ color: "#000", amount: 1 })).toBe("#ffffff");
      expect(yield* decodeColorDarken({ color: "#fff", amount: 1 })).toBe("#000000");
      expect(yield* decodeColorWithAlpha({ color: "#336699", alpha: 0.25 })).toBe("rgba(51, 102, 153, 0.25)");
    })
  );

  it.effect.prop(
    "canonical hex colors round-trip losslessly through RGB",
    [Arbitrary.schema(Color.HexColor)],
    Effect.fnUntraced(function* ([hex]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      const rgb = yield* decodeUnknownColorHexToRgb(hex);
      expect(yield* decodeUnknownColorRgbToHex({ r: rgb.r, g: rgb.g, b: rgb.b })).toBe(hex);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "derives only bounded color amounts from the source schema",
    [Arbitrary.schema(Color.ColorAmount)],
    Effect.fnUntraced(function* ([amount]) {
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(1);
      expect(yield* decodeUnknownColorColorAmount(yield* encodeColorColorAmount(amount))).toBe(amount);

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );
});
