/**
 * Media classification and geometry helpers for dataset file curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ImageFileExtension, VideoFileExtension } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, flow, Order, pipe, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  assessImageCandidate as assessImageCandidateImpl,
  cropBordersPlanEntryFromDetection as cropBordersPlanEntryFromDetectionImpl,
  formatIndex as formatIndexImpl,
  hasSkippedFiles as hasSkippedFilesImpl,
  makeStripMetadataTempEntries as makeStripMetadataTempEntriesImpl,
  roundCandidateMetric as roundCandidateMetricImpl,
  selectedCanonicalPathSet as selectedCanonicalPathSetImpl,
  targetNameForEntry as targetNameForEntryImpl,
} from "./Files.plan.ts";
import {
  renderArchivePoorCandidatesEntry as renderArchivePoorCandidatesEntryImpl,
  renderArchivePoorCandidatesSkippedEntry as renderArchivePoorCandidatesSkippedEntryImpl,
  renderCreateCaptionFilesPlanEntry as renderCreateCaptionFilesPlanEntryImpl,
  renderCreateCaptionFilesSkippedEntry as renderCreateCaptionFilesSkippedEntryImpl,
  renderCropBordersPlanEntry as renderCropBordersPlanEntryImpl,
  renderDetectBordersEntry as renderDetectBordersEntryImpl,
  renderDetectBordersSkippedEntry as renderDetectBordersSkippedEntryImpl,
  renderDetectFacesEntry as renderDetectFacesEntryImpl,
  renderDetectFacesSkippedEntry as renderDetectFacesSkippedEntryImpl,
  renderNormalizePlanEntry as renderNormalizePlanEntryImpl,
  renderNormalizeSkippedEntry as renderNormalizeSkippedEntryImpl,
  renderPlanEntry as renderPlanEntryImpl,
  renderStripMetadataPlanEntry as renderStripMetadataPlanEntryImpl,
} from "./Files.render.ts";
import { decodeRotationNumber, MediaDimensions, SupportedMetadataImageExtension } from "./Files.schemas.ts";
import {
  analyzeSolidBorders as analyzeSolidBordersImpl,
  classifyBorderSides as classifyBorderSidesImpl,
  rgbToHex as rgbToHexImpl,
} from "./internal/BorderDetection.ts";
import type * as Ordering from "effect/Ordering";
import type { FfprobeStream, MediaKind, NormalizeImageFormat, SortableFile } from "./Files.schemas.ts";

/**
 * Analyze raw image pixels for solid borders.
 *
 * **Example** (Analyze solid image borders)
 *
 * ```ts
 * import { analyzeSolidBorders } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof analyzeSolidBorders = analyzeSolidBorders
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const analyzeSolidBorders = analyzeSolidBordersImpl;

/**
 * Classify a set of matched border sides.
 *
 * **Example** (Classify matched border sides)
 *
 * ```ts
 * import { classifyBorderSides } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof classifyBorderSides = classifyBorderSides
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const classifyBorderSides = classifyBorderSidesImpl;

/**
 * Render an RGB color as a lowercase hex string.
 *
 * **Example** (Convert RGB to hex)
 *
 * ```ts
 * import { rgbToHex } from "@beep/repo-cli/commands/Files"
 *
 * const color = rgbToHex({ b: 0, g: 128, r: 255 })
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rgbToHex = rgbToHexImpl;

/**
 * Assess image dimensions against archive-candidate thresholds.
 *
 * **Example** (Assess archive image candidate)
 *
 * ```ts
 * import { assessImageCandidate } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof assessImageCandidate = assessImageCandidate
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const assessImageCandidate = assessImageCandidateImpl;

/**
 * Convert a border detection entry into a crop plan entry.
 *
 * **Example** (Convert detection to crop plan)
 *
 * ```ts
 * import { cropBordersPlanEntryFromDetection } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof cropBordersPlanEntryFromDetection = cropBordersPlanEntryFromDetection
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const cropBordersPlanEntryFromDetection = cropBordersPlanEntryFromDetectionImpl;

/**
 * Format a zero-padded index.
 *
 * **Example** (Format zero-padded index)
 *
 * ```ts
 * import { formatIndex } from "@beep/repo-cli/commands/Files"
 *
 * const text = formatIndex(7, 3)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatIndex = formatIndexImpl;

/**
 * Check whether a command skipped any files.
 *
 * **Example** (Check for skipped files)
 *
 * ```ts
 * import { hasSkippedFiles } from "@beep/repo-cli/commands/Files"
 *
 * const skipped = hasSkippedFiles(2)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hasSkippedFiles = hasSkippedFilesImpl;

/**
 * Build temporary metadata-strip output paths.
 *
 * **Example** (Build metadata strip temp paths)
 *
 * ```ts
 * import { makeStripMetadataTempEntries } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof makeStripMetadataTempEntries = makeStripMetadataTempEntries
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeStripMetadataTempEntries = makeStripMetadataTempEntriesImpl;

/**
 * Round an archive-candidate metric for stable manifests.
 *
 * **Example** (Round archive candidate metric)
 *
 * ```ts
 * import { roundCandidateMetric } from "@beep/repo-cli/commands/Files"
 *
 * const metric = roundCandidateMetric(1.23456)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const roundCandidateMetric = roundCandidateMetricImpl;

/**
 * Build the canonical source path set selected by a rename plan.
 *
 * **Example** (Build selected canonical path set)
 *
 * ```ts
 * import { selectedCanonicalPathSet } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof selectedCanonicalPathSet = selectedCanonicalPathSet
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const selectedCanonicalPathSet = selectedCanonicalPathSetImpl;

/**
 * Build a generated target filename for a sortable file.
 *
 * **Example** (Build generated target filename)
 *
 * ```ts
 * import { targetNameForEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof targetNameForEntry = targetNameForEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const targetNameForEntry = targetNameForEntryImpl;

/**
 * Render a rename plan entry.
 *
 * **Example** (Render rename plan entry)
 *
 * ```ts
 * import { renderPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderPlanEntry = renderPlanEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderPlanEntry = renderPlanEntryImpl;

/**
 * Render a metadata-strip plan entry.
 *
 * **Example** (Render metadata strip plan entry)
 *
 * ```ts
 * import { renderStripMetadataPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderStripMetadataPlanEntry = renderStripMetadataPlanEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderStripMetadataPlanEntry = renderStripMetadataPlanEntryImpl;

/**
 * Render a caption sidecar creation plan entry.
 *
 * **Example** (Render caption creation plan entry)
 *
 * ```ts
 * import { renderCreateCaptionFilesPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderCreateCaptionFilesPlanEntry = renderCreateCaptionFilesPlanEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderCreateCaptionFilesPlanEntry = renderCreateCaptionFilesPlanEntryImpl;

/**
 * Render a skipped caption sidecar source entry.
 *
 * **Example** (Render skipped caption source entry)
 *
 * ```ts
 * import { renderCreateCaptionFilesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderCreateCaptionFilesSkippedEntry = renderCreateCaptionFilesSkippedEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderCreateCaptionFilesSkippedEntry = renderCreateCaptionFilesSkippedEntryImpl;

/**
 * Render a normalize plan entry.
 *
 * **Example** (Render normalize plan entry)
 *
 * ```ts
 * import { renderNormalizePlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderNormalizePlanEntry = renderNormalizePlanEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderNormalizePlanEntry = renderNormalizePlanEntryImpl;

/**
 * Render a skipped normalize source entry.
 *
 * **Example** (Render skipped normalize entry)
 *
 * ```ts
 * import { renderNormalizeSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderNormalizeSkippedEntry = renderNormalizeSkippedEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderNormalizeSkippedEntry = renderNormalizeSkippedEntryImpl;

/**
 * Render an archive-candidate plan entry.
 *
 * **Example** (Render archive candidate plan entry)
 *
 * ```ts
 * import { renderArchivePoorCandidatesEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderArchivePoorCandidatesEntry = renderArchivePoorCandidatesEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderArchivePoorCandidatesEntry = renderArchivePoorCandidatesEntryImpl;

/**
 * Render a skipped archive-candidate source entry.
 *
 * **Example** (Render skipped archive candidate entry)
 *
 * ```ts
 * import { renderArchivePoorCandidatesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderArchivePoorCandidatesSkippedEntry = renderArchivePoorCandidatesSkippedEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderArchivePoorCandidatesSkippedEntry = renderArchivePoorCandidatesSkippedEntryImpl;

/**
 * Render a positive border-detection report entry.
 *
 * **Example** (Render border detection report entry)
 *
 * ```ts
 * import { renderDetectBordersEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectBordersEntry = renderDetectBordersEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectBordersEntry = renderDetectBordersEntryImpl;

/**
 * Render a skipped border-detection source entry.
 *
 * **Example** (Render skipped border detection entry)
 *
 * ```ts
 * import { renderDetectBordersSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectBordersSkippedEntry = renderDetectBordersSkippedEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectBordersSkippedEntry = renderDetectBordersSkippedEntryImpl;

/**
 * Render a face-detection report entry.
 *
 * **Example** (Render face detection report entry)
 *
 * ```ts
 * import { renderDetectFacesEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectFacesEntry = renderDetectFacesEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectFacesEntry = renderDetectFacesEntryImpl;

/**
 * Render a skipped face-detection source entry.
 *
 * **Example** (Render skipped face detection entry)
 *
 * ```ts
 * import { renderDetectFacesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectFacesSkippedEntry = renderDetectFacesSkippedEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectFacesSkippedEntry = renderDetectFacesSkippedEntryImpl;

/**
 * Render a border crop plan entry.
 *
 * **Example** (Render border crop plan entry)
 *
 * ```ts
 * import { renderCropBordersPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderCropBordersPlanEntry = renderCropBordersPlanEntry
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderCropBordersPlanEntry = renderCropBordersPlanEntryImpl;

/**
 * Schema-derived image extension guard.
 *
 * **Example** (Guard image file extensions)
 *
 * ```ts
 * import { isImageFileExtension } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof isImageFileExtension = isImageFileExtension
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isImageFileExtension = S.is(ImageFileExtension);

/**
 * Schema-derived video extension guard.
 *
 * **Example** (Guard video file extensions)
 *
 * ```ts
 * import { isVideoFileExtension } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof isVideoFileExtension = isVideoFileExtension
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isVideoFileExtension = S.is(VideoFileExtension);

/**
 * Schema-derived metadata-strip image extension guard.
 *
 * **Example** (Guard metadata image extensions)
 *
 * ```ts
 * import { isSupportedMetadataImageExtension } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof isSupportedMetadataImageExtension = isSupportedMetadataImageExtension
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isSupportedMetadataImageExtension = S.is(SupportedMetadataImageExtension);

/**
 * Order regular files by size descending, then name ascending.
 *
 * **Example** (Sort files by size then name)
 *
 * ```ts
 * import { bySizeDescendingThenNameAscending } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof bySizeDescendingThenNameAscending = bySizeDescendingThenNameAscending
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const bySizeDescendingThenNameAscending: {
  (that: SortableFile): (self: SortableFile) => Ordering.Ordering;
  (self: SortableFile, that: SortableFile): Ordering.Ordering;
} = dual(
  2,
  Order.combine(
    Order.flip(Order.mapInput(Order.BigInt, (file: SortableFile) => file.size)),
    Order.mapInput(Str.orderAsc, (file: SortableFile) => file.name)
  )
);

/**
 * Order regular files by name ascending.
 *
 * **Example** (Sort files by name ascending)
 *
 * ```ts
 * import { byNameAscending } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof byNameAscending = byNameAscending
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byNameAscending: {
  (that: SortableFile): (self: SortableFile) => Ordering.Ordering;
  (self: SortableFile, that: SortableFile): Ordering.Ordering;
} = dual(
  2,
  Order.mapInput(Str.orderAsc, (file: SortableFile) => file.name)
);

/**
 * Normalize a file extension to a lowercase bare extension.
 *
 * **Example** (Normalize bare file extension)
 *
 * ```ts
 * import { normalizeBareExtension } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof normalizeBareExtension = normalizeBareExtension
 * ```
 *
 * @param extension - File extension with or without a leading dot.
 * @returns Lowercase extension without a leading dot.
 * @category utilities
 * @since 0.0.0
 */
