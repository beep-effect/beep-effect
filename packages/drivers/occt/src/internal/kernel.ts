/**
 * Private replicad / opencascade.js glue: build parts from the technical spec,
 * run hidden-line removal through a driver-owned camera, and canonicalise the
 * projected segments.
 *
 * @internal
 */

import {
  BandInk,
  BandRun,
  bandRunLengths,
  coverageOf,
  gradedExtents,
  HiddenLinePassAbout,
  inkOrderSteps,
  inkTwins,
  ladderPitch,
  legibleShading,
  nearestOutlineDistance,
  ShadingBand,
  ShadingCoverage,
  ShadingRoom,
  ShadingSkipped,
  ShadingStretchSkip,
  ShadingStretchSkipReason,
} from "@beep/technical-drawing";
import { A, N, O } from "@beep/utils";
import { flow, pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as replicad from "replicad";
import { OcctError } from "../Occt.errors.ts";
import { BoundingBox, EdgeSet, ModelSummary, Primitive } from "../Occt.models.ts";
import { claimedPartOf, claimedStrokes, makeSurveyor, pieceStyles, sightOf, unclaimedOf } from "./claim.ts";
import { hasBandRoom, hatchCompound, probeEdges, roomColumns } from "./shading.ts";
import { add, cross, scale } from "./vector.ts";
import type { ShadingProbe } from "@beep/technical-drawing";
import type { HLRBRep_HLRToShape, OpenCascadeInstance, TopoDS_Shape } from "replicad-opencascadejs";
import type {
  Camera,
  ModelSpec,
  OverlayLine,
  OverlayStyle,
  Part,
  PartLineStyle,
  Rotation,
  Segment2,
  ShadingPlan,
} from "../Occt.models.ts";
import type { Run, Styles, Surveyor, Unclaimed, Viewed } from "./claim.ts";
import type { GroupBeyond, HatchedFace, StretchPiece } from "./shading.ts";
import type { V3 } from "./vector.ts";

type Shape3D = replicad.Shape3D;
type AnyShape = replicad.AnyShape;

const CURVE_SAMPLES = 24;

const SHORTEST_STROKE = 1e-6;
const DECIMALS = 3;

const round = (value: number): number => {
  const possiblyNegativeZero = N.round(DECIMALS)(value);
  return possiblyNegativeZero === 0 ? 0 : possiblyNegativeZero;
};

const place = (shape: Shape3D, rotate: ReadonlyArray<Rotation>, translate: readonly [number, number, number]) =>
  pipe(
    rotate,
    A.reduce(shape, (acc, r) => acc.rotate(r.degrees, [...r.origin], [...r.axis]) as Shape3D),
    (rotated) => rotated.translate([...translate]) as Shape3D
  );

const buildPrimitive: (primitive: Primitive) => Shape3D = Primitive.match({
  box: (box) => place(replicad.makeBox([...box.min], [...box.max]), box.rotate, box.translate),
  prism: (prism) => {
    const face = replicad.makePolygon(A.map(prism.profile, (p) => [...p] as const));
    const solid = replicad.basicFaceExtrusion(face, new replicad.Vector([...prism.extrusion]));
    return place(solid, prism.rotate, prism.translate);
  },
  cylinder: (cylinder) =>
    place(
      replicad.makeCylinder(cylinder.radius, cylinder.height, [...cylinder.base], [...cylinder.axis]),
      cylinder.rotate,
      cylinder.translate
    ),
});

const buildPart = (add: ReadonlyArray<Primitive>, subtract: ReadonlyArray<Primitive>): Shape3D => {
  const [first, ...rest] = add;
  if (first === undefined) {
    throw OcctError.make({ reason: "solid-build", message: "A part needs at least one primitive to add." });
  }
  const fused = pipe(
    rest,
    A.reduce(buildPrimitive(first), (acc, p) => acc.fuse(buildPrimitive(p)))
  );
  return pipe(
    subtract,
    A.reduce(fused, (acc, p) => acc.cut(buildPrimitive(p)))
  ).simplify();
};

/**
 * One built part, the line style it is drawn in, and, for a solid part with
 * broken add primitives, its unclaimed matter.
 *
 * @internal
 */
export interface BuiltPart {
  readonly lineStyle: PartLineStyle;
  readonly shape: Shape3D;
  readonly unclaimed: O.Option<Unclaimed>;
}

/**
 * The parts of a model gathered by line style: the solid (claimed) parts and
 * the broken-line (unclaimed) parts, each as one solid or compound, or none,
 * plus the per-primitive line styles when any solid part has unclaimed matter.
 *
 * @internal
 */
export interface BuiltModel {
  readonly broken: O.Option<Shape3D>;
  readonly solid: O.Option<Shape3D>;
  readonly styles: O.Option<Styles>;
}

const styleIn =
  (part: Part) =>
  (primitive: Primitive): PartLineStyle =>
    O.getOrElse(primitive.lineStyle, () => part.lineStyle);

const unclaimedIn = (part: Part, shape: Shape3D): O.Option<Unclaimed> => {
  const style = styleIn(part);
  if (part.lineStyle === "broken" || !A.some(part.add, (primitive) => style(primitive) === "broken")) {
    return O.none();
  }
  const built = (lineStyle: PartLineStyle) =>
    pipe(
      part.add,
      A.filter((primitive) => style(primitive) === lineStyle),
      A.map(buildPrimitive)
    );
  const solids = built("solid");
  const broken = built("broken");
  try {
    if (!A.every(solids, (solid) => solid instanceof replicad.Solid)) {
      throw OcctError.make({
        reason: "solid-build",
        message: `Part "${part.name}" has a primitive that is not a solid, so its faces cannot be cut by it.`,
      });
    }
    return pipe(
      unclaimedOf({ shape, solids, broken }),
      O.liftPredicate((unclaimed) => A.isReadonlyArrayNonEmpty(unclaimed.pieces))
    );
  } finally {
    A.forEach([...solids, ...broken], (primitive) => primitive.delete());
  }
};

/**
 * Build every part of a spec as its own solid, in spec order, with the
 * unclaimed matter of each solid part that has broken add primitives.
 *
 * **Details**
 *
 * A primitive's `lineStyle`, absent, is its part's. A solid part with a
 * broken add primitive is still fused as one solid, so no seam line crosses
 * where the primitives meet; its surface outside every solid add primitive
 * is then cut out face by face. Without a primitive-level broken style the
 * parts and their output are exactly what they were before primitive styles
 * existed.
 *
 * **Gotchas**
 *
 * Booleans leave seam edges where coplanar faces met, so each part is
 * simplified after its booleans; otherwise the hidden-line pass draws a line
 * the article does not have. `unclaimed` is none for a broken part, for a
 * solid part without a broken primitive, and for one whose broken primitives
 * lie wholly inside its solid ones.
 *
 * @internal
 */
export const buildParts = (spec: ModelSpec): ReadonlyArray<BuiltPart> =>
  A.map(spec.parts, (part) => {
    const shape = buildPart(part.add, part.subtract);
    return { lineStyle: part.lineStyle, shape, unclaimed: unclaimedIn(part, shape) };
  });

const compoundOf = (shapes: ReadonlyArray<Shape3D>): O.Option<Shape3D> => {
  if (A.length(shapes) === 0) {
    return O.none();
  }
  const compound = A.length(shapes) === 1 ? shapes[0] : replicad.makeCompound([...shapes]);
  if (!(compound instanceof replicad.Compound || compound instanceof replicad.Solid)) {
    throw OcctError.make({ reason: "solid-build", message: "The parts did not form a solid or a compound." });
  }
  return O.some(compound);
};

const shapesIn = (parts: ReadonlyArray<BuiltPart>, lineStyle: PartLineStyle): ReadonlyArray<Shape3D> =>
  pipe(
    parts,
    A.filter((part) => part.lineStyle === lineStyle),
    A.map((part) => part.shape)
  );

const stylesOf = (parts: ReadonlyArray<BuiltPart>): O.Option<Styles> =>
  A.some(parts, (part) => O.isSome(part.unclaimed))
    ? O.some({
        brokenFaces: A.flatMap(parts, (part) =>
          O.match(part.unclaimed, { onNone: A.empty<replicad.Face>, onSome: (u) => u.brokenFaces })
        ),
        mixedFaces: A.flatMap(parts, (part) =>
          O.match(part.unclaimed, {
            onNone: A.empty<Styles["mixedFaces"][number]>,
            onSome: (u) => u.mixedFaces,
          })
        ),
        parts: pipe(
          parts,
          A.filter((part) => part.lineStyle === "solid"),
          A.map((part) => claimedPartOf({ shape: part.shape, unclaimed: part.unclaimed }))
        ),
      })
    : O.none();

/**
 * Gather built parts into one compound per line style.
 *
 * **Details**
 *
 * `makeCompound` disposes the part shapes it is given, so each part goes into
 * exactly one compound and must not be read afterwards; the per-primitive
 * styles are read from the parts first. With no broken parts the solid
 * compound is exactly the compound the kernel always built.
 *
 * **Gotchas**
 *
 * The styles hold the parts' own faces and edges, which the compound keeps,
 * so they stay valid after compounding.
 *
 * @internal
 */
export const compoundParts = (parts: ReadonlyArray<BuiltPart>): BuiltModel => {
  const styles = stylesOf(parts);
  return {
    styles,
    solid: compoundOf(shapesIn(parts, "solid")),
    broken: compoundOf(shapesIn(parts, "broken")),
  };
};

/**
 * Build every part of a spec and gather them into one compound per line style.
 *
 * @internal
 */
export const buildCompound: (spec: ModelSpec) => BuiltModel = flow(buildParts, compoundParts);

const TOUCHING_PARTS_VOLUME_NOISE = 1e-6;

const boxesMeet = (a: Shape3D, b: Shape3D): boolean => {
  const [aMin, aMax] = a.boundingBox.bounds;
  const [bMin, bMax] = b.boundingBox.bounds;
  return A.every([0, 1, 2] as const, (i) => aMin[i] < bMax[i] && bMin[i] < aMax[i]);
};

const commonVolume = (a: Shape3D, b: Shape3D): number => {
  const common = a.intersect(b);
  try {
    return replicad.measureVolume(common);
  } finally {
    common.delete();
  }
};

/**
 * Count the pairs of parts whose common volume exceeds the overlap tolerance.
 *
 * **Details**
 *
 * Reads the part shapes, so it must run before {@link compoundParts} disposes
 * them. Pairs whose bounding boxes do not meet are skipped without a boolean.
 *
 * @internal
 */
export const countOverlaps = (parts: ReadonlyArray<BuiltPart>): number => {
  let count = 0;
  for (const [index, part] of A.entries(parts)) {
    for (const other of A.drop(parts, index + 1)) {
      if (boxesMeet(part.shape, other.shape) && commonVolume(part.shape, other.shape) > TOUCHING_PARTS_VOLUME_NOISE) {
        count++;
      }
    }
  }
  return count;
};

/**
 * Measure a built model.
 *
 * **Details**
 *
 * `makeCompound` disposes the part shapes it is given, so every measurement
 * reads the compounds, never the parts: volumes and topology counts are
 * summed and the bounding boxes are unioned. With only solid parts this is
 * the single compound's measurement.
 *
 * @internal
 */
export const summarize = (input: { readonly built: BuiltModel; readonly partOverlaps: number }): ModelSummary => {
  const shapes = [...O.toArray(input.built.solid), ...O.toArray(input.built.broken)];
  const bounds = A.map(shapes, (shape) => shape.boundingBox.bounds);
  const lowest = (axis: 0 | 1 | 2) => round(Math.min(...A.map(bounds, ([min]) => min[axis])));
  const highest = (axis: 0 | 1 | 2) => round(Math.max(...A.map(bounds, ([, max]) => max[axis])));
  const sum = (measure: (shape: Shape3D) => number) => A.reduce(shapes, 0, (total, shape) => total + measure(shape));
  return ModelSummary.make({
    boundingBox: BoundingBox.make({
      min: [lowest(0), lowest(1), lowest(2)],
      max: [highest(0), highest(1), highest(2)],
    }),
    volume: round(sum(replicad.measureVolume)),
    faceCount: sum((shape) => shape.faces.length),
    edgeCount: sum((shape) => shape.edges.length),
    partOverlaps: input.partOverlaps,
  });
};

const normalize = (v: readonly [number, number, number]): [number, number, number] => {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!(length > 0)) {
    throw OcctError.make({ reason: "projection", message: "Camera vectors must be non-zero." });
  }
  return [v[0] / length, v[1] / length, v[2] / length];
};

