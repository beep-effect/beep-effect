import {
  BoundingBox,
  Box,
  Camera,
  cameraForView,
  closeOutlineGaps,
  commonScale,
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
  nearestOutlineDistance,
  OUTLINE_COINCIDENCE_MM,
  OverlayLine,
  outlineSpacingFindings,
  PageMetrics,
  Part,
  PdfBackend,
  PdfFacts,
  PdfFontFact,
  PdfPageSize,
  PdfStreamFact,
  PT_PER_MM,
  purityFindings,
  RenderManifest,
  RenderRequest,
  Segment2,
  ShadingBand,
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
import { NodeServices } from "@effect/platform-node";
import { describe, expect, vi } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OutlineSeparation, ShadingPlan } from "@beep/technical-drawing";

const UnknownJson = S.fromJsonString(S.Unknown);

const RenderManifestJson = S.fromJsonString(RenderManifest);

const square: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 10, 0],
  [0, 0, 0, 5],
  [0, 5, 10, 5],
  [10, 0, 10, 5],
];
const rearEyeSquare = A.map(square, ([a, b, c, d]) => [a + 1, b, c + 1, d] as const);

type FakeSegment = readonly [number, number, number, number];

const uniformHatchStartingOnOutline: ReadonlyArray<FakeSegment> = [[0.2, 0.2, 4, 4]];
const gradedPairHairApart: ReadonlyArray<FakeSegment> = [
  [1, 1, 9, 1],
  [1, 1.01, 9, 1.01],
];
const brokenSegmentPerView: ReadonlyArray<FakeSegment> = [[2, 1, 8, 1]];
const emphasisAlongBottomEdge: ReadonlyArray<FakeSegment> = [[0, 0, 10, 0]];

