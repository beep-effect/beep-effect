/**
 * Private per-primitive line style: which parts of a fused solid part are
 * claimed (on one of its solid add primitives) and which are unclaimed (only
 * on its broken ones), for its faces, for the strokes that shade them, and
 * for the stretches of its hidden-line output.
 *
 * The part is built and projected fused, so no seam crosses where a broken
 * primitive meets a solid one. Its surface outside every solid add primitive
 * is then cut out exactly, face by face. A point of the part is unclaimed
 * when it lies on that surface, so an edge is unclaimed where it bounds an
 * unclaimed face, and a face merged across both kinds of primitive is split
 * where the solid primitive ends. Hidden-line output keeps no link to the
 * edges it came from, so each output piece is traced back to the part's own
 * edges and silhouettes: at every point it takes the style of the nearest
 * edge projecting there when visible, and is drawn when hidden only where a
 * claimed edge lies hidden there.
 *
 * @internal
 */

import { A, O } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as replicad from "replicad";
import { add, scale } from "./vector.ts";
import type { OpenCascadeInstance, TopoDS_Shape } from "replicad-opencascadejs";
import type { V3 } from "./vector.ts";

type Shape3D = replicad.Shape3D;
type AnyShape = replicad.AnyShape;
type Box3 = readonly [min: V3, max: V3];
type Box2 = readonly [minX: number, minY: number, maxX: number, maxY: number];

const ON_SURFACE_DISTANCE = 1e-6;

const SLIVER_AREA_SHARE = 1e-6;

const STYLE_SAMPLE_SPACING = 0.1;
const MIN_SAMPLES = 8;
const MAX_SAMPLES = 400;

const STYLE_CHANGE_BISECTIONS = 30;

const CHORDS_PER_TRACED_CURVE = 64;
const NEAREST_POINT_GOLDEN_STEPS = 60;

const EXACT_MATCH = 1e-4;
const APPROXIMATE_MATCH_SHARE = 0.01;
const APPROXIMATE_MATCH_FLOOR = 1e-3;

/**
 * A piece of a part's surface outside every one of its solid add primitives,
 * with its bounds.
 *
 * @internal
 */
export type Piece = {
  readonly shape: AnyShape;
  readonly bounds: Box3;
};

/**
 * The unclaimed matter of a solid part with broken add primitives: the faces
 * only its broken primitives own, the faces merged across a solid and a
 * broken primitive (each with its unclaimed pieces), and every unclaimed piece
 * of its surface.
 *
 * @internal
 */
export interface Unclaimed {
  readonly brokenFaces: ReadonlyArray<replicad.Face>;
  readonly mixedFaces: ReadonlyArray<{ readonly face: replicad.Face; readonly pieces: ReadonlyArray<Piece> }>;
  readonly pieces: ReadonlyArray<Piece>;
}

/**
 * What the projection needs of one solid part when any part of the model has
 * unclaimed matter: its drawn edges (seams and degenerate edges left out),
 * its cylindrical faces (whose silhouettes the hidden-line pass draws), and
 * its unclaimed pieces (none for a part whose primitives are all solid).
 *
 * @internal
 */
export interface ClaimedPart {
  readonly cylinders: ReadonlyArray<replicad.Face>;
  readonly edges: ReadonlyArray<replicad.Edge>;
  readonly pieces: ReadonlyArray<Piece>;
}

/**
 * Per-primitive line styles of a built model: the faces never shaded, the
 * merged faces shaded only on their claimed part, and every solid part.
 *
 * @internal
 */
export interface Styles {
  readonly brokenFaces: ReadonlyArray<replicad.Face>;
  readonly mixedFaces: ReadonlyArray<{ readonly face: replicad.Face; readonly pieces: ReadonlyArray<Piece> }>;
  readonly parts: ReadonlyArray<ClaimedPart>;
}

const boundsOf = (shape: AnyShape): Box3 => {
  const [min, max] = shape.boundingBox.bounds;
  return [
    [min[0], min[1], min[2]],
    [max[0], max[1], max[2]],
  ];
};

