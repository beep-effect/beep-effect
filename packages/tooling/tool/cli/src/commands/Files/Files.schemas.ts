/**
 * Schema models for dataset file curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FaceDetection, FaceDetectionConfidence, FaceDetectionPercentage } from "@beep/face-detection";
import { FileProcessingEngineFamily } from "@beep/file-processing/Strategy";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Str } from "@beep/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Files/Files.schemas");

/**
 * Positive media dimension schema.
 *
 * @example
 * ```ts
 * import { PositiveMediaDimension } from "@beep/repo-cli/commands/Files"
 * console.log(PositiveMediaDimension)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const PositiveMediaDimension = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`PositiveMediaDimensionGreaterThanZeroCheck`,
        title: "Positive Media Dimension",
        description: "A media width or height must be greater than zero.",
        message: "Expected a positive media dimension",
      }),
    ],
    {
      identifier: $I`PositiveMediaDimensionChecks`,
      title: "Positive Media Dimension",
      description: "Checks for positive integer media dimensions.",
    }
  )
).pipe(
  $I.annoteSchema("PositiveMediaDimension", {
    description: "A positive integer width or height reported by a media probe.",
  })
);

/**
 * Positive media dimension value.
 *
 * @example
 * ```ts
 * import type { PositiveMediaDimension } from "@beep/repo-cli/commands/Files"
 *
 * const height: PositiveMediaDimension = 1080
 * console.log(height)
 * ```
 * @category models
 * @since 0.0.0
 */
export type PositiveMediaDimension = typeof PositiveMediaDimension.Type;

/**
 * SHA-256 hash recorded for normalized file bytes.
 *
 * @example
 * ```ts
 * import { FileSha256Hash } from "@beep/repo-cli/commands/Files"
 * console.log(FileSha256Hash)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const FileSha256Hash = S.String.check(
  S.isPattern(/^sha256:[a-f0-9]{64}$/, {
    identifier: $I`FileSha256HashPatternCheck`,
    title: "File SHA-256 Hash",
    description: "A file content hash must use the sha256:<64 lowercase hex digits> format.",
    message: "Expected a SHA-256 file hash",
  })
).pipe(
  $I.annoteSchema("FileSha256Hash", {
    description: "A SHA-256 digest for exact file-byte duplicate detection.",
  })
);

/**
 * SHA-256 hash recorded for normalized file bytes.
 *
 * @example
 * ```ts
 * import type { FileSha256Hash } from "@beep/repo-cli/commands/Files"
 *
 * const hash: FileSha256Hash = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * console.log(hash)
 * ```
 * @category models
 * @since 0.0.0
 */
export type FileSha256Hash = typeof FileSha256Hash.Type;

/**
 * Non-negative pixel offset schema.
 *
 * @example
 * ```ts
 * import { NonNegativePixelOffset } from "@beep/repo-cli/commands/Files"
 * console.log(NonNegativePixelOffset)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NonNegativePixelOffset = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`NonNegativePixelOffsetGreaterThanOrEqualToZeroCheck`,
        title: "Non-negative Pixel Offset",
        description: "A crop offset must be greater than or equal to zero.",
        message: "Expected a non-negative pixel offset",
      }),
    ],
    {
      identifier: $I`NonNegativePixelOffsetChecks`,
      title: "Non-negative Pixel Offset",
      description: "Checks for non-negative integer pixel offsets.",
    }
  )
).pipe(
  $I.annoteSchema("NonNegativePixelOffset", {
    description: "A non-negative integer crop offset.",
  })
);

/**
 * Non-negative pixel offset value.
 *
 * @example
 * ```ts
 * import type { NonNegativePixelOffset } from "@beep/repo-cli/commands/Files"
 *
 * const offset: NonNegativePixelOffset = 0
 * console.log(offset)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NonNegativePixelOffset = typeof NonNegativePixelOffset.Type;

/**
 * Media kind schema for selected dataset files.
 *
 * @example
 * ```ts
 * import { MediaKind } from "@beep/repo-cli/commands/Files"
 * console.log(MediaKind)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const MediaKind = LiteralKit(["image", "video"]).pipe(
  $I.annoteSchema("MediaKind", {
    description: "The media probing strategy used for a selected file.",
  })
);

/**
 * Media kind for selected dataset files.
 *
 * @example
 * ```ts
 * import type { MediaKind } from "@beep/repo-cli/commands/Files"
 *
 * const kind: MediaKind = "image"
 * console.log(kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export type MediaKind = typeof MediaKind.Type;

/**
 * Image extension schema supported by metadata stripping.
 *
 * @example
 * ```ts
 * import { SupportedMetadataImageExtension } from "@beep/repo-cli/commands/Files"
 * console.log(SupportedMetadataImageExtension)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SupportedMetadataImageExtension = LiteralKit(["avif", "jpeg", "jpg", "png", "tif", "tiff", "webp"]).pipe(
  $I.annoteSchema("SupportedMetadataImageExtension", {
    description: "Image file extensions that the metadata-strip command normalizes through sharp.",
  })
);

/**
 * Image extension supported by metadata stripping.
 *
 * @example
 * ```ts
 * import type { SupportedMetadataImageExtension } from "@beep/repo-cli/commands/Files"
 *
 * const extension: SupportedMetadataImageExtension = "png"
 * console.log(extension)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SupportedMetadataImageExtension = typeof SupportedMetadataImageExtension.Type;

/**
 * CLI image format accepted by `files normalize`.
 *
 * @example
 * ```ts
 * import { NormalizeImageFormatInput } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeImageFormatInput)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NormalizeImageFormatInput = LiteralKit(["png", "jpg", "jpeg", "webp"]).pipe(
  $I.annoteSchema("NormalizeImageFormatInput", {
    description: "Image output format accepted by the normalize command.",
  })
);

/**
 * CLI image format accepted by `files normalize`.
 *
 * @example
 * ```ts
 * import type { NormalizeImageFormatInput } from "@beep/repo-cli/commands/Files"
 *
 * const format: NormalizeImageFormatInput = "png"
 * console.log(format)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NormalizeImageFormatInput = typeof NormalizeImageFormatInput.Type;

/**
 * Canonical image output format emitted by `files normalize`.
 *
 * @example
 * ```ts
 * import { NormalizeImageFormat } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeImageFormat)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NormalizeImageFormat = LiteralKit(["png", "jpg", "webp"]).pipe(
  $I.annoteSchema("NormalizeImageFormat", {
    description: "Canonical image output format emitted by the normalize command.",
  })
);

/**
 * Canonical image output format emitted by `files normalize`.
 *
 * @example
 * ```ts
 * import type { NormalizeImageFormat } from "@beep/repo-cli/commands/Files"
 *
 * const format: NormalizeImageFormat = "png"
 * console.log(format)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NormalizeImageFormat = typeof NormalizeImageFormat.Type;

/**
 * Reason a direct directory entry was skipped by `files normalize`.
 *
 * @example
 * ```ts
 * import { NormalizeSkippedReason } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeSkippedReason)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NormalizeSkippedReason = LiteralKit([
  "duplicate",
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unsupported-image",
  "video",
]).pipe(
  $I.annoteSchema("NormalizeSkippedReason", {
    description: "Reason a source entry was not selected for image normalization.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files normalize`.
 *
 * @example
 * ```ts
 * import type { NormalizeSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const reason: NormalizeSkippedReason = "duplicate"
 * console.log(reason)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NormalizeSkippedReason = typeof NormalizeSkippedReason.Type;

/**
 * Reason a direct directory entry was skipped by `files create-captions`.
 *
 * @example
 * ```ts
 * import { CreateCaptionFilesSkippedReason } from "@beep/repo-cli/commands/Files"
 * console.log(CreateCaptionFilesSkippedReason)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CreateCaptionFilesSkippedReason = LiteralKit([
  "caption-exists",
  "caption-target-collision",
  "caption-target-not-file",
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "video",
]).pipe(
  $I.annoteSchema("CreateCaptionFilesSkippedReason", {
    description: "Reason a source entry was not selected for caption sidecar creation.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files create-captions`.
 *
 * @example
 * ```ts
 * import type { CreateCaptionFilesSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const reason: CreateCaptionFilesSkippedReason = "directory"
 * console.log(reason)
 * ```
 * @category models
 * @since 0.0.0
 */
export type CreateCaptionFilesSkippedReason = typeof CreateCaptionFilesSkippedReason.Type;

