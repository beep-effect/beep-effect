import {
  anchorOf,
  aspectOf,
  BandInk,
  BandRun,
  BoundingBox,
  bandLead,
  bandRunLengths,
  Camera,
  cameraForView,
  coverageOf,
  coveringOutlineDistance,
  FaceEdge,
  FaceFacts,
  FaceTreatment,
  faintShareOf,
  gradedExtents,
  gradedOffsets,
  hatchDirectionOf,
  inkOrderSteps,
  inkTwins,
  ladderPitch,
  legibleShading,
  legibleStrokeLength,
  nearestOutlineDistance,
  nextBandTaper,
  pointToSegmentDistance,
  reclippedCoverage,
  reclippedShading,
  ShadingBand,
  ShadingCoverage,
  ShadingCut,
  ShadingLines,
  ShadingPlan,
  ShadingRoom,
  ShadingSkip,
  ShadingSkipped,
  ShadingStretchSkip,
  ShadingTone,
  ShadingWindow,
  SheetOptions,
  settleBandTapers,
  shadingBandLadderFindings,
  shadingCoverageFindings,
  shadingLoneLineFindings,
  shadingOutlineClearanceFindings,
  shadingSpacingFindings,
  sideBySideGap,
  stretchFitsBand,
  surfaceClassOf,
  toneOf,
  treatmentFor,
  ValidationOptions,
  ViewFacts,
  ViewName,
  viewFactsOf,
} from "@beep/technical-drawing";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import type { BandTaper, Segment2, Vec3 } from "@beep/technical-drawing";
import type * as HashSet from "effect/HashSet";

const quad = (normal: Vec3, corners: readonly [Vec3, Vec3, Vec3, Vec3]): FaceFacts => {
  const edges = A.map(corners, (start, i) => {
    const end = corners[(i + 1) % 4] ?? start;
    return FaceEdge.make({ start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]) });
  });
  const axis = (k: 0 | 1 | 2) => A.map(corners, (c) => c[k]);
  const center = A.map([0, 1, 2], (k) => (Math.min(...axis(k as 0 | 1 | 2)) + Math.max(...axis(k as 0 | 1 | 2))) / 2);
  return FaceFacts.make({
    normal,
    center: [center[0] ?? 0, center[1] ?? 0, center[2] ?? 0],
    edges,
    outline: corners,
    bounds: BoundingBox.make({
      min: [Math.min(...axis(0)), Math.min(...axis(1)), Math.min(...axis(2))],
      max: [Math.max(...axis(0)), Math.max(...axis(1)), Math.max(...axis(2))],
    }),
  });
};

const wall = quad(
  [0, -1, 0],
  [
    [-20, 0, 0],
    [20, 0, 0],
    [20, 0, 20],
    [-20, 0, 20],
  ]
);
const front = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }));
const top = viewFactsOf(Camera.make({ eye: [0, 0, 1], up: [0, 1, 0] }));
const plan = (
  fields: Partial<{
    style: "uniform" | "graded";
    axis: "longest-edge" | "surface-class";
    minFaceSpan: number;
    minStroke: number;
  }>
) => ShadingPlan.make({ minPitch: 1, maxPitch: 3, litThreshold: 0.55, ...fields });

const roundedNoNegativeZero = (v: Vec3): ReadonlyArray<number> => A.map(v, (x) => Math.round(x * 1e9) / 1e9 + 0);

const linesOf = (treatment: FaceTreatment): O.Option<ShadingLines> =>
  treatment.kind === "lines" ? O.some(treatment) : O.none();