const boxesMeet = ([aMin, aMax]: Box3, [bMin, bMax]: Box3): boolean =>
  A.every(
    [0, 1, 2] as const,
    (i) => aMin[i] <= bMax[i] + ON_SURFACE_DISTANCE && bMin[i] <= aMax[i] + ON_SURFACE_DISTANCE
  );

const inBox = (p: V3, [min, max]: Box3): boolean =>
  A.every([0, 1, 2] as const, (i) => p[i] >= min[i] - ON_SURFACE_DISTANCE && p[i] <= max[i] + ON_SURFACE_DISTANCE);

const outsideOf = (oc: OpenCascadeInstance, face: replicad.Face, solids: ReadonlyArray<Shape3D>) =>
  pipe(
    A.reduce(solids, face.wrapped as TopoDS_Shape, (rest, solid) => {
      const progress = new oc.Message_ProgressRange();
      const cut = new oc.BRepAlgoAPI_Cut(rest, solid.wrapped, progress);
      try {
        return cut.Shape();
      } finally {
        cut.delete();
        progress.delete();
      }
    }),
    (rest) => replicad.cast(rest).faces
  );

const areaOf = (faces: ReadonlyArray<replicad.Face>): number =>
  A.reduce(faces, 0, (total, face) => total + replicad.measureArea(face));

/**
 * The unclaimed matter of a built solid part: its surface outside every one
 * of its solid add primitives.
 *
 * **Details**
 *
 * A face clear of every broken primitive's bounds lies on the solid ones and
 * is claimed without a boolean. Any other face is cut by the solid
 * primitives near it: nothing left, it is claimed; all of it left, broken;
 * some left, mixed, and the part left over is its unclaimed piece. A face
 * lying on a solid primitive's boundary counts as on it, so the flap and tab
 * top surface keeps the flap's part claimed.
 *
 * @internal
 */
export const unclaimedOf = (options: {
  readonly shape: Shape3D;
  readonly solids: ReadonlyArray<Shape3D>;
  readonly broken: ReadonlyArray<Shape3D>;
}): Unclaimed => {
  const oc = replicad.getOC();
  const brokenBounds = A.map(options.broken, boundsOf);
  const solids = A.map(options.solids, (solid) => ({ solid, bounds: boundsOf(solid) }));
  const faces = A.map(options.shape.faces, (face) => {
    const bounds = boundsOf(face);
    if (!A.some(brokenBounds, (broken) => boxesMeet(bounds, broken))) {
      return { face, kind: "claimed" as const, pieces: A.empty<Piece>() };
    }
    const near = pipe(
      solids,
      A.filter((solid) => boxesMeet(bounds, solid.bounds)),
      A.map((solid) => solid.solid)
    );
    const outside = outsideOf(oc, face, near);
    const area = replicad.measureArea(face);
    const left = areaOf(outside);
    const kind =
      left <= area * SLIVER_AREA_SHARE ? "claimed" : left >= area * (1 - SLIVER_AREA_SHARE) ? "broken" : "mixed";
    return {
      face,
      kind,
      pieces:
        kind === "claimed"
          ? A.empty<Piece>()
          : A.map(outside, (piece): Piece => ({ shape: piece, bounds: boundsOf(piece) })),
    };
  });
  return {
    brokenFaces: pipe(
      faces,
      A.filter((face) => face.kind === "broken"),
      A.map((face) => face.face)
    ),
    mixedFaces: pipe(
      faces,
      A.filter((face) => face.kind === "mixed"),
      A.map((face) => ({ face: face.face, pieces: face.pieces }))
    ),
    pieces: A.flatMap(faces, (face) => face.pieces),
  };
};

/**
 * What the projection needs of one built solid part, read before the part is
 * compounded: its drawn edges, its cylindrical faces and its unclaimed pieces.
 *
 * @internal
 */
export const claimedPartOf = (options: {
  readonly shape: Shape3D;
  readonly unclaimed: O.Option<Unclaimed>;
}): ClaimedPart => {
  const oc = replicad.getOC();
  const faces = options.shape.faces;
  return {
    edges: pipe(
      faces,
      A.flatMap((face) =>
        A.filter(
          face.edges,
          (edge) => !oc.BRep_Tool.IsClosed(edge.wrapped, face.wrapped) && !oc.BRep_Tool.Degenerated(edge.wrapped)
        )
      ),
      A.dedupeWith((a, b) => a.isSame(b))
    ),
    cylinders: A.filter(faces, (face) => face.geomType === "CYLINDRE"),
    pieces: O.match(options.unclaimed, { onNone: A.empty<Piece>, onSome: (u) => u.pieces }),
  };
};