/**
 * The point a camera's hidden-line pass runs about, when it is not the model's
 * own origin.
 *
 * **Details**
 *
 * OCCT's perspective pass finds curved faces' silhouettes, and which way
 * every face turns, from an eye `focus` along the view direction from its
 * world origin, not from the projector's origin (the camera's target). A
 * camera whose `hiddenLinePassAbout` is `target` (a two-point camera, whose
 * target stands well above or below the model) runs the pass about its own
 * target: the model is moved by −target and the projector stands at the
 * origin, so the pass's eye is the camera's own and the drawn frame is
 * unchanged. A camera left at `origin` keeps the model where it is, so its
 * renders stay byte-equal to the ones written before the field existed.
 *
 * @internal
 */
const passOrigin = (camera: Camera): O.Option<V3> =>
  HiddenLinePassAbout.match(camera.hiddenLinePassAbout, {
    origin: (): O.Option<V3> => O.none(),
    target: () => O.some(camera.target),
  });

const heldAbout =
  (oc: OpenCascadeInstance, origin: O.Option<V3>) =>
  (shape: TopoDS_Shape): TopoDS_Shape =>
    O.match(origin, {
      onNone: () => shape,
      onSome: ([x, y, z]) => {
        const by = new oc.gp_Vec(-x, -y, -z);
        const trsf = new oc.gp_Trsf();
        trsf.SetTranslation(by);
        const moved = new oc.BRepBuilderAPI_Transform(shape, trsf, false, false).ModifiedShape(shape);
        by.delete();
        trsf.delete();
        return moved;
      },
    });

/**
 * Build the OCCT projector for a camera.
 *
 * **Details**
 *
 * OCCT's `gp_Ax2` for a projector has its origin at the view-plane point, its
 * main direction pointing from the target toward the eye, and its X direction
 * as the horizontal screen axis. The screen Y axis is then `direction × x`,
 * which is the camera's up vector. With a focus, `HLRAlgo_Projector` places
 * the eye `focus` units along the direction and projects in perspective. A
 * camera the pass runs about its own target ({@link passOrigin}) sees the
 * model moved by −target, so its projector stands at the origin.
 *
 * @internal
 */
const makeProjector = (oc: OpenCascadeInstance, camera: Camera) => {
  const direction = normalize(camera.eye);
  const up = normalize(camera.up);
  const right = normalize(cross(up, direction));
  const at = O.match(passOrigin(camera), { onNone: () => camera.target, onSome: (): V3 => [0, 0, 0] });
  const origin = new oc.gp_Pnt(at[0], at[1], at[2]);
  const mainDir = new oc.gp_Dir(direction[0], direction[1], direction[2]);
  const xDir = new oc.gp_Dir(right[0], right[1], right[2]);
  const ax2 = new oc.gp_Ax2(origin, mainDir, xDir);
  return O.match(camera.focus, {
    onNone: () => new oc.HLRAlgo_Projector(ax2),
    onSome: (focus) => new oc.HLRAlgo_Projector(ax2, focus),
  });
};

const edgesOf = (shape: Parameters<typeof replicad.cast>[0], oc: OpenCascadeInstance) => {
  if (shape.IsNull()) {
    return [] as ReadonlyArray<replicad.Edge>;
  }
  const edges = replicad.cast(shape).edges;
  A.forEach(edges, (e) => oc.BRepLib.BuildCurves3d(e.wrapped));
  return edges;
};

const segmentOrder = Order.mapInput(
  Order.combineAll([
    Order.mapInput(Order.Number, (s: Segment2) => s[0]),
    Order.mapInput(Order.Number, (s: Segment2) => s[1]),
    Order.mapInput(Order.Number, (s: Segment2) => s[2]),
    Order.mapInput(Order.Number, (s: Segment2) => s[3]),
  ]),
  (s: Segment2) => s
);

const canonical = (a: readonly [number, number], b: readonly [number, number]): Segment2 => {
  const p: readonly [number, number] = [round(a[0]), round(a[1])];
  const q: readonly [number, number] = [round(b[0]), round(b[1])];
  const pFirst = p[0] < q[0] || (p[0] === q[0] && p[1] <= q[1]);
  return pFirst ? [p[0], p[1], q[0], q[1]] : [q[0], q[1], p[0], p[1]];
};

type RawSegment = readonly [x1: number, y1: number, x2: number, y2: number];

const sampled = (edges: ReadonlyArray<replicad.Edge>): ReadonlyArray<RawSegment> =>
  A.flatMap(edges, (edge) => {
    const samples = edge.geomType === "LINE" ? 1 : CURVE_SAMPLES;
    return A.makeBy(samples, (i): RawSegment => {
      const a = edge.pointAt(i / samples);
      const b = edge.pointAt((i + 1) / samples);
      return [a.x, a.y, b.x, b.y];
    });
  });

const isSharedBoundaryRepeat = (a: Segment2, b: Segment2): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