describe("Shading.rules", () => {
  it("defaults every new option to the original behaviour", () => {
    const defaults = ShadingPlan.make({ minPitch: 1, maxPitch: 3 });
    expect([defaults.style, defaults.axis, defaults.minFaceSpan, defaults.litThreshold]).toEqual([
      "uniform",
      "longest-edge",
      0,
      0.75,
    ]);
    const sheet = SheetOptions.make({});
    expect([sheet.shadingStyle, sheet.shadingAxis, sheet.shadingMinFaceSpanMm]).toEqual(["uniform", "longest-edge", 0]);
  });

  it("puts the 1.84(m) light at the sheet's upper left, toward the viewer", () => {
    const k = 1 / Math.sqrt(3);
    expect(roundedNoNegativeZero(front.right)).toEqual([1, 0, 0]);
    expect(roundedNoNegativeZero(front.up)).toEqual([0, 0, 1]);
    A.forEach(front.light, (v, i) => expect(v).toBeCloseTo([-k, -k, k][i] ?? 0, 12));
  });

  it("frames a two-point camera along its sight, keeps sheet-right level, and lands its light at 45° on the picture plane", () => {
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const unit = (v: Vec3): Vec3 => [v[0] / Math.hypot(...v), v[1] / Math.hypot(...v), v[2] / Math.hypot(...v)];
    const level: Vec3 = [-Math.sin(Math.PI / 6), -Math.cos(Math.PI / 6), 0];
    A.forEach([1, -1] as const, (zSign) => {
      const sight: Vec3 = [level[0] * 120, level[1] * 120, 45 * zSign];
      const camera = Camera.make({
        eye: level,
        up: [0, 0, 1],
        target: [20, 15, 20 + 45 * zSign],
        focus: O.some(120),
        sight: O.some(sight),
        hiddenLinePassAbout: "target",
      });
      const view = viewFactsOf(camera);
      A.forEach(view.eye, (v, i) =>
        expect(v, "the facing direction is the sight, not the level eye").toBeCloseTo(unit(sight)[i] ?? 0, 12)
      );
      expect(view.right[2], "sheet right stays level").toBeCloseTo(0, 12);
      expect(dot(view.right, view.eye), "sheet right stays square to the sight").toBeCloseTo(0, 12);
      expect(dot(view.right, level)).toBeCloseTo(0, 12);
      expect(dot(view.up, view.eye)).toBeCloseTo(0, 12);
      expect(view.up[2], "sheet up leans with the sight").toBeGreaterThan(0);
      const cosBeta = Math.abs(dot(level, view.eye));
      expect(cosBeta, "the tilted sight is not the level eye the vertical picture plane is square to").toBeLessThan(1);
      const pictureNormal = O.map(view.picture, roundedNoNegativeZero);
      assertSome(pictureNormal, roundedNoNegativeZero(level));
      const onPicture = dot(view.light, level);
      const sheetLight = [dot(view.light, view.right), view.light[2]] as const;
      expect(sheetLight[0]).toBeLessThan(0);
      expect(
        -sheetLight[0],
        "the light's part on the picture plane (the level component dropped) falls at 45° from the upper left"
      ).toBeCloseTo(sheetLight[1], 12);
      expect(onPicture).toBeCloseTo(1 / Math.sqrt(3), 12);
      expect(dot(view.light, view.eye)).toBeGreaterThan(0);
      const withoutSight = viewFactsOf(Camera.make({ ...camera, sight: O.none() }));
      A.forEach(withoutSight.eye, (v, i) =>
        expect(v, "the same camera without its sight reads the level eye, square to its own sheet").toBeCloseTo(
          level[i] ?? 0,
          12
        )
      );
      assertNone(withoutSight.picture);
    });
  });

  it("lights a two-point view on its picture plane, so a wall parallel to the sheet takes one tone above and below", () => {
    // decision: two-point-light-lies-on-the-picture-plane
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] });
    const twoPoint = (view: "top-perspective" | "bottom-perspective") =>
      cameraForView({ view, box, projection: "two-point", elevationDeg: O.some(20) });
    const above = twoPoint("top-perspective");
    const below = twoPoint("bottom-perspective");
    const levelEye = above.eye;
    const views = [viewFactsOf(above), viewFactsOf(below), viewFactsOf(Camera.make({ eye: levelEye, up: [0, 0, 1] }))];
    const [fromAbove, fromBelow, level] = views;
    expect(
      dot(fromAbove?.eye ?? levelEye, fromBelow?.eye ?? levelEye),
      "the two sights tilt opposite ways, so the frames differ"
    ).toBeLessThan(0.99);
    A.forEach(views, (view) =>
      A.forEach(view.light, (v, i) => expect(v).toBeCloseTo(level?.light[i] ?? Number.NaN, 12))
    );
    const along: Vec3 = [-levelEye[1], levelEye[0], 0];
    const at = (x: number, z: number): Vec3 => [10 + along[0] * x, 10 + along[1] * x, z];
    const wallFacingLevelEye = quad(levelEye, [at(-20, 0), at(20, 0), at(20, 20), at(-20, 20)]);
    A.forEach(views, (view) =>
      expect(
        dot(wallFacingLevelEye.normal, view.light),
        "lit on the picture plane, the wall parallel to it takes the square-on exposure 1/√3 in every view"
      ).toBeCloseTo(1 / Math.sqrt(3), 12)
    );
    expect(A.map(views, (view) => toneOf(dot(wallFacingLevelEye.normal, view.light)))).toEqual([
      "light",
      "light",
      "light",
    ]);
    const gradedPlan = plan({ style: "graded", axis: "surface-class" });
    const bandOf = (view: ViewFacts) =>
      O.map(linesOf(treatmentFor({ face: wallFacingLevelEye, view, plan: gradedPlan })), (lines) => ({
        offsets: A.map(lines.cuts, (cut) => Math.round(cut.offset * 1e9) / 1e9),
        extents: A.map(lines.cuts, (cut) => Math.round(cut.extent * 1e9) / 1e9),
      }));
    const bands = A.map(views, bandOf);
    const lightRecipeExtentsAcross40 = O.map(bands[0] ?? O.none(), (band) => band.extents);
    assertSome(lightRecipeExtentsAcross40, [1, 1, 0.6, 0.5, 0.4]);
    expect(bands[1], "the two-point bottom view bands the wall as the two-point top view does").toEqual(bands[0]);
    expect(bands[2], "the level elevation bands the wall as the two-point top view does").toEqual(bands[0]);
  });

  it("classes faces against +Z within a degree", () => {
    expect(surfaceClassOf([0, 0, 1])).toBe("level");
    expect(surfaceClassOf([0, 0.01, -1])).toBe("level");
    expect(surfaceClassOf([1, 0, 0])).toBe("upright");
    expect(surfaceClassOf([0.9998, 0, 0.01])).toBe("upright");
    expect(surfaceClassOf([0, -Math.SQRT1_2, Math.SQRT1_2])).toBe("inclined");
  });

  it("tells square-on, oblique, and sliver faces apart", () => {
    expect(aspectOf({ face: wall, view: front, minFaceSpan: 0 })).toBe("square-on");
    const turned = viewFactsOf(Camera.make({ eye: [0.5, -1, 0], up: [0, 0, 1] }));
    expect(aspectOf({ face: wall, view: turned, minFaceSpan: 0 })).toBe("oblique");
    expect(aspectOf({ face: wall, view: front, minFaceSpan: 19.9 })).toBe("square-on");
    expect(aspectOf({ face: wall, view: front, minFaceSpan: 20.1 })).toBe("sliver");
  });

  it("bands exposure and never leaves a band unshaded", () => {
    expect(A.map([1, 0.6, 1 / Math.sqrt(3), 0.2, 0, -0.2, -1], toneOf)).toEqual([
      "faint",
      "faint",
      "light",
      "light",
      "medium",
      "medium",
      "dark",
    ]);
    expect(ShadingTone.literals).toEqual(["faint", "light", "medium", "dark"]);
  });

  it("anchors graded lines on the shadow edge: lower right of a square-on wall", () => {
    const anchor = anchorOf({ face: wall, view: front, direction: [0, 0, 1] });
    expect(anchor.point).toEqual([20, 0, 0]);
    expect(roundedNoNegativeZero(anchor.step)).toEqual([-1, 0, 0]);
    assertSome(
      O.map(anchor.edge, (e) => [e.start, e.end]),
      [
        [20, 0, 0],
        [20, 0, 20],
      ]
    );
    expect(
      anchorOf({ face: wall, view: front, direction: [1, 0, 0] }).point[2],
      "horizontal lines on the same wall anchor on the bottom edge (light from above)"
    ).toBe(0);
  });

  it("anchors a steeply receding wall's band at its sheet-right end, not its near end", () => {
    const receding = quad(
      [-Math.sqrt(0.75), -0.5, 0],
      [
        [0, 0, 0],
        [-5, 8.66, 0],
        [-5, 8.66, 20],
        [0, 0, 20],
      ]
    );
    expect(
      anchorOf({ face: receding, view: front, direction: [0, 0, 1] }).point[0],
      "from the viewer at -Y the wall runs from x = 0 (sheet right) away and to the left, 60° off the sheet"
    ).toBe(0);
    const fromBelow = viewFactsOf(Camera.make({ eye: [-0.82, 0, -0.58], up: [0, 0, 1] }));
    const acrossLit = quad(
      [-0.5, 0.866, 0],
      [
        [-200, 0, 0],
        [-100, 57.7, 0],
        [-100, 57.7, 400],
        [-200, 0, 400],
      ]
    );
    expect(
      anchorOf({ face: acrossLit, view: fromBelow, direction: [0, 0, 1] }).point[1],
      "a wall the sheet light runs straight across (seen from below, at 60° to the sheet) anchors on its sheet-right end, here the end with the smaller y"
    ).toBe(0);
    const tabbed = FaceFacts.make({
      ...wall,
      edges: [
        ...wall.edges,
        FaceEdge.make({ start: [20, 0, 8], end: [22, 0, 8], length: 2 }),
        FaceEdge.make({ start: [22, 0, 8], end: [22, 0, 12], length: 4 }),
        FaceEdge.make({ start: [22, 0, 12], end: [20, 0, 12], length: 2 }),
      ],
      outline: [...wall.outline, [22, 0, 8], [22, 0, 12]],
    });
    expect(
      anchorOf({ face: tabbed, view: front, direction: [0, 0, 1] }).point[0],
      "a tab sticking out past the wall's right side does not move the anchor off the wall"
    ).toBe(20);
    const gradedPlan = (minStroke: number) => plan({ style: "graded", axis: "surface-class", minStroke });
    expect(
      treatmentFor({ face: wall, view: front, plan: gradedPlan(18) }).kind,
      "a chord must keep the minimum stroke after both ends are drawn back one pitch: the 20 chord keeps 18"
    ).toBe("lines");
    expect(
      treatmentFor({ face: wall, view: front, plan: gradedPlan(19) }),
      "the 20 chord drawn back one pitch at both ends cannot keep a minimum stroke of 19"
    ).toEqual(ShadingSkipped.make({ reason: "sliver" }));
  });

  it("spaces graded lines from minPitch, growing, capped, within the tone's share", () => {
    const offsets = gradedOffsets({ span: 40, minPitch: 1, maxPitch: 2.5, tone: "medium" });
    const gaps = A.zipWith([0, ...offsets], offsets, (a, b) => b - a);
    expect(offsets[0]).toBe(1);
    expect(
      A.every(
        A.zipWith(gaps, A.drop(gaps, 1), (a, b) => b >= a - 1e-12),
        (grows) => grows
      )
    ).toBe(true);
    expect(Math.max(...gaps)).toBe(2.5);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(0.35 * 40 + 2.5);
    expect(
      gradedOffsets({ span: 40, minPitch: 1, maxPitch: 2.5, tone: "faint" }).length,
      "a lit face carries two to four short strokes: three fit inside 15% of a 40-wide face"
    ).toBe(3);
    expect(
      gradedOffsets({ span: 8, minPitch: 1, maxPitch: 2.5, tone: "faint" }).length,
      "two lit strokes fit inside 15% of an 8-wide face"
    ).toBe(2);
    expect(gradedOffsets({ span: 400, minPitch: 1, maxPitch: 2.5, tone: "faint" }).length).toBe(4);
    expect(gradedOffsets({ span: 400, minPitch: 1, maxPitch: 2.5, tone: "dark" }).length).toBe(8);
    expect(
      gradedOffsets({ span: 4, minPitch: 1, maxPitch: 2.5, tone: "medium" }),
      "a narrow face still gets the tone's minimum where it fits"
    ).toEqual([1, 2.4]);
    expect(gradedOffsets({ span: 1.5, minPitch: 1, maxPitch: 2.5, tone: "dark" }), "nothing below one pitch").toEqual(
      []
    );
    expect(
      A.map(
        gradedOffsets({ span: 40, minPitch: 1, maxPitch: 2.5, tone: "faint", keep: (o) => o >= 3 }),
        (o) => Math.round(o * 10) / 10
      ),
      "positions the face is too narrow for are skipped, not counted: the strokes move inward"
    ).toEqual([3, 4.4]);
    const gradedPlan = plan({ style: "graded", axis: "surface-class" });
    const offsetsFrom = (from: number) => (treatment: FaceTreatment) =>
      O.map(linesOf(treatment), (l) => A.map(l.cuts, (c) => Math.round((c.offset - from) * 10) / 10));
    const whole = offsetsFrom(0)(treatmentFor({ face: wall, view: front, plan: gradedPlan }));
    const stretch = offsetsFrom(12)(
      treatmentFor({ face: wall, view: front, plan: gradedPlan, window: ShadingWindow.make({ start: 12, span: 28 }) })
    );
    assertSome(O.map(stretch, A.take(3)), O.getOrThrow(O.map(whole, A.take(3))));
    expect(
      Math.max(...O.getOrThrow(stretch)),
      "a visible stretch of the face is shaded on its own, from the side nearest the shadow anchor"
    ).toBeLessThanOrEqual(28 - 1);
    const stretchClampedToAnchor = offsetsFrom(0)(
      treatmentFor({ face: wall, view: front, plan: gradedPlan, window: ShadingWindow.make({ start: -2, span: 30 }) })
    );
    assertSome(O.map(stretchClampedToAnchor, A.take(3)), O.getOrThrow(O.map(whole, A.take(3))));
  });

  it("keeps shading legible after hidden-line removal: fragments and doubled lines go", () => {
    const fullStroke: Segment2 = [0, 0, 10, 0];
    const shorterLineBeside: Segment2 = [0, 0.3, 4, 0.3];
    const underMinimumFragment: Segment2 = [0, 0, 0.5, 0];
    const neighbourAtLegalGap: Segment2 = [0, 2, 10, 2];
    const unrelatedStroke: Segment2 = [20, 0, 20, 10];
    const segments: ReadonlyArray<Segment2> = [
      fullStroke,
      shorterLineBeside,
      underMinimumFragment,
      neighbourAtLegalGap,
      unrelatedStroke,
    ];
    expect(legibleShading({ segments, minStroke: 1, minSpacing: 0.5 })).toEqual([
      [0, 0, 10, 0],
      [0, 2, 10, 2],
      [20, 0, 20, 10],
    ]);
    expect(
      legibleShading({
        segments: [
          [0, 0, 10, 0],
          [0, 5, 1.5, 5],
        ],
        minStroke: 1,
        minSpacing: 0.5,
        inset: 1,
      }),
      "the inset draws every surviving stroke back from both ends"
    ).toEqual([[1, 0, 9, 0]]);
    expect(
      legibleShading({
        segments: [
          [0, 0.3, 10, 0.3],
          [0, 0, 10, 0],
        ],
        minStroke: 0,
        minSpacing: 0.5,
      }),
      "equal lengths side by side keep the first"
    ).toEqual([[0, 0.3, 10, 0.3]]);
    assertSome(sideBySideGap({ first: [0, 0, 10, 0], second: [0, 0.3, 10, 0.3], minSpacing: 0.5 }), 0.3);
    assertNone(sideBySideGap({ first: [0, 0, 10, 0], second: [10.5, 0, 20, 0], minSpacing: 0.5 }));
  });

  it("draws a stroke end back further until it stands clear of an outline it met at a shallow angle", () => {
    const [stroke] = legibleShading({
      segments: [[5, 0.3, 5, 19.7]],
      minStroke: 1,
      minSpacing: 0.5,
      outlines: [[0, 0, 20, 2]],
      clearance: 0.5,
    });
    expect(
      stroke?.[1],
      "the top end at (5, 0.3) sits 0.2 from the outline y = x / 10; clearance 0.5 needs it at y >= 1"
    ).toBeCloseTo(1.05, 6);
    expect(stroke?.[3]).toBe(19.7);
    expect(
      legibleShading({
        segments: [[0.3, 2, 0.3, 18]],
        minStroke: 1,
        minSpacing: 0.5,
        outlines: [[0, 0, 0, 20]],
        clearance: 0.5,
      }),
      "a stroke running beside an outline closer than the clearance is dropped"
    ).toEqual([]);
    expect(pointToSegmentDistance({ x: 5, y: 3, segment: [0, 0, 10, 0] })).toBe(3);
  });

  it("tapers graded strokes: two full lines, then 60% down to 40% of the chord", () => {
    const rounded = (extents: ReadonlyArray<number>) => A.map(extents, (e) => Math.round(e * 100) / 100);
    expect(rounded(gradedExtents({ count: 5 }))).toEqual([1, 1, 0.6, 0.5, 0.4]);
    expect(rounded(gradedExtents({ count: 3 }))).toEqual([1, 1, 0.6]);
    expect(rounded(gradedExtents({ count: 2 }))).toEqual([1, 1]);
    expect(gradedExtents({ count: 0 })).toEqual([]);
    expect(rounded(gradedExtents({ count: 2, fullLines: 0 }))).toEqual([0.6, 0.4]);
    expect(rounded(gradedExtents({ count: 1, fullLines: 0 }))).toEqual([0.6]);
  });

  it("keeps the original lit cut-off under the default plan and shades the same face when graded", () => {
    const uniform = treatmentFor({ face: wall, view: front, plan: plan({}) });
    expect(uniform).toEqual(ShadingSkipped.make({ reason: "lit" }));
    const graded = treatmentFor({ face: wall, view: front, plan: plan({ style: "graded", axis: "surface-class" }) });
    const lines = linesOf(graded);
    assertSome(
      O.map(lines, (l) => [roundedNoNegativeZero(l.origin), roundedNoNegativeZero(l.step)]),
      [
        [20, 0, 0],
        [-1, 0, 0],
      ]
    );
    const offsets = O.getOrElse(
      O.map(lines, (l) => A.map(l.cuts, (cut) => cut.offset)),
      () => []
    );
    const extents = O.getOrElse(
      O.map(lines, (l) => A.map(l.cuts, (cut) => cut.extent)),
      () => []
    );
    expect(A.take(extents, 2), "the taper: the first two strokes run the full chord").toEqual([1, 1]);
    expect(
      A.every(
        A.zipWith(extents, A.drop(extents, 1), (a, b) => b <= a),
        (shrinks) => shrinks
      ),
      "later strokes shorten toward the light"
    ).toBe(true);
    const gaps = A.zipWith([0, ...offsets], offsets, (a, b) => b - a);
    expect(gaps[0]).toBe(1);
    expect(
      A.every(
        A.zipWith(gaps, A.drop(gaps, 1), (a, b) => b >= a - 1e-12),
        (grows) => grows
      )
    ).toBe(true);
  });

  it("runs a level face's lines along its darkest edge when the light is known", () => {
    const corners = A.makeBy(
      6,
      (i) => [100 * Math.cos((i * Math.PI) / 3), 100 * Math.sin((i * Math.PI) / 3), 5] as const
    );
    const lid = FaceFacts.make({
      normal: [0, 0, 1],
      center: [0, 0, 5],
      edges: A.makeBy(6, (i) => {
        const start = corners[i]!;
        const end = corners[(i + 1) % 6]!;
        return FaceEdge.make({ start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) });
      }),
      outline: corners,
      bounds: BoundingBox.make({ min: [-100, -87, 5], max: [100, 87, 5] }),
    });
    const topPlan = viewFactsOf(Camera.make({ eye: [0, 0, 1], up: [1, 0, 0] }));
    const direction = O.getOrThrow(hatchDirectionOf({ face: lid, axis: "surface-class", view: topPlan }));
    expect(
      Math.abs(direction[0] * 0.5 + (direction[1] * -Math.sqrt(3)) / 2),
      "every edge of the regular hexagon lid is longest, so the light decides: under the top-plan light (world +X +Y +Z) the darkest edge faces -X -Y, the one from the 180° to the 240° corner along (0.5, -0.866)"
    ).toBeCloseTo(1, 6);
    const directionWithoutLight = hatchDirectionOf({ face: lid, axis: "surface-class" });
    assertSome(directionWithoutLight, O.getOrThrow(hatchDirectionOf({ face: lid, axis: "longest-edge" })));
  });

  it("hatches upright faces along +Z, inclined faces along their level line or darkest edge, level faces along the longest edge", () => {
    assertSome(hatchDirectionOf({ face: wall, axis: "surface-class" }), [0, 0, 1]);
    assertSome(hatchDirectionOf({ face: wall, axis: "longest-edge" }), [1, 0, 0]);
    const flap = quad(
      [0, -Math.SQRT1_2, Math.SQRT1_2],
      [
        [0, 0, 0],
        [10, 0, 0],
        [10, 30, 30],
        [0, 30, 30],
      ]
    );
    const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
    const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross3 = (a: Vec3, b: Vec3): Vec3 => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const unit3 = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
    const sheetDarkest = (face: FaceFacts, view: ReturnType<typeof viewFactsOf>) => {
      const onSheet = (v: Vec3): Vec3 => sub(v, scale(view.eye, dot3(v, view.eye)));
      const light = onSheet(view.light);
      const normal = unit3(face.normal);
      const longest = A.reduce(face.edges, 0, (most, edge) => Math.max(most, edge.length));
      const isMajorEdge = (edge: FaceEdge) => edge.length >= 0.25 * longest;
      return pipe(
        face.edges,
        A.filter(isMajorEdge),
        A.map((edge) => {
          const along = unit3(sub(edge.end, edge.start));
          const side = unit3(cross3(normal, along));
          const mid = scale(
            [edge.start[0] + edge.end[0], edge.start[1] + edge.end[1], edge.start[2] + edge.end[2]],
            0.5
          );
          const outward = dot3(side, sub(mid, face.center)) < 0 ? scale(side, -1) : side;
          return { edge, darkness: -dot3(unit3(onSheet(outward)), light) };
        }),
        A.sort(Order.flip(Order.mapInput(Order.Number, (e: { readonly darkness: number }) => e.darkness))),
        A.head,
        O.map((e) => unit3(sub(e.edge.end, e.edge.start)))
      );
    };
    const oblique = viewFactsOf(Camera.make({ eye: [-0.82, 0, -0.58], up: [0, 0, 1] }));
    for (const view of [front, oblique]) {
      const expected = O.map(sheetDarkest(flap, view), (d) =>
        roundedNoNegativeZero(A.map(d, Math.abs) as unknown as Vec3)
      );
      const chosen = O.map(hatchDirectionOf({ face: flap, axis: "surface-class", view }), (d) =>
        roundedNoNegativeZero(A.map(d, Math.abs) as unknown as Vec3)
      );
      expect(
        chosen,
        "the darkest edge is read on the sheet: each edge's outward normal and the light projected onto the view plane, the edge turned most away; from the oblique eye below the article the in-plane light would pick another edge"
      ).toEqual(expected);
    }
    const flapDirection = hatchDirectionOf({ face: flap, axis: "surface-class" });
    assertSome(O.map(flapDirection, roundedNoNegativeZero), [-1, 0, 0]);
    expect(
      anchorOf({
        face: flap,
        view: front,
        direction: [0, Math.SQRT1_2, Math.SQRT1_2],
        shadowEdge: FaceEdge.make({ start: [10, 0, 0], end: [10, 30, 30], length: Math.hypot(30, 30) }),
      }).point[0],
      "with the light known, an inclined face runs along the edge turned away from it (here the +X side), and its band anchors on that edge"
    ).toBe(10);
    assertSome(
      O.map(hatchDirectionOf({ face: flap, axis: "surface-class", view: front }), (d) => [
        Math.round(d[0] * 100) / 100,
        Math.round((Math.abs(d[1]) - Math.abs(d[2])) * 100) / 100,
      ]),
      [0, 0]
    );
    const lid = quad(
      [0, 0, 1],
      [
        [0, 0, 5],
        [10, 0, 5],
        [10, 30, 5],
        [0, 30, 5],
      ]
    );
    assertSome(hatchDirectionOf({ face: lid, axis: "surface-class" }), [0, 1, 0]);
    const disc = FaceFacts.make({ ...lid, edges: [] });
    assertSome(hatchDirectionOf({ face: disc, axis: "surface-class" }), [1, 0, 0]);
    assertNone(hatchDirectionOf({ face: disc, axis: "longest-edge" }));
  });

  it("gives faces mirrored about the light azimuth equal bands and equal lines", () => {
    const a = Math.SQRT1_2 * 0.6;
    const c = 0.8;
    const slope = (sign: 1 | -1) =>
      quad(
        [sign * a, sign * a, c],
        [
          [0, 0, 0],
          [-10, 10, 0],
          [-10 + sign * 6 * Math.SQRT1_2, 10 + sign * 6 * Math.SQRT1_2, -4.5],
          [sign * 6 * Math.SQRT1_2, sign * 6 * Math.SQRT1_2, -4.5],
        ]
      );
    const [one, two] = [slope(1), slope(-1)];
    const gradedPlan = plan({ style: "graded", axis: "surface-class" });
    expect(
      toneOf(one.normal[0] * top.light[0] + one.normal[1] * top.light[1] + one.normal[2] * top.light[2]),
      "seen from above, the light's azimuth is the sheet diagonal (-1, 1); the two slopes mirror each other across that vertical plane"
    ).toBe(toneOf(two.normal[0] * top.light[0] + two.normal[1] * top.light[1] + two.normal[2] * top.light[2]));
    const offsetsOf = (face: FaceFacts) =>
      O.map(linesOf(treatmentFor({ face, view: top, plan: gradedPlan })), (l) =>
        A.map(l.cuts, (cut) => Math.round(cut.offset * 1e9) / 1e9)
      );
    const first = offsetsOf(one);
    expect(O.isSome(first)).toBe(true);
    expect(offsetsOf(two)).toEqual(first);
  });

  it("never skips a visible planar face as lit under graded shading", () => {
    const gradedPlan = plan({ style: "graded", axis: "surface-class" });
    const turns = A.makeBy(12, (i) => (i * Math.PI) / 6);
    const treatments = A.flatMap(turns, (azimuth) =>
      A.map([-60, -30, 0, 30, 60], (elevation) => {
        const view = viewFactsOf(
          Camera.make({
            eye: [
              Math.cos(azimuth) * Math.cos((elevation * Math.PI) / 180),
              Math.sin(azimuth) * Math.cos((elevation * Math.PI) / 180),
              Math.sin((elevation * Math.PI) / 180),
            ],
            up: [0, 0, 1],
          })
        );
        return treatmentFor({ face: wall, view, plan: gradedPlan });
      })
    );
    const reasons = A.dedupe(A.map(A.filter(treatments, FaceTreatment.guards.skipped), (t) => t.reason));
    expect(A.every(reasons, (r) => r === "back-facing" || r === "edge-on")).toBe(true);
    expect(A.some(treatments, (t) => t.kind === "lines")).toBe(true);
  });

  it("skips slivers and counts coverage per reason in reason order", () => {
    const sliver = treatmentFor({ face: wall, view: front, plan: plan({ style: "graded", minFaceSpan: 25 }) });
    expect(sliver).toEqual(ShadingSkipped.make({ reason: "sliver" }));
    const back = treatmentFor({ face: wall, view: top, plan: plan({ style: "graded" }) });
    expect(back).toEqual(ShadingSkipped.make({ reason: "back-facing" }));
    const lines = ShadingLines.make({ origin: [0, 0, 0], step: [1, 0, 0], cuts: [ShadingCut.make({ offset: 1 })] });
    expect(coverageOf([sliver, lines, back, ShadingSkipped.make({ reason: "curved" }), back])).toEqual(
      ShadingCoverage.make({
        shadedFaces: 1,
        skippedFaces: [
          ShadingSkip.make({ reason: "back-facing", faces: 2 }),
          ShadingSkip.make({ reason: "curved", faces: 1 }),
          ShadingSkip.make({ reason: "sliver", faces: 1 }),
        ],
      })
    );
  });
});

