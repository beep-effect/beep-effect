import {
  BoundingBox,
  Box,
  Camera,
  Cylinder,
  EdgeSet,
  ModelSpec,
  Occt,
  OcctError,
  OverlayLine,
  Part,
  Prism,
  ProjectionRequest,
  Segment2,
  ShadingPlan,
} from "@beep/occt";
import {
  cameraForView,
  closeOutlineGaps,
  DrawingError,
  EngineInfo,
  FigureSet,
  GeometryEngine,
  InkBounds,
  OUTLINE_COINCIDENCE_MM,
  PageMetrics,
  PdfBackend,
  PdfFacts,
  PdfPageSize,
  PT_PER_MM,
  RenderRequest,
} from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// A 40 × 30 × 20 box with an off-centre wedge on top, so no two principal
// views coincide and the top/bottom distinction is observable.
const fixture = ModelSpec.make({
  parts: [
    Part.make({
      name: "body",
      add: [
        Box.make({ min: [-20, -15, 0], max: [20, 15, 20] }),
        Prism.make({
          profile: [
            [-20, -5, 20],
            [0, -5, 20],
            [-20, -5, 35],
          ],
          extrusion: [0, 20, 0],
        }),
      ],
    }),
  ],
});

const top = Camera.make({ eye: [0, 0, 1], up: [0, 1, 0] });
const bottom = Camera.make({ eye: [0, 0, -1], up: [0, 1, 0] });
const front = Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] });
const persp = (focus: number) =>
  Camera.make({ eye: [90, -120, 65], up: [0, 0, 1], target: [0, 0, 15], focus: O.some(focus) });

const TestLayer = Occt.layer.pipe(Layer.provide(NodeServices.layer));

type Seg = readonly [number, number, number, number];
type Point3 = readonly [number, number, number];

// Where a camera draws a model point: the projector's own frame (right = up × eye, sheet up = eye × right, both about
// the target) under its own projection, as the kernel's view mapping reads it.
const drawnAt = (camera: Camera, p: Point3): readonly [number, number] => {
  const unit = (v: Point3): Point3 => [v[0] / Math.hypot(...v), v[1] / Math.hypot(...v), v[2] / Math.hypot(...v)];
  const cross = (a: Point3, b: Point3): Point3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const direction = unit(camera.eye);
  const right = unit(cross(unit(camera.up), direction));
  const up = cross(direction, right);
  const d: Point3 = [p[0] - camera.target[0], p[1] - camera.target[1], p[2] - camera.target[2]];
  const [u, v, w] = [dot(d, right), dot(d, up), dot(d, direction)];
  return O.match(camera.focus, {
    onNone: () => [u, v] as const,
    onSome: (focus) => [(u * focus) / (focus - w), (v * focus) / (focus - w)] as const,
  });
};

// The drawn segment that joins two model points (the kernel rounds to 0.001), if any.
const joining =
  (camera: Camera, segments: ReadonlyArray<Seg>) =>
  (a: Point3, b: Point3): O.Option<Seg> => {
    const [p, q] = [drawnAt(camera, a), drawnAt(camera, b)];
    const near = (x: number, y: number, at: readonly [number, number]) =>
      Math.abs(x - at[0]) < 2e-3 && Math.abs(y - at[1]) < 2e-3;
    return A.findFirst(
      segments,
      ([x1, y1, x2, y2]) => (near(x1, y1, p) && near(x2, y2, q)) || (near(x1, y1, q) && near(x2, y2, p))
    );
  };

// Sine of the angle between two drawn segments: 0 when parallel.
const turnBetween = ([ax1, ay1, ax2, ay2]: Seg, [bx1, by1, bx2, by2]: Seg): number =>
  Math.abs((ax2 - ax1) * (by2 - by1) - (ay2 - ay1) * (bx2 - bx1)) /
  (Math.hypot(ax2 - ax1, ay2 - ay1) * Math.hypot(bx2 - bx1, by2 - by1));
const totalLength = (segments: ReadonlyArray<Seg>): number =>
  A.reduce(segments, 0, (sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1));

// Generic crate: two plates crossed at 90° with halving slots (the long wall
// slotted from the top, the cross wall from the bottom), a lid with a slit,
// and a tab through the slit drawn in broken lines. Every contact face has
// zero clearance. Mirrors the technical-drawing synthetic-crate fixture.
const box = (min: readonly [number, number, number], max: readonly [number, number, number]) =>
  Box.make({ min: [...min], max: [...max] });
const longWall = Part.make({
  name: "long-wall",
  add: [box([-40, -2, 0], [40, 2, 40])],
  subtract: [box([-2, -3, 20], [2, 3, 41])],
});
const crossWall = Part.make({
  name: "cross-wall",
  add: [box([-2, -30, 0], [2, 30, 40])],
  subtract: [box([-3, -2, -1], [3, 2, 20])],
});
const lid = Part.make({
  name: "lid",
  add: [box([0, -30, 40], [40, 30, 43])],
  subtract: [box([20, -2, 39], [30, 2, 44])],
});
const tab = Part.make({ name: "tab", add: [box([20, -2, 40], [30, 2, 46])], lineStyle: "broken" });
const crate = ModelSpec.make({ parts: [longWall, crossWall, lid, tab] });

const noView = EdgeSet.make({ visible: [], hidden: [] });

// Names the two views of a plan + front projection; a missing view fails the
// test instead of silently reading as empty.
const planAndFront = (views: ReadonlyArray<EdgeSet>): { readonly plan: EdgeSet; readonly front: EdgeSet } => {
  expect(views).toHaveLength(2);
  const [plan = noView, frontView = noView] = views;
  return { plan, front: frontView };
};

