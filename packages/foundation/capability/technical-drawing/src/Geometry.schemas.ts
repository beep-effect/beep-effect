/**
 * Geometry vocabulary of a figure set: the parametric model (parts built from
 * placed primitives), projection cameras, projected segments, and measured
 * model facts.
 *
 * **Details**
 *
 * These schemas are the capability's own; a geometry engine adapter maps them
 * onto its kernel driver. Lengths are in the model's declared units.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $TechnicalDrawingId.create("Geometry.schemas");

/**
 * Finite 3D vector or point in model units.
 *
 * **Example** (Make a vector)
 *
 * ```ts
 * import { Vec3 } from "@beep/technical-drawing"
 *
 * const v = Vec3.make([1, 2, 3])
 * console.log(v)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export const Vec3 = S.Tuple([S.Finite, S.Finite, S.Finite]).pipe(
  $I.annoteSchema("Vec3", {
    description: "Finite [x, y, z] vector or point in model units.",
  })
);

/**
 * Type for {@link Vec3}.
 *
 * **Example** (Annotate a vector)
 *
 * ```ts
 * import type { Vec3 } from "@beep/technical-drawing"
 *
 * const origin: Vec3 = [0, 0, 0]
 * console.log(origin)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export type Vec3 = typeof Vec3.Type;

/**
 * Strictly positive finite length.
 *
 * **Example** (Make a length)
 *
 * ```ts
 * import { PositiveLength } from "@beep/technical-drawing"
 *
 * console.log(PositiveLength.make(12.5))
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export const PositiveLength = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: $I`PositiveLengthCheck`,
    title: "Positive Length",
    description: "Lengths, radii, and focal distances are strictly positive.",
    message: "Expected a strictly positive length",
  })
).pipe(
  $I.annoteSchema("PositiveLength", {
    description: "Strictly positive finite length in model units.",
  })
);

/**
 * Type for {@link PositiveLength}.
 *
 * **Example** (Annotate a length)
 *
 * ```ts
 * import { PositiveLength } from "@beep/technical-drawing"
 *
 * const r: PositiveLength = PositiveLength.make(3)
 * console.log(r)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export type PositiveLength = typeof PositiveLength.Type;

/**
 * Rotation of a primitive about an axis through a point, in degrees.
 *
 * **Example** (Rotate 90° about Z through the origin)
 *
 * ```ts
 * import { Rotation } from "@beep/technical-drawing"
 *
 * const r = Rotation.make({ axis: [0, 0, 1], degrees: 90 })
 * console.log(r.origin)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class Rotation extends S.Class<Rotation>($I`Rotation`)(
  {
    axis: Vec3.annotateKey({ description: "Axis direction; need not be normalised." }),
    origin: Vec3.pipe(
      S.withConstructorDefault(Effect.succeed([0, 0, 0] as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed([0, 0, 0] as const)),
      S.annotateKey({ description: "Point the axis passes through. Defaults to the origin." })
    ),
    degrees: S.Finite.annotateKey({ description: "Signed rotation angle in degrees (right-hand rule)." }),
  },
  $I.annote("Rotation", {
    description: "Rotation about an axis through a point, in degrees.",
  })
) {}

const placementFields = {
  rotate: S.Array(Rotation).pipe(
    S.withConstructorDefault(Effect.succeed([])),
    S.withDecodingDefaultTypeKey(Effect.succeed([])),
    S.annotateKey({ description: "Rotations applied in order, before the translation." })
  ),
  translate: Vec3.pipe(
    S.withConstructorDefault(Effect.succeed([0, 0, 0] as const)),
    S.withDecodingDefaultTypeKey(Effect.succeed([0, 0, 0] as const)),
    S.annotateKey({ description: "Translation applied after the rotations." })
  ),
};

/**
 * Axis-aligned box spanning two opposite corners, then placed.
 *
 * **Example** (A 40 × 30 × 20 box on the XY plane)
 *
 * ```ts
 * import { Box } from "@beep/technical-drawing"
 *
 * const box = Box.make({ min: [0, 0, 0], max: [40, 30, 20] })
 * console.log(box.kind)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class Box extends S.Class<Box>($I`Box`)(
  {
    kind: S.tag("box").annotateKey({ description: "Primitive discriminator." }),
    min: Vec3.annotateKey({ description: "Corner with the smaller coordinates." }),
    max: Vec3.annotateKey({ description: "Corner with the larger coordinates." }),
    ...placementFields,
  },
  $I.annote("Box", {
    description: "Axis-aligned box between two corners, then rotated and translated.",
  })
) {}

/**
 * Planar polygon profile extruded along a vector, then placed.
 *
 * **Example** (A triangular wedge)
 *
 * ```ts
 * import { Prism } from "@beep/technical-drawing"
 *
 * const wedge = Prism.make({
 *   profile: [[0, 0, 0], [20, 0, 0], [0, 0, 15]],
 *   extrusion: [0, 10, 0]
 * })
 * console.log(wedge.profile.length)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class Prism extends S.Class<Prism>($I`Prism`)(
  {
    kind: S.tag("prism").annotateKey({ description: "Primitive discriminator." }),
    profile: S.Array(Vec3)
      .check(
        S.isMinLength(3, {
          identifier: $I`PrismProfileCheck`,
          title: "Prism Profile",
          description: "A prism profile is a closed polygon of at least three coplanar points.",
          message: "Expected at least three profile points",
        })
      )
      .annotateKey({ description: "Closed planar polygon vertices in order; the last joins the first." }),
    extrusion: Vec3.annotateKey({ description: "Extrusion vector; its length is the prism depth." }),
    ...placementFields,
  },
  $I.annote("Prism", {
    description: "Closed planar polygon extruded along a vector, then rotated and translated.",
  })
) {}

/**
 * Right circular cylinder from a base point along an axis, then placed.
 *
 * **Example** (A peg)
 *
 * ```ts
 * import { Cylinder } from "@beep/technical-drawing"
 *
 * const peg = Cylinder.make({ base: [5, 5, 0], axis: [0, 0, 1], radius: 2, height: 8 })
 * console.log(peg.radius)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class Cylinder extends S.Class<Cylinder>($I`Cylinder`)(
  {
    kind: S.tag("cylinder").annotateKey({ description: "Primitive discriminator." }),
    base: Vec3.annotateKey({ description: "Centre of the base disc." }),
    axis: Vec3.annotateKey({ description: "Axis direction from the base; need not be normalised." }),
    radius: PositiveLength.annotateKey({ description: "Disc radius." }),
    height: PositiveLength.annotateKey({ description: "Length along the axis." }),
    ...placementFields,
  },
  $I.annote("Cylinder", {
    description: "Right circular cylinder from a base point along an axis, then rotated and translated.",
  })
) {}

/**
 * Solid primitive discriminated on `kind`.
 *
 * **Example** (Branch on a primitive)
 *
 * ```ts
 * import { Box, Primitive } from "@beep/technical-drawing"
 * import * as S from "effect/Schema"
 *
 * const p = Box.make({ min: [0, 0, 0], max: [1, 1, 1] })
 * console.log(S.is(Primitive)(p))
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export const Primitive = S.Union([Box, Prism, Cylinder]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Primitive", {
    description: "Box, prism, or cylinder primitive discriminated on `kind`.",
  })
);

/**
 * Type for {@link Primitive}.
 *
 * **Example** (Annotate a primitive)
 *
 * ```ts
 * import { Box } from "@beep/technical-drawing"
 * import type { Primitive } from "@beep/technical-drawing"
 *
 * const p: Primitive = Box.make({ min: [0, 0, 0], max: [1, 1, 1] })
 * console.log(p.kind)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export type Primitive = typeof Primitive.Type;

/**
 * One solid of a model: the fusion of its `add` primitives minus its `subtract` primitives.
 *
 * **Details**
 *
 * Parts stay separate solids in the final compound, so edges where two parts
 * touch are still drawn. Use one part per physical piece (panel, tab, peg).
 *
 * **Example** (A plate with a hole)
 *
 * ```ts
 * import { Box, Cylinder, Part } from "@beep/technical-drawing"
 *
 * const plate = Part.make({
 *   name: "plate",
 *   add: [Box.make({ min: [0, 0, 0], max: [60, 40, 3] })],
 *   subtract: [Cylinder.make({ base: [30, 20, -1], axis: [0, 0, 1], radius: 4, height: 5 })]
 * })
 * console.log(plate.name)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class Part extends S.Class<Part>($I`Part`)(
  {
    name: S.NonEmptyString.annotateKey({ description: "Stable part name used in diagnostics." }),
    add: S.Array(Primitive)
      .check(
        S.isMinLength(1, {
          identifier: $I`PartAddCheck`,
          title: "Part Add",
          description: "A part fuses at least one primitive.",
          message: "Expected at least one primitive to add",
        })
      )
      .annotateKey({ description: "Primitives fused together, in order." }),
    subtract: S.Array(Primitive).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({ description: "Primitives cut from the fused result, in order." })
    ),
  },
  $I.annote("Part", {
    description: "One solid: fused `add` primitives minus `subtract` primitives.",
  })
) {}

const LengthUnitBase = LiteralKit(["mm", "in"]);

/**
 * Unit of the model's lengths.
 *
 * **Example** (Read the units)
 *
 * ```ts
 * import { LengthUnit } from "@beep/technical-drawing"
 *
 * console.log(LengthUnit.literals)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export const LengthUnit = LengthUnitBase.pipe(
  $I.annoteSchema("LengthUnit", {
    description: "Length unit of a model: millimetres or inches.",
  }),
  SchemaUtils.withLiteralKitStatics(LengthUnitBase)
);

/**
 * Type for {@link LengthUnit}.
 *
 * **Example** (Annotate a unit)
 *
 * ```ts
 * import type { LengthUnit } from "@beep/technical-drawing"
 *
 * const unit: LengthUnit = "mm"
 * console.log(unit)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export type LengthUnit = typeof LengthUnit.Type;

/**
 * A model: a compound of named parts.
 *
 * **Example** (A one-part model)
 *
 * ```ts
 * import { Box, Part, ModelSpec } from "@beep/technical-drawing"
 *
 * const spec = ModelSpec.make({
 *   parts: [Part.make({ name: "body", add: [Box.make({ min: [0, 0, 0], max: [40, 30, 20] })] })]
 * })
 * console.log(spec.parts.length)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class ModelSpec extends S.Class<ModelSpec>($I`ModelSpec`)(
  {
    units: LengthUnit.pipe(
      S.withConstructorDefault(Effect.succeed("mm" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("mm" as const)),
      S.annotateKey({ description: "Unit of every length in the model. Defaults to mm." })
    ),
    parts: S.Array(Part)
      .check(
        S.isMinLength(1, {
          identifier: $I`ModelSpecPartsCheck`,
          title: "Solid Spec Parts",
          description: "A model has at least one part.",
          message: "Expected at least one part",
        })
      )
      .annotateKey({ description: "Parts kept as separate solids in one compound." }),
  },
  $I.annote("ModelSpec", {
    description: "Compound of named parts built from primitives.",
  })
) {}

/**
 * Viewing camera for hidden-line projection.
 *
 * **Details**
 *
 * `eye` points from the target toward the viewer and `up` fixes the roll;
 * neither needs normalising. `focus` is the eye-to-target distance of a
 * perspective camera in model units; absent, the projection is orthographic.
 *
 * **Example** (Front orthographic and an upper-left perspective)
 *
 * ```ts
 * import { Camera } from "@beep/technical-drawing"
 * import * as O from "effect/Option"
 *
 * const front = Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] })
 * const persp = Camera.make({ eye: [-1, -1.3, 0.9], up: [0, 0, 1], target: [20, 15, 10], focus: O.some(250) })
 * console.log(front.focus, persp.focus)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class Camera extends S.Class<Camera>($I`Camera`)(
  {
    eye: Vec3.annotateKey({ description: "Direction from the target toward the viewer." }),
    up: Vec3.annotateKey({ description: "Approximate up direction; projected to be orthogonal to `eye`." }),
    target: Vec3.pipe(
      S.withConstructorDefault(Effect.succeed([0, 0, 0] as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed([0, 0, 0] as const)),
      S.annotateKey({ description: "View-plane point the camera looks at. Defaults to the origin." })
    ),
    focus: S.OptionFromOptionalKey(PositiveLength).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Perspective eye distance from the target; none means orthographic." })
    ),
  },
  $I.annote("Camera", {
    description: "Hidden-line projection camera: eye direction, up vector, target, optional perspective focus.",
  })
) {}

/**
 * Projected 2D line segment `[x1, y1, x2, y2]` in view-plane model units.
 *
 * **Example** (Make a segment)
 *
 * ```ts
 * import { Segment2 } from "@beep/technical-drawing"
 *
 * console.log(Segment2.make([0, 0, 10, 0]))
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export const Segment2 = S.Tuple([S.Finite, S.Finite, S.Finite, S.Finite]).pipe(
  $I.annoteSchema("Segment2", {
    description: "Projected line segment [x1, y1, x2, y2] in view-plane model units, y up.",
  })
);

/**
 * Type for {@link Segment2}.
 *
 * **Example** (Annotate a segment)
 *
 * ```ts
 * import type { Segment2 } from "@beep/technical-drawing"
 *
 * const s: Segment2 = [0, 0, 1, 1]
 * console.log(s)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export type Segment2 = typeof Segment2.Type;

/**
 * Visible and hidden projected edges of one view.
 *
 * **Details**
 *
 * Every edge is sampled to straight segments (one per straight edge, several
 * per curve), coordinates are rounded to three decimals, each segment is
 * direction-normalised, and the lists are sorted, so equal geometry yields
 * byte-equal output.
 *
 * **Example** (An empty edge set)
 *
 * ```ts
 * import { EdgeSet } from "@beep/technical-drawing"
 *
 * console.log(EdgeSet.make({ visible: [], hidden: [] }).visible.length)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class EdgeSet extends S.Class<EdgeSet>($I`EdgeSet`)(
  {
    visible: S.Array(Segment2).annotateKey({ description: "Visible edges, including silhouettes." }),
    hidden: S.Array(Segment2).annotateKey({ description: "Hidden edges, including silhouettes." }),
  },
  $I.annote("EdgeSet", {
    description: "Canonically ordered visible and hidden projected segments of one view.",
  })
) {}

/**
 * Axis-aligned bounding box of a solid.
 *
 * **Example** (Make a bounding box)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing"
 *
 * console.log(BoundingBox.make({ min: [0, 0, 0], max: [1, 2, 3] }).max)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class BoundingBox extends S.Class<BoundingBox>($I`BoundingBox`)(
  {
    min: Vec3.annotateKey({ description: "Minimum corner." }),
    max: Vec3.annotateKey({ description: "Maximum corner." }),
  },
  $I.annote("BoundingBox", {
    description: "Axis-aligned bounding box.",
  })
) {}

/**
 * Measured facts about a built solid.
 *
 * **Example** (Make a summary)
 *
 * ```ts
 * import { BoundingBox, ModelSummary } from "@beep/technical-drawing"
 *
 * const summary = ModelSummary.make({
 *   boundingBox: BoundingBox.make({ min: [0, 0, 0], max: [1, 1, 1] }),
 *   volume: 1,
 *   faceCount: 6,
 *   edgeCount: 12
 * })
 * console.log(summary.volume)
 * ```
 *
 * @category geometry
 * @since 0.0.0
 */
export class ModelSummary extends S.Class<ModelSummary>($I`ModelSummary`)(
  {
    boundingBox: BoundingBox.annotateKey({ description: "Bounding box of the whole compound." }),
    volume: S.Finite.annotateKey({ description: "Total volume in cubic model units, rounded to three decimals." }),
    faceCount: S.Natural.annotateKey({ description: "Number of faces across all parts." }),
    edgeCount: S.Natural.annotateKey({ description: "Number of edges across all parts." }),
  },
  $I.annote("ModelSummary", {
    description: "Bounding box, volume, and topology counts of a built solid.",
  })
) {}