describe("neighbour ink order", () => {
  const band = (face: number, exposure: number, density: number) => BandInk.make({ face, exposure, density });
  const bands = [band(0, 0.5, 0.3), band(1, -0.4, 0.2), band(2, 0.7, 0.1)];
  const facesOf = (steps: HashSet.HashSet<number>) => A.sort(A.fromIterable(steps), Order.Number);

  it("steps the lighter face of a shared edge only when it carries more ink than the darker one", () => {
    expect(
      facesOf(inkOrderSteps({ bands, shared: [[0, 1]] })),
      "the lit face 0 out-inks the dark face 1 across their shared edge"
    ).toEqual([0]);
    expect(facesOf(inkOrderSteps({ bands, shared: [[1, 0]] }))).toEqual([0]);
    expect(
      facesOf(inkOrderSteps({ bands, shared: [[2, 1]] })),
      "the lighter face 2 is sparser than face 1: nothing to do"
    ).toEqual([]);
    expect(
      facesOf(inkOrderSteps({ bands, shared: [] })),
      "faces that share no visible edge are never compared"
    ).toEqual([]);
  });

  it("leaves equally lit faces, and a face bare by design, alone", () => {
    const tie = [band(0, 0.5, 0.25), band(1, 0.5, 0.1), band(2, 0.5005, 0.4), band(3, 0.502, 0.4)];
    expect(facesOf(inkOrderSteps({ bands: tie, shared: [[0, 1]] }))).toEqual([]);
    expect(
      facesOf(inkOrderSteps({ bands: tie, shared: [[0, 2]] })),
      "face 2, the denser of its pair, is lit inside the exposure tie (0.001) above face 0: its equal, it keeps its ink"
    ).toEqual([]);
    expect(
      facesOf(inkOrderSteps({ bands: tie, shared: [[0, 3]] })),
      "face 3, the denser of its pair, is lit past the exposure tie above face 0: the lighter, it steps"
    ).toEqual([3]);
    expect(
      facesOf(inkOrderSteps({ bands, shared: [[0, 3]] })),
      "face 3 has no band (a sliver, a narrow face, a broken part): its pairs are not compared"
    ).toEqual([]);
  });

  it("steps a band from full to the lit taper to the lit floor, and no further", () => {
    assertSome(nextBandTaper("full"), "lit");
    assertSome(nextBandTaper("lit"), "lit-floor");
    assertNone(nextBandTaper("lit-floor"));
  });

  it("cuts a light band back to short strokes at the same offsets, and to two lines at the floor", () => {
    const square = quad(
      [0, -1, 0],
      [
        [-10, 0, 0],
        [10, 0, 0],
        [10, 0, 20],
        [-10, 0, 20],
      ]
    );
    const gradedPlan = plan({ style: "graded", axis: "surface-class" });
    const cutsOf = (taper?: BandTaper) =>
      O.getOrElse(
        O.map(
          linesOf(
            treatmentFor({ face: square, view: front, plan: gradedPlan, ...(taper === undefined ? {} : { taper }) })
          ),
          (lines) =>
            A.map(lines.cuts, (cut) => [Math.round(cut.offset * 1e9) / 1e9, Math.round(cut.extent * 100) / 100])
        ),
        () => []
      );
    expect(cutsOf(), "a 20 × 20 wall square-on to the front view is a light face with a three-line band").toEqual([
      [1, 1],
      [2.4, 1],
      [4.36, 0.6],
    ]);
    expect(cutsOf("full"), "the default is the full band, exactly as before tapers existed").toEqual(cutsOf());
    expect(cutsOf("lit")).toEqual([
      [1, 0.6],
      [2.4, 0.5],
      [4.36, 0.4],
    ]);
    expect(cutsOf("lit-floor")).toEqual([
      [1, 0.6],
      [2.4, 0.4],
    ]);
  });

  it("settles a view's tapers: each inverted face steps until it no longer out-inks its neighbour", () => {
    const ink = (taper: BandTaper, full: number, lit: number, floor: number) =>
      taper === "full" ? full : taper === "lit" ? lit : floor;
    const calls: Array<HashMap.HashMap<number, BandTaper>> = [];
    const inkOf = (tapers: HashMap.HashMap<number, BandTaper>) => {
      calls.push(tapers);
      const taperOf = (face: number): BandTaper => O.getOrElse(HashMap.get(tapers, face), (): BandTaper => "full");
      return [
        band(0, 0.5, ink(taperOf(0), 0.3, 0.15, 0.1)),
        band(1, -0.4, 0.2),
        band(2, 0.3, ink(taperOf(2), 0.4, 0.25, 0.15)),
        band(3, 0.7, ink(taperOf(3), 0.6, 0.5, 0.4)),
        band(4, 0.6, 0.5),
      ];
    };
    const tapers = settleBandTapers({
      shared: [
        [0, 1],
        [1, 2],
        [1, 3],
        [3, 4],
      ],
      inkOf,
    });
    const settled = A.map([0, 1, 2, 3, 4], (face) => O.getOrNull(HashMap.get(tapers, face)));
    expect(
      settled,
      "ink per taper of each face: 0 needs one step, 2 needs two, and 3 is still denser at the floor"
    ).toEqual(["lit", null, "lit-floor", "lit-floor", null]);
    calls.length = 0;
    expect(
      HashMap.size(settleBandTapers({ shared: [], inkOf })),
      "with no shared edges every band stays as its tone gives it"
    ).toBe(0);
    expect(A.length(calls), "with no shared edges the view is planned once").toBe(1);
  });

  it("settles a cascade: a face cut back below its darker neighbour may in turn have to cut back a lighter one", () => {
    const inkOf = (tapers: HashMap.HashMap<number, BandTaper>) => [
      band(0, 0, HashMap.has(tapers, 0) ? 0.1 : 0.3),
      band(1, -0.5, 0.2),
      band(2, 0.4, HashMap.has(tapers, 2) ? 0.05 : 0.15),
    ];
    const tapers = settleBandTapers({
      shared: [
        [0, 1],
        [0, 2],
      ],
      inkOf,
    });
    expect(
      A.map([0, 1, 2], (face) => O.getOrNull(HashMap.get(tapers, face))),
      "1 (dark) < 0 (medium) < 2 (light) in exposure; 0 out-inks 1, and once 0 is cut back 2 out-inks 0"
    ).toEqual(["lit", null, "lit"]);
  });

  it("refuses a step that would leave the face without a band or would not thin it", () => {
    const inkOf = (tapers: HashMap.HashMap<number, BandTaper>) => [
      ...(HashMap.has(tapers, 0) ? [] : [band(0, 0.5, 0.3)]),
      band(1, -0.4, 0.2),
      band(2, 0.3, HashMap.has(tapers, 2) ? 0.35 : 0.3),
    ];
    const tapers = settleBandTapers({
      shared: [
        [0, 1],
        [1, 2],
      ],
      inkOf,
    });
    expect(
      HashMap.size(tapers),
      "stepped to either taper, face 0 loses its band and face 2 gains ink (a band the taper alone would empty is drawn untapered)"
    ).toBe(0);
  });

  it("tries the lit floor in the same round when the lit taper does not thin a band", () => {
    const calls: Array<HashMap.HashMap<number, BandTaper>> = [];
    const inkOf = (tapers: HashMap.HashMap<number, BandTaper>) => {
      calls.push(tapers);
      const taperOf = (face: number): BandTaper => O.getOrElse(HashMap.get(tapers, face), (): BandTaper => "full");
      return [
        band(0, 0.5, taperOf(0) === "full" ? 0.3 : taperOf(0) === "lit" ? 0.35 : 0.15),
        band(1, -0.4, 0.2),
        band(2, 0.3, taperOf(2) === "full" ? 0.3 : 0.4),
      ];
    };
    const tapers = settleBandTapers({
      shared: [
        [0, 1],
        [1, 2],
      ],
      inkOf,
    });
    expect(
      A.map([0, 1, 2], (face) => O.getOrNull(HashMap.get(tapers, face))),
      "face 0's lit taper leaves its strokes too short for a band, so they are drawn untapered with more ink; its lit floor, two lines, thins it below the dark face; face 2 thins at neither and keeps its full band"
    ).toEqual(["lit-floor", null, null]);
    expect(
      A.length(calls),
      "the first plan, the lit step, the lit floor, then the settled view: one round of steps"
    ).toBe(4);
  });

  it("settles two faces of one seen area a tone step apart as if they shared an edge", () => {
    const bands = [band(0, 0.6, 0.063), band(1, 0.05, 0.06), band(2, 0.3, 0.07)];
    const seen = (face: number) => A.getUnsafe([1000, 1040, 400], face);
    const twins = inkTwins({ bands, seen });
    expect(twins, "faces 0 and 1 are twins; face 2 is a third the size, and faces a tone step apart only").toEqual([
      [0, 1],
    ]);
    expect(inkTwins({ bands: [band(0, 0.6, 0.063), band(1, 0.45, 0.06)], seen })).toEqual([]);
    const inkOf = (tapers: HashMap.HashMap<number, BandTaper>) => [
      band(0, 0.6, HashMap.has(tapers, 0) ? 0.04 : 0.063),
      band(1, 0.05, 0.06),
    ];
    expect(HashMap.size(settleBandTapers({ shared: [], inkOf })), "off a shared edge alone nothing steps").toBe(0);
    expect(
      O.getOrNull(HashMap.get(settleBandTapers({ shared: twins, inkOf }), 0)),
      "a lit flap (0.6) and its medium-tone mirror (0.05) on opposite sides of an article share no edge; of one seen area they are twins, and settled with its twin the lit flap steps"
    ).toBe("lit");
  });
});

