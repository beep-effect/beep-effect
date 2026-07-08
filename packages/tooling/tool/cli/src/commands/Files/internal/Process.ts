/**
 * File-processing proof pipeline for the Files command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import {
  ChildArtifactRecord,
  encodeChildArtifactRecordJson,
  encodeFileProcessingCoverageSummaryJson,
  encodeFileProcessingFailureRecordJson,
  encodeProcessRunManifestJson,
  encodeSourceProcessingRecordJson,
  FailedFileProcessingFailureRecord,
  FailedSourceProcessingRecord,
  FileProcessingCoverageSummary,
  ProcessRunManifest,
  SkippedFileProcessingFailureRecord,
  SkippedSourceProcessingRecord,
  SucceededSourceProcessingRecord,
} from "@beep/file-processing/Extraction";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { collectSourceOutcomeRecords } from "@beep/file-processing/Service";
import {
  classifyFormatFromExtension,
  DeferredSelectedStrategy,
  SupportedSelectedStrategy,
  UnsupportedSelectedStrategy,
} from "@beep/file-processing/Strategy";
import { TestFileProcessingEngine } from "@beep/file-processing/test";
import { makeLibpffFileProcessingEngine } from "@beep/libpff";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { NativePathToPosixPath, normalizePath } from "@beep/schema/PosixPath";
import { makeTikaFileProcessingEngine } from "@beep/tika";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Effect, FileSystem, flow, HashSet, Match, Order, Path, pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FilesCommandError, formatPlatformError } from "../Files.errors.js";
import { FilesConcurrency } from "../Files.progress.js";
import { ProcessFilesSummary } from "../Files.schemas.js";
import type {
  FileProcessingFailureRecord,
  SourceProcessingRecord,
  SourceProcessingStatus,
} from "@beep/file-processing/Extraction";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { FileFormatFamily, FileProcessingSkipReason, SelectedStrategy } from "@beep/file-processing/Strategy";
import type { MimeType } from "@beep/schema/MimeType";
import type { PosixPath } from "@beep/schema/PosixPath";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ProcessFilesOptions } from "../Files.schemas.js";

type FilesProcessRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | Crypto.Crypto
  | ChildProcessSpawner.ChildProcessSpawner;

interface ProcessCollectedFile {
  readonly canonicalPath: string;
  readonly extension: string;
  readonly name: string;
  readonly relativePath: string;
  readonly sizeBytes: NonNegativeInt;
  readonly sourcePath: string;
}

interface ProcessPreparedSource {
  readonly bytes: Uint8Array;
  readonly digest: ContentDigest;
  readonly format: FileFormatFamily;
  readonly operationId: OperationId;
  readonly source: SourceArtifact;
  readonly sourceFile: ProcessCollectedFile;
}

interface ProcessInputCollection {
  readonly canonicalSourceRoot: string;
  readonly files: ReadonlyArray<ProcessCollectedFile>;
  readonly sourceRoot: string;
}

interface ProcessDirectoryCollection {
  readonly files: ReadonlyArray<ProcessCollectedFile>;
  readonly visitedDirectories: HashSet.HashSet<string>;
}

interface ProcessSourceOutcome {
  readonly childRecords: ReadonlyArray<ChildArtifactRecord>;
  readonly failure: O.Option<FileProcessingFailureRecord>;
  readonly sourceRecord: SourceProcessingRecord;
  readonly strategy: SelectedStrategy;
  readonly text: O.Option<readonly [string, string]>;
}

const processPathSeparators = Str.replace(/\\/gu, "/");
const processExtensionWithoutDot = flow(Str.replace(/^\./u, ""), Str.toLowerCase);
const processUtf8Encoder = new TextEncoder();
const processUtf8Decoder = new TextDecoder();
const processTextLikeFormats: ReadonlyArray<FileFormatFamily> = ["html", "markdown", "plain-text", "xhtml"];
const processCoverageFormats: ReadonlyArray<FileFormatFamily> = [
  "doc",
  "docm",
  "docx",
  "html",
  "image-metadata",
  "markdown",
  "pdf-text-layer",
  "plain-text",
  "pst",
  "rtf",
  "unknown",
  "xhtml",
  "xls",
  "xlsx",
];
const isProcessSelfOrNestedRelativePath = (relativePath: string): boolean =>
  Str.isEmpty(relativePath) ||
  (!Str.equivalence(relativePath, "..") && !Str.startsWith("../")(relativePath) && !Str.startsWith("/")(relativePath));

const decodeContentDigest = S.decodeUnknownEffect(ContentDigest);
const decodeArtifactId = S.decodeUnknownEffect(ArtifactId);
const decodeOperationId = S.decodeUnknownEffect(OperationId);
const decodeProcessPosixPath = S.decodeUnknownEffect(NativePathToPosixPath);
const processCount = (count: number): NonNegativeInt => NonNegativeInt.make(count);

const classifyProcessExtension = classifyFormatFromExtension;

const mediaTypeForProcessFormat = Match.type<FileFormatFamily>().pipe(
  Match.when("html", (): O.Option<MimeType> => O.some("text/html")),
  Match.when("xhtml", (): O.Option<MimeType> => O.some("application/xhtml+xml")),
  Match.when("markdown", (): O.Option<MimeType> => O.some("text/markdown")),
  Match.when("plain-text", (): O.Option<MimeType> => O.some("text/plain")),
  Match.when("rtf", (): O.Option<MimeType> => O.some("application/rtf")),
  Match.when("pdf-text-layer", (): O.Option<MimeType> => O.some("application/pdf")),
  Match.orElse(O.none<MimeType>)
);

const processOperationErrorStatus = (error: FileProcessingOperationError): SourceProcessingRecord["status"] =>
  error.reason === "engine-unavailable" ||
  error.reason === "unsupported-file-format" ||
  error.reason === "output-limit-exceeded"
    ? "skipped"
    : "failed";

const processOperationErrorSkipReason = (error: FileProcessingOperationError): O.Option<FileProcessingSkipReason> =>
  Match.value(error.reason).pipe(
    Match.when("engine-unavailable", () => O.some("engine-unavailable" as const)),
    Match.when("unsupported-file-format", () => O.some("unsupported-format" as const)),
    Match.when("output-limit-exceeded", () => O.some("output-budget-exceeded" as const)),
    Match.orElse(O.none<FileProcessingSkipReason>)
  );

const processEngineFor = (
  engine: ProcessFilesOptions["engine"],
  format: FileFormatFamily
): FileProcessingEngineShape => {
  if (engine === "test") {
    return TestFileProcessingEngine;
  }
  if (engine === "libpff") {
    return makeLibpffFileProcessingEngine();
  }
  if (engine === "tika") {
    return makeTikaFileProcessingEngine();
  }

  return format === "pst" ? makeLibpffFileProcessingEngine() : makeTikaFileProcessingEngine();
};

const syntheticLibpffEngine = (): FileProcessingEngineShape =>
  makeLibpffFileProcessingEngine({ syntheticExport: true });

const processEngineSupportsChildExport = (engine: FileProcessingEngineShape, format: FileFormatFamily): boolean =>
  A.contains(engine.descriptor.capabilities, "export-children") &&
  A.contains(engine.descriptor.supportedFormats, format);

const processHashBytes = Effect.fn("Files.processHashBytes")(function* (
  bytes: Uint8Array,
  label: string
): Effect.fn.Return<string, FilesCommandError, Crypto.Crypto> {
  return yield* S.decodeUnknownEffect(Sha256HexFromBytes)(bytes).pipe(
    FilesCommandError.mapError(`Failed to compute SHA-256 for ${label}`)
  );
});

const makeContentDigest = Effect.fn("Files.makeContentDigest")(function* (
  bytes: Uint8Array,
  label: string
): Effect.fn.Return<ContentDigest, FilesCommandError, Crypto.Crypto> {
  const hex = yield* processHashBytes(bytes, label);
  return yield* decodeContentDigest(`sha256:${hex}`).pipe(
    FilesCommandError.mapError(`Failed to decode content digest for ${label}`)
  );
});

const makeArtifactId = Effect.fn("Files.makeArtifactId")(function* (
  digest: ContentDigest,
  label: string
): Effect.fn.Return<ArtifactId, FilesCommandError> {
  const hex = Str.slice("sha256:".length)(digest);
  return yield* decodeArtifactId(`artifact:${hex}`).pipe(
    FilesCommandError.mapError(`Failed to decode artifact id for ${label}`)
  );
});

const makeOperationIdFromText = Effect.fn("Files.makeOperationIdFromText")(function* (
  text: string,
  label: string
): Effect.fn.Return<OperationId, FilesCommandError, Crypto.Crypto> {
  const hex = yield* processHashBytes(processUtf8Encoder.encode(text), label);
  return yield* decodeOperationId(`operation:${hex}`).pipe(
    FilesCommandError.mapError(`Failed to decode operation id for ${label}`)
  );
});

const collectProcessDirectoryFiles = Effect.fn("Files.collectProcessDirectoryFiles")(function* (
  sourceRoot: string,
  canonicalSourceRoot: string,
  currentDirectory: string,
  visitedDirectories: HashSet.HashSet<string>
): Effect.fn.Return<ProcessDirectoryCollection, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(currentDirectory)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to read process input directory", currentDirectory, { cause })
      )
    );
  let files: ReadonlyArray<ProcessCollectedFile> = A.empty();
  let visited = visitedDirectories;

  for (const entry of A.sort(entries, Order.String)) {
    const sourcePath = path.join(currentDirectory, entry);
    const canonicalPath = yield* fs.realPath(sourcePath).pipe(Effect.option);

    if (O.isNone(canonicalPath)) {
      continue;
    }

    const canonicalRelativePath = pipe(path.relative(canonicalSourceRoot, canonicalPath.value), processPathSeparators);
    if (Str.startsWith("../")(canonicalRelativePath) || Str.startsWith("/")(canonicalRelativePath)) {
      continue;
    }

    const stat = yield* fs
      .stat(canonicalPath.value)
      .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat process input", sourcePath, { cause })));

    if (stat.type === "Directory") {
      if (HashSet.has(visited, canonicalPath.value)) {
        continue;
      }

      visited = HashSet.add(visited, canonicalPath.value);
      const childCollection = yield* collectProcessDirectoryFiles(sourceRoot, canonicalSourceRoot, sourcePath, visited);
      files = A.appendAll(files, childCollection.files);
      visited = childCollection.visitedDirectories;
      continue;
    }

    if (stat.type !== "File") {
      continue;
    }

    const relativePath = pipe(path.relative(sourceRoot, sourcePath), processPathSeparators);
    const extension = pipe(path.extname(entry), processExtensionWithoutDot);
    files = A.append(files, {
      canonicalPath: canonicalPath.value,
      extension,
      name: entry,
      relativePath,
      sizeBytes: processCount(Number(stat.size)),
      sourcePath,
    });
  }

  return {
    files: A.sort(
      files,
      Order.mapInput(Order.String, (file: ProcessCollectedFile) => file.relativePath)
    ),
    visitedDirectories: visited,
  };
});

const collectProcessInputFiles = Effect.fn("Files.collectProcessInputFiles")(function* (
  input: string
): Effect.fn.Return<ProcessInputCollection, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.resolve(input);
  const stat = yield* fs
    .stat(sourcePath)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat process input", sourcePath, { cause })));

  if (stat.type === "File") {
    const sourceRoot = path.dirname(sourcePath);
    const canonicalPath = yield* fs
      .realPath(sourcePath)
      .pipe(Effect.mapError((cause) => formatPlatformError("Failed to resolve process input", sourcePath, { cause })));
    const canonicalSourceRoot = path.dirname(canonicalPath);
    const name = path.basename(sourcePath);

    return {
      canonicalSourceRoot,
      files: [
        {
          canonicalPath,
          extension: pipe(path.extname(name), processExtensionWithoutDot),
          name,
          relativePath: name,
          sizeBytes: processCount(Number(stat.size)),
          sourcePath,
        },
      ],
      sourceRoot,
    };
  }

  if (stat.type !== "Directory") {
    return yield* FilesCommandError.make({
      message: `Expected --input to be a file or directory: "${sourcePath}"`,
    });
  }

  const canonicalSourceRoot = yield* fs
    .realPath(sourcePath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to resolve process input directory", sourcePath, { cause })
      )
    );
  const collection = yield* collectProcessDirectoryFiles(
    sourcePath,
    canonicalSourceRoot,
    sourcePath,
    HashSet.add(HashSet.empty<string>(), canonicalSourceRoot)
  );

  return {
    canonicalSourceRoot,
    files: collection.files,
    sourceRoot: sourcePath,
  };
});

const canonicalizeProcessTargetPath = Effect.fn("Files.canonicalizeProcessTargetPath")(function* (
  targetPath: string
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(targetPath);
  const canonicalPath = yield* fs.realPath(absolutePath).pipe(Effect.option);

  if (O.isSome(canonicalPath)) {
    return canonicalPath.value;
  }

  const parentPath = path.dirname(absolutePath);
  if (Str.equivalence(parentPath, absolutePath)) {
    return yield* fs
      .realPath(absolutePath)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to resolve process output path", absolutePath, { cause })
        )
      );
  }

  const canonicalParentPath = yield* canonicalizeProcessTargetPath(parentPath);
  return path.join(canonicalParentPath, path.basename(absolutePath));
});

const prepareProcessOutDir = Effect.fn("Files.prepareProcessOutDir")(function* (
  outDir: string,
  canonicalSourceRoot: string,
  overwrite: boolean
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const outputDirectory = path.resolve(outDir);
  const canonicalOutputDirectory = yield* canonicalizeProcessTargetPath(outputDirectory);
  const outputRelativeToSource = pipe(
    path.relative(canonicalSourceRoot, canonicalOutputDirectory),
    processPathSeparators
  );
  const sourceRelativeToOutput = pipe(
    path.relative(canonicalOutputDirectory, canonicalSourceRoot),
    processPathSeparators
  );

  if (
    isProcessSelfOrNestedRelativePath(outputRelativeToSource) ||
    isProcessSelfOrNestedRelativePath(sourceRelativeToOutput)
  ) {
    return yield* FilesCommandError.make({
      message: `Refusing to write files process output in an overlapping source/output tree: "${outputDirectory}"`,
    });
  }

  const outputStat = yield* fs.stat(outputDirectory).pipe(Effect.option);
  const outputExists = O.isSome(outputStat);
  if (outputExists && outputStat.value.type !== "Directory") {
    return yield* FilesCommandError.make({
      message: `Refusing to write files process output to a non-directory path: "${outputDirectory}"`,
    });
  }
  if (outputExists && overwrite) {
    yield* fs
      .remove(outputDirectory, { force: true, recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to remove existing process output", outputDirectory, { cause })
        )
      );
  }
  if (outputExists && !overwrite) {
    const entries = yield* fs
      .readDirectory(outputDirectory)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect existing process output", outputDirectory, { cause })
        )
      );
    if (A.length(entries) > 0) {
      return yield* FilesCommandError.make({
        message: `Refusing to write files process output to non-empty directory without --overwrite: "${outputDirectory}"`,
      });
    }
  }

  yield* fs
    .makeDirectory(path.join(outputDirectory, "text"), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create process text directory", outputDirectory, { cause })
      )
    );
  yield* fs
    .makeDirectory(path.join(outputDirectory, "children"), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create process children directory", outputDirectory, { cause })
      )
    );

  return outputDirectory;
});

const prepareProcessSource = Effect.fn("Files.prepareProcessSource")(function* (
  sourceFile: ProcessCollectedFile,
  engine: ProcessFilesOptions["engine"]
): Effect.fn.Return<ProcessPreparedSource, FilesCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs
    .readFile(sourceFile.sourcePath)
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to read process source", sourceFile.sourcePath, { cause }))
    );
  const digest = yield* makeContentDigest(bytes, sourceFile.relativePath);
  const artifactId = yield* makeArtifactId(digest, sourceFile.relativePath);
  const operationId = yield* makeOperationIdFromText(
    `${sourceFile.relativePath}:${digest}:${engine}`,
    `operation ${sourceFile.relativePath}`
  );
  const locatorPath = yield* decodeProcessPosixPath(sourceFile.sourcePath).pipe(
    FilesCommandError.mapError(`Failed to normalize process source locator path for ${sourceFile.relativePath}`)
  );
  const relativePath = yield* decodeProcessPosixPath(sourceFile.relativePath).pipe(
    FilesCommandError.mapError(`Failed to normalize process source relative path for ${sourceFile.relativePath}`)
  );
  const format = classifyProcessExtension(sourceFile.extension);
  const mediaType = mediaTypeForProcessFormat(format);
  const sourceText = A.contains(processTextLikeFormats, format)
    ? O.some(processUtf8Decoder.decode(bytes))
    : O.none<string>();

  return {
    bytes,
    digest,
    format,
    operationId,
    source: SourceArtifact.make({
      bytes,
      digest,
      extension: sourceFile.extension,
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "file", value: locatorPath }),
      name: sourceFile.name,
      relativePath,
      sizeBytes: sourceFile.sizeBytes,
      ...O.getSomesStruct({ mediaType, text: sourceText }),
    }),
    sourceFile,
  };
});

const makeProcessSourceRecord = (
  prepared: ProcessPreparedSource,
  status: SourceProcessingRecord["status"],
  options: {
    readonly engine?: string;
    readonly skipReason?: FileProcessingSkipReason;
    readonly textPath?: PosixPath;
  } = {}
): SourceProcessingRecord => {
  const base = {
    artifactId: prepared.source.id,
    digest: prepared.digest,
    format: prepared.format,
    operationId: prepared.operationId,
    relativePath: prepared.source.relativePath,
    sizeBytes: prepared.sourceFile.sizeBytes,
    ...O.getSomesStruct({
      engine: O.fromUndefinedOr(options.engine),
    }),
  };

  if (status === "succeeded") {
    return SucceededSourceProcessingRecord.make({
      ...base,
      status,
      ...O.getSomesStruct({
        textPath: O.fromUndefinedOr(options.textPath),
      }),
    });
  }

  if (status === "skipped") {
    return SkippedSourceProcessingRecord.make({
      ...base,
      skipReason: options.skipReason ?? "unsupported-format",
      status,
    });
  }

  return FailedSourceProcessingRecord.make({
    ...base,
    status,
  });
};

const makeProcessSkippedFailureRecord = (
  prepared: ProcessPreparedSource,
  message: string,
  reason: FileProcessingSkipReason,
  options: {
    readonly engine?: string;
    readonly format?: FileFormatFamily;
  } = {}
): FileProcessingFailureRecord =>
  SkippedFileProcessingFailureRecord.make({
    artifactId: prepared.source.id,
    message,
    operationId: prepared.operationId,
    reason,
    relativePath: prepared.source.relativePath,
    status: "skipped",
    ...O.getSomesStruct({
      engine: O.fromUndefinedOr(options.engine),
      format: O.fromUndefinedOr(options.format),
    }),
  });

const makeProcessFailedFailureRecord = (
  prepared: ProcessPreparedSource,
  message: string,
  reason: FileProcessingOperationError["reason"],
  options: {
    readonly engine?: string;
    readonly format?: FileFormatFamily;
  } = {}
): FileProcessingFailureRecord =>
  FailedFileProcessingFailureRecord.make({
    artifactId: prepared.source.id,
    message,
    operationId: prepared.operationId,
    reason,
    relativePath: prepared.source.relativePath,
    status: "failed",
    ...O.getSomesStruct({
      engine: O.fromUndefinedOr(options.engine),
      format: O.fromUndefinedOr(options.format),
    }),
  });

const makeProcessStrategy = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  disposition: SelectedStrategy["disposition"],
  skipReason: O.Option<FileProcessingSkipReason>
): SelectedStrategy =>
  disposition === "supported"
    ? SupportedSelectedStrategy.make({
        disposition,
        engine: engine.descriptor.engine,
        format: prepared.format,
        operationKind: prepared.format === "pst" ? "export-archive" : "extract",
      })
    : disposition === "deferred"
      ? DeferredSelectedStrategy.make({
          disposition,
          engine: engine.descriptor.engine,
          format: prepared.format,
          operationKind: prepared.format === "pst" ? "export-archive" : "extract",
          skipReason: O.getOrElse(skipReason, () => "engine-unavailable"),
        })
      : UnsupportedSelectedStrategy.make({
          disposition,
          engine: engine.descriptor.engine,
          format: prepared.format,
          operationKind: prepared.format === "pst" ? "export-archive" : "extract",
          skipReason: O.getOrElse(skipReason, () => "unsupported-format"),
        });

const processFailureOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  error: FileProcessingOperationError
): ProcessSourceOutcome => {
  const status = processOperationErrorStatus(error);
  const skipReason = processOperationErrorSkipReason(error);

  return {
    childRecords: A.empty(),
    failure: O.some(
      status === "skipped" && O.isSome(skipReason)
        ? makeProcessSkippedFailureRecord(prepared, error.message, skipReason.value, {
            engine: error.engine ?? engine.descriptor.name,
            format: error.format ?? prepared.format,
          })
        : makeProcessFailedFailureRecord(prepared, error.message, error.reason, {
            engine: error.engine ?? engine.descriptor.name,
            format: error.format ?? prepared.format,
          })
    ),
    sourceRecord: makeProcessSourceRecord(prepared, status, {
      engine: error.engine ?? engine.descriptor.name,
      ...O.getSomesStruct({ skipReason }),
    }),
    strategy: makeProcessStrategy(engine, prepared, O.isNone(skipReason) ? "supported" : "deferred", skipReason),
    text: O.none<readonly [string, string]>(),
  };
};

const processSkippedOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  message: string,
  reason: FileProcessingSkipReason
): ProcessSourceOutcome => ({
  childRecords: A.empty(),
  failure: O.some(
    makeProcessSkippedFailureRecord(prepared, message, reason, {
      engine: engine.descriptor.name,
      format: prepared.format,
    })
  ),
  sourceRecord: makeProcessSourceRecord(prepared, "skipped", {
    engine: engine.descriptor.name,
    skipReason: reason,
  }),
  strategy: makeProcessStrategy(engine, prepared, "deferred", O.some(reason)),
  text: O.none<readonly [string, string]>(),
});

const processExtractionSuccessOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  text: O.Option<string>
): ProcessSourceOutcome => {
  const textRelativePath = O.map(text, () => normalizePath(`text/${prepared.operationId}.txt`));

  return {
    childRecords: A.empty(),
    failure: O.none<FileProcessingFailureRecord>(),
    sourceRecord: makeProcessSourceRecord(prepared, "succeeded", {
      engine: engine.descriptor.name,
      ...O.getSomesStruct({ textPath: textRelativePath }),
    }),
    strategy: makeProcessStrategy(engine, prepared, "supported", O.none<FileProcessingSkipReason>()),
    text:
      O.isNone(text) || O.isNone(textRelativePath) ? O.none() : O.some([textRelativePath.value, text.value] as const),
  };
};

const processArchiveSuccessOutcome = (
  engine: FileProcessingEngineShape,
  prepared: ProcessPreparedSource,
  children: ReadonlyArray<ChildArtifactRecord>
): ProcessSourceOutcome => ({
  childRecords: children,
  failure: O.none<FileProcessingFailureRecord>(),
  sourceRecord: makeProcessSourceRecord(prepared, "succeeded", {
    engine: engine.descriptor.name,
  }),
  strategy: makeProcessStrategy(engine, prepared, "supported", O.none<FileProcessingSkipReason>()),
  text: O.none<readonly [string, string]>(),
});

const makeZeroProcessStatusCounts = (): Record<SourceProcessingStatus, number> => ({
  failed: 0,
  skipped: 0,
  succeeded: 0,
});

const makeZeroProcessCoverageByFormat = (): Record<FileFormatFamily, Record<SourceProcessingStatus, number>> =>
  R.fromEntries(A.map(processCoverageFormats, (format) => [format, makeZeroProcessStatusCounts()] as const));

const makeProcessCoverageByFormat = (
  byFormat: Record<FileFormatFamily, Record<SourceProcessingStatus, number>>
): FileProcessingCoverageSummary["byFormat"] =>
  R.fromEntries(
    A.map(processCoverageFormats, (format) => {
      const counts = byFormat[format];
      return [
        format,
        {
          failed: processCount(counts.failed),
          skipped: processCount(counts.skipped),
          succeeded: processCount(counts.succeeded),
        },
      ] as const;
    })
  ) as FileProcessingCoverageSummary["byFormat"];

const sourceRecordHasTextPath = (record: SourceProcessingRecord): boolean =>
  record.status === "succeeded" && record.textPath !== undefined;

const processPreparedSource = Effect.fn("Files.processPreparedSource")(function* (
  prepared: ProcessPreparedSource,
  options: ProcessFilesOptions
): Effect.fn.Return<ProcessSourceOutcome, never, Crypto.Crypto> {
  const engine =
    options.engine === "test" && prepared.format === "pst"
      ? syntheticLibpffEngine()
      : processEngineFor(options.engine, prepared.format);

  if (prepared.format === "docm" || prepared.format === "xls" || prepared.format === "xlsx") {
    return processSkippedOutcome(
      engine,
      prepared,
      `${prepared.format} was classified deterministically; deep extraction is out of scope for V1.`,
      "format-out-of-scope"
    );
  }

  if (prepared.format === "unknown") {
    return processSkippedOutcome(
      engine,
      prepared,
      "Source format is not supported by the V1 proof.",
      "unsupported-format"
    );
  }

  if (prepared.format === "pst") {
    if (!options.exportChildren) {
      return processSkippedOutcome(engine, prepared, "PST child export was not requested.", "operation-not-required");
    }

    if (!processEngineSupportsChildExport(engine, prepared.format)) {
      return processSkippedOutcome(
        engine,
        prepared,
        `${engine.descriptor.name} does not support PST child export in the P1 proof.`,
        "engine-unavailable"
      );
    }

    return yield* engine
      .exportArchive({
        format: prepared.format,
        operationId: prepared.operationId,
        operationKind: "export-archive",
        preference: { engine: options.engine },
        source: prepared.source,
        ...O.getSomesStruct({
          maxMaterializedBytes: O.fromUndefinedOr(options.maxMaterializedBytes),
        }),
      })
      .pipe(
        Effect.matchEffect({
          onFailure: (error) => Effect.succeed(processFailureOutcome(engine, prepared, error)),
          onSuccess: (result) =>
            Effect.succeed(
              processArchiveSuccessOutcome(
                engine,
                prepared,
                A.map(result.children, (child) =>
                  ChildArtifactRecord.make({
                    child,
                    sourceArtifactId: prepared.source.id,
                  })
                )
              )
            ),
        })
      );
  }

  return yield* engine
    .extract({
      format: prepared.format,
      operationId: prepared.operationId,
      operationKind: "extract",
      preference: { engine: options.engine },
      source: prepared.source,
      ...O.getSomesStruct({
        maxMaterializedBytes: O.fromUndefinedOr(options.maxMaterializedBytes),
      }),
    })
    .pipe(
      Effect.matchEffect({
        onFailure: (error) => Effect.succeed(processFailureOutcome(engine, prepared, error)),
        onSuccess: (result) => {
          if (
            options.maxMaterializedBytes !== undefined &&
            result.text !== undefined &&
            processUtf8Encoder.encode(result.text).length > options.maxMaterializedBytes
          ) {
            return Effect.succeed(
              processFailureOutcome(
                engine,
                prepared,
                FileProcessingOperationError.fromReason("output-limit-exceeded", {
                  artifactId: prepared.source.id,
                  engine: engine.descriptor.name,
                  format: prepared.format,
                  message: "Extracted text exceeded --max-materialized-bytes.",
                  operationId: prepared.operationId,
                })
              )
            );
          }

          return Effect.succeed(processExtractionSuccessOutcome(engine, prepared, O.fromUndefinedOr(result.text)));
        },
      })
    );
});

const makeProcessCoverage = (records: ReadonlyArray<SourceProcessingRecord>): FileProcessingCoverageSummary => {
  const byFormat = makeZeroProcessCoverageByFormat();

  for (const record of records) {
    const formatCounts = byFormat[record.format];
    formatCounts[record.status] = (formatCounts[record.status] ?? 0) + 1;
    byFormat[record.format] = formatCounts;
  }

  return FileProcessingCoverageSummary.make({
    byFormat: makeProcessCoverageByFormat(byFormat),
    failedCount: processCount(A.length(A.filter(records, (record) => record.status === "failed"))),
    skippedCount: processCount(A.length(A.filter(records, (record) => record.status === "skipped"))),
    sourceCount: processCount(A.length(records)),
    succeededCount: processCount(A.length(A.filter(records, (record) => record.status === "succeeded"))),
    textArtifactCount: processCount(A.length(A.filter(records, sourceRecordHasTextPath))),
  });
};

const encodeProcessJsonLine = <AValue>(
  value: AValue,
  encode: (value: AValue) => Effect.Effect<string, S.SchemaError>,
  label: string
): Effect.Effect<string, FilesCommandError> =>
  encode(value).pipe(
    FilesCommandError.mapError(`Failed to encode ${label}`),
    Effect.map((line) => `${line}\n`)
  );

const writeProcessStringFile = Effect.fn("Files.writeProcessStringFile")(function* (
  outputPath: string,
  content: string
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs
    .makeDirectory(path.dirname(outputPath), { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create process output directory", outputPath, { cause })
      )
    );
  yield* fs
    .writeFileString(outputPath, content)
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to write process output", outputPath, { cause })));
});

const writeProcessManifestTree = Effect.fn("Files.writeProcessManifestTree")(function* (
  outputDirectory: string,
  options: ProcessFilesOptions,
  outcomes: ReadonlyArray<ProcessSourceOutcome>,
  coverage: FileProcessingCoverageSummary
): Effect.fn.Return<
  void,
  FilesCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const { failureRecords, sourceRecords } = collectSourceOutcomeRecords(outcomes);
  const runId = yield* makeOperationIdFromText(
    `${options.engine}:${A.join("|")(A.map(sourceRecords, (record) => `${record.relativePath}:${record.operationId}`))}`,
    "process run"
  );
  const runManifest = ProcessRunManifest.make({
    coverage,
    engine: options.engine,
    manifestVersion: "beep.file-processing.run.v1",
    outputRoot: ".",
    runId,
    sourceRootLabel: "input",
    strategies: A.map(outcomes, (outcome) => outcome.strategy),
  });
  const sourceLines = yield* Effect.forEach(sourceRecords, (record) =>
    encodeProcessJsonLine(record, encodeSourceProcessingRecordJson, "process source record")
  );
  const failureLines = yield* Effect.forEach(failureRecords, (record) =>
    encodeProcessJsonLine(record, encodeFileProcessingFailureRecordJson, "process failure record")
  );
  const coverageJson = yield* encodeFileProcessingCoverageSummaryJson(coverage).pipe(
    FilesCommandError.mapError("Failed to encode process coverage")
  );
  const runJson = yield* encodeProcessRunManifestJson(runManifest).pipe(
    FilesCommandError.mapError("Failed to encode process run manifest")
  );

  yield* writeProcessStringFile(path.join(outputDirectory, "run.json"), `${runJson}\n`);
  yield* writeProcessStringFile(path.join(outputDirectory, "coverage.json"), `${coverageJson}\n`);
  yield* writeProcessStringFile(path.join(outputDirectory, "sources.jsonl"), A.join("")(sourceLines));
  yield* writeProcessStringFile(path.join(outputDirectory, "failures.jsonl"), A.join("")(failureLines));

  for (const outcome of outcomes) {
    if (O.isSome(outcome.text)) {
      yield* writeProcessStringFile(path.join(outputDirectory, outcome.text.value[0]), outcome.text.value[1]);
    }

    if (A.length(outcome.childRecords) > 0) {
      const childLines = yield* Effect.forEach(outcome.childRecords, (record) =>
        encodeProcessJsonLine(record, encodeChildArtifactRecordJson, "process child artifact record")
      );
      yield* writeProcessStringFile(
        path.join(outputDirectory, "children", `${outcome.sourceRecord.artifactId}`, "artifacts.jsonl"),
        A.join("")(childLines)
      );
    }
  }
});

/**
 * Execute the process subcommand pipeline: collect input artifacts, prepare
 * the output directory, process each file, and write per-artifact plus
 * summary outputs.
 *
 * @category use-cases
 * @since 0.0.0
 */