/**
 * Side of an image edge scanned for a solid border.
 *
 * @example
 * ```ts
 * import { BorderSide } from "@beep/repo-cli/commands/Files"
 * console.log(BorderSide)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BorderSide = LiteralKit(["top", "right", "bottom", "left"]).pipe(
  $I.annoteSchema("BorderSide", {
    description: "Image side scanned by the border detection operation.",
  })
);

/**
 * Side of an image edge scanned for a solid border.
 *
 * @example
 * ```ts
 * import type { BorderSide } from "@beep/repo-cli/commands/Files"
 *
 * const side: BorderSide = "top"
 * console.log(side)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BorderSide = typeof BorderSide.Type;

/**
 * Classified border layout for an analyzed image.
 *
 * @example
 * ```ts
 * import { BorderDetectionKind } from "@beep/repo-cli/commands/Files"
 * console.log(BorderDetectionKind)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionKind = LiteralKit(["none", "canvas-edge", "pillarbox", "letterbox", "frame", "mixed"]).pipe(
  $I.annoteSchema("BorderDetectionKind", {
    description: "Detected solid-border layout for a dataset image.",
  })
);

/**
 * Classified border layout for an analyzed image.
 *
 * @example
 * ```ts
 * import type { BorderDetectionKind } from "@beep/repo-cli/commands/Files"
 *
 * const kind: BorderDetectionKind = "none"
 * console.log(kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionKind = typeof BorderDetectionKind.Type;

/**
 * Reason a direct directory entry was skipped by `files detect-borders`.
 *
 * @example
 * ```ts
 * import { DetectBordersSkippedReason } from "@beep/repo-cli/commands/Files"
 * console.log(DetectBordersSkippedReason)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const DetectBordersSkippedReason = LiteralKit([
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unsupported-image",
  "unreadable-image",
  "video",
]).pipe(
  $I.annoteSchema("DetectBordersSkippedReason", {
    description: "Reason a source entry was not analyzed for solid borders.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files detect-borders`.
 *
 * @example
 * ```ts
 * import type { DetectBordersSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const reason: DetectBordersSkippedReason = "directory"
 * console.log(reason)
 * ```
 * @category models
 * @since 0.0.0
 */
export type DetectBordersSkippedReason = typeof DetectBordersSkippedReason.Type;

/**
 * Reason a direct directory entry was skipped by `files detect-faces`.
 *
 * @example
 * ```ts
 * import { DetectFacesSkippedReason } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesSkippedReason)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const DetectFacesSkippedReason = LiteralKit([
  "detection-failed",
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unreadable-image",
  "unsupported-image",
  "video",
]).pipe(
  $I.annoteSchema("DetectFacesSkippedReason", {
    description: "Reason a source entry was not selected for face detection.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files detect-faces`.
 *
 * @example
 * ```ts
 * import type { DetectFacesSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const reason: DetectFacesSkippedReason = "directory"
 * console.log(reason)
 * ```
 * @category models
 * @since 0.0.0
 */
export type DetectFacesSkippedReason = typeof DetectFacesSkippedReason.Type;

/**
 * Triage flag emitted by `files detect-faces`.
 *
 * @example
 * ```ts
 * import { DetectFacesFlag } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesFlag)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const DetectFacesFlag = LiteralKit([
  "face-at-edge",
  "face-too-small",
  "has-face",
  "multiple-faces",
  "no-face",
]).pipe(
  $I.annoteSchema("DetectFacesFlag", {
    description: "Machine-readable face triage flag emitted for an analyzed image.",
  })
);

/**
 * Triage flag emitted by `files detect-faces`.
 *
 * @example
 * ```ts
 * import type { DetectFacesFlag } from "@beep/repo-cli/commands/Files"
 *
 * const flag: DetectFacesFlag = "has-face"
 * console.log(flag)
 * ```
 * @category models
 * @since 0.0.0
 */
export type DetectFacesFlag = typeof DetectFacesFlag.Type;

/**
 * Dataset profile used by candidate-quality triage.
 *
 * @example
 * ```ts
 * import { CandidateAssessmentProfile } from "@beep/repo-cli/commands/Files"
 * console.log(CandidateAssessmentProfile)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAssessmentProfile = LiteralKit(["character-lora"]).pipe(
  $I.annoteSchema("CandidateAssessmentProfile", {
    description: "Dataset-quality assessment profile for files archive-poor-candidates.",
  })
);

/**
 * Dataset profile used by candidate-quality triage.
 *
 * @example
 * ```ts
 * import type { CandidateAssessmentProfile } from "@beep/repo-cli/commands/Files"
 *
 * const profile: CandidateAssessmentProfile = "character-lora"
 * console.log(profile)
 * ```
 * @category models
 * @since 0.0.0
 */
export type CandidateAssessmentProfile = typeof CandidateAssessmentProfile.Type;

/**
 * Candidate-quality decision produced by `files archive-poor-candidates`.
 *
 * @example
 * ```ts
 * import { CandidateAssessmentDecision } from "@beep/repo-cli/commands/Files"
 * console.log(CandidateAssessmentDecision)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAssessmentDecision = LiteralKit(["archive", "keep"]).pipe(
  $I.annoteSchema("CandidateAssessmentDecision", {
    description: "Whether an assessed image should be kept in place or archived as a poor candidate.",
  })
);

/**
 * Candidate-quality decision produced by `files archive-poor-candidates`.
 *
 * @example
 * ```ts
 * import type { CandidateAssessmentDecision } from "@beep/repo-cli/commands/Files"
 *
 * const decision: CandidateAssessmentDecision = "keep"
 * console.log(decision)
 * ```
 * @category models
 * @since 0.0.0
 */
export type CandidateAssessmentDecision = typeof CandidateAssessmentDecision.Type;

/**
 * Hard-threshold reason that can cause an image to be archived.
 *
 * @example
 * ```ts
 * import { CandidateAssessmentReason } from "@beep/repo-cli/commands/Files"
 * console.log(CandidateAssessmentReason)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAssessmentReason = LiteralKit([
  "extreme-aspect-ratio",
  "short-edge-too-small",
  "upscale-too-large",
]).pipe(
  $I.annoteSchema("CandidateAssessmentReason", {
    description: "Machine-readable hard-threshold reason for archiving a poor image candidate.",
  })
);

/**
 * Hard-threshold reason that can cause an image to be archived.
 *
 * @example
 * ```ts
 * import type { CandidateAssessmentReason } from "@beep/repo-cli/commands/Files"
 *
 * const reason: CandidateAssessmentReason = "short-edge-too-small"
 * console.log(reason)
 * ```
 * @category models
 * @since 0.0.0
 */
export type CandidateAssessmentReason = typeof CandidateAssessmentReason.Type;

/**
 * Reason a direct directory entry was skipped by `files archive-poor-candidates`.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesSkippedReason } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesSkippedReason)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ArchivePoorCandidatesSkippedReason = LiteralKit([
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unsupported-image",
  "unreadable-image",
  "video",
]).pipe(
  $I.annoteSchema("ArchivePoorCandidatesSkippedReason", {
    description: "Reason a source entry was not assessed for candidate-quality archival.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files archive-poor-candidates`.
 *
 * @example
 * ```ts
 * import type { ArchivePoorCandidatesSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const reason: ArchivePoorCandidatesSkippedReason = "directory"
 * console.log(reason)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ArchivePoorCandidatesSkippedReason = typeof ArchivePoorCandidatesSkippedReason.Type;

/**
 * Numeric threshold ratio used by candidate-quality triage.
 *
 * @example
 * ```ts
 * import { CandidateRatioThreshold } from "@beep/repo-cli/commands/Files"
 * console.log(CandidateRatioThreshold)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CandidateRatioThreshold = S.Finite.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`CandidateRatioThresholdGreaterThanOrEqualToOneCheck`,
    title: "Candidate Ratio Threshold",
    description: "Candidate assessment ratio thresholds must be at least one.",
    message: "Expected a ratio threshold greater than or equal to one",
  })
).pipe(
  $I.annoteSchema("CandidateRatioThreshold", {
    description: "A ratio threshold greater than or equal to one.",
  })
);

/**
 * Numeric threshold ratio used by candidate-quality triage.
 *
 * @example
 * ```ts
 * import type { CandidateRatioThreshold } from "@beep/repo-cli/commands/Files"
 *
 * const ratio: CandidateRatioThreshold = 1.5
 * console.log(ratio)
 * ```
 * @category models
 * @since 0.0.0
 */
