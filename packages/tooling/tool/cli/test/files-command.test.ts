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
import {
  ArchivePoorCandidatesManifest,
  DetectBordersReport,
  DetectFacesReport,
  FilesCommandServiceLive,
  ImageAuditManifest,
  ImageCurationDecisionDocument,
  ImageCurationManifest,
  NormalizeManifest,
  ProcessFilesOptions,
  processFiles,
  renderFilesProgressBar,
} from "@beep/repo-cli/test/Files";
import { fcRuns } from "@beep/test-utils";
import { A, O, Str } from "@beep/utils";
import { NodeChildProcessSpawner, NodeServices } from "@effect/platform-node";
import { Cause, ConfigProvider, Data, Effect, Exit, FileSystem, Layer, Order, Path, pipe } from "effect";
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

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FetchHttpClient.layer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(NodeServices.layer))
);
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
const DetectBordersReportArbitrary = S.toArbitrary(DetectBordersReport);
const ChildArtifactRecordArbitrary = S.toArbitrary(ChildArtifactRecord);
const FileProcessingCoverageSummaryArbitrary = S.toArbitrary(FileProcessingCoverageSummary);
const FileProcessingFailureRecordArbitrary = S.toArbitrary(FileProcessingFailureRecord);
const NormalizeManifestArbitrary = S.toArbitrary(NormalizeManifest);
const ImageAuditManifestArbitrary = S.toArbitrary(ImageAuditManifest);
const ImageCurationManifestArbitrary = S.toArbitrary(ImageCurationManifest);
const ProcessRunManifestArbitrary = S.toArbitrary(ProcessRunManifest);
const SourceProcessingRecordArbitrary = S.toArbitrary(SourceProcessingRecord);
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