export const normalizeBareExtension: (extension: string) => string = flow(Str.replace(/^\./, ""), Str.toLowerCase);

/**
 * Resolve a media kind from a file extension.
 *
 * **Example** (Resolve media kind from extension)
 *
 * ```ts
 * import { mediaKindFromExtension } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof mediaKindFromExtension = mediaKindFromExtension
 * ```
 *
 * @param extension - File extension with or without a leading dot.
 * @returns Optional media kind for recognized image or video extensions.
 * @category utilities
 * @since 0.0.0
 */
export const mediaKindFromExtension = (extension: string): O.Option<MediaKind> => {
  const bareExtension = normalizeBareExtension(extension);

  if (isImageFileExtension(bareExtension)) {
    return O.some("image");
  }

  if (isVideoFileExtension(bareExtension)) {
    return O.some("video");
  }

  return O.none();
};

/**
 * Collect a byte stream into trimmed text.
 *
 * **Example** (Collect stream into trimmed text)
 *
 * ```ts
 * import { collectText } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof collectText = collectText
 * ```
 *
 * @param stream - Byte stream to decode.
 * @returns Decoded trimmed text effect.
 * @category utilities
 * @since 0.0.0
 */
export const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (acc, chunk) => `${acc}${chunk}`
    ),
    Effect.map(Str.trim)
  );