const fakeEngineWith = (
  plans: Array<ShadingPlan>,
  gradedScene?: { readonly shading: ReadonlyArray<FakeSegment>; readonly visible: ReadonlyArray<FakeSegment> }
) =>
  Layer.succeed(
    GeometryEngine,
    GeometryEngine.of({
      info: Effect.succeed(EngineInfo.make({ name: "fake", version: "0", binarySha256: "" })),
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
        O.map(shading, (plan) => plans.push(plan));
        const scene = O.filter(O.fromUndefinedOr(gradedScene), () =>
          O.exists(shading, (plan) => plan.style === "graded")
        );
        const hatch = O.match(shading, {
          onNone: () => [],
          onSome: (plan) =>
            plan.style === "graded"
              ? O.match(scene, {
                  onNone: () => gradedPairHairApart,
                  onSome: (own) => own.shading,
                })
              : uniformHatchStartingOnOutline,
        });
        const outline = (base: ReadonlyArray<FakeSegment>) =>
          O.match(scene, { onNone: () => base, onSome: (own) => [...base, ...own.visible] });
        const coverage = O.map(shading, () =>
          ShadingCoverage.make({
            shadedFaces: 1,
            skippedFaces: [ShadingSkip.make({ reason: "back-facing", faces: 5 })],
          })
        );
        const broken = A.some(model.parts, (part) => part.lineStyle === "broken") ? brokenSegmentPerView : [];
        const emphasis = A.some(model.overlays, (overlay) => overlay.style === "emphasis")
          ? emphasisAlongBottomEdge
          : [];
        return A.map(cameras, (camera) =>
          EdgeSet.make({
            visible: outline(camera.eye[1] > 0 ? rearEyeSquare : square),
            hidden: [],
            shading: hatch,
            shadingCoverage: coverage,
            broken,
            emphasis,
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
    inkBounds: InkBounds.makeOption({
      minX: Math.round(1.1 * dpi),
      minY: Math.round(1.1 * dpi),
      maxX: Math.round(7.5 * dpi),
      maxY: Math.round(10 * dpi),
    }),
    inkPixels: 100,
    impurePixels: 0,
    largestBlackSquare: 4,
  });

const encodeSheetFonts = S.encodeEffect(S.fromJsonString(SheetFonts));
const decodeJson = S.decodeEffect(UnknownJson);

const fakeBackend = Layer.effect(
  PdfBackend,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return PdfBackend.of({
      svgToPdf: Effect.fnUntraced(function* (svgPaths, outputPath, fonts) {
        yield* fs.writeFileString(outputPath, `%PDF-1.6 fake ${A.length(svgPaths)} pages`);
        if (O.isSome(fonts)) {
          const pinnedFontsBesidePdf = `${outputPath}.fonts.json`;
          const encodedSheetFonts = yield* encodeSheetFonts(fonts.value);
          yield* fs.writeFileString(pinnedFontsBesidePdf, encodedSheetFonts);
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
        const emptyDocument = pageCount === 0;
        return PdfFacts.make({
          headerVersion: "1.6",
          pages: emptyDocument ? [] : A.makeBy(pageCount, () => letter),
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
  moreParts: ReadonlyArray<Readonly<Record<string, unknown>>> = [],
  overlays: ReadonlyArray<Readonly<Record<string, unknown>>> = []
) => {
  const preOverlayModel = { parts: [part, ...moreParts] };
  return Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      ...extra,
      title: "Synthetic block",
      model: A.isReadonlyArrayNonEmpty(overlays) ? { ...preOverlayModel, overlays } : preOverlayModel,
      figures,
      omissions,
    }),
    identity
  );
};

const OPENTYPE_MODULE = A.join(["opentype", "js"], ".");
interface OpenTypeBuilder {
  readonly Font: new (options: Readonly<Record<string, unknown>>) => { toArrayBuffer(): ArrayBuffer };
  readonly Glyph: new (options: Readonly<Record<string, unknown>>) => unknown;
  readonly Path: new () => {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
  };
}
const makeBoxGlyphLabelFont = Effect.fnUntraced(function* (alphabet: string) {
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
      name: `u${pipe(char, Str.charCodeAt(0), O.getOrElse(constant(Number.NaN)))}`,
      unicode: pipe(char, Str.charCodeAt(0), O.getOrElse(constant(Number.NaN))),
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
const boxGlyphLabelFont = makeBoxGlyphLabelFont("0123456789FIG./ ");

const makeLayer = () =>
  FigureSet.layer.pipe(Layer.provide(Layer.merge(fakeEngine, fakeBackend)), Layer.provideMerge(NodeServices.layer));

type Pt = readonly [number, number];
const pathPieces = (d: string): ReadonlyArray<ReadonlyArray<Pt>> => {
  const tokens = pipe(d, Str.match(/[MLQZ]|-?\d+(?:\.\d+)?/g), O.getOrElse(A.empty<string>));
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
  const sampledOutlinePoints = A.flatMap(
    kept,
    (piece): ReadonlyArray<Pt> => (piece.length === 2 ? piece : A.map(A.range(0, 2000), (k) => quadAt(piece, k / 2000)))
  );
  return A.reduce(
    sampledOutlinePoints,
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
type Crossing = readonly [number, number];
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
const nonzeroWindingRowInk = (
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
const rowSquareSizes = (ink: ReadonlyArray<boolean>, previous: ReadonlyArray<number>): ReadonlyArray<number> => {
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
    const current = rowSquareSizes(nonzeroWindingRowInk(rowCrossings(edges, y), box.minX, cols, step), previous);
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
        A.map(A.fromIterable(new Uint8Array(digest)), (b) => Str.padStart(2, "0")(b.toString(16))),
        ""
      )
    )
  );
const styled = SheetOptions.make({
  margins: "cfr-strict",
  labelGapMm: O.some(1),
  sheetNumberLabel: LabelStyle.makeOption({ typeface: "sans", sizePt: 18 }),
  figureLabel: LabelStyle.makeOption({ typeface: "serif", sizePt: 24 }),
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
          [...Str.matchAll(/[ML](-?\d+\.\d+) (-?\d+\.\d+)/g)(a)],
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
        expect(
          composeSheet({ ...base, shading: [], broken: [] }),
          "an empty broken layer leaves the sheet byte-identical"
        ).toBe(plain);
        expect(plain).not.toContain('id="broken"');
        expect(plain).not.toContain("stroke-dasharray");
        const withBroken = composeSheet({ ...base, shading: [[1, 1, 4, 4]], broken: [[2, 1, 8, 1]] });
        expect(withBroken, "3 mm dashes, 1.5 mm gaps, the outline weight, between shading and figure").toContain(
          'stroke-width="0.992" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8.504 4.252"/>'
        );
        const order = A.map(['id="labels"', 'id="shading"', 'id="broken"', 'id="figure"'], (id) =>
          pipe(withBroken, Str.indexOf(id), O.getOrElse(constant(-1)))
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
        const figureOf = (svg: string) =>
          Str.slice(pipe(svg, Str.indexOf('<path id="figure"'), O.getOrElse(constant(-1))))(svg);
        expect(figureOf(withBroken), "broken lines inside the outline do not move it").toBe(figureOf(plain));
        expect(
          figureOf(composeSheet({ ...base, shading: [], broken: [[-10, 0, 0, 0]] })),
          "outside the outline broken lines re-centre the view"
        ).not.toBe(figureOf(plain));
        expect(SheetOptions.make({}).brokenGapMm).toBe(1.5);
        expect(() => SheetOptions.make({ brokenDashMm: 0.5 })).toThrow();
        expect(() => SheetOptions.make({ brokenGapMm: 0.5 })).toThrow();
        expect(
          SheetOptions.make({ lineWeightMm: 1.2 }).brokenGapMm,
          "round caps eat the line weight: a heavy stroke would close a gap valid on its own, so the drawn gap widens at emit time; the options themselves stay usable on a solid-only sheet"
        ).toBe(1.5);
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
      "composeSheet chains broken segments that meet end to end into one dashed subpath",
      Effect.fnUntraced(function* () {
        const base = {
          segments: square,
          shading: [],
          figure: 1,
          sheet: 1,
          sheets: 1,
          scale: 5,
          options: SheetOptions.make({}),
        } as const;
        const subpathsOf = (svg: string) =>
          pipe(
            /<path id="broken" d="([^"]*)"/.exec(svg)?.[1] ?? "",
            Str.split("M"),
            A.filter(Str.isNonEmpty),
            A.map(Str.split("L"))
          );
        const wave = A.makeBy(80, (i) => {
          const x = i / 2;
          return [x, 2 + Math.sin(x), x + 0.5, 2 + Math.sin(x + 0.5)] as const;
        });
        const waved = subpathsOf(composeSheet({ ...base, broken: [...wave, [0, 4, 10, 4]] }));
        expect(
          A.map(waved, A.length),
          "SVG and PDF restart the dash pattern at each subpath: a corrugation wave of 80 segments 2.5 pt long, each far shorter than the 8.504 pt dash, in the engine's canonical order, chains into one subpath beside the straight line"
        ).toEqual([81, 2]);
        const ring = subpathsOf(
          composeSheet({
            ...base,
            broken: [
              [1, 1, 1, 3],
              [1, 1, 4, 1],
              [1, 3, 4, 3],
              [4, 1, 4, 3],
            ],
          })
        );
        expect(
          A.map(ring, A.length),
          "a closed ring whose canonical segments run both ways round is one subpath"
        ).toEqual([5]);
        expect(
          A.map(ring, (points) => A.head(points)),
          "the ring's subpath ends where it starts"
        ).toEqual(A.map(ring, (points) => A.last(points)));
        const tee = subpathsOf(
          composeSheet({
            ...base,
            broken: [
              [0, 1, 5, 1],
              [5, 1, 10, 1],
              [5, 1, 5, 4],
            ],
          })
        );
        expect(
          A.map(tee, A.length),
          "where three segments meet the chain runs on into the first in order; the third starts its own subpath"
        ).toEqual([3, 2]);
        const apart = /<path id="broken" d="([^"]*)"/.exec(
          composeSheet({
            ...base,
            broken: [
              [2, 1, 8, 1],
              [2, 2, 8, 2],
            ],
          })
        )?.[1];
        expect(apart, "segments that do not touch keep one M..L.. subpath each, as before chaining").toMatch(
          /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/
        );
      })
    );

    it.effect(
      "composeSheet draws emphasis lines over the outlines only when they exist",
      Effect.fnUntraced(function* () {
        const options = SheetOptions.make({});
        const base = { segments: square, shading: [], figure: 1, sheet: 1, sheets: 1, scale: 20, options } as const;
        const plain = composeSheet(base);
        expect(
          composeSheet({ ...base, emphasis: [] }),
          "an empty emphasis layer leaves the sheet byte-identical, golden included"
        ).toBe(plain);
        expect(plain).not.toContain('id="emphasis"');
        const styledEmpty = composeSheet({
          segments: square,
          shading: [],
          emphasis: [],
          figure: 3,
          sheet: 3,
          sheets: 8,
          scale: 20,
          options: styled,
        });
        const sha256Hex1 = yield* sha256Hex(styledEmpty);
        expect(sha256Hex1).toBe("dcfb8611b16781c15f0caf34506a913c44d795e88ce09fc01e6a33bb2b1f6112");
        const withEmphasis = composeSheet({ ...base, emphasis: [[0, 0, 10, 0]] });
        expect(SheetOptions.make({}).emphasisWeightMm, "0.7 mm by default").toBe(0.7);
        expect(withEmphasis).toContain('<path id="emphasis" d="M');
        expect(withEmphasis, "the emphasis takes the outline caps and joins, drawn last").toContain(
          'fill="none" stroke="#000000" stroke-width="1.984" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>'
        );
        expect(
          pipe(withEmphasis, Str.indexOf('id="figure"'), O.getOrElse(constant(-1))),
          "the emphasis is drawn after the figure, so it sits on the outline it runs along"
        ).toBeLessThan(pipe(withEmphasis, Str.indexOf('id="emphasis"'), O.getOrElse(constant(-1))));
        const figureOf = (svg: string) =>
          Str.slice(
            pipe(svg, Str.indexOf('<path id="figure"'), O.getOrElse(constant(-1))),
            pipe(svg, Str.indexOf('<path id="emphasis"'), O.getOrElse(constant(-1)))
          )(svg);
        expect(figureOf(withEmphasis), "the emphasis line runs along the outline, so the outlines do not move").toBe(
          Str.slice(
            pipe(plain, Str.indexOf('<path id="figure"'), O.getOrElse(constant(-1))),
            pipe(plain, Str.indexOf("</svg>"), O.getOrElse(constant(-1)))
          )(plain)
        );
        const heavy = composeSheet({
          ...base,
          emphasis: [[0, 0, 10, 0]],
          options: SheetOptions.make({ emphasisWeightMm: 1 }),
        });
        expect(heavy).toContain('<path id="emphasis" d="M');
        expect(heavy).toContain('stroke-width="2.835"');
        expect(() => SheetOptions.make({ emphasisWeightMm: 0.3 })).toThrow();
      })
    );

    it.effect(
      "a model decodes without overlays, and an overlay line joins at least two points",
      Effect.fnUntraced(function* () {
        const legacy = yield* S.decodeUnknownEffect(ModelSpec)({ parts: [body] });
        expect(legacy.overlays).toEqual([]);
        const decodeSpecFileOverlay = (input: unknown) => S.decodeUnknownOption(OverlayLine)(input);
        const line = { name: "seat", style: "emphasis", points: [[0, 0, 0]] };
        assertNone(decodeSpecFileOverlay(line));
        assertNone(decodeSpecFileOverlay({ ...line, points: [], style: "broken" }));
        const directionlessFacing = decodeSpecFileOverlay({
          ...line,
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
          facing: [0, 0, 0],
        });
        assertNone(directionlessFacing);
        const overlay = yield* S.decodeUnknownEffect(OverlayLine)({
          ...line,
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        });
        expect(overlay.lift).toBe(0.01);
        assertNone(overlay.facing);
        const model = yield* S.decodeUnknownEffect(ModelSpec)({
          parts: [body],
          overlays: [
            {
              ...line,
              style: "broken",
              points: [
                [0, 0, 0],
                [0, 0, 5],
                [10, 0, 5],
              ],
              facing: [0, -1, 0],
            },
          ],
        });
        expect(A.map(model.overlays, (o) => [o.style, A.length(o.points)])).toEqual([["broken", 3]]);
        assertSome(model.overlays[0]!.facing, [0, -1, 0]);
      })
    );

    it.effect(
      "segment comparison is order- and direction-insensitive; mirroring is about the view centre",
      Effect.fnUntraced(function* () {
        expect(
          sameSegments({ left: square, right: A.reverse(A.map(square, ([a, b, c, d]) => [c, d, a, b] as const)) })
        ).toBe(true);
        expect(sameSegments({ left: square, right: rearEyeSquare })).toBe(false);
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
        const swung = cameraForView({ view: "top-perspective", box, azimuthDeg: O.some(90) });
        expect(swung.eye[0], "a set azimuth swings the eye about +Z, keeping its reach and height").toBeCloseTo(
          -Math.hypot(1, 1.2),
          12
        );
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
        expect(
          (Math.asin(top.eye[2] / Math.hypot(...top.eye)) * 180) / Math.PI,
          "35.264° above the horizon"
        ).toBeCloseTo(35.264, 3);
        const iso = cameraForView({ view: "top-perspective", box, projection: "isometric" });
        expect(
          iso.eye[0],
          "without an azimuth the isometric eye looks along 45°, so the model's X, Y and Z foreshorten equally"
        ).toBeCloseTo(iso.eye[1], 12);
        expect(Math.abs(iso.eye[0])).toBeCloseTo(Math.abs(iso.eye[2]), 12);
      })
    );

    it.effect(
      "cameras: a set elevation lowers the isometric; without one every pictorial camera is unchanged",
      Effect.fnUntraced(function* () {
        const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
        const elevationOf = (eye: readonly [number, number, number]) =>
          (Math.asin(eye[2] / Math.hypot(...eye)) * 180) / Math.PI;
        const top = cameraForView({ view: "top-perspective", box, projection: "isometric", elevationDeg: O.some(20) });
        const bottom = cameraForView({
          view: "bottom-perspective",
          box,
          projection: "isometric",
          elevationDeg: O.some(20),
        });
        assertNone(top.focus);
        expect(elevationOf(top.eye)).toBeCloseTo(20, 9);
        expect(elevationOf(bottom.eye)).toBeCloseTo(-20, 9);
        expect(top.eye[0], "the azimuth still swings it: 45° by default").toBeCloseTo(top.eye[1], 12);
        const az = (45 * Math.PI) / 180;
        const el = Math.atan(1 / Math.SQRT2);
        const isometricOf = (zSign: 1 | -1) =>
          Camera.make({
            eye: [-Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el) * zSign],
            up: [0, 0, 1],
          });
        A.forEach(
          [
            ["top-perspective", 1],
            ["bottom-perspective", -1],
          ] as const,
          ([view, zSign]) => {
            const isometric = cameraForView({ view, box, projection: "isometric" });
            expect(
              isometric,
              "without an elevation the isometric is the camera written before the field existed, bit for bit"
            ).toEqual(isometricOf(zSign));
            expect(
              cameraForView({ view, box, projection: "isometric", focusDiagonals: O.some(4) }),
              "without an elevation the isometric ignores a set focus"
            ).toEqual(isometricOf(zSign));
            assertNone(isometric.sight);
            expect(isometric.hiddenLinePassAbout).toBe("origin");
          }
        );
        const perspective = Camera.make({
          eye: [-1, -1.2, 0.85],
          up: [0, 0, 1],
          target: [20, 15, 10],
          focus: O.some(Math.max(Math.hypot(40, 30, 20) * 2.5, 1)),
        });
        expect(
          cameraForView({ view: "top-perspective", box, elevationDeg: O.some(20) }),
          "a perspective ignores a set elevation (a set passes its elevation to every view; the spec refuses one no pictorial reads), so it keeps the camera written before the field existed, bit for bit"
        ).toEqual(perspective);
        const perspectiveFocusAtFourDiagonals = cameraForView({
          view: "top-perspective",
          box,
          focusDiagonals: O.some(4),
        }).focus;
        assertSome(perspectiveFocusAtFourDiagonals, 4 * Math.hypot(40, 30, 20));
      })
    );

    it.effect(
      "cameras: a two-point pictorial looks level from above the top or below the bottom, seeing the box's near corner at the elevation",
      Effect.fnUntraced(function* () {
        const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
        const diagonal = Math.hypot(40, 30, 20);
        const az = Math.PI / 6;
        const el = (20 * Math.PI) / 180;
        const level = (view: "top-perspective" | "bottom-perspective") =>
          cameraForView({ view, box, projection: "two-point", azimuthDeg: O.some(30), elevationDeg: O.some(20) });
        const top = level("top-perspective");
        const bottom = level("bottom-perspective");
        A.forEach([top, bottom], (camera) => {
          expect(
            camera.eye[0],
            "a level line of sight along the azimuth, up +Z: the view plane is upright, so verticals stay vertical"
          ).toBeCloseTo(-Math.sin(az), 12);
          expect(camera.eye[1]).toBeCloseTo(-Math.cos(az), 12);
          expect(camera.eye[2]).toBe(0);
          expect(camera.up).toEqual([0, 0, 1]);
          assertSome(camera.focus, 2.5 * diagonal);
          expect([camera.target[0], camera.target[1]]).toEqual([20, 15]);
        });
        const reach = (Math.sin(az) * 40 + Math.cos(az) * 30) / 2;
        const depth = 2.5 * diagonal - reach;
        expect(
          Math.atan2(top.target[2] - 20, depth),
          "the eye stands focus from the target along the eye direction, so its depth to the face's nearest point (the near corner, reach from the centre along the sight line) is focus − reach, and that point sits el below it"
        ).toBeCloseTo(el, 12);
        expect(
          Math.atan2(0 - bottom.target[2], depth),
          "from below, the near corner sits el above the eye"
        ).toBeCloseTo(el, 12);
        const nearTop = [0, 0, 20] as const;
        const along = (p: readonly [number, number, number]) =>
          (p[0] - top.target[0]) * top.eye[0] + (p[1] - top.target[1]) * top.eye[1];
        expect(
          along(nearTop),
          "the near corner of the top face lies reach along the sight line from the target"
        ).toBeCloseTo(reach, 9);
        expect(
          Math.atan2(top.target[2] - nearTop[2], 2.5 * diagonal - along(nearTop)),
          "the near corner of the top face drops el below the eye"
        ).toBeCloseTo(el, 12);
        const sightOf = (camera: typeof top) => O.getOrThrow(camera.sight);
        expect(
          sightOf(top)[0] / sightOf(top)[1],
          "the sight runs from the box centre toward the eye point"
        ).toBeCloseTo(Math.tan(az), 12);
        expect(sightOf(top)[2], "the top sight's end stands above the box centre").toBeCloseTo(top.target[2] - 10, 9);
        expect(sightOf(bottom)[2]).toBeCloseTo(bottom.target[2] - 10, 9);
        expect(sightOf(bottom)[2], "the bottom sight's end stands below the box centre").toBeLessThan(0);
        expect(
          top.hiddenLinePassAbout,
          "its hidden-line pass runs about its target, which stands well clear of the model"
        ).toBe("target");
        expect(bottom.hiddenLinePassAbout).toBe("target");
        const plain = cameraForView({ view: "top-perspective", box, projection: "two-point" });
        const plainReach = (Math.SQRT1_2 * 40 + Math.SQRT1_2 * 30) / 2;
        expect(
          Math.atan2(plain.target[2] - 20, 2.5 * diagonal - plainReach),
          "without an elevation it sees the near corner at 20°"
        ).toBeCloseTo(el, 12);
        expect(plain.eye[0], "without an azimuth it looks along 45°").toBeCloseTo(plain.eye[1], 12);
        expect(
          Math.atan2(
            cameraForView({ view: "top-perspective", box, projection: "two-point", elevationDeg: O.some(30) })
              .target[2] - 20,
            2.5 * diagonal - plainReach
          ),
          "its field stays within half the 60° cone of vision"
        ).toBeCloseTo(Math.PI / 6, 12);
        expect(() =>
          cameraForView({ view: "top-perspective", box, projection: "two-point", elevationDeg: O.some(31) })
        ).toThrow();
        expect(
          cameraForView({ view: "top-perspective", box, projection: "isometric", elevationDeg: O.some(60) }).eye[2],
          "an isometric takes any elevation below a plan"
        ).toBeCloseTo(Math.sin(Math.PI / 3), 12);
        const nearerEyeFocus = cameraForView({
          view: "top-perspective",
          box,
          projection: "two-point",
          focusDiagonals: O.some(1.5),
        }).focus;
        assertSome(nearerEyeFocus, 1.5 * diagonal);
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
        expect(cameraForView({ view: "left", box, planFacing: "right" }), "elevations ignore the plan facing").toEqual(
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
        const d = sheetGeometry(SheetOptions.make({}));
        expect(d.labels.top, "default: the labels sit at the safety gap, exactly where they always did").toBe(
          d.sight.top
        );
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
        const ys = A.map([...Str.matchAll(/[ML](-?\d+\.\d+) (-?\d+\.\d+)/g)(svg)], (m) => Number(m[2]));
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
        const sha256Hex2 = yield* sha256Hex(svg);
        expect(sha256Hex2).toBe("dcfb8611b16781c15f0caf34506a913c44d795e88ce09fc01e6a33bb2b1f6112");
        const plain = composeStyled(3, SheetOptions.make({}));
        expect(plain, "without label styles the sheet keeps its single stroked label path").toContain(
          '<path id="labels" d="M'
        );
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
          expect(
            Math.abs(ink.minY - g.labels.top),
            '"n/8": the slash rises above the cap height, and the ink top still lands on the label line'
          ).toBeLessThan(0.01);
          expect(
            Math.abs(ink.maxY - g.labels.bottom),
            "inkBox reduces a label's hundreds of thousands of sampled points: spread into one call they exceed its argument limit"
          ).toBeLessThan(0.01);
          const top = inkBox(d, (piece) => piece[0]![1] < g.page.height / 2);
          expect(
            Math.abs((top.minX + top.maxX) / 2 - centreX),
            "the sheet number is centred between the side margins"
          ).toBeLessThan(0.01);
          expect(g.figure.top, "the figure area keeps clear of both labels").toBeGreaterThan(ink.minY + 18 * 0.7);
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
        const decoded3 = yield* decode({ typeface: "stroke", sizePt: 18 });
        expect(labelFontFamily(decoded3)).toBe("Times New Roman");
        const decoded4 = yield* decode({ typeface: "serif", sizePt: 24, render: "text" });
        expect(labelFontFamily(decoded4)).toBe("Times New Roman");
        const decoded5 = yield* decode({ typeface: "sans", sizePt: 18, render: "text", fontFamily: "Liberation Sans" });
        expect(labelFontFamily(decoded5)).toBe("Liberation Sans");
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
          sheetNumberLabel: LabelStyle.makeOption({ typeface: "sans", sizePt: 18, render: "text" }),
          figureLabel: LabelStyle.makeOption({ typeface: "serif", sizePt: 24, render: "text" }),
        });
        const g = sheetGeometry(text);
        const centreX = (g.sight.left + g.sight.right) / 2;
        const svg = composeStyled(1, text);
        expect(outlinesOf(svg)).toBe("");
        expect(svg).not.toContain('id="labels"');
        const elements = A.fromIterable(
          Str.matchAll(
            /<text x="([\d.]+)" y="([\d.]+)" font-family="([^"]+)" font-size="([\d.]+)" text-anchor="middle" fill="#000000">([^<]+)<\/text>/g
          )(svg)
        );
        expect(A.map(elements, (m) => [m[3], m[4], m[5]])).toEqual([
          ["Arial", "18.000", "1/8"],
          ["Times New Roman", "24.000", "FIG. 1"],
        ]);
        for (const m of elements) {
          expect(Number(m[1])).toBeCloseTo(centreX, 3);
        }
        const [top, bottom] = A.map(elements, (m) => Number(m[2]));
        expect(
          top! - g.labels.top,
          "the sheet number's ink top, about one cap height above its baseline, sits on the top label line"
        ).toBeGreaterThan(18 * 0.6);
        expect(top! - g.labels.top).toBeLessThan(18 * 0.8);
        expect(
          Math.abs(bottom! - g.labels.bottom),
          "the FIG. ink bottom, its baseline, sits on the bottom label line"
        ).toBeLessThan(0.5);
        expect(
          sheetGeometry(text).figure,
          "the figure area is the outline route's: the bands measure the same face"
        ).toEqual(sheetGeometry(styled).figure);
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
        deepStrictEqual(
          A.map(labelTextFindings({ page: 1, pages: 8, text: "11/8\nFIG. 10\n", options }), (f) => [f.code, f.page]),
          [
            ["label-missing", O.some(1)],
            ["label-missing", O.some(1)],
          ],
          "FIG. 10 does not carry FIG. 1; 11/8 does not carry 1/8"
        );
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
        const step = 0.04 * (72 / 25.4);
        for (const n of A.range(1, 8)) {
          const squareMm = (largestInkSquarePt(outlinesOf(composeStyled(n)), step) * 25.4) / 72;
          expect(
            squareMm,
            "measured 0.84 mm on every sheet at this 0.04 mm sampling (0.86 mm at 0.02 mm), serif 24 pt and sans 18 pt"
          ).toBeLessThan(1.5);
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
        expect(clean.containerDiscovery).toBe("complete");
        const legacy = yield* S.decodeEffect(PdfFacts)({
          headerVersion: "1.6",
          pages: [letter],
          fonts: [],
          annotationCount: 0,
          hasOptionalContent: false,
          encrypted: false,
          undecodableStreams: [],
          streamCheck: "complete",
        });
        expect(legacy.containerDiscovery).toBe("complete");
        for (const containerDiscovery of ["limit-reached", "encrypted"] as const) {
          const incomplete = structuralFindings({
            facts: PdfFacts.make({ ...clean, containerDiscovery }),
            options: ValidationOptions.make({ expectedPages: O.some(1) }),
          });
          expect(A.map(incomplete, (finding) => finding.code)).toEqual(["pdf-stream-undecodable"]);
          expect(incomplete[0]!.message).toContain("global stream inspection is incomplete");
        }
        const truncated = PdfFacts.make({
          ...clean,
          undecodableStreams: [
            PdfStreamFact.make({ objectNumber: 5, generation: 0, reason: "unexpected end of file" }),
            PdfStreamFact.make({ objectNumber: 9, generation: 0, reason: "incorrect header check" }),
          ],
        });
        const undecodable = structuralFindings({
          facts: truncated,
          options: ValidationOptions.make({ expectedPages: O.some(1) }),
        });
        expect(
          A.map(undecodable, (f) => f.code),
          "a FlateDecode stream a strict reader refuses fails the set, with every such stream named"
        ).toEqual(["pdf-stream-undecodable"]);
        assertNone(undecodable[0]!.page);
        expect(undecodable[0]!.message).toBe(
          "2 FlateDecode stream(s) fail a strict inflate: 5 0 R (unexpected end of file), 9 0 R (incorrect header check)."
        );
        const unchecked = structuralFindings({
          facts: PdfFacts.make({ ...clean, streamCheck: "limit-reached" }),
          options: ValidationOptions.make({ expectedPages: O.some(1) }),
        });
        expect(
          A.map(unchecked, (f) => [f.code, f.message]),
          "a check that stopped at the inflate limit leaves later streams unverified: it fails the set too"
        ).toEqual([
          [
            "pdf-stream-undecodable",
            "The strict-inflate check stopped at the inflate limit before every FlateDecode stream was checked, so the file is unverified.",
          ],
        ]);
        const truncatedAndUnchecked = structuralFindings({
          facts: PdfFacts.make({ ...truncated, streamCheck: "limit-reached" }),
          options: ValidationOptions.make({ expectedPages: O.some(1) }),
        });
        expect(A.map(truncatedAndUnchecked, (f) => f.message)).toEqual([
          "2 FlateDecode stream(s) fail a strict inflate: 5 0 R (unexpected end of file), 9 0 R (incorrect header check). The check stopped at the inflate limit, so the FlateDecode streams after it were not checked.",
        ]);
        expect(
          A.map(
            structuralFindings({
              facts: PdfFacts.make({ ...clean, encrypted: true, streamCheck: "encrypted" }),
              options: ValidationOptions.make({ expectedPages: O.some(1) }),
            }),
            (f) => f.code
          ),
          "an encrypted file's streams are not checked; the encrypted finding alone fails it"
        ).toEqual(["encrypted"]);
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
          inkBounds: InkBounds.makeOption({ minX: 200, minY: 200, maxX: 2500, maxY: 3250 }),
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
          const written = yield* fs.readFileString(path.join(out, "manifest.json"));
          const decoded = yield* S.decodeEffect(RenderManifestJson)(written);
          expect(decoded, "the written manifest decodes back to the returned one (it feeds drawings sign)").toEqual(
            manifest
          );
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
          expect(shadedSvg, "0.2 mm shading").toContain('stroke-width="0.567"');
          expect(shadedSvg, "under 0.35 mm outlines").toContain('stroke-width="0.992"');
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
          expect(broken.manifest.scale, "the broken segment lies inside the outline, so the scale is unchanged").toBe(
            solid.manifest.scale
          );
        })
      );

      it.effect(
        "draws emphasis overlays as a heavier layer and records them only when drawn",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const service = yield* FigureSet;
          const figures = [{ view: "front", description: "is a front elevation view" }];
          const render = Effect.fnUntraced(function* (name: string, text: string) {
            const specPath = path.join(dir, `${name}.json`);
            yield* fs.writeFileString(specPath, text);
            const out = path.join(dir, name);
            const manifest = yield* service.render(RenderRequest.make({ specPath, outputDir: out, validate: false }));
            return {
              manifest,
              svg: yield* fs.readFileString(path.join(out, "fig-1.svg")),
              json: yield* fs.readFileString(path.join(out, "manifest.json")),
            };
          });
          const seat = {
            name: "seat",
            style: "emphasis",
            points: [
              [0, 0, 0],
              [10, 0, 0],
            ],
            facing: [0, -1, 0],
          };
          const plain = yield* render("plain", spec(figures));
          const emphasised = yield* render(
            "emphasis",
            spec(figures, [], { sheet: { emphasisWeightMm: 1 } }, body, [], [seat])
          );
          expect(plain.svg, "a render without overlays writes no emphasis layer").not.toContain('id="emphasis"');
          expect(plain.json, "a render without overlays writes no emphasis count").not.toContain("emphasisSegments");
          assertNone(plain.manifest.figures[0]!.emphasisSegments);
          expect(emphasised.svg).toContain('<path id="emphasis" d="M');
          expect(emphasised.svg).toContain(
            'stroke-width="2.835" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>'
          );
          assertSome(emphasised.manifest.figures[0]!.emphasisSegments, 1);
          const value6 = yield* S.decodeEffect(RenderManifestJson)(emphasised.json);
          expect(value6).toEqual(emphasised.manifest);
          expect(emphasised.manifest.scale, "the emphasis line runs along the outline, so the scale is unchanged").toBe(
            plain.manifest.scale
          );
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
          const written = yield* fs.readFileString(path.join(dir, "out", "manifest.json"));
          const value7 = yield* S.decodeEffect(RenderManifestJson)(written);
          expect(value7, "the manifest round-trips").toEqual(manifest);
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
          expect(
            error.message,
            "the parser loaded and rejected the bytes: a failed opentype.js import has another message"
          ).toContain("could not be parsed");
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
          const madeBoxGlyphLabelFont = yield* makeBoxGlyphLabelFont("0123456789IG./ ");
          yield* fs.writeFile(incompleteFont, madeBoxGlyphLabelFont);
          const incomplete = yield* renderWith(incompleteFont);
          expect(incomplete.reason).toBe("font");
          expect(incomplete.message).toContain('the font has no glyph for "F"');
          const exists8 = yield* fs.exists(outputDir);
          expect(exists8).toBe(false);
        })
      );

      it.effect(
        "outlines an operator font file on every runner and records its sha256",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const bytes = yield* boxGlyphLabelFont;
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
          expect(
            outlinesOf(svg),
            '"1/1" in the box face: three 400 x 700 unit boxes, every corner a straight line'
          ).toMatch(/^M[\d. LZM-]+$/);
          expect(
            inkBox(outlinesOf(svg)).maxY - inkBox(outlinesOf(svg)).minY,
            "a box glyph's ink is 700 units of the 1000-unit em"
          ).toBeCloseTo((18 * 700) / 1000, 2);
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
            const readFileString9 = yield* fs.readFileString(path.join(outputDir, "fig-1.svg"));
            expect(readFileString9).toContain("Q");
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
          const bytes = yield* boxGlyphLabelFont;
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
          const readFileString10 = yield* fs.readFileString(path.join(dir, "out", "sheets.pdf.fonts.json"));
          const pinned = yield* decodeJson(readFileString10);
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
          const g = sheetGeometry(manifest.sheet.pipe(O.getOrThrow));
          const ys = A.map(A.fromIterable(Str.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)(svg)), (m) => Number(m[1]));
          expect(
            ys[0],
            "the loaded face places the text: a 700-unit box glyph has its ink top 12.6 pt (18 pt × 0.7) above the baseline"
          ).toBeCloseTo(g.labels.top + 12.6, 3);
          expect(ys[1], "the box glyph's ink bottom sits on the baseline").toBeCloseTo(g.labels.bottom, 3);
          const codesFromTextlessFake = O.map(manifest.validation, (v) => A.map(v.findings, (f) => [f.code, f.page]));
          assertSome(codesFromTextlessFake, [
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
          const argument1 = path.join(dir, "boxes.otf");
          const boxGlyphLabelFont1 = yield* boxGlyphLabelFont;
          yield* fs.writeFile(argument1, boxGlyphLabelFont1);
          const noArial = yield* renderWith({ sheetNumberLabel: label, fontDirectory: dir });
          expect(noArial.reason).toBe("font");
          expect(noArial.message).toContain('no Regular font of the family "Arial"');
          const argument2 = path.join(dir, "boxes-copy.otf");
          const boxGlyphLabelFont2 = yield* boxGlyphLabelFont;
          yield* fs.writeFile(argument2, boxGlyphLabelFont2);
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
          const sansFile = "/usr/share/fonts/liberation/LiberationSans-Regular.ttf";
          const serifFile = "/usr/share/fonts/liberation/LiberationSerif-Regular.ttf";
          if (!(yield* fs.exists(sansFile)) || !(yield* fs.exists(serifFile))) {
            context.skip(
              `Missing ${sansFile} or ${serifFile}: hosted runners do not install the vendored faces' source fonts`
            );
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
          expect(
            supplied.svg,
            "byte-equal sheets prove the committed glyph data still matches its recorded sources"
          ).toBe(vendored.svg);
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
        "threads the set elevation and focus into two-point pictorials, and checks them",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped();
          const specPath = path.join(dir, "spec.json");
          const service = yield* FigureSet;
          const renderSpec = (contents: string) =>
            fs
              .writeFileString(specPath, contents)
              .pipe(
                Effect.andThen(
                  service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "out"), validate: false }))
                )
              );
          const figures = [
            { view: "top-perspective", description: "is a top view", projection: "two-point" },
            { view: "front", description: "is a front elevation view" },
          ];
          const manifest = yield* renderSpec(
            spec(figures, [{ omitted: "bottom-perspective", shown: "top-perspective", relation: "identical" }], {
              pictorialAzimuthDeg: 30,
              pictorialElevationDeg: 20,
              pictorialFocusDiagonals: 3,
            })
          );
          const fakeModelBoxDiagonal = Math.hypot(10, 5, 5);
          const camera = O.getOrThrow(manifest.figures[0]!.camera);
          expect(camera.eye[2]).toBe(0);
          assertSome(camera.focus, 3 * fakeModelBoxDiagonal);
          const reach = (Math.sin(Math.PI / 6) * 10 + Math.cos(Math.PI / 6) * 5) / 2;
          expect(Math.atan2(camera.target[2] - 5, 3 * fakeModelBoxDiagonal - reach)).toBeCloseTo(
            (20 * Math.PI) / 180,
            12
          );
          assertSome(
            O.map(camera.sight, (sight) => sight[2] > 0),
            true
          );
          const written = yield* fs.readFileString(path.join(dir, "out", "manifest.json"));
          expect(written, "the camera, sight included, round-trips through the manifest").toContain('"sight"');
          const value11 = yield* S.decodeEffect(RenderManifestJson)(written);
          expect(value11).toEqual(manifest);
          const plain = yield* renderSpec(
            spec(
              [{ view: "top-perspective", description: "is a top view", projection: "isometric" }, figures[1]!],
              [],
              {
                pictorialElevationDeg: 20,
              }
            )
          );
          assertNone(O.getOrThrow(plain.figures[0]!.camera).sight);
          const plainWritten = yield* fs.readFileString(path.join(dir, "out", "manifest.json"));
          expect(plainWritten, "a set without a two-point pictorial writes no sight").not.toContain('"sight"');
          expect(plainWritten).not.toContain('"hiddenLinePassAbout"');
          expect(written).toContain('"hiddenLinePassAbout":"target"');
          const refused = (contents: string) => Effect.flip(renderSpec(contents)).pipe(Effect.map((e) => e.reason));
          const refused12 = yield* refused(spec(figures, [], { pictorialElevationDeg: 0 }));
          expect(refused12, "the elevation lies strictly above level").toBe("spec");
          const refused13 = yield* refused(spec(figures, [], { pictorialElevationDeg: 90 }));
          expect(refused13, "the elevation lies strictly below plan").toBe("spec");
          const refused14 = yield* refused(spec(figures, [], { pictorialFocusDiagonals: 0.9 }));
          expect(refused14, "the focus keeps the eye a diagonal clear").toBe("spec");
          const refused15 = yield* refused(
            spec([{ view: "front", description: "is a front elevation view", projection: "two-point" }])
          );
          expect(refused15, "a two-point projection belongs to a pictorial only").toBe("spec");
          const refused16 = yield* refused(spec(figures, [], { pictorialElevationDeg: 31 }));
          expect(
            refused16,
            "a two-point field stays within half the 60° cone of vision, also for an omitted pictorial claimed from a two-point figure"
          ).toBe("spec");
          const isometricTop = { view: "top-perspective", description: "is a top view", projection: "isometric" };
          const perspectiveTop = { view: "top-perspective", description: "is a top view" };
          const refused17 = yield* refused(spec([perspectiveTop, figures[1]!], [], { pictorialElevationDeg: 20 }));
          expect(
            refused17,
            "an elevation needs an isometric or two-point pictorial to read it: on a set without one it would render the set unchanged"
          ).toBe("spec");
          const refused18 = yield* refused(spec([isometricTop, figures[1]!], [], { pictorialFocusDiagonals: 3 }));
          expect(
            refused18,
            "a focus needs a perspective or two-point pictorial to read it: on a set without one it would render the set unchanged"
          ).toBe("spec");
          const refused19 = yield* refused(
            spec([figures[1]!], [{ omitted: "rear", shown: "front", relation: "identical" }], {
              pictorialElevationDeg: 20,
              pictorialFocusDiagonals: 3,
            })
          );
          expect(
            refused19,
            "an elevation and its omitted rear read neither the elevation nor the focus, so the set is refused"
          ).toBe("spec");
          const refused20 = yield* refused(
            spec([figures[1]!], [{ omitted: "bottom-perspective", shown: "top-perspective", relation: "identical" }], {
              pictorialFocusDiagonals: 3,
            })
          );
          expect(
            refused20,
            "a missing shown figure uses the default perspective for camera checks, then fails omission validation"
          ).toBe("omission");
          const mirrored = yield* renderSpec(
            spec(
              [perspectiveTop, figures[1]!],
              [{ omitted: "bottom-perspective", shown: "top-perspective", relation: "identical" }],
              { pictorialFocusDiagonals: 3 }
            )
          );
          const omittedReadsClaimedFocus = O.flatMap(mirrored.figures[0]!.camera, (camera) => camera.focus);
          assertSome(omittedReadsClaimedFocus, 3 * fakeModelBoxDiagonal);
          const mixed = yield* renderSpec(
            spec([isometricTop, { view: "bottom-perspective", description: "is a bottom view" }, figures[1]!], [], {
              pictorialElevationDeg: 20,
              pictorialFocusDiagonals: 3,
            })
          );
          const mixedIsometricFocus = O.getOrThrow(mixed.figures[0]!.camera).focus;
          const mixedPerspectiveFocus = O.getOrThrow(mixed.figures[1]!.camera).focus;
          assertNone(mixedIsometricFocus);
          assertSome(mixedPerspectiveFocus, 3 * fakeModelBoxDiagonal);
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
          expect(
            error.reason,
            "the fake engine projects the rear camera (eye +Y) shifted, so the identical-omission claim fails"
          ).toBe("omission");
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

const geometryVocabulary = [Box, ModelSpec, Part];
void geometryVocabulary;

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
        const service = yield* FigureSet;
        const report = yield* service.validate(pdfPath, ValidationOptions.make({ expectedPages: O.none() }));
        expect(
          report.pageCount,
          "the fake backend reads the empty document's own page count; A.makeBy(0, f) would still yield one page"
        ).toBe(0);
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
        assertNone(unbound.manifest.approver);
        expect(unbound.written).not.toContain("approver");
      })
    );
  });
});

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
        expect(
          A.length(gradedPlans),
          "only this block's one test uses this fresh layer, so concurrent tests elsewhere cannot add plans to it"
        ).toBe(1);
        const plan = gradedPlans[0];
        expect([plan?.style, plan?.axis]).toEqual(["graded", "surface-class"]);
        expect(plan?.minFaceSpan).toBeCloseTo((1.5 * PT_PER_MM) / manifest.scale, 9);
        expect(plan?.minStroke).toBeCloseTo((2 * PT_PER_MM) / manifest.scale, 9);
        expect(
          O.getOrElse(plan?.ladderReach ?? O.none(), () => Number.NaN),
          "the kernel's ladder reach is the validator's, 2.5 mm on the sheet"
        ).toBeCloseTo((2.5 * PT_PER_MM) / manifest.scale, 9);
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
        const unshaded = yield* service.render(RenderRequest.make({ specPath, outputDir: path.join(dir, "plain") }));
        assertNone(unshaded.figures[0]!.shadingCoverage);
        assertSome(
          O.map(unshaded.validation, (v) => v.findings.length),
          0
        );
        const uniformSpec = path.join(dir, "uniform.json");
        yield* fs.writeFileString(
          uniformSpec,
          spec([{ view: "front", description: "is a front elevation view" }], [], {})
        );
        const uniform = yield* service.render(
          RenderRequest.make({ specPath: uniformSpec, outputDir: path.join(dir, "uniform"), shade: true })
        );
        const uniformCodesWithoutGradedChecks = O.map(uniform.validation, (v) => A.map(v.findings, (f) => f.code));
        assertSome(uniformCodesWithoutGradedChecks, []);
      })
    );
  });
});

