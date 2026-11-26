import {
  BoundingBox,
  Box,
  Camera,
  Cylinder,
  ModelSpec,
  Occt,
  OverlayLine,
  Part,
  Prism,
  ProjectionRequest,
  Rotation,
  Segment2,
  ShadingPlan,
} from "@beep/occt";
import { retapered, settleRedrawnInk } from "@beep/occt/internal/kernel";
import { hatchCompound } from "@beep/occt/internal/shading";
import {
  cameraForView,
  nearestOutlineDistance,
  ShadingCoverage,
  ShadingSkip,
  shadingBandLadderFindings,
  shadingCoverageFindings,
  toneOf,
  ValidationOptions,
  viewFactsOf,
} from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A, O } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as replicad from "replicad";
import type { EdgeSet } from "@beep/occt";
import type { StretchPiece } from "@beep/occt/internal/shading";

const UnknownJson = S.fromJsonString(S.Unknown);

type Segment = readonly [number, number, number, number];

const legacyFixture = ModelSpec.make({
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

const legacyCameras = [
  Camera.make({ eye: [0, 0, 1], up: [0, 1, 0] }),
  Camera.make({ eye: [0, 0, -1], up: [0, 1, 0] }),
  Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }),
  Camera.make({ eye: [1, 0.3, 0], up: [0, 0, 1] }),
  Camera.make({ eye: [90, -120, 65], up: [0, 0, 1], target: [0, 0, 15] }),
  Camera.make({ eye: [-90, -120, 65], up: [0, 0, 1], target: [0, 0, 15], focus: O.some(300) }),
];

const LEGACY_SHA256 = "af9b81c85515c2035920293ef17bfc478f7a5464c41b62e07ca7dbff2455c668";
const hostedShardTimeoutMs = 120_000;

const sha256Of = (text: string) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).pipe(
    Effect.map((digest) =>
      pipe(
        A.fromIterable(new Uint8Array(digest)),
        A.map((b) => Str.padStart(2, "0")(b.toString(16))),
        A.join("")
      )
    )
  );

const box = (min: readonly [number, number, number], max: readonly [number, number, number]) =>
  ModelSpec.make({ parts: [Part.make({ name: "box", add: [Box.make({ min, max })] })] });

const front = Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] });
const left = Camera.make({ eye: [-1, 0, 0], up: [0, 0, 1] });
const right = Camera.make({ eye: [1, 0, 0], up: [0, 0, 1] });
const top = Camera.make({ eye: [0, 0, 1], up: [0, 1, 0] });

const graded = (fields?: {
  readonly axis?: "longest-edge" | "surface-class";
  readonly minFaceSpan?: number;
  readonly minStroke?: number;
  readonly clearance?: number | undefined;
  readonly ladderReach?: number | undefined;
}) =>
  ShadingPlan.make({
    minPitch: 1,
    maxPitch: 3,
    litThreshold: 0.55,
    style: "graded",
    axis: fields?.axis ?? "surface-class",
    minFaceSpan: fields?.minFaceSpan ?? 0,
    minStroke: fields?.minStroke ?? 0,
    clearance: O.fromNullishOr(fields?.clearance),
    ladderReach: O.fromNullishOr(fields?.ladderReach),
  });

const frontHatch = (shape: replicad.AnyShape) => ({
  oc: replicad.getOC(),
  shape,
  camera: front,
  plan: graded(),
  rooms: () => O.none(),
  isBrokenFace: () => false,
  claimedOf: () => O.none(),
  viewedLength: ([a, b]: readonly [readonly [number, number, number], readonly [number, number, number]]) =>
    Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
  neighbours: [],
  groupBeyond: () => O.none(),
});

const ladderFindings = (view: EdgeSet | undefined) => {
  const sheetMmPerUnit = 1.5;
  const mm = (segments: ReadonlyArray<Segment>) =>
    A.map(
      segments,
      ([x1, y1, x2, y2]): Segment => [
        x1 * sheetMmPerUnit,
        y1 * sheetMmPerUnit,
        x2 * sheetMmPerUnit,
        y2 * sheetMmPerUnit,
      ]
    );
  return A.map(
    shadingBandLadderFindings({
      page: 1,
      shadingMm: mm(view?.shading ?? []),
      outlineMm: mm([...(view?.visible ?? []), ...(view?.broken ?? []), ...(view?.emphasis ?? [])]),
      options: ValidationOptions.make({ expectedPages: O.none() }),
    }),
    (finding) => finding.code
  );
};

const isVertical = ([x1, , x2]: Segment) => Math.abs(x1 - x2) < 1e-6;
const isHorizontal = ([, y1, , y2]: Segment) => Math.abs(y1 - y2) < 1e-6;
const lengthOf = ([x1, y1, x2, y2]: Segment) => Math.hypot(x2 - x1, y2 - y1);
const sumOf = A.reduce(0, (sum: number, n: number) => sum + n);

const TestLayer = Occt.layer.pipe(Layer.provide(NodeServices.layer));

