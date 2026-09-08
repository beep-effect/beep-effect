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
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
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
      Result.getOrThrow(PatchOpSummary.encodeResult(ReplacePatchOpSummary.make({ path: "/children/0/text" })))
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

  it("round-trips touched schemas with schema-derived arbitraries", () => {
    const schemas: ReadonlyArray<S.Codec<unknown>> = [
      MermaidDiagramType,
      ScanState,
      ScanChunkInput,
      ScanChunkResult,
      IssueReport,
      PatchOpSummary,
    ];

    for (const schema of schemas) {
      fc.assert(
        fc.property(S.toArbitrary(schema)(fc), (value) => roundTrip(schema, value)),
        fcRuns(25)
      );
    }
  });
});
