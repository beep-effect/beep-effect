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
  EVIDENCE_SPAN_QUOTE_MAX_LENGTH,
  Evidence,
  EvidenceSpan,
  TurnFinalizationUsageAppend,
  UsageRecord,
} from "@beep/epistemic-domain";
import { EvidenceSpanArbitrary } from "@beep/epistemic-domain/values/EvidenceSpan";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { fcRuns, productEntityFixtureInput, systemPrincipal } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeEvidenceSpanResult = S.decodeResult(EvidenceSpan);
const decodeTextAnchorResult = S.decodeResult(TextAnchor);
const decodeUnknownCandidateClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeUnknownTurnFinalizationUsageAppend = S.decodeUnknownEffect(TurnFinalizationUsageAppend);

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

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  value: Schema["Type"],
  label: string
): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));
  expect(S.toEquivalence(schema)(decoded, value), label).toBe(true);
};

const isConfidence = S.is(Confidence);

describe("@beep/epistemic-domain", () => {
  it("exports value schemas from the package identity", () => {
    expect(ClaimLifecycle.is.candidate("candidate")).toBe(true);
  });

  it.effect("derives valid Confidence samples", () =>
    Effect.gen(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(Confidence), { count: 25 });
      expect(samples.every(isConfidence)).toBe(true);
    })
  );

  it("wires CandidateClaim to the epistemic product identity", () => {
    expect(CandidateClaim.sql.tableName).toBe(Epistemic.CandidateClaimId.tableName);
    expect(Epistemic.CandidateClaimId.entityType).toBe("EpistemicCandidateClaim");
    expect(Object.keys(CandidateClaim.fields)).toEqual(expect.arrayContaining(["id", "snapshot"]));
  });

  it.effect.prop(
    "rejects inconsistent evidence-span widths and derives only consistent spans",
    [EvidenceSpanArbitrary],
    ([span]) =>
      Effect.sync(() => {
        pipe(
          decodeEvidenceSpanResult({
            confidence: 0.92,
            endChar: 13,
            quote: "a claimed fact",
            startChar: 12,
          }),
          Result.isFailure,
          assertTrue
        );
        const result = EvidenceSpan.isInternallyConsistent(span);
        expect(result).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it("bounds evidence quotes to one source-text page", () => {
    const maximumQuote = Str.repeat(EVIDENCE_SPAN_QUOTE_MAX_LENGTH)("a");
    const overLimitQuote = `${maximumQuote}a`;

    pipe(
      decodeEvidenceSpanResult({
        confidence: 0.92,
        endChar: EVIDENCE_SPAN_QUOTE_MAX_LENGTH,
        quote: maximumQuote,
        startChar: 0,
      }),
      Result.isSuccess,
      assertTrue
    );
    pipe(
      decodeEvidenceSpanResult({
        confidence: 0.92,
        endChar: EVIDENCE_SPAN_QUOTE_MAX_LENGTH + 1,
        quote: overLimitQuote,
        startChar: 0,
      }),
      Result.isFailure,
      assertTrue
    );
  });

  it("matches an evidence span only to its exact provenance anchor", () => {
    const span = Result.getOrThrow(
      decodeEvidenceSpanResult({
        confidence: 0.92,
        endChar: 8,
        quote: "amount A",
        startChar: 0,
      })
    );
    const matching = Result.getOrThrow(
      decodeTextAnchorResult({
        endChar: 8,
        quote: "amount A",
        startChar: 0,
      })
    );
    const unrelated = TextAnchor.make({
      ...matching,
      quote: "amount B",
    });

    expect(EvidenceSpan.matchesAnchor(span, matching)).toBe(true);
    expect(EvidenceSpan.matchesAnchor(span, unrelated)).toBe(false);
  });

  it.effect("decodes and constructs a CandidateClaim row", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownCandidateClaim({
        ...productEntityFixtureInput("EpistemicCandidateClaim", 3),
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
    })
  );

  it.effect("appends a UsageRecord from turn-finalization activity", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownTurnFinalizationUsageAppend({
        ...productEntityFixtureInput("EpistemicUsageRecord", 7),
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
      assertNone(appended.unitCount);
      expect(appended.metadata).toEqual({ threadId: 9, turnId: 12 });
    })
  );

  it("preserves encoded wire shapes for crispened schemas", () => {
    expectMadeValueEncodedRoundTrip(Activity, {
      ...productEntityFixtureInput("EpistemicActivity", 1),
      fixtureKey: "runtime-proof:turn-1",
      snapshot: { status: "completed" },
    });
    expectMadeValueEncodedRoundTrip(CandidateClaim, {
      ...productEntityFixtureInput("EpistemicCandidateClaim", 3),
      fixtureKey: "claim.patentability",
      lifecycle: "candidate",
      snapshot: { confidence: 0.92, label: "Patentability" },
    });
    expectMadeValueEncodedRoundTrip(Evidence, {
      ...productEntityFixtureInput("EpistemicEvidence", 4),
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
      ...productEntityFixtureInput("EpistemicUsageRecord", 7),
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
      ...productEntityFixtureInput("EpistemicUsageRecord", 8),
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

  it.effect.prop(
    "derives schema arbitraries for crispened epistemic schemas",
    {
      EpistemicFixtureKey: Arbitrary.schema(EpistemicFixtureKey),
      Confidence: Arbitrary.schema(Confidence),
      ClaimGateSeverity: Arbitrary.schema(ClaimGateSeverity),
      ClaimGateViolation: Arbitrary.schema(ClaimGateViolation),
      ClaimGateResult: Arbitrary.schema(ClaimGateResult),
      ClaimLifecycleError: Arbitrary.schema(ClaimLifecycleError),
      EvidenceSpan: EvidenceSpanArbitrary,
      ClaimProjectionView: Arbitrary.schema(ClaimProjectionView),
      Activity: Arbitrary.schema(Activity),
      CandidateClaim: Arbitrary.schema(CandidateClaim),
      Evidence: Arbitrary.all({
        fields: Arbitrary.schema(S.Struct(Evidence.fields).mapFields(({ span, ...fields }) => fields)),
        span: EvidenceSpanArbitrary,
      }).pipe(Arbitrary.map(({ fields, span }) => Evidence.make({ ...fields, span }))),
      UsageRecord: Arbitrary.schema(UsageRecord),
      TurnFinalizationUsageAppend: Arbitrary.schema(TurnFinalizationUsageAppend),
    },
    (values) =>
      Effect.sync(() => {
        assertSchemaRoundTrip(EpistemicFixtureKey, values.EpistemicFixtureKey, "EpistemicFixtureKey");
        assertSchemaRoundTrip(Confidence, values.Confidence, "Confidence");
        assertSchemaRoundTrip(ClaimGateSeverity, values.ClaimGateSeverity, "ClaimGateSeverity");
        assertSchemaRoundTrip(ClaimGateViolation, values.ClaimGateViolation, "ClaimGateViolation");
        assertSchemaRoundTrip(ClaimGateResult, values.ClaimGateResult, "ClaimGateResult");
        assertSchemaRoundTrip(ClaimLifecycleError, values.ClaimLifecycleError, "ClaimLifecycleError");
        assertSchemaRoundTrip(EvidenceSpan, values.EvidenceSpan, "EvidenceSpan");
        assertSchemaRoundTrip(ClaimProjectionView, values.ClaimProjectionView, "ClaimProjectionView");
        assertSchemaRoundTrip(Activity, values.Activity, "Activity");
        assertSchemaRoundTrip(CandidateClaim, values.CandidateClaim, "CandidateClaim");
        assertSchemaRoundTrip(Evidence, values.Evidence, "Evidence");
        assertSchemaRoundTrip(UsageRecord, values.UsageRecord, "UsageRecord");
        assertSchemaRoundTrip(
          TurnFinalizationUsageAppend,
          values.TurnFinalizationUsageAppend,
          "TurnFinalizationUsageAppend"
        );
      }),
    { arbitrary: fcRuns(10) }
  );
});
