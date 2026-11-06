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

// A 40 × 20 × 2 plate with a coplanar 6 × 8 × 2 tab sticking out of its long edge at y = 0, both in ONE part so the
// fuse leaves no seam across the tab root; only the tab primitive is unclaimed.
const plate = Box.make({ min: [0, 0, 0], max: [40, 20, 2] });
const tab = Box.make({ min: [17, -8, 0], max: [23, 0, 2], lineStyle: O.some("broken") });
const flap = ModelSpec.make({ parts: [Part.make({ name: "flap", add: [plate, tab] })] });
const solidFlap = ModelSpec.make({
  parts: [Part.make({ name: "flap", add: [plate, Box.make({ min: [17, -8, 0], max: [23, 0, 2] })] })],
});

// Plan view: screen x is model x, screen y is model y. Front view: screen x is model x, screen y is model z.
const top = Camera.make({ eye: [0, 0, 1], up: [0, 1, 0] });
const front = Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] });
// from behind: the tab hides behind the plate, its end face's top edge on the plate's own top edge
const back = Camera.make({ eye: [0, 1, 0], up: [0, 0, 1] });
// upper front left, in perspective: the tab's root edge at x = 23 is hidden behind the tab, the one at x = 17 shows
const persp = Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [20, 10, 1], focus: O.some(200) });

// upper front left, orthographic and in perspective, over the plate's middle
const axo = Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [20, 10, 1] });
const axoPersp = Camera.make({ eye: [-1, -1.2, 0.85], up: [0, 0, 1], target: [20, 10, 1], focus: O.some(200) });
// upper front left in a two-point pictorial of the plate and a boss 4 tall on it: a level line of sight from a target
// raised far above the model, which the hidden-line pass runs about instead of the model's origin
const twoPoint = cameraForView({
  view: "top-perspective",
  box: BoundingBox.make({ min: [0, 0, 0], max: [40, 20, 6] }),
  projection: "two-point",
  azimuthDeg: O.some(30),
});
// from below, front and right: the plate's bottom face (merged with the tab's) faces the eye
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

