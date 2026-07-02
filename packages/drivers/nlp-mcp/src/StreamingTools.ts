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
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import { DatasetMeta } from "./Streaming/DatasetLoader.ts";
import { JsonlLineError, JsonlStats as JsonlStatsModel } from "./Streaming/Jsonl.ts";
import { PipelineError, PipelineResult, PipelineStage } from "./Streaming/Pipeline.ts";
import { TextEncoding, TextStreamStats } from "./Streaming/TextStream.ts";

const $I = $NlpMcpId.create("StreamingTools");

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
    count: S.Finite.annotateKey({
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
    })
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
    lineCount: S.optionalKey(S.Finite).annotateKey({
      description: "Total line count when the file exists.",
    }),
    sizeBytes: S.optionalKey(S.Finite).annotateKey({
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
    })
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
  })
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
    count: S.Finite.annotateKey({
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
    })
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
  })
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
  })
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
    })
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
  })
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
    count: S.Finite.annotateKey({
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
    count: S.Finite.annotateKey({
      description: "Computed count.",
    }),
    errors: S.optionalKey(S.Finite).annotateKey({
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

const ReadLinesParameters = S.Class<{ readonly options?: unknown; readonly path: string }>($I`ReadLinesParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        encoding: S.optionalKey(TextEncoding),
        maxLines: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        skip: S.optionalKey(S.Finite.check(S.isGreaterThanOrEqualTo(0))),
        skipEmpty: S.optionalKey(S.Boolean),
        tail: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        trim: S.optionalKey(S.Boolean),
      })
    ),
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

const TextStatsParameters = S.Class<{ readonly options?: unknown; readonly path: string }>($I`TextStatsParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        skipEmpty: S.optionalKey(S.Boolean),
        trim: S.optionalKey(S.Boolean),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("TextStatsParameters", { description: "Inputs for computing text statistics." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("TextStatsParameters", { description: "Inputs for computing text statistics." }));

const SampleLinesParameters = S.Class<{
  readonly options?: unknown;
  readonly path: string;
  readonly sampleSize: number;
}>($I`SampleLinesParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        skipEmpty: S.optionalKey(S.Boolean),
        trim: S.optionalKey(S.Boolean),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
    sampleSize: S.Finite.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(10_000)),
  },
  $I.annote("SampleLinesParameters", { description: "Inputs for randomly sampling text lines." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("SampleLinesParameters", { description: "Inputs for randomly sampling text lines." }));

const ReadJsonlParameters = S.Class<{ readonly options?: unknown; readonly path: string }>($I`ReadJsonlParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        collectErrors: S.optionalKey(S.Boolean),
        maxRecords: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        skipInvalid: S.optionalKey(S.Boolean),
      })
    ),
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

const ValidateJsonlParameters = S.Class<{ readonly options?: unknown; readonly path: string }>(
  $I`ValidateJsonlParameters`
)(
  {
    options: S.optionalKey(
      S.Struct({
        maxErrors: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        maxRecords: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("ValidateJsonlParameters", { description: "Inputs for validating a JSONL file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ValidateJsonlParameters", { description: "Inputs for validating a JSONL file." }));

const SampleJsonlParameters = S.Class<{
  readonly options?: unknown;
  readonly path: string;
  readonly sampleSize: number;
}>($I`SampleJsonlParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        skipInvalid: S.optionalKey(S.Boolean),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
    sampleSize: S.Finite.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(10_000)),
  },
  $I.annote("SampleJsonlParameters", { description: "Inputs for randomly sampling JSONL records." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("SampleJsonlParameters", { description: "Inputs for randomly sampling JSONL records." }));

const LoadTextParameters = S.Class<{ readonly location: string; readonly options?: unknown }>($I`LoadTextParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(
      S.Struct({
        encoding: S.optionalKey(TextEncoding),
        timeout: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
      })
    ),
  },
  $I.annote("LoadTextParameters", { description: "Inputs for loading text from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadTextParameters", { description: "Inputs for loading text from a file or URL." }));

const LoadLinesParameters = S.Class<{ readonly location: string; readonly options?: unknown }>($I`LoadLinesParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(
      S.Struct({
        maxLines: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        skipEmpty: S.optionalKey(S.Boolean),
        timeout: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        trim: S.optionalKey(S.Boolean),
      })
    ),
  },
  $I.annote("LoadLinesParameters", { description: "Inputs for loading lines from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadLinesParameters", { description: "Inputs for loading lines from a file or URL." }));

const LoadJsonlParameters = S.Class<{ readonly location: string; readonly options?: unknown }>($I`LoadJsonlParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(
      S.Struct({
        maxRecords: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        skipInvalid: S.optionalKey(S.Boolean),
        timeout: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
      })
    ),
  },
  $I.annote("LoadJsonlParameters", { description: "Inputs for loading JSONL from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadJsonlParameters", { description: "Inputs for loading JSONL from a file or URL." }));

const LoadJsonParameters = S.Class<{ readonly location: string; readonly options?: unknown }>($I`LoadJsonParameters`)(
  {
    location: S.String.check(S.isMinLength(1)),
    options: S.optionalKey(
      S.Struct({
        timeout: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
      })
    ),
  },
  $I.annote("LoadJsonParameters", { description: "Inputs for loading JSON from a file or URL." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("LoadJsonParameters", { description: "Inputs for loading JSON from a file or URL." }));

const ProcessFileParameters = S.Class<{ readonly options?: unknown; readonly path: string; readonly stages: unknown }>(
  $I`ProcessFileParameters`
)(
  {
    options: S.optionalKey(
      S.Struct({
        maxLines: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
        skipEmpty: S.optionalKey(S.Boolean),
        stopOnError: S.optionalKey(S.Boolean).annotateKey({
          description:
            "Reserved for future custom stages. The built-in transform stages are total and never fail, so this option currently has no effect.",
        }),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
    stages: S.NonEmptyArray(PipelineStage),
  },
  $I.annote("ProcessFileParameters", { description: "Inputs for running a line-transform pipeline." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("ProcessFileParameters", { description: "Inputs for running a line-transform pipeline." }));

const FilterLinesParameters = S.Class<{ readonly options?: unknown; readonly path: string; readonly pattern: string }>(
  $I`FilterLinesParameters`
)(
  {
    options: S.optionalKey(
      S.Struct({
        caseInsensitive: S.optionalKey(S.Boolean),
        invert: S.optionalKey(S.Boolean),
        maxLines: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
    pattern: S.String.check(S.isMinLength(1)),
  },
  $I.annote("FilterLinesParameters", { description: "Inputs for filtering lines by a regex pattern." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("FilterLinesParameters", { description: "Inputs for filtering lines by a regex pattern." }));

const ExtractMatchesParameters = S.Class<{
  readonly options?: unknown;
  readonly path: string;
  readonly pattern: string;
}>($I`ExtractMatchesParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        caseInsensitive: S.optionalKey(S.Boolean),
        fullLines: S.optionalKey(S.Boolean),
        maxMatches: S.optionalKey(S.Finite.check(S.isGreaterThan(0))),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
    pattern: S.String.check(S.isMinLength(1)),
  },
  $I.annote("ExtractMatchesParameters", { description: "Inputs for extracting regex matches from a file." })
)
  .mapFields((fields) => fields)
  .pipe(
    $I.annoteSchema("ExtractMatchesParameters", { description: "Inputs for extracting regex matches from a file." })
  );

const CountLinesParameters = S.Class<{ readonly options?: unknown; readonly path: string }>($I`CountLinesParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        skipEmpty: S.optionalKey(S.Boolean),
      })
    ),
    path: S.String.check(S.isMinLength(1)),
  },
  $I.annote("CountLinesParameters", { description: "Inputs for counting lines in a file." })
)
  .mapFields((fields) => fields)
  .pipe($I.annoteSchema("CountLinesParameters", { description: "Inputs for counting lines in a file." }));

const CountJsonlParameters = S.Class<{ readonly options?: unknown; readonly path: string }>($I`CountJsonlParameters`)(
  {
    options: S.optionalKey(
      S.Struct({
        skipInvalid: S.optionalKey(S.Boolean),
      })
    ),
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