const canonicalSegments: (segments: ReadonlyArray<RawSegment>) => ReadonlyArray<Segment2> = flow(
  A.map(([x1, y1, x2, y2]: RawSegment) => canonical([x1, y1], [x2, y2])),
  A.filter((s) => !(s[0] === s[2] && s[1] === s[3])),
  A.sort(segmentOrder),
  A.dedupeAdjacentWith(isSharedBoundaryRepeat)
);

const toSegments = flow(sampled, canonicalSegments);

const chordsOf =
  (edge: replicad.Edge) =>
  (run: Run): ReadonlyArray<RawSegment> => {
    const span = run.to - run.from;
    const samples = edge.geomType === "LINE" ? 1 : Math.max(1, Math.ceil(CURVE_SAMPLES * span - 1e-9));
    return A.makeBy(samples, (i): RawSegment => {
      const a = edge.pointAt(run.from + (span * i) / samples);
      const b = edge.pointAt(run.from + (span * (i + 1)) / samples);
      return [a.x, a.y, b.x, b.y];
    });
  };

const visibleEdges = (shapes: HLRBRep_HLRToShape, own: TopoDS_Shape, oc: OpenCascadeInstance) => [
  ...edgesOf(shapes.VCompound(own), oc),
  ...edgesOf(shapes.Rg1LineVCompound(own), oc),
  ...edgesOf(shapes.OutLineVCompound(own), oc),
];

type ViewedLine = {
  readonly point: readonly [number, number];
  readonly along: readonly [number, number];
  readonly length: number;
  readonly depth: readonly [startDistanceFromEye: number, endDistanceFromEye: number];
};

type ProbeLine = ViewedLine & { readonly probe: ShadingProbe };

type PlannedStroke = HatchedFace<ProbeLine>["stretches"][number]["planned"][number];

type SkippedStretch = HatchedFace<ProbeLine>["skipped"][number];

type RoomColumn = ReturnType<typeof roomColumns>[number];

const viewedLine = (camera: Camera, from: V3, to: V3): O.Option<ViewedLine> => {
  const direction = normalize(camera.eye);
  const right = normalize(cross(normalize(camera.up), direction));
  const up = cross(direction, right);
  const frame = (p: V3): readonly [number, number, number] => {
    const d: V3 = [p[0] - camera.target[0], p[1] - camera.target[1], p[2] - camera.target[2]];
    return [
      d[0] * right[0] + d[1] * right[1] + d[2] * right[2],
      d[0] * up[0] + d[1] * up[1] + d[2] * up[2],
      d[0] * direction[0] + d[1] * direction[1] + d[2] * direction[2],
    ];
  };
  const project = (p: V3): { readonly at: readonly [number, number]; readonly depth: number } => {
    const [u, v, w] = frame(p);
    return O.match(camera.focus, {
      onNone: () => ({ at: [u, v] as const, depth: 1 }),
      onSome: (focus) => ({ at: [(u * focus) / (focus - w), (v * focus) / (focus - w)] as const, depth: focus - w }),
    });
  };
  const a = project(from);
  const b = project(to);
  const length = Math.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]);
  return length < 1e-9
    ? O.none()
    : O.some({
        point: a.at,
        length,
        along: [(b.at[0] - a.at[0]) / length, (b.at[1] - a.at[1]) / length],
        depth: [a.depth, b.depth],
      });
};

const projectedProbe = (camera: Camera, probe: ShadingProbe): O.Option<ProbeLine> =>
  O.map(viewedLine(camera, probe.from, probe.to), (line) => ({ probe, ...line }));

const viewOf = (camera: Camera): ((p: V3) => Viewed) => {
  const direction = normalize(camera.eye);
  const right = normalize(cross(normalize(camera.up), direction));
  const up = cross(direction, right);
  return (p) => {
    const d: V3 = [p[0] - camera.target[0], p[1] - camera.target[1], p[2] - camera.target[2]];
    const u = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
    const v = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
    const w = d[0] * direction[0] + d[1] * direction[1] + d[2] * direction[2];
    return O.match(camera.focus, {
      onNone: () => ({ x: u, y: v, w }),
      onSome: (focus) => ({ x: (u * focus) / (focus - w), y: (v * focus) / (focus - w), w }),
    });
  };
};

const fractionAt = (line: ViewedLine, x: number, y: number): number => {
  const viewPlaneFraction = Math.min(
    Math.max(((x - line.point[0]) * line.along[0] + (y - line.point[1]) * line.along[1]) / line.length, 0),
    1
  );
  const [near, far] = line.depth;
  return (viewPlaneFraction * near) / (viewPlaneFraction * near + (1 - viewPlaneFraction) * far);
};

const offsetAt = (line: ProbeLine, x: number, y: number): number =>
  line.probe.start + fractionAt(line, x, y) * (line.probe.end - line.probe.start);

const PIECE_BOUNDARY_GAP = 1e-6;

const regionsOf = (options: {
  readonly camera: Camera;
  readonly probes: ReadonlyArray<{ readonly probe: ShadingProbe; readonly pieces: ReadonlyArray<Segment2> }>;
  readonly outlines: ReadonlyArray<Segment2>;
}): HashMap.HashMap<number, ReadonlyArray<A.NonEmptyReadonlyArray<StretchPiece<ProbeLine>>>> => {
  type End = readonly [x: number, y: number, offset: number];
  type Piece = Omit<StretchPiece<ProbeLine>, "row"> & {
    readonly face: number;
    readonly height: number;
    readonly ends: readonly [End, End];
  };
  const pieces: ReadonlyArray<Piece> = A.flatMap(options.probes, ({ probe, pieces }) =>
    O.getOrElse(
      O.map(projectedProbe(options.camera, probe), (line): ReadonlyArray<Piece> => {
        // decision: probes-pass-as-short-pieces
        type Span = { readonly from: number; readonly to: number; readonly ends: readonly [End, End] };
        const runs = pipe(
          pieces,
          A.map((s): Span => {
            const a = offsetAt(line, s[0], s[1]);
            const b = offsetAt(line, s[2], s[3]);
            return a <= b
              ? { from: a, to: b, ends: [[s[0], s[1], a] as const, [s[2], s[3], b] as const] }
              : { from: b, to: a, ends: [[s[2], s[3], b] as const, [s[0], s[1], a] as const] };
          }),
          A.sort(Order.mapInput(Order.Number, (run: Span) => run.from)),
          A.reduce(
            A.empty<Span>(),
            (joined: ReadonlyArray<Span>, run): ReadonlyArray<Span> =>
              pipe(
                A.last(joined),
                O.filter((last) => run.from - last.to <= PIECE_BOUNDARY_GAP),
                O.match({
                  onNone: () => A.append(joined, run),
                  onSome: (last): ReadonlyArray<Span> => {
                    const ends: readonly [End, End] = run.to > last.to ? [last.ends[0], run.ends[1]] : last.ends;
                    return A.append(A.dropRight(joined, 1), { from: last.from, to: Math.max(last.to, run.to), ends });
                  },
                })
              )
          )
        );
        return A.map(
          runs,
          (run): Piece => ({
            face: probe.face,
            height: probe.height,
            ends: run.ends,
            from: run.from,
            to: run.to,
            low: probe.height - probe.reach,
            high: probe.height + probe.reach,
            probes: [line],
          })
        );
      }),
      A.empty<Piece>
    )
  );
  const pointAt = (piece: Piece, offset: number): readonly [number, number] => {
    const [[x1, y1, o1], [x2, y2, o2]] = piece.ends;
    const t = Math.abs(o2 - o1) < 1e-12 ? 0.5 : (offset - o1) / (o2 - o1);
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  };
  const side = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
    (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const crossesOutline = ([px, py]: readonly [number, number], [qx, qy]: readonly [number, number]): boolean =>
    A.some(options.outlines, ([ax, ay, bx, by]) => {
      if (
        Math.max(ax, bx) < Math.min(px, qx) ||
        Math.min(ax, bx) > Math.max(px, qx) ||
        Math.max(ay, by) < Math.min(py, qy) ||
        Math.min(ay, by) > Math.max(py, qy)
      ) {
        return false;
      }
      return (
        side(ax, ay, bx, by, px, py) * side(ax, ay, bx, by, qx, qy) < 0 &&
        side(px, py, qx, qy, ax, ay) * side(px, py, qx, qy, bx, by) < 0
      );
    });
  type Rowed = Piece & { readonly row: number };
  // decision: bands-keep-to-their-visible-area
  const linked = (p: Rowed, q: Rowed): boolean => {
    if (Math.abs(p.row - q.row) !== 1) {
      return false;
    }
    const lo = Math.max(p.from, q.from);
    const hi = Math.min(p.to, q.to);
    if (!(lo < hi)) {
      return false;
    }
    const middle = (lo + hi) / 2;
    return !crossesOutline(pointAt(p, middle), pointAt(q, middle));
  };
  const areasOf = (group: ReadonlyArray<Piece>): ReadonlyArray<A.NonEmptyReadonlyArray<StretchPiece<ProbeLine>>> => {
    const heights = pipe(
      A.map(group, (piece) => piece.height),
      A.dedupe,
      A.sort(Order.Number)
    );
    const rowed: ReadonlyArray<Rowed> = A.map(group, (piece) => ({
      ...piece,
      // Every height came from this same group; an absent row is an invariant failure, never row zero.
      row: O.getOrThrow(A.findFirstIndex(heights, (h) => h === piece.height)),
    }));
    const graph = Graph.undirected<Rowed, null>((mutable) => {
      const nodes = A.map(rowed, (piece) => Graph.addNode(mutable, piece));
      A.forEach(rowed, (p, i) =>
        A.forEach(rowed, (q, j) => {
          if (i < j && linked(p, q)) {
            Graph.addEdge(mutable, nodes[i] ?? 0, nodes[j] ?? 0, null);
          }
        })
      );
    });
    return pipe(
      Graph.connectedComponents(graph),
      A.map(
        flow(
          A.map((index: Graph.NodeIndex) => Graph.getNode(graph, index)),
          A.getSomes,
          A.map(({ face: _face, height: _height, ends: _ends, ...piece }): StretchPiece<ProbeLine> => piece)
        )
      ),
      A.filter(A.isArrayNonEmpty)
    );
  };
  return pipe(
    pieces,
    A.filter((piece) => piece.to - piece.from > 0),
    A.groupBy((piece) => `${piece.face}`),
    R.toEntries,
    A.map(([face, group]) => [Number(face), areasOf(group)] as const),
    HashMap.fromIterable
  );
};

const crosses = (line: ProbeLine, piece: Segment2, tolerance: number): boolean => {
  const [x1, y1, x2, y2] = piece;
  const ex = x2 - x1;
  const ey = y2 - y1;
  const dx = line.along[0] * line.length;
  const dy = line.along[1] * line.length;
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < 1e-9) {
    return false;
  }
  const qx = x1 - line.point[0];
  const qy = y1 - line.point[1];
  const alongProbe = (qx * ey - qy * ex) / denominator;
  const alongPiece = (qx * dy - qy * dx) / denominator;
  const slack = tolerance / Math.max(Math.hypot(ex, ey), 1e-9);
  return alongProbe >= -1e-6 && alongProbe <= 1 + 1e-6 && alongPiece >= -slack && alongPiece <= 1 + slack;
};

