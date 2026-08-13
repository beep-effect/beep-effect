/**
 * Extraction result schemas for file processing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { ArtifactId, ArtifactReference, OperationId } from "../Artifact/Artifact.schema.ts";
import { FileFormatFamily, FileProcessingSkipReason } from "../Strategy/Strategy.schema.ts";

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
