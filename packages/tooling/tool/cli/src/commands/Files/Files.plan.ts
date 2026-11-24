/**
 * Planning helpers for dataset file curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CandidateAssessmentDecision,
  CandidateAssessmentMetrics,
  CandidateAssessmentReason,
  CropBordersPlanEntry,
  MediaDimensions,
  SortableFile,
  StripMetadataPlanEntry,
} from "./Files.schemas.ts";
import type * as Path from "effect/Path";
import type {
  BorderSide,
  DetectBordersEntry,
  NormalizeImageFormat,
  RenamePlanEntry,
  SafeFilePrefix,
} from "./Files.schemas.ts";

const $I = $RepoCliId.create("commands/Files/Files.plan");

/**
 * **Example** (Name a probed photo by index and size)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MediaDimensions, SortableFile, targetNameForEntry } from "@beep/repo-cli/commands/Files"
 * import { TargetNameForEntryOptions } from "@beep/repo-cli/commands/Files/Files.plan"
 *
 * const file = SortableFile.make({
 *   canonicalPath: "/srv/photos/IMG_0042.jpg",
 *   extension: ".jpg",
 *   name: "IMG_0042.jpg",
 *   size: 2_485_760n,
 *   sourcePath: "/srv/photos/IMG_0042.jpg"
 * })
 * const options = TargetNameForEntryOptions.make({
 *   dimensions: MediaDimensions.makeOption({ width: 4032, height: 3024 }),
 *   file,
 *   index: 7,
 *   width: 3
 * })
 *
 * console.log(targetNameForEntry("vacation", options)) // => "vacation_007_4032x3024.jpg"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TargetNameForEntryOptions extends S.Opaque<TargetNameForEntryOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    dimensions: S.Option(MediaDimensions),
    dateCreated: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    file: SortableFile,
    hash: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    index: S.Finite,
    withAspectRatio: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    withDimensions: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    withSizeMb: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    width: S.Finite,
  }).pipe(
    $I.annoteSchema("TargetNameForEntryOptions", {
      description: "Inputs used to build a generated target filename for a sortable file.",
    })
  )
) {}

class StripMetadataTempEntry extends S.Opaque<StripMetadataTempEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    entry: StripMetadataPlanEntry,
    tempPath: S.String,
  }).pipe(
    $I.annoteSchema("StripMetadataTempEntry", {
      description: "Metadata stripping plan entry paired with its temporary output path.",
    })
  )
) {}

/**
 * **Example** (Archive a thumbnail below the short-edge floor)
 *
 * ```ts
 * import { assessImageCandidate, MediaDimensions } from "@beep/repo-cli/commands/Files"
 * import { CandidateAssessmentThresholds } from "@beep/repo-cli/commands/Files/Files.plan"
 *
 * const thresholds = CandidateAssessmentThresholds.make({
 *   maxAspect: 3,
 *   maxUpscale: 2,
 *   minShortEdge: 512,
 *   targetResolution: 1024
 * })
 * const result = assessImageCandidate(MediaDimensions.make({ width: 320, height: 240 }), thresholds)
 *
 * console.log(result.decision) // => "archive"
 * console.log(result.reasons) // => ["short-edge-too-small", "upscale-too-large"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateAssessmentThresholds extends S.Opaque<
  CandidateAssessmentThresholds,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    maxAspect: S.Finite,
    maxUpscale: S.Finite,
    minShortEdge: S.Finite,
    targetResolution: S.Finite,
  }).pipe(
    $I.annoteSchema("CandidateAssessmentThresholds", {
      description: "Hard thresholds used to assess image candidate quality.",
    })
  )
) {}

class CandidateAssessmentResult extends S.Opaque<CandidateAssessmentResult, { readonly brand: unique symbol }>()(
  S.Struct({
    decision: CandidateAssessmentDecision,
    metrics: CandidateAssessmentMetrics,
    reasons: S.Array(CandidateAssessmentReason),
  }).pipe(
    $I.annoteSchema("CandidateAssessmentResult", {
      description: "Candidate-quality decision with metrics and hard-threshold reasons.",
    })
  )
) {}

/**
 * Format a zero-padded numeric index.
 *
 * **Example** (Zero-padded index format)
 *
 * ```ts
 * import { formatIndex } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof formatIndex = formatIndex
 * ```
 *
 * @param index - Numeric index to format.
 * @param width - Minimum output width.
 * @returns Zero-padded index text.
 * @category utilities
 * @since 0.0.0
 */
