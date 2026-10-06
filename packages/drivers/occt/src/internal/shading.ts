/**
 * Private procedural straight-line shading: hatch every planar face that
 * faces the camera, with a pitch set by its exposure to the 37 CFR 1.84(m)
 * light. The hatch edges lie on the model's own faces, so the caller projects
 * them through the same hidden-line removal as the outlines.
 *
 * @internal
 */

import { A, O } from "@beep/utils";
import { Order, pipe } from "effect";
import * as replicad from "replicad";
import { add, cross, dot, scale, unit } from "./vector.ts";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import type { Camera, ShadingPlan } from "../Occt.models.ts";
import type { V3 } from "./vector.ts";

const vec = (v: replicad.Vector): V3 => [v.x, v.y, v.z];

/**
 * Camera frame and the 1.84(m) light (upper left, toward the viewer, 45°)
 * expressed in model coordinates.
 *
 * @internal
 */
export const lightFor = (camera: Camera): { readonly eye: V3; readonly light: V3 } => {
  const eye = unit(camera.eye);
  const right = unit(cross(unit(camera.up), eye));
  const up = cross(eye, right);
  return { eye, light: unit(add(add(scale(right, -1), up), eye)) };
};

/**
 * Pitch for an exposure: `minPitch` at -1, `maxPitch` at the lit threshold,
 * none above it.
 *
 * @internal
 */
export const pitchFor = (input: { readonly exposure: number; readonly plan: ShadingPlan }): O.Option<number> => {
  const { exposure, plan } = input;
  if (exposure > plan.litThreshold) {
    return O.none();
  }
  const t = (exposure + 1) / (plan.litThreshold + 1);
  return O.some(plan.minPitch + (plan.maxPitch - plan.minPitch) * Math.max(0, Math.min(1, t)));
};

const lineLength = (edge: replicad.Edge): number => edge.length;

const longestLineOrder = Order.flip(Order.mapInput(Order.Number, lineLength));

// Hatch direction: the face's longest straight edge, so lines read as running
// along the face; none for a planar face without straight edges.
const hatchDirection = (face: replicad.Face): O.Option<V3> =>
  pipe(
    face.edges,
    A.filter((edge) => edge.geomType === "LINE"),
    A.sort(longestLineOrder),
    A.head,
    O.map((edge) => unit(add(vec(edge.endPoint), scale(vec(edge.startPoint), -1))))
  );

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

// Parallel lines across one face: planes stepped along `normal × direction`
// with a half-pitch phase so no line lands on the face's own boundary.
const hatchFace = (oc: OpenCascadeInstance, face: replicad.Face, normal: V3, direction: V3, pitch: number) => {
  const step = unit(cross(normal, direction));
  const center = vec(face.center);
  const [min, max] = face.boundingBox.bounds;
  const reach = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const count = Math.floor((2 * reach) / pitch);
  return pipe(
    A.makeBy(count + 1, (i) => -reach + pitch * (i + 0.5)),
    A.flatMap((t) => sectionEdges(oc, face, add(center, scale(step, t)), step))
  );
};

// Planar faces only: `normalAt` projects the face centre onto the surface,
// which throws inside OCCT for curved faces whose centre lies off them.
const isPlanar = (face: replicad.Face): boolean => face.geomType === "PLANE";

const shadeFace =
  (oc: OpenCascadeInstance, camera: Camera, plan: ShadingPlan) =>
  (face: replicad.Face): ReadonlyArray<replicad.Edge> => {
    const { eye, light } = lightFor(camera);
    const normal = vec(face.normalAt(face.center));
    return pipe(
      O.liftPredicate(normal, (n) => dot(n, eye) > 1e-9),
      O.flatMap(() => pitchFor({ exposure: dot(normal, light), plan })),
      O.flatMap((pitch) => O.map(hatchDirection(face), (direction) => hatchFace(oc, face, normal, direction, pitch))),
      O.getOrElse(() => A.empty<replicad.Edge>())
    );
  };

/**
 * Hatch edges for every planar face of a shape that faces the camera, as one
 * compound, or none when no face is shaded.
 *
 * @internal
 */
export const hatchCompound = (options: {
  readonly oc: OpenCascadeInstance;
  readonly shape: replicad.AnyShape;
  readonly camera: Camera;
  readonly plan: ShadingPlan;
}): O.Option<replicad.AnyShape> =>
  pipe(
    options.shape.faces,
    A.filter(isPlanar),
    A.flatMap(shadeFace(options.oc, options.camera, options.plan)),
    O.liftPredicate(A.isReadonlyArrayNonEmpty),
    O.map((edges) => replicad.makeCompound([...edges]))
  );