/**
 * A run of a stroke or projected piece, as fractions of its parameter range,
 * and whether it is claimed.
 *
 * **Gotchas**
 *
 * Runs are found by sampling the middles of equal steps and bisecting between
 * neighbouring samples that differ. The ends are never sampled: each takes
 * its nearest sample's value, since an end is often a vertex shared with an
 * edge of the other style.
 *
 * @internal
 */
export type Run = {
  readonly from: number;
  readonly to: number;
  readonly claimed: boolean;
};

const runsOf = (claimedAt: (t: number) => boolean, count: number): A.NonEmptyReadonlyArray<Run> => {
  const stepMiddle = (j: number) => (j + 0.5) / count;
  const values = A.makeBy(count, (j) => claimedAt(stepMiddle(j)));
  const bisect = (low: number, high: number, lowValue: boolean): number =>
    pipe(
      A.makeBy(STYLE_CHANGE_BISECTIONS, (i) => i),
      A.reduce([low, high] as const, ([a, b]) => {
        const middle = (a + b) / 2;
        return claimedAt(middle) === lowValue ? ([middle, b] as const) : ([a, middle] as const);
      }),
      ([a, b]) => (a + b) / 2
    );
  const first = values[0] ?? true;
  return pipe(
    A.makeBy(count - 1, (j) => j),
    A.reduce(A.of<Run>({ from: 0, to: 1, claimed: first }), (runs, j) => {
      const here = values[j] ?? first;
      const next = values[j + 1] ?? here;
      if (here === next) {
        return runs;
      }
      const cut = bisect(stepMiddle(j), stepMiddle(j + 1), here);
      const last = A.lastNonEmpty(runs);
      return A.append(A.appendAll(A.dropRight(runs, 1), [{ ...last, to: cut }]), { from: cut, to: 1, claimed: next });
    })
  );
};

const samplesFor = (length: number): number =>
  Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.ceil(length / STYLE_SAMPLE_SPACING)));

/**
 * Distance queries from points to shapes, through one reusable extrema tool.
 *
 * @internal
 */
export interface Surveyor {
  readonly dispose: () => void;
  readonly onAny: (pieces: ReadonlyArray<Piece>) => (point: V3) => boolean;
  readonly onShape: (shape: AnyShape) => (point: V3) => boolean;
}

/**
 * Build a {@link Surveyor}; dispose of it when done.
 *
 * @internal
 */
export const makeSurveyor = (): Surveyor => {
  const tool = new replicad.DistanceTool();
  const near = (shape: AnyShape, point: V3): boolean => {
    const vertex = replicad.makeVertex([...point]);
    try {
      return tool.distanceBetween(vertex, shape) <= ON_SURFACE_DISTANCE;
    } finally {
      vertex.delete();
    }
  };
  return {
    onAny: (pieces) => (point) => A.some(pieces, (piece) => inBox(point, piece.bounds) && near(piece.shape, point)),
    onShape: (shape) => (point) => near(shape, point),
    dispose: () => tool.delete(),
  };
};

const vecOf = (v: replicad.Vector): V3 => [v.x, v.y, v.z];
const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * The claimed stretches of a straight stroke lying on a mixed face: the
 * stroke itself when all of it is claimed, else one line per claimed run.
 *
 * **Gotchas**
 *
 * OCCT refuses an edge between coincident points, so a claimed run shorter
 * than `shortest` (model units) is not made.
 *
 * @internal
 */