/**
 * Check whether an EXIF orientation value implies a quarter-turn image.
 *
 * **Example** (Check EXIF quarter-turn orientation)
 *
 * ```ts
 * import { isExifOrientationRotated } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof isExifOrientationRotated = isExifOrientationRotated
 * ```
 *
 * @param orientation - EXIF orientation value.
 * @returns Whether dimensions should be swapped.
 * @category utilities
 * @since 0.0.0
 */
export const isExifOrientationRotated = (orientation: number): boolean => A.contains([5, 6, 7, 8], orientation);

/**
 * Check whether a video rotation value implies a quarter-turn image.
 *
 * **Example** (Check video quarter-turn rotation)
 *
 * ```ts
 * import { isQuarterTurnRotation } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof isQuarterTurnRotation = isQuarterTurnRotation
 * ```
 *
 * @param rotation - Rotation degrees.
 * @returns Whether dimensions should be swapped.
 * @category utilities
 * @since 0.0.0
 */
export const isQuarterTurnRotation = (rotation: number): boolean => {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized === 90 || normalized === 270;
};

/**
 * Swap dimensions when a media orientation requires it.
 *
 * **Example** (Swap dimensions when needed)
 *
 * ```ts
 * import { maybeSwapDimensions } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof maybeSwapDimensions = maybeSwapDimensions
 * ```
 *
 * @param dimensions - Original media dimensions.
 * @param swap - Whether to swap width and height.
 * @returns Original or swapped dimensions.
 * @category utilities
 * @since 0.0.0
 */