describe("bandRunLengths", () => {
  const run = (length: number, extent: number, rank: number) => BandRun.make({ length, extent, rank });

  it("keeps a redrawn band's taper when its shadow-side run is the shorter", () => {
    const [shadow = 0, lit = 0] = bandRunLengths({ runs: [run(5, 0.6, 0), run(8, 0.4, 1)], minStroke: 4 });
    expect(
      shadow,
      "at a glimpse's acute tip the shadow-side run is the shorter (5 against 8); cut to 0.6 and 0.4 of each run's own length (3 and 3.2), the minimum stroke of 4 would raise both to 4 and lose the taper"
    ).toBeCloseTo(5, 12);
    expect(lit, "against the band's longest run, the shadow-side stroke is the longer").toBeCloseTo(4, 12);
    expect(
      bandRunLengths({ runs: [run(10, 0.6, 0), run(10, 0.4, 1)], minStroke: 1.5 }),
      "above the minimum stroke the band keeps its planned ratio of the longest run"
    ).toEqual([6, 4]);
    expect(
      bandRunLengths({ runs: [run(4, 0.6, 0), run(10, 0.4, 1)], minStroke: 1.5 }),
      "each stroke never runs beyond its own run"
    ).toEqual([4, 4]);
  });

  it("never draws a line longer than one nearer the shadow edge", () => {
    const lengths = bandRunLengths({
      runs: [run(3.2, 0.6, 0), run(9, 0.4, 1), run(3.5, 0.6, 0)],
      minStroke: 1,
    });
    expect(lengths).toEqual([3.2, 3.5, 3.5]);
  });
});

