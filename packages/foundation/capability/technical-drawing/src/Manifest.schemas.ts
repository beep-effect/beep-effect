/**
 * Render manifest: everything needed to reproduce and audit a sheet set.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { EmailString } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Camera, ModelSummary, ShadingCoverage } from "./Geometry.schemas.ts";
import { SheetOptions } from "./Sheet.schemas.ts";
import { ValidationReport } from "./Validation.schemas.ts";
import { ViewName } from "./View.schemas.ts";

const $I = $TechnicalDrawingId.create("Manifest.schemas");

/**
 * Lowercase hex SHA-256 digest.
 *
 * **Example** (The empty-string digest)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/technical-drawing/Manifest.schemas"
 *
 * console.log(Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Sha256Hex = S.String.check(
  S.isPattern(
    /^[0-9a-f]{64}$/,
    $I.annote("Sha256HexCheck", {
      title: "SHA-256 Hex",
      description: "64 lowercase hex characters.",
      message: "Expected a lowercase hex SHA-256 digest",
    })
  )
).pipe(
  $I.annoteSchema("Sha256Hex", {
    description: "Lowercase hex SHA-256 digest.",
  })
);

/**
 * Type for {@link Sha256Hex}.
 *
 * **Example** (Annotate a digest)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/technical-drawing/Manifest.schemas"
 *
 * const digest: Sha256Hex = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(digest)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sha256Hex = typeof Sha256Hex.Type;

/**
 * Provenance of the geometry engine that produced the projections.
 *
 * **Example** (Make engine info)
 *
 * ```ts
 * import { EngineInfo } from "@beep/technical-drawing/Manifest.schemas"
 *
 * console.log(EngineInfo.make({ name: "replicad", version: "1.1.0", binarySha256: "00" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EngineInfo extends S.Opaque<EngineInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "Engine name." }),
    version: S.NonEmptyString.annotateKey({ description: "Engine version." }),
    binarySha256: S.String.annotateKey({ description: "Hash of the kernel binary, when the engine has one." }),
  }).pipe(
    $I.annoteSchema("EngineInfo", {
      description: "Name, version, and binary hash of the geometry engine.",
    })
  )
) {}

/**
 * How far the outline-spacing rule opened a figure's close outlines: how
 * many lines moved and the largest move, in mm on the sheet, and how many
 * graded shading strokes were cut back or dropped to keep their clearance
 * from the moved lines.
 *
 * **Example** (Two lines moved)
 *
 * ```ts
 * import { OutlineSeparation } from "@beep/technical-drawing/Manifest.schemas"
 *
 * console.log(OutlineSeparation.make({ lines: 2, largestMoveMm: 0.36 }).largestMoveMm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutlineSeparation extends S.Opaque<OutlineSeparation, { readonly brand: unique symbol }>()(
  S.Struct({
    lines: S.Int.check(S.isGreaterThan(0)).annotateKey({
      description: "Outlines moved to hold the least centre spacing from a line beside them.",
    }),
    largestMoveMm: S.Finite.check(S.isGreaterThan(0)).annotateKey({
      description: "Largest move of one outline, in mm on the sheet.",
    }),
    trimmedStrokes: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Graded shading strokes cut back to keep their clearance from a moved outline. Defaults to 0, and on manifests rendered before strokes were clipped again.",
      })
    ),
    droppedStrokes: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description:
          "Graded shading strokes the re-clip removed: strokes shorter than the minimum stroke once cut back from a moved outline, and every stroke of a band the re-clip left with fewer than two strokes. Defaults to 0, and on manifests rendered before strokes were clipped again.",
      })
    ),
  }).pipe(
    $I.annoteSchema("OutlineSeparation", {
      description:
        "Count of outlines moved apart and the largest move, in mm, on one figure, and the shading strokes cut back or dropped beside them.",
    })
  )
) {}

/**
 * One rendered figure in the manifest.
 *
 * **Example** (FIG. 1)
 *
 * ```ts
 * import { FigureRecord } from "@beep/technical-drawing/Manifest.schemas"
 *
 * const record = FigureRecord.make({
 *   figure: 1, view: "top-perspective", description: "is a top perspective view",
 *   svgFile: "fig-1.svg", svgSha256: "00", visibleSegments: 15
 * })
 * console.log(record.figure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FigureRecord extends S.Opaque<FigureRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    figure: S.Natural.annotateKey({ description: "FIG. number, from 1." }),
    view: ViewName.annotateKey({ description: "View shown." }),
    description: S.NonEmptyString.annotateKey({ description: "Description sentence." }),
    svgFile: S.NonEmptyString.annotateKey({ description: "Sheet SVG file name in the output directory." }),
    svgSha256: S.String.annotateKey({ description: "SHA-256 of the sheet SVG." }),
    visibleSegments: S.Natural.annotateKey({ description: "Visible segments drawn." }),
    shadingSegments: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({ description: "Surface-shading segments drawn. Defaults to 0." })
    ),
    brokenSegments: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.annotateKey({
        description: "Broken-line (unclaimed part and broken overlay) segments drawn. Defaults to 0.",
      })
    ),
    emphasisSegments: S.OptionFromOptionalKey(S.Natural).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Emphasis overlay segments drawn. Absent when the figure draws none, and on manifests rendered before overlay lines.",
      })
    ),
    camera: S.OptionFromOptionalKey(Camera).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Camera the figure was projected with. Absent on manifests rendered before design-figure review round 1.",
      })
    ),
    shadingCoverage: S.OptionFromOptionalKey(ShadingCoverage).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Faces given shading lines and faces skipped per reason, with the faces and stretches lost counted on what the sheet draws, after the re-clip beside separated outlines. Absent on unshaded renders and on manifests rendered before graded shading.",
      })
    ),
    outlineSeparations: S.OptionFromOptionalKey(OutlineSeparation).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Outlines moved apart to hold the least centre spacing, and the largest move. Absent when no outline moved, and on manifests rendered before the outline-spacing rule.",
      })
    ),
  }).pipe(
    $I.annoteSchema("FigureRecord", {
      description:
        "FIG. number, view, description, sheet file, hash, segment counts, camera, shading coverage, and outline separations of one figure.",
    })
  )
) {}

/**
 * Result of proving an omission claim by render diff.
 *
 * **Example** (A proven claim)
 *
 * ```ts
 * import { OmissionProof } from "@beep/technical-drawing/Manifest.schemas"
 *
 * console.log(OmissionProof.make({ omitted: "rear", shown: "front", relation: "identical", proven: true }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OmissionProof extends S.Opaque<OmissionProof, { readonly brand: unique symbol }>()(
  S.Struct({
    omitted: ViewName.annotateKey({ description: "View omitted." }),
    shown: ViewName.annotateKey({ description: "View it was compared with." }),
    relation: S.Literals(["identical", "mirror"]).annotateKey({ description: "Claimed relation." }),
    proven: S.Boolean.annotateKey({ description: "Whether the projections agreed." }),
  }).pipe(
    $I.annoteSchema("OmissionProof", {
      description: "Outcome of checking one omission claim against the projections.",
    })
  )
) {}

/**
 * An operator label font file a render outlined, with its sha256.
 *
 * **Example** (A recorded font file)
 *
 * ```ts
 * import { LabelFontRecord } from "@beep/technical-drawing/Manifest.schemas"
 *
 * console.log(LabelFontRecord.make({ fontFile: "/fonts/arial.ttf", sha256: "00" }).fontFile)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LabelFontRecord extends S.Opaque<LabelFontRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    fontFile: S.NonEmptyString.annotateKey({
      description: "Absolute path of the font file, as the sheet options name it.",
    }),
    sha256: Sha256Hex.annotateKey({ description: "SHA-256 of the font file bytes the labels were outlined from." }),
  }).pipe(
    $I.annoteSchema("LabelFontRecord", {
      description: "Path and SHA-256 of an operator label font file outlined by a render.",
    })
  )
) {}

/**
 * A font a render embedded for text labels: the requested family, the file it
 * resolved to, and the file's sha256.
 *
 * **Example** (A pinned Arial)
 *
 * ```ts
 * import { FontPin } from "@beep/technical-drawing/Manifest.schemas"
 *
 * const pin = FontPin.make({
 *   family: "Arial",
 *   file: "/fonts/arial.ttf",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * })
 * console.log(pin.family)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FontPin extends S.Opaque<FontPin, { readonly brand: unique symbol }>()(
  S.Struct({
    family: S.NonEmptyString.annotateKey({ description: "Font family a text label requested." }),
    file: S.NonEmptyString.annotateKey({ description: "Absolute path of the font file the family resolved to." }),
    sha256: Sha256Hex.annotateKey({ description: "SHA-256 of the font file bytes embedded in the PDF." }),
  }).pipe(
    $I.annoteSchema("FontPin", {
      description: "Requested family, resolved file, and SHA-256 of a font embedded for text labels.",
    })
  )
) {}

/**
 * The render manifest written next to a sheet set.
 *
 * **Example** (A minimal manifest)
 *
 * ```ts
 * import { BoundingBox, ModelSummary } from "@beep/technical-drawing/Geometry.schemas"
 * import { EngineInfo, RenderManifest } from "@beep/technical-drawing/Manifest.schemas"
 * import * as O from "effect/Option"
 *
 * const manifest = RenderManifest.make({
 *   title: "Synthetic bracket",
 *   specSha256: "00",
 *   engine: EngineInfo.make({ name: "replicad", version: "1.1.0", binarySha256: "00" }),
 *   model: ModelSummary.make({ boundingBox: BoundingBox.make({ min: [0, 0, 0], max: [1, 1, 1] }), volume: 1, faceCount: 6, edgeCount: 12 }),
 *   scale: 1,
 *   figures: [],
 *   omissions: [],
 *   pdfFile: "sheets.pdf",
 *   pdfSha256: "00",
 *   validation: O.none()
 * })
 * console.log(manifest.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderManifest extends S.Opaque<RenderManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    title: S.NonEmptyString.annotateKey({ description: "Article title from the spec." }),
    specSha256: S.String.annotateKey({ description: "SHA-256 of the spec file bytes." }),
    engine: EngineInfo.annotateKey({ description: "Geometry engine provenance." }),
    model: ModelSummary.annotateKey({ description: "Measured model facts." }),
    scale: S.Finite.annotateKey({ description: "Points per model unit used on every sheet." }),
    shaded: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false)),
      S.annotateKey({ description: "Whether the figures carry procedural surface shading. Defaults to false." })
    ),
    figures: S.Array(FigureRecord).annotateKey({ description: "Rendered figures in FIG. order." }),
    omissions: S.Array(OmissionProof).annotateKey({ description: "Omission claims and their proofs." }),
    pdfFile: S.NonEmptyString.annotateKey({ description: "Sheet-set PDF file name in the output directory." }),
    pdfSha256: S.String.annotateKey({ description: "SHA-256 of the sheet-set PDF; the sheet-set hash." }),
    validation: S.OptionFromNullOr(ValidationReport).annotateKey({
      description: "Validator report, when it ran; `null` in JSON otherwise.",
    }),
    approver: S.OptionFromOptionalKey(EmailString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Approver recorded in the spec this set was rendered from; the only address `drawings sign` accepts. Absent when the spec names none.",
      })
    ),
    sheet: S.OptionFromOptionalKey(SheetOptions).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Effective sheet options of the render (the spec's, else the request's). Absent on manifests rendered before design-figure review round 1.",
      })
    ),
    labelFonts: S.Array(LabelFontRecord).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description: "Operator font files the labels were outlined from, with their hashes. Empty for vendored faces.",
      })
    ),
    fonts: S.Array(FontPin).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.annotateKey({
        description:
          "Fonts resolved and embedded for text labels, with their files and hashes. Empty when every label is outlined.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RenderManifest", {
      description:
        "Spec hash, engine, model facts, scale, figures, omission proofs, PDF hash, validation, recorded approver, effective sheet options, label font files, and embedded label fonts of a render.",
    })
  )
) {}
