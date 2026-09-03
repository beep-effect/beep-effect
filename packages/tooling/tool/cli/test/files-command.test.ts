import { createHash } from "node:crypto";
import { Chalk } from "@beep/chalk";
import { createColors } from "@beep/colors";
import {
  ChildArtifactRecord,
  FileProcessingCoverageSummary,
  FileProcessingFailureRecord,
  ProcessRunManifest,
  SourceProcessingRecord,
} from "@beep/file-processing/Extraction";
import { filesCommand } from "@beep/repo-cli";
import { CommandJsonOutput } from "@beep/repo-cli/test/Cli";
import {
  ArchivePoorCandidatesManifest,
  boundedPersonMatchDirectoryNamesForTesting,
  CanonicalMatchPersonInputs,
  DetectBordersReport,
  DetectFacesReport,
  FilesCommandServiceLive,
  FlattenMediaOptions,
  flattenMediaFiles,
  ImageAuditManifest,
  ImageCurationDecisionDocument,
  ImageCurationManifest,
  MatchPersonOptions,
  NormalizeManifest,
  PersonMatchDeviceIndexesFromCsv,
  PersonMatchModel,
  PersonMatchModelArtifactVerifier,
  PersonMatchReport,
  PersonMatchWorkerPolicyForTest,
  PersonMatchWorkerReport,
  PersonMatchWorkerService,
  PersonMatchWorkerSuccess,
  PreparedAdaFaceArtifacts,
  ProcessFilesOptions,
  processFiles,
  renderFilesProgressBar,
  runMatchPerson,
} from "@beep/repo-cli/test/Files";
import { fcRuns } from "@beep/test-utils";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, ConfigProvider, Data, Effect, Exit, FileSystem, Layer, Order, Path, pipe } from "effect";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer, FetchHttpClient.layer);
const runFilesCommand = Command.runWith(filesCommand, { version: "0.0.0" });
const decodeArchivePoorCandidatesManifest = S.decodeUnknownSync(S.fromJsonString(ArchivePoorCandidatesManifest));
const decodeDetectBordersReport = S.decodeUnknownSync(S.fromJsonString(DetectBordersReport));
const decodeDetectFacesReport = S.decodeUnknownEffect(S.fromJsonString(DetectFacesReport));
const decodeImageAuditManifest = S.decodeUnknownEffect(S.fromJsonString(ImageAuditManifest));
const decodeImageCurationManifest = S.decodeUnknownEffect(S.fromJsonString(ImageCurationManifest));
const decodeChildArtifactRecord = S.decodeUnknownEffect(S.fromJsonString(ChildArtifactRecord));
const decodeFileProcessingCoverageSummary = S.decodeUnknownEffect(S.fromJsonString(FileProcessingCoverageSummary));
const decodeFileProcessingFailureRecord = S.decodeUnknownEffect(S.fromJsonString(FileProcessingFailureRecord));
const decodeNormalizeManifest = S.decodeUnknownSync(S.fromJsonString(NormalizeManifest));
const decodePersonMatchReport = S.decodeUnknownEffect(S.fromJsonString(PersonMatchReport));
const decodePersonMatchWorkerSuccess = S.decodeUnknownEffect(PersonMatchWorkerSuccess);
const decodeProcessRunManifest = S.decodeUnknownEffect(S.fromJsonString(ProcessRunManifest));
const decodeSourceProcessingRecord = S.decodeUnknownEffect(S.fromJsonString(SourceProcessingRecord));
const encodeDetectBordersReport = S.encodeUnknownEffect(S.fromJsonString(DetectBordersReport));
const encodeImageAuditManifest = S.encodeUnknownEffect(S.fromJsonString(ImageAuditManifest));
const encodeImageCurationDecisionDocument = S.encodeUnknownEffect(S.fromJsonString(ImageCurationDecisionDocument));
const encodeImageCurationManifest = S.encodeUnknownEffect(S.fromJsonString(ImageCurationManifest));
const encodeChildArtifactRecord = S.encodeUnknownEffect(S.fromJsonString(ChildArtifactRecord));
const encodeFileProcessingCoverageSummary = S.encodeUnknownEffect(S.fromJsonString(FileProcessingCoverageSummary));
const encodeFileProcessingFailureRecord = S.encodeUnknownEffect(S.fromJsonString(FileProcessingFailureRecord));
const encodeNormalizeManifest = S.encodeUnknownEffect(S.fromJsonString(NormalizeManifest));
const encodeProcessRunManifest = S.encodeUnknownEffect(S.fromJsonString(ProcessRunManifest));
const encodeSourceProcessingRecord = S.encodeUnknownEffect(S.fromJsonString(SourceProcessingRecord));
const encodeUnknownJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const DetectBordersReportArbitrary = S.toArbitrary(DetectBordersReport)(fc);
const ChildArtifactRecordArbitrary = S.toArbitrary(ChildArtifactRecord)(fc);
const FileProcessingCoverageSummaryArbitrary = S.toArbitrary(FileProcessingCoverageSummary)(fc);
const FileProcessingFailureRecordArbitrary = S.toArbitrary(FileProcessingFailureRecord)(fc);
const NormalizeManifestArbitrary = S.toArbitrary(NormalizeManifest)(fc);
const ImageAuditManifestArbitrary = S.toArbitrary(ImageAuditManifest)(fc);
const ImageCurationManifestArbitrary = S.toArbitrary(ImageCurationManifest)(fc);
const ProcessRunManifestArbitrary = S.toArbitrary(ProcessRunManifest)(fc);
const SourceProcessingRecordArbitrary = S.toArbitrary(SourceProcessingRecord)(fc);
const decodeChildArtifactRecordLine = (line: string) => decodeChildArtifactRecord(line);
const decodeFileProcessingFailureRecordLine = (line: string) => decodeFileProcessingFailureRecord(line);
const decodeSourceProcessingRecordLine = (line: string) => decodeSourceProcessingRecord(line);
const isString = (value: unknown): value is string => typeof value === "string";

class FilesTestError extends Data.TaggedError("FilesTestError")<{ readonly cause: unknown }> {}

const filesTestError = (cause: unknown) => new FilesTestError({ cause });

const expectFilesCommandFailure = Effect.fn("FilesCommandTest.expectFilesCommandFailure")(function* (
  args: ReadonlyArray<string>
) {
  const exit = yield* Effect.exit(runFilesCommand(args));
  expect(Exit.isFailure(exit)).toBe(true);

  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    if (P.hasProperty(error, "message") && P.isString(error.message)) {
      return error.message;
    }

    return Cause.pretty(exit.cause);
  }

  return "";
});

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();

      process.chdir(tmpDir);

      return { fs, previousCwd, tmpDir } as const;
    }),
    ({ tmpDir }) => use(tmpDir),
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  ).pipe(provideScopedLayer(testLayer));

const makeDatasetDir = Effect.fn("FilesTest.makeDatasetDir")(function* (tmpDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const datasetDir = path.join(tmpDir, "dataset");
  yield* fs.makeDirectory(datasetDir, { recursive: true });
  return datasetDir;
});

const writeSizedFile = Effect.fn("FilesTest.writeSizedFile")(function* (filePath: string, size: number, fill: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, pipe(fill, Str.repeat(size)));
});

// Hermetic stand-ins for the real engines (corpus-test pattern): the java stub
// prints a tika-app JSON response, and the pffexport stub materializes a
// one-message export tree the libpff driver assembles EML/JSONL from.
const stubProcessJava = `#!/usr/bin/env bash
printf '%s' '[{"Content-Type":"text/plain","X-TIKA:content":"\\n  stub text body\\n"}]'
`;

const stubProcessPffexport = `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then printf 'pffexport 20260608\\n'; exit 0; fi
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
source="\${@: -1}"
[ -f "$source" ] || exit 2
item="$target.export/Inbox/Message00001"
mkdir -p "$item/Attachments"
printf 'Subject:\\tproof message\\nSender name:\\tAda\\nSender email address:\\tada@example.com\\n' > "$item/OutlookHeaders.txt"
printf 'proof body' > "$item/Message.txt"
printf 'pdfbytes' > "$item/Attachments/report.pdf"
exit 0
`;

const writeProcessStub = Effect.fn("FilesTest.writeProcessStub")(function* (script: string, stubPath: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(stubPath, script);
  yield* fs.chmod(stubPath, 0o755);
});

const writeSvgFile = Effect.fn("FilesTest.writeSvgFile")(function* (
  filePath: string,
  width: number,
  height: number,
  padding = 0
) {
  const fs = yield* FileSystem.FileSystem;
  const filler = pipe("x", Str.repeat(padding));
  yield* fs.writeFileString(
    filePath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${filler}</svg>`
  );
});

const writeJpegWithExif = Effect.fn("FilesTest.writeJpegWithExif")(function* (
  filePath: string,
  width: number,
  height: number
) {
  yield* Effect.tryPromise({
    try: () =>
      sharp({
        create: {
          background: { alpha: 1, b: 48, g: 32, r: 16 },
          channels: 3,
          height,
          width,
        },
      })
        .jpeg()
        .withExif({
          IFD0: {
            Copyright: "beep-secret",
            ImageDescription: "dataset-source",
          },
        })
        .toFile(filePath),
    catch: filesTestError,
  }).pipe(Effect.asVoid);
});

const writeJpegWithOrientationExif = Effect.fn("FilesTest.writeJpegWithOrientationExif")(function* (
  filePath: string,
  width: number,
  height: number,
  orientation: number
) {
  yield* Effect.tryPromise({
    try: () =>
      sharp({
        create: {
          background: { alpha: 1, b: 32, g: 64, r: 96 },
          channels: 3,
          height,
          width,
        },
      })
        .jpeg()
        .withMetadata({ orientation })
        .withExif({
          IFD0: {
            ImageDescription: "oriented-source",
          },
        })
        .toFile(filePath),
    catch: filesTestError,
  }).pipe(Effect.asVoid);
});

const readImageMetadata = Effect.fn("FilesTest.readImageMetadata")(function* (filePath: string) {
  return yield* Effect.tryPromise({
    try: () => sharp(filePath).metadata(),
    catch: filesTestError,
  });
});

const readNormalizeManifest = Effect.fn("FilesTest.readNormalizeManifest")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath);
  return decodeNormalizeManifest(content);
});

const readArchivePoorCandidatesManifest = Effect.fn("FilesTest.readArchivePoorCandidatesManifest")(function* (
  filePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath);
  return decodeArchivePoorCandidatesManifest(content);
});

const readDetectBordersJsonLog = Effect.fn("FilesTest.readDetectBordersJsonLog")(function* () {
  const lines = A.filter(yield* TestConsole.logLines, isString);
  return decodeDetectBordersReport(A.join("\n")(lines));
});

const readDetectFacesJsonLog = Effect.fn("FilesTest.readDetectFacesJsonLog")(function* () {
  const lines = A.filter(yield* TestConsole.logLines, isString);
  return yield* decodeDetectFacesReport(A.join("\n")(lines)).pipe(Effect.mapError(filesTestError));
});

const readDetectFacesManifest = Effect.fn("FilesTest.readDetectFacesManifest")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath);
  return yield* decodeDetectFacesReport(content).pipe(Effect.mapError(filesTestError));
});

const readPersonMatchManifest = Effect.fn("FilesTest.readPersonMatchManifest")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath);
  return yield* decodePersonMatchReport(content).pipe(Effect.mapError(filesTestError));
});

const insightFaceModelSource = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip";
const insightFaceModelLicenseNotice =
  "InsightFace pretrained-model terms: https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md";
const cvlFaceModelLicenseNotice =
  "CVLFace code is MIT-licensed; checkpoint use is also subject to the training-dataset and model-card terms at the pinned source.";

const makeBuffaloModelFixture = (path: Path.Path, cacheDir: string) => {
  const root = path.join(cacheDir, "insightface");
  const runtimeRoot = path.join(root, "models", "beep_buffalo_l_v1");
  return {
    backend: "buffalo-l",
    name: "buffalo_l",
    packageName: "insightface",
    packageVersion: "1.0.1",
    runtime: {
      framework: "onnxruntime",
      packageVersion: "1.23.2",
      actualCompute: "cpu",
      precision: "fp32",
      providers: ["CPUExecutionProvider"],
      devices: [],
      warnings: [],
    },
    allowedModules: ["detection", "recognition"],
    root,
    components: [
      {
        role: "detector",
        name: "insightface-det_10g",
        revision: "v0.7",
        source: insightFaceModelSource,
        licenseNotice: insightFaceModelLicenseNotice,
        artifacts: [
          {
            name: "det_10g.onnx",
            path: path.join(runtimeRoot, "det_10g.onnx"),
            sizeBytes: 16_923_827,
            sha256: "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
          },
        ],
      },
      {
        role: "recognizer",
        name: "insightface-w600k_r50",
        revision: "v0.7",
        source: insightFaceModelSource,
        licenseNotice: insightFaceModelLicenseNotice,
        artifacts: [
          {
            name: "w600k_r50.onnx",
            path: path.join(runtimeRoot, "w600k_r50.onnx"),
            sizeBytes: 174_383_860,
            sha256: "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
          },
        ],
      },
    ],
  };
};

const makeAdaFaceModelFixture = (path: Path.Path, cacheDir: string) => {
  const root = path.join(cacheDir, "adaface-kprpe");
  return {
    backend: "adaface-kprpe",
    name: "cvlface_adaface_vit_base_kprpe_webface12m",
    codeRevision: "308142aa50adf2e187711354f7524635d3414f1e",
    runtime: {
      framework: "pytorch",
      distribution: "rocm72",
      packageVersion: "2.9.1+rocm7.2.0.git7e1940d4",
      hipVersion: "7.2.26015-fc0010cf6a",
      actualCompute: "rocm",
      precision: "fp32",
      devices: [{ index: 0, name: "AMD Radeon AI PRO R9700", architecture: "gfx1201" }],
      warnings: [],
    },
    root,
    components: [
      {
        role: "detector",
        name: "insightface-det_10g",
        revision: "v0.7",
        source: insightFaceModelSource,
        licenseNotice: insightFaceModelLicenseNotice,
        artifacts: [
          {
            name: "det_10g.onnx",
            path: path.join(root, "models", "beep_buffalo_l_v1", "det_10g.onnx"),
            sizeBytes: 16_923_827,
            sha256: "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
          },
        ],
      },
      {
        role: "aligner",
        name: "cvlface_DFA_mobilenet",
        revision: "8317e6dda53d91e7074979923144c2cc08906a33",
        source:
          "https://huggingface.co/minchul/cvlface_DFA_mobilenet/resolve/8317e6dda53d91e7074979923144c2cc08906a33/model.safetensors",
        licenseNotice: cvlFaceModelLicenseNotice,
        artifacts: [
          {
            name: "model.safetensors",
            path: path.join(root, "pinned", "aligner", "model.safetensors"),
            sizeBytes: 2_007_980,
            sha256: "80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a",
          },
        ],
      },
      {
        role: "recognizer",
        name: "cvlface_adaface_vit_base_kprpe_webface12m",
        revision: "daefd5012d369588bd214fbaf4cc6b1d286e7066",
        source:
          "https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m/resolve/daefd5012d369588bd214fbaf4cc6b1d286e7066/model.safetensors",
        licenseNotice: cvlFaceModelLicenseNotice,
        artifacts: [
          {
            name: "model.safetensors",
            path: path.join(root, "pinned", "recognizer", "model.safetensors"),
            sizeBytes: 460_344_344,
            sha256: "99d16ed4aac0fdf0fcc82526b9b70703f3ec8c3041bf1bf44bd22751536e65db",
          },
        ],
      },
    ],
  };
};

const buffaloParametersFixture = {
  backend: "buffalo-l",
  compute: "auto",
  actualCompute: "cpu",
  devices: [],
  batchSize: 32,
  precision: "fp32",
  thresholdSource: "calibrated-default",
  detectionThreshold: 0.6,
  matchThreshold: 0.5,
  reviewThreshold: 0.35,
  minFaceAreaPct: 1,
  recursive: false,
};

const adaFaceRocmParametersFixture = {
  backend: "adaface-kprpe",
  compute: "rocm",
  actualCompute: "rocm",
  devices: [0],
  batchSize: 32,
  precision: "fp32",
  thresholdSource: "calibrated-default",
  detectionThreshold: 0.6,
  matchThreshold: 0.5,
  reviewThreshold: 0.35,
  minFaceAreaPct: 1,
  recursive: false,
};

const workerLimitsFixture = {
  referenceImages: 256,
  candidateImages: 10_000,
  facesPerImage: 32,
  reportedFaces: 65_536,
  reportBytes: 67_108_864,
  diagnosticBytes: 1_048_576,
};

const makePersonMatchFaceFixture = (matchScore: number) => ({
  box: { x1: 10, y1: 20, x2: 110, y2: 140 },
  detectionScore: 0.99,
  faceAreaPct: 15,
  matchScore,
  centroidScore: matchScore,
  top3MedianScore: matchScore,
  bestReferenceScore: matchScore,
  bestReferenceName: "reference.jpg",
  qualityFlags: [],
});

const makeAdaFaceRocmWorkerReportFixture = (
  path: Path.Path,
  cacheDir: string,
  candidateDir: string,
  referencePath: string
) => ({
  schemaVersion: "beep.files.match-person.worker.v3",
  ok: true,
  limits: workerLimitsFixture,
  model: makeAdaFaceModelFixture(path, cacheDir),
  parameters: adaFaceRocmParametersFixture,
  references: [
    {
      sourceName: "reference.jpg",
      sourcePath: referencePath,
      accepted: true,
      faceCount: 1,
      detectionScore: 0.99,
    },
  ],
  entries: [
    {
      sourceName: "solo.jpg",
      sourcePath: path.join(candidateDir, "solo.jpg"),
      relativePath: "solo.jpg",
      disposition: "solo-match",
      faceCount: 1,
      bestScore: 0.81,
      faces: [makePersonMatchFaceFixture(0.81)],
    },
    {
      sourceName: "review.jpg",
      sourcePath: path.join(candidateDir, "review.jpg"),
      relativePath: "review.jpg",
      disposition: "review",
      faceCount: 1,
      bestScore: 0.4,
      faces: [makePersonMatchFaceFixture(0.4)],
    },
    {
      sourceName: "no-face.jpg",
      sourcePath: path.join(candidateDir, "no-face.jpg"),
      relativePath: "no-face.jpg",
      disposition: "no-face",
      faceCount: 0,
      faces: [],
    },
    {
      sourceName: "aligner-rejected.jpg",
      sourcePath: path.join(candidateDir, "aligner-rejected.jpg"),
      relativePath: "aligner-rejected.jpg",
      disposition: "no-face",
      faceCount: 0,
      faces: [],
      reason: "aligner-confidence-failed",
    },
  ],
  summary: {
    totalCount: 4,
    soloMatchCount: 1,
    groupMatchCount: 0,
    lowQualityMatchCount: 0,
    reviewCount: 1,
    noMatchCount: 0,
    noFaceCount: 2,
    unreadableCount: 0,
    acceptedReferenceCount: 1,
    rejectedReferenceCount: 0,
  },
  elapsedSeconds: 0.25,
});

const makeBuffaloWorkerReportFixture = (
  path: Path.Path,
  cacheDir: string,
  candidateDir: string,
  referencePath: string
) => ({
  schemaVersion: "beep.files.match-person.worker.v3",
  ok: true,
  limits: workerLimitsFixture,
  model: makeBuffaloModelFixture(path, cacheDir),
  parameters: buffaloParametersFixture,
  references: [
    {
      sourceName: "reference.jpg",
      sourcePath: referencePath,
      accepted: true,
      faceCount: 1,
      detectionScore: 0.99,
    },
  ],
  entries: [
    {
      sourceName: "group.jpg",
      sourcePath: path.join(candidateDir, "group.jpg"),
      relativePath: "group.jpg",
      disposition: "group-match",
      faceCount: 2,
      bestScore: 0.72,
      faces: [makePersonMatchFaceFixture(0.72), makePersonMatchFaceFixture(0.1)],
    },
    {
      sourceName: "other.jpg",
      sourcePath: path.join(candidateDir, "other.jpg"),
      relativePath: "other.jpg",
      disposition: "no-match",
      faceCount: 1,
      bestScore: 0.1,
      faces: [makePersonMatchFaceFixture(0.1)],
    },
    {
      sourceName: "solo.jpg",
      sourcePath: path.join(candidateDir, "solo.jpg"),
      relativePath: "solo.jpg",
      disposition: "solo-match",
      faceCount: 1,
      bestScore: 0.81,
      faces: [makePersonMatchFaceFixture(0.81)],
    },
    {
      sourceName: "unreadable.jpg",
      sourcePath: path.join(candidateDir, "unreadable.jpg"),
      relativePath: "unreadable.jpg",
      disposition: "unreadable",
      faceCount: 0,
      faces: [],
      reason: "image-decode-failed",
    },
  ],
  summary: {
    totalCount: 4,
    soloMatchCount: 1,
    groupMatchCount: 1,
    lowQualityMatchCount: 0,
    reviewCount: 0,
    noMatchCount: 1,
    noFaceCount: 0,
    unreadableCount: 1,
    acceptedReferenceCount: 1,
    rejectedReferenceCount: 0,
  },
  elapsedSeconds: 0.25,
});

const writeInsetCanvasImage = Effect.fn("FilesTest.writeInsetCanvasImage")(function* (
  filePath: string,
  width: number,
  height: number,
  inset: { readonly bottom: number; readonly left: number; readonly right: number; readonly top: number },
  background: { readonly b: number; readonly g: number; readonly r: number },
  content: { readonly b: number; readonly g: number; readonly r: number }
) {
  yield* Effect.tryPromise({
    try: () =>
      sharp({
        create: {
          background,
          channels: 3,
          height,
          width,
        },
      })
        .composite([
          {
            input: {
              create: {
                background: content,
                channels: 3,
                height: height - inset.top - inset.bottom,
                width: width - inset.left - inset.right,
              },
            },
            left: inset.left,
            top: inset.top,
          },
        ])
        .png()
        .toFile(filePath),
    catch: filesTestError,
  }).pipe(Effect.asVoid);
});

const writePatternImage = Effect.fn("FilesTest.writePatternImage")(function* (
  filePath: string,
  width: number,
  height: number
) {
  const data = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      data[offset] = (x * 17 + y * 31) % 256;
      data[offset + 1] = (x * 47 + y * 13) % 256;
      data[offset + 2] = (x * 7 + y * 71) % 256;
    }
  }

  yield* Effect.tryPromise({
    try: () =>
      sharp(data, { raw: { channels: 3, height, width } })
        .png()
        .toFile(filePath),
    catch: filesTestError,
  }).pipe(Effect.asVoid);
});

const writeLeftCanvasPatternImage = Effect.fn("FilesTest.writeLeftCanvasPatternImage")(function* (
  filePath: string,
  width: number,
  height: number,
  leftWidth: number
) {
  const data = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      if (x < leftWidth) {
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
        continue;
      }

      data[offset] = (x * 17 + y * 31) % 256;
      data[offset + 1] = (x * 47 + y * 13) % 256;
      data[offset + 2] = (x * 7 + y * 71) % 256;
    }
  }

  yield* Effect.tryPromise({
    try: () =>
      sharp(data, { raw: { channels: 3, height, width } })
        .png()
        .toFile(filePath),
    catch: filesTestError,
  }).pipe(Effect.asVoid);
});

const writeNearSolidJpegBorder = Effect.fn("FilesTest.writeNearSolidJpegBorder")(function* (
  filePath: string,
  width: number,
  height: number,
  borderWidth: number
) {
  const data = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const inBorder = x < borderWidth || x >= width - borderWidth;
      const value = inBorder ? (x + y) % 7 : 140;
      data[offset] = value;
      data[offset + 1] = inBorder ? value : 90;
      data[offset + 2] = inBorder ? value : 40;
    }
  }

  yield* Effect.tryPromise({
    try: () =>
      sharp(data, { raw: { channels: 3, height, width } })
        .jpeg({ quality: 85 })
        .toFile(filePath),
    catch: filesTestError,
  }).pipe(Effect.asVoid);
});

const withEnvVar = <A, E, R>(name: string, value: string, use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousValue = Bun.env[name];
      Bun.env[name] = value;
      return previousValue;
    }),
    () => provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ [name]: value })))(use),
    (previousValue) =>
      Effect.sync(() => {
        if (previousValue === undefined) {
          delete Bun.env[name];
        } else {
          Bun.env[name] = previousValue;
        }
      })
  );

const writeFfprobeShim = Effect.fn("FilesTest.writeFfprobeShim")(function* (
  binDir: string,
  width: number,
  height: number,
  rotation: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const shimPath = path.join(binDir, "ffprobe");
  yield* fs.makeDirectory(binDir, { recursive: true });
  yield* fs.writeFileString(
    shimPath,
    `#!/usr/bin/env sh\nprintf '%s\\n' '{"streams":[{"width":${width},"height":${height},"side_data_list":[{"rotation":${rotation}}]}]}'\n`
  );
  yield* fs.chmod(shimPath, 0o755);
});