describe("faint ramp", () => {
  const SQUARE_ON_EXPOSURE = 1 / Math.sqrt(3);
  const TURNED_30_TOWARD_LIGHT_EXPOSURE = (Math.sqrt(3) + 1) / (2 * Math.sqrt(3));
  const gradedPlan = plan({ style: "graded", axis: "surface-class" });
  const wide = (turn: number) => {
    const along: Vec3 = [Math.cos((turn * Math.PI) / 180), -Math.sin((turn * Math.PI) / 180), 0];
    const at = (x: number, z: number): Vec3 => [along[0] * x, along[1] * x, z];
    return quad(
      [-Math.sin((turn * Math.PI) / 180), -Math.cos((turn * Math.PI) / 180), 0],
      [at(-40, 0), at(40, 0), at(40, 40), at(-40, 40)]
    );
  };
  const frontLitAtExposure = (exposure: number) => {
    const k = Math.sqrt((1 - exposure * exposure) / 2);
    return ViewFacts.make({ eye: front.eye, right: front.right, up: front.up, light: [-k, -exposure, k] });
  };
  const cutsOf = (face: FaceFacts, view: ViewFacts) =>
    O.getOrElse(
      O.map(linesOf(treatmentFor({ face, view, plan: gradedPlan })), (lines) =>
        A.map(lines.cuts, (cut) => [Math.round(cut.offset * 1e9) / 1e9, Math.round(cut.extent * 1e9) / 1e9] as const)
      ),
      () => A.empty()
    );
  const inkInChordLengths = (cuts: ReadonlyArray<readonly [number, number]>) =>
    A.reduce(cuts, 0, (sum, [, extent]) => sum + extent);

  it("bands a wall alike in any two default views that light it within 0.01 of each other", () => {
    // decision: faint-recipe-ramps-between-light-and-faint
    const box = BoundingBox.make({ min: [-40, -30, 0], max: [40, 30, 46] });
    const cameraSets = [
      {},
      { projection: "isometric" as const },
      { projection: "isometric" as const, azimuthDeg: O.some(90) },
      { projection: "two-point" as const },
      { projection: "two-point" as const, elevationDeg: O.some(30) },
      { projection: "isometric" as const, elevationDeg: O.some(20) },
    ];
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const uprightWall = (deg: number) => {
      const turn = (deg * Math.PI) / 180;
      const along: Vec3 = [-Math.sin(turn), Math.cos(turn), 0];
      const at = (x: number, z: number): Vec3 => [along[0] * x, along[1] * x, z];
      return quad([Math.cos(turn), Math.sin(turn), 0], [at(-200, 0), at(200, 0), at(200, 40), at(-200, 40)]);
    };
    const pairs = A.flatMap(cameraSets, (set) => {
      const views = A.map(ViewName.literals, (view) => viewFactsOf(cameraForView({ view, box, ...set })));
      return A.flatMap(
        A.makeBy(3600, (i) => i / 10),
        (deg) => {
          const face = uprightWall(deg);
          const banded = pipe(
            views,
            A.filter((view) => dot(face.normal, view.eye) > 1e-9),
            A.map((view) =>
              O.map(linesOf(treatmentFor({ face, view, plan: gradedPlan })), (lines) => ({
                exposure: dot(face.normal, view.light),
                extents: A.map(lines.cuts, (cut) => cut.extent),
                stepIntoWall: lines.step,
              }))
            ),
            A.getSomes
          );
          return A.flatMap(banded, (p, i) =>
            pipe(
              A.drop(banded, i + 1),
              A.filter((q) => Math.abs(p.exposure - q.exposure) < 0.01),
              A.map((q) => ({ deg, p, q }))
            )
          );
        }
      );
    });
    const ink = (extents: ReadonlyArray<number>) => A.reduce(extents, 0, (sum, extent) => sum + extent);
    expect(
      A.length(pairs),
      "upright walls turned 0.1° at a time through every default camera set do meet views that light a wall alike; each wall is 400 wide, so every view's band is held to its tone's line count, never to its span on the sheet"
    ).toBeGreaterThan(100);
    const unlike = A.filter(
      pairs,
      ({ p, q }) =>
        Math.abs(A.length(p.extents) - A.length(q.extents)) > 1 ||
        Math.abs(ink(p.extents) - ink(q.extents)) > 1 ||
        dot(p.stepIntoWall, q.stepIntoWall) <= 0
    );
    expect(
      A.map(unlike, ({ deg }) => deg),
      "the 1.84(m) light is each view's own, yet whenever two views facing a wall light it within 0.01 of each other, their bands differ by at most one stroke in line count and one chord length in ink and sit at the same model edge: no hard edge of a recipe, nor of the side anchorOf takes (including its switch to the sheet's lower right for a wall lit edge-on to its lines), may split them"
    ).toEqual([]);
  });

  it("turns the light recipe into the faint one between exposures 0.6 and 0.7", () => {
    expect(A.map([0.2, SQUARE_ON_EXPOSURE, 0.6, 0.7, TURNED_30_TOWARD_LIGHT_EXPOSURE, 1], faintShareOf)).toEqual([
      0, 0, 0, 1, 1, 1,
    ]);
    expect(faintShareOf(0.65)).toBeCloseTo(0.5, 12);
    const offsets = (tone: ShadingTone, faintShare?: number) =>
      gradedOffsets({
        span: 40,
        minPitch: 1,
        maxPitch: 2.5,
        tone,
        ...(faintShare === undefined ? {} : { faintShare }),
      });
    expect(offsets("faint", 0), "the ramp's ends are the light and faint recipes exactly").toEqual(offsets("light"));
    expect(offsets("faint", 1)).toEqual(offsets("faint"));
    expect(offsets("light", 0)).toEqual(offsets("light"));
    expect(A.map([0, 0.5, 1], (share) => offsets("faint", share).length)).toEqual([5, 4, 3]);
    expect(gradedExtents({ count: 5, faintShare: 0 })).toEqual(gradedExtents({ count: 5 }));
    expect(gradedExtents({ count: 4, faintShare: 1 })).toEqual(gradedExtents({ count: 4, fullLines: 0 }));
    expect(A.map(gradedExtents({ count: 4, faintShare: 0.5 }), (e) => Math.round(e * 100) / 100)).toEqual([
      0.8, 0.77, 0.53, 0.4,
    ]);
    expect(
      gradedExtents({ count: 3, fullLines: 0, faintShare: 0.3 }),
      "a band already cut back to the lit taper has no full-length line anywhere on the ramp"
    ).toEqual(A.map(gradedExtents({ count: 3, fullLines: 0 }), (e) => expect.closeTo(e, 12)));
  });

  it("keeps the light and faint bands at the ramp's ends and never drops a third of a band to a small change of exposure", () => {
    // decision: faint-recipe-ramps-between-light-and-faint
    const square = wide(0);
    const light = cutsOf(square, frontLitAtExposure(0.59));
    const faint = cutsOf(square, frontLitAtExposure(0.75));
    expect(
      A.map(light, ([, extent]) => extent),
      "under the light recipe the 80 × 40 wall's band is five lines"
    ).toEqual([1, 1, 0.6, 0.5, 0.4]);
    expect(
      A.map(faint, ([, extent]) => Math.round(extent * 100) / 100),
      "under the faint recipe the 80 × 40 wall's band is four lines"
    ).toEqual([0.6, 0.53, 0.47, 0.4]);
    expect(cutsOf(square, frontLitAtExposure(0.6))).toEqual(light);
    expect(cutsOf(square, frontLitAtExposure(0.7))).toEqual(faint);
    const exposures = A.makeBy(201, (i) => 0.55 + i * 0.001);
    const bands = A.map(exposures, (exposure) => cutsOf(square, frontLitAtExposure(exposure)));
    const pairs = A.zip(bands, A.drop(bands, 6));
    A.forEach(pairs, ([before, after]) => {
      expect(
        inkInChordLengths(before) - inkInChordLengths(after),
        "across the ramp the band thins step by step: no 0.006 rise of exposure takes more than one short stroke's ink"
      ).toBeLessThanOrEqual(0.6);
      expect(
        A.length(before) - A.length(after),
        "no 0.006 rise of exposure takes more than one line"
      ).toBeLessThanOrEqual(1);
    });
    A.forEach(A.zip(bands, A.drop(bands, 1)), ([before, after]) =>
      expect(
        inkInChordLengths(after),
        "the ink only ever falls as the face turns toward the light"
      ).toBeLessThanOrEqual(inkInChordLengths(before) + 1e-9)
    );
  });

  it("draws a wall turned 2.0° and 2.6° toward the light almost alike", () => {
    const turned = (deg: number) => {
      const face = wide(deg);
      const [nx, ny, nz] = face.normal;
      const [lx, ly, lz] = front.light;
      return { exposure: nx * lx + ny * ly + nz * lz, cuts: cutsOf(face, front) };
    };
    const nearer = turned(2);
    const further = turned(2.6);
    expect(
      nearer.exposure,
      "in the front view these turns put the wall at exposures either side of 0.6 (0.597 and 0.603)"
    ).toBeLessThan(0.6);
    expect(further.exposure).toBeGreaterThan(0.6);
    expect(A.length(further.cuts)).toBe(A.length(nearer.cuts));
    expect(inkInChordLengths(further.cuts)).toBeGreaterThan(0.95 * inkInChordLengths(nearer.cuts));
  });
});

