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
import * as Effect from "effect/Effect";
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
 * @since 0.0.0
 */
export type Primitive = typeof Primitive.Type;

const PartLineStyleBase = LiteralKit(["solid", "broken"]);

/**
 * Line style of a part's visible edges.
 *
 * **Details**
 *
 * `solid` parts are the claimed design. `broken` parts are unclaimed subject
 * matter (37 CFR 1.152): their visible edges go to the broken-line layer and
 * are drawn dashed.
 *
 * **Gotchas**
 *
 * Broken lines mark unclaimed subject matter, never hidden lines. A broken
 * part's hidden edges are not collected, and the part is never shaded.
 *
 * **Example** (Read the styles)
 *
 * ```ts
 * import { PartLineStyle } from "@beep/technical-drawing"
 *
 * console.log(PartLineStyle.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PartLineStyle = PartLineStyleBase.pipe(
  $I.annoteSchema("PartLineStyle", {
    description: "Line style of a part's visible edges: solid (claimed) or broken (unclaimed, 37 CFR 1.152).",
  }),
  SchemaUtils.withLiteralKitStatics(PartLineStyleBase)
);

/**
 * Type for {@link PartLineStyle}.
 *
 * **Example** (Annotate a style)
 *
 * ```ts
 * import type { PartLineStyle } from "@beep/technical-drawing"
 *
 * const style: PartLineStyle = "broken"
 * console.log(style)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PartLineStyle = typeof PartLineStyle.Type;

/**
 * One solid of a model: the fusion of its `add` primitives minus its `subtract` primitives.
 *
 * **Details**
 *
 * Parts stay separate solids in the final compound, so edges where two parts
 * touch are still drawn. Use one part per physical piece (panel, tab, peg).
 * `lineStyle` chooses how the part's visible edges are drawn; it defaults to
 * `solid`.
 *
 * **Gotchas**
 *
 * A `broken` part is drawn in broken (dashed) lines because it is unclaimed
 * subject matter under 37 CFR 1.152: environment or context the design does
 * not claim. Broken lines are never hidden lines. Only the part's visible
 * edges are drawn, the part still hides what lies behind it, edges hidden by
 * other parts are never collected, and the part is never surface-shaded.
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
 * @category models
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
    lineStyle: PartLineStyle.pipe(
      S.withConstructorDefault(Effect.succeed("solid" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("solid" as const)),
      S.annotateKey({
        description:
          "How the part's visible edges are drawn: solid, or broken for unclaimed subject matter (37 CFR 1.152). Defaults to solid.",
      })
    ),
  },
  $I.annote("Part", {
    description: "One solid: fused `add` primitives minus `subtract` primitives, drawn in solid or broken lines.",
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
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
 * @category models
 * @since 0.0.0
 */
export type Segment2 = typeof Segment2.Type;

const ShadingSkipReasonBase = LiteralKit([
  "back-facing",
  "curved",
  "broken-part",
  "sliver",
  "hidden",
  "lit",
  "no-straight-edge",
  "edge-on",
]);

