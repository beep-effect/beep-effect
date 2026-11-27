import {
  BoundingBox,
  Box,
  Camera,
  Cylinder,
  EdgeSet,
  ModelSpec,
  Occt,
  Part,
  ProjectionRequest,
  ShadingPlan,
} from "@beep/occt";
import { cameraForView, ShadingSkip } from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A, O } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

type Segment = readonly [number, number, number, number];

const TestLayer = Occt.layer.pipe(Layer.provide(NodeServices.layer));

const plate = Box.make({ min: [0, 0, 0], max: [40, 20, 2] });
const tab = Box.make({ min: [17, -8, 0], max: [23, 0, 2], lineStyle: O.some("broken") });
const flap = ModelSpec.make({ parts: [Part.make({ name: "flap", add: [plate, tab] })] });
const solidFlap = ModelSpec.make({
  parts: [Part.make({ name: "flap", add: [plate, Box.make({ min: [17, -8, 0], max: [23, 0, 2] })] })],
});

const top = Camera.make({ eye: [0, 0, 1], up: [0, 1, 0] });
const front = Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] });
const back = Camera.make({ eye: [0, 1, 0], up: [0, 0, 1] });
const persp = Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [20, 10, 1], focus: O.some(200) });

const axo = Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [20, 10, 1] });
const axoPersp = Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [20, 10, 1], focus: O.some(200) });
const twoPoint = cameraForView({
  view: "top-perspective",
  box: BoundingBox.make({ min: [0, 0, 0], max: [40, 20, 6] }),
  projection: "two-point",
  azimuthDeg: O.some(30),
});
const below = Camera.make({ eye: [0.3, -0.5, -1], up: [0, 0, 1] });

const one = (name: string, add: ReadonlyArray<Box | Cylinder>) =>
  ModelSpec.make({ parts: [Part.make({ name, add: [...add] })] });

const graded = ShadingPlan.make({
  minPitch: 1,
  maxPitch: 3,
  litThreshold: 0.55,
  style: "graded",
  axis: "surface-class",
});

const uniform = ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: 0.55 });

const noView = EdgeSet.make({ visible: [], hidden: [] });

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const sameSegment = (s: Segment, t: Segment) =>
  near(s[0], t[0]) && near(s[1], t[1]) && near(s[2], t[2]) && near(s[3], t[3]);
const totalLength = (segments: ReadonlyArray<Segment>) =>
  A.reduce(segments, 0, (sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1));

const overlapsCollinear = (line: Segment) => (segment: Segment) => {
  const [x1, y1, x2, y2] = line;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const off = (x: number, y: number) => Math.abs((x - x1) * uy - (y - y1) * ux);
  const along = (x: number, y: number) => (x - x1) * ux + (y - y1) * uy;
  const [a, b, c, d] = segment;
  if (off(a, b) > 1e-3 || off(c, d) > 1e-3) {
    return false;
  }
  const low = Math.max(Math.min(along(a, b), along(c, d)), 0);
  const high = Math.min(Math.max(along(a, b), along(c, d)), length);
  return high - low > 1e-3;
};

const orthoViewPlaneOntoZ0 = (cameraAtOrigin: Camera) => {
  const unit = ([x, y, z]: readonly [number, number, number]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length] as const;
  };
  const cross = (a: readonly [number, number, number], b: readonly [number, number, number]) =>
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as const;
  const direction = unit(cameraAtOrigin.eye);
  const right = unit(cross(unit(cameraAtOrigin.up), direction));
  const up = cross(direction, right);
  return (x: number, y: number): readonly [number, number] => {
    const p = A.map([0, 1, 2], (i) => x * (right[i] ?? 0) + y * (up[i] ?? 0));
    const t = -(p[2] ?? 0) / direction[2];
    return [(p[0] ?? 0) + t * direction[0], (p[1] ?? 0) + t * direction[1]];
  };
};

const project = Effect.fnUntraced(function* (solid: ModelSpec, cameras: ReadonlyArray<Camera>, withHidden = false) {
  const occt = yield* Occt;
  return yield* occt.project(ProjectionRequest.make({ solid, cameras: [...cameras], withHidden }));
});