const writeFfmpegShim = Effect.fn("FilesTest.writeFfmpegShim")(function* (
  binDir: string,
  argsPath: string,
  outputText = "clean video"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const shimPath = path.join(binDir, "ffmpeg");
  yield* fs.makeDirectory(binDir, { recursive: true });
  yield* fs.writeFileString(
    shimPath,
    `#!/usr/bin/env sh\nprintf '%s\\n' "$@" > '${argsPath}'\nlast=''\nfor arg do last="$arg"; done\nprintf '%s\\n' '${outputText}' > "$last"\n`
  );
  yield* fs.chmod(shimPath, 0o755);
});

const writeFailingFfmpegShim = Effect.fn("FilesTest.writeFailingFfmpegShim")(function* (
  binDir: string,
  argsPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const shimPath = path.join(binDir, "ffmpeg");
  yield* fs.makeDirectory(binDir, { recursive: true });
  yield* fs.writeFileString(
    shimPath,
    `#!/usr/bin/env sh\nprintf '%s\\n' "$@" > '${argsPath}'\nprintf '%s\\n' 'ffmpeg boom' >&2\nexit 7\n`
  );
  yield* fs.chmod(shimPath, 0o755);
});

const sortedDirectoryEntries = Effect.fn("FilesTest.sortedDirectoryEntries")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  return A.sort(yield* fs.readDirectory(dir), Order.String);
});

const fileSize = Effect.fn("FilesTest.fileSize")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs.stat(filePath);
  return stat.size;
});

const sha256FileRef = Effect.fn("FilesTest.sha256FileRef")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(filePath);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
});

