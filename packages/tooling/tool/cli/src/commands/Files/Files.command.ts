/**
 * Command definitions for dataset file curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { FilesCommandError } from "./Files.errors.ts";
import {
  ArchivePoorCandidatesOptions,
  CreateCaptionFilesOptions,
  CropBordersOptions,
  DetectBordersOptions,
  FlattenMediaOptions,
  ImageAuditOptions,
  ImageCurationOptions,
  MatchPersonOptions,
  NormalizeFilesOptions,
  PersonMatchThresholdProfile,
  ProcessFilesOptions,
  SortAndRenameOptions,
} from "./Files.schemas.ts";
import {
  archivePoorCandidates,
  auditImages,
  createCaptionFiles,
  cropBordersFiles,
  curateImages,
  detectBordersFiles,
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

const decodeMatchPersonOptions = S.decodeEffect(MatchPersonOptions);

const runFilesProgram = <A>(
  effect: Effect.Effect<A, FilesCommandError, FilesCommandService>
): Effect.Effect<void, FilesCommandError, FilesCommandService> => effect.pipe(Effect.asVoid);

const sortDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct regular files should be sorted and renamed")
);
const flattenMediaDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory recursively searched for image and video files to move")
);
const stripDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image and video files should have metadata stripped")
);
const normalizeDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be normalized")
);
const createCaptionsDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should receive same-stem caption sidecars")
);
const detectBordersDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be scanned for solid borders")
);
const cropBordersDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be cropped when solid borders are detected")
);
const archiveCandidatesDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be assessed for poor-candidate archival")
);
const auditImagesDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory whose direct image files should be audited without mutation")
);
const auditImagesManifestFlag = Flag.Path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Path to the image audit manifest")
);
const curateImagesDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Immutable source directory containing direct image files")
);
const curateImagesDecisionsFlag = Flag.File("decisions", { mustExist: true }).pipe(
  Flag.withDescription("Complete hash-pinned image curation decision ledger")
);
const curateImagesOutDirFlag = Flag.Directory("out-dir").pipe(
  Flag.withDescription("Output root for canonical, holdout, reserve, archive, and manifest derivatives")
);
const curateImagesManifestFlag = Flag.Path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Curation manifest output path; defaults to --out-dir/manifests/image-curation-manifest.json"),
  Flag.optional
);
const matchPersonDirFlag = Flag.Directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Candidate photo directory to scan for the target person")
);
const matchPersonReferencesFlag = Flag.Directory("references", { mustExist: true }).pipe(
  Flag.withDescription("Trusted reference directory whose images contain only the target person")
);
const matchPersonManifestFlag = Flag.Path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Required schema-versioned person-match manifest output path")
);
const matchPersonOutDirFlag = Flag.Directory("out-dir").pipe(
  Flag.withDescription("Optional directory receiving non-destructive accepted and review copies"),
  Flag.optional
);
const matchPersonCacheDirFlag = Flag.Directory("cache-dir").pipe(
  Flag.withDescription("Optional cache root for pinned face-recognition models and generated ONNX graphs"),
  Flag.optional
);
const matchPersonBackendFlag = Flag.ChoiceWithValue("backend", [
  ["buffalo-l", "buffalo-l"],
  ["adaface-kprpe", "adaface-kprpe"],
]).pipe(
  Flag.withDescription(
    "Recognition backend: AdaFace on Linux x64; Buffalo CPU on Linux x64/arm64, macOS x64/arm64, or Windows x64"
  ),
  Flag.optional
);
const archiveDirFlag = Flag.Directory("archive-dir").pipe(
  Flag.withDescription("Directory that receives archived poor image candidates")
);
const normalizeOutDirFlag = Flag.Directory("out-dir").pipe(
  Flag.withDescription("Output directory for normalized image files")
);
const flattenMediaOutDirFlag = Flag.Directory("out-dir").pipe(
  Flag.withDescription("Flat output directory for moved image and video files")
);
const processInputFlag = Flag.Path("input", { mustExist: true, pathType: "either" }).pipe(
  Flag.withDescription("File or directory to process into a V1 proof manifest")
);
const processOutDirFlag = Flag.Directory("out-dir").pipe(
  Flag.withDescription("Output directory for the V1 file-processing proof manifest")
);
const normalizeFormatFlag = Flag.ChoiceWithValue("format", [
  ["png", "png"],
  ["jpg", "jpg"],
  ["jpeg", "jpg"],
  ["webp", "webp"],
]).pipe(Flag.withDefault("png"), Flag.withDescription("Output image format: png, jpg/jpeg, or webp"));
const processEngineFlag = Flag.ChoiceWithValue("engine", [
  ["auto", "auto"],
  ["tika", "tika"],
  ["libpff", "libpff"],
  ["test", "test"],
]).pipe(Flag.withDefault("auto"), Flag.withDescription("File-processing engine: auto, tika, libpff, or test"));
const processFailurePolicyFlag = Flag.ChoiceWithValue("failure-policy", [
  ["fail-on-error", "fail-on-error"],
  ["continue", "continue"],
]).pipe(Flag.withDefault("fail-on-error"), Flag.withDescription("Exit policy for failed source rows"));
const maxMaterializedBytesFlag = Flag.Int("max-materialized-bytes").pipe(
  Flag.withDescription("Maximum materialized text bytes per source"),
  Flag.optional
);
const maxLongEdgeFlag = Flag.Int("max-long-edge").pipe(
  Flag.withDescription("Resize long edge down to this pixel count without upscaling"),
  Flag.optional
);
const manifestFlag = Flag.Path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Manifest output path; defaults to --out-dir/normalize-manifest.json"),
  Flag.optional
);
const archiveManifestFlag = Flag.Path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Manifest output path; defaults to --archive-dir/archive-poor-candidates-manifest.json"),
  Flag.optional
);
const prefixFlag = Flag.String("prefix").pipe(
  Flag.withDescription("Generated filename prefix without dots, path separators, or embedded NUL bytes")
);
const sortDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned renames without touching files")
);
const flattenMediaDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned moves without touching files")
);
const stripDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned metadata rewrites without touching files")
);
const normalizeDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned normalizations without writing files")
);
const createCaptionsDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned caption sidecars without writing files")
);
const archiveDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the planned poor-candidate archival without moving files")
);
const curateImagesDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Validate and print every disposition without writing derivatives")
);
const auditImagesOverwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite an existing regular-file image audit manifest")
);
const curateImagesOverwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing regular-file curation outputs and manifest")
);
const matchPersonOverwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite an existing regular-file manifest and matching output files")
);
const matchPersonRecursiveFlag = Flag.Boolean("recursive").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Recursively scan nested candidate and reference directories")
);
const matchPersonAcceptModelLicenseFlag = Flag.Boolean("accept-model-license").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Accept the selected model and training-dataset license notices")
);
const captionTextFlag = Flag.String("caption").pipe(
  Flag.withDefault(""),
  Flag.withDescription("Caption text to write to newly created sidecar files")
);
const normalizeDedupeFlag = Flag.Boolean("dedupe").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Skip later files whose normalized bytes exactly duplicate an earlier normalized output; implied by --move-duplicates-to"
  )
);
const processExportChildrenFlag = Flag.Boolean("export-children").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Export child artifacts from archive-like sources such as PST")
);
const normalizeMoveDuplicatesToFlag = Flag.Directory("move-duplicates-to").pipe(
  Flag.withDescription("Move later duplicate source files to this directory after exact normalized-byte dedupe"),
  Flag.optional
);
const cropBordersDryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print detected border crops without rewriting files")
);
const overwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing normalized outputs, duplicate move targets, and manifest")
);
const archiveOverwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing archived files, sidecars, and manifest")
);
const processOverwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite an existing files process output directory")
);
const processTikaJarFlag = Flag.File("tika-jar", { mustExist: true }).pipe(
  Flag.withDescription("Apache tika-app jar; selects the Tika App engine for non-PST extraction"),
  Flag.optional
);
const processJavaFlag = Flag.String("java").pipe(
  Flag.withDescription("java binary used to run the tika-app jar"),
  Flag.optional
);
const processTikaUrlFlag = Flag.String("tika-url").pipe(
  Flag.withDescription("Tika Server base URL; defaults to the BEEP_TIKA_* environment configuration"),
  Flag.optional
);
const processPffexportFlag = Flag.String("pffexport").pipe(
  Flag.withDescription("pffexport binary used for PST archive export"),
  Flag.optional
);
const createCaptionsOverwriteFlag = Flag.Boolean("overwrite").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite existing caption sidecar files")
);
const withDimensionsFlag = Flag.Boolean("with-dimensions").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include probed image or video dimensions in generated media filenames")
);
const withAspectRatioFlag = Flag.Boolean("with-aspect-ratio").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Append reduced display aspect ratio, for example ar16x9")
);
const withDateCreatedFlag = Flag.Boolean("with-date-created").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Append UTC creation time; m/b/n marks media, birth time, or now")
);
const withHashFlag = Flag.Boolean("with-hash").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Append full SHA-256 hash of original media bytes")
);
const withSizeMbFlag = Flag.Boolean("with-size-mb").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Append decimal megabytes rounded to two places")
);
const candidateProfileFlag = Flag.ChoiceWithValue("profile", [["character-lora", "character-lora"]]).pipe(
  Flag.withDefault("character-lora"),
  Flag.withDescription("Candidate assessment profile")
);
const targetResolutionFlag = Flag.Int("target-resolution").pipe(
  Flag.withDefault(1024),
  Flag.withDescription("Square training target resolution used to estimate required upscaling")
);
const minShortEdgeFlag = Flag.Int("min-short-edge").pipe(
  Flag.withDefault(512),
  Flag.withDescription("Archive images whose shorter edge is below this pixel count")
);
const maxAspectFlag = Flag.Finite("max-aspect").pipe(
  Flag.withDefault(3),
  Flag.withDescription("Archive images whose long-edge to short-edge ratio exceeds this value")
);
const maxUpscaleFlag = Flag.Finite("max-upscale").pipe(
  Flag.withDefault(1.5),
  Flag.withDescription("Archive images that would need more than this scale factor to reach the target area")
);
const sidecarsFlag = Flag.String("sidecars").pipe(
  Flag.withDefault("txt"),
  Flag.withDescription("Same-stem sidecars to move with archived images: none or a comma-separated extension list")
);
const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Emit a machine-readable JSON report")
);
const borderToleranceFlag = Flag.Finite("tolerance").pipe(
  Flag.withDefault(12),
  Flag.withDescription("Maximum RGB channel distance for near-solid border pixels")
);
const minSolidPctFlag = Flag.Finite("min-solid-pct").pipe(
  Flag.withDefault(98.5),
  Flag.withDescription("Minimum percent of pixels in a border row or column that must match the edge color")
);
const minWidthPctFlag = Flag.Finite("min-width-pct").pipe(
  Flag.withDefault(1),
  Flag.withDescription("Minimum border width as a percent of the scanned image dimension")
);
const maxScanPctFlag = Flag.Finite("max-scan-pct").pipe(
  Flag.withDefault(45),
  Flag.withDescription("Maximum percent of each image dimension to scan inward from an edge")
);
const matchPersonDetectionThresholdFlag = Flag.Finite("detection-threshold").pipe(
  Flag.withDescription("Override the backend profile's minimum face-detection confidence between 0 and 1"),
  Flag.optional
);
const matchPersonMatchThresholdFlag = Flag.Finite("match-threshold").pipe(
  Flag.withDescription("Override the backend profile's minimum target-person cosine similarity between 0 and 1"),
  Flag.optional
);
const matchPersonReviewThresholdFlag = Flag.Finite("review-threshold").pipe(
  Flag.withDescription("Override the backend profile's lower cosine-similarity boundary for identity review"),
  Flag.optional
);
const matchPersonMinFaceAreaPctFlag = Flag.Finite("min-face-area-pct").pipe(
  Flag.withDescription("Override the backend profile's minimum matched-face percentage of the full image area"),
  Flag.optional
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

const filesAuditImagesCommand = Command.make(
  "audit-images",
  {
    dir: auditImagesDirFlag,
    manifest: auditImagesManifestFlag,
    overwrite: auditImagesOverwriteFlag,
  },
  Effect.fn(function* ({ dir, manifest, overwrite }) {
    yield* runFilesProgram(
      auditImages(
        ImageAuditOptions.make({
          dir,
          manifest,
          overwrite,
        })
      )
    );
  })
).pipe(
  Command.withDescription("Audit image hashes, geometry, metadata presence, and advisory quality"),
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

const filesMatchPersonCommandDefinition = Command.make(
  "match-person",
  {
    acceptModelLicense: matchPersonAcceptModelLicenseFlag,
    backend: matchPersonBackendFlag,
    cacheDir: matchPersonCacheDirFlag,
    detectionThreshold: matchPersonDetectionThresholdFlag,
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
    cacheDir,
    detectionThreshold,
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
    const options = yield* decodeMatchPersonOptions({
      acceptModelLicense,
      backend: resolvedBackend,
      batchSize: 1,
      cacheDir,
      detectionThreshold: thresholds.detectionThreshold,
      devices: O.none(),
      compute: "cpu",
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
).pipe(Command.withDescription("Match one trusted person across a local photo collection with a pinned local backend"));

/**
 * Build the matcher command with an explicit service layer for runtime composition and tests.
 *
 * **Example** (Build the live command)
 *
 * ```ts
 * import { makeFilesMatchPersonCommand, FilesCommandServiceLive } from "@beep/repo-cli/test/Files"
 * const command = makeFilesMatchPersonCommand(FilesCommandServiceLive)
 * console.log(command)
 * ```
 *
 * @param serviceLayer - Files command service implementation to provide.
 * @returns The match-person subcommand.
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const makeFilesMatchPersonCommand = (serviceLayer: typeof FilesCommandServiceLive) =>
  filesMatchPersonCommandDefinition.pipe(Command.provide(serviceLayer));
const filesMatchPersonCommand = filesMatchPersonCommandDefinition.pipe(Command.provide(FilesCommandServiceLive));

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
    withAspectRatio: withAspectRatioFlag,
    withDateCreated: withDateCreatedFlag,
    withDimensions: withDimensionsFlag,
    withHash: withHashFlag,
    withSizeMb: withSizeMbFlag,
  },
  Effect.fn(function* ({
    dir,
    dryRun,
    prefix,
    withAspectRatio,
    withDateCreated,
    withDimensions,
    withHash,
    withSizeMb,
  }) {
    yield* runFilesProgram(
      sortAndRenameFiles(
        dir,
        prefix,
        dryRun,
        SortAndRenameOptions.make({
          withAspectRatio,
          withDateCreated,
          withDimensions,
          withHash,
          withSizeMb,
        })
      )
    );
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
 * import * as Command from "effect/cli/Command";
 * import * as Effect from "effect/Effect";
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
    filesFlattenMediaCommand,
    filesMatchPersonCommand,
    filesNormalizeCommand,
    filesProcessCommand,
    filesSortAndRenameCommand,
    filesStripMetadataCommand,
  ])
);