describe("@beep/occt primitive line style", () => {
  it.layer(TestLayer, { timeout: "120 seconds" })((it) => {
    it.effect(
      "draws a fused tab's own faces in broken lines with no line across its root (plan view)",
      Effect.fnUntraced(function* () {
        const [plan = noView] = yield* project(flap, [top]);
        expect(
          A.filter([...plan.visible, ...plan.broken], overlapsCollinear([17, 0, 23, 0])),
          "plate and tab are one part, so the fuse leaves no seam: nothing runs along the plate edge between the tab's sides"
        ).toEqual([]);
        const sides: ReadonlyArray<Segment> = [
          [17, -8, 17, 0],
          [17, -8, 23, -8],
          [23, -8, 23, 0],
        ];
        expect(plan.broken, "only the tab primitive is unclaimed: its three outer sides are broken").toEqual(sides);
        expect(
          A.filter(plan.visible, (segment) => A.some(sides, (side) => overlapsCollinear(side)(segment))),
          "no broken tab side is also drawn solid"
        ).toEqual([]);
        expect(
          plan.visible,
          "plan view (screen x, y = model x, y): the plate's long edge either side of the tab and its outline stay solid"
        ).toEqual([
          [0, 0, 0, 20],
          [0, 0, 17, 0],
          [0, 20, 40, 20],
          [23, 0, 40, 0],
          [40, 0, 40, 20],
        ]);
      })
    );

    it.effect(
      "keeps a hole's wall solid: a face inside a solid primitive's volume is claimed",
      Effect.fnUntraced(function* () {
        const hole = Cylinder.make({ base: [10, 10, -1], axis: [0, 0, 1], radius: 3, height: 4 });
        const holed = (add: ReadonlyArray<Box>) =>
          ModelSpec.make({ parts: [Part.make({ name: "flap", add: [...add], subtract: [hole] })] });
        const [plan = noView] = yield* project(holed([plate, tab]), [top]);
        const [withoutTab = noView] = yield* project(holed([plate]), [top]);
        expect(plan.broken).toEqual([
          [17, -8, 17, 0],
          [17, -8, 23, -8],
          [23, -8, 23, 0],
        ]);
        const wall = A.filter(withoutTab.visible, ([x1, y1]) => Math.hypot(x1 - 10, y1 - 10) < 3.5);
        expect(wall.length).toBeGreaterThan(8);
        expect(
          A.every(wall, (chord) => A.some(plan.visible, (segment) => sameSegment(segment, chord))),
          "the hole's wall lies inside the plate primitive it was cut from, so its samples are inside a solid primitive"
        ).toBe(true);
      })
    );

    it.effect(
      "shades the plate face under a graded plan and skips the tab's own faces as broken-part",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const [plan = noView] = yield* occt.project(
          ProjectionRequest.make({ solid: flap, cameras: [top], shading: O.some(graded) })
        );
        const [solidPlan = noView] = yield* occt.project(
          ProjectionRequest.make({ solid: solidFlap, cameras: [top], shading: O.some(graded) })
        );
        expect(
          plan.shading.length,
          "the merged plate-and-tab top face is solid and shaded; the tab's end and sides skip as broken-part before any rule reads them (edge-on here; the solid tab's count as back-facing)"
        ).toBeGreaterThan(1);
        expect(
          A.filter(plan.shading, ([, y1, , y2]) => Math.min(y1, y2) < 0),
          "no stroke runs onto the tab, which lies below screen y 0, past the plate's long edge"
        ).toEqual([]);
        assertSome(
          O.map(plan.shadingCoverage, (coverage) => [coverage.shadedFaces, coverage.skippedFaces] as const),
          [
            1,
            [
              ShadingSkip.make({ reason: "back-facing", faces: 6 }),
              ShadingSkip.make({ reason: "broken-part", faces: 3 }),
            ],
          ]
        );
        assertSome(
          O.map(solidPlan.shadingCoverage, (coverage) => [coverage.shadedFaces, coverage.skippedFaces] as const),
          [1, [ShadingSkip.make({ reason: "back-facing", faces: 9 })]]
        );
      })
    );

    it.effect(
      "draws the tab's end face in broken lines where a front view shows it",
      Effect.fnUntraced(function* () {
        const [elevation = noView] = yield* project(flap, [front]);
        expect(
          elevation.broken,
          "front view (screen x, y = model x, z): the tab's end face is the 6 × 2 rectangle at x 17..23"
        ).toEqual([
          [17, 0, 17, 2],
          [17, 0, 23, 0],
          [17, 2, 23, 2],
          [23, 0, 23, 2],
        ]);
        expect(elevation.visible, "the plate's front face either side of the tab stays solid").toEqual([
          [0, 0, 0, 2],
          [0, 0, 17, 0],
          [0, 2, 17, 2],
          [23, 0, 40, 0],
          [23, 2, 40, 2],
          [40, 0, 40, 2],
        ]);
      })
    );

    it.effect(
      "never draws a tab edge the part's own outline hides, even where it falls on a solid edge",
      Effect.fnUntraced(function* () {
        const [rear = noView, oblique = noView] = yield* project(flap, [back, persp], true);
        const [solidRear = noView, solidOblique = noView] = yield* project(solidFlap, [back, persp], true);
        expect(rear.broken, "from behind, the tab hides behind the plate").toEqual([]);
        expect(
          rear.visible,
          "the plate's back top edge stays solid where the hidden tab's end face top edge falls on it"
        ).toEqual(solidRear.visible);
        expect(A.filter(solidRear.hidden, overlapsCollinear([-23, 0, -17, 0]))).not.toEqual([]);
        expect(
          A.filter(rear.hidden, overlapsCollinear([-23, 0, -17, 0])),
          "the tab's hidden edges are dropped, as a broken part's are (from behind, screen x is -model x)"
        ).toEqual([]);
        expect(A.filter(rear.hidden, overlapsCollinear([-40, 0, -23, 0])), "the plate's hidden edges stay").not.toEqual(
          []
        );
        expect(totalLength(oblique.broken)).toBeGreaterThan(0);
        expect(
          totalLength(oblique.visible) + totalLength(oblique.broken),
          "obliquely, the broken layer is exactly what left the solid outline, piece by piece"
        ).toBeCloseTo(totalLength(solidOblique.visible), 3);
        expect(
          A.every(oblique.broken, (piece) =>
            A.some(solidOblique.visible, (segment) => overlapsCollinear(segment)(piece))
          )
        ).toBe(true);
        expect(
          A.filter(oblique.visible, (segment) => A.some(oblique.broken, (piece) => overlapsCollinear(segment)(piece)))
        ).toEqual([]);
        const hiddenRootAtX23: Segment = [8.911, -3.717, 8.954, -1.929];
        expect(
          A.some(solidOblique.hidden, (segment) => sameSegment(segment, hiddenRootAtX23)),
          "in perspective from upper front left, the tab hides its root edge at x = 23; the one at x = 17 shows"
        ).toBe(true);
        expect(
          A.some([...oblique.broken, ...oblique.hidden], (segment) => sameSegment(segment, hiddenRootAtX23)),
          "the hidden root edge is neither drawn broken nor drawn hidden"
        ).toBe(false);
      })
    );

    it.effect(
      "draws a part whose primitives are all solid exactly as the same part without primitive styles",
      Effect.fnUntraced(function* () {
        const explicit = ModelSpec.make({
          parts: [
            Part.make({
              name: "flap",
              add: [plate, Box.make({ min: [17, -8, 0], max: [23, 0, 2], lineStyle: O.some("solid") })],
            }),
          ],
        });
        const views = yield* project(explicit, [top, front, persp], true);
        const expectation = expect(views);
        const project1 = yield* project(solidFlap, [top, front, persp], true);
        expectation.toEqual(project1);
        expect(A.map(views, (view) => view.broken)).toEqual([[], [], []]);
      })
    );

    it.effect(
      "keeps a claimed rail solid when its merged face is mostly an unclaimed tab",
      Effect.fnUntraced(function* () {
        const rail = one("rail", [
          Box.make({ min: [0, 0, 0], max: [40, 2, 2] }),
          Box.make({ min: [17, -30, 0], max: [23, 0, 2], lineStyle: O.some("broken") }),
        ]);
        const [plan = noView] = yield* project(rail, [top]);
        expect(plan.visible, "a 2 deep rail with a 30 deep tab: the merged top face is under a tenth claimed").toEqual([
          [0, 0, 0, 2],
          [0, 0, 17, 0],
          [0, 2, 40, 2],
          [23, 0, 40, 0],
          [40, 0, 40, 2],
        ]);
        expect(plan.broken).toEqual([
          [17, -30, 17, 0],
          [17, -30, 23, -30],
          [23, -30, 23, 0],
        ]);
      })
    );

    it.effect(
      "draws a tab side flush with the plate's end broken up to the tab root",
      Effect.fnUntraced(function* () {
        const flush = one("flush", [
          plate,
          Box.make({ min: [34, -8, 0], max: [40, 0, 2], lineStyle: O.some("broken") }),
        ]);
        const [plan = noView] = yield* project(flush, [top]);
        expect(
          plan.broken,
          "the tab's side at x = 40 is one edge with the plate's end: unclaimed below y = 0, claimed above"
        ).toEqual([
          [34, -8, 34, 0],
          [34, -8, 40, -8],
          [40, -8, 40, 0],
        ]);
        expect(plan.visible).toEqual([
          [0, 0, 0, 20],
          [0, 0, 34, 0],
          [0, 20, 40, 20],
          [40, 0, 40, 20],
        ]);
      })
    );

    it.effect(
      "draws a broken cylinder boss in broken lines in oblique views, curves and silhouettes included",
      Effect.fnUntraced(function* () {
        const peg = (lineStyle: O.Option<"solid" | "broken">) =>
          Cylinder.make({ base: [10, 10, 2], axis: [0, 0, 1], radius: 3, height: 4, lineStyle });
        expect(
          twoPoint.hiddenLinePassAbout,
          "the two-point view's level sight line has its target far above the model; silhouettes trace back about it"
        ).toBe("target");
        const cameras = [axo, axoPersp, twoPoint];
        const boss = yield* project(one("boss", [plate, peg(O.some("broken"))]), cameras, true);
        const bossOutline = yield* project(one("boss", [plate, peg(O.some("broken"))]), cameras);
        expect(
          A.map(bossOutline, (view) => [view.visible, view.broken]),
          "without hidden lines the outline and the broken layer are the same"
        ).toEqual(A.map(boss, (view) => [view.visible, view.broken]));
        const solidBoss = yield* project(one("boss", [plate, peg(O.none())]), cameras, true);
        const plateOnly = yield* project(one("plate", [plate]), cameras, true);
        A.forEach(A.zip(A.zip(boss, solidBoss), plateOnly), ([[view, solidView], plateView]) => {
          const plateLines = [...plateView.visible, ...plateView.hidden];
          const onPlate = (segment: Segment) => A.some(plateLines, (line) => overlapsCollinear(line)(segment));
          expect(
            A.filter(solidView.visible, (segment) => !onPlate(segment)).length,
            "the claimed boss adds its circles and silhouettes to the outline"
          ).toBeGreaterThan(24);
          expect(
            A.filter(view.visible, (segment) => !onPlate(segment)),
            "the unclaimed boss adds none of them"
          ).toEqual([]);
          expect(
            view.broken.length,
            "they are drawn broken instead: top circle, front of the foot circle, two silhouettes"
          ).toBeGreaterThan(24);
          expect(totalLength(view.visible) + totalLength(view.broken)).toBeCloseTo(totalLength(solidView.visible), 3);
          expect(
            A.filter(view.hidden, (segment) => !onPlate(segment)),
            "the boss's hidden lines go, as a broken part's do"
          ).toEqual([]);
          expect(
            A.filter(solidView.hidden, (segment) => !onPlate(segment)).length,
            "the plate's hidden lines stay"
          ).toBeGreaterThan(0);
        });
      })
    );

    it.effect(
      "keeps a claimed edge solid, or hidden, where an unclaimed edge projects onto it at another depth",
      Effect.fnUntraced(function* () {
        const stack = one("stack", [
          plate,
          Box.make({ min: [10, 5, 2], max: [20, 15, 6], lineStyle: O.some("broken") }),
        ]);
        const [elevation = noView] = yield* project(stack, [front], true);
        expect(
          elevation.visible,
          "the broken box stacked on the plate has its foot edges on the plate's top edges in a front view"
        ).toEqual([
          [0, 0, 0, 2],
          [0, 0, 40, 0],
          [0, 2, 40, 2],
          [40, 0, 40, 2],
        ]);
        expect(elevation.broken).toEqual([
          [10, 2, 10, 6],
          [10, 6, 20, 6],
          [20, 2, 20, 6],
        ]);
        expect(
          A.some(elevation.hidden, (segment) => sameSegment(segment, [0, 2, 40, 2])),
          "the plate's back top edge, behind the box's hidden foot, is hidden over its whole length"
        ).toBe(true);
      })
    );

    it.effect(
      "never shades the unclaimed part of a merged face",
      Effect.fnUntraced(function* () {
        const occt = yield* Occt;
        const shade = (solid: ModelSpec) =>
          occt.project(ProjectionRequest.make({ solid, cameras: [below], shading: O.some(uniform) }));
        const [view = noView] = yield* shade(flap);
        const [solidView = noView] = yield* shade(solidFlap);
        const ground = orthoViewPlaneOntoZ0(below);
        const onTab = ([x1, y1, x2, y2]: Segment) =>
          A.every([ground(x1, y1), ground(x2, y2)], ([x, y]) => x > 16.99 && x < 23.01 && y > -8.01 && y < -0.01);
        expect(
          A.filter(solidView.shading, onTab).length,
          "from below, the bottom face merged with the tab's faces the eye and is shaded"
        ).toBeGreaterThan(0);
        expect(
          A.filter(view.shading, onTab),
          "a bottom-face stroke read back onto z = 0 within the tab's footprint is unclaimed"
        ).toEqual([]);
        expect(
          A.filter(view.shading, (stroke) => !onTab(stroke)),
          "the bottom face's strokes over the plate stay exactly as on the all-solid flap"
        ).toEqual(A.filter(solidView.shading, (stroke) => !onTab(stroke)));
        assertSome(
          O.map(view.shadingCoverage, (coverage) =>
            A.filter(coverage.skippedFaces, (skip) => skip.reason === "broken-part")
          ),
          [ShadingSkip.make({ reason: "broken-part", faces: 3 })]
        );
      })
    );
  });
});
