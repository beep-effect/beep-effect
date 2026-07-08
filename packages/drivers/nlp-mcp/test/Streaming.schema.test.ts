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
  DataOutput,
  DatasetMetaOutput,
  FileInfoOutput,
  JsonlOutput,
  JsonlStatsOutput,
  LinesOutput,
  PipelineOutput,
  TextStatsOutput,
} from "@beep/nlp-mcp/StreamingTools";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const encode = <Sch extends S.Top & S.ConstraintEncoder<unknown>>(schema: Sch, value: Sch["Type"]): Sch["Encoded"] =>
  Result.getOrThrow(S.encodeUnknownResult(schema)(value));

const decode = <Sch extends S.Top & S.ConstraintDecoder<unknown>>(schema: Sch, value: Sch["Encoded"]): Sch["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const assertRoundTrip = <Sch extends S.Top & S.ConstraintDecoder<unknown> & S.ConstraintEncoder<unknown>>(
  schema: Sch
): void =>
  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      expect(Eq.equals(decode(schema, encode(schema, value)), value)).toBe(true);
    }),
    fcRuns(25)
  );

describe("streaming schema laws", () => {
  it("round-trips defaulted option schemas", () => {
    assertRoundTrip(TextReadOptions);
    assertRoundTrip(TextStreamOptions);
    assertRoundTrip(DatasetLoadTextOptions);
    assertRoundTrip(DatasetLoadLinesOptions);
    assertRoundTrip(DatasetLoadJsonlOptions);
    assertRoundTrip(DatasetLoadJsonOptions);
    assertRoundTrip(JsonlReadOptions);
    assertRoundTrip(PipelineProcessOptions);
  });

  it("round-trips integer-refined result schemas", () => {
    assertRoundTrip(TextStreamStats);
    assertRoundTrip(JsonlLineError);
    assertRoundTrip(JsonlStats);
    assertRoundTrip(JsonlValidationResult);
    assertRoundTrip(S.String.pipe(DatasetResult));
    assertRoundTrip(PipelineResult);
    assertRoundTrip(LinesOutput);
    assertRoundTrip(FileInfoOutput);
    assertRoundTrip(TextStatsOutput);
    assertRoundTrip(JsonlOutput);
    assertRoundTrip(JsonlStatsOutput);
    assertRoundTrip(DatasetMetaOutput);
    assertRoundTrip(DataOutput);
    assertRoundTrip(PipelineOutput);
  });

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
});