export const claimedStrokes =
  (options: { readonly surveyor: Surveyor; readonly pieces: ReadonlyArray<Piece>; readonly shortest: number }) =>
  (edge: replicad.Edge): ReadonlyArray<replicad.Edge> => {
    if (edge.geomType !== "LINE") {
      return [edge];
    }
    const from = vecOf(edge.startPoint);
    const to = vecOf(edge.endPoint);
    const span: Box3 = [
      [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.min(from[2], to[2])],
      [Math.max(from[0], to[0]), Math.max(from[1], to[1]), Math.max(from[2], to[2])],
    ];
    const pieces = A.filter(options.pieces, (piece) => boxesMeet(span, piece.bounds));
    if (!A.isReadonlyArrayNonEmpty(pieces)) {
      return [edge];
    }
    const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const unclaimed = options.surveyor.onAny(pieces);
    const runs = runsOf((t) => !unclaimed(lerp(from, to, t)), samplesFor(length));
    if (A.every(runs, (run) => run.claimed)) {
      return [edge];
    }
    return pipe(
      runs,
      A.filter((run) => run.claimed && (run.to - run.from) * length >= options.shortest),
      A.map((run) => replicad.makeLine([...lerp(from, to, run.from)], [...lerp(from, to, run.to)]))
    );
  };

/**
 * A point on the view plane and how near it is to the eye along the view
 * direction (larger is nearer).
 *
 * @internal
 */
export type Viewed = { readonly x: number; readonly y: number; readonly w: number };

/**
 * Where the eye looks from: along a direction (orthographic) or from a point
 * (perspective).
 *
 * @internal
 */
export type Sight =
  | { readonly kind: "parallel"; readonly direction: V3 }
  | { readonly kind: "central"; readonly eye: V3 };

type Curve = {
  readonly at: (fractionOfParameterRange: number) => V3;
  readonly line: boolean;
  readonly dispose: () => void;
};

const curveOf = (oc: OpenCascadeInstance, edge: replicad.Edge): Curve => {
  const adaptor = new oc.BRepAdaptor_Curve(edge.wrapped);
  const first = adaptor.FirstParameter();
  const last = adaptor.LastParameter();
  return {
    at: (t) => {
      const point = adaptor.Value(first + (last - first) * t);
      try {
        return [point.X(), point.Y(), point.Z()];
      } finally {
        point.delete();
      }
    },
    line: edge.geomType === "LINE",
    dispose: () => adaptor.delete(),
  };
};

type Trace = {
  readonly at: (fraction: number) => Viewed;
  readonly polyline: A.NonEmptyReadonlyArray<Viewed>;
  readonly strayFromPolyline: number;
  readonly box: Box2;
};

const chordDistance = (x: number, y: number, a: Viewed, b: Viewed): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length < 1e-24 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length));
  return Math.hypot(a.x + t * dx - x, a.y + t * dy - y);
};

const STRAY_BOUND_PER_MIDDLE_STRAY = 2;

const traceOf = (at: (t: number) => Viewed, projectsStraight: boolean): Trace => {
  const steps = projectsStraight ? 1 : CHORDS_PER_TRACED_CURVE;
  const points = A.makeBy(steps + 1, (i) => at(i / steps));
  const strayFromPolyline = projectsStraight
    ? 0
    : STRAY_BOUND_PER_MIDDLE_STRAY *
      A.reduce(
        A.makeBy(steps, (i) => i),
        0,
        (most, i) => {
          const middle = at((i + 0.5) / steps);
          const a = points[i] ?? middle;
          const b = points[i + 1] ?? middle;
          return Math.max(most, chordDistance(middle.x, middle.y, a, b));
        }
      );
  return {
    at,
    polyline: points,
    strayFromPolyline,
    box: box2Of(points),
  };
};

const box2Of = (points: ReadonlyArray<{ readonly x: number; readonly y: number }>): Box2 =>
  A.reduce(
    points,
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY] as Box2,
    ([x0, y0, x1, y1], p) => [Math.min(x0, p.x), Math.min(y0, p.y), Math.max(x1, p.x), Math.max(y1, p.y)]
  );

const inBox2 = (x: number, y: number, [x0, y0, x1, y1]: Box2, slack: number): boolean =>
  x >= x0 - slack && x <= x1 + slack && y >= y0 - slack && y <= y1 + slack;