export const formatIndex: {
  (width: number): (index: number) => string;
  (index: number, width: number): string;
} = dual(2, (index: number, width: number): string => pipe(`${index}`, Str.padStart(width, "0")));

/**
 * Build a generated filename for a planned rename.
 *
 * **Example** (Generated rename filename)
 *
 * ```ts
 * import { targetNameForEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof targetNameForEntry = targetNameForEntry
 * ```
 *
 * @param prefix - Safe generated filename prefix.
 * @param options - Source file, index, width, and optional probed dimensions.
 * @returns Generated target name.
 * @category utilities
 * @since 0.0.0
 */
export const targetNameForEntry: {
  (options: TargetNameForEntryOptions): (prefix: SafeFilePrefix) => string;
  (prefix: SafeFilePrefix, options: TargetNameForEntryOptions): string;
} = dual(2, (prefix: SafeFilePrefix, options: TargetNameForEntryOptions): string => {
  const { dateCreated, dimensions, file, hash, index, width, withAspectRatio, withDimensions, withSizeMb } =
    TargetNameForEntryOptions.make(options);
  const formattedIndex = formatIndex(index, width);
  const parts = [`${prefix}`, formattedIndex];
  if (O.isSome(dateCreated)) parts.push(dateCreated.value);
  if (O.isSome(dimensions)) {
    if (withDimensions) parts.push(`${dimensions.value.width}x${dimensions.value.height}`);
    if (withAspectRatio) {
      const divisor = greatestCommonDivisor(dimensions.value.width, dimensions.value.height);
      parts.push(`ar${dimensions.value.width / divisor}x${dimensions.value.height / divisor}`);
    }
  }
  if (withSizeMb) {
    const hundredths = (file.size * BigInt(100) + BigInt(500_000)) / BigInt(1_000_000);
    parts.push(`${hundredths / BigInt(100)}.${pipe(`${hundredths % BigInt(100)}`, Str.padStart(2, "0"))}MB`);
  }
  if (O.isSome(hash)) parts.push(`sha256-${hash.value}`);
  return `${A.join(parts, "_")}${file.extension}`;
});

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = left;
  let b = right;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};

/**
 * Check whether a plan skipped any files.
 *
 * **Example** (Positive skipped count check)
 *
 * ```ts
 * import { hasSkippedFiles } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof hasSkippedFiles = hasSkippedFiles
 * ```
 *
 * @param skippedCount - Number of skipped files.
 * @returns Whether the skipped count is positive.
 * @category utilities
 * @since 0.0.0
 */
export const hasSkippedFiles = (skippedCount: number): boolean => skippedCount > 0;

/**
 * Build a hash set of selected canonical source paths.
 *
 * **Example** (Canonical path hash set)
 *
 * ```ts
 * import { selectedCanonicalPathSet } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof selectedCanonicalPathSet = selectedCanonicalPathSet
 * ```
 *
 * @param plan - Rename plan entries.
 * @returns Hash set of canonical source paths.
 * @category utilities
 * @since 0.0.0
 */
export const selectedCanonicalPathSet = (plan: ReadonlyArray<RenamePlanEntry>): HashSet.HashSet<string> => {
  let selected = HashSet.empty<string>();
  for (const entry of plan) {
    selected = HashSet.add(selected, entry.canonicalSourcePath);
  }
  return selected;
};

/**
 * Allocate a unique normalize output name for a source stem and format.
 *
 * **Example** (Unique normalize target name)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet";
 * import { uniqueNormalizeTargetName } from "../../src/commands/Files/Files.plan.ts"
 *
 * const targetName = uniqueNormalizeTargetName("image", "png", HashSet.empty())
 * ```
 *
 * @param stem - Source file stem.
 * @param format - Normalize output format.
 * @param usedTargetNames - Names already allocated in this plan.
 * @returns Target name plus the updated allocation set.
 * @category utilities
 * @since 0.0.0
 */
