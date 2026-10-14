/**
 * Private replicad / opencascade.js glue: build parts from the technical spec,
 * run hidden-line removal through a driver-owned camera, and canonicalise the
 * projected segments.
 *
 * @internal
 */

import { legibleShading, ShadingCoverage, ShadingWindow } from "@beep/technical-drawing";
import { A, N, O } from "@beep/utils";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as replicad from "replicad";
import { OcctError } from "../Occt.errors.ts";
import { BoundingBox, EdgeSet, ModelSummary, Primitive } from "../Occt.models.ts";
import { hatchCompound, probeEdges } from "./shading.ts";
import { cross } from "./vector.ts";
import type { FaceTreatment, ShadingProbe } from "@beep/technical-drawing";
import type { HLRBRep_HLRToShape, OpenCascadeInstance, TopoDS_Shape } from "replicad-opencascadejs";
import type { Camera, ModelSpec, PartLineStyle, Rotation, Segment2, ShadingPlan } from "../Occt.models.ts";
import type { V3 } from "./vector.ts";

type Shape3D = replicad.Shape3D;
type AnyShape = replicad.AnyShape;

const CURVE_SAMPLES = 24;
const DECIMALS = 3;

const round = (value: number): number => {
  const rounded = N.round(DECIMALS)(value);
  // -0 and 0 must hash alike.
  return rounded === 0 ? 0 : rounded;
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
  // Booleans leave seam edges where coplanar faces met; merge them so the
  // hidden-line pass does not draw a line the article does not have.
  return pipe(
    subtract,
    A.reduce(fused, (acc, p) => acc.cut(buildPrimitive(p)))
  ).simplify();
};

/**
 * One built part and the line style it is drawn in.
 *
 * @internal
 */
export interface BuiltPart {
  readonly lineStyle: PartLineStyle;
  readonly shape: Shape3D;
}

/**
 * The parts of a model gathered by line style: the solid (claimed) parts and
 * the broken-line (unclaimed) parts, each as one solid or compound, or none.
 *
 * @internal
 */
export interface BuiltModel {
  readonly broken: O.Option<Shape3D>;
  readonly solid: O.Option<Shape3D>;
}

/**
 * Build every part of a spec as its own solid, in spec order.
 *
 * @internal
 */
export const buildParts = (spec: ModelSpec): ReadonlyArray<BuiltPart> =>
  A.map(spec.parts, (part) => ({ lineStyle: part.lineStyle, shape: buildPart(part.add, part.subtract) }));

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

/**
 * Gather built parts into one compound per line style.
 *
 * **Details**
 *
 * `makeCompound` disposes the part shapes it is given, so each part goes into
 * exactly one compound and must not be read afterwards. With no broken parts
 * the solid compound is exactly the compound the kernel always built.
 *
 * @internal
 */
export const compoundParts = (parts: ReadonlyArray<BuiltPart>): BuiltModel => ({
  solid: compoundOf(shapesIn(parts, "solid")),
  broken: compoundOf(shapesIn(parts, "broken")),
});

/**
 * Build every part of a spec and gather them into one compound per line style.
 *
 * @internal
 */
export const buildCompound: (spec: ModelSpec) => BuiltModel = flow(buildParts, compoundParts);

// Common volume, in cubic model units, above which two parts overlap. Parts
// modelled to touch (zero clearance) share only a face, whose volume is zero
// up to the boolean's numerical noise.
const OVERLAP_TOLERANCE = 1e-6;

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
export const countOverlaps = (parts: ReadonlyArray<BuiltPart>): number =>
  pipe(
    parts,
    A.flatMap((a, i) => A.map(A.drop(parts, i + 1), (b) => [a.shape, b.shape] as const)),
    A.filter(([a, b]) => boxesMeet(a, b) && commonVolume(a, b) > OVERLAP_TOLERANCE),
    A.length
  );

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
 * Build the OCCT projector for a camera.
 *
 * **Details**
 *
 * OCCT's `gp_Ax2` for a projector has its origin at the view-plane point, its
 * main direction pointing from the target toward the eye, and its X direction
 * as the horizontal screen axis. The screen Y axis is then `direction × x`,
 * which is the camera's up vector. With a focus, `HLRAlgo_Projector` places
 * the eye `focus` units along the direction and projects in perspective.
 *
 * @internal
 */
