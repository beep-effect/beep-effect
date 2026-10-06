/**
 * Render manifest: everything needed to reproduce and audit a sheet set.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { ModelSummary } from "./Geometry.schemas.ts";
import { ValidationReport } from "./Validation.schemas.ts";
import { ViewName } from "./View.schemas.ts";

const $I = $TechnicalDrawingId.create("Manifest.schemas");

/**
 * Lowercase hex SHA-256 digest.
 *
 * **Example** (The empty-string digest)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/technical-drawing"
 *
 * console.log(Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"))
 * ```
 *
 * @category manifest
 * @since 0.0.0
 */
export const Sha256Hex = S.String.check(
  S.isPattern(/^[0-9a-f]{64}$/, {
    identifier: $I`Sha256HexCheck`,
    title: "SHA-256 Hex",
    description: "64 lowercase hex characters.",
    message: "Expected a lowercase hex SHA-256 digest",
  })
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
 * import { Sha256Hex } from "@beep/technical-drawing"
 *
 * const digest: Sha256Hex = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(digest)
 * ```
 *
 * @category manifest
 * @since 0.0.0
 */
export type Sha256Hex = typeof Sha256Hex.Type;

/**
 * Provenance of the geometry engine that produced the projections.
 *
 * **Example** (Make engine info)
 *
 * ```ts
 * import { EngineInfo } from "@beep/technical-drawing"
 *
 * console.log(EngineInfo.make({ name: "replicad", version: "1.1.0", binarySha256: "00" }))
 * ```
 *
 * @category manifest
 * @since 0.0.0
 */
export class EngineInfo extends S.Class<EngineInfo>($I`EngineInfo`)(
  {
    name: S.NonEmptyString.annotateKey({ description: "Engine name." }),
    version: S.NonEmptyString.annotateKey({ description: "Engine version." }),
    binarySha256: S.String.annotateKey({ description: "Hash of the kernel binary, when the engine has one." }),
  },
  $I.annote("EngineInfo", {
    description: "Name, version, and binary hash of the geometry engine.",
  })
) {}

/**
 * One rendered figure in the manifest.
 *
 * **Example** (FIG. 1)
 *
 * ```ts
 * import { FigureRecord } from "@beep/technical-drawing"
 *
 * const record = FigureRecord.make({
 *   figure: 1, view: "top-perspective", description: "is a top perspective view",
 *   svgFile: "fig-1.svg", svgSha256: "00", visibleSegments: 15
 * })
 * console.log(record.figure)
 * ```
 *
 * @category manifest
 * @since 0.0.0
 */
export class FigureRecord extends S.Class<FigureRecord>($I`FigureRecord`)(
  {
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
  },
  $I.annote("FigureRecord", {
    description: "FIG. number, view, description, sheet file, hash, and segment count of one figure.",
  })
) {}

/**
 * Result of proving an omission claim by render diff.
 *
 * **Example** (A proven claim)
 *
 * ```ts
 * import { OmissionProof } from "@beep/technical-drawing"
 *
 * console.log(OmissionProof.make({ omitted: "rear", shown: "front", relation: "identical", proven: true }))
 * ```
 *
 * @category manifest
 * @since 0.0.0
 */
export class OmissionProof extends S.Class<OmissionProof>($I`OmissionProof`)(
  {
    omitted: ViewName.annotateKey({ description: "View omitted." }),
    shown: ViewName.annotateKey({ description: "View it was compared with." }),
    relation: S.Literals(["identical", "mirror"]).annotateKey({ description: "Claimed relation." }),
    proven: S.Boolean.annotateKey({ description: "Whether the projections agreed." }),
  },
  $I.annote("OmissionProof", {
    description: "Outcome of checking one omission claim against the projections.",
  })
) {}

/**
 * The render manifest written next to a sheet set.
 *
 * **Example** (A minimal manifest)
 *
 * ```ts
 * import { BoundingBox, EngineInfo, ModelSummary, RenderManifest } from "@beep/technical-drawing"
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
 * @category manifest
 * @since 0.0.0
 */
export class RenderManifest extends S.Class<RenderManifest>($I`RenderManifest`)(
  {
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
  },
  $I.annote("RenderManifest", {
    description:
      "Spec hash, engine, model facts, scale, figures, omission proofs, PDF hash, and validation of a render.",
  })
) {}
