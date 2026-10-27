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
import { BoundingBox, Camera, HiddenLinePassAbout, ModelSpec } from "./Geometry.schemas.ts";
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
 * import { ViewName } from "@beep/technical-drawing/View.schemas"
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
 * import type { ViewName } from "@beep/technical-drawing/View.schemas"
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

const radians = (deg: number): number => (deg * Math.PI) / 180;

// Default field of a two-point pictorial when the set gives none: low enough that a box of ordinary proportions,
// walls included, stays near the 60° cone of vision.
const TWO_POINT_ELEVATION_DEG = 20;
// Half the 60° cone of vision. A two-point field above it puts the near top corner outside the cone, and the walls
// below that corner further out still; moving the eye back does not bring them in.
const TWO_POINT_MAX_ELEVATION_DEG = 30;

const PictorialElevationDeg = S.Finite.check(
  S.isGreaterThan(
    0,
    $I.annote("PictorialElevationMinCheck", {
      title: "Pictorial Elevation Minimum",
      description: "A pictorial looks at the top (or bottom) from above (or below) it, never level with it.",
      message: "Expected a pictorial elevation above 0 degrees",
    })
  ),
  S.isLessThan(
    90,
    $I.annote("PictorialElevationMaxCheck", {
      title: "Pictorial Elevation Maximum",
      description: "A pictorial at 90 degrees would be a plan view.",
      message: "Expected a pictorial elevation below 90 degrees",
    })
  )
).pipe(
  $I.annoteSchema("PictorialElevationDeg", {
    description:
      "Pictorial sight angle in degrees above the top (below the bottom), strictly between level (0) and plan (90); a two-point pictorial takes at most 30.",
  })
);

const PictorialFocusDiagonals = S.Finite.check(
  S.isGreaterThanOrEqualTo(
    1,
    $I.annote("PictorialFocusDiagonalsCheck", {
      title: "Pictorial Focus Diagonals",
      description:
        "A converging pictorial's eye stands at least one box diagonal from the box centre, clear of the model.",
      message: "Expected a pictorial focus of at least 1 box diagonal",
    })
  )
).pipe(
  $I.annoteSchema("PictorialFocusDiagonals", {
    description: "Eye distance of a converging pictorial in box diagonals, at least 1.",
  })
);

const PictorialProjectionBase = LiteralKit(["perspective", "isometric", "two-point"]);