export type CandidateRatioThreshold = typeof CandidateRatioThreshold.Type;

/**
 * Percentage threshold used by border detection options.
 *
 * @example
 * ```ts
 * import { BorderDetectionPercentage } from "@beep/repo-cli/commands/Files"
 * console.log(BorderDetectionPercentage)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionPercentage = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`BorderDetectionPercentageGreaterThanZeroCheck`,
        title: "Border Detection Percentage Greater Than Zero",
        description: "Border detection percentages must be greater than zero.",
        message: "Expected a percentage greater than zero",
      }),
      S.isLessThanOrEqualTo(100, {
        identifier: $I`BorderDetectionPercentageLessThanOrEqualToOneHundredCheck`,
        title: "Border Detection Percentage Maximum",
        description: "Border detection percentages must not exceed 100.",
        message: "Expected a percentage no greater than 100",
      }),
    ],
    {
      identifier: $I`BorderDetectionPercentageChecks`,
      title: "Border Detection Percentage",
      description: "Checks for percentage thresholds accepted by border detection.",
    }
  )
).pipe(
  $I.annoteSchema("BorderDetectionPercentage", {
    description: "Percentage threshold between greater than zero and 100.",
  })
);

/**
 * Percentage threshold used by border detection options.
 *
 * @example
 * ```ts
 * import type { BorderDetectionPercentage } from "@beep/repo-cli/commands/Files"
 *
 * const percentage: BorderDetectionPercentage = 10
 * console.log(percentage)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionPercentage = typeof BorderDetectionPercentage.Type;

/**
 * Maximum scan percentage accepted by border detection.
 *
 * @example
 * ```ts
 * import { BorderDetectionMaxScanPercentage } from "@beep/repo-cli/commands/Files"
 * console.log(BorderDetectionMaxScanPercentage)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionMaxScanPercentage = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`BorderDetectionMaxScanPercentageGreaterThanZeroCheck`,
        title: "Border Detection Max Scan Percentage Greater Than Zero",
        description: "The maximum scan percentage must be greater than zero.",
        message: "Expected a max scan percentage greater than zero",
      }),
      S.isLessThanOrEqualTo(50, {
        identifier: $I`BorderDetectionMaxScanPercentageLessThanOrEqualToFiftyCheck`,
        title: "Border Detection Max Scan Percentage Maximum",
        description: "The maximum scan percentage is capped at half of an image dimension.",
        message: "Expected a max scan percentage no greater than 50",
      }),
    ],
    {
      identifier: $I`BorderDetectionMaxScanPercentageChecks`,
      title: "Border Detection Max Scan Percentage",
      description: "Checks for maximum inward border scan percentage.",
    }
  )
).pipe(
  $I.annoteSchema("BorderDetectionMaxScanPercentage", {
    description: "Maximum percentage of each image dimension to scan inward from an edge.",
  })
);

/**
 * Maximum scan percentage accepted by border detection.
 *
 * @example
 * ```ts
 * import type { BorderDetectionMaxScanPercentage } from "@beep/repo-cli/commands/Files"
 *
 * const percentage: BorderDetectionMaxScanPercentage = 25
 * console.log(percentage)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionMaxScanPercentage = typeof BorderDetectionMaxScanPercentage.Type;

/**
 * RGB channel tolerance accepted by border detection.
 *
 * @example
 * ```ts
 * import { BorderDetectionTolerance } from "@beep/repo-cli/commands/Files"
 * console.log(BorderDetectionTolerance)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionTolerance = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`BorderDetectionToleranceGreaterThanOrEqualToZeroCheck`,
        title: "Border Detection Tolerance Minimum",
        description: "RGB tolerance must be zero or greater.",
        message: "Expected an RGB tolerance no less than zero",
      }),
      S.isLessThanOrEqualTo(255, {
        identifier: $I`BorderDetectionToleranceLessThanOrEqualToTwoHundredFiftyFiveCheck`,
        title: "Border Detection Tolerance Maximum",
        description: "RGB tolerance must fit inside one 8-bit color channel.",
        message: "Expected an RGB tolerance no greater than 255",
      }),
    ],
    {
      identifier: $I`BorderDetectionToleranceChecks`,
      title: "Border Detection Tolerance",
      description: "Checks for RGB channel tolerance accepted by border detection.",
    }
  )
).pipe(
  $I.annoteSchema("BorderDetectionTolerance", {
    description: "Maximum per-channel RGB distance accepted for near-solid border pixels.",
  })
);

/**
 * RGB channel tolerance accepted by border detection.
 *
 * @example
 * ```ts
 * import type { BorderDetectionTolerance } from "@beep/repo-cli/commands/Files"
 *
 * const tolerance: BorderDetectionTolerance = 10
 * console.log(tolerance)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionTolerance = typeof BorderDetectionTolerance.Type;

/**
 * Integer RGB channel value.
 *
 * @example
 * ```ts
 * import { RgbChannel } from "@beep/repo-cli/commands/Files"
 * console.log(RgbChannel)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const RgbChannel = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`RgbChannelGreaterThanOrEqualToZeroCheck`,
        title: "RGB Channel Minimum",
        description: "RGB channel values must be zero or greater.",
        message: "Expected an RGB channel value no less than zero",
      }),
      S.isLessThanOrEqualTo(255, {
        identifier: $I`RgbChannelLessThanOrEqualToTwoHundredFiftyFiveCheck`,
        title: "RGB Channel Maximum",
        description: "RGB channel values must not exceed 255.",
        message: "Expected an RGB channel value no greater than 255",
      }),
    ],
    {
      identifier: $I`RgbChannelChecks`,
      title: "RGB Channel",
      description: "Checks for one 8-bit RGB channel.",
    }
  )
).pipe(
  $I.annoteSchema("RgbChannel", {
    description: "One integer 8-bit RGB channel value.",
  })
);

/**
 * Integer RGB channel value.
 *
 * @example
 * ```ts
 * import type { RgbChannel } from "@beep/repo-cli/commands/Files"
 *
 * const channel: RgbChannel = 128
 * console.log(channel)
 * ```
 * @category models
 * @since 0.0.0
 */
export type RgbChannel = typeof RgbChannel.Type;

