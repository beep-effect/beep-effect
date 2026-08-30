import {
  AgentEffectivenessAiMetricsSection,
  AgentEffectivenessAnnotationCheckFindingCode,
  AgentEffectivenessAnnotationOptimization,
  AgentEffectivenessAnnotationSource,
  AgentEffectivenessAnnotationTargetKind,
  AgentEffectivenessDatasetBundle,
} from "@beep/repo-ai-metrics/agent-effectiveness";
import { fcRuns } from "@beep/test-utils";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const encodeAiMetricsSection = S.encodeUnknownResult(AgentEffectivenessAiMetricsSection);
const decodeAiMetricsSection = S.decodeUnknownResult(AgentEffectivenessAiMetricsSection);
const encodeDatasetBundle = S.encodeUnknownResult(AgentEffectivenessDatasetBundle);
const decodeDatasetBundle = S.decodeUnknownResult(AgentEffectivenessDatasetBundle);
const isOptimization = S.is(AgentEffectivenessAnnotationOptimization);
const isSource = S.is(AgentEffectivenessAnnotationSource);
const isTargetKind = S.is(AgentEffectivenessAnnotationTargetKind);
const isFindingCode = S.is(AgentEffectivenessAnnotationCheckFindingCode);

describe("agent-effectiveness schema laws", () => {
  it("generates only members of the annotation optimization domain", () =>
    fc.assert(
      fc.property(S.toArbitrary(AgentEffectivenessAnnotationOptimization)(fc), (value) => isOptimization(value)),
      fcRuns(25)
    ));

  it("keeps required null wire fields while decoding absence to Option", () => {
    const section = AgentEffectivenessAiMetricsSection.make({
      benchmarkRunCount: 0,
      dataRoot: "/tmp/ai-metrics",
      derivedDuckDbPath: "/tmp/ai-metrics/derived/ai-metrics.duckdb",
      labelCount: 0,
      message: "No derived evidence.",
      sourceCoverage: [],
      status: "unavailable",
      unavailableMetrics: [],
    });

    const encoded = Result.getOrThrow(encodeAiMetricsSection(section));
    expect(encoded.latestForwarder).toBeNull();
    expect(encoded.latestScorecard).toBeNull();

    const decoded = Result.getOrThrow(decodeAiMetricsSection(encoded));
    expect(O.isNone(decoded.latestForwarder)).toBe(true);
    expect(O.isNone(decoded.latestScorecard)).toBe(true);
  });

  it("owns finite annotation vocabularies on their schemas", () => {
    expect(isOptimization("maximize")).toBe(true);
    expect(isOptimization("increase")).toBe(false);
    expect(isSource("ai-metrics")).toBe(true);
    expect(isSource("external-provider")).toBe(false);
    expect(isTargetKind("agent-task")).toBe(true);
    expect(isTargetKind("span")).toBe(false);
    expect(isFindingCode("plan-encode-failed")).toBe(true);
    expect(isFindingCode("unknown-finding")).toBe(false);
  });

  it("defaults and validates the dataset artifact version", () => {
    const bundle = AgentEffectivenessDatasetBundle.make({
      datasets: [],
      generatedAt: "2026-08-24T00:00:00.000Z",
      projectName: "beep-agent-effectiveness",
    });
    const encoded = Result.getOrThrow(encodeDatasetBundle(bundle));

    expect(encoded.schemaVersion).toBe("agent-effectiveness-datasets/v1");
    expect(
      Result.isFailure(decodeDatasetBundle({ ...encoded, schemaVersion: "agent-effectiveness-datasets/v2" }))
    ).toBe(true);
  });
});
