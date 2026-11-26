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
  BandEdge,
  BandInk,
  BoundingBox,
  bandLead,
  FaceEdge,
  FaceFacts,
  FaceTreatment,
  inkTwins,
  legibleStrokeLength,
  ShadingLines,
  ShadingProbe,
  ShadingSkipped,
  ShadingWindow,
  settleBandTapers,
  stretchFitsBand,
  treatmentFor,
  viewFactsOf,
} from "@beep/technical-drawing";
import { A, O } from "@beep/utils";
import { constant, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as replicad from "replicad";
import { add, cross, scale } from "./vector.ts";
import type { BandTaper, ShadingRoom, ShadingStretchSkipReason, ViewFacts } from "@beep/technical-drawing";
import type { LazyArg } from "effect/Function";
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

/**
 * Length of a planned stroke on the view plane, from its two ends in model
 * coordinates, under the camera's own projection (perspective included). The
 * kernel supplies it, so the stroke pass and the kernel judge a stretch's
 * room by the same measure.
 *
 * @internal
 */
export type ViewedLength = (stroke: readonly [V3, V3]) => number;

// A band is at least two strokes: one line beside an outline reads as a doubled edge, never as shading.
const BAND_STROKES = 2;

/**
 * Whether a planned stretch has room for a band: at least two of its planned
 * strokes reach the plan's legible stroke length on the view plane. The
 * kernel leaves a stretch without room bare as a sliver, and the stroke pass
 * asks the same question before it hands a tapered band over.
 *
 * @internal
 */
export const hasBandRoom = (options: {
  readonly plan: ShadingPlan;
  readonly viewedLength: ViewedLength;
  readonly planned: ReadonlyArray<readonly [V3, V3]>;
}): boolean =>
  A.length(A.filter(options.planned, (stroke) => options.viewedLength(stroke) >= legibleStrokeLength(options.plan))) >=
  BAND_STROKES;

const endsOf = (edge: replicad.Edge): readonly [V3, V3] => [vec(edge.startPoint), vec(edge.endPoint)];

/**
 * The kernel's reading beside a band's first line (a `BandEdge` of
 * `@beep/technical-drawing`), on the view plane: the spacing from the band's
 * edge to the nearest drawn line within the plan's ladder reach that runs
 * alongside the edge beyond the band (`ladderPitch` of
 * `@beep/technical-drawing`), or none. The band is then planned behind the
 * gutter `bandLead` gives for that spacing.
 *
 * @internal
 */
export type GroupBeyond = (band: BandEdge) => O.Option<number>;

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

// The lines the rules plan on a planar face not drawn in broken lines, with the face's facts: none for any other
// face, or for one the rules skip.
const plannedLinesOf = (
  face: replicad.Face,
  view: ViewFacts,
  plan: ShadingPlan,
  isBrokenFace: (face: replicad.Face) => boolean
): O.Option<{ readonly facts: FaceFacts; readonly lines: ShadingLines }> => {
  if (isBrokenFace(face) || !isPlanar(face)) {
    return O.none();
  }
  const facts = factsOf(face);
  return O.map(O.liftPredicate(treatmentFor({ face: facts, view, plan }), FaceTreatment.guards.lines), (lines) => ({
    facts,
    lines,
  }));
};

// Probes cross a graded face at this many heights, evenly spread between its
// lowest and highest point along its lines.
// Nine probes per face: a band planned for one visible area is clipped to the
// cells of the probes that saw it, so a band can run on past that area by at
// most half a cell (a ninth of the face's extent along the lines) before the
// hidden-line pass can stop it.
const PROBE_HEIGHTS = 9;

type ProbeRow = { readonly height: number; readonly reach: number };

// The rows a face is probed at, each with the half-height of the cell it stands for: the nine interior rows and, where
// their cells are more than two pitches tall, an edge row a pitch inside each end of the face's reach, standing for a
// cell a pitch to either side. A stretch glimpsed at a face's free edge under a part in front (a far face seen at its
// foot below a crossing wall) is then measured near its base, where it is widest, not only where an interior row
// happens to cross it (review loop 4, A-01). Denser rows at every pitch in the end cells cost bands elsewhere.
const probeRows = (low: number, high: number, minPitch: number): ReadonlyArray<ProbeRow> => {
  const reach = (high - low) / (2 * PROBE_HEIGHTS);
  const interior = A.makeBy(
    PROBE_HEIGHTS,
    (i): ProbeRow => ({
      height: low + ((high - low) * (i + 0.5)) / PROBE_HEIGHTS,
      reach,
    })
  );
  return minPitch < reach
    ? [...interior, { height: low + minPitch, reach: minPitch }, { height: high - minPitch, reach: minPitch }]
    : interior;
};

// Lowest and highest reach of a face's outline along a unit direction.
const reachOf = (face: FaceFacts, along: V3): readonly [number, number] =>
  pipe(
    face.outline,
    A.map((p) => dotV(p, along)),
    (reaches) => [Math.min(...reaches), Math.max(...reaches)] as const
  );

type Probe = { readonly shape: replicad.AnyShape; readonly probe: ShadingProbe };

// A probe goes through the hidden-line pass as a chain of short pieces in one compound: a long chord that starts
// inside a part standing on the face (a wall behind a fin) is misread by the pass along its whole length, while each
// short piece is read on its own (review loop 2, K-01). The kernel joins the visible pieces that touch.
const PROBE_PIECE_PITCHES = 4;

const chopped = (edge: replicad.Edge, length: number): replicad.AnyShape => {
  const a = vec(edge.startPoint);
  const b = vec(edge.endPoint);
  const along = minusV(b, a);
  const count = Math.max(1, Math.ceil(Math.hypot(along[0], along[1], along[2]) / length));
  const at = (i: number): V3 => add(a, scale(along, i / count));
  return replicad.makeCompound(A.makeBy(count, (i) => replicad.makeLine([...at(i)], [...at(i + 1)])));
};

// Probe lines across one graded face: at each height, the face's chord(s)
// along its shading step, lifted off the face like its strokes and tagged
// with the offsets of their ends from the face's shadow anchor.
const probeFace =
  (oc: OpenCascadeInstance, view: ViewFacts, plan: ShadingPlan, isBrokenFace: (face: replicad.Face) => boolean) =>
  (face: replicad.Face, index: number): ReadonlyArray<Probe> =>
    O.match(plannedLinesOf(face, view, plan, isBrokenFace), {
      onNone: A.empty<Probe>,
      onSome: ({ facts, lines }) => {
        const direction = unitV(cross(facts.normal, lines.step));
        const [low, high] = reachOf(facts, direction);
        const offsetOf = (p: V3): number => dotV(minusV(p, lines.origin), lines.step);
        return pipe(
          probeRows(low, high, plan.minPitch),
          A.flatMap(({ height, reach }) =>
            A.map(sectionEdges(oc, face, scale(direction, height), direction), (edge) => ({ edge, height, reach }))
          ),
          A.map(({ edge, height, reach }, rank) => {
            // the ends are read before the lift: translating a replicad edge frees the original
            const from = vec(edge.startPoint);
            const to = vec(edge.endPoint);
            return {
              shape: chopped(liftFor(face, plan)(edge), PROBE_PIECE_PITCHES * plan.minPitch),
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

/**
 * Probe lines across every graded face of a shape, each with its record, for
 * the hidden-line pass to read each face's visible stretches from: nine rows
 * spread over the face's reach along its lines and, where their cells are
 * more than two pitches tall, a row a pitch inside each end of that reach.
 * The probes go through that pass as separate shapes, so each one's visible
 * pieces come back on their own. Faces drawn in broken lines are never
 * probed.
 *
 * @internal
 */
export const probeEdges = (options: {
  readonly oc: OpenCascadeInstance;
  readonly shape: replicad.AnyShape;
  readonly camera: Camera;
  readonly plan: ShadingPlan;
  readonly isBrokenFace: (face: replicad.Face) => boolean;
}): ReadonlyArray<Probe> =>
  A.flatMap(
    options.shape.faces,
    probeFace(options.oc, viewFactsOf(options.camera), options.plan, options.isBrokenFace)
  );

// A chord clipped to the stretch's range along the lines (the cells of the
// probes that saw the stretch): a band planned for one visible area of a
// face must not run on into another area at the same offsets, and the
// hidden-line pass only splits a stroke where something stands in front of it.
const clipTo =
  (focus: O.Option<readonly [number, number]>, along: V3) =>
  (edge: replicad.Edge): O.Option<replicad.Edge> =>
    O.match(focus, {
      onNone: () => O.some(edge),
      onSome: ([low, high]) => {
        const h0 = dotV(vec(edge.startPoint), along);
        const h1 = dotV(vec(edge.endPoint), along);
        if (Math.abs(h1 - h0) < 1e-9) {
          return O.some(edge);
        }
        const lo = Math.max(Math.min(h0, h1), low);
        const hi = Math.min(Math.max(h0, h1), high);
        if (hi - lo < SHORTEST_STROKE) {
          return O.none();
        }
        const t = (h: number) => (h - h0) / (h1 - h0);
        const [t0, t1] = h0 < h1 ? [t(lo), t(hi)] : [t(hi), t(lo)];
        return O.some(replicad.makeLine(edge.pointAt(t0), edge.pointAt(t1)));
      },
    });

// `A.reduce` hands the reducer the index as a third argument, which a
// variadic `Math.min` would take as a value.
const leastOf = (values: ReadonlyArray<number>) =>
  A.reduce(values, Number.POSITIVE_INFINITY, (acc, value) => Math.min(acc, value));
const mostOf = (values: ReadonlyArray<number>) =>
  A.reduce(values, Number.NEGATIVE_INFINITY, (acc, value) => Math.max(acc, value));

// One planned stroke of a band: its edge, the drawn fraction of its chord its line was planned (1 for a full chord,
// whether or not the stroke is drawn tapered), and its line's rank in the band, nearest the shadow edge first.
type Stroke = { readonly edge: replicad.Edge; readonly extent: number; readonly rank: number };

const edgesOf = (strokes: ReadonlyArray<Stroke>): ReadonlyArray<replicad.Edge> => A.map(strokes, (s) => s.edge);

// The strokes of one treatment on its face: each cut's chord, drawn once per
// run of neighbouring rows that saw the area at the cut's offset and clipped
// to those rows' cells, trimmed to the cut's extent (`tapered`; otherwise
// every clipped chord is drawn whole), cut back to the face's claimed part
// (`claimed`, on a face merged across a solid and a broken primitive), kept
// when long enough on the view plane, lifted off the face. A stretch planned
// over the whole face (no pieces) draws every chord whole. Each call cuts its
// own sections: lifting a stroke frees the edge it was made from.
const strokesOf =
  <P>(
    oc: OpenCascadeInstance,
    view: ViewFacts,
    plan: ShadingPlan,
    face: replicad.Face,
    facts: FaceFacts,
    claimed: O.Option<(edge: replicad.Edge) => ReadonlyArray<replicad.Edge>>
  ) =>
  (lines: ShadingLines, pieces: ReadonlyArray<StretchPiece<P>>, tapered: boolean): ReadonlyArray<Stroke> => {
    const along = unitV(cross(facts.normal, lines.step));
    const runsAt = (offset: number): ReadonlyArray<O.Option<readonly [number, number]>> =>
      A.isReadonlyArrayNonEmpty(pieces)
        ? pipe(
            pieces,
            A.filter((piece) => piece.from - plan.minPitch <= offset && offset <= piece.to + plan.minPitch),
            A.sort(Order.mapInput(Order.Number, (piece: StretchPiece<P>) => piece.row)),
            A.reduce(A.empty<A.NonEmptyReadonlyArray<StretchPiece<P>>>(), (runs, piece) =>
              O.match(A.last(runs), {
                onNone: () => [A.of(piece)],
                onSome: (run) =>
                  piece.row - A.lastNonEmpty(run).row <= 1
                    ? [...A.dropRight(runs, 1), A.append(run, piece)]
                    : [...runs, A.of(piece)],
              })
            ),
            A.map((run) =>
              O.some([leastOf(A.map(run, (piece) => piece.low)), mostOf(A.map(run, (piece) => piece.high))] as const)
            )
          )
        : [O.none()];
    return A.flatMap(lines.cuts, (cut, rank) =>
      A.flatMap(runsAt(cut.offset), (focus) =>
        pipe(
          sectionEdges(oc, face, add(lines.origin, scale(lines.step, cut.offset)), lines.step),
          A.map(clipTo(focus, along)),
          A.getSomes,
          A.map(trimTo(tapered ? cut.extent : 1, focus, along)),
          A.getSomes,
          A.flatMap((edge) => O.match(claimed, { onNone: () => [edge], onSome: (claim) => claim(edge) })),
          A.filter(longEnough(view, plan.minStroke)),
          A.map((edge): Stroke => ({ edge: liftFor(face, plan)(edge), extent: cut.extent, rank }))
        )
      )
    );
  };

/**
 * A visible piece of a face along its shading step, read by one probe of the
 * hidden-line pass: its offsets from the face's shadow anchor, the probe's
 * range along the lines, whether the piece starts at the face's own outline
 * rather than behind a part in front of the face, and the probe (as the
 * kernel describes it) that saw it, so the kernel can keep the piece's strokes
 * to what that probe crossed.
 *
 * @internal
 */
export type StretchPiece<P> = {
  /** Index of the probe's height among the face's probe heights, lowest first. */
  readonly row: number;
  readonly from: number;
  readonly to: number;
  readonly low: number;
  readonly high: number;
  readonly probes: ReadonlyArray<P>;
};

// The strokes of one planned stretch, the probes that saw it (none for a
// stretch planned over the whole face), whether they are a tapered band's
// whole clipped chords (drawn so because the taper alone left no room), for a
// band drawn tapered the same band's strokes as whole clipped chords, and
// whether the stretch's measured room fits a band (for a stretch the kernel
// may find without room for one).
type StrokeSet<P> = {
  readonly strokes: ReadonlyArray<Stroke>;
  readonly probes: ReadonlyArray<P>;
  readonly whole: boolean;
  readonly untapered: O.Option<LazyArg<ReadonlyArray<Stroke>>>;
  readonly fits: boolean;
};

// A visible stretch of a face given shading lines that hands no strokes over to the kernel: why, and whether its
// measured room fits a band all the same (`stretchFitsBand`).
type SkippedStretch = { readonly reason: ShadingStretchSkipReason; readonly fits: boolean };

// One face shaded under one band taper: its treatment, the strokes of each planned stretch, the visible stretches that
// hand no strokes over, its exposure to the light and visible area on the view plane, and, when the face is banded
// under a graded plan, its planned ink for the neighbour ink order.
type Shaded<P> = {
  readonly treatment: FaceTreatment;
  readonly strokes: ReadonlyArray<StrokeSet<P>>;
  readonly skipped: ReadonlyArray<SkippedStretch>;
  readonly exposure: number;
  readonly seen: number;
  readonly ink: O.Option<BandInk>;
};

const bare = <P>(treatment: FaceTreatment): Shaded<P> => ({
  treatment,
  strokes: A.empty(),
  skipped: A.empty(),
  exposure: 0,
  seen: 0,
  ink: O.none(),
});

const sumOf = (values: ReadonlyArray<number>): number => A.reduce(values, 0, (total, value) => total + value);

type Run = { readonly from: number; readonly to: number };

// Length of the part of `run` that none of `others` covers.
const uncoveredLength = (run: Run, others: ReadonlyArray<Run>): number =>
  pipe(
    others,
    A.map((other) => ({ from: Math.max(run.from, other.from), to: Math.min(run.to, other.to) })),
    A.filter((other) => other.to > other.from),
    A.sort(Order.mapInput(Order.Number, (other: Run) => other.from)),
    A.reduce({ covered: 0, reached: run.from }, (acc, other) => ({
      covered: acc.covered + Math.max(0, other.to - Math.max(other.from, acc.reached)),
      reached: Math.max(acc.reached, other.to),
    })),
    (acc) => run.to - run.from - acc.covered
  );

// A piece whose probe cell lies inside a taller cell of another piece: an edge row beside its interior neighbour.
const nestsIn =
  <P>(piece: StretchPiece<P>) =>
  (other: StretchPiece<P>): boolean =>
    other !== piece &&
    other.low <= piece.low &&
    piece.high <= other.high &&
    other.high - other.low > piece.high - piece.low;

// The area the pieces a face's probes saw cover along the step and the lines, each piece a run one probe cell tall. An
// edge row's cell lies inside its interior neighbour's, so an edge piece adds only the run its neighbours did not see.
const seenArea = <P>(pieces: ReadonlyArray<StretchPiece<P>>): number =>
  sumOf(
    A.map(pieces, (piece) => {
      const hosts = A.filter(pieces, nestsIn(piece));
      return A.isReadonlyArrayNonEmpty(hosts)
        ? uncoveredLength(piece, hosts) * (piece.high - piece.low)
        : (piece.to - piece.from) * (piece.high - piece.low);
    })
  );

// Why a planned visible stretch drew no band: lines without room for two legible strokes, a band too narrow for a
// second line, or one with room for none.
const stretchSkipOf = (treatment: FaceTreatment): ShadingStretchSkipReason =>
  FaceTreatment.match(treatment, {
    lines: (): ShadingStretchSkipReason => "no-room",
    skipped: (skip): ShadingStretchSkipReason => (skip.reason === "narrow" ? "narrow" : "sliver"),
  });

// Shading of one face under one band taper: its treatment and the strokes of each of its planned stretches. With the
// face's visible stretches known (graded shading after the probe pass), every stretch is treated on its own: the face
// counts as shaded when any stretch gets lines, as hidden when no stretch shows, and as a sliver when each is too
// narrow. Every visible stretch that hands no strokes over keeps its verdict, so the kernel can count it (review loop
// 4, A-01). A face whose planned stretches leave room for a band also reports its planned ink: the viewed length of
// the strokes of those stretches times the minimum pitch, over the area its probes saw, projected onto the view plane.
const shadeFace =
  <P>(
    oc: OpenCascadeInstance,
    view: ViewFacts,
    plan: ShadingPlan,
    regions: O.Option<(face: number) => ReadonlyArray<A.NonEmptyReadonlyArray<StretchPiece<P>>>>,
    rooms: (face: number, area: number) => O.Option<ReadonlyArray<ShadingRoom>>,
    isBrokenFace: (face: replicad.Face) => boolean,
    claimedOf: (face: replicad.Face) => O.Option<(edge: replicad.Edge) => ReadonlyArray<replicad.Edge>>,
    viewedLength: ViewedLength,
    groupBeyond: GroupBeyond
  ) =>
  (face: replicad.Face, index: number, taper: BandTaper): Shaded<P> => {
    // unclaimed matter is never shaded, before any rule reads the face
    if (isBrokenFace(face)) {
      return bare(ShadingSkipped.make({ reason: "broken-part" }));
    }
    if (!isPlanar(face)) {
      return bare(ShadingSkipped.make({ reason: "curved" }));
    }
    const facts = factsOf(face);
    const whole = treatmentFor({ face: facts, view, plan, taper });
    const strokes = strokesOf(oc, view, plan, face, facts, claimedOf(face));
    const drawn = (
      treatment: FaceTreatment,
      pieces: ReadonlyArray<StretchPiece<P>>,
      tapered: boolean
    ): ReadonlyArray<Stroke> =>
      FaceTreatment.match(treatment, {
        skipped: A.empty<Stroke>,
        lines: (lines) => strokes(lines, pieces, tapered),
      });
    const hasRoom = (planned: ReadonlyArray<Stroke>): boolean =>
      hasBandRoom({ plan, viewedLength, planned: A.map(planned, (stroke) => endsOf(stroke.edge)) });
    type Planned = {
      readonly treatment: FaceTreatment;
      readonly strokes: ReadonlyArray<Stroke>;
      readonly probes: ReadonlyArray<P>;
      // the strokes are a tapered band's whole clipped chords, for the kernel to cut back to the taper
      readonly whole: boolean;
      readonly untapered: O.Option<LazyArg<ReadonlyArray<Stroke>>>;
      // the visible area's window as its probes and columns measured it; none for a stretch planned over the whole face
      readonly window: O.Option<ShadingWindow>;
    };
    // A tapered band's strokes again as whole clipped chords, made only when asked for: the kernel draws them where
    // hidden-line removal cut a band planned with room below two legible strokes. None for a band without a taper.
    const untaperedOf = (
      treatment: FaceTreatment,
      pieces: ReadonlyArray<StretchPiece<P>>
    ): O.Option<LazyArg<ReadonlyArray<Stroke>>> =>
      pipe(
        O.liftPredicate(treatment, FaceTreatment.guards.lines),
        O.filter((lines) => A.some(lines.cuts, (cut) => cut.extent < 1)),
        O.map(() => () => drawn(treatment, pieces, false))
      );
    // One band for one visible area of the face (the kernel groups the probe pieces into areas), measured from
    // `start` along the step to the area's far end, with the room the kernel measured across a glimpsed area when the
    // band is a rescue (`plannedFor`). An ordinary band's strokes are then drawn only in the rows that saw the area at
    // their offset, so a band tapers along a slanting occluder and never runs on into a neighbouring area.
    const windowAt = (
      pieces: A.NonEmptyReadonlyArray<StretchPiece<P>>,
      start: number,
      lead: O.Option<number>,
      room: O.Option<ReadonlyArray<ShadingRoom>>
    ): ShadingWindow =>
      ShadingWindow.make({
        start,
        span: mostOf(A.map(pieces, (piece) => piece.to)) - start,
        low: O.some(leastOf(A.map(pieces, (piece) => piece.low))),
        high: O.some(mostOf(A.map(pieces, (piece) => piece.high))),
        lead,
        room,
      });
    // The band's first line as drawn (the first cut that makes strokes in the area's rows) and the step from it back
    // to the band's edge, which the rules put at `start`, or at the anchor when `start` lies before it.
    const firstLineOf = (
      lines: ShadingLines,
      pieces: A.NonEmptyReadonlyArray<StretchPiece<P>>,
      start: number
    ): O.Option<BandEdge> =>
      A.findFirst(lines.cuts, (cut) =>
        pipe(
          edgesOf(strokes(ShadingLines.make({ origin: lines.origin, step: lines.step, cuts: [cut] }), pieces, true)),
          O.liftPredicate(A.isReadonlyArrayNonEmpty),
          O.map((edges) =>
            BandEdge.make({
              first: A.map(edges, endsOf),
              back: scale(lines.step, Math.max(0, start) - cut.offset),
            })
          )
        )
      );
    // A band whose edge has drawn lines running alongside it just beyond (a wall's two lines past a flap's free edge)
    // would read with them as one evenly spaced ladder: the kernel reads the spacing to those lines beside the band's
    // first line, and the band is planned again behind the gutter the rules give for it (review loop 3, O-04). A
    // gutter may move a band but never empty it: on a stretch too narrow for two lines behind it (the planned band
    // turns `narrow` or a sliver), or whose strokes behind it lose the room the kernel asks of a band while the plain
    // band has that room, the band stays where its edge alone puts it. The first line read is the one the rules
    // placed, also when they moved the band inward off a glimpsed tip (review loop 4, G-01).
    const planAt = (
      pieces: A.NonEmptyReadonlyArray<StretchPiece<P>>,
      start: number,
      room: O.Option<ReadonlyArray<ShadingRoom>>
    ): FaceTreatment => {
      const plain = treatmentFor({ face: facts, view, plan, window: windowAt(pieces, start, O.none(), room), taper });
      return pipe(
        O.liftPredicate(plain, FaceTreatment.guards.lines),
        O.flatMap((lines) => firstLineOf(lines, pieces, start)),
        O.flatMap(groupBeyond),
        O.map((pitch) =>
          treatmentFor({
            face: facts,
            view,
            plan,
            window: windowAt(
              pieces,
              start,
              O.some(bandLead({ minPitch: plan.minPitch, groupPitch: O.some(pitch) })),
              room
            ),
            taper,
          })
        ),
        O.filter(
          (led) =>
            FaceTreatment.guards.lines(led) &&
            (hasRoom(drawn(led, pieces, true)) || !hasRoom(drawn(plain, pieces, true)))
        ),
        O.getOrElse(() => plain)
      );
    };
    // A plan is tried again when it gives lines whose tapered strokes leave no room for a band in the kernel's eyes
    // (`hasBandRoom`), or when the rules found the stretch too narrow for a band from its start (review loop 4, A-01):
    // the start's own rows can be a narrow tip of the area.
    const replans = (treatment: FaceTreatment, tapered: ReadonlyArray<Stroke>): boolean =>
      FaceTreatment.match(treatment, {
        lines: () => !hasRoom(tapered),
        skipped: (skip) => skip.reason === "narrow" || skip.reason === "sliver",
      });
    // An area is banded from its own least offset: an area at the face's outline starts at the face's edge (the
    // rule clamps a start before the anchor), an area behind a part in front starts at its nearest side. The taper
    // may shorten that band but must never be what empties it (review loop 3, J-01). A plan tried again is first
    // re-planned from the start of a later row of the area, nearest first, where the tapered strokes have room. With
    // no such row, a band of lines draws every stroke as its whole clipped chord, hidden-line removal cuts it to what
    // shows, and the kernel cuts what shows back to the taper (review loop 4, K-08). An area whose whole clipped chords
    // lack room too stays a sliver. A band drawn tapered keeps its whole clipped chords at hand (`untapered`) for the
    // kernel, which only sees after hidden-line removal whether a part in front cut the band's rows below what the
    // taper needs. The strokes are drawn on `canvas`: the area's own pieces, or, for a rescued glimpse, one piece over
    // the area's whole range (`plannedFor`).
    const plannedOver = (
      pieces: A.NonEmptyReadonlyArray<StretchPiece<P>>,
      canvas: A.NonEmptyReadonlyArray<StretchPiece<P>>,
      room: O.Option<ReadonlyArray<ShadingRoom>>
    ): Planned => {
      const probes = A.flatMap(pieces, (piece) => piece.probes);
      const from = leastOf(A.map(pieces, (piece) => piece.from));
      const window = O.some(windowAt(canvas, from, O.none(), room));
      const treatment = planAt(canvas, from, room);
      const tapered = drawn(treatment, canvas, true);
      const settled = (
        chosen: FaceTreatment,
        planned: ReadonlyArray<Stroke>,
        untapered: O.Option<LazyArg<ReadonlyArray<Stroke>>>
      ): Planned => ({ treatment: chosen, strokes: planned, probes, whole: false, untapered, window });
      const banded = (
        chosen: FaceTreatment,
        planned: ReadonlyArray<Stroke>,
        untapered: O.Option<LazyArg<ReadonlyArray<Stroke>>>
      ): O.Option<Planned> => (hasRoom(planned) ? O.some(settled(chosen, planned, untapered)) : O.none());
      // a tapered band drawn on its whole clipped chords, which the kernel cuts back to the taper after hidden-line
      // removal (review loop 4, K-08)
      const wholeChords = (): O.Option<Planned> =>
        O.map(banded(treatment, drawn(treatment, canvas, false), O.none()), (planned) => ({
          ...planned,
          whole: O.isSome(untaperedOf(treatment, canvas)),
        }));
      return !replans(treatment, tapered)
        ? settled(treatment, tapered, untaperedOf(treatment, canvas))
        : pipe(
            A.map(pieces, (piece) => piece.from),
            A.dedupe,
            A.filter((start) => start > from),
            A.sort(Order.Number),
            A.findFirst((start) => {
              const later = planAt(canvas, start, room);
              return FaceTreatment.guards.lines(later)
                ? banded(later, drawn(later, canvas, true), untaperedOf(later, canvas))
                : O.none();
            }),
            O.orElse(wholeChords),
            O.getOrElse(() => settled(treatment, tapered, O.none()))
          );
    };
    // An area's ordinary plan bands it when it gives lines (two kept lines at least) whose strokes have room for a band.
    const bandsArea = (planned: Planned): boolean =>
      FaceTreatment.guards.lines(planned.treatment) && hasRoom(planned.strokes);
    // Each area is first planned the ordinary way: positions kept on the face's chords, each stroke clipped to the
    // cells of the run of rows that saw the area at its offset, so a band never runs on into a neighbouring area
    // across a part in front (review loop 2). The room measured across a glimpsed area is a rescue only, for an area
    // that plan leaves without a band (a `narrow` or sliver skip, or lines without room): its positions are then judged
    // by the measured room and each stroke is drawn over the area's whole range along the lines, for the hidden-line
    // pass to cut to what shows, since its few rows' cells say nothing of how tall the glimpse is at each offset
    // (review loop 4, G-01). A band the ordinary plan already gives is drawn as it is (review loop 4, R4-08).
    const plannedFor = (
      pieces: A.NonEmptyReadonlyArray<StretchPiece<P>>,
      room: O.Option<ReadonlyArray<ShadingRoom>>
    ): Planned => {
      const ordinary = plannedOver(pieces, pieces, O.none());
      return pipe(
        room,
        O.filter(() => !bandsArea(ordinary)),
        O.match({
          onNone: () => ordinary,
          onSome: (measured) =>
            plannedOver(
              pieces,
              A.of({
                row: 0,
                from: leastOf(A.map(pieces, (piece) => piece.from)),
                to: mostOf(A.map(pieces, (piece) => piece.to)),
                low: leastOf(A.map(pieces, (piece) => piece.low)),
                high: mostOf(A.map(pieces, (piece) => piece.high)),
                probes: A.flatMap(pieces, (piece) => piece.probes),
              }),
              O.some(measured)
            ),
        })
      );
    };
    const unplanned = (treatment: FaceTreatment, planned: ReadonlyArray<Stroke>): Planned => ({
      treatment,
      strokes: planned,
      probes: A.empty(),
      whole: false,
      untapered: O.none(),
      window: O.none(),
    });
    const planned: A.NonEmptyReadonlyArray<Planned> = pipe(
      regions,
      O.filter(() => FaceTreatment.guards.lines(whole)),
      O.match({
        onNone: () => A.of(unplanned(whole, drawn(whole, A.empty(), true))),
        onSome: (pieces) =>
          pipe(
            pieces(index),
            A.map((area, k) => plannedFor(area, rooms(index, k))),
            (areas) =>
              A.isReadonlyArrayNonEmpty(areas)
                ? areas
                : A.of(unplanned(ShadingSkipped.make({ reason: "hidden" }), A.empty()))
          ),
      })
    );
    // the stretches the kernel will band: lines planned with room for a band (any other stretch stays bare)
    const banded = A.filter(planned, (p) => FaceTreatment.guards.lines(p.treatment) && hasRoom(p.strokes));
    // the face's visible area on the view plane, from the pieces its probes saw (each a run along the step, one probe
    // cell tall), projected by the face's turn toward the eye
    const seen = O.match(regions, {
      onNone: () => 0,
      onSome: (pieces) => seenArea(A.flatten(pieces(index))) * Math.abs(dotV(facts.normal, view.eye)),
    });
    const exposure = dotV(facts.normal, view.light);
    const fitsOf = (p: Planned): boolean =>
      O.exists(p.window, (window) => stretchFitsBand({ face: facts, view, plan, window }));
    return {
      treatment: pipe(
        A.findFirst(planned, (p) => FaceTreatment.guards.lines(p.treatment)),
        O.map((p) => p.treatment),
        O.getOrElse(() => A.headNonEmpty(planned).treatment)
      ),
      // one stroke set per planned stretch, so the hidden-line pass reports each stretch on its own
      strokes: pipe(
        planned,
        A.filter((p) => A.isReadonlyArrayNonEmpty(p.strokes)),
        A.map(
          (p): StrokeSet<P> => ({
            strokes: p.strokes,
            probes: p.probes,
            whole: p.whole,
            untapered: p.untapered,
            fits: !hasRoom(p.strokes) && fitsOf(p),
          })
        )
      ),
      // every visible stretch that hands no strokes over, with its verdict
      skipped: pipe(
        planned,
        A.filter((p) => O.isSome(p.window) && !A.isReadonlyArrayNonEmpty(p.strokes)),
        A.map((p): SkippedStretch => ({ reason: stretchSkipOf(p.treatment), fits: fitsOf(p) }))
      ),
      exposure,
      seen,
      ink:
        plan.style === "graded" && A.isReadonlyArrayNonEmpty(banded) && seen > 0
          ? BandInk.makeOption({
              face: index,
              exposure,
              density:
                (sumOf(A.flatMap(banded, (p) => A.map(p.strokes, (stroke) => viewedLength(endsOf(stroke.edge))))) *
                  plan.minPitch) /
                seen,
            })
          : O.none(),
    };
  };

// One planned stroke of a band as the kernel reads it: its two ends in model coordinates, the drawn fraction of its chord
// its line was planned (1 for a full chord), and its line's rank in the band, nearest the shadow edge first.
type PlannedStroke = {
  readonly ends: readonly [V3, V3];
  readonly extent: number;
  readonly rank: number;
};

/**
 * One face of a shaded shape as the kernel reads it: its treatment, its
 * exposure to the 1.84(m) light and its visible area on the view plane (0
 * without a probe pass), the visible stretches that hand no strokes over,
 * and one compound of strokes per planned stretch.
 *
 * **Details**
 *
 * Each stretch carries its planned strokes (each with its line's planned
 * extent and rank), the probes that saw it, whether the strokes are a tapered
 * band's whole clipped chords, whether its measured room fits a band, and,
 * for a band drawn tapered, the same band on whole clipped chords, made on
 * request, so the kernel can cut a band drawn on whole chords back to its
 * taper.
 *
 * @internal
 */
export type HatchedFace<P> = {
  readonly treatment: FaceTreatment;
  readonly exposure: number;
  readonly seen: number;
  readonly skipped: ReadonlyArray<SkippedStretch>;
  readonly stretches: ReadonlyArray<{
    readonly planned: ReadonlyArray<PlannedStroke>;
    readonly shape: replicad.AnyShape;
    readonly probes: ReadonlyArray<P>;
    readonly whole: boolean;
    readonly untapered: O.Option<
      LazyArg<{ readonly shape: replicad.AnyShape; readonly strokes: ReadonlyArray<PlannedStroke> }>
    >;
    readonly fits: boolean;
  }>;
};

const plannedOf = (stroke: Stroke): PlannedStroke => ({
  ends: endsOf(stroke.edge),
  extent: stroke.extent,
  rank: stroke.rank,
});

// One stroke set as the kernel reads it; each stroke's ends are read before the strokes are compounded.
const hatchedStretch = <P>(set: StrokeSet<P>): HatchedFace<P>["stretches"][number] => ({
  planned: A.map(set.strokes, plannedOf),
  shape: replicad.makeCompound([...edgesOf(set.strokes)]),
  probes: set.probes,
  whole: set.whole,
  untapered: O.map(set.untapered, (strokes) => () => {
    const made = strokes();
    const planned = A.map(made, plannedOf);
    return { shape: replicad.makeCompound([...edgesOf(made)]), strokes: planned };
  }),
  fits: set.fits,
});

/**
 * Shading of every face of a shape: each face's treatment and, when it got
 * lines, one compound of strokes per planned stretch (so the hidden-line
 * pass can report each stretch's visible strokes separately), from which the
 * kernel counts the view's coverage. With `regions` (graded shading after
 * the probe pass: the chains of overlapping visible pieces of each face),
 * each face's visible stretches are shaded one by one.
 *
 * **Details**
 *
 * Broken-line parts never reach this pass: the kernel shades the solid
 * compound only. Faces of solid parts that only broken primitives own
 * (`isBrokenFace`) are skipped with reason `broken-part` before the rules
 * run, so they get no lines and are counted under that reason. A face
 * merged across a solid and a broken primitive is shaded as one face, and
 * `claimedOf` cuts each of its strokes back to the part on the solid
 * primitive. `viewedLength` is the kernel's measure of a planned stroke on
 * the view plane: a graded stretch whose tapered strokes leave no room for a
 * band by that measure is re-planned or drawn untapered before the kernel
 * reads it. A stretch drawn tapered also carries the same band as whole
 * clipped chords (`untapered`), made only on request: the kernel draws them
 * where hidden-line removal and the legibility pass leave the tapered band
 * fewer than two strokes, since a part in front can cut a probe row's cell
 * anywhere between the row and its unseen neighbour. Each of those strokes
 * carries its line's planned extent and rank, so the kernel cuts the redrawn
 * band back to its taper.
 *
 * `rooms` gives the room the kernel measured across a visible area of a face
 * (by face and by the area's index among the face's regions). It is a rescue
 * only: an area whose ordinary plan leaves it without a band (a `narrow` or
 * sliver skip, or lines without room) is planned again with each band
 * position judged by what the view shows rather than by the face's whole
 * chord, its strokes drawn over the area's whole range (review loop 4,
 * G-01). An area the ordinary plan bands keeps that band, each stroke
 * clipped to its own rows' cells (review loop 4, R4-08). Every visible
 * stretch that hands no strokes over is reported in `skipped` with its
 * reason and whether its measured room fits a band (review loop 4, A-01).
 *
 * `neighbours` are the pairs of faces that share an edge visible in the view.
 * A face turned toward the light must never carry more ink than a darker face
 * it shares such an edge with (review loop 3, O-02): the bands are settled by
 * `settleBandTapers`, which cuts the lighter band back to the lit taper and
 * then to the lit floor while it out-inks its neighbour, and only a face whose
 * taper changes is shaded again. Banded faces of one seen area a tone step
 * apart (`inkTwins`) are settled the same way, shared edge or not (review
 * loop 4, F11-04). With no neighbours and no twins every band is the band its
 * own tone gives.
 *
 * `groupBeyond` is the kernel's reading beside a band's first line of the
 * drawn lines just beyond the band's edge. A band whose edge has lines
 * running alongside it within the plan's ladder reach is planned again with
 * its first line behind the gutter `bandLead` gives (review loop 3, O-04), so
 * band, edge, and lines never read as one evenly spaced ladder. A gutter
 * moves a band but never empties it: where the band behind it would be cut
 * to one line, or lose the room a band needs while the plain band has it,
 * the band stays one pitch in.
 *
 * @internal
 */
export const hatchCompound = <P>(options: {
  readonly oc: OpenCascadeInstance;
  readonly shape: replicad.AnyShape;
  readonly camera: Camera;
  readonly plan: ShadingPlan;
  readonly regions: O.Option<(face: number) => ReadonlyArray<A.NonEmptyReadonlyArray<StretchPiece<P>>>>;
  readonly rooms: (face: number, area: number) => O.Option<ReadonlyArray<ShadingRoom>>;
  readonly isBrokenFace: (face: replicad.Face) => boolean;
  readonly claimedOf: (face: replicad.Face) => O.Option<(edge: replicad.Edge) => ReadonlyArray<replicad.Edge>>;
  readonly viewedLength: ViewedLength;
  readonly neighbours: ReadonlyArray<readonly [number, number]>;
  readonly groupBeyond: GroupBeyond;
}): { readonly faces: ReadonlyArray<HatchedFace<P>> } => {
  const shade = shadeFace(
    options.oc,
    viewFactsOf(options.camera),
    options.plan,
    options.regions,
    options.rooms,
    options.isBrokenFace,
    options.claimedOf,
    options.viewedLength,
    options.groupBeyond
  );
  // each face is shaded once per taper it is asked for: settling re-shades only the faces whose taper steps
  const shadings = A.map(options.shape.faces, (face, index) => {
    const byTaper = MutableHashMap.empty<BandTaper, Shaded<P>>();
    return (taper: BandTaper): Shaded<P> =>
      O.getOrElse(MutableHashMap.get(byTaper, taper), () => {
        const shaded = shade(face, index, taper);
        MutableHashMap.set(byTaper, taper, shaded);
        return shaded;
      });
  });
  const shadedUnder = (tapers: HashMap.HashMap<number, BandTaper>): ReadonlyArray<Shaded<P>> =>
    A.map(shadings, (shading, index) => shading(O.getOrElse(HashMap.get(tapers, index), (): BandTaper => "full")));
  // faces of one seen area a tone step apart are settled like neighbours (review loop 4, F11-04)
  const full = shadedUnder(HashMap.empty());
  const shared = [
    ...options.neighbours,
    ...inkTwins({
      bands: A.getSomes(A.map(full, (face) => face.ink)),
      // inkTwins reads only the indices from the bands mapped from full above.
      seen: (face) => A.getUnsafe(full, face).seen,
    }),
  ];
  const tapers = A.isReadonlyArrayNonEmpty(shared)
    ? settleBandTapers({
        shared,
        inkOf: (stepped) =>
          stepped.pipe(
            shadedUnder,
            A.map((face) => face.ink),
            A.getSomes
          ),
      })
    : HashMap.empty<number, BandTaper>();
  return {
    faces: A.map(
      shadedUnder(tapers),
      (face): HatchedFace<P> => ({
        treatment: face.treatment,
        exposure: face.exposure,
        seen: face.seen,
        skipped: face.skipped,
        stretches: A.map(face.strokes, hatchedStretch),
      })
    ),
  };
};

// A chord along the lines of a probed face at one offset across one of its visible areas, cut to the area's range along
// the lines, for the hidden-line pass to measure the area's room for a stroke there (`ShadingRoom`).
type RoomColumn = {
  /** Index of the face in its shape. */
  readonly face: number;
  /** Index of the area among the face's visible areas. */
  readonly area: number;
  /** Offset of the chord along the face's step from its shadow anchor. */
  readonly offset: number;
  /** One end of the chord in model space, read before it is lifted off the face. */
  readonly from: V3;
  /** The other end of the chord in model space. */
  readonly to: V3;
  readonly shape: replicad.AnyShape;
};

// An area seen by fewer probe rows than this has its room measured column by column: the cells of a few rows can
// overstate a pointed glimpse of a face by up to a cell, so a band placed by them lands on the glimpse's empty tip
// (review loop 4, G-01). An area three rows saw is at least a cell tall where its middle row crossed it.
const MEASURED_ROWS = 3;

// The columns across one visible area, one a minimum pitch apart along the step (at the middles of equal parts of the
// area's range), each cut to the area's range along the lines.
const areaColumns = <P>(input: {
  readonly oc: OpenCascadeInstance;
  readonly plan: ShadingPlan;
  readonly face: replicad.Face;
  readonly index: number;
  readonly lines: ShadingLines;
  readonly along: V3;
  readonly pieces: A.NonEmptyReadonlyArray<StretchPiece<P>>;
  readonly area: number;
}): ReadonlyArray<RoomColumn> => {
  const { oc, plan, face, lines, along, pieces } = input;
  const from = leastOf(A.map(pieces, (piece) => piece.from));
  const to = mostOf(A.map(pieces, (piece) => piece.to));
  const range = O.some([
    leastOf(A.map(pieces, (piece) => piece.low)),
    mostOf(A.map(pieces, (piece) => piece.high)),
  ] as const);
  const count = Math.max(1, Math.ceil((to - from) / plan.minPitch));
  return A.flatMap(
    A.makeBy(count, (k) => from + ((to - from) * (k + 0.5)) / count),
    (offset) =>
      pipe(
        sectionEdges(oc, face, add(lines.origin, scale(lines.step, offset)), lines.step),
        A.map(clipTo(range, along)),
        A.getSomes,
        A.map((edge): RoomColumn => {
          // the ends are read before the lift: translating a replicad edge frees the original
          const [start, end] = endsOf(edge);
          return {
            face: input.index,
            area: input.area,
            offset,
            from: start,
            to: end,
            shape: chopped(liftFor(face, plan)(edge), PROBE_PIECE_PITCHES * plan.minPitch),
          };
        })
      )
  );
};

/**
 * Columns across every visible area of a shape's graded faces that fewer than
 * three probe rows saw, for one more hidden-line pass to measure each area's
 * room for a stroke. The columns of an area run along the face's lines at
 * offsets a minimum pitch apart across the area, each cut to the area's
 * range along the lines and chopped like a probe, so the pass reads each
 * piece on its own. Faces drawn in broken lines are never measured, and a
 * view whose every area several rows saw needs no columns at all. The stroke
 * pass reads an area's room only to rescue an area its ordinary plan leaves
 * without a band (`hatchCompound`).
 *
 * @internal
 */
export const roomColumns = <P>(options: {
  readonly oc: OpenCascadeInstance;
  readonly shape: replicad.AnyShape;
  readonly camera: Camera;
  readonly plan: ShadingPlan;
  readonly isBrokenFace: (face: replicad.Face) => boolean;
  readonly regions: (face: number) => ReadonlyArray<A.NonEmptyReadonlyArray<StretchPiece<P>>>;
}): ReadonlyArray<RoomColumn> => {
  const { oc, plan } = options;
  const view = viewFactsOf(options.camera);
  const glimpsed = (pieces: A.NonEmptyReadonlyArray<StretchPiece<P>>): boolean =>
    A.length(A.dedupe(A.map(pieces, (piece) => piece.row))) < MEASURED_ROWS;
  return A.flatMap(options.shape.faces, (face, index) => {
    const areas = options.regions(index);
    if (!A.some(areas, glimpsed)) {
      return A.empty<RoomColumn>();
    }
    return O.match(plannedLinesOf(face, view, plan, options.isBrokenFace), {
      onNone: A.empty<RoomColumn>,
      onSome: ({ facts, lines }) => {
        const along = unitV(cross(facts.normal, lines.step));
        return A.flatMap(areas, (pieces, area) =>
          glimpsed(pieces) ? areaColumns({ oc, plan, face, index, lines, along, pieces, area }) : A.empty()
        );
      },
    });
  });
};
