import {
  BoundingBox,
  Box,
  Camera,
  cameraForView,
  composeSheet,
  DrawingError,
  drawnBrokenGapMm,
  EdgeSet,
  EngineInfo,
  FigureRecord,
  FigureSet,
  GeometryEngine,
  InkBounds,
  LabelStyle,
  LabelTypeface,
  labelCapHeightCm,
  labelFontFamily,
  labelTextFindings,
  ModelSpec,
  ModelSummary,
  marginFindings,
  marginsCm,
  mirrorSegments,
  PageMetrics,
  Part,
  PdfBackend,
  PdfFacts,
  PdfFontFact,
  PdfPageSize,
  PT_PER_MM,
  purityFindings,
  RenderManifest,
  RenderRequest,
  ShadingCoverage,
  ShadingSkip,
  SheetFonts,
  SheetMargins,
  SheetOptions,
  sameSegments,
  sheetGeometry,
  structuralFindings,
  ValidationOptions,
} from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, vi } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ShadingPlan } from "@beep/technical-drawing";

// A fake engine: every view projects a unit square, except that the "rear"
// camera (eye +Y) projects the square shifted, so omission proofs can fail.
const RenderManifestJson = S.fromJsonString(RenderManifest);

const square: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 10, 0],
  [0, 0, 0, 5],
  [0, 5, 10, 5],
  [10, 0, 10, 5],
];
const shifted = A.map(square, ([a, b, c, d]) => [a + 1, b, c + 1, d] as const);

// `plans` collects every shading plan the engine is asked for, per layer.
const fakeEngineWith = (plans: Array<ShadingPlan>) =>
  Layer.succeed(
    GeometryEngine,
    GeometryEngine.of({
      info: Effect.succeed(EngineInfo.make({ name: "fake", version: "0", binarySha256: "" })),
      // a model with more than one part reports one overlapping pair
      summarize: Effect.fnUntraced(function* (model) {
        return ModelSummary.make({
          boundingBox: BoundingBox.make({ min: [0, 0, 0], max: [10, 5, 5] }),
          volume: 250,
          faceCount: 6,
          edgeCount: 12,
          partOverlaps: A.length(model.parts) > 1 ? 1 : 0,
        });
      }),
      project: Effect.fnUntraced(function* (model, cameras, shading) {
        // uniform shading carries one diagonal hatch line per view that starts on the
        // outline (uniform strokes end on the face edge by design, and only graded
        // output is held to the outline checks); graded shading two lines a hair
        // apart, which the spacing rule must flag; a model with a broken-line part
        // carries one broken segment per view
        O.map(shading, (plan) => plans.push(plan));
        const hatch = O.match(shading, {
          onNone: () => [],
          onSome: (plan) =>
            plan.style === "graded"
              ? [[1, 1, 9, 1] as const, [1, 1.01, 9, 1.01] as const]
              : [[0.2, 0.2, 4, 4] as const],
        });
        const coverage = O.map(shading, () =>
          ShadingCoverage.make({
            shadedFaces: 1,
            skippedFaces: [ShadingSkip.make({ reason: "back-facing", faces: 5 })],
          })
        );
        const broken = A.some(model.parts, (part) => part.lineStyle === "broken") ? [[2, 1, 8, 1] as const] : [];
        return A.map(cameras, (camera) =>
          EdgeSet.make({
            visible: camera.eye[1] > 0 ? shifted : square,
            hidden: [],
            shading: hatch,
            shadingCoverage: coverage,
            broken,
          })
        );
      }),
    })
  );

const fakeEngine = fakeEngineWith([]);

const letter = PdfPageSize.make({ widthPt: 612, heightPt: 792 });
const cleanMetrics = (dpi: number, antiAliased: boolean) =>
  PageMetrics.make({
    width: Math.round(8.5 * dpi),
    height: Math.round(11 * dpi),
    dpi,
    antiAliased,
    inkBounds: O.some(
      InkBounds.make({
        minX: Math.round(1.1 * dpi),
        minY: Math.round(1.1 * dpi),
        maxX: Math.round(7.5 * dpi),
        maxY: Math.round(10 * dpi),
      })
    ),
    inkPixels: 100,
    impurePixels: 0,
    largestBlackSquare: 4,
  });

// the fake backend writes the fonts it was given as JSON, and a test reads them back
const encodeSheetFonts = S.encodeEffect(S.fromJsonString(SheetFonts));
const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown));

const fakeBackend = Layer.effect(
  PdfBackend,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return PdfBackend.of({
      svgToPdf: Effect.fnUntraced(function* (svgPaths, outputPath, fonts) {
        yield* fs.writeFileString(outputPath, `%PDF-1.6 fake ${A.length(svgPaths)} pages`);
        // the pinned fonts land beside the fake PDF, so a test can read what the backend was given
        if (O.isSome(fonts)) {
          yield* fs.writeFileString(`${outputPath}.fonts.json`, yield* encodeSheetFonts(fonts.value));
        }
      }, Effect.orDie),
      inspect: Effect.fnUntraced(function* (pdfPath) {
        const contents = yield* fs.readFileString(pdfPath);
        const pageCount = pipe(
          contents,
          Str.match(/fake (\d+) pages$/),
          O.flatMap(A.get(1)),
          O.flatMap(Num.parse),
          O.getOrElse(() => 0)
        );
        return PdfFacts.make({
          headerVersion: "1.6",
          // `A.makeBy(0, f)` still yields one element, so the empty case is explicit
          pages: pageCount === 0 ? [] : A.makeBy(pageCount, () => letter),
          fonts: [],
          annotationCount: 0,
          hasOptionalContent: false,
          encrypted: false,
        });
      }, Effect.orDie),
      measurePage: Effect.fnUntraced(function* ({ dpi, antiAlias }) {
        return cleanMetrics(dpi, antiAlias);
      }),
      pageText: Effect.fnUntraced(function* () {
        return "";
      }),
    });
  })
);

const body = { name: "body", add: [{ kind: "box", min: [0, 0, 0], max: [10, 5, 5] }] };

const spec = (
  figures: ReadonlyArray<{ view: string; description: string; projection?: string }>,
  omissions: ReadonlyArray<unknown> = [],
  extra: Readonly<Record<string, unknown>> = {},
  part: Readonly<Record<string, unknown>> = body,
  moreParts: ReadonlyArray<Readonly<Record<string, unknown>>> = []
) =>
  JSON.stringify({
    ...extra,
    title: "Synthetic block",
    model: { parts: [part, ...moreParts] },
    figures,
    omissions,
  });

// A label-alphabet font built in-test with opentype.js (the package's own parser), so the
// operator fontFile route runs on every runner without a committed font: each inked
// glyph is a 400 x 700 box on a 1000-unit em, the space is blank.
const OPENTYPE_MODULE = ["opentype", "js"].join(".");
interface OpenTypeBuilder {
  readonly Font: new (options: Readonly<Record<string, unknown>>) => { toArrayBuffer(): ArrayBuffer };
  readonly Glyph: new (options: Readonly<Record<string, unknown>>) => unknown;
  readonly Path: new () => {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
  };
}
const makeLabelAlphabetFont = Effect.fnUntraced(function* (alphabet: string) {
  const module: { readonly default?: OpenTypeBuilder } & Partial<OpenTypeBuilder> = yield* Effect.promise(
    () => import(OPENTYPE_MODULE)
  );
  const opentype: OpenTypeBuilder = module.Font === undefined ? module.default! : (module as OpenTypeBuilder);
  const glyph = (char: string) => {
    const outline = new opentype.Path();
    if (char !== " ") {
      outline.moveTo(50, 0);
      outline.lineTo(450, 0);
      outline.lineTo(450, 700);
      outline.lineTo(50, 700);
      outline.close();
    }
    return new opentype.Glyph({
      name: `u${char.charCodeAt(0)}`,
      unicode: char.charCodeAt(0),
      advanceWidth: 500,
      path: outline,
    });
  };
  const notdef = new opentype.Glyph({ name: ".notdef", advanceWidth: 500, path: new opentype.Path() });
  const font = new opentype.Font({
    familyName: "Label Boxes",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: [notdef, ...A.map(A.fromIterable(alphabet), glyph)],
  });
  return new Uint8Array(font.toArrayBuffer());
});
const labelAlphabetFont = makeLabelAlphabetFont("0123456789FIG./ ");

