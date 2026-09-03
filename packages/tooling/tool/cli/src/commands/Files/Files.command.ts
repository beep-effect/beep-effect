/**
 * Command definitions for dataset file curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, Match } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { FilesCommandError } from "./Files.errors.ts";
import {
  ArchivePoorCandidatesOptions,
  CreateCaptionFilesOptions,
  CropBordersOptions,
  DetectBordersOptions,
  DetectFacesOptions,
  FlattenMediaOptions,
  ImageAuditOptions,
  ImageCurationOptions,
  MatchPersonOptions,
  NormalizeFilesOptions,
  PersonMatchDeviceIndexesFromCsv,
  PersonMatchThresholdProfile,
  ProcessFilesOptions,
} from "./Files.schemas.ts";
import {
  archivePoorCandidates,
  auditImages,
  createCaptionFiles,
  cropBordersFiles,
  curateImages,
  detectBordersFiles,
  detectFacesFiles,
  FilesCommandServiceLive,
  flattenMediaFiles,
  matchPerson,
  normalizeFiles,
  printFilesIndex,
  processFiles,
  sortAndRenameFiles,
  stripMetadataFiles,
} from "./Files.service.ts";
import { defaultPersonMatchBackendForPlatform } from "./internal/MatchPerson.ts";
import type { PersonMatchBackend } from "./Files.schemas.ts";
import type { FilesCommandService } from "./Files.service.ts";

const runFilesProgram = <A>(
  effect: Effect.Effect<A, FilesCommandError, FilesCommandService>
): Effect.Effect<void, FilesCommandError, FilesCommandService> => effect.pipe(Effect.asVoid);

const sortDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct regular files should be sorted and renamed")
);
const flattenMediaDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory recursively searched for image and video files to move")
);
const stripDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image and video files should have metadata stripped")
);
const normalizeDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be normalized")
);
const createCaptionsDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should receive same-stem caption sidecars")
);
const detectBordersDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be scanned for solid borders")
);
const detectFacesDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be scanned for human faces")
);
const detectFacesModelFlag = Flag.file("model", { mustExist: true }).pipe(
  Flag.withDescription("YuNet-compatible ONNX face detection model file")
);
const cropBordersDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be cropped when solid borders are detected")
);
const archiveCandidatesDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be assessed for poor-candidate archival")
);
const auditImagesDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be audited without mutation")
);
const auditImagesModelFlag = Flag.file("model", { mustExist: true }).pipe(
  Flag.withDescription("Pinned YuNet-compatible ONNX face detection model")
);
const auditImagesManifestFlag = Flag.path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Path to the image audit manifest")
);
const curateImagesDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Immutable source directory containing direct image files")
);
const curateImagesDecisionsFlag = Flag.file("decisions", { mustExist: true }).pipe(
  Flag.withDescription("Complete hash-pinned image curation decision ledger")
);
const curateImagesOutDirFlag = Flag.directory("out-dir").pipe(
  Flag.withDescription("Output root for canonical, holdout, reserve, archive, and manifest derivatives")
);
const curateImagesManifestFlag = Flag.path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Curation manifest output path; defaults to --out-dir/manifests/image-curation-manifest.json"),
  Flag.optional
);
const matchPersonDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Candidate photo directory to scan for the target person")
);
const matchPersonReferencesFlag = Flag.directory("references", { mustExist: true }).pipe(
  Flag.withDescription("Trusted reference directory whose images contain only the target person")
);
const matchPersonManifestFlag = Flag.path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Required schema-versioned person-match manifest output path")
);
const matchPersonOutDirFlag = Flag.directory("out-dir").pipe(
  Flag.withDescription("Optional directory receiving non-destructive accepted and review copies"),
  Flag.optional
);
const matchPersonCacheDirFlag = Flag.directory("cache-dir").pipe(
  Flag.withDescription("Optional cache root for isolated Python environments and pinned face-recognition models"),
  Flag.optional
);
const matchPersonBackendFlag = Flag.choiceWithValue("backend", [
  ["buffalo-l", "buffalo-l"],
  ["adaface-kprpe", "adaface-kprpe"],
]).pipe(
  Flag.withDescription(
    "Recognition backend: AdaFace on Linux x64; Buffalo CPU on Linux x64/arm64, macOS x64/arm64, or Windows x64"
  ),
  Flag.optional
);
const matchPersonComputeFlag = Flag.choiceWithValue("compute", [
  ["auto", "auto"],
  ["cpu", "cpu"],
  ["rocm", "rocm"],
]).pipe(
  Flag.withDefault("auto"),
  Flag.withDescription("Compute policy: prefer ROCm when available, require CPU, or require ROCm")
);
const matchPersonDevicesFlag = Flag.string("devices").pipe(
  Flag.withDescription("Optional single ROCm device index, for example 0"),
  Flag.optional
);
const matchPersonBatchSizeFlag = Flag.integer("batch-size").pipe(
  Flag.withDefault(32),
  Flag.withDescription("Positive face-embedding inference batch size")
);
const archiveDirFlag = Flag.directory("archive-dir").pipe(
  Flag.withDescription("Directory that receives archived poor image candidates")
);
const normalizeOutDirFlag = Flag.directory("out-dir").pipe(
  Flag.withDescription("Output directory for normalized image files")
);
const flattenMediaOutDirFlag = Flag.directory("out-dir").pipe(
  Flag.withDescription("Flat output directory for moved image and video files")
);
const processInputFlag = Flag.path("input", { mustExist: true, pathType: "either" }).pipe(
  Flag.withDescription("File or directory to process into a V1 proof manifest")
);
const processOutDirFlag = Flag.directory("out-dir").pipe(
  Flag.withDescription("Output directory for the V1 file-processing proof manifest")
);
const normalizeFormatFlag = Flag.choiceWithValue("format", [
  ["png", "png"],
  ["jpg", "jpg"],
  ["jpeg", "jpg"],
  ["webp", "webp"],
]).pipe(Flag.withDefault("png"), Flag.withDescription("Output image format: png, jpg/jpeg, or webp"));
const processEngineFlag = Flag.choiceWithValue("engine", [
  ["auto", "auto"],
  ["tika", "tika"],
  ["libpff", "libpff"],
  ["test", "test"],
]).pipe(Flag.withDefault("auto"), Flag.withDescription("File-processing engine: auto, tika, libpff, or test"));
const processFailurePolicyFlag = Flag.choiceWithValue("failure-policy", [
  ["fail-on-error", "fail-on-error"],
  ["continue", "continue"],
]).pipe(Flag.withDefault("fail-on-error"), Flag.withDescription("Exit policy for failed source rows"));
const maxMaterializedBytesFlag = Flag.integer("max-materialized-bytes").pipe(
  Flag.withDescription("Maximum materialized text bytes per source"),
  Flag.optional
);
const maxLongEdgeFlag = Flag.integer("max-long-edge").pipe(
  Flag.withDescription("Resize long edge down to this pixel count without upscaling"),
  Flag.optional
);
const manifestFlag = Flag.path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Manifest output path; defaults to --out-dir/normalize-manifest.json"),
  Flag.optional
);
const archiveManifestFlag = Flag.path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Manifest output path; defaults to --archive-dir/archive-poor-candidates-manifest.json"),
  Flag.optional
);
const detectFacesManifestFlag = Flag.path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Manifest output path; defaults to --dir/detect-faces-manifest.json"),
  Flag.optional
);
const detectFacesMoveNoFaceToFlag = Flag.directory("move-no-face-to").pipe(
  Flag.withDescription("Move images with no detected faces to this directory"),
  Flag.optional
);
const prefixFlag = Flag.string("prefix").pipe(
  Flag.withDescription("Generated filename prefix without dots, path separators, or embedded NUL bytes")
);
const sortDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned renames without touching files")
);
const flattenMediaDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned moves without touching files")
);
const stripDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned metadata rewrites without touching files")
);
const normalizeDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned normalizations without writing files")
);
const createCaptionsDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned caption sidecars without writing files")
);
const archiveDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned poor-candidate archival without moving files")
);
const curateImagesDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Validate and print every disposition without writing derivatives")
);
const auditImagesOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite an existing regular-file image audit manifest")
);
const curateImagesOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing regular-file curation outputs and manifest")
);
const matchPersonOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite an existing regular-file manifest and matching output files")
);
const matchPersonRecursiveFlag = Flag.boolean("recursive").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Recursively scan nested candidate and reference directories")
);
const matchPersonAcceptModelLicenseFlag = Flag.boolean("accept-model-license").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Accept the selected model and training-dataset license notices")
);
const captionTextFlag = Flag.string("caption").pipe(
  Flag.withDefault(""),
  Flag.withDescription("Caption text to write to newly created sidecar files")
);
const normalizeDedupeFlag = Flag.boolean("dedupe").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Skip later files whose normalized bytes exactly duplicate an earlier normalized output; implied by --move-duplicates-to"
  )
);
const processExportChildrenFlag = Flag.boolean("export-children").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Export child artifacts from archive-like sources such as PST")
);
const normalizeMoveDuplicatesToFlag = Flag.directory("move-duplicates-to").pipe(
  Flag.withDescription("Move later duplicate source files to this directory after exact normalized-byte dedupe"),
  Flag.optional
);
const cropBordersDryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print detected border crops without rewriting files")
);
const overwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing normalized outputs, duplicate move targets, and manifest")
);
const archiveOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing archived files, sidecars, and manifest")
);
const processOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite an existing files process output directory")
);
const processTikaJarFlag = Flag.file("tika-jar", { mustExist: true }).pipe(
  Flag.withDescription("Apache tika-app jar; selects the Tika App engine for non-PST extraction"),
  Flag.optional
);
const processJavaFlag = Flag.string("java").pipe(
  Flag.withDescription("java binary used to run the tika-app jar"),
  Flag.optional
);
const processTikaUrlFlag = Flag.string("tika-url").pipe(
  Flag.withDescription("Tika Server base URL; defaults to the BEEP_TIKA_* environment configuration"),
  Flag.optional
);
const processPffexportFlag = Flag.string("pffexport").pipe(
  Flag.withDescription("pffexport binary used for PST archive export"),
  Flag.optional
);
const createCaptionsOverwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing caption sidecar files")
);
const withDimensionsFlag = Flag.boolean("with-dimensions").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include probed image or video dimensions in generated media filenames")
);
const candidateProfileFlag = Flag.choiceWithValue("profile", [["character-lora", "character-lora"]]).pipe(
  Flag.withDefault("character-lora"),
  Flag.withDescription("Candidate assessment profile")
);
const targetResolutionFlag = Flag.integer("target-resolution").pipe(
  Flag.withDefault(1024),
  Flag.withDescription("Square training target resolution used to estimate required upscaling")
);
const minShortEdgeFlag = Flag.integer("min-short-edge").pipe(
  Flag.withDefault(512),
  Flag.withDescription("Archive images whose shorter edge is below this pixel count")
);
const maxAspectFlag = Flag.float("max-aspect").pipe(
  Flag.withDefault(3),
  Flag.withDescription("Archive images whose long-edge to short-edge ratio exceeds this value")
);
const maxUpscaleFlag = Flag.float("max-upscale").pipe(
  Flag.withDefault(1.5),
  Flag.withDescription("Archive images that would need more than this scale factor to reach the target area")
);
const sidecarsFlag = Flag.string("sidecars").pipe(
  Flag.withDefault("txt"),
  Flag.withDescription("Same-stem sidecars to move with archived images: none or a comma-separated extension list")
);
const jsonFlag = Flag.boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Emit a machine-readable JSON report")
);
const borderToleranceFlag = Flag.float("tolerance").pipe(
  Flag.withDefault(12),
  Flag.withDescription("Maximum RGB channel distance for near-solid border pixels")
);
const minSolidPctFlag = Flag.float("min-solid-pct").pipe(
  Flag.withDefault(98.5),
  Flag.withDescription("Minimum percent of pixels in a border row or column that must match the edge color")
);
const minWidthPctFlag = Flag.float("min-width-pct").pipe(
  Flag.withDefault(1),
  Flag.withDescription("Minimum border width as a percent of the scanned image dimension")
);
const maxScanPctFlag = Flag.float("max-scan-pct").pipe(
  Flag.withDefault(45),
  Flag.withDescription("Maximum percent of each image dimension to scan inward from an edge")
);
const minFaceConfidenceFlag = Flag.float("min-confidence").pipe(
  Flag.withDefault(0.75),
  Flag.withDescription("Minimum face detection confidence between 0 and 1")
);
const minFaceAreaPctFlag = Flag.float("min-face-area-pct").pipe(
  Flag.withDefault(1),
  Flag.withDescription("Flag detected faces whose primary face box area is below this image percentage")
);
const matchPersonDetectionThresholdFlag = Flag.float("detection-threshold").pipe(
  Flag.withDescription("Override the backend profile's minimum face-detection confidence between 0 and 1"),
  Flag.optional
);
const matchPersonMatchThresholdFlag = Flag.float("match-threshold").pipe(
  Flag.withDescription("Override the backend profile's minimum target-person cosine similarity between 0 and 1"),
  Flag.optional
);
const matchPersonReviewThresholdFlag = Flag.float("review-threshold").pipe(
  Flag.withDescription("Override the backend profile's lower cosine-similarity boundary for identity review"),
  Flag.optional
);
const matchPersonMinFaceAreaPctFlag = Flag.float("min-face-area-pct").pipe(
  Flag.withDescription("Override the backend profile's minimum matched-face percentage of the full image area"),
  Flag.optional
);
const faceEdgeMarginPctFlag = Flag.float("edge-margin-pct").pipe(
  Flag.withDefault(2),
  Flag.withDescription("Flag detected faces whose primary face box is within this percent of an image edge")
);

const buffaloMatchPersonThresholdProfile = PersonMatchThresholdProfile.make({
  detectionThreshold: 0.6,
  matchThreshold: 0.5,
  reviewThreshold: 0.35,
  minFaceAreaPct: 1,
});

const adaFaceMatchPersonThresholdProfile = PersonMatchThresholdProfile.make({
  detectionThreshold: 0.6,
  matchThreshold: 0.5,
  reviewThreshold: 0.35,
  minFaceAreaPct: 1,
});

const matchPersonThresholdProfileFor = Match.type<PersonMatchBackend>().pipe(
  Match.when("buffalo-l", () => buffaloMatchPersonThresholdProfile),
  Match.when("adaface-kprpe", () => adaFaceMatchPersonThresholdProfile),
  Match.exhaustive
);

const resolveMatchPersonThresholdProfile = (
  backend: PersonMatchBackend,
  detectionThreshold: O.Option<number>,
  matchThreshold: O.Option<number>,
  reviewThreshold: O.Option<number>,
  minFaceAreaPct: O.Option<number>
): PersonMatchThresholdProfile => {
  const defaults = matchPersonThresholdProfileFor(backend);
  return PersonMatchThresholdProfile.make({
    detectionThreshold: O.getOrElse(detectionThreshold, () => defaults.detectionThreshold),
    matchThreshold: O.getOrElse(matchThreshold, () => defaults.matchThreshold),
    reviewThreshold: O.getOrElse(reviewThreshold, () => defaults.reviewThreshold),
    minFaceAreaPct: O.getOrElse(minFaceAreaPct, () => defaults.minFaceAreaPct),
  });
};

const decodeMatchPersonDevices = (
  devices: O.Option<string>
): Effect.Effect<O.Option<PersonMatchDeviceIndexesFromCsv>, FilesCommandError> =>
  O.match(devices, {
    onNone: () => Effect.succeed(O.none<PersonMatchDeviceIndexesFromCsv>()),
    onSome: (value) =>
      S.decodeEffect(PersonMatchDeviceIndexesFromCsv)(value).pipe(
        Effect.asSome,
        FilesCommandError.mapError(
          `Invalid --devices value "${value}"; expected exactly one non-negative device index such as 0.`
        )
      ),
  });

const filesAuditImagesCommand = Command.make(
  "audit-images",
  {
    dir: auditImagesDirFlag,
    manifest: auditImagesManifestFlag,
    minConfidence: minFaceConfidenceFlag,
    modelPath: auditImagesModelFlag,
    overwrite: auditImagesOverwriteFlag,
  },
  Effect.fn(function* ({ dir, manifest, minConfidence, modelPath, overwrite }) {
    yield* runFilesProgram(
      auditImages(
        ImageAuditOptions.make({
          dir,
          manifest,
          minConfidence,
          modelPath,
          overwrite,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Audit image hashes, geometry, metadata presence, faces, and advisory quality"),
  Command.provide(FilesCommandServiceLive)
);

const filesCreateCaptionsCommand = Command.make(
  "create-captions",
  {
    caption: captionTextFlag,
    dir: createCaptionsDirFlag,
    dryRun: createCaptionsDryRunFlag,
    overwrite: createCaptionsOverwriteFlag,
  },
  Effect.fn(function* ({ caption, dir, dryRun, overwrite }) {
    yield* runFilesProgram(
      createCaptionFiles(
        CreateCaptionFilesOptions.make({
          caption,
          dir,
          dryRun,
          overwrite,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Create missing same-stem .txt caption sidecars for direct image files"),
  Command.provide(FilesCommandServiceLive)
);

const filesArchivePoorCandidatesCommand = Command.make(
  "archive-poor-candidates",
  {
    archiveDir: archiveDirFlag,
    dir: archiveCandidatesDirFlag,
    dryRun: archiveDryRunFlag,
    manifest: archiveManifestFlag,
    maxAspect: maxAspectFlag,
    maxUpscale: maxUpscaleFlag,
    minShortEdge: minShortEdgeFlag,
    overwrite: archiveOverwriteFlag,
    profile: candidateProfileFlag,
    sidecars: sidecarsFlag,
    targetResolution: targetResolutionFlag,
  },
  Effect.fn(function* ({
    archiveDir,
    dir,
    dryRun,
    manifest,
    maxAspect,
    maxUpscale,
    minShortEdge,
    overwrite,
    profile,
    sidecars,
    targetResolution,
  }) {
    yield* runFilesProgram(
      archivePoorCandidates(
        ArchivePoorCandidatesOptions.make({
          archiveDir,
          dir,
          dryRun,
          manifest,
          maxAspect,
          maxUpscale,
          minShortEdge,
          overwrite,
          profile,
          sidecars,
          targetResolution,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Archive obvious poor image candidates and same-stem sidecars"),
  Command.provide(FilesCommandServiceLive)
);

const filesDetectBordersCommand = Command.make(
  "detect-borders",
  {
    dir: detectBordersDirFlag,
    json: jsonFlag,
    maxScanPct: maxScanPctFlag,
    minSolidPct: minSolidPctFlag,
    minWidthPct: minWidthPctFlag,
    tolerance: borderToleranceFlag,
  },
  Effect.fn(function* ({ dir, json, maxScanPct, minSolidPct, minWidthPct, tolerance }) {
    yield* runFilesProgram(
      detectBordersFiles(
        DetectBordersOptions.make({
          dir,
          json,
          maxScanPct,
          minSolidPct,
          minWidthPct,
          tolerance,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Detect solid or near-solid canvas borders in direct image files"),
  Command.provide(FilesCommandServiceLive)
);

const filesCropBordersCommand = Command.make(
  "crop-borders",
  {
    dir: cropBordersDirFlag,
    dryRun: cropBordersDryRunFlag,
    maxScanPct: maxScanPctFlag,
    minSolidPct: minSolidPctFlag,
    minWidthPct: minWidthPctFlag,
    tolerance: borderToleranceFlag,
  },
  Effect.fn(function* ({ dir, dryRun, maxScanPct, minSolidPct, minWidthPct, tolerance }) {
    yield* runFilesProgram(
      cropBordersFiles(
        CropBordersOptions.make({
          dir,
          dryRun,
          maxScanPct,
          minSolidPct,
          minWidthPct,
          tolerance,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Crop solid or near-solid canvas borders from direct image files"),
  Command.provide(FilesCommandServiceLive)
);

const filesCurateImagesCommand = Command.make(
  "curate-images",
  {
    decisionsPath: curateImagesDecisionsFlag,
    dir: curateImagesDirFlag,
    dryRun: curateImagesDryRunFlag,
    manifest: curateImagesManifestFlag,
    outDir: curateImagesOutDirFlag,
    overwrite: curateImagesOverwriteFlag,
  },
  Effect.fn(function* ({ decisionsPath, dir, dryRun, manifest, outDir, overwrite }) {
    yield* runFilesProgram(
      curateImages(
        ImageCurationOptions.make({
          decisionsPath,
          dir,
          dryRun,
          manifest,
          outDir,
          overwrite,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Materialize hash-pinned image decisions as metadata-free canonical PNG derivatives"),
  Command.provide(FilesCommandServiceLive)
);

const filesDetectFacesCommand = Command.make(
  "detect-faces",
  {
    dir: detectFacesDirFlag,
    edgeMarginPct: faceEdgeMarginPctFlag,
    json: jsonFlag,
    manifest: detectFacesManifestFlag,
    minConfidence: minFaceConfidenceFlag,
    minFaceAreaPct: minFaceAreaPctFlag,
    modelPath: detectFacesModelFlag,
    moveNoFaceTo: detectFacesMoveNoFaceToFlag,
  },
  Effect.fn(function* ({ dir, edgeMarginPct, json, manifest, minConfidence, minFaceAreaPct, modelPath, moveNoFaceTo }) {
    yield* runFilesProgram(
      detectFacesFiles(
        DetectFacesOptions.make({
          dir,
          edgeMarginPct,
          json,
          manifest,
          minConfidence,
          minFaceAreaPct,
          modelPath,
          moveNoFaceTo,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Detect human faces in direct image files and write a triage manifest"),
  Command.provide(FilesCommandServiceLive)
);

const filesMatchPersonCommand = Command.make(
  "match-person",
  {
    acceptModelLicense: matchPersonAcceptModelLicenseFlag,
    backend: matchPersonBackendFlag,
    batchSize: matchPersonBatchSizeFlag,
    cacheDir: matchPersonCacheDirFlag,
    compute: matchPersonComputeFlag,
    detectionThreshold: matchPersonDetectionThresholdFlag,
    devices: matchPersonDevicesFlag,
    dir: matchPersonDirFlag,
    json: jsonFlag,
    manifest: matchPersonManifestFlag,
    matchThreshold: matchPersonMatchThresholdFlag,
    minFaceAreaPct: matchPersonMinFaceAreaPctFlag,
    outDir: matchPersonOutDirFlag,
    overwrite: matchPersonOverwriteFlag,
    recursive: matchPersonRecursiveFlag,
    references: matchPersonReferencesFlag,
    reviewThreshold: matchPersonReviewThresholdFlag,
  },
  Effect.fn(function* ({
    acceptModelLicense,
    backend,
    batchSize,
    cacheDir,
    compute,
    detectionThreshold,
    devices: deviceCsv,
    dir,
    json,
    manifest,
    matchThreshold,
    minFaceAreaPct,
    outDir,
    overwrite,
    recursive,
    references,
    reviewThreshold,
  }) {
    const hostPlatform = yield* HostProcessPlatform;
    const hostArchitecture = yield* HostProcessArchitecture;
    const resolvedBackend = O.getOrElse(backend, () =>
      defaultPersonMatchBackendForPlatform(hostPlatform, hostArchitecture)
    );
    const devices = yield* decodeMatchPersonDevices(deviceCsv);
    const thresholds = resolveMatchPersonThresholdProfile(
      resolvedBackend,
      detectionThreshold,
      matchThreshold,
      reviewThreshold,
      minFaceAreaPct
    );
    const thresholdSource = A.some([detectionThreshold, matchThreshold, reviewThreshold, minFaceAreaPct], O.isSome)
      ? "explicit"
      : "calibrated-default";
    const options = yield* S.decodeEffect(MatchPersonOptions)({
      acceptModelLicense,
      backend: resolvedBackend,
      batchSize,
      cacheDir,
      compute,
      detectionThreshold: thresholds.detectionThreshold,
      devices,
      dir,
      json,
      manifest,
      matchThreshold: thresholds.matchThreshold,
      minFaceAreaPct: thresholds.minFaceAreaPct,
      outDir,
      overwrite,
      recursive,
      references,
      reviewThreshold: thresholds.reviewThreshold,
      thresholdSource,
    }).pipe(FilesCommandError.mapError("Invalid match-person options."));
    yield* runFilesProgram(matchPerson(options));
  })
).pipe(
  Command.withDescription("Match one trusted person across a local photo collection with a pinned local backend"),
  Command.provide(FilesCommandServiceLive)
);

const filesNormalizeCommand = Command.make(
  "normalize",
  {
    dedupe: normalizeDedupeFlag,
    dir: normalizeDirFlag,
    dryRun: normalizeDryRunFlag,
    format: normalizeFormatFlag,
    manifest: manifestFlag,
    maxLongEdge: maxLongEdgeFlag,
    moveDuplicatesTo: normalizeMoveDuplicatesToFlag,
    outDir: normalizeOutDirFlag,
    overwrite: overwriteFlag,
  },
  Effect.fn(function* ({ dedupe, dir, dryRun, format, manifest, maxLongEdge, moveDuplicatesTo, outDir, overwrite }) {
    const effectiveDedupe = dedupe || O.isSome(moveDuplicatesTo);

    yield* runFilesProgram(
      normalizeFiles(
        NormalizeFilesOptions.make({
          dedupe: effectiveDedupe,
          dir,
          dryRun,
          format,
          manifest,
          maxLongEdge,
          moveDuplicatesTo,
          outDir,
          overwrite,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Normalize direct image files into an output directory and write a manifest"),
  Command.provide(FilesCommandServiceLive)
);

const filesProcessCommand = Command.make(
  "process",
  {
    engine: processEngineFlag,
    exportChildren: processExportChildrenFlag,
    failurePolicy: processFailurePolicyFlag,
    input: processInputFlag,
    java: processJavaFlag,
    maxMaterializedBytes: maxMaterializedBytesFlag,
    outDir: processOutDirFlag,
    overwrite: processOverwriteFlag,
    pffexport: processPffexportFlag,
    tikaJar: processTikaJarFlag,
    tikaUrl: processTikaUrlFlag,
  },
  Effect.fn(function* ({
    engine,
    exportChildren,
    failurePolicy,
    input,
    java,
    maxMaterializedBytes,
    outDir,
    overwrite,
    pffexport,
    tikaJar,
    tikaUrl,
  }) {
    yield* runFilesProgram(
      processFiles(
        ProcessFilesOptions.make({
          engine,
          exportChildren,
          failurePolicy,
          input,
          outDir,
          overwrite,
          ...(O.isNone(maxMaterializedBytes) ? {} : { maxMaterializedBytes: maxMaterializedBytes.value }),
          ...O.getSomesStruct({
            javaPath: java,
            pffexportPath: pffexport,
            tikaJarPath: tikaJar,
            tikaUrl,
          }),
        })
      )
    );
  })
).pipe(
  Command.withDescription(
    "Process files into the V1 file-processing proof manifest tree; point --input at generated fixtures or an operator-local corpus (coverage.json is the coverage profile)"
  ),
  Command.provide(FilesCommandServiceLive)
);

const filesSortAndRenameCommand = Command.make(
  "sort-and-rename",
  {
    dir: sortDirFlag,
    dryRun: sortDryRunFlag,
    prefix: prefixFlag,
    withDimensions: withDimensionsFlag,
  },
  Effect.fn(function* ({ dir, dryRun, prefix, withDimensions }) {
    yield* runFilesProgram(sortAndRenameFiles(dir, prefix, dryRun, withDimensions));
  })
).pipe(
  Command.withDescription("Sort direct files by size and rename them with a generated prefix"),
  Command.provide(FilesCommandServiceLive)
);

const filesFlattenMediaCommand = Command.make(
  "flatten-media",
  {
    dir: flattenMediaDirFlag,
    dryRun: flattenMediaDryRunFlag,
    outDir: flattenMediaOutDirFlag,
  },
  Effect.fn(function* ({ dir, dryRun, outDir }) {
    yield* runFilesProgram(flattenMediaFiles(FlattenMediaOptions.make({ dir, dryRun, outDir })));
  })
).pipe(
  Command.withDescription("Recursively move image and video files into a flat directory"),
  Command.provide(FilesCommandServiceLive)
);

const filesStripMetadataCommand = Command.make(
  "strip-metadata",
  {
    dir: stripDirFlag,
    dryRun: stripDryRunFlag,
  },
  Effect.fn(function* ({ dir, dryRun }) {
    yield* runFilesProgram(stripMetadataFiles(dir, dryRun));
  })
).pipe(
  Command.withDescription("Strip metadata from direct image and video files"),
  Command.provide(FilesCommandServiceLive)
);

/**
 * File curation command group.
 *
 * **Example** (Run files command group)
 *
 * ```ts
 * import { filesCommand } from "@beep/repo-cli/commands/Files"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(filesCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const filesCommand = Command.make("files", {}, () => printFilesIndex).pipe(
  Command.withDescription("Dataset file curation commands"),
  Command.withSubcommands([
    filesAuditImagesCommand,
    filesArchivePoorCandidatesCommand,
    filesCreateCaptionsCommand,
    filesCropBordersCommand,
    filesCurateImagesCommand,
    filesDetectBordersCommand,
    filesDetectFacesCommand,
    filesFlattenMediaCommand,
    filesMatchPersonCommand,
    filesNormalizeCommand,
    filesProcessCommand,
    filesSortAndRenameCommand,
    filesStripMetadataCommand,
  ])
);