export const maybeSwapDimensions: {
  (swap: boolean): (dimensions: MediaDimensions) => MediaDimensions;
  (dimensions: MediaDimensions, swap: boolean): MediaDimensions;
} = dual(
  2,
  (dimensions: MediaDimensions, swap: boolean): MediaDimensions =>
    swap
      ? MediaDimensions.make({
          height: dimensions.width,
          width: dimensions.height,
        })
      : dimensions
);

/**
 * Resolve rotation metadata from an ffprobe stream.
 *
 * **Example** (Resolve rotation from ffprobe stream)
 *
 * ```ts
 * import { rotationFromStream } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof rotationFromStream = rotationFromStream
 * ```
 *
 * @param stream - ffprobe stream metadata.
 * @returns Optional rotation value.
 * @category utilities
 * @since 0.0.0
 */
export const rotationFromStream = (stream: FfprobeStream): O.Option<number> => {
  const sideDataRotation = pipe(
    O.fromUndefinedOr(stream.side_data_list),
    O.flatMap(A.findFirst((sideData) => O.isSome(O.fromUndefinedOr(sideData.rotation)))),
    O.flatMap((sideData) => O.fromUndefinedOr(sideData.rotation)),
    O.flatMap(decodeRotationNumber)
  );
  const tagRotation = pipe(O.fromUndefinedOr(stream.tags), O.flatMap(R.get("rotate")), O.flatMap(decodeRotationNumber));

  return O.orElse(sideDataRotation, () => tagRotation);
};