const makeProjector = (oc: OpenCascadeInstance, camera: Camera) => {
  const direction = normalize(camera.eye);
  const up = normalize(camera.up);
  const right = normalize(cross(up, direction));
  const origin = new oc.gp_Pnt(camera.target[0], camera.target[1], camera.target[2]);
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

const toSegments = (edges: ReadonlyArray<replicad.Edge>): ReadonlyArray<Segment2> =>
  pipe(
    edges,
    A.flatMap((edge) => {
      const samples = edge.geomType === "LINE" ? 1 : CURVE_SAMPLES;
      return A.makeBy(samples, (i) => {
        const a = edge.pointAt(i / samples);
        const b = edge.pointAt((i + 1) / samples);
        return canonical([a.x, a.y], [b.x, b.y]);
      });
    }),
    A.filter((s) => !(s[0] === s[2] && s[1] === s[3])),
    A.sort(segmentOrder)
  );

const visibleEdges = (shapes: HLRBRep_HLRToShape, own: TopoDS_Shape, oc: OpenCascadeInstance) => [
  ...edgesOf(shapes.VCompound(own), oc),
  ...edgesOf(shapes.Rg1LineVCompound(own), oc),
  ...edgesOf(shapes.OutLineVCompound(own), oc),
];

type ProbeLine = {
  readonly probe: ShadingProbe;
  readonly point: readonly [number, number];
  readonly along: readonly [number, number];
  readonly length: number;
  // the two ends' distances from the eye along the view direction under a
  // perspective camera (both 1 for an orthographic one), for walking back
  // from a view-plane fraction to a fraction of the probe in space
  readonly depth: readonly [number, number];
};

// A probe's line on the view plane, in the projector's own frame (the frame
// the hidden-line pass reports its edges in) and under its own projection: a
// camera with a focus projects in perspective, the eye `focus` along the view
// direction from the target, exactly as `makeProjector` sets the HLR up.
// None when the probe projects to a point.
const projectedProbe = (camera: Camera, probe: ShadingProbe): O.Option<ProbeLine> => {
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
  const from = project(probe.from);
  const to = project(probe.to);
  const length = Math.hypot(to.at[0] - from.at[0], to.at[1] - from.at[1]);
  return length < 1e-9
    ? O.none()
    : O.some({
        probe,
        point: from.at,
        length,
        along: [(to.at[0] - from.at[0]) / length, (to.at[1] - from.at[1]) / length],
        depth: [from.depth, to.depth],
      });
};

// Offset along the face's step, from its shadow anchor, of the point of a
// probe's line nearest a view-plane point. A fraction of the projected line
// is a fraction of the probe in space only under an orthographic camera;
// under perspective the far end is foreshortened, so the fraction is walked
// back through the two ends' depths.
const offsetAt = (line: ProbeLine, x: number, y: number): number => {
  const t = Math.min(
    Math.max(((x - line.point[0]) * line.along[0] + (y - line.point[1]) * line.along[1]) / line.length, 0),
    1
  );
  const [near, far] = line.depth;
  const s = (t * near) / (t * near + (1 - t) * far);
  return line.probe.start + s * (line.probe.end - line.probe.start);
};

type Stretch = {
  readonly face: number;
  readonly from: number;
  readonly to: number;
  readonly low: number;
  readonly high: number;
};

// The visible stretches of every probed face along its shading step: each
// visible piece of a probe mapped back to offsets from the face's shadow
// anchor, then the pieces of all the face's probes merged where they overlap
// or come within `merge` of each other.
const regionsOf = (options: {
  readonly camera: Camera;
  readonly probes: ReadonlyArray<{ readonly probe: ShadingProbe; readonly pieces: ReadonlyArray<Segment2> }>;
  readonly merge: number;
}): HashMap.HashMap<number, ReadonlyArray<ShadingWindow>> => {
  const stretches: ReadonlyArray<Stretch> = A.flatMap(options.probes, ({ probe, pieces }) =>
    O.match(projectedProbe(options.camera, probe), {
      onNone: () => A.empty<Stretch>(),
      onSome: (line) =>
        A.map(pieces, (s) => {
          const a = offsetAt(line, s[0], s[1]);
          const b = offsetAt(line, s[2], s[3]);
          return {
            face: probe.face,
            from: Math.min(a, b),
            to: Math.max(a, b),
            low: probe.height - probe.reach,
            high: probe.height + probe.reach,
          };
        }),
    })
  );
  const merged = (group: ReadonlyArray<Stretch>): ReadonlyArray<ShadingWindow> =>
    pipe(
      A.sort(
        group,
        Order.mapInput(Order.Number, (s: Stretch) => s.from)
      ),
      A.reduce(A.empty<Stretch>(), (acc, s) =>
        O.match(A.last(acc), {
          onNone: () => [s],
          onSome: (last) =>
            s.from <= last.to + options.merge
              ? [
                  ...A.dropRight(acc, 1),
                  {
                    ...last,
                    to: Math.max(last.to, s.to),
                    low: Math.min(last.low, s.low),
                    high: Math.max(last.high, s.high),
                  },
                ]
              : [...acc, s],
        })
      ),
      A.filter((s) => s.to - s.from > 0),
      A.map((s) => ShadingWindow.make({ start: s.from, span: s.to - s.from, low: O.some(s.low), high: O.some(s.high) }))
    );
  return pipe(
    stretches,
    A.groupBy((s) => `${s.face}`),
    R.toEntries,
    A.map(([face, group]) => [Number(face), merged(group)] as const),
    HashMap.fromIterable
  );
};

type Lines = {
  readonly visible: ReadonlyArray<replicad.Edge>;
  readonly hidden: ReadonlyArray<replicad.Edge>;
  readonly broken: ReadonlyArray<replicad.Edge>;
  readonly extras: ReadonlyArray<ReadonlyArray<replicad.Edge>>;
};

// One hidden-line pass over the solid and broken-line compounds, with extra
// shapes (one stroke set per planned stretch, or one probe each) whose visible
// pieces come back per shape, in order. Every part hides what lies behind it
// whatever its style; only the broken compound's visible edges are read.
const hiddenLines = (options: {
  readonly oc: OpenCascadeInstance;
  readonly built: BuiltModel;
  readonly camera: Camera;
  readonly withHidden: boolean;
  readonly extras: ReadonlyArray<AnyShape>;
}): Lines => {
  const { oc, built, camera } = options;
  const algo = new oc.HLRBRep_Algo();
  A.forEach([built.solid, built.broken], (shape) => O.map(shape, (s) => algo.Add(s.wrapped, 0)));
  A.forEach(options.extras, (shape) => algo.Add(shape.wrapped, 0));
  algo.Projector(makeProjector(oc, camera));
  algo.Update();
  algo.Hide();
  const shapes = new oc.HLRBRep_HLRToShape(algo);
  return {
    visible: O.match(built.solid, {
      onNone: A.empty<replicad.Edge>,
      onSome: (s) => visibleEdges(shapes, s.wrapped, oc),
    }),
    hidden: O.match(
      O.filter(built.solid, () => options.withHidden),
      {
        onNone: A.empty<replicad.Edge>,
        onSome: (s) => [
          ...edgesOf(shapes.HCompound(s.wrapped), oc),
          ...edgesOf(shapes.Rg1LineHCompound(s.wrapped), oc),
          ...edgesOf(shapes.OutLineHCompound(s.wrapped), oc),
        ],
      }
    ),
    broken: O.match(built.broken, {
      onNone: A.empty<replicad.Edge>,
      onSome: (s) => visibleEdges(shapes, s.wrapped, oc),
    }),
    extras: A.map(options.extras, (shape) => edgesOf(shapes.VCompound(shape.wrapped), oc)),
  };
};

/**
 * Run exact hidden-line removal for one camera and return canonical segments.
 *
 * **Details**
 *
 * The solid compound, the broken-line compound, and the shading strokes are
 * added to one hidden-line pass, so every part hides what lies behind it
 * whatever its style; the solid compound's visible (and, on request, hidden)
 * edges, the broken compound's visible edges, and each stroke set's visible
 * pieces are then read on their own. Only solid parts are shaded. Graded
 * shading takes two passes: a probe across every graded face at several
 * heights goes through hidden-line removal first, as a shape of its own, and
 * its visible pieces give the face's visible stretches; the strokes are then
 * planned per stretch and projected with the outlines. A stretch left with
 * fewer than two legible strokes carries none, and a face whose every stroke
 * is lost is counted in the coverage. The uniform style keeps one pass.
 *
 * @internal
 */
export const project = (options: {
  readonly oc: OpenCascadeInstance;
  readonly built: BuiltModel;
  readonly camera: Camera;
  readonly withHidden: boolean;
  readonly shading: O.Option<ShadingPlan>;
}): EdgeSet => {
  const { oc, built, camera, withHidden } = options;
  const regions = pipe(
    built.solid,
    O.flatMap((solid) =>
      pipe(
        options.shading,
        O.filter((plan) => plan.style === "graded"),
        O.map((plan) => {
          const probing = probeEdges({ oc, shape: solid, camera, plan });
          const pieces = A.isReadonlyArrayNonEmpty(probing)
            ? hiddenLines({ oc, built, camera, withHidden: false, extras: A.map(probing, (p) => p.edge) }).extras
            : A.empty<ReadonlyArray<replicad.Edge>>();
          return regionsOf({
            camera,
            probes: A.zipWith(probing, pieces, (p, edges) => ({ probe: p.probe, pieces: toSegments(edges) })),
            merge: plan.minPitch,
          });
        })
      )
    )
  );
  const shaded = pipe(
    built.solid,
    O.flatMap((solid) =>
      O.map(options.shading, (plan) =>
        hatchCompound({
          oc,
          shape: solid,
          camera,
          plan,
          regions: O.map(
            regions,
            (windows) => (face: number) => O.getOrElse(HashMap.get(windows, face), () => A.empty<ShadingWindow>())
          ),
        })
      )
    )
  );
  // Each planned stretch's strokes go through the hidden-line pass as a shape
  // of their own, so a stretch left with a single stroke can be emptied (one
  // line beside an outline reads as a doubled edge, never as shading) and a
  // face whose every stroke is lost can be counted.
  const faces: ReadonlyArray<{ readonly treatment: FaceTreatment; readonly stretches: ReadonlyArray<AnyShape> }> =
    O.match(shaded, { onNone: () => [], onSome: (view) => view.faces });
  const stroked = A.flatMap(faces, (face, index) => A.map(face.stretches, (shape) => ({ index, shape })));
  const lines = hiddenLines({ oc, built, camera, withHidden, extras: A.map(stroked, (s) => s.shape) });
  const visible = toSegments(lines.visible);
  const broken = toSegments(lines.broken);
  // Graded shading is tidied after the hidden-line pass, stretch by stretch:
  // fragments under the minimum stroke, the shorter of two lines inside half
  // the minimum pitch, and strokes touching or riding a drawn line go; the
  // uniform style is left exactly as the legacy golden records it.
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
              outlines: [...visible, ...broken],
              // the sheet carries the validator's floor on the plan; a bare plan clears half a pitch
              clearance: O.getOrElse(plan.clearance, () => plan.minPitch / 2),
            })
          : segments,
    });
  const graded = O.exists(options.shading, (plan) => plan.style === "graded");
  const drawn = A.map(lines.extras, (edges) => {
    const segments = legible(toSegments(edges));
    return graded && A.length(segments) < 2 ? A.empty<Segment2>() : segments;
  });
  const drawnFaces = pipe(
    A.zipWith(stroked, drawn, (s, segments) => (A.isReadonlyArrayNonEmpty(segments) ? O.some(s.index) : O.none())),
    A.getSomes,
    HashSet.fromIterable
  );
  // only graded faces are planned per visible stretch; a uniform face hidden behind another part is not lost
  const lostFaces = graded
    ? pipe(
        faces,
        A.filter((face, index) => face.treatment.kind === "lines" && !HashSet.has(drawnFaces, index)),
        A.length
      )
    : 0;
  return EdgeSet.make({
    visible,
    hidden: toSegments(lines.hidden),
    shading: pipe(drawn, A.flatten, A.sort(segmentOrder)),
    broken,
    shadingCoverage: O.map(shaded, (view) => ShadingCoverage.make({ ...view.coverage, lostFaces })),
  });
};