export const uniqueNormalizeTargetName: {
  (format: NormalizeImageFormat, usedTargetNames: HashSet.HashSet<string>): (stem: string) => string;
  (stem: string, format: NormalizeImageFormat, usedTargetNames: HashSet.HashSet<string>): string;
} = dual(3, (stem: string, format: NormalizeImageFormat, usedTargetNames: HashSet.HashSet<string>): string => {
  const extension = `.${format}`;
  let suffix = 0;
  let targetName = `${stem}${extension}`;

  while (HashSet.has(usedTargetNames, targetName)) {
    suffix += 1;
    targetName = `${stem}_${formatIndex(suffix, 2)}${extension}`;
  }

  return targetName;
});

/**
 * Allocate a unique archive output name for a source stem and extension.
 *
 * **Example** (Unique archive target name)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet";
 * import { uniqueArchiveTargetName } from "../../src/commands/Files/Files.plan.ts"
 *
 * const targetName = uniqueArchiveTargetName("image", ".jpg", HashSet.empty())
 * ```
 *
 * @param stem - Source file stem.
 * @param extension - Source extension, including the leading dot.
 * @param usedTargetNames - Names already allocated in this plan.
 * @returns Target name plus the updated allocation set.
 * @category utilities
 * @since 0.0.0
 */
export const uniqueArchiveTargetName: {
  (extension: string, usedTargetNames: HashSet.HashSet<string>): (stem: string) => string;
  (stem: string, extension: string, usedTargetNames: HashSet.HashSet<string>): string;
} = dual(3, (stem: string, extension: string, usedTargetNames: HashSet.HashSet<string>): string => {
  let suffix = 0;
  let targetName = `${stem}${extension}`;

  while (HashSet.has(usedTargetNames, targetName)) {
    suffix += 1;
    targetName = `${stem}_${formatIndex(suffix, 2)}${extension}`;
  }

  return targetName;
});

/**
 * Round a candidate assessment metric for stable manifest output.
 *
 * **Example** (Four-decimal metric rounding)
 *
 * ```ts
 * import { roundCandidateMetric } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof roundCandidateMetric = roundCandidateMetric
 * ```
 *
 * @param value - Numeric metric to round.
 * @returns Metric rounded to four decimal places.
 * @category utilities
 * @since 0.0.0
 */
export const roundCandidateMetric = (value: number): number => Math.round(value * 10_000) / 10_000;

/**
 * Assess image dimensions against hard candidate-quality thresholds.
 *
 * **Example** (Image candidate quality assess)
 *
 * ```ts
 * import { assessImageCandidate } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof assessImageCandidate = assessImageCandidate
 * ```
 *
 * @param dimensions - Probed image dimensions after orientation handling.
 * @param thresholds - Hard candidate-quality thresholds.
 * @returns Candidate decision, reasons, and derived metrics.
 * @category utilities
 * @since 0.0.0
 */
export const assessImageCandidate: {
  (thresholds: CandidateAssessmentThresholds): (dimensions: MediaDimensions) => CandidateAssessmentResult;
  (dimensions: MediaDimensions, thresholds: CandidateAssessmentThresholds): CandidateAssessmentResult;
} = dual(2, (dimensions: MediaDimensions, thresholds: CandidateAssessmentThresholds): CandidateAssessmentResult => {
  const candidateThresholds = CandidateAssessmentThresholds.make(thresholds);
  const shortEdge = Math.min(dimensions.width, dimensions.height);
  const longEdge = Math.max(dimensions.width, dimensions.height);
  const pixelArea = dimensions.width * dimensions.height;
  const aspectRatio = longEdge / shortEdge;
  const targetArea = candidateThresholds.targetResolution * candidateThresholds.targetResolution;
  const upscaleToTarget = pixelArea >= targetArea ? 1 : Math.sqrt(targetArea / pixelArea);
  let reasons = A.empty<CandidateAssessmentReason>();

  if (shortEdge < candidateThresholds.minShortEdge) {
    reasons = A.append(reasons, "short-edge-too-small");
  }

  if (aspectRatio > candidateThresholds.maxAspect) {
    reasons = A.append(reasons, "extreme-aspect-ratio");
  }

  if (upscaleToTarget > candidateThresholds.maxUpscale) {
    reasons = A.append(reasons, "upscale-too-large");
  }

  return CandidateAssessmentResult.make({
    decision: A.isReadonlyArrayNonEmpty(reasons) ? "archive" : "keep",
    metrics: CandidateAssessmentMetrics.make({
      aspectRatio: roundCandidateMetric(aspectRatio),
      pixelArea,
      shortEdge,
      upscaleToTarget: roundCandidateMetric(upscaleToTarget),
    }),
    reasons,
  });
});

