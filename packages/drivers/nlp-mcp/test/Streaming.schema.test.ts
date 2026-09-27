import {
  DatasetLoadError,
  DatasetLoadJsonlOptions,
  DatasetLoadJsonOptions,
  DatasetLoadLinesOptions,
  DatasetLoadTextOptions,
  DatasetMeta,
  DatasetResult,
} from "@beep/nlp-mcp/Streaming/DatasetLoader";
import { JsonlLineError, JsonlReadOptions, JsonlStats, JsonlValidationResult } from "@beep/nlp-mcp/Streaming/Jsonl";
import { PipelineProcessOptions, PipelineResult } from "@beep/nlp-mcp/Streaming/Pipeline";
import { TextReadOptions, TextStreamOptions, TextStreamStats } from "@beep/nlp-mcp/Streaming/TextStream";
import {
  CountJsonlOptions,
  CountLinesOptions,
  DataOutput,
  DatasetMetaOutput,
  ExtractMatchesOptions,
  FileInfoOutput,
  FilterLinesOptions,
  JsonlOutput,
  JsonlStatsOutput,
  LinesOutput,
  LoadJsonlOptions,
  LoadJsonOptions,
  LoadLinesOptions,
  LoadTextOptions,
  PipelineOutput,
  ProcessFileOptions,
  ReadJsonlOptions,
  ReadLinesOptions,
  SampleJsonlOptions,
  SampleLinesOptions,
  TextStatsOptions,
  TextStatsOutput,
  ValidateJsonlOptions,
} from "@beep/nlp-mcp/StreamingTools";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const StringDatasetResult = S.String.pipe(DatasetResult);

const encode = <Sch extends S.Top & S.ConstraintEncoder<unknown>>(schema: Sch, value: Sch["Type"]): Sch["Encoded"] =>
  Result.getOrThrow(S.encodeUnknownResult(schema)(value));

const decode = <Sch extends S.Top & S.ConstraintDecoder<unknown>>(schema: Sch, value: Sch["Encoded"]): Sch["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const assertRoundTrip = <Sch extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>>(
  schema: Sch,
  value: Sch["Type"]
): void => {
  expect(Eq.equals(decode(schema, encode(schema, value)), value)).toBe(true);
};

