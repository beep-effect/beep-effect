import {
  ArchivePoorCandidatesOptions,
  archivePoorCandidates,
  CreateCaptionFilesOptions,
  CropBordersOptions,
  createCaptionFiles,
  cropBordersFiles,
  DetectBordersOptions,
  detectBordersFiles,
  FlattenMediaOptions,
  flattenMediaFiles,
  NormalizeFilesOptions,
  normalizeFiles,
} from "@beep/repo-cli/test/Files";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  ArchivePoorCandidatesEntry,
  ArchivePoorCandidatesManifest,
  ArchivePoorCandidatesSkippedEntry,
  ArchivePoorCandidatesSummary,
  CandidateAssessmentDecision,
  CandidateAssessmentProfile,
  CandidateAssessmentReason,
  CreateCaptionFilesPlanEntry,
  CreateCaptionFilesSkippedEntry,
  CreateCaptionFilesSummary,
  CropBordersSummary,
  DetectBordersReport,
  DetectBordersSkippedEntry,
  DetectBordersSummary,
  FileSha256Hash,
  FilesCommandError,
  FilesCommandService,
  FilesCommandServiceShape,
  FlattenMediaSummary,
  NormalizeImageFormat,
  NormalizeManifest,
  NormalizePlanEntry,
  NormalizeSkippedEntry,
  NormalizeSummary,
} from "@beep/repo-cli/test/Files";
import type { Effect } from "effect";

