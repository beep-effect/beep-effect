/**
 * Streaming and dataset MCP tool definitions.
 *
 * Declares the 17 agent-facing streaming tools (file IO, JSONL handling,
 * dataset loading, and line-transform pipelines) together with their output
 * schemas and the {@link StreamingToolkit} that groups them. Every tool fails
 * with {@link AiToolError} using `failureMode: "return"` so callers can inspect
 * structured failures. All output schemas are plain {@link S.Struct} values
 * because the toolkit encodes results structurally.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpMcpId } from "@beep/identity";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import { AiToolError } from "@beep/nlp-processing/Tools";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import { DatasetMeta } from "./Streaming/DatasetLoader.ts";
import { JsonlLineError, JsonlStats as JsonlStatsModel } from "./Streaming/Jsonl.ts";
import { PipelineError, PipelineResult, PipelineStage } from "./Streaming/Pipeline.ts";
import { TextEncoding, TextStreamStats } from "./Streaming/TextStream.ts";

const $I = $NlpMcpId.create("StreamingTools");
const NonNegativeInteger = S.Int.check(S.isGreaterThanOrEqualTo(0));
const PositiveInteger = S.Int.check(S.isGreaterThan(0));

const withOutputCodecStatics = <Sch extends S.Top & S.ConstraintDecoder<unknown>>(self: Sch) =>
  SchemaUtils.withCodecStatics(self).pipe(
    SchemaUtils.withStatics((schema) => ({
      decodeResult: S.decodeUnknownResult(schema),
    }))
  );

const JsonlLineErrorOutput = JsonlLineError.mapFields((fields) => fields).pipe(
  $I.annoteSchema("JsonlLineErrorOutput", {
    description: "A JSONL line parse failure with its zero-based line number.",
  })
);

const PipelineErrorOutput = PipelineError.mapFields((fields) => fields).pipe(
  $I.annoteSchema("PipelineErrorOutput", {
    description: "A pipeline failure describing the failing item, message, and stage.",
  })
);

/**
 * Output schema for line-returning streaming tools.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { LinesOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(LinesOutput)({ count: 1, lines: ["hi"], truncated: false })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const LinesOutput = S.Class<{
  readonly count: number;
  readonly lines: ReadonlyArray<string>;
  readonly truncated: boolean;
}>($I`LinesOutput`)(
  {
    count: NonNegativeInteger.annotateKey({
      description: "Number of lines returned.",
    }),
    lines: S.Array(S.String).annotateKey({
      description: "Returned text lines in document order.",
    }),
    truncated: S.Boolean.annotateKey({
      description: "Whether the result was capped by the requested or default limit.",
    }),
  },
  $I.annote("LinesOutput", {
    description: "Lines returned from a streaming file operation with a truncation flag.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("LinesOutput", {
      description: "Lines returned from a streaming file operation with a truncation flag.",
    }),
    withOutputCodecStatics
  );

/**
 * Type for {@link LinesOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type LinesOutput = typeof LinesOutput.Type;

/**
 * Output schema for file existence and size metadata.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FileInfoOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(FileInfoOutput)({ exists: true, lineCount: 3, sizeBytes: 12 })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const FileInfoOutput = S.Class<{
  readonly exists: boolean;
  readonly lineCount?: number | undefined;
  readonly sizeBytes?: number | undefined;
}>($I`FileInfoOutput`)(
  {
    exists: S.Boolean.annotateKey({
      description: "Whether the target file exists.",
    }),
    lineCount: S.optionalKey(NonNegativeInteger).annotateKey({
      description: "Total line count when the file exists.",
    }),
    sizeBytes: S.optionalKey(NonNegativeInteger).annotateKey({
      description: "File size in bytes when the file exists.",
    }),
  },
  $I.annote("FileInfoOutput", {
    description: "File existence with optional line count and byte size.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("FileInfoOutput", {
      description: "File existence with optional line count and byte size.",
    }),
    withOutputCodecStatics
  );

/**
 * Type for {@link FileInfoOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type FileInfoOutput = typeof FileInfoOutput.Type;

/**
 * Output schema for aggregate text statistics.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextStatsOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(TextStatsOutput)({
 *   avgLineLength: 4,
 *   maxLineLength: 8,
 *   minLineLength: 1,
 *   nonEmptyLines: 2,
 *   totalBytes: 12,
 *   totalLines: 3
 * })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const TextStatsOutput = TextStreamStats.mapFields((fields) => fields).pipe(
  $I.annoteSchema("TextStatsOutput", {
    description: "Aggregate line-length and byte statistics for a text file.",
  }),
  withOutputCodecStatics
);

/**
 * Type for {@link TextStatsOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type TextStatsOutput = typeof TextStatsOutput.Type;

/**
 * Output schema for JSONL record reads, with optional collected errors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonlOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(JsonlOutput)({ count: 1, records: [{ id: 1 }], truncated: false })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const JsonlOutput = S.Class<{
  readonly count: number;
  readonly errors?: ReadonlyArray<typeof JsonlLineErrorOutput.Type> | undefined;
  readonly records: ReadonlyArray<unknown>;
  readonly truncated: boolean;
}>($I`JsonlOutput`)(
  {
    count: NonNegativeInteger.annotateKey({
      description: "Number of parsed records returned.",
    }),
    errors: JsonlLineErrorOutput.pipe(S.Array, S.optionalKey).annotateKey({
      description: "Collected JSONL parse errors when requested by the caller.",
    }),
    records: S.Array(S.Unknown).annotateKey({
      description: "Parsed JSONL records in file order.",
    }),
    truncated: S.Boolean.annotateKey({
      description: "Whether records or errors were capped by the requested or default limit.",
    }),
  },
  $I.annote("JsonlOutput", {
    description: "JSONL records returned from a streaming operation with optional parse errors.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("JsonlOutput", {
      description: "JSONL records returned from a streaming operation with optional parse errors.",
    }),
    withOutputCodecStatics
  );

/**
 * Type for {@link JsonlOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type JsonlOutput = typeof JsonlOutput.Type;

/**
 * Output schema for JSONL parse statistics.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonlStatsOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(JsonlStatsOutput)({
 *   errorCount: 0,
 *   skippedCount: 0,
 *   successCount: 3,
 *   totalLines: 3
 * })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const JsonlStatsOutput = JsonlStatsModel.mapFields((fields) => fields).pipe(
  $I.annoteSchema("JsonlStatsOutput", {
    description: "Aggregate parse statistics for a JSONL file.",
  }),
  withOutputCodecStatics
);

/**
 * Type for {@link JsonlStatsOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type JsonlStatsOutput = typeof JsonlStatsOutput.Type;

/**
 * Output schema for dataset provenance metadata.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DatasetMetaOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(DatasetMetaOutput)({
 *   format: "text",
 *   loadedAt: 0,
 *   location: "/tmp/data.txt",
 *   sourceType: "file"
 * })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DatasetMetaOutput = DatasetMeta.mapFields((fields) => fields).pipe(
  $I.annoteSchema("DatasetMetaOutput", {
    description: "Provenance metadata describing a loaded dataset.",
  }),
  withOutputCodecStatics
);

/**
 * Type for {@link DatasetMetaOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type DatasetMetaOutput = typeof DatasetMetaOutput.Type;

/**
 * Output schema pairing loaded data with its {@link DatasetMetaOutput}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DataOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(DataOutput)({
 *   data: "hello",
 *   meta: { format: "text", loadedAt: 0, location: "/tmp/data.txt", sourceType: "file" }
 * })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DataOutput = S.Class<{
  readonly data: unknown;
  readonly meta: DatasetMetaOutput;
}>($I`DataOutput`)(
  {
    data: S.Unknown.annotateKey({
      description: "Loaded dataset payload.",
    }),
    meta: DatasetMetaOutput.annotateKey({
      description: "Provenance metadata for the loaded payload.",
    }),
  },
  $I.annote("DataOutput", {
    description: "A loaded dataset payload paired with its provenance metadata.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("DataOutput", {
      description: "A loaded dataset payload paired with its provenance metadata.",
    }),
    withOutputCodecStatics
  );

/**
 * Type for {@link DataOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type DataOutput = typeof DataOutput.Type;

/**
 * Output schema for line-transform pipeline runs.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PipelineOutput } from "@beep/nlp-mcp/StreamingTools"
 *
 * const output = S.decodeUnknownResult(PipelineOutput)({
 *   durationMs: 1,
 *   errors: [],
 *   failed: 0,
 *   processed: 2,
 *   results: ["a", "b"],
 *   skipped: 0
 * })
 * console.log(output)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const PipelineOutput = PipelineResult.mapFields((fields) => ({
  ...fields,
  errors: S.Array(PipelineErrorOutput),
})).pipe(
  $I.annoteSchema("PipelineOutput", {
    description: "Result of running a line-transform pipeline over a file.",
  }),
  withOutputCodecStatics
);

/**
 * Type for {@link PipelineOutput}.
 *
 * @since 0.0.0
 * @category models
 */
