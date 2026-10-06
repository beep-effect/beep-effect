import { Box, Camera, ModelSpec, Occt, OcctError, Part, Prism, ProjectionRequest, ShadingPlan } from "@beep/occt";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import { Effect, Layer, Order, pipe } from "effect";
import * as O from "effect/Option";

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