const ladderScene = {
  shading: [
    [4.75, 1, 4.75, 4],
    [4.9, 1, 4.9, 4],
    [5, 1, 5, 4],
  ] as const,
  visible: [
    [5.07, 1, 5.07, 4],
    [5.16, 1, 5.16, 4],
    [5.22, 1, 5.22, 4],
  ] as const,
};

describe("graded shading ladder through fake ports", () => {
  it.layer(
    Layer.fresh(FigureSet.layer).pipe(
      Layer.provide(Layer.merge(fakeEngineWith([], ladderScene), fakeBackend)),
      Layer.provideMerge(NodeServices.layer)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "flags a band that reads as one ladder with the lines beyond its edge in the render's validation",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const specPath = path.join(dir, "spec.json");
        yield* fs.writeFileString(
          specPath,
          spec([{ view: "front", description: "is a front elevation view" }], [], {
            sheet: { shadingStyle: "graded", shadingAxis: "surface-class" },
          })
        );
        const manifest = yield* (yield* FigureSet).render(
          RenderRequest.make({ specPath, outputDir: path.join(dir, "out"), shade: true })
        );
        const mmPerUnit = manifest.scale / PT_PER_MM;
        expect(
          mmPerUnit,
          "the ladder scene reads as one ladder at any scale from 5 to 24 mm a unit; this render's scale lies in that range"
        ).toBeGreaterThan(5);
        expect(mmPerUnit).toBeLessThan(24);
        assertTrue(
          O.exists(manifest.validation, (v) =>
            A.some(v.findings, (f) => f.code === "shading-band-ladder" && O.contains(f.page, 1))
          ),
          "a three-line band (gaps 0.1 and 0.15 units) 0.07 from its edge, with lines 0.09 and 0.15 beyond it: the gaps clear the spacing floor, the lines lie within its reach, the band within one companion distance"
        );
      })
    );
  });
});

