import {
  Box,
  Camera,
  Cylinder,
  EdgeSet,
  ModelSpec,
  Occt,
  OcctError,
  Part,
  Prism,
  ProjectionRequest,
  Segment2,
  ShadingPlan,
} from "@beep/occt";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

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
const LEGACY_SHA256 = "5e0530cb08eb91997221a704f0800ba020da36137b2f4941e2b8e3f4ec059051";
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
        A.map((b) => b.toString(16).padStart(2, "0")),
        A.join("")
      )
    )
  );

describe("@beep/occt service", () => {
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
        const json = yield* encodeLegacyViews(
          A.map(views, (view) => ({ visible: view.visible, hidden: view.hidden, shading: view.shading }))
        );
        expect(yield* sha256Hex(json)).toBe(LEGACY_SHA256);
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
  });
});