/**
 * Why a face of a shaded view got no shading lines.
 *
 * **Details**
 *
 * `back-facing`: turned away from the viewer. `curved`: not planar.
 * `broken-part`: belongs to a part drawn in broken lines. `sliver`: narrower
 * on the sheet than the plan's minimum face span, or too narrow for one
 * graded line. `hidden`: graded, but no stretch of it shows in the view.
 * `lit`: above the uniform style's lit threshold.
 * `no-straight-edge`: the hatch axis needs a straight edge the face lacks.
 * `edge-on`: the hatch step is too foreshortened to keep lines apart.
 *
 * **Example** (Read the reasons)
 *
 * ```ts
 * import { ShadingSkipReason } from "@beep/technical-drawing"
 *
 * console.log(ShadingSkipReason.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShadingSkipReason = ShadingSkipReasonBase.pipe(
  $I.annoteSchema("ShadingSkipReason", {
    description:
      "Why a face got no shading lines: back-facing, curved, broken-part, sliver, hidden, lit, no-straight-edge, or edge-on.",
  }),
  SchemaUtils.withLiteralKitStatics(ShadingSkipReasonBase)
);

/**
 * Type for {@link ShadingSkipReason}.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { ShadingSkipReason } from "@beep/technical-drawing"
 *
 * const reason: ShadingSkipReason = "sliver"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ShadingSkipReason = typeof ShadingSkipReason.Type;

/**
 * Number of faces of one view skipped for one reason.
 *
 * **Example** (Three back faces)
 *
 * ```ts
 * import { ShadingSkip } from "@beep/technical-drawing"
 *
 * console.log(ShadingSkip.make({ reason: "back-facing", faces: 3 }).faces)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShadingSkip extends S.Class<ShadingSkip>($I`ShadingSkip`)(
  {
    reason: ShadingSkipReason.annotateKey({ description: "Why the faces got no lines." }),
    faces: S.Natural.annotateKey({ description: "Faces skipped for this reason." }),
  },
  $I.annote("ShadingSkip", {
    description: "Count of faces in one view left unshaded for one reason.",
  })
) {}

/**
 * Shading coverage of one view: faces given lines and faces skipped by reason.
 *
 * **Details**
 *
 * Counted before hidden-line removal, so a shaded face may still be hidden
 * by another part. Skips are listed in {@link ShadingSkipReason} order with
 * zero counts left out.
 *
 * **Example** (Five shaded faces, one sliver)
 *
 * ```ts
 * import { ShadingCoverage, ShadingSkip } from "@beep/technical-drawing"
 *
 * const coverage = ShadingCoverage.make({
 *   shadedFaces: 5,
 *   skippedFaces: [ShadingSkip.make({ reason: "sliver", faces: 1 })]
 * })
 * console.log(coverage.shadedFaces)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShadingCoverage extends S.Class<ShadingCoverage>($I`ShadingCoverage`)(
  {
    shadedFaces: S.Natural.annotateKey({ description: "Faces given shading lines." }),
    skippedFaces: S.Array(ShadingSkip).annotateKey({
      description: "Faces left unshaded, per reason, in reason order; zero counts left out.",
    }),
    lostFaces: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Faces given shading lines whose every stroke the hidden-line and legibility passes then removed; counted in `shadedFaces` too. Defaults to 0.",
      })
    ),
  },
  $I.annote("ShadingCoverage", {
    description:
      "Faces of one view given shading lines, faces skipped per reason, and faces whose lines were all lost after hidden-line removal.",
  })
) {}

/**
 * Visible and hidden projected edges of one view.
 *
 * **Details**
 *
 * Every edge is sampled to straight segments (one per straight edge, several
 * per curve), coordinates are rounded to three decimals, each segment is
 * direction-normalised, and the lists are sorted, so equal geometry yields
 * byte-equal output. `visible` and `hidden` hold the edges of solid parts;
 * `broken` holds only the visible edges of broken-line parts.
 *
 * **Example** (An empty edge set)
 *
 * ```ts
 * import { EdgeSet } from "@beep/technical-drawing"
 *
 * console.log(EdgeSet.make({ visible: [], hidden: [] }).visible.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EdgeSet extends S.Class<EdgeSet>($I`EdgeSet`)(
  {
    visible: S.Array(Segment2).annotateKey({ description: "Visible edges, including silhouettes." }),
    hidden: S.Array(Segment2).annotateKey({ description: "Hidden edges, including silhouettes." }),
    shading: S.Array(Segment2).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({ description: "Visible surface-shading lines; empty when the view was not shaded." })
    ),
    shadingCoverage: S.OptionFromOptionalKey(ShadingCoverage).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Faces shaded and skipped; absent when the view was not shaded." })
    ),
    broken: S.Array(Segment2).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description:
          "Visible edges of broken-line parts (unclaimed subject matter), drawn dashed; empty when no part is broken.",
      })
    ),
  },
  $I.annote("EdgeSet", {
    description: "Canonically ordered visible, hidden, shading, and broken-line projected segments of one view.",
  })
) {}

const ShadingStyleBase = LiteralKit(["uniform", "graded"]);

/**
 * How shading lines are spaced on a face.
 *
 * **Details**
 *
 * `uniform` (the default) spaces lines evenly across the face at a pitch set
 * by its exposure and leaves faces above the lit threshold blank. `graded`
 * shades every visible planar face: the first line sits one minimum pitch
 * from the shadow edge and the gaps grow toward the lit side, in the manner
 * of the USPTO Guide's 1.84(m) spaced-line examples.
 *
 * **Example** (Read the styles)
 *
 * ```ts
 * import { ShadingStyle } from "@beep/technical-drawing"
 *
 * console.log(ShadingStyle.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShadingStyle = ShadingStyleBase.pipe(
  $I.annoteSchema("ShadingStyle", {
    description: "`uniform` evenly spaced lines with a lit threshold, or `graded` lines from the shadow edge.",
  }),
  SchemaUtils.withLiteralKitStatics(ShadingStyleBase)
);

/**
 * Type for {@link ShadingStyle}.
 *
 * **Example** (Annotate a style)
 *
 * ```ts
 * import type { ShadingStyle } from "@beep/technical-drawing"
 *
 * const style: ShadingStyle = "graded"
 * console.log(style)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ShadingStyle = typeof ShadingStyle.Type;

const HatchAxisBase = LiteralKit(["longest-edge", "surface-class"]);

/**
 * Which way shading lines run on a face.
 *
 * **Details**
 *
 * `longest-edge` (the default) runs lines along the face's longest straight
 * edge. `surface-class` runs them along +Z on upright faces (walls read
 * vertical in every elevation and pictorial) and, on inclined and level
 * faces, along the major straight edge whose outward side faces most away
 * from the 1.84(m) light (a hanging flap is hatched along its lower-right
 * edge, a lid along its lower-right edge); without a light, inclined faces
 * take their level line and level faces their longest edge.
 *
 * **Example** (Read the axes)
 *
 * ```ts
 * import { HatchAxis } from "@beep/technical-drawing"
 *
 * console.log(HatchAxis.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HatchAxis = HatchAxisBase.pipe(
  $I.annoteSchema("HatchAxis", {
    description: "`longest-edge` lines along a face's longest edge, or `surface-class` lines by face orientation.",
  }),
  SchemaUtils.withLiteralKitStatics(HatchAxisBase)
);

/**
 * Type for {@link HatchAxis}.
 *
 * **Example** (Annotate an axis)
 *
 * ```ts
 * import type { HatchAxis } from "@beep/technical-drawing"
 *
 * const axis: HatchAxis = "surface-class"
 * console.log(axis)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HatchAxis = typeof HatchAxis.Type;

const ExposureThreshold = S.Finite.check(
  S.isGreaterThanOrEqualTo(-1, {
    identifier: $I`ExposureThresholdMinCheck`,
    title: "Exposure Threshold Minimum",
    description: "Exposure is a cosine, so a threshold below -1 shades nothing differently.",
    message: "Expected a threshold of at least -1",
  }),
  S.isLessThanOrEqualTo(1, {
    identifier: $I`ExposureThresholdMaxCheck`,
    title: "Exposure Threshold Maximum",
    description: "Exposure is a cosine, so a threshold above 1 shades every face.",
    message: "Expected a threshold of at most 1",
  })
);

/**
 * Straight-line surface-shading plan for one projection, in model units.
 *
 * **Details**
 *
 * Exposure is the cosine between a face's outward normal and the 37 CFR
 * 1.84(m) light (upper left, toward the viewer, 45°) in the camera frame.
 * Under the default `uniform` style, faces whose exposure exceeds
 * `litThreshold` stay unshaded and the rest get parallel lines whose pitch
 * runs from `minPitch` (exposure -1, darkest) to `maxPitch` (exposure at the
 * threshold). The `graded` style shades every visible planar face from its
 * shadow edge (see {@link ShadingStyle}); `axis` picks the line direction
 * (see {@link HatchAxis}); faces narrower than `minFaceSpan` are never
 * hatched, and chords shorter than `minStroke` on the view plane are dropped. Only planar faces turned toward the camera are shaded, and the
 * lines pass through the same hidden-line removal as the outlines. The
 * defaults reproduce the original hatch exactly.
 *
 * **Example** (A plan in millimetres)
 *
 * ```ts
 * import { ShadingPlan } from "@beep/technical-drawing"
 *
 * const plan = ShadingPlan.make({ minPitch: 0.6, maxPitch: 2.4 })
 * console.log(plan.litThreshold)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShadingPlan extends S.Class<ShadingPlan>($I`ShadingPlan`)(
  {
    minPitch: PositiveLength.annotateKey({ description: "Line pitch on the darkest faces, in model units." }),
    maxPitch: PositiveLength.annotateKey({ description: "Line pitch on the faintest shaded faces, in model units." }),
    litThreshold: ExposureThreshold.pipe(
      S.withConstructorDefault(Effect.succeed(0.75)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.75)),
      S.annotateKey({
        description:
          "Exposure above which a face stays unshaded under the uniform style; graded shading ignores it. Defaults to 0.75.",
      })
    ),
    style: ShadingStyle.pipe(
      S.withConstructorDefault(Effect.succeed("uniform" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("uniform" as const)),
      S.annotateKey({ description: "Line spacing style. Defaults to `uniform`." })
    ),
    axis: HatchAxis.pipe(
      S.withConstructorDefault(Effect.succeed("longest-edge" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("longest-edge" as const)),
      S.annotateKey({ description: "Which way lines run on a face. Defaults to `longest-edge`." })
    ),
    minFaceSpan: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`ShadingMinFaceSpanCheck`,
        title: "Shading Minimum Face Span",
        description: "A face narrower than this on the view plane is a sliver and gets no lines.",
        message: "Expected a non-negative minimum face span",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Projected width, in model units, below which a face is a sliver and gets no lines. Defaults to 0 (no slivers).",
      })
    ),
    minStroke: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`ShadingMinStrokeCheck`,
        title: "Shading Minimum Stroke",
        description: "A shading stroke shorter than this on the view plane is not drawn.",
        message: "Expected a non-negative minimum stroke length",
      })
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Projected length, in model units, below which a cut chord is dropped instead of drawn: near a pointed corner the strokes would read as a dot ladder (the 1993 Guide's strokes are 2-8 mm on the sheet). Defaults to 0 (every chord is drawn).",
      })
    ),
    clearance: S.OptionFromOptionalKey(PositiveLength).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Distance, in model units, a graded stroke end keeps from every drawn outline after hidden-line removal; none means half the minimum pitch. A sheet sets it to the larger of half its pitch and the validator's spacing floor, so a render passes its own check.",
      })
    ),
  },
  $I.annote("ShadingPlan", {
    description:
      "Pitch range, lit threshold, style, hatch axis, sliver width, minimum stroke, and outline clearance of straight-line shading, in model units.",
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
 * @category models
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
 * **Details**
 *
 * The volume sums every part, so overlapping parts are counted twice;
 * `partOverlaps` reports how many part pairs truly overlap. Contact faces
 * modelled with zero clearance do not count as overlaps.
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
 * @category models
 * @since 0.0.0
 */
export class ModelSummary extends S.Class<ModelSummary>($I`ModelSummary`)(
  {
    boundingBox: BoundingBox.annotateKey({ description: "Bounding box of the whole compound." }),
    volume: S.Finite.annotateKey({ description: "Total volume in cubic model units, rounded to three decimals." }),
    faceCount: S.Natural.annotateKey({ description: "Number of faces across all parts." }),
    edgeCount: S.Natural.annotateKey({ description: "Number of edges across all parts." }),
    partOverlaps: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Pairs of parts whose common volume exceeds the kernel tolerance; parts that only touch do not count. Defaults to 0.",
      })
    ),
  },
  $I.annote("ModelSummary", {
    description: "Bounding box, volume, topology counts, and part-overlap count of a built model.",
  })
) {}