const borderWidthForSide = (entry: DetectBordersEntry, side: BorderSide): number =>
  pipe(
    entry.sides,
    A.findFirst((measurement) => measurement.side === side),
    O.filter((measurement) => measurement.matched),
    O.map((measurement) => measurement.widthPx),
    O.getOrElse(() => 0)
  );

/**
 * Convert a detected-border entry into a valid crop plan entry.
 *
 * **Example** (Border detection to crop plan)
 *
 * ```ts
 * import { cropBordersPlanEntryFromDetection } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof cropBordersPlanEntryFromDetection = cropBordersPlanEntryFromDetection
 * ```
 *
 * @param entry - Detection result with one or more matched border sides.
 * @returns Crop plan entry when the detected borders leave positive image dimensions.
 * @category utilities
 * @since 0.0.0
 */
export const cropBordersPlanEntryFromDetection = (entry: DetectBordersEntry): O.Option<CropBordersPlanEntry> => {
  const cropLeft = borderWidthForSide(entry, "left");
  const cropTop = borderWidthForSide(entry, "top");
  const cropRight = borderWidthForSide(entry, "right");
  const cropBottom = borderWidthForSide(entry, "bottom");
  const cropWidth = entry.width - cropLeft - cropRight;
  const cropHeight = entry.height - cropTop - cropBottom;

  if (cropWidth < 1 || cropHeight < 1) {
    return O.none();
  }

  return CropBordersPlanEntry.makeOption({
    borderCount: entry.borderCount,
    classification: entry.classification,
    cropHeight,
    cropLeft,
    cropTop,
    cropWidth,
    extension: entry.extension,
    originalHeight: entry.height,
    originalWidth: entry.width,
    sides: entry.sides,
    sourceName: entry.sourceName,
    sourcePath: entry.sourcePath,
  });
};

/**
 * Build temporary output paths for metadata stripping.
 *
 * **Example** (Metadata strip temp paths)
 *
 * ```ts
 * import { makeStripMetadataTempEntries } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof makeStripMetadataTempEntries = makeStripMetadataTempEntries
 * ```
 *
 * @param tempDir - Temporary working directory.
 * @param plan - Files scheduled for metadata-safe staged rewrites.
 * @param path - Platform path service.
 * @returns Source entries paired with temporary output paths.
 * @category utilities
 * @since 0.0.0
 */
export const makeStripMetadataTempEntries: {
  (
    plan: ReadonlyArray<StripMetadataPlanEntry>,
    path: Path.Path
  ): (tempDir: string) => ReadonlyArray<StripMetadataTempEntry>;
  (
    tempDir: string,
    plan: ReadonlyArray<StripMetadataPlanEntry>,
    path: Path.Path
  ): ReadonlyArray<StripMetadataTempEntry>;
} = dual(3, (tempDir: string, plan: ReadonlyArray<StripMetadataPlanEntry>, path: Path.Path) =>
  A.map(plan, (entry, index) =>
    StripMetadataTempEntry.make({
      entry,
      tempPath: path.join(tempDir, `${formatIndex(index, Str.length(`${A.length(plan)}`) + 1)}-${entry.sourceName}`),
    })
  )
);
