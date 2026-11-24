/**
 * Extraction result schemas for file processing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ArtifactId, ArtifactReference, OperationId } from "../Artifact/Artifact.schema.ts";
import { FileFormatFamily, FileProcessingSkipReason } from "../Strategy/Strategy.schema.ts";

const $I = $FileProcessingId.create("Extraction");

/**
 * Extracted text span with byte or character offsets supplied by the engine.
 *
 * **Example** (Compare the unchecked base with the ordered span)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { TextSpan, TextSpanBase } from "@beep/file-processing/Extraction"
 *
 * const reversed = { startOffset: 12, endOffset: 4, text: "claim 1" }
 *
 * console.log(Exit.isSuccess(S.decodeUnknownExit(TextSpanBase)(reversed))) // => true
 * console.log(Exit.isSuccess(S.decodeUnknownExit(TextSpan)(reversed))) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextSpanBase extends S.Opaque<TextSpanBase, { readonly brand: unique symbol }>()(
  S.Struct({
    endOffset: S.Natural,
    startOffset: S.Natural,
    text: S.String,
  }).pipe(
    $I.annoteSchema("TextSpan", {
      description: "Extracted text span with byte or character offsets supplied by the engine.",
    })
  )
) {}

/**
 * Processing status emitted for each source row.
 *
 * **Example** (Check skipped status option)
 *
 * ```ts import.meta.vitest name="Check skipped status option"
 * import { SourceProcessingStatus } from "@beep/file-processing/Extraction"
 *
 * SourceProcessingStatus.literals.includes("skipped") // => true
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
 * **Example** (Type succeeded status value)
 *
 * ```ts import.meta.vitest name="Type succeeded status value"
 * import { SourceProcessingStatus } from "@beep/file-processing/Extraction"
 *
 * const status: SourceProcessingStatus = "succeeded"
 * SourceProcessingStatus.is.succeeded(status) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SourceProcessingStatus = typeof SourceProcessingStatus.Type;

/**
 * **Example** (Decode text artifact reference)
 *
 * ```ts
 * import { TextArtifactReference } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
export class TextArtifactReference extends S.Opaque<TextArtifactReference, { readonly brand: unique symbol }>()(
  S.Struct({
    artifact: ArtifactReference,
    operationId: OperationId,
  }).pipe(
    $I.annoteSchema("TextArtifactReference", {
      description: "Reference to a text artifact emitted for one extraction operation.",
    })
  )
) {}

/**
 * Text span emitted by a text extraction operation.
 *
 * **Example** (Make text span value)
 *
 * ```ts import.meta.vitest name="Make text span value"
 * import * as S from "effect/Schema"
 * import { TextSpan } from "@beep/file-processing/Extraction"
 *
 * const span = TextSpan.make({ endOffset: S.Natural.make(5), startOffset: S.Natural.make(0), text: "hello" })
 * span.text // => "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextSpan = TextSpanBase.check(
  S.makeFilter(
    ({ endOffset, startOffset }) => endOffset >= startOffset,
    $I.annote("TextSpanOffsetOrderCheck", {
      title: "Text Span Offset Order",
      description: "Checks that a text span's end offset is greater than or equal to its start offset.",
      message: "Expected endOffset to be greater than or equal to startOffset.",
    })
  )
);

/**
 * Type for {@link TextSpan}.
 *
 * **Example** (Type text span value)
 *
 * ```ts import.meta.vitest name="Type text span value"
 * import * as S from "effect/Schema"
 * import { TextSpan } from "@beep/file-processing/Extraction"
 *
 * const span: TextSpan = TextSpan.make({ endOffset: S.Natural.make(5), startOffset: S.Natural.make(0), text: "hello" })
 * span.text // => "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextSpan = InstanceType<typeof TextSpanBase>;

/**
 * **Example** (Decode extraction result)
 *
 * ```ts
 * import { ExtractionResult } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
export class ExtractionResult extends S.Opaque<ExtractionResult, { readonly brand: unique symbol }>()(
  S.Struct({
    engine: S.String,
    engineVersion: S.optionalKey(S.String),
    format: FileFormatFamily,
    metadata: S.Record(S.String, S.String),
    operationId: OperationId,
    sourceArtifactId: ArtifactId,
    text: S.optionalKey(S.String),
    textArtifact: S.optionalKey(TextArtifactReference),
    warnings: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ExtractionResult", {
      description: "Runtime-neutral text and metadata extraction result.",
    })
  )
) {}

/**
 * **Example** (Decode archive export result)
 *
 * ```ts
 * import { ArchiveExportResult } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
export class ArchiveExportResult extends S.Opaque<ArchiveExportResult, { readonly brand: unique symbol }>()(
  S.Struct({
    children: S.Array(ArtifactReference),
    engine: S.String,
    operationId: OperationId,
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ArchiveExportResult", {
      description: "Runtime-neutral child artifact export result for archive-like source files.",
    })
  )
) {}

/**
 * Successful extraction result of a full source processing operation.
 *
 * **Example** (Make extracted process result)
 *
 * ```ts import.meta.vitest name="Make extracted process result"
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { ExtractedProcessFileResult, ExtractionResult } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
 * await Effect.runPromise(program) // => "extracted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractedProcessFileResult extends S.Opaque<
  ExtractedProcessFileResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    engine: S.String,
    extraction: ExtractionResult,
    format: FileFormatFamily,
    operationId: OperationId,
    resultKind: S.tag("extracted"),
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ExtractedProcessFileResult", {
      description: "Full source processing result for text or metadata extraction.",
    })
  )
) {}

/**
 * Successful archive export result of a full source processing operation.
 *
 * **Example** (Make archive export process result)
 *
 * ```ts import.meta.vitest name="Make archive export process result"
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { ArchiveExportProcessFileResult, ArchiveExportResult } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
 * await Effect.runPromise(program) // => "archive-exported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveExportProcessFileResult extends S.Opaque<
  ArchiveExportProcessFileResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    archiveExport: ArchiveExportResult,
    engine: S.String,
    format: FileFormatFamily,
    operationId: OperationId,
    resultKind: S.tag("archive-exported"),
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ArchiveExportProcessFileResult", {
      description: "Full source processing result for archive child export.",
    })
  )
) {}

/**
 * **Example** (Make skipped process result)
 *
 * ```ts import.meta.vitest name="Make skipped process result"
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { SkippedProcessFileResult } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
 * await Effect.runPromise(program) // => "format-out-of-scope"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkippedProcessFileResult extends S.Opaque<SkippedProcessFileResult, { readonly brand: unique symbol }>()(
  S.Struct({
    engine: S.String,
    format: FileFormatFamily,
    operationId: OperationId,
    resultKind: S.tag("skipped"),
    skipReason: FileProcessingSkipReason,
    sourceArtifactId: ArtifactId,
    warnings: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("SkippedProcessFileResult", {
      description: "Full source processing result for intentional skips.",
    })
  )
) {}

/**
 * **Example** (Decode skipped process result)
 *
 * ```ts
 * import { ArtifactId, OperationId } from "@beep/file-processing/Artifact"
 * import { ProcessFileResult } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
  })
);

/**
 * **Example** (Type process file result)
 *
 * ```ts import.meta.vitest name="Type process file result"
 * import { ProcessFileResult } from "@beep/file-processing/Extraction"
 * import * as Effect from "effect/Effect";
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
 * await Effect.runPromise(program) // => "skipped"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProcessFileResult = typeof ProcessFileResult.Type;
