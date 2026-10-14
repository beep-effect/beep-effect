/**
 * Pure sheet composition: place one projected view on a 37 CFR 1.84 sheet as
 * a deterministic SVG with `n/N` and `FIG. n` labels.
 *
 * **Details**
 *
 * Without a label style, lettering is drawn from a small single-stroke glyph
 * table (digits, `F`, `I`, `G`, `.`, `/`). A label style switches a label to
 * the same stroke table at a point size, or to filled sans or serif outlines.
 * On the default `outline` route a sheet needs no font and embeds none.
 * Outlined labels are placed by the ink box of the glyph run: the sheet
 * number's ink top sits on the label line under the top margin, the `FIG. n`
 * ink bottom on the one over the bottom margin. A `text` label is an SVG
 * `<text>` element centred on the sight, its baseline where the outline
 * route would put it for the same face. Coordinates are rounded to three
 * decimals and segments keep the engine's canonical order, so equal geometry
 * yields byte-equal SVG.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Html, N, O } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import { SANS_FACE, SERIF_FACE } from "./internal/LabelGlyphs.ts";
import { alphabetSpan } from "./internal/LabelOutline.ts";
import {
  LabelRender,
  LabelTypeface,
  labelFontFamily,
  marginsCm,
  PT_PER_CM,
  PT_PER_MM,
  pageSizePt,
  SheetLabelFaces,
} from "./Sheet.schemas.ts";
import type { Segment2 } from "./Geometry.schemas.ts";
import type { InkBox, LabelFace } from "./internal/LabelOutline.ts";
import type { LabelStyle, SheetOptions } from "./Sheet.schemas.ts";

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

// How one label is lettered: the original stroke at `letterHeightCm`, the
// stroke table at a style's size, a filled outline face, or embedded text
// placed with a face's metrics.
type LabelLettering =
  | { readonly _tag: "legacy"; readonly cap: number }
  | { readonly _tag: "stroke"; readonly cap: number; readonly halfStroke: number }
  | { readonly _tag: "outline"; readonly face: LabelFace; readonly scale: number }
  | {
      readonly _tag: "text";
      readonly face: LabelFace;
      readonly scale: number;
      readonly family: string;
      readonly sizePt: number;
    };

const letteringOf = (
  style: O.Option<LabelStyle>,
  override: O.Option<LabelFace>,
  options: SheetOptions
): LabelLettering =>
  O.match(style, {
    onNone: (): LabelLettering => ({ _tag: "legacy", cap: options.letterHeightCm * PT_PER_CM }),
    onSome: (s): LabelLettering => {
      const outline = (vendored: LabelFace): LabelLettering => {
        const face = O.getOrElse(override, () => vendored);
        const scale = s.sizePt / face.unitsPerEm;
        return LabelRender.$match(s.render, {
          outline: (): LabelLettering => ({ _tag: "outline", face, scale }),
          text: (): LabelLettering => ({ _tag: "text", face, scale, family: labelFontFamily(s), sizePt: s.sizePt }),
        });
      };
      return LabelTypeface.$match(s.typeface, {
        stroke: (): LabelLettering => ({
          _tag: "stroke",
          cap: (s.sizePt * SANS_FACE.capHeight) / SANS_FACE.unitsPerEm,
          halfStroke: (options.lineWeightMm * PT_PER_MM) / 2,
        }),
        sans: () => outline(SANS_FACE),
        serif: () => outline(SERIF_FACE),
      });
    },
  });

const faceExtent = ({ face, scale }: { readonly face: LabelFace; readonly scale: number }): number => {
  const [low, high] = alphabetSpan(face);
  return (high - low) * scale;
};

// Height every label of a lettering fits in, whatever its digits: the band
// under the top margin (and over the bottom one) is twice this.
const letteringExtent = (lettering: LabelLettering): number =>
  Match.valueTags(lettering, {
    legacy: ({ cap }) => cap,
    stroke: ({ cap, halfStroke }) => cap + 2 * halfStroke,
    outline: faceExtent,
    text: faceExtent,
  });

const NO_FACES = SheetLabelFaces.make({});

const geometryOf = (options: SheetOptions, faces: SheetLabelFaces) => {
  const page = pageSizePt(options.format);
  const margins = marginsCm(options.margins);
  const safety = options.safetyMm * PT_PER_MM;
  const labelGap = O.getOrElse(options.labelGapMm, () => options.safetyMm) * PT_PER_MM;
  const cap = options.letterHeightCm * PT_PER_CM;
  const lettering = {
    sheetNumber: letteringOf(options.sheetNumberLabel, faces.sheetNumber, options),
    figure: letteringOf(options.figureLabel, faces.figure, options),
  };
  const sight = {
    left: margins.left * PT_PER_CM + safety,
    top: margins.top * PT_PER_CM + safety,
    right: page.width - margins.right * PT_PER_CM - safety,
    bottom: page.height - margins.bottom * PT_PER_CM - safety,
  };
  // Ink top of the sheet number and ink bottom of `FIG. n`.
  const labels = {
    top: margins.top * PT_PER_CM + labelGap,
    bottom: page.height - margins.bottom * PT_PER_CM - labelGap,
  };
  const figure = {
    left: sight.left,
    top: Math.max(sight.top, labels.top + letteringExtent(lettering.sheetNumber) * 2),
    right: sight.right,
    bottom: Math.min(sight.bottom, labels.bottom - letteringExtent(lettering.figure) * 2),
  };
  return { page, cap, sight, labels, lettering, figure } as const;
};

/**
 * Geometry of the sight (drawable area) of a sheet, in points, SVG y down.
 *
 * **Details**
 *
 * The sight is the page minus the margins of `options.margins` and the
 * safety gap. The sheet number's ink top sits `labelGapMm` below the top
 * margin and the `FIG. n` ink bottom `labelGapMm` above the bottom margin
 * (`labels`); without a label gap both sit at the safety gap. The figure area
 * is the sight minus the sheet-number band at the top and the `FIG. n` band
 * at the bottom; each band is twice the height its label style's alphabet
 * spans, so the figure area is the same on every sheet of a set.
 *
 * **Gotchas**
 *
 * A label style with a `fontFile`, or a `text` label, is measured here with
 * the vendored face of its typeface; {@link commonScale} and
 * {@link composeSheet} take the loaded faces through their `faces` input.
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
export const sheetGeometry = (options: SheetOptions) => geometryOf(options, NO_FACES);

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
  readonly faces?: SheetLabelFaces | undefined;
}): number => {
  const { views, options } = input;
  const { figure } = geometryOf(options, input.faces ?? NO_FACES);
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

// Ink box of a glyph run in font units, pen at 0, y up; blank glyphs add none.
const runInk = (face: LabelFace, text: string): InkBox => {
  const placed = A.reduce(A.fromIterable(text), { pen: 0, boxes: A.empty<InkBox>() }, (acc, char) => {
    const glyph = face.glyphs[char];
    return glyph === undefined
      ? acc
      : {
          pen: acc.pen + glyph.advance,
          boxes: A.isReadonlyArrayNonEmpty(glyph.commands)
            ? A.append(acc.boxes, [acc.pen + glyph.ink[0], glyph.ink[1], acc.pen + glyph.ink[2], glyph.ink[3]] as const)
            : acc.boxes,
        };
  });
  return A.isReadonlyArrayNonEmpty(placed.boxes)
    ? [
        Math.min(...A.map(placed.boxes, (b) => b[0])),
        Math.min(...A.map(placed.boxes, (b) => b[1])),
        Math.max(...A.map(placed.boxes, (b) => b[2])),
        Math.max(...A.map(placed.boxes, (b) => b[3])),
      ]
    : [0, 0, 0, 0];
};

// SVG path of a glyph run with its pen origin at (x, baseline), SVG y down.
const runPath = (input: {
  readonly face: LabelFace;
  readonly text: string;
  readonly scale: number;
  readonly x: number;
  readonly baseline: number;
}): string => {
  const { face, scale, x, baseline } = input;
  const at = (pen: number, gx: number, gy: number) => `${r3(x + (pen + gx) * scale)} ${r3(baseline - gy * scale)}`;
  return A.reduce(A.fromIterable(input.text), { pen: 0, d: "" }, (acc, char) => {
    const glyph = face.glyphs[char];
    if (glyph === undefined) {
      return acc;
    }
    const d = pipe(
      glyph.commands,
      A.map((c) =>
        c[0] === "Q"
          ? `Q${at(acc.pen, c[1], c[2])} ${at(acc.pen, c[3], c[4])}`
          : c[0] === "Z"
            ? "Z"
            : `${c[0]}${at(acc.pen, c[1], c[2])}`
      ),
      A.join("")
    );
    return { pen: acc.pen + glyph.advance, d: acc.d + d };
  }).d;
};

type LetteredLabel = {
  readonly strokes: ReadonlyArray<Polyline>;
  readonly fill: string;
  readonly text: string;
};

// Baseline that puts a glyph run's ink top (anchor "top") or ink bottom on `edge`.
const inkBaseline = (ink: InkBox, scale: number, edge: number, anchor: "top" | "bottom"): number =>
  anchor === "top" ? edge + ink[3] * scale : edge + ink[1] * scale;

// Letter one label centred at `centreX`, its ink edge on `edge`: the ink top
// for the sheet number (`anchor: "top"`), the ink bottom for `FIG. n`.
const letter = (input: {
  readonly lettering: LabelLettering;
  readonly text: string;
  readonly centreX: number;
  readonly edge: number;
  readonly anchor: "top" | "bottom";
}): LetteredLabel => {
  const { lettering, text, centreX, edge, anchor } = input;
  const stroked = (cap: number, baseline: number): LetteredLabel => ({
    strokes: strokeLabel({
      text,
      x: centreX - labelWidthPt({ text, capHeightPt: cap }) / 2,
      y: baseline,
      capHeightPt: cap,
    }),
    fill: "",
    text: "",
  });
  return Match.valueTags(lettering, {
    legacy: ({ cap }) => stroked(cap, anchor === "top" ? edge + cap : edge),
    stroke: ({ cap, halfStroke }) => stroked(cap, anchor === "top" ? edge + halfStroke + cap : edge - halfStroke),
    outline: ({ face, scale }): LetteredLabel => {
      const [xMin, yMin, xMax, yMax] = runInk(face, text);
      return {
        strokes: [],
        fill: runPath({
          face,
          text,
          scale,
          x: centreX - ((xMin + xMax) / 2) * scale,
          baseline: inkBaseline([xMin, yMin, xMax, yMax], scale, edge, anchor),
        }),
        text: "",
      };
    },
    // One user unit is one point, so `font-size` is the style's point size.
    text: ({ face, scale, family, sizePt }): LetteredLabel => ({
      strokes: [],
      fill: "",
      text: `<text x="${r3(centreX)}" y="${r3(inkBaseline(runInk(face, text), scale, edge, anchor))}" font-family="${Html.escapeHtml(family)}" font-size="${r3(sizePt)}" text-anchor="middle" fill="#000000">${Html.escapeHtml(text)}</text>`,
    }),
  });
};

/**
 * Compose one sheet.
 *
 * **Details**
 *
 * Stroke labels go in the stroked `labels` path; outlined labels go in one
 * filled `label-outlines` path; text labels are `<text>` elements after them.
 * A sheet without label styles is byte-equal to one composed before label
 * styles existed.
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
  readonly faces?: SheetLabelFaces | undefined;
}): string => {
  const { segments, scale, options } = input;
  const { page, sight, labels: anchors, lettering, figure } = geometryOf(options, input.faces ?? NO_FACES);
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
  const centreX = (sight.left + sight.right) / 2;
  const sheetNumber = letter({
    lettering: lettering.sheetNumber,
    text: `${input.sheet}/${input.sheets}`,
    centreX,
    edge: anchors.top,
    anchor: "top",
  });
  const figLabel = letter({
    lettering: lettering.figure,
    text: `FIG. ${input.figure}`,
    centreX,
    edge: anchors.bottom,
    anchor: "bottom",
  });
  const labels = [...sheetNumber.strokes, ...figLabel.strokes];
  const labelPath = pipe(labels, A.map(polylinePath), A.join(""));
  const outlinePath = sheetNumber.fill + figLabel.fill;
  const attrsFor = (width: number) =>
    `fill="none" stroke="#000000" stroke-width="${r3(width)}" stroke-linecap="round" stroke-linejoin="round"`;
  const attrs = attrsFor(stroke);
  // The shading layer is emitted only when present, so unshaded sheets stay
  // byte-identical to sheets composed before shading existed.
  const shadingLayer =
    A.length(input.shading) === 0
      ? []
      : [`<path id="shading" d="${pathOf(input.shading)}" ${attrsFor(options.shadingWeightMm * PT_PER_MM)}/>`];
  // Each label layer is emitted only when it has marks, so a sheet without
  // label styles keeps exactly the one stroked `labels` path it always had.
  const labelLayers = [
    ...(A.length(labels) === 0 ? [] : [`<path id="labels" d="${labelPath}" ${attrs}/>`]),
    ...(outlinePath === "" ? [] : [`<path id="label-outlines" d="${outlinePath}" fill="#000000" stroke="none"/>`]),
    ...A.filter([sheetNumber.text, figLabel.text], (element) => element !== ""),
  ];
  return pipe(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(page.width)}pt" height="${r3(page.height)}pt" viewBox="0 0 ${r3(page.width)} ${r3(page.height)}">`,
      ...labelLayers,
      ...shadingLayer,
      `<path id="figure" d="${figurePath}" ${attrs}/>`,
      "</svg>",
      "",
    ],
    A.join("\n")
  );
};
