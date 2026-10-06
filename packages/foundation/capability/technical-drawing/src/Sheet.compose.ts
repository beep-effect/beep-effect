/**
 * Pure sheet composition: place one projected view on a 37 CFR 1.84 sheet as
 * a deterministic SVG with stroke-lettered `n/N` and `FIG. n` labels.
 *
 * **Details**
 *
 * Lettering is drawn from a small single-stroke glyph table (digits, `F`,
 * `I`, `G`, `.`, `/`), so a sheet needs no font and embeds none: every mark
 * on the page is a uniform-width black stroke. Coordinates are rounded to
 * three decimals and segments keep the engine's canonical order, so equal
 * geometry yields byte-equal SVG.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, N } from "@beep/utils";
import { pipe } from "effect";
import { MARGINS_CM, PT_PER_CM, PT_PER_MM, pageSizePt } from "./Sheet.schemas.ts";
import type { Segment2 } from "./Geometry.schemas.ts";
import type { SheetOptions } from "./Sheet.schemas.ts";

type Polyline = ReadonlyArray<readonly [number, number]>;

// Single-stroke glyphs on a 4-wide × 6-tall cell (y up), advance 5.
const GLYPHS: Readonly<Record<string, ReadonlyArray<Polyline>>> = {
  "0": [
    [
      [0, 0],
      [4, 0],
      [4, 6],
      [0, 6],
      [0, 0],
    ],
  ],
  "1": [
    [
      [2, 0],
      [2, 6],
    ],
    [
      [0, 4],
      [2, 6],
    ],
  ],
  "2": [
    [
      [0, 6],
      [4, 6],
      [4, 3],
      [0, 3],
      [0, 0],
      [4, 0],
    ],
  ],
  "3": [
    [
      [0, 6],
      [4, 6],
      [4, 0],
      [0, 0],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  "4": [
    [
      [0, 6],
      [0, 3],
      [4, 3],
    ],
    [
      [4, 6],
      [4, 0],
    ],
  ],
  "5": [
    [
      [4, 6],
      [0, 6],
      [0, 3],
      [4, 3],
      [4, 0],
      [0, 0],
    ],
  ],
  "6": [
    [
      [4, 6],
      [0, 6],
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
  ],
  "7": [
    [
      [0, 6],
      [4, 6],
      [4, 0],
    ],
  ],
  "8": [
    [
      [0, 0],
      [4, 0],
      [4, 6],
      [0, 6],
      [0, 0],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  "9": [
    [
      [0, 0],
      [4, 0],
      [4, 6],
      [0, 6],
      [0, 3],
      [4, 3],
    ],
  ],
  F: [
    [
      [0, 0],
      [0, 6],
      [4, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  I: [
    [
      [2, 0],
      [2, 6],
    ],
    [
      [1, 0],
      [3, 0],
    ],
    [
      [1, 6],
      [3, 6],
    ],
  ],
  G: [
    [
      [4, 6],
      [0, 6],
      [0, 0],
      [4, 0],
      [4, 3],
      [2, 3],
    ],
  ],
  ".": [
    [
      [1.5, 0],
      [2.5, 0],
    ],
  ],
  "/": [
    [
      [0, 0],
      [4, 6],
    ],
  ],
  " ": [],
};
const GLYPH_HEIGHT = 6;
const GLYPH_ADVANCE = 5;

const r3 = (value: number): string => {
  const rounded = N.round(3)(value);
  return (rounded === 0 ? 0 : rounded).toFixed(3);
};

/**
 * Width of a label in points at a cap height.
 *
 * **Example** (Width of `FIG. 1`)
 *
 * ```ts
 * import { labelWidthPt } from "@beep/technical-drawing"
 *
 * console.log(labelWidthPt({ text: "FIG. 1", capHeightPt: 12.76 }))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const labelWidthPt = (input: { readonly text: string; readonly capHeightPt: number }): number =>
  ((input.text.length * GLYPH_ADVANCE - 1) * input.capHeightPt) / GLYPH_HEIGHT;

/**
 * Stroke a label as polylines in sheet points, left-aligned at `x`, baseline
 * at `y` (SVG y down).
 *
 * **Details**
 *
 * Characters outside the glyph table draw nothing; callers only pass
 * `FIG. n` and `n/N`.
 *
 * **Example** (Stroke a sheet number)
 *
 * ```ts
 * import { strokeLabel } from "@beep/technical-drawing"
 *
 * console.log(strokeLabel({ text: "1/8", x: 100, y: 100, capHeightPt: 12.76 }).length)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const strokeLabel = (input: {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly capHeightPt: number;
}): ReadonlyArray<Polyline> => {
  const { text, x, y, capHeightPt } = input;
  const unit = capHeightPt / GLYPH_HEIGHT;
  return pipe(
    A.fromIterable(text),
    A.flatMap((char, index) =>
      pipe(
        GLYPHS[char] ?? [],
        A.map((line) => A.map(line, ([gx, gy]) => [x + (index * GLYPH_ADVANCE + gx) * unit, y - gy * unit] as const))
      )
    )
  );
};

const polylinePath = (line: Polyline): string =>
  pipe(
    line,
    A.map(([px, py], i) => `${i === 0 ? "M" : "L"}${r3(px)} ${r3(py)}`),
    A.join("")
  );

/**
 * Extents of a projected view in model units.
 *
 * **Example** (Extents of one segment)
 *
 * ```ts
 * import { viewExtents } from "@beep/technical-drawing"
 *
 * console.log(viewExtents([[0, 0, 10, 5]]))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const viewExtents = (
  segments: ReadonlyArray<Segment2>
): { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number } => {
  const xs = pipe(
    segments,
    A.flatMap((s) => [s[0], s[2]])
  );
  const ys = pipe(
    segments,
    A.flatMap((s) => [s[1], s[3]])
  );
  return {
    minX: A.length(xs) === 0 ? 0 : Math.min(...xs),
    minY: A.length(ys) === 0 ? 0 : Math.min(...ys),
    maxX: A.length(xs) === 0 ? 0 : Math.max(...xs),
    maxY: A.length(ys) === 0 ? 0 : Math.max(...ys),
  };
};

/**
 * Geometry of the sight (drawable area) of a sheet, in points, SVG y down.
 *
 * **Details**
 *
 * The sight is the page minus the 1.84(g) margins and the safety gap. The
 * figure area is the sight minus the sheet-number band at the top and the
 * `FIG. n` band at the bottom.
 *
 * **Example** (Letter sight)
 *
 * ```ts
 * import { SheetOptions, sheetGeometry } from "@beep/technical-drawing"
 *
 * const g = sheetGeometry(SheetOptions.make({}))
 * console.log(g.sight.left, g.figure.top)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sheetGeometry = (options: SheetOptions) => {
  const page = pageSizePt(options.format);
  const safety = options.safetyMm * PT_PER_MM;
  const cap = options.letterHeightCm * PT_PER_CM;
  const band = cap * 2;
  const sight = {
    left: MARGINS_CM.left * PT_PER_CM + safety,
    top: MARGINS_CM.top * PT_PER_CM + safety,
    right: page.width - MARGINS_CM.right * PT_PER_CM - safety,
    bottom: page.height - MARGINS_CM.bottom * PT_PER_CM - safety,
  };
  const figure = {
    left: sight.left,
    top: sight.top + band,
    right: sight.right,
    bottom: sight.bottom - band,
  };
  return { page, cap, sight, figure } as const;
};

/**
 * Largest scale (points per model unit) at which every view fits the figure
 * area of a sheet, rounded down to four decimals so all sheets share it.
 *
 * **Example** (Fit two views)
 *
 * ```ts
 * import { SheetOptions, commonScale } from "@beep/technical-drawing"
 *
 * console.log(commonScale({ views: [[[0, 0, 40, 30]], [[0, 0, 20, 60]]], options: SheetOptions.make({}) }))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const commonScale = (input: {
  readonly views: ReadonlyArray<ReadonlyArray<Segment2>>;
  readonly options: SheetOptions;
}): number => {
  const { views, options } = input;
  const { figure } = sheetGeometry(options);
  const stroke = options.lineWeightMm * PT_PER_MM;
  const areaW = figure.right - figure.left - stroke;
  const areaH = figure.bottom - figure.top - stroke;
  const fits = pipe(
    views,
    A.map(viewExtents),
    A.map((e) => Math.min(areaW / Math.max(e.maxX - e.minX, 1e-9), areaH / Math.max(e.maxY - e.minY, 1e-9)))
  );
  const raw = A.length(fits) === 0 ? 1 : Math.min(...fits);
  return Math.floor(raw * 1e4) / 1e4;
};

/**
 * Compose one sheet.
 *
 * **Example** (A sheet with one segment)
 *
 * ```ts
 * import { SheetOptions, composeSheet } from "@beep/technical-drawing"
 *
 * const svg = composeSheet({
 *   segments: [[0, 0, 40, 0]], shading: [], figure: 1, sheet: 1, sheets: 1, scale: 5, options: SheetOptions.make({})
 * })
 * console.log(svg.startsWith("<svg"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const composeSheet = (input: {
  readonly segments: ReadonlyArray<Segment2>;
  readonly shading: ReadonlyArray<Segment2>;
  readonly figure: number;
  readonly sheet: number;
  readonly sheets: number;
  readonly scale: number;
  readonly options: SheetOptions;
}): string => {
  const { segments, scale, options } = input;
  const { page, cap, sight, figure } = sheetGeometry(options);
  const stroke = options.lineWeightMm * PT_PER_MM;
  const extents = viewExtents(segments);
  const drawnW = (extents.maxX - extents.minX) * scale;
  const drawnH = (extents.maxY - extents.minY) * scale;
  const originX = (figure.left + figure.right) / 2 - drawnW / 2;
  const originY = (figure.top + figure.bottom) / 2 + drawnH / 2;
  // Model y is up; SVG y is down.
  const toSheet = ([x1, y1, x2, y2]: Segment2): Segment2 => [
    originX + (x1 - extents.minX) * scale,
    originY - (y1 - extents.minY) * scale,
    originX + (x2 - extents.minX) * scale,
    originY - (y2 - extents.minY) * scale,
  ];
  const pathOf = (lines: ReadonlyArray<Segment2>) =>
    pipe(
      lines,
      A.map(toSheet),
      A.map(([x1, y1, x2, y2]) => `M${r3(x1)} ${r3(y1)}L${r3(x2)} ${r3(y2)}`),
      A.join("")
    );
  const figurePath = pathOf(segments);
  const sheetLabel = `${input.sheet}/${input.sheets}`;
  const figLabel = `FIG. ${input.figure}`;
  const centred = (text: string, y: number) =>
    strokeLabel({
      text,
      x: (sight.left + sight.right) / 2 - labelWidthPt({ text, capHeightPt: cap }) / 2,
      y,
      capHeightPt: cap,
    });
  const labels = [...centred(sheetLabel, sight.top + cap), ...centred(figLabel, sight.bottom)];
  const labelPath = pipe(labels, A.map(polylinePath), A.join(""));
  const attrsFor = (width: number) =>
    `fill="none" stroke="#000000" stroke-width="${r3(width)}" stroke-linecap="round" stroke-linejoin="round"`;
  const attrs = attrsFor(stroke);
  // The shading layer is emitted only when present, so unshaded sheets stay
  // byte-identical to sheets composed before shading existed.
  const shadingLayer =
    A.length(input.shading) === 0
      ? []
      : [`<path id="shading" d="${pathOf(input.shading)}" ${attrsFor(options.shadingWeightMm * PT_PER_MM)}/>`];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(page.width)}pt" height="${r3(page.height)}pt" viewBox="0 0 ${r3(page.width)} ${r3(page.height)}">`,
    `<path id="labels" d="${labelPath}" ${attrs}/>`,
    ...shadingLayer,
    `<path id="figure" d="${figurePath}" ${attrs}/>`,
    "</svg>",
    "",
  ].join("\n");
};
