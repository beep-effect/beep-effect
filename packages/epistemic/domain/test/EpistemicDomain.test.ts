import {
  Activity,
  appendTurnFinalizationUsageRecord,
  CandidateClaim,
  ClaimGateResult,
  ClaimGateSeverity,
  ClaimGateViolation,
  ClaimLifecycle,
  ClaimLifecycleError,
  ClaimProjectionView,
  Confidence,
  EpistemicFixtureKey,
  Evidence,
  EvidenceSpan,
  TurnFinalizationUsageAppend,
  UsageRecord,
} from "@beep/epistemic-domain";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { baseEntityFixtureInput, fcRuns, systemPrincipal } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const expectEncodedRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, encoded: Schema["Encoded"]): void => {
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));
  expect(Result.getOrThrow(S.encodeResult(schema)(decoded))).toStrictEqual(encoded);
};

type MakeableCodec<Schema extends S.Codec<unknown>> = Schema & {
  readonly make: (input: Schema["Type"]) => Schema["Type"];
};

const expectMadeValueEncodedRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: MakeableCodec<Schema>,
  input: unknown
): void => {
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(input));
  const encoded = Result.getOrThrow(S.encodeResult(schema)(schema.make(decoded)));

  expectEncodedRoundTrip(schema, encoded);
};

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: {
    readonly numRuns?: number;
  }
): void => {
  const arbitrary = S.toArbitrary(schema);
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      return equivalent(decoded, value);
    }),
    fcRuns(options?.numRuns ?? 50)
  );
};