/**
 * Dimension metadata returned by `image-size`.
 *
 * @example
 * ```ts
 * import { ImageSizeMetadata } from "@beep/repo-cli/commands/Files"
 * console.log(ImageSizeMetadata)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ImageSizeMetadata extends S.Class<ImageSizeMetadata>($I`ImageSizeMetadata`)(
  {
    height: PositiveMediaDimension,
    orientation: S.optionalKey(S.Int),
    width: PositiveMediaDimension,
  },
  $I.annote("ImageSizeMetadata", {
    description: "Dimension metadata returned by the image-size package.",
  })
) {}

/**
 * Side-data entry returned by `ffprobe`.
 *
 * @example
 * ```ts
 * import { FfprobeSideData } from "@beep/repo-cli/commands/Files"
 * console.log(FfprobeSideData)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FfprobeSideData extends S.Class<FfprobeSideData>($I`FfprobeSideData`)(
  {
    rotation: S.optionalKey(S.Union([S.Finite, S.FiniteFromString])),
  },
  $I.annote("FfprobeSideData", {
    description: "Side-data entry returned by ffprobe for a video stream.",
  })
) {}

/**
 * Video stream metadata returned by `ffprobe`.
 *
 * @example
 * ```ts
 * import { FfprobeStream } from "@beep/repo-cli/commands/Files"
 * console.log(FfprobeStream)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FfprobeStream extends S.Class<FfprobeStream>($I`FfprobeStream`)(
  {
    height: PositiveMediaDimension,
    side_data_list: S.Array(FfprobeSideData).pipe(S.optionalKey),
    tags: S.optionalKey(S.Record(S.String, S.Unknown)),
    width: PositiveMediaDimension,
  },
  $I.annote("FfprobeStream", {
    description: "Video stream metadata returned by ffprobe.",
  })
) {}

/**
 * JSON document emitted by `ffprobe`.
 *
 * @example
 * ```ts
 * import { FfprobeOutput } from "@beep/repo-cli/commands/Files"
 * console.log(FfprobeOutput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FfprobeOutput extends S.Class<FfprobeOutput>($I`FfprobeOutput`)(
  {
    streams: S.Array(FfprobeStream),
  },
  $I.annote("FfprobeOutput", {
    description: "JSON document emitted by ffprobe stream probing.",
  })
) {}

/**
 * Safe generated filename prefix schema.
 *
 * @example
 * ```ts
 * import { SafeFilePrefix } from "@beep/repo-cli/commands/Files"
 * console.log(SafeFilePrefix)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SafeFilePrefix = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(P.not(Str.includes(".")), {
        identifier: $I`SafeFilePrefixNoDotCheck`,
        title: "Safe File Prefix Without Dot",
        description: "A file prefix that does not contain a dot.",
        message: "File prefix must not contain .",
      }),
      S.makeFilter(P.not(Str.includes("/")), {
        identifier: $I`SafeFilePrefixNoPosixSeparatorCheck`,
        title: "Safe File Prefix Without Posix Separator",
        description: "A file prefix that does not contain the POSIX path separator.",
        message: "File prefix must not contain /",
      }),
      S.makeFilter(P.not(Str.includes("\\")), {
        identifier: $I`SafeFilePrefixNoWindowsSeparatorCheck`,
        title: "Safe File Prefix Without Windows Separator",
        description: "A file prefix that does not contain the Windows path separator.",
        message: "File prefix must not contain \\",
      }),
      S.makeFilter(P.not(Str.includes("\0")), {
        identifier: $I`SafeFilePrefixNoNullByteCheck`,
        title: "Safe File Prefix Without Null Byte",
        description: "A file prefix that does not contain an embedded NUL byte.",
        message: "File prefix must not contain embedded NUL bytes",
      }),
    ],
    {
      identifier: $I`SafeFilePrefixChecks`,
      title: "Safe File Prefix",
      description: "Checks for a safe file-name stem used as a generated dataset prefix.",
    }
  )
).pipe(
  $I.annoteSchema("SafeFilePrefix", {
    description: "A non-empty generated file prefix without dots, separators, or embedded NUL bytes.",
  })
);

/**
 * Safe prefix accepted by `files sort-and-rename`.
 *
 * @example
 * ```ts
 * import type { SafeFilePrefix } from "@beep/repo-cli/commands/Files"
 *
 * const prefix: SafeFilePrefix = "dataset-001"
 * console.log(prefix)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SafeFilePrefix = typeof SafeFilePrefix.Type;

/**
 * File discovered for deterministic rename planning.
 *
 * @example
 * ```ts
 * import { SortableFile } from "@beep/repo-cli/commands/Files/index"
 *
 * const file = SortableFile.make({
 *   canonicalPath: "/tmp/images/a.png",
 *   extension: ".png",
 *   name: "a.png",
 *   size: 10n,
 *   sourcePath: "/tmp/images/a.png"
 * })
 * console.log(file.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SortableFile extends S.Class<SortableFile>($I`SortableFile`)(
  {
    canonicalPath: S.String,
    extension: S.String,
    mediaKind: S.Option(MediaKind).pipe(S.withConstructorDefault(Effect.succeed(O.none<MediaKind>()))),
    name: S.String,
    size: S.BigInt,
    sourcePath: S.String,
  },
  $I.annote("SortableFile", {
    description: "A direct regular file selected for size-based rename planning.",
  })
) {}

/**
 * Planned rename from an existing file path to a generated target path.
 *
 * @example
 * ```ts
 * import { RenamePlanEntry } from "@beep/repo-cli/commands/Files"
 * console.log(RenamePlanEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RenamePlanEntry extends S.Class<RenamePlanEntry>($I`RenamePlanEntry`)(
  {
    canonicalSourcePath: S.String,
    dimensions: S.Option(S.suspend(() => MediaDimensions)).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<MediaDimensions>()))
    ),
    extension: S.String,
    index: S.Finite,
    size: S.BigInt,
    sourceName: S.String,
    sourcePath: S.String,
    targetName: S.String,
    targetPath: S.String,
  },
  $I.annote("RenamePlanEntry", {
    description: "A single source-to-target file rename planned by a files operation.",
  })
) {}

/**
 * Summary returned by `sortAndRenameFiles`.
 *
 * @example
 * ```ts
 * import { SortAndRenameSummary } from "@beep/repo-cli/commands/Files"
 * console.log(SortAndRenameSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SortAndRenameSummary extends S.Class<SortAndRenameSummary>($I`SortAndRenameSummary`)(
  {
    directory: S.String,
    dryRun: S.Boolean,
    plannedCount: S.Finite,
    renamedCount: S.Finite,
    skippedCount: S.Finite,
    withDimensions: S.Boolean,
  },
  $I.annote("SortAndRenameSummary", {
    description: "Summary counts for a sort-and-rename file curation run.",
  })
) {}

/**
 * Planned metadata strip for a selected image or video file.
 *
 * @example
 * ```ts
 * import { StripMetadataPlanEntry } from "@beep/repo-cli/commands/Files/index"
 *
 * const entry = StripMetadataPlanEntry.make({
 *   extension: ".jpg",
 *   mediaKind: "image",
 *   size: 10n,
 *   sourceName: "photo.jpg",
 *   sourcePath: "/tmp/dataset/photo.jpg"
 * })
 * console.log(entry.mediaKind)
 * ```
 * @category models
 * @since 0.0.0
 */