/**
 * Projection of a pictorial (top or bottom perspective-slot) figure.
 *
 * **Details**
 *
 * `perspective` is the converging camera the sets were first drawn with: it
 * looks down (or up) at the box centre, so vertical edges converge as well.
 * `isometric` is a parallel projection at the isometric elevation
 * (atan(1/√2) ≈ 35.264°) unless the set gives another: tops and bottoms keep
 * their size and vertical sides stay vertical. Without a set azimuth it looks
 * along the 45° bearing, where the model's X, Y and Z axes foreshorten
 * equally. Any other azimuth gives the isometric view of the model turned by
 * (azimuth − 45°) about +Z, so its own X and Y edges foreshorten unequally.
 * `two-point` is a perspective with a level line of sight: the eye stands
 * above the top (below the bottom for the bottom figure) and looks
 * horizontally along the azimuth, so every vertical edge stays vertical and
 * parallel on the sheet while level edges run to two vanishing points on the
 * horizon. Its field defaults to 20° and may not exceed 30°, half the 60°
 * cone of vision. The view names `top-perspective` and `bottom-perspective`
 * stay figure-slot names whatever the projection.
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
      "`perspective` (converging, looking down or up), `isometric` (parallel, at the isometric or a set elevation) or `two-point` (converging, level line of sight, verticals kept vertical) pictorial projection.",
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

const ElevationViewBase = ViewName.pick(["front", "rear", "left", "right"]);

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
  ElevationView.match(view, {
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
 * import { isPerspectiveView } from "@beep/technical-drawing/View.schemas"
 *
 * console.log(isPerspectiveView("top-perspective"), isPerspectiveView("front"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const isPerspectiveView = S.is(ViewName.pick(["top-perspective", "bottom-perspective"]));

// A two-point pictorial's set field is at most half the 60° cone of vision; other views and projections take any.
const twoPointFieldInCone = (input: {
  readonly view: ViewName;
  readonly projection: PictorialProjection;
  readonly elevationDeg: O.Option<number>;
}): boolean =>
  !(
    input.projection === PictorialProjection.Enum["two-point"] &&
    isPerspectiveView(input.view) &&
    O.exists(input.elevationDeg, (deg) => deg > TWO_POINT_MAX_ELEVATION_DEG)
  );

/**
 * Input of {@link cameraForView}: the view, the model's bounding box, and the
 * set-level camera choices.
 *
 * **Details**
 *
 * Every field but `view` and `box` has a default equal to the camera written
 * before the field existed, so `cameraForView({ view, box })` is unchanged.
 * A two-point pictorial with an `elevationDeg` above 30 is refused.
 *
 * **Example** (Make an input)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing/Geometry.schemas"
 * import { CameraForViewInput } from "@beep/technical-drawing/View.schemas"
 *
 * console.log(CameraForViewInput.make({ view: "front", box: BoundingBox.make({ min: [0, 0, 0], max: [1, 1, 1] }) }).view)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CameraForViewInput extends S.Opaque<CameraForViewInput, { readonly brand: unique symbol }>()(
  S.Struct({
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
          "Pictorial azimuth in degrees from the front toward the left. None keeps the original perspective eye (about 39.8°), or 45° for an isometric or two-point pictorial.",
      })
    ),
    elevationDeg: S.Option(PictorialElevationDeg).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultTypeKey(Effect.succeedNone),
      S.annotateKey({
        description:
          "Pictorial sight angle in degrees. An isometric looks down (up) at the model at it, within (0, 90); none keeps the isometric elevation, about 35.264°. A two-point eye sees the near top (bottom) corner of the bounding box at it, not any face of the article, within (0, 30]; none keeps 20°. A perspective ignores it.",
      })
    ),
    focusDiagonals: S.Option(PictorialFocusDiagonals).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultTypeKey(Effect.succeedNone),
      S.annotateKey({
        description:
          "Eye distance of a converging (perspective or two-point) pictorial in box diagonals, at least 1. None keeps 2.5. An isometric ignores it.",
      })
    ),
    planFacing: ElevationView.pipe(
      S.withConstructorDefault(Effect.succeed("front" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("front" as const)),
      S.annotateKey({ description: "Elevation whose viewer stands at the page bottom of both plans." })
    ),
  })
    .check(
      S.makeFilter(
        twoPointFieldInCone,
        $I.annote("CameraForViewInputTwoPointElevationCheck", {
          title: "Two-Point Elevation",
          description: "A two-point pictorial's field stays within half the 60° cone of vision.",
          message: "Expected a two-point pictorial elevation of at most 30 degrees",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CameraForViewInput", {
        description:
          "View name, model bounding box, pictorial projection, azimuth, elevation and focus, and plan facing.",
      })
    )
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
 * a focus of 2.5 box diagonals (or the set `focusDiagonals`), far enough to
 * read as a drawing rather than a photograph while still converging visibly.
 * An isometric pictorial has no focus: its eye is
 * `[-sin(az)·cos(el), -cos(az)·cos(el), ±sin(el)]` with `el = atan(1/√2)`
 * unless set, `az` 45° unless set, and up +Z. A two-point pictorial looks
 * along the level direction `eye = [-sin(az), -cos(az), 0]` (`az` 45° unless
 * set) with up +Z and the same focus `f` as a perspective. Its target is the
 * box centre's x and y at the eye height `h = top + (f − r)·tan(el)` (bottom
 * view: `bottom − (f − r)·tan(el)`), with `el` 20° unless set (at most 30°),
 * where `r` is how far the box reaches from its centre toward the eye along
 * the sight line. The projector stands the eye `f` from the target along
 * `eye`, so `f − r` is the eye's depth to the bounding box's near top
 * (bottom) corner, which it sees exactly `el` below (above) the horizon.
 * That corner need not be a point of the article: a part standing above the
 * top face puts that face's own near corner steeper than `el`, and a
 * rounded or chamfered plan puts its nearest top point deeper, so shallower.
 * An isometric applies `el` to every point, so an isometric and a two-point
 * at one elevation are not like for like. Its `sight`, the direction
 * face-facing decisions read, runs from the box centre to that eye, and its
 * hidden-line pass runs about its target. Both plans take their up vector
 * from `planFacing` (up = −eye of that elevation), so the bottom plan stays
 * the left–right mirror of the top plan.
 *
 * **Gotchas**
 *
 * The input is decoded, so it takes the encoded form: omitted defaulted keys
 * get their defaults.
 *
 * **Example** (Front, top-perspective and two-point cameras)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing/Geometry.schemas"
 * import { cameraForView } from "@beep/technical-drawing/View.schemas"
 * import * as O from "effect/Option"
 *
 * const box = BoundingBox.make({ min: [0, 0, 0], max: [40, 30, 20] })
 * console.log(cameraForView({ view: "front", box }).focus, cameraForView({ view: "top-perspective", box }).focus)
 * const level = cameraForView({ view: "top-perspective", box, projection: "two-point", elevationDeg: O.some(20) })
 * console.log(level.eye[2], level.target[2] > 20)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const cameraForView: (input: typeof CameraForViewInput.Encoded) => Camera = CameraForView.implementSync(
  (input) => {
    const planUp = negate(elevationEye(input.planFacing));
    return ViewName.match(input.view, {
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
  PictorialProjection.match(input.projection, {
    perspective: () => perspective(input, zSign),
    isometric: () => {
      const az = radians(O.getOrElse(input.azimuthDeg, () => ISOMETRIC_AZIMUTH_DEG));
      const el = pictorialElevation(input);
      const reach = Math.cos(el);
      return orthographic([-Math.sin(az) * reach, -Math.cos(az) * reach, Math.sin(el) * zSign], [0, 0, 1]);
    },
    "two-point": () => twoPoint(input, zSign),
  });

// Without a set elevation, the isometric one.
const pictorialElevation = ({ elevationDeg }: CameraForViewInput): number =>
  O.match(elevationDeg, { onNone: () => ISOMETRIC_ELEVATION, onSome: radians });

// Without a set elevation, the two-point default field.
const twoPointElevation = ({ elevationDeg }: CameraForViewInput): number =>
  radians(O.getOrElse(elevationDeg, () => TWO_POINT_ELEVATION_DEG));

const boxCentre = ({ min, max }: CameraForViewInput["box"]): Vec3 => [
  (min[0] + max[0]) / 2,
  (min[1] + max[1]) / 2,
  (min[2] + max[2]) / 2,
];

// Eye distance of a converging pictorial; 2.5 diagonals unless set.
const pictorialFocus = ({ box, focusDiagonals }: CameraForViewInput): number =>
  Math.max(
    Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) *
      O.getOrElse(focusDiagonals, () => PERSPECTIVE_FOCUS_DIAGONALS),
    1
  );

const perspective = (input: CameraForViewInput, zSign: 1 | -1): Camera => {
  // Without a set azimuth the legacy eye is used verbatim, so default goldens stay byte-equal.
  const [ex, ey] = O.match(input.azimuthDeg, {
    onNone: () => [PERSPECTIVE_EYE[0], PERSPECTIVE_EYE[1]] as const,
    onSome: (deg) =>
      [-Math.sin(radians(deg)) * PERSPECTIVE_REACH, -Math.cos(radians(deg)) * PERSPECTIVE_REACH] as const,
  });
  return Camera.make({
    eye: [ex, ey, PERSPECTIVE_EYE[2] * zSign],
    up: [0, 0, 1],
    target: boxCentre(input.box),
    focus: O.some(pictorialFocus(input)),
  });
};

// A level line of sight keeps every vertical edge vertical on the sheet. The projector stands the eye `focus` from
// the target along `eye`, so with the target over the box centre the eye's depth to the bounding box's near top
// (bottom) corner is `focus − reach`; lifting the target (and the eye with it) by that depth times tan(el) above the
// top (below the bottom) sees that corner at `el` from the horizon, and every farther point of the box's top lower.
const twoPoint = (input: CameraForViewInput, zSign: 1 | -1): Camera => {
  const { box } = input;
  const az = radians(O.getOrElse(input.azimuthDeg, () => ISOMETRIC_AZIMUTH_DEG));
  const eye: Vec3 = [-Math.sin(az), -Math.cos(az), 0];
  const focus = pictorialFocus(input);
  const reach = (Math.abs(eye[0]) * (box.max[0] - box.min[0]) + Math.abs(eye[1]) * (box.max[1] - box.min[1])) / 2;
  const rise = (focus - reach) * Math.tan(twoPointElevation(input));
  const centre = boxCentre(box);
  const height = zSign === 1 ? box.max[2] + rise : box.min[2] - rise;
  return Camera.make({
    eye,
    up: [0, 0, 1],
    target: [centre[0], centre[1], height],
    focus: O.some(focus),
    // the eye point seen from the box centre: the direction a camera aimed at the box centre would carry as `eye`
    sight: O.some([eye[0] * focus, eye[1] * focus, height - centre[2]]),
    // the target stands well clear of the model, so the pass runs about it to see the model from this eye
    hiddenLinePassAbout: HiddenLinePassAbout.Enum.target,
  });
};

/**
 * One claimed figure: a view and the sentence that describes it.
 *
 * **Example** (The front elevation)
 *
 * ```ts
 * import { FigureSpec } from "@beep/technical-drawing/View.schemas"
 *
 * const fig = FigureSpec.make({ view: "front", description: "is a front elevation view thereof" })
 * console.log(fig.view)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FigureSpec extends S.Opaque<FigureSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    view: ViewName.annotateKey({ description: "View shown by this figure." }),
    description: S.Trimmed.check(
      S.isMinLength(
        1,
        $I.annote("FigureDescriptionCheck", {
          title: "Figure Description",
          description: "Every figure carries its own description sentence (the 1:1 FIG ↔ description rule).",
          message: "Expected a non-empty figure description",
        })
      )
    ).annotateKey({ description: "Description sentence for the figure, without the leading `FIG. n`." }),
    projection: PictorialProjection.pipe(
      S.withConstructorDefault(Effect.succeed("perspective" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("perspective" as const)),
      S.annotateKey({
        description:
          "Projection of a pictorial (`top-perspective` / `bottom-perspective`) figure. Defaults to `perspective`; plans and elevations accept only the default.",
      })
    ),
  }).pipe(
    $I.annoteSchema("FigureSpec", {
      description: "A claimed figure: its view, description sentence, and pictorial projection.",
    })
  )
) {}

const OmissionRelationBase = LiteralKit(["identical", "mirror"]);

/**
 * How an omitted view relates to a shown one.
 *
 * **Example** (Read the relations)
 *
 * ```ts
 * import { OmissionRelation } from "@beep/technical-drawing/View.schemas"
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
 * import type { OmissionRelation } from "@beep/technical-drawing/View.schemas"
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
 * import { OmissionClaim } from "@beep/technical-drawing/View.schemas"
 *
 * console.log(OmissionClaim.make({ omitted: "rear", shown: "front", relation: "identical" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OmissionClaim extends S.Opaque<OmissionClaim, { readonly brand: unique symbol }>()(
  S.Struct({
    omitted: ViewName.annotateKey({ description: "View left out of the set." }),
    shown: ViewName.annotateKey({ description: "View in the set it is derived from." }),
    relation: OmissionRelation.annotateKey({ description: "How the omitted view relates to the shown one." }),
  }).pipe(
    $I.annoteSchema("OmissionClaim", {
      description: "An omitted view claimed identical to, or the mirror of, a shown view.",
    })
  )
) {}

// Only the two pictorial slots have a projection choice.
const projectionsFitViews = (figures: ReadonlyArray<FigureSpec>): boolean =>
  A.every(figures, (f) => f.projection === "perspective" || isPerspectiveView(f.view));

// The projection each pictorial of a set is drawn in: a shown pictorial's own, an omitted one's from the figure it is
// claimed from (as the renderer projects it).
const pictorialProjectionsOf = (set: {
  readonly figures: ReadonlyArray<FigureSpec>;
  readonly omissions: ReadonlyArray<OmissionClaim>;
}): ReadonlyArray<PictorialProjection> => [
  ...pipe(
    set.figures,
    A.filter((f) => isPerspectiveView(f.view)),
    A.map((f) => f.projection)
  ),
  ...pipe(
    set.omissions,
    A.filter((o) => isPerspectiveView(o.omitted)),
    A.map((o) =>
      pipe(
        A.findFirst(set.figures, (f) => f.view === o.shown),
        O.map((f) => f.projection),
        O.getOrElse(() => PictorialProjection.Enum.perspective)
      )
    )
  ),
];

const readsElevation = S.is(PictorialProjection.pick(["isometric", "two-point"]));
const readsFocus = S.is(PictorialProjection.pick(["perspective", "two-point"]));

type PictorialChoices = {
  readonly figures: ReadonlyArray<FigureSpec>;
  readonly omissions: ReadonlyArray<OmissionClaim>;
  readonly pictorialElevationDeg: O.Option<number>;
  readonly pictorialFocusDiagonals: O.Option<number>;
};

// A set elevation is read by an isometric or two-point pictorial; a perspective alone would drop it unseen.
const elevationIsRead = (set: PictorialChoices): boolean =>
  O.isNone(set.pictorialElevationDeg) || A.some(pictorialProjectionsOf(set), readsElevation);

// A set focus is read by a perspective or two-point pictorial; an isometric alone would drop it unseen.
const focusIsRead = (set: PictorialChoices): boolean =>
  O.isNone(set.pictorialFocusDiagonals) || A.some(pictorialProjectionsOf(set), readsFocus);

// A set with a two-point pictorial keeps its elevation within half the 60° cone of vision.
const twoPointElevationInCone = (set: PictorialChoices): boolean =>
  !A.contains(pictorialProjectionsOf(set), PictorialProjection.Enum["two-point"]) ||
  !O.exists(set.pictorialElevationDeg, (deg) => deg > TWO_POINT_MAX_ELEVATION_DEG);

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
 * import { Box, ModelSpec, Part } from "@beep/technical-drawing/Geometry.schemas"
 * import { FigureSetSpec, FigureSpec } from "@beep/technical-drawing/View.schemas"
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
export class FigureSetSpec extends S.Opaque<FigureSetSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    title: S.NonEmptyString.annotateKey({ description: "Article title, used in file names and the manifest." }),
    model: ModelSpec.annotateKey({ description: "Parametric model every figure is projected from." }),
    figures: S.Array(FigureSpec)
      .check(
        S.isMinLength(
          1,
          $I.annote("FigureSetFiguresCheck", {
            title: "Figure Set Figures",
            description: "A figure set claims at least one figure.",
            message: "Expected at least one figure",
          })
        ),
        S.makeFilter(
          viewsAreUnique,
          $I.annote("FigureSetUniqueViewsCheck", {
            title: "Figure Set Unique Views",
            description: "No view appears twice in a figure set.",
            message: "Expected every figure to show a different view",
          })
        ),
        S.makeFilter(
          projectionsFitViews,
          $I.annote("FigureSetProjectionsCheck", {
            title: "Figure Set Projections",
            description: "Only the pictorial views take a projection other than the default.",
            message:
              "Expected `projection: isometric` or `projection: two-point` only on top-perspective or bottom-perspective figures",
          })
        )
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
        S.isGreaterThanOrEqualTo(
          -180,
          $I.annote("PictorialAzimuthMinCheck", {
            title: "Pictorial Azimuth Minimum",
            description: "An azimuth is an angle in degrees within one turn.",
            message: "Expected a pictorial azimuth of at least -180 degrees",
          })
        ),
        S.isLessThanOrEqualTo(
          180,
          $I.annote("PictorialAzimuthMaxCheck", {
            title: "Pictorial Azimuth Maximum",
            description: "An azimuth is an angle in degrees within one turn.",
            message: "Expected a pictorial azimuth of at most 180 degrees",
          })
        )
      )
    ).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Azimuth of both pictorial figures in degrees, from the front (−Y) toward the left (−X). Absent, a perspective keeps the original eye (about 39.8°) and an isometric or two-point looks along 45°; another azimuth turns the isometric frame by (azimuth − 45°) about +Z.",
      })
    ),
    pictorialElevationDeg: S.OptionFromOptionalKey(PictorialElevationDeg).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Sight angle of the pictorial figures in degrees above the top (below the bottom). An isometric looks down (up) at this elevation instead of the isometric 35.264°, within (0, 90). A two-point eye sees the bounding box's near top (bottom) corner at it, not any face of the article, and the rest of the box lower; with a two-point pictorial it is at most 30 (half the 60° cone of vision), and absent the two-point takes 20°. Only a set with an isometric or two-point pictorial (shown, or omitted and claimed from one) may set it.",
      })
    ),
    pictorialFocusDiagonals: S.OptionFromOptionalKey(PictorialFocusDiagonals).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Eye distance of the converging (perspective or two-point) pictorial figures in box diagonals, at least 1: nearer converges more strongly. Absent keeps 2.5. Only a set with a perspective or two-point pictorial (shown, or omitted and claimed from one) may set it.",
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
  })
    .check(
      S.makeFilter(
        elevationIsRead,
        $I.annote("FigureSetElevationReadCheck", {
          title: "Figure Set Pictorial Elevation",
          description:
            "A set elevation needs an isometric or two-point pictorial to read it; a perspective ignores it, so the set would render unchanged.",
          message: "Expected `pictorialElevationDeg` only with an isometric or two-point pictorial",
        })
      ),
      S.makeFilter(
        focusIsRead,
        $I.annote("FigureSetFocusReadCheck", {
          title: "Figure Set Pictorial Focus",
          description:
            "A set focus needs a perspective or two-point pictorial to read it; an isometric has no focus, so the set would render unchanged.",
          message: "Expected `pictorialFocusDiagonals` only with a perspective or two-point pictorial",
        })
      ),
      S.makeFilter(
        twoPointElevationInCone,
        $I.annote("FigureSetTwoPointElevationCheck", {
          title: "Figure Set Two-Point Elevation",
          description:
            "A two-point pictorial's field stays within half the 60° cone of vision; above it the article falls outside the cone whatever the focus.",
          message: "Expected `pictorialElevationDeg` of at most 30 degrees with a two-point pictorial",
        })
      )
    )
    .pipe(
      $I.annoteSchema("FigureSetSpec", {
        description:
          "Model, claimed figures in order, omission claims, recorded approver, pictorial azimuth, elevation and focus, plan facing, and sheet options of one figure set.",
      })
    )
) {}