describe("files command", { concurrent: false }, () => {
  it("round-trips schema-derived report data through JSON command boundaries", () =>
    fc.assert(
      fc.property(
        DetectBordersReportArbitrary,
        ImageAuditManifestArbitrary,
        ImageCurationManifestArbitrary,
        ChildArtifactRecordArbitrary,
        FileProcessingCoverageSummaryArbitrary,
        FileProcessingFailureRecordArbitrary,
        NormalizeManifestArbitrary,
        ProcessRunManifestArbitrary,
        SourceProcessingRecordArbitrary,
        (
          detectBordersReport,
          imageAuditManifest,
          imageCurationManifest,
          childArtifactRecord,
          coverageSummary,
          failureRecord,
          normalizeManifest,
          processRunManifest,
          sourceProcessingRecord
        ) => {
          const encodedDetectBordersReport = Effect.runSync(encodeDetectBordersReport(detectBordersReport));
          const decodedDetectBordersReport = decodeDetectBordersReport(encodedDetectBordersReport);
          expect(Effect.runSync(encodeDetectBordersReport(decodedDetectBordersReport))).toBe(
            encodedDetectBordersReport
          );

          const encodedImageAuditManifest = Effect.runSync(encodeImageAuditManifest(imageAuditManifest));
          const decodedImageAuditManifest = Effect.runSync(decodeImageAuditManifest(encodedImageAuditManifest));
          expect(Effect.runSync(encodeImageAuditManifest(decodedImageAuditManifest))).toBe(encodedImageAuditManifest);

          const encodedImageCurationManifest = Effect.runSync(encodeImageCurationManifest(imageCurationManifest));
          const decodedImageCurationManifest = Effect.runSync(
            decodeImageCurationManifest(encodedImageCurationManifest)
          );
          expect(Effect.runSync(encodeImageCurationManifest(decodedImageCurationManifest))).toBe(
            encodedImageCurationManifest
          );

          const encodedChildArtifactRecord = Effect.runSync(encodeChildArtifactRecord(childArtifactRecord));
          const decodedChildArtifactRecord = Effect.runSync(decodeChildArtifactRecord(encodedChildArtifactRecord));
          expect(Effect.runSync(encodeChildArtifactRecord(decodedChildArtifactRecord))).toBe(
            encodedChildArtifactRecord
          );

          const encodedCoverageSummary = Effect.runSync(encodeFileProcessingCoverageSummary(coverageSummary));
          const decodedCoverageSummary = Effect.runSync(decodeFileProcessingCoverageSummary(encodedCoverageSummary));
          expect(Effect.runSync(encodeFileProcessingCoverageSummary(decodedCoverageSummary))).toBe(
            encodedCoverageSummary
          );

          const encodedFailureRecord = Effect.runSync(encodeFileProcessingFailureRecord(failureRecord));
          const decodedFailureRecord = Effect.runSync(decodeFileProcessingFailureRecord(encodedFailureRecord));
          expect(Effect.runSync(encodeFileProcessingFailureRecord(decodedFailureRecord))).toBe(encodedFailureRecord);

          const encodedNormalizeManifest = Effect.runSync(encodeNormalizeManifest(normalizeManifest));
          const decodedNormalizeManifest = decodeNormalizeManifest(encodedNormalizeManifest);
          expect(Effect.runSync(encodeNormalizeManifest(decodedNormalizeManifest))).toBe(encodedNormalizeManifest);

          const encodedProcessRunManifest = Effect.runSync(encodeProcessRunManifest(processRunManifest));
          const decodedProcessRunManifest = Effect.runSync(decodeProcessRunManifest(encodedProcessRunManifest));
          expect(Effect.runSync(encodeProcessRunManifest(decodedProcessRunManifest))).toBe(encodedProcessRunManifest);

          const encodedSourceProcessingRecord = Effect.runSync(encodeSourceProcessingRecord(sourceProcessingRecord));
          const decodedSourceProcessingRecord = Effect.runSync(
            decodeSourceProcessingRecord(encodedSourceProcessingRecord)
          );
          expect(Effect.runSync(encodeSourceProcessingRecord(decodedSourceProcessingRecord))).toBe(
            encodedSourceProcessingRecord
          );
        }
      ),
      fcRuns(25)
    ));

  it("renders a plain ascii files progress bar when colors are disabled", () => {
    const rendered = renderFilesProgressBar({
      chalk: new Chalk({ level: 0 }),
      colors: createColors(false),
      completed: 3,
      label: "normalize write",
      total: 6,
      width: 10,
    });

    expect(rendered).toBe("files normalize write <#####-----> 3/6 50.0%");
  });

  it("writes the V1 file-processing proof manifest tree", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* fs.writeFileString(path.join(datasetDir, "note.txt"), "hello proof");
          yield* fs.writeFileString(path.join(datasetDir, "table.xls"), "not extracted");
          yield* fs.writeFileString(path.join(datasetDir, "mailbox.pst"), "pst");

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "test",
            "--export-children",
            "--failure-policy",
            "continue",
          ]);

          const runManifest = yield* decodeProcessRunManifest(yield* fs.readFileString(path.join(outDir, "run.json")));
          const coverage = yield* decodeFileProcessingCoverageSummary(
            yield* fs.readFileString(path.join(outDir, "coverage.json"))
          );
          const sourceLines = pipe(
            yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
            Str.split("\n"),
            A.filter((line) => line.length > 0)
          );
          const sourceRecords = yield* Effect.forEach(sourceLines, decodeSourceProcessingRecordLine);
          const failureLines = pipe(
            yield* fs.readFileString(path.join(outDir, "failures.jsonl")),
            Str.split("\n"),
            A.filter((line) => line.length > 0)
          );
          const failureRecords = yield* Effect.forEach(failureLines, decodeFileProcessingFailureRecordLine);
          const textRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "note.txt"));
          const pstRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "mailbox.pst"));
          const xlsRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "table.xls"));
          const xlsFailure = O.getOrThrow(A.findFirst(failureRecords, (record) => record.relativePath === "table.xls"));
          const childPath = path.join(outDir, "children", `${pstRecord.artifactId}`, "artifacts.jsonl");
          const childRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(childPath),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeChildArtifactRecordLine
          );

          expect(runManifest.manifestVersion).toBe("beep.file-processing.run.v1");
          expect(runManifest.outputRoot).toBe(".");
          expect(runManifest.sourceRootLabel).toBe("input");
          expect(runManifest).not.toHaveProperty("outDir");
          expect(runManifest).not.toHaveProperty("sourceRoot");
          expect(coverage.sourceCount).toBe(3);
          expect(coverage.succeededCount).toBe(2);
          expect(coverage.skippedCount).toBe(1);
          expect(A.map(sourceRecords, (record) => record.relativePath)).toEqual([
            "mailbox.pst",
            "note.txt",
            "table.xls",
          ]);
          expect(textRecord.status).toBe("succeeded");
          if (textRecord.status !== "succeeded") {
            throw new Error("Expected note.txt to succeed in the file-processing proof manifest.");
          }
          expect(textRecord.textPath).toBe(`text/${textRecord.operationId}.txt`);
          expect(xlsRecord.status).toBe("skipped");
          if (xlsRecord.status !== "skipped") {
            throw new Error("Expected table.xls to be skipped in the file-processing proof manifest.");
          }
          expect(xlsRecord.skipReason).toBe("format-out-of-scope");
          expect(xlsFailure.status).toBe("skipped");
          expect(xlsFailure.reason).toBe("format-out-of-scope");
          expect(childRecords).toHaveLength(1);
          expect(childRecords[0]?.sourceArtifactId).toBe(pstRecord.artifactId);
          expect(childRecords[0]?.child.id).not.toBe(pstRecord.artifactId);
          expect(childRecords[0]?.child.relativePath).toBe("children/synthetic-libpff-message.txt");
          expect(yield* fs.readFileString(path.join(outDir, textRecord.textPath ?? ""))).toBe("hello proof");
          expect(yield* fs.exists(path.join(outDir, "failures.jsonl"))).toBe(true);
          expect(yield* fs.exists(childPath)).toBe(true);
        })
      )
    ));

  it("skips PST child export when the selected engine lacks archive-export capability", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* fs.writeFileString(path.join(datasetDir, "mailbox.pst"), "pst");

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "tika",
            "--export-children",
            "--failure-policy",
            "continue",
            "--tika-url",
            "http://127.0.0.1:1",
          ]);

          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );
          const failureRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "failures.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeFileProcessingFailureRecordLine
          );
          const pstRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "mailbox.pst"));
          const pstFailure = O.getOrThrow(
            A.findFirst(failureRecords, (record) => record.relativePath === "mailbox.pst")
          );

          expect(pstRecord.status).toBe("skipped");
          if (pstRecord.status !== "skipped") {
            throw new Error("Expected mailbox.pst to be skipped for Tika archive export.");
          }
          expect(pstRecord.skipReason).toBe("engine-unavailable");
          expect(pstFailure.status).toBe("skipped");
          expect(pstFailure.reason).toBe("engine-unavailable");
          expect(yield* fs.exists(path.join(outDir, "children", `${pstRecord.artifactId}`, "artifacts.jsonl"))).toBe(
            false
          );
        })
      )
    ));

  it("processes fixtures through the real stub engines and rebases child paths onto the output root", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");
          const javaStubPath = path.join(tmpDir, "java-stub");
          const pffexportStubPath = path.join(tmpDir, "pffexport-stub");
          const inertJarPath = path.join(tmpDir, "inert-tika.jar");

          yield* writeProcessStub(stubProcessJava, javaStubPath);
          yield* writeProcessStub(stubProcessPffexport, pffexportStubPath);
          yield* fs.writeFileString(inertJarPath, "inert");
          yield* fs.writeFileString(path.join(datasetDir, "note.txt"), "hello proof");
          yield* fs.writeFileString(path.join(datasetDir, "table.xls"), "not extracted");
          yield* fs.writeFileString(path.join(datasetDir, "mailbox.pst"), "not a real pst");

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "auto",
            "--export-children",
            "--failure-policy",
            "continue",
            "--java",
            javaStubPath,
            "--tika-jar",
            inertJarPath,
            "--pffexport",
            pffexportStubPath,
          ]);

          const runManifest = yield* decodeProcessRunManifest(yield* fs.readFileString(path.join(outDir, "run.json")));
          const coverage = yield* decodeFileProcessingCoverageSummary(
            yield* fs.readFileString(path.join(outDir, "coverage.json"))
          );
          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );
          const textRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "note.txt"));
          const pstRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "mailbox.pst"));
          const xlsRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "table.xls"));
          const childRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "children", `${pstRecord.artifactId}`, "artifacts.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeChildArtifactRecordLine
          );

          expect(runManifest.manifestVersion).toBe("beep.file-processing.run.v1");
          expect(coverage.sourceCount).toBe(3);
          expect(coverage.succeededCount).toBe(2);
          expect(coverage.skippedCount).toBe(1);
          expect(textRecord.status).toBe("succeeded");
          if (textRecord.status !== "succeeded") {
            throw new Error("Expected note.txt to succeed through the tika-app stub engine.");
          }
          expect(yield* fs.readFileString(path.join(outDir, textRecord.textPath ?? ""))).toBe("stub text body");
          expect(pstRecord.status).toBe("succeeded");
          expect(xlsRecord.status).toBe("skipped");
          expect(childRecords.length).toBeGreaterThan(0);
          expect(childRecords.every((record) => record.child.relativePath.startsWith("children/"))).toBe(true);
          expect(childRecords.some((record) => record.child.relativePath.endsWith("/Message.eml"))).toBe(true);
          expect(childRecords.some((record) => record.child.relativePath.endsWith(".messages.jsonl"))).toBe(true);
          for (const record of childRecords) {
            expect(yield* fs.exists(path.join(outDir, record.child.relativePath))).toBe(true);
          }
        })
      )
    ));

  it("dedupes byte-identical sources to one representative per digest", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* fs.writeFileString(path.join(datasetDir, "a.pst"), "pst");
          yield* fs.writeFileString(path.join(datasetDir, "b.pst"), "pst");
          yield* fs.writeFileString(path.join(datasetDir, "copy.txt"), "hello proof");
          yield* fs.writeFileString(path.join(datasetDir, "note.txt"), "hello proof");

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "test",
            "--export-children",
            "--failure-policy",
            "continue",
          ]);

          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );
          const failureRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "failures.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeFileProcessingFailureRecordLine
          );
          const representativePst = O.getOrThrow(
            A.findFirst(sourceRecords, (record) => record.relativePath === "a.pst")
          );
          const duplicatePst = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "b.pst"));
          const representativeText = O.getOrThrow(
            A.findFirst(sourceRecords, (record) => record.relativePath === "copy.txt")
          );
          const duplicateText = O.getOrThrow(
            A.findFirst(sourceRecords, (record) => record.relativePath === "note.txt")
          );
          const duplicateFailure = O.getOrThrow(
            A.findFirst(failureRecords, (record) => record.relativePath === "b.pst")
          );

          expect(A.map(sourceRecords, (record) => record.relativePath)).toEqual([
            "a.pst",
            "b.pst",
            "copy.txt",
            "note.txt",
          ]);
          expect(representativePst.status).toBe("succeeded");
          expect(duplicatePst.status).toBe("skipped");
          if (duplicatePst.status !== "skipped") {
            throw new Error("Expected the duplicate PST to be skipped.");
          }
          expect(duplicatePst.skipReason).toBe("operation-not-required");
          expect(representativeText.status).toBe("succeeded");
          expect(duplicateText.status).toBe("skipped");
          expect(duplicateFailure.message).toContain('Duplicate content of "a.pst"');
        })
      )
    ));

  it("dedupes sources across bounded preparation chunks", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* Effect.forEach(A.range(0, 15), (index) =>
            fs.writeFileString(path.join(datasetDir, `${Str.padStart(2, "0")(`${index}`)}.txt`), `source-${index}`)
          );
          yield* fs.writeFileString(path.join(datasetDir, "16.txt"), "source-0");

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "test",
            "--failure-policy",
            "continue",
          ]);

          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter(Str.isNonEmpty)
            ),
            decodeSourceProcessingRecordLine
          );
          const representative = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "00.txt"));
          const duplicate = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "16.txt"));

          expect(sourceRecords).toHaveLength(17);
          expect(representative.status).toBe("succeeded");
          expect(duplicate.status).toBe("skipped");
          expect(duplicate.artifactId).toBe(representative.artifactId);
        })
      )
    ));

  it("translates an unreachable Tika Server into skipped engine-unavailable records", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* fs.writeFileString(path.join(datasetDir, "note.txt"), "hello proof");

          // Proxy env would reroute the loopback request and turn the
          // deterministic connection refusal into a proxy response; clear it
          // for the duration of the run.
          const proxyKeys = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"];
          const previousProxies = A.map(proxyKeys, (key) => [key, Bun.env[key]] as const);
          for (const key of proxyKeys) {
            delete Bun.env[key];
          }

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "tika",
            "--failure-policy",
            "continue",
            "--tika-url",
            "http://127.0.0.1:1",
          ]).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                for (const [key, value] of previousProxies) {
                  if (value === undefined) {
                    delete Bun.env[key];
                  } else {
                    Bun.env[key] = value;
                  }
                }
              })
            )
          );

          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );
          const failureRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "failures.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeFileProcessingFailureRecordLine
          );
          const textRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "note.txt"));
          const textFailure = O.getOrThrow(A.findFirst(failureRecords, (record) => record.relativePath === "note.txt"));

          expect(textRecord.status).toBe("skipped");
          if (textRecord.status !== "skipped") {
            throw new Error("Expected note.txt to be skipped against an unreachable Tika Server.");
          }
          expect(textRecord.skipReason).toBe("engine-unavailable");
          expect(textFailure.reason).toBe("engine-unavailable");
        })
      )
    ));

  it("translates a missing pffexport binary into skipped engine-unavailable records", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* fs.writeFileString(path.join(datasetDir, "mailbox.pst"), "not a real pst");

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "libpff",
            "--export-children",
            "--failure-policy",
            "continue",
            "--pffexport",
            "/nonexistent/pffexport-missing",
          ]);

          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );
          const pstRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "mailbox.pst"));

          expect(pstRecord.status).toBe("skipped");
          if (pstRecord.status !== "skipped") {
            throw new Error("Expected mailbox.pst to be skipped for a missing pffexport binary.");
          }
          expect(pstRecord.skipReason).toBe("engine-unavailable");
        })
      )
    ));

  it("fails with a configuration exit-code hint when --tika-url is invalid", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* fs.writeFileString(path.join(datasetDir, "note.txt"), "hello proof");

          const exit = yield* Effect.exit(
            processFiles(
              ProcessFilesOptions.make({
                engine: "tika",
                exportChildren: false,
                failurePolicy: "continue",
                input: datasetDir,
                outDir,
                overwrite: false,
                tikaUrl: "not a url",
              })
            ).pipe(provideScopedLayer(FilesCommandServiceLive))
          );

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const error = Cause.squash(exit.cause);
            expect(P.hasProperty(error, "exitCode") && error.exitCode === 2).toBe(true);
            expect(P.hasProperty(error, "message") && P.isString(error.message) && error.message).toContain(
              "Invalid --tika-url"
            );
          }
          expect(yield* fs.exists(path.join(outDir, "run.json"))).toBe(false);
        })
      )
    ));

  it("ignores malformed BEEP_TIKA_* environment when only the pffexport engine runs", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");
          const pffexportStubPath = path.join(tmpDir, "pffexport-stub");

          yield* writeProcessStub(stubProcessPffexport, pffexportStubPath);
          yield* fs.writeFileString(path.join(datasetDir, "mailbox.pst"), "not a real pst");

          yield* withEnvVar(
            "BEEP_TIKA_TIMEOUT_MILLIS",
            "not-a-number",
            runFilesCommand([
              "process",
              "--input",
              datasetDir,
              "--out-dir",
              outDir,
              "--engine",
              "libpff",
              "--export-children",
              "--failure-policy",
              "fail-on-error",
              "--pffexport",
              pffexportStubPath,
            ])
          );

          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );
          const pstRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "mailbox.pst"));

          expect(pstRecord.status).toBe("succeeded");
        })
      )
    ));

  it("pins the budget-exhausted PST outcome: succeeded without EML children plus engine warnings", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");
          const pffexportStubPath = path.join(tmpDir, "pffexport-stub");

          yield* writeProcessStub(stubProcessPffexport, pffexportStubPath);
          yield* fs.writeFileString(path.join(datasetDir, "mailbox.pst"), "not a real pst");

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "libpff",
            "--export-children",
            "--failure-policy",
            "continue",
            "--max-materialized-bytes",
            "1",
            "--pffexport",
            pffexportStubPath,
          ]);

          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );
          const pstRecord = O.getOrThrow(A.findFirst(sourceRecords, (record) => record.relativePath === "mailbox.pst"));
          const childRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "children", `${pstRecord.artifactId}`, "artifacts.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeChildArtifactRecordLine
          );
          const logLines = A.filter(yield* TestConsole.logLines, isString);

          expect(pstRecord.status).toBe("succeeded");
          expect(childRecords.some((record) => record.child.relativePath.endsWith("/Message.eml"))).toBe(false);
          expect(childRecords.some((record) => record.child.relativePath.endsWith(".messages.jsonl"))).toBe(true);
          expect(logLines.some((line) => line.includes("engine warning(s)"))).toBe(true);
        })
      )
    ));

  it("refuses to overwrite a non-directory process output path", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outPath = path.join(tmpDir, "proof-file");

          yield* fs.writeFileString(path.join(datasetDir, "note.txt"), "hello proof");
          yield* fs.writeFileString(outPath, "keep me");

          const exit = yield* Effect.exit(
            processFiles(
              ProcessFilesOptions.make({
                engine: "test",
                exportChildren: false,
                failurePolicy: "continue",
                input: datasetDir,
                outDir: outPath,
                overwrite: true,
              })
            ).pipe(provideScopedLayer(FilesCommandServiceLive))
          );
          const output = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";

          expect(output).toContain("Refusing to write files process output to a non-directory path");
          expect(yield* fs.readFileString(outPath)).toBe("keep me");
        })
      )
    ));

  it("skips recursive symlink loops while collecting process sources", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outDir = path.join(tmpDir, "proof");

          yield* fs.writeFileString(path.join(datasetDir, "note.txt"), "hello proof");
          yield* fs.symlink(datasetDir, path.join(datasetDir, "loop"));
          yield* fs.symlink(path.join(datasetDir, "missing.txt"), path.join(datasetDir, "dangling.txt"));

          yield* runFilesCommand([
            "process",
            "--input",
            datasetDir,
            "--out-dir",
            outDir,
            "--engine",
            "test",
            "--failure-policy",
            "continue",
          ]);

          const coverage = yield* decodeFileProcessingCoverageSummary(
            yield* fs.readFileString(path.join(outDir, "coverage.json"))
          );
          const sourceRecords = yield* Effect.forEach(
            pipe(
              yield* fs.readFileString(path.join(outDir, "sources.jsonl")),
              Str.split("\n"),
              A.filter((line) => line.length > 0)
            ),
            decodeSourceProcessingRecordLine
          );

          expect(coverage.sourceCount).toBe(1);
          expect(A.map(sourceRecords, (record) => record.relativePath)).toEqual(["note.txt"]);
        })
      )
    ));

  it("rejects process output inside the resolved source root for symlinked file input", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const realDir = path.join(tmpDir, "real");
          const aliasDir = path.join(tmpDir, "alias");
          const realFile = path.join(realDir, "note.txt");
          const aliasFile = path.join(aliasDir, "note.txt");
          const outDir = path.join(realDir, "proof");

          yield* fs.makeDirectory(realDir, { recursive: true });
          yield* fs.makeDirectory(aliasDir, { recursive: true });
          yield* fs.writeFileString(realFile, "hello proof");
          yield* fs.symlink(realFile, aliasFile);

          const output = yield* expectFilesCommandFailure([
            "process",
            "--input",
            aliasFile,
            "--out-dir",
            outDir,
            "--engine",
            "test",
            "--failure-policy",
            "continue",
          ]);

          expect(output).toContain("Refusing to write files process output in an overlapping source/output tree");
          expect(yield* fs.exists(outDir)).toBe(false);
        })
      )
    ));

  it("detects black pillarbox borders", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeInsetCanvasImage(
            path.join(datasetDir, "pillar.png"),
            100,
            80,
            { bottom: 0, left: 20, right: 20, top: 0 },
            { b: 0, g: 0, r: 0 },
            { b: 64, g: 96, r: 160 }
          );

          yield* runFilesCommand(["detect-borders", "--dir", datasetDir, "--json"]);

          const report = yield* readDetectBordersJsonLog();
          const entry = report.entries[0];
          const leftSide = O.getOrUndefined(A.findFirst(entry?.sides ?? [], (side) => side.side === "left"));
          const rightSide = O.getOrUndefined(A.findFirst(entry?.sides ?? [], (side) => side.side === "right"));

          expect(report.summary.borderedCount).toBe(1);
          expect(entry?.classification).toBe("pillarbox");
          expect(leftSide?.widthPx).toBe(20);
          expect(rightSide?.widthPx).toBe(20);
        })
      )
    ));

  it("writes an empty face detection manifest without loading the model", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const modelPath = path.join(tmpDir, "face_detection_yunet.onnx");
          const manifestPath = path.join(datasetDir, "detect-faces-manifest.json");

          yield* fs.writeFileString(modelPath, "not a real model");
          yield* runFilesCommand(["detect-faces", "--dir", datasetDir, "--model", modelPath, "--json"]);

          const report = yield* readDetectFacesJsonLog();
          const manifest = yield* readDetectFacesManifest(manifestPath);

          expect(report.summary.analyzedCount).toBe(0);
          expect(report.summary.movedNoFaceCount).toBe(0);
          expect(report.summary.skippedCount).toBe(0);
          expect(report.manifestWritten).toBe(true);
          expect(manifest.schemaVersion).toBe("beep.files.detect-faces.v1");
          expect(manifest.manifestWritten).toBe(true);
        })
      )
    ));

  it("accepts exact pinned AdaFace provenance and rejects a Buffalo/PyTorch v2 mismatch", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const adaFaceModel = makeAdaFaceModelFixture(path, path.join(tmpDir, "cache"));
          const mismatchedWorkerReport = {
            schemaVersion: "beep.files.match-person.worker.v3",
            ok: true,
            limits: workerLimitsFixture,
            model: {
              backend: "buffalo-l",
              name: "buffalo_l",
              packageName: "insightface",
              packageVersion: "1.0.1",
              runtime: adaFaceModel.runtime,
              allowedModules: ["detection", "recognition"],
              root: path.join(tmpDir, "cache", "insightface"),
              components: [],
            },
            parameters: buffaloParametersFixture,
            references: [],
            entries: [],
            summary: {
              totalCount: 0,
              soloMatchCount: 0,
              groupMatchCount: 0,
              lowQualityMatchCount: 0,
              reviewCount: 0,
              noMatchCount: 0,
              noFaceCount: 0,
              unreadableCount: 0,
              acceptedReferenceCount: 0,
              rejectedReferenceCount: 0,
            },
            elapsedSeconds: 0,
          };

          expect(O.isSome(S.decodeUnknownOption(PersonMatchModel)(adaFaceModel))).toBe(true);
          expect(O.isNone(S.decodeUnknownOption(PersonMatchWorkerReport)(mismatchedWorkerReport))).toBe(true);
        })
      )
    ));

  it("validates a pinned AdaFace ROCm orchestration report with review and no-face semantics", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const cacheDir = path.join(tmpDir, "cache");
          const manifestPath = path.join(tmpDir, "person-match.json");
          const uvPath = path.join(tmpDir, "uv");
          const liveWorkerMarkerPath = path.join(tmpDir, "live-worker-started");
          const referencePath = path.join(referenceDir, "reference.jpg");

          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });
          yield* Effect.forEach(
            ["aligner-rejected.jpg", "no-face.jpg", "review.jpg", "solo.jpg"],
            (name) => fs.writeFileString(path.join(candidateDir, name), name),
            { concurrency: 1, discard: true }
          );
          yield* fs.writeFileString(referencePath, "reference");
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf invoked > "${liveWorkerMarkerPath}"\nexit 99\n`, uvPath);

          const rocmWorkerReport = makeAdaFaceRocmWorkerReportFixture(path, cacheDir, candidateDir, referencePath);
          const worker = yield* decodePersonMatchWorkerSuccess(rocmWorkerReport).pipe(Effect.mapError(filesTestError));
          const devices = yield* S.decodeEffect(PersonMatchDeviceIndexesFromCsv)("0").pipe(
            Effect.mapError(filesTestError)
          );
          const options = MatchPersonOptions.make({
            acceptModelLicense: true,
            backend: "adaface-kprpe",
            cacheDir: O.some(cacheDir),
            compute: "rocm",
            detectionThreshold: 0.6,
            devices: O.some(devices),
            dir: candidateDir,
            manifest: manifestPath,
            matchThreshold: 0.5,
            minFaceAreaPct: 1,
            references: referenceDir,
            reviewThreshold: 0.35,
          });
          const modelRoot = path.join(cacheDir, "adaface-kprpe");
          const inputs = CanonicalMatchPersonInputs.make({
            cacheRoot: cacheDir,
            candidateDirectory: candidateDir,
            manifestPath,
            modelRoot,
            outputDirectory: O.none(),
            referenceDirectory: referenceDir,
            uvCacheRoot: path.join(cacheDir, "uv-cache"),
            uvCpuEnvironment: path.join(cacheDir, "venv-adaface-cpu-py312-v1"),
            uvEnvironment: path.join(cacheDir, "venv-adaface-rocm72-py312-v1"),
            uvPath,
          });
          const artifacts = PreparedAdaFaceArtifacts.make({
            alignerPath: path.join(modelRoot, "pinned", "aligner", "model.safetensors"),
            recognizerPath: path.join(modelRoot, "pinned", "recognizer", "model.safetensors"),
          });
          const rocmLibraryDirectory = path.join(tmpDir, "rocm-library");
          const rocmVersionedLibrary = path.join(rocmLibraryDirectory, "libhipsparselt.so.0.2");
          yield* fs.makeDirectory(rocmLibraryDirectory, { recursive: true });
          yield* fs.writeFileString(rocmVersionedLibrary, "fixture");
          yield* fs.symlink(rocmVersionedLibrary, path.join(rocmLibraryDirectory, "libhipsparselt.so.0"));

          yield* PersonMatchWorkerPolicyForTest.validateRuntimeRequest(options);
          yield* PersonMatchWorkerPolicyForTest.validateWorkerEnvelope(worker, options, inputs);
          const configuredLibraryPath = yield* PersonMatchWorkerPolicyForTest.resolveWorkerLibraryPath(
            options,
            inputs,
            "primary"
          ).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({
                BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH: rocmLibraryDirectory,
                LD_LIBRARY_PATH: "/system/lib",
              })
            )
          );
          expect(configuredLibraryPath).toEqual(O.some(`${rocmLibraryDirectory}:/system/lib`));

          const configuredLibraryPathWithoutInherited = yield* PersonMatchWorkerPolicyForTest.resolveWorkerLibraryPath(
            options,
            inputs,
            "primary"
          ).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH: rocmLibraryDirectory })
            )
          );
          expect(configuredLibraryPathWithoutInherited).toEqual(O.some(rocmLibraryDirectory));

          const missingDirectoryError = yield* PersonMatchWorkerPolicyForTest.resolveWorkerLibraryPath(
            options,
            inputs,
            "primary"
          ).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({
                BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH: path.join(tmpDir, "missing-rocm-library"),
              })
            ),
            Effect.flip
          );
          expect(missingDirectoryError._tag).toBe("MatchPersonPathError");

          const incompleteLibraryDirectory = path.join(tmpDir, "incomplete-rocm-library");
          yield* fs.makeDirectory(incompleteLibraryDirectory, { recursive: true });
          const incompleteLibraryError = yield* PersonMatchWorkerPolicyForTest.resolveWorkerLibraryPath(
            options,
            inputs,
            "primary"
          ).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({
                BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH: incompleteLibraryDirectory,
              })
            ),
            Effect.flip
          );
          expect(incompleteLibraryError._tag).toBe("MatchPersonPathError");

          const missingSonameDirectory = path.join(tmpDir, "missing-soname-rocm-library");
          yield* fs.makeDirectory(missingSonameDirectory, { recursive: true });
          yield* fs.writeFileString(path.join(missingSonameDirectory, "libhipsparselt.so.0.2"), "fixture");
          const missingSonameError = yield* PersonMatchWorkerPolicyForTest.resolveWorkerLibraryPath(
            options,
            inputs,
            "primary"
          ).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH: missingSonameDirectory })
            ),
            Effect.flip
          );
          expect(missingSonameError._tag).toBe("MatchPersonPathError");

          const automaticOptions = MatchPersonOptions.make({
            ...options,
            compute: "auto",
            devices: O.none(),
          });
          const cpuWorkerReport = {
            ...rocmWorkerReport,
            model: {
              ...worker.model,
              runtime: {
                framework: "pytorch",
                distribution: "cpu",
                packageVersion: "2.9.1+cpu",
                actualCompute: "cpu",
                precision: "fp32",
                devices: [],
                warnings: [
                  {
                    code: "rocm-fallback-to-cpu",
                    message: "ROCm was unavailable, so automatic compute selected the pinned CPU runtime.",
                  },
                ],
              },
            },
            parameters: {
              ...worker.parameters,
              compute: "auto",
              actualCompute: "cpu",
              devices: [],
            },
          };
          const cpuWorker = yield* decodePersonMatchWorkerSuccess(cpuWorkerReport).pipe(
            Effect.mapError(filesTestError)
          );
          yield* PersonMatchWorkerPolicyForTest.validateWorkerEnvelope(cpuWorker, automaticOptions, inputs);

          const mismatchedParametersWorker = yield* decodePersonMatchWorkerSuccess({
            ...rocmWorkerReport,
            parameters: { ...rocmWorkerReport.parameters, batchSize: 64 },
          }).pipe(Effect.mapError(filesTestError));
          const mismatchedParametersError = yield* PersonMatchWorkerPolicyForTest.validateWorkerEnvelope(
            mismatchedParametersWorker,
            options,
            inputs
          ).pipe(Effect.flip);
          expect(mismatchedParametersError.message).toContain("parameters that do not match");

          const invalidHipWorker = yield* decodePersonMatchWorkerSuccess({
            ...rocmWorkerReport,
            model: {
              ...rocmWorkerReport.model,
              runtime: { ...rocmWorkerReport.model.runtime, hipVersion: "7.1.0" },
            },
          }).pipe(Effect.mapError(filesTestError));
          const invalidHipError = yield* PersonMatchWorkerPolicyForTest.validateWorkerEnvelope(
            invalidHipWorker,
            options,
            inputs
          ).pipe(Effect.flip);
          expect(invalidHipError.message).toContain("pinned HIP 7.2 family");

          const unexpectedWarningWorker = yield* decodePersonMatchWorkerSuccess({
            ...rocmWorkerReport,
            model: {
              ...rocmWorkerReport.model,
              runtime: {
                ...rocmWorkerReport.model.runtime,
                warnings: [
                  {
                    code: "rocm-fallback-to-cpu",
                    message: "A ROCm execution cannot also claim a CPU fallback.",
                  },
                ],
              },
            },
            parameters: { ...rocmWorkerReport.parameters, compute: "auto" },
          }).pipe(Effect.mapError(filesTestError));
          const unexpectedWarningError = yield* PersonMatchWorkerPolicyForTest.validateWorkerEnvelope(
            unexpectedWarningWorker,
            automaticOptions,
            inputs
          ).pipe(Effect.flip);
          expect(unexpectedWarningError.message).toContain("incoherent compute-fallback provenance");

          const wrongCpuPackageWorker = yield* decodePersonMatchWorkerSuccess({
            ...cpuWorkerReport,
            model: {
              ...cpuWorkerReport.model,
              runtime: { ...cpuWorkerReport.model.runtime, packageVersion: "2.9.0+cpu" },
            },
          }).pipe(Effect.mapError(filesTestError));
          const wrongCpuPackageError = yield* PersonMatchWorkerPolicyForTest.validateWorkerEnvelope(
            wrongCpuPackageWorker,
            automaticOptions,
            inputs
          ).pipe(Effect.flip);
          expect(wrongCpuPackageError.message).toContain("pinned cpu PyTorch runtime 2.9.1+cpu");

          expect(PersonMatchWorkerPolicyForTest.workerSyncArguments(options, "primary")).toEqual(
            expect.arrayContaining(["--extra", "adaface"])
          );
          expect(PersonMatchWorkerPolicyForTest.workerSyncArguments(options, "cpu")).toEqual(
            expect.arrayContaining(["--extra", "adaface-cpu"])
          );
          expect(PersonMatchWorkerPolicyForTest.workerArguments(options, inputs, O.some(artifacts))).toEqual(
            expect.arrayContaining([
              "--backend",
              "adaface-kprpe",
              "--compute",
              "rocm",
              "--devices",
              "0",
              "--aligner-path",
              artifacts.alignerPath,
              "--recognizer-path",
              artifacts.recognizerPath,
            ])
          );
          let workerCallCount = 0;
          const workerService = PersonMatchWorkerService.of({
            run: Effect.fn("PersonMatchWorkerService.run")(() =>
              Effect.sync(() => {
                workerCallCount += 1;
                return worker;
              })
            ),
          });

          yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            runMatchPerson(options).pipe(Effect.provideService(PersonMatchWorkerService, workerService))
          );

          const manifest = yield* readPersonMatchManifest(manifestPath);
          const reviewEntry = O.getOrUndefined(
            A.findFirst(manifest.entries, (entry) => entry.sourceName === "review.jpg")
          );
          const noFaceEntry = O.getOrUndefined(
            A.findFirst(manifest.entries, (entry) => entry.sourceName === "no-face.jpg")
          );
          const alignerRejectedEntry = O.getOrUndefined(
            A.findFirst(manifest.entries, (entry) => entry.sourceName === "aligner-rejected.jpg")
          );

          expect(workerCallCount).toBe(1);
          expect(yield* fs.exists(liveWorkerMarkerPath)).toBe(false);
          expect(manifest.manifestWritten).toBe(true);
          expect(manifest.model).toMatchObject({
            backend: "adaface-kprpe",
            runtime: {
              actualCompute: "rocm",
              devices: [{ architecture: "gfx1201", index: 0 }],
              distribution: "rocm72",
              packageVersion: "2.9.1+rocm7.2.0.git7e1940d4",
              warnings: [],
            },
          });
          expect(A.map(manifest.model.components, (component) => component.role)).toEqual([
            "detector",
            "aligner",
            "recognizer",
          ]);
          expect(manifest.parameters).toMatchObject({
            actualCompute: "rocm",
            backend: "adaface-kprpe",
            compute: "rocm",
            devices: [0],
          });
          expect(manifest.summary).toMatchObject({
            acceptedReferenceCount: 1,
            noFaceCount: 2,
            reviewCount: 1,
            soloMatchCount: 1,
            totalCount: 4,
          });
          expect(reviewEntry).toMatchObject({ disposition: "review" });
          expect(reviewEntry?.reason).toBeUndefined();
          expect(noFaceEntry).toMatchObject({ disposition: "no-face" });
          expect(noFaceEntry?.reason).toBeUndefined();
          expect(alignerRejectedEntry).toMatchObject({
            disposition: "no-face",
            reason: "aligner-confidence-failed",
          });
        })
      )
    ));

  it("bounds person-match directory enumeration before sorting the discovered names", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const directory = path.join(tmpDir, "wide-person-match-input");
          yield* fs.makeDirectory(directory, { recursive: true });
          yield* Effect.forEach(
            ["first.jpg", "second.jpg", "third.jpg"],
            (name) => fs.writeFileString(path.join(directory, name), name),
            { concurrency: 1, discard: true }
          );

          const error = yield* Effect.flip(boundedPersonMatchDirectoryNamesForTesting(directory, 2));
          expect(error.message).toContain("directory entry count exceeds 2");
        })
      )
    ));

  it.each([
    { deviceCsv: "0,0", invalidCase: "duplicate" },
    { deviceCsv: "0,,1", invalidCase: "blank" },
  ])("rejects $invalidCase person-match device indexes before starting a worker", ({ deviceCsv }) =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const manifestPath = path.join(tmpDir, "person-match.json");
          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });

          const message = yield* expectFilesCommandFailure([
            "match-person",
            "--references",
            referenceDir,
            "--dir",
            candidateDir,
            "--manifest",
            manifestPath,
            "--devices",
            deviceCsv,
          ]);

          expect(message).toContain("Invalid --devices value");
          expect(yield* fs.exists(manifestPath)).toBe(false);
        })
      )
    )
  );

  it.each([
    {
      invalidCase: "Buffalo with required ROCm",
      options: ["--backend", "buffalo-l", "--compute", "rocm"],
      expectedMessage: "Buffalo backend is CPU-only",
    },
    {
      invalidCase: "CPU with explicit GPU devices",
      options: ["--backend", "adaface-kprpe", "--compute", "cpu", "--devices", "0"],
      expectedMessage: "Explicit GPU devices cannot be combined with --compute cpu",
    },
  ])("rejects $invalidCase before acquisition or worker startup", ({ expectedMessage, options }) =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const cacheDir = path.join(tmpDir, "cache");
          const manifestPath = path.join(tmpDir, "person-match.json");
          const uvPath = path.join(tmpDir, "uv");
          const workerMarkerPath = path.join(tmpDir, "worker-started");
          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });
          yield* fs.writeFileString(path.join(referenceDir, "reference.jpg"), "reference");
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf invoked > "${workerMarkerPath}"\nexit 99\n`, uvPath);

          const message = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              manifestPath,
              "--accept-model-license",
              ...options,
            ])
          );

          expect(message).toContain(expectedMessage);
          expect(yield* fs.exists(workerMarkerPath)).toBe(false);
          expect(yield* fs.exists(manifestPath)).toBe(false);
        })
      )
    )
  );

  it("rejects an empty reference directory before AdaFace acquisition or worker startup", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const cacheDir = path.join(tmpDir, "cache");
          const manifestPath = path.join(tmpDir, "person-match.json");
          const uvPath = path.join(tmpDir, "uv");
          const workerMarkerPath = path.join(tmpDir, "worker-started");
          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });
          yield* fs.writeFileString(path.join(candidateDir, "candidate.jpg"), "candidate");
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf invoked > "${workerMarkerPath}"\nexit 99\n`, uvPath);

          const message = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              manifestPath,
              "--accept-model-license",
            ])
          );

          expect(message).toContain("Reference directory contains no supported");
          expect(yield* fs.exists(workerMarkerPath)).toBe(false);
          expect(yield* fs.exists(path.join(cacheDir, "adaface-kprpe", "pinned"))).toBe(false);
          expect(yield* fs.exists(manifestPath)).toBe(false);
        })
      )
    ));

  it.each([
    {
      compute: "auto",
      expectedEnvironmentChildren: ["venv-adaface-rocm72-py312-v1", "venv-adaface-cpu-py312-v1"],
    },
    {
      compute: "rocm",
      expectedEnvironmentChildren: ["venv-adaface-rocm72-py312-v1"],
    },
  ])(
    "bounds AdaFace $compute environment setup failures before model acquisition",
    ({ compute, expectedEnvironmentChildren }) =>
      Effect.runPromise(
        withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const candidateDir = path.join(tmpDir, "candidates");
            const referenceDir = path.join(tmpDir, "references");
            const cacheDir = path.join(tmpDir, "cache");
            const manifestPath = path.join(tmpDir, "person-match.json");
            const uvPath = path.join(tmpDir, "uv");
            const invocationPath = path.join(tmpDir, "uv-invocations");
            yield* fs.makeDirectory(candidateDir, { recursive: true });
            yield* fs.makeDirectory(referenceDir, { recursive: true });
            yield* fs.writeFileString(path.join(candidateDir, "candidate.jpg"), "candidate");
            yield* fs.writeFileString(path.join(referenceDir, "reference.jpg"), "reference");
            yield* writeProcessStub(
              `#!/usr/bin/env bash
