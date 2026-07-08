/**
 * Plain-text renderers for dataset file curation plans and reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { A } from "@beep/utils";
import { Console, Effect, FileSystem, Path, pipe } from "effect";
import * as O from "effect/Option";
import { FilesCommandError, formatPlatformError } from "./Files.errors.js";
import {
  ArchivePoorCandidatesManifest,
  ArchivePoorCandidatesManifestSummary,
  encodeArchivePoorCandidatesManifest,
  encodeDetectBordersReport,
  encodeDetectFacesReport,
  encodeNormalizeManifest,
} from "./Files.schemas.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  ArchivePoorCandidatesEntry,
  ArchivePoorCandidatesManifest as ArchivePoorCandidatesManifestModel,
  ArchivePoorCandidatesPlan,
  ArchivePoorCandidatesSkippedEntry,
  CreateCaptionFilesPlan,
  CreateCaptionFilesPlanEntry,
  CreateCaptionFilesSkippedEntry,
  CropBordersPlanEntry,
  DetectBordersEntry,
  DetectBordersReport,
  DetectBordersSkippedEntry,
  DetectFacesEntry,
  DetectFacesReport,
  DetectFacesSkippedEntry,
  NormalizeManifest as NormalizeManifestModel,
  NormalizePlan,
  NormalizePlanEntry,
  NormalizeSkippedEntry,
  RenamePlanEntry,
  StripMetadataPlanEntry,
} from "./Files.schemas.js";

/**
 * Render a rename plan entry.
 *
 * @param entry - Rename plan entry.
 * @returns Human-readable plan line.
 * @example
 * ```ts
 * import { renderPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderPlanEntry = renderPlanEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderPlanEntry = (entry: RenamePlanEntry): string => `${entry.sourceName} -> ${entry.targetName}`;

/**
 * Render a metadata strip plan entry.
 *
 * @param entry - Planned source file whose metadata will be removed.
 * @returns Human-readable plan line.
 * @example
 * ```ts
 * import { renderStripMetadataPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderStripMetadataPlanEntry = renderStripMetadataPlanEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderStripMetadataPlanEntry = (entry: StripMetadataPlanEntry): string =>
  `${entry.sourceName} [${entry.mediaKind}]`;

/**
 * Render a caption sidecar creation plan entry.
 *
 * @param entry - Planned source image and caption sidecar pair.
 * @returns Human-readable plan line.
 * @example
 * ```ts
 * import { renderCreateCaptionFilesPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderCreateCaptionFilesPlanEntry = renderCreateCaptionFilesPlanEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderCreateCaptionFilesPlanEntry = (entry: CreateCaptionFilesPlanEntry): string =>
  `${entry.sourceName} -> ${entry.captionName}`;

/**
 * Render a skipped caption sidecar creation source entry.
 *
 * @param entry - Source file excluded from caption sidecar creation with its reason.
 * @returns Human-readable skipped line.
 * @example
 * ```ts
 * import { renderCreateCaptionFilesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderCreateCaptionFilesSkippedEntry = renderCreateCaptionFilesSkippedEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderCreateCaptionFilesSkippedEntry = (entry: CreateCaptionFilesSkippedEntry): string =>
  `${entry.sourceName} [${entry.reason}] ${entry.message}`;

/**
 * Render a normalize plan entry.
 *
 * @param entry - Planned source/output pair with probed resize details.
 * @returns Human-readable plan line.
 * @example
 * ```ts
 * import { renderNormalizePlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderNormalizePlanEntry = renderNormalizePlanEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderNormalizePlanEntry = (entry: NormalizePlanEntry): string =>
  `${entry.sourceName} -> ${entry.outputName} (${entry.inputDimensions.width}x${entry.inputDimensions.height} -> ${entry.outputDimensions.width}x${entry.outputDimensions.height})`;

/**
 * Render a normalize skipped entry.
 *
 * @param entry - Source file excluded from normalization with its reason.
 * @returns Human-readable skipped line.
 * @example
 * ```ts
 * import { renderNormalizeSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderNormalizeSkippedEntry = renderNormalizeSkippedEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderNormalizeSkippedEntry = (entry: NormalizeSkippedEntry): string =>
  `${entry.sourceName} [${entry.reason}] ${entry.message}`;

/**
 * Render a poor-candidate archive plan entry.
 *
 * @param entry - Assessed image candidate.
 * @returns Human-readable archive plan line.
 * @example
 * ```ts
 * import { renderArchivePoorCandidatesEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderArchivePoorCandidatesEntry = renderArchivePoorCandidatesEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderArchivePoorCandidatesEntry = (entry: ArchivePoorCandidatesEntry): string => {
  const target = pipe(
    O.fromUndefinedOr(entry.archiveName),
    O.getOrElse(() => "kept")
  );
  const reasons = A.isReadonlyArrayNonEmpty(entry.reasons) ? A.join(", ")(entry.reasons) : "none";
  return `${entry.sourceName} [${entry.decision}] ${entry.dimensions.width}x${entry.dimensions.height} -> ${target} (${reasons})`;
};

/**
 * Render a skipped poor-candidate archive source entry.
 *
 * @param entry - Source file excluded from candidate archival with its reason.
 * @returns Human-readable skipped line.
 * @example
 * ```ts
 * import { renderArchivePoorCandidatesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderArchivePoorCandidatesSkippedEntry = renderArchivePoorCandidatesSkippedEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderArchivePoorCandidatesSkippedEntry = (entry: ArchivePoorCandidatesSkippedEntry): string =>
  `${entry.sourceName} [${entry.reason}] ${entry.message}`;

/**
 * Render a detected-border report entry.
 *
 * @param entry - Analyzed image entry.
 * @returns Human-readable report line.
 * @example
 * ```ts
 * import { renderDetectBordersEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectBordersEntry = renderDetectBordersEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectBordersEntry = (entry: DetectBordersEntry): string => {
  const matchedSides = pipe(
    entry.sides,
    A.filter((side) => side.matched),
    A.map((side) => `${side.side}=${side.widthPx}px/${side.widthPct}% ${side.colorHex}`),
    A.join(", ")
  );

  return `${entry.sourceName} [${entry.classification}] ${entry.width}x${entry.height} ${matchedSides}`;
};

/**
 * Render a skipped border-detection source entry.
 *
 * @param entry - Source file excluded from border detection with its reason.
 * @returns Human-readable skipped line.
 * @example
 * ```ts
 * import { renderDetectBordersSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectBordersSkippedEntry = renderDetectBordersSkippedEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectBordersSkippedEntry = (entry: DetectBordersSkippedEntry): string =>
  `${entry.sourceName} [${entry.reason}] ${entry.message}`;

/**
 * Render a face-detection report entry.
 *
 * @param entry - Analyzed image entry.
 * @returns Human-readable report line.
 * @example
 * ```ts
 * import { renderDetectFacesEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectFacesEntry = renderDetectFacesEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectFacesEntry = (entry: DetectFacesEntry): string => {
  const flags = A.isReadonlyArrayNonEmpty(entry.flags) ? A.join(", ")(entry.flags) : "none";
  const area = pipe(
    O.fromUndefinedOr(entry.primaryFaceAreaPct),
    O.map((value) => ` area=${value.toFixed(2)}%`),
    O.getOrElse(() => "")
  );
  const moved = pipe(
    O.fromUndefinedOr(entry.movedNoFaceRelativePath),
    O.map((value) => ` moved=${value}`),
    O.getOrElse(() => "")
  );
  return `${entry.sourceName} [${flags}] faces=${entry.faceCount}${area}${moved}`;
};

/**
 * Render a skipped face-detection source entry.
 *
 * @param entry - Source file excluded from face detection with its reason.
 * @returns Human-readable skipped line.
 * @example
 * ```ts
 * import { renderDetectFacesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderDetectFacesSkippedEntry = renderDetectFacesSkippedEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderDetectFacesSkippedEntry = (entry: DetectFacesSkippedEntry): string =>
  `${entry.sourceName} [${entry.reason}] ${entry.message}`;

/**
 * Render a border crop plan entry.
 *
 * @param entry - Planned in-place crop.
 * @returns Human-readable crop plan line.
 * @example
 * ```ts
 * import { renderCropBordersPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderCropBordersPlanEntry = renderCropBordersPlanEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderCropBordersPlanEntry = (entry: CropBordersPlanEntry): string =>
  `${entry.sourceName} [${entry.classification}] ${entry.originalWidth}x${entry.originalHeight} -> ${entry.cropWidth}x${entry.cropHeight} @ ${entry.cropLeft},${entry.cropTop}`;

/**
 * Render a normalize manifest with the shared Biome JSON formatter.
 *
 * @param manifestPath - Destination manifest path used for formatter context.
 * @param manifest - Manifest to encode and render.
 * @returns Formatted JSON text.
 * @example
 * ```ts
 * import { renderNormalizeManifest } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof renderNormalizeManifest !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderNormalizeManifest = Effect.fn("Files.renderNormalizeManifest")(function* (
  manifestPath: string,
  manifest: NormalizeManifestModel
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeNormalizeManifest(manifest).pipe(
    FilesCommandError.mapError(`Failed to encode normalize manifest for "${manifestPath}"`)
  );

  return yield* renderBiomeJson(manifestPath, encoded).pipe(
    FilesCommandError.mapError(`Failed to render normalize manifest for "${manifestPath}"`)
  );
});

/**
 * Select archive-plan entries that move source files.
 *
 * @param entries - Candidate assessment entries.
 * @returns Entries whose decision is `archive`.
 * @example
 * ```ts
 * import { archivedEntries } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof archivedEntries !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const archivedEntries = (
  entries: ReadonlyArray<ArchivePoorCandidatesEntry>
): ReadonlyArray<ArchivePoorCandidatesEntry> => A.filter(entries, (entry) => entry.decision === "archive");

/**
 * Count sidecars moved by an archive plan.
 *
 * @param entries - Candidate assessment entries.
 * @returns Total moved sidecar count.
 * @example
 * ```ts
 * import { countMovedSidecars } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof countMovedSidecars !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const countMovedSidecars = (entries: ReadonlyArray<ArchivePoorCandidatesEntry>): number =>
  A.reduce(entries, 0, (count, entry) => count + A.length(entry.sidecars));

/**
 * Build the archive-poor-candidates manifest for a plan.
 *
 * @param plan - Candidate archive plan.
 * @returns Versioned archive manifest.
 * @example
 * ```ts
 * import { makeArchivePoorCandidatesManifest } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof makeArchivePoorCandidatesManifest !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const makeArchivePoorCandidatesManifest = (
  plan: ArchivePoorCandidatesPlan
): ArchivePoorCandidatesManifestModel =>
  ArchivePoorCandidatesManifest.make({
    archiveDirectory: plan.archiveDirectory,
    entries: plan.entries,
    manifestPath: plan.manifestPath,
    options: plan.options,
    schemaVersion: "beep.files.archive-poor-candidates.v1",
    skipped: plan.skipped,
    sourceDirectory: plan.sourceDirectory,
    summary: ArchivePoorCandidatesManifestSummary.make({
      archivedCount: A.length(archivedEntries(plan.entries)),
      assessedCount: A.length(plan.entries),
      keptCount: A.length(A.filter(plan.entries, (entry) => entry.decision === "keep")),
      movedSidecarCount: countMovedSidecars(plan.entries),
      skippedCount: A.length(plan.skipped),
    }),
  });

/**
 * Render an archive manifest with the shared Biome JSON formatter.
 *
 * @param manifestPath - Destination manifest path used for formatter context.
 * @param manifest - Manifest to encode and render.
 * @returns Formatted JSON text.
 * @example
 * ```ts
 * import { renderArchivePoorCandidatesManifest } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof renderArchivePoorCandidatesManifest !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderArchivePoorCandidatesManifest = Effect.fn("Files.renderArchivePoorCandidatesManifest")(function* (
  manifestPath: string,
  manifest: ArchivePoorCandidatesManifestModel
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeArchivePoorCandidatesManifest(manifest).pipe(
    FilesCommandError.mapError(`Failed to encode archive manifest for "${manifestPath}"`)
  );

  return yield* renderBiomeJson(manifestPath, encoded).pipe(
    FilesCommandError.mapError(`Failed to render archive manifest for "${manifestPath}"`)
  );
});

/**
 * Render a detect-borders report with the shared Biome JSON formatter.
 *
 * @param report - Detect-borders report to encode.
 * @returns Formatted JSON text.
 * @example
 * ```ts
 * import { renderDetectBordersReportJson } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof renderDetectBordersReportJson !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderDetectBordersReportJson = Effect.fn("Files.renderDetectBordersReportJson")(function* (
  report: DetectBordersReport
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeDetectBordersReport(report).pipe(
    FilesCommandError.mapError("Failed to encode detect-borders report")
  );

  return yield* renderBiomeJson("detect-borders-report.json", encoded).pipe(
    FilesCommandError.mapError("Failed to render detect-borders report")
  );
});

/**
 * Render a detect-faces report with the shared Biome JSON formatter.
 *
 * @param report - Detect-faces report to encode.
 * @param outputPath - Output path used for formatter context.
 * @returns Formatted JSON text.
 * @example
 * ```ts
 * import { renderDetectFacesReportJson } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof renderDetectFacesReportJson !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderDetectFacesReportJson = Effect.fn("Files.renderDetectFacesReportJson")(function* (
  report: DetectFacesReport,
  outputPath: string
): Effect.fn.Return<string, FilesCommandError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const encoded = yield* encodeDetectFacesReport(report).pipe(
    FilesCommandError.mapError(`Failed to encode detect-faces report for "${outputPath}"`)
  );

  return yield* renderBiomeJson(outputPath, encoded).pipe(
    FilesCommandError.mapError(`Failed to render detect-faces report for "${outputPath}"`)
  );
});

/**
 * Write a detect-faces manifest report to disk.
 *
 * @param report - Detect-faces report with manifest path.
 * @example
 * ```ts
 * import { writeDetectFacesManifest } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof writeDetectFacesManifest !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const writeDetectFacesManifest = Effect.fn("Files.writeDetectFacesManifest")(function* (
  report: DetectFacesReport
): Effect.fn.Return<
  void,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* renderDetectFacesReportJson(report, report.manifestPath);

  yield* fs
    .makeDirectory(path.dirname(report.manifestPath), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create detect-faces manifest directory", report.manifestPath, { cause })
      )
    );
  yield* fs
    .writeFileString(report.manifestPath, content)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to write detect-faces manifest", report.manifestPath, { cause })
      )
    );
});

/**
 * Log a rename plan line by line.
 *
 * @param plan - Rename plan entries.
 * @example
 * ```ts
 * import { logRenamePlan } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logRenamePlan !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logRenamePlan = Effect.fn("Files.logRenamePlan")(function* (plan: ReadonlyArray<RenamePlanEntry>) {
  yield* Effect.forEach(plan, (entry) => Console.log(renderPlanEntry(entry)), {
    discard: true,
  });
});

/**
 * Log a metadata strip plan line by line.
 *
 * @param plan - Metadata strip plan entries.
 * @example
 * ```ts
 * import { logStripMetadataPlan } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logStripMetadataPlan !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logStripMetadataPlan = Effect.fn("Files.logStripMetadataPlan")(function* (
  plan: ReadonlyArray<StripMetadataPlanEntry>
) {
  yield* Effect.forEach(plan, (entry) => Console.log(renderStripMetadataPlanEntry(entry)), {
    discard: true,
  });
});

/**
 * Log normalize plan and skipped entries line by line.
 *
 * @param plan - Plan whose entries are rendered one console line each.
 * @example
 * ```ts
 * import { logNormalizePlan } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logNormalizePlan !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logNormalizePlan = Effect.fn("Files.logNormalizePlan")(function* (plan: NormalizePlan) {
  yield* Effect.forEach(plan.entries, (entry) => Console.log(renderNormalizePlanEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(plan.skipped, (entry) => Console.log(renderNormalizeSkippedEntry(entry)), {
    discard: true,
  });
});

/**
 * Log caption plan and skipped entries line by line.
 *
 * @param plan - Caption creation plan.
 * @example
 * ```ts
 * import { logCreateCaptionFilesPlan } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logCreateCaptionFilesPlan !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logCreateCaptionFilesPlan = Effect.fn("Files.logCreateCaptionFilesPlan")(function* (
  plan: CreateCaptionFilesPlan
) {
  yield* Effect.forEach(plan.entries, (entry) => Console.log(renderCreateCaptionFilesPlanEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(plan.skipped, (entry) => Console.log(renderCreateCaptionFilesSkippedEntry(entry)), {
    discard: true,
  });
});

/**
 * Log archive-candidate plan and skipped entries line by line.
 *
 * @param plan - Candidate archive plan.
 * @example
 * ```ts
 * import { logArchivePoorCandidatesPlan } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logArchivePoorCandidatesPlan !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logArchivePoorCandidatesPlan = Effect.fn("Files.logArchivePoorCandidatesPlan")(function* (
  plan: ArchivePoorCandidatesPlan
) {
  yield* Effect.forEach(plan.entries, (entry) => Console.log(renderArchivePoorCandidatesEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(plan.skipped, (entry) => Console.log(renderArchivePoorCandidatesSkippedEntry(entry)), {
    discard: true,
  });
});

/**
 * Log only positive border-detection entries line by line.
 *
 * @param entries - Border detection entries.
 * @example
 * ```ts
 * import { logDetectBordersEntries } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logDetectBordersEntries !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logDetectBordersEntries = Effect.fn("Files.logDetectBordersEntries")(function* (
  entries: ReadonlyArray<DetectBordersEntry>
) {
  const borderedEntries = A.filter(entries, (entry) => entry.hasBorder);
  yield* Effect.forEach(borderedEntries, (entry) => Console.log(renderDetectBordersEntry(entry)), {
    discard: true,
  });
});

/**
 * Log face-detection entries and skipped entries line by line.
 *
 * @param entries - Face detection entries.
 * @param skipped - Skipped face-detection entries.
 * @example
 * ```ts
 * import { logDetectFacesEntries } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logDetectFacesEntries !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logDetectFacesEntries = Effect.fn("Files.logDetectFacesEntries")(function* (
  entries: ReadonlyArray<DetectFacesEntry>,
  skipped: ReadonlyArray<DetectFacesSkippedEntry>
) {
  yield* Effect.forEach(entries, (entry) => Console.log(renderDetectFacesEntry(entry)), {
    discard: true,
  });
  yield* Effect.forEach(skipped, (entry) => Console.log(renderDetectFacesSkippedEntry(entry)), {
    discard: true,
  });
});

/**
 * Log border crop plan entries line by line.
 *
 * @param plan - Border crop plan entries.
 * @example
 * ```ts
 * import { logCropBordersPlan } from "@beep/repo-cli/commands/Files/Files.render"
 *
 * console.log(typeof logCropBordersPlan !== "undefined") // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const logCropBordersPlan = Effect.fn("Files.logCropBordersPlan")(function* (
  plan: ReadonlyArray<CropBordersPlanEntry>
) {
  yield* Effect.forEach(plan, (entry) => Console.log(renderCropBordersPlanEntry(entry)), {
    discard: true,
  });
});
