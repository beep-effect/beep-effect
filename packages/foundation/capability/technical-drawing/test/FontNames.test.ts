import { fontNamesOf } from "@beep/technical-drawing/internal/LabelOutline";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vitest";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("opentype.js", () => ({ parse }));

it.effect("falls back through platform tables separately for each font-name field", () =>
  Effect.gen(function* () {
    parse.mockReturnValue({
      unitsPerEm: 1000,
      charToGlyph: () => undefined,
      tables: {},
      names: {
        unicode: { fontFamily: { en: "Primary Family" } },
        macintosh: { fontFamily: { en: "Secondary Family" } },
        windows: { fontSubfamily: { en: "Regular" } },
      },
    });

    const fontNamesOf1 = yield* fontNamesOf("fixture.ttf", new Uint8Array([0]));
    expect(fontNamesOf1).toEqual({
      family: "Primary Family",
      subfamily: "Regular",
    });

    parse.mockReturnValue({
      unitsPerEm: 1000,
      charToGlyph: () => undefined,
      tables: {},
      names: {
        unicode: { fontFamily: {} },
        macintosh: { fontFamily: { fr: "Famille" } },
        windows: { fontSubfamily: { en: "Regular" } },
      },
    });

    const fontNamesOf2 = yield* fontNamesOf("fixture.ttf", new Uint8Array([0]));
    expect(fontNamesOf2).toEqual({
      family: "Famille",
      subfamily: "Regular",
    });
  })
);
