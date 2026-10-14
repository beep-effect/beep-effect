/**
 * Private procedural straight-line shading: read each face's facts from the
 * kernel, let the pure 37 CFR 1.84(m) rules of `@beep/technical-drawing`
 * decide its treatment, and cut the face along the section planes they
 * return. The hatch edges lie on the model's own faces, so the caller
 * projects them through the same hidden-line removal as the outlines. Graded
 * faces are first crossed by probes, so the caller can read which stretches
 * of each face show in the view and have every stretch shaded at its own
 * shadow side.
 *
 * @internal
 */

import {
  BoundingBox,
  coverageOf,
  FaceEdge,
  FaceFacts,
  FaceTreatment,
  ShadingProbe,
  ShadingSkipped,
  treatmentFor,
  viewFactsOf,
} from "@beep/technical-drawing";
import { A, O } from "@beep/utils";
import { constant, pipe } from "effect/Function";
import * as replicad from "replicad";
import { add, cross, scale } from "./vector.ts";
import type { ShadingCoverage, ShadingLines, ShadingWindow, ViewFacts } from "@beep/technical-drawing";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import type { Camera, ShadingPlan } from "../Occt.models.ts";
import type { V3 } from "./vector.ts";

const vec = (v: replicad.Vector): V3 => [v.x, v.y, v.z];
const dotV = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const minusV = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const unitV = (v: V3): V3 => {
  const length = Math.hypot(v[0], v[1], v[2]);
  return length < 1e-12 ? v : [v[0] / length, v[1] / length, v[2] / length];
};

// Curved boundary edges are sampled this many times for the face's outline.
const OUTLINE_SAMPLES = 8;

const isLine = (edge: replicad.Edge): boolean => edge.geomType === "LINE";

const outlineOf = (edge: replicad.Edge): ReadonlyArray<V3> =>
  isLine(edge)
    ? [vec(edge.startPoint), vec(edge.endPoint)]
    : A.makeBy(OUTLINE_SAMPLES + 1, (i) => vec(edge.pointAt(i / OUTLINE_SAMPLES)));

// `normalAt` projects the face centre onto the surface, which is exact for
// the planar faces this is called on.
const factsOf = (face: replicad.Face): FaceFacts => {
  const edges = face.edges;
  const [min, max] = face.boundingBox.bounds;
  return FaceFacts.make({
    normal: vec(face.normalAt(face.center)),
    center: vec(face.center),
    edges: pipe(
      edges,
      A.filter(isLine),
      A.map((edge) => FaceEdge.make({ start: vec(edge.startPoint), end: vec(edge.endPoint), length: edge.length }))
    ),
    outline: A.flatMap(edges, outlineOf),
    bounds: BoundingBox.make({ min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] }),
  });
};

