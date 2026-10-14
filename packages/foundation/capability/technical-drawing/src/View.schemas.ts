/**
 * View domain of a figure set: the eight standard views, their cameras, the
 * figures a set claims, and the typed omission claims it makes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { EmailString, Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import { BoundingBox, Camera, ModelSpec } from "./Geometry.schemas.ts";
import { SheetOptions } from "./Sheet.schemas.ts";
import type { Vec3 } from "./Geometry.schemas.ts";

const $I = $TechnicalDrawingId.create("View.schemas");

const ViewNameBase = LiteralKit([
  "top-perspective",
  "bottom-perspective",
  "top-plan",
  "bottom-plan",
  "front",
  "rear",
  "left",
  "right",
]);

/**
 * The eight standard design-figure views.
 *
 * **Details**
 *
 * The model's +Z is up, −Y faces the viewer in the front elevation, and +X is
 * the viewer's right. Perspectives look from the front-left, above or below.
 *
 * **Example** (Read the view names)
 *
 * ```ts
 * import { ViewName } from "@beep/technical-drawing"
 *
 * console.log(ViewName.literals.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ViewName = ViewNameBase.pipe(
  $I.annoteSchema("ViewName", {
    description: "One of the eight standard views: two perspectives, two plans, four elevations.",
  }),
  SchemaUtils.withLiteralKitStatics(ViewNameBase)
);

/**
 * Type for {@link ViewName}.
 *
 * **Example** (Annotate a view)
 *
 * ```ts
 * import type { ViewName } from "@beep/technical-drawing"
 *
 * const view: ViewName = "front"
 * console.log(view)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ViewName = typeof ViewName.Type;

const PERSPECTIVE_EYE: Vec3 = [-1, -1.2, 0.85];
const PERSPECTIVE_FOCUS_DIAGONALS = 2.5;
// Horizontal reach of the legacy perspective eye; a set azimuth swings it.
const PERSPECTIVE_REACH = Math.hypot(PERSPECTIVE_EYE[0], PERSPECTIVE_EYE[1]);
// Isometric elevation: the angle at which a cube's three axes foreshorten equally.
const ISOMETRIC_ELEVATION = Math.atan(1 / Math.SQRT2);
// Isometric azimuth: at 45° (mod 90°) the model's own X, Y and Z axes foreshorten equally.
const ISOMETRIC_AZIMUTH_DEG = 45;

const orthographic = (eye: Vec3, up: Vec3) => Camera.make({ eye, up });

const PictorialProjectionBase = LiteralKit(["perspective", "isometric"]);

/**
 * Projection of a pictorial (top or bottom perspective-slot) figure.
 *
 * **Details**
 *
 * `perspective` is the converging camera the sets were first drawn with.
 * `isometric` is a parallel projection at the isometric elevation
 * (atan(1/√2) ≈ 35.264°): tops and bottoms keep their size and vertical sides
 * stay vertical. Without a set azimuth it looks along the 45° bearing, where
 * the model's X, Y and Z axes foreshorten equally. Any other azimuth gives the
 * isometric view of the model turned by (azimuth − 45°) about +Z, so its own
 * X and Y edges foreshorten unequally. The view names `top-perspective` and
 * `bottom-perspective` stay figure-slot names either way.
 *
 * **Example** (Read the projections)
 *
 * ```ts
 * import { PictorialProjection } from "@beep/technical-drawing/View.schemas"
 *
 * console.log(PictorialProjection.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PictorialProjection = PictorialProjectionBase.pipe(
  $I.annoteSchema("PictorialProjection", {
    description:
      "`perspective` (converging) or `isometric` (parallel, at the isometric elevation) pictorial projection.",
  }),
  SchemaUtils.withLiteralKitStatics(PictorialProjectionBase)
);

/**
 * Type for {@link PictorialProjection}.
 *
 * **Example** (Annotate a projection)
 *
 * ```ts
 * import type { PictorialProjection } from "@beep/technical-drawing/View.schemas"
 *
 * const projection: PictorialProjection = "isometric"
 * console.log(projection)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PictorialProjection = typeof PictorialProjection.Type;

const ElevationViewBase = LiteralKit(ViewName.pick(["front", "rear", "left", "right"]).literals);

/**
 * The four elevation views, a subset of {@link ViewName}.
 *
 * **Example** (Read the elevations)
 *
 * ```ts
 * import { ElevationView } from "@beep/technical-drawing/View.schemas"
 *
 * console.log(ElevationView.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ElevationView = ElevationViewBase.pipe(
  $I.annoteSchema("ElevationView", {
    description: "One of the four elevations: front, rear, left, right.",
  }),
  SchemaUtils.withLiteralKitStatics(ElevationViewBase)
);

/**
 * Type for {@link ElevationView}.
 *
 * **Example** (Annotate an elevation)
 *
 * ```ts
 * import type { ElevationView } from "@beep/technical-drawing/View.schemas"
 *
 * const facing: ElevationView = "left"
 * console.log(facing)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ElevationView = typeof ElevationView.Type;

const elevationEye = (view: ElevationView): Vec3 =>
  ElevationView.$match(view, {
    front: () => [0, -1, 0] as const,
    rear: () => [0, 1, 0] as const,
    left: () => [-1, 0, 0] as const,
    right: () => [1, 0, 0] as const,
  });

// Negate without minting −0, so a default plan camera stays byte-equal to the
// one written before `planFacing` existed.
const negate = (v: Vec3): Vec3 => [v[0] === 0 ? 0 : -v[0], v[1] === 0 ? 0 : -v[1], v[2] === 0 ? 0 : -v[2]];

/**
 * Whether a view is a perspective.
 *
 * **Example** (Test a view)
 *
 * ```ts
 * import { isPerspectiveView } from "@beep/technical-drawing"
 *
 * console.log(isPerspectiveView("top-perspective"), isPerspectiveView("front"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const isPerspectiveView = S.is(ViewName.pick(["top-perspective", "bottom-perspective"]));

/**
 * Input of {@link cameraForView}: the view, the model's bounding box, and the
 * set-level camera choices.
 *
 * **Details**
 *
 * Every field but `view` and `box` has a default equal to the camera written
 * before the field existed, so `cameraForView({ view, box })` is unchanged.
 *
 * **Example** (Make an input)
 *
 * ```ts
 * import { BoundingBox, CameraForViewInput } from "@beep/technical-drawing"
 *
 * console.log(CameraForViewInput.make({ view: "front", box: BoundingBox.make({ min: [0, 0, 0], max: [1, 1, 1] }) }).view)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CameraForViewInput extends S.Class<CameraForViewInput>($I`CameraForViewInput`)(
  {
    view: ViewName.annotateKey({ description: "View to frame." }),
    box: BoundingBox.annotateKey({ description: "Bounding box of the model." }),
    projection: PictorialProjection.pipe(
      S.withConstructorDefault(Effect.succeed("perspective" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("perspective" as const)),
      S.annotateKey({ description: "Projection of a pictorial view; ignored by plans and elevations." })
    ),
    azimuthDeg: S.Option(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultTypeKey(Effect.succeedNone),
      S.annotateKey({
        description:
          "Pictorial azimuth in degrees from the front toward the left. None keeps the original perspective eye (about 39.8°), or 45° for an isometric pictorial.",
      })
    ),
    planFacing: ElevationView.pipe(
      S.withConstructorDefault(Effect.succeed("front" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("front" as const)),
      S.annotateKey({ description: "Elevation whose viewer stands at the page bottom of both plans." })
    ),
  },
  $I.annote("CameraForViewInput", {
    description: "View name, model bounding box, pictorial projection and azimuth, and plan facing.",
  })
) {}

const CameraForView = Fn({ input: CameraForViewInput, output: Camera }).pipe(
  $I.annoteSchema("CameraForView", {
    description: "Schema-backed camera for a standard view framed on a bounding box.",
  })
);

/**
 * Camera for a view, framed on a model's bounding box.
 *
 * **Details**
 *
 * Orthographic views ignore the box. Perspectives aim at the box centre with
 * a focus of 2.5 box diagonals, far enough to read as a drawing rather than a
 * photograph while still converging visibly. An isometric pictorial has no
 * focus: its eye is `[-sin(az)·cos(el), -cos(az)·cos(el), ±sin(el)]` with
 * `el = atan(1/√2)`, `az` 45° unless set, and up +Z. Both plans take their up vector from
 * `planFacing` (up = −eye of that elevation), so the bottom plan stays the
 * left–right mirror of the top plan.
 *
 * **Gotchas**
 *
 * The input is decoded, so it takes the encoded form: omitted defaulted keys
 * get their defaults.
 *
 * **Example** (Front and top-perspective cameras)
 *
 * ```ts
 * import { BoundingBox, cameraForView } from "@beep/technical-drawing"
 *
 * const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] })
 * console.log(cameraForView({ view: "front", box }).focus, cameraForView({ view: "top-perspective", box }).focus)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const cameraForView: (input: typeof CameraForViewInput.Encoded) => Camera = CameraForView.implementSync(
  (input) => {
    const planUp = negate(elevationEye(input.planFacing));
    return ViewName.$match(input.view, {
      "top-plan": () => orthographic([0, 0, 1], planUp),
      "bottom-plan": () => orthographic([0, 0, -1], planUp),
      front: () => orthographic(elevationEye("front"), [0, 0, 1]),
      rear: () => orthographic(elevationEye("rear"), [0, 0, 1]),
      left: () => orthographic(elevationEye("left"), [0, 0, 1]),
      right: () => orthographic(elevationEye("right"), [0, 0, 1]),
      "top-perspective": () => pictorial(input, 1),
      "bottom-perspective": () => pictorial(input, -1),
    });
  }
);

const pictorial = (input: CameraForViewInput, zSign: 1 | -1): Camera =>
  PictorialProjection.$match(input.projection, {
    perspective: () => perspective(input, zSign),
    isometric: () => {
      const az = (O.getOrElse(input.azimuthDeg, () => ISOMETRIC_AZIMUTH_DEG) * Math.PI) / 180;
      const reach = Math.cos(ISOMETRIC_ELEVATION);
      return orthographic(
        [-Math.sin(az) * reach, -Math.cos(az) * reach, Math.sin(ISOMETRIC_ELEVATION) * zSign],
        [0, 0, 1]
      );
    },
  });

const perspective = ({ box, azimuthDeg }: CameraForViewInput, zSign: 1 | -1): Camera => {
  const target: Vec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const diagonal = Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
  // Without a set azimuth the legacy eye is used verbatim, so default goldens stay byte-equal.
  const [ex, ey] = O.match(azimuthDeg, {
    onNone: () => [PERSPECTIVE_EYE[0], PERSPECTIVE_EYE[1]] as const,
    onSome: (deg) =>
      [
        -Math.sin((deg * Math.PI) / 180) * PERSPECTIVE_REACH,
        -Math.cos((deg * Math.PI) / 180) * PERSPECTIVE_REACH,
      ] as const,
  });
  return Camera.make({
    eye: [ex, ey, PERSPECTIVE_EYE[2] * zSign],
    up: [0, 0, 1],
    target,
    focus: O.some(Math.max(diagonal * PERSPECTIVE_FOCUS_DIAGONALS, 1)),
  });
};

/**
 * One claimed figure: a view and the sentence that describes it.
 *
 * **Example** (The front elevation)
 *
 * ```ts
 * import { FigureSpec } from "@beep/technical-drawing"
 *
 * const fig = FigureSpec.make({ view: "front", description: "is a front elevation view thereof" })
 * console.log(fig.view)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FigureSpec extends S.Class<FigureSpec>($I`FigureSpec`)(
  {
    view: ViewName.annotateKey({ description: "View shown by this figure." }),
    description: S.Trimmed.check(
      S.isMinLength(1, {
        identifier: $I`FigureDescriptionCheck`,
        title: "Figure Description",
        description: "Every figure carries its own description sentence (the 1:1 FIG ↔ description rule).",
        message: "Expected a non-empty figure description",
      })
    ).annotateKey({ description: "Description sentence for the figure, without the leading `FIG. n`." }),
    projection: PictorialProjection.pipe(
      S.withConstructorDefault(Effect.succeed("perspective" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("perspective" as const)),
      S.annotateKey({
        description:
          "Projection of a pictorial (`top-perspective` / `bottom-perspective`) figure. Defaults to `perspective`; plans and elevations accept only the default.",
      })
    ),
  },
  $I.annote("FigureSpec", {
    description: "A claimed figure: its view, description sentence, and pictorial projection.",
  })
) {}

const OmissionRelationBase = LiteralKit(["identical", "mirror"]);

/**
 * How an omitted view relates to a shown one.
 *
 * **Example** (Read the relations)
 *
 * ```ts
 * import { OmissionRelation } from "@beep/technical-drawing"
 *
 * console.log(OmissionRelation.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OmissionRelation = OmissionRelationBase.pipe(
  $I.annoteSchema("OmissionRelation", {
    description: "`identical` (same projection) or `mirror` (left–right mirror image) of the shown view.",
  }),
  SchemaUtils.withLiteralKitStatics(OmissionRelationBase)
);

/**
 * Type for {@link OmissionRelation}.
 *
 * **Example** (Annotate a relation)
 *
 * ```ts
 * import type { OmissionRelation } from "@beep/technical-drawing"
 *
 * const relation: OmissionRelation = "mirror"
 * console.log(relation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OmissionRelation = typeof OmissionRelation.Type;

/**
 * A typed omission claim: an unshown view declared identical to, or a mirror
 * image of, a shown view. The renderer proves it by projecting both.
 *
 * **Example** (Rear identical to front)
 *
 * ```ts
 * import { OmissionClaim } from "@beep/technical-drawing"
 *
 * console.log(OmissionClaim.make({ omitted: "rear", shown: "front", relation: "identical" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OmissionClaim extends S.Class<OmissionClaim>($I`OmissionClaim`)(
  {
    omitted: ViewName.annotateKey({ description: "View left out of the set." }),
    shown: ViewName.annotateKey({ description: "View in the set it is derived from." }),
    relation: OmissionRelation.annotateKey({ description: "How the omitted view relates to the shown one." }),
  },
  $I.annote("OmissionClaim", {
    description: "An omitted view claimed identical to, or the mirror of, a shown view.",
  })
) {}

// Only the two pictorial slots have a projection choice.
const projectionsFitViews = (figures: ReadonlyArray<FigureSpec>): boolean =>
  A.every(figures, (f) => f.projection === "perspective" || isPerspectiveView(f.view));

const viewsAreUnique = (figures: ReadonlyArray<FigureSpec>): boolean =>
  pipe(
    figures,
    A.map((f) => f.view),
    A.dedupe,
    A.length
  ) === A.length(figures);

/**
 * A figure set: the model, the figures claimed from it (in FIG. order), and
 * any omission claims.
 *
 * **Example** (A one-figure set)
 *
 * ```ts
 * import { Box, FigureSetSpec, FigureSpec, ModelSpec, Part } from "@beep/technical-drawing"
 *
 * const spec = FigureSetSpec.make({
 *   title: "Synthetic bracket",
 *   model: ModelSpec.make({ parts: [Part.make({ name: "body", add: [Box.make({ min: [0, 0, 0], max: [40, 30, 20] })] })] }),
 *   figures: [FigureSpec.make({ view: "front", description: "is a front elevation view thereof" })]
 * })
 * console.log(spec.figures.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FigureSetSpec extends S.Class<FigureSetSpec>($I`FigureSetSpec`)(
  {
    title: S.NonEmptyString.annotateKey({ description: "Article title, used in file names and the manifest." }),
    model: ModelSpec.annotateKey({ description: "Parametric model every figure is projected from." }),
    figures: S.Array(FigureSpec)
      .check(
        S.isMinLength(1, {
          identifier: $I`FigureSetFiguresCheck`,
          title: "Figure Set Figures",
          description: "A figure set claims at least one figure.",
          message: "Expected at least one figure",
        }),
        S.makeFilter(viewsAreUnique, {
          identifier: $I`FigureSetUniqueViewsCheck`,
          title: "Figure Set Unique Views",
          description: "No view appears twice in a figure set.",
          message: "Expected every figure to show a different view",
        }),
        S.makeFilter(projectionsFitViews, {
          identifier: $I`FigureSetProjectionsCheck`,
          title: "Figure Set Projections",
          description: "Only the pictorial views take a projection other than the default.",
          message: "Expected `projection: isometric` only on top-perspective or bottom-perspective figures",
        })
      )
      .annotateKey({ description: "Figures in FIG. 1..n order." }),
    omissions: S.Array(OmissionClaim).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({ description: "Views left out with a typed, render-proven reason." })
    ),
    approver: S.OptionFromOptionalKey(EmailString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Email address of the attorney who must approve the sheet set. A set rendered without one cannot be signed.",
      })
    ),
    pictorialAzimuthDeg: S.OptionFromOptionalKey(
      S.Finite.check(
        S.isGreaterThanOrEqualTo(-180, {
          identifier: $I`PictorialAzimuthMinCheck`,
          title: "Pictorial Azimuth Minimum",
          description: "An azimuth is an angle in degrees within one turn.",
          message: "Expected a pictorial azimuth of at least -180 degrees",
        }),
        S.isLessThanOrEqualTo(180, {
          identifier: $I`PictorialAzimuthMaxCheck`,
          title: "Pictorial Azimuth Maximum",
          description: "An azimuth is an angle in degrees within one turn.",
          message: "Expected a pictorial azimuth of at most 180 degrees",
        })
      )
    ).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Azimuth of both pictorial figures in degrees, from the front (−Y) toward the left (−X). Absent, a perspective keeps the original eye (about 39.8°) and an isometric looks along 45°; another azimuth turns the isometric frame by (azimuth − 45°) about +Z.",
      })
    ),
    planFacing: ElevationView.pipe(
      S.withConstructorDefault(Effect.succeed("front" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("front" as const)),
      S.annotateKey({
        description:
          "Elevation whose viewer stands at the page bottom of both plans (plan up = −eye of that elevation). Defaults to `front`.",
      })
    ),
    sheet: S.OptionFromOptionalKey(SheetOptions).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Sheet options carried by the spec, so they hash with it. When present they win wholesale over the options of the render request.",
      })
    ),
  },
  $I.annote("FigureSetSpec", {
    description:
      "Model, claimed figures in order, omission claims, recorded approver, pictorial azimuth, plan facing, and sheet options of one figure set.",
  })
) {}