describe("band gutter beside a ladder of outlines", () => {
  const stroke: Segment2 = [0, 0, 0, 30];
  const edge: Segment2 = [1.5, 0, 1.5, 30];
  const wallLines: ReadonlyArray<Segment2> = [
    [3.3, 0, 3.3, 30],
    [4.5, 0, 4.5, 30],
  ];
  const pitchBeside = (outlines: ReadonlyArray<Segment2>, line: Segment2 = stroke) =>
    O.map(ladderPitch({ stroke: line, edge, outlines, reach: 2.5, tolerance: 0.15 }), (p) => Math.round(p * 1e9) / 1e9);

  it("starts a band at its lead and keeps the band's rhythm after it", () => {
    const plain = gradedOffsets({ span: 30, minPitch: 1.5, maxPitch: 6, tone: "dark" });
    const led = gradedOffsets({ span: 30, minPitch: 1.5, maxPitch: 6, tone: "dark", lead: 3.15 });
    const rounded = (offsets: ReadonlyArray<number>) => A.map(offsets, (o) => Math.round(o * 1e9) / 1e9);
    expect(rounded(plain), "without a lead the first line sits one pitch in, then 1.4 pitches on, then 1.96").toEqual([
      1.5, 3.6, 6.54,
    ]);
    expect(
      rounded(led),
      "with a lead the first line sits at it and the next gap is still 1.4 pitches (2.1, not 1.5 x 1.4 squared)"
    ).toEqual([3.15, 5.25, 8.19]);
    expect(
      gradedOffsets({ span: 30, minPitch: 1.5, maxPitch: 6, tone: "dark", lead: 1.5 }),
      "a lead of one pitch changes nothing"
    ).toEqual(plain);
    expect(
      gradedOffsets({ span: 30, minPitch: 1.5, maxPitch: 6, tone: "dark", lead: 0.5 }),
      "a lead under one pitch changes nothing"
    ).toEqual(plain);
  });

  it("sets the gutter at 1.5 times the band's first gap or the spacing beyond its edge, whichever is wider", () => {
    expect(bandLead({ minPitch: 1.5, groupPitch: O.some(1.8) })).toBeCloseTo(3.15, 9);
    expect(bandLead({ minPitch: 1.5, groupPitch: O.some(2.4) })).toBeCloseTo(3.6, 9);
    expect(bandLead({ minPitch: 1.5, groupPitch: O.none() })).toBe(1.5);
  });

  it("plans a stretch's band from the window's lead", () => {
    const gradedPlan = plan({ style: "graded", axis: "surface-class" });
    const offsets = (window: ShadingWindow) =>
      O.map(linesOf(treatmentFor({ face: wall, view: front, plan: gradedPlan, window })), (l) =>
        A.map(A.take(l.cuts, 3), (c) => Math.round((c.offset - 12) * 1e9) / 1e9)
      );
    assertSome(offsets(ShadingWindow.make({ start: 12, span: 28 })), [1, 2.4, 4.36]);
    assertSome(offsets(ShadingWindow.make({ start: 12, span: 28, lead: O.some(2.1) })), [2.1, 3.5, 5.46]);
  });

  it("reads a ladder where drawn lines run beside the band's edge just beyond it", () => {
    assertSome(pitchBeside([edge, ...wallLines]), 1.8);
    const edgeInPiecesDrawnTwice: ReadonlyArray<Segment2> = [[1.5, 0, 1.5, 12], [1.5, 12, 1.5, 30], edge];
    const strokeRunningDown: Segment2 = [0, 30, 0, 0];
    const lineBeyondReach: Segment2 = [4.5, 0, 4.5, 30];
    const lineOnBandSide: Segment2 = [-1, 0, -1, 30];
    const edgeAlone = [edge];
    assertSome(pitchBeside([...edgeInPiecesDrawnTwice, ...wallLines]), 1.8);
    assertSome(pitchBeside([edge, ...wallLines], strokeRunningDown), 1.8);
    assertNone(pitchBeside([edge, lineBeyondReach]));
    assertNone(pitchBeside([edge, lineOnBandSide]));
    assertNone(pitchBeside(edgeAlone));
  });

  it("reads no ladder where the outline beyond the edge only steps out around a tabInEdgeGap", () => {
    const tabInEdgeGap: ReadonlyArray<Segment2> = [
      [1.5, 0, 1.5, 13],
      [1.5, 13, 3.3, 13],
      [3.3, 13, 3.3, 17],
      [3.3, 17, 1.5, 17],
      [1.5, 17, 1.5, 30],
    ];
    assertNone(pitchBeside(tabInEdgeGap));
    const wallBesideQuarterOfEdge: ReadonlyArray<Segment2> = [edge, [3.3, 0, 3.3, 7.5], [4.5, 0, 4.5, 7.5]];
    const wallBesideHalfOfStroke: ReadonlyArray<Segment2> = [edge, [3.3, 0, 3.3, 15], [4.5, 0, 4.5, 15]];
    assertNone(pitchBeside(wallBesideQuarterOfEdge));
    assertSome(pitchBeside(wallBesideHalfOfStroke), 1.8);
  });

  it("reads a band's edge as the nearest line on one side that runs beside half the stroke", () => {
    const covering = (side: number, outlines: ReadonlyArray<Segment2>) =>
      coveringOutlineDistance({ stroke, side, outlines, within: 3.5, tolerance: 0.15 });
    const rightOfUpwardStroke = -1;
    const leftOfUpwardStroke = 1;
    const shortTickNearerThanEdge: Segment2 = [0.8, 0, 0.8, 5];
    assertSome(
      covering(rightOfUpwardStroke, [shortTickNearerThanEdge, [1.5, 0, 1.5, 12], [1.5, 12, 1.5, 30], [-3, 0, -3, 30]]),
      1.5
    );
    assertSome(
      covering(leftOfUpwardStroke, [
        [1.5, 0, 1.5, 30],
        [-3, 0, -3, 30],
      ]),
      3
    );
    assertNone(
      covering(leftOfUpwardStroke, [
        [1.5, 0, 1.5, 30],
        [-4, 0, -4, 30],
      ])
    );
  });
});

