import { Sha256Hex } from "@beep/schema/Sha256";
import { ISOStr } from "@beep/schema/Timestamp";
import { URLStr } from "@beep/schema/URL";
import {
  AttestationResource,
  EvidenceDigest,
  EvidencePredicateType,
  EvidenceSubject,
  GateId,
  GateResultSummary,
  GateSummary,
  GateSummaryPredicateType,
  GateSummaryReceipt,
  GateSummaryVerifier,
} from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const emptySha256 = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const digest = EvidenceDigest.make({ sha256: emptySha256 });
const subject = EvidenceSubject.make({ digest, name: "qa/inventory.json" });
const policy = AttestationResource.make({ digest, uri: URLStr.make("https://beep-effect.dev/policy/qa/v1") });
const inputAttestation = AttestationResource.make({
  digest,
  uri: URLStr.make("https://beep-effect.dev/attestation/qa/inventory/v1"),
});
const verifier = GateSummaryVerifier.make({
  id: URLStr.make("https://beep-effect.dev/verifier/skill-contract/v1"),
  version: { kernel: "1.0.0" },
});
const evidenceType = EvidencePredicateType.make("https://beep-effect.dev/evidence/artifact/v1");
const gateId = GateId.make("artifact-exists");

const summaryFor = (options: {
  readonly applicable: boolean;
  readonly outcome: "allowed" | "denied";
  readonly severity: "blocking" | "advisory";
}) => {
  const passed = !options.applicable || options.severity === "advisory" || options.outcome === "allowed";
  return GateSummary.make({
    contractSubject: subject,
    gateResults: [
      GateResultSummary.make({
        applicable: options.applicable,
        evidenceSubjects: [subject],
        evidenceType,
        gateId,
        outcome: options.outcome,
        severity: options.severity,
      }),
    ],
    inputAttestations: [inputAttestation],
    policy,
    resourceUri: URLStr.make("https://beep-effect.dev/resource/qa-round/1"),
    timeVerified: ISOStr.make("2026-08-24T00:00:00.000Z"),
    verificationResult: passed ? "PASSED" : "FAILED",
    verifiedLevels: passed ? ["BEEP_SKILL_CONTRACT_BLOCKING_GATES"] : ["FAILED"],
    verifier,
  });
};

describe("@beep/skill-contract GateSummary", () => {
  it.effect("round-trips a VSA-shaped passing summary receipt with the canonical digest seam", () =>
    Effect.gen(function* () {
      const summary = summaryFor({ applicable: true, outcome: "allowed", severity: "blocking" });
      const receipt = GateSummaryReceipt.make({
        predicate: summary,
        predicateType: GateSummaryPredicateType,
        subject: [subject],
      });
      const encoded = yield* S.encodeUnknownEffect(GateSummaryReceipt)(receipt);
      const decoded = yield* S.decodeEffect(GateSummaryReceipt)(encoded);

      expect(S.toEquivalence(GateSummaryReceipt)(decoded, receipt)).toBe(true);
      expect(decoded.predicate.policy.digest.sha256).toBe(emptySha256);
      expect(decoded.subject[0].digest.sha256).toBe(emptySha256);
      expect(decoded.predicate.verifiedLevels).toEqual(["BEEP_SKILL_CONTRACT_BLOCKING_GATES"]);
    })
  );

  it("coheres blocking, advisory, and non-applicable gate summaries", () => {
    const failed = summaryFor({ applicable: true, outcome: "denied", severity: "blocking" });
    const advisory = summaryFor({ applicable: true, outcome: "denied", severity: "advisory" });
    const nonApplicable = summaryFor({ applicable: false, outcome: "denied", severity: "blocking" });

    expect(failed.verificationResult).toBe("FAILED");
    expect(failed.verifiedLevels).toEqual(["FAILED"]);
    expect(advisory.verificationResult).toBe("PASSED");
    expect(nonApplicable.verificationResult).toBe("PASSED");
  });

  it.effect("rejects result and level fields that disagree with blocking outcomes", () =>
    Effect.gen(function* () {
      const passing = summaryFor({ applicable: true, outcome: "allowed", severity: "blocking" });
      const encoded = yield* S.encodeUnknownEffect(GateSummary)(passing);
      const wrongResultInput: unknown = { ...encoded, verificationResult: "FAILED" };
      const wrongLevelsInput: unknown = { ...encoded, verifiedLevels: ["FAILED"] };
      const wrongResult = yield* S.decodeUnknownEffect(GateSummary)(wrongResultInput).pipe(Effect.flip);
      const wrongLevels = yield* S.decodeUnknownEffect(GateSummary)(wrongLevelsInput).pipe(Effect.flip);

      expect(wrongResult.message).toContain("must agree");
      expect(wrongLevels.message).toContain("must agree");
    })
  );

  it.effect("rejects an applicable allowed gate result without evidence subjects", () =>
    Effect.gen(function* () {
      const passing = summaryFor({ applicable: true, outcome: "allowed", severity: "blocking" });
      const encoded = yield* S.encodeUnknownEffect(GateSummary)(passing);
      const missingEvidenceInput: unknown = {
        ...encoded,
        gateResults: A.map(encoded.gateResults, (result) => ({ ...result, evidenceSubjects: [] })),
      };
      const failure = yield* S.decodeUnknownEffect(GateSummary)(missingEvidenceInput).pipe(Effect.flip);

      expect(failure.message).toContain("require non-empty evidence subjects");
    })
  );

  it("round-trips schema-derived arbitrary attestation resources", () =>
    fc.assert(
      fc.property(S.toArbitrary(AttestationResource)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(AttestationResource)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(AttestationResource)(encoded));

        expect(S.toEquivalence(AttestationResource)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));
});