// Whether a drawn segment lies on the line through `line` and shares more than a point with it.
const overlaps = (line: Segment) => (segment: Segment) => {
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

// Where an orthographic camera's view-plane point (target at the origin) meets the model plane z = 0.
const ontoGround = (camera: Camera) => {
  const unit = ([x, y, z]: readonly [number, number, number]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length] as const;
  };
  const cross = (a: readonly [number, number, number], b: readonly [number, number, number]) =>
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as const;
  const direction = unit(camera.eye);
  const right = unit(cross(unit(camera.up), direction));
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
        // (a) nothing, solid or broken, runs along the plate edge between the tab's two sides
        expect(A.filter([...plan.visible, ...plan.broken], overlaps([17, 0, 23, 0]))).toEqual([]);
        // (b) the tab's three outer sides are broken, and none of them is also drawn solid
        const sides: ReadonlyArray<Segment> = [
          [17, -8, 17, 0],
          [17, -8, 23, -8],
          [23, -8, 23, 0],
        ];
        expect(plan.broken).toEqual(sides);
        expect(A.filter(plan.visible, (segment) => A.some(sides, (side) => overlaps(side)(segment)))).toEqual([]);
        // (c) the plate's long edge either side of the tab, and the rest of its outline, stay solid
        expect(plan.visible).toEqual([
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
        // the hole's wall lies inside the plate primitive (cut away from it), so every sample on it is inside a
        // solid primitive, not outside every one
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
        expect(A.every(wall, (chord) => A.some(plan.visible, (segment) => sameSegment(segment, chord)))).toBe(true);
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
        // (d) the merged plate-and-tab top face is solid and shaded; the tab's end and sides are skipped as
        // unclaimed before any rule reads them (edge-on here, the solid tab's count as back-facing)
        expect(plan.shading.length).toBeGreaterThan(1);
        // no stroke runs out onto the tab (screen y below 0 is the tab, past the plate's long edge)
        expect(A.filter(plan.shading, ([, y1, , y2]) => Math.min(y1, y2) < 0)).toEqual([]);
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
        // the end face is the 6 × 2 rectangle at x 17..23; the plate's front face either side stays solid
        expect(elevation.broken).toEqual([
          [17, 0, 17, 2],
          [17, 0, 23, 0],
          [17, 2, 23, 2],
          [23, 0, 23, 2],
        ]);
        expect(elevation.visible).toEqual([
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
        // from behind, the plate's back top edge stays solid where the hidden tab's end edge falls on it
        expect(rear.broken).toEqual([]);
        expect(rear.visible).toEqual(solidRear.visible);
        // the tab's hidden edges are dropped, as a broken part's are; the plate's stay (screen x is -model x)
        expect(A.filter(solidRear.hidden, overlaps([-23, 0, -17, 0]))).not.toEqual([]);
        expect(A.filter(rear.hidden, overlaps([-23, 0, -17, 0]))).toEqual([]);
        expect(A.filter(rear.hidden, overlaps([-40, 0, -23, 0]))).not.toEqual([]);
        // obliquely, the broken layer is exactly what left the solid outline, piece by piece
        expect(totalLength(oblique.broken)).toBeGreaterThan(0);
        expect(totalLength(oblique.visible) + totalLength(oblique.broken)).toBeCloseTo(
          totalLength(solidOblique.visible),
          3
        );
        expect(
          A.every(oblique.broken, (piece) => A.some(solidOblique.visible, (segment) => overlaps(segment)(piece)))
        ).toBe(true);
        expect(
          A.filter(oblique.visible, (segment) => A.some(oblique.broken, (piece) => overlaps(segment)(piece)))
        ).toEqual([]);
        // the root edge at x = 23 is hidden behind the tab: neither drawn broken nor drawn hidden
        const hiddenRoot: Segment = [8.911, -3.717, 8.954, -1.929];
        expect(A.some(solidOblique.hidden, (segment) => sameSegment(segment, hiddenRoot))).toBe(true);
        expect(A.some([...oblique.broken, ...oblique.hidden], (segment) => sameSegment(segment, hiddenRoot))).toBe(
          false
        );
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
        // the rail is 2 deep, the tab 30: the merged top face is less than a tenth claimed
        const rail = one("rail", [
          Box.make({ min: [0, 0, 0], max: [40, 2, 2] }),
          Box.make({ min: [17, -30, 0], max: [23, 0, 2], lineStyle: O.some("broken") }),
        ]);
        const [plan = noView] = yield* project(rail, [top]);
        expect(plan.visible).toEqual([
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
        // the tab's outer side at x = 40 is one edge with the plate's end: unclaimed below y = 0, claimed above
        const flush = one("flush", [
          plate,
          Box.make({ min: [34, -8, 0], max: [40, 0, 2], lineStyle: O.some("broken") }),
        ]);
        const [plan = noView] = yield* project(flush, [top]);
        expect(plan.broken).toEqual([
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
        // the two-point view's silhouettes are traced back from the eye the pass saw them from, about its target
        expect(twoPoint.hiddenLinePassAbout).toBe("target");
        const cameras = [axo, axoPersp, twoPoint];
        const boss = yield* project(one("boss", [plate, peg(O.some("broken"))]), cameras, true);
        // without hidden lines the outline and the broken layer are the same
        const bossOutline = yield* project(one("boss", [plate, peg(O.some("broken"))]), cameras);
        expect(A.map(bossOutline, (view) => [view.visible, view.broken])).toEqual(
          A.map(boss, (view) => [view.visible, view.broken])
        );
        const solidBoss = yield* project(one("boss", [plate, peg(O.none())]), cameras, true);
        const plateOnly = yield* project(one("plate", [plate]), cameras, true);
        A.forEach(A.zip(A.zip(boss, solidBoss), plateOnly), ([[view, solidView], plateView]) => {
          const plateLines = [...plateView.visible, ...plateView.hidden];
          const onPlate = (segment: Segment) => A.some(plateLines, (line) => overlaps(line)(segment));
          // the claimed boss adds its circles and silhouettes to the outline; the unclaimed one adds none of them
          expect(A.filter(solidView.visible, (segment) => !onPlate(segment)).length).toBeGreaterThan(24);
          expect(A.filter(view.visible, (segment) => !onPlate(segment))).toEqual([]);
          // every one of them is drawn broken instead (top circle, front of the foot circle, two silhouettes)
          expect(view.broken.length).toBeGreaterThan(24);
          expect(totalLength(view.visible) + totalLength(view.broken)).toBeCloseTo(totalLength(solidView.visible), 3);
          // and the boss's hidden lines go, as a broken part's do; the plate's stay
          expect(A.filter(view.hidden, (segment) => !onPlate(segment))).toEqual([]);
          expect(A.filter(solidView.hidden, (segment) => !onPlate(segment)).length).toBeGreaterThan(0);
        });
      })
    );

    it.effect(
      "keeps a claimed edge solid, or hidden, where an unclaimed edge projects onto it at another depth",
      Effect.fnUntraced(function* () {
        // a broken box stacked on the plate: in a front view its foot edges fall on the plate's top edges
        const stack = one("stack", [
          plate,
          Box.make({ min: [10, 5, 2], max: [20, 15, 6], lineStyle: O.some("broken") }),
        ]);
        const [elevation = noView] = yield* project(stack, [front], true);
        expect(elevation.visible).toEqual([
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
        // the plate's back top edge, behind the box's hidden foot, is hidden over its whole length
        expect(A.some(elevation.hidden, (segment) => sameSegment(segment, [0, 2, 40, 2]))).toBe(true);
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
        // a stroke on the bottom face (z = 0) is read back from the view plane; on the tab's footprint it is unclaimed
        const ground = ontoGround(below);
        const onTab = ([x1, y1, x2, y2]: Segment) =>
          A.every([ground(x1, y1), ground(x2, y2)], ([x, y]) => x > 16.99 && x < 23.01 && y > -8.01 && y < -0.01);
        expect(A.filter(solidView.shading, onTab).length).toBeGreaterThan(0);
        expect(A.filter(view.shading, onTab)).toEqual([]);
        // the bottom face's strokes over the plate stay exactly as on the all-solid flap
        expect(A.filter(view.shading, (stroke) => !onTab(stroke))).toEqual(
          A.filter(solidView.shading, (stroke) => !onTab(stroke))
        );
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