// decision: overlay-facing-cull
const OVERLAY_MIN_FACING = 0.2;

const facesEye =
  (camera: Camera) =>
  (overlay: OverlayLine): boolean =>
    O.match(overlay.facing, {
      onNone: () => true,
      onSome: (facing) => {
        const n = normalize(facing);
        const eye = normalize(O.getOrElse(camera.sight, () => camera.eye));
        return n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2] > OVERLAY_MIN_FACING;
      },
    });

// decision: lines-lifted-off-their-face
const overlayShape = (overlay: OverlayLine): O.Option<AnyShape> => {
  const lift: V3 = O.match(overlay.facing, {
    onNone: () => [0, 0, 0],
    onSome: (facing) => scale(normalize(facing), overlay.lift),
  });
  const points = A.map(overlay.points, (point) => add(point, lift));
  const edges = pipe(
    A.zip(points, A.drop(points, 1)),
    A.filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 1e-9),
    A.map(([a, b]) => replicad.makeLine([...a], [...b]))
  );
  return A.isReadonlyArrayNonEmpty(edges) ? O.some(replicad.makeCompound([...edges])) : O.none();
};

const SHARED_EDGE_SAMPLES = 16;

const vecOf = (v: replicad.Vector): V3 => [v.x, v.y, v.z];

// decision: ink-neighbours-share-a-visible-edge
const visibleNeighbours = (options: {
  readonly solid: Shape3D;
  readonly view: (p: V3) => Viewed;
  readonly outline: ReadonlyArray<Segment2>;
  readonly tolerance: number;
  readonly least: number;
  readonly seen: (face: number) => boolean;
}): ReadonlyArray<readonly [number, number]> => {
  type Bound = { readonly face: number; readonly edge: replicad.Edge };
  const bounds = A.flatMap(
    options.solid.faces,
    (face, index): ReadonlyArray<Bound> =>
      options.seen(index) ? A.map(face.edges, (edge) => ({ face: index, edge })) : A.empty()
  );
  // the bounds grouped by their edge's hash, as positions in `bounds`: a hash map compares the values it replaces,
  // which must never reach into the kernel's objects
  const byHash = A.reduce(bounds, HashMap.empty<number, ReadonlyArray<number>>(), (acc, bound, position) =>
    HashMap.set(
      acc,
      bound.edge.hashCode,
      A.append(O.getOrElse(HashMap.get(acc, bound.edge.hashCode), A.empty<number>), position)
    )
  );
  const shownLength = (edge: replicad.Edge): number => {
    const a = options.view(vecOf(edge.startPoint));
    const b = options.view(vecOf(edge.endPoint));
    const reach = options.tolerance;
    const near = A.filter(
      options.outline,
      ([x1, y1, x2, y2]) =>
        Math.max(x1, x2) >= Math.min(a.x, b.x) - reach &&
        Math.min(x1, x2) <= Math.max(a.x, b.x) + reach &&
        Math.max(y1, y2) >= Math.min(a.y, b.y) - reach &&
        Math.min(y1, y2) <= Math.max(a.y, b.y) + reach
    );
    const shown = A.length(
      A.filter(
        A.makeBy(SHARED_EDGE_SAMPLES, (i) => (i + 0.5) / SHARED_EDGE_SAMPLES),
        (t) => {
          const p = options.view(vecOf(edge.pointAt(t)));
          return nearestOutlineDistance({ x: p.x, y: p.y, outlines: near }) <= reach;
        }
      )
    );
    return (shown / SHARED_EDGE_SAMPLES) * Math.hypot(b.x - a.x, b.y - a.y);
  };
  return byHash.pipe(
    HashMap.values,
    A.fromIterable,
    A.map((positions) =>
      pipe(
        A.map(positions, (position) => A.get(bounds, position)),
        A.getSomes
      )
    ),
    A.flatMap((group) =>
      A.flatMap(group, (p, i) =>
        pipe(
          A.drop(group, i + 1),
          A.filter((q) => q.face !== p.face && p.edge.isSame(q.edge)),
          A.map((q) => ({ pair: [Math.min(p.face, q.face), Math.max(p.face, q.face)] as const, edge: p.edge }))
        )
      )
    ),
    A.reduce(HashMap.empty<string, { readonly pair: readonly [number, number]; readonly shown: number }>(), (acc, s) =>
      HashMap.set(acc, `${s.pair[0]}:${s.pair[1]}`, {
        pair: s.pair,
        shown: O.match(HashMap.get(acc, `${s.pair[0]}:${s.pair[1]}`), {
          onNone: () => shownLength(s.edge),
          onSome: (seen) => seen.shown + shownLength(s.edge),
        }),
      })
    ),
    HashMap.values,
    A.fromIterable,
    A.filter((neighbours) => neighbours.shown >= options.least),
    A.map((neighbours) => neighbours.pair),
    A.sort(
      Order.combine(
        Order.mapInput(Order.Number, (pair: readonly [number, number]) => pair[0]),
        Order.mapInput(Order.Number, (pair: readonly [number, number]) => pair[1])
      )
    )
  );
};

// decision: band-gutter-from-the-ladder-reading
const LADDER_REACH_PITCHES = 5 / 3;

const drawnBack =
  (inset: number) =>
  ([x1, y1, x2, y2]: Segment2): O.Option<Segment2> => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (!(length > 2 * inset)) {
      return O.none();
    }
    const dx = ((x2 - x1) / length) * inset;
    const dy = ((y2 - y1) / length) * inset;
    return O.some([x1 + dx, y1 + dy, x2 - dx, y2 - dy]);
  };

const groupBeyondOf =
  (input: {
    readonly view: (p: V3) => Viewed;
    readonly outlines: ReadonlyArray<Segment2>;
    readonly plan: ShadingPlan;
  }): GroupBeyond =>
  (band) => {
    const { plan } = input;
    const reach = O.getOrElse(plan.ladderReach, () => LADDER_REACH_PITCHES * plan.minPitch);
    const onView = ([a, b]: readonly [V3, V3]): Segment2 => {
      const p = input.view(a);
      const q = input.view(b);
      return [p.x, p.y, q.x, q.y];
    };
    return pipe(
      band.first,
      A.map(([a, b]) =>
        pipe(
          drawnBack(plan.minPitch)(onView([a, b])),
          O.flatMap((stroke) =>
            ladderPitch({
              stroke,
              edge: onView([add(a, band.back), add(b, band.back)]),
              outlines: input.outlines,
              reach,
              tolerance: plan.minPitch / 10,
            })
          )
        )
      ),
      A.getSomes,
      A.match({
        onEmpty: O.none,
        onNonEmpty: (pitches) =>
          O.some(A.reduce(pitches, Number.POSITIVE_INFINITY, (least, pitch) => Math.min(least, pitch))),
      })
    );
  };

