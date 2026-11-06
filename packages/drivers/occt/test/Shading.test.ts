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

// A box with a wedge on top, a through hole, and a separate post in front:
// planar, curved, foreshortened, and partly hidden faces in one model.
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

// sha256 of the projected segments the shading generator produced before the
// style, axis and sliver options existed, for lit thresholds -0.2, 0.55, 0.75 and 1.
const LEGACY_SHA256 = "af9b81c85515c2035920293ef17bfc478f7a5464c41b62e07ca7dbff2455c668";

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

// The stroke pass's inputs for a shape in the front view under the graded plan, with no measured rooms, claims,
// neighbours or lines beyond a band; the caller gives the probe regions.
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

// The validator's ladder check on a view drawn at 1.5 mm a model unit, reading every line the sheet draws.
const ladderFindings = (view: EdgeSet | undefined) => {
  const mm = (segments: ReadonlyArray<Segment>) =>
    A.map(segments, ([x1, y1, x2, y2]): Segment => [x1 * 1.5, y1 * 1.5, x2 * 1.5, y2 * 1.5]);
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
        // a polyline of one repeated point has no leg to draw, so it is never built; the line next to it still prints
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
        expect(view?.emphasis).toEqual([[-5, 5, 5, 5]]);
      })
    );

    it.effect(
      "pairs a lit face with its darker neighbour across a ridge a notch splits into two edges",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // The ridge block of the lit-taper test below, with a notch 2 tall and half a unit deep cut out of its ridge at
        // z = 28: the lit and the dark face now share two collinear edges, below and above the notch, and what the view
        // shows of the two is summed for the pair. The notch stays inside the bands' first pitch, so both faces are
        // banded exactly as on the whole ridge, the lit band still cut back to the lit taper (review loop 3, O-02).
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
        expect(strokes).toEqual(whole?.shading);
        const lit = A.filter(strokes, (s) => s[0] < 0);
        expect(A.length(lit)).toBeGreaterThanOrEqual(2);
        // every lit stroke is a short one: at most 0.6 of the 60-tall chord, which the sheet shows at 2/sqrt(6)
        expect(Math.max(...A.map(lit, lengthOf))).toBeLessThanOrEqual(0.6 * 60 * (2 / Math.sqrt(6)) + 1e-6);
      })
    );

    it.effect(
      "plans a face given lines that no probe row saw as hidden, with no strokes",
      Effect.fnUntraced(function* () {
        yield* Occt;
        const shape = replicad.makeBox([-10, -10, 0], [10, 10, 20]);
        try {
          // the probe pass found no visible area on any face: the front face, the only one turned toward the eye, is
          // hidden rather than banded over its whole extent
          const hatched = hatchCompound({ ...frontHatch(shape), regions: O.some(() => []) });
          expect(
            A.map(hatched.faces, (face) =>
              face.treatment.kind === "skipped" ? face.treatment.reason : face.treatment.kind
            )
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
        // Positions along the front face's lines read along -z, its top at -20. Rows 0 and 1 saw the face from z = 20
        // down to 11, rows 3 and 4 from z = 9 down to 0, and row 2 saw none of it: every line of the band is drawn once
        // in the cells of each run of rows, and none crosses the gap between them.
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
            ])
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
      "reproduces the original hatch byte for byte under the default style, axis and span",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const run = (plan: (litThreshold: number) => ShadingPlan) =>
          Effect.forEach([-0.2, 0.55, 0.75, 1], (litThreshold) =>
            occt
              .project(
                ProjectionRequest.make({
                  solid: legacyFixture,
                  cameras: legacyCameras,
                  shading: O.some(plan(litThreshold)),
                })
              )
              .pipe(Effect.map(A.map((v: EdgeSet) => [v.visible, v.hidden, v.shading])))
          ).pipe(
            Effect.flatMap((views) =>
              sha256Of(Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(views), identity))
            )
          );
        const result = yield* run((litThreshold) => ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold }));
        expect(result).toBe(LEGACY_SHA256);
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
      // Eight full projections of the legacy fixture (four lit thresholds under two plans). About 1.7 s on a
      // workstation before and after the outline-separation change, but 33.7 s on a hosted unit shard, past
      // vitest's 30 s default, so this one test gets its own limit.
      120_000
    );

    it.effect(
      "records coverage: shaded faces and skips by reason",
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
                  shading: O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: 0.55 })),
                })
              )
            ),
            Effect.map(([a, b]) => [a[0], b[0]] as const)
          );
        expect(O.isNone(plain?.shadingCoverage ?? O.none())).toBe(true);
        // square-on front faces stay blank under the uniform default; the hole wall is curved
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
        expect(A.length(strokes)).toBeGreaterThan(0);
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
          // each stroke in exactly one band, each band's strokes ascending, and only shaded faces carry bands
          expect(A.sort(places, Order.Number)).toEqual(A.map(view.shading, (_, at) => at));
          A.forEach(view.shadingBands, (band) => expect(band.strokes).toEqual(A.sort(band.strokes, Order.Number)));
          const faces = A.dedupe(A.map(view.shadingBands, (band) => band.face));
          expect(O.exists(view.shadingCoverage, (coverage) => A.length(faces) <= coverage.shadedFaces)).toBe(true);
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
        // the wall is 20 high: the full chords clear 8 after their end insets; nothing clears 25, so the
        // chord-aware offsets find no position and the face is a sliver
        expect(drawn?.shading.length).toBeGreaterThan(1);
        expect(dropped?.shading).toEqual([]);
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
        // a wall whose front face carries a coplanar bump 2 wide and 8 tall on its right (shadow) side:
        // a minor appendage, like a locking tab proud of a flap's edge. The probes through the bump see
        // the face reach x = 22, but the band must still start one pitch inside the wall's edge at x = 20.
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
        // no stroke inside the bump, and the first one a minimum pitch inside the face's edge
        expect(Math.max(...xs)).toBeLessThan(20);
        expect(Math.max(...xs)).toBeCloseTo(19, 1);
      })
    );

    it.effect(
      "bands every separately bounded visible area of a face seen through a lattice, without leaking into its neighbours",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // a 120 x 60 plate seen from above with thin walls standing on it (their tops are slivers and
        // draw nothing of their own): across the right half at y = 0, across the left half at y = 10,
        // and up the middle from y = 0 to the plate's top edge. The plate's top shows as three areas:
        // the lower one (y < 0 on the right, y < 10 on the left, in one piece below the middle wall),
        // the upper-right one and the upper-left one.
        // Under the upper-left light the plate's right and bottom edges are equally dark and the tie
        // goes to the edge least aligned with the sheet's vertical, the bottom one: lines run
        // horizontally and the step runs up the sheet. The lower area starts at the plate's own edge
        // and gets one band there; each upper area starts behind its own wall and gets a band hugging
        // that wall, drawn only in the rows that saw it; and no band runs on into another area.
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
        // strokes on the plate, not on the walls' own top faces
        const onPlate = A.filter(view?.shading ?? [], ([x1, y1, x2, y2]) => {
          const x = (x1 + x2) / 2;
          const y = (y1 + y2) / 2;
          return !(
            (y > -0.5 && y < 0.5 && x > 0) ||
            (y > 9.5 && y < 10.5 && x < 0) ||
            (x > -0.5 && x < 0.5 && y > -0.5)
          );
        });
        expect(A.isReadonlyArrayNonEmpty(onPlate) && A.every(onPlate, isHorizontal)).toBe(true);
        // strokes (horizontal) that run through a box of the plate
        const through = (x0: number, x1: number, y0: number, y1: number) =>
          A.length(
            A.filter(onPlate, ([xa, y, xb]) => y > y0 && y < y1 && Math.max(xa, xb) > x0 && Math.min(xa, xb) < x1)
          );
        // the lower area: one band at the plate's bottom edge, running through both halves
        expect(through(2, 60, -30, -20)).toBeGreaterThanOrEqual(2);
        expect(through(-60, -2, -30, -20)).toBeGreaterThanOrEqual(2);
        // the upper area: a band above the right wall on the right, and above the left wall on the left
        expect(through(2, 60, 2, 13)).toBeGreaterThanOrEqual(2);
        expect(through(-60, -2, 12, 23)).toBeGreaterThanOrEqual(2);
        // nothing leaks: the right wall's band does not run on into the left half (the lower area's
        // lit side there), the left wall's band does not run on into the right half, and the lower
        // area's lit side stays bare. A band is drawn in the cells of the probes that saw its area,
        // so it may run on past the middle wall by up to half a cell (120 / 18 here) and no further.
        expect(through(-60, -9, 2, 8)).toBe(0);
        expect(through(9, 60, 14, 30)).toBe(0);
        expect(through(-60, 60, -18, -3)).toBe(0);
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
        // an 80 x 40 wall (front face y = 0) with a 4-thick fin standing on its front face, seen from the
        // front-left above. Every probe across the wall's front face starts or runs inside the fin, which
        // abuts the face; drawn as one long chord the hidden-line pass misread where the fin hides the
        // wall, so the band of the area left of the fin was planned behind the fin and drew nothing
        // (review loop 2, K-01). Probes go through the pass in short pieces.
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
        // the fin covers the sheet from (x - y)/sqrt(2) = -2/sqrt(2) rightward; strokes left of it lie on the wall
        const finLeft = -2 / Math.SQRT2;
        const sheetX = ([x1, , x2]: Segment) => (x1 + x2) / 2;
        const onWallLeft = A.filter(strokes, (s) => isVertical(s) && Math.abs(sheetX(s) - finLeft) > 0.5);
        expect(A.length(onWallLeft)).toBeGreaterThanOrEqual(2);
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
        // a 120 x 120 plate seen from above with a hexagonal ring wall standing on it (inner radius 28,
        // outer 30, vertices on the x axis). The plate shows as the area outside the ring and the cell
        // inside it. Probe rows a pitch apart see the cell's pieces and the outside pieces overlap in
        // range across the slanting walls; only the link test keeps the cell its own area, banded at its
        // own nearest side, instead of folding it into the outside band at the plate's edge.
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
        // the cell (inside the inner wall, apothem 24.2) carries its own band
        expect(A.length(A.filter(strokes, (s) => radiusOf(s) < 24))).toBeGreaterThanOrEqual(2);
        // the outside area keeps its band at the plate's edge
        expect(A.length(A.filter(strokes, (s) => radiusOf(s) > 40))).toBeGreaterThanOrEqual(2);
        // no stroke runs across the ring: none has one end inside the cell and the other outside the ring
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
          )
        ).toBe(false);
        // the ring's own 2 mm top face shows only short chords: a sliver, bare by design and never counted lost.
        // Its rules give it lines, but its every stretch lacks room for two legible strokes, so the coverage counts
        // it a sliver: only the plate's top is a shaded face (review loop 3, J-01)
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
          [1, 1, 0, 0] as const
        );
      })
    );

    it.effect(
      "keeps a cell's band that two probe rows saw inside the rows' own cells, never across a crossing strip",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // A 120 x 60 plate seen from above (lines horizontal, step up the sheet, as in the lattice above) with walls 1
        // thick standing on it around a cell: along y = -10 from x = 8 to 18, up x = 18 to y = 12, back along y = 12
        // to x = -5, and a slanting strip from there down to (8, -10). The plate's nine probe rows stand 13.3 apart
        // along the lines, so only the rows at x = 0 and 13.3 cross the cell: a glimpse, whose room the kernel
        // measures. Low in the cell, where its band goes, only the row at 13.3 sees it, and the row at 0 sees the
        // plate beyond the strip. The rows' cells already give the cell a band, each stroke clipped to the cell of the
        // row that saw it there. Drawn over the whole range of both rows instead, the band ran on across the strip
        // into the plate beyond, where the row at 0 kept it (review loop 4, R4-08): the measured room only rescues an
        // area its rows' cells leave without a band.
        const wall = (name: string, [ax, ay]: readonly [number, number], [bx, by]: readonly [number, number]) => {
          // half a thickness along the wall and across it; each end runs half a thickness past its point
          const length = Math.hypot(bx - ax, by - ay);
          const ux = (bx - ax) / length / 2;
          const uy = (by - ay) / length / 2;
          return Part.make({
            name,
            add: [
              Prism.make({
                profile: [
                  [ax - ux - uy, ay - uy + ux, 2],
                  [ax - ux + uy, ay - uy - ux, 2],
                  [bx + ux + uy, by + uy - ux, 2],
                  [bx + ux - uy, by + uy + ux, 2],
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
        // the strip's centre line, as x at a height y on the sheet
        const stripX = (y: number) => 8 - ((y + 10) * 13) / 22;
        // the plate's strokes between the cell's bottom and top walls
        const level = A.filter(view?.shading ?? [], (s) => isHorizontal(s) && s[1] > -9.5 && s[1] < 11.5);
        // the cell keeps its band, every stroke inside the cell, and nothing runs on beyond the strip
        expect(A.length(level)).toBeGreaterThanOrEqual(2);
        expect(A.filter(level, ([x1, y, x2]) => Math.min(x1, x2) <= stripX(y) || Math.max(x1, x2) >= 17.5)).toEqual([]);
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
        // A wall 12 wide and 90 tall (front face x = 0, outward normal -x) seen from below on the left, behind
        // a block that hides all of it but a strip about 8 tall at its foot. Of the nine probe rows (cells 10
        // tall), only the lowest sees the strip, so each stroke of the band is clipped to that one cell. Lit
        // (faint), the band tapered to 0.6 and 0.4 of the cell, which left its second stroke under the legible
        // length (minimum stroke plus a pitch at each end, 3.5 here): the kernel called the stretch a sliver and
        // the wall drew nothing (review loop 3, J-01). The taper may shorten a band but never empty it, so the
        // band is drawn as whole clipped chords and hidden-line removal cuts them to the strip. Drawn whole, the
        // two strokes came out alike, the Guide's untapered look; each is now cut back to its taper, centred on
        // what shows (review loop 4, K-08).
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
            // the exposure of the wall's front face, whose outward normal is -x
            tone: toneOf(-viewFactsOf(camera).light[0]),
            // the wall's front face spans |x| < 6 on the sheet; the block's strokes lie far outside it
            strokes: A.filter(view?.shading ?? [], (s) => isVertical(s) && Math.abs(s[0]) < 6),
            lost: O.flatMap(O.fromNullishOr(view), (v) =>
              O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
            ),
          };
        });
        const lit = yield* shadeWall([-root, 0, -1 / Math.sqrt(3)], -6);
        expect(lit.tone).toBe("faint");
        expect(A.length(lit.strokes)).toBeGreaterThanOrEqual(2);
        // the band keeps its taper: its stroke nearest the shadow edge (sheet x = 6) is the longer
        const [first = 0, second = 0] = pipe(
          lit.strokes,
          A.sort(Order.mapInput(Order.Number, (s: Segment) => -s[0])),
          A.map(lengthOf)
        );
        expect(first).toBeGreaterThan(second);
        assertSome(lit.lost, [0, 0] as const);
        // control: turned from the light (medium), the same one-row strip keeps full-length strokes and always drew
        const dim = yield* shadeWall([-root / 2, (root * Math.sqrt(3)) / 2, -1 / Math.sqrt(3)], -20.3);
        expect(dim.tone).toBe("medium");
        expect(A.length(dim.strokes)).toBeGreaterThanOrEqual(2);
        assertSome(dim.lost, [0, 0] as const);
      })
    );

    it.effect(
      "re-plans a lit band past a one-row tip of its area before drawing it untapered",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // The wall and view above, behind a wedge whose bottom rises across the wall: the visible area is about
        // 8 tall at the wall's shadow edge (sheet x = 6) and about 22 at its far edge (sheet x = -6). Only the
        // lowest probe row sees the area's first 6 along the step; the next row joins there. Planned at the shadow
        // edge, the lit band has no room once tapered. Rather than drawing it untapered in that one-row tip, the
        // band is re-planned from the start of the next row, where its tapered strokes have room (review loop 3,
        // J-01).
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
        // the wall's strokes, nearest its shadow edge first
        const strokes = pipe(
          view?.shading ?? [],
          A.filter((s) => isVertical(s) && Math.abs(s[0]) < 6),
          A.sort(Order.mapInput(Order.Number, (s: Segment) => -s[0]))
        );
        expect(A.length(strokes)).toBeGreaterThanOrEqual(2);
        // every stroke lies past the tip only the lowest row sees (within 5 of the shadow edge, a pitch's slack
        // before the next row starts at 6)
        expect(A.every(strokes, (s) => s[0] < 1)).toBe(true);
        // and the band keeps its taper: the stroke nearest the shadow edge is the longer
        const [first = 0, second = 0] = A.map(strokes, lengthOf);
        expect(first).toBeGreaterThan(second);
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
        // A wall 30 wide, 20 tall and 1.5 thick seen along +x: its face x = 0 is parallel to the picture plane of a
        // two-point view at azimuth 90 and square-on to the left elevation. The two-point views lit it as their tilted
        // sight leaned, light from above and faint from below, so the bottom view drew a shorter, fainter band (review
        // loop 4, O-03). Lit on the picture plane, it takes the square-on exposure 1/√3 and the same band in all
        // three views. The wall is thin so its top and bottom faces are too narrow to band: a banded neighbour would
        // hold the wall's ink below its own, which differs from view to view.
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
        // the face's strokes, each as its place across the face and its length against the face's height, both read
        // between the face's two vertical edges (the only vertical outlines the views draw)
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
        // the light recipe: two whole strokes at the shadow edge (sheet right), then a taper toward the light
        expect(A.length(above)).toBe(4);
        const [first = 0, second = 0, third = 0, fourth = 0] = A.map(A.reverse(above), ([, extent]) => extent);
        expect(first).toBe(second);
        expect(third).toBeLessThan(second);
        expect(fourth).toBeLessThan(third);
        expect(below).toEqual(above);
        expect(elevation).toEqual(above);
      })
    );

    it.effect(
      "redraws a tapered band a slot shows only at a wall's foot on its whole chords in a two-point bottom view",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // A plate 2 thick with a slot 22.5 deep across it, and a wall 20 wide and 90 tall standing on the plate along
        // the slot's far edge (front face y = -10, outward normal -y), seen from below in a two-point pictorial turned
        // 35° off the wall. Through the slot the wall shows only a strip at its foot; the plate hides it above that,
        // and the wall shows again above the plate's front edge. Only the lowest probe rows see the strip. Lit
        // (faint), the strip's band is tapered to 0.6 and 0.4 of their cells and centred on them: both strokes had
        // room as planned, but the plate hid each above the strip and the legibility pass dropped what showed, so the
        // stretch drew nothing and counted lost. The band is drawn again on its whole clipped chords, which
        // hidden-line removal cuts to the strip. The view is turned because a two-point view lights a wall parallel
        // to its picture plane at 1/√3 from below as from above (review loop 4, O-03), so only a wall turned toward
        // the light is faint; looking straight along +y the wall now takes the light recipe, whose two whole strokes
        // need no redraw. Turned 45°, the tapered strokes the strip's own rows centre show as planned and need no
        // redraw either: the room measured across the strip no longer re-plans a band its rows already give (review
        // loop 4, R4-08).
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
        // the wall's front face, the only face the view hatches vertically, is lit
        expect(toneOf(-viewFactsOf(camera).light[1])).toBe("faint");
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [plate, wall] }),
            cameras: [camera],
            shading: O.some(graded({ minStroke: 1.5 })),
          })
        );
        const strokes = A.filter(view?.shading ?? [], isVertical);
        // the strip's band is shorter than one probe cell; the band above the plate runs over several
        const strip = A.filter(strokes, (s) => lengthOf(s) < 10);
        const above = A.filter(strokes, (s) => lengthOf(s) >= 10);
        expect(A.length(strip)).toBeGreaterThanOrEqual(2);
        expect(A.length(above)).toBeGreaterThanOrEqual(2);
        const heights = (segments: ReadonlyArray<Segment>) => A.flatMap(segments, ([, y1, , y2]) => [y1, y2]);
        expect(Math.max(...heights(strip))).toBeLessThan(Math.min(...heights(above)));
        // the strip's band is the one the third pass drew again
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches, c.redrawnStretches] as const)
          ),
          [0, 0, 1] as const
        );
      })
    );

    it.effect(
      "bands both halves of a far point glimpsed at its foot below a crossing wall in a two-point bottom view",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // A wall 1 thick and 60 wide (front face x = 0) with a chevron standing behind it: two plates meeting in a
        // point at x = 21 to 23, their inner faces 30° off the sight line. Seen from below in a two-point pictorial
        // looking along +x, the wall hides the chevron but for a bay at its foot on each side of the point: the
        // triangle between the wall's bottom edge (sheet y = 111.636), the inner face's bottom edge, and the point's
        // inner corner (sheet x = 0), 11.955 wide and 7 tall at the corner. Of the nine probe rows (cells 11.7 tall)
        // only the lowest crossed each bay, where the bay is a fifth of its base wide, so both were planned `narrow`
        // and dropped uncounted (review loop 4, A-01). A probe row a pitch inside each end of a face's reach measures
        // a bay near its base. The dark half's band then sits at the corner. The faint half's band anchors at its
        // acute tip, where the bay shows nothing: its room is measured column by column and the band moves inward to
        // where a stroke fits (review loop 4, G-01).
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
        // the two inner faces, turned toward the point's corner, are lit dark and faint by the picture-plane light
        const light = viewFactsOf(camera).light;
        expect(
          pipe(
            [
              [-0.5, -Math.sqrt(3) / 2],
              [-0.5, Math.sqrt(3) / 2],
            ],
            A.map(([nx = 0, ny = 0]) => toneOf(nx * light[0] + ny * light[1])),
            A.sort(Order.String)
          )
        ).toEqual(["dark", "faint"]);
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [front, chevron] }),
            cameras: [camera],
            shading: O.some(graded({ minStroke: 1.5 })),
          })
        );
        // the strokes in the bays, between the wall's bottom edge and the lowest point of the chevron's corner
        const bays = A.filter(
          view?.shading ?? [],
          (s) =>
            isVertical(s) && Math.abs(s[0]) < 13 && Math.min(s[1], s[3]) >= 103.944 && Math.max(s[1], s[3]) <= 111.636
        );
        // a stroke's ends stand at least the plan's clearance (half a pitch) off the drawn outline
        const outlines = view?.visible ?? [];
        const clearOf = ([x1, y1, x2, y2]: Segment) =>
          Math.min(
            nearestOutlineDistance({ x: x1, y: y1, outlines }),
            nearestOutlineDistance({ x: x2, y: y2, outlines })
          );
        const banded = (strokes: ReadonlyArray<Segment>) =>
          A.length(strokes) >= 2 && A.every(strokes, (s) => lengthOf(s) >= 1.5 - 1e-6 && clearOf(s) >= 0.5);
        expect(banded(A.filter(bays, (s) => s[0] < 0))).toBe(true);
        const faint = A.filter(bays, (s) => s[0] > 0);
        expect(banded(faint)).toBe(true);
        // the faint band moved off its acute tip, into the half of the bay beside the corner, and neither band reads
        // with the outlines beside it as one ladder
        expect(A.every(faint, (s) => s[0] <= 11.955 / 2)).toBe(true);
        expect(ladderFindings(view)).toEqual([]);
        const coverage = O.flatMap(O.fromNullishOr(view), (v) => v.shadingCoverage);
        assertSome(
          O.map(coverage, (c) => [c.lostFaces, c.lostStretches] as const),
          [0, 0] as const
        );
        // no visible stretch was skipped while its measured room fits a band, and the validator agrees
        assertSome(
          O.map(coverage, (c) => A.filter(c.skippedStretches, (skip) => skip.fitting > 0)),
          []
        );
        assertSome(
          O.map(coverage, (c) => shadingCoverageFindings({ page: 1, coverage: c })),
          []
        );
      })
    );

    it.effect(
      "counts every visible stretch skipped by design, with whether its measured room fits a band",
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
        // A wall 40 wide in the front elevation behind a slab that leaves only its last 2 at the shadow edge (x = 18
        // to 20) showing: room for one line, a planned `narrow` skip. It was dropped before anything counted it
        // (review loop 4, A-01); the coverage now counts it, without room for a band, so the validator stays quiet.
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
        // the 2-unit front edge of a plate seen from above in front planned lines whose chords leave no room for two
        // legible strokes: it stays bare, now counted, and raises no finding
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
        // A prism seen square from -x: its lit face L (sheet x -20 to -12.48) and its dark face D (sheet x -12.48 to
        // 4.42) share the visible edge between them. A block in front hides all but a strip 6 tall at their foot,
        // inside the lowest probe row's cell (cells 10 tall). L's band, settled to the lit taper against D, is centred
        // on that cell and hidden-line removal leaves it nothing, so the kernel draws it again on its whole chords.
        // Drawn whole, its two strokes ran the strip alike and L carried 1.8 times D's ink over it, against the
        // settled order (review loop 4, K-08). Each redrawn run is cut back to its stroke's taper, and the ink order is
        // read again on what is drawn.
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
          // each face's drawn ink: its strokes' length over its width on the sheet
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
        // the lit face carries no more ink for its strip than the dark face beside it
        expect(glimpsed.litInk).toBeLessThanOrEqual(glimpsed.darkInk);
        // and its band keeps its taper: the stroke nearest its shadow edge (the shared edge) is the longer
        const [first = 0, second = 0] = A.map(glimpsed.lit, lengthOf);
        expect(A.length(glimpsed.lit)).toBe(2);
        expect(first).toBeGreaterThan(second);
        assertSome(glimpsed.coverage, [0, 0, 1] as const);
        // control: without the block both faces show whole, nothing is redrawn, and both hold as they always did
        const whole = yield* shade([prism]);
        expect(whole.litInk).toBeLessThanOrEqual(whole.darkInk);
        const [wholeFirst = 0, wholeSecond = 0] = A.map(whole.lit, lengthOf);
        expect(wholeFirst).toBeGreaterThan(wholeSecond);
        assertSome(whole.coverage, [0, 0, 0] as const);
      })
    );

    it.effect(
      "shades every visible stretch of a wall at the side nearest its shadow edge",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // a wall whose shadow edge (its right end, x = 20) is behind a slab standing in front of x >= 8
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, -15, 0], max: [20, 15, 20] })] });
        const slab = Part.make({ name: "slab", add: [Box.make({ min: [8, -40, -5], max: [26, -25, 25] })] });
        // a post in front of the wall's middle splits its visible area in two
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
        // behind the slab the wall's band hugs the slab's edge: its first line one pitch left of x = 8
        // (the slab's own strokes sit past x = 20)
        const strokeXs2 = yield* strokeXs(ModelSpec.make({ parts: [wall, slab] }));
        const slabbed = A.filter(strokeXs2, (x) => x <= 20);
        expect(A.isReadonlyArrayNonEmpty(slabbed) && A.every(slabbed, (x) => x < 8)).toBe(true);
        expect(Math.max(...slabbed)).toBeCloseTo(7, 1);
        // the post splits the wall: the right stretch keeps its band, the left one gets a band next to the post
        const posted = yield* strokeXs(ModelSpec.make({ parts: [wall, post] }));
        expect(A.some(posted, (x) => x > 7)).toBe(true);
        expect(Math.max(...A.filter(posted, (x) => x < -2))).toBeCloseTo(-3, 1);
        // every face that planned lines drew some: nothing was lost to hidden-line removal
        const views = yield* occt.project(
          ProjectionRequest.make({
            solid: ModelSpec.make({ parts: [wall, post] }),
            cameras: [front],
            shading: O.some(graded({ minStroke: 0.5 })),
          })
        );
        assertSome(
          O.flatMap(O.fromNullishOr(views[0]), (v) => O.map(v.shadingCoverage, (c) => c.lostFaces)),
          0
        );
      })
    );

    it.effect(
      "keeps graded stroke ends the plan's clearance from the outlines",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, -15, 0], max: [20, 15, 20] })] });
        // lowest and highest end of the wall's vertical strokes in the front view (y is z there)
        const ends = (clearance?: number) =>
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
        // a bare plan draws the strokes back one pitch from the outlines they ended on
        // (0 and 20) and clears half a pitch, which that already satisfies
        const [low, high] = yield* ends();
        expect(low).toBeGreaterThanOrEqual(0.9);
        expect(low).toBeLessThanOrEqual(1.1);
        expect(high).toBeGreaterThanOrEqual(18.9);
        expect(high).toBeLessThanOrEqual(19.1);
        // a plan that carries a clearance keeps the ends at least that far away
        const [lowCleared, highCleared] = yield* ends(3);
        expect(lowCleared).toBeGreaterThanOrEqual(3);
        expect(highCleared).toBeLessThanOrEqual(17);
      })
    );

    it.effect(
      "maps graded probes through a perspective camera the way the hidden-line pass projects",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const wall = Part.make({ name: "wall", add: [Box.make({ min: [-20, -15, 0], max: [20, 15, 20] })] });
        const post = Part.make({ name: "post", add: [Box.make({ min: [-2, -40, -5], max: [2, -25, 25] })] });
        // stroke count, shaded faces and lost faces of a view
        const summary = (view: EdgeSet) => [
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
        // a perspective camera draws the same strokes on the same faces as its orthographic
        // twin, from the front (both probe ends at one depth) and from an oblique eye (the far
        // end foreshortened): the window of each partly hidden probe is walked back through
        // the camera's own projection, not read as a fraction of the projected line
        expect(summary(views[1]!)).toEqual(summary(views[0]!));
        expect(summary(views[3]!)).toEqual(summary(views[2]!));
        // from the pictorial eye the post's 4 mm faces have room for a single stroke each and are
        // skipped as narrow by design (a lone line beside an outline reads as a doubled edge), so
        // they count neither as shaded nor as lost; the wall's strokes are drawn only in the probe
        // rows that saw each area, which leaves the band one stroke short of the whole-chord count
        expect(summary(views[2]!)).toEqual([12, 4, 0]);
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
            shading: O.some(ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: 0.55 })),
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
        // the 1.84(m) light comes from the upper left, so the shadow edge is the right one (x = 20)
        const columns = pipe(
          shading,
          A.map(([x]) => x),
          A.dedupe,
          A.sort(Order.flip(Order.Number))
        );
        const gaps = A.zipWith([20, ...columns], columns, (a, b) => Math.round((a - b) * 1e3) / 1e3);
        expect(gaps[0]).toBe(1);
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
        // a wide, low wall: its longest edge is horizontal, so the default axis hatches it horizontally
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
        expect(A.every(longest?.shading ?? [], isHorizontal)).toBe(true);
      })
    );

    it.effect(
      "gives equally inclined faces mirrored about the light azimuth equal bands",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // a gable roof whose ridge runs along (-1, 1, 0): in the top plan the
        // 1.84(m) light lies in the ridge's vertical plane, so both slopes see it alike
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
        // the projected ridge is the line x + y = 0
        const side = ([x1, y1, x2, y2]: Segment) => (x1 + x2 + y1 + y2) / 2;
        const lower = A.filter(shading, (s) => side(s) < 0);
        const upper = A.filter(shading, (s) => side(s) > 0);
        expect(A.length(lower)).toBeGreaterThan(0);
        expect(A.length(lower)).toBe(A.length(upper));
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
        // A block 30 by 30 whose top falls from 60 at x = 0 to 20 at x = 30, seen in the standard isometric (the top
        // turns away). Its left face (x = 0, lit at about 0.51) and its front face (y = 0, dark at about -0.31) meet
        // at the ridge x = y = 0, sheet x = 0. Both bands sit at the sheet-right of their faces: the lit face's on
        // the 60-tall ridge, the dark face's on its 20-tall outer edge. Planned face by face, the lit band out-inked
        // the dark one (0.12 against 0.08 of each face's area); a face turned toward the light must never carry
        // more ink than a darker face it shares a visible edge with, so the lit band takes the lit taper (review
        // loop 3, O-02).
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
        // a model height shows on the sheet at 2/sqrt(6) of its length; each face's model width at sqrt(2) times
        // its sheet x, and its visible area at 1/sqrt(3) of its model area
        const upright = 2 / Math.sqrt(6);
        const chordOfDark = (sheetX: number) => (60 - (40 * sheetX * Math.SQRT2) / 30) * upright;
        // every lit stroke is a short one: at most 0.6 of the 60-tall chord
        expect(A.length(lit)).toBeGreaterThanOrEqual(2);
        expect(Math.max(...A.map(lit, lengthOf))).toBeLessThanOrEqual(0.6 * 60 * upright + 1e-6);
        // the dark band keeps its full-length lines: its stroke nearest its shadow edge runs past 0.6 of its chord
        const nearest = pipe(dark, A.sort(Order.mapInput(Order.flip(Order.Number), (s: Segment) => s[0])), A.head);
        expect(O.exists(nearest, (s) => lengthOf(s) > 0.6 * chordOfDark(s[0]))).toBe(true);
        // and the lit face now carries less ink for its area than the dark face
        const densityOf = (face: ReadonlyArray<Segment>, modelArea: number) =>
          sumOf(A.map(face, lengthOf)) / (modelArea / Math.sqrt(3));
        expect(densityOf(lit, 30 * 60)).toBeLessThan(densityOf(dark, (30 * (60 + 20)) / 2));
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
        // A block 40 by 30 and 20 tall with a vertical chamfer at its front right corner, in the front elevation:
        // the front wall (square-on, light at 1/sqrt(3)) shares its right edge, x = 15, with the darker chamfer
        // (medium). The wall's band sits on that edge. The chamfer is narrow, so its own two-line band is far
        // denser than the wall's, and the wall keeps its two full-length lines at the shadow edge.
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
        // the wall's strokes, nearest its shadow edge (x = 15) first
        const wall = pipe(
          strokes,
          A.filter((s) => isVertical(s) && s[0] < 15),
          A.sort(Order.mapInput(Order.flip(Order.Number), (s: Segment) => s[0]))
        );
        // both full lines run the wall's height less an inset of a pitch at each end
        expect(A.map(A.take(wall, 2), (s) => Math.round(lengthOf(s) * 1e3) / 1e3)).toEqual([18, 18]);
        expect(A.length(wall)).toBeGreaterThanOrEqual(3);
        // the chamfer keeps its own band
        expect(A.length(A.filter(strokes, (s) => s[0] > 15))).toBeGreaterThanOrEqual(2);
      })
    );

    it.effect(
      "compares the ink of two faces only across an edge the view shows",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // The ridge block of the test above with a post standing in front of its ridge, taller than the block: the post
        // hides the whole ridge, and none of the post's own edges is drawn along the ridge's line. Less of the lit face
        // shows and its band is the same, so it still carries more ink for its area than the dark face, but the two
        // faces no longer share an edge the view shows: their bands are not compared, and the lit band keeps its
        // full-length lines (review loop 3, O-02).
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
        // the post covers the sheet from x = -2/sqrt(2) to 6/sqrt(2); the lit face's band starts at its left side
        const lit = A.filter(view?.shading ?? [], (s) => isVertical(s) && s[0] < -Math.SQRT2);
        expect(A.length(lit)).toBeGreaterThanOrEqual(2);
        // a full-length line runs past 0.6 of the 60-tall chord (60 x 2/sqrt(6) on the sheet)
        expect(Math.max(...A.map(lit, lengthOf))).toBeGreaterThan(0.6 * 60 * (2 / Math.sqrt(6)));
      })
    );

    it.effect(
      "compares two faces' ink over the area each covers on the sheet, however foreshortened",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // A box 30 wide (x), 60 deep (y) and 40 tall seen from the front right, above: its front face (y = 0) is lit
        // and turned almost square to the viewer, its right face (x = 30) dark and seen nearly edge-on. Over the area
        // each face covers on the sheet, the dark face carries more ink than the lit one, so the lit band keeps its
        // full-length lines. Over the faces' own areas, the dark face's foreshortening would hide most of its ink and
        // the lit band would wrongly be cut back (review loop 3, O-02).
        const eye = [0.3, -1, 0.4] as const;
        const [view] = yield* occt.project(
          ProjectionRequest.make({
            solid: box([0, 0, 0], [30, 60, 40]),
            cameras: [Camera.make({ eye: [...eye], up: [0, 0, 1] })],
            shading: O.some(graded({ minStroke: 1.5, minFaceSpan: 3 })),
          })
        );
        // the sheet's x runs along (1, 0.3, 0): the front face spans sheet x 0 to 30/sqrt(1.09), the right face beyond
        const frontRight = 30 / Math.hypot(1, 0.3);
        const strokes = A.filter(view?.shading ?? [], isVertical);
        const lit = A.filter(strokes, (s) => s[0] < frontRight);
        expect(A.length(A.filter(strokes, (s) => s[0] > frontRight))).toBeGreaterThanOrEqual(2);
        // the lit face's 40 height shows on the sheet foreshortened by the view's tilt; its two full-length lines run
        // that chord less a pitch at each end
        const chord = 40 * Math.sqrt(1 - (eye[2] * eye[2]) / (eye[0] * eye[0] + eye[1] * eye[1] + eye[2] * eye[2]));
        expect(
          pipe(
            lit,
            A.map(lengthOf),
            A.filter((length) => length > 0.6 * chord),
            A.map((length) => Math.round(length * 100) / 100)
          )
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
        // A wall 40 wide and 20 tall in the front elevation, its band on its right edge (x = 20), and a plate 0.8 thick
        // standing 1.3 past that edge: the plate draws two lines beside the edge, 1.3 and 2.1 beyond it. A band
        // starting one pitch in (x = 19, then 17.6) would read with the edge and the plate's lines as one evenly
        // spaced ladder. The nearer line lies within the ladder reach (five thirds of a pitch on a bare plan) and runs
        // beside the whole edge, so the band starts behind a gutter of 1.5 times its own first gap, 1.4 pitches: its
        // first line 2.1 in, then 1.4 to the next (review loop 3, O-04).
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
            // the wall's strokes, nearest its shadow edge first
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
        expect(firstTwo(ladder.wall)).toEqual([17.9, 16.5]);
        // the first line keeps its full length, and nothing planned is lost
        expect(O.map(A.head(ladder.wall), (s) => Math.round(lengthOf(s) * 1e6) / 1e6)).toEqual(O.some(18));
        assertSome(
          O.flatMap(O.fromNullishOr(ladder.view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.lostFaces, c.lostStretches] as const)
          ),
          [0, 0] as const
        );
        // control: without the plate the band starts one pitch in, as always
        expect(firstTwo((yield* shadeFront([wall])).wall)).toEqual([19, 17.6]);
        // the validator reads the ladder on the sheet. At 1.5 mm a pitch, the band planned without the gutter (a ladder
        // reach too short to see the plate) is flagged, and the band behind its gutter passes.
        expect(ladderFindings((yield* shadeFront([wall, plate], 0.01)).view)).toEqual(["shading-band-ladder"]);
        expect(ladderFindings(ladder.view)).toEqual([]);
      })
    );

    it.effect(
      "keeps a narrow wall's band where a gutter would leave room for a single line",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // A wall only 4 wide (x = 16 to 20) beside the plate of the test above, 1.3 past the wall's right edge. Behind
        // the gutter (2.1 in) the band's second line would sit 3.5 in, past the room a 4-wide band has (its last line
        // a pitch inside the far edge, 3 in): one line, which the rules skip as `narrow`, so the wall drew nothing and
        // no loss was counted. A gutter may move a band but never empty it, so the band keeps its two lines one pitch
        // in (review loop 3, O-04).
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
        expect(strokes).toEqual([19, 17.6]);
        // the wall counts as shaded (the plate's 0.8 face is a sliver), and nothing planned is lost
        assertSome(
          O.flatMap(O.fromNullishOr(view), (v) =>
            O.map(v.shadingCoverage, (c) => [c.shadedFaces, c.lostFaces, c.lostStretches] as const)
          ),
          [1, 0, 0] as const
        );
      })
    );

    it.effect(
      "reads the lines beyond a band's edge beside the stroke the sheet draws",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // The wall of the gutter test with the plate cut to 9.9 tall at the middle of the wall's height (z = 5.05 to
        // 14.95). The band's first line is planned 20 long and drawn 18, a pitch shorter at each end, and the plate's
        // near line runs beside it for 9.9: under half the planned stroke, over half the drawn one. Read beside the
        // planned stroke, the kernel saw no ladder and left the band one pitch in, while the validator, reading the
        // drawn stroke, flagged the render. The kernel reads beside the drawn stroke too, so the band starts behind
        // its gutter and the render passes its own check (review loop 3, O-04).
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
        expect(firstTwo(guttered)).toEqual([17.9, 16.5]);
        expect(ladderFindings(guttered)).toEqual([]);
        // the validator does read the shortened plate as a ladder: the band without its gutter (a ladder reach too
        // short to see the plate) is flagged
        const plain = yield* shadeFront(0.01);
        expect(firstTwo(plain)).toEqual([19, 17.6]);
        expect(ladderFindings(plain)).toEqual(["shading-band-ladder"]);
      })
    );

    it.effect(
      "reads emphasis lines beyond a band's edge as the sheet draws them",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // The wall of the gutter test alone, with two emphasis lines standing 1.3 and 2.1 past its right edge where the
        // plate's lines stood. The sheet draws them like outlines, and the validator reads them so; the kernel reads
        // them beside the band's first line too, so the band starts behind its gutter (review loop 3, O-04).
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
        expect(strokes).toEqual([17.9, 16.5]);
        expect(ladderFindings(view)).toEqual([]);
      })
    );

    it.effect(
      "keeps a band one pitch in where its edge only steps out around a tab",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        // The same wall with a tab 4 tall sticking 1.3 out of its right edge, in the front elevation. The tab's end
        // is a line 1.3 beyond the band's edge, within the ladder reach, and runs beside the band's planned first
        // stroke for 4 of its 20: measured against the stroke alone, it passes for a line beyond the edge. But it
        // fills the gap in the edge instead of running beside it (the edge is drawn only below and above the tab), so
        // band and outline do not read as a ladder and the band keeps its first line one pitch in (review loop 3,
        // O-04).
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
        // the tab's end is drawn
        expect(A.some(view?.visible ?? [], (s) => isVertical(s) && Math.abs(s[0] - 21.3) < 1e-6)).toBe(true);
        const wall = pipe(
          view?.shading ?? [],
          A.filter((s) => isVertical(s) && s[0] < 20),
          A.sort(Order.mapInput(Order.flip(Order.Number), (s: Segment) => s[0]))
        );
        expect(A.map(A.take(wall, 2), (s) => Math.round(s[0] * 1e6) / 1e6)).toEqual([19, 17.6]);
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
        // a 40 × 30 × 2 plate seen from above and in front: the front edge band is 2 thick,
        // about 1.4 wide on the view plane, so a minimum span of 2 makes it a sliver
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
        // without a minimum span the rules band the edge face, but its 2-unit chords leave no room for two legible
        // strokes past the end insets: the kernel leaves it bare and counts it a sliver, never a shaded face that
        // draws nothing (review loop 3, J-01)
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
        expect(banded?.shading.length).toBeLessThanOrEqual(all?.shading.length ?? 0);
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