describe("@beep/epistemic-domain", () => {
  it("exports value schemas from the package identity", () => {
    expect(ClaimLifecycle.is.candidate("candidate")).toBe(true);
  });

  it("wires CandidateClaim to the epistemic BaseEntity identity", () => {
    expect(CandidateClaim.definition.entityId).toBe(Epistemic.CandidateClaimId);
    expect(CandidateClaim.definition.entityId.tableName).toBe("epistemic_candidate_claim");
    expect(CandidateClaim.definition.entityId.entityType).toBe("EpistemicCandidateClaim");
    expect(CandidateClaim.definition.persisted.id.storageKind).toBe("entityId");
    expect(CandidateClaim.definition.persisted.snapshot.storageKind).toBe("jsonb");
  });

  it("rejects inconsistent evidence-span widths and derives only consistent spans", () => {
    expect(
      Result.isFailure(
        S.decodeUnknownResult(EvidenceSpan)({
          confidence: 0.92,
          endChar: 13,
          quote: "a claimed fact",
          startChar: 12,
        })
      )
    ).toBe(true);

    fc.assert(
      fc.property(S.toArbitrary(EvidenceSpan), (span) => EvidenceSpan.isInternallyConsistent(span)),
      fcRuns(25)
    );
  });

  it("decodes and constructs a CandidateClaim row", () => {
    const decoded = S.decodeUnknownSync(CandidateClaim)({
      ...baseEntityFixtureInput("EpistemicCandidateClaim", 3),
      fixtureKey: "claim.patentability",
      lifecycle: "candidate",
      snapshot: { confidence: 0.92, label: "Patentability" },
    });
    const constructed = CandidateClaim.make(decoded);

    expect(decoded).toBeInstanceOf(CandidateClaim);
    expect(constructed).toBeInstanceOf(CandidateClaim);
    expect(constructed.entityType).toBe("EpistemicCandidateClaim");
    expect(constructed.lifecycle).toBe("candidate");
    expect(constructed.snapshot).toEqual({ confidence: 0.92, label: "Patentability" });
  });

  it("appends a UsageRecord from turn-finalization activity", () => {
    const decoded = S.decodeUnknownSync(TurnFinalizationUsageAppend)({
      ...baseEntityFixtureInput("EpistemicUsageRecord", 7),
      activityId: 5,
      actor: systemPrincipal,
      costUsdApproxMicros: 3000,
      credentialReference: "op://Private/Claude/token",
      inputTokens: 120,
      latencyMillis: 1420,
      metadata: { threadId: 9, turnId: 12 },
      model: "claude-opus-4-6",
      outputTokens: 80,
      provider: "anthropic",
      totalTokens: 200,
      unitCount: null,
    });
    const appended = appendTurnFinalizationUsageRecord(decoded);

    expect(appended).toBeInstanceOf(UsageRecord);
    expect(O.getOrThrow(appended.activityId)).toBe(5);
    expect(appended.entityType).toBe("EpistemicUsageRecord");
    expect(O.getOrElse(appended.credentialReference, () => "")).toBe("op://Private/Claude/token");
    expect(O.getOrElse(appended.unitCount, () => 0)).toBe(0);
    expect(appended.metadata).toEqual({ threadId: 9, turnId: 12 });
  });

  it("preserves encoded wire shapes for crispened schemas", () => {
    expectMadeValueEncodedRoundTrip(Activity, {
      ...baseEntityFixtureInput("EpistemicActivity", 1),
      fixtureKey: "runtime-proof:turn-1",
      snapshot: { status: "completed" },
    });
    expectMadeValueEncodedRoundTrip(CandidateClaim, {
      ...baseEntityFixtureInput("EpistemicCandidateClaim", 3),
      fixtureKey: "claim.patentability",
      lifecycle: "candidate",
      snapshot: { confidence: 0.92, label: "Patentability" },
    });
    expectMadeValueEncodedRoundTrip(Evidence, {
      ...baseEntityFixtureInput("EpistemicEvidence", 4),
      artifactFixtureKey: "artifact.office-action",
      span: {
        confidence: 0.92,
        endChar: 57,
        quote: "a processor configured to receive sensor data",
        startChar: 12,
      },
      spanFixtureKey: "span.claim-1",
    });
    expectMadeValueEncodedRoundTrip(UsageRecord, {
      ...baseEntityFixtureInput("EpistemicUsageRecord", 7),
      activityId: 5,
      actor: systemPrincipal,
      costUsdApproxMicros: 3000,
      credentialReference: "op://Private/Claude/token",
      inputTokens: 120,
      latencyMillis: 1420,
      metadata: { threadId: 9, turnId: 12 },
      model: "claude-opus-4-6",
      outputTokens: 80,
      provider: "anthropic",
      totalTokens: 200,
      unitCount: null,
    });
    expectMadeValueEncodedRoundTrip(TurnFinalizationUsageAppend, {
      ...baseEntityFixtureInput("EpistemicUsageRecord", 8),
      activityId: 5,
      actor: systemPrincipal,
      costUsdApproxMicros: 3000,
      credentialReference: "op://Private/Claude/token",
      inputTokens: 120,
      latencyMillis: 1420,
      metadata: { threadId: 9, turnId: 12 },
      model: "claude-opus-4-6",
      outputTokens: 80,
      provider: "anthropic",
      totalTokens: 200,
      unitCount: null,
    });
    expectEncodedRoundTrip(ClaimProjectionView, {
      admittedKeys: ["claim.patentability"],
      counts: { admitted: 1, candidate: 2, consistency_checked: 0, shape_valid: 1 },
      total: 4,
    });
    expectEncodedRoundTrip(ClaimGateResult, {
      verdict: "rejected",
      violations: [
        {
          focusNode: "https://beep.dev/epistemic/claim/patentability",
          message: "Expected at least 1 value(s) for evidence.",
          path: "https://beep.dev/epistemic/hasEvidenceQuote",
          severity: "violation",
        },
      ],
    });
    expectEncodedRoundTrip(ClaimLifecycleError, {
      _tag: "ClaimInvalidTransition",
      from: "candidate",
      to: "admitted",
    });
  });

  it("derives schema arbitraries for crispened epistemic schemas", () => {
    const options = { numRuns: 10 };

    assertSchemaArbitraryRoundTrip(EpistemicFixtureKey, options);
    assertSchemaArbitraryRoundTrip(Confidence, options);
    assertSchemaArbitraryRoundTrip(ClaimGateSeverity, options);
    assertSchemaArbitraryRoundTrip(ClaimGateViolation, options);
    assertSchemaArbitraryRoundTrip(ClaimGateResult, options);
    assertSchemaArbitraryRoundTrip(ClaimLifecycleError, options);
    assertSchemaArbitraryRoundTrip(EvidenceSpan, options);
    assertSchemaArbitraryRoundTrip(ClaimProjectionView, options);
    assertSchemaArbitraryRoundTrip(Activity, options);
    assertSchemaArbitraryRoundTrip(CandidateClaim, options);
    assertSchemaArbitraryRoundTrip(Evidence, options);
    assertSchemaArbitraryRoundTrip(UsageRecord, options);
    assertSchemaArbitraryRoundTrip(TurnFinalizationUsageAppend, options);
  });
});