export class StripMetadataPlanEntry extends S.Class<StripMetadataPlanEntry>($I`StripMetadataPlanEntry`)(
  {
    extension: S.String,
    mediaKind: MediaKind,
    size: S.BigInt,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("StripMetadataPlanEntry", {
    description: "A direct media file selected for metadata stripping.",
  })
) {}

/**
 * Summary returned by `stripMetadataFiles`.
 *
 * @example
 * ```ts
 * import { StripMetadataSummary } from "@beep/repo-cli/commands/Files"
 * console.log(StripMetadataSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class StripMetadataSummary extends S.Class<StripMetadataSummary>($I`StripMetadataSummary`)(
  {
    directory: S.String,
    dryRun: S.Boolean,
    imageCount: S.Finite,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
    strippedCount: S.Finite,
    videoCount: S.Finite,
  },
  $I.annote("StripMetadataSummary", {
    description: "Summary counts for an image and video metadata stripping run.",
  })
) {}

/**
 * Width and height discovered for an image or video file.
 *
 * @example
 * ```ts
 * import { MediaDimensions } from "@beep/repo-cli/commands/Files/index"
 *
 * const dimensions = MediaDimensions.make({ height: 1024, width: 1536 })
 * console.log(dimensions.width)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MediaDimensions extends S.Class<MediaDimensions>($I`MediaDimensions`)(
  {
    height: PositiveMediaDimension,
    width: PositiveMediaDimension,
  },
  $I.annote("MediaDimensions", {
    description: "Pixel dimensions discovered from an image or video file.",
  })
) {}

/**
 * Options used by caption sidecar creation.
 *
 * @example
 * ```ts
 * import { CreateCaptionFilesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(CreateCaptionFilesOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesOptions extends S.Class<CreateCaptionFilesOptions>($I`CreateCaptionFilesOptions`)(
  {
    caption: S.String.pipe(S.withConstructorDefault(Effect.succeed(""))),
    dir: S.String,
    dryRun: S.Boolean,
    overwrite: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  },
  $I.annote("CreateCaptionFilesOptions", {
    description: "Validated options used by files create-captions.",
  })
) {}

/**
 * Planned caption sidecar file creation.
 *
 * @example
 * ```ts
 * import { CreateCaptionFilesPlanEntry } from "@beep/repo-cli/commands/Files"
 * console.log(CreateCaptionFilesPlanEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesPlanEntry extends S.Class<CreateCaptionFilesPlanEntry>($I`CreateCaptionFilesPlanEntry`)(
  {
    captionName: S.String,
    captionPath: S.String,
    captionRelativePath: S.String,
    extension: S.String,
    overwritesExisting: S.Boolean,
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
  },
  $I.annote("CreateCaptionFilesPlanEntry", {
    description: "A same-stem caption sidecar planned for an image file.",
  })
) {}

/**
 * Source entry skipped by caption sidecar creation.
 *
 * @example
 * ```ts
 * import { CreateCaptionFilesSkippedEntry } from "@beep/repo-cli/commands/Files"
 * console.log(CreateCaptionFilesSkippedEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesSkippedEntry extends S.Class<CreateCaptionFilesSkippedEntry>(
  $I`CreateCaptionFilesSkippedEntry`
)(
  {
    captionName: S.optionalKey(S.String),
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: CreateCaptionFilesSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("CreateCaptionFilesSkippedEntry", {
    description: "A direct source entry skipped by files create-captions with a machine-readable reason.",
  })
) {}

/**
 * Planned caption sidecar creation run.
 *
 * @example
 * ```ts
 * import { CreateCaptionFilesPlan } from "@beep/repo-cli/commands/Files"
 * console.log(CreateCaptionFilesPlan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesPlan extends S.Class<CreateCaptionFilesPlan>($I`CreateCaptionFilesPlan`)(
  {
    caption: S.String,
    directory: S.String,
    entries: S.Array(CreateCaptionFilesPlanEntry),
    overwrite: S.Boolean,
    skipped: S.Array(CreateCaptionFilesSkippedEntry),
  },
  $I.annote("CreateCaptionFilesPlan", {
    description: "Planned caption sidecar entries plus skipped source entries.",
  })
) {}

/**
 * Summary returned by `createCaptionFiles`.
 *
 * @example
 * ```ts
 * import { CreateCaptionFilesSummary } from "@beep/repo-cli/commands/Files"
 * console.log(CreateCaptionFilesSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CreateCaptionFilesSummary extends S.Class<CreateCaptionFilesSummary>($I`CreateCaptionFilesSummary`)(
  {
    createdCount: S.Finite,
    directory: S.String,
    dryRun: S.Boolean,
    overwrittenCount: S.Finite,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("CreateCaptionFilesSummary", {
    description: "Summary counts returned by files create-captions.",
  })
) {}

/**
 * Options used by the image normalization operation.
 *
 * @example
 * ```ts
 * import { NormalizeFilesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeFilesOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeFilesOptions extends S.Class<NormalizeFilesOptions>($I`NormalizeFilesOptions`)(
  {
    dedupe: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    dir: S.String,
    dryRun: S.Boolean,
    format: NormalizeImageFormat,
    manifest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    maxLongEdge: S.Option(PositiveMediaDimension).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PositiveMediaDimension>()))
    ),
    moveDuplicatesTo: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    outDir: S.String,
    overwrite: S.Boolean,
  },
  $I.annote("NormalizeFilesOptions", {
    description: "Validated options used by the image normalization operation.",
  })
) {}

/**
 * Manifest options recorded for an image normalization run.
 *
 * @example
 * ```ts
 * import { NormalizeManifestOptions } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeManifestOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeManifestOptions extends S.Class<NormalizeManifestOptions>($I`NormalizeManifestOptions`)(
  {
    dedupe: S.Boolean,
    format: NormalizeImageFormat,
    maxLongEdge: S.optionalKey(PositiveMediaDimension),
    moveDuplicatesTo: S.optionalKey(S.String),
    overwrite: S.Boolean,
  },
  $I.annote("NormalizeManifestOptions", {
    description: "JSON-safe options recorded in the normalize manifest.",
  })
) {}

/**
 * Planned source-to-output image transform.
 *
 * @example
 * ```ts
 * import { NormalizePlanEntry } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizePlanEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizePlanEntry extends S.Class<NormalizePlanEntry>($I`NormalizePlanEntry`)(
  {
    format: NormalizeImageFormat,
    inputDimensions: MediaDimensions,
    outputDimensions: MediaDimensions,
    outputName: S.String,
    outputHash: S.optionalKey(FileSha256Hash),
    outputPath: S.String,
    outputRelativePath: S.String,
    outputSizeBytes: S.optionalKey(S.String),
    resized: S.Boolean,
    sourceExtension: S.String,
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
    sourceSizeBytes: S.String,
  },
  $I.annote("NormalizePlanEntry", {
    description: "A source-to-output image transform planned by files normalize.",
  })
) {}

/**
 * Source entry skipped by image normalization.
 *
 * @example
 * ```ts
 * import { NormalizeSkippedEntry } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeSkippedEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeSkippedEntry extends S.Class<NormalizeSkippedEntry>($I`NormalizeSkippedEntry`)(
  {
    duplicateOfOutputRelativePath: S.optionalKey(S.String),
    duplicateOfSourceRelativePath: S.optionalKey(S.String),
    duplicateMovedPath: S.optionalKey(S.String),
    duplicateMovedRelativePath: S.optionalKey(S.String),
    extension: S.optionalKey(S.String),
    message: S.String,
    outputHash: S.optionalKey(FileSha256Hash),
    reason: NormalizeSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("NormalizeSkippedEntry", {
    description: "A direct source entry skipped by files normalize with a machine-readable reason.",
  })
) {}

/**
 * Planned image normalization run.
 *
 * @example
 * ```ts
 * import { NormalizePlan } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizePlan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizePlan extends S.Class<NormalizePlan>($I`NormalizePlan`)(
  {
    duplicateDirectory: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    entries: S.Array(NormalizePlanEntry),
    manifestPath: S.String,
    options: NormalizeManifestOptions,
    outputDirectory: S.String,
    skipped: S.Array(NormalizeSkippedEntry),
    sourceDirectory: S.String,
  },
  $I.annote("NormalizePlan", {
    description: "Planned image normalization entries plus skipped source entries.",
  })
) {}

/**
 * Summary counts for an image normalization run.
 *
 * @example
 * ```ts
 * import { NormalizeSummary } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeSummary extends S.Class<NormalizeSummary>($I`NormalizeSummary`)(
  {
    directory: S.String,
    duplicateCount: S.Finite,
    dryRun: S.Boolean,
    format: NormalizeImageFormat,
    manifestPath: S.String,
    manifestWritten: S.Boolean,
    maxLongEdge: S.Option(PositiveMediaDimension).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PositiveMediaDimension>()))
    ),
    movedDuplicateCount: S.Finite,
    normalizedCount: S.Finite,
    outputDirectory: S.String,
    plannedCount: S.Finite,
    resizedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("NormalizeSummary", {
    description: "Summary counts returned by files normalize.",
  })
) {}

/**
 * JSON-safe summary recorded in an image normalization manifest.
 *
 * @example
 * ```ts
 * import { NormalizeManifestSummary } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeManifestSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeManifestSummary extends S.Class<NormalizeManifestSummary>($I`NormalizeManifestSummary`)(
  {
    duplicateCount: S.Finite,
    movedDuplicateCount: S.Finite,
    normalizedCount: S.Finite,
    plannedCount: S.Finite,
    resizedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("NormalizeManifestSummary", {
    description: "JSON-safe summary counts recorded by files normalize.",
  })
) {}

/**
 * Manifest written by a successful image normalization run.
 *
 * @example
 * ```ts
 * import { NormalizeManifest } from "@beep/repo-cli/commands/Files"
 * console.log(NormalizeManifest)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeManifest extends S.Class<NormalizeManifest>($I`NormalizeManifest`)(
  {
    entries: S.Array(NormalizePlanEntry),
    manifestPath: S.String,
    options: NormalizeManifestOptions,
    outputDirectory: S.String,
    schemaVersion: S.Literal("beep.files.normalize.v1"),
    skipped: S.Array(NormalizeSkippedEntry),
    sourceDirectory: S.String,
    summary: NormalizeManifestSummary,
  },
  $I.annote("NormalizeManifest", {
    description: "JSON manifest of source-to-output transforms produced by files normalize.",
  })
) {}

/**
 * Options used by poor-candidate archival.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesOptions extends S.Class<ArchivePoorCandidatesOptions>(
  $I`ArchivePoorCandidatesOptions`
)(
  {
    archiveDir: S.String,
    dir: S.String,
    dryRun: S.Boolean,
    manifest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    maxAspect: CandidateRatioThreshold,
    maxUpscale: CandidateRatioThreshold,
    minShortEdge: PositiveMediaDimension,
    overwrite: S.Boolean,
    profile: CandidateAssessmentProfile,
    sidecars: S.String.pipe(S.withConstructorDefault(Effect.succeed("txt"))),
    targetResolution: PositiveMediaDimension,
  },
  $I.annote("ArchivePoorCandidatesOptions", {
    description: "Validated options used by files archive-poor-candidates.",
  })
) {}

/**
 * JSON-safe options recorded in a poor-candidate archive manifest.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesManifestOptions } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesManifestOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesManifestOptions extends S.Class<ArchivePoorCandidatesManifestOptions>(
  $I`ArchivePoorCandidatesManifestOptions`
)(
  {
    maxAspect: CandidateRatioThreshold,
    maxUpscale: CandidateRatioThreshold,
    minShortEdge: PositiveMediaDimension,
    overwrite: S.Boolean,
    profile: CandidateAssessmentProfile,
    sidecars: S.Array(S.String),
    targetResolution: PositiveMediaDimension,
  },
  $I.annote("ArchivePoorCandidatesManifestOptions", {
    description: "JSON-safe options recorded by files archive-poor-candidates.",
  })
) {}

/**
 * Derived image metrics used for candidate-quality triage.
 *
 * @example
 * ```ts
 * import { CandidateAssessmentMetrics } from "@beep/repo-cli/commands/Files"
 * console.log(CandidateAssessmentMetrics)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CandidateAssessmentMetrics extends S.Class<CandidateAssessmentMetrics>($I`CandidateAssessmentMetrics`)(
  {
    aspectRatio: S.Finite,
    pixelArea: S.Int,
    shortEdge: PositiveMediaDimension,
    upscaleToTarget: S.Finite,
  },
  $I.annote("CandidateAssessmentMetrics", {
    description: "Resolution-derived metrics used to classify image training-data candidates.",
  })
) {}

/**
 * Caption or metadata sidecar moved with an archived image.
 *
 * @example
 * ```ts
 * import { ArchivedSidecarEntry } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivedSidecarEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivedSidecarEntry extends S.Class<ArchivedSidecarEntry>($I`ArchivedSidecarEntry`)(
  {
    archivePath: S.String,
    archiveRelativePath: S.String,
    extension: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
  },
  $I.annote("ArchivedSidecarEntry", {
    description: "A same-stem sidecar file moved with an archived poor image candidate.",
  })
) {}

/**
 * Assessed image candidate with an archive or keep decision.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesEntry } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesEntry extends S.Class<ArchivePoorCandidatesEntry>($I`ArchivePoorCandidatesEntry`)(
  {
    archiveName: S.optionalKey(S.String),
    archivePath: S.optionalKey(S.String),
    archiveRelativePath: S.optionalKey(S.String),
    decision: CandidateAssessmentDecision,
    dimensions: MediaDimensions,
    extension: S.String,
    metrics: CandidateAssessmentMetrics,
    reasons: S.Array(CandidateAssessmentReason),
    sidecars: S.Array(ArchivedSidecarEntry),
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
    sourceSizeBytes: S.String,
  },
  $I.annote("ArchivePoorCandidatesEntry", {
    description: "Image candidate assessed by files archive-poor-candidates.",
  })
) {}

/**
 * Source entry skipped by poor-candidate archival.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesSkippedEntry } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesSkippedEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesSkippedEntry extends S.Class<ArchivePoorCandidatesSkippedEntry>(
  $I`ArchivePoorCandidatesSkippedEntry`
)(
  {
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: ArchivePoorCandidatesSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("ArchivePoorCandidatesSkippedEntry", {
    description: "A direct source entry skipped by files archive-poor-candidates with a machine-readable reason.",
  })
) {}

/**
 * Planned poor-candidate archive run.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesPlan } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesPlan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesPlan extends S.Class<ArchivePoorCandidatesPlan>($I`ArchivePoorCandidatesPlan`)(
  {
    archiveDirectory: S.String,
    entries: S.Array(ArchivePoorCandidatesEntry),
    manifestPath: S.String,
    options: ArchivePoorCandidatesManifestOptions,
    skipped: S.Array(ArchivePoorCandidatesSkippedEntry),
    sourceDirectory: S.String,
  },
  $I.annote("ArchivePoorCandidatesPlan", {
    description: "Planned image candidate archival entries plus skipped source entries.",
  })
) {}

/**
 * Summary counts returned by poor-candidate archival.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesSummary } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesSummary extends S.Class<ArchivePoorCandidatesSummary>(
  $I`ArchivePoorCandidatesSummary`
)(
  {
    archivedCount: S.Finite,
    archiveDirectory: S.String,
    assessedCount: S.Finite,
    directory: S.String,
    dryRun: S.Boolean,
    keptCount: S.Finite,
    manifestPath: S.String,
    manifestWritten: S.Boolean,
    movedSidecarCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("ArchivePoorCandidatesSummary", {
    description: "Summary counts returned by files archive-poor-candidates.",
  })
) {}

/**
 * JSON-safe summary recorded by poor-candidate archival.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesManifestSummary } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesManifestSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesManifestSummary extends S.Class<ArchivePoorCandidatesManifestSummary>(
  $I`ArchivePoorCandidatesManifestSummary`
)(
  {
    archivedCount: S.Finite,
    assessedCount: S.Finite,
    keptCount: S.Finite,
    movedSidecarCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("ArchivePoorCandidatesManifestSummary", {
    description: "JSON-safe summary counts recorded by files archive-poor-candidates.",
  })
) {}

/**
 * Manifest written by a successful poor-candidate archive run.
 *
 * @example
 * ```ts
 * import { ArchivePoorCandidatesManifest } from "@beep/repo-cli/commands/Files"
 * console.log(ArchivePoorCandidatesManifest)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesManifest extends S.Class<ArchivePoorCandidatesManifest>(
  $I`ArchivePoorCandidatesManifest`
)(
  {
    archiveDirectory: S.String,
    entries: S.Array(ArchivePoorCandidatesEntry),
    manifestPath: S.String,
    options: ArchivePoorCandidatesManifestOptions,
    schemaVersion: S.Literal("beep.files.archive-poor-candidates.v1"),
    skipped: S.Array(ArchivePoorCandidatesSkippedEntry),
    sourceDirectory: S.String,
    summary: ArchivePoorCandidatesManifestSummary,
  },
  $I.annote("ArchivePoorCandidatesManifest", {
    description: "JSON manifest of image candidates archived by files archive-poor-candidates.",
  })
) {}

/**
 * Options used by the image border detection operation.
 *
 * @example
 * ```ts
 * import { DetectBordersOptions } from "@beep/repo-cli/commands/Files"
 * console.log(DetectBordersOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectBordersOptions extends S.Class<DetectBordersOptions>($I`DetectBordersOptions`)(
  {
    dir: S.String,
    json: S.Boolean,
    maxScanPct: BorderDetectionMaxScanPercentage,
    minSolidPct: BorderDetectionPercentage,
    minWidthPct: BorderDetectionPercentage,
    tolerance: BorderDetectionTolerance,
  },
  $I.annote("DetectBordersOptions", {
    description: "Validated options used by the solid-border detection operation.",
  })
) {}

/**
 * Options used by the image face detection operation.
 *
 * @example
 * ```ts
 * import { DetectFacesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectFacesOptions extends S.Class<DetectFacesOptions>($I`DetectFacesOptions`)(
  {
    dir: S.String,
    edgeMarginPct: FaceDetectionPercentage,
    json: S.Boolean,
    manifest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    minConfidence: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    modelPath: S.String,
    moveNoFaceTo: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("DetectFacesOptions", {
    description: "Validated options used by the face detection operation.",
  })
) {}

/**
 * JSON-safe options recorded by the image face detection report.
 *
 * @example
 * ```ts
 * import { DetectFacesReportOptions } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesReportOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectFacesReportOptions extends S.Class<DetectFacesReportOptions>($I`DetectFacesReportOptions`)(
  {
    edgeMarginPct: FaceDetectionPercentage,
    json: S.Boolean,
    manifest: S.optionalKey(S.String),
    minConfidence: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    modelPath: S.String,
    moveNoFaceTo: S.optionalKey(S.String),
  },
  $I.annote("DetectFacesReportOptions", {
    description: "JSON-safe options recorded by files detect-faces.",
  })
) {}

/**
 * Options used by the image border cropping operation.
 *
 * @example
 * ```ts
 * import { CropBordersOptions } from "@beep/repo-cli/commands/Files"
 * console.log(CropBordersOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CropBordersOptions extends S.Class<CropBordersOptions>($I`CropBordersOptions`)(
  {
    dir: S.String,
    dryRun: S.Boolean,
    maxScanPct: BorderDetectionMaxScanPercentage,
    minSolidPct: BorderDetectionPercentage,
    minWidthPct: BorderDetectionPercentage,
    tolerance: BorderDetectionTolerance,
  },
  $I.annote("CropBordersOptions", {
    description: "Validated options used by the solid-border crop operation.",
  })
) {}

/**
 * RGB color sampled from a detected image border.
 *
 * @example
 * ```ts
 * import { RgbColor } from "@beep/repo-cli/commands/Files"
 * console.log(RgbColor)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RgbColor extends S.Class<RgbColor>($I`RgbColor`)(
  {
    b: RgbChannel,
    g: RgbChannel,
    r: RgbChannel,
  },
  $I.annote("RgbColor", {
    description: "RGB color sampled from an image border.",
  })
) {}

/**
 * Measurement for one scanned image side.
 *
 * @example
 * ```ts
 * import { DetectBorderSideMeasurement } from "@beep/repo-cli/commands/Files"
 * console.log(DetectBorderSideMeasurement)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectBorderSideMeasurement extends S.Class<DetectBorderSideMeasurement>($I`DetectBorderSideMeasurement`)(
  {
    color: RgbColor,
    colorHex: S.String,
    matched: S.Boolean,
    score: S.Finite,
    side: BorderSide,
    widthPct: S.Finite,
    widthPx: S.Int,
  },
  $I.annote("DetectBorderSideMeasurement", {
    description: "Measured near-solid border width and sampled edge color for one image side.",
  })
) {}

/**
 * Image entry analyzed by `files detect-borders`.
 *
 * @example
 * ```ts
 * import { DetectBordersEntry } from "@beep/repo-cli/commands/Files"
 * console.log(DetectBordersEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectBordersEntry extends S.Class<DetectBordersEntry>($I`DetectBordersEntry`)(
  {
    borderCount: S.Int,
    classification: BorderDetectionKind,
    extension: S.String,
    hasBorder: S.Boolean,
    height: PositiveMediaDimension,
    sides: S.Array(DetectBorderSideMeasurement),
    sourceName: S.String,
    sourcePath: S.String,
    width: PositiveMediaDimension,
  },
  $I.annote("DetectBordersEntry", {
    description: "Image file analyzed for solid or near-solid canvas borders.",
  })
) {}

/**
 * Source entry skipped by image border detection.
 *
 * @example
 * ```ts
 * import { DetectBordersSkippedEntry } from "@beep/repo-cli/commands/Files"
 * console.log(DetectBordersSkippedEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectBordersSkippedEntry extends S.Class<DetectBordersSkippedEntry>($I`DetectBordersSkippedEntry`)(
  {
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: DetectBordersSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("DetectBordersSkippedEntry", {
    description: "A direct source entry skipped by files detect-borders with a machine-readable reason.",
  })
) {}

/**
 * Summary counts for an image border detection run.
 *
 * @example
 * ```ts
 * import { DetectBordersSummary } from "@beep/repo-cli/commands/Files"
 * console.log(DetectBordersSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectBordersSummary extends S.Class<DetectBordersSummary>($I`DetectBordersSummary`)(
  {
    analyzedCount: S.Finite,
    borderedCount: S.Finite,
    directory: S.String,
    skippedCount: S.Finite,
    totalCount: S.Finite,
  },
  $I.annote("DetectBordersSummary", {
    description: "Summary counts returned by files detect-borders.",
  })
) {}

/**
 * JSON report emitted by an image border detection run.
 *
 * @example
 * ```ts
 * import { DetectBordersReport } from "@beep/repo-cli/commands/Files"
 * console.log(DetectBordersReport)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectBordersReport extends S.Class<DetectBordersReport>($I`DetectBordersReport`)(
  {
    directory: S.String,
    entries: S.Array(DetectBordersEntry),
    options: DetectBordersOptions,
    schemaVersion: S.Literal("beep.files.detect-borders.v1"),
    skipped: S.Array(DetectBordersSkippedEntry),
    summary: DetectBordersSummary,
  },
  $I.annote("DetectBordersReport", {
    description: "JSON-safe report of solid-border detection results.",
  })
) {}

/**
 * Image entry analyzed by `files detect-faces`.
 *
 * @example
 * ```ts
 * import { DetectFacesEntry } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectFacesEntry extends S.Class<DetectFacesEntry>($I`DetectFacesEntry`)(
  {
    extension: S.String,
    faceCount: S.Int,
    faces: S.Array(FaceDetection),
    flags: S.Array(DetectFacesFlag),
    hasFace: S.Boolean,
    height: PositiveMediaDimension,
    movedNoFaceName: S.optionalKey(S.String),
    movedNoFacePath: S.optionalKey(S.String),
    movedNoFaceRelativePath: S.optionalKey(S.String),
    primaryFace: S.optionalKey(FaceDetection),
    primaryFaceAreaPct: S.optionalKey(S.Finite),
    sourceName: S.String,
    sourcePath: S.String,
    width: PositiveMediaDimension,
  },
  $I.annote("DetectFacesEntry", {
    description: "Image file analyzed for detectable human faces.",
  })
) {}

/**
 * Source entry skipped by image face detection.
 *
 * @example
 * ```ts
 * import { DetectFacesSkippedEntry } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesSkippedEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectFacesSkippedEntry extends S.Class<DetectFacesSkippedEntry>($I`DetectFacesSkippedEntry`)(
  {
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: DetectFacesSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("DetectFacesSkippedEntry", {
    description: "A direct source entry skipped by files detect-faces with a machine-readable reason.",
  })
) {}

/**
 * Summary counts for an image face detection run.
 *
 * @example
 * ```ts
 * import { DetectFacesSummary } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectFacesSummary extends S.Class<DetectFacesSummary>($I`DetectFacesSummary`)(
  {
    analyzedCount: S.Finite,
    directory: S.String,
    faceImageCount: S.Finite,
    movedNoFaceCount: S.Finite,
    noFaceImageCount: S.Finite,
    reviewImageCount: S.Finite,
    skippedCount: S.Finite,
    totalCount: S.Finite,
  },
  $I.annote("DetectFacesSummary", {
    description: "Summary counts returned by files detect-faces.",
  })
) {}

/**
 * JSON report emitted by an image face detection run.
 *
 * @example
 * ```ts
 * import { DetectFacesReport } from "@beep/repo-cli/commands/Files"
 * console.log(DetectFacesReport)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DetectFacesReport extends S.Class<DetectFacesReport>($I`DetectFacesReport`)(
  {
    directory: S.String,
    entries: S.Array(DetectFacesEntry),
    manifestPath: S.String,
    manifestWritten: S.Boolean,
    options: DetectFacesReportOptions,
    schemaVersion: S.Literal("beep.files.detect-faces.v1"),
    skipped: S.Array(DetectFacesSkippedEntry),
    summary: DetectFacesSummary,
  },
  $I.annote("DetectFacesReport", {
    description: "JSON-safe report of face detection results.",
  })
) {}

/**
 * Planned crop for an image with detected solid borders.
 *
 * @example
 * ```ts
 * import { CropBordersPlanEntry } from "@beep/repo-cli/commands/Files"
 * console.log(CropBordersPlanEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CropBordersPlanEntry extends S.Class<CropBordersPlanEntry>($I`CropBordersPlanEntry`)(
  {
    borderCount: S.Int,
    classification: BorderDetectionKind,
    cropHeight: PositiveMediaDimension,
    cropLeft: NonNegativePixelOffset,
    cropTop: NonNegativePixelOffset,
    cropWidth: PositiveMediaDimension,
    extension: S.String,
    originalHeight: PositiveMediaDimension,
    originalWidth: PositiveMediaDimension,
    sides: S.Array(DetectBorderSideMeasurement),
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("CropBordersPlanEntry", {
    description: "Image crop planned from detected near-solid border measurements.",
  })
) {}

/**
 * Planned border crop entries plus skipped file counts.
 *
 * @example
 * ```ts
 * import { CropBordersPlan } from "@beep/repo-cli/commands/Files"
 * console.log(CropBordersPlan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CropBordersPlan extends S.Class<CropBordersPlan>($I`CropBordersPlan`)(
  {
    analyzedCount: S.Finite,
    borderedCount: S.Finite,
    directory: S.String,
    entries: S.Array(CropBordersPlanEntry),
    skippedCount: S.Finite,
  },
  $I.annote("CropBordersPlan", {
    description: "Planned in-place crops for image files with detected near-solid borders.",
  })
) {}

/**
 * Summary returned by `cropBordersFiles`.
 *
 * @example
 * ```ts
 * import { CropBordersSummary } from "@beep/repo-cli/commands/Files"
 * console.log(CropBordersSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CropBordersSummary extends S.Class<CropBordersSummary>($I`CropBordersSummary`)(
  {
    analyzedCount: S.Finite,
    borderedCount: S.Finite,
    croppedCount: S.Finite,
    directory: S.String,
    dryRun: S.Boolean,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("CropBordersSummary", {
    description: "Summary counts returned by files crop-borders.",
  })
) {}

/**
 * Files selected for rename planning plus skipped file counts.
 *
 * @example
 * ```ts
 * import { SortableFileCollection } from "@beep/repo-cli/commands/Files"
 * console.log(SortableFileCollection)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SortableFileCollection extends S.Class<SortableFileCollection>($I`SortableFileCollection`)(
  {
    files: S.Array(SortableFile),
    skippedCount: S.Finite,
  },
  $I.annote("SortableFileCollection", {
    description: "Files selected for rename planning plus direct regular files skipped by media filtering.",
  })
) {}

/**
 * Planned rename entries plus skipped file counts.
 *
 * @example
 * ```ts
 * import { RenamePlan } from "@beep/repo-cli/commands/Files"
 * console.log(RenamePlan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RenamePlan extends S.Class<RenamePlan>($I`RenamePlan`)(
  {
    entries: S.Array(RenamePlanEntry),
    skippedCount: S.Finite,
  },
  $I.annote("RenamePlan", {
    description: "Planned rename entries plus direct regular files skipped before planning.",
  })
) {}

/**
 * Planned metadata stripping entries plus skipped file counts.
 *
 * @example
 * ```ts
 * import { StripMetadataPlan } from "@beep/repo-cli/commands/Files"
 * console.log(StripMetadataPlan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class StripMetadataPlan extends S.Class<StripMetadataPlan>($I`StripMetadataPlan`)(
  {
    entries: S.Array(StripMetadataPlanEntry),
    imageCount: S.Finite,
    skippedCount: S.Finite,
    videoCount: S.Finite,
  },
  $I.annote("StripMetadataPlan", {
    description: "Planned metadata stripping entries plus direct media files skipped before processing.",
  })
) {}

/**
 * Failure policy for `files process`.
 *
 * @example
 * ```ts
 * import { ProcessFilesFailurePolicy } from "@beep/repo-cli/commands/Files"
 * console.log(ProcessFilesFailurePolicy)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ProcessFilesFailurePolicy = LiteralKit(["continue", "fail-on-error"]).pipe(
  $I.annoteSchema("ProcessFilesFailurePolicy", {
    description: "Controls whether files process returns a failing exit code when source processing records fail.",
  })
);

/**
 * Failure policy for `files process`.
 *
 * @example
 * ```ts
 * import type { ProcessFilesFailurePolicy } from "@beep/repo-cli/commands/Files"
 *
 * const policy: ProcessFilesFailurePolicy = "continue"
 * console.log(policy)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ProcessFilesFailurePolicy = typeof ProcessFilesFailurePolicy.Type;

/**
 * Validated options used by `files process`.
 *
 * @example
 * ```ts
 * import { ProcessFilesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(ProcessFilesOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProcessFilesOptions extends S.Class<ProcessFilesOptions>($I`ProcessFilesOptions`)(
  {
    engine: FileProcessingEngineFamily,
    exportChildren: S.Boolean,
    failurePolicy: ProcessFilesFailurePolicy,
    input: S.String,
    maxMaterializedBytes: S.optionalKey(S.Finite),
    outDir: S.String,
    overwrite: S.Boolean,
  },
  $I.annote("ProcessFilesOptions", {
    description: "Validated options used by files process.",
  })
) {}

/**
 * Summary counts returned by `files process`.
 *
 * @example
 * ```ts
 * import { ProcessFilesSummary } from "@beep/repo-cli/commands/Files"
 * console.log(ProcessFilesSummary)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProcessFilesSummary extends S.Class<ProcessFilesSummary>($I`ProcessFilesSummary`)(
  {
    failedCount: NonNegativeInt,
    skippedCount: NonNegativeInt,
    sourceCount: NonNegativeInt,
    succeededCount: NonNegativeInt,
    textArtifactCount: NonNegativeInt,
  },
  $I.annote("ProcessFilesSummary", {
    description: "Summary counts returned by files process.",
  })
) {}

/**
 * Decode unknown image-size metadata.
 *
 * @example
 * ```ts
 * import { decodeImageSizeMetadata } from "@beep/repo-cli/commands/Files"
 * console.log(decodeImageSizeMetadata)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeImageSizeMetadata = S.decodeUnknownEffect(ImageSizeMetadata);

/**
 * Decode an ffprobe JSON document.
 *
 * @example
 * ```ts
 * import { decodeFfprobeOutputJson } from "@beep/repo-cli/commands/Files"
 * console.log(decodeFfprobeOutputJson)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeFfprobeOutputJson = S.decodeUnknownEffect(S.fromJsonString(FfprobeOutput));

/**
 * Decode an unknown rotation value into an optional number.
 *
 * @example
 * ```ts
 * import { decodeRotationNumber } from "@beep/repo-cli/commands/Files"
 * console.log(decodeRotationNumber)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeRotationNumber = S.decodeUnknownOption(S.Union([S.Finite, S.FiniteFromString]));

/**
 * Decode an unknown safe filename prefix.
 *
 * @example
 * ```ts
 * import { decodeSafeFilePrefix } from "@beep/repo-cli/commands/Files"
 * console.log(decodeSafeFilePrefix)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeSafeFilePrefix = S.decodeUnknownEffect(SafeFilePrefix);

/**
 * Decode an unknown maximum long-edge value.
 *
 * @example
 * ```ts
 * import { decodeNormalizeMaxLongEdge } from "@beep/repo-cli/commands/Files"
 * console.log(decodeNormalizeMaxLongEdge)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeNormalizeMaxLongEdge = S.decodeUnknownEffect(PositiveMediaDimension);

/**
 * Decode unknown poor-candidate archive options.
 *
 * @example
 * ```ts
 * import { decodeArchivePoorCandidatesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(decodeArchivePoorCandidatesOptions)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeArchivePoorCandidatesOptions = S.decodeUnknownEffect(ArchivePoorCandidatesOptions);

/**
 * Decode unknown caption sidecar creation options.
 *
 * @example
 * ```ts
 * import { decodeCreateCaptionFilesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(decodeCreateCaptionFilesOptions)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeCreateCaptionFilesOptions = S.decodeUnknownEffect(CreateCaptionFilesOptions);

/**
 * Decode unknown border detection options.
 *
 * @example
 * ```ts
 * import { decodeDetectBordersOptions } from "@beep/repo-cli/commands/Files"
 * console.log(decodeDetectBordersOptions)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeDetectBordersOptions = S.decodeUnknownEffect(DetectBordersOptions);
/**
 * Decode face detection options from unknown input.
 *
 * @example
 * ```ts
 * import { decodeDetectFacesOptions } from "@beep/repo-cli/commands/Files"
 * console.log(decodeDetectFacesOptions)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const decodeDetectFacesOptions = S.decodeUnknownEffect(DetectFacesOptions);

/**
 * Decode unknown border cropping options.
 *
 * @example
 * ```ts
 * import { decodeCropBordersOptions } from "@beep/repo-cli/commands/Files"
 * console.log(decodeCropBordersOptions)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeCropBordersOptions = S.decodeUnknownEffect(CropBordersOptions);

/**
 * Encode a normalize manifest into its JSON-safe shape.
 *
 * @example
 * ```ts
 * import { encodeNormalizeManifest } from "@beep/repo-cli/commands/Files"
 * console.log(encodeNormalizeManifest)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const encodeNormalizeManifest = S.encodeUnknownEffect(NormalizeManifest);

/**
 * Encode a poor-candidate archive manifest into its JSON-safe shape.
 *
 * @example
 * ```ts
 * import { encodeArchivePoorCandidatesManifest } from "@beep/repo-cli/commands/Files"
 * console.log(encodeArchivePoorCandidatesManifest)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const encodeArchivePoorCandidatesManifest = S.encodeUnknownEffect(ArchivePoorCandidatesManifest);

/**
 * Encode a detect-borders report into its JSON-safe shape.
 *
 * @example
 * ```ts
 * import { encodeDetectBordersReport } from "@beep/repo-cli/commands/Files"
 * console.log(encodeDetectBordersReport)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const encodeDetectBordersReport = S.encodeUnknownEffect(DetectBordersReport);
/**
 * Encode a face detection report into its JSON-safe shape.
 *
 * @example
 * ```ts
 * import { encodeDetectFacesReport } from "@beep/repo-cli/commands/Files"
 * console.log(encodeDetectFacesReport)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeDetectFacesReport = S.encodeUnknownEffect(DetectFacesReport);