const sectionEdges = (oc: OpenCascadeInstance, face: replicad.Face, point: V3, normal: V3) => {
  const plane = new oc.gp_Pln(
    new oc.gp_Pnt(point[0], point[1], point[2]),
    new oc.gp_Dir(normal[0], normal[1], normal[2])
  );
  const section = new oc.BRepAlgoAPI_Section(face.wrapped, plane, true);
  const explorer = new oc.TopExp_Explorer(
    section.Shape(),
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  const edges = A.empty<replicad.Edge>();
  for (; explorer.More(); explorer.Next()) {
    edges.push(replicad.cast(explorer.Current()) as replicad.Edge);
  }
  return edges;
};

// Chords shorter than the plan's minimum on the view plane are dropped: near a
// pointed corner the graded strokes would otherwise read as a dot ladder.
const longEnough =
  (view: ViewFacts, minStroke: number) =>
  (edge: replicad.Edge): boolean => {
    if (minStroke <= 0) {
      return true;
    }
    const [sx, sy, sz] = vec(edge.startPoint);
    const [ex, ey, ez] = vec(edge.endPoint);
    const length = edge.length;
    const along = ((ex - sx) * view.eye[0] + (ey - sy) * view.eye[1] + (ez - sz) * view.eye[2]) / length;
    return length > 0 && length * Math.sqrt(Math.max(0, 1 - along * along)) >= minStroke;
  };

// Shorter than this (model units) a trimmed stroke is not made at all: the
// kernel refuses an edge between coincident points, and nothing that short
// survives the minimum-stroke filter anyway.
const SHORTEST_STROKE = 1e-6;

// A stroke shorter than its chord (the graded taper) is centred on the part
// of the chord that shows (`focus`: the lowest and highest position along
// the lines at which the face's stretch was seen), or on the chord itself;
// the stroke's ends are drawn back from the outline after hidden-line removal.
const trimTo =
  (extent: number, focus: O.Option<readonly [number, number]>, along: V3) =>
  (edge: replicad.Edge): O.Option<replicad.Edge> => {
    if (extent >= 1) {
      return O.some(edge);
    }
    if (edge.length * extent < SHORTEST_STROKE) {
      return O.none();
    }
    const h0 = dotV(vec(edge.startPoint), along);
    const h1 = dotV(vec(edge.endPoint), along);
    const centre = O.match(focus, {
      onNone: constant(0.5),
      onSome: ([low, high]) => {
        const lo = Math.min(h0, h1);
        const hi = Math.max(h0, h1);
        const seenLow = Math.max(lo, low);
        const seenHigh = Math.min(hi, high);
        return hi - lo < 1e-9 || seenLow > seenHigh ? 0.5 : ((seenLow + seenHigh) / 2 - h0) / (h1 - h0);
      },
    });
    const start = Math.max(0, Math.min(1 - extent, centre - extent / 2));
    return O.some(replicad.makeLine(edge.pointAt(start), edge.pointAt(start + extent)));
  };

// Graded strokes and probes are lifted this far off their face along its
// outward normal (model units; a thousandth of a millimetre on the sheet) so
// the hidden-line pass sees them in front of the face they lie on instead of
// deciding by rounding whether a re-made stroke is behind it. The uniform
// style keeps its legacy placement.
const HATCH_LIFT = 1e-3;

const liftFor =
  (face: replicad.Face, plan: ShadingPlan) =>
  (edge: replicad.Edge): replicad.Edge => {
    if (plan.style !== "graded") {
      return edge;
    }
    const [nx, ny, nz] = vec(face.normalAt(face.center));
    return edge.translate(nx * HATCH_LIFT, ny * HATCH_LIFT, nz * HATCH_LIFT);
  };

// Planar faces only: curved faces are counted, never hatched.
const isPlanar = (face: replicad.Face): boolean => face.geomType === "PLANE";

// Probes cross a graded face at this many heights, evenly spread between its
// lowest and highest point along its lines.
const PROBE_HEIGHTS = 5;

// Lowest and highest reach of a face's outline along a unit direction.
const reachOf = (face: FaceFacts, along: V3): readonly [number, number] =>
  pipe(
    face.outline,
    A.map((p) => dotV(p, along)),
    (reaches) => [Math.min(...reaches), Math.max(...reaches)] as const
  );

type Probe = { readonly edge: replicad.Edge; readonly probe: ShadingProbe };

// Probe lines across one graded face: at each height, the face's chord(s)
// along its shading step, lifted off the face like its strokes and tagged
// with the offsets of their ends from the face's shadow anchor.
const probeFace =
  (oc: OpenCascadeInstance, view: ViewFacts, plan: ShadingPlan) =>
  (face: replicad.Face, index: number): ReadonlyArray<Probe> => {
    if (!isPlanar(face)) {
      return A.empty();
    }
    const facts = factsOf(face);
    return FaceTreatment.match(treatmentFor({ face: facts, view, plan }), {
      skipped: () => A.empty<Probe>(),
      lines: (lines) => {
        const direction = unitV(cross(facts.normal, lines.step));
        const [low, high] = reachOf(facts, direction);
        const offsetOf = (p: V3): number => dotV(minusV(p, lines.origin), lines.step);
        const reach = (high - low) / (2 * PROBE_HEIGHTS);
        return pipe(
          A.makeBy(PROBE_HEIGHTS, (i) => low + ((high - low) * (i + 0.5)) / PROBE_HEIGHTS),
          A.flatMap((height) =>
            A.map(sectionEdges(oc, face, scale(direction, height), direction), (edge) => ({ edge, height }))
          ),
          A.map(({ edge, height }, rank) => {
            // the ends are read before the lift: translating a replicad edge frees the original
            const from = vec(edge.startPoint);
            const to = vec(edge.endPoint);
            return {
              edge: liftFor(face, plan)(edge),
              probe: ShadingProbe.make({
                face: index,
                rank,
                from,
                to,
                start: offsetOf(from),
                end: offsetOf(to),
                height,
                reach,
              }),
            };
          })
        );
      },
    });
  };

/**
 * Probe lines across every graded face of a shape, each with its record, for
 * the hidden-line pass to read each face's visible stretches from. The
 * probes go through that pass as separate shapes, so each one's visible
 * pieces come back on their own.
 *
 * @internal
 */
export const probeEdges = (options: {
  readonly oc: OpenCascadeInstance;
  readonly shape: replicad.AnyShape;
  readonly camera: Camera;
  readonly plan: ShadingPlan;
}): ReadonlyArray<{ readonly edge: replicad.Edge; readonly probe: ShadingProbe }> =>
  A.flatMap(options.shape.faces, probeFace(options.oc, viewFactsOf(options.camera), options.plan));

// The strokes of one treatment on its face: each cut's chord, trimmed to the
// cut's extent, kept when long enough on the view plane, lifted off the face.
const strokesOf =
  (oc: OpenCascadeInstance, view: ViewFacts, plan: ShadingPlan, face: replicad.Face, facts: FaceFacts) =>
  (lines: ShadingLines, focus: O.Option<readonly [number, number]>): ReadonlyArray<replicad.Edge> =>
    A.flatMap(lines.cuts, (cut) =>
      pipe(
        sectionEdges(oc, face, add(lines.origin, scale(lines.step, cut.offset)), lines.step),
        A.map(trimTo(cut.extent, focus, unitV(cross(facts.normal, lines.step)))),
        A.getSomes,
        A.filter(longEnough(view, plan.minStroke)),
        A.map(liftFor(face, plan))
      )
    );

// Shading of one face: its treatment and the strokes of each of its planned
// stretches. With the face's visible stretches known (graded shading after
// the probe pass), every stretch is treated on its own: the face counts as
// shaded when any stretch gets lines, as hidden when no stretch shows, and as
// a sliver when each is too narrow.
const shadeFace =
  (
    oc: OpenCascadeInstance,
    view: ViewFacts,
    plan: ShadingPlan,
    regions: O.Option<(face: number) => ReadonlyArray<ShadingWindow>>
  ) =>
  (
    face: replicad.Face,
    index: number
  ): { readonly treatment: FaceTreatment; readonly strokes: ReadonlyArray<ReadonlyArray<replicad.Edge>> } => {
    if (!isPlanar(face)) {
      return { treatment: ShadingSkipped.make({ reason: "curved" }), strokes: A.empty() };
    }
    const facts = factsOf(face);
    const whole = treatmentFor({ face: facts, view, plan });
    type Planned = { readonly treatment: FaceTreatment; readonly focus: O.Option<readonly [number, number]> };
    const planned: A.NonEmptyReadonlyArray<Planned> = pipe(
      regions,
      O.filter(() => FaceTreatment.guards.lines(whole)),
      O.match({
        onNone: () => A.of<Planned>({ treatment: whole, focus: O.none() }),
        onSome: (windows) =>
          pipe(
            windows(index),
            A.map(
              (window): Planned => ({
                treatment: treatmentFor({ face: facts, view, plan, window }),
                focus: O.flatMap(window.low, (low) => O.map(window.high, (high) => [low, high] as const)),
              })
            ),
            (stretches) =>
              A.isReadonlyArrayNonEmpty(stretches)
                ? stretches
                : A.of<Planned>({ treatment: ShadingSkipped.make({ reason: "hidden" }), focus: O.none() })
          ),
      })
    );
    const strokes = strokesOf(oc, view, plan, face, facts);
    return {
      treatment: pipe(
        A.findFirst(planned, (p) => FaceTreatment.guards.lines(p.treatment)),
        O.map((p) => p.treatment),
        O.getOrElse(() => A.headNonEmpty(planned).treatment)
      ),
      // one stroke set per planned stretch, so the hidden-line pass reports each stretch on its own
      strokes: pipe(
        planned,
        A.map((p) => (p.treatment.kind === "lines" ? strokes(p.treatment, p.focus) : A.empty<replicad.Edge>())),
        A.filter(A.isReadonlyArrayNonEmpty)
      ),
    };
  };

/**
 * Shading of every face of a shape: each face's treatment and, when it got
 * lines, one compound of strokes per planned stretch (so the hidden-line
 * pass can report each stretch's visible strokes separately), plus the
 * view's coverage counts. With `regions` (graded shading after the probe
 * pass), each face's visible stretches are shaded one by one.
 *
 * **Details**
 *
 * TODO(design-figure-review-loop, PR #1648): once `Part.lineStyle` lands,
 * faces of `broken` parts are skipped with reason `broken-part` before the
 * rules run; this needs the per-part solids, not only the fused compound.
 *
 * @internal
 */
export const hatchCompound = (options: {
  readonly oc: OpenCascadeInstance;
  readonly shape: replicad.AnyShape;
  readonly camera: Camera;
  readonly plan: ShadingPlan;
  readonly regions: O.Option<(face: number) => ReadonlyArray<ShadingWindow>>;
}): {
  readonly faces: ReadonlyArray<{
    readonly treatment: FaceTreatment;
    readonly stretches: ReadonlyArray<replicad.AnyShape>;
  }>;
  readonly coverage: ShadingCoverage;
} => {
  const shaded = A.map(
    options.shape.faces,
    shadeFace(options.oc, viewFactsOf(options.camera), options.plan, options.regions)
  );
  return {
    faces: A.map(shaded, (face) => ({
      treatment: face.treatment,
      stretches: A.map(face.strokes, (edges) => replicad.makeCompound([...edges])),
    })),
    coverage: coverageOf(A.map(shaded, (face) => face.treatment)),
  };
};
