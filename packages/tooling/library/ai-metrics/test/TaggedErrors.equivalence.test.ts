import {
  AgentEffectivenessError,
  AiMetricsArchiveError,
  AiMetricsConfigSnapshotError,
  AiMetricsDataRootError,
  AiMetricsDerivedStorageError,
  AiMetricsFileInventoryError,
  AiMetricsForwarderError,
  AiMetricsIdentityRegistryError,
  AiMetricsIngestError,
  AiMetricsInstallConfigurationError,
  AiMetricsMirrorError,
  AiMetricsOtlpExportError,
  AiMetricsPrivacyError,
  AiMetricsRetentionError,
  AiMetricsScorecardError,
  AiMetricsSourceDiscoveryError,
} from "@beep/repo-ai-metrics";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(schema: S.Schema<A>, a: A, b: A, different: A, differentCause: A): void => {
  const same = S.toEquivalence(schema);

  expect(same(a, b)).toBe(true);
  expect(same(a, different)).toBe(false);
  expect(same(a, differentCause)).toBe(true);
};

describe("AI metrics declared-field equivalence", () => {
  it("compares AgentEffectivenessError by stable fields and ignores cause", () => {
    const a = AgentEffectivenessError.make({ cause: "same cause", message: "same message" });
    const b = AgentEffectivenessError.make({ cause: "same cause", message: "same message" });
    const different = AgentEffectivenessError.make({ cause: "same cause", message: "different message" });
    const differentCause = AgentEffectivenessError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AgentEffectivenessError, a, b, different, differentCause);
  });

  it("compares AiMetricsArchiveError by stable fields and ignores cause", () => {
    const a = AiMetricsArchiveError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsArchiveError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsArchiveError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsArchiveError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsArchiveError, a, b, different, differentCause);
  });

  it("compares AiMetricsConfigSnapshotError by stable fields and ignores cause", () => {
    const a = AiMetricsConfigSnapshotError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsConfigSnapshotError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsConfigSnapshotError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsConfigSnapshotError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsConfigSnapshotError, a, b, different, differentCause);
  });

  it("compares AiMetricsDataRootError by stable fields and ignores cause", () => {
    const a = AiMetricsDataRootError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsDataRootError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsDataRootError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsDataRootError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsDataRootError, a, b, different, differentCause);
  });

  it("compares AiMetricsDerivedStorageError by stable fields and ignores cause", () => {
    const a = AiMetricsDerivedStorageError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsDerivedStorageError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsDerivedStorageError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsDerivedStorageError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsDerivedStorageError, a, b, different, differentCause);
  });

  it("compares AiMetricsFileInventoryError by operation and ignores cause", () => {
    const a = AiMetricsFileInventoryError.make({ cause: "same cause", operation: "inspect" });
    const b = AiMetricsFileInventoryError.make({ cause: "same cause", operation: "inspect" });
    const different = AiMetricsFileInventoryError.make({ cause: "same cause", operation: "read" });
    const differentCause = AiMetricsFileInventoryError.make({ cause: "different cause", operation: "inspect" });

    expectDeclaredEquivalence(AiMetricsFileInventoryError, a, b, different, differentCause);
  });

  it("compares AiMetricsForwarderError by stable fields and ignores cause", () => {
    const a = AiMetricsForwarderError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsForwarderError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsForwarderError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsForwarderError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsForwarderError, a, b, different, differentCause);
  });

  it("compares AiMetricsIdentityRegistryError by stable fields and ignores cause", () => {
    const a = AiMetricsIdentityRegistryError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsIdentityRegistryError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsIdentityRegistryError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsIdentityRegistryError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsIdentityRegistryError, a, b, different, differentCause);
  });

  it("compares AiMetricsIngestError by stable fields and ignores cause", () => {
    const a = AiMetricsIngestError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsIngestError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsIngestError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsIngestError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsIngestError, a, b, different, differentCause);
  });

  it("compares AiMetricsInstallConfigurationError by stable fields and ignores cause", () => {
    const a = AiMetricsInstallConfigurationError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsInstallConfigurationError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsInstallConfigurationError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsInstallConfigurationError.make({
      cause: "different cause",
      message: "same message",
    });

    expectDeclaredEquivalence(AiMetricsInstallConfigurationError, a, b, different, differentCause);
  });

  it("compares AiMetricsMirrorError by stable fields and ignores cause", () => {
    const a = AiMetricsMirrorError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsMirrorError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsMirrorError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsMirrorError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsMirrorError, a, b, different, differentCause);
  });

  it("compares AiMetricsOtlpExportError by stable fields and ignores cause", () => {
    const a = AiMetricsOtlpExportError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsOtlpExportError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsOtlpExportError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsOtlpExportError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsOtlpExportError, a, b, different, differentCause);
  });

  it("compares AiMetricsPrivacyError by stable fields and ignores cause", () => {
    const a = AiMetricsPrivacyError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsPrivacyError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsPrivacyError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsPrivacyError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsPrivacyError, a, b, different, differentCause);
  });

  it("compares AiMetricsRetentionError by stable fields and ignores cause", () => {
    const a = AiMetricsRetentionError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsRetentionError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsRetentionError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsRetentionError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsRetentionError, a, b, different, differentCause);
  });

  it("compares AiMetricsScorecardError by stable fields and ignores cause", () => {
    const a = AiMetricsScorecardError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsScorecardError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsScorecardError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsScorecardError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsScorecardError, a, b, different, differentCause);
  });

  it("compares AiMetricsSourceDiscoveryError by stable fields and ignores cause", () => {
    const a = AiMetricsSourceDiscoveryError.make({ cause: "same cause", message: "same message" });
    const b = AiMetricsSourceDiscoveryError.make({ cause: "same cause", message: "same message" });
    const different = AiMetricsSourceDiscoveryError.make({ cause: "same cause", message: "different message" });
    const differentCause = AiMetricsSourceDiscoveryError.make({ cause: "different cause", message: "same message" });

    expectDeclaredEquivalence(AiMetricsSourceDiscoveryError, a, b, different, differentCause);
  });
});
