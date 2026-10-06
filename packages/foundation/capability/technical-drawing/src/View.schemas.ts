/**
 * View domain of a figure set: the eight standard views, their cameras, the
 * figures a set claims, and the typed omission claims it makes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as S from "effect/Schema";
import { BoundingBox, Camera, ModelSpec } from "./Geometry.schemas.ts";
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

const orthographic = (eye: Vec3, up: Vec3) => Camera.make({ eye, up });

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
 * Input of {@link cameraForView}: the view and the model's bounding box.
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
  },
  $I.annote("CameraForViewInput", {
    description: "View name and model bounding box.",
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
 * photograph while still converging visibly.
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
export const cameraForView: (input: CameraForViewInput) => Camera = CameraForView.implementSync(({ view, box }) =>
  ViewName.$match(view, {
    "top-plan": () => orthographic([0, 0, 1], [0, 1, 0]),
    "bottom-plan": () => orthographic([0, 0, -1], [0, 1, 0]),
    front: () => orthographic([0, -1, 0], [0, 0, 1]),
    rear: () => orthographic([0, 1, 0], [0, 0, 1]),
    left: () => orthographic([-1, 0, 0], [0, 0, 1]),
    right: () => orthographic([1, 0, 0], [0, 0, 1]),
    "top-perspective": () => perspective(box, 1),
    "bottom-perspective": () => perspective(box, -1),
  })
);

const perspective = (box: BoundingBox, zSign: 1 | -1): Camera => {
  const target: Vec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const diagonal = Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
  return Camera.make({
    eye: [PERSPECTIVE_EYE[0], PERSPECTIVE_EYE[1], PERSPECTIVE_EYE[2] * zSign],
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
  },
  $I.annote("FigureSpec", {
    description: "A claimed figure: its view and description sentence.",
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
        })
      )
      .annotateKey({ description: "Figures in FIG. 1..n order." }),
    omissions: S.Array(OmissionClaim).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({ description: "Views left out with a typed, render-proven reason." })
    ),
  },
  $I.annote("FigureSetSpec", {
    description: "Model, claimed figures in order, and omission claims of one figure set.",
  })
) {}