const boxes2Meet = ([a0, b0, a1, b1]: Box2, [c0, d0, c1, d1]: Box2, slack: number): boolean =>
  a0 <= c1 + slack && c0 <= a1 + slack && b0 <= d1 + slack && d0 <= b1 + slack;

const GOLDEN = (Math.sqrt(5) - 1) / 2;

const nearestOn = (trace: Trace, x: number, y: number, tolerance: number): O.Option<number> => {
  if (!inBox2(x, y, trace.box, tolerance + trace.strayFromPolyline)) {
    return O.none();
  }
  const steps = A.length(trace.polyline) - 1;
  const nearest: readonly [chord: number, gap: number] = [0, Number.POSITIVE_INFINITY];
  const [chord, gap] = A.reduce(
    A.makeBy(steps, (i) => i),
    nearest,
    (best, i) => {
      const a = trace.polyline[i];
      const b = trace.polyline[i + 1];
      const d = a === undefined || b === undefined ? Number.POSITIVE_INFINITY : chordDistance(x, y, a, b);
      return d < best[1] ? ([i, d] as const) : best;
    }
  );
  if (gap > tolerance + trace.strayFromPolyline) {
    return O.none();
  }
  const off = (t: number) => {
    const p = trace.at(t);
    return Math.hypot(p.x - x, p.y - y);
  };
  const [low, high] = A.reduce(
    A.makeBy(NEAREST_POINT_GOLDEN_STEPS, (i) => i),
    [Math.max(0, (chord - 0.5) / steps), Math.min(1, (chord + 1.5) / steps)] as const,
    ([a, b]) => {
      const c = b - GOLDEN * (b - a);
      const d = a + GOLDEN * (b - a);
      return off(c) < off(d) ? ([a, d] as const) : ([c, b] as const);
    }
  );
  const t = (low + high) / 2;
  return off(t) <= tolerance ? O.some(t) : O.none();
};

type Candidate = {
  readonly at: (t: number) => V3;
  readonly trace: Trace;
  readonly pieces: ReadonlyArray<Piece>;
  readonly silhouetteFace: O.Option<replicad.Face>;
};

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const minus = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const silhouettesOf = (
  oc: OpenCascadeInstance,
  face: replicad.Face,
  sight: Sight
): ReadonlyArray<readonly [V3, V3]> => {
  const surface = new oc.BRepAdaptor_Surface(face.wrapped, true);
  try {
    const cylinder = surface.Cylinder();
    const position = cylinder.Position();
    const read = (v: { X: () => number; Y: () => number; Z: () => number }): V3 => [v.X(), v.Y(), v.Z()];
    const origin = read(position.Location());
    const xAxis = read(position.XDirection());
    const yAxis = read(position.YDirection());
    const axis = read(position.Direction());
    const radius = cylinder.Radius();
    const [u0, u1, v0, v1] = [
      surface.FirstUParameter(),
      surface.LastUParameter(),
      surface.FirstVParameter(),
      surface.LastVParameter(),
    ];
    const angles: ReadonlyArray<number> =
      sight.kind === "parallel"
        ? pipe([dot(xAxis, sight.direction), dot(yAxis, sight.direction)] as const, ([a, b]) => {
            const seenAlongAxis = Math.hypot(a, b) < 1e-9;
            return seenAlongAxis ? A.empty<number>() : [Math.atan2(-a, b), Math.atan2(-a, b) + Math.PI];
          })
        : pipe(minus(origin, sight.eye), (q) => {
            const a = dot(xAxis, q);
            const b = dot(yAxis, q);
            const reach = Math.hypot(a, b);
            if (!(reach > radius)) {
              return A.empty<number>();
            }
            const phi = Math.atan2(b, a);
            const delta = Math.acos(-radius / reach);
            return [phi + delta, phi - delta];
          });
    const period = 2 * Math.PI;
    return pipe(
      angles,
      A.map((u) => u0 + ((((u - u0) % period) + period) % period)),
      A.filter((u) => u <= u1 + 1e-9),
      A.map((u) => {
        const rim = add(origin, add(scale(xAxis, radius * Math.cos(u)), scale(yAxis, radius * Math.sin(u))));
        return [add(rim, scale(axis, v0)), add(rim, scale(axis, v1))] as const;
      })
    );
  } finally {
    surface.delete();
  }
};

