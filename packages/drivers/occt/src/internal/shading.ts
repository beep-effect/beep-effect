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

const CURVED_EDGE_OUTLINE_SAMPLES = 8;

const isLine = (edge: replicad.Edge): boolean => edge.geomType === "LINE";

const outlineOf = (edge: replicad.Edge): ReadonlyArray<V3> =>
  isLine(edge)
    ? [vec(edge.startPoint), vec(edge.endPoint)]
    : A.makeBy(CURVED_EDGE_OUTLINE_SAMPLES + 1, (i) => vec(edge.pointAt(i / CURVED_EDGE_OUTLINE_SAMPLES)));

const planarFaceFactsOf = (face: replicad.Face): FaceFacts => {
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

const BAND_STROKES = 2;

/**
 * Whether a planned stretch has room for a band: at least two of its planned
 * strokes reach the plan's legible stroke length on the view plane. The
 * kernel leaves a stretch without room bare as a sliver, and the stroke pass
 * asks the same question before it hands a tapered band over.
 *
 * **Gotchas**
 *
 * A band is at least two strokes: one line beside an outline reads as a
 * doubled edge, never as shading.
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

const SHORTEST_STROKE = 1e-6;

const trimTo =
  (extent: number, seenRange: O.Option<readonly [low: number, high: number]>, along: V3) =>
  (edge: replicad.Edge): O.Option<replicad.Edge> => {
    if (extent >= 1) {
      return O.some(edge);
    }
    if (edge.length * extent < SHORTEST_STROKE) {
      return O.none();
    }
    const h0 = dotV(vec(edge.startPoint), along);
    const h1 = dotV(vec(edge.endPoint), along);
    const centre = O.match(seenRange, {
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

// decision: lines-lifted-off-their-face
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

const isPlanar = (face: replicad.Face): boolean => face.geomType === "PLANE";

const plannedLinesOf = (
  face: replicad.Face,
  view: ViewFacts,
  plan: ShadingPlan,
  isBrokenFace: (face: replicad.Face) => boolean
): O.Option<{ readonly facts: FaceFacts; readonly lines: ShadingLines }> => {
  if (isBrokenFace(face) || !isPlanar(face)) {
    return O.none();
  }
  const facts = planarFaceFactsOf(face);
  return O.map(O.liftPredicate(treatmentFor({ face: facts, view, plan }), FaceTreatment.guards.lines), (lines) => ({
    facts,
    lines,
  }));
};

// decision: probe-rows-with-edge-rows
const PROBE_HEIGHTS = 9;

type ProbeRow = { readonly height: number; readonly reach: number };

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

const reachOf = (face: FaceFacts, along: V3): readonly [number, number] =>
  pipe(
    face.outline,
    A.map((p) => dotV(p, along)),
    (reaches) => [Math.min(...reaches), Math.max(...reaches)] as const
  );

type Probe = { readonly shape: replicad.AnyShape; readonly probe: ShadingProbe };

// decision: probes-pass-as-short-pieces
const PROBE_PIECE_PITCHES = 4;

const chopped = (edge: replicad.Edge, length: number): replicad.AnyShape => {
  const a = vec(edge.startPoint);
  const b = vec(edge.endPoint);
  const along = minusV(b, a);
  const count = Math.max(1, Math.ceil(Math.hypot(along[0], along[1], along[2]) / length));
  const at = (i: number): V3 => add(a, scale(along, i / count));
  return replicad.makeCompound(A.makeBy(count, (i) => replicad.makeLine([...at(i)], [...at(i + 1)])));
};

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
 * **Gotchas**
 *
 * Translating a replicad edge frees the original, so each probe's ends are
 * read before it is lifted off the face.
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

// decision: bands-keep-to-their-visible-area
const clipTo =
  (seenRange: O.Option<readonly [low: number, high: number]>, along: V3) =>
  (edge: replicad.Edge): O.Option<replicad.Edge> =>
    O.match(seenRange, {
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

type Stroke = { readonly edge: replicad.Edge; readonly extent: number; readonly rank: number };

const edgesOf = (strokes: ReadonlyArray<Stroke>): ReadonlyArray<replicad.Edge> => A.map(strokes, (s) => s.edge);

// decision: bands-keep-to-their-visible-area
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
      A.flatMap(runsAt(cut.offset), (seenRange) =>
        pipe(
          sectionEdges(oc, face, add(lines.origin, scale(lines.step, cut.offset)), lines.step),
          A.map(clipTo(seenRange, along)),
          A.getSomes,
          A.map(trimTo(tapered ? cut.extent : 1, seenRange, along)),
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

type StrokeSet<P> = {
  readonly strokes: ReadonlyArray<Stroke>;
  readonly probes: ReadonlyArray<P>;
  readonly whole: boolean;
  readonly untapered: O.Option<LazyArg<ReadonlyArray<Stroke>>>;
  readonly fits: boolean;
};

type SkippedStretch = { readonly reason: ShadingStretchSkipReason; readonly fits: boolean };

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

const nestsIn =
  <P>(piece: StretchPiece<P>) =>
  (other: StretchPiece<P>): boolean =>
    other !== piece &&
    other.low <= piece.low &&
    piece.high <= other.high &&
    other.high - other.low > piece.high - piece.low;

// decision: probe-rows-with-edge-rows
const seenArea = <P>(pieces: ReadonlyArray<StretchPiece<P>>): number =>
  sumOf(
    A.map(pieces, (piece) => {
      const hosts = A.filter(pieces, nestsIn(piece));
      return A.isReadonlyArrayNonEmpty(hosts)
        ? uncoveredLength(piece, hosts) * (piece.high - piece.low)
        : (piece.to - piece.from) * (piece.high - piece.low);
    })
  );

const stretchSkipOf = (treatment: FaceTreatment): ShadingStretchSkipReason =>
  FaceTreatment.match(treatment, {
    lines: (): ShadingStretchSkipReason => "no-room",
    skipped: (skip): ShadingStretchSkipReason => (skip.reason === "narrow" ? "narrow" : "sliver"),
  });

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
    if (isBrokenFace(face)) {
      return bare(ShadingSkipped.make({ reason: "broken-part" }));
    }
    if (!isPlanar(face)) {
      return bare(ShadingSkipped.make({ reason: "curved" }));
    }
    const facts = planarFaceFactsOf(face);
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
      readonly whole: boolean;
      readonly untapered: O.Option<LazyArg<ReadonlyArray<Stroke>>>;
      readonly window: O.Option<ShadingWindow>;
    };
    const untaperedOf = (
      treatment: FaceTreatment,
      pieces: ReadonlyArray<StretchPiece<P>>
    ): O.Option<LazyArg<ReadonlyArray<Stroke>>> =>
      pipe(
        O.liftPredicate(treatment, FaceTreatment.guards.lines),
        O.filter((lines) => A.some(lines.cuts, (cut) => cut.extent < 1)),
        O.map(() => () => drawn(treatment, pieces, false))
      );
    // decision: bands-keep-to-their-visible-area
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
    // decision: band-gutter-from-the-ladder-reading
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
    // decision: redraw-emptied-tapered-bands
    const replans = (treatment: FaceTreatment, tapered: ReadonlyArray<Stroke>): boolean =>
      FaceTreatment.match(treatment, {
        lines: () => !hasRoom(tapered),
        skipped: (skip) => skip.reason === "narrow" || skip.reason === "sliver",
      });
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
    const bandsArea = (planned: Planned): boolean =>
      FaceTreatment.guards.lines(planned.treatment) && hasRoom(planned.strokes);
    // decision: measured-room-rescues-glimpses
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
    const banded = A.filter(planned, (p) => FaceTreatment.guards.lines(p.treatment) && hasRoom(p.strokes));
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
 * **Gotchas**
 *
 * A planned stroke's `extent` is the drawn fraction of its chord its line
 * was planned (1 for a full chord, whether or not the stroke is drawn
 * tapered), and its `rank` is its line's place in the band, nearest the
 * shadow edge first; its `ends` are in model coordinates.
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
 * **Gotchas**
 *
 * OCCT refuses an edge between coincident points, so a trimmed or clipped
 * stroke shorter than `SHORTEST_STROKE` model units is never made. Chords
 * shorter than the plan's minimum stroke on the view plane are dropped:
 * near a pointed corner the graded strokes would otherwise read as a dot
 * ladder. Translating a replicad edge frees the original and compounding
 * consumes the strokes, so every stroke is cut from its own sections and
 * its ends are read before it is lifted or compounded.
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
  const full = shadedUnder(HashMap.empty());
  const shared = [
    ...options.neighbours,
    ...inkTwins({
      bands: A.getSomes(A.map(full, (face) => face.ink)),
      seen: (indexInFull) => A.getUnsafe(full, indexInFull).seen,
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

type RoomColumn = {
  readonly face: number;
  readonly area: number;
  readonly offset: number;
  readonly from: V3;
  readonly to: V3;
  readonly shape: replicad.AnyShape;
};

// decision: measured-room-rescues-glimpses
const MEASURED_ROWS = 3;

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
 * **Gotchas**
 *
 * Translating a replicad edge frees the original, so a column's `from` and
 * `to` ends (model space) are read before it is lifted off the face. Its
 * `offset` runs along the face's step from the shadow anchor, and `area`
 * indexes the face's visible areas.
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
