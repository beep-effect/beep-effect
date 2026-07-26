/**
 * Image audit schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { FileSha256Hash, PositiveMediaDimension } from "./Media.schemas.ts";

// cspell:ignore Iptc

const $I = $RepoCliId.create("commands/Files/internal/ImageAudit.schemas");

/**
 * Options used by `files audit-images`.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditOptions extends S.Class<ImageAuditOptions>($I`ImageAuditOptions`)(
  {
    dir: S.String,
    manifest: S.String,
    minConfidence: S.Finite,
    modelPath: S.String,
    overwrite: S.Boolean,
  },
  $I.annote("ImageAuditOptions", {
    description: "Validated inputs for a read-only image identity and quality audit.",
  })
) {}

/**
 * Metadata-presence flags recorded without copying metadata values.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditMetadataPresence extends S.Class<ImageAuditMetadataPresence>($I`ImageAuditMetadataPresence`)(
  {
    hasExif: S.Boolean,
    hasIcc: S.Boolean,
    hasIptc: S.Boolean,
    hasXmp: S.Boolean,
    orientation: S.optionalKey(S.Int),
    orientationApplied: S.Boolean,
  },
  $I.annote("ImageAuditMetadataPresence", {
    description: "Privacy-preserving metadata presence and orientation facts for a source image.",
  })
) {}

/**
 * Advisory technical-quality measurements for an audited image.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditQualityMetrics extends S.Class<ImageAuditQualityMetrics>($I`ImageAuditQualityMetrics`)(
  {
    colorfulness: S.Finite,
    darkClipPct: S.Finite,
    edgeEnergy: S.Finite,
    entropyBits: S.Finite,
    lightClipPct: S.Finite,
    meanLuminance: S.Finite,
  },
  $I.annote("ImageAuditQualityMetrics", {
    description: "Advisory luminance, clipping, color, entropy, and edge-energy measurements.",
  })
) {}

/**
 * Face measurements recorded for one audited image.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditFaceMetrics extends S.Class<ImageAuditFaceMetrics>($I`ImageAuditFaceMetrics`)(
  {
    faceCount: S.Int,
    primaryFaceAreaPct: S.optionalKey(S.Finite),
    primaryFaceConfidence: S.optionalKey(S.Finite),
    primaryFaceHeight: S.optionalKey(S.Finite),
    primaryFaceWidth: S.optionalKey(S.Finite),
  },
  $I.annote("ImageAuditFaceMetrics", {
    description: "Detected face count and primary-face scale measurements used only for review.",
  })
) {}

/**
 * One successfully audited source image.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditEntry extends S.Class<ImageAuditEntry>($I`ImageAuditEntry`)(
  {
    aspectRatio: S.Finite,
    colorHash: S.String,
    decodedPixelSha256: FileSha256Hash,
    extension: S.String,
    faces: ImageAuditFaceMetrics,
    height: PositiveMediaDimension,
    metadata: ImageAuditMetadataPresence,
    perceptualHash: S.String,
    quality: ImageAuditQualityMetrics,
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
    sourceSha256: FileSha256Hash,
    sourceSizeBytes: S.String,
    width: PositiveMediaDimension,
  },
  $I.annote("ImageAuditEntry", {
    description: "Hashes, geometry, metadata presence, face scale, and advisory quality data for one source image.",
  })
) {}

/**
 * A source entry skipped by the image audit.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditSkippedEntry extends S.Class<ImageAuditSkippedEntry>($I`ImageAuditSkippedEntry`)(
  {
    message: S.String,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("ImageAuditSkippedEntry", {
    description: "A non-image, unsafe, or unreadable direct source entry skipped by the audit.",
  })
) {}

/**
 * Advisory perceptual similarity between two audited images.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditSimilarityPair extends S.Class<ImageAuditSimilarityPair>($I`ImageAuditSimilarityPair`)(
  {
    colorDistance: S.Finite,
    perceptualDistance: S.Int,
    sourceNameA: S.String,
    sourceNameB: S.String,
  },
  $I.annote("ImageAuditSimilarityPair", {
    description: "A candidate near-duplicate pair and its advisory perceptual and color distances.",
  })
) {}

/**
 * Candidate duplicate or filename-session cluster.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditCluster extends S.Class<ImageAuditCluster>($I`ImageAuditCluster`)(
  {
    id: S.String,
    sourceNames: S.NonEmptyArray(S.String),
  },
  $I.annote("ImageAuditCluster", {
    description: "A deterministic candidate cluster that requires visual confirmation.",
  })
) {}

/**
 * Summary counts for an image audit.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditSummary extends S.Class<ImageAuditSummary>($I`ImageAuditSummary`)(
  {
    analyzedCount: S.Int,
    duplicateClusterCount: S.Int,
    faceImageCount: S.Int,
    multiFaceImageCount: S.Int,
    noFaceImageCount: S.Int,
    sessionClusterCount: S.Int,
    similarityPairCount: S.Int,
    skippedCount: S.Int,
    totalCount: S.Int,
  },
  $I.annote("ImageAuditSummary", {
    description: "Machine-readable counts for a completed image audit.",
  })
) {}

/**
 * Read-only image audit manifest.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditManifest extends S.Class<ImageAuditManifest>($I`ImageAuditManifest`)(
  {
    duplicateClusters: S.Array(ImageAuditCluster),
    entries: S.Array(ImageAuditEntry),
    manifestPath: S.String,
    modelPath: S.String,
    schemaVersion: S.Literal("beep.files.image-audit.v1"),
    sessionClusters: S.Array(ImageAuditCluster),
    similarityPairs: S.Array(ImageAuditSimilarityPair),
    skipped: S.Array(ImageAuditSkippedEntry),
    sourceDirectory: S.String,
    summary: ImageAuditSummary,
  },
  $I.annote("ImageAuditManifest", {
    description: "Deterministic image audit evidence; all scores and clusters are advisory.",
  })
) {}

/**
 * Encode an image audit manifest into its JSON-safe representation.
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeImageAuditManifest = S.encodeUnknownEffect(ImageAuditManifest);

/**
 * Decode a JSON image audit manifest.
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeImageAuditManifestJson = S.decodeUnknownEffect(S.fromJsonString(ImageAuditManifest));