const engineDrawing = (
  lines: ReadonlyArray<FakeSegment>,
  strokes: ReadonlyArray<FakeSegment> = [],
  bands: ReadonlyArray<ShadingBand> = []
) =>
  Layer.succeed(
    GeometryEngine,
    GeometryEngine.of({
      info: Effect.succeed(EngineInfo.make({ name: "fake", version: "0", binarySha256: "" })),
      summarize: Effect.fnUntraced(function* () {
        return ModelSummary.make({
          boundingBox: BoundingBox.make({ min: [0, 0, 0], max: [10, 5, 5] }),
          volume: 250,
          faceCount: 6,
          edgeCount: 12,
          partOverlaps: 0,
        });
      }),
      project: Effect.fnUntraced(function* (_model, cameras, shading) {
        return A.map(cameras, () =>
          EdgeSet.make({
            visible: [...square, ...lines],
            hidden: [],
            shading: O.match(shading, { onNone: A.empty, onSome: () => strokes }),
            shadingCoverage: O.map(shading, () =>
              ShadingCoverage.make({
                shadedFaces: Math.max(1, A.length(A.dedupe(A.map(bands, (band) => band.face)))),
                skippedFaces: [],
              })
            ),
            shadingBands: O.match(shading, { onNone: A.empty, onSome: () => bands }),
          })
        );
      }),
    })
  );