type Interval = { readonly from: number; readonly to: number };

// decision: probes-pass-as-short-pieces
const joinedIntervals = (intervals: ReadonlyArray<Interval>): ReadonlyArray<Interval> =>
  pipe(
    intervals,
    A.sort(Order.mapInput(Order.Number, (interval: Interval) => interval.from)),
    A.reduce(
      A.empty<Interval>(),
      (joined: ReadonlyArray<Interval>, next): ReadonlyArray<Interval> =>
        pipe(
          A.last(joined),
          O.filter((last) => next.from - last.to <= PIECE_BOUNDARY_GAP),
          O.match({
            onNone: () => A.append(joined, next),
            onSome: (last) => A.append(A.dropRight(joined, 1), { from: last.from, to: Math.max(last.to, next.to) }),
          })
        )
    )
  );

const columnRoom = (camera: Camera, column: RoomColumn, pieces: ReadonlyArray<Segment2>): number => {
  const length = Math.hypot(
    column.to[0] - column.from[0],
    column.to[1] - column.from[1],
    column.to[2] - column.from[2]
  );
  return O.match(viewedLine(camera, column.from, column.to), {
    onNone: () => 0,
    onSome: (line) =>
      pipe(
        pieces,
        A.map(([x1, y1, x2, y2]): Interval => {
          const a = fractionAt(line, x1, y1) * length;
          const b = fractionAt(line, x2, y2) * length;
          return { from: Math.min(a, b), to: Math.max(a, b) };
        }),
        joinedIntervals,
        A.reduce(0, (most, interval) => Math.max(most, interval.to - interval.from))
      ),
  });
};

const roomKey = (face: number, area: number): string => `${face}:${area}`;

const measuredRooms = (
  camera: Camera,
  columns: ReadonlyArray<RoomColumn>,
  pieces: ReadonlyArray<ReadonlyArray<Segment2>>
): HashMap.HashMap<string, ReadonlyArray<ShadingRoom>> =>
  pipe(
    A.zipWith(columns, pieces, (column, seen) => ({
      key: roomKey(column.face, column.area),
      offset: column.offset,
      length: columnRoom(camera, column, seen),
    })),
    A.groupBy((reading) => reading.key),
    R.toEntries,
    A.map(
      ([key, readings]) =>
        [
          key,
          pipe(
            readings,
            A.groupBy((reading) => `${reading.offset}`),
            R.values,
            A.map((same) =>
              ShadingRoom.make({
                offset: A.headNonEmpty(same).offset,
                length: A.reduce(same, 0, (most, reading) => Math.max(most, reading.length)),
              })
            ),
            A.sort(Order.mapInput(Order.Number, (room: ShadingRoom) => room.offset))
          ),
        ] as const
    ),
    HashMap.fromIterable
  );

type RedrawnRun = { readonly run: Segment2; readonly extent: number; readonly rank: number };

const offLine =
  (run: Segment2) =>
  (line: { readonly a: Viewed; readonly b: Viewed }): number => {
    const dx = line.b.x - line.a.x;
    const dy = line.b.y - line.a.y;
    const length = Math.hypot(dx, dy);
    const mx = (run[0] + run[2]) / 2;
    const my = (run[1] + run[3]) / 2;
    return length < 1e-12 ? Number.POSITIVE_INFINITY : Math.abs(dx * (my - line.a.y) - dy * (mx - line.a.x)) / length;
  };

// decision: redraw-emptied-tapered-bands
const matchedRuns = (input: {
  readonly runs: ReadonlyArray<Segment2>;
  readonly strokes: ReadonlyArray<PlannedStroke>;
  readonly view: (p: V3) => Viewed;
}): ReadonlyArray<RedrawnRun> => {
  const lines = A.map(input.strokes, (stroke) => ({
    stroke,
    a: input.view(stroke.ends[0]),
    b: input.view(stroke.ends[1]),
  }));
  return pipe(
    input.runs,
    A.map((run) =>
      pipe(
        lines,
        A.map((line) => ({ stroke: line.stroke, off: offLine(run)(line) })),
        A.sort(Order.mapInput(Order.Number, (match: { readonly off: number }) => match.off)),
        A.head,
        O.map(({ stroke }): RedrawnRun => ({ run, extent: stroke.extent, rank: stroke.rank }))
      )
    ),
    A.getSomes
  );
};

const segmentLength = ([x1, y1, x2, y2]: Segment2): number => Math.hypot(x2 - x1, y2 - y1);

const cutTo = (run: Segment2, length: number): Segment2 => {
  const [x1, y1, x2, y2] = run;
  const whole = Math.hypot(x2 - x1, y2 - y1);
  const trim = whole > 0 ? (whole - Math.min(whole, length)) / (2 * whole) : 0;
  return [
    round(x1 + (x2 - x1) * trim),
    round(y1 + (y2 - y1) * trim),
    round(x2 - (x2 - x1) * trim),
    round(y2 - (y2 - y1) * trim),
  ];
};

// decision: redraw-emptied-tapered-bands
/**
 * Retaper projected whole-chord runs without rebuilding their kernel edges.
 *
 * **Example** (Centre a shortened projected stroke)
 * ```ts
 * import { Segment2 } from "../Occt.models.ts"
 * import { retapered } from "./kernel.ts"
 *
 * const strokes = retapered({
 *   runs: [{ run: Segment2.make([0, 0, 0, 10]), extent: 0.6, rank: 0 }],
 *   minStroke: 0,
 * })
 * console.log(strokes) // [[0, 2, 0, 8]]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 * @internal
 */
export const retapered = (options: {
  readonly runs: ReadonlyArray<RedrawnRun>;
  readonly minStroke: number;
}): ReadonlyArray<Segment2> =>
  A.zipWith(
    options.runs,
    bandRunLengths({
      runs: A.map(options.runs, (run) =>
        BandRun.make({ length: segmentLength(run.run), extent: run.extent, rank: run.rank })
      ),
      minStroke: options.minStroke,
    }),
    (run, length) => cutTo(run.run, length)
  );

// decision: ink-order-on-drawn-ink
const litFloorOf = (runs: ReadonlyArray<RedrawnRun>, minStroke: number): ReadonlyArray<Segment2> => {
  const ranks = pipe(
    A.map(runs, (run) => run.rank),
    A.dedupe,
    A.sort(Order.Number),
    A.take(2)
  );
  const extents = gradedExtents({ count: 2, fullLines: 0 });
  return retapered({
    runs: pipe(
      runs,
      A.map((run) =>
        pipe(
          A.findFirstIndex(ranks, (rank) => rank === run.rank),
          O.flatMap((position) => A.get(extents, position)),
          O.map((extent): RedrawnRun => ({ ...run, extent }))
        )
      ),
      A.getSomes
    ),
    minStroke,
  });
};

// decision: redraw-emptied-tapered-bands
type DrawnStretch = {
  readonly index: number;
  readonly sliver: boolean;
  readonly segments: ReadonlyArray<Segment2>;
  readonly relaxed: O.Option<ReadonlyArray<RedrawnRun>>;
  readonly redrawn: boolean;
  readonly inkOrder: boolean;
  readonly fits: boolean;
};

const isRelaxed = (stretch: DrawnStretch): boolean =>
  O.isSome(stretch.relaxed) && A.isReadonlyArrayNonEmpty(stretch.segments);

const isRedrawn = (stretch: DrawnStretch): boolean => stretch.redrawn && A.isReadonlyArrayNonEmpty(stretch.segments);

type BandStroke = { readonly segment: Segment2; readonly band: number };

const strokeOrder = Order.mapInput(segmentOrder, (stroke: BandStroke) => stroke.segment);
const bandOrder = Order.mapInput(Order.Number, (stroke: { readonly band: number }) => stroke.band);