describe("@beep/occt shading", () => {
  it.layer(TestLayer, { timeout: "120 seconds" })((it) => {
    it.effect(
      "projects an overlay without a facing from both sides",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const model = ModelSpec.make({
          ...box([-10, -10, 0], [10, 10, 20]),
          overlays: [
            OverlayLine.make({
              name: "unfaced",
              points: [
                [-5, -15, 5],
                [5, -15, 5],
              ],
              style: "emphasis",
            }),
          ],
        });
        const views = yield* occt.project(
          ProjectionRequest.make({ solid: model, cameras: [front, Camera.make({ eye: [0, -1, 1], up: [0, 0, 1] })] })
        );
        expect(A.map(views, (view) => A.length(view.emphasis))).toEqual([1, 1]);
      })
    );

    it.effect(
      "counts nested probe cells once and reports an unconstructably short visible band",
      Effect.fnUntraced(function* () {
        yield* Occt;
        const shape = replicad.makeBox([-10, -10, 0], [10, 10, 20]);
        const base = frontHatch(shape);
        const nested: A.NonEmptyReadonlyArray<StretchPiece<never>> = [
          { row: 0, from: 0, to: 10, low: 2, high: 4, probes: [] },
          { row: 1, from: 2, to: 8, low: 0, high: 6, probes: [] },
          { row: 2, from: 3, to: 7, low: 1, high: 5, probes: [] },
        ];
        const small: A.NonEmptyReadonlyArray<StretchPiece<never>> = [
          { row: 0, from: 0, to: 20, low: 0, high: 1e-7, probes: [] },
        ];
        try {
          const counted = hatchCompound({ ...base, regions: O.some(() => [nested]) });
          expect(A.some(counted.faces, (face) => Math.abs(face.seen - 44) < 1e-9)).toBe(true);
          A.forEach(counted.faces, (face) => A.forEach(face.stretches, (stretch) => stretch.shape.delete()));
          const skipped = hatchCompound({ ...base, regions: O.some(() => [small]) });
          expect(A.some(skipped.faces, (face) => A.some(face.skipped, (skip) => skip.reason === "no-room"))).toBe(true);
          A.forEach(skipped.faces, (face) => A.forEach(face.stretches, (stretch) => stretch.shape.delete()));
        } finally {
          shape.delete();
        }
      })
    );

    it.effect(
      "drops an overlay whose points all coincide and keeps the overlay beside it",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const model = ModelSpec.make({
          ...box([-10, -10, 0], [10, 10, 20]),
          overlays: [
            OverlayLine.make({
              name: "dot",
              points: [
                [0, -15, 5],
                [0, -15, 5],
              ],
              style: "emphasis",
            }),
            OverlayLine.make({
              name: "line",
              points: [
                [-5, -15, 5],
                [5, -15, 5],
              ],
              style: "emphasis",
            }),
          ],
        });
        const [view] = yield* occt.project(ProjectionRequest.make({ solid: model, cameras: [front] }));
        expect(
          view?.emphasis,
          "a polyline of one repeated point has no leg to draw and is never built; the line beside it still prints"
        ).toEqual([[-5, 5, 5, 5]]);
      })
    );

    it.effect(
      "pairs a lit face with its darker neighbour across a ridge a notch splits into two edges",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const ridge = Prism.make({
          profile: [
            [0, 0, 0],
            [30, 0, 0],
            [30, 0, 20],
            [0, 0, 60],
          ],
          extrusion: [0, 30, 0],
        });
        const projected = (subtract: ReadonlyArray<Box>) =>
          occt.project(
            ProjectionRequest.make({
              solid: ModelSpec.make({ parts: [Part.make({ name: "block", add: [ridge], subtract })] }),
              cameras: [Camera.make({ eye: [-1, -1, 1], up: [0, 0, 1] })],
              shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
            })
          );
        const [whole] = yield* projected([]);
        const [notched] = yield* projected([Box.make({ min: [-1, -1, 28], max: [0.5, 0.5, 30] })]);
        const strokes = notched?.shading ?? [];
        expect(
          strokes,
          "the notch at z = 28 splits the shared ridge into two collinear edges summed for the pair, inside the first pitch"
        ).toEqual(whole?.shading);
        const lit = A.filter(strokes, (s) => s[0] < 0);
        expect(A.length(lit)).toBeGreaterThanOrEqual(2);
        expect(
          Math.max(...A.map(lit, lengthOf)),
          "the lit band keeps the lit taper: at most 0.6 of the 60-tall chord, shown on the sheet at 2/sqrt(6)"
        ).toBeLessThanOrEqual(0.6 * 60 * (2 / Math.sqrt(6)) + 1e-6);
      })
    );

    it.effect(
      "plans a face given lines that no probe row saw as hidden, with no strokes",
      Effect.fnUntraced(function* () {
        yield* Occt;
        const shape = replicad.makeBox([-10, -10, 0], [10, 10, 20]);
        try {
          const hatched = hatchCompound({ ...frontHatch(shape), regions: O.some(() => []) });
          expect(
            A.map(hatched.faces, (face) =>
              face.treatment.kind === "skipped" ? face.treatment.reason : face.treatment.kind
            ),
            "with no visible area found, the front face, the only one turned to the eye, is hidden, not banded whole"
          ).toEqual(["back-facing", "back-facing", "hidden", "back-facing", "back-facing", "back-facing"]);
          expect(A.map(hatched.faces, (face) => [A.length(face.stretches), A.length(face.skipped), face.seen])).toEqual(
            A.makeBy(6, () => [0, 0, 0])
          );
        } finally {
          shape.delete();
        }
      })
    );

    it.effect(
      "draws a band once per run of adjacent probe rows, never across a row between them that missed the area",
      Effect.fnUntraced(function* () {
        yield* Occt;
        const shape = replicad.makeBox([-10, -10, 0], [10, 10, 20]);
        const gapped: A.NonEmptyReadonlyArray<StretchPiece<never>> = [
          { row: 0, from: 0, to: 20, low: -20, high: -14, probes: [] },
          { row: 1, from: 0, to: 20, low: -16, high: -11, probes: [] },
          { row: 3, from: 0, to: 20, low: -9, high: -4, probes: [] },
          { row: 4, from: 0, to: 20, low: -6, high: 0, probes: [] },
        ];
        try {
          const hatched = hatchCompound({ ...frontHatch(shape), regions: O.some(() => [gapped]) });
          A.forEach(hatched.faces, (face) => A.forEach(face.stretches, (stretch) => stretch.shape.delete()));
          const planned = A.flatMap(hatched.faces, (face) => A.flatMap(face.stretches, (stretch) => stretch.planned));
          const rounded = (n: number) => Math.round(n * 1e6) / 1e6;
          expect(
            A.map(planned, ({ ends: [a, b], rank }) => [
              rank,
              rounded(Math.min(a[2], b[2])),
              rounded(Math.max(a[2], b[2])),
            ]),
            "positions read along -z: rows 0-1 saw z 20..11, rows 3-4 z 9..0, row 2 nothing; no line crosses the gap"
          ).toEqual([
            [0, 11, 20],
            [0, 0, 9],
            [1, 11, 20],
            [1, 0, 9],
            [2, 12.8, 18.2],
            [2, 1.8, 7.2],
          ]);
        } finally {
          shape.delete();
        }
      })
    );

    it.effect(
      "reproduces the original hatch byte for byte under the default style, axis and span, over eight full projections",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const run = (plan: (litThreshold: number) => ShadingPlan) =>
          Effect.forEach(
            [-0.2, 0.55, 0.75, 1],
            (litThreshold) =>
              occt
                .project(
                  ProjectionRequest.make({
                    solid: legacyFixture,
                    cameras: legacyCameras,
                    shading: O.some(plan(litThreshold)),
                  })
                )
                .pipe(Effect.map(A.map((v: EdgeSet) => [v.visible, v.hidden, v.shading]))),
            { concurrency: 1 }
          ).pipe(
            Effect.flatMap((views) =>
              sha256Of(Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(views), identity))
            )
          );
        const result = yield* run((litThreshold) => ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold }));
        expect(result, "the hatch from before the style, axis and sliver options existed, at four lit thresholds").toBe(
          LEGACY_SHA256
        );
        const result1 = yield* run((litThreshold) =>
          ShadingPlan.make({
            minPitch: 1,
            maxPitch: 3,
            litThreshold,
            style: "uniform",
            axis: "longest-edge",
            minFaceSpan: 0,
          })
        );
        expect(result1).toBe(LEGACY_SHA256);
      }),
      hostedShardTimeoutMs
    );

    it.effect(
      "records coverage by skip reason: square-on front faces skip as lit under the uniform default, the hole wall curved",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const [plain, shaded] = yield* occt
          .project(ProjectionRequest.make({ solid: legacyFixture, cameras: [front], shading: O.none() }))
          .pipe(
            Effect.zip(
              occt.project(
                ProjectionRequest.make({
                  solid: legacyFixture,
                  cameras: [front],
                  shading: ShadingPlan.makeOption({ minPitch: 1, maxPitch: 3, litThreshold: 0.55 }),
                })
              )
            ),
            Effect.map(([a, b]) => [a[0], b[0]] as const)
          );
        expect(O.isNone(plain?.shadingCoverage ?? O.none())).toBe(true);
        const coverage = O.flatMap(O.fromNullishOr(shaded), (view) => view.shadingCoverage);
        assertSome(
          O.map(coverage, (c) => A.map(c.skippedFaces, (s) => s.reason)),
          ["back-facing", "curved", "lit"]
        );
      })
    );

    it.effect(
      "grades planar faces around curved and partially hidden geometry without producing degenerate strokes",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const views = yield* occt.project(
          ProjectionRequest.make({ solid: legacyFixture, cameras: legacyCameras, shading: O.some(graded()) })
        );
        const strokes = A.flatMap(views, (view) => view.shading);
        expect(
          A.length(strokes),
          "the legacy fixture holds planar, curved, foreshortened and partly hidden faces"
        ).toBeGreaterThan(0);
        expect(A.every(strokes, (stroke) => lengthOf(stroke) > 0)).toBe(true);
        expect(
          A.some(views, (view) =>
            O.exists(view.shadingCoverage, (coverage) =>
              A.some(coverage.skippedFaces, (skip) => skip.reason === "curved")
            )
          )
        ).toBe(true);
      })
    );

    it.effect(
      "groups every drawn stroke into one band of a shaded face, in the canonical stroke order",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const views = yield* occt.project(
          ProjectionRequest.make({ solid: legacyFixture, cameras: legacyCameras, shading: O.some(graded()) })
        );
        expect(A.some(views, (view) => A.length(view.shadingBands) > 1)).toBe(true);
        A.forEach(views, (view) => {
          const places = A.flatMap(view.shadingBands, (band) => band.strokes);
          expect(A.sort(places, Order.Number), "each stroke is in exactly one band").toEqual(
            A.map(view.shading, (_, at) => at)
          );
          A.forEach(view.shadingBands, (band) =>
            expect(band.strokes, "each band's strokes ascend").toEqual(A.sort(band.strokes, Order.Number))
          );
          const faces = A.dedupe(A.map(view.shadingBands, (band) => band.face));
          expect(
            O.exists(view.shadingCoverage, (coverage) => A.length(faces) <= coverage.shadedFaces),
            "only shaded faces carry bands"
          ).toBe(true);
        });
      })
    );

    it.effect(
      "drops strokes shorter than the plan's minimum on the view plane; a face too narrow for any stroke is a sliver",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const solid = box([-20, -15, 0], [20, 15, 20]);
        const [drawn] = yield* occt.project(
          ProjectionRequest.make({ solid, cameras: [front], shading: O.some(graded({ minStroke: 8 })) })
        );
        const [dropped] = yield* occt.project(
          ProjectionRequest.make({ solid, cameras: [front], shading: O.some(graded({ minStroke: 25 })) })
        );
        expect(drawn?.shading.length, "the 20-high wall's full chords clear 8 after their end insets").toBeGreaterThan(
          1
        );
        expect(
          dropped?.shading,
          "nothing clears 25, so the chord-aware offsets find no position and the face is a sliver"
        ).toEqual([]);
        assertSome(
          O.flatMap(O.fromNullishOr(dropped), (view) => view.shadingCoverage),
          ShadingCoverage.make({
            shadedFaces: 0,
            skippedFaces: [
              ShadingSkip.make({ reason: "back-facing", faces: 5 }),
              ShadingSkip.make({ reason: "sliver", faces: 1 }),
            ],
          })
        );
      })
    );

    it.effect(
      "measures a graded band from the face's own edge, not from a tab that sticks out past it",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({
          name: "wall",
          add: [
            Box.make({ min: [-20, -15, 0], max: [20, 15, 20] }),
            Box.make({ min: [20, -15, 5], max: [22, -13, 13] }),
          ],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall] }),
            cameras: [front],
            shading: O.some(graded()),
          })
        );
        const xs = pipe(
          view?.shading ?? [],
          A.filter(isVertical),
          A.map((s) => s[0]),
          A.sort(Order.Number)
        );
        expect(A.isReadonlyArrayNonEmpty(xs)).toBe(true);
        expect(
          Math.max(...xs),
          "probes through the coplanar bump on the shadow side see the face reach x = 22; no stroke lies in the bump"
        ).toBeLessThan(20);
        expect(Math.max(...xs), "the first stroke is a minimum pitch inside the wall's own edge at x = 20").toBeCloseTo(
          19,
          1
        );
      })
    );

    it.effect(
      "bands every separately bounded visible area of a face seen through a lattice, without leaking into its neighbours",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const plate = Part.make({ name: "plate", add: [Box.make({ min: [-60, -30, 0], max: [60, 30, 2] })] });
        const right = Part.make({ name: "right", add: [Box.make({ min: [0, -0.5, 2], max: [60, 0.5, 12] })] });
        const bridge = Part.make({ name: "bridge", add: [Box.make({ min: [-0.5, -0.5, 2], max: [0.5, 30, 12] })] });
        const left = Part.make({ name: "left", add: [Box.make({ min: [-60, 9.5, 2], max: [0, 10.5, 12] })] });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [plate, right, bridge, left] }),
            cameras: [top],
            shading: O.some(graded({ minStroke: 0.5 })),
          })
        );
        const onPlate = A.filter(view?.shading ?? [], ([x1, y1, x2, y2]) => {
          const x = (x1 + x2) / 2;
          const y = (y1 + y2) / 2;
          return !(
            (y > -0.5 && y < 0.5 && x > 0) ||
            (y > 9.5 && y < 10.5 && x < 0) ||
            (x > -0.5 && x < 0.5 && y > -0.5)
          );
        });
        expect(
          A.isReadonlyArrayNonEmpty(onPlate) && A.every(onPlate, isHorizontal),
          "the plate's right and bottom edges tie for dark; the tie goes to the edge least aligned with the sheet's vertical"
        ).toBe(true);
        const strokesThroughBox = (x0: number, x1: number, y0: number, y1: number) =>
          A.length(
            A.filter(onPlate, ([xa, y, xb]) => y > y0 && y < y1 && Math.max(xa, xb) > x0 && Math.min(xa, xb) < x1)
          );
        expect(
          strokesThroughBox(2, 60, -30, -20),
          "the lower area, in one piece below the middle wall, gets one band at the plate's bottom edge"
        ).toBeGreaterThanOrEqual(2);
        expect(strokesThroughBox(-60, -2, -30, -20), "that band runs through both halves").toBeGreaterThanOrEqual(2);
        expect(
          strokesThroughBox(2, 60, 2, 13),
          "the upper-right area gets a band hugging the right wall, drawn only in the rows that saw it"
        ).toBeGreaterThanOrEqual(2);
        expect(
          strokesThroughBox(-60, -2, 12, 23),
          "the upper-left area gets a band hugging the left wall"
        ).toBeGreaterThanOrEqual(2);
        expect(
          strokesThroughBox(-60, -9, 2, 8),
          "drawn in its probes' cells, the right wall's band runs past the middle wall by half a cell (120 / 18) at most"
        ).toBe(0);
        expect(strokesThroughBox(9, 60, 14, 30), "the left wall's band does not run on into the right half").toBe(0);
        expect(strokesThroughBox(-60, 60, -18, -3), "the lower area's lit side stays bare").toBe(0);
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) => O.map(v.shadingCoverage, (c) => c.lostFaces)),
          0
        );
      })
    );

    it.effect(
      "bands a wall beside a fin standing on it, where the fin's probe chords start inside the fin",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-40, 0, 0], max: [40, 4, 40] })] });
        const fin = Part.make({ name: "fin", add: [Box.make({ min: [-2, -30, 0], max: [2, 0, 30] })] });
        const camera = Camera.make({ eye: [-1, -1, 1], up: [0, 0, 1] });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall, fin] }),
            cameras: [camera],
            shading: O.some(graded({ minStroke: 1, minFaceSpan: 6 })),
          })
        );
        const strokes = view?.shading ?? [];
        const finLeftEdgeSheetX = -2 / Math.SQRT2;
        const sheetX = ([x1, , x2]: Segment) => (x1 + x2) / 2;
        const onWallLeft = A.filter(strokes, (s) => isVertical(s) && Math.abs(sheetX(s) - finLeftEdgeSheetX) > 0.5);
        expect(
          A.length(onWallLeft),
          "every probe starts or runs inside the abutting fin; passed as short pieces, the area left of it still bands"
        ).toBeGreaterThanOrEqual(2);
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
          ),
          [0, 0] as const
        );
      })
    );

    it.effect(
      "bands a cell walled off by slanting walls on its own, apart from the area outside the walls",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const hexagon = (radius: number, z: number) =>
          A.makeBy(6, (k) => [radius * Math.cos((k * Math.PI) / 3), radius * Math.sin((k * Math.PI) / 3), z] as const);
        const plate = Part.make({ name: "plate", add: [Box.make({ min: [-60, -60, 0], max: [60, 60, 2] })] });
        const ring = Part.make({
          name: "ring",
          add: [Prism.make({ profile: A.map(hexagon(30, 2), (p) => [...p]), extrusion: [0, 0, 10] })],
          subtract: [Prism.make({ profile: A.map(hexagon(28, 1), (p) => [...p]), extrusion: [0, 0, 12] })],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [plate, ring] }),
            cameras: [top],
            shading: O.some(graded({ minStroke: 0.5, minFaceSpan: 6 })),
          })
        );
        const strokes = view?.shading ?? [];
        const radiusOf = ([x1, y1, x2, y2]: Segment) => Math.hypot((x1 + x2) / 2, (y1 + y2) / 2);
        expect(
          A.length(A.filter(strokes, (s) => radiusOf(s) < 24)),
          "rows see the cell's and the outside pieces overlap across the slanting walls; the link test keeps the cell apart"
        ).toBeGreaterThanOrEqual(2);
        expect(
          A.length(A.filter(strokes, (s) => radiusOf(s) > 40)),
          "the outside area keeps its band at the plate's edge"
        ).toBeGreaterThanOrEqual(2);
        const within = (radius: number) => (x: number, y: number) =>
          A.every(
            A.makeBy(6, (k) => (Math.PI / 6) * (2 * k + 1)),
            (a) => x * Math.cos(a) + y * Math.sin(a) <= radius * Math.cos(Math.PI / 6) + 1e-6
          );
        const inCell = within(28);
        const inRing = within(30);
        expect(
          A.some(
            strokes,
            ([x1, y1, x2, y2]) => (inCell(x1, y1) && !inRing(x2, y2)) || (inCell(x2, y2) && !inRing(x1, y1))
          ),
          "no stroke runs across the ring from the cell (inner apothem 24.2) to outside it"
        ).toBe(false);
        const onlyPlateShadedRingTopSliver = [1, 1, 0, 0] as const;
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(
              v.shadingCoverage,
              (c) =>
                [
                  c.shadedFaces,
                  O.getOrElse(
                    O.map(
                      A.findFirst(c.skippedFaces, (skip) => skip.reason === "sliver"),
                      (skip) => skip.faces
                    ),
                    () => 0
                  ),
                  c.lostFaces,
                  c.lostStretches,
                ] as const
            )
          ),
          onlyPlateShadedRingTopSliver
        );
      })
    );

    it.effect(
      "keeps a cell's band that two probe rows saw inside the rows' own cells, never across a crossing strip",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = (name: string, [ax, ay]: readonly [number, number], [bx, by]: readonly [number, number]) => {
          const length = Math.hypot(bx - ax, by - ay);
          const halfAlongX = (bx - ax) / length / 2;
          const halfAlongY = (by - ay) / length / 2;
          return Part.make({
            name,
            add: [
              Prism.make({
                profile: [
                  [ax - halfAlongX - halfAlongY, ay - halfAlongY + halfAlongX, 2],
                  [ax - halfAlongX + halfAlongY, ay - halfAlongY - halfAlongX, 2],
                  [bx + halfAlongX + halfAlongY, by + halfAlongY - halfAlongX, 2],
                  [bx + halfAlongX - halfAlongY, by + halfAlongY + halfAlongX, 2],
                ],
                extrusion: [0, 0, 10],
              }),
            ],
          });
        };
        const plate = Part.make({ name: "plate", add: [Box.make({ min: [-60, -30, 0], max: [60, 30, 2] })] });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({
              parts: [
                plate,
                wall("bottom", [8, -10], [18, -10]),
                wall("side", [18, -10], [18, 12]),
                wall("top", [18, 12], [-5, 12]),
                wall("strip", [-5, 12], [8, -10]),
              ],
            }),
            cameras: [top],
            shading: O.some(graded({ minStroke: 0.5, minFaceSpan: 6 })),
          })
        );
        const stripCentreX = (y: number) => 8 - ((y + 10) * 13) / 22;
        const betweenCellWalls = A.filter(view?.shading ?? [], (s) => isHorizontal(s) && s[1] > -9.5 && s[1] < 11.5);
        expect(
          A.length(betweenCellWalls),
          "only the probe rows at x = 0 and 13.3 cross the cell; their cells already give it a band"
        ).toBeGreaterThanOrEqual(2);
        expect(
          A.filter(betweenCellWalls, ([x1, y, x2]) => Math.min(x1, x2) <= stripCentreX(y) || Math.max(x1, x2) >= 17.5),
          "each stroke is clipped to the cell of the row that saw it, so none runs across the strip; the measured room " +
            "only rescues an area its rows' cells leave bare"
        ).toEqual([]);
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
          ),
          [0, 0] as const
        );
      })
    );

    it.effect(
      "draws a lit band glimpsed through one probe row on its whole chords cut back to its taper, never bare",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const root = Math.sqrt(2 / 3);
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [0, -6, 0], max: [2, 6, 90] })] });
        const shadeWall = Effect.fnUntraced(function* (eye: readonly [number, number, number], blockBottom: number) {
          const camera = Camera.make({ eye: [...eye], up: [0, 0, 1] });
          const block = Part.make({
            name: "block",
            add: [Box.make({ min: [-30, -200, blockBottom], max: [-20, 200, 200] })],
          });
          const [view] = yield* occt.project(
            ProjectionRequest.make({
              solid: ModelSpec.make({ parts: [wall, block] }),
              cameras: [camera],
              shading: O.some(graded({ minStroke: 1.5 })),
            })
          );
          return {
            tone: toneOf(-viewFactsOf(camera).light[0]),
            strokes: A.filter(view?.shading ?? [], (s) => isVertical(s) && Math.abs(s[0]) < 6),
            lost: O.flatMap(O.fromNullishOr(view), (v) =>
              O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
            ),
          };
        });
        const lit = yield* shadeWall([-root, 0, -1 / Math.sqrt(3)], -6);
        expect(lit.tone, "the wall's front face has outward normal -x, so its exposure is -light.x").toBe("faint");
        expect(
          A.length(lit.strokes),
          "only the lowest of nine 10-tall probe cells sees the strip; the wall's strokes lie within sheet |x| < 6"
        ).toBeGreaterThanOrEqual(2);
        const [first = 0, second = 0] = pipe(
          lit.strokes,
          A.sort(Order.mapInput(Order.Number, (s: Segment) => -s[0])),
          A.map(lengthOf)
        );
        expect(
          first,
          "the taper never empties the band: drawn on whole clipped chords, each cut back to its taper, nearest x = 6 longer"
        ).toBeGreaterThan(second);
        assertSome(lit.lost, [0, 0] as const);
        const dim = yield* shadeWall([-root / 2, (root * Math.sqrt(3)) / 2, -1 / Math.sqrt(3)], -20.3);
        expect(dim.tone).toBe("medium");
        expect(
          A.length(dim.strokes),
          "control: turned from the light, the same one-row strip keeps full-length strokes"
        ).toBeGreaterThanOrEqual(2);
        assertSome(dim.lost, [0, 0] as const);
      })
    );

    it.effect(
      "re-plans a lit band past a one-row tip of its area before drawing it untapered",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const root = Math.sqrt(2 / 3);
        const bottom = (y: number) => -6 + 1.15 * (y + 6);
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [0, -6, 0], max: [2, 6, 90] })] });
        const wedge = Part.make({
          name: "wedge",
          add: [
            Prism.make({
              profile: [
                [-30, -20, bottom(-20)],
                [-30, 20, bottom(20)],
                [-30, 20, 200],
                [-30, -20, 200],
              ],
              extrusion: [10, 0, 0],
            }),
          ],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall, wedge] }),
            cameras: [Camera.make({ eye: [-root, 0, -1 / Math.sqrt(3)], up: [0, 0, 1] })],
            shading: O.some(graded({ minStroke: 1.5 })),
          })
        );
        const strokes = pipe(
          view?.shading ?? [],
          A.filter((s) => isVertical(s) && Math.abs(s[0]) < 6),
          A.sort(Order.mapInput(Order.Number, (s: Segment) => -s[0]))
        );
        expect(A.length(strokes)).toBeGreaterThanOrEqual(2);
        expect(
          A.every(strokes, (s) => s[0] < 1),
          "the band is re-planned past the one-row tip (the first 6 from the shadow edge, less a pitch's slack)"
        ).toBe(true);
        const [first = 0, second = 0] = A.map(strokes, lengthOf);
        expect(first, "the band keeps its taper: the stroke nearest the shadow edge is the longer").toBeGreaterThan(
          second
        );
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
          ),
          [0, 0] as const
        );
      })
    );

    it.effect(
      "bands a wall parallel to the picture plane alike in two-point top and bottom views and in its elevation",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const bounds = BoundingBox.make({ min: [0, 0, 0], max: [1.5, 30, 20] });
        const twoPoint = (view: "top-perspective" | "bottom-perspective") =>
          cameraForView({
            view,
            box: bounds,
            projection: "two-point",
            azimuthDeg: O.some(90),
            elevationDeg: O.some(20),
          });
        const views = yield* occt.project(
          ProjectionRequest.make({
            solid: box([0, 0, 0], [1.5, 30, 20]),
            cameras: [twoPoint("top-perspective"), twoPoint("bottom-perspective"), left],
            shading: O.some(graded()),
          })
        );
        const round = (value: number) => Math.round(value * 100) / 100;
        const bandOf = (view: EdgeSet) => {
          const edges = A.filter(view.visible, isVertical);
          const xs = A.map(edges, (s) => s[0]);
          const ys = A.flatMap(edges, (s) => [s[1], s[3]]);
          const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
          return pipe(
            view.shading,
            A.filter(
              (s) => isVertical(s) && s[0] > x0 && s[0] < x1 && (s[1] + s[3]) / 2 > y0 && (s[1] + s[3]) / 2 < y1
            ),
            A.map((s) => [round((s[0] - x0) / (x1 - x0)), round(lengthOf(s) / (y1 - y0))] as const),
            A.sort(Order.mapInput(Order.Number, ([at]: readonly [number, number]) => at))
          );
        };
        const [above = [], below = [], elevation = []] = A.map(views, bandOf);
        expect(
          A.length(above),
          "read between the face's two vertical edges, the only vertical outlines; the 1.5-thick wall has no banded neighbour"
        ).toBe(4);
        const [first = 0, second = 0, third = 0, fourth = 0] = A.map(A.reverse(above), ([, extent]) => extent);
        expect(first, "the light recipe: two whole strokes at the shadow edge, sheet right").toBe(second);
        expect(third, "then a taper toward the light").toBeLessThan(second);
        expect(fourth).toBeLessThan(third);
        expect(
          below,
          "lit on the picture plane, the wall takes the square-on exposure 1/√3 from below as from above"
        ).toEqual(above);
        expect(elevation, "and the same band as in its left elevation").toEqual(above);
      })
    );

    it.effect(
      "redraws a tapered band a slot shows only at a wall's foot on its whole chords in a two-point bottom view",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const plate = Part.make({
          name: "plate",
          add: [Box.make({ min: [-30, -52.5, 0], max: [30, 30, 2] })],
          subtract: [Box.make({ min: [-20, -32.5, -1], max: [20, -10, 3] })],
        });
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-10, -10, 2], max: [10, -8, 92] })] });
        const camera = cameraForView({
          view: "bottom-perspective",
          box: BoundingBox.make({ min: [-30, -52.5, 0], max: [30, 30, 92] }),
          projection: "two-point",
          azimuthDeg: O.some(-35),
        });
        expect(
          toneOf(-viewFactsOf(camera).light[1]),
          "turned 35° off the wall, its front face (normal -y) is lit; square-on it takes the light recipe, and at 45° its rows need no redraw"
        ).toBe("faint");
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [plate, wall] }),
            cameras: [camera],
            shading: O.some(graded({ minStroke: 1.5 })),
          })
        );
        const strokes = A.filter(view?.shading ?? [], isVertical);
        const strip = A.filter(strokes, (s) => lengthOf(s) < 10);
        const above = A.filter(strokes, (s) => lengthOf(s) >= 10);
        expect(
          A.length(strip),
          "through the slot only the lowest rows see the wall's foot: its band is shorter than one probe cell"
        ).toBeGreaterThanOrEqual(2);
        expect(A.length(above), "the band above the plate's front edge runs over several cells").toBeGreaterThanOrEqual(
          2
        );
        const heights = (segments: ReadonlyArray<Segment>) => A.flatMap(segments, ([, y1, , y2]) => [y1, y2]);
        expect(
          Math.max(...heights(strip)),
          "the plate hid each planned stroke above the strip, so the band is redrawn on whole chords cut to the strip"
        ).toBeLessThan(Math.min(...heights(above)));
        const stripBandRedrawnOnce = [0, 0, 1] as const;
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches, c.redrawnStretches] as const)
          ),
          stripBandRedrawnOnce
        );
      })
    );

    it.effect(
      "bands both halves of a far point glimpsed at its foot below a crossing wall in a two-point bottom view",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const front = Part.make({ name: "front", add: [Box.make({ min: [0, -30, 0], max: [1, 30, 105] })] });
        const chevron = Part.make({
          name: "chevron",
          add: [
            Prism.make({
              profile: [
                [1, 11.547, 0],
                [21, 0, 0],
                [1, -11.547, 0],
                [1, -12.702, 0],
                [23, 0, 0],
                [1, 12.702, 0],
              ],
              extrusion: [0, 0, 105],
            }),
          ],
        });
        const camera = cameraForView({
          view: "bottom-perspective",
          box: BoundingBox.make({ min: [0, -30, 0], max: [23, 30, 105] }),
          projection: "two-point",
          azimuthDeg: O.some(90),
          elevationDeg: O.some(20),
        });
        const light = viewFactsOf(camera).light;
        expect(
          pipe(
            [
              [-0.5, -Math.sqrt(3) / 2],
              [-0.5, Math.sqrt(3) / 2],
            ],
            A.map(([nx = 0, ny = 0]) => toneOf(nx * light[0] + ny * light[1])),
            A.sort(Order.String)
          ),
          "the two inner faces, 30° off the sight line, are lit dark and faint by the picture-plane light"
        ).toEqual(["dark", "faint"]);
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [front, chevron] }),
            cameras: [camera],
            shading: O.some(graded({ minStroke: 1.5 })),
          })
        );
        const chevronCornerLowY = 103.944;
        const wallBottomY = 111.636;
        const bays = A.filter(
          view?.shading ?? [],
          (s) =>
            isVertical(s) &&
            Math.abs(s[0]) < 13 &&
            Math.min(s[1], s[3]) >= chevronCornerLowY &&
            Math.max(s[1], s[3]) <= wallBottomY
        );
        const halfPitchClearance = 0.5;
        const outlines = view?.visible ?? [];
        const clearOf = ([x1, y1, x2, y2]: Segment) =>
          Math.min(
            nearestOutlineDistance({ x: x1, y: y1, outlines }),
            nearestOutlineDistance({ x: x2, y: y2, outlines })
          );
        const banded = (strokes: ReadonlyArray<Segment>) =>
          A.length(strokes) >= 2 &&
          A.every(strokes, (s) => lengthOf(s) >= 1.5 - 1e-6 && clearOf(s) >= halfPitchClearance);
        expect(
          banded(A.filter(bays, (s) => s[0] < 0)),
          "a probe row a pitch inside each end of a face's reach measures a bay near its base: the dark band is at the corner"
        ).toBe(true);
        const faint = A.filter(bays, (s) => s[0] > 0);
        expect(
          banded(faint),
          "the faint half's room is measured column by column, so its band moves in from the acute tip to where it fits"
        ).toBe(true);
        expect(
          A.every(faint, (s) => s[0] <= 11.955 / 2),
          "the faint band sits in the half of the 11.955-wide bay beside the corner"
        ).toBe(true);
        expect(ladderFindings(view), "neither band reads with the outlines beside it as one ladder").toEqual([]);
        const coverage = O.flatMap(O.fromNullishOr(view), (v) => v.shadingCoverage);
        assertSome(
          O.map(coverage, (c) => [c.lostFaces, c.lostStretches] as const),
          [0, 0] as const
        );
        const skippedThoughFitting = O.map(coverage, (c) => A.filter(c.skippedStretches, (skip) => skip.fitting > 0));
        assertSome(skippedThoughFitting, []);
        const validatorFindings = O.map(coverage, (c) => shadingCoverageFindings({ page: 1, coverage: c }));
        assertSome(validatorFindings, []);
      })
    );

    it.effect(
      "counts a one-line narrow stretch and a bare no-room edge, skipped by design, with whether their room fits a band",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const skipsOf = (view: EdgeSet | undefined) =>
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) =>
              A.map(c.skippedStretches, (skip) => [skip.reason, skip.stretches, skip.fitting])
            )
          );
        const findingsOf = (view: EdgeSet | undefined) =>
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => shadingCoverageFindings({ page: 1, coverage: c }))
          );
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, -15, 0], max: [20, 15, 20] })] });
        const slab = Part.make({ name: "slab", add: [Box.make({ min: [-30, -40, -5], max: [18, -25, 25] })] });
        const [narrow] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall, slab] }),
            cameras: [front],
            shading: O.some(graded({ minStroke: 1.5 })),
          })
        );
        assertSome(skipsOf(narrow), [["narrow", 1, 0]]);
        assertSome(findingsOf(narrow), []);
        const [edge] = yield* occt.project(
          ProjectionRequest.make({
            solid: box([-20, -15, 0], [20, 15, 2]),
            cameras: [Camera.make({ eye: [0, -1, 1], up: [0, 0, 1] })],
            shading: O.some(graded()),
          })
        );
        assertSome(skipsOf(edge), [["no-room", 1, 0]]);
        assertSome(findingsOf(edge), []);
      })
    );

    it.effect(
      "cuts a lit band redrawn on its whole chords back to its taper, under its darker neighbour's ink",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const prism = Part.make({
          name: "prism",
          add: [
            Prism.make({
              profile: [
                [0, 20, 0],
                [2.736, 12.482, 0],
                [38.988, -4.422, 0],
                [53.988, 15, 0],
              ],
              extrusion: [0, 0, 90],
            }),
          ],
        });
        const block = Part.make({ name: "block", add: [Box.make({ min: [-40, -200, 6], max: [-30, 200, 200] })] });
        const shade = Effect.fnUntraced(function* (parts: ReadonlyArray<Part>) {
          const [view] = yield* occt.project(
            ProjectionRequest.make({
              solid: ModelSpec.make({ parts: [...parts] }),
              cameras: [Camera.make({ eye: [-1, 0, 0], up: [0, 0, 1] })],
              shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
            })
          );
          const strokes = A.filter(view?.shading ?? [], isVertical);
          const within = (x0: number, x1: number) => A.filter(strokes, (s) => s[0] > x0 && s[0] < x1);
          const inkOf = (x0: number, x1: number) => sumOf(A.map(within(x0, x1), lengthOf)) / (x1 - x0);
          return {
            lit: A.sort(
              within(-20, -12.48),
              Order.mapInput(Order.Number, (s: Segment) => -s[0])
            ),
            litInk: inkOf(-20, -12.48),
            darkInk: inkOf(-12.48, 4.42),
            coverage: O.flatMap(O.fromNullishOr(view), (v) =>
              O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches, c.redrawnStretches] as const)
            ),
          };
        });
        const glimpsed = yield* shade([prism, block]);
        expect(
          glimpsed.litInk,
          "the lit band, hidden but for a 6-tall strip, is redrawn on whole chords and its ink order read on what is drawn"
        ).toBeLessThanOrEqual(glimpsed.darkInk);
        const [first = 0, second = 0] = A.map(glimpsed.lit, lengthOf);
        expect(A.length(glimpsed.lit)).toBe(2);
        expect(
          first,
          "each redrawn run is cut back to its taper: the stroke nearest the shared edge is the longer"
        ).toBeGreaterThan(second);
        assertSome(glimpsed.coverage, [0, 0, 1] as const);
        const whole = yield* shade([prism]);
        expect(
          whole.litInk,
          "control: without the block both faces show whole, nothing is redrawn, and the order holds"
        ).toBeLessThanOrEqual(whole.darkInk);
        const [wholeFirst = 0, wholeSecond = 0] = A.map(whole.lit, lengthOf);
        expect(wholeFirst).toBeGreaterThan(wholeSecond);
        assertSome(whole.coverage, [0, 0, 0] as const);
      })
    );

    it.effect(
      "shades every visible stretch of a wall at the side nearest its shadow edge",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, -15, 0], max: [20, 15, 20] })] });
        const slab = Part.make({ name: "slab", add: [Box.make({ min: [8, -40, -5], max: [26, -25, 25] })] });
        const post = Part.make({ name: "post", add: [Box.make({ min: [-2, -40, -5], max: [2, -25, 25] })] });
        const strokeXs = (solid: ModelSpec) =>
          occt
            .project(ProjectionRequest.make({ solid, cameras: [front], shading: O.some(graded({ minStroke: 0.5 })) }))
            .pipe(
              Effect.map((views) =>
                pipe(
                  views[0]?.shading ?? [],
                  A.filter((s) => isVertical(s) && s[0] > -19),
                  A.map((s) => s[0]),
                  A.sort(Order.Number)
                )
              )
            );
        const alone = yield* strokeXs(ModelSpec.make({ parts: [wall] }));
        expect(A.isReadonlyArrayNonEmpty(alone) && A.every(alone, (x) => x >= 7)).toBe(true);
        const strokeXs2 = yield* strokeXs(ModelSpec.make({ parts: [wall, slab] }));
        const slabbed = A.filter(strokeXs2, (x) => x <= 20);
        expect(
          A.isReadonlyArrayNonEmpty(slabbed) && A.every(slabbed, (x) => x < 8),
          "the slab in front of x >= 8 hides the wall's shadow edge at x = 20; the slab's own strokes sit past x = 20"
        ).toBe(true);
        expect(
          Math.max(...slabbed),
          "behind the slab the wall's band hugs the slab's edge, its first line one pitch left of x = 8"
        ).toBeCloseTo(7, 1);
        const posted = yield* strokeXs(ModelSpec.make({ parts: [wall, post] }));
        expect(
          A.some(posted, (x) => x > 7),
          "the post in front of the wall's middle splits it in two; the right stretch keeps its band"
        ).toBe(true);
        expect(
          Math.max(...A.filter(posted, (x) => x < -2)),
          "the left stretch gets a band next to the post"
        ).toBeCloseTo(-3, 1);
        const views = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall, post] }),
            cameras: [front],
            shading: O.some(graded({ minStroke: 0.5 })),
          })
        );
        const lostToHiddenLineRemoval = O.flatMap(O.fromNullishOr(views[0]), (v) =>
          O.map(v.shadingCoverage, (c) => c.lostFaces)
        );
        assertSome(lostToHiddenLineRemoval, 0);
      })
    );

    it.effect(
      "keeps graded stroke ends the plan's clearance from the outlines",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, -15, 0], max: [20, 15, 20] })] });
        const strokeEndHeights = (clearance?: number) =>
          occt
            .project(
              ProjectionRequest.make({
                solid: ModelSpec.make({ parts: [wall] }),
                cameras: [front],
                shading: O.some(graded({ minStroke: 0.5, clearance })),
              })
            )
            .pipe(
              Effect.map((views) => {
                const ys = A.flatMap(A.filter(views[0]?.shading ?? [], isVertical), (s: Segment) => [s[1], s[3]]);
                return [Math.min(...ys), Math.max(...ys)] as const;
              })
            );
        const [low, high] = yield* strokeEndHeights();
        expect(
          low,
          "a bare plan draws strokes one pitch back from the outlines they end on (0 and 20), already clearing half a pitch"
        ).toBeGreaterThanOrEqual(0.9);
        expect(low).toBeLessThanOrEqual(1.1);
        expect(high).toBeGreaterThanOrEqual(18.9);
        expect(high).toBeLessThanOrEqual(19.1);
        const [lowCleared, highCleared] = yield* strokeEndHeights(3);
        expect(
          lowCleared,
          "a plan that carries a clearance keeps the ends at least that far away"
        ).toBeGreaterThanOrEqual(3);
        expect(highCleared).toBeLessThanOrEqual(17);
      })
    );

    it.effect(
      "maps graded probes through a perspective camera the way the hidden-line pass projects",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, -15, 0], max: [20, 15, 20] })] });
        const post = Part.make({ name: "post", add: [Box.make({ min: [-2, -40, -5], max: [2, -25, 25] })] });
        const strokesShadedLost = (view: EdgeSet) => [
          A.length(view.shading),
          ...O.getOrElse(
            O.map(view.shadingCoverage, (c) => [c.shadedFaces, c.lostFaces]),
            () => [-1, -1]
          ),
        ];
        const views = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall, post] }),
            cameras: [
              front,
              Camera.make({ eye: [0, -1, 0], up: [0, 0, 1], focus: O.some(300) }),
              Camera.make({ eye: [-90, -120, 65], up: [0, 0, 1], target: [0, 0, 10] }),
              Camera.make({ eye: [-90, -120, 65], up: [0, 0, 1], target: [0, 0, 10], focus: O.some(300) }),
            ],
            shading: O.some(graded({ minStroke: 0.5 })),
          })
        );
        expect(
          strokesShadedLost(views[1]!),
          "from the front both probe ends sit at one depth, so perspective matches its orthographic twin"
        ).toEqual(strokesShadedLost(views[0]!));
        expect(
          strokesShadedLost(views[3]!),
          "from an oblique eye a partly hidden probe's window is walked back through the camera's projection"
        ).toEqual(strokesShadedLost(views[2]!));
        expect(
          strokesShadedLost(views[2]!),
          "the post's 4 mm faces skip as narrow (a lone line reads as a doubled edge); the wall bands only in rows that saw it"
        ).toEqual([12, 4, 0]);
      })
    );

    it.effect(
      "hatches a square-on face under graded shading, which the uniform default leaves blank",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const solid = box([-20, -15, 0], [20, 15, 20]);
        const [uniform] = yield* occt.project(
          ProjectionRequest.make({
            solid,
            cameras: [front],
            shading: ShadingPlan.makeOption({ minPitch: 1, maxPitch: 3, litThreshold: 0.55 }),
          })
        );
        const [gradedView] = yield* occt.project(
          ProjectionRequest.make({ solid, cameras: [front], shading: O.some(graded()) })
        );
        expect(uniform?.shading).toEqual([]);
        expect(gradedView?.shading.length).toBeGreaterThan(1);
        assertSome(
          O.flatMap(O.fromNullishOr(gradedView), (view) => view.shadingCoverage),
          ShadingCoverage.make({
            shadedFaces: 1,
            skippedFaces: [ShadingSkip.make({ reason: "back-facing", faces: 5 })],
          })
        );
      })
    );

    it.effect(
      "grades the gaps from the shadow edge: first gap the minimum pitch, then growing to the cap",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: box([-20, -15, 0], [20, 15, 20]),
            cameras: [front],
            shading: O.some(graded()),
          })
        );
        const shading = view?.shading ?? [];
        expect(A.every(shading, isVertical)).toBe(true);
        const columns = pipe(
          shading,
          A.map(([x]) => x),
          A.dedupe,
          A.sort(Order.flip(Order.Number))
        );
        const gaps = A.zipWith([20, ...columns], columns, (a, b) => Math.round((a - b) * 1e3) / 1e3);
        expect(
          gaps[0],
          "the 1.84(m) light comes from the upper left, so the shadow edge is the right one, x = 20"
        ).toBe(1);
        expect(
          A.every(
            A.zipWith(gaps, A.drop(gaps, 1), (a, b) => b >= a),
            (grows) => grows
          )
        ).toBe(true);
        expect(Math.max(...gaps)).toBeLessThanOrEqual(3);
        expect(A.length(columns)).toBeGreaterThanOrEqual(2);
      })
    );

    it.effect(
      "hatches upright faces vertically in the front and both side views",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const solid = box([-30, -5, 0], [30, 5, 12]);
        const views = yield* occt.project(
          ProjectionRequest.make({ solid, cameras: [front, left, right], shading: O.some(graded()) })
        );
        expect(A.length(views)).toBe(3);
        expect(
          A.map(views, (view) => A.isReadonlyArrayNonEmpty(view.shading) && A.every(view.shading, isVertical))
        ).toEqual([true, true, true]);
        const [longest] = yield* occt.project(
          ProjectionRequest.make({ solid, cameras: [front], shading: O.some(graded({ axis: "longest-edge" })) })
        );
        expect(
          A.every(longest?.shading ?? [], isHorizontal),
          "the wide, low wall's longest edge is horizontal, so the longest-edge axis hatches it horizontally"
        ).toBe(true);
      })
    );

    it.effect(
      "gives equally inclined faces mirrored about the light azimuth equal bands",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const roof = ModelSpec.make({
          parts: [
            Part.make({
              name: "roof",
              add: [
                Prism.make({
                  profile: [
                    [-10, -15, 0],
                    [10, -15, 0],
                    [0, -15, 8],
                  ],
                  extrusion: [0, 30, 0],
                  rotate: [Rotation.make({ axis: [0, 0, 1], degrees: 45 })],
                }),
              ],
            }),
          ],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({ solid: roof, cameras: [top], shading: O.some(graded()) })
        );
        const shading = view?.shading ?? [];
        const sideOfRidge = ([x1, y1, x2, y2]: Segment) => (x1 + x2 + y1 + y2) / 2;
        const lower = A.filter(shading, (s) => sideOfRidge(s) < 0);
        const upper = A.filter(shading, (s) => sideOfRidge(s) > 0);
        expect(A.length(lower)).toBeGreaterThan(0);
        expect(
          A.length(lower),
          "the ridge runs along (-1, 1, 0), x + y = 0 in plan, and the 1.84(m) light lies in its vertical plane"
        ).toBe(A.length(upper));
        expect(Math.abs(sumOf(A.map(lower, lengthOf)) - sumOf(A.map(upper, lengthOf)))).toBeLessThan(1e-2);
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) => O.map(v.shadingCoverage, (c) => c.shadedFaces)),
          2
        );
      })
    );

    it.effect(
      "cuts a lit face's band back to the lit taper where it would out-ink the darker face across its ridge",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const block = Part.make({
          name: "block",
          add: [
            Prism.make({
              profile: [
                [0, 0, 0],
                [30, 0, 0],
                [30, 0, 20],
                [0, 0, 60],
              ],
              extrusion: [0, 30, 0],
            }),
          ],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [block] }),
            cameras: [Camera.make({ eye: [-1, -1, 1], up: [0, 0, 1] })],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        const strokes = view?.shading ?? [];
        expect(A.every(strokes, isVertical)).toBe(true);
        const lit = A.filter(strokes, (s) => s[0] < 0);
        const dark = A.filter(strokes, (s) => s[0] > 0);
        const sheetPerModelHeight = 2 / Math.sqrt(6);
        const chordOfDark = (sheetX: number) => (60 - (40 * sheetX * Math.SQRT2) / 30) * sheetPerModelHeight;
        expect(A.length(lit)).toBeGreaterThanOrEqual(2);
        expect(
          Math.max(...A.map(lit, lengthOf)),
          "a lit face never out-inks a darker face sharing a visible edge, so the lit band takes the lit taper"
        ).toBeLessThanOrEqual(0.6 * 60 * sheetPerModelHeight + 1e-6);
        const nearest = pipe(dark, A.sort(Order.mapInput(Order.flip(Order.Number), (s: Segment) => s[0])), A.head);
        expect(
          O.exists(nearest, (s) => lengthOf(s) > 0.6 * chordOfDark(s[0])),
          "the dark band keeps full-length lines: its stroke nearest its shadow edge runs past 0.6 of its chord"
        ).toBe(true);
        const densityOf = (face: ReadonlyArray<Segment>, modelArea: number) =>
          sumOf(A.map(face, lengthOf)) / (modelArea / Math.sqrt(3));
        expect(
          densityOf(lit, 30 * 60),
          "each face's visible area is 1/sqrt(3) of its model area; planned face by face the lit band out-inked the dark"
        ).toBeLessThan(densityOf(dark, (30 * (60 + 20)) / 2));
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.shadedFaces, c.lostFaces, c.lostStretches] as const)
          ),
          [2, 0, 0] as const
        );
      })
    );

    it.effect(
      "keeps the full-length lines of an elevation wall square to the viewer beside a darker face",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const block = Part.make({
          name: "block",
          add: [
            Prism.make({
              profile: [
                [-20, 0, 0],
                [15, 0, 0],
                [20, 5, 0],
                [20, 30, 0],
                [-20, 30, 0],
              ],
              extrusion: [0, 0, 20],
            }),
          ],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [block] }),
            cameras: [front],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        const strokes = view?.shading ?? [];
        const wall = pipe(
          strokes,
          A.filter((s) => isVertical(s) && s[0] < 15),
          A.sort(Order.mapInput(Order.flip(Order.Number), (s: Segment) => s[0]))
        );
        expect(
          A.map(A.take(wall, 2), (s) => Math.round(lengthOf(s) * 1e3) / 1e3),
          "the narrow chamfer's two-line band is far denser, so the wall keeps two full lines: its height less a pitch each end"
        ).toEqual([18, 18]);
        expect(A.length(wall)).toBeGreaterThanOrEqual(3);
        expect(
          A.length(A.filter(strokes, (s) => s[0] > 15)),
          "the darker chamfer beside the wall's shadow edge x = 15 keeps its own band"
        ).toBeGreaterThanOrEqual(2);
      })
    );

    it.effect(
      "compares the ink of two faces only across an edge the view shows",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const block = Part.make({
          name: "block",
          add: [
            Prism.make({
              profile: [
                [0, 0, 0],
                [30, 0, 0],
                [30, 0, 20],
                [0, 0, 60],
              ],
              extrusion: [0, 30, 0],
            }),
          ],
        });
        const post = Part.make({ name: "post", add: [Box.make({ min: [-8, -10, 0], max: [-4, -6, 70] })] });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [block, post] }),
            cameras: [Camera.make({ eye: [-1, -1, 1], up: [0, 0, 1] })],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        const lit = A.filter(view?.shading ?? [], (s) => isVertical(s) && s[0] < -Math.SQRT2);
        expect(
          A.length(lit),
          "the post covers sheet x -2/sqrt(2) to 6/sqrt(2); the lit band starts at its left side"
        ).toBeGreaterThanOrEqual(2);
        expect(
          Math.max(...A.map(lit, lengthOf)),
          "the post hides the whole ridge, so the faces share no shown edge and the lit band keeps full-length lines"
        ).toBeGreaterThan(0.6 * 60 * (2 / Math.sqrt(6)));
      })
    );

    it.effect(
      "compares two faces' ink over the area each covers on the sheet, however foreshortened",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const eye = [0.3, -1, 0.4] as const;
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: box([0, 0, 0], [30, 60, 40]),
            cameras: [Camera.make({ eye: [...eye], up: [0, 0, 1] })],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        const frontRight = 30 / Math.hypot(1, 0.3);
        const strokes = A.filter(view?.shading ?? [], isVertical);
        const lit = A.filter(strokes, (s) => s[0] < frontRight);
        expect(
          A.length(A.filter(strokes, (s) => s[0] > frontRight)),
          "the sheet's x runs along (1, 0.3, 0): the front face spans sheet x 0 to 30/sqrt(1.09), the right face beyond"
        ).toBeGreaterThanOrEqual(2);
        const chord = 40 * Math.sqrt(1 - (eye[2] * eye[2]) / (eye[0] * eye[0] + eye[1] * eye[1] + eye[2] * eye[2]));
        expect(
          pipe(
            lit,
            A.map(lengthOf),
            A.filter((length) => length > 0.6 * chord),
            A.map((length) => Math.round(length * 100) / 100)
          ),
          "compared over sheet areas the edge-on dark face out-inks the lit one, so the lit band keeps two full-length lines"
        ).toEqual(A.makeBy(2, () => Math.round((chord - 2) * 100) / 100));
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.shadedFaces, c.lostFaces, c.lostStretches] as const)
          ),
          [3, 0, 0] as const
        );
      })
    );

    it.effect(
      "starts a band behind a gutter where a wall's two lines run beside its edge just beyond it",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, 0, 0], max: [20, 10, 20] })] });
        const plate = Part.make({ name: "plate", add: [Box.make({ min: [21.3, 0, 0], max: [22.1, 10, 20] })] });
        const shadeFront = Effect.fnUntraced(function* (parts: ReadonlyArray<Part>, ladderReach?: number) {
          const [view] = yield* occt.project(
            ProjectionRequest.make({
              solid: ModelSpec.make({ parts: [...parts] }),
              cameras: [front],
              shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3, ladderReach })),
            })
          );
          return {
            view,
            wall: pipe(
              view?.shading ?? [],
              A.filter((s) => isVertical(s) && s[0] < 20),
              A.sort(Order.mapInput(Order.flip(Order.Number), (s: Segment) => s[0]))
            ),
          };
        });
        const firstTwo = (strokes: ReadonlyArray<Segment>) =>
          A.map(A.take(strokes, 2), (s) => Math.round(s[0] * 1e6) / 1e6);
        const ladder = yield* shadeFront([wall, plate]);
        expect(
          firstTwo(ladder.wall),
          "the plate's near line lies within the ladder reach beside the whole edge: a gutter of 1.5 first gaps, 2.1 in"
        ).toEqual([17.9, 16.5]);
        expect(
          O.map(A.head(ladder.wall), (s) => Math.round(lengthOf(s) * 1e6) / 1e6),
          "the first line keeps its full length"
        ).toEqual(O.some(18));
        assertSome(
          O.flatMap(O.fromNullishOr(ladder.view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
          ),
          [0, 0] as const
        );
        expect(
          firstTwo((yield* shadeFront([wall])).wall),
          "control: without the plate the band starts one pitch in"
        ).toEqual([19, 17.6]);
        expect(
          ladderFindings((yield* shadeFront([wall, plate], 0.01)).view),
          "a ladder reach too short to see the plate plans no gutter, and the validator flags the ladder on the sheet"
        ).toEqual(["shading-band-ladder"]);
        expect(ladderFindings(ladder.view), "the band behind its gutter passes").toEqual([]);
      })
    );

    it.effect(
      "keeps a narrow wall's band where a gutter would leave room for a single line",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [16, 0, 0], max: [20, 10, 20] })] });
        const plate = Part.make({ name: "plate", add: [Box.make({ min: [21.3, 0, 0], max: [22.1, 10, 20] })] });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall, plate] }),
            cameras: [front],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        const strokes = pipe(
          view?.shading ?? [],
          A.filter((s) => isVertical(s) && s[0] < 20),
          A.map((s) => Math.round(s[0] * 1e6) / 1e6),
          A.sort(Order.flip(Order.Number))
        );
        expect(
          strokes,
          "behind a gutter the 4-wide band would keep one narrow line; a gutter never empties a band, so it stays one pitch in"
        ).toEqual([19, 17.6]);
        const wallShadedPlateFaceSliver = [1, 0, 0] as const;
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.shadedFaces, c.lostFaces, c.lostStretches] as const)
          ),
          wallShadedPlateFaceSliver
        );
      })
    );

    it.effect(
      "reads the lines beyond a band's edge beside the stroke the sheet draws",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, 0, 0], max: [20, 10, 20] })] });
        const plate = Part.make({ name: "plate", add: [Box.make({ min: [21.3, 0, 5.05], max: [22.1, 10, 14.95] })] });
        const shadeFront = Effect.fnUntraced(function* (ladderReach?: number) {
          const [view] = yield* occt.project(
            ProjectionRequest.make({
              solid: ModelSpec.make({ parts: [wall, plate] }),
              cameras: [front],
              shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3, ladderReach })),
            })
          );
          return view;
        });
        const firstTwo = (view: EdgeSet | undefined) =>
          pipe(
            view?.shading ?? [],
            A.filter((s) => isVertical(s) && s[0] < 20),
            A.map((s) => Math.round(s[0] * 1e6) / 1e6),
            A.sort(Order.flip(Order.Number)),
            A.take(2)
          );
        const guttered = yield* shadeFront();
        expect(
          firstTwo(guttered),
          "the 9.9 plate runs beside under half the planned 20 but over half the drawn 18; the kernel reads the drawn stroke"
        ).toEqual([17.9, 16.5]);
        expect(ladderFindings(guttered), "so the render passes its own check").toEqual([]);
        const plain = yield* shadeFront(0.01);
        expect(firstTwo(plain)).toEqual([19, 17.6]);
        expect(
          ladderFindings(plain),
          "the validator reads the shortened plate as a ladder when the reach is too short for a gutter"
        ).toEqual(["shading-band-ladder"]);
      })
    );

    it.effect(
      "reads emphasis lines beyond a band's edge as the sheet draws them",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, 0, 0], max: [20, 10, 20] })] });
        const line = (x: number) =>
          OverlayLine.make({
            name: `line-${x}`,
            style: "emphasis",
            points: [
              [x, 0, 0],
              [x, 0, 20],
            ],
            facing: O.some([0, -1, 0]),
          });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall], overlays: [line(21.3), line(22.1)] }),
            cameras: [front],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        expect(A.length(view?.emphasis ?? [])).toBe(2);
        const strokes = pipe(
          view?.shading ?? [],
          A.filter((s) => isVertical(s) && s[0] < 20),
          A.map((s) => Math.round(s[0] * 1e6) / 1e6),
          A.sort(Order.flip(Order.Number)),
          A.take(2)
        );
        expect(
          strokes,
          "the sheet draws emphasis lines like outlines, so the kernel reads them beside the band and starts a gutter"
        ).toEqual([17.9, 16.5]);
        expect(ladderFindings(view)).toEqual([]);
      })
    );

    it.effect(
      "keeps a band one pitch in where its edge only steps out around a tab",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const tabbed = Part.make({
          name: "wall",
          add: [Box.make({ min: [-20, 0, 0], max: [20, 10, 20] }), Box.make({ min: [20, 0, 8], max: [21.3, 10, 12] })],
        });
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [tabbed] }),
            cameras: [front],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        expect(
          A.some(view?.visible ?? [], (s) => isVertical(s) && Math.abs(s[0] - 21.3) < 1e-6),
          "the tab's end is drawn, 1.3 beyond the band's edge and within the ladder reach"
        ).toBe(true);
        const wall = pipe(
          view?.shading ?? [],
          A.filter((s) => isVertical(s) && s[0] < 20),
          A.sort(Order.mapInput(Order.flip(Order.Number), (s: Segment) => s[0]))
        );
        expect(
          A.map(A.take(wall, 2), (s) => Math.round(s[0] * 1e6) / 1e6),
          "the tab's end fills the gap in the edge instead of running beside it, so no ladder reads"
        ).toEqual([19, 17.6]);
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
          ),
          [0, 0] as const
        );
      })
    );

    it.effect(
      "drops a 2 mm band below the minimum face span",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const plate = box([-20, -15, 0], [20, 15, 2]);
        const camera = Camera.make({ eye: [0, -1, 1], up: [0, 0, 1] });
        const shadeWith = (minFaceSpan: number) =>
          occt
            .project(
              ProjectionRequest.make({ solid: plate, cameras: [camera], shading: O.some(graded({ minFaceSpan })) })
            )
            .pipe(Effect.map((views) => views[0]));
        const all = yield* shadeWith(0);
        const banded = yield* shadeWith(2);
        assertSome(
          O.flatMap(O.fromNullishOr(all), (v) =>
            O.map(v.shadingCoverage, (c) => [c.shadedFaces, A.map(c.skippedFaces, (s) => [s.reason, s.faces])])
          ),
          [
            1,
            [
              ["back-facing", 4],
              ["sliver", 1],
            ],
          ]
        );
        assertSome(
          O.flatMap(O.fromNullishOr(banded), (v) =>
            O.map(v.shadingCoverage, (c) => [c.shadedFaces, A.map(c.skippedFaces, (s) => [s.reason, s.faces])])
          ),
          [
            1,
            [
              ["back-facing", 4],
              ["sliver", 1],
            ],
          ]
        );
        expect(
          banded?.shading.length,
          "the 2-thick front edge, about 1.4 wide on the view plane, has no room for two legible strokes: a bare sliver, never a shaded face"
        ).toBeLessThanOrEqual(all?.shading.length ?? 0);
      })
    );
  });
});