const sheetScale = commonScale({ views: [square], options: SheetOptions.make({}) });
const unitsPerMm = PT_PER_MM / sheetScale;
const lift = 0.4 * unitsPerMm;
const closeLine: FakeSegment = [1, lift, 9, lift];
const teeOnCloseLine: FakeSegment = [5, lift, 5, 3];
const closeScene: ReadonlyArray<FakeSegment> = [closeLine, teeOnCloseLine];
const figureSegmentsMm = (svg: string, layer = "figure"): ReadonlyArray<Segment2> =>
  pipe(
    new RegExp(`<path id="${layer}" d="([^"]*)"`).exec(svg)?.[1] ?? "",
    (d) => [...Str.matchAll(/M(-?\d+\.\d+) (-?\d+\.\d+)L(-?\d+\.\d+) (-?\d+\.\d+)/g)(d)],
    A.map((m) => Segment2.make([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])])),
    A.map(([x1, y1, x2, y2]) => Segment2.make([x1 / PT_PER_MM, y1 / PT_PER_MM, x2 / PT_PER_MM, y2 / PT_PER_MM]))
  );

describe("outline spacing through fake ports", () => {
  it.layer(
    Layer.fresh(FigureSet.layer).pipe(
      Layer.provide(Layer.merge(engineDrawing(closeScene), fakeBackend)),
      Layer.provideMerge(NodeServices.layer)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "opens outlines drawn closer than 0.7 mm on the sheet, records the move, and validates clean",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const specPath = path.join(dir, "spec.json");
        yield* fs.writeFileString(specPath, spec([{ view: "front", description: "is a front elevation view" }]));
        const outputDir = path.join(dir, "out");
        const manifest = yield* (yield* FigureSet).render(RenderRequest.make({ specPath, outputDir }));
        expect(manifest.scale).toBe(sheetScale);
        const projectedMm = A.map([...square, ...closeScene], ([x1, y1, x2, y2]) =>
          Segment2.make([x1 / unitsPerMm, y1 / unitsPerMm, x2 / unitsPerMm, y2 / unitsPerMm])
        );
        const options = ValidationOptions.make({ expectedPages: O.none() });
        expect(
          A.map(outlineSpacingFindings({ page: 1, segmentsMm: projectedMm, options }), (f) => f.message),
          "drawn as the engine projects them, the bottom edge and the close line beside it (a thin board's bottom face seen nearly edge-on) print 0.4 mm apart"
        ).toEqual([expect.stringContaining("closest are 0.4 mm apart")]);
        const readFileString21 = yield* fs.readFileString(path.join(outputDir, "fig-1.svg"));
        const drawn = figureSegmentsMm(readFileString21);
        expect(A.length(drawn), "on the sheet the moved line is still a second line").toBe(
          A.length(square) + A.length(closeScene)
        );
        const tolerances = { minOverlap: 1, coincidence: OUTLINE_COINCIDENCE_MM };
        expect(closeOutlineGaps({ segments: drawn, minSpacing: 0.7, ...tolerances })).toEqual([]);
        const [pair = 0] = closeOutlineGaps({ segments: drawn, minSpacing: 0.75, ...tolerances });
        expect(
          pair,
          "the line moved 0.305 mm to stand 0.7 mm clear, with a 0.005 mm margin for the printed coordinates"
        ).toBeCloseTo(0.705, 3);
        const [, , , , moved = Segment2.make([0, 0, 0, 0]), tee = Segment2.make([0, 0, 0, 0])] = drawn;
        expect(Math.abs(tee[1] - moved[1]), "the T-end followed the moved line").toBeLessThan(1e-3);
        const figure = manifest.figures[0];
        assertSome(
          O.map(figure?.outlineSeparations ?? O.none<OutlineSeparation>(), (separation) => [
            separation.lines,
            Math.round(separation.largestMoveMm * 1e6) / 1e6,
          ]),
          [1, 0.305]
        );
        expect(figure?.visibleSegments).toBe(A.length(square) + A.length(closeScene));
        assertSome(
          O.map(manifest.validation, (v) => A.map(v.findings, (f) => f.code)),
          []
        );
      })
    );
  });
});