describe("Files command", () => {
  it("returns the create-captions summary through the files service", () => {
    const options = CreateCaptionFilesOptions.make({
      caption: "trigger token",
      dir: "./dataset/images",
      dryRun: true,
      overwrite: false,
    });

    expect(createCaptionFiles(options)).type.toBe<
      Effect.Effect<CreateCaptionFilesSummary, FilesCommandError, FilesCommandService>
    >();
  });

  it("keeps create-captions entries JSON-safe", () => {
    expect<CreateCaptionFilesPlanEntry["captionRelativePath"]>().type.toBe<string>();
    expect<CreateCaptionFilesPlanEntry["overwritesExisting"]>().type.toBe<boolean>();
    expect<CreateCaptionFilesSkippedEntry["captionName"]>().type.toBe<string | undefined>();
    expect<CreateCaptionFilesSkippedEntry["reason"]>().type.toBe<
      | "caption-exists"
      | "caption-target-collision"
      | "caption-target-not-file"
      | "directory"
      | "extensionless"
      | "non-media"
      | "symlink"
      | "video"
    >();
  });

  it("returns the flatten-media summary through the files service", () => {
    const options = FlattenMediaOptions.make({
      dir: "./raw",
      dryRun: true,
      outDir: "./flat",
    });

    expect(flattenMediaFiles(options)).type.toBe<
      Effect.Effect<FlattenMediaSummary, FilesCommandError, FilesCommandService>
    >();
    expect<FilesCommandServiceShape["flattenMediaFiles"]>().type.toBe<
      (options: FlattenMediaOptions) => Effect.Effect<FlattenMediaSummary, FilesCommandError>
    >();
  });

  it("keeps flatten-media options and summary fields JSON-safe", () => {
    expect<FlattenMediaOptions["dir"]>().type.toBe<string>();
    expect<FlattenMediaOptions["dryRun"]>().type.toBe<boolean>();
    expect<FlattenMediaOptions["outDir"]>().type.toBe<string>();
    expect<FlattenMediaSummary["collisionCount"]>().type.toBe<number>();
    expect<FlattenMediaSummary["destinationDirectory"]>().type.toBe<string>();
    expect<FlattenMediaSummary["dryRun"]>().type.toBe<boolean>();
    expect<FlattenMediaSummary["movedCount"]>().type.toBe<number>();
    expect<FlattenMediaSummary["plannedCount"]>().type.toBe<number>();
    expect<FlattenMediaSummary["skippedCount"]>().type.toBe<number>();
    expect<FlattenMediaSummary["sourceDirectory"]>().type.toBe<string>();
  });

  it("returns the archive-poor-candidates summary through the files service", () => {
    const options = ArchivePoorCandidatesOptions.make({
      archiveDir: "./rejected",
      dir: "./raw",
      dryRun: true,
      manifest: O.none(),
      maxAspect: 3,
      maxUpscale: 1.5,
      minShortEdge: 512,
      overwrite: false,
      profile: "character-lora",
      sidecars: "txt",
      targetResolution: 1024,
    });

    expect(archivePoorCandidates(options)).type.toBe<
      Effect.Effect<ArchivePoorCandidatesSummary, FilesCommandError, FilesCommandService>
    >();
  });

  it("keeps archive-poor-candidates manifest entries JSON-safe", () => {
    expect<CandidateAssessmentProfile>().type.toBe<"character-lora">();
    expect<CandidateAssessmentDecision>().type.toBe<"archive" | "keep">();
    expect<CandidateAssessmentReason>().type.toBe<
      "extreme-aspect-ratio" | "short-edge-too-small" | "upscale-too-large"
    >();
    expect<ArchivePoorCandidatesManifest["schemaVersion"]>().type.toBe<"beep.files.archive-poor-candidates.v1">();
    expect<ArchivePoorCandidatesManifest["summary"]["movedSidecarCount"]>().type.toBe<number>();
    expect<ArchivePoorCandidatesEntry["sourceSizeBytes"]>().type.toBe<string>();
    expect<ArchivePoorCandidatesEntry["archivePath"]>().type.toBe<string | undefined>();
    expect<ArchivePoorCandidatesSkippedEntry["reason"]>().type.toBe<
      "directory" | "extensionless" | "non-media" | "symlink" | "unsupported-image" | "unreadable-image" | "video"
    >();
  });

  it("returns the crop-borders summary through the files service", () => {
    const options = CropBordersOptions.make({
      dir: "./raw",
      dryRun: true,
      maxScanPct: 45,
      minSolidPct: 98.5,
      minWidthPct: 1,
      tolerance: 12,
    });

    expect(cropBordersFiles(options)).type.toBe<
      Effect.Effect<CropBordersSummary, FilesCommandError, FilesCommandService>
    >();
  });

  it("returns the detect-borders report through the files service", () => {
    const options = DetectBordersOptions.make({
      dir: "./raw",
      json: true,
      maxScanPct: 45,
      minSolidPct: 98.5,
      minWidthPct: 1,
      tolerance: 12,
    });

    expect(detectBordersFiles(options)).type.toBe<
      Effect.Effect<DetectBordersReport, FilesCommandError, FilesCommandService>
    >();
  });

  it("keeps detect-borders report entries JSON-safe", () => {
    expect<DetectBordersReport["schemaVersion"]>().type.toBe<"beep.files.detect-borders.v1">();
    expect<DetectBordersSummary["borderedCount"]>().type.toBe<number>();
    expect<DetectBordersSkippedEntry["reason"]>().type.toBe<
      "directory" | "extensionless" | "non-media" | "symlink" | "unsupported-image" | "unreadable-image" | "video"
    >();
  });

  it("exposes the canonical normalize image formats", () => {
    expect<NormalizeImageFormat>().type.toBe<"png" | "jpg" | "webp">();
  });

  it("returns the normalize summary through the files service", () => {
    const options = NormalizeFilesOptions.make({
      dedupe: true,
      dir: "./raw",
      dryRun: true,
      format: "png",
      manifest: O.none(),
      maxLongEdge: O.some(1024),
      moveDuplicatesTo: O.some("./duplicates"),
      outDir: "./dataset/images",
      overwrite: false,
    });

    expect(normalizeFiles(options)).type.toBe<
      Effect.Effect<NormalizeSummary, FilesCommandError, FilesCommandService>
    >();
  });

  it("keeps normalize manifest entries JSON-safe", () => {
    expect<NormalizeManifest["schemaVersion"]>().type.toBe<"beep.files.normalize.v1">();
    expect<NormalizeManifest["summary"]["duplicateCount"]>().type.toBe<number>();
    expect<NormalizeManifest["summary"]["movedDuplicateCount"]>().type.toBe<number>();
    expect<NormalizeManifest["options"]["moveDuplicatesTo"]>().type.toBe<string | undefined>();
    expect<NormalizePlanEntry["outputHash"]>().type.toBe<FileSha256Hash | undefined>();
    expect<NormalizePlanEntry["sourceSizeBytes"]>().type.toBe<string>();
    expect<NormalizePlanEntry["outputSizeBytes"]>().type.toBe<string | undefined>();
    expect<NormalizeSkippedEntry["duplicateOfOutputRelativePath"]>().type.toBe<string | undefined>();
    expect<NormalizeSkippedEntry["duplicateMovedPath"]>().type.toBe<string | undefined>();
    expect<NormalizeSkippedEntry["duplicateMovedRelativePath"]>().type.toBe<string | undefined>();
    expect<NormalizeSkippedEntry["outputHash"]>().type.toBe<FileSha256Hash | undefined>();
    expect<NormalizeSkippedEntry["reason"]>().type.toBe<
      "directory" | "duplicate" | "extensionless" | "non-media" | "symlink" | "unsupported-image" | "video"
    >();
  });
});
