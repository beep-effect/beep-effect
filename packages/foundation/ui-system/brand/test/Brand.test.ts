import {
  BrandIdentity,
  beep,
  GENERATED_CSS_BANNER,
  renderThemeCss,
  ScaleStep,
  SurfaceStep,
  SvgPaint,
} from "@beep/brand";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

describe("beep identity", () => {
  it.effect("round-trips through its schema", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(BrandIdentity)(beep);
      const decoded = yield* S.decodeEffect(BrandIdentity)(encoded);

      expect(decoded).toStrictEqual(beep);
    })
  );

  it("shares every brand step between schemes except the two light accents", () => {
    const differing = A.filter(ScaleStep.Options, (step) => beep.light.brand[step] !== beep.dark.brand[step]);

    expect(differing).toStrictEqual(["300", "400"]);
  });

  it("names five mark paths: two strokes, one frame, two lenses", () => {
    expect(beep.mark.strokes.length).toBe(2);
    expect(beep.mark.glasses.lenses.length).toBe(2);
    expect(SvgPaint.is("currentColor")).toBe(true);
    expect(SvgPaint.is("green")).toBe(false);
  });
});

describe("renderThemeCss", () => {
  const css = renderThemeCss(beep);

  it("starts with the generated banner and ends with a newline", () => {
    expect(css.startsWith(GENERATED_CSS_BANNER)).toBe(true);
    expect(css.endsWith("}\n")).toBe(true);
  });

  it("declares every scale step and surface step in both schemes", () => {
    for (const step of ScaleStep.Options) {
      expect(css).toContain(`--color-brand-${step}: ${beep.light.brand[step]};`);
      expect(css).toContain(`--color-brand-${step}: ${beep.dark.brand[step]};`);
    }
    for (const step of SurfaceStep.Options) {
      expect(css).toContain(`--color-surface-${step}: ${beep.dark.surface[step]};`);
    }
  });

  it("puts the light scheme in @theme and the dark scheme under .dark", () => {
    const themeBlock = css.slice(css.indexOf("@theme {"), css.indexOf(":root {"));
    const darkBlock = css.slice(css.indexOf(".dark {"));

    expect(themeBlock).toContain(`--color-surface-0: ${beep.light.surface["0"]};`);
    expect(darkBlock).toContain(`--color-surface-0: ${beep.dark.surface["0"]};`);
  });

  it("references the brand scale from glow layers instead of baking rgba", () => {
    expect(css).toContain("--beep-glow-primary-start: color-mix(in srgb, var(--color-brand-500) 28%, transparent);");
    expect(css).toContain("--beep-glow-primary-start: color-mix(in srgb, var(--color-brand-500) 35%, transparent);");
    expect(css).not.toContain("rgba(");
  });

  it("quotes multi-word families and leaves generic keywords bare", () => {
    expect(css).toContain('--font-brand-sans: "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif;');
    expect(css).toContain('--font-brand-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace;');
    expect(css).toContain("--font-sans: var(--font-brand-sans);");
  });
});