describe("streaming schema laws", () => {
  it.prop(
    "round-trips defaulted option schemas",
    {
      textReadOptions: Arbitrary.schema(TextReadOptions),
      textStreamOptions: Arbitrary.schema(TextStreamOptions),
      datasetLoadTextOptions: Arbitrary.schema(DatasetLoadTextOptions),
      datasetLoadLinesOptions: Arbitrary.schema(DatasetLoadLinesOptions),
      datasetLoadJsonlOptions: Arbitrary.schema(DatasetLoadJsonlOptions),
      datasetLoadJsonOptions: Arbitrary.schema(DatasetLoadJsonOptions),
      jsonlReadOptions: Arbitrary.schema(JsonlReadOptions),
      pipelineProcessOptions: Arbitrary.schema(PipelineProcessOptions),
    },
    ({
      textReadOptions,
      textStreamOptions,
      datasetLoadTextOptions,
      datasetLoadLinesOptions,
      datasetLoadJsonlOptions,
      datasetLoadJsonOptions,
      jsonlReadOptions,
      pipelineProcessOptions,
    }) => {
      assertRoundTrip(TextReadOptions, textReadOptions);
      assertRoundTrip(TextStreamOptions, textStreamOptions);
      assertRoundTrip(DatasetLoadTextOptions, datasetLoadTextOptions);
      assertRoundTrip(DatasetLoadLinesOptions, datasetLoadLinesOptions);
      assertRoundTrip(DatasetLoadJsonlOptions, datasetLoadJsonlOptions);
      assertRoundTrip(DatasetLoadJsonOptions, datasetLoadJsonOptions);
      assertRoundTrip(JsonlReadOptions, jsonlReadOptions);
      assertRoundTrip(PipelineProcessOptions, pipelineProcessOptions);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips integer-refined result schemas",
    {
      textStreamStats: Arbitrary.schema(TextStreamStats),
      jsonlLineError: Arbitrary.schema(JsonlLineError),
      jsonlStats: Arbitrary.schema(JsonlStats),
      jsonlValidationResult: Arbitrary.schema(JsonlValidationResult),
      stringDatasetResult: Arbitrary.schema(StringDatasetResult),
      pipelineResult: Arbitrary.schema(PipelineResult),
      linesOutput: Arbitrary.schema(LinesOutput),
      fileInfoOutput: Arbitrary.schema(FileInfoOutput),
      textStatsOutput: Arbitrary.schema(TextStatsOutput),
      jsonlOutput: Arbitrary.schema(JsonlOutput),
      jsonlStatsOutput: Arbitrary.schema(JsonlStatsOutput),
      datasetMetaOutput: Arbitrary.schema(DatasetMetaOutput),
      dataOutput: Arbitrary.schema(DataOutput),
      pipelineOutput: Arbitrary.schema(PipelineOutput),
    },
    ({
      textStreamStats,
      jsonlLineError,
      jsonlStats,
      jsonlValidationResult,
      stringDatasetResult,
      pipelineResult,
      linesOutput,
      fileInfoOutput,
      textStatsOutput,
      jsonlOutput,
      jsonlStatsOutput,
      datasetMetaOutput,
      dataOutput,
      pipelineOutput,
    }) => {
      assertRoundTrip(TextStreamStats, textStreamStats);
      assertRoundTrip(JsonlLineError, jsonlLineError);
      assertRoundTrip(JsonlStats, jsonlStats);
      assertRoundTrip(JsonlValidationResult, jsonlValidationResult);
      assertRoundTrip(StringDatasetResult, stringDatasetResult);
      assertRoundTrip(PipelineResult, pipelineResult);
      assertRoundTrip(LinesOutput, linesOutput);
      assertRoundTrip(FileInfoOutput, fileInfoOutput);
      assertRoundTrip(TextStatsOutput, textStatsOutput);
      assertRoundTrip(JsonlOutput, jsonlOutput);
      assertRoundTrip(JsonlStatsOutput, jsonlStatsOutput);
      assertRoundTrip(DatasetMetaOutput, datasetMetaOutput);
      assertRoundTrip(DataOutput, dataOutput);
      assertRoundTrip(PipelineOutput, pipelineOutput);
    },
    { arbitrary: fcRuns(25) }
  );

  it("keeps optional metadata wire shape byte-identical", () => {
    const withoutSize = DatasetMeta.make({
      format: "text",
      loadedAt: 0,
      location: "/tmp/data.txt",
      sourceType: "file",
    });
    const withSize = DatasetMeta.make({
      format: "text",
      loadedAt: 0,
      location: "/tmp/data.txt",
      sizeBytes: O.some(12),
      sourceType: "file",
    });

    expect(encode(DatasetMeta, withoutSize)).toEqual({
      format: "text",
      loadedAt: 0,
      location: "/tmp/data.txt",
      sourceType: "file",
    });
    expect(encode(DatasetMeta, withSize)).toEqual({
      format: "text",
      loadedAt: 0,
      location: "/tmp/data.txt",
      sizeBytes: 12,
      sourceType: "file",
    });
    expect(Eq.equals(decode(DatasetMeta, encode(DatasetMeta, withSize)), withSize)).toBe(true);
  });

  it("keeps optional error cause wire shape byte-identical", () => {
    const error = DatasetLoadError.make({
      location: "https://example.com/data.json",
      message: "failed",
    });

    expect(encode(DatasetLoadError, error)).toEqual({
      _tag: "DatasetLoadError",
      location: "https://example.com/data.json",
      message: "failed",
    });
  });

  it.prop(
    "round-trips tool-parameter option schemas extracted from inline S.Struct (RC-SF)",
    {
      readLinesOptions: Arbitrary.schema(ReadLinesOptions),
      textStatsOptions: Arbitrary.schema(TextStatsOptions),
      sampleLinesOptions: Arbitrary.schema(SampleLinesOptions),
      readJsonlOptions: Arbitrary.schema(ReadJsonlOptions),
      validateJsonlOptions: Arbitrary.schema(ValidateJsonlOptions),
      sampleJsonlOptions: Arbitrary.schema(SampleJsonlOptions),
      loadTextOptions: Arbitrary.schema(LoadTextOptions),
      loadLinesOptions: Arbitrary.schema(LoadLinesOptions),
      loadJsonlOptions: Arbitrary.schema(LoadJsonlOptions),
      loadJsonOptions: Arbitrary.schema(LoadJsonOptions),
      processFileOptions: Arbitrary.schema(ProcessFileOptions),
      filterLinesOptions: Arbitrary.schema(FilterLinesOptions),
      extractMatchesOptions: Arbitrary.schema(ExtractMatchesOptions),
      countLinesOptions: Arbitrary.schema(CountLinesOptions),
      countJsonlOptions: Arbitrary.schema(CountJsonlOptions),
    },
    ({
      readLinesOptions,
      textStatsOptions,
      sampleLinesOptions,
      readJsonlOptions,
      validateJsonlOptions,
      sampleJsonlOptions,
      loadTextOptions,
      loadLinesOptions,
      loadJsonlOptions,
      loadJsonOptions,
      processFileOptions,
      filterLinesOptions,
      extractMatchesOptions,
      countLinesOptions,
      countJsonlOptions,
    }) => {
      assertRoundTrip(ReadLinesOptions, readLinesOptions);
      assertRoundTrip(TextStatsOptions, textStatsOptions);
      assertRoundTrip(SampleLinesOptions, sampleLinesOptions);
      assertRoundTrip(ReadJsonlOptions, readJsonlOptions);
      assertRoundTrip(ValidateJsonlOptions, validateJsonlOptions);
      assertRoundTrip(SampleJsonlOptions, sampleJsonlOptions);
      assertRoundTrip(LoadTextOptions, loadTextOptions);
      assertRoundTrip(LoadLinesOptions, loadLinesOptions);
      assertRoundTrip(LoadJsonlOptions, loadJsonlOptions);
      assertRoundTrip(LoadJsonOptions, loadJsonOptions);
      assertRoundTrip(ProcessFileOptions, processFileOptions);
      assertRoundTrip(FilterLinesOptions, filterLinesOptions);
      assertRoundTrip(ExtractMatchesOptions, extractMatchesOptions);
      assertRoundTrip(CountLinesOptions, countLinesOptions);
      assertRoundTrip(CountJsonlOptions, countJsonlOptions);
    },
    { arbitrary: fcRuns(25) }
  );

  it("keeps extracted tool-parameter option wire shape byte-identical to the prior inline S.Struct", () => {
    // Every field stayed S.optionalKey with no default: an empty call still
    // encodes to `{}` (no keys materialize), exactly as the inline S.Struct did.
    expect(encode(ReadLinesOptions, ReadLinesOptions.make({}))).toEqual({});
    expect(encode(ProcessFileOptions, ProcessFileOptions.make({}))).toEqual({});

    expect(
      encode(
        ReadLinesOptions,
        ReadLinesOptions.make({ encoding: "utf-8", maxLines: 10, skip: 2, skipEmpty: true, tail: 5, trim: true })
      )
    ).toEqual({ encoding: "utf-8", maxLines: 10, skip: 2, skipEmpty: true, tail: 5, trim: true });

    expect(encode(ValidateJsonlOptions, ValidateJsonlOptions.make({ maxErrors: 1, maxRecords: 2 }))).toEqual({
      maxErrors: 1,
      maxRecords: 2,
    });

    expect(
      encode(ProcessFileOptions, ProcessFileOptions.make({ maxLines: 3, skipEmpty: true, stopOnError: false }))
    ).toEqual({ maxLines: 3, skipEmpty: true, stopOnError: false });
  });
});