/**
 * Resolve the file extension emitted for a canonical normalize format.
 *
 * **Example** (Resolve normalize output extension)
 *
 * ```ts
 * import { normalizeOutputExtension } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof normalizeOutputExtension = normalizeOutputExtension
 * ```
 *
 * @param format - Canonical normalize output format.
 * @returns Dotted file extension.
 * @category utilities
 * @since 0.0.0
 */
export const normalizeOutputExtension = (format: NormalizeImageFormat): string => `.${format}`;

/**
 * Resolve the sharp encoder name for a canonical normalize format.
 *
 * **Example** (Resolve sharp encoder format name)
 *
 * ```ts
 * import { sharpFormatForNormalize } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof sharpFormatForNormalize = sharpFormatForNormalize
 * ```
 *
 * @param format - Canonical normalize output format.
 * @returns Format name accepted by sharp.
 * @category utilities
 * @since 0.0.0
 */
export const sharpFormatForNormalize = (format: NormalizeImageFormat): "jpeg" | "png" | "webp" =>
  format === "jpg" ? "jpeg" : format;

/**
 * Calculate downscaled dimensions for a max long edge without upscaling.
 *
 * **Example** (Calculate downscaled output dimensions)
 *
 * ```ts
 * import { normalizeOutputDimensions } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof normalizeOutputDimensions = normalizeOutputDimensions
 * ```
 *
 * @param dimensions - Input dimensions after orientation is applied.
 * @param maxLongEdge - Maximum output long edge.
 * @returns Output dimensions after optional downscaling.
 * @category utilities
 * @since 0.0.0
 */
export const normalizeOutputDimensions: {
  (maxLongEdge: O.Option<number>): (dimensions: MediaDimensions) => MediaDimensions;
  (dimensions: MediaDimensions, maxLongEdge: O.Option<number>): MediaDimensions;
} = dual(2, (dimensions: MediaDimensions, maxLongEdge: O.Option<number>): MediaDimensions => {
  if (O.isNone(maxLongEdge)) {
    return dimensions;
  }

  const longEdge = Math.max(dimensions.width, dimensions.height);
  if (longEdge <= maxLongEdge.value) {
    return dimensions;
  }

  const scale = maxLongEdge.value / longEdge;
  return MediaDimensions.make({
    height: Math.max(1, Math.round(dimensions.height * scale)),
    width: Math.max(1, Math.round(dimensions.width * scale)),
  });
});

/**
 * Check whether two media dimensions differ.
 *
 * **Example** (Compare media dimensions for change)
 *
 * ```ts
 * import { mediaDimensionsChanged } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof mediaDimensionsChanged = mediaDimensionsChanged
 * ```
 *
 * @param left - First dimensions.
 * @param right - Second dimensions.
 * @returns Whether width or height changed.
 * @category utilities
 * @since 0.0.0
 */
export const mediaDimensionsChanged: {
  (right: MediaDimensions): (left: MediaDimensions) => boolean;
  (left: MediaDimensions, right: MediaDimensions): boolean;
} = dual(
  2,
  (left: MediaDimensions, right: MediaDimensions): boolean => left.width !== right.width || left.height !== right.height
);

/**
 * Check whether a selected image file can be normalized by metadata stripping.
 *
 * **Example** (Check metadata strip image support)
 *
 * ```ts
 * import { isSupportedMetadataImageFile } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof isSupportedMetadataImageFile = isSupportedMetadataImageFile
 * ```
 *
 * @param file - Selected file.
 * @returns Whether the file extension is supported for image metadata stripping.
 * @category utilities
 * @since 0.0.0
 */
export const isSupportedMetadataImageFile = (file: SortableFile): boolean =>
  isSupportedMetadataImageExtension(normalizeBareExtension(file.extension));