const makeLayer = () =>
  FigureSet.layer.pipe(Layer.provide(Layer.merge(fakeEngine, fakeBackend)), Layer.provideMerge(NodeServices.layer));

// Outline path helpers for the label tests: exact ink extrema of an SVG path
// made of M/L/Q/Z, and the largest all-ink square of its nonzero fill.
type Pt = readonly [number, number];
const pathPieces = (d: string): ReadonlyArray<ReadonlyArray<Pt>> => {
  const tokens = d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const pieces: Array<Array<Pt>> = [];
  let at: Pt = [0, 0];
  let start: Pt = [0, 0];
  let i = 0;
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "M") {
      at = [next(), next()];
      start = at;
    } else if (command === "L") {
      const to: Pt = [next(), next()];
      pieces.push([at, to]);
      at = to;
    } else if (command === "Q") {
      const control: Pt = [next(), next()];
      const to: Pt = [next(), next()];
      pieces.push([at, control, to]);
      at = to;
    } else {
      pieces.push([at, start]);
      at = start;
    }
  }
  return pieces;
};
const quadAt = (p: ReadonlyArray<Pt>, t: number): Pt => [
  (1 - t) * (1 - t) * p[0]![0] + 2 * (1 - t) * t * p[1]![0] + t * t * p[2]![0],
  (1 - t) * (1 - t) * p[0]![1] + 2 * (1 - t) * t * p[1]![1] + t * t * p[2]![1],
];
const flatten = (d: string): ReadonlyArray<readonly [Pt, Pt]> =>
  A.flatMap(pathPieces(d), (piece) =>
    piece.length === 2
      ? [[piece[0]!, piece[1]!] as const]
      : A.map(A.range(0, 31), (k) => [quadAt(piece, k / 32), quadAt(piece, (k + 1) / 32)] as const)
  );
const inkBox = (d: string, keep: (piece: ReadonlyArray<Pt>) => boolean = () => true) => {
  const kept: ReadonlyArray<ReadonlyArray<Pt>> = A.filter(pathPieces(d), (piece: ReadonlyArray<Pt>) => keep(piece));
  const points = A.flatMap(
    kept,
    (piece): ReadonlyArray<Pt> => (piece.length === 2 ? piece : A.map(A.range(0, 2000), (k) => quadAt(piece, k / 2000)))
  );
  // Reduce instead of spreading: a label's sampled outline has hundreds of
  // thousands of points, more than one call can take as arguments.
  return A.reduce(
    points,
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
    (box, p) => ({
      minX: Math.min(box.minX, p[0]),
      minY: Math.min(box.minY, p[1]),
      maxX: Math.max(box.maxX, p[0]),
      maxY: Math.max(box.maxY, p[1]),
    })
  );
};
// Largest all-ink square (in points) of the nonzero fill, sampled every `step` points.
type Crossing = readonly [number, number];
// Where the outline edges cross the scanline `y`, sorted by x, with the winding direction.
const rowCrossings = (edges: ReadonlyArray<readonly [Pt, Pt]>, y: number): ReadonlyArray<Crossing> =>
  A.sort(
    A.flatMap(
      edges,
      ([[x0, y0], [x1, y1]]): ReadonlyArray<Crossing> =>
        (y0 <= y && y1 > y) || (y1 <= y && y0 > y)
          ? [[x0 + ((y - y0) / (y1 - y0)) * (x1 - x0), y1 > y0 ? 1 : -1] as const]
          : []
    ),
    (a: Crossing, b: Crossing) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
  );
// Nonzero-winding ink test for each sampled column of one scanline.
const rowInk = (
  crossings: ReadonlyArray<Crossing>,
  minX: number,
  cols: number,
  step: number
): ReadonlyArray<boolean> => {
  let winding = 0;
  let k = 0;
  return A.makeBy(cols, (c) => {
    const x = minX + (c + 0.5) * step;
    while (k < crossings.length && crossings[k]![0] <= x) {
      winding += crossings[k]![1];
      k++;
    }
    return winding !== 0;
  });
};
// Dynamic-programming square sizes for one row given the previous row's sizes.
const rowSquares = (ink: ReadonlyArray<boolean>, previous: ReadonlyArray<number>): ReadonlyArray<number> => {
  const current: Array<number> = [];
  for (let c = 0; c < ink.length; c++) {
    current[c] = ink[c] === true ? 1 + Math.min(previous[c] ?? 0, current[c - 1] ?? 0, previous[c - 1] ?? 0) : 0;
  }
  return current;
};
const largestInkSquarePt = (d: string, step: number): number => {
  const edges = flatten(d);
  const box = inkBox(d);
  const cols = Math.ceil((box.maxX - box.minX) / step) + 1;
  const rows = Math.ceil((box.maxY - box.minY) / step) + 1;
  let previous: ReadonlyArray<number> = A.makeBy(cols, () => 0);
  let best = 0;
  for (let r = 0; r < rows; r++) {
    const y = box.minY + (r + 0.5) * step;
    const current = rowSquares(rowInk(rowCrossings(edges, y), box.minX, cols, step), previous);
    best = Math.max(
      best,
      A.reduce(current, 0, (acc, size) => Math.max(acc, size))
    );
    previous = current;
  }
  return best * step;
};
const outlinesOf = (svg: string): string => /<path id="label-outlines" d="([^"]*)"/.exec(svg)?.[1] ?? "";
const sha256Hex = (text: string) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).pipe(
    Effect.map((digest) =>
      A.join(
        A.map(A.fromIterable(new Uint8Array(digest)), (b) => b.toString(16).padStart(2, "0")),
        ""
      )
    )
  );
const styled = SheetOptions.make({
  margins: "cfr-strict",
  labelGapMm: O.some(1),
  sheetNumberLabel: O.some(LabelStyle.make({ typeface: "sans", sizePt: 18 })),
  figureLabel: O.some(LabelStyle.make({ typeface: "serif", sizePt: 24 })),
});
const composeStyled = (n: number, options: SheetOptions = styled) =>
  composeSheet({ segments: square, shading: [], figure: n, sheet: n, sheets: 8, scale: 20, options });

