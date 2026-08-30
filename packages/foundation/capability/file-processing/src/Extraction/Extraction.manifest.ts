/**
 * File-processing manifest schemas and records.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { ArtifactId, ArtifactReference, ContentDigest, OperationId } from "../Artifact/Artifact.schema.ts";
import { FileProcessingOperationErrorReason } from "../Operation/Operation.errors.ts";
import { FileFormatFamily, FileProcessingSkipReason, SelectedStrategy } from "../Strategy/Strategy.schema.ts";
import { SourceProcessingStatus } from "./Extraction.schema.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $FileProcessingId.create("Extraction");

type JsonEncodeEffect<Input> = {
  // Data-last first: the `(input, options?)` overload would otherwise absorb a
  // lone parse-options argument and hide the curried form.
  (options?: AST.ParseOptions): (input: Input) => Effect.Effect<string, S.SchemaError>;
  (input: Input, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
};

/**
 * Succeeded source row written to sources.jsonl.
 *
 * **Example** (Make succeeded source record)
 *
 * ```ts import.meta.vitest name="Make succeeded source record"
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
 * await Effect.runPromise(program) // => "succeeded"
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
 * ```ts import.meta.vitest name="Make skipped source record"
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
 * await Effect.runPromise(program) // => "format-out-of-scope"
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
 * ```ts import.meta.vitest name="Make failed source record"
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
 * await Effect.runPromise(program) // => "failed"
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
  SchemaUtils.withStatics((schema) => ({
    encodeJson: S.encodeUnknownEffect(S.fromJsonString(schema)),
  }))
);

/**
 * Type for {@link SourceProcessingRecord}.
 *
 * **Example** (Type source processing record)
 *
 * ```ts import.meta.vitest name="Type source processing record"
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
 * await Effect.runPromise(program) // => "succeeded"
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
 * ```ts import.meta.vitest name="Decode failure reason value"
 * import { FileProcessingFailureReason } from "@beep/file-processing/Extraction"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(FileProcessingFailureReason)("format-out-of-scope")
 *
 * await Effect.runPromise(program) // => "format-out-of-scope"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileProcessingFailureReason = S.Union([FileProcessingOperationErrorReason, FileProcessingSkipReason]).pipe(
  $I.annoteSchema("FileProcessingFailureReason", {
    description: "Machine-readable skipped or failed source reason emitted in failures.jsonl.",
  })
);

/**
 * Type for {@link FileProcessingFailureReason}.
 *
 * **Example** (Type failure reason value)
 *
 * ```ts import.meta.vitest name="Type failure reason value"
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
 * await Effect.runPromise(program) // => "format-out-of-scope"
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
 * ```ts import.meta.vitest name="Make failed failure record"
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
 * await Effect.runPromise(program) // => "unsupported-file-format"
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
  SchemaUtils.withStatics((schema) => ({
    encodeJson: S.encodeUnknownEffect(S.fromJsonString(schema)),
  }))
);

/**
 * Type for {@link FileProcessingFailureRecord}.
 *
 * **Example** (Type failure record)
 *
 * ```ts import.meta.vitest name="Type failure record"
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
 * await Effect.runPromise(program) // => "failed"
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
