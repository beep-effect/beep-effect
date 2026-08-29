/**
 * Planning helpers for dataset file curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { HashSet, pipe } from "effect";
import { dual } from "effect/Function";
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
import type { Path } from "effect";
import type {
  BorderSide,
  DetectBordersEntry,
  NormalizeImageFormat,
  RenamePlanEntry,
  SafeFilePrefix,
} from "./Files.schemas.ts";

const $I = $RepoCliId.create("commands/Files/Files.plan");

class TargetNameForEntryOptions extends S.Class<TargetNameForEntryOptions>($I`TargetNameForEntryOptions`)(
  {
    dimensions: S.Option(MediaDimensions),
    file: SortableFile,
    index: S.Finite,
    width: S.Finite,
  },
  $I.annote("TargetNameForEntryOptions", {
    description: "Inputs used to build a generated target filename for a sortable file.",
  })
) {}

class StripMetadataTempEntry extends S.Class<StripMetadataTempEntry>($I`StripMetadataTempEntry`)(
  {
    entry: StripMetadataPlanEntry,
    tempPath: S.String,
  },
  $I.annote("StripMetadataTempEntry", {
    description: "Metadata stripping plan entry paired with its temporary output path.",
  })
) {}

class CandidateAssessmentThresholds extends S.Class<CandidateAssessmentThresholds>($I`CandidateAssessmentThresholds`)(
  {
    maxAspect: S.Finite,
    maxUpscale: S.Finite,
    minShortEdge: S.Finite,
    targetResolution: S.Finite,
  },
  $I.annote("CandidateAssessmentThresholds", {
    description: "Hard thresholds used to assess image candidate quality.",
  })
) {}

class CandidateAssessmentResult extends S.Class<CandidateAssessmentResult>($I`CandidateAssessmentResult`)(
  {
    decision: CandidateAssessmentDecision,
    metrics: CandidateAssessmentMetrics,
    reasons: S.Array(CandidateAssessmentReason),
  },
  $I.annote("CandidateAssessmentResult", {
    description: "Candidate-quality decision with metrics and hard-threshold reasons.",
  })
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
  const { dimensions, file, index, width } = TargetNameForEntryOptions.make(options);
  const formattedIndex = formatIndex(index, width);
  return pipe(
    dimensions,
    O.match({
      onNone: () => `${prefix}_${formattedIndex}${file.extension}`,
      onSome: (mediaDimensions) =>
        `${prefix}_${formattedIndex}_${mediaDimensions.width}x${mediaDimensions.height}${file.extension}`,
    })
  );
});

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
 * import { HashSet } from "effect"
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
 * import { HashSet } from "effect"
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

  return O.some(
    CropBordersPlanEntry.make({
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
    })
  );
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