const strokeFoot = lift + 0.65 * unitsPerMm;
const faceStrokes: ReadonlyArray<FakeSegment> = A.map([2, 3, 7, 8], (x) => [x, strokeFoot, x, 4] as const);

describe("graded shading beside a separated outline through fake ports", () => {
  it.layer(
    Layer.fresh(FigureSet.layer).pipe(
      Layer.provide(Layer.merge(engineDrawing(closeScene, faceStrokes), fakeBackend)),
      Layer.provideMerge(NodeServices.layer)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "clips graded strokes again where the separation moves an outline toward their ends",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const specPath = path.join(dir, "spec.json");
        yield* fs.writeFileString(
          specPath,
          spec([{ view: "front", description: "is a front elevation view" }], [], {
            sheet: { shadingStyle: "graded", shadingAxis: "surface-class" },
          })
        );
        const outputDir = path.join(dir, "out");
        const manifest = yield* (yield* FigureSet).render(RenderRequest.make({ specPath, outputDir, shade: true }));
        const svg = yield* fs.readFileString(path.join(outputDir, "fig-1.svg"));
        const strokes = figureSegmentsMm(svg, "shading");
        const outline = figureSegmentsMm(svg, "figure");
        const clearances = A.flatMap(strokes, ([x1, y1, x2, y2]) => [
          nearestOutlineDistance({ x: x1, y: y1, outlines: outline }),
          nearestOutlineDistance({ x: x2, y: y2, outlines: outline }),
        ]);
        expect(A.length(strokes)).toBe(A.length(faceStrokes));
        expect(
          Math.min(...clearances),
          "the strokes' feet stood 0.65 mm above the close line, clear of the 0.6 mm clearance (half the 1.2 mm least pitch); the line moved 0.305 mm toward them, and every stroke end stands the plan's 0.6 mm clear of every drawn line again"
        ).toBeGreaterThanOrEqual(0.6 - 1e-3);
        expect(Math.min(...clearances), "the strokes are cut back by no more than the clearance").toBeCloseTo(0.6, 2);
        const figure = manifest.figures[0];
        expect(figure?.shadingSegments).toBe(A.length(faceStrokes));
        assertSome(
          O.map(figure?.outlineSeparations ?? O.none<OutlineSeparation>(), (separation) => [
            separation.lines,
            separation.trimmedStrokes,
            separation.droppedStrokes,
          ]),
          [1, 4, 0]
        );
        assertSome(
          O.map(manifest.validation, (v) => A.map(v.findings, (f) => f.code)),
          []
        );
      })
    );
  });
});