// The projection output of this model before broken-line parts existed:
// SHA-256 of the JSON of each view's visible, hidden and shading segments,
// recorded from main 6e390049ca for the cameras and plan below.
const LEGACY_MODEL = ModelSpec.make({
  parts: [
    Part.make({
      name: "body",
      add: [
        Box.make({ min: [-20, -15, 0], max: [20, 15, 20] }),
        Prism.make({
          profile: [
            [-20, -5, 20],
            [0, -5, 20],
            [-20, -5, 35],
          ],
          extrusion: [0, 20, 0],
        }),
      ],
      subtract: [Cylinder.make({ base: [10, 0, -1], axis: [0, 0, 1], radius: 4, height: 30 })],
    }),
    Part.make({ name: "post", add: [Box.make({ min: [-4, -30, 0], max: [4, -24, 30] })] }),
  ],
});
// Re-recorded 2026-10-14: the front view's hidden lines held 49 exact duplicates (two parts meeting on a shared
// plane each reported the boundary); `toSegments` now draws such a line once. Visible and shading output unchanged.
const LEGACY_SHA256 = "6824418a60da2f5a6d77dc7fac46024a7c909aa1552ea78a1e8be18555dd1d42";
const LegacyViews = S.Struct({
  visible: S.Array(Segment2),
  hidden: S.Array(Segment2),
  shading: S.Array(Segment2),
}).pipe(S.Array, S.fromJsonString);
const encodeLegacyViews = S.encodeEffect(LegacyViews);
const sha256Hex = (text: string) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).pipe(
    Effect.map((digest) =>
      pipe(
        A.fromIterable(new Uint8Array(digest)),
        A.map((b) => Str.padStart(2, "0")(b.toString(16))),
        A.join("")
      )
    )
  );

// The kernel as the figure-set renderer's geometry port, as the drawings command wires it.
const kernelEngine = Layer.effect(
  GeometryEngine,
  Effect.gen(function* () {
    const occt = yield* Occt;
    const failed = (cause: unknown) => DrawingError.fromUnknown("geometry", "The kernel failed.", cause);
    return GeometryEngine.of({
      info: Effect.succeed(EngineInfo.make({ name: "occt", version: "test", binarySha256: "" })),
      summarize: Effect.fn("TestEngine.summarize")(function* (model) {
        return yield* occt.summarize(model).pipe(Effect.mapError(failed));
      }),
      project: Effect.fn("TestEngine.project")(function* (model, cameras, shading) {
        return yield* occt
          .project(ProjectionRequest.make({ solid: model, cameras, shading }))
          .pipe(Effect.mapError(failed));
      }),
    });
  })
).pipe(Layer.provide(Occt.layer));

// A PDF backend that writes a placeholder and reports a clean Letter page, so the render validates without tools.
const letterMetrics = (dpi: number, antiAliased: boolean) =>
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

const backend = Layer.effect(
  PdfBackend,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return PdfBackend.of({
      svgToPdf: Effect.fn("TestBackend.svgToPdf")(function* (svgPaths, outputPath) {
        yield* fs.writeFileString(outputPath, `%PDF-1.6 placeholder ${A.length(svgPaths)}`).pipe(Effect.orDie);
      }),
      inspect: Effect.fn("TestBackend.inspect")(function* () {
        return PdfFacts.make({
          headerVersion: "1.6",
          pages: [PdfPageSize.make({ widthPt: 612, heightPt: 792 })],
          fonts: [],
          annotationCount: 0,
          hasOptionalContent: false,
          encrypted: false,
        });
      }),
      measurePage: Effect.fn("TestBackend.measurePage")(function* ({ dpi, antiAlias }) {
        return letterMetrics(dpi, antiAlias);
      }),
      pageText: Effect.fn("TestBackend.pageText")(function* () {
        return "";
      }),
    });
  })
);

// The figure-set renderer over the kernel the enclosing layer builds, so one test file instantiates the WASM once.
const FigureLayer = Layer.fresh(FigureSet.layer).pipe(
  Layer.provide(Layer.merge(kernelEngine, backend)),
  Layer.provideMerge(NodeServices.layer)
);

// An encoded box primitive, as a drawing spec file writes it.
const encodedBox = (min: readonly [number, number, number], max: readonly [number, number, number]) => ({
  kind: "box",
  min,
  max,
});

// An open square tube of four 3 mm boards, 400 x 400 and 300 tall, with two 3 mm plates crossing inside it in a
// halving joint: the plate along x slotted from below, the plate along y from above.
const tube = {
  parts: [
    { name: "front", add: [encodedBox([-200, -200, 0], [200, -197, 300])] },
    { name: "back", add: [encodedBox([-200, 197, 0], [200, 200, 300])] },
    { name: "left", add: [encodedBox([-200, -197, 0], [-197, 197, 300])] },
    { name: "right", add: [encodedBox([197, -197, 0], [200, 197, 300])] },
    {
      name: "along-x",
      add: [encodedBox([-197, -1.5, 0], [197, 1.5, 300])],
      subtract: [encodedBox([-1.5, -2, -1], [1.5, 2, 150])],
    },
    {
      name: "along-y",
      add: [encodedBox([-1.5, -197, 0], [1.5, 197, 300])],
      subtract: [encodedBox([-2, -1.5, 150], [2, 1.5, 301])],
    },
  ],
};

const figureSegmentsMm = (svg: string): ReadonlyArray<Segment2> =>
  pipe(
    /<path id="figure" d="([^"]*)"/.exec(svg)?.[1] ?? "",
    (d) => [...Str.matchAll(/M(-?\d+\.\d+) (-?\d+\.\d+)L(-?\d+\.\d+) (-?\d+\.\d+)/g)(d)],
    A.map((m) =>
      Segment2.make([
        Number(m[1]) / PT_PER_MM,
        Number(m[2]) / PT_PER_MM,
        Number(m[3]) / PT_PER_MM,
        Number(m[4]) / PT_PER_MM,
      ])
    )
  );

const gapsOf = (segments: ReadonlyArray<Segment2>, minSpacing: number) =>
  closeOutlineGaps({ segments, minSpacing, minOverlap: 1, coincidence: OUTLINE_COINCIDENCE_MM });

const lengthOf = ([x1, y1, x2, y2]: Segment2) => Math.hypot(x2 - x1, y2 - y1);

