import {
  AgentEffectivenessAiMetricsSection,
  AgentEffectivenessAnnotationCheckFindingCode,
  AgentEffectivenessAnnotationOptimization,
  AgentEffectivenessAnnotationSource,
  AgentEffectivenessAnnotationTargetKind,
  AgentEffectivenessDatasetBundle,
} from "@beep/repo-ai-metrics/agent-effectiveness";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

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
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(AgentEffectivenessAnnotationOptimization)]),
          ([value]) => isOptimization(value),
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed"));

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
    assertNone(decoded.latestForwarder);
    assertNone(decoded.latestScorecard);
  });

  it("owns finite annotation vocabularies on their schemas", () => {
    pipe(isOptimization("maximize"), assertTrue);
    pipe(isOptimization("increase"), assertFalse);
    pipe(isSource("ai-metrics"), assertTrue);
    pipe(isSource("external-provider"), assertFalse);
    pipe(isTargetKind("agent-task"), assertTrue);
    pipe(isTargetKind("span"), assertFalse);
    pipe(isFindingCode("plan-encode-failed"), assertTrue);
    pipe(isFindingCode("unknown-finding"), assertFalse);
  });

  it("defaults and validates the dataset artifact version", () => {
    const bundle = AgentEffectivenessDatasetBundle.make({
      datasets: [],
      generatedAt: "2026-08-24T00:00:00.000Z",
      projectName: "beep-agent-effectiveness",
    });
    const encoded = Result.getOrThrow(encodeDatasetBundle(bundle));

    expect(encoded.schemaVersion).toBe("agent-effectiveness-datasets/v1");
    pipe(
      decodeDatasetBundle({ ...encoded, schemaVersion: "agent-effectiveness-datasets/v2" }),
      Result.isFailure,
      assertTrue
    );
  });
});