describe("@beep/technical-drawing", () => {
  describe("pure sheet and rule helpers", () => {
    it.effect(
      "composeSheet is deterministic and keeps every mark inside the sight",
      Effect.fnUntraced(function* () {
        const options = SheetOptions.make({});
        const a = composeSheet({ segments: square, shading: [], figure: 3, sheet: 3, sheets: 8, scale: 20, options });
        const b = composeSheet({ segments: square, shading: [], figure: 3, sheet: 3, sheets: 8, scale: 20, options });
        expect(a).toBe(b);
        expect(a).toContain('width="612.000pt"');
        const coords = A.map(
          [...a.matchAll(/[ML](-?\d+\.\d+) (-?\d+\.\d+)/g)],
          (m) => [Number(m[1]), Number(m[2])] as const
        );
        expect(A.length(coords)).toBeGreaterThan(20);
        for (const [x, y] of coords) {
          expect(x).toBeGreaterThanOrEqual(2.5 * 28.3464);
          expect(x).toBeLessThanOrEqual(612 - 1.5 * 28.3464);
          expect(y).toBeGreaterThanOrEqual(2.5 * 28.3464);
          expect(y).toBeLessThanOrEqual(792 - 1.0 * 28.3464);
        }
      })
    );

    it.effect(
      "composeSheet adds a dashed broken layer only when broken lines exist",
      Effect.fnUntraced(function* () {
        const options = SheetOptions.make({});
        const base = { segments: square, figure: 1, sheet: 1, sheets: 1, scale: 20, options } as const;
        const plain = composeSheet({ ...base, shading: [] });
        // an empty broken layer leaves the sheet byte-identical
        expect(composeSheet({ ...base, shading: [], broken: [] })).toBe(plain);
        expect(plain).not.toContain('id="broken"');
        expect(plain).not.toContain("stroke-dasharray");
        const withBroken = composeSheet({ ...base, shading: [[1, 1, 4, 4]], broken: [[2, 1, 8, 1]] });
        // 3 mm dashes, 1.5 mm gaps, the outline weight, between shading and figure
        expect(withBroken).toContain(
          'stroke-width="0.992" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8.504 4.252"/>'
        );
        const order = A.map(['id="labels"', 'id="shading"', 'id="broken"', 'id="figure"'], (id) =>
          withBroken.indexOf(id)
        );
        expect(order).toEqual(A.sort(order, Order.Number));
        expect(A.every(order, (index) => index > 0)).toBe(true);
        const custom = composeSheet({
          ...base,
          shading: [],
          broken: [[2, 1, 8, 1]],
          options: SheetOptions.make({ brokenDashMm: 2, brokenGapMm: 1 }),
        });
        expect(custom).toContain('stroke-dasharray="5.669 2.835"');
        // broken lines inside the outline do not move it; outside it they re-centre the view
        const figureOf = (svg: string) => svg.slice(svg.indexOf('<path id="figure"'));
        expect(figureOf(withBroken)).toBe(figureOf(plain));
        expect(figureOf(composeSheet({ ...base, shading: [], broken: [[-10, 0, 0, 0]] }))).not.toBe(figureOf(plain));
        expect(SheetOptions.make({}).brokenGapMm).toBe(1.5);
        expect(() => SheetOptions.make({ brokenDashMm: 0.5 })).toThrow();
        expect(() => SheetOptions.make({ brokenGapMm: 0.5 })).toThrow();
        // round caps eat the line weight: a heavy stroke would close a gap that is valid on its own, so the
        // drawn gap widens at emit time; the options themselves stay usable on a solid-only sheet
        expect(SheetOptions.make({ lineWeightMm: 1.2 }).brokenGapMm).toBe(1.5);
        expect(drawnBrokenGapMm(SheetOptions.make({ lineWeightMm: 0.8, brokenGapMm: 0.75 }))).toBeCloseTo(1.2, 9);
        expect(drawnBrokenGapMm(SheetOptions.make({ lineWeightMm: 0.8, brokenGapMm: 1.2 }))).toBe(1.2);
        const widened = composeSheet({
          ...base,
          shading: [],
          broken: [[2, 1, 8, 1]],
          options: SheetOptions.make({ brokenDashMm: 2, brokenGapMm: 0.75, lineWeightMm: 0.8 }),
        });
        expect(widened).toContain('stroke-dasharray="5.669 3.402"');
      })
    );

    it.effect(
      "segment comparison is order- and direction-insensitive; mirroring is about the view centre",
      Effect.fnUntraced(function* () {
        expect(
          sameSegments({ left: square, right: A.reverse(A.map(square, ([a, b, c, d]) => [c, d, a, b] as const)) })
        ).toBe(true);
        expect(sameSegments({ left: square, right: shifted })).toBe(false);
        expect(sameSegments({ left: mirrorSegments(square), right: square })).toBe(true);
        expect(
          sameSegments({
            left: mirrorSegments([
              [0, 0, 4, 0],
              [4, 0, 4, 2],
            ]),
            right: [
              [0, 0, 4, 0],
              [0, 0, 0, 2],
            ],
          })
        ).toBe(true);
      })
    );

    it.effect(
      "cameras: elevations are orthographic, perspectives carry a focus scaled to the box",
      Effect.fnUntraced(function* () {
        const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
        expect(cameraForView({ view: "front", box })).toEqual(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }));
        const persp = cameraForView({ view: "bottom-perspective", box });
        expect(persp.eye[2]).toBeLessThan(0);
        expect(persp.target).toEqual([20, 15, 10]);
        assertSome(
          O.map(persp.focus, (f) => Math.round(f)),
          Math.round(2.5 * Math.hypot(40, 30, 20))
        );
      })
    );

    it.effect(
      "cameras: the default perspective keeps the original eye, bit for bit",
      Effect.fnUntraced(function* () {
        const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
        const focus = O.some(Math.max(Math.hypot(40, 30, 20) * 2.5, 1));
        expect(cameraForView({ view: "top-perspective", box })).toEqual(
          Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [20, 15, 10], focus })
        );
        expect(cameraForView({ view: "bottom-perspective", box, projection: "perspective" })).toEqual(
          Camera.make({ eye: [-1, -1.2, -0.85], up: [0, 0, 1], target: [20, 15, 10], focus })
        );
        // a set azimuth swings the eye about +Z, keeping its reach and height
        const swung = cameraForView({ view: "top-perspective", box, azimuthDeg: O.some(90) });
        expect(swung.eye[0]).toBeCloseTo(-Math.hypot(1, 1.2), 12);
        expect(swung.eye[1]).toBeCloseTo(0, 12);
        expect(swung.eye[2]).toBe(0.85);
      })
    );

    it.effect(
      "cameras: an isometric pictorial has no focus, up +Z, and the isometric elevation",
      Effect.fnUntraced(function* () {
        const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
        const top = cameraForView({ view: "top-perspective", box, projection: "isometric", azimuthDeg: O.some(30) });
        const bottom = cameraForView({
          view: "bottom-perspective",
          box,
          projection: "isometric",
          azimuthDeg: O.some(30),
        });
        assertNone(top.focus);
        assertNone(bottom.focus);
        expect(top.up).toEqual([0, 0, 1]);
        const el = Math.atan(1 / Math.SQRT2);
        expect(top.eye[0]).toBeCloseTo(-Math.sin(Math.PI / 6) * Math.cos(el), 12);
        expect(top.eye[1]).toBeCloseTo(-Math.cos(Math.PI / 6) * Math.cos(el), 12);
        expect(top.eye[2]).toBeCloseTo(Math.sin(el), 12);
        expect(bottom.eye[2]).toBeCloseTo(-Math.sin(el), 12);
        // 35.264° above the horizon
        expect((Math.asin(top.eye[2] / Math.hypot(...top.eye)) * 180) / Math.PI).toBeCloseTo(35.264, 3);
        // without an azimuth the isometric eye looks along 45°, so the model's X, Y and Z foreshorten equally
        const iso = cameraForView({ view: "top-perspective", box, projection: "isometric" });
        expect(iso.eye[0]).toBeCloseTo(iso.eye[1], 12);
        expect(Math.abs(iso.eye[0])).toBeCloseTo(Math.abs(iso.eye[2]), 12);
      })
    );

    it.effect(
      "cameras: both plans share the up vector planFacing sets, front by default",
      Effect.fnUntraced(function* () {
        const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
        expect(cameraForView({ view: "top-plan", box })).toEqual(Camera.make({ eye: [0, 0, 1], up: [0, 1, 0] }));
        expect(cameraForView({ view: "bottom-plan", box })).toEqual(Camera.make({ eye: [0, 0, -1], up: [0, 1, 0] }));
        const top = cameraForView({ view: "top-plan", box, planFacing: "left" });
        const bottom = cameraForView({ view: "bottom-plan", box, planFacing: "left" });
        expect(top.up).toEqual([1, 0, 0]);
        expect(bottom.up).toEqual(top.up);
        expect(cameraForView({ view: "top-plan", box, planFacing: "rear" }).up).toEqual([0, -1, 0]);
        // elevations ignore the plan facing
        expect(cameraForView({ view: "left", box, planFacing: "right" })).toEqual(
          Camera.make({ eye: [-1, 0, 0], up: [0, 0, 1] })
        );
      })
    );

    it.effect(
      "sheet geometry: cfr-strict takes the larger of the cm and inch margins; the label gap moves the labels",
      Effect.fnUntraced(function* () {
        expect(marginsCm("cfr-cm")).toEqual(SheetMargins.make({ top: 2.5, left: 2.5, right: 1.5, bottom: 1 }));
        const strict = marginsCm("cfr-strict");
        expect([strict.top, strict.left, strict.bottom]).toEqual([2.54, 2.54, 1]);
        expect(strict.right).toBeCloseTo(1.5875, 12);
        const g = sheetGeometry(SheetOptions.make({ margins: "cfr-strict", safetyMm: 0 }));
        expect(g.sight.left).toBeCloseTo(72, 9);
        expect(g.sight.top).toBeCloseTo(72, 9);
        expect(g.sight.right).toBeCloseTo(612 - 45, 9);
        expect(g.sight.bottom).toBeCloseTo(792 - 72 / 2.54, 9);
        // default: the labels sit at the safety gap, exactly where they always did
        const d = sheetGeometry(SheetOptions.make({}));
        expect(d.labels.top).toBe(d.sight.top);
        expect(d.labels.bottom).toBe(d.sight.bottom);
        expect(d.figure.top).toBe(d.sight.top + 2 * d.cap);
        const gap = sheetGeometry(SheetOptions.make({ margins: "cfr-strict", labelGapMm: O.some(1) }));
        expect(gap.labels.top).toBeCloseTo(72 + 72 / 25.4, 9);
        expect(gap.figure.top).toBeGreaterThanOrEqual(gap.sight.top);
        const svg = composeSheet({
          segments: square,
          shading: [],
          figure: 1,
          sheet: 1,
          sheets: 8,
          scale: 20,
          options: SheetOptions.make({ margins: "cfr-strict", labelGapMm: O.some(1) }),
        });
        const ys = A.map([...svg.matchAll(/[ML](-?\d+\.\d+) (-?\d+\.\d+)/g)], (m) => Number(m[2]));
        expect(Math.min(...ys)).toBeCloseTo(72 + 72 / 25.4, 2);
        expect(Math.max(...ys)).toBeCloseTo(792 - 72 / 2.54 - 72 / 25.4, 2);
      })
    );

    it.effect(
      "outlined labels: one filled path, byte-stable, and no stroked label path",
      Effect.fnUntraced(function* () {
        const svg = composeStyled(3);
        expect(svg).toBe(composeStyled(3));
        expect(svg).toContain('<path id="label-outlines" d="M');
        expect(svg).toContain('fill="#000000" stroke="none"/>');
        expect(svg).not.toContain('<path id="labels"');
        expect(yield* sha256Hex(svg)).toBe("dcfb8611b16781c15f0caf34506a913c44d795e88ce09fc01e6a33bb2b1f6112");
        // without label styles the sheet keeps its single stroked label path
        const plain = composeStyled(3, SheetOptions.make({}));
        expect(plain).toContain('<path id="labels" d="M');
        expect(plain).not.toContain("label-outlines");
      })
    );

    it.effect(
      "outlined labels sit by their ink box on every sheet: number below the top margin, FIG above the bottom",
      Effect.fnUntraced(function* () {
        const g = sheetGeometry(styled);
        const centreX = (g.sight.left + g.sight.right) / 2;
        for (const n of A.range(1, 8)) {
          const svg = composeStyled(n);
          const d = outlinesOf(svg);
          expect(d.length).toBeGreaterThan(0);
          const ink = inkBox(d);
          // "n/8": the slash rises above the cap height, and the ink top still lands on the label line
          expect(Math.abs(ink.minY - g.labels.top)).toBeLessThan(0.01);
          expect(Math.abs(ink.maxY - g.labels.bottom)).toBeLessThan(0.01);
          // the sheet number is centred between the side margins
          const top = inkBox(d, (piece) => piece[0]![1] < g.page.height / 2);
          expect(Math.abs((top.minX + top.maxX) / 2 - centreX)).toBeLessThan(0.01);
          // the figure area keeps clear of both labels
          expect(g.figure.top).toBeGreaterThan(ink.minY + 18 * 0.7);
          expect(g.figure.bottom).toBeLessThan(ink.maxY - 24 * 0.6);
        }
      })
    );

    it.effect(
      "a label style needs a 0.32 cm cap height; only outlined faces take an absolute font file",
      Effect.fnUntraced(function* () {
        const decode = S.decodeUnknownEffect(LabelStyle);
        expect(labelCapHeightCm({ typeface: "sans", sizePt: 18 })).toBeCloseTo(0.437, 3);
        expect(labelCapHeightCm({ typeface: "serif", sizePt: 24 })).toBeCloseTo(0.554, 3);
        yield* decode({ typeface: "sans", sizePt: 18, fontFile: "/fonts/arial.ttf" });
        yield* Effect.flip(decode({ typeface: "sans", sizePt: 12 }));
        yield* Effect.flip(decode({ typeface: "serif", sizePt: 13 }));
        yield* Effect.flip(decode({ typeface: "stroke", sizePt: 18, fontFile: "/fonts/arial.ttf" }));
        yield* Effect.flip(decode({ typeface: "sans", sizePt: 18, fontFile: "fonts/arial.ttf" }));
      })
    );

    it.effect(
      "a text label needs an outlined typeface, takes no font file, and defaults to the metric family",
      Effect.fnUntraced(function* () {
        const decode = S.decodeUnknownEffect(LabelStyle);
        const sans = yield* decode({ typeface: "sans", sizePt: 18, render: "text" });
        expect(labelFontFamily(sans)).toBe("Arial");
        expect(labelFontFamily(yield* decode({ typeface: "stroke", sizePt: 18 }))).toBe("Times New Roman");
        expect(labelFontFamily(yield* decode({ typeface: "serif", sizePt: 24, render: "text" }))).toBe(
          "Times New Roman"
        );
        expect(
          labelFontFamily(
            yield* decode({ typeface: "sans", sizePt: 18, render: "text", fontFamily: "Liberation Sans" })
          )
        ).toBe("Liberation Sans");
        expect(LabelStyle.make({ typeface: "sans", sizePt: 18 }).render).toBe("outline");
        yield* Effect.flip(decode({ typeface: "stroke", sizePt: 18, render: "text" }));
        yield* Effect.flip(decode({ typeface: "sans", sizePt: 18, render: "text", fontFile: "/fonts/arial.ttf" }));
        yield* Effect.flip(decode({ typeface: "sans", sizePt: 18, fontFamily: "Arial" }));
        yield* Effect.flip(S.decodeEffect(SheetOptions)({ fontDirectory: "fonts" }));
      })
    );

    it.effect(
      "text labels are <text> elements in the requested family and point size, where the outlines would sit",
      Effect.fnUntraced(function* () {
        const text = SheetOptions.make({
          ...styled,
          sheetNumberLabel: O.some(LabelStyle.make({ typeface: "sans", sizePt: 18, render: "text" })),
          figureLabel: O.some(LabelStyle.make({ typeface: "serif", sizePt: 24, render: "text" })),
        });
        const g = sheetGeometry(text);
        const centreX = (g.sight.left + g.sight.right) / 2;
        const svg = composeStyled(1, text);
        expect(outlinesOf(svg)).toBe("");
        expect(svg).not.toContain('id="labels"');
        const elements = A.fromIterable(
          svg.matchAll(
            /<text x="([\d.]+)" y="([\d.]+)" font-family="([^"]+)" font-size="([\d.]+)" text-anchor="middle" fill="#000000">([^<]+)<\/text>/g
          )
        );
        expect(A.map(elements, (m) => [m[3], m[4], m[5]])).toEqual([
          ["Arial", "18.000", "1/8"],
          ["Times New Roman", "24.000", "FIG. 1"],
        ]);
        for (const m of elements) {
          expect(Number(m[1])).toBeCloseTo(centreX, 3);
        }
        // Baselines: the sheet number's ink top (about one cap height above its baseline)
        // on the top label line, the FIG. ink bottom (the baseline) on the bottom one.
        const [top, bottom] = A.map(elements, (m) => Number(m[2]));
        expect(top! - g.labels.top).toBeGreaterThan(18 * 0.6);
        expect(top! - g.labels.top).toBeLessThan(18 * 0.8);
        expect(Math.abs(bottom! - g.labels.bottom)).toBeLessThan(0.5);
        // the figure area is the outline route's: the bands measure the same face
        expect(sheetGeometry(text).figure).toEqual(sheetGeometry(styled).figure);
      })
    );

    it.effect(
      "text rules: each page's text must carry its labels, and embedded fonts must be label families",
      Effect.fnUntraced(function* () {
        const options = ValidationOptions.make({
          expectedPages: O.none(),
          textLabels: ["figure", "sheet-number"],
          expectedLabelFonts: ["Times New Roman", "Arial"],
        });
        expect(labelTextFindings({ page: 1, pages: 8, text: "1/8\n\nFIG. 1\n\f", options })).toEqual([]);
        // FIG. 10 does not carry FIG. 1; 11/8 does not carry 1/8
        expect(
          A.map(labelTextFindings({ page: 1, pages: 8, text: "11/8\nFIG. 10\n", options }), (f) => [f.code, f.page])
        ).toEqual([
          ["label-missing", O.some(1)],
          ["label-missing", O.some(1)],
        ]);
        expect(
          labelTextFindings({
            page: 2,
            pages: 8,
            text: "",
            options: ValidationOptions.make({ expectedPages: O.none() }),
          })
        ).toEqual([]);
        const facts = PdfFacts.make({
          headerVersion: "1.6",
          pages: [letter],
          fonts: [
            PdfFontFact.make({ name: "QWERTY+ArialMT", embedded: true }),
            PdfFontFact.make({ name: "ASDFGH+TimesNewRomanPSMT", embedded: true }),
            PdfFontFact.make({ name: "ZXCVBN+LiberationSans", embedded: true }),
          ],
          annotationCount: 0,
          hasOptionalContent: false,
          encrypted: false,
        });
        expect(PdfFontFact.make({ name: "ZXCVBN+LiberationSans", embedded: true }).baseName).toBe("LiberationSans");
        const findings = structuralFindings({ facts, options });
        expect(A.map(findings, (f) => f.code)).toEqual(["font-unexpected"]);
        expect(findings[0]?.message).toContain("LiberationSans");
        expect(structuralFindings({ facts, options: ValidationOptions.make({ expectedPages: O.none() }) })).toEqual([]);
      })
    );

    it.effect.prop(
      "property: a label style decodes exactly when its cap height reaches 0.32 cm",
      [LabelTypeface, S.Finite.check(S.isBetween({ minimum: 1, maximum: 40 }))],
      ([typeface, sizePt]) =>
        Effect.gen(function* () {
          const decoded = yield* Effect.isSuccess(S.decodeEffect(LabelStyle)({ typeface, sizePt }));
          expect(decoded).toBe(labelCapHeightCm({ typeface, sizePt }) >= 0.32);
        }),
      { arbitrary: { runs: 200 } }
    );

    it.effect(
      "outlined label stems stay under the 1.5 mm solid-black limit",
      Effect.fnUntraced(function* () {
        // Measured: 0.84 mm on every sheet at this 0.04 mm sampling (0.86 mm at 0.02 mm), serif 24 pt and sans 18 pt.
        const step = 0.04 * (72 / 25.4);
        for (const n of A.range(1, 8)) {
          const squareMm = (largestInkSquarePt(outlinesOf(composeStyled(n)), step) * 25.4) / 72;
          expect(squareMm).toBeLessThan(1.5);
        }
      })
    );

    it.effect(
      "structural rules flag version, encryption, layers, annotations, fonts, page count, sizes",
      Effect.fnUntraced(function* () {
        const facts = PdfFacts.make({
          headerVersion: "1.7",
          pages: [
            letter,
            PdfPageSize.make({ widthPt: 595.3, heightPt: 841.9 }),
            PdfPageSize.make({ widthPt: 500, heightPt: 500 }),
          ],
          fonts: [
            PdfFontFact.make({ name: "Helvetica", embedded: false }),
            PdfFontFact.make({ name: "ABCDEF+Foo", embedded: true }),
          ],
          annotationCount: 2,
          hasOptionalContent: true,
          encrypted: true,
        });
        const codes = A.map(
          structuralFindings({ facts, options: ValidationOptions.make({ expectedPages: O.some(8) }) }),
          (f) => f.code
        );
        expect(codes).toEqual([
          "pdf-version",
          "encrypted",
          "optional-content",
          "annotations",
          "font-not-embedded",
          "page-count",
          "page-size",
          "page-size-mixed",
        ]);
        const clean = PdfFacts.make({
          headerVersion: "1.6",
          pages: [letter],
          fonts: [],
          annotationCount: 0,
          hasOptionalContent: false,
          encrypted: false,
        });
        expect(
          structuralFindings({ facts: clean, options: ValidationOptions.make({ expectedPages: O.some(1) }) })
        ).toEqual([]);
      })
    );

    it.effect(
      "raster rules flag margins, blank pages, impurity, and solid black",
      Effect.fnUntraced(function* () {
        const tight = PageMetrics.make({
          width: 2550,
          height: 3300,
          dpi: 300,
          antiAliased: true,
          inkBounds: O.some(InkBounds.make({ minX: 200, minY: 200, maxX: 2500, maxY: 3250 })),
          inkPixels: 1,
          impurePixels: 0,
          largestBlackSquare: 0,
        });
        expect(A.map(marginFindings({ page: 2, metrics: tight }), (f) => f.code)).toEqual([
          "margin-top",
          "margin-left",
          "margin-right",
          "margin-bottom",
        ]);
        expect(A.map(marginFindings({ page: 1, metrics: cleanMetrics(300, true) }), (f) => f.code)).toEqual([]);
        const blank = PageMetrics.make({
          width: 1,
          height: 1,
          dpi: 300,
          antiAliased: true,
          inkBounds: O.none(),
          inkPixels: 0,
          impurePixels: 0,
          largestBlackSquare: 0,
        });
        expect(A.map(marginFindings({ page: 1, metrics: blank }), (f) => f.code)).toEqual(["blank-page"]);
        const dirty = PageMetrics.make({
          width: 1,
          height: 1,
          dpi: 300,
          antiAliased: false,
          inkBounds: O.none(),
          inkPixels: 0,
          impurePixels: 3,
          largestBlackSquare: 40,
        });
        expect(
          A.map(
            purityFindings({ page: 1, metrics: dirty, options: ValidationOptions.make({ expectedPages: O.none() }) }),
            (f) => f.code
          )
        ).toEqual(["impure-pixels", "solid-black-area"]);
      })
    );
  });

  describe("render through fake ports", () => {
    it.layer(makeLayer(), { timeout: "30 seconds" })((it) => {
      it.effect(
        "inspects each PDF independently after writing a different output",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          const twoPages = path.join(dir, "two", "sheets.pdf");
          const onePage = path.join(dir, "one", "sheets.pdf");
          const empty = path.join(dir, "empty.pdf");
          const service = yield* FigureSet;
          yield* fs.writeFileString(
            specPath,
            spec([
              { view: "front", description: "is a front elevation view" },
              { view: "top-plan", description: "is a top plan view" },
            ])
          );
          yield* service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "two"), validate: false }));
          yield* fs.writeFileString(specPath, spec([{ view: "front", description: "is a front elevation view" }]));
          yield* service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "one"), validate: false }));
          yield* fs.writeFileString(empty, "%PDF-1.6 no pages");
          const options = ValidationOptions.make({ expectedPages: O.none() });
          expect((yield* service.validate(twoPages, options)).pageCount).toBe(2);
          expect((yield* service.validate(onePage, options)).pageCount).toBe(1);
          expect((yield* service.validate(empty, options)).pageCount).toBe(0);
        })
      );

      it.effect(
        "renders sheets, proves omissions, writes a manifest, and validates",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          yield* fs.writeFileString(
            specPath,
            spec(
              [
                { view: "front", description: "is a front elevation view" },
                { view: "top-plan", description: "is a top plan view" },
              ],
              [
                { omitted: "left", shown: "front", relation: "identical" },
                { omitted: "right", shown: "front", relation: "mirror" },
              ]
            )
          );
          const out = path.join(dir, "out");
          const service = yield* FigureSet;
          const manifest = yield* service.render(RenderRequest.make({ specPath, outputDir: out }));
          expect(A.map(manifest.figures, (f) => [f.figure, f.view, f.svgFile])).toEqual([
            [1, "front", "fig-1.svg"],
            [2, "top-plan", "fig-2.svg"],
          ]);
          expect(A.map(manifest.omissions, (o) => o.proven)).toEqual([true, true]);
          expect(manifest.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
          assertSome(
            O.map(manifest.validation, (v) => [v.pageCount, v.findings.length]),
            [2, 0]
          );
          const files = yield* fs.readDirectory(out);
          expect(A.sort(files, (a: string, b: string) => (a < b ? -1 : 1))).toEqual([
            "fig-1.svg",
            "fig-2.svg",
            "manifest.json",
            "sheets.pdf",
          ]);
          // the written manifest decodes back to the returned one (it feeds `drawings sign`)
          const written = yield* fs.readFileString(path.join(out, "manifest.json"));
          const decoded = yield* S.decodeEffect(RenderManifestJson)(written);
          expect(decoded).toEqual(manifest);
          const again = yield* service.render(RenderRequest.make({ specPath, outputDir: out }));
          expect(again.figures).toEqual(manifest.figures);
        })
      );

      it.effect(
        "adds a thinner shading layer only when shading is requested",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          yield* fs.writeFileString(specPath, spec([{ view: "front", description: "is a front elevation view" }]));
          const service = yield* FigureSet;
          const plain = yield* service.render(
            RenderRequest.make({ specPath, outputDir: path.join(dir, "plain"), validate: false })
          );
          const shaded = yield* service.render(
            RenderRequest.make({ specPath, outputDir: path.join(dir, "shaded"), validate: false, shade: true })
          );
          expect(plain.shaded).toBe(false);
          expect(shaded.shaded).toBe(true);
          expect(A.map(plain.figures, (f) => f.shadingSegments)).toEqual([0]);
          expect(A.map(shaded.figures, (f) => f.shadingSegments)).toEqual([1]);
          const plainSvg = yield* fs.readFileString(path.join(dir, "plain", "fig-1.svg"));
          const shadedSvg = yield* fs.readFileString(path.join(dir, "shaded", "fig-1.svg"));
          expect(plainSvg).not.toContain('id="shading"');
          expect(shadedSvg).toContain('<path id="shading"');
          // 0.2 mm shading under 0.35 mm outlines
          expect(shadedSvg).toContain('stroke-width="0.567"');
          expect(shadedSvg).toContain('stroke-width="0.992"');
        })
      );

      it.effect(
        "draws broken-line parts as a dashed layer, counts them, and proves omissions over both layers",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const service = yield* FigureSet;
          const figures = [{ view: "front", description: "is a front elevation view" }];
          const omissions = [{ omitted: "left", shown: "front", relation: "identical" }];
          const render = Effect.fnUntraced(function* (name: string, text: string) {
            const specPath = path.join(dir, `${name}.json`);
            yield* fs.writeFileString(specPath, text);
            const out = path.join(dir, name);
            const manifest = yield* service.render(RenderRequest.make({ specPath, outputDir: out, validate: false }));
            return { manifest, svg: yield* fs.readFileString(path.join(out, "fig-1.svg")) };
          });
          const solid = yield* render("solid", spec(figures, omissions));
          const broken = yield* render("broken", spec(figures, omissions, {}, { ...body, lineStyle: "broken" }));
          expect(A.map(solid.manifest.figures, (f) => f.brokenSegments)).toEqual([0]);
          expect(A.map(broken.manifest.figures, (f) => f.brokenSegments)).toEqual([1]);
          expect(solid.svg).not.toContain('id="broken"');
          expect(broken.svg).toContain('<path id="broken"');
          expect(broken.svg).toContain('stroke-dasharray="8.504 4.252"');
          expect(A.map(broken.manifest.omissions, (o) => o.proven)).toEqual([true]);
          // the broken segment lies inside the outline, so the scale is unchanged
          expect(broken.manifest.scale).toBe(solid.manifest.scale);
        })
      );

      it.effect(
        "records the effective sheet and cameras; a spec's sheet wins over the request's",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          const service = yield* FigureSet;
          yield* fs.writeFileString(
            specPath,
            spec(
              [
                { view: "top-perspective", description: "is a top view", projection: "isometric" },
                { view: "top-plan", description: "is a top plan view" },
              ],
              [{ omitted: "bottom-perspective", shown: "top-perspective", relation: "identical" }],
              { pictorialAzimuthDeg: 30, planFacing: "left", sheet: { format: "a4", margins: "cfr-strict" } }
            )
          );
          const manifest = yield* service.render(
            RenderRequest.make({ specPath, outputDir: path.join(dir, "out"), validate: false })
          );
          assertSome(
            O.map(manifest.sheet, (sheet) => [sheet.format, sheet.margins]),
            ["a4", "cfr-strict"]
          );
          const cameras = A.map(manifest.figures, (f) => O.getOrThrow(f.camera));
          assertNone(cameras[0]!.focus);
          expect(cameras[1]!.up).toEqual([1, 0, 0]);
          const svg = yield* fs.readFileString(path.join(dir, "out", "fig-1.svg"));
          expect(svg).toContain('width="595.276pt"');
          // the manifest round-trips, and a manifest written before these fields still decodes
          const written = yield* fs.readFileString(path.join(dir, "out", "manifest.json"));
          expect(yield* S.decodeEffect(RenderManifestJson)(written)).toEqual(manifest);
          const legacy = yield* S.encodeEffect(RenderManifestJson)(
            RenderManifest.make({
              ...manifest,
              sheet: O.none(),
              figures: A.map(manifest.figures, (f) => FigureRecord.make({ ...f, camera: O.none() })),
            })
          );
          expect(legacy).not.toContain('"sheet"');
          expect(legacy).not.toContain('"camera"');
          const old = yield* S.decodeEffect(RenderManifestJson)(legacy);
          assertNone(old.sheet);
          assertNone(old.figures[0]!.camera);
          assertNone(old.figures[1]!.camera);
        })
      );

      it.effect(
        "refuses a label font file that is not a font",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const fontFile = path.join(dir, "not-a-font.ttf");
          yield* fs.writeFileString(fontFile, "not a font");
          const specPath = path.join(dir, "spec.json");
          yield* fs.writeFileString(
            specPath,
            spec([{ view: "front", description: "is a front elevation view" }], [], {
              sheet: { figureLabel: { typeface: "serif", sizePt: 24, fontFile } },
            })
          );
          const service = yield* FigureSet;
          const error = yield* Effect.flip(
            service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "out"), validate: false }))
          );
          expect(error.reason).toBe("font");
          // the parser loaded and rejected the bytes: a failed opentype.js import has another message
          expect(error.message).toContain("could not be parsed");
          expect(error.message).not.toContain("Could not load");
        })
      );

      it.effect(
        "rejects unreadable font files and missing label glyphs before producing output",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          const outputDir = path.join(dir, "out");
          const service = yield* FigureSet;
          const renderWith = Effect.fnUntraced(function* (fontFile: string) {
            yield* fs.writeFileString(
              specPath,
              spec([{ view: "front", description: "is a front elevation view" }], [], {
                sheet: { figureLabel: { typeface: "serif", sizePt: 24, fontFile } },
              })
            );
            return yield* Effect.flip(service.render(RenderRequest.make({ specPath, outputDir, validate: false })));
          });
          const missing = yield* renderWith(path.join(dir, "missing.otf"));
          expect(missing.reason).toBe("font");
          expect(missing.message).toContain("Could not read label font");
          const incompleteFont = path.join(dir, "missing-F.otf");
          yield* fs.writeFile(incompleteFont, yield* makeLabelAlphabetFont("0123456789IG./ "));
          const incomplete = yield* renderWith(incompleteFont);
          expect(incomplete.reason).toBe("font");
          expect(incomplete.message).toContain('the font has no glyph for "F"');
          expect(yield* fs.exists(outputDir)).toBe(false);
        })
      );

      it.effect(
        "outlines an operator font file on every runner and records its sha256",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const bytes = yield* labelAlphabetFont;
          const fontFile = path.join(dir, "boxes.otf");
          yield* fs.writeFile(fontFile, bytes);
          const specPath = path.join(dir, "spec.json");
          yield* fs.writeFileString(
            specPath,
            spec([{ view: "front", description: "is a front elevation view" }], [], {
              sheet: { sheetNumberLabel: { typeface: "sans", sizePt: 18, fontFile } },
            })
          );
          const service = yield* FigureSet;
          const manifest = yield* service.render(
            RenderRequest.make({ specPath, outputDir: path.join(dir, "out"), validate: false })
          );
          const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", bytes.slice().buffer));
          expect(A.map(manifest.labelFonts, (f) => [f.fontFile, f.sha256])).toEqual([
            [fontFile, Buffer.from(digest).toString("hex")],
          ]);
          const svg = yield* fs.readFileString(path.join(dir, "out", "fig-1.svg"));
          // "1/1" in the box face: three 400 x 700 unit boxes, every corner a straight line
          expect(outlinesOf(svg)).toMatch(/^M[\d. LZM-]+$/);
          expect(inkBox(outlinesOf(svg)).maxY - inkBox(outlinesOf(svg)).minY).toBeCloseTo((18 * 700) / 1000, 2);
        })
      );

      it.effect(
        "accepts a default-export font parser with quadratic outlines and rejects an undersized cap height",
        Effect.fnUntraced(function* () {
          let capHeight = 700;
          yield* Effect.sync(() =>
            vi.doMock(OPENTYPE_MODULE, () => ({
              default: {
                parse: () => ({
                  unitsPerEm: 1000,
                  tables: { os2: { sCapHeight: capHeight } },
                  charToGlyph: (char: string) => ({
                    index: char === " " ? 0 : 1,
                    advanceWidth: char === " " ? undefined : 500,
                    path: {
                      commands:
                        char === " "
                          ? []
                          : [
                              { type: "M", x: 0, y: 0 },
                              { type: "Q", x1: 100, y1: 1400, x: 500, y: 0 },
                              { type: "Q", x1: 500, y1: 350, x: 500, y: 700 },
                              { type: "L", x: 0, y: 700 },
                              { type: "Z" },
                            ],
                    },
                  }),
                }),
              },
            }))
          );
          yield* Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const dir = yield* fs.makeTempDirectoryScoped();
            const specPath = path.join(dir, "spec.json");
            const fontFile = path.join(dir, "quadratic.ttf");
            const outputDir = path.join(dir, "out");
            yield* fs.writeFileString(fontFile, "font parser boundary fixture");
            yield* fs.writeFileString(
              specPath,
              spec([{ view: "front", description: "is a front elevation view" }], [], {
                sheet: {
                  sheetNumberLabel: { typeface: "sans", sizePt: 18, fontFile },
                  figureLabel: { typeface: "serif", sizePt: 24, fontFile },
                },
              })
            );
            const service = yield* FigureSet;
            const request = RenderRequest.make({ specPath, outputDir, validate: false });
            const manifest = yield* service.render(request);
            expect(A.some(manifest.labelFonts, (font) => font.fontFile === fontFile)).toBe(true);
            expect(yield* fs.readFileString(path.join(outputDir, "fig-1.svg"))).toContain("Q");
            capHeight = 1;
            const undersized = yield* Effect.flip(service.render(request));
            expect(undersized.reason).toBe("font");
            expect(undersized.message).toContain("under 0.32 cm");
          }).pipe(Effect.ensuring(Effect.sync(() => vi.doUnmock(OPENTYPE_MODULE))));
        }),
        { concurrent: false }
      );

      it.effect(
        "sets text labels in a font resolved from the font directory, pins it for the backend, and records it",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const fontDirectory = path.join(dir, "fonts");
          yield* fs.makeDirectory(path.join(fontDirectory, "nested"), { recursive: true });
          const bytes = yield* labelAlphabetFont;
          const fontFile = path.join(fontDirectory, "nested", "boxes.otf");
          yield* fs.writeFile(fontFile, bytes);
          yield* fs.writeFileString(path.join(fontDirectory, "README.txt"), "not a font");
          const specPath = path.join(dir, "spec.json");
          const textSheet = {
            fontDirectory,
            labelGapMm: 1,
            sheetNumberLabel: { typeface: "sans", sizePt: 18, render: "text", fontFamily: "label boxes" },
            figureLabel: { typeface: "serif", sizePt: 24, render: "text", fontFamily: "Label Boxes" },
          };
          yield* fs.writeFileString(
            specPath,
            spec(
              [
                { view: "front", description: "is a front elevation view" },
                { view: "top-plan", description: "is a top plan view" },
              ],
              [],
              { sheet: textSheet }
            )
          );
          const service = yield* FigureSet;
          const manifest = yield* service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "out") }));
          const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", bytes.slice().buffer));
          expect(A.map(manifest.fonts, (pin) => [pin.family, pin.file, pin.sha256])).toEqual([
            ["label boxes", fontFile, Buffer.from(digest).toString("hex")],
            ["Label Boxes", fontFile, Buffer.from(digest).toString("hex")],
          ]);
          expect(manifest.labelFonts).toEqual([]);
          const pinned = yield* decodeJson(yield* fs.readFileString(path.join(dir, "out", "sheets.pdf.fonts.json")));
          expect(pinned).toEqual({
            directory: fontDirectory,
            families: [
              { requested: "label boxes", family: "Label Boxes" },
              { requested: "Label Boxes", family: "Label Boxes" },
            ],
          });
          const svg = yield* fs.readFileString(path.join(dir, "out", "fig-2.svg"));
          expect(svg).toContain(
            'font-family="label boxes" font-size="18.000" text-anchor="middle" fill="#000000">2/2</text>'
          );
          expect(svg).toContain(
            'font-family="Label Boxes" font-size="24.000" text-anchor="middle" fill="#000000">FIG. 2</text>'
          );
          // The loaded face places the text: a 700-unit box glyph has its ink top 12.6 pt
          // (18 pt × 0.7) above the baseline and its ink bottom on it.
          const g = sheetGeometry(manifest.sheet.pipe(O.getOrThrow));
          const ys = A.map(A.fromIterable(svg.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)), (m) => Number(m[1]));
          expect(ys[0]).toBeCloseTo(g.labels.top + 12.6, 3);
          expect(ys[1]).toBeCloseTo(g.labels.bottom, 3);
          // the fake backend extracts no text, so the validator reports both labels missing on both pages
          const codes = O.map(manifest.validation, (v) => A.map(v.findings, (f) => [f.code, f.page]));
          assertSome(codes, [
            ["label-missing", O.some(1)],
            ["label-missing", O.some(1)],
            ["label-missing", O.some(2)],
            ["label-missing", O.some(2)],
          ]);
        })
      );

      it.effect(
        "refuses text labels without a font directory or without a Regular file of the family",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          const service = yield* FigureSet;
          const renderWith = Effect.fnUntraced(function* (sheet: Record<string, unknown>) {
            yield* fs.writeFileString(
              specPath,
              spec([{ view: "front", description: "is a front elevation view" }], [], { sheet })
            );
            return yield* Effect.flip(
              service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "out"), validate: false }))
            );
          });
          const label = { typeface: "sans", sizePt: 18, render: "text" };
          const noDirectory = yield* renderWith({ sheetNumberLabel: label });
          expect(noDirectory.reason).toBe("font");
          expect(noDirectory.message).toContain("fontDirectory");
          yield* fs.writeFile(path.join(dir, "boxes.otf"), yield* labelAlphabetFont);
          const noArial = yield* renderWith({ sheetNumberLabel: label, fontDirectory: dir });
          expect(noArial.reason).toBe("font");
          expect(noArial.message).toContain('no Regular font of the family "Arial"');
          yield* fs.writeFile(path.join(dir, "boxes-copy.otf"), yield* labelAlphabetFont);
          const twice = yield* renderWith({
            sheetNumberLabel: { ...label, fontFamily: "Label Boxes" },
            fontDirectory: dir,
          });
          expect(twice.message).toContain("2 Regular files");
        })
      );

      it.effect("re-derives both vendored faces from their source fonts through the supplied-font path", (context) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          // Workstation-only: hosted runners do not install the source fonts of the vendored faces.
          // Byte-equal sheets prove the committed glyph data still matches its recorded sources.
          const sansFile = "/usr/share/fonts/liberation/LiberationSans-Regular.ttf";
          const serifFile = "/usr/share/fonts/liberation/LiberationSerif-Regular.ttf";
          if (!(yield* fs.exists(sansFile)) || !(yield* fs.exists(serifFile))) {
            context.skip(`Missing ${sansFile} or ${serifFile}`);
            return;
          }
          const dir = yield* fs.makeTempDirectoryScoped();
          const service = yield* FigureSet;
          const render = Effect.fnUntraced(function* (name: string, sheet: Record<string, unknown>) {
            const specPath = path.join(dir, `${name}.json`);
            yield* fs.writeFileString(
              specPath,
              spec([{ view: "front", description: "is a front elevation view" }], [], { sheet })
            );
            const manifest = yield* service.render(
              RenderRequest.make({ specPath, outputDir: path.join(dir, name), validate: false })
            );
            return { manifest, svg: yield* fs.readFileString(path.join(dir, name, "fig-1.svg")) };
          });
          const vendored = yield* render("vendored", {
            sheetNumberLabel: { typeface: "sans", sizePt: 18 },
            figureLabel: { typeface: "serif", sizePt: 24 },
          });
          const supplied = yield* render("supplied", {
            sheetNumberLabel: { typeface: "sans", sizePt: 18, fontFile: sansFile },
            figureLabel: { typeface: "serif", sizePt: 24, fontFile: serifFile },
          });
          expect(supplied.svg).toBe(vendored.svg);
          expect(vendored.manifest.labelFonts).toEqual([]);
          expect(A.map(supplied.manifest.labelFonts, (f) => [f.fontFile, f.sha256])).toEqual([
            [sansFile, "baccc64becc3eb7d104b7c84d99f5314a0a1f896e2b3ea6c2f22fc08d2003bee"],
            [serifFile, "86b9ea1c2f41bed9d7c09ccad4abc2894b33df5de60e5bbbece5d48610911870"],
          ]);
        })
      );

      it.effect(
        "rejects an isometric projection on a plan or elevation",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          const service = yield* FigureSet;
          yield* fs.writeFileString(
            specPath,
            spec([{ view: "front", description: "is a front elevation view", projection: "isometric" }])
          );
          const error = yield* Effect.flip(service.render(RenderRequest.make({ specPath, outputDir: dir })));
          expect(error.reason).toBe("spec");
        })
      );

      it.effect(
        "refuses an omission claim the projections disprove",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          yield* fs.writeFileString(
            specPath,
            spec(
              [{ view: "front", description: "is a front elevation view" }],
              [{ omitted: "rear", shown: "front", relation: "identical" }]
            )
          );
          const service = yield* FigureSet;
          const error = yield* Effect.flip(
            service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "out") }))
          );
          assertInstanceOf(error, DrawingError);
          expect(error.reason).toBe("omission");
        })
      );

      it.effect(
        "refuses a model whose parts overlap unless the request allows it",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          yield* fs.writeFileString(
            specPath,
            spec([{ view: "front", description: "is a front elevation view" }], [], {}, body, [
              { ...body, name: "lid" },
            ])
          );
          const service = yield* FigureSet;
          const error = yield* Effect.flip(
            service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "refused"), validate: false }))
          );
          assertInstanceOf(error, DrawingError);
          expect(error.reason).toBe("geometry");
          expect(error.message).toContain("1 pair(s) of parts overlap");
          const allowed = yield* service.render(
            RenderRequest.make({
              specPath,
              outputDir: path.join(dir, "allowed"),
              validate: false,
              allowPartOverlaps: true,
            })
          );
          expect(allowed.model.partOverlaps).toBe(1);
        })
      );

      it.effect(
        "rejects a spec that repeats a view or lacks a description",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          const service = yield* FigureSet;
          yield* fs.writeFileString(
            specPath,
            spec([
              { view: "front", description: "a" },
              { view: "front", description: "b" },
            ])
          );
          const dup = yield* Effect.flip(service.render(RenderRequest.make({ specPath, outputDir: dir })));
          expect(dup.reason).toBe("spec");
          yield* fs.writeFileString(specPath, spec([{ view: "front", description: "   " }]));
          const empty = yield* Effect.flip(service.render(RenderRequest.make({ specPath, outputDir: dir })));
          expect(empty.reason).toBe("spec");
        })
      );
    });
  });
});

