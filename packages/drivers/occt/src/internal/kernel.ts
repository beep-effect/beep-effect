/**
 * Private replicad / opencascade.js glue: build parts from the technical spec,
 * run hidden-line removal through a driver-owned camera, and canonicalise the
 * projected segments.
 *
 * @internal
 */

import { A, N, O } from "@beep/utils";
import { Order, pipe } from "effect";
import * as replicad from "replicad";
import { OcctError } from "../Occt.errors.ts";
import { BoundingBox, EdgeSet, ModelSummary, Primitive } from "../Occt.models.ts";
import { hatchCompound } from "./shading.ts";
import { cross } from "./vector.ts";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import type { Camera, ModelSpec, Rotation, Segment2, ShadingPlan } from "../Occt.models.ts";

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
    const face = replicad.makePolygon(prism.profile.map((p) => [...p] as const));
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
 * Build every part of a spec and keep them as separate solids in one compound.
 *
 * @internal
 */
export const buildCompound = (spec: ModelSpec): { readonly compound: Shape3D } => {
  const parts = spec.parts.map((part) => buildPart(part.add, part.subtract));
  const compound = A.length(parts) === 1 ? parts[0] : replicad.makeCompound(parts);
  if (!(compound instanceof replicad.Compound || compound instanceof replicad.Solid)) {
    throw OcctError.make({ reason: "solid-build", message: "The parts did not form a solid or a compound." });
  }
  return { compound };
};

/**
 * Measure a built compound.
 *
 * **Details**
 *
 * `makeCompound` disposes the part shapes it is given, so every measurement
 * reads the compound, never the parts.
 *
 * @internal
 */
export const summarize = (built: ReturnType<typeof buildCompound>): ModelSummary => {
  const [min, max] = built.compound.boundingBox.bounds;
  return ModelSummary.make({
    boundingBox: BoundingBox.make({
      min: [round(min[0]), round(min[1]), round(min[2])],
      max: [round(max[0]), round(max[1]), round(max[2])],
    }),
    volume: round(replicad.measureVolume(built.compound)),
    faceCount: built.compound.faces.length,
    edgeCount: built.compound.edges.length,
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
  edges.forEach((e) => oc.BRepLib.BuildCurves3d(e.wrapped));
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

/**
 * Run exact hidden-line removal for one camera and return canonical segments.
 *
 * @internal
 */
export const project = (options: {
  readonly oc: OpenCascadeInstance;
  readonly compound: AnyShape;
  readonly camera: Camera;
  readonly withHidden: boolean;
  readonly shading: O.Option<ShadingPlan>;
}): EdgeSet => {
  const { oc, compound, camera, withHidden } = options;
  const hatch = O.flatMap(options.shading, (plan) => hatchCompound({ oc, shape: compound, camera, plan }));
  const algo = new oc.HLRBRep_Algo();
  algo.Add(compound.wrapped, 0);
  O.map(hatch, (shape) => algo.Add(shape.wrapped, 0));
  algo.Projector(makeProjector(oc, camera));
  algo.Update();
  algo.Hide();
  const shapes = new oc.HLRBRep_HLRToShape(algo);
  const own = compound.wrapped;
  const visible = [
    ...edgesOf(shapes.VCompound(own), oc),
    ...edgesOf(shapes.Rg1LineVCompound(own), oc),
    ...edgesOf(shapes.OutLineVCompound(own), oc),
  ];
  const hidden = withHidden
    ? [
        ...edgesOf(shapes.HCompound(own), oc),
        ...edgesOf(shapes.Rg1LineHCompound(own), oc),
        ...edgesOf(shapes.OutLineHCompound(own), oc),
      ]
    : [];
  const shading = O.match(hatch, {
    onNone: () => [],
    onSome: (shape) => edgesOf(shapes.VCompound(shape.wrapped), oc),
  });
  return EdgeSet.make({ visible: toSegments(visible), hidden: toSegments(hidden), shading: toSegments(shading) });
};