describe("projected band ink order", () => {
  it("steps a rescued lit band to two tapered ranks, then leaves it bare only when it still out-inks its neighbour", () => {
    const runs = [
      { run: Segment2.make([0, 0, 0, 10]), extent: 1, rank: 0 },
      { run: Segment2.make([1, 0, 1, 10]), extent: 1, rank: 1 },
      { run: Segment2.make([2, 0, 2, 10]), extent: 1, rank: 2 },
    ];
    const lit = {
      index: 0,
      sliver: false,
      segments: A.map(runs, (run) => run.run),
      relaxed: O.some(runs),
      redrawn: true,
      inkOrder: false,
      fits: true,
    };
    const dark = (length: number) => ({
      ...lit,
      index: 1,
      segments: [Segment2.make([5, 0, 5, length])],
      relaxed: O.none(),
      redrawn: false,
    });
    const faces = [
      { exposure: 0.5, seen: 100 },
      { exposure: -0.4, seen: 100 },
    ];
    const plan = graded();
    const floored = settleRedrawnInk({ stretches: [lit, dark(15)], faces, neighbours: [[0, 1]], plan });
    expect(floored[0]?.segments).toEqual([
      [0, 2, 0, 8],
      [1, 3, 1, 7],
    ]);
    expect(floored[0]?.inkOrder).toBe(false);
    expect(floored[1]?.segments).toEqual([[5, 0, 5, 15]]);
    const bare = settleRedrawnInk({ stretches: [lit, dark(5)], faces, neighbours: [[0, 1]], plan });
    expect(bare[0]?.segments).toEqual([]);
    expect(bare[0]?.inkOrder).toBe(true);
    expect(bare[1]?.segments).toEqual([[5, 0, 5, 5]]);
    const ordinary = { ...lit, relaxed: O.none() };
    const retained = settleRedrawnInk({ stretches: [ordinary, dark(5)], faces, neighbours: [[0, 1]], plan });
    expect(retained[0]).toBe(ordinary);
    expect(retapered({ runs: [{ run: Segment2.make([0, 0, 0, 0]), extent: 0.6, rank: 0 }], minStroke: 0 })).toEqual([
      [0, 0, 0, 0],
    ]);
  });
});
