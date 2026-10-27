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
import { O } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $TechnicalDrawingId.create("Geometry.schemas");

/**
 * Finite 3D vector or point in model units.
 *
 * **Example** (Make a vector)
 *
 * ```ts
 * import { Vec3 } from "@beep/technical-drawing/Geometry.schemas"
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
 * import type { Vec3 } from "@beep/technical-drawing/Geometry.schemas"
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
 * import { PositiveLength } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(PositiveLength.make(12.5))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PositiveLength = S.Finite.check(
  S.isGreaterThan(
    0,
    $I.annote("PositiveLengthCheck", {
      title: "Positive Length",
      description: "Lengths, radii, and focal distances are strictly positive.",
      message: "Expected a strictly positive length",
    })
  )
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
 * import { PositiveLength } from "@beep/technical-drawing/Geometry.schemas"
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
 * import { Rotation } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const r = Rotation.make({ axis: [0, 0, 1], degrees: 90 })
 * console.log(r.origin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Rotation extends S.Opaque<Rotation, { readonly brand: unique symbol }>()(
  S.Struct({
    axis: Vec3.annotateKey({ description: "Axis direction; need not be normalised." }),
    origin: Vec3.pipe(
      S.withConstructorDefault(Effect.succeed([0, 0, 0] as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed([0, 0, 0] as const)),
      S.annotateKey({ description: "Point the axis passes through. Defaults to the origin." })
    ),
    degrees: S.Finite.annotateKey({ description: "Signed rotation angle in degrees (right-hand rule)." }),
  }).pipe(
    $I.annoteSchema("Rotation", {
      description: "Rotation about an axis through a point, in degrees.",
    })
  )
) {}

const PartLineStyleBase = LiteralKit(["solid", "broken"]);

/**
 * Line style of a part's visible edges, or of the surface one primitive covers inside a solid part.
 *
 * **Details**
 *
 * `solid` parts are the claimed design. `broken` parts are unclaimed subject
 * matter (37 CFR 1.152): their visible edges go to the broken-line layer and
 * are drawn dashed. An add primitive of a solid part may carry `broken` too:
 * the edges of the surface only it covers are then drawn dashed while the
 * part stays one fused solid (see {@link Box}).
 *
 * **Gotchas**
 *
 * Broken lines mark unclaimed subject matter, never hidden lines. A broken
 * part's hidden edges are not collected, and the part is never shaded.
 *
 * **Example** (Read the styles)
 *
 * ```ts
 * import { PartLineStyle } from "@beep/technical-drawing/Geometry.schemas"
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
 * import type { PartLineStyle } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const style: PartLineStyle = "broken"
 * console.log(style)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PartLineStyle = typeof PartLineStyle.Type;

// Fields every primitive shares: its placement and the line style of its own faces.
const primitiveFields = {
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
  lineStyle: S.OptionFromOptionalKey(PartLineStyle).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({
      description: "Line style of this primitive's own faces inside its part; absent, the part's style.",
    })
  ),
};

/**
 * Axis-aligned box spanning two opposite corners, then placed.
 *
 * **Details**
 *
 * Every primitive takes an optional `lineStyle`. Absent, its faces are drawn
 * in its part's style. On an add primitive of a solid part, `broken` marks
 * unclaimed matter fused into the claimed part, such as a flap's coplanar
 * tabs: the part is still built as one solid, so no seam line crosses the tab
 * root. The part's surface outside every solid add primitive is unclaimed:
 * every edge and silhouette bounding it is drawn in broken lines (its hidden
 * stretches not at all), a face lying only on broken primitives is never
 * shaded, and a face shared with a solid primitive (the flap and tab top
 * surface) is shaded only on the solid primitive's part of it. Where a
 * claimed and an unclaimed edge project onto one line, the nearer is drawn.
 *
 * **Gotchas**
 *
 * Only add primitives of a solid part are read: a broken part draws every
 * face broken, and a subtract primitive's style is ignored.
 *
 * **Example** (A 40 × 30 × 20 box on the XY plane)
 *
 * ```ts
 * import { Box } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const box = Box.make({ min: [0, 0, 0], max: [40, 30, 20] })
 * console.log(box.kind)
 * ```
 *
 * **Example** (A flap with an unclaimed tab fused into it)
 *
 * ```ts
 * import { Box, Part } from "@beep/technical-drawing/Geometry.schemas"
 * import * as O from "effect/Option"
 *
 * const flap = Part.make({
 *   name: "flap",
 *   add: [
 *     Box.make({ min: [0, 0, 0], max: [40, 20, 2] }),
 *     Box.make({ min: [17, -8, 0], max: [23, 0, 2], lineStyle: O.some("broken") })
 *   ]
 * })
 * console.log(flap.add.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Box extends S.Opaque<Box, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("box").annotateKey({ description: "Primitive discriminator." }),
    min: Vec3.annotateKey({ description: "Corner with the smaller coordinates." }),
    max: Vec3.annotateKey({ description: "Corner with the larger coordinates." }),
    ...primitiveFields,
  }).pipe(
    $I.annoteSchema("Box", {
      description: "Axis-aligned box between two corners, then rotated and translated.",
    })
  )
) {}

/**
 * Planar polygon profile extruded along a vector, then placed.
 *
 * **Details**
 *
 * `lineStyle` works as on {@link Box}: absent, the part's style; `broken` on
 * an add primitive of a solid part draws its unclaimed surface's edges in
 * broken lines.
 *
 * **Example** (A triangular wedge)
 *
 * ```ts
 * import { Prism } from "@beep/technical-drawing/Geometry.schemas"
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
export class Prism extends S.Opaque<Prism, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("prism").annotateKey({ description: "Primitive discriminator." }),
    profile: S.Array(Vec3)
      .check(
        S.isMinLength(
          3,
          $I.annote("PrismProfileCheck", {
            title: "Prism Profile",
            description: "A prism profile is a closed polygon of at least three coplanar points.",
            message: "Expected at least three profile points",
          })
        )
      )
      .annotateKey({ description: "Closed planar polygon vertices in order; the last joins the first." }),
    extrusion: Vec3.annotateKey({ description: "Extrusion vector; its length is the prism depth." }),
    ...primitiveFields,
  }).pipe(
    $I.annoteSchema("Prism", {
      description: "Closed planar polygon extruded along a vector, then rotated and translated.",
    })
  )
) {}

/**
 * Right circular cylinder from a base point along an axis, then placed.
 *
 * **Details**
 *
 * `lineStyle` works as on {@link Box}: absent, the part's style; `broken` on
 * an add primitive of a solid part draws its unclaimed surface's edges in
 * broken lines.
 *
 * **Example** (A peg)
 *
 * ```ts
 * import { Cylinder } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const peg = Cylinder.make({ base: [5, 5, 0], axis: [0, 0, 1], radius: 2, height: 8 })
 * console.log(peg.radius)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Cylinder extends S.Opaque<Cylinder, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("cylinder").annotateKey({ description: "Primitive discriminator." }),
    base: Vec3.annotateKey({ description: "Centre of the base disc." }),
    axis: Vec3.annotateKey({ description: "Axis direction from the base; need not be normalised." }),
    radius: PositiveLength.annotateKey({ description: "Disc radius." }),
    height: PositiveLength.annotateKey({ description: "Length along the axis." }),
    ...primitiveFields,
  }).pipe(
    $I.annoteSchema("Cylinder", {
      description: "Right circular cylinder from a base point along an axis, then rotated and translated.",
    })
  )
) {}

/**
 * Solid primitive discriminated on `kind`.
 *
 * **Example** (Branch on a primitive)
 *
 * ```ts
 * import { Box, Primitive } from "@beep/technical-drawing/Geometry.schemas"
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
 * import { Box } from "@beep/technical-drawing/Geometry.schemas"
 * import type { Primitive } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const p: Primitive = Box.make({ min: [0, 0, 0], max: [1, 1, 1] })
 * console.log(p.kind)
 * ```
 *
 * @category models
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
 * `lineStyle` chooses how the part's visible edges are drawn; it defaults to
 * `solid`. An add primitive of a solid part may set its own `lineStyle` to
 * draw the surface only it covers in broken lines without splitting the
 * part.
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
 * import { Box, Cylinder, Part } from "@beep/technical-drawing/Geometry.schemas"
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
export class Part extends S.Opaque<Part, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "Stable part name used in diagnostics." }),
    add: S.Array(Primitive)
      .check(
        S.isMinLength(
          1,
          $I.annote("PartAddCheck", {
            title: "Part Add",
            description: "A part fuses at least one primitive.",
            message: "Expected at least one primitive to add",
          })
        )
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
  }).pipe(
    $I.annoteSchema("Part", {
      description: "One solid: fused `add` primitives minus `subtract` primitives, drawn in solid or broken lines.",
    })
  )
) {}

const OverlayStyleBase = LiteralKit(["emphasis", "broken"]);

/**
 * Line class of an authored overlay line.
 *
 * **Details**
 *
 * `emphasis` lines are drawn on top of the outlines in the sheet's heavier
 * emphasis weight, such as the edge where a tab sits flush in its slot.
 * `broken` lines join the broken-line layer and are drawn dashed exactly like
 * a broken part's edges: unclaimed subject matter (37 CFR 1.152), such as the
 * corrugation on an exposed board edge.
 *
 * **Example** (Read the styles)
 *
 * ```ts
 * import { OverlayStyle } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(OverlayStyle.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OverlayStyle = OverlayStyleBase.pipe(
  $I.annoteSchema("OverlayStyle", {
    description:
      "Line class of an overlay line: emphasis (heavier than outlines) or broken (dashed, unclaimed, 37 CFR 1.152).",
  }),
  SchemaUtils.withLiteralKitStatics(OverlayStyleBase)
);

/**
 * Type for {@link OverlayStyle}.
 *
 * **Example** (Annotate a style)
 *
 * ```ts
 * import type { OverlayStyle } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const style: OverlayStyle = "emphasis"
 * console.log(style)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OverlayStyle = typeof OverlayStyle.Type;

const OverlayFacing = Vec3.check(
  S.makeFilter(
    (v: Vec3) => Math.hypot(v[0], v[1], v[2]) > 0,
    $I.annote("OverlayFacingCheck", {
      title: "Overlay Facing",
      description: "An overlay's facing is the outward normal of the face it lies on, so it has a direction.",
      message: "Expected a non-zero facing vector",
    })
  )
);

/**
 * An authored 3D polyline drawn over the projected outlines of a model.
 *
 * **Details**
 *
 * The spec author draws an overlay line in model space; the pipeline only
 * projects it. Consecutive points are joined, and the polyline stays open.
 * The line goes through the same hidden-line removal as the outlines, so a
 * part standing in front of it hides it.
 *
 * `facing` is the outward normal of the face the line lies on. With a facing,
 * the line is drawn only in views whose eye direction makes a cosine above 0.2
 * with it. A line on a face seen edge-on or from behind therefore never prints
 * over an outline. The line is also moved `lift` model units along the facing
 * before hidden-line removal, so the face it lies on does not hide it. Without
 * a facing the line is drawn in every view and is not moved.
 *
 * **Gotchas**
 *
 * A `broken` overlay is unclaimed subject matter: its visible pieces join the
 * broken-line layer, and an empty facing makes it print in every view.
 *
 * **Example** (A heavy edge along a tab seated in its slot)
 *
 * ```ts
 * import { OverlayLine } from "@beep/technical-drawing/Geometry.schemas"
 * import * as O from "effect/Option"
 *
 * const seat = OverlayLine.make({
 *   name: "tab-seat",
 *   style: "emphasis",
 *   points: [[20, -2, 43], [30, -2, 43]],
 *   facing: O.some([0, -1, 0])
 * })
 * console.log(seat.lift)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OverlayLine extends S.Opaque<OverlayLine, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "Stable overlay name used in diagnostics." }),
    style: OverlayStyle.annotateKey({ description: "Line class: emphasis or broken." }),
    points: S.Array(Vec3)
      .check(
        S.isMinLength(
          2,
          $I.annote("OverlayLinePointsCheck", {
            title: "Overlay Line Points",
            description: "An overlay line joins at least two points.",
            message: "Expected at least two overlay points",
          })
        )
      )
      .annotateKey({ description: "Open polyline vertices in model units; consecutive points are joined." }),
    facing: S.OptionFromOptionalKey(OverlayFacing).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Outward normal of the face the line lies on. When present, the line is drawn only in views whose eye direction makes a cosine above 0.2 with it; none draws it in every view.",
      })
    ),
    lift: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0.01)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.01)),
      S.annotateKey({
        description:
          "Model units the line is moved along its facing, toward the viewer, so hidden-line removal sees it in front of the face it lies on. Ignored without a facing. Defaults to 0.01.",
      })
    ),
  }).pipe(
    $I.annoteSchema("OverlayLine", {
      description:
        "Authored open 3D polyline drawn as an emphasis or broken line, culled by an optional face normal and lifted off its face.",
    })
  )
) {}

const LengthUnitBase = LiteralKit(["mm", "in"]);

/**
 * Unit of the model's lengths.
 *
 * **Example** (Read the units)
 *
 * ```ts
 * import { LengthUnit } from "@beep/technical-drawing/Geometry.schemas"
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
 * import type { LengthUnit } from "@beep/technical-drawing/Geometry.schemas"
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
 * A model: a compound of named parts, plus authored overlay lines.
 *
 * **Details**
 *
 * `overlays` defaults to none, so a spec written before overlay lines existed
 * decodes and projects unchanged.
 *
 * **Example** (A one-part model)
 *
 * ```ts
 * import { Box, Part, ModelSpec } from "@beep/technical-drawing/Geometry.schemas"
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
export class ModelSpec extends S.Opaque<ModelSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    units: LengthUnit.pipe(
      S.withConstructorDefault(Effect.succeed("mm" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("mm" as const)),
      S.annotateKey({ description: "Unit of every length in the model. Defaults to mm." })
    ),
    parts: S.Array(Part)
      .check(
        S.isMinLength(
          1,
          $I.annote("ModelSpecPartsCheck", {
            title: "Solid Spec Parts",
            description: "A model has at least one part.",
            message: "Expected at least one part",
          })
        ),
        S.isMaxLength(
          256,
          $I.annote("ModelSpecPartsMaxCheck", {
            title: "Solid Spec Parts Limit",
            description: "A model has at most 256 parts to bound overlap work.",
            message: "Expected at most 256 parts",
          })
        )
      )
      .annotateKey({ description: "Parts kept as separate solids in one compound." }),
    overlays: S.Array(OverlayLine).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description: "Authored emphasis and broken overlay lines, projected with the parts. Defaults to none.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ModelSpec", {
      description: "Compound of named parts built from primitives, plus authored overlay lines.",
    })
  )
) {}

const HiddenLinePassAboutBase = LiteralKit(["origin", "target"]);

/**
 * Point a camera's hidden-line pass runs about.
 *
 * **Details**
 *
 * `origin` runs the pass about the model's own origin, as every camera did
 * before the field existed. `target` runs it about the camera's target: a
 * kernel whose perspective pass places its eye relative to the pass origin
 * then sees the model from the camera's own eye point. A camera whose target
 * stands well clear of the model (a two-point pictorial) needs `target`.
 *
 * **Example** (Read the pass origins)
 *
 * ```ts
 * import { HiddenLinePassAbout } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(HiddenLinePassAbout.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HiddenLinePassAbout = HiddenLinePassAboutBase.pipe(
  $I.annoteSchema("HiddenLinePassAbout", {
    description: "Point a camera's hidden-line pass runs about: the model's `origin` or the camera's `target`.",
  }),
  SchemaUtils.withLiteralKitStatics(HiddenLinePassAboutBase)
);

/**
 * Type for {@link HiddenLinePassAbout}.
 *
 * **Example** (Annotate a pass origin)
 *
 * ```ts
 * import type { HiddenLinePassAbout } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const about: HiddenLinePassAbout = "target"
 * console.log(about)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HiddenLinePassAbout = typeof HiddenLinePassAbout.Type;

// Encoded only when it is not `origin`, so cameras written before the field existed encode byte for byte as before.
const hiddenLinePassAboutKey = S.optionalKey(HiddenLinePassAbout).pipe(
  S.decodeTo(
    HiddenLinePassAbout,
    SchemaTransformation.transformOptional<HiddenLinePassAbout, HiddenLinePassAbout>({
      decode: (about) => O.some(O.getOrElse(about, () => HiddenLinePassAbout.Enum.origin)),
      encode: O.filter((about) => about !== HiddenLinePassAbout.Enum.origin),
    })
  ),
  S.withConstructorDefault(Effect.succeed(HiddenLinePassAbout.Enum.origin)),
  S.annotateKey({
    description:
      "Point the hidden-line pass runs about: `origin` (the model's, the default, omitted when encoded) or `target`.",
  })
);

/**
 * Viewing camera for hidden-line projection.
 *
 * **Details**
 *
 * `eye` points from the target toward the viewer and `up` fixes the roll;
 * neither needs normalising. `focus` is the eye-to-target distance of a
 * perspective camera in model units; absent, the projection is orthographic.
 * `sight` is the direction toward the viewer that face-facing decisions
 * (shading, faced overlay lines) read in place of `eye`. A camera aimed at
 * the model's centre needs none; a two-point camera, whose level line of
 * sight would read every level face as edge-on, carries the direction from
 * the box centre to its eye point. `hiddenLinePassAbout` says where the
 * hidden-line pass runs (see {@link HiddenLinePassAbout}); it is set apart
 * from `sight`, so a camera can change what it reads as facing without
 * moving its pass.
 *
 * **Example** (Front orthographic and an upper-left perspective)
 *
 * ```ts
 * import { Camera } from "@beep/technical-drawing/Geometry.schemas"
 * import * as O from "effect/Option"
 *
 * const front = Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] })
 * const persp = Camera.make({ eye: [-1, -1.3, 0.9], up: [0, 0, 1], target: [20, 15, 10], focus: O.some(250) })
 * console.log(front.focus, persp.focus, persp.hiddenLinePassAbout)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Camera extends S.Opaque<Camera, { readonly brand: unique symbol }>()(
  S.Struct({
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
    sight: S.OptionFromOptionalKey(Vec3).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Direction toward the viewer that shading and faced overlay lines read for which way a face turns; none means `eye`.",
      })
    ),
    hiddenLinePassAbout: hiddenLinePassAboutKey,
  }).pipe(
    $I.annoteSchema("Camera", {
      description:
        "Hidden-line projection camera: eye direction, up vector, target, optional perspective focus, optional facing sight, and the point its hidden-line pass runs about.",
    })
  )
) {}

/**
 * Projected 2D line segment `[x1, y1, x2, y2]` in view-plane model units.
 *
 * **Example** (Make a segment)
 *
 * ```ts
 * import { Segment2 } from "@beep/technical-drawing/Geometry.schemas"
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
 * import type { Segment2 } from "@beep/technical-drawing/Geometry.schemas"
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
  "narrow",
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
 * import { ShadingSkipReason } from "@beep/technical-drawing/Geometry.schemas"
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
 * import type { ShadingSkipReason } from "@beep/technical-drawing/Geometry.schemas"
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
 * import { ShadingSkip } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(ShadingSkip.make({ reason: "back-facing", faces: 3 }).faces)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShadingSkip extends S.Opaque<ShadingSkip, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: ShadingSkipReason.annotateKey({ description: "Why the faces got no lines." }),
    faces: S.Natural.annotateKey({ description: "Faces skipped for this reason." }),
  }).pipe(
    $I.annoteSchema("ShadingSkip", {
      description: "Count of faces in one view left unshaded for one reason.",
    })
  )
) {}

const ShadingStretchSkipReasonBase = LiteralKit(["narrow", "sliver", "no-room", "ink-order"]);

/**
 * Why a visible stretch of a face given shading lines drew no band.
 *
 * **Details**
 *
 * `narrow`: the rules found room for one line only, and one line beside an
 * outline reads as a doubled edge. `sliver`: the rules found room for no
 * line. `no-room`: lines were planned, but fewer than two of their strokes
 * reach the legible stroke length. `ink-order`: the band, drawn on its whole
 * chords (its taper, or hidden-line removal, left its tapered strokes no room)
 * and cut back to its taper, still carried more ink than a darker face beside
 * it at the lit floor, so it was left bare.
 *
 * **Example** (Read the reasons)
 *
 * ```ts
 * import { ShadingStretchSkipReason } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(ShadingStretchSkipReason.literals) // ["narrow", "sliver", "no-room", "ink-order"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShadingStretchSkipReason = ShadingStretchSkipReasonBase.pipe(
  $I.annoteSchema("ShadingStretchSkipReason", {
    description:
      "Why a visible stretch of a face given shading lines drew no band: narrow, sliver, no-room, or ink-order.",
  }),
  SchemaUtils.withLiteralKitStatics(ShadingStretchSkipReasonBase)
);

/**
 * Type for {@link ShadingStretchSkipReason}.
 *
 * **Example** (Annotate a stretch skip reason)
 *
 * ```ts
 * import type { ShadingStretchSkipReason } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const reason: ShadingStretchSkipReason = "narrow"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ShadingStretchSkipReason = typeof ShadingStretchSkipReason.Type;

/**
 * Number of visible stretches of one view's shaded faces that drew no band
 * for one reason, and how many of them had measured room for a band.
 *
 * **Details**
 *
 * A stretch has room for a band when the part of it whose visible chord
 * reaches the legible stroke length is at least 3.4 minimum pitches across on
 * the sheet: a first line one pitch in, a second 1.4 pitches past it, and a
 * pitch to spare (`stretchFitsBand` in `Shading.rules`). A skipped stretch
 * with that room is a band the planner failed to draw, which the validator
 * reports.
 *
 * **Example** (Two narrow stretches, one of them with room for a band)
 *
 * ```ts
 * import { ShadingStretchSkip } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(ShadingStretchSkip.make({ reason: "narrow", stretches: 2, fitting: 1 }).fitting) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShadingStretchSkip extends S.Opaque<ShadingStretchSkip, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: ShadingStretchSkipReason.annotateKey({ description: "Why the stretches drew no band." }),
    stretches: S.Natural.annotateKey({ description: "Visible stretches skipped for this reason." }),
    fitting: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "How many of those stretches had measured room for a band: legible chords at least 3.4 minimum pitches across. Defaults to 0.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ShadingStretchSkip", {
      description:
        "Count of visible stretches of one view's shaded faces that drew no band for one reason, and how many had room for one.",
    })
  )
) {}

/**
 * Shading coverage of one view: faces given lines and faces skipped by reason.
 *
 * **Details**
 *
 * Counted before hidden-line removal, so a shaded face may still be hidden
 * by another part. Skips are listed in {@link ShadingSkipReason} order with
 * zero counts left out. Under graded shading every visible stretch of a face
 * given lines is planned on its own: a stretch that drew no band by design is
 * counted in `skippedStretches` ({@link ShadingStretchSkipReason} order, zero
 * counts left out), and a band drawn again on its whole chords after
 * hidden-line removal cut its tapered strokes in `redrawnStretches`. The
 * engine counts `lostFaces` and `lostStretches` on the strokes it projects;
 * a render adds the bands the sheet's re-clip beside separated outlines then
 * empties (`reclippedCoverage`), so its manifest counts what the sheet draws.
 *
 * **Example** (Five shaded faces, one sliver)
 *
 * ```ts
 * import { ShadingCoverage, ShadingSkip } from "@beep/technical-drawing/Geometry.schemas"
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
export class ShadingCoverage extends S.Opaque<ShadingCoverage, { readonly brand: unique symbol }>()(
  S.Struct({
    shadedFaces: S.Natural.annotateKey({ description: "Faces given shading lines." }),
    skippedFaces: S.Array(ShadingSkip).annotateKey({
      description: "Faces left unshaded, per reason, in reason order; zero counts left out.",
    }),
    lostFaces: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Faces given shading lines whose every stroke the hidden-line and legibility passes, or on the sheet the re-clip beside separated outlines, then removed; counted in `shadedFaces` too. Defaults to 0.",
      })
    ),
    lostStretches: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Visible stretches of faces that were planned at least two shading lines and drew none after the hidden-line and legibility passes, or on the sheet after the re-clip beside separated outlines; a face with another stretch still drawn is not a lost face. Defaults to 0.",
      })
    ),
    skippedStretches: S.Array(ShadingStretchSkip).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description:
          "Visible stretches of faces given shading lines that drew no band by design, per reason, in reason order; zero counts left out. Defaults to none.",
      })
    ),
    redrawnStretches: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Tapered bands that hidden-line removal and the legibility pass left with fewer than two strokes, drawn again on their whole chords and cut back to their taper. Defaults to 0.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ShadingCoverage", {
      description:
        "Faces of one view given shading lines, faces skipped per reason, faces whose lines were all lost after hidden-line removal or the sheet's re-clip, planned stretches that drew nothing, stretches skipped by design, and bands redrawn on their whole chords.",
    })
  )
) {}

/**
 * One visible stretch of a face that drew shading lines: the face it shades
 * and the strokes of its band.
 *
 * **Details**
 *
 * `strokes` index the view's `EdgeSet.shading`, which keeps the one canonical
 * stroke order the sheet draws. A pass that changes strokes after projection
 * (the re-clip beside outlines the sheet separates) reads through them which
 * stretch, and which face, it left bare. `face` numbers the faces the view
 * planned shading for, so the bands of one face share it; the numbering is
 * the engine's and means nothing across views.
 *
 * **Example** (A band of three strokes on the view's first planned face)
 *
 * ```ts
 * import { ShadingBand } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(ShadingBand.make({ face: 0, strokes: [0, 2, 5] }).strokes.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShadingBand extends S.Opaque<ShadingBand, { readonly brand: unique symbol }>()(
  S.Struct({
    face: S.Natural.annotateKey({
      description: "The face the band shades, numbered among the faces the view planned; bands of one face share it.",
    }),
    strokes: S.NonEmptyArray(S.Natural).annotateKey({
      description: "Indices into the view's `shading` of the strokes the band drew, ascending.",
    }),
  }).pipe(
    $I.annoteSchema("ShadingBand", {
      description: "A visible stretch of a face that drew shading lines: its face and the indices of its strokes.",
    })
  )
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
 * `broken` holds only the visible edges of broken-line parts, the visible
 * edges of faces a solid part's broken primitives alone own (see {@link Box}),
 * and the visible pieces of `broken` overlay lines; `emphasis` holds the
 * visible pieces of `emphasis` overlay lines (see {@link OverlayLine}).
 * `shadingBands` group the shading strokes by the visible stretch that drew
 * them (see {@link ShadingBand}).
 *
 * **Example** (An empty edge set)
 *
 * ```ts
 * import { EdgeSet } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(EdgeSet.make({ visible: [], hidden: [] }).visible.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EdgeSet extends S.Opaque<EdgeSet, { readonly brand: unique symbol }>()(
  S.Struct({
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
    shadingBands: S.Array(ShadingBand).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description:
          "Visible stretches that drew shading lines, each with its face and its strokes' indices in `shading`; every stroke belongs to one band. Empty when the view was not shaded.",
      })
    ),
    broken: S.Array(Segment2).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description:
          "Visible edges of broken-line parts and of the surface only broken primitives cover, and visible pieces of broken overlay lines (unclaimed subject matter), drawn dashed; empty when nothing is broken.",
      })
    ),
    emphasis: S.Array(Segment2).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description:
          "Visible pieces of emphasis overlay lines, drawn heavier than the outlines; empty when the model has none.",
      })
    ),
  }).pipe(
    $I.annoteSchema("EdgeSet", {
      description:
        "Canonically ordered visible, hidden, shading, broken-line, and emphasis projected segments of one view, with the shading's coverage and bands.",
    })
  )
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
 * import { ShadingStyle } from "@beep/technical-drawing/Geometry.schemas"
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
 * import type { ShadingStyle } from "@beep/technical-drawing/Geometry.schemas"
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
 * import { HatchAxis } from "@beep/technical-drawing/Geometry.schemas"
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
 * import type { HatchAxis } from "@beep/technical-drawing/Geometry.schemas"
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
  S.isGreaterThanOrEqualTo(
    -1,
    $I.annote("ExposureThresholdMinCheck", {
      title: "Exposure Threshold Minimum",
      description: "Exposure is a cosine, so a threshold below -1 shades nothing differently.",
      message: "Expected a threshold of at least -1",
    })
  ),
  S.isLessThanOrEqualTo(
    1,
    $I.annote("ExposureThresholdMaxCheck", {
      title: "Exposure Threshold Maximum",
      description: "Exposure is a cosine, so a threshold above 1 shades every face.",
      message: "Expected a threshold of at most 1",
    })
  )
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
 * lines pass through the same hidden-line removal as the outlines. A graded
 * band whose edge has another drawn line within `ladderReach` beyond it,
 * running alongside the edge, starts behind a gutter. The defaults reproduce
 * the original hatch exactly.
 *
 * **Example** (A plan in millimetres)
 *
 * ```ts
 * import { ShadingPlan } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const plan = ShadingPlan.make({ minPitch: 0.6, maxPitch: 2.4 })
 * console.log(plan.litThreshold)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShadingPlan extends S.Opaque<ShadingPlan, { readonly brand: unique symbol }>()(
  S.Struct({
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
      S.isGreaterThanOrEqualTo(
        0,
        $I.annote("ShadingMinFaceSpanCheck", {
          title: "Shading Minimum Face Span",
          description: "A face narrower than this on the view plane is a sliver and gets no lines.",
          message: "Expected a non-negative minimum face span",
        })
      )
    ).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Projected width, in model units, below which a face is a sliver and gets no lines. Defaults to 0 (no slivers).",
      })
    ),
    minStroke: S.Finite.check(
      S.isGreaterThanOrEqualTo(
        0,
        $I.annote("ShadingMinStrokeCheck", {
          title: "Shading Minimum Stroke",
          description: "A shading stroke shorter than this on the view plane is not drawn.",
          message: "Expected a non-negative minimum stroke length",
        })
      )
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
    ladderReach: S.OptionFromOptionalKey(PositiveLength).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "How far beyond a graded band's edge, in model units, a drawn line running alongside that edge makes the band and the lines read as one ladder, so the band starts behind a gutter; none means five thirds of the minimum pitch. A sheet sets it from the validator's ladder reach, so a render passes its own check.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ShadingPlan", {
      description:
        "Pitch range, lit threshold, style, hatch axis, sliver width, minimum stroke, outline clearance, and ladder reach of straight-line shading, in model units.",
    })
  )
) {}

/**
 * Axis-aligned bounding box of a solid.
 *
 * **Example** (Make a bounding box)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing/Geometry.schemas"
 *
 * console.log(BoundingBox.make({ min: [0, 0, 0], max: [1, 2, 3] }).max)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoundingBox extends S.Opaque<BoundingBox, { readonly brand: unique symbol }>()(
  S.Struct({
    min: Vec3.annotateKey({ description: "Minimum corner." }),
    max: Vec3.annotateKey({ description: "Maximum corner." }),
  }).pipe(
    $I.annoteSchema("BoundingBox", {
      description: "Axis-aligned bounding box.",
    })
  )
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
 * import { BoundingBox, ModelSummary } from "@beep/technical-drawing/Geometry.schemas"
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
export class ModelSummary extends S.Opaque<ModelSummary, { readonly brand: unique symbol }>()(
  S.Struct({
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
  }).pipe(
    $I.annoteSchema("ModelSummary", {
      description: "Bounding box, volume, topology counts, and part-overlap count of a built model.",
    })
  )
) {}