describe("shadingBandLadderFindings", () => {
  const options = ValidationOptions.make({ expectedPages: O.none() });
  const bandEdgeAndWallLines: ReadonlyArray<Segment2> = [
    [1.5, 0, 1.5, 30],
    [3.3, 0, 3.3, 30],
    [4.5, 0, 4.5, 30],
  ];
  const vertical = (x: number): Segment2 => [x, 0, x, 30];
  const codes = (shadingMm: ReadonlyArray<Segment2>, outlineMm: ReadonlyArray<Segment2> = bandEdgeAndWallLines) =>
    A.map(shadingBandLadderFindings({ page: 4, shadingMm, outlineMm, options }), (f) => [f.code, f.page]);

  it("flags a band whose first stroke, edge, and the lines beyond it read as one ladder", () => {
    expect(
      codes([vertical(-5.04), vertical(-2.1), vertical(0)]),
      "a three-line band (gaps 2.1, then 2.94) whose first stroke sits 1.5 from the edge: under 1.4 x max(2.1, 1.8)"
    ).toEqual([["shading-band-ladder", O.some(4)]]);
    expect(
      codes([vertical(-6.27), vertical(-3.33), vertical(-1.23)]),
      "a gutter under 1.4 times is flagged however far it puts the stroke from its edge: 2.73 is past the lone-line offset (2.5 mm) and still under 2.94"
    ).toEqual([["shading-band-ladder", O.some(4)]]);
  });

  it("passes a band behind its gutter, an edge with nothing beyond it, and an edge that steps out around a tab", () => {
    expect(
      codes([vertical(-6.69), vertical(-3.75), vertical(-1.65)]),
      "the renderer's gutter: 3.15 from the edge, at least 1.4 x max(2.1, 1.8)"
    ).toEqual([]);
    expect(codes([vertical(-5.04), vertical(-2.1), vertical(0)], [vertical(1.5)])).toEqual([]);
    const tab: ReadonlyArray<Segment2> = [
      [1.5, 0, 1.5, 13],
      [1.5, 13, 3.3, 13],
      [3.3, 13, 3.3, 17],
      [3.3, 17, 1.5, 17],
      [1.5, 17, 1.5, 30],
    ];
    expect(codes([vertical(-5.04), vertical(-2.1), vertical(0)], tab)).toEqual([]);
  });

  it("reads only a band's shadow-edge stroke: never one with companions on both sides, nor the band's lit-side end", () => {
    expect(
      codes([vertical(-2.1), vertical(0), vertical(5.5)]),
      "a stroke with companions on both sides is inside a band, or between two"
    ).toEqual([]);
    const mirrored = A.map(bandEdgeAndWallLines, ([x1, y1, x2, y2]): Segment2 => [-6.54 - x1, y1, -6.54 - x2, y2]);
    expect(
      codes([vertical(0), vertical(-2.1), vertical(-5.04)], mirrored),
      "the lit-side end of a band, whose last gap (2.94) is wider than its neighbour's (2.1), is not read as an edge stroke, though the outlines beyond it would make a ladder"
    ).toEqual([]);
  });

  it("does not read a band of two strokes, whose shadow-edge end cannot be told from its lit-side end", () => {
    expect(
      codes([vertical(0), vertical(2.1)], [vertical(3.5), vertical(5.3)]),
      "a two-line band (0 and 2.1) with its lit side's outline 1.4 beyond the stroke at 2.1 and a line 1.8 beyond that reads as a ladder from that end, but the renderer's gutter moves only a band's shadow-side line, so a finding here could never be cleared"
    ).toEqual([]);
    expect(
      codes([vertical(-2.94), vertical(-0.84), vertical(2.1)], [vertical(3.5), vertical(5.3)]),
      "beside a three-line band's lit-side end the same lines pass too: that end's wider last gap (2.94) marks it"
    ).toEqual([]);
    expect(
      codes([vertical(-2.94), vertical(0), vertical(2.1)], [vertical(3.5), vertical(5.3)]),
      "a three-line band whose smallest gap is at that end has its shadow edge there, and is read"
    ).toEqual([["shading-band-ladder", O.some(4)]]);
  });
});

describe("room of a glimpsed stretch", () => {
  const gradedPlan = plan({ style: "graded", axis: "surface-class", minStroke: 1.5 });
  const needed = legibleStrokeLength(gradedPlan);
  const k = Math.SQRT1_2;
  const litWall = quad(
    [-k, -k, 0],
    [
      [20, -20, 0],
      [-20, 20, 0],
      [-20, 20, 20],
      [20, -20, 20],
    ]
  );
  const roomAt = (offset: number) => (2 * needed * offset) / 20;
  const pointedTipGlimpse = ShadingWindow.make({
    start: 0,
    span: 20,
    room: O.some(A.makeBy(21, (i) => ShadingRoom.make({ offset: i, length: roomAt(i) }))),
  });
  const cutsOf = (window: ShadingWindow) =>
    O.getOrElse(
      O.map(linesOf(treatmentFor({ face: litWall, view: front, plan: gradedPlan, window })), (l) => l.cuts),
      () => []
    );

  it("judges each band position by the room the stretch shows there, not by the face's whole chord", () => {
    expect(
      toneOf(-2 * k * front.light[0]),
      "a wall 40√2 wide facing the light from the front-left (exposure 0.82) is faint; hatched vertically, its step runs at 45° to the sheet, so a step of 1 shows 1/√2, and its lines lie in the picture plane (spread 1)"
    ).toBe("faint");
    const cuts = cutsOf(pointedTipGlimpse);
    expect(A.length(cuts), "there is a band of lines").toBeGreaterThanOrEqual(2);
    expect(
      A.every(cuts, (cut) => roomAt(cut.offset) >= needed),
      "every line sits where a whole chord of the glimpse keeps the legible length"
    ).toBe(true);
    const blind = cutsOf(ShadingWindow.make({ start: 0, span: 20 }));
    expect(
      O.map(A.head(blind), (cut) => Math.round(cut.offset * 1e9) / 1e9),
      "judged by the face's 20-tall chord, the band would start one pitch from the tip"
    ).toEqual(O.some(Math.round(1e9 / k) / 1e9));
    expect(
      O.exists(A.head(blind), (cut) => roomAt(cut.offset) < needed),
      "one pitch from the tip the glimpse shows nothing legible"
    ).toBe(true);
  });

  it("places a band its taper would empty on whole chords, keeping the taper on its lines", () => {
    expect(
      0.4 * roomAt(20),
      "even the stretch's tallest room, at its far end, gives the shorter faint-taper stroke (0.4 of a chord) only 0.8 of the legible length"
    ).toBeLessThan(needed);
    const cuts = cutsOf(pointedTipGlimpse);
    expect(
      A.length(cuts),
      "the faint taper draws 0.6 and 0.4 of a chord, so no position keeps a tapered second line legible, yet a band of two is placed"
    ).toBe(2);
    expect(
      A.every(cuts, (cut) => roomAt(cut.offset) >= needed && roomAt(cut.offset) * cut.extent < needed),
      "the band's place was chosen for whole chords: each line's whole chord there is legible and its tapered stroke is not, so the tapered recipe could not have kept it"
    ).toBe(true);
    expect(
      A.map(cuts, (cut) => cut.extent),
      "the lines keep the faint taper, for the engine to cut what shows back to"
    ).toEqual(gradedExtents({ count: 2, fullLines: 2, faintShare: 1 }));
  });

  it("tells a stretch with room for a band of two legible lines from one without", () => {
    const wallPlan = plan({ style: "graded", axis: "surface-class", minStroke: 1.5 });
    expect(
      stretchFitsBand({ face: wall, view: front, plan: wallPlan, window: ShadingWindow.make({ start: 0, span: 40 }) }),
      "the 40 × 20 wall in the front elevation has room everywhere"
    ).toBe(true);
    expect(
      stretchFitsBand({ face: wall, view: front, plan: wallPlan, window: ShadingWindow.make({ start: 0, span: 2 }) }),
      "the 40 × 20 wall has no room in a stretch 2 wide"
    ).toBe(false);
    const low = ShadingWindow.make({
      start: 0,
      span: 40,
      room: O.some(A.makeBy(41, (i) => ShadingRoom.make({ offset: i, length: needed - 0.5 }))),
    });
    expect(
      stretchFitsBand({ face: wall, view: front, plan: wallPlan, window: low }),
      "a measured room below the legible length everywhere has no room for a band"
    ).toBe(false);
    expect(
      stretchFitsBand({ face: litWall, view: front, plan: gradedPlan, window: pointedTipGlimpse }),
      "the lit wall's glimpse is legible over its far half, 10 along the step and about 7 on the sheet: room for a band"
    ).toBe(true);
    const sharp = ShadingWindow.make({
      start: 0,
      span: 20,
      room: O.some(A.makeBy(21, (i) => ShadingRoom.make({ offset: i, length: i >= 18 ? needed : 0 }))),
    });
    expect(
      stretchFitsBand({ face: litWall, view: front, plan: gradedPlan, window: sharp }),
      "legible over its last 2 along the step only, 1.4 on the sheet, the glimpse has no room for a band"
    ).toBe(false);
  });

  it.effect(
    "decodes a coverage recorded before stretches were counted",
    Effect.fnUntraced(function* () {
      const old = yield* S.decodeEffect(ShadingCoverage)({ shadedFaces: 2, skippedFaces: [], lostFaces: 0 });
      expect([old.skippedStretches, old.redrawnStretches]).toEqual([[], 0]);
      const skip = yield* S.decodeEffect(ShadingStretchSkip)({ reason: "narrow", stretches: 1 });
      expect(skip.fitting).toBe(0);
    })
  );
});

describe("shadingCoverageFindings", () => {
  it("flags a view whose faces planned lines and drew none, and nothing otherwise", () => {
    const lost = ShadingCoverage.make({ shadedFaces: 3, skippedFaces: [], lostFaces: 1 });
    expect(A.map(shadingCoverageFindings({ page: 2, coverage: lost }), (f) => [f.code, f.page])).toEqual([
      ["shading-lost-face", O.some(2)],
    ]);
    const stretch = ShadingCoverage.make({ shadedFaces: 3, skippedFaces: [], lostStretches: 2 });
    expect(
      A.map(shadingCoverageFindings({ page: 4, coverage: stretch }), (f) => [f.code, f.page]),
      "a face that kept another stretch is not lost, but the stretch that drew nothing is reported"
    ).toEqual([["shading-lost-stretch", O.some(4)]]);
    expect(
      shadingCoverageFindings({ page: 1, coverage: ShadingCoverage.make({ shadedFaces: 3, skippedFaces: [] }) })
    ).toEqual([]);
  });

  it("flags a stretch skipped by design only where its measured room fits a band", () => {
    const skipped = (fitting: number) =>
      ShadingCoverage.make({
        shadedFaces: 3,
        skippedFaces: [],
        skippedStretches: [
          ShadingStretchSkip.make({ reason: "narrow", stretches: 2, fitting }),
          ShadingStretchSkip.make({ reason: "no-room", stretches: 1 }),
        ],
      });
    expect(A.map(shadingCoverageFindings({ page: 2, coverage: skipped(1) }), (f) => [f.code, f.page])).toEqual([
      ["shading-skipped-stretch", O.some(2)],
    ]);
    expect(shadingCoverageFindings({ page: 2, coverage: skipped(0) })).toEqual([]);
  });
});