const bandedShading = (
  stretches: ReadonlyArray<DrawnStretch>
): { readonly shading: ReadonlyArray<Segment2>; readonly bands: ReadonlyArray<ShadingBand> } => {
  const inked = A.filter(stretches, (stretch) => A.isReadonlyArrayNonEmpty(stretch.segments));
  const strokes = pipe(
    inked,
    A.flatMap((stretch, band) => A.map(stretch.segments, (segment): BandStroke => ({ segment, band }))),
    A.sort(strokeOrder)
  );
  const strokePlacesPerInkedStretch = A.match(
    A.sort(
      A.map(strokes, (stroke, at) => ({ band: stroke.band, at })),
      bandOrder
    ),
    {
      onEmpty: () => [],
      onNonEmpty: A.groupWith((a, b) => a.band === b.band),
    }
  );
  return {
    shading: A.map(strokes, (stroke) => stroke.segment),
    bands: A.zipWith(inked, strokePlacesPerInkedStretch, (stretch, group) =>
      ShadingBand.make({ face: stretch.index, strokes: A.map(group, (stroke) => stroke.at) })
    ),
  };
};

const drawnInkOf = (
  faces: ReadonlyArray<Pick<HatchedFace<ProbeLine>, "seen" | "exposure">>,
  stretches: ReadonlyArray<DrawnStretch>,
  minPitch: number
): ReadonlyArray<BandInk> =>
  pipe(
    faces,
    A.map((face, index) => {
      const length = pipe(
        stretches,
        A.filter((stretch) => stretch.index === index),
        A.flatMap((stretch) => stretch.segments),
        A.reduce(0, (sum, segment: Segment2) => sum + segmentLength(segment))
      );
      return face.seen > 0 && length > 0
        ? BandInk.makeOption({ face: index, exposure: face.exposure, density: (length * minPitch) / face.seen })
        : O.none();
    }),
    A.getSomes
  );

// decision: ink-order-on-drawn-ink
/**
 * Restore drawn light-to-dark ink order after whole-chord rescue.
 *
 * **Example** (Leave an over-inked rescued band bare)
 * ```ts
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { Segment2, ShadingPlan } from "../Occt.models.ts"
 * import { settleRedrawnInk } from "./kernel.ts"
 *
 * const runs = [
 *   { run: Segment2.make([0, 0, 0, 10]), extent: 1, rank: 0 },
 *   { run: Segment2.make([1, 0, 1, 10]), extent: 1, rank: 1 },
 *   { run: Segment2.make([2, 0, 2, 10]), extent: 1, rank: 2 },
 * ]
 * const lit = {
 *   index: 0, sliver: false, segments: A.map(runs, (run) => run.run),
 *   relaxed: O.some(runs), redrawn: true, inkOrder: false, fits: true,
 * }
 * const settled = settleRedrawnInk({
 *   stretches: [lit, {
 *     ...lit, index: 1, segments: [Segment2.make([5, 0, 5, 5])],
 *     relaxed: O.none(), redrawn: false,
 *   }],
 *   faces: [{ seen: 100, exposure: 0.5 }, { seen: 100, exposure: -0.4 }],
 *   neighbours: [[0, 1]],
 *   plan: ShadingPlan.make({
 *     style: "graded", axis: "surface-class", minPitch: 1, maxPitch: 3,
 *     litThreshold: 0.55, minFaceSpan: 0, minStroke: 0,
 *   }),
 * })
 * console.log(settled[0]?.segments) // []
 * console.log(settled[0]?.inkOrder) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 * @internal
 */
export const settleRedrawnInk = (input: {
  readonly stretches: ReadonlyArray<DrawnStretch>;
  readonly faces: ReadonlyArray<Pick<HatchedFace<ProbeLine>, "seen" | "exposure">>;
  readonly neighbours: ReadonlyArray<readonly [number, number]>;
  readonly plan: ShadingPlan;
}): ReadonlyArray<DrawnStretch> => {
  const { faces, neighbours, plan } = input;
  const relaxedFaces = HashSet.fromIterable(A.map(A.filter(input.stretches, isRelaxed), (stretch) => stretch.index));
  const outInking = (stretches: ReadonlyArray<DrawnStretch>): HashSet.HashSet<number> => {
    const bands = drawnInkOf(faces, stretches, plan.minPitch);
    const seen = (face: number) => O.match(A.get(faces, face), { onNone: () => 0, onSome: (hatched) => hatched.seen });
    return HashSet.intersection(
      inkOrderSteps({ bands, shared: [...neighbours, ...inkTwins({ bands, seen })] }),
      relaxedFaces
    );
  };
  const stepAt = (
    stretches: ReadonlyArray<DrawnStretch>,
    stepped: HashSet.HashSet<number>,
    step: (stretch: DrawnStretch, runs: ReadonlyArray<RedrawnRun>) => DrawnStretch
  ): ReadonlyArray<DrawnStretch> =>
    A.map(stretches, (stretch) =>
      HashSet.has(stepped, stretch.index) && isRelaxed(stretch)
        ? O.match(stretch.relaxed, { onNone: () => stretch, onSome: (runs) => step(stretch, runs) })
        : stretch
    );
  const stepped = outInking(input.stretches);
  const floored = stepAt(input.stretches, stepped, (stretch, runs) => ({
    ...stretch,
    segments: litFloorOf(runs, plan.minStroke),
  }));
  return stepAt(floored, HashSet.intersection(outInking(floored), stepped), (stretch) => ({
    ...stretch,
    segments: A.empty(),
    inkOrder: true,
  }));
};

const stretchSkipsOf = (skips: ReadonlyArray<SkippedStretch>): ReadonlyArray<ShadingStretchSkip> =>
  pipe(
    ShadingStretchSkipReason.literals,
    A.map((reason) => {
      const of = A.filter(skips, (skip) => skip.reason === reason);
      return ShadingStretchSkip.make({
        reason,
        stretches: A.length(of),
        fitting: A.length(A.filter(of, (skip) => skip.fits)),
      });
    }),
    A.filter((skip) => skip.stretches > 0)
  );

type Lines = {
  readonly visible: ReadonlyArray<replicad.Edge>;
  readonly hidden: ReadonlyArray<replicad.Edge>;
  readonly broken: ReadonlyArray<replicad.Edge>;
  readonly extras: ReadonlyArray<ReadonlyArray<replicad.Edge>>;
};

const hiddenLines = (options: {
  readonly oc: OpenCascadeInstance;
  readonly built: BuiltModel;
  readonly camera: Camera;
  readonly withHidden: boolean;
  readonly extras: ReadonlyArray<AnyShape>;
}): Lines => {
  const { oc, built, camera } = options;
  const held = heldAbout(oc, passOrigin(camera));
  const solid = O.map(built.solid, (s) => held(s.wrapped));
  const broken = O.map(built.broken, (s) => held(s.wrapped));
  const extras = A.map(options.extras, (shape) => held(shape.wrapped));
  const algo = new oc.HLRBRep_Algo();
  A.forEach([solid, broken], (shape) => O.map(shape, (s) => algo.Add(s, 0)));
  A.forEach(extras, (shape) => algo.Add(shape, 0));
  algo.Projector(makeProjector(oc, camera));
  algo.Update();
  algo.Hide();
  const shapes = new oc.HLRBRep_HLRToShape(algo);
  return {
    visible: O.match(solid, {
      onNone: A.empty<replicad.Edge>,
      onSome: (s) => visibleEdges(shapes, s, oc),
    }),
    hidden: O.match(
      O.filter(solid, () => options.withHidden),
      {
        onNone: A.empty<replicad.Edge>,
        onSome: (s) => [
          ...edgesOf(shapes.HCompound(s), oc),
          ...edgesOf(shapes.Rg1LineHCompound(s), oc),
          ...edgesOf(shapes.OutLineHCompound(s), oc),
        ],
      }
    ),
    broken: O.match(broken, {
      onNone: A.empty<replicad.Edge>,
      onSome: (s) => visibleEdges(shapes, s, oc),
    }),
    extras: A.map(extras, (shape) => edgesOf(shapes.VCompound(shape), oc)),
  };
};

type ProjectOptions = {
  readonly oc: OpenCascadeInstance;
  readonly built: BuiltModel;
  readonly camera: Camera;
  readonly withHidden: boolean;
  readonly shading: O.Option<ShadingPlan>;
  readonly overlays: ReadonlyArray<OverlayLine>;
};