const shortStroke = 1.2 * unitsPerMm;
const shortAt = (x: number): FakeSegment => [x, strokeFoot, x, strokeFoot + shortStroke];
const longAt = (x: number): FakeSegment => [x, strokeFoot, x, 4];
const twoFaceBands = [ShadingBand.make({ face: 0, strokes: [0, 1] }), ShadingBand.make({ face: 1, strokes: [2, 3] })];

const reclipLayer = (strokes: ReadonlyArray<FakeSegment>) =>
  Layer.fresh(FigureSet.layer).pipe(
    Layer.provide(Layer.merge(engineDrawing(closeScene, strokes, twoFaceBands), fakeBackend)),
    Layer.provideMerge(NodeServices.layer)
  );

const reclippedFaces = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped();
  const specPath = path.join(dir, "spec.json");
  yield* fs.writeFileString(
    specPath,
    spec([{ view: "front", description: "is a front elevation view" }], [], {
      sheet: { shadingStyle: "graded", shadingAxis: "surface-class", shadingMinStrokeMm: 1 },
    })
  );
  const outputDir = path.join(dir, "out");
  const manifest = yield* (yield* FigureSet).render(RenderRequest.make({ specPath, outputDir, shade: true }));
  const svg = yield* fs.readFileString(path.join(outputDir, "fig-1.svg"));
  const figure = manifest.figures[0];
  const squareLeftEdgeMm = Math.min(...A.map(figureSegmentsMm(svg), ([x1, , x2]) => Math.min(x1, x2)));
  return {
    drawn: A.map(figureSegmentsMm(svg, "shading"), ([x1]) => Math.round((x1 - squareLeftEdgeMm) * unitsPerMm)),
    separation: O.map(figure?.outlineSeparations ?? O.none<OutlineSeparation>(), (separation) => [
      separation.trimmedStrokes,
      separation.droppedStrokes,
    ]),
    coverage: O.map(figure?.shadingCoverage ?? O.none<ShadingCoverage>(), (coverage) => [
      coverage.shadedFaces,
      coverage.lostFaces,
      coverage.lostStretches,
    ]),
    findings: O.map(manifest.validation, (v) => A.map(v.findings, (f) => f.code)),
  };
});