export type PipelineOutput = typeof PipelineOutput.Type;

const CountOutput = S.Class<{ readonly count: number }>($I`CountOutput`)(
  {
    count: NonNegativeInteger.annotateKey({
      description: "Computed count.",
    }),
  },
  $I.annote("CountOutput", {
    description: "A single non-negative count.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("CountOutput", {
      description: "A single non-negative count.",
    })
  );

const CountWithErrorsOutput = S.Class<{ readonly count: number; readonly errors?: number | undefined }>(
  $I`CountWithErrorsOutput`
)(
  {
    count: NonNegativeInteger.annotateKey({
      description: "Computed count.",
    }),
    errors: S.optionalKey(NonNegativeInteger).annotateKey({
      description: "Optional companion error count.",
    }),
  },
  $I.annote("CountWithErrorsOutput", {
    description: "A count with an optional companion error count.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("CountWithErrorsOutput", {
      description: "A count with an optional companion error count.",
    })
  );

/**
 * Optional windowing, encoding, and trimming controls for {@link ReadLines}.
 *
 * @example
 * ```ts
 * import { ReadLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = ReadLinesOptions.make({ maxLines: 10 })
 * console.log(options.maxLines)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ReadLinesOptions = S.Class<{
  readonly encoding?: TextEncoding | undefined;
  readonly maxLines?: number | undefined;
  readonly skip?: number | undefined;
  readonly skipEmpty?: boolean | undefined;
  readonly tail?: number | undefined;
  readonly trim?: boolean | undefined;
}>($I`ReadLinesOptions`)(
  {
    encoding: S.optionalKey(TextEncoding),
    maxLines: S.optionalKey(PositiveInteger),
    skip: S.optionalKey(NonNegativeInteger),
    skipEmpty: S.optionalKey(S.Boolean),
    tail: S.optionalKey(PositiveInteger),
    trim: S.optionalKey(S.Boolean),
  },
  $I.annote("ReadLinesOptions", {
    description: "Optional windowing, encoding, and trimming controls for reading lines.",
  })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("ReadLinesOptions", {
      description: "Optional windowing, encoding, and trimming controls for reading lines.",
    })
  );

/**
 * Type for {@link ReadLinesOptions}.
 *
 * @example
 * ```ts
 * import type { ReadLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const windowed: ReadLinesOptions = { maxLines: 10, trim: true }
 * console.log(windowed.maxLines)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ReadLinesOptions = typeof ReadLinesOptions.Type;

const ReadLinesParameters = S.Class<{
  readonly options?: ReadLinesOptions | undefined;
  readonly path: string;
}>($I`ReadLinesParameters`)(
  {
    options: S.optionalKey(ReadLinesOptions),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("ReadLinesParameters", { description: "Inputs for reading lines from a text file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ReadLinesParameters", { description: "Inputs for reading lines from a text file." }));

const FileInfoParameters = S.Class<{ readonly path: string }>($I`FileInfoParameters`)(
  {
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("FileInfoParameters", { description: "Inputs for inspecting a text file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("FileInfoParameters", { description: "Inputs for inspecting a text file." }));

/**
 * Optional line-normalization controls for {@link TextStats}.
 *
 * @example
 * ```ts
 * import { TextStatsOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = TextStatsOptions.make({ trim: true })
 * console.log(options.trim)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const TextStatsOptions = S.Class<{
  readonly skipEmpty?: boolean | undefined;
  readonly trim?: boolean | undefined;
}>($I`TextStatsOptions`)(
  {
    skipEmpty: S.optionalKey(S.Boolean),
    trim: S.optionalKey(S.Boolean),
  },
  $I.annote("TextStatsOptions", { description: "Optional line-normalization controls for computing text statistics." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("TextStatsOptions", {
      description: "Optional line-normalization controls for computing text statistics.",
    })
  );

/**
 * Type for {@link TextStatsOptions}.
 *
 * @example
 * ```ts
 * import type { TextStatsOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const normalized: TextStatsOptions = { trim: true }
 * console.log(normalized.trim)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TextStatsOptions = typeof TextStatsOptions.Type;

const TextStatsParameters = S.Class<{
  readonly options?: TextStatsOptions | undefined;
  readonly path: string;
}>($I`TextStatsParameters`)(
  {
    options: S.optionalKey(TextStatsOptions),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("TextStatsParameters", { description: "Inputs for computing text statistics." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("TextStatsParameters", { description: "Inputs for computing text statistics." }));

/**
 * Optional line-normalization controls for {@link SampleLines}.
 *
 * @example
 * ```ts
 * import { SampleLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = SampleLinesOptions.make({ trim: true })
 * console.log(options.trim)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const SampleLinesOptions = S.Class<{
  readonly skipEmpty?: boolean | undefined;
  readonly trim?: boolean | undefined;
}>($I`SampleLinesOptions`)(
  {
    skipEmpty: S.optionalKey(S.Boolean),
    trim: S.optionalKey(S.Boolean),
  },
  $I.annote("SampleLinesOptions", { description: "Optional line-normalization controls for sampling text lines." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("SampleLinesOptions", {
      description: "Optional line-normalization controls for sampling text lines.",
    })
  );

/**
 * Type for {@link SampleLinesOptions}.
 *
 * @example
 * ```ts
 * import type { SampleLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const sampled: SampleLinesOptions = { trim: true }
 * console.log(sampled.trim)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SampleLinesOptions = typeof SampleLinesOptions.Type;

const SampleLinesParameters = S.Class<{
  readonly options?: SampleLinesOptions | undefined;
  readonly path: string;
  readonly sampleSize: number;
}>($I`SampleLinesParameters`)(
  {
    options: S.optionalKey(SampleLinesOptions),
    path: S.String.check(S.isMinLength(1)),
    sampleSize: PositiveInteger.check(S.isLessThanOrEqualTo(10_000)),
  },
  $I.annote("SampleLinesParameters", { description: "Inputs for randomly sampling text lines." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("SampleLinesParameters", { description: "Inputs for randomly sampling text lines." }));

/**
 * Optional controls for {@link ReadJsonl}.
 *
 * @example
 * ```ts
 * import { ReadJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = ReadJsonlOptions.make({ skipInvalid: true })
 * console.log(options.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ReadJsonlOptions = S.Class<{
  readonly collectErrors?: boolean | undefined;
  readonly maxRecords?: number | undefined;
  readonly skipInvalid?: boolean | undefined;
}>($I`ReadJsonlOptions`)(
  {
    collectErrors: S.optionalKey(S.Boolean),
    maxRecords: S.optionalKey(PositiveInteger),
    skipInvalid: S.optionalKey(S.Boolean),
  },
  $I.annote("ReadJsonlOptions", { description: "Optional controls for reading JSONL records." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ReadJsonlOptions", { description: "Optional controls for reading JSONL records." }));

/**
 * Type for {@link ReadJsonlOptions}.
 *
 * @example
 * ```ts
 * import type { ReadJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const lenient: ReadJsonlOptions = { skipInvalid: true }
 * console.log(lenient.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ReadJsonlOptions = typeof ReadJsonlOptions.Type;

const ReadJsonlParameters = S.Class<{
  readonly options?: ReadJsonlOptions | undefined;
  readonly path: string;
}>($I`ReadJsonlParameters`)(
  {
    options: S.optionalKey(ReadJsonlOptions),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("ReadJsonlParameters", { description: "Inputs for reading JSONL records." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ReadJsonlParameters", { description: "Inputs for reading JSONL records." }));

const JsonlStatsParameters = S.Class<{ readonly path: string }>($I`JsonlStatsParameters`)(
  {
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("JsonlStatsParameters", { description: "Inputs for computing JSONL statistics." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("JsonlStatsParameters", { description: "Inputs for computing JSONL statistics." }));

/**
 * Optional caps for {@link ValidateJsonl}.
 *
 * @example
 * ```ts
 * import { ValidateJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = ValidateJsonlOptions.make({ maxErrors: 10 })
 * console.log(options.maxErrors)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ValidateJsonlOptions = S.Class<{
  readonly maxErrors?: number | undefined;
  readonly maxRecords?: number | undefined;
}>($I`ValidateJsonlOptions`)(
  {
    maxErrors: S.optionalKey(PositiveInteger),
    maxRecords: S.optionalKey(PositiveInteger),
  },
  $I.annote("ValidateJsonlOptions", { description: "Optional caps for validating a JSONL file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ValidateJsonlOptions", { description: "Optional caps for validating a JSONL file." }));

/**
 * Type for {@link ValidateJsonlOptions}.
 *
 * @example
 * ```ts
 * import type { ValidateJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const capped: ValidateJsonlOptions = { maxErrors: 10 }
 * console.log(capped.maxErrors)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ValidateJsonlOptions = typeof ValidateJsonlOptions.Type;

const ValidateJsonlParameters = S.Class<{
  readonly options?: ValidateJsonlOptions | undefined;
  readonly path: string;
}>($I`ValidateJsonlParameters`)(
  {
    options: S.optionalKey(ValidateJsonlOptions),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("ValidateJsonlParameters", { description: "Inputs for validating a JSONL file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ValidateJsonlParameters", { description: "Inputs for validating a JSONL file." }));

/**
 * Optional controls for {@link SampleJsonl}.
 *
 * @example
 * ```ts
 * import { SampleJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = SampleJsonlOptions.make({ skipInvalid: true })
 * console.log(options.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const SampleJsonlOptions = S.Class<{
  readonly skipInvalid?: boolean | undefined;
}>($I`SampleJsonlOptions`)(
  {
    skipInvalid: S.optionalKey(S.Boolean),
  },
  $I.annote("SampleJsonlOptions", { description: "Optional controls for sampling JSONL records." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("SampleJsonlOptions", { description: "Optional controls for sampling JSONL records." }));

/**
 * Type for {@link SampleJsonlOptions}.
 *
 * @example
 * ```ts
 * import type { SampleJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const sampled: SampleJsonlOptions = { skipInvalid: true }
 * console.log(sampled.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SampleJsonlOptions = typeof SampleJsonlOptions.Type;

const SampleJsonlParameters = S.Class<{
  readonly options?: SampleJsonlOptions | undefined;
  readonly path: string;
  readonly sampleSize: number;
}>($I`SampleJsonlParameters`)(
  {
    options: S.optionalKey(SampleJsonlOptions),
    path: S.String.check(S.isMinLength(1)),
    sampleSize: PositiveInteger.check(S.isLessThanOrEqualTo(10_000)),
  },
  $I.annote("SampleJsonlParameters", { description: "Inputs for randomly sampling JSONL records." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("SampleJsonlParameters", { description: "Inputs for randomly sampling JSONL records." }));

/**
 * Optional controls for {@link LoadText}.
 *
 * @example
 * ```ts
 * import { LoadTextOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = LoadTextOptions.make({ encoding: "utf-8" })
 * console.log(options.encoding)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const LoadTextOptions = S.Class<{
  readonly encoding?: TextEncoding | undefined;
  readonly timeout?: number | undefined;
}>($I`LoadTextOptions`)(
  {
    encoding: S.optionalKey(TextEncoding),
    timeout: S.optionalKey(PositiveInteger),
  },
  $I.annote("LoadTextOptions", { description: "Optional controls for loading text from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadTextOptions", { description: "Optional controls for loading text from a file or URL." }));

/**
 * Type for {@link LoadTextOptions}.
 *
 * @example
 * ```ts
 * import type { LoadTextOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const loaded: LoadTextOptions = { encoding: "utf-8" }
 * console.log(loaded.encoding)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LoadTextOptions = typeof LoadTextOptions.Type;

const LoadTextParameters = S.Class<{
  readonly location: string;
  readonly options?: LoadTextOptions | undefined;
}>($I`LoadTextParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(LoadTextOptions),
  },
  $I.annote("LoadTextParameters", { description: "Inputs for loading text from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadTextParameters", { description: "Inputs for loading text from a file or URL." }));

/**
 * Optional controls for {@link LoadLines}.
 *
 * @example
 * ```ts
 * import { LoadLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = LoadLinesOptions.make({ skipEmpty: true })
 * console.log(options.skipEmpty)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const LoadLinesOptions = S.Class<{
  readonly maxLines?: number | undefined;
  readonly skipEmpty?: boolean | undefined;
  readonly timeout?: number | undefined;
  readonly trim?: boolean | undefined;
}>($I`LoadLinesOptions`)(
  {
    maxLines: S.optionalKey(PositiveInteger),
    skipEmpty: S.optionalKey(S.Boolean),
    timeout: S.optionalKey(PositiveInteger),
    trim: S.optionalKey(S.Boolean),
  },
  $I.annote("LoadLinesOptions", { description: "Optional controls for loading lines from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("LoadLinesOptions", { description: "Optional controls for loading lines from a file or URL." })
  );

/**
 * Type for {@link LoadLinesOptions}.
 *
 * @example
 * ```ts
 * import type { LoadLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const loaded: LoadLinesOptions = { skipEmpty: true }
 * console.log(loaded.skipEmpty)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LoadLinesOptions = typeof LoadLinesOptions.Type;

const LoadLinesParameters = S.Class<{
  readonly location: string;
  readonly options?: LoadLinesOptions | undefined;
}>($I`LoadLinesParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(LoadLinesOptions),
  },
  $I.annote("LoadLinesParameters", { description: "Inputs for loading lines from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadLinesParameters", { description: "Inputs for loading lines from a file or URL." }));

/**
 * Optional controls for {@link LoadJsonl}.
 *
 * @example
 * ```ts
 * import { LoadJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = LoadJsonlOptions.make({ skipInvalid: true })
 * console.log(options.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const LoadJsonlOptions = S.Class<{
  readonly maxRecords?: number | undefined;
  readonly skipInvalid?: boolean | undefined;
  readonly timeout?: number | undefined;
}>($I`LoadJsonlOptions`)(
  {
    maxRecords: S.optionalKey(PositiveInteger),
    skipInvalid: S.optionalKey(S.Boolean),
    timeout: S.optionalKey(PositiveInteger),
  },
  $I.annote("LoadJsonlOptions", { description: "Optional controls for loading JSONL from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("LoadJsonlOptions", { description: "Optional controls for loading JSONL from a file or URL." })
  );

/**
 * Type for {@link LoadJsonlOptions}.
 *
 * @example
 * ```ts
 * import type { LoadJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const loaded: LoadJsonlOptions = { skipInvalid: true }
 * console.log(loaded.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LoadJsonlOptions = typeof LoadJsonlOptions.Type;

const LoadJsonlParameters = S.Class<{
  readonly location: string;
  readonly options?: LoadJsonlOptions | undefined;
}>($I`LoadJsonlParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(LoadJsonlOptions),
  },
  $I.annote("LoadJsonlParameters", { description: "Inputs for loading JSONL from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadJsonlParameters", { description: "Inputs for loading JSONL from a file or URL." }));

/**
 * Optional controls for {@link LoadJson}.
 *
 * @example
 * ```ts
 * import { LoadJsonOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = LoadJsonOptions.make({ timeout: 5000 })
 * console.log(options.timeout)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const LoadJsonOptions = S.Class<{
  readonly timeout?: number | undefined;
}>($I`LoadJsonOptions`)(
  {
    timeout: S.optionalKey(PositiveInteger),
  },
  $I.annote("LoadJsonOptions", { description: "Optional controls for loading JSON from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadJsonOptions", { description: "Optional controls for loading JSON from a file or URL." }));

/**
 * Type for {@link LoadJsonOptions}.
 *
 * @example
 * ```ts
 * import type { LoadJsonOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const loaded: LoadJsonOptions = { timeout: 5000 }
 * console.log(loaded.timeout)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LoadJsonOptions = typeof LoadJsonOptions.Type;

const LoadJsonParameters = S.Class<{
  readonly location: string;
  readonly options?: LoadJsonOptions | undefined;
}>($I`LoadJsonParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(LoadJsonOptions),
  },
  $I.annote("LoadJsonParameters", { description: "Inputs for loading JSON from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadJsonParameters", { description: "Inputs for loading JSON from a file or URL." }));

/**
 * Optional controls for {@link ProcessFile}.
 *
 * @example
 * ```ts
 * import { ProcessFileOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = ProcessFileOptions.make({ skipEmpty: true })
 * console.log(options.skipEmpty)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ProcessFileOptions = S.Class<{
  readonly maxLines?: number | undefined;
  readonly skipEmpty?: boolean | undefined;
  readonly stopOnError?: boolean | undefined;
}>($I`ProcessFileOptions`)(
  {
    maxLines: S.optionalKey(PositiveInteger),
    skipEmpty: S.optionalKey(S.Boolean),
    stopOnError: S.optionalKey(S.Boolean).annotateKey({
      description:
        "Reserved for future custom stages. The built-in transform stages are total and never fail, so this option currently has no effect.",
    }),
  },
  $I.annote("ProcessFileOptions", { description: "Optional controls for running a line-transform pipeline." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("ProcessFileOptions", { description: "Optional controls for running a line-transform pipeline." })
  );

/**
 * Type for {@link ProcessFileOptions}.
 *
 * @example
 * ```ts
 * import type { ProcessFileOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const pipeline: ProcessFileOptions = { skipEmpty: true }
 * console.log(pipeline.skipEmpty)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ProcessFileOptions = typeof ProcessFileOptions.Type;

const ProcessFileParameters = S.Class<{
  readonly options?: ProcessFileOptions | undefined;
  readonly path: string;
  readonly stages: unknown;
}>($I`ProcessFileParameters`)(
  {
    options: S.optionalKey(ProcessFileOptions),
    path: S.String.check(S.isMinLength(1)),
    stages: S.NonEmptyArray(PipelineStage),
  },
  $I.annote("ProcessFileParameters", { description: "Inputs for running a line-transform pipeline." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ProcessFileParameters", { description: "Inputs for running a line-transform pipeline." }));

/**
 * Optional controls for {@link FilterLines}.
 *
 * @example
 * ```ts
 * import { FilterLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = FilterLinesOptions.make({ invert: true })
 * console.log(options.invert)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const FilterLinesOptions = S.Class<{
  readonly caseInsensitive?: boolean | undefined;
  readonly invert?: boolean | undefined;
  readonly maxLines?: number | undefined;
}>($I`FilterLinesOptions`)(
  {
    caseInsensitive: S.optionalKey(S.Boolean),
    invert: S.optionalKey(S.Boolean),
    maxLines: S.optionalKey(PositiveInteger),
  },
  $I.annote("FilterLinesOptions", { description: "Optional controls for filtering lines by a regex pattern." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("FilterLinesOptions", { description: "Optional controls for filtering lines by a regex pattern." })
  );

/**
 * Type for {@link FilterLinesOptions}.
 *
 * @example
 * ```ts
 * import type { FilterLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const filtered: FilterLinesOptions = { invert: true }
 * console.log(filtered.invert)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type FilterLinesOptions = typeof FilterLinesOptions.Type;

const FilterLinesParameters = S.Class<{
  readonly options?: FilterLinesOptions | undefined;
  readonly path: string;
  readonly pattern: string;
}>($I`FilterLinesParameters`)(
  {
    options: S.optionalKey(FilterLinesOptions),
    path: S.String.check(S.isMinLength(1)),
    pattern: S.String.check(S.isMinLength(1)),
  },
  $I.annote("FilterLinesParameters", { description: "Inputs for filtering lines by a regex pattern." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("FilterLinesParameters", { description: "Inputs for filtering lines by a regex pattern." }));

/**
 * Optional controls for {@link ExtractMatches}.
 *
 * @example
 * ```ts
 * import { ExtractMatchesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = ExtractMatchesOptions.make({ fullLines: true })
 * console.log(options.fullLines)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ExtractMatchesOptions = S.Class<{
  readonly caseInsensitive?: boolean | undefined;
  readonly fullLines?: boolean | undefined;
  readonly maxMatches?: number | undefined;
}>($I`ExtractMatchesOptions`)(
  {
    caseInsensitive: S.optionalKey(S.Boolean),
    fullLines: S.optionalKey(S.Boolean),
    maxMatches: S.optionalKey(PositiveInteger),
  },
  $I.annote("ExtractMatchesOptions", { description: "Optional controls for extracting regex matches from a file." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("ExtractMatchesOptions", {
      description: "Optional controls for extracting regex matches from a file.",
    })
  );

/**
 * Type for {@link ExtractMatchesOptions}.
 *
 * @example
 * ```ts
 * import type { ExtractMatchesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const extracted: ExtractMatchesOptions = { fullLines: true }
 * console.log(extracted.fullLines)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ExtractMatchesOptions = typeof ExtractMatchesOptions.Type;

const ExtractMatchesParameters = S.Class<{
  readonly options?: ExtractMatchesOptions | undefined;
  readonly path: string;
  readonly pattern: string;
}>($I`ExtractMatchesParameters`)(
  {
    options: S.optionalKey(ExtractMatchesOptions),
    path: S.String.check(S.isMinLength(1)),
    pattern: S.String.check(S.isMinLength(1)),
  },
  $I.annote("ExtractMatchesParameters", { description: "Inputs for extracting regex matches from a file." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("ExtractMatchesParameters", { description: "Inputs for extracting regex matches from a file." })
  );

/**
 * Optional controls for {@link CountLines}.
 *
 * @example
 * ```ts
 * import { CountLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = CountLinesOptions.make({ skipEmpty: true })
 * console.log(options.skipEmpty)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const CountLinesOptions = S.Class<{
  readonly skipEmpty?: boolean | undefined;
}>($I`CountLinesOptions`)(
  {
    skipEmpty: S.optionalKey(S.Boolean),
  },
  $I.annote("CountLinesOptions", { description: "Optional controls for counting lines in a file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("CountLinesOptions", { description: "Optional controls for counting lines in a file." }));

/**
 * Type for {@link CountLinesOptions}.
 *
 * @example
 * ```ts
 * import type { CountLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const counted: CountLinesOptions = { skipEmpty: true }
 * console.log(counted.skipEmpty)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type CountLinesOptions = typeof CountLinesOptions.Type;

const CountLinesParameters = S.Class<{
  readonly options?: CountLinesOptions | undefined;
  readonly path: string;
}>($I`CountLinesParameters`)(
  {
    options: S.optionalKey(CountLinesOptions),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("CountLinesParameters", { description: "Inputs for counting lines in a file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("CountLinesParameters", { description: "Inputs for counting lines in a file." }));

/**
 * Optional controls for {@link CountJsonl}.
 *
 * @example
 * ```ts
 * import { CountJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const options = CountJsonlOptions.make({ skipInvalid: true })
 * console.log(options.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const CountJsonlOptions = S.Class<{
  readonly skipInvalid?: boolean | undefined;
}>($I`CountJsonlOptions`)(
  {
    skipInvalid: S.optionalKey(S.Boolean),
  },
  $I.annote("CountJsonlOptions", { description: "Optional controls for counting JSONL records in a file." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("CountJsonlOptions", { description: "Optional controls for counting JSONL records in a file." })
  );

/**
 * Type for {@link CountJsonlOptions}.
 *
 * @example
 * ```ts
 * import type { CountJsonlOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const counted: CountJsonlOptions = { skipInvalid: true }
 * console.log(counted.skipInvalid)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type CountJsonlOptions = typeof CountJsonlOptions.Type;

const CountJsonlParameters = S.Class<{
  readonly options?: CountJsonlOptions | undefined;
  readonly path: string;
}>($I`CountJsonlParameters`)(
  {
    options: S.optionalKey(CountJsonlOptions),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("CountJsonlParameters", { description: "Inputs for counting JSONL records in a file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("CountJsonlParameters", { description: "Inputs for counting JSONL records." }));

/**
 * Tool: read lines from a text file with optional head/tail windowing.
 *
 * @example
 * ```ts
 * import { ReadLines } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(ReadLines.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const ReadLines = annotateFourHints(
  Tool.make("stream_read_lines", {
    description:
      "Read lines from a text file. Memory efficient for large files. Supports head/tail windowing, skipping, and trimming.",
    failure: AiToolError,
    failureMode: "return",
    parameters: ReadLinesParameters,
    success: LinesOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: report whether a file exists plus its size and line count.
 *
 * @example
 * ```ts
 * import { FileInfo } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(FileInfo.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const FileInfo = annotateFourHints(
  Tool.make("stream_file_info", {
    description: "Get information about a text file: existence, byte size, and line count.",
    failure: AiToolError,
    failureMode: "return",
    parameters: FileInfoParameters,
    success: FileInfoOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: compute aggregate line-length and byte statistics for a file.
 *
 * @example
 * ```ts
 * import { TextStats } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(TextStats.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const TextStats = annotateFourHints(
  Tool.make("stream_text_stats", {
    description: "Compute detailed statistics about a text file: line counts, byte size, and line-length distribution.",
    failure: AiToolError,
    failureMode: "return",
    parameters: TextStatsParameters,
    success: TextStatsOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: sample random lines from a text file.
 *
 * @example
 * ```ts
 * import { SampleLines } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(SampleLines.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const SampleLines = annotateFourHints(
  Tool.make("stream_sample_lines", {
    description: "Sample random lines from a text file. Useful for building test or validation subsets.",
    failure: AiToolError,
    failureMode: "return",
    parameters: SampleLinesParameters,
    success: LinesOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: read JSONL/NDJSON records from a file.
 *
 * @example
 * ```ts
 * import { ReadJsonl } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(ReadJsonl.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const ReadJsonl = annotateFourHints(
  Tool.make("stream_read_jsonl", {
    description: "Read JSON Lines (JSONL/NDJSON) records from a file. Memory efficient and supports error collection.",
    failure: AiToolError,
    failureMode: "return",
    parameters: ReadJsonlParameters,
    success: JsonlOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: compute JSONL parse statistics for a file.
 *
 * @example
 * ```ts
 * import { JsonlStats } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(JsonlStats.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const JsonlStats = annotateFourHints(
  Tool.make("stream_jsonl_stats", {
    description: "Compute statistics about a JSONL file: total, success, error, and skipped line counts.",
    failure: AiToolError,
    failureMode: "return",
    parameters: JsonlStatsParameters,
    success: JsonlStatsOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: validate a JSONL file and collect parse errors.
 *
 * @example
 * ```ts
 * import { ValidateJsonl } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(ValidateJsonl.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const ValidateJsonl = annotateFourHints(
  Tool.make("stream_validate_jsonl", {
    description: "Validate a JSONL file, returning parsed records and collected parse errors.",
    failure: AiToolError,
    failureMode: "return",
    parameters: ValidateJsonlParameters,
    success: JsonlOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: sample random JSONL records from a file.
 *
 * @example
 * ```ts
 * import { SampleJsonl } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(SampleJsonl.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const SampleJsonl = annotateFourHints(
  Tool.make("stream_sample_jsonl", {
    description: "Sample random records from a JSONL file.",
    failure: AiToolError,
    failureMode: "return",
    parameters: SampleJsonlParameters,
    success: JsonlOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: load text from a local file or remote URL.
 *
 * @example
 * ```ts
 * import { LoadText } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(LoadText.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const LoadText = annotateFourHints(
  Tool.make("stream_load_text", {
    description: "Load text content from a local file or remote URL. Auto-detects the source type.",
    failure: AiToolError,
    failureMode: "return",
    parameters: LoadTextParameters,
    success: DataOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: load lines from a local file or remote URL.
 *
 * @example
 * ```ts
 * import { LoadLines } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(LoadLines.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const LoadLines = annotateFourHints(
  Tool.make("stream_load_lines", {
    description: "Load text as an array of lines from a local file or remote URL.",
    failure: AiToolError,
    failureMode: "return",
    parameters: LoadLinesParameters,
    success: DataOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: load JSONL records from a local file or remote URL.
 *
 * @example
 * ```ts
 * import { LoadJsonl } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(LoadJsonl.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const LoadJsonl = annotateFourHints(
  Tool.make("stream_load_jsonl", {
    description: "Load JSONL/NDJSON records from a local file or remote URL. Auto-detects the source type.",
    failure: AiToolError,
    failureMode: "return",
    parameters: LoadJsonlParameters,
    success: DataOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: load and parse JSON from a local file or remote URL.
 *
 * @example
 * ```ts
 * import { LoadJson } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(LoadJson.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const LoadJson = annotateFourHints(
  Tool.make("stream_load_json", {
    description: "Load and parse a JSON document from a local file or remote URL.",
    failure: AiToolError,
    failureMode: "return",
    parameters: LoadJsonParameters,
    success: DataOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: run a line-transform pipeline over a file.
 *
 * @example
 * ```ts
 * import { ProcessFile } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(ProcessFile.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const ProcessFile = annotateFourHints(
  Tool.make("stream_process_file", {
    description: "Run a line-transform pipeline over a file, applying ordered stages to each line.",
    failure: AiToolError,
    failureMode: "return",
    parameters: ProcessFileParameters,
    success: PipelineOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: filter file lines by a regex pattern.
 *
 * @example
 * ```ts
 * import { FilterLines } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(FilterLines.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const FilterLines = annotateFourHints(
  Tool.make("stream_filter_lines", {
    description: "Filter lines from a file that match a regex pattern, with optional inversion.",
    failure: AiToolError,
    failureMode: "return",
    parameters: FilterLinesParameters,
    success: LinesOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: extract regex matches from a file.
 *
 * @example
 * ```ts
 * import { ExtractMatches } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(ExtractMatches.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const ExtractMatches = annotateFourHints(
  Tool.make("stream_extract_matches", {
    description: "Extract regex matches from a file, returning matched substrings or full matching lines.",
    failure: AiToolError,
    failureMode: "return",
    parameters: ExtractMatchesParameters,
    success: LinesOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: count total lines in a file.
 *
 * @example
 * ```ts
 * import { CountLines } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(CountLines.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const CountLines = annotateFourHints(
  Tool.make("stream_count_lines", {
    description: "Count the total lines in a file. Memory efficient for large files.",
    failure: AiToolError,
    failureMode: "return",
    parameters: CountLinesParameters,
    success: CountOutput,
  }),
  readOnlyToolHints
);

/**
 * Tool: count valid JSONL records in a file.
 *
 * @example
 * ```ts
 * import { CountJsonl } from "@beep/nlp-mcp/StreamingTools"
 *
 * console.log(CountJsonl.name)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const CountJsonl = annotateFourHints(
  Tool.make("stream_count_jsonl", {
    description: "Count JSONL records in a file, optionally counting only valid records.",
    failure: AiToolError,
    failureMode: "return",
    parameters: CountJsonlParameters,
    success: CountWithErrorsOutput,
  }),
  readOnlyToolHints
);

/**
 * The complete streaming toolkit grouping all 17 streaming tools.
 *
 * @example
 * ```ts
 * import { StreamingToolkit } from "@beep/nlp-mcp/StreamingTools"
 *
 * const names = Object.keys(StreamingToolkit.tools)
 * console.log(names.length)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export const StreamingToolkit = Toolkit.make(
  ReadLines,
  FileInfo,
  TextStats,
  SampleLines,
  ReadJsonl,
  JsonlStats,
  ValidateJsonl,
  SampleJsonl,
  LoadText,
  LoadLines,
  LoadJsonl,
  LoadJson,
  ProcessFile,
  FilterLines,
  ExtractMatches,
  CountLines,
  CountJsonl
);

/**
 * Type of the {@link StreamingToolkit}.
 *
 * @example
 * ```ts
 * import { StreamingToolkit } from "@beep/nlp-mcp/StreamingTools"
 * import type { StreamingToolkit as StreamingToolkitType } from "@beep/nlp-mcp/StreamingTools"
 *
 * const toolkit: StreamingToolkitType = StreamingToolkit
 * console.log(toolkit.tools)
 * ```
 *
 * @since 0.0.0
 * @category tools
 */
export type StreamingToolkit = typeof StreamingToolkit;