const drawView = (options: ProjectOptions, surveyor: O.Option<Surveyor>): EdgeSet => {
  const { oc, built, camera, withHidden } = options;
  const isBrokenFace = (face: replicad.Face): boolean =>
    O.exists(built.styles, (styles) => A.some(styles.brokenFaces, (broken) => broken.isSame(face)));
  const claimedOf = (face: replicad.Face): O.Option<(edge: replicad.Edge) => ReadonlyArray<replicad.Edge>> =>
    pipe(
      built.styles,
      O.flatMap((styles) => A.findFirst(styles.mixedFaces, (mixed) => mixed.face.isSame(face))),
      O.flatMap((mixed) =>
        O.map(surveyor, (s) => claimedStrokes({ surveyor: s, pieces: mixed.pieces, shortest: SHORTEST_STROKE }))
      )
    );
  const onView = viewOf(camera);
  // decision: overlay-facing-cull
  const overlays = pipe(
    options.overlays,
    A.filter(facesEye(camera)),
    A.map((overlay) => O.map(overlayShape(overlay), (shape) => ({ style: overlay.style, shape }))),
    A.getSomes
  );
  const probed = pipe(
    built.solid,
    O.flatMap((solid) =>
      pipe(
        options.shading,
        O.filter((plan) => plan.style === "graded"),
        O.map((plan) => {
          const probing = probeEdges({ oc, shape: solid, camera, plan, isBrokenFace });
          const pass = A.isReadonlyArrayNonEmpty(probing)
            ? O.some(
                hiddenLines({
                  oc,
                  built,
                  camera,
                  withHidden: false,
                  extras: [...A.map(probing, (p) => p.shape), ...A.map(overlays, (o) => o.shape)],
                })
              )
            : O.none();
          const pieces = O.match(pass, {
            onNone: A.empty<ReadonlyArray<replicad.Edge>>,
            onSome: (p) => A.take(p.extras, A.length(probing)),
          });
          const overlaid = O.match(pass, {
            onNone: A.empty<Segment2>,
            onSome: (p) => toSegments(A.flatten(A.drop(p.extras, A.length(probing)))),
          });
          const outline = O.match(pass, { onNone: A.empty<Segment2>, onSome: (p) => toSegments(p.visible) });
          const drawnOutlines = O.match(pass, {
            onNone: A.empty<Segment2>,
            onSome: (p) => [...outline, ...toSegments(p.broken)],
          });
          const regions = regionsOf({
            camera,
            probes: A.zipWith(probing, pieces, (p, edges) => ({ probe: p.probe, pieces: toSegments(edges) })),
            outlines: drawnOutlines,
          });
          // decision: measured-room-rescues-glimpses
          const columns = roomColumns({
            oc,
            shape: solid,
            camera,
            plan,
            isBrokenFace,
            regions: (face) =>
              O.getOrElse(HashMap.get(regions, face), A.empty<A.NonEmptyReadonlyArray<StretchPiece<ProbeLine>>>),
          });
          const rooms = A.isReadonlyArrayNonEmpty(columns)
            ? measuredRooms(
                camera,
                columns,
                A.map(
                  hiddenLines({
                    oc,
                    built,
                    camera,
                    withHidden: false,
                    extras: A.map(columns, (column) => column.shape),
                  }).extras,
                  toSegments
                )
              )
            : HashMap.empty<string, ReadonlyArray<ShadingRoom>>();
          return {
            regions,
            rooms,
            // decision: band-gutter-from-the-ladder-reading
            groupBeyond: groupBeyondOf({ view: onView, outlines: [...drawnOutlines, ...overlaid], plan }),
            neighbours: visibleNeighbours({
              solid,
              view: onView,
              outline,
              tolerance: plan.minPitch / 4,
              least: plan.minPitch,
              seen: (face) => O.exists(HashMap.get(regions, face), A.isReadonlyArrayNonEmpty),
            }),
          };
        })
      )
    )
  );
  const regions = O.map(probed, (p) => p.regions);
  const viewedLength = ([a, b]: readonly [V3, V3]): number => {
    const p = onView(a);
    const q = onView(b);
    return Math.hypot(q.x - p.x, q.y - p.y);
  };
  const shaded = pipe(
    built.solid,
    O.flatMap((solid) =>
      O.map(options.shading, (plan) =>
        hatchCompound({
          oc,
          shape: solid,
          camera,
          plan,
          isBrokenFace,
          claimedOf,
          viewedLength,
          rooms: (face, area) => O.flatMap(probed, (p) => HashMap.get(p.rooms, roomKey(face, area))),
          neighbours: O.match(probed, { onNone: A.empty, onSome: (p) => p.neighbours }),
          groupBeyond: O.match(probed, {
            onNone: (): GroupBeyond => () => O.none(),
            onSome: (p) => p.groupBeyond,
          }),
          regions: O.map(
            regions,
            (byFace) => (face: number) =>
              O.getOrElse(HashMap.get(byFace, face), A.empty<A.NonEmptyReadonlyArray<StretchPiece<ProbeLine>>>)
          ),
        })
      )
    )
  );
  const faces: ReadonlyArray<HatchedFace<ProbeLine>> = O.match(shaded, {
    onNone: () => [],
    onSome: (view) => view.faces,
  });
  const stroked = A.flatMap(faces, (face, index) => A.map(face.stretches, (stretch) => ({ index, ...stretch })));
  const lines = hiddenLines({
    oc,
    built,
    camera,
    withHidden,
    extras: [...A.map(stroked, (s) => s.shape), ...A.map(overlays, (o) => o.shape)],
  });
  const strokePieces = A.take(lines.extras, A.length(stroked));
  const overlayPieces = A.zipWith(overlays, A.drop(lines.extras, A.length(stroked)), (overlay, edges) => ({
    style: overlay.style,
    edges,
  }));
  const overlayEdges = (style: OverlayStyle): ReadonlyArray<replicad.Edge> =>
    pipe(
      overlayPieces,
      A.filter((piece) => piece.style === style),
      A.flatMap((piece) => piece.edges)
    );
  const traced = pipe(
    built.styles,
    O.flatMap((styles) =>
      O.map(surveyor, (s) =>
        pieceStyles({
          oc,
          styles,
          view: onView,
          sight: sightOf({ direction: normalize(camera.eye), focus: camera.focus, origin: passOrigin(camera) }),
          surveyor: s,
          visible: lines.visible,
        })
      )
    )
  );
  const split = (layer: "visible" | "hidden", edges: ReadonlyArray<replicad.Edge>) =>
    O.match(traced, {
      onNone: () => ({ claimed: sampled(edges), unclaimed: A.empty<RawSegment>() }),
      onSome: (styles) => {
        const runs = A.flatMap(edges, (edge) => A.map(styles.runs(layer)(edge), (run) => ({ edge, run })));
        const chords = (claimed: boolean) =>
          pipe(
            runs,
            A.filter(({ run }) => run.claimed === claimed),
            A.flatMap(({ edge, run }) => chordsOf(edge)(run))
          );
        return { claimed: chords(true), unclaimed: chords(false) };
      },
    });
  const [outline, behind] = (() => {
    try {
      return [split("visible", lines.visible), split("hidden", lines.hidden)] as const;
    } finally {
      O.map(traced, (styles) => styles.dispose());
    }
  })();
  const visible = canonicalSegments(outline.claimed);
  const broken = canonicalSegments([...sampled([...lines.broken, ...overlayEdges("broken")]), ...outline.unclaimed]);
  const emphasis = toSegments(overlayEdges("emphasis"));
  const legible = (segments: ReadonlyArray<Segment2>): ReadonlyArray<Segment2> =>
    O.match(options.shading, {
      onNone: () => segments,
      onSome: (plan) =>
        plan.style === "graded"
          ? legibleShading({
              segments,
              minStroke: plan.minStroke,
              minSpacing: plan.minPitch / 2,
              inset: plan.minPitch,
              outlines: [...visible, ...broken, ...emphasis],
              clearance: O.getOrElse(plan.clearance, () => plan.minPitch / 2),
            })
          : segments,
    });
  const graded = O.exists(options.shading, (plan) => plan.style === "graded");
  const tolerance = O.match(options.shading, { onNone: () => 0, onSome: (plan) => plan.minPitch });
  // decision: band-room-from-the-plan
  const hasRoom = (planned: ReadonlyArray<PlannedStroke>): boolean =>
    O.exists(options.shading, (plan) =>
      hasBandRoom({ plan, viewedLength, planned: A.map(planned, (stroke) => stroke.ends) })
    );
  type Stroked = (typeof stroked)[number];
  // decision: bands-keep-to-their-visible-area
  const strokesOf = (stretch: Stroked, edges: ReadonlyArray<replicad.Edge>): ReadonlyArray<Segment2> => {
    const pieces = toSegments(edges);
    const own = A.isReadonlyArrayNonEmpty(stretch.probes)
      ? A.filter(pieces, (piece) => A.some(stretch.probes, (line) => crosses(line, piece, tolerance)))
      : pieces;
    const segments = legible(own);
    return graded && A.length(segments) < 2 ? A.empty<Segment2>() : segments;
  };
  const minStroke = O.match(options.shading, { onNone: () => 0, onSome: (plan) => plan.minStroke });
  // decision: redraw-emptied-tapered-bands
  const firstPassOf = (stretch: Stroked, edges: ReadonlyArray<replicad.Edge>): DrawnStretch => {
    const sliver = graded && !hasRoom(stretch.planned);
    const segments = sliver ? A.empty<Segment2>() : strokesOf(stretch, edges);
    const relaxed =
      graded && stretch.whole
        ? O.some(matchedRuns({ runs: segments, strokes: stretch.planned, view: onView }))
        : O.none<ReadonlyArray<RedrawnRun>>();
    return {
      index: stretch.index,
      sliver,
      segments: O.match(relaxed, { onNone: () => segments, onSome: (runs) => retapered({ runs, minStroke }) }),
      relaxed,
      redrawn: false,
      inkOrder: false,
      fits: stretch.fits,
    };
  };
  const tapered = A.zipWith(stroked, strokePieces, firstPassOf);
  // decision: redraw-emptied-tapered-bands
  const emptied = graded
    ? pipe(
        tapered,
        A.map((drawnFirst, k) =>
          !drawnFirst.sliver && !A.isReadonlyArrayNonEmpty(drawnFirst.segments)
            ? O.flatMap(A.get(stroked, k), (stretch) =>
                O.map(stretch.untapered, (untapered) => ({ k, stretch, made: untapered() }))
              )
            : O.none()
        ),
        A.getSomes
      )
    : A.empty<{
        readonly k: number;
        readonly stretch: Stroked;
        readonly made: { readonly shape: AnyShape; readonly strokes: ReadonlyArray<PlannedStroke> };
      }>();
  const redrawn = A.isReadonlyArrayNonEmpty(emptied)
    ? HashMap.fromIterable(
        A.zipWith(
          hiddenLines({ oc, built, camera, withHidden: false, extras: A.map(emptied, (stretch) => stretch.made.shape) })
            .extras,
          emptied,
          (edges, { k, stretch, made }) =>
            [k, matchedRuns({ runs: strokesOf(stretch, edges), strokes: made.strokes, view: onView })] as const
        )
      )
    : HashMap.empty<number, ReadonlyArray<RedrawnRun>>();
  const redrawnFirst = A.map(tapered, (stretch, k) =>
    O.match(HashMap.get(redrawn, k), {
      onNone: () => stretch,
      onSome: (runs): DrawnStretch => ({
        ...stretch,
        segments: retapered({ runs, minStroke }),
        relaxed: O.some(runs),
        redrawn: true,
      }),
    })
  );
  // decision: ink-order-on-drawn-ink
  const drawn = pipe(
    options.shading,
    O.filter(() => graded && A.some(redrawnFirst, isRelaxed)),
    O.match({
      onNone: () => redrawnFirst,
      onSome: (plan) =>
        settleRedrawnInk({
          stretches: redrawnFirst,
          faces,
          neighbours: O.match(probed, { onNone: A.empty, onSome: (p) => p.neighbours }),
          plan,
        }),
    })
  );
  const lostStretches = graded
    ? A.length(
        A.filter(
          drawn,
          (stretch) => !stretch.sliver && !stretch.inkOrder && !A.isReadonlyArrayNonEmpty(stretch.segments)
        )
      )
    : 0;
  const drawnFaces = pipe(
    A.filter(drawn, (stretch) => A.isReadonlyArrayNonEmpty(stretch.segments)),
    A.map((stretch) => stretch.index),
    HashSet.fromIterable
  );
  const facesBareBy = (byDesign: (stretch: DrawnStretch) => boolean): HashSet.HashSet<number> =>
    graded
      ? pipe(
          faces,
          A.map((face, index) => ({ face, of: A.filter(drawn, (stretch) => stretch.index === index), index })),
          A.filter(({ face, of }) => face.treatment.kind === "lines" && A.every(of, byDesign)),
          A.map(({ index }) => index),
          HashSet.fromIterable
        )
      : HashSet.empty<number>();
  const sliverFaces = facesBareBy((stretch) => stretch.sliver);
  const bareFaces = facesBareBy((stretch) => stretch.sliver || stretch.inkOrder);
  const lostFaces = graded
    ? pipe(
        faces,
        A.filter(
          (face, index) =>
            face.treatment.kind === "lines" && !HashSet.has(drawnFaces, index) && !HashSet.has(bareFaces, index)
        ),
        A.length
      )
    : 0;
  const skippedStretches = stretchSkipsOf([
    ...A.flatMap(faces, (face) => face.skipped),
    ...pipe(
      drawn,
      A.filter((stretch) => graded && (stretch.sliver || stretch.inkOrder)),
      A.map(
        (stretch): SkippedStretch =>
          stretch.inkOrder ? { reason: "ink-order", fits: false } : { reason: "no-room", fits: stretch.fits }
      )
    ),
  ]);
  const banded = bandedShading(drawn);
  return EdgeSet.make({
    visible,
    hidden: canonicalSegments(behind.claimed),
    shading: banded.shading,
    shadingBands: banded.bands,
    broken,
    emphasis,
    shadingCoverage: O.map(shaded, () =>
      ShadingCoverage.make({
        ...coverageOf(
          A.map(faces, (face, index) =>
            face.treatment.kind === "lines" && HashSet.has(sliverFaces, index)
              ? ShadingSkipped.make({ reason: "sliver" })
              : face.treatment
          )
        ),
        lostFaces,
        lostStretches,
        skippedStretches,
        redrawnStretches: A.length(A.filter(drawn, isRedrawn)),
      })
    ),
  });
};