describe("a face the re-clip beside a separated outline leaves bare through fake ports", () => {
  it.layer(reclipLayer([shortAt(2), shortAt(3), longAt(7), longAt(8)]), { timeout: "30 seconds" })((it) => {
    it.effect(
      "counts a face whose every stroke the re-clip drops lost in the manifest's coverage and on the sheet",
      Effect.fnUntraced(function* () {
        const render = yield* reclippedFaces();
        expect(
          render.drawn,
          "a 1.2 mm stroke cut back to the 0.6 mm clearance falls under the 1 mm least stroke, so both short strokes of the first face go and the sheet draws only the second face"
        ).toEqual([7, 8]);
        assertSome(render.separation, [2, 2]);
        assertSome(render.coverage, [2, 1, 1]);
        assertSome(render.findings, ["shading-lost-face", "shading-lost-stretch"]);
      })
    );
  });
});

describe("a band the re-clip beside a separated outline leaves with one stroke through fake ports", () => {
  it.layer(reclipLayer([longAt(2), shortAt(3), longAt(7), longAt(8)]), { timeout: "30 seconds" })((it) => {
    it.effect(
      "draws none of the band, as the engine draws no band below two strokes, and counts its face lost",
      Effect.fnUntraced(function* () {
        const render = yield* reclippedFaces();
        expect(
          render.drawn,
          "the first face's long stroke, running on to the top, is cut back and kept while its short one drops; alone it would read as a stray line, so it goes too"
        ).toEqual([7, 8]);
        assertSome(render.separation, [2, 2]);
        assertSome(render.coverage, [2, 1, 1]);
        assertSome(render.findings, ["shading-lost-face", "shading-lost-stretch"]);
      })
    );
  });
});
