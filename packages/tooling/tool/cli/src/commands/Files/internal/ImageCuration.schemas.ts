/**
 * Ledger-driven image curation schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FileSha256Hash, NonNegativePixelOffset, PositiveMediaDimension } from "./Media.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/ImageCuration.schemas");

/**
 * Final materialization disposition for a source image.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImageCurationDisposition = LiteralKit([
  "active-core",
  "active-extended",
  "holdout",
  "reserve-near-duplicate",
  "archive-earlier-life",
  "archive-identity-ambiguous",
  "archive-other-people",
  "archive-technical-quality",
  "archive-synthetic-filtered",
]).pipe(
  $I.annoteSchema("ImageCurationDisposition", {
    description: "Closed set of canonical, holdout, reserve, and archive destinations.",
  })
);

/**
 * Final materialization disposition for a source image.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageCurationDisposition = typeof ImageCurationDisposition.Type;

/**
 * Optional lossless crop rectangle in orientation-corrected source coordinates.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCurationCrop extends S.Class<ImageCurationCrop>($I`ImageCurationCrop`)(
  {
    height: PositiveMediaDimension,
    left: NonNegativePixelOffset,
    top: NonNegativePixelOffset,
    width: PositiveMediaDimension,
  },
  $I.annote("ImageCurationCrop", {
    description: "A reviewed natural crop expressed in pixels after EXIF orientation is applied.",
  })
) {}

/**
 * One explicit, hash-pinned source disposition.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCurationDecision extends S.Class<ImageCurationDecision>($I`ImageCurationDecision`)(
  {
    crop: S.optionalKey(ImageCurationCrop),
    disposition: ImageCurationDisposition,
    duplicateClusterId: S.optionalKey(S.String),
    reasons: S.NonEmptyArray(S.String),
    sessionId: S.optionalKey(S.String),
    sourceName: S.String,
    sourceSha256: FileSha256Hash,
  },
  $I.annote("ImageCurationDecision", {
    description: "A human-reviewable source decision pinned to exact source bytes.",
  })
) {}

/**
 * Complete decision ledger consumed by `files curate-images`.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCurationDecisionDocument extends S.Class<ImageCurationDecisionDocument>(
  $I`ImageCurationDecisionDocument`
)(
  {
    decisions: S.Array(ImageCurationDecision),
    schemaVersion: S.Literal("beep.files.image-curation-decisions.v1"),
    sourceDirectory: S.String,
  },
  $I.annote("ImageCurationDecisionDocument", {
    description: "A complete one-decision-per-source ledger for deterministic image curation.",
  })
) {}

/**
 * Options used by `files curate-images`.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCurationOptions extends S.Class<ImageCurationOptions>($I`ImageCurationOptions`)(
  {
    decisionsPath: S.String,
    dir: S.String,
    dryRun: S.Boolean,
    manifest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    outDir: S.String,
    overwrite: S.Boolean,
  },
  $I.annote("ImageCurationOptions", {
    description: "Validated source, ledger, output, dry-run, and overwrite inputs for image curation.",
  })
) {}

/**
 * One source-to-canonical-PNG materialization record.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCurationManifestEntry extends S.Class<ImageCurationManifestEntry>($I`ImageCurationManifestEntry`)(
  {
    crop: S.optionalKey(ImageCurationCrop),
    disposition: ImageCurationDisposition,
    duplicateClusterId: S.optionalKey(S.String),
    outputHeight: PositiveMediaDimension,
    outputName: S.String,
    outputPath: S.String,
    outputRelativePath: S.String,
    outputSha256: FileSha256Hash,
    outputSizeBytes: S.String,
    outputWidth: PositiveMediaDimension,
    reasons: S.NonEmptyArray(S.String),
    sessionId: S.optionalKey(S.String),
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
    sourceSha256: FileSha256Hash,
  },
  $I.annote("ImageCurationManifestEntry", {
    description: "Verified mapping from immutable source bytes to a metadata-free orientation-corrected PNG.",
  })
) {}

/**
 * Summary counts for a curation run.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCurationSummary extends S.Class<ImageCurationSummary>($I`ImageCurationSummary`)(
  {
    archiveCount: S.Int,
    coreCount: S.Int,
    dryRun: S.Boolean,
    extendedCount: S.Int,
    holdoutCount: S.Int,
    materializedCount: S.Int,
    plannedCount: S.Int,
    reserveCount: S.Int,
  },
  $I.annote("ImageCurationSummary", {
    description: "Counts by final disposition for a ledger validation or materialization run.",
  })
) {}

/**
 * Manifest produced by a successful image curation run.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageCurationManifest extends S.Class<ImageCurationManifest>($I`ImageCurationManifest`)(
  {
    decisionDocumentPath: S.String,
    entries: S.Array(ImageCurationManifestEntry),
    manifestPath: S.String,
    outputDirectory: S.String,
    schemaVersion: S.Literal("beep.files.image-curation.v1"),
    sourceDirectory: S.String,
    summary: ImageCurationSummary,
  },
  $I.annote("ImageCurationManifest", {
    description: "Complete provenance map for canonical PNG derivatives and all archived or reserved derivatives.",
  })
) {}

/**
 * Decode a JSON curation decision ledger.
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeImageCurationDecisionDocumentJson = S.decodeUnknownEffect(
  S.fromJsonString(ImageCurationDecisionDocument)
);

/**
 * Encode a curation decision ledger into its JSON-safe representation.
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeImageCurationDecisionDocument = S.encodeUnknownEffect(ImageCurationDecisionDocument);

/**
 * Encode a curation manifest into its JSON-safe representation.
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeImageCurationManifest = S.encodeUnknownEffect(ImageCurationManifest);

/**
 * Decode a JSON curation manifest.
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeImageCurationManifestJson = S.decodeUnknownEffect(S.fromJsonString(ImageCurationManifest));