export const processFilesImpl = Effect.fn("FilesCommandService.processFiles")(function* (
  options: ProcessFilesOptions
): Effect.fn.Return<ProcessFilesSummary, FilesCommandError, FilesProcessRequirements> {
  const collection = yield* collectProcessInputFiles(options.input);
  const outputDirectory = yield* prepareProcessOutDir(
    options.outDir,
    collection.canonicalSourceRoot,
    options.overwrite
  );
  const outcomes = yield* Effect.forEach(
    collection.files,
    (sourceFile) =>
      prepareProcessSource(sourceFile, options.engine).pipe(
        Effect.flatMap((prepared) => processPreparedSource(prepared, options))
      ),
    {
      concurrency: FilesConcurrency.scan,
    }
  );
  const { sourceRecords } = collectSourceOutcomeRecords(outcomes);
  const coverage = makeProcessCoverage(sourceRecords);
  const summary = ProcessFilesSummary.make({
    failedCount: coverage.failedCount,
    skippedCount: coverage.skippedCount,
    sourceCount: coverage.sourceCount,
    succeededCount: coverage.succeededCount,
    textArtifactCount: coverage.textArtifactCount,
  });

  yield* writeProcessManifestTree(outputDirectory, options, outcomes, coverage);
  yield* Console.log(
    `files process: ${summary.succeededCount} succeeded, ${summary.skippedCount} skipped, ${summary.failedCount} failed; wrote "${outputDirectory}".`
  );

  if (options.failurePolicy === "fail-on-error" && summary.failedCount > 0) {
    return yield* FilesCommandError.make({
      message: `files process: ${summary.failedCount} source file(s) failed. See "${outputDirectory}" for manifest details.`,
    });
  }

  return summary;
});