printf '%s\t%s\n' "$UV_PROJECT_ENVIRONMENT" "$*" >> "${invocationPath}"
if [ "$1" = "lock" ]; then exit 0; fi
printf 'simulated pinned environment setup failure' >&2
exit 73
`,
              uvPath
            );

            const message = yield* withEnvVar(
              "BEEP_UV_PATH",
              uvPath,
              expectFilesCommandFailure([
                "match-person",
                "--backend",
                "adaface-kprpe",
                "--compute",
                compute,
                "--references",
                referenceDir,
                "--dir",
                candidateDir,
                "--cache-dir",
                cacheDir,
                "--manifest",
                manifestPath,
                "--accept-model-license",
              ])
            );

            const invocations = A.filter(Str.split(yield* fs.readFileString(invocationPath), "\n"), Str.isNonEmpty);
            expect(invocations[0]).toContain("lock --check");
            expect(A.drop(invocations, 1)).toHaveLength(A.length(expectedEnvironmentChildren));
            A.forEach(expectedEnvironmentChildren, (environmentChild, index) => {
              const invocation = invocations[index + 1];
              expect(invocation).toContain(path.join(cacheDir, environmentChild));
              expect(invocation).toContain("sync");
              expect(invocation).toContain(
                Str.includes("cpu")(environmentChild) ? "--extra adaface-cpu" : "--extra adaface"
              );
            });
            expect(message).toContain("environment");
            expect(yield* fs.exists(path.join(cacheDir, "adaface-kprpe", "pinned"))).toBe(false);
            expect(yield* fs.exists(manifestPath)).toBe(false);
          })
        )
      )
  );

  it("fails closed on an invalid person-match uv lock before environment or model setup", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const cacheDir = path.join(tmpDir, "cache");
          const manifestPath = path.join(tmpDir, "person-match.json");
          const uvPath = path.join(tmpDir, "uv");
          const invocationPath = path.join(tmpDir, "uv-invocations");
          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });
          yield* fs.writeFileString(path.join(candidateDir, "candidate.jpg"), "candidate");
          yield* fs.writeFileString(path.join(referenceDir, "reference.jpg"), "reference");
          yield* writeProcessStub(
            `#!/usr/bin/env bash
