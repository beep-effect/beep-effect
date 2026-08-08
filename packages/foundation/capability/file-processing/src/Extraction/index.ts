/**
 * Extraction result and manifest schemas for file processing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ArtifactId, ArtifactReference, ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import { FileProcessingOperationErrorReason } from "@beep/file-processing/Operation";
import { FileFormatFamily, FileProcessingSkipReason, SelectedStrategy } from "@beep/file-processing/Strategy";
import { $FileProcessingId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $FileProcessingId.create("Extraction");

class TextSpanBase extends S.Class<TextSpanBase>($I`TextSpan`)(
  {
    endOffset: NonNegativeInt,
    startOffset: NonNegativeInt,
    text: S.String,
  },
  $I.annote("TextSpan", {
    description: "Extracted text span with byte or character offsets supplied by the engine.",
  })
) {}

type JsonEncodeEffect<Input> = {
  // Data-last first: the `(input, options?)` overload would otherwise absorb a
  // lone parse-options argument and hide the curried form.
  (options?: AST.ParseOptions): (input: Input) => Effect.Effect<string, S.SchemaError>;
  (input: Input, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
};

/**
 * Processing status emitted for each source row.
 *
 * **Example** (Check skipped status option)
 *
 * ```ts
 * import { SourceProcessingStatus } from "@beep/file-processing/Extraction"
 *
 * console.log(SourceProcessingStatus.Options.includes("skipped")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceProcessingStatus = LiteralKit(["succeeded", "skipped", "failed"]).pipe(
  $I.annoteSchema("SourceProcessingStatus", {
    description: "Per-source processing status used in sources.jsonl.",
  })
);

/**
 * Type for {@link SourceProcessingStatus}.
 *
 * **Example** (Type succeeded status value)
 *
 * ```ts
 * import { SourceProcessingStatus } from "@beep/file-processing/Extraction"
 *
 * const status: SourceProcessingStatus = "succeeded"
 * console.log(SourceProcessingStatus.is.succeeded(status)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SourceProcessingStatus = typeof SourceProcessingStatus.Type;

/**
 * Materialized text artifact reference.
 *
 * **Example** (Decode text artifact reference)
 *
 * ```ts
 * import { TextArtifactReference } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(TextArtifactReference)({
 *   artifact: {
 *     id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     relativePath: "text/README.txt",
 *     sizeBytes: 5
 *   },
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * })
 *
 * Effect.runPromise(program).then((reference) => console.log(reference.artifact.relativePath)) // "text/README.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextArtifactReference extends S.Class<TextArtifactReference>($I`TextArtifactReference`)(
  {
    artifact: ArtifactReference,
    operationId: OperationId,
  },
  $I.annote("TextArtifactReference", {
    description: "Reference to a text artifact emitted for one extraction operation.",
  })
) {}

/**
 * Text span emitted by a text extraction operation.
 *
 * **Example** (Make text span value)
 *
 * ```ts
 * import { TextSpan } from "@beep/file-processing/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const span = TextSpan.make({ endOffset: NonNegativeInt.make(5), startOffset: NonNegativeInt.make(0), text: "hello" })
 * console.log(span.text) // "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextSpan = TextSpanBase.check(
  S.makeFilter(({ endOffset, startOffset }) => endOffset >= startOffset, {
    identifier: $I`TextSpanOffsetOrderCheck`,
    title: "Text Span Offset Order",
    description: "Checks that a text span's end offset is greater than or equal to its start offset.",
    message: "Expected endOffset to be greater than or equal to startOffset.",
  })
);

/**
 * Type for {@link TextSpan}.
 *
 * **Example** (Type text span value)
 *
 * ```ts
 * import { TextSpan } from "@beep/file-processing/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const span: TextSpan = TextSpan.make({ endOffset: NonNegativeInt.make(5), startOffset: NonNegativeInt.make(0), text: "hello" })
 * console.log(span.text) // "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextSpan = InstanceType<typeof TextSpanBase>;

/**
 * Text and metadata extraction result.
 *
 * **Example** (Decode extraction result)
 *
 * ```ts
 * import { ExtractionResult } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(ExtractionResult)({
 *   engine: "beep-test",
 *   format: "plain-text",
 *   metadata: { language: "en" },
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sourceArtifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   text: "hello",
 *   warnings: []
 * })
 *
 * Effect.runPromise(program).then((result) => console.log(result.metadata.language)) // "en"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionResult extends S.Class<ExtractionResult>($I`ExtractionResult`)(
  {
    engine: S.String,
    engineVersion: S.optionalKey(S.String),
    format: FileFormatFamily,
    metadata: S.Record(S.String, S.String),
    operationId: OperationId,
    sourceArtifactId: ArtifactId,
    text: S.optionalKey(S.String),
    textArtifact: S.optionalKey(TextArtifactReference),
    warnings: S.Array(S.String),
  },
  $I.annote("ExtractionResult", {
    description: "Runtime-neutral text and metadata extraction result.",
  })
) {}

/**
 * Archive export result.
 *
 * **Example** (Decode archive export result)
 *
 * ```ts
 * import { ArchiveExportResult } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(ArchiveExportResult)({
 *   children: [],
 *   engine: "libpff",
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sourceArtifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   warnings: []
 * })
 *
 * Effect.runPromise(program).then((result) => console.log(result.engine)) // "libpff"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveExportResult extends S.Class<ArchiveExportResult>($I`ArchiveExportResult`)(
  {
    children: S.Array(ArtifactReference),
    engine: S.String,
    operationId: OperationId,
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  },
  $I.annote("ArchiveExportResult", {
    description: "Runtime-neutral child artifact export result for archive-like source files.",
  })
) {}

/**
 * Successful extraction result of a full source processing operation.
 *
 * **Example** (Make extracted process result)
 *
 * ```ts
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { ExtractedProcessFileResult, ExtractionResult } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const extraction = ExtractionResult.make({
 *     engine: "beep-test",
 *     format: "markdown",
 *     metadata: {},
 *     operationId,
 *     sourceArtifactId: artifactId,
 *     text: "hello",
 *     warnings: []
 *   })
 *
 *   return ExtractedProcessFileResult.make({
 *     engine: "beep-test",
 *     extraction,
 *     format: "markdown",
 *     operationId,
 *     resultKind: "extracted",
 *     sourceArtifactId: artifactId,
 *     warnings: []
 *   }).resultKind
 * })
 *
 * Effect.runPromise(program).then(console.log) // "extracted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractedProcessFileResult extends S.Class<ExtractedProcessFileResult>($I`ExtractedProcessFileResult`)(
  {
    engine: S.String,
    extraction: ExtractionResult,
    format: FileFormatFamily,
    operationId: OperationId,
    resultKind: S.Literal("extracted"),
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  },
  $I.annote("ExtractedProcessFileResult", {
    description: "Full source processing result for text or metadata extraction.",
  })
) {}

/**
 * Successful archive export result of a full source processing operation.
 *
 * **Example** (Make archive export process result)
 *
 * ```ts
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { ArchiveExportProcessFileResult, ArchiveExportResult } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const archiveExport = ArchiveExportResult.make({
 *     children: [],
 *     engine: "libpff",
 *     operationId,
 *     sourceArtifactId: artifactId,
 *     warnings: []
 *   })
 *
 *   return ArchiveExportProcessFileResult.make({
 *     archiveExport,
 *     engine: "libpff",
 *     format: "pst",
 *     operationId,
 *     resultKind: "archive-exported",
 *     sourceArtifactId: artifactId,
 *     warnings: []
 *   }).resultKind
 * })
 *
 * Effect.runPromise(program).then(console.log) // "archive-exported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveExportProcessFileResult extends S.Class<ArchiveExportProcessFileResult>(
  $I`ArchiveExportProcessFileResult`
)(
  {
    archiveExport: ArchiveExportResult,
    engine: S.String,
    format: FileFormatFamily,
    operationId: OperationId,
    resultKind: S.Literal("archive-exported"),
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  },
  $I.annote("ArchiveExportProcessFileResult", {
    description: "Full source processing result for archive child export.",
  })
) {}

/**
 * Intentional skip result of a full source processing operation.
 *
 * **Example** (Make skipped process result)
 *
 * ```ts
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { SkippedProcessFileResult } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const result = SkippedProcessFileResult.make({
 *     engine: "beep-test",
 *     format: "xls",
 *     operationId,
 *     resultKind: "skipped",
 *     skipReason: "format-out-of-scope",
 *     sourceArtifactId: artifactId,
 *     warnings: []
 *   })
 *
 *   return result.skipReason
 * })
 *
 * Effect.runPromise(program).then(console.log) // "format-out-of-scope"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkippedProcessFileResult extends S.Class<SkippedProcessFileResult>($I`SkippedProcessFileResult`)(
  {
    engine: S.String,
    format: FileFormatFamily,
    operationId: OperationId,
    resultKind: S.Literal("skipped"),
    skipReason: FileProcessingSkipReason,
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  },
  $I.annote("SkippedProcessFileResult", {
    description: "Full source processing result for intentional skips.",
  })
) {}

/**
 * Result of a full source processing operation.
 *
 * **Example** (Decode skipped process result)
 *
 * ```ts
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { ProcessFileResult } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *
 *   return yield* S.decodeUnknownEffect(ProcessFileResult)({
 *     engine: "beep-test",
 *     format: "xls",
 *     operationId,
 *     resultKind: "skipped",
 *     skipReason: "format-out-of-scope",
 *     sourceArtifactId: artifactId,
 *     warnings: []
 *   })
 * })
 *
 * Effect.runPromise(program).then((result) => console.log(result.resultKind)) // "skipped"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessFileResult = S.Union([
  ExtractedProcessFileResult,
  ArchiveExportProcessFileResult,
  SkippedProcessFileResult,
]).pipe(
  S.toTaggedUnion("resultKind"),
  $I.annoteSchema("ProcessFileResult", {
    description: "Runtime-neutral result for a full source processing operation.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ProcessFileResult}.
 *
 * **Example** (Type process file result)
 *
 * ```ts
 * import { ProcessFileResult } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const result: ProcessFileResult = yield* S.decodeUnknownEffect(ProcessFileResult)({
 *     engine: "beep-test",
 *     format: "xls",
 *     operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     resultKind: "skipped",
 *     skipReason: "format-out-of-scope",
 *     sourceArtifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     warnings: []
 *   })
 *   return result.resultKind
 * })
 *
 * Effect.runPromise(program).then(console.log) // "skipped"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProcessFileResult = typeof ProcessFileResult.Type;

/**
 * Succeeded source row written to sources.jsonl.
 *
 * **Example** (Make succeeded source record)
 *
 * ```ts
 * import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { SucceededSourceProcessingRecord } from "@beep/file-processing/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("README.md")
 *   const textPath = yield* S.decodeUnknownEffect(PosixPath)("text/example.txt")
 *
 *   return SucceededSourceProcessingRecord.make({
 *     artifactId,
 *     digest,
 *     engine: "beep-test",
 *     format: "markdown",
 *     operationId,
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(11),
 *     status: "succeeded",
 *     textPath
 *   }).status
 * })
 *
 * Effect.runPromise(program).then(console.log) // "succeeded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SucceededSourceProcessingRecord extends S.Class<SucceededSourceProcessingRecord>(
  $I`SucceededSourceProcessingRecord`
)(
  {
    artifactId: ArtifactId,
    digest: ContentDigest,
    engine: S.optionalKey(S.String),
    format: FileFormatFamily,
    operationId: OperationId,
    relativePath: PosixPath,
    sizeBytes: NonNegativeInt,
    status: S.Literal("succeeded"),
    textPath: S.optionalKey(PosixPath),
  },
  $I.annote("SucceededSourceProcessingRecord", {
    description: "JSONL-safe succeeded source processing record emitted by the CLI proof.",
  })
) {}

/**
 * Skipped source row written to sources.jsonl.
 *
 * **Example** (Make skipped source record)
 *
 * ```ts
 * import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { SkippedSourceProcessingRecord } from "@beep/file-processing/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("table.xls")
 *
 *   return SkippedSourceProcessingRecord.make({
 *     artifactId,
 *     digest,
 *     engine: "beep-test",
 *     format: "xls",
 *     operationId,
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(64),
 *     skipReason: "format-out-of-scope",
 *     status: "skipped"
 *   }).skipReason
 * })
 *
 * Effect.runPromise(program).then(console.log) // "format-out-of-scope"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkippedSourceProcessingRecord extends S.Class<SkippedSourceProcessingRecord>(
  $I`SkippedSourceProcessingRecord`
)(
  {
    artifactId: ArtifactId,
    digest: ContentDigest,
    engine: S.optionalKey(S.String),
    format: FileFormatFamily,
    operationId: OperationId,
    relativePath: PosixPath,
    sizeBytes: NonNegativeInt,
    skipReason: FileProcessingSkipReason,
    status: S.Literal("skipped"),
  },
  $I.annote("SkippedSourceProcessingRecord", {
    description: "JSONL-safe skipped source processing record emitted by the CLI proof.",
  })
) {}

/**
 * Failed source row written to sources.jsonl.
 *
 * **Example** (Make failed source record)
 *
 * ```ts
 * import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { FailedSourceProcessingRecord } from "@beep/file-processing/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("broken.bin")
 *
 *   return FailedSourceProcessingRecord.make({
 *     artifactId,
 *     digest,
 *     format: "unknown",
 *     operationId,
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(0),
 *     status: "failed"
 *   }).status
 * })
 *
 * Effect.runPromise(program).then(console.log) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FailedSourceProcessingRecord extends S.Class<FailedSourceProcessingRecord>(
  $I`FailedSourceProcessingRecord`
)(
  {
    artifactId: ArtifactId,
    digest: ContentDigest,
    engine: S.optionalKey(S.String),
    format: FileFormatFamily,
    operationId: OperationId,
    relativePath: PosixPath,
    sizeBytes: NonNegativeInt,
    status: S.Literal("failed"),
  },
  $I.annote("FailedSourceProcessingRecord", {
    description: "JSONL-safe failed source processing record emitted by the CLI proof.",
  })
) {}

/**
 * Source row written to sources.jsonl.
 *
 * **Example** (Decode source processing record)
 *
 * ```ts
 * import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { SourceProcessingRecord } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *
 *   return yield* S.decodeUnknownEffect(SourceProcessingRecord)({
 *     artifactId,
 *     digest,
 *     format: "markdown",
 *     operationId,
 *     relativePath: "README.md",
 *     sizeBytes: 11,
 *     status: "succeeded"
 *   })
 * })
 *
 * Effect.runPromise(program).then((record) => console.log(record.status)) // "succeeded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SourceProcessingRecord = S.Union([
  SucceededSourceProcessingRecord,
  SkippedSourceProcessingRecord,
  FailedSourceProcessingRecord,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("SourceProcessingRecord", {
    description: "JSONL-safe source processing record emitted by the CLI proof.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    encodeJson: S.encodeUnknownEffect(S.fromJsonString(schema)),
  }))
);

/**
 * Type for {@link SourceProcessingRecord}.
 *
 * **Example** (Type source processing record)
 *
 * ```ts
 * import { SourceProcessingRecord } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const record: SourceProcessingRecord = yield* S.decodeUnknownEffect(SourceProcessingRecord)({
 *     artifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     format: "markdown",
 *     operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     relativePath: "README.md",
 *     sizeBytes: 11,
 *     status: "succeeded"
 *   })
 *   return record.status
 * })
 *
 * Effect.runPromise(program).then(console.log) // "succeeded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SourceProcessingRecord = typeof SourceProcessingRecord.Type;

/**
 * Machine-readable failure row reason.
 *
 * **Example** (Decode failure reason value)
 *
 * ```ts
 * import { FileProcessingFailureReason } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(FileProcessingFailureReason)("format-out-of-scope")
 *
 * Effect.runPromise(program).then(console.log) // "format-out-of-scope"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileProcessingFailureReason = S.Union([FileProcessingOperationErrorReason, FileProcessingSkipReason]).pipe(
  $I.annoteSchema("FileProcessingFailureReason", {
    description: "Machine-readable skipped or failed source reason emitted in failures.jsonl.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link FileProcessingFailureReason}.
 *
 * **Example** (Type failure reason value)
 *
 * ```ts
 * import { FileProcessingFailureReason } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const reason: FileProcessingFailureReason = yield* S.decodeUnknownEffect(FileProcessingFailureReason)(
 *     "format-out-of-scope"
 *   )
 *   return reason
 * })
 *
 * Effect.runPromise(program).then(console.log) // "format-out-of-scope"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingFailureReason = typeof FileProcessingFailureReason.Type;

/**
 * Skipped row written to failures.jsonl.
 *
 * **Example** (Decode skipped failure record)
 *
 * ```ts
 * import { SkippedFileProcessingFailureRecord } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(SkippedFileProcessingFailureRecord)({
 *   artifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   format: "xls",
 *   message: "XLS extraction is deferred in this run.",
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   reason: "format-out-of-scope",
 *   relativePath: "table.xls",
 *   status: "skipped"
 * })
 *
 * Effect.runPromise(program).then((record) => console.log(record.reason)) // "format-out-of-scope"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkippedFileProcessingFailureRecord extends S.Class<SkippedFileProcessingFailureRecord>(
  $I`SkippedFileProcessingFailureRecord`
)(
  {
    artifactId: ArtifactId,
    engine: S.optionalKey(S.String),
    format: S.optionalKey(FileFormatFamily),
    message: S.String,
    operationId: OperationId,
    reason: FileProcessingSkipReason,
    relativePath: PosixPath,
    status: S.Literal("skipped"),
  },
  $I.annote("SkippedFileProcessingFailureRecord", {
    description: "JSONL-safe sanitized skipped or failed source record.",
  })
) {}

/**
 * Hard failure row written to failures.jsonl.
 *
 * **Example** (Make failed failure record)
 *
 * ```ts
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { FailedFileProcessingFailureRecord } from "@beep/file-processing/Extraction"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("mystery.bin")
 *
 *   return FailedFileProcessingFailureRecord.make({
 *     artifactId,
 *     format: "unknown",
 *     message: "No engine could classify the source.",
 *     operationId,
 *     reason: "unsupported-file-format",
 *     relativePath,
 *     status: "failed"
 *   }).reason
 * })
 *
 * Effect.runPromise(program).then(console.log) // "unsupported-file-format"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FailedFileProcessingFailureRecord extends S.Class<FailedFileProcessingFailureRecord>(
  $I`FailedFileProcessingFailureRecord`
)(
  {
    artifactId: ArtifactId,
    engine: S.optionalKey(S.String),
    format: S.optionalKey(FileFormatFamily),
    message: S.String,
    operationId: OperationId,
    reason: FileProcessingOperationErrorReason,
    relativePath: PosixPath,
    status: S.Literal("failed"),
  },
  $I.annote("FailedFileProcessingFailureRecord", {
    description: "JSONL-safe sanitized hard failure source record.",
  })
) {}

/**
 * Failure row written to failures.jsonl.
 *
 * **Example** (Decode failure record)
 *
 * ```ts
 * import { FileProcessingFailureRecord } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(FileProcessingFailureRecord)({
 *   artifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   format: "unknown",
 *   message: "No engine could classify the source.",
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   reason: "unsupported-file-format",
 *   relativePath: "mystery.bin",
 *   status: "failed"
 * })
 *
 * Effect.runPromise(program).then((record) => console.log(record.status)) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FileProcessingFailureRecord = S.Union([
  SkippedFileProcessingFailureRecord,
  FailedFileProcessingFailureRecord,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FileProcessingFailureRecord", {
    description: "JSONL-safe sanitized skipped or failed source record.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    encodeJson: S.encodeUnknownEffect(S.fromJsonString(schema)),
  }))
);

/**
 * Type for {@link FileProcessingFailureRecord}.
 *
 * **Example** (Type failure record)
 *
 * ```ts
 * import { FileProcessingFailureRecord } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const record: FileProcessingFailureRecord = yield* S.decodeUnknownEffect(FileProcessingFailureRecord)({
 *     artifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     format: "unknown",
 *     message: "No engine could classify the source.",
 *     operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     reason: "unsupported-file-format",
 *     relativePath: "mystery.bin",
 *     status: "failed"
 *   })
 *   return record.status
 * })
 *
 * Effect.runPromise(program).then(console.log) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingFailureRecord = typeof FileProcessingFailureRecord.Type;

/**
 * Child artifact row written to children/<source-artifact-id>/artifacts.jsonl.
 *
 * **Example** (Decode child artifact record)
 *
 * ```ts
 * import { ChildArtifactRecord } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(ChildArtifactRecord)({
 *   child: {
 *     id: "artifact:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7",
 *     relativePath: "children/message.txt",
 *     sizeBytes: 29
 *   },
 *   sourceArtifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * })
 *
 * Effect.runPromise(program).then((record) => console.log(record.child.relativePath)) // "children/message.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChildArtifactRecord extends S.Class<ChildArtifactRecord>($I`ChildArtifactRecord`)(
  {
    child: ArtifactReference,
    sourceArtifactId: ArtifactId,
  },
  $I.annote("ChildArtifactRecord", {
    description: "JSONL-safe child artifact record emitted for archive exports.",
  })
) {
  static readonly encodeJson: JsonEncodeEffect<ChildArtifactRecord> = dual(
    SchemaUtils.isCodecDataFirst,
    S.encodeUnknownEffect(S.fromJsonString(ChildArtifactRecord))
  );
}

/**
 * Coverage summary written to coverage.json.
 *
 * **Example** (Decode coverage summary)
 *
 * ```ts
 * import { FileProcessingCoverageSummary } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(FileProcessingCoverageSummary)({
 *   byFormat: { markdown: { failed: 0, skipped: 0, succeeded: 1 } },
 *   failedCount: 0,
 *   skippedCount: 0,
 *   sourceCount: 1,
 *   succeededCount: 1,
 *   textArtifactCount: 1
 * })
 *
 * Effect.runPromise(program).then((summary) => console.log(summary.succeededCount)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileProcessingCoverageSummary extends S.Class<FileProcessingCoverageSummary>(
  $I`FileProcessingCoverageSummary`
)(
  {
    byFormat: S.Record(FileFormatFamily, S.Record(SourceProcessingStatus, NonNegativeInt)),
    failedCount: NonNegativeInt,
    skippedCount: NonNegativeInt,
    sourceCount: NonNegativeInt,
    succeededCount: NonNegativeInt,
    textArtifactCount: NonNegativeInt,
  },
  $I.annote("FileProcessingCoverageSummary", {
    description: "Aggregate processing coverage counts for the proof manifest.",
  })
) {
  static readonly encodeJson: JsonEncodeEffect<FileProcessingCoverageSummary> = dual(
    SchemaUtils.isCodecDataFirst,
    S.encodeUnknownEffect(S.fromJsonString(FileProcessingCoverageSummary))
  );
}

/**
 * Top-level run manifest written to run.json.
 *
 * **Example** (Decode process run manifest)
 *
 * ```ts
 * import { ProcessRunManifest } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(ProcessRunManifest)({
 *   coverage: {
 *     byFormat: { markdown: { failed: 0, skipped: 0, succeeded: 1 } },
 *     failedCount: 0,
 *     skippedCount: 0,
 *     sourceCount: 1,
 *     succeededCount: 1,
 *     textArtifactCount: 1
 *   },
 *   engine: "beep-test",
 *   manifestVersion: "beep.file-processing.run.v1",
 *   outputRoot: ".",
 *   runId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sourceRootLabel: "fixtures",
 *   strategies: []
 * })
 *
 * Effect.runPromise(program).then((manifest) => console.log(manifest.outputRoot)) // "."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessRunManifest extends S.Class<ProcessRunManifest>($I`ProcessRunManifest`)(
  {
    coverage: FileProcessingCoverageSummary,
    engine: S.String,
    manifestVersion: S.Literal("beep.file-processing.run.v1"),
    outputRoot: S.Literal("."),
    runId: OperationId,
    sourceRootLabel: S.String,
    strategies: S.Array(SelectedStrategy),
  },
  $I.annote("ProcessRunManifest", {
    description: "JSON-safe root manifest for a file-processing proof run.",
  })
) {
  static readonly encodeJson: JsonEncodeEffect<ProcessRunManifest> = dual(
    SchemaUtils.isCodecDataFirst,
    S.encodeUnknownEffect(S.fromJsonString(ProcessRunManifest))
  );
}

/**
 * JSON encoder for {@link ProcessRunManifest}.
 *
 * **Example** (Encode run manifest JSON)
 *
 * ```ts
 * import { OperationId } from "@beep/file-processing/Artifact"
 * import { encodeProcessRunManifestJson, ProcessRunManifest } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const formats = [
 *   "doc", "docx", "docm", "rtf", "html", "xhtml", "pdf-text-layer",
 *   "pst", "plain-text", "markdown", "image-metadata", "xls", "xlsx", "unknown"
 * ]
 * const statusCounts = { succeeded: 0, skipped: 0, failed: 0 }
 *
 * const program = Effect.gen(function* () {
 *   const runId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const manifest = yield* S.decodeUnknownEffect(ProcessRunManifest)({
 *     coverage: {
 *       byFormat: Object.fromEntries(formats.map((format) => [format, statusCounts])),
 *       failedCount: 0,
 *       skippedCount: 0,
 *       sourceCount: 0,
 *       succeededCount: 0,
 *       textArtifactCount: 0
 *     },
 *     engine: "test",
 *     manifestVersion: "beep.file-processing.run.v1",
 *     outputRoot: ".",
 *     runId,
 *     sourceRootLabel: "input",
 *     strategies: []
 *   })
 *
 *   return yield* encodeProcessRunManifestJson(manifest)
 * })
 *
 * Effect.runPromise(program).then((json) => console.log(json.includes("\"outputRoot\":\".\""))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeProcessRunManifestJson = ProcessRunManifest.encodeJson;

/**
 * JSON encoder for {@link FileProcessingCoverageSummary}.
 *
 * **Example** (Encode coverage summary JSON)
 *
 * ```ts
 * import { encodeFileProcessingCoverageSummaryJson, FileProcessingCoverageSummary } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const formats = [
 *   "doc", "docx", "docm", "rtf", "html", "xhtml", "pdf-text-layer",
 *   "pst", "plain-text", "markdown", "image-metadata", "xls", "xlsx", "unknown"
 * ]
 * const statusCounts = { succeeded: 0, skipped: 0, failed: 0 }
 *
 * const program = Effect.gen(function* () {
 *   const coverage = yield* S.decodeUnknownEffect(FileProcessingCoverageSummary)({
 *     byFormat: Object.fromEntries(formats.map((format) => [format, statusCounts])),
 *     failedCount: 0,
 *     skippedCount: 0,
 *     sourceCount: 0,
 *     succeededCount: 0,
 *     textArtifactCount: 0
 *   })
 *
 *   return yield* encodeFileProcessingCoverageSummaryJson(coverage)
 * })
 *
 * Effect.runPromise(program).then((json) => console.log(json.includes("\"sourceCount\":0"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeFileProcessingCoverageSummaryJson = FileProcessingCoverageSummary.encodeJson;

/**
 * JSONL encoder for {@link SourceProcessingRecord}.
 *
 * **Example** (Encode source record JSONL)
 *
 * ```ts
 * import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { encodeSourceProcessingRecordJson, SucceededSourceProcessingRecord } from "@beep/file-processing/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("note.txt")
 *
 *   return yield* encodeSourceProcessingRecordJson(SucceededSourceProcessingRecord.make({
 *     artifactId,
 *     digest,
 *     format: "plain-text",
 *     operationId,
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(4),
 *     status: "succeeded"
 *   }))
 * })
 *
 * Effect.runPromise(program).then((json) => console.log(json.includes("\"status\":\"succeeded\""))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSourceProcessingRecordJson: JsonEncodeEffect<unknown> = dual(
  SchemaUtils.isCodecDataFirst,
  SourceProcessingRecord.encodeJson
);

/**
 * JSONL encoder for {@link FileProcessingFailureRecord}.
 *
 * **Example** (Encode failure record JSONL)
 *
 * ```ts
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { encodeFileProcessingFailureRecordJson, SkippedFileProcessingFailureRecord } from "@beep/file-processing/Extraction"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("table.xls")
 *
 *   return yield* encodeFileProcessingFailureRecordJson(SkippedFileProcessingFailureRecord.make({
 *     artifactId,
 *     format: "xls",
 *     message: "XLS is classified but extraction is deferred in V1.",
 *     operationId,
 *     reason: "format-out-of-scope",
 *     relativePath,
 *     status: "skipped"
 *   }))
 * })
 *
 * Effect.runPromise(program).then((json) => console.log(json.includes("\"status\":\"skipped\""))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeFileProcessingFailureRecordJson: JsonEncodeEffect<unknown> = dual(
  SchemaUtils.isCodecDataFirst,
  FileProcessingFailureRecord.encodeJson
);

/**
 * JSONL encoder for {@link ChildArtifactRecord}.
 *
 * **Example** (Encode child artifact JSONL)
 *
 * ```ts
 * import { ArtifactId, ArtifactReference } from "@beep/file-processing/Artifact"
 * import { ChildArtifactRecord, encodeChildArtifactRecordJson } from "@beep/file-processing/Extraction"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("children/message.txt")
 *   const child = ArtifactReference.make({
 *     id: artifactId,
 *     mediaType: "text/plain",
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(12)
 *   })
 *
 *   return yield* encodeChildArtifactRecordJson(ChildArtifactRecord.make({ child, sourceArtifactId: artifactId }))
 * })
 *
 * Effect.runPromise(program).then((json) => console.log(json.includes("children/message.txt"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeChildArtifactRecordJson = ChildArtifactRecord.encodeJson;