/**
 * The claimed and unclaimed runs of the solid compound's hidden-line pieces.
 *
 * @internal
 */
export interface PieceStyles {
  readonly dispose: () => void;
  readonly runs: (layer: "visible" | "hidden") => (piece: replicad.Edge) => A.NonEmptyReadonlyArray<Run>;
}

/**
 * Trace the solid compound's hidden-line pieces back to the parts' edges and
 * silhouettes and split each into claimed and unclaimed runs.
 *
 * **Details**
 *
 * At each point of a piece, every edge or silhouette of a solid part whose
 * projection passes there is found with the 3D point on it. A visible piece
 * takes the style of the nearest such point; a hidden piece is drawn where a
 * claimed point other than the visible one (the nearest, where a visible
 * piece also passes) lies there. Points away from every unclaimed piece's
 * projected bounds are claimed without a search.
 *
 * **Gotchas**
 *
 * OCCT's hidden-line pass returns lines and conics exactly, but approximates
 * a curve seen in perspective by a spline that strays from the true
 * projection by up to about a hundredth of its size. A spline piece is
 * therefore matched to an edge's projection within
 * `APPROXIMATE_MATCH_SHARE` of its size (at least `APPROXIMATE_MATCH_FLOOR`)
 * and every other piece within `EXACT_MATCH` model units.
 *
 * @internal
 */
