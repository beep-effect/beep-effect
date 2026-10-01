import {
  IssueReport,
  initialScanState,
  MermaidDiagramType,
  PatchOpSummary,
  ReplacePatchOpSummary,
  ScanChunkInput,
  ScanChunkResult,
  ScanState,
  scanChunk,
} from "@beep/agents-server/AssistantTurn";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";

const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"], label: string): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value), label).toBe(true);
};

describe("@beep/agents-server schema parity", () => {
  it("keeps touched encoded shapes stable", () => {
    expect(Result.getOrThrow(ScanState.encodeResult(initialScanState))).toStrictEqual({
      current: "",
      depth: 0,
      escaped: false,
      inBlocksArray: false,
      inString: false,
    });

    const issue = IssueReport.make({
      index: 0,
      raw: '{"type":"paragraph"}',
      report: "children is missing",
    });
    expect(Result.getOrThrow(IssueReport.encodeResult(issue))).toStrictEqual({
      index: 0,
      raw: '{"type":"paragraph"}',
      report: "children is missing",
    });

    expect(
      Result.getOrThrow(S.encodeResult(PatchOpSummary)(ReplacePatchOpSummary.make({ path: "/children/0/text" })))
    ).toStrictEqual({
      path: "/children/0/text",
      op: "replace",
    });

    const [next, completed] = scanChunk(initialScanState, '{"blocks":[{"type":"paragraph"}]}');
    expect(next).toStrictEqual({
      current: "",
      depth: 0,
      escaped: false,
      inBlocksArray: true,
      inString: false,
    });
    expect(completed).toStrictEqual(['{"type":"paragraph"}']);
  });

  it.effect.prop(
    "round-trips touched schemas with schema-derived arbitraries",
    {
      MermaidDiagramType: Arbitrary.schema(MermaidDiagramType),
      ScanState: Arbitrary.schema(ScanState),
      ScanChunkInput: Arbitrary.schema(ScanChunkInput),
      ScanChunkResult: Arbitrary.schema(ScanChunkResult),
      IssueReport: Arbitrary.schema(IssueReport),
      PatchOpSummary: Arbitrary.schema(PatchOpSummary),
    },
    (values) =>
      Effect.sync(() => {
        roundTrip(MermaidDiagramType, values.MermaidDiagramType, "MermaidDiagramType");
        roundTrip(ScanState, values.ScanState, "ScanState");
        roundTrip(ScanChunkInput, values.ScanChunkInput, "ScanChunkInput");
        roundTrip(ScanChunkResult, values.ScanChunkResult, "ScanChunkResult");
        roundTrip(IssueReport, values.IssueReport, "IssueReport");
        roundTrip(PatchOpSummary, values.PatchOpSummary, "PatchOpSummary");
      }),
    { arbitrary: fcRuns(25) }
  );
});