describe("shading strokes against the outline", () => {
  const options = ValidationOptions.make({ expectedPages: O.none() });
  const outlineMm: ReadonlyArray<Segment2> = [
    [0, 0, 40, 0],
    [40, 0, 40, 30],
    [40, 30, 0, 30],
    [0, 30, 0, 0],
  ];
  const codes = (findings: ReadonlyArray<{ readonly code: string }>) => A.map(findings, (f) => f.code);

  it("flags a stroke end or side within half a millimetre of an outline and passes inset strokes", () => {
    const clearance = (shadingMm: ReadonlyArray<Segment2>) =>
      codes(shadingOutlineClearanceFindings({ page: 1, shadingMm, outlineMm, options }));
    expect(clearance([[38.5, 1.5, 38.5, 28.5]])).toEqual([]);
    expect(clearance([[38.5, 0.2, 38.5, 28.5]])).toEqual(["shading-outline-clearance"]);
    expect(clearance([[39.7, 5, 39.7, 25]])).toEqual(["shading-outline-clearance"]);
  });

  it("flags a stroke that runs alone beside an outline and passes one with a companion", () => {
    const lone: ReadonlyArray<Segment2> = [[38.5, 1.5, 38.5, 28.5]];
    expect(codes(shadingLoneLineFindings({ page: 1, shadingMm: lone, outlineMm, options }))).toEqual([
      "shading-lone-line",
    ]);
    const pair: ReadonlyArray<Segment2> = [...lone, [36.4, 6, 36.4, 24]];
    expect(codes(shadingLoneLineFindings({ page: 1, shadingMm: pair, outlineMm, options }))).toEqual([]);
    expect(
      codes(shadingLoneLineFindings({ page: 1, shadingMm: [[20, 5, 20, 25]], outlineMm, options })),
      "a stroke far from every outline is not lone, however alone it is"
    ).toEqual([]);
  });
});

describe("reclippedShading", () => {
  const clip = (segments: ReadonlyArray<Segment2>, lines: ReadonlyArray<Segment2>) =>
    reclippedShading({ segments, bands: [], lines, clearance: 0.6, minStroke: 1 });
  const nearest = (strokes: ReadonlyArray<Segment2>, lines: ReadonlyArray<Segment2>) =>
    Math.min(
      ...A.flatMap(strokes, ([x1, y1, x2, y2]) => [
        nearestOutlineDistance({ x: x1, y: y1, outlines: lines }),
        nearestOutlineDistance({ x: x2, y: y2, outlines: lines }),
      ])
    );

  it("cuts strokes back to the clearance from a line moved toward their ends, and drops one left too short", () => {
    const moved: ReadonlyArray<Segment2> = [[0, 0.3, 10, 0.3]];
    const far: Segment2 = [5, 5, 5, 9];
    const result = clip([[2, 0.6, 2, 10], [4, 0.6, 4, 1.2], far], moved);
    expect(
      A.map(result.segments, (s) => A.map(s, (v) => Math.round(v * 1e6) / 1e6)),
      "strokes planned 0.6 clear of a line at y = 0, which then moved up 0.3: the long one is cut back, the short one dropped"
    ).toEqual([
      [2, 0.9, 2, 10],
      [5, 5, 5, 9],
    ]);
    expect(result.segments[1], "the third stroke is far from the moved line and comes back as it was").toBe(far);
    expect([result.trimmed, result.dropped, result.droppedAt]).toEqual([1, 1, [1]]);
    expect(nearest(result.segments, moved)).toBeGreaterThanOrEqual(0.6);
    const strokes: ReadonlyArray<Segment2> = [far];
    expect(clip(strokes, moved).segments, "nothing near a moved line: the input comes back as it was").toBe(strokes);
    expect(clip(strokes, []).segments).toBe(strokes);
  });

  it("cuts a stroke a moved line crosses, runs beside, or ends beside, keeping the long pieces", () => {
    const crossing = clip([[0, 0, 0, 10]], [[-3, 9.5, 3, 8.5]]);
    expect(
      A.length(crossing.segments),
      "an oblique line moved across a stroke's end: the piece beyond it is under the least stroke and goes"
    ).toBe(1);
    expect(nearest(crossing.segments, [[-3, 9.5, 3, 8.5]])).toBeGreaterThanOrEqual(0.6);
    expect(crossing.segments[0]?.[3]).toBeLessThan(9);
    const beside = clip([[0, 0, 20, 0]], [[8, 0.4, 12, 0.4]]);
    expect(
      A.length(beside.segments),
      "a parallel line moved within 0.4 of a stroke's middle stretch: the stroke keeps its ends beyond that stretch"
    ).toBe(2);
    expect(A.map(beside.segments, ([x1, , x2]) => [x1 < 8, x2 > 12])).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(nearest(beside.segments, [[8, 0.4, 12, 0.4]])).toBeGreaterThanOrEqual(0.6);
    const ending = clip([[0, 0, 20, 0]], [[10, 0.2, 10, 8]]);
    expect(
      A.map(ending.segments, (s) => A.map(s, (v) => Math.round(v * 1e6) / 1e6)),
      "a moved line ending 0.2 beside a stroke's middle cuts it in two, both pieces long enough to keep"
    ).toEqual([
      [0, 0, 9.434315, 0],
      [10.565685, 0, 20, 0],
    ]);
    expect([ending.trimmed, ending.dropped, ending.droppedAt]).toEqual([1, 0, []]);
  });

  it("empties a band the clip leaves with fewer than two strokes, and keeps a band left with two", () => {
    const moved: ReadonlyArray<Segment2> = [[0, 0.3, 10, 0.3]];
    const long = (x: number): Segment2 => [x, 0.6, x, 10];
    const short = (x: number): Segment2 => [x, 0.6, x, 1.2];
    const strokes: ReadonlyArray<Segment2> = [long(1), short(2), [3, 5, 3, 9], short(4), long(5), long(6), short(7)];
    const leftWithOneCutBack = ShadingBand.make({ face: 0, strokes: [0, 1] });
    const leftWithOneUntouched = ShadingBand.make({ face: 1, strokes: [2, 3] });
    const leftWithTwoCutBack = ShadingBand.make({ face: 2, strokes: [4, 5, 6] });
    const bands = [leftWithOneCutBack, leftWithOneUntouched, leftWithTwoCutBack];
    const result = reclippedShading({ segments: strokes, bands, lines: moved, clearance: 0.6, minStroke: 1 });
    expect(
      A.map(result.segments, ([x]) => x),
      "a line at y = 0 moved up 0.3 under the bands: a stroke running up to y = 10 is cut back and kept, one ending at y = 1.2 is cut under the least stroke and dropped, and the stroke at y = 5..9 stays clear"
    ).toEqual([5, 6]);
    expect([result.trimmed, result.dropped, result.droppedAt]).toEqual([2, 5, [0, 1, 2, 3, 6]]);
    const coverage = reclippedCoverage({
      coverage: ShadingCoverage.make({ shadedFaces: 3, skippedFaces: [] }),
      bands,
      dropped: result.droppedAt,
    });
    expect([coverage.lostFaces, coverage.lostStretches]).toEqual([2, 2]);
    const single = reclippedShading({
      segments: [long(1)],
      bands: [ShadingBand.make({ face: 0, strokes: [0] })],
      lines: moved,
      clearance: 0.6,
      minStroke: 1,
    });
    expect(
      [A.length(single.segments), single.trimmed, single.dropped],
      "a band the engine drew with one stroke keeps it when the clip only cuts it back"
    ).toEqual([1, 1, 0]);
  });
});

describe("reclippedCoverage", () => {
  const engineCoverage = ShadingCoverage.make({ shadedFaces: 3, skippedFaces: [], lostStretches: 1 });
  const bands = [
    ShadingBand.make({ face: 0, strokes: [0, 1] }),
    ShadingBand.make({ face: 0, strokes: [2, 3] }),
    ShadingBand.make({ face: 1, strokes: [4, 5] }),
    ShadingBand.make({ face: 2, strokes: [6, 7] }),
  ];
  const lost = (dropped: ReadonlyArray<number>) => {
    const coverage = reclippedCoverage({ coverage: engineCoverage, bands, dropped });
    return [coverage.lostFaces, coverage.lostStretches];
  };

  it("keeps the engine's coverage while every band keeps a stroke", () => {
    expect(reclippedCoverage({ coverage: engineCoverage, bands, dropped: [] })).toBe(engineCoverage);
    expect(reclippedCoverage({ coverage: engineCoverage, bands, dropped: [0, 3, 5, 6] })).toBe(engineCoverage);
  });

  it("counts a band the re-clip empties as a lost stretch, and its face lost only when no band of it draws", () => {
    expect(lost([0, 1]), "face 0 keeps its second band: one more lost stretch, no lost face").toEqual([0, 2]);
    expect(lost([0, 1, 2, 3]), "both bands of face 0 emptied: a lost face and two lost stretches").toEqual([1, 3]);
    expect(lost([1, 4, 5, 6, 7]), "faces 1 and 2 emptied, face 0 trimmed: two lost faces").toEqual([2, 3]);
  });

  it("attributes no drop without bands", () => {
    expect(reclippedCoverage({ coverage: engineCoverage, bands: [], dropped: [0, 1] })).toBe(engineCoverage);
  });
});

describe("shadingSpacingFindings", () => {
  const options = ValidationOptions.make({ expectedPages: O.none() });
  const codes = (segmentsMm: ReadonlyArray<readonly [number, number, number, number]>) =>
    A.map(shadingSpacingFindings({ page: 2, segmentsMm, options }), (f) => [f.code, f.page]);

  it("flags side-by-side lines closer than 0.5 mm", () => {
    expect(
      codes([
        [0, 0, 10, 0],
        [0, 0.3, 10, 0.3],
      ])
    ).toEqual([["shading-spacing", O.some(2)]]);
  });

  it("passes lines at the minimum, collinear pieces, crossings, and end-to-end runs", () => {
    expect(
      codes([
        [0, 0, 10, 0],
        [0, 0.6, 10, 0.6],
        [10.2, 0, 20, 0],
        [5, -5, 5, 5],
        [0, 1.2, 4, 1.2],
        [4.2, 1.4, 9, 1.4],
      ])
    ).toEqual([]);
    assertNone(O.fromNullishOr(shadingSpacingFindings({ page: 1, segmentsMm: [], options })[0]));
  });
});