// Keep the geometry vocabulary exercised at the type level: the spec decodes
// into these classes.
void Box;
void ModelSpec;
void Part;

describe("@beep/technical-drawing approver binding and empty documents", () => {
  it.layer(makeLayer(), { timeout: "30 seconds" })((it) => {
    it.effect(
      "reports an empty document instead of rasterising a page that is not there",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const pdfPath = path.join(dir, "empty.pdf");
        yield* fs.writeFileString(pdfPath, "%PDF-1.6 no pages");
        // the fake backend reads the empty document's own page count
        const service = yield* FigureSet;
        const report = yield* service.validate(pdfPath, ValidationOptions.make({ expectedPages: O.none() }));
        expect(report.pageCount).toBe(0);
        expect(report.ok).toBe(false);
        expect(A.map(report.findings, (f) => [f.code, f.message])).toEqual([["page-count", "The PDF has no pages."]]);
      })
    );
  });

  it.layer(makeLayer(), { timeout: "30 seconds" })((it) => {
    it.effect(
      "carries the spec's approver into the manifest, and omits the key when the spec names none",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const service = yield* FigureSet;
        const figures = [{ view: "front", description: "is a front elevation view thereof" }];
        const render = Effect.fnUntraced(function* (name: string, text: string) {
          const specPath = path.join(dir, `${name}.json`);
          yield* fs.writeFileString(specPath, text);
          const out = path.join(dir, name);
          const manifest = yield* service.render(RenderRequest.make({ specPath, outputDir: out }));
          return { manifest, written: yield* fs.readFileString(path.join(out, "manifest.json")) };
        });
        const bound = yield* render("bound", spec(figures, [], { approver: "Attorney@Example.com" }));
        expect(O.getOrUndefined(bound.manifest.approver)).toBe("attorney@example.com");
        const decoded = yield* S.decodeEffect(RenderManifestJson)(bound.written);
        expect(O.getOrUndefined(decoded.approver)).toBe("attorney@example.com");
        const unbound = yield* render("unbound", spec(figures));
        expect(O.isNone(unbound.manifest.approver)).toBe(true);
        expect(unbound.written).not.toContain("approver");
      })
    );
  });
});