/**
 * Run exact hidden-line removal for one camera and return canonical segments.
 *
 * **Details**
 *
 * The solid compound, the broken-line compound, the shading strokes, and the
 * overlay lines facing this camera are added to one hidden-line pass, so
 * every part hides what lies behind it whatever its style; the solid
 * compound's visible (and, on request, hidden) edges, the broken compound's
 * visible edges, each stroke set's visible pieces, and each overlay's visible
 * pieces are then read on their own. Broken overlay pieces join the broken
 * layer and emphasis pieces the emphasis layer; overlays draw nothing else,
 * so a model without overlays projects exactly as before they existed. When
 * a solid part has unclaimed matter (broken add primitives), each piece of
 * the solid compound's outline is traced back to the parts' own edges and
 * silhouettes and split where it turns unclaimed: a visible unclaimed run
 * joins the broken layer and a hidden one is dropped, and at a point where
 * several edges project, a visible piece takes the style of the nearest. A
 * face only broken primitives own is never shaded (skipped as
 * `broken-part`), and the strokes on a face merged across both kinds keep to
 * its claimed part. Without unclaimed matter nothing changes. Graded
 * shading takes two passes: a probe across every graded face at several
 * heights goes through hidden-line removal first, as a shape of its own, and
 * its visible pieces give the face's visible stretches; the strokes are then
 * planned per stretch and projected with the outlines. A visible stretch
 * that fewer than three probe rows saw has its room for a stroke measured
 * first, by chords along the face's lines through one more hidden-line pass
 * that runs only when such a stretch exists, so its band goes where the view
 * shows enough of the face for a stroke. A stretch left with fewer than two
 * legible strokes carries none, and a face whose every stroke is lost is
 * counted in the coverage. A tapered band that hidden-line removal and the
 * legibility pass leave with fewer than two strokes (a part in front cut its
 * probe row's cell short) is drawn again on its whole clipped chords in a
 * further pass, which runs only when such a band exists; it is counted lost
 * only when those draw nothing either. A band drawn on whole chords, by that
 * pass or by the planner, is cut back to its taper on what shows, and its
 * face's ink is read again against its darker neighbours: a face that out-inks
 * one has the band stepped to the lit floor, or left bare as a planned skip. A
 * face whose every planned stretch has room for fewer than two legible strokes
 * draws nothing by design and is counted a sliver, not a shaded face. Every
 * visible stretch skipped by design is counted with its reason and whether its
 * measured room fits a band. The uniform style keeps one pass. The drawn
 * strokes come in one canonical order, with one band per stretch that drew
 * ink naming its face and its strokes' places in that order.
 *
 * **Gotchas**
 *
 * `viewedLine` and `viewOf` re-derive the projector's frame and projection
 * by hand (the eye `focus` along the view direction from the target under
 * perspective), so they must change with `makeProjector`. The canonical
 * stroke sort is stable, so the shading strokes are those drawn before bands
 * existed, in the same order; a pass after projection reads through the
 * bands which stretch and which face it left bare. A run's chords over the
 * whole parameter range are exactly the samples of an unsplit edge. The
 * uniform style skips the legibility pass, so its output stays exactly as
 * the legacy goldens record it, and only graded faces can be lost: a uniform
 * face is not planned per visible stretch, so one hidden behind another part
 * is not lost.
 *
 * @internal
 */
export const project = (options: ProjectOptions): EdgeSet => {
  const surveyor = O.map(options.built.styles, makeSurveyor);
  try {
    return drawView(options, surveyor);
  } finally {
    O.map(surveyor, (s) => s.dispose());
  }
};
