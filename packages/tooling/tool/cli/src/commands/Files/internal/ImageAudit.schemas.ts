/**
 * Image audit schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { FileSha256Hash, PositiveMediaDimension } from "./Media.schemas.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Files/internal/ImageAudit.schemas");

/**
 * @category models
 * @since 0.0.0
 */
export class ImageAuditOptions extends S.Opaque<ImageAuditOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    dir: S.String,
    manifest: S.String,
    overwrite: S.Boolean,
  }).pipe(
    $I.annoteSchema("ImageAuditOptions", {
      description: "Validated inputs for a read-only image identity and quality audit.",
    })
  )
) {}

/**
 * Metadata-presence flags recorded without copying metadata values.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditMetadataPresence extends S.Opaque<
  ImageAuditMetadataPresence,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    hasExif: S.Boolean,
    hasIcc: S.Boolean,
    hasIptc: S.Boolean,
    hasXmp: S.Boolean,
    orientation: S.optionalKey(S.Int),
    orientationApplied: S.Boolean,
  }).pipe(
    $I.annoteSchema("ImageAuditMetadataPresence", {
      description: "Privacy-preserving metadata presence and orientation facts for a source image.",
    })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export class ImageAuditQualityMetrics extends S.Opaque<ImageAuditQualityMetrics, { readonly brand: unique symbol }>()(
  S.Struct({
    colorfulness: S.Finite,
    darkClipPct: S.Finite,
    edgeEnergy: S.Finite,
    entropyBits: S.Finite,
    lightClipPct: S.Finite,
    meanLuminance: S.Finite,
  }).pipe(
    $I.annoteSchema("ImageAuditQualityMetrics", {
      description: "Advisory luminance, clipping, color, entropy, and edge-energy measurements.",
    })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export class ImageAuditEntry extends S.Opaque<ImageAuditEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    aspectRatio: S.Finite,
    colorHash: S.String,
    decodedPixelSha256: FileSha256Hash,
    extension: S.String,
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
  }).pipe(
    $I.annoteSchema("ImageAuditEntry", {
      description: "Hashes, geometry, metadata presence, and advisory quality data for one source image.",
    })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export class ImageAuditSkippedEntry extends S.Opaque<ImageAuditSkippedEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    message: S.String,
    sourceName: S.String,
    sourcePath: S.String,
  }).pipe(
    $I.annoteSchema("ImageAuditSkippedEntry", {
      description: "A non-image, unsafe, or unreadable direct source entry skipped by the audit.",
    })
  )
) {}

/**
 * Advisory perceptual similarity between two audited images.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditSimilarityPair extends S.Opaque<ImageAuditSimilarityPair, { readonly brand: unique symbol }>()(
  S.Struct({
    colorDistance: S.Finite,
    perceptualDistance: S.Int,
    sourceNameA: S.String,
    sourceNameB: S.String,
  }).pipe(
    $I.annoteSchema("ImageAuditSimilarityPair", {
      description: "A candidate near-duplicate pair and its advisory perceptual and color distances.",
    })
  )
) {}

/**
 * Candidate duplicate or filename-session cluster.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditCluster extends S.Opaque<ImageAuditCluster, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    sourceNames: S.NonEmptyArray(S.String),
  }).pipe(
    $I.annoteSchema("ImageAuditCluster", {
      description: "A deterministic candidate cluster that requires visual confirmation.",
    })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export class ImageAuditSummary extends S.Opaque<ImageAuditSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    analyzedCount: S.Int,
    duplicateClusterCount: S.Int,
    sessionClusterCount: S.Int,
    similarityPairCount: S.Int,
    skippedCount: S.Int,
    totalCount: S.Int,
  }).pipe(
    $I.annoteSchema("ImageAuditSummary", {
      description: "Machine-readable counts for a completed image audit.",
    })
  )
) {}

/**
 * Read-only image audit manifest.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageAuditManifest extends S.Opaque<ImageAuditManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    duplicateClusters: S.Array(ImageAuditCluster),
    entries: S.Array(ImageAuditEntry),
    manifestPath: S.String,
    schemaVersion: S.tag("beep.files.image-audit.v2"),
    sessionClusters: S.Array(ImageAuditCluster),
    similarityPairs: S.Array(ImageAuditSimilarityPair),
    skipped: S.Array(ImageAuditSkippedEntry),
    sourceDirectory: S.String,
    summary: ImageAuditSummary,
  }).pipe(
    $I.annoteSchema("ImageAuditManifest", {
      description: "Deterministic image audit evidence; all scores and clusters are advisory.",
    })
  )
) {}

/**
 * Encode an image audit manifest into its JSON-safe representation.
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeImageAuditManifest: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof ImageAuditManifest.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof ImageAuditManifest.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(ImageAuditManifest));

/**
 * Decode a JSON image audit manifest.
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeImageAuditManifestJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ImageAuditManifest, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ImageAuditManifest, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(ImageAuditManifest)));