// The break between two collinear pieces of one line (each within `tolerance` of the other's line) that do not
// overlap: the length of line between them. None for any other pair.
const breakBetween = (first: Segment2, second: Segment2, tolerance = 0.005): O.Option<number> => {
  const [longer, shorter] = lengthOf(first) >= lengthOf(second) ? [first, second] : [second, first];
  const length = lengthOf(longer);
  if (length === 0 || lengthOf(shorter) === 0) {
    return O.none();
  }
  const u = [(longer[2] - longer[0]) / length, (longer[3] - longer[1]) / length] as const;
  const along = (x: number, y: number) => (x - longer[0]) * u[0] + (y - longer[1]) * u[1];
  const off = (x: number, y: number) => Math.abs((x - longer[0]) * u[1] - (y - longer[1]) * u[0]);
  const [s1, s2] = [along(shorter[0], shorter[1]), along(shorter[2], shorter[3])];
  const gap = Math.max(Math.min(s1, s2) - length, -Math.max(s1, s2));
  return off(shorter[0], shorter[1]) < tolerance && off(shorter[2], shorter[3]) < tolerance && gap > 0
    ? O.some(gap)
    : O.none();
};

// Every pair of indices below `count`, each once.
const pairsOf = (count: number): ReadonlyArray<readonly [number, number]> =>
  pipe(
    A.makeBy(count, (i) => i),
    A.flatMap((i) =>
      A.map(
        A.makeBy(count, (j) => j),
        (j) => [i, j] as const
      )
    ),
    A.filter(([i, j]) => i < j)
  );

// Direction of a segment in degrees, in [0, 180).
const directionOf = ([x1, y1, x2, y2]: Segment2) => {
  const degrees = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return degrees < 0 ? degrees + 180 : degrees % 180;
};

const turnOf = (first: Segment2, second: Segment2) => {
  const difference = Math.abs(directionOf(first) - directionOf(second));
  return Math.min(difference, 180 - difference);
};

// Distance of a point from the line through a segment.
const offLine = (x: number, y: number, [x1, y1, x2, y2]: Segment2) =>
  Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) / Math.max(Math.hypot(x2 - x1, y2 - y1), 1e-12);

// Whether two segments lie on one line: within 1° of parallel and the shorter within `tolerance` of the longer's line.
const onOneLine = (first: Segment2, second: Segment2, tolerance: number) => {
  const [longer, shorter] = lengthOf(first) >= lengthOf(second) ? [first, second] : [second, first];
  return (
    lengthOf(shorter) > 0 &&
    turnOf(longer, shorter) < 1 &&
    offLine(shorter[0], shorter[1], longer) < tolerance &&
    offLine(shorter[2], shorter[3], longer) < tolerance
  );
};

const decodeModelSpec = S.decodeUnknownEffect(ModelSpec);
const encodeSpecJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
// Part counts on either side of a model's 256-part work limit.
const WithinPartLimit = S.Int.check(S.isBetween({ minimum: 1, maximum: 256 }));
const PastPartLimit = S.Int.check(S.isBetween({ minimum: 257, maximum: 320 }));
// An encoded model of `count` unit boxes.
const unitBoxes = (count: number) => ({
  parts: A.makeBy(count, () => ({ name: "box", add: [encodedBox([0, 0, 0], [1, 1, 1])] })),
});

// The tube seen from below in a two-point pictorial at 20° and the given azimuth: the sheet's figure segments (mm)
// with the projected segments they were drawn from (mm at the sheet scale), and the render's manifest.
const renderTube = Effect.fnUntraced(function* (azimuth: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped();
  const specPath = path.join(dir, "spec.json");
  const specJson = yield* encodeSpecJson({
    title: "Synthetic crossed tube",
    model: tube,
    figures: [{ view: "bottom-perspective", description: "is a bottom perspective view", projection: "two-point" }],
    pictorialAzimuthDeg: azimuth,
    pictorialElevationDeg: 20,
  });
  yield* fs.writeFileString(specPath, specJson);
  const outputDir = path.join(dir, "out");
  const manifest = yield* (yield* FigureSet).render(RenderRequest.make({ specPath, outputDir }));
  const figure = manifest.figures[0];
  const camera: Camera | undefined = O.getOrUndefined(O.flatMap(O.fromNullishOr(figure), (f) => f.camera));
  const [projected] = yield* (yield* Occt).project(
    ProjectionRequest.make({
      solid: yield* decodeModelSpec(tube),
      cameras: camera === undefined ? [] : [camera],
      shading: O.none(),
    })
  );
  const mm = manifest.scale / PT_PER_MM;
  // the sheet's y runs down the page, so the projection is mirrored to compare directions
  const before = A.map(projected?.visible ?? [], ([x1, y1, x2, y2]) =>
    Segment2.make([x1 * mm, -y1 * mm, x2 * mm, -y2 * mm])
  );
  const readFileString1 = yield* fs.readFileString(path.join(outputDir, "fig-1.svg"));
  const after = figureSegmentsMm(readFileString1);
  return { manifest, figure, before, after };
});

