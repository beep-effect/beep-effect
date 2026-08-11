/**
 * JSON and JSONL encoders for file-processing manifests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import {
  ChildArtifactRecord,
  FileProcessingCoverageSummary,
  FileProcessingFailureRecord,
  ProcessRunManifest,
  SourceProcessingRecord,
} from "./Extraction.manifest.ts";
import type * as Effect from "effect/Effect";
import type * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

type JsonEncodeEffect<Input> = {
  (options?: AST.ParseOptions): (input: Input) => Effect.Effect<string, S.SchemaError>;
  (input: Input, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
};

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