// The engine records the plans it is asked for; only this block's one test uses this layer,
// so concurrent tests elsewhere cannot add to it.
const gradedPlans = A.empty<ShadingPlan>();

describe("graded shading through fake ports", () => {
  it.layer(
    Layer.fresh(FigureSet.layer).pipe(
      Layer.provide(Layer.merge(fakeEngineWith(gradedPlans), fakeBackend)),
      Layer.provideMerge(NodeServices.layer)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "passes a spec's graded shading options to the engine, records coverage, and flags close shading lines",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const specPath = path.join(dir, "spec.json");
        yield* fs.writeFileString(
          specPath,
          spec([{ view: "front", description: "is a front elevation view" }], [], {
            sheet: {
              shadingStyle: "graded",
              shadingAxis: "surface-class",
              shadingMinFaceSpanMm: 1.5,
              shadingMinStrokeMm: 2,
            },
          })
        );
        const service = yield* FigureSet;
        const manifest = yield* service.render(
          RenderRequest.make({ specPath, outputDir: path.join(dir, "out"), shade: true })
        );
        expect(A.length(gradedPlans)).toBe(1);
        const plan = gradedPlans[0];
        expect([plan?.style, plan?.axis]).toEqual(["graded", "surface-class"]);
        expect(plan?.minFaceSpan).toBeCloseTo((1.5 * PT_PER_MM) / manifest.scale, 9);
        expect(plan?.minStroke).toBeCloseTo((2 * PT_PER_MM) / manifest.scale, 9);
        assertSome(
          manifest.figures[0]!.shadingCoverage,
          ShadingCoverage.make({
            shadedFaces: 1,
            skippedFaces: [ShadingSkip.make({ reason: "back-facing", faces: 5 })],
          })
        );
        assertSome(
          O.map(manifest.validation, (v) => A.map(v.findings, (f) => [f.code, f.page])),
          [["shading-spacing", O.some(1)]]
        );
        // the unshaded render records no coverage and no spacing finding
        const plain = yield* service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "plain") }));
        assertNone(plain.figures[0]!.shadingCoverage);
        assertSome(
          O.map(plain.validation, (v) => v.findings.length),
          0
        );
        // a default (uniform) shaded render is not held to the graded outline checks, although its
        // hatch starts on the outline
        const uniformSpec = path.join(dir, "uniform.json");
        yield* fs.writeFileString(
          uniformSpec,
          spec([{ view: "front", description: "is a front elevation view" }], [], {})
        );
        const uniform = yield* service.render(
          RenderRequest.make({ specPath: uniformSpec, outputDir: path.join(dir, "uniform"), shade: true })
        );
        assertSome(
          O.map(uniform.validation, (v) => A.map(v.findings, (f) => f.code)),
          []
        );
      })
    );
  });
});