describe("@beep/occt service", () => {
  it.effect(
    "rejects model specs exceeding the bounded overlap work limit",
    Effect.fnUntraced(function* () {
      // encoded input: a primitive's decoded line style is an Option, which the decoder does not take back
      const part = { name: "box", add: [{ kind: "box", min: [0, 0, 0], max: [1, 1, 1] }] };
      const rejected = yield* Effect.flip(decodeModelSpec({ parts: A.makeBy(257, () => part) }));
      expect(rejected.message).toContain("Expected at most 256 parts");
      expect((yield* decodeModelSpec({ parts: A.makeBy(256, () => part) })).parts).toHaveLength(256);
    })
  );
  it.effect.prop(
    "decodes a model spec of any part count up to the work limit and refuses every count past it",
    [WithinPartLimit, PastPartLimit],
    Effect.fnUntraced(function* ([within, past]) {
      expect((yield* decodeModelSpec(unitBoxes(within))).parts).toHaveLength(within);
      const rejected = yield* Effect.flip(decodeModelSpec(unitBoxes(past)));
      expect(rejected.message).toContain("Expected at most 256 parts");
    }),
    { arbitrary: { runs: 40 } }
  );
  it.layer(TestLayer, { timeout: "60 seconds" })((it) => {
    it.effect(
      "reports kernel provenance",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const kernel = yield* occt.kernel;
        expect(kernel.variant).toBe("single-thread");
        expect(kernel.wasmSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(kernel.wasmBytes).toBeGreaterThan(1_000_000);
      })
    );

    it.effect(
      "measures the fixture",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const summary = yield* occt.summarize(fixture);
        expect(summary.boundingBox.min).toEqual([-20, -15, 0]);
        expect(summary.boundingBox.max).toEqual([20, 15, 35]);
        // box 40·30·20 plus wedge ½·20·15·20
        expect(summary.volume).toBe(24000 + 3000);
        expect(summary.faceCount).toBe(8);
      })
    );

    it.effect(
      "distinguishes top from bottom and front views",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const [topView, bottomView, frontView] = yield* occt.project(
          ProjectionRequest.make({ solid: fixture, cameras: [top, bottom, front], withHidden: true })
        );
        // bottom: only the box outline; top: outline plus the wedge's four edges
        expect(bottomView?.visible.length).toBe(4);
        expect(topView?.visible.length).toBe(8);
        expect(bottomView?.hidden.length).toBeGreaterThan(topView?.hidden.length ?? 0);
        expect(frontView?.visible.length).toBe(6);
        expect(topView?.visible).not.toEqual(bottomView?.visible);
      })
    );

    it.effect(
      "projects in perspective when a focus is given",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const [axo, near] = yield* occt.project(
          ProjectionRequest.make({
            solid: fixture,
            cameras: [Camera.make({ eye: [90, -120, 65], up: [0, 0, 1], target: [0, 0, 15] }), persp(80)],
          })
        );
        expect(axo?.visible.length).toBe(15);
        expect(near?.visible.length).toBe(15);
        expect(axo?.visible).not.toEqual(near?.visible);
        // In the axonometric view the four vertical box edges stay parallel
        // (equal projected direction); in perspective they converge.
        const directionSpread = (segments: ReadonlyArray<readonly [number, number, number, number]>) =>
          pipe(
            segments,
            A.map(([x1, y1, x2, y2]) => Math.atan2(y2 - y1, x2 - x1)),
            A.map((angle) => Math.abs(Math.cos(angle))),
            A.filter((c) => c < 0.3),
            (cs) => Math.max(...cs) - Math.min(...cs)
          );
        expect(directionSpread(axo?.visible ?? [])).toBeLessThan(1e-6);
        expect(directionSpread(near?.visible ?? [])).toBeGreaterThan(1e-3);
      })
    );

    it.effect(
      "keeps every vertical edge vertical in a two-point pictorial, converges level edges, and shows the top or bottom",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const block = ModelSpec.make({ parts: [Part.make({ name: "block", add: [box([0, 0, 0], [40, 30, 20])] })] });
        const bounds = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
        const pictorial = (view: "top-perspective" | "bottom-perspective", projection: "two-point" | "isometric") =>
          cameraForView({ view, box: bounds, projection, azimuthDeg: O.some(30), elevationDeg: O.some(20) });
        const cameras = [
          pictorial("top-perspective", "two-point"),
          pictorial("bottom-perspective", "two-point"),
          pictorial("top-perspective", "isometric"),
        ] as const;
        const views = yield* occt.project(
          ProjectionRequest.make({ solid: block, cameras: [...cameras], withHidden: true })
        );
        expect(views).toHaveLength(3);
        const drawn = A.map(views, (view) => [...view.visible, ...view.hidden]);
        const corners = [
          [0, 0],
          [40, 0],
          [0, 30],
          [40, 30],
        ] as const;
        const isVertical = ([x1, , x2]: Seg) => Math.abs(x2 - x1) < 1e-6;
        A.forEach([0, 1], (index) => {
          const camera = cameras[index]!;
          const segments = drawn[index]!;
          // every vertical model edge is drawn as a vertical segment, and no other edge is
          A.forEach(corners, ([x, y]) => {
            const edge = joining(camera, segments)([x, y, 0], [x, y, 20]);
            expect(O.exists(edge, isVertical)).toBe(true);
          });
          expect(A.length(A.filter(segments, isVertical))).toBe(4);
          // level edges that are parallel on the model run toward a vanishing point on the sheet
          const pairs = [
            [
              [0, 0, 0],
              [40, 0, 0],
              [0, 0, 20],
              [40, 0, 20],
            ],
            [
              [0, 0, 0],
              [0, 30, 0],
              [0, 0, 20],
              [0, 30, 20],
            ],
          ] as const;
          A.forEach(pairs, ([a, b, c, d]) => {
            const lower = O.getOrThrow(joining(camera, segments)(a, b));
            const upper = O.getOrThrow(joining(camera, segments)(c, d));
            expect(turnBetween(lower, upper)).toBeGreaterThan(0.02);
          });
        });
        // the isometric keeps them parallel
        const iso = cameras[2];
        const isoFront = O.getOrThrow(joining(iso, drawn[2]!)([0, 0, 0], [40, 0, 0]));
        const isoFrontTop = O.getOrThrow(joining(iso, drawn[2]!)([0, 0, 20], [40, 0, 20]));
        expect(turnBetween(isoFront, isoFrontTop)).toBeLessThan(1e-4);
        // the eye stands at the front-left, so the far corner is (40, 30): its top end closes the visible top face in
        // the top view and is hidden in the bottom view, and the other way round for its bottom end
        const touching = (camera: Camera, segments: ReadonlyArray<Seg>, p: Point3) => {
          const [x, y] = drawnAt(camera, p);
          return A.length(
            A.filter(
              segments,
              ([x1, y1, x2, y2]) =>
                (Math.abs(x1 - x) < 2e-3 && Math.abs(y1 - y) < 2e-3) ||
                (Math.abs(x2 - x) < 2e-3 && Math.abs(y2 - y) < 2e-3)
            )
          );
        };
        const [upperView, lowerView] = views;
        expect(touching(cameras[0], upperView?.visible ?? [], [40, 30, 20])).toBe(2);
        expect(touching(cameras[0], upperView?.visible ?? [], [40, 30, 0])).toBe(0);
        expect(touching(cameras[1], lowerView?.visible ?? [], [40, 30, 0])).toBe(2);
        expect(touching(cameras[1], lowerView?.visible ?? [], [40, 30, 20])).toBe(0);
        expect(A.map(views, (view) => A.length(view.visible))).toEqual([9, 9, 9]);
      })
    );

    it.effect(
      "lets shading and faced overlays see the top face a two-point camera looks level across",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const lid = OverlayLine.make({
          name: "lid",
          style: "emphasis",
          points: [
            [10, 15, 20],
            [30, 15, 20],
          ],
          facing: O.some([0, 0, 1]),
        });
        const block = ModelSpec.make({
          parts: [Part.make({ name: "block", add: [box([0, 0, 0], [40, 30, 20])] })],
          overlays: [lid],
        });
        const level = cameraForView({
          view: "top-perspective",
          box: BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] }),
          projection: "two-point",
          azimuthDeg: O.some(30),
          elevationDeg: O.some(20),
        });
        // the same camera without its sight reads the top face edge-on; it keeps its hidden-line pass about the target,
        // so only what it reads as facing changes
        const blind = Camera.make({ ...level, sight: O.none() });
        expect(blind.hiddenLinePassAbout).toBe("target");
        const [seen, unseen] = yield* occt.project(
          ProjectionRequest.make({
            solid: block,
            cameras: [level, blind],
            shading: O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: 1 })),
          })
        );
        const backFacing = (view: EdgeSet | undefined) =>
          pipe(
            O.fromNullishOr(view),
            O.flatMap((v) => v.shadingCoverage),
            O.flatMap((coverage) => A.findFirst(coverage.skippedFaces, (skip) => skip.reason === "back-facing")),
            O.map((skip) => skip.faces)
          );
        // bottom, rear and right turn away; the level eye alone would add the top
        assertSome(backFacing(seen), 3);
        assertSome(backFacing(unseen), 4);
        expect(totalLength(seen?.emphasis ?? [])).toBeGreaterThan(10);
        expect(unseen?.emphasis).toEqual([]);
        // with the pass origin held, the sight changes what is shaded, never the outline
        expect(seen?.visible).toEqual(unseen?.visible);
      })
    );

    it.effect(
      "hides what a two-point pictorial's near slab covers wherever the model sits about the origin",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        type Corner = readonly [number, number, number];
        // A block on a plate whose underside is the model's z = 0, seen from below, and a table whose top is z = 0,
        // seen from above: OCCT's own perspective eye stands level with the slab's near face in both, so only a pass
        // run about the camera's target hides the block's face against the slab.
        const cases = [
          { view: "bottom-perspective", slab: [0, 4], block: [4, 14], contact: 4 },
          { view: "top-perspective", slab: [-4, 0], block: [-14, -4], contact: -4 },
        ] as const;
        yield* Effect.forEach(
          cases,
          Effect.fnUntraced(function* ({ view, slab, block, contact }) {
            const at = ([tx, ty, tz]: Corner) =>
              ModelSpec.make({
                parts: [
                  Part.make({ name: "slab", add: [box([tx, ty, slab[0] + tz], [40 + tx, 30 + ty, slab[1] + tz])] }),
                  Part.make({
                    name: "block",
                    add: [box([10 + tx, 10 + ty, block[0] + tz], [20 + tx, 20 + ty, block[1] + tz])],
                  }),
                ],
              });
            const camera = cameraForView({
              view,
              box: BoundingBox.make({
                min: [0, 0, Math.min(slab[0], block[0])],
                max: [40, 30, Math.max(slab[1], block[1])],
              }),
              projection: "two-point",
              azimuthDeg: O.some(30),
              elevationDeg: O.some(20),
            });
            const [placed] = yield* occt.project(
              ProjectionRequest.make({ solid: at([0, 0, 0]), cameras: [camera], withHidden: false })
            );
            // the same view of the model moved so the camera's target is the origin
            const [centred] = yield* occt.project(
              ProjectionRequest.make({
                solid: at([-camera.target[0], -camera.target[1], -camera.target[2]]),
                cameras: [Camera.make({ ...camera, target: [0, 0, 0] })],
                withHidden: false,
              })
            );
            const visible = placed?.visible ?? [];
            const footprint = [
              [10, 10],
              [20, 10],
              [20, 20],
              [10, 20],
            ] as const;
            A.forEach(footprint, ([x, y], index) => {
              const [nx, ny] = footprint[(index + 1) % 4]!;
              assertNone(joining(camera, visible)([x, y, contact], [nx, ny, contact]));
            });
            expect(A.length(visible)).toBe(A.length(centred?.visible ?? []));
            expect(totalLength(visible)).toBeCloseTo(totalLength(centred?.visible ?? []), 2);
            // the pass origin, not the sight, decides it: the same camera run about the model's origin draws the
            // block's face against the slab
            const [aboutOrigin] = yield* occt.project(
              ProjectionRequest.make({
                solid: at([0, 0, 0]),
                cameras: [Camera.make({ ...camera, hiddenLinePassAbout: "origin" })],
                withHidden: false,
              })
            );
            expect(
              A.some(footprint, ([x, y], index) => {
                const [nx, ny] = footprint[(index + 1) % 4]!;
                return O.isSome(joining(camera, aboutOrigin?.visible ?? [])([x, y, contact], [nx, ny, contact]));
              })
            ).toBe(true);
          }),
          { discard: true }
        );
      })
    );

    it.effect(
      "is byte-stable across runs",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const request = ProjectionRequest.make({ solid: fixture, cameras: [top, persp(300)] });
        const first = yield* occt.project(request);
        const second = yield* occt.project(request);
        expect(first).toEqual(second);
        expect(first.length).toBe(2);
      })
    );

    it.effect(
      "shades nothing without a plan, and nothing above a lit threshold of -1",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const [plain, unlit] = yield* occt.project(ProjectionRequest.make({ solid: fixture, cameras: [front] })).pipe(
          Effect.zip(
            occt.project(
              ProjectionRequest.make({
                solid: fixture,
                cameras: [front],
                shading: O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: -1 })),
              })
            )
          ),
          Effect.map(([a, b]) => [a[0], b[0]] as const)
        );
        expect(plain?.shading).toEqual([]);
        expect(unlit?.shading).toEqual([]);
      })
    );

    it.effect(
      "hatches the front elevation with lines along the face's longest edge",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: fixture,
            cameras: [front],
            shading: O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3 })),
          })
        );
        const shading = view?.shading ?? [];
        // box front face: lines along its 40-long bottom edge (horizontal); wedge
        // triangle: lines along its hypotenuse, slope -15/20 in this view
        const slopeOf = ([x1, y1, x2, y2]: readonly [number, number, number, number]) =>
          Math.round(((y2 - y1) / (x2 - x1)) * 1000) / 1000;
        const slopes = pipe(shading, A.map(slopeOf), A.dedupe, A.sort(Order.Number));
        expect(slopes).toEqual([-0.75, 0]);
        // outlines are unchanged by shading
        expect(view?.visible.length).toBe(6);
      })
    );

    it.effect(
      "hides hatch lines behind a separate part",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const post = Part.make({ name: "post", add: [Box.make({ min: [-4, -30, 0], max: [4, -24, 30] })] });
        const plan = O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3 }));
        const shadingLength = (solid: ModelSpec) =>
          occt.project(ProjectionRequest.make({ solid, cameras: [front], shading: plan })).pipe(
            Effect.map((views) =>
              pipe(
                views[0]?.shading ?? [],
                A.reduce(0, (sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1))
              )
            )
          );
        const together = yield* shadingLength(ModelSpec.make({ parts: [...fixture.parts, post] }));
        const bodyAlone = yield* shadingLength(fixture);
        const postAlone = yield* shadingLength(ModelSpec.make({ parts: [post] }));
        expect(together).toBeLessThan(bodyAlone + postAlone - 1);
      })
    );

    it.effect(
      "merges the seam between coplanar faces of fused primitives",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // two boxes side by side share one flat front face after the fuse
        const slab = ModelSpec.make({
          parts: [
            Part.make({
              name: "slab",
              add: [Box.make({ min: [0, 0, 0], max: [10, 10, 10] }), Box.make({ min: [10, 0, 0], max: [25, 10, 10] })],
            }),
          ],
        });
        const [view] = yield* occt.project(ProjectionRequest.make({ solid: slab, cameras: [front] }));
        expect(view?.visible.length).toBe(4);
        const summary = yield* occt.summarize(slab);
        expect(summary.faceCount).toBe(6);
      })
    );

    it.effect(
      "keeps hatch lines at least the minimum pitch apart on a foreshortened face",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // a tall slab seen almost edge-on to its +Y face; the lit threshold
        // leaves the +X face clear, so every line belongs to the +Y face
        const post = ModelSpec.make({
          parts: [Part.make({ name: "post", add: [Box.make({ min: [0, 0, 0], max: [60, 10, 80] })] })],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: post,
            cameras: [Camera.make({ eye: [1, 0.3, 0], up: [0, 0, 1] })],
            shading: O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: 0 })),
          })
        );
        const shading = view?.shading ?? [];
        // lines still run along the 80-long vertical edges
        expect(
          pipe(
            shading,
            A.every(([x1, , x2]) => x1 === x2)
          )
        ).toBe(true);
        expect(shading.length).toBeGreaterThan(2);
        const columns = pipe(
          shading,
          A.map(([x]) => x),
          A.sort(Order.Number)
        );
        const gaps = A.zipWith(columns, A.drop(columns, 1), (a, b) => b - a);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.99);
      })
    );

    it.effect(
      "projects a model without broken parts exactly as before broken-line parts existed",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const views = yield* occt.project(
          ProjectionRequest.make({
            solid: LEGACY_MODEL,
            cameras: [
              top,
              front,
              Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [0, 0, 15], focus: O.some(200) }),
            ],
            withHidden: true,
            shading: O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3 })),
          })
        );
        expect(A.map(views, (view) => view.broken)).toEqual([[], [], []]);
        expect(A.map(views, (view) => view.emphasis)).toEqual([[], [], []]);
        const json = yield* encodeLegacyViews(
          A.map(views, (view) => ({ visible: view.visible, hidden: view.hidden, shading: view.shading }))
        );
        const sha256Hex2 = yield* sha256Hex(json);
        expect(sha256Hex2).toBe(LEGACY_SHA256);
      })
    );

    it.effect(
      "draws a broken part's visible edges in the broken layer only",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const solidTab = ModelSpec.make({
          parts: [longWall, crossWall, lid, Part.make({ ...tab, lineStyle: "solid" })],
        });
        const projectPlanAndFront = (solid: ModelSpec) =>
          occt.project(ProjectionRequest.make({ solid, cameras: [top, front] })).pipe(Effect.map(planAndFront));
        const broken = yield* projectPlanAndFront(crate);
        const solid = yield* projectPlanAndFront(solidTab);
        // the tab rises 3 above the lid: its top face in plan, its exposed band in front
        expect(totalLength(broken.plan.broken)).toBeGreaterThan(0);
        expect(totalLength(broken.front.broken)).toBeGreaterThan(0);
        expect(solid.plan.broken).toEqual([]);
        // the band above the lid is 10 wide and 3 tall; the part inside the slit stays hidden
        expect(A.every(broken.front.broken, ([, y1, , y2]) => Math.min(y1, y2) >= 43)).toBe(true);
        // what the broken layer draws is exactly what the solid tab added to the outline
        expect(totalLength(broken.front.visible) + totalLength(broken.front.broken)).toBeCloseTo(
          totalLength(solid.front.visible),
          3
        );
        expect(broken.plan.visible.length).toBeGreaterThan(0);
      })
    );

    it.effect(
      "hides broken parts behind solid parts and solid parts behind broken ones",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // a plate with a low block in front of it, seen from the front: the
        // block hides 10 of the plate's 140-long outline
        const plate = Part.make({ name: "plate", add: [box([-20, 10, 0], [20, 12, 30])] });
        const block = Part.make({ name: "block", add: [box([-5, -10, 0], [5, 0, 10])] });
        const view = (parts: ReadonlyArray<Part>) =>
          occt
            .project(ProjectionRequest.make({ solid: ModelSpec.make({ parts }), cameras: [front], withHidden: true }))
            .pipe(Effect.map((views) => views[0] ?? EdgeSet.make({ visible: [], hidden: [] })));
        const brokenBlock = yield* view([plate, Part.make({ ...block, lineStyle: "broken" })]);
        const brokenPlate = yield* view([Part.make({ ...plate, lineStyle: "broken" }), block]);
        const blockAlone = yield* view([block]);
        // solid plate occluded by the broken block
        expect(totalLength(brokenBlock.visible)).toBeCloseTo(130, 3);
        expect(totalLength(brokenBlock.broken)).toBeCloseTo(40, 3);
        // broken plate occluded by the solid block, the same 130
        expect(totalLength(brokenPlate.broken)).toBeCloseTo(130, 3);
        expect(totalLength(brokenPlate.visible)).toBeCloseTo(40, 3);
        // a broken part's hidden edges are never collected
        expect(brokenPlate.hidden).toEqual(blockAlone.hidden);
      })
    );

    it.effect(
      "never shades a broken part",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const plan = O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: 1 }));
        const slab = Part.make({ name: "slab", add: [box([0, 0, 0], [40, 10, 30])] });
        const shade = (part: Part) =>
          occt
            .project(
              ProjectionRequest.make({ solid: ModelSpec.make({ parts: [part] }), cameras: [front], shading: plan })
            )
            .pipe(Effect.map((views) => views[0] ?? EdgeSet.make({ visible: [], hidden: [] })));
        const solid = yield* shade(slab);
        const broken = yield* shade(Part.make({ ...slab, lineStyle: "broken" }));
        expect(solid.shading.length).toBeGreaterThan(0);
        expect(broken.shading).toEqual([]);
        expect(broken.visible).toEqual([]);
        expect(broken.broken).toEqual(solid.visible);
        // in the crate, hatching is the same whether the tab is broken or absent
        const [withTab] = yield* occt.project(
          ProjectionRequest.make({ solid: crate, cameras: [front], shading: plan })
        );
        const [withoutTab] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [longWall, crossWall, lid] }),
            cameras: [front],
            shading: plan,
          })
        );
        expect(withTab?.shading).toEqual(withoutTab?.shading);
      })
    );

    it.effect(
      "draws an emphasis overlay only in views its face turns toward, behind the parts in front of it",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // a slab whose front face (y = 0) carries a 20-long heavy line at mid height
        const slab = Part.make({ name: "slab", add: [box([-20, 0, 0], [20, 10, 30])] });
        const seat = OverlayLine.make({
          name: "seat",
          style: "emphasis",
          points: [
            [-10, 0, 15],
            [0, 0, 15],
            [10, 0, 15],
          ],
          facing: O.some([0, -1, 0]),
        });
        const back = Camera.make({ eye: [0, 1, 0], up: [0, 0, 1] });
        const [frontView, backView, topView] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [slab], overlays: [seat] }),
            cameras: [front, back, top],
          })
        );
        const emphasisOf = (view: typeof frontView) => view?.emphasis ?? [];
        expect(totalLength(emphasisOf(frontView))).toBeCloseTo(20, 3);
        expect(A.every(emphasisOf(frontView), ([, y1, , y2]) => y1 === 15 && y2 === 15)).toBe(true);
        // the face is seen from behind in the back view and edge-on in the plan: no line prints over an outline
        expect(emphasisOf(backView)).toEqual([]);
        expect(emphasisOf(topView)).toEqual([]);
        // an overlay draws nothing on the other layers
        const [bare] = yield* occt.project(
          ProjectionRequest.make({ solid: ModelSpec.make({ parts: [slab] }), cameras: [front] })
        );
        expect(frontView?.visible).toEqual(bare?.visible);
        expect(frontView?.broken).toEqual([]);
        // a post standing in front of the right half hides that half
        const post = Part.make({ name: "post", add: [box([0, -20, 0], [15, -10, 30])] });
        const [hidden] = yield* occt.project(
          ProjectionRequest.make({ solid: ModelSpec.make({ parts: [slab, post], overlays: [seat] }), cameras: [front] })
        );
        expect(totalLength(emphasisOf(hidden))).toBeCloseTo(10, 3);
        expect(A.every(emphasisOf(hidden), ([x1, , x2]) => Math.max(x1, x2) <= 0)).toBe(true);
      })
    );

    it.effect(
      "draws a broken overlay in the broken layer",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const slab = Part.make({ name: "slab", add: [box([-20, 0, 0], [20, 10, 30])] });
        const corrugation = OverlayLine.make({
          name: "corrugation",
          style: "broken",
          points: [
            [-20, 0, 5],
            [20, 0, 5],
          ],
          facing: O.some([0, -1, 0]),
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [slab], overlays: [corrugation] }),
            cameras: [front],
          })
        );
        expect(totalLength(view?.broken ?? [])).toBeCloseTo(40, 3);
        expect(view?.emphasis).toEqual([]);
        expect(totalLength(view?.visible ?? [])).toBeCloseTo(140, 3);
        // a corrugation wave of short segments comes back as pieces that meet end to end
        // (the sheet chains them into one dashed subpath): only the wave's two ends are
        // the end of a single piece
        const wave = OverlayLine.make({
          name: "wave",
          style: "broken",
          points: A.makeBy(17, (i) => [-20 + i * 2.5, 0, 15 + (i % 2)] as const),
          facing: O.some([0, -1, 0]),
        });
        const [waved] = yield* occt.project(
          ProjectionRequest.make({ solid: ModelSpec.make({ parts: [slab], overlays: [wave] }), cameras: [front] })
        );
        const pieces = waved?.broken ?? [];
        expect(A.length(pieces)).toBe(16);
        const ends = A.groupBy(
          A.flatMap(pieces, ([x1, y1, x2, y2]) => [`${x1} ${y1}`, `${x2} ${y2}`]),
          (key) => key
        );
        expect(A.length(A.filter(R.values(ends), (at) => A.length(at) === 1))).toBe(2);
      })
    );

    it.effect(
      "measures every part and counts true overlaps only",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const summary = yield* occt.summarize(crate);
        // the broken tab still counts toward the extents and the volume
        expect(summary.boundingBox.min).toEqual([-40, -30, 0]);
        expect(summary.boundingBox.max).toEqual([40, 30, 46]);
        // walls 80·4·40 + 60·4·40 less the two 4·4·20 slots; lid 40·60·3 less its 10·4·3 slit; tab 10·4·6
        expect(summary.volume).toBe(12800 - 320 + 9600 - 320 + 7200 - 120 + 240);
        // zero-clearance contact faces are not overlaps
        expect(summary.partOverlaps).toBe(0);
        // without the halving slots the walls interpenetrate: one overlapping pair
        const unslotted = yield* occt.summarize(
          ModelSpec.make({
            parts: [Part.make({ ...longWall, subtract: [] }), Part.make({ ...crossWall, subtract: [] }), lid],
          })
        );
        expect(unslotted.partOverlaps).toBe(1);
        const legacy = yield* occt.summarize(fixture);
        expect(legacy.partOverlaps).toBe(0);
      })
    );

    it.effect(
      "reports a typed build failure when a part has zero width",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const error = yield* Effect.flip(
          occt.summarize(
            ModelSpec.make({
              parts: [Part.make({ name: "degenerate", add: [box([0, 0, 0], [0, 10, 10])] })],
            })
          )
        );
        assertInstanceOf(error, OcctError);
        expect(error.reason).toBe("solid-build");
        expect(error.message).toBe("The kernel could not build the solid.");
        assertNone(error.cause);
      })
    );

    it.effect(
      "rejects a camera with a zero eye vector",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const error = yield* Effect.flip(
          occt.project(
            ProjectionRequest.make({ solid: fixture, cameras: [Camera.make({ eye: [0, 0, 0], up: [0, 0, 1] })] })
          )
        );
        assertInstanceOf(error, OcctError);
        expect(error.reason).toBe("projection");
        expect(error.message).toBe("Camera vectors must be non-zero.");
        assertNone(error.cause);
      })
    );

    it.layer(FigureLayer, { timeout: "300 seconds" })("outline spacing through the figure-set renderer", (it) => {
      // Seen from below in a two-point pictorial at 20°, each board's bottom face projects as two lines a few tenths of
      // a millimetre apart: on paper they print as one line of the 0.7 mm emphasis weight (review loop 4, O-01). The
      // renderer opens each pair to 0.7 mm centre to centre on the sheet, keeps both lines, and re-ends the lines that
      // stop on them, so the plate slotted from below keeps its break where the crossing plate runs through. Off the
      // square view (30°, 45°, 60°) the pairs' ends meet obliques and verticals: re-solved point by point, an unmoved
      // line followed a moved one and closed a pair again, verticals leaned, and the pieces of one line kinked
      // (review loop 4, R4-01, R4-02).
      A.forEach([30, 45, 60, 90], (azimuth) =>
        it.effect(
          `opens a thin board's edges seen from below at azimuth ${azimuth}° to 0.7 mm, keeping every line's direction`,
          Effect.fnUntraced(function* () {
            const { manifest, figure, before, after } = yield* renderTube(azimuth);
            // as projected, board edges print closer than 0.7 mm; on the sheet nothing does, and every edge is drawn
            expect(Math.min(...gapsOf(before, 0.7))).toBeLessThan(0.5);
            expect(A.length(after)).toBe(A.length(before));
            expect(gapsOf(after, 0.7)).toEqual([]);
            const pairs = pairsOf(A.length(before));
            const at = (segments: ReadonlyArray<Segment2>, i: number) => A.getUnsafe(segments, i);
            // every close pair still prints as two lines side by side, at least the least spacing apart
            const close = A.filter(pairs, ([i, j]) =>
              A.isReadonlyArrayNonEmpty(gapsOf([at(before, i), at(before, j)], 0.7))
            );
            expect(A.length(close)).toBeGreaterThanOrEqual(2);
            A.forEach(close, ([i, j]) => {
              const [spacing = Number.NaN] = gapsOf([at(after, i), at(after, j)], 1.5);
              expect(spacing).toBeGreaterThanOrEqual(0.7);
            });
            // every line drawn 3 mm or longer keeps its direction: verticals stay vertical, nothing turns
            A.forEach(before, (segment, i) => {
              if (lengthOf(segment) >= 3) {
                expect(turnOf(segment, at(after, i))).toBeLessThan(0.05);
              }
            });
            // pieces of one line stay on one line
            A.forEach(pairs, ([i, j]) => {
              if (onOneLine(at(before, i), at(before, j), 0.005)) {
                assertTrue(onOneLine(at(after, i), at(after, j), OUTLINE_COINCIDENCE_MM));
              }
            });
            // every break in a line (the slotted plate's bottom edges where the crossing plate runs through) keeps at
            // least its width, its pieces still on one line
            const breaks = pipe(
              pairs,
              A.map(([i, j]) =>
                pipe(
                  breakBetween(at(before, i), at(before, j)),
                  // pieces that meet end to end (a joint, no break) are left out
                  O.filter((gap) => gap > 0.01 && gap < 5),
                  O.map((gap) => ({ gap, after: breakBetween(at(after, i), at(after, j), OUTLINE_COINCIDENCE_MM) }))
                )
              ),
              A.getSomes
            );
            expect(A.length(breaks)).toBeGreaterThanOrEqual(1);
            A.forEach(breaks, ({ gap, after: kept }) => assertTrue(O.exists(kept, (width) => width >= gap - 1e-3)));
            // the manifest records the moves, and the render validates without an outline-spacing finding
            assertTrue(
              O.exists(
                O.flatMap(O.fromNullishOr(figure), (f) => f.outlineSeparations),
                (separation) => separation.lines >= 2 && separation.largestMoveMm > 0 && separation.largestMoveMm < 0.6
              )
            );
            assertSome(
              O.map(manifest.validation, (v) => A.filter(v.findings, (f) => f.code === "outline-spacing")),
              []
            );
          })
        )
      );
    });
  });
});