export const pieceStyles = (options: {
  readonly oc: OpenCascadeInstance;
  readonly styles: Styles;
  readonly view: (p: V3) => Viewed;
  readonly sight: Sight;
  readonly surveyor: Surveyor;
  readonly visible: ReadonlyArray<replicad.Edge>;
}): PieceStyles => {
  const { oc, styles, view, surveyor } = options;
  const curves = A.empty<Curve>();
  const keep = (curve: Curve): Curve => {
    curves.push(curve);
    return curve;
  };
  const unclaimedRegions: ReadonlyArray<Box2> = pipe(
    styles.parts,
    A.flatMap((part) => part.pieces),
    A.map(({ bounds: [min, max] }) =>
      pipe(
        A.makeBy(
          8,
          (corner): V3 => [
            (corner & 1) === 0 ? min[0] : max[0],
            (corner & 2) === 0 ? min[1] : max[1],
            (corner & 4) === 0 ? min[2] : max[2],
          ]
        ),
        A.map(view),
        box2Of
      )
    )
  );
  const candidatesNearUnclaimed: ReadonlyArray<Candidate> = pipe(
    styles.parts,
    A.flatMap((part) => [
      ...A.map(part.edges, (edge) => {
        const curve = keep(curveOf(oc, edge));
        return {
          at: curve.at,
          trace: traceOf((t) => view(curve.at(t)), curve.line),
          pieces: part.pieces,
          silhouetteFace: O.none<replicad.Face>(),
        };
      }),
      ...A.flatMap(part.cylinders, (face) =>
        A.map(silhouettesOf(oc, face, options.sight), ([from, to]) => {
          const at = (t: number) => lerp(from, to, t);
          return { at, trace: traceOf((t) => view(at(t)), true), pieces: part.pieces, silhouetteFace: O.some(face) };
        })
      ),
    ]),
    A.filter((candidate) =>
      A.some(unclaimedRegions, (region) => boxes2Meet(candidate.trace.box, region, APPROXIMATE_MATCH_FLOOR))
    )
  );
  const flat =
    (curve: Curve) =>
    (t: number): Viewed => {
      const [x, y] = curve.at(t);
      return { x, y, w: 0 };
    };
  const toleranceOf = (piece: replicad.Edge, trace: Trace): number => {
    const type = piece.geomType;
    if (type === "LINE" || type === "CIRCLE" || type === "ELLIPSE") {
      return EXACT_MATCH;
    }
    const [x0, y0, x1, y1] = trace.box;
    return Math.max(APPROXIMATE_MATCH_FLOOR, APPROXIMATE_MATCH_SHARE * Math.hypot(x1 - x0, y1 - y0));
  };
  let shown: O.Option<ReadonlyArray<{ readonly trace: Trace; readonly tolerance: number }>> = O.none();
  const visiblePieces = () =>
    O.getOrElse(shown, () => {
      const traced = A.map(options.visible, (piece) => {
        const curve = keep(curveOf(oc, piece));
        const trace = traceOf(flat(curve), curve.line);
        return { trace, tolerance: toleranceOf(piece, trace) };
      });
      shown = O.some(traced);
      return traced;
    });
  const visibleAt = (x: number, y: number, tolerance: number): boolean =>
    A.some(visiblePieces(), (piece) => O.isSome(nearestOn(piece.trace, x, y, Math.max(tolerance, piece.tolerance))));
  type Match = { readonly point: V3; readonly w: number; readonly pieces: ReadonlyArray<Piece> };
  const byNearness = Order.flip(Order.mapInput(Order.Number, (match: Match) => match.w));
  const claimedAt =
    (layer: "visible" | "hidden", tolerance: number) =>
    (x: number, y: number): boolean => {
      if (!A.some(unclaimedRegions, (region) => inBox2(x, y, region, tolerance))) {
        return true;
      }
      const matches = pipe(
        candidatesNearUnclaimed,
        A.map((candidate) =>
          pipe(
            nearestOn(candidate.trace, x, y, tolerance),
            O.map(candidate.at),
            O.filter((point) =>
              O.match(candidate.silhouetteFace, { onNone: () => true, onSome: (face) => surveyor.onShape(face)(point) })
            ),
            O.map((point): Match => ({ point, w: view(point).w, pieces: candidate.pieces }))
          )
        ),
        A.getSomes,
        A.sort(byNearness)
      );
      const claimed = (match: Match) => !surveyor.onAny(match.pieces)(match.point);
      if (!A.isReadonlyArrayNonEmpty(matches)) {
        return true;
      }
      if (layer === "visible") {
        return claimed(A.headNonEmpty(matches));
      }
      const behind = A.length(matches) > 1 && visibleAt(x, y, tolerance) ? A.drop(matches, 1) : matches;
      return A.some(behind, claimed);
    };
  return {
    runs: (layer) => (piece) => {
      const curve = keep(curveOf(oc, piece));
      const trace = traceOf(flat(curve), curve.line);
      const tolerance = toleranceOf(piece, trace);
      if (!A.some(unclaimedRegions, (region) => boxes2Meet(trace.box, region, tolerance))) {
        return A.of({ from: 0, to: 1, claimed: true });
      }
      const length = A.reduce(
        A.makeBy(A.length(trace.polyline) - 1, (i) => i),
        0,
        (total, i) => {
          const a = trace.polyline[i];
          const b = trace.polyline[i + 1];
          return a === undefined || b === undefined ? total : total + Math.hypot(b.x - a.x, b.y - a.y);
        }
      );
      const at = claimedAt(layer, tolerance);
      return runsOf((t) => {
        const p = trace.at(t);
        return at(p.x, p.y);
      }, samplesFor(length));
    },
    dispose: () => A.forEach(curves, (curve) => curve.dispose()),
  };
};

/**
 * The line of sight the hidden-line pass finds silhouettes for: along the
 * camera's unit view direction (from the target toward the eye) for an
 * orthographic camera, or from an eye point for a perspective one.
 *
 * **Gotchas**
 *
 * The pass projects a perspective view with the eye `focus` along the view
 * direction from the target, but finds curved faces' silhouettes as seen
 * from `focus` along it from its own world origin: the model origin, or the
 * `origin` it was run about (a camera's target, for which the two eyes are
 * one). The silhouettes it draws are those, so they are traced back from
 * the same eye.
 *
 * @internal
 */
export const sightOf = (options: {
  readonly direction: V3;
  readonly focus: O.Option<number>;
  readonly origin: O.Option<V3>;
}): Sight =>
  O.match(options.focus, {
    onNone: () => ({ kind: "parallel", direction: options.direction }),
    onSome: (focus) => {
      const along = scale(options.direction, focus);
      return {
        kind: "central",
        eye: O.getOrElse(
          O.map(options.origin, (origin) => add(origin, along)),
          () => along
        ),
      };
    },
  });