printf '%s\n' "$*" >> "${invocationPath}"
printf 'simulated stale uv lock' >&2
exit 74
`,
            uvPath
          );

          const message = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "adaface-kprpe",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              manifestPath,
              "--accept-model-license",
            ])
          );

          const invocations = A.filter(Str.split(yield* fs.readFileString(invocationPath), "\n"), Str.isNonEmpty);
          expect(invocations).toHaveLength(1);
          expect(invocations[0]).toContain("lock --check");
          expect(message).toContain("lock");
          expect(yield* fs.exists(path.join(cacheDir, "adaface-kprpe", "pinned"))).toBe(false);
          expect(yield* fs.exists(manifestPath)).toBe(false);
        })
      )
    ));

  it("resolves Buffalo thresholds and requires an exact v2 worker parameter echo", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const cacheDir = path.join(tmpDir, "cache");
          const uvPath = path.join(tmpDir, "uv");
          const referencePath = path.join(referenceDir, "reference.jpg");
          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });
          yield* Effect.forEach(
            ["group.jpg", "other.jpg", "solo.jpg", "unreadable.jpg"],
            (name) => fs.writeFileString(path.join(candidateDir, name), name),
            { concurrency: 1, discard: true }
          );
          yield* fs.writeFileString(referencePath, "reference");

          const defaultManifestPath = path.join(tmpDir, "default-person-match.json");
          const defaultWorkerReport = makeBuffaloWorkerReportFixture(path, cacheDir, candidateDir, referencePath);
          const defaultWorkerJson = yield* encodeUnknownJson(defaultWorkerReport);
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf '%s' '${defaultWorkerJson}'\n`, uvPath);
          yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            runFilesCommand([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              defaultManifestPath,
              "--accept-model-license",
            ])
          );
          expect((yield* readPersonMatchManifest(defaultManifestPath)).parameters).toEqual(buffaloParametersFixture);

          const explicitParameters = {
            ...buffaloParametersFixture,
            thresholdSource: "explicit",
            detectionThreshold: 0.7,
            matchThreshold: 0.65,
            reviewThreshold: 0.4,
            minFaceAreaPct: 2,
          };
          const explicitManifestPath = path.join(tmpDir, "explicit-person-match.json");
          const explicitWorkerReport = { ...defaultWorkerReport, parameters: explicitParameters };
          const explicitWorkerJson = yield* encodeUnknownJson(explicitWorkerReport);
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf '%s' '${explicitWorkerJson}'\n`, uvPath);
          yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            runFilesCommand([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              explicitManifestPath,
              "--detection-threshold",
              "0.7",
              "--match-threshold",
              "0.65",
              "--review-threshold",
              "0.4",
              "--min-face-area-pct",
              "2",
              "--accept-model-license",
            ])
          );
          expect((yield* readPersonMatchManifest(explicitManifestPath)).parameters).toEqual(explicitParameters);

          const mismatchedManifestPath = path.join(tmpDir, "mismatched-person-match.json");
          const mismatchedWorkerReport = {
            ...defaultWorkerReport,
            parameters: { ...buffaloParametersFixture, batchSize: 64 },
          };
          const mismatchedWorkerJson = yield* encodeUnknownJson(mismatchedWorkerReport);
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf '%s' '${mismatchedWorkerJson}'\n`, uvPath);
          const message = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              mismatchedManifestPath,
              "--accept-model-license",
            ])
          );
          expect(message).toContain("reported parameters that do not match the requested scan");
          expect(yield* fs.exists(mismatchedManifestPath)).toBe(false);
        })
      ).pipe(Effect.provideService(PersonMatchModelArtifactVerifier, () => Effect.void))
    ));

  it("matches a person through the local worker boundary and copies only accepted review lanes", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const cacheDir = path.join(tmpDir, "cache");
          const manifestPath = path.join(tmpDir, "person-match.json");
          const outDir = path.join(tmpDir, "matched");
          const uvPath = path.join(tmpDir, "uv");
          const soloPath = path.join(candidateDir, "solo.jpg");
          const groupPath = path.join(candidateDir, "group.jpg");
          const otherPath = path.join(candidateDir, "other.jpg");
          const unreadablePath = path.join(candidateDir, "unreadable.jpg");
          const referencePath = path.join(referenceDir, "reference.jpg");

          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });
          yield* fs.writeFileString(soloPath, "solo source");
          yield* fs.writeFileString(groupPath, "group source");
          yield* fs.writeFileString(otherPath, "other source");
          yield* fs.writeFileString(unreadablePath, "unreadable source");
          yield* fs.writeFileString(referencePath, "reference source");

          const workerReport = makeBuffaloWorkerReportFixture(path, cacheDir, candidateDir, referencePath);
          const workerReportJson = yield* encodeUnknownJson(workerReport);

          yield* fs.writeFileString(uvPath, `#!/usr/bin/env bash\nprintf '%s' '${workerReportJson}'\n`);
          yield* fs.chmod(uvPath, 0o755);
          const jsonChunks: Array<string> = [];
          let hardLinkCallCount = 0;
          const noHardLinkFileSystem: FileSystem.FileSystem = {
            ...fs,
            link: () =>
              Effect.suspend(() => {
                hardLinkCallCount += 1;
                return Effect.fail(
                  PlatformError.badArgument({
                    description: "hard links unavailable",
                    method: "link",
                    module: "FileSystem",
                  })
                );
              }),
          };
          yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            runFilesCommand([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              manifestPath,
              "--out-dir",
              outDir,
              "--accept-model-license",
              "--json",
            ]).pipe(
              Effect.provideService(CommandJsonOutput, (text) =>
                Effect.sync(() => {
                  jsonChunks.push(text);
                })
              ),
              Effect.provideService(FileSystem.FileSystem, noHardLinkFileSystem)
            )
          );

          const report = yield* readPersonMatchManifest(manifestPath);
          expect(A.join(jsonChunks, "")).toBe(yield* fs.readFileString(manifestPath));
          expect(report.schemaVersion).toBe("beep.files.match-person.v2");
          expect(report.summary).toMatchObject({
            groupMatchCount: 1,
            noMatchCount: 1,
            soloMatchCount: 1,
            unreadableCount: 1,
          });
          expect(report.model).toMatchObject({
            backend: "buffalo-l",
            runtime: {
              actualCompute: "cpu",
              devices: [],
              framework: "onnxruntime",
              packageVersion: "1.23.2",
              precision: "fp32",
              providers: ["CPUExecutionProvider"],
              warnings: [],
            },
          });
          expect(report.parameters).toEqual(buffaloParametersFixture);
          expect(report.outputDirectory).toBe(outDir);
          expect(yield* fs.readFileString(path.join(outDir, "accepted", "solo.jpg"))).toBe("solo source");
          expect(yield* fs.readFileString(path.join(outDir, "group-review", "group.jpg"))).toBe("group source");
          expect(yield* fs.exists(path.join(outDir, "accepted", "other.jpg"))).toBe(false);
          expect(yield* fs.exists(path.join(outDir, "accepted", "unreadable.jpg"))).toBe(false);
          expect(yield* fs.readFileString(soloPath)).toBe("solo source");
          expect(yield* fs.readFileString(groupPath)).toBe("group source");
          expect(yield* fs.readFileString(otherPath)).toBe("other source");
          expect(yield* fs.readFileString(unreadablePath)).toBe("unreadable source");
          expect(hardLinkCallCount).toBe(0);

          const backupNamedManifestPath = path.join(tmpDir, ".previous-manifest");
          yield* fs.writeFileString(backupNamedManifestPath, "previous manifest");
          yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            runFilesCommand([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              backupNamedManifestPath,
              "--accept-model-license",
              "--overwrite",
            ])
          );
          expect((yield* readPersonMatchManifest(backupNamedManifestPath)).summary.totalCount).toBe(4);

          const partialAlignerManifestPath = path.join(tmpDir, "partial-aligner-person-match.json");
          const partialAlignerWorkerReport = {
            ...workerReport,
            entries: A.map(workerReport.entries, (entry) =>
              entry.disposition === "group-match"
                ? { ...entry, disposition: "review", reason: "aligner-confidence-failed" }
                : entry
            ),
            summary: {
              ...workerReport.summary,
              groupMatchCount: 0,
              reviewCount: 1,
            },
          };
          const partialAlignerWorkerJson = yield* encodeUnknownJson(partialAlignerWorkerReport);
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf '%s' '${partialAlignerWorkerJson}'\n`, uvPath);
          yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            runFilesCommand([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              partialAlignerManifestPath,
              "--accept-model-license",
            ])
          );
          const partialAlignerReport = yield* readPersonMatchManifest(partialAlignerManifestPath);
          expect(partialAlignerReport.summary.reviewCount).toBe(1);
          expect(partialAlignerReport.entries[0]).toMatchObject({
            disposition: "review",
            reason: "aligner-confidence-failed",
          });

          const incompleteManifestPath = path.join(tmpDir, "incomplete-person-match.json");
          const incompleteWorkerReport = {
            ...workerReport,
            entries: A.filter(workerReport.entries, (entry) => entry.sourceName !== "other.jpg"),
            summary: {
              ...workerReport.summary,
              totalCount: 3,
              noMatchCount: 0,
            },
          };
          const incompleteWorkerJson = yield* encodeUnknownJson(incompleteWorkerReport);
          yield* writeProcessStub(`#!/usr/bin/env bash\nprintf '%s' '${incompleteWorkerJson}'\n`, uvPath);
          const incompleteMessage = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              incompleteManifestPath,
              "--accept-model-license",
            ])
          );
          expect(incompleteMessage).toContain("did not report every eligible candidate and reference image");
          expect(yield* fs.exists(incompleteManifestPath)).toBe(false);

          const invalidManifestPath = path.join(tmpDir, "invalid-person-match.json");
          const invalidOutDir = path.join(tmpDir, "invalid-matched");
          const invalidWorkerReport = {
            ...workerReport,
            entries: A.map(workerReport.entries, (entry, entryIndex) =>
              entryIndex === 0
                ? {
                    ...entry,
                    faces: A.map(entry.faces, (entryFace, faceIndex) =>
                      faceIndex === 0 ? { ...entryFace, embedding: [0.1, 0.2, 0.3] } : entryFace
                    ),
                  }
                : entry
            ),
          };
          const invalidWorkerReportJson = yield* encodeUnknownJson(invalidWorkerReport);
          yield* fs.writeFileString(uvPath, `#!/usr/bin/env bash\nprintf '%s' '${invalidWorkerReportJson}'\n`);
          const invalidMessage = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              invalidManifestPath,
              "--out-dir",
              invalidOutDir,
              "--accept-model-license",
            ])
          );

          expect(invalidMessage).toContain("Person-match worker returned invalid");
          expect(yield* fs.exists(invalidManifestPath)).toBe(false);
          expect(yield* fs.exists(invalidOutDir)).toBe(false);

          const unpinnedManifestPath = path.join(tmpDir, "unpinned-model-person-match.json");
          const unpinnedWorkerReport = {
            ...workerReport,
            model: {
              ...workerReport.model,
              components: A.map(workerReport.model.components, (component, componentIndex) =>
                componentIndex === 0
                  ? {
                      ...component,
                      artifacts: A.map(component.artifacts, (artifact, artifactIndex) =>
                        artifactIndex === 0 ? { ...artifact, sha256: pipe("0", Str.repeat(64)) } : artifact
                      ),
                    }
                  : component
              ),
            },
          };
          const unpinnedWorkerReportJson = yield* encodeUnknownJson(unpinnedWorkerReport);
          yield* fs.writeFileString(uvPath, `#!/usr/bin/env bash\nprintf '%s' '${unpinnedWorkerReportJson}'\n`);
          const unpinnedMessage = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              unpinnedManifestPath,
              "--accept-model-license",
            ])
          );
          expect(unpinnedMessage).toContain("unexpected model artifact provenance");
          expect(yield* fs.exists(unpinnedManifestPath)).toBe(false);

          const misclassifiedManifestPath = path.join(tmpDir, "misclassified-person-match.json");
          const misclassifiedOutDir = path.join(tmpDir, "misclassified-matched");
          const misclassifiedWorkerReport = {
            ...workerReport,
            entries: A.map(workerReport.entries, (entry) =>
              entry.disposition === "solo-match"
                ? {
                    ...entry,
                    bestScore: 0.1,
                    faces: A.map(entry.faces, (entryFace) => ({
                      ...entryFace,
                      bestReferenceScore: 0.1,
                      centroidScore: 0.1,
                      matchScore: 0.1,
                      top3MedianScore: 0.1,
                    })),
                  }
                : entry
            ),
          };
          const misclassifiedWorkerReportJson = yield* encodeUnknownJson(misclassifiedWorkerReport);
          yield* fs.writeFileString(uvPath, `#!/usr/bin/env bash\nprintf '%s' '${misclassifiedWorkerReportJson}'\n`);
          const misclassifiedMessage = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              misclassifiedManifestPath,
              "--out-dir",
              misclassifiedOutDir,
              "--accept-model-license",
            ])
          );
          expect(misclassifiedMessage).toContain("inconsistent with its thresholds or quality evidence");
          expect(yield* fs.exists(misclassifiedManifestPath)).toBe(false);
          expect(yield* fs.exists(misclassifiedOutDir)).toBe(false);

          const inconsistentManifestPath = path.join(tmpDir, "inconsistent-person-match.json");
          const inconsistentOutDir = path.join(tmpDir, "inconsistent-matched");
          const inconsistentWorkerReport = {
            ...workerReport,
            entries: A.map(workerReport.entries, (entry, index) =>
              index === 0 ? { ...entry, sourcePath: otherPath } : entry
            ),
          };
          const inconsistentWorkerReportJson = yield* encodeUnknownJson(inconsistentWorkerReport);
          yield* fs.writeFileString(uvPath, `#!/usr/bin/env bash\nprintf '%s' '${inconsistentWorkerReportJson}'\n`);
          const inconsistentMessage = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              inconsistentManifestPath,
              "--out-dir",
              inconsistentOutDir,
              "--accept-model-license",
            ])
          );
          expect(inconsistentMessage).toContain("mismatched source and relative paths");
          expect(yield* fs.exists(inconsistentManifestPath)).toBe(false);
          expect(yield* fs.exists(inconsistentOutDir)).toBe(false);

          const duplicateManifestPath = path.join(tmpDir, "duplicate-reference-person-match.json");
          const duplicateWorkerReport = {
            ...workerReport,
            parameters: { ...workerReport.parameters, recursive: true },
            references: [
              ...workerReport.references,
              {
                ...workerReport.references[0],
                sourcePath: path.join(referenceDir, "nested", "reference.jpg"),
              },
            ],
            summary: { ...workerReport.summary, acceptedReferenceCount: 2 },
          };
          const duplicateWorkerReportJson = yield* encodeUnknownJson(duplicateWorkerReport);
          yield* fs.writeFileString(uvPath, `#!/usr/bin/env bash\nprintf '%s' '${duplicateWorkerReportJson}'\n`);
          const duplicateMessage = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              duplicateManifestPath,
              "--recursive",
              "--accept-model-license",
            ])
          );

          expect(duplicateMessage).toContain("duplicate accepted file names");
          expect(yield* fs.exists(duplicateManifestPath)).toBe(false);

          const acceptedTarget = path.join(outDir, "accepted", "solo.jpg");
          const groupTarget = path.join(outDir, "group-review", "group.jpg");
          yield* fs.writeFileString(acceptedTarget, "previous solo");
          yield* fs.writeFileString(groupTarget, "previous group");
          yield* fs.writeFileString(manifestPath, "previous manifest");
          yield* fs.writeFileString(uvPath, `#!/usr/bin/env bash\nprintf '%s' '${workerReportJson}'\n`);
          let stagedRenameCount = 0;
          let linkCallCount = 0;
          const failingFileSystem: FileSystem.FileSystem = {
            ...fs,
            link: () =>
              Effect.suspend(() => {
                linkCallCount += 1;
                return Effect.fail(
                  PlatformError.badArgument({
                    description: "unexpected hard-link materialization",
                    method: "link",
                    module: "FileSystem",
                  })
                );
              }),
            rename: (fromPath, toPath) =>
              Effect.suspend(() => {
                if (!Str.startsWith(".staged-")(path.basename(fromPath))) {
                  return fs.rename(fromPath, toPath);
                }
                stagedRenameCount += 1;
                return stagedRenameCount === 2
                  ? Effect.fail(
                      PlatformError.badArgument({
                        description: "simulated second person-match commit failure",
                        method: "rename",
                        module: "FileSystem",
                      })
                    )
                  : fs.rename(fromPath, toPath);
              }),
          };
          const rollbackExit = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            runFilesCommand([
              "match-person",
              "--backend",
              "buffalo-l",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              cacheDir,
              "--manifest",
              manifestPath,
              "--out-dir",
              outDir,
              "--accept-model-license",
              "--overwrite",
            ]).pipe(Effect.provideService(FileSystem.FileSystem, failingFileSystem), Effect.exit)
          );

          expect(Exit.isFailure(rollbackExit)).toBe(true);
          expect(stagedRenameCount).toBe(2);
          expect(linkCallCount).toBe(0);
          expect(yield* fs.readFileString(acceptedTarget)).toBe("previous solo");
          expect(yield* fs.readFileString(groupTarget)).toBe("previous group");
          expect(yield* fs.readFileString(manifestPath)).toBe("previous manifest");
          expect(yield* sortedDirectoryEntries(path.dirname(acceptedTarget))).toEqual(["solo.jpg"]);
          expect(yield* sortedDirectoryEntries(path.dirname(groupTarget))).toEqual(["group.jpg"]);
          expect(
            A.filter(yield* sortedDirectoryEntries(tmpDir), (name) => Str.startsWith(".beep-files-person-match-")(name))
          ).toEqual([]);
          expect(yield* fs.readFileString(soloPath)).toBe("solo source");
          expect(yield* fs.readFileString(groupPath)).toBe("group source");
          expect(yield* fs.readFileString(otherPath)).toBe("other source");
          expect(yield* fs.readFileString(unreadablePath)).toBe("unreadable source");
        })
      ).pipe(Effect.provideService(PersonMatchModelArtifactVerifier, () => Effect.void))
    ));

  it.each([
    { cacheChild: "insightface", targetState: "existing" },
    { cacheChild: "insightface", targetState: "dangling" },
    { cacheChild: "venv-cpu-py312-v1", targetState: "existing" },
    { cacheChild: "venv-cpu-py312-v1", targetState: "dangling" },
    { cacheChild: "uv-cache", targetState: "existing" },
    { cacheChild: "uv-cache", targetState: "dangling" },
  ])(
    "rejects a $targetState symlinked $cacheChild cache child before starting the worker",
    ({ cacheChild, targetState }) =>
      Effect.runPromise(
        withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const candidateDir = path.join(tmpDir, "candidates");
            const referenceDir = path.join(tmpDir, "references");
            const cacheDir = path.join(tmpDir, "cache");
            const escapedDir = path.join(tmpDir, "escaped");
            const canaryPath = path.join(escapedDir, "canary.txt");
            const manifestPath = path.join(tmpDir, "person-match.json");
            const uvPath = path.join(tmpDir, "uv");
            const workerMarkerPath = path.join(tmpDir, "worker-started");
            const targetExists = targetState === "existing";

            yield* fs.makeDirectory(candidateDir, { recursive: true });
            yield* fs.makeDirectory(referenceDir, { recursive: true });
            yield* fs.makeDirectory(cacheDir, { recursive: true });
            if (targetExists) {
              yield* fs.makeDirectory(escapedDir, { recursive: true });
              yield* fs.writeFileString(canaryPath, "untouched");
            }
            yield* fs.symlink(escapedDir, path.join(cacheDir, cacheChild));
            yield* writeProcessStub(`#!/usr/bin/env bash\nprintf invoked > "${workerMarkerPath}"\nexit 99\n`, uvPath);

            const message = yield* withEnvVar(
              "BEEP_UV_PATH",
              uvPath,
              expectFilesCommandFailure([
                "match-person",
                "--backend",
                "buffalo-l",
                "--references",
                referenceDir,
                "--dir",
                candidateDir,
                "--cache-dir",
                cacheDir,
                "--manifest",
                manifestPath,
                "--accept-model-license",
              ])
            );

            expect(message).toMatch(targetExists ? /symlinked|aliased/i : /failed to resolve/i);
            expect(message).toContain(path.join(cacheDir, cacheChild));
            expect(yield* fs.exists(workerMarkerPath)).toBe(false);
            expect(yield* fs.exists(manifestPath)).toBe(false);
            if (targetExists) {
              expect(yield* fs.readFileString(canaryPath)).toBe("untouched");
              expect(yield* sortedDirectoryEntries(escapedDir)).toEqual(["canary.txt"]);
            } else {
              expect(yield* fs.exists(escapedDir)).toBe(false);
            }
          })
        )
      )
  );

  it("rejects overlapping person-match manifest, output, and cache paths before starting the worker", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const candidateDir = path.join(tmpDir, "candidates");
          const referenceDir = path.join(tmpDir, "references");
          const outputDir = path.join(tmpDir, "output");
          const uvPath = path.join(tmpDir, "uv");
          yield* fs.makeDirectory(candidateDir, { recursive: true });
          yield* fs.makeDirectory(referenceDir, { recursive: true });
          yield* fs.makeDirectory(outputDir, { recursive: true });
          yield* fs.writeFileString(uvPath, "#!/usr/bin/env bash\nexit 99\n");
          yield* fs.chmod(uvPath, 0o755);

          const message = yield* withEnvVar(
            "BEEP_UV_PATH",
            uvPath,
            expectFilesCommandFailure([
              "match-person",
              "--references",
              referenceDir,
              "--dir",
              candidateDir,
              "--cache-dir",
              path.join(tmpDir, "cache"),
              "--manifest",
              path.join(outputDir, "person-match.json"),
              "--out-dir",
              outputDir,
              "--accept-model-license",
            ])
          );
          expect(message).toContain("output directory must not overlap the manifest or cache paths");
        })
      )
    ));

  it("creates an empty no-face move directory without loading the model", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const modelPath = path.join(tmpDir, "face_detection_yunet.onnx");
          const noFaceDir = path.join(tmpDir, "no-face");

          yield* fs.writeFileString(modelPath, "not a real model");
          yield* runFilesCommand([
            "detect-faces",
            "--dir",
            datasetDir,
            "--model",
            modelPath,
            "--move-no-face-to",
            noFaceDir,
            "--json",
          ]);

          const report = yield* readDetectFacesJsonLog();
          const noFaceDirExists = yield* fs.exists(noFaceDir);

          expect(report.options.moveNoFaceTo).toBe(noFaceDir);
          expect(report.summary.movedNoFaceCount).toBe(0);
          expect(noFaceDirExists).toBe(true);
        })
      )
    ));

  it("detects one-sided white canvas edges", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeLeftCanvasPatternImage(path.join(datasetDir, "canvas.png"), 80, 80, 10);

          yield* runFilesCommand(["detect-borders", "--dir", datasetDir, "--json"]);

          const report = yield* readDetectBordersJsonLog();
          const entry = report.entries[0];
          const leftSide = O.getOrUndefined(A.findFirst(entry?.sides ?? [], (side) => side.side === "left"));

          expect(report.summary.borderedCount).toBe(1);
          expect(entry?.classification).toBe("canvas-edge");
          expect(leftSide?.colorHex).toBe("#ffffff");
          expect(leftSide?.widthPx).toBe(10);
        })
      )
    ));

  it("does not report clean patterned images as bordered", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writePatternImage(path.join(datasetDir, "clean.png"), 64, 64);

          yield* runFilesCommand(["detect-borders", "--dir", datasetDir]);

          expect(yield* TestConsole.logLines).toContain(
            `files detect-borders: 0 bordered image(s) found in "${datasetDir}" (1 analyzed, 0 skipped).`
          );
        })
      )
    ));

  it("detects near-solid jpeg-compressed borders with tolerance", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeNearSolidJpegBorder(path.join(datasetDir, "near-solid.jpg"), 90, 72, 12);

          yield* runFilesCommand(["detect-borders", "--dir", datasetDir, "--json", "--tolerance", "24"]);

          const report = yield* readDetectBordersJsonLog();
          const entry = report.entries[0];
          const leftSide = O.getOrUndefined(A.findFirst(entry?.sides ?? [], (side) => side.side === "left"));
          const rightSide = O.getOrUndefined(A.findFirst(entry?.sides ?? [], (side) => side.side === "right"));

          expect(entry?.classification).toBe("pillarbox");
          expect(leftSide?.widthPx).toBeGreaterThanOrEqual(8);
          expect(rightSide?.widthPx).toBeGreaterThanOrEqual(8);
        })
      )
    ));

  it("skips unsupported and unreadable sources during border detection", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeInsetCanvasImage(
            path.join(datasetDir, "bordered.png"),
            40,
            40,
            { bottom: 0, left: 5, right: 5, top: 0 },
            { b: 0, g: 0, r: 0 },
            { b: 120, g: 120, r: 120 }
          );
          yield* writeSizedFile(path.join(datasetDir, "broken.jpg"), 1, "x");
          yield* writeSvgFile(path.join(datasetDir, "vector.svg"), 2, 2);
          yield* fs.writeFileString(path.join(datasetDir, "caption.txt"), "caption");
          yield* fs.writeFileString(path.join(datasetDir, "clip.mp4"), "video");
          yield* fs.writeFileString(path.join(datasetDir, "extensionless"), "notes");
          yield* fs.makeDirectory(path.join(datasetDir, "nested"));

          yield* runFilesCommand(["detect-borders", "--dir", datasetDir, "--json"]);

          const report = yield* readDetectBordersJsonLog();

          expect(report.summary.analyzedCount).toBe(1);
          expect(report.summary.borderedCount).toBe(1);
          expect(A.map(report.skipped, (entry) => entry.reason)).toEqual([
            "unreadable-image",
            "non-media",
            "video",
            "extensionless",
            "directory",
            "unsupported-image",
          ]);
        })
      )
    ));

  it("validates border detection threshold relationships", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writePatternImage(path.join(datasetDir, "clean.png"), 32, 32);

          const output = yield* expectFilesCommandFailure([
            "detect-borders",
            "--dir",
            datasetDir,
            "--min-width-pct",
            "40",
            "--max-scan-pct",
            "10",
          ]);

          expect(output).toBe("Expected --min-width-pct (40) to be less than or equal to --max-scan-pct (10).");
        })
      )
    ));

  it("crops detected pillarbox borders in place", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const imagePath = path.join(datasetDir, "pillar.png");

          yield* writeInsetCanvasImage(
            imagePath,
            100,
            80,
            { bottom: 0, left: 20, right: 20, top: 0 },
            { b: 0, g: 0, r: 0 },
            { b: 64, g: 96, r: 160 }
          );

          yield* runFilesCommand(["crop-borders", "--dir", datasetDir]);

          const metadata = yield* readImageMetadata(imagePath);

          expect(metadata.width).toBe(60);
          expect(metadata.height).toBe(80);
          expect(yield* TestConsole.logLines).toContain("files crop-borders: cropped 1 image file(s).");
        })
      )
    ));

  it("preserves bordered images during crop-borders dry-run", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const imagePath = path.join(datasetDir, "canvas.png");

          yield* writeLeftCanvasPatternImage(imagePath, 80, 80, 10);

          yield* runFilesCommand(["crop-borders", "--dir", datasetDir, "--dry-run"]);

          const metadata = yield* readImageMetadata(imagePath);

          expect(metadata.width).toBe(80);
          expect(metadata.height).toBe(80);
          expect(yield* TestConsole.logLines).toContain("files crop-borders: dry run; no files rewritten.");
        })
      )
    ));

  it("validates border crop threshold relationships", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writePatternImage(path.join(datasetDir, "clean.png"), 32, 32);

          const output = yield* expectFilesCommandFailure([
            "crop-borders",
            "--dir",
            datasetDir,
            "--min-width-pct",
            "40",
            "--max-scan-pct",
            "10",
          ]);

          expect(output).toBe("Expected --min-width-pct (40) to be less than or equal to --max-scan-pct (10).");
        })
      )
    ));

  it("sorts direct files by size and renames with generated indexes", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          for (const size of [7, 6, 5, 4, 3, 2, 1]) {
            yield* writeSizedFile(path.join(datasetDir, `${size}.png`), size, "x");
          }

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual([
            "image_00.png",
            "image_01.png",
            "image_02.png",
            "image_03.png",
            "image_04.png",
            "image_05.png",
            "image_06.png",
          ]);
          expect(yield* fileSize(path.join(datasetDir, "image_00.png"))).toBe(7n);
          expect(yield* fileSize(path.join(datasetDir, "image_06.png"))).toBe(1n);
        })
      )
    ));

  it("breaks equal-size ties by original name", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* fs.writeFileString(path.join(datasetDir, "b.png"), "bb");
          yield* fs.writeFileString(path.join(datasetDir, "a.png"), "aa");
          yield* fs.writeFileString(path.join(datasetDir, "c.png"), "ccc");

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir]);

          expect(yield* fs.readFileString(path.join(datasetDir, "image_00.png"))).toBe("ccc");
          expect(yield* fs.readFileString(path.join(datasetDir, "image_01.png"))).toBe("aa");
          expect(yield* fs.readFileString(path.join(datasetDir, "image_02.png"))).toBe("bb");
        })
      )
    ));

  it("increases index width from the file count", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          for (const index of A.range(0, 99)) {
            yield* fs.writeFileString(path.join(datasetDir, `source-${index}.png`), "x");
          }

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir]);

          expect(yield* fs.exists(path.join(datasetDir, "image_0000.png"))).toBe(true);
          expect(yield* fs.exists(path.join(datasetDir, "image_0099.png"))).toBe(true);
          expect(A.length(yield* sortedDirectoryEntries(datasetDir))).toBe(100);
        })
      )
    ));

  it("preserves files during dry-run", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSizedFile(path.join(datasetDir, "large.png"), 2, "x");
          yield* writeSizedFile(path.join(datasetDir, "small.png"), 1, "x");

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir, "--dry-run"]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["large.png", "small.png"]);
          expect(yield* fs.exists(path.join(datasetDir, "image_00.png"))).toBe(false);
          expect(yield* TestConsole.logLines).toContain("files sort-and-rename: dry run; no files renamed.");
        })
      )
    ));

  it("preserves extension casing", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSizedFile(path.join(datasetDir, "large.PNG"), 2, "x");
          yield* writeSizedFile(path.join(datasetDir, "small.jpg"), 1, "x");

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["image_00.PNG", "image_01.jpg"]);
        })
      )
    ));

  it("fails before mutation when a selected file has no extension", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSizedFile(path.join(datasetDir, "extensionless"), 2, "x");
          yield* writeSizedFile(path.join(datasetDir, "small.png"), 1, "x");

          const output = yield* expectFilesCommandFailure([
            "sort-and-rename",
            "--prefix",
            "image",
            "--dir",
            datasetDir,
          ]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["extensionless", "small.png"]);
          expect(yield* fs.exists(path.join(datasetDir, "image_00.png"))).toBe(false);
          expect(output).toBe(`Cannot rename extensionless file: "${path.join(datasetDir, "extensionless")}"`);
        })
      )
    ));

  it("fails before mutation when a target path exists outside the rename set", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const collidingDirectory = path.join(datasetDir, "image_00.png");

          yield* writeSizedFile(path.join(datasetDir, "source.png"), 1, "x");
          yield* fs.makeDirectory(collidingDirectory);

          const output = yield* expectFilesCommandFailure([
            "sort-and-rename",
            "--prefix",
            "image",
            "--dir",
            datasetDir,
          ]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["image_00.png", "source.png"]);
          expect(yield* fs.exists(path.join(datasetDir, "source.png"))).toBe(true);
          expect(output).toContain("Refusing to overwrite existing target outside the rename set");
        })
      )
    ));

  it("skips directories and symlink entries", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outsideFile = path.join(tmpDir, "outside.png");

          yield* writeSizedFile(path.join(datasetDir, "large.png"), 2, "x");
          yield* writeSizedFile(path.join(datasetDir, "small.png"), 1, "x");
          yield* fs.makeDirectory(path.join(datasetDir, "nested.png"));
          yield* fs.writeFileString(outsideFile, "outside");
          yield* fs.symlink(outsideFile, path.join(datasetDir, "linked.png"));

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual([
            "image_00.png",
            "image_01.png",
            "linked.png",
            "nested.png",
          ]);
          expect(yield* fs.exists(path.join(datasetDir, "image_02.png"))).toBe(false);
        })
      )
    ));

  it("succeeds as a no-op for empty directories", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual([]);
          expect(yield* TestConsole.logLines).toEqual([
            `files sort-and-rename: 0 file(s) in "${datasetDir}"; nothing to rename.`,
          ]);
        })
      )
    ));

  it("includes media dimensions in generated names when requested", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSvgFile(path.join(datasetDir, "small.svg"), 1, 1);
          yield* writeSvgFile(path.join(datasetDir, "large.svg"), 2, 1, 20);

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir, "--with-dimensions"]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["image_00_2x1.svg", "image_01_1x1.svg"]);
        })
      )
    ));

  it("leaves non-media files untouched when dimensions are requested", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSvgFile(path.join(datasetDir, "photo.svg"), 1, 1);
          yield* fs.writeFileString(path.join(datasetDir, "photo.txt"), "caption");
          yield* fs.writeFileString(path.join(datasetDir, "extensionless"), "notes");

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir, "--with-dimensions"]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["extensionless", "image_00_1x1.svg", "photo.txt"]);
          expect(yield* fs.readFileString(path.join(datasetDir, "photo.txt"))).toBe("caption");
        })
      )
    ));

  it("does not append duplicate dimension suffixes when rerun", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSvgFile(path.join(datasetDir, "source.svg"), 3, 2);

          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir, "--with-dimensions"]);
          yield* runFilesCommand(["sort-and-rename", "--prefix", "image", "--dir", datasetDir, "--with-dimensions"]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["image_00_3x2.svg"]);
        })
      )
    ));

  it("uses ffprobe stream rotation for video dimensions", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const binDir = path.join(tmpDir, "bin");

          yield* writeFfprobeShim(binDir, 640, 360, 90);
          yield* writeSizedFile(path.join(datasetDir, "clip.mp4"), 4, "x");

          yield* withEnvVar(
            "BEEP_FFPROBE_PATH",
            path.join(binDir, "ffprobe"),
            runFilesCommand(["sort-and-rename", "--prefix", "clip", "--dir", datasetDir, "--with-dimensions"])
          );

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["clip_00_360x640.mp4"]);
        })
      )
    ));

  it("fails before mutation when selected media dimensions cannot be probed", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSvgFile(path.join(datasetDir, "valid.svg"), 1, 1);
          yield* writeSizedFile(path.join(datasetDir, "broken.png"), 2, "x");

          const output = yield* expectFilesCommandFailure([
            "sort-and-rename",
            "--prefix",
            "image",
            "--dir",
            datasetDir,
            "--with-dimensions",
          ]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["broken.png", "valid.svg"]);
          expect(output).toContain("Failed to probe image dimensions");
        })
      )
    ));

  it("recursively flattens image and video files while preserving non-media files and source directories", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const nestedDir = path.join(sourceDir, "nestedFolder");
          const hiddenDir = path.join(sourceDir, ".hidden");
          const emptyDir = path.join(nestedDir, "empty");
          const outDir = path.join(tmpDir, "flat");

          yield* fs.makeDirectory(emptyDir, { recursive: true });
          yield* fs.makeDirectory(hiddenDir, { recursive: true });
          yield* fs.writeFileString(path.join(sourceDir, "1.jpg"), "direct image");
          yield* fs.writeFileString(path.join(sourceDir, "1.mkv"), "direct video");
          yield* fs.writeFileString(path.join(nestedDir, "2.png"), "nested image");
          yield* fs.writeFileString(path.join(nestedDir, "beep.mp4"), "nested video");
          yield* fs.writeFileString(path.join(hiddenDir, "secret.WEBM"), "hidden video");
          yield* fs.writeFileString(path.join(sourceDir, "notes.txt"), "keep direct");
          yield* fs.writeFileString(path.join(nestedDir, "keep.md"), "keep nested");

          yield* runFilesCommand(["flatten-media", "--dir", sourceDir, "--out-dir", outDir]);

          expect(yield* sortedDirectoryEntries(outDir)).toEqual(["1.jpg", "1.mkv", "2.png", "beep.mp4", "secret.WEBM"]);
          expect(yield* fs.readFileString(path.join(outDir, "1.jpg"))).toBe("direct image");
          expect(yield* fs.readFileString(path.join(outDir, "beep.mp4"))).toBe("nested video");
          expect(yield* fs.readFileString(path.join(outDir, "secret.WEBM"))).toBe("hidden video");
          expect(yield* sortedDirectoryEntries(sourceDir)).toEqual([".hidden", "nestedFolder", "notes.txt"]);
          expect(yield* sortedDirectoryEntries(nestedDir)).toEqual(["empty", "keep.md"]);
          expect(yield* sortedDirectoryEntries(hiddenDir)).toEqual([]);
          expect(yield* fs.readFileString(path.join(sourceDir, "notes.txt"))).toBe("keep direct");
          expect(yield* fs.readFileString(path.join(nestedDir, "keep.md"))).toBe("keep nested");
        })
      )
    ));

  it("allocates deterministic collision suffixes around existing file and directory names", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const outDir = path.join(tmpDir, "flat");

          yield* fs.makeDirectory(path.join(sourceDir, "a"), { recursive: true });
          yield* fs.makeDirectory(path.join(sourceDir, "b"), { recursive: true });
          yield* fs.makeDirectory(path.join(sourceDir, "c"), { recursive: true });
          yield* fs.makeDirectory(path.join(outDir, "photo_01.JPG"), { recursive: true });
          yield* fs.writeFileString(path.join(sourceDir, "a", "photo.JPG"), "source a");
          yield* fs.writeFileString(path.join(sourceDir, "b", "photo.JPG"), "source b");
          yield* fs.writeFileString(path.join(sourceDir, "c", "photo.JPG"), "source c");
          yield* fs.writeFileString(path.join(outDir, "photo.JPG"), "existing original");
          yield* fs.writeFileString(path.join(outDir, "photo_03.JPG"), "existing gap");

          yield* runFilesCommand(["flatten-media", "--dir", sourceDir, "--out-dir", outDir]);

          expect(yield* sortedDirectoryEntries(outDir)).toEqual([
            "photo.JPG",
            "photo_01.JPG",
            "photo_02.JPG",
            "photo_03.JPG",
            "photo_04.JPG",
            "photo_05.JPG",
          ]);
          expect(yield* fs.readFileString(path.join(outDir, "photo.JPG"))).toBe("existing original");
          expect(yield* fs.readFileString(path.join(outDir, "photo_02.JPG"))).toBe("source a");
          expect(yield* fs.readFileString(path.join(outDir, "photo_03.JPG"))).toBe("existing gap");
          expect(yield* fs.readFileString(path.join(outDir, "photo_04.JPG"))).toBe("source b");
          expect(yield* fs.readFileString(path.join(outDir, "photo_05.JPG"))).toBe("source c");
          expect(yield* sortedDirectoryEntries(path.join(outDir, "photo_01.JPG"))).toEqual([]);
        })
      )
    ));

  it("keeps mixed-case collision planning and application filesystem-safe", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const outDir = path.join(tmpDir, "flat");

          yield* fs.makeDirectory(path.join(sourceDir, "a"), { recursive: true });
          yield* fs.makeDirectory(path.join(sourceDir, "b"), { recursive: true });
          yield* fs.makeDirectory(outDir, { recursive: true });
          yield* fs.writeFileString(path.join(sourceDir, "a", "photo.jpg"), "lowercase source");
          yield* fs.writeFileString(path.join(sourceDir, "b", "PHOTO.JPG"), "uppercase source");
          yield* fs.writeFileString(path.join(outDir, "Photo.jpg"), "existing mixed-case target");

          yield* runFilesCommand(["flatten-media", "--dir", sourceDir, "--out-dir", outDir, "--dry-run"]);

          expect(yield* TestConsole.logLines).toContain("a/photo.jpg -> photo_01.jpg");
          expect(yield* TestConsole.logLines).toContain("b/PHOTO.JPG -> PHOTO_02.JPG");
          expect(yield* fs.readFileString(path.join(sourceDir, "a", "photo.jpg"))).toBe("lowercase source");
          expect(yield* fs.readFileString(path.join(sourceDir, "b", "PHOTO.JPG"))).toBe("uppercase source");

          yield* runFilesCommand(["flatten-media", "--dir", sourceDir, "--out-dir", outDir]);

          expect(yield* sortedDirectoryEntries(outDir)).toEqual(["PHOTO_02.JPG", "Photo.jpg", "photo_01.jpg"]);
          expect(yield* fs.readFileString(path.join(outDir, "Photo.jpg"))).toBe("existing mixed-case target");
          expect(yield* fs.readFileString(path.join(outDir, "photo_01.jpg"))).toBe("lowercase source");
          expect(yield* fs.readFileString(path.join(outDir, "PHOTO_02.JPG"))).toBe("uppercase source");
        })
      )
    ));

  it("prints a dry-run plan without moving files or creating the destination", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const nestedDir = path.join(sourceDir, "nested");
          const outDir = path.join(tmpDir, "flat");

          yield* fs.makeDirectory(nestedDir, { recursive: true });
          yield* fs.writeFileString(path.join(nestedDir, "photo.png"), "image");

          yield* runFilesCommand(["flatten-media", "--dir", sourceDir, "--out-dir", outDir, "--dry-run"]);

          expect(yield* fs.readFileString(path.join(nestedDir, "photo.png"))).toBe("image");
          expect(yield* fs.exists(outDir)).toBe(false);
          expect(yield* TestConsole.logLines).toContain(
            "files flatten-media: dry run; no directory created and no files moved."
          );
        })
      )
    ));

  it("does not create the destination when no media files are found", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const outDir = path.join(tmpDir, "flat");

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.writeFileString(path.join(sourceDir, "notes.txt"), "keep");

          yield* runFilesCommand(["flatten-media", "--dir", sourceDir, "--out-dir", outDir]);

          expect(yield* fs.readFileString(path.join(sourceDir, "notes.txt"))).toBe("keep");
          expect(yield* fs.exists(outDir)).toBe(false);
        })
      )
    ));

  it("rejects an output path that is not a directory without moving media", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const outPath = path.join(tmpDir, "not-a-directory");
          const sourcePath = path.join(sourceDir, "photo.jpg");

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.writeFileString(sourcePath, "image");
          yield* fs.writeFileString(outPath, "existing file");

          yield* expectFilesCommandFailure(["flatten-media", "--dir", sourceDir, "--out-dir", outPath]);

          expect(yield* fs.readFileString(sourcePath)).toBe("image");
          expect(yield* fs.readFileString(outPath)).toBe("existing file");
        })
      )
    ));

  it("rejects destination overlap in both containment directions", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const outerSourceDir = path.join(tmpDir, "outer-source");
          const nestedOutDir = path.join(outerSourceDir, "flat");
          const outerSourcePath = path.join(outerSourceDir, "outer.jpg");
          const sourceAlias = path.join(tmpDir, "source-alias");
          const aliasedNestedOutDir = path.join(sourceAlias, "aliased-flat");
          const outerOutDir = path.join(tmpDir, "outer-output");
          const nestedSourceDir = path.join(outerOutDir, "nested-source");
          const nestedSourcePath = path.join(nestedSourceDir, "nested.png");

          yield* fs.makeDirectory(outerSourceDir, { recursive: true });
          yield* fs.makeDirectory(nestedSourceDir, { recursive: true });
          yield* fs.writeFileString(outerSourcePath, "outer");
          yield* fs.writeFileString(nestedSourcePath, "nested");
          yield* fs.symlink(outerSourceDir, sourceAlias);

          yield* expectFilesCommandFailure(["flatten-media", "--dir", outerSourceDir, "--out-dir", nestedOutDir]);
          yield* expectFilesCommandFailure(["flatten-media", "--dir", outerSourceDir, "--out-dir", outerSourceDir]);
          yield* expectFilesCommandFailure(["flatten-media", "--dir", nestedSourceDir, "--out-dir", outerOutDir]);
          yield* expectFilesCommandFailure([
            "flatten-media",
            "--dir",
            outerSourceDir,
            "--out-dir",
            aliasedNestedOutDir,
          ]);

          expect(yield* fs.readFileString(outerSourcePath)).toBe("outer");
          expect(yield* fs.readFileString(nestedSourcePath)).toBe("nested");
          expect(yield* fs.exists(nestedOutDir)).toBe(false);
          expect(yield* fs.exists(path.join(outerSourceDir, "aliased-flat"))).toBe(false);
        })
      )
    ));

  it("skips symlinked media files and directories during recursive traversal", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const outsideDir = path.join(tmpDir, "outside");
          const outsideFile = path.join(tmpDir, "outside.png");
          const outDir = path.join(tmpDir, "flat");

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.makeDirectory(outsideDir, { recursive: true });
          yield* fs.writeFileString(path.join(sourceDir, "actual.jpg"), "actual");
          yield* fs.writeFileString(outsideFile, "outside file");
          yield* fs.writeFileString(path.join(outsideDir, "hidden.mp4"), "outside directory");
          yield* fs.symlink(outsideFile, path.join(sourceDir, "linked.png"));
          yield* fs.symlink(outsideDir, path.join(sourceDir, "linked-dir"));

          yield* runFilesCommand(["flatten-media", "--dir", sourceDir, "--out-dir", outDir]);

          expect(yield* sortedDirectoryEntries(outDir)).toEqual(["actual.jpg"]);
          expect(yield* sortedDirectoryEntries(sourceDir)).toEqual(["linked-dir", "linked.png"]);
          expect(yield* fs.readFileString(outsideFile)).toBe("outside file");
          expect(yield* fs.readFileString(path.join(outsideDir, "hidden.mp4"))).toBe("outside directory");
        })
      )
    ));

  it("fails cross-device preflight before creating the destination or moving files", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const firstSourcePath = path.join(sourceDir, "a.jpg");
          const secondSourcePath = path.join(sourceDir, "b.mp4");
          const outDir = path.join(tmpDir, "flat");
          let renameCallCount = 0;

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.writeFileString(firstSourcePath, "first");
          yield* fs.writeFileString(secondSourcePath, "second");

          const crossDeviceFileSystem: FileSystem.FileSystem = {
            ...fs,
            rename: (fromPath, toPath) =>
              Effect.sync(() => {
                renameCallCount += 1;
              }).pipe(Effect.flatMap(() => fs.rename(fromPath, toPath))),
            stat: (filePath) =>
              fs
                .stat(filePath)
                .pipe(Effect.map((info) => (filePath === secondSourcePath ? { ...info, dev: info.dev + 1 } : info))),
          };
          const error = yield* flattenMediaFiles(
            FlattenMediaOptions.make({ dir: sourceDir, dryRun: false, outDir })
          ).pipe(
            provideScopedLayer(FilesCommandServiceLive),
            Effect.provideService(FileSystem.FileSystem, crossDeviceFileSystem),
            Effect.flip
          );

          expect(error.message).toContain("different filesystems");
          expect(renameCallCount).toBe(0);
          expect(yield* fs.readFileString(firstSourcePath)).toBe("first");
          expect(yield* fs.readFileString(secondSourcePath)).toBe("second");
          expect(yield* fs.exists(outDir)).toBe(false);
        })
      )
    ));

  it("preserves a target discovered immediately before the move", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const sourcePath = path.join(sourceDir, "photo.jpg");
          const outDir = path.join(tmpDir, "flat");
          const targetPath = path.join(outDir, "photo.jpg");
          let targetProbeCount = 0;
          let injectedTarget = false;

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.writeFileString(sourcePath, "source");

          const racingFileSystem: FileSystem.FileSystem = {
            ...fs,
            exists: (filePath) =>
              Effect.suspend(() => {
                if (filePath !== targetPath) {
                  return fs.exists(filePath);
                }

                targetProbeCount += 1;
                if (targetProbeCount < 2) {
                  return fs.exists(filePath);
                }

                injectedTarget = true;
                return fs.writeFileString(filePath, "concurrent target").pipe(Effect.as(true));
              }),
          };
          const error = yield* flattenMediaFiles(
            FlattenMediaOptions.make({ dir: sourceDir, dryRun: false, outDir })
          ).pipe(
            provideScopedLayer(FilesCommandServiceLive),
            Effect.provideService(FileSystem.FileSystem, racingFileSystem),
            Effect.flip
          );

          expect(error.message).toContain("Refusing to overwrite");
          expect(injectedTarget).toBe(true);
          expect(yield* fs.readFileString(sourcePath)).toBe("source");
          expect(yield* fs.readFileString(targetPath)).toBe("concurrent target");
        })
      )
    ));

  it("rolls completed moves back and leaves the new output directory in place when a later move fails", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const firstSourcePath = path.join(sourceDir, "a.jpg");
          const secondSourcePath = path.join(sourceDir, "b.mp4");
          const outDir = path.join(tmpDir, "flat");
          let renameCallCount = 0;

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.writeFileString(firstSourcePath, "first");
          yield* fs.writeFileString(secondSourcePath, "second");

          const failingFileSystem: FileSystem.FileSystem = {
            ...fs,
            rename: (fromPath, toPath) =>
              Effect.suspend(() => {
                renameCallCount += 1;
                return renameCallCount === 2
                  ? Effect.fail(
                      PlatformError.badArgument({
                        description: "simulated second rename failure",
                        method: "rename",
                        module: "FileSystem",
                      })
                    )
                  : fs.rename(fromPath, toPath);
              }),
          };

          const error = yield* flattenMediaFiles(
            FlattenMediaOptions.make({ dir: sourceDir, dryRun: false, outDir })
          ).pipe(
            provideScopedLayer(FilesCommandServiceLive),
            Effect.provideService(FileSystem.FileSystem, failingFileSystem),
            Effect.flip
          );

          expect(renameCallCount).toBe(3);
          expect(error.message).toContain("Completed moves were restored.");
          expect(yield* fs.readFileString(firstSourcePath)).toBe("first");
          expect(yield* fs.readFileString(secondSourcePath)).toBe("second");
          expect(yield* sortedDirectoryEntries(outDir)).toEqual([]);
        })
      )
    ));

  it("does not clean up an output directory created by another actor after planning", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const firstSourcePath = path.join(sourceDir, "a.jpg");
          const secondSourcePath = path.join(sourceDir, "b.mp4");
          const outDir = path.join(tmpDir, "flat");
          let injectedDirectory = false;
          let renameCallCount = 0;

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.writeFileString(firstSourcePath, "first");
          yield* fs.writeFileString(secondSourcePath, "second");

          const racingFileSystem: FileSystem.FileSystem = {
            ...fs,
            makeDirectory: (directoryPath, options) =>
              Effect.suspend(() => {
                if (directoryPath !== outDir || injectedDirectory) {
                  return fs.makeDirectory(directoryPath, options);
                }

                injectedDirectory = true;
                return fs.makeDirectory(directoryPath).pipe(Effect.andThen(fs.makeDirectory(directoryPath, options)));
              }),
            rename: (fromPath, toPath) =>
              Effect.suspend(() => {
                renameCallCount += 1;
                return renameCallCount === 2
                  ? Effect.fail(
                      PlatformError.badArgument({
                        description: "simulated second rename failure",
                        method: "rename",
                        module: "FileSystem",
                      })
                    )
                  : fs.rename(fromPath, toPath);
              }),
          };

          const error = yield* flattenMediaFiles(
            FlattenMediaOptions.make({ dir: sourceDir, dryRun: false, outDir })
          ).pipe(
            provideScopedLayer(FilesCommandServiceLive),
            Effect.provideService(FileSystem.FileSystem, racingFileSystem),
            Effect.flip
          );

          expect(error.message).toContain("Completed moves were restored.");
          expect(injectedDirectory).toBe(true);
          expect(yield* fs.exists(outDir)).toBe(true);
          expect(yield* sortedDirectoryEntries(outDir)).toEqual([]);
          expect(yield* fs.readFileString(firstSourcePath)).toBe("first");
          expect(yield* fs.readFileString(secondSourcePath)).toBe("second");
        })
      )
    ));

  it("reports rollback failures without disturbing source files that were not moved", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceDir = path.join(tmpDir, "source");
          const firstSourcePath = path.join(sourceDir, "a.jpg");
          const secondSourcePath = path.join(sourceDir, "b.mp4");
          const outDir = path.join(tmpDir, "flat");
          const firstTargetPath = path.join(outDir, "a.jpg");
          const sentinelDirectory = path.join(outDir, "reserved");
          const sentinelPath = path.join(outDir, "sentinel.txt");
          let renameCallCount = 0;

          yield* fs.makeDirectory(sourceDir, { recursive: true });
          yield* fs.makeDirectory(sentinelDirectory, { recursive: true });
          yield* fs.writeFileString(firstSourcePath, "first");
          yield* fs.writeFileString(secondSourcePath, "second");
          yield* fs.writeFileString(sentinelPath, "sentinel");

          const failingFileSystem: FileSystem.FileSystem = {
            ...fs,
            rename: (fromPath, toPath) =>
              Effect.suspend(() => {
                renameCallCount += 1;
                return renameCallCount === 1
                  ? fs.rename(fromPath, toPath)
                  : Effect.fail(
                      PlatformError.badArgument({
                        description:
                          renameCallCount === 2 ? "simulated second rename failure" : "simulated rollback failure",
                        method: "rename",
                        module: "FileSystem",
                      })
                    );
              }),
          };
          const error = yield* flattenMediaFiles(
            FlattenMediaOptions.make({ dir: sourceDir, dryRun: false, outDir })
          ).pipe(
            provideScopedLayer(FilesCommandServiceLive),
            Effect.provideService(FileSystem.FileSystem, failingFileSystem),
            Effect.flip
          );

          expect(renameCallCount).toBe(3);
          expect(error.message).toMatch(/rollback/i);
          expect(yield* fs.exists(firstSourcePath)).toBe(false);
          expect(yield* fs.readFileString(secondSourcePath)).toBe("second");
          expect(yield* fs.readFileString(firstTargetPath)).toBe("first");
          expect(yield* fs.readFileString(sentinelPath)).toBe("sentinel");
          expect(yield* sortedDirectoryEntries(sentinelDirectory)).toEqual([]);
        })
      )
    ));

  it("normalizes images into an output directory with orientation, metadata stripping, resizing, and a manifest", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "dataset", "images");
          const sourcePath = path.join(rawDir, "portrait.jpg");
          const outputPath = path.join(outDir, "portrait.png");
          const manifestPath = path.join(outDir, "normalize-manifest.json");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithOrientationExif(sourcePath, 3, 5, 6);
          expect((yield* readImageMetadata(sourcePath)).exif).toBeDefined();

          yield* runFilesCommand([
            "normalize",
            "--dir",
            rawDir,
            "--out-dir",
            outDir,
            "--format",
            "png",
            "--max-long-edge",
            "4",
          ]);

          const outputMetadata = yield* readImageMetadata(outputPath);
          const sourceMetadata = yield* readImageMetadata(sourcePath);
          const manifest = yield* readNormalizeManifest(manifestPath);

          expect(outputMetadata.format).toBe("png");
          expect(outputMetadata.exif).toBeUndefined();
          expect(outputMetadata.width).toBe(4);
          expect(outputMetadata.height).toBe(2);
          expect(sourceMetadata.exif).toBeDefined();
          expect(yield* sortedDirectoryEntries(rawDir)).toEqual(["portrait.jpg"]);
          expect(yield* sortedDirectoryEntries(outDir)).toEqual(["normalize-manifest.json", "portrait.png"]);
          expect(manifest.schemaVersion).toBe("beep.files.normalize.v1");
          expect(manifest.sourceDirectory).toBe(rawDir);
          expect(manifest.outputDirectory).toBe(outDir);
          expect(manifest.summary).toEqual({
            duplicateCount: 0,
            movedDuplicateCount: 0,
            normalizedCount: 1,
            plannedCount: 1,
            resizedCount: 1,
            skippedCount: 0,
          });
          expect(manifest.entries[0]?.sourceRelativePath).toBe("portrait.jpg");
          expect(manifest.entries[0]?.outputRelativePath).toBe("portrait.png");
          expect(manifest.entries[0]?.inputDimensions).toEqual({ width: 5, height: 3 });
          expect(manifest.entries[0]?.outputDimensions).toEqual({ width: 4, height: 2 });
          expect(manifest.entries[0]?.resized).toBe(true);
          expect(manifest.entries[0]?.outputSizeBytes).toBeDefined();
        })
      )
    ));

  it("does not upscale images during normalization", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "out");
          const sourcePath = path.join(rawDir, "small.jpg");
          const outputPath = path.join(outDir, "small.webp");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithExif(sourcePath, 3, 2);

          yield* runFilesCommand([
            "normalize",
            "--dir",
            rawDir,
            "--out-dir",
            outDir,
            "--format",
            "webp",
            "--max-long-edge",
            "20",
          ]);

          const outputMetadata = yield* readImageMetadata(outputPath);
          const manifest = yield* readNormalizeManifest(path.join(outDir, "normalize-manifest.json"));

          expect(outputMetadata.format).toBe("webp");
          expect(outputMetadata.width).toBe(3);
          expect(outputMetadata.height).toBe(2);
          expect(manifest.entries[0]?.resized).toBe(false);
          expect(manifest.summary.resizedCount).toBe(0);
        })
      )
    ));

  it("skips exact duplicate normalized outputs when normalize dedupe is enabled", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "out");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeInsetCanvasImage(
            path.join(rawDir, "alpha.png"),
            4,
            4,
            { bottom: 0, left: 0, right: 0, top: 0 },
            { b: 48, g: 32, r: 16 },
            { b: 48, g: 32, r: 16 }
          );
          yield* writeInsetCanvasImage(
            path.join(rawDir, "copy.png"),
            4,
            4,
            { bottom: 0, left: 0, right: 0, top: 0 },
            { b: 48, g: 32, r: 16 },
            { b: 48, g: 32, r: 16 }
          );

          yield* runFilesCommand(["normalize", "--dir", rawDir, "--out-dir", outDir, "--dedupe"]);

          const manifest = yield* readNormalizeManifest(path.join(outDir, "normalize-manifest.json"));
          const outputHash = manifest.entries[0]?.outputHash;
          const duplicate = manifest.skipped[0];

          expect(yield* sortedDirectoryEntries(outDir)).toEqual(["alpha.png", "normalize-manifest.json"]);
          expect(manifest.summary).toEqual({
            duplicateCount: 1,
            movedDuplicateCount: 0,
            normalizedCount: 1,
            plannedCount: 2,
            resizedCount: 0,
            skippedCount: 1,
          });
          expect(outputHash).toMatch(/^sha256:[a-f0-9]{64}$/);
          expect(duplicate?.reason).toBe("duplicate");
          expect(duplicate?.sourceName).toBe("copy.png");
          expect(duplicate?.duplicateOfOutputRelativePath).toBe("alpha.png");
          expect(duplicate?.duplicateOfSourceRelativePath).toBe("alpha.png");
          expect(duplicate?.outputHash).toBe(outputHash);
        })
      )
    ));

  it("moves exact duplicate source files when normalize move-duplicates-to is provided", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "out");
          const duplicatesDir = path.join(tmpDir, "duplicates");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeInsetCanvasImage(
            path.join(rawDir, "alpha.png"),
            4,
            4,
            { bottom: 0, left: 0, right: 0, top: 0 },
            { b: 48, g: 32, r: 16 },
            { b: 48, g: 32, r: 16 }
          );
          yield* writeInsetCanvasImage(
            path.join(rawDir, "copy.png"),
            4,
            4,
            { bottom: 0, left: 0, right: 0, top: 0 },
            { b: 48, g: 32, r: 16 },
            { b: 48, g: 32, r: 16 }
          );

          yield* runFilesCommand([
            "normalize",
            "--dir",
            rawDir,
            "--out-dir",
            outDir,
            "--move-duplicates-to",
            duplicatesDir,
          ]);

          const manifest = yield* readNormalizeManifest(path.join(outDir, "normalize-manifest.json"));
          const duplicate = manifest.skipped[0];

          expect(yield* sortedDirectoryEntries(rawDir)).toEqual(["alpha.png"]);
          expect(yield* sortedDirectoryEntries(outDir)).toEqual(["alpha.png", "normalize-manifest.json"]);
          expect(yield* sortedDirectoryEntries(duplicatesDir)).toEqual(["copy.png"]);
          expect(manifest.options.dedupe).toBe(true);
          expect(manifest.options.moveDuplicatesTo).toBe(duplicatesDir);
          expect(manifest.summary).toEqual({
            duplicateCount: 1,
            movedDuplicateCount: 1,
            normalizedCount: 1,
            plannedCount: 2,
            resizedCount: 0,
            skippedCount: 1,
          });
          expect(duplicate?.reason).toBe("duplicate");
          expect(duplicate?.sourceName).toBe("copy.png");
          expect(duplicate?.duplicateMovedPath).toBe(path.join(duplicatesDir, "copy.png"));
          expect(duplicate?.duplicateMovedRelativePath).toBe("copy.png");
        })
      )
    ));

  it("preserves stems, resolves same-run output collisions, and records skipped sources", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "out");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "foo.jpg"), 2, 2);
          yield* writeJpegWithExif(path.join(rawDir, "foo.png"), 2, 2);
          yield* fs.writeFileString(path.join(rawDir, "notes.txt"), "caption");
          yield* fs.writeFileString(path.join(rawDir, "clip.mp4"), "video");
          yield* fs.writeFileString(path.join(rawDir, "extensionless"), "notes");
          yield* fs.makeDirectory(path.join(rawDir, "nested.jpg"));
          yield* writeSvgFile(path.join(rawDir, "vector.svg"), 2, 2);

          yield* runFilesCommand(["normalize", "--dir", rawDir, "--out-dir", outDir]);

          const manifest = yield* readNormalizeManifest(path.join(outDir, "normalize-manifest.json"));

          expect(yield* sortedDirectoryEntries(outDir)).toEqual(["foo.png", "foo_01.png", "normalize-manifest.json"]);
          expect(A.map(manifest.entries, (entry) => entry.outputName)).toEqual(["foo.png", "foo_01.png"]);
          expect(A.map(manifest.skipped, (entry) => entry.reason)).toEqual([
            "video",
            "extensionless",
            "directory",
            "non-media",
            "unsupported-image",
          ]);
          expect(manifest.summary).toEqual({
            duplicateCount: 0,
            movedDuplicateCount: 0,
            normalizedCount: 2,
            plannedCount: 2,
            resizedCount: 0,
            skippedCount: 5,
          });
        })
      )
    ));

  it("does not create outputs or directories during normalize dry-run", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "missing-out");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "photo.jpg"), 2, 2);

          yield* runFilesCommand(["normalize", "--dir", rawDir, "--out-dir", outDir, "--dry-run"]);

          expect(yield* fs.exists(outDir)).toBe(false);
          expect(yield* TestConsole.logLines).toContain("files normalize: dry run; no files written.");
        })
      )
    ));

  it("refuses existing normalize output files unless overwrite is enabled", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "out");
          const outputPath = path.join(outDir, "photo.png");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* fs.makeDirectory(outDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "photo.jpg"), 2, 2);
          yield* fs.writeFileString(outputPath, "existing");

          const output = yield* expectFilesCommandFailure(["normalize", "--dir", rawDir, "--out-dir", outDir]);

          expect(yield* fs.readFileString(outputPath)).toBe("existing");
          expect(yield* fs.exists(path.join(outDir, "normalize-manifest.json"))).toBe(false);
          expect(output).toContain("Refusing to overwrite existing normalize output");
          yield* runFilesCommand(["normalize", "--dir", rawDir, "--out-dir", outDir, "--overwrite"]);

          expect((yield* readImageMetadata(outputPath)).format).toBe("png");
          expect(yield* fs.exists(path.join(outDir, "normalize-manifest.json"))).toBe(true);
        })
      )
    ));

  it("refuses an existing normalize manifest unless overwrite is enabled", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "raw");
          const outDir = path.join(tmpDir, "out");
          const manifestPath = path.join(outDir, "normalize-manifest.json");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* fs.makeDirectory(outDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "photo.jpg"), 2, 2);
          yield* fs.writeFileString(manifestPath, "existing manifest");

          const output = yield* expectFilesCommandFailure(["normalize", "--dir", rawDir, "--out-dir", outDir]);

          expect(yield* fs.readFileString(manifestPath)).toBe("existing manifest");
          expect(yield* fs.exists(path.join(outDir, "photo.png"))).toBe(false);
          expect(output).toContain("Refusing to overwrite existing normalize manifest");
        })
      )
    ));

  it("creates missing same-stem caption sidecars for image files", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeJpegWithExif(path.join(datasetDir, "alpha.jpg"), 4, 4);
          yield* writeJpegWithExif(path.join(datasetDir, "beta.png"), 4, 4);
          yield* fs.writeFileString(path.join(datasetDir, "beta.txt"), "existing caption");
          yield* fs.writeFileString(path.join(datasetDir, "clip.mp4"), "video");
          yield* fs.writeFileString(path.join(datasetDir, "notes.md"), "notes");

          yield* runFilesCommand(["create-captions", "--dir", datasetDir, "--caption", "trigger token"]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual([
            "alpha.jpg",
            "alpha.txt",
            "beta.png",
            "beta.txt",
            "clip.mp4",
            "notes.md",
          ]);
          expect(yield* fs.readFileString(path.join(datasetDir, "alpha.txt"))).toBe("trigger token");
          expect(yield* fs.readFileString(path.join(datasetDir, "beta.txt"))).toBe("existing caption");
          expect(yield* TestConsole.logLines).toContain(
            `files create-captions: created 1 caption sidecar file(s); overwritten 0 existing caption file(s).`
          );
        })
      )
    ));

  it("does not create caption sidecars during create-captions dry-run", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeJpegWithExif(path.join(datasetDir, "alpha.jpg"), 4, 4);

          yield* runFilesCommand(["create-captions", "--dir", datasetDir, "--caption", "caption", "--dry-run"]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["alpha.jpg"]);
          expect(yield* fs.exists(path.join(datasetDir, "alpha.txt"))).toBe(false);
          expect(yield* TestConsole.logLines).toContain("files create-captions: dry run; no caption files written.");
        })
      )
    ));

  it("does not write through predictable caption temp symlinks", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const outsideFile = path.join(tmpDir, "outside.txt");
          const oldPredictableTempPath = path.join(datasetDir, `.alpha.txt.${process.pid}.tmp`);

          yield* writeJpegWithExif(path.join(datasetDir, "alpha.jpg"), 4, 4);
          yield* fs.writeFileString(outsideFile, "outside");
          yield* fs.symlink(outsideFile, oldPredictableTempPath);

          yield* runFilesCommand(["create-captions", "--dir", datasetDir, "--caption", "caption"]);

          expect(yield* fs.readFileString(path.join(datasetDir, "alpha.txt"))).toBe("caption");
          expect(yield* fs.readFileString(outsideFile)).toBe("outside");
          expect(yield* fs.readLink(oldPredictableTempPath)).toBe(outsideFile);
        })
      )
    ));

  it("overwrites existing caption sidecars only when requested", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const captionPath = path.join(datasetDir, "alpha.txt");

          yield* writeJpegWithExif(path.join(datasetDir, "alpha.jpg"), 4, 4);
          yield* fs.writeFileString(captionPath, "keep me");

          yield* runFilesCommand(["create-captions", "--dir", datasetDir, "--caption", "new caption"]);

          expect(yield* fs.readFileString(captionPath)).toBe("keep me");

          yield* runFilesCommand(["create-captions", "--dir", datasetDir, "--caption", "new caption", "--overwrite"]);

          expect(yield* fs.readFileString(captionPath)).toBe("new caption");
        })
      )
    ));

  it("skips duplicate caption targets during create-captions planning", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeJpegWithExif(path.join(datasetDir, "same.jpg"), 4, 4);
          yield* writeJpegWithExif(path.join(datasetDir, "same.png"), 4, 4);

          yield* runFilesCommand(["create-captions", "--dir", datasetDir]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["same.jpg", "same.png", "same.txt"]);
          expect(yield* fs.readFileString(path.join(datasetDir, "same.txt"))).toBe("");
          expect(yield* TestConsole.logLines).toContain(
            `same.png [caption-target-collision] Another image in this run already targets "same.txt".`
          );
        })
      )
    ));

  it("archives poor image candidates with same-stem txt sidecars by default", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "images");
          const archiveDir = path.join(tmpDir, "rejected");
          const tinyPath = path.join(rawDir, "tiny.jpg");
          const goodPath = path.join(rawDir, "good.jpg");
          const manifestPath = path.join(archiveDir, "archive-poor-candidates-manifest.json");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithExif(tinyPath, 20, 80);
          yield* writeJpegWithExif(goodPath, 64, 64);
          yield* fs.writeFileString(path.join(rawDir, "tiny.txt"), "tiny caption");

          yield* runFilesCommand([
            "archive-poor-candidates",
            "--dir",
            rawDir,
            "--archive-dir",
            archiveDir,
            "--target-resolution",
            "64",
            "--min-short-edge",
            "32",
            "--max-aspect",
            "3",
            "--max-upscale",
            "1.5",
          ]);

          const manifest = yield* readArchivePoorCandidatesManifest(manifestPath);

          expect(yield* sortedDirectoryEntries(rawDir)).toEqual(["good.jpg"]);
          expect(yield* sortedDirectoryEntries(archiveDir)).toEqual([
            "archive-poor-candidates-manifest.json",
            "tiny.jpg",
            "tiny.txt",
          ]);
          expect(yield* fs.readFileString(path.join(archiveDir, "tiny.txt"))).toBe("tiny caption");
          expect(manifest.schemaVersion).toBe("beep.files.archive-poor-candidates.v1");
          expect(manifest.summary).toEqual({
            archivedCount: 1,
            assessedCount: 2,
            keptCount: 1,
            movedSidecarCount: 1,
            skippedCount: 0,
          });
          expect(
            O.getOrUndefined(A.findFirst(manifest.entries, (entry) => entry.sourceName === "tiny.jpg"))?.decision
          ).toBe("archive");
          expect(
            O.getOrUndefined(A.findFirst(manifest.entries, (entry) => entry.sourceName === "tiny.jpg"))?.reasons
          ).toEqual(["short-edge-too-small", "extreme-aspect-ratio", "upscale-too-large"]);
          expect(
            O.getOrUndefined(A.findFirst(manifest.entries, (entry) => entry.sourceName === "good.jpg"))?.decision
          ).toBe("keep");
        })
      )
    ));

  it("does not create archives or directories during archive-poor-candidates dry-run", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "images");
          const archiveDir = path.join(tmpDir, "missing-rejected");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "tiny.jpg"), 20, 80);
          yield* fs.writeFileString(path.join(rawDir, "tiny.txt"), "tiny caption");

          yield* runFilesCommand([
            "archive-poor-candidates",
            "--dir",
            rawDir,
            "--archive-dir",
            archiveDir,
            "--target-resolution",
            "64",
            "--min-short-edge",
            "32",
            "--dry-run",
          ]);

          expect(yield* sortedDirectoryEntries(rawDir)).toEqual(["tiny.jpg", "tiny.txt"]);
          expect(yield* fs.exists(archiveDir)).toBe(false);
          expect(yield* TestConsole.logLines).toContain("files archive-poor-candidates: dry run; no files moved.");
        })
      )
    ));

  it("leaves captions in place when archive-poor-candidates sidecars are disabled", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "images");
          const archiveDir = path.join(tmpDir, "rejected");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "tiny.jpg"), 20, 80);
          yield* fs.writeFileString(path.join(rawDir, "tiny.txt"), "tiny caption");

          yield* runFilesCommand([
            "archive-poor-candidates",
            "--dir",
            rawDir,
            "--archive-dir",
            archiveDir,
            "--target-resolution",
            "64",
            "--min-short-edge",
            "32",
            "--sidecars",
            "none",
          ]);

          expect(yield* sortedDirectoryEntries(rawDir)).toEqual(["tiny.txt"]);
          expect(yield* sortedDirectoryEntries(archiveDir)).toEqual([
            "archive-poor-candidates-manifest.json",
            "tiny.jpg",
          ]);
        })
      )
    ));

  it("refuses existing archive targets unless overwrite is enabled", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "images");
          const archiveDir = path.join(tmpDir, "rejected");
          const archivePath = path.join(archiveDir, "tiny.jpg");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* fs.makeDirectory(archiveDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "tiny.jpg"), 20, 80);
          yield* fs.writeFileString(archivePath, "existing");

          const output = yield* expectFilesCommandFailure([
            "archive-poor-candidates",
            "--dir",
            rawDir,
            "--archive-dir",
            archiveDir,
            "--target-resolution",
            "64",
            "--min-short-edge",
            "32",
          ]);

          expect(yield* fs.readFileString(archivePath)).toBe("existing");
          expect(yield* fs.exists(path.join(rawDir, "tiny.jpg"))).toBe(true);
          expect(output).toContain("Refusing to overwrite existing archive output file");
          yield* runFilesCommand([
            "archive-poor-candidates",
            "--dir",
            rawDir,
            "--archive-dir",
            archiveDir,
            "--target-resolution",
            "64",
            "--min-short-edge",
            "32",
            "--overwrite",
          ]);

          expect((yield* readImageMetadata(archivePath)).format).toBe("jpeg");
          expect(yield* fs.exists(path.join(rawDir, "tiny.jpg"))).toBe(false);
        })
      )
    ));

  it("records skipped sources while archiving poor candidates", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "images");
          const archiveDir = path.join(tmpDir, "rejected");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeSizedFile(path.join(rawDir, "broken.jpg"), 1, "x");
          yield* fs.writeFileString(path.join(rawDir, "caption.txt"), "caption");
          yield* fs.writeFileString(path.join(rawDir, "clip.mp4"), "video");
          yield* fs.writeFileString(path.join(rawDir, "extensionless"), "notes");
          yield* fs.makeDirectory(path.join(rawDir, "nested.jpg"));
          yield* writeSvgFile(path.join(rawDir, "vector.svg"), 2, 2);

          yield* runFilesCommand(["archive-poor-candidates", "--dir", rawDir, "--archive-dir", archiveDir]);

          const manifest = yield* readArchivePoorCandidatesManifest(
            path.join(archiveDir, "archive-poor-candidates-manifest.json")
          );

          expect(manifest.entries).toEqual([]);
          expect(A.map(manifest.skipped, (entry) => entry.reason)).toEqual([
            "unreadable-image",
            "non-media",
            "video",
            "extensionless",
            "directory",
            "unsupported-image",
          ]);
          expect(manifest.summary.skippedCount).toBe(6);
        })
      )
    ));

  it("refuses to archive poor candidates into the source directory", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const rawDir = path.join(tmpDir, "images");

          yield* fs.makeDirectory(rawDir, { recursive: true });
          yield* writeJpegWithExif(path.join(rawDir, "tiny.jpg"), 20, 80);

          const output = yield* expectFilesCommandFailure([
            "archive-poor-candidates",
            "--dir",
            rawDir,
            "--archive-dir",
            rawDir,
          ]);

          expect(output).toBe(`Refusing to archive into the source directory: "${rawDir}"`);
        })
      )
    ));

  it("strips image metadata by normalizing selected image files", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const imagePath = path.join(datasetDir, "photo.jpg");

          yield* writeJpegWithExif(imagePath, 4, 3);
          expect((yield* readImageMetadata(imagePath)).exif).toBeDefined();

          yield* runFilesCommand(["strip-metadata", "--dir", datasetDir]);

          const metadata = yield* readImageMetadata(imagePath);
          expect(metadata.exif).toBeUndefined();
          expect(metadata.width).toBe(4);
          expect(metadata.height).toBe(3);
          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["photo.jpg"]);
        })
      )
    ));

  it("preserves files during strip-metadata dry-run without decoding media", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);

          yield* writeSizedFile(path.join(datasetDir, "broken.jpg"), 1, "x");
          yield* writeSizedFile(path.join(datasetDir, "clip.mp4"), 1, "v");

          yield* runFilesCommand(["strip-metadata", "--dir", datasetDir, "--dry-run"]);

          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["broken.jpg", "clip.mp4"]);
          expect(yield* TestConsole.logLines).toContain("files strip-metadata: dry run; no files rewritten.");
        })
      )
    ));

  it("skips non-media files and unsupported image formats", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const imagePath = path.join(datasetDir, "photo.jpg");

          yield* writeJpegWithExif(imagePath, 2, 2);
          yield* writeSvgFile(path.join(datasetDir, "vector.svg"), 1, 1);
          yield* fs.writeFileString(path.join(datasetDir, "caption.txt"), "caption");

          yield* runFilesCommand(["strip-metadata", "--dir", datasetDir]);

          expect((yield* readImageMetadata(imagePath)).exif).toBeUndefined();
          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["caption.txt", "photo.jpg", "vector.svg"]);
          expect(yield* TestConsole.logLines).toContain(
            "files strip-metadata: skipped 2 unsupported or non-media file(s)."
          );
        })
      )
    ));

  it("uses ffmpeg stream copy flags for selected video files", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const clipPath = path.join(datasetDir, "clip.mp4");

          yield* writeFfmpegShim(binDir, argsPath);
          yield* writeSizedFile(clipPath, 4, "v");

          yield* withEnvVar(
            "BEEP_FFMPEG_PATH",
            path.join(binDir, "ffmpeg"),
            runFilesCommand(["strip-metadata", "--dir", datasetDir])
          );

          const args = pipe(yield* fs.readFileString(argsPath), Str.split("\n"));
          expect(A.slice(args, { start: 0, end: -2 })).toEqual([
            "-hide_banner",
            "-nostdin",
            "-y",
            "-protocol_whitelist",
            "file,pipe",
            "-i",
            clipPath,
            "-map",
            "0",
            "-c",
            "copy",
            "-map_metadata",
            "-1",
            "-map_metadata:s",
            "-1",
            "-map_metadata:c",
            "-1",
            "-map_chapters",
            "-1",
          ]);
          expect(O.getOrUndefined(A.get(args, args.length - 2))).toContain(".beep-files-strip-metadata-");
          expect(yield* fs.readFileString(clipPath)).toBe("clean video\n");
        })
      )
    ));

  it("leaves originals untouched when strip-metadata transform fails", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const validPath = path.join(datasetDir, "valid.jpg");

          yield* writeJpegWithExif(validPath, 3, 3);
          yield* writeSizedFile(path.join(datasetDir, "broken.png"), 1, "x");

          const output = yield* expectFilesCommandFailure(["strip-metadata", "--dir", datasetDir]);

          expect((yield* readImageMetadata(validPath)).exif).toBeDefined();
          expect(yield* sortedDirectoryEntries(datasetDir)).toEqual(["broken.png", "valid.jpg"]);
          expect(output).toContain("Failed to normalize image metadata");
        })
      )
    ));

  it("leaves video originals untouched when ffmpeg fails", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const clipPath = path.join(datasetDir, "clip.mp4");

          yield* writeFailingFfmpegShim(binDir, argsPath);
          yield* writeSizedFile(clipPath, 4, "v");

          yield* withEnvVar(
            "BEEP_FFMPEG_PATH",
            path.join(binDir, "ffmpeg"),
            expectFilesCommandFailure(["strip-metadata", "--dir", datasetDir])
          );

          expect(yield* fs.readFileString(clipPath)).toBe("vvvv");
          expect(yield* fs.exists(argsPath)).toBe(true);
        })
      )
    ));

  it("materializes a complete hash-pinned image ledger as metadata-free canonical PNGs", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const firstPath = path.join(datasetDir, "first.jpg");
          const secondPath = path.join(datasetDir, "second.jpg");
          const decisionsPath = path.join(tmpDir, "decisions.json");
          const outDir = path.join(tmpDir, "prepared");

          yield* writeJpegWithExif(firstPath, 64, 48);
          yield* writeJpegWithExif(secondPath, 48, 64);
          const firstBefore = yield* sha256FileRef(firstPath);
          const secondBefore = yield* sha256FileRef(secondPath);
          const decisionText = yield* encodeImageCurationDecisionDocument(
            ImageCurationDecisionDocument.make({
              decisions: [
                {
                  crop: { height: 24, left: 0, top: 0, width: 32 },
                  disposition: "active-core",
                  reasons: ["clean-current-identity"],
                  sourceName: "first.jpg",
                  sourceSha256: firstBefore,
                },
                {
                  disposition: "archive-technical-quality",
                  reasons: ["test-technical-archive"],
                  sourceName: "second.jpg",
                  sourceSha256: secondBefore,
                },
              ],
              schemaVersion: "beep.files.image-curation-decisions.v1",
              sourceDirectory: datasetDir,
            })
          );
          yield* fs.writeFileString(decisionsPath, decisionText);

          yield* runFilesCommand([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outDir,
            "--dry-run",
          ]);
          expect(yield* fs.exists(outDir)).toBe(false);

          yield* runFilesCommand([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outDir,
          ]);

          const manifestPath = path.join(outDir, "manifests", "image-curation-manifest.json");
          const manifest = yield* decodeImageCurationManifest(yield* fs.readFileString(manifestPath));
          expect(manifest.schemaVersion).toBe("beep.files.image-curation.v1");
          expect(manifest.summary.plannedCount).toBe(2);
          expect(manifest.summary.materializedCount).toBe(2);
          expect(manifest.summary.coreCount).toBe(1);
          expect(manifest.summary.archiveCount).toBe(1);
          expect(manifest.entries.map((entry) => entry.outputRelativePath)).toEqual([
            `canonical/active/core/twv1_${firstBefore.slice("sha256:".length, "sha256:".length + 20)}.png`,
            `archive/technical-quality/twv1_${secondBefore.slice("sha256:".length, "sha256:".length + 20)}.png`,
          ]);
          for (const entry of manifest.entries) {
            const metadata = yield* readImageMetadata(entry.outputPath);
            expect(metadata.format).toBe("png");
            expect(metadata.exif).toBeUndefined();
            expect(metadata.iptc).toBeUndefined();
            expect(metadata.xmp).toBeUndefined();
          }
          expect(yield* sha256FileRef(firstPath)).toBe(firstBefore);
          expect(yield* sha256FileRef(secondPath)).toBe(secondBefore);
        })
      )
    ));

  it("allocates distinct derivative paths for byte-identical image sources", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const firstPath = path.join(datasetDir, "first.jpg");
          const secondPath = path.join(datasetDir, "second.jpg");
          const decisionsPath = path.join(tmpDir, "decisions.json");
          const outDir = path.join(tmpDir, "prepared");

          yield* writeJpegWithExif(firstPath, 32, 32);
          yield* fs.writeFile(secondPath, yield* fs.readFile(firstPath));
          const sourceHash = yield* sha256FileRef(firstPath);
          const decisionText = yield* encodeImageCurationDecisionDocument(
            ImageCurationDecisionDocument.make({
              decisions: [
                {
                  disposition: "active-core",
                  reasons: ["preferred-duplicate"],
                  sourceName: "first.jpg",
                  sourceSha256: sourceHash,
                },
                {
                  disposition: "active-core",
                  reasons: ["preserved-duplicate"],
                  sourceName: "second.jpg",
                  sourceSha256: sourceHash,
                },
              ],
              schemaVersion: "beep.files.image-curation-decisions.v1",
              sourceDirectory: datasetDir,
            })
          );
          yield* fs.writeFileString(decisionsPath, decisionText);

          yield* runFilesCommand([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outDir,
          ]);

          const manifestPath = path.join(outDir, "manifests", "image-curation-manifest.json");
          const manifest = yield* decodeImageCurationManifest(yield* fs.readFileString(manifestPath));
          const hashPrefix = sourceHash.slice("sha256:".length, "sha256:".length + 20);
          expect(manifest.entries.map((entry) => entry.outputName)).toEqual([
            `twv1_${hashPrefix}.png`,
            `twv1_${hashPrefix}_2.png`,
          ]);
          expect(manifest.entries[0]?.outputPath).not.toBe(manifest.entries[1]?.outputPath);
          expect(yield* fs.exists(manifest.entries[0]?.outputPath ?? "")).toBe(true);
          expect(yield* fs.exists(manifest.entries[1]?.outputPath ?? "")).toBe(true);
        })
      )
    ));

  it("refuses audit manifests that reach protected files through filesystem aliases", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const sourcePath = path.join(datasetDir, "source.jpg");
          const modelDir = path.join(tmpDir, "model");
          const modelPath = path.join(modelDir, "face-detection.onnx");
          const sourceAlias = path.join(tmpDir, "source-alias");
          const modelAlias = path.join(tmpDir, "model-alias");

          yield* writeJpegWithExif(sourcePath, 32, 32);
          const sourceHash = yield* sha256FileRef(sourcePath);
          yield* fs.makeDirectory(modelDir, { recursive: true });
          yield* fs.writeFileString(modelPath, "not a real model");
          yield* fs.symlink(datasetDir, sourceAlias);
          yield* fs.symlink(modelDir, modelAlias);
          const baseArgs = ["audit-images", "--dir", datasetDir, "--model", modelPath, "--overwrite", "--manifest"];

          const sourceAliasError = yield* expectFilesCommandFailure([
            ...baseArgs,
            path.join(sourceAlias, "audit.json"),
          ]);
          expect(sourceAliasError).toContain("must not be written inside source directory");
          expect(yield* sha256FileRef(sourcePath)).toBe(sourceHash);

          const modelAliasError = yield* expectFilesCommandFailure([
            ...baseArgs,
            path.join(modelAlias, "face-detection.onnx"),
          ]);
          expect(modelAliasError).toContain("must not overwrite face model");
          expect(yield* fs.readFileString(modelPath)).toBe("not a real model");
        })
      )
    ));

  it("refuses curation manifests that overlap protected inputs or generated derivatives", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const sourcePath = path.join(datasetDir, "source.jpg");
          const decisionsPath = path.join(tmpDir, "decisions.json");
          const outDir = path.join(tmpDir, "prepared");

          yield* writeJpegWithExif(sourcePath, 32, 32);
          const sourceHash = yield* sha256FileRef(sourcePath);
          const decisionText = yield* encodeImageCurationDecisionDocument(
            ImageCurationDecisionDocument.make({
              decisions: [
                {
                  disposition: "active-core",
                  reasons: ["clean-current-identity"],
                  sourceName: "source.jpg",
                  sourceSha256: sourceHash,
                },
              ],
              schemaVersion: "beep.files.image-curation-decisions.v1",
              sourceDirectory: datasetDir,
            })
          );
          yield* fs.writeFileString(decisionsPath, decisionText);
          const baseArgs = [
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outDir,
            "--overwrite",
            "--manifest",
          ];

          const sourceManifestError = yield* expectFilesCommandFailure([...baseArgs, sourcePath]);
          expect(sourceManifestError).toContain("must not be written inside source directory");
          expect(yield* sha256FileRef(sourcePath)).toBe(sourceHash);

          const decisionManifestError = yield* expectFilesCommandFailure([...baseArgs, decisionsPath]);
          expect(decisionManifestError).toContain("must not overwrite decision ledger");
          expect(yield* fs.readFileString(decisionsPath)).toBe(decisionText);

          const outputPath = path.join(
            outDir,
            "canonical",
            "active",
            "core",
            `twv1_${sourceHash.slice("sha256:".length, "sha256:".length + 20)}.png`
          );
          const derivativeManifestError = yield* expectFilesCommandFailure([...baseArgs, outputPath]);
          expect(derivativeManifestError).toContain("must not overlap generated derivative");
          expect(yield* fs.exists(outDir)).toBe(false);
        })
      )
    ));

  it("refuses filesystem aliases that escape protected curation roots", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const sourcePath = path.join(datasetDir, "source.jpg");
          const ledgerDir = path.join(tmpDir, "ledger");
          const decisionsPath = path.join(ledgerDir, "decisions.json");
          const sourceAlias = path.join(tmpDir, "source-alias");
          const ledgerAlias = path.join(tmpDir, "ledger-alias");
          const outputAlias = path.join(tmpDir, "output-alias");
          const outDir = path.join(tmpDir, "prepared");

          yield* writeJpegWithExif(sourcePath, 32, 32);
          const sourceHash = yield* sha256FileRef(sourcePath);
          const decisionText = yield* encodeImageCurationDecisionDocument(
            ImageCurationDecisionDocument.make({
              decisions: [
                {
                  disposition: "active-core",
                  reasons: ["clean-current-identity"],
                  sourceName: "source.jpg",
                  sourceSha256: sourceHash,
                },
              ],
              schemaVersion: "beep.files.image-curation-decisions.v1",
              sourceDirectory: datasetDir,
            })
          );
          yield* fs.makeDirectory(ledgerDir, { recursive: true });
          yield* fs.writeFileString(decisionsPath, decisionText);
          yield* fs.symlink(datasetDir, sourceAlias);
          yield* fs.symlink(ledgerDir, ledgerAlias);
          yield* fs.symlink(datasetDir, outputAlias);

          const baseArgs = [
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outDir,
            "--overwrite",
            "--manifest",
          ];
          const sourceAliasError = yield* expectFilesCommandFailure([
            ...baseArgs,
            path.join(sourceAlias, "manifest.json"),
          ]);
          expect(sourceAliasError).toContain("must not be written inside source directory");

          const ledgerAliasError = yield* expectFilesCommandFailure([
            ...baseArgs,
            path.join(ledgerAlias, "decisions.json"),
          ]);
          expect(ledgerAliasError).toContain("must not overwrite decision ledger");
          expect(yield* fs.readFileString(decisionsPath)).toBe(decisionText);

          const outputAliasError = yield* expectFilesCommandFailure([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outputAlias,
            "--dry-run",
          ]);
          expect(outputAliasError).toContain("output directory must not overlap source directory");

          const derivativeParent = path.join(outDir, "canonical", "active");
          yield* fs.makeDirectory(derivativeParent, { recursive: true });
          yield* fs.symlink(datasetDir, path.join(derivativeParent, "core"));
          const derivativeAliasError = yield* expectFilesCommandFailure([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outDir,
            "--dry-run",
          ]);
          expect(derivativeAliasError).toContain("derivative must remain inside output directory");
          expect(yield* sha256FileRef(sourcePath)).toBe(sourceHash);
        })
      )
    ));

  it("keeps prior outputs intact when a later curation source cannot be materialized", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const validPath = path.join(datasetDir, "a-valid.jpg");
          const brokenPath = path.join(datasetDir, "z-broken.jpg");
          const decisionsPath = path.join(tmpDir, "decisions.json");
          const outDir = path.join(tmpDir, "prepared");
          const manifestPath = path.join(outDir, "manifests", "image-curation-manifest.json");

          yield* writeJpegWithExif(validPath, 32, 32);
          yield* fs.writeFileString(brokenPath, "not-an-image");
          const validHash = yield* sha256FileRef(validPath);
          const decisionText = yield* encodeImageCurationDecisionDocument(
            ImageCurationDecisionDocument.make({
              decisions: [
                {
                  disposition: "active-core",
                  reasons: ["clean-current-identity"],
                  sourceName: "a-valid.jpg",
                  sourceSha256: validHash,
                },
                {
                  disposition: "archive-technical-quality",
                  reasons: ["broken-decoder-input"],
                  sourceName: "z-broken.jpg",
                  sourceSha256: yield* sha256FileRef(brokenPath),
                },
              ],
              schemaVersion: "beep.files.image-curation-decisions.v1",
              sourceDirectory: datasetDir,
            })
          );
          yield* fs.writeFileString(decisionsPath, decisionText);

          const existingOutputPath = path.join(
            outDir,
            "canonical",
            "active",
            "core",
            `twv1_${validHash.slice("sha256:".length, "sha256:".length + 20)}.png`
          );
          yield* fs.makeDirectory(path.dirname(existingOutputPath), { recursive: true });
          yield* fs.makeDirectory(path.dirname(manifestPath), { recursive: true });
          yield* fs.writeFileString(existingOutputPath, "previous-output");
          yield* fs.writeFileString(manifestPath, "previous-manifest");

          const output = yield* expectFilesCommandFailure([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            outDir,
            "--overwrite",
          ]);

          expect(output).toContain("Failed to inspect canonical PNG source");
          expect(yield* fs.readFileString(existingOutputPath)).toBe("previous-output");
          expect(yield* fs.readFileString(manifestPath)).toBe("previous-manifest");
        })
      )
    ));

  it("refuses incomplete or source-drifted image curation ledgers", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const datasetDir = yield* makeDatasetDir(tmpDir);
          const firstPath = path.join(datasetDir, "first.jpg");
          const secondPath = path.join(datasetDir, "second.jpg");
          const decisionsPath = path.join(tmpDir, "decisions.json");

          yield* writeJpegWithExif(firstPath, 32, 32);
          yield* writeJpegWithExif(secondPath, 32, 32);
          const firstHash = yield* sha256FileRef(firstPath);
          const incompleteText = yield* encodeImageCurationDecisionDocument(
            ImageCurationDecisionDocument.make({
              decisions: [
                {
                  disposition: "active-core",
                  reasons: ["clean-current-identity"],
                  sourceName: "first.jpg",
                  sourceSha256: firstHash,
                },
              ],
              schemaVersion: "beep.files.image-curation-decisions.v1",
              sourceDirectory: datasetDir,
            })
          );
          yield* fs.writeFileString(decisionsPath, incompleteText);
          const incompleteError = yield* expectFilesCommandFailure([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            path.join(tmpDir, "prepared"),
            "--dry-run",
          ]);
          expect(incompleteError).toContain("exactly one decision per source");

          const driftedText = yield* encodeImageCurationDecisionDocument(
            ImageCurationDecisionDocument.make({
              decisions: [
                {
                  disposition: "active-core",
                  reasons: ["clean-current-identity"],
                  sourceName: "first.jpg",
                  sourceSha256: `sha256:${"0".repeat(64)}`,
                },
                {
                  disposition: "active-extended",
                  reasons: ["useful-identity-signal"],
                  sourceName: "second.jpg",
                  sourceSha256: yield* sha256FileRef(secondPath),
                },
              ],
              schemaVersion: "beep.files.image-curation-decisions.v1",
              sourceDirectory: datasetDir,
            })
          );
          yield* fs.writeFileString(decisionsPath, driftedText);
          const driftError = yield* expectFilesCommandFailure([
            "curate-images",
            "--dir",
            datasetDir,
            "--decisions",
            decisionsPath,
            "--out-dir",
            path.join(tmpDir, "prepared"),
            "--dry-run",
          ]);
          expect(driftError).toContain('Source hash mismatch for "first.jpg"');
        })
      )
    ));
});
