import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256Hex } from "@beep/schema/Sha256";
import { ISOStr } from "@beep/schema/Timestamp";
import { URLStr } from "@beep/schema/URL";
import {
  AlwaysGateApplicability,
  AttestationResource,
  CompletionEvaluation,
  CompletionInvariantError,
  CompletionInvariantReason,
  ConditionalGateApplicability,
  EvaluateSkillCompletionInput,
  EvidenceDigest,
  EvidenceLadderReceiptTypes,
  EvidencePredicateType,
  EvidenceReceiptReference,
  EvidenceSubject,
  evaluateSkillCompletion,
  FailurePredicateType,
  GateDeclaration,
  GateEvidenceRequirement,
  GateRegistry,
  GateResultSummary,
  GateSummary,
  GateSummaryPredicateType,
  GateSummaryReceipt,
  GateSummaryVerifier,
  LiveVerified,
  makeGateId,
  NoRecoveryPolicy,
  ReceiptTypeBindings,
  SchemaReference,
  SchemaReferenceId,
  SemanticallyApplied,
  SkillCompletion,
  SkillCompletionReceipt,
  SkillContract,
  SkillContractId,
  toSkillCompletionReceipt,
} from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const QaGateId = makeGateId(LiteralKit(["blocking-gate", "advisory-gate", "conditional-gate", "extra-gate"]));
const digest = EvidenceDigest.make({
  sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
});
const outputSubject = EvidenceSubject.make({ digest, name: "qa/output.json" });
const summarySubject = EvidenceSubject.make({ digest, name: "qa/gate-summary.json" });
const contractSubject = EvidenceSubject.make({ digest, name: "contracts/completion-test/1.0.0.json" });
const unrelatedSubject = EvidenceSubject.make({ digest, name: "qa/unrelated-output.json" });
const policy = AttestationResource.make({ digest, uri: URLStr.make("https://beep.dev/policy/skill/v1") });
const inputAttestation = AttestationResource.make({
  digest,
  uri: URLStr.make("https://beep.dev/attestation/input/v1"),
});
const verifier = GateSummaryVerifier.make({
  id: URLStr.make("https://beep.dev/verifier/skill/v1"),
  version: { kernel: "1.0.0" },
});
const gateEvidenceType = EvidencePredicateType.make("https://beep.dev/evidence/gate/v1");
const acceptedType = EvidencePredicateType.make("https://beep.dev/evidence/accepted/v1");
const persistedType = EvidencePredicateType.make("https://beep.dev/evidence/persisted/v1");
const deliveredType = EvidencePredicateType.make("https://beep.dev/evidence/delivered/v1");
const appliedType = EvidencePredicateType.make("https://beep.dev/evidence/applied/v1");
const recoveryAttemptType = EvidencePredicateType.make("https://beep.dev/evidence/recovery-attempt/v1");
const ladderTypes = EvidenceLadderReceiptTypes.make({
  accepted: acceptedType,
  delivered: deliveredType,
  persisted: persistedType,
  semanticallyApplied: appliedType,
});
const reference = (
  predicateType: EvidencePredicateType,
  subjects: A.NonEmptyReadonlyArray<EvidenceSubject> = [summarySubject]
) => EvidenceReceiptReference.make({ predicateType, receipt: summarySubject, subjects });
const ladder = SemanticallyApplied.make({
  accepted: reference(acceptedType),
  delivered: reference(deliveredType),
  persisted: reference(persistedType),
  semanticallyApplied: reference(appliedType, [outputSubject]),
});
const always = AlwaysGateApplicability.make({});
const conditional = ConditionalGateApplicability.make({
  condition: SchemaReference.make({ schemaId: SchemaReferenceId.make("qa.condition/v1") }),
});
const blockingGate = GateDeclaration.make({
  applicability: always,
  evidence: GateEvidenceRequirement.make({ predicateType: gateEvidenceType }),
  id: QaGateId.make("blocking-gate"),
  remediationOwner: "qa",
  severity: "blocking",
});
const conditionalGate = GateDeclaration.make({
  applicability: conditional,
  evidence: GateEvidenceRequirement.make({ predicateType: gateEvidenceType }),
  id: QaGateId.make("conditional-gate"),
  remediationOwner: "qa",
  severity: "blocking",
});
const conditionalAdvisoryGate = GateDeclaration.make({
  applicability: conditional,
  evidence: GateEvidenceRequirement.make({ predicateType: gateEvidenceType }),
  id: QaGateId.make("conditional-gate"),
  remediationOwner: "qa",
  severity: "advisory",
});

const contractFor = (
  declarations: ReadonlyArray<GateDeclaration>,
  options?: {
    readonly gateSummaryType?: EvidencePredicateType;
    readonly evidenceSubject?: EvidenceSubject;
    readonly receiptLadderTypes?: EvidenceLadderReceiptTypes;
  }
) =>
  SkillContract.make({
    evidenceSubject: options?.evidenceSubject ?? contractSubject,
    gates: GateRegistry.make({ declarations }),
    id: SkillContractId.make("completion-test"),
    input: SchemaReference.make({ schemaId: SchemaReferenceId.make("completion.input/v1") }),
    output: SchemaReference.make({ schemaId: SchemaReferenceId.make("completion.output/v1") }),
    promise: "Produce a verified output.",
    receiptTypes: ReceiptTypeBindings.make({
      failure: FailurePredicateType,
      gateSummary: options?.gateSummaryType ?? GateSummaryPredicateType,
      ladder: options?.receiptLadderTypes ?? ladderTypes,
      recoveryAttempt: recoveryAttemptType,
    }),
    recovery: NoRecoveryPolicy.make({}),
    version: "1.0.0",
  });

const gateResult = (
  declaration: GateDeclaration,
  options: { readonly applicable: boolean; readonly outcome: "allowed" | "denied" }
) =>
  GateResultSummary.make({
    applicable: options.applicable,
    evidenceSubjects: [summarySubject],
    evidenceType: declaration.evidence.predicateType,
    gateId: declaration.id,
    outcome: options.outcome,
    severity: declaration.severity,
  });

const gateSummaryReceipt = (gateResults: ReadonlyArray<GateResultSummary>) => {
  const passed = A.every(
    gateResults,
    (result) => !result.applicable || result.severity === "advisory" || result.outcome === "allowed"
  );
  const summary = GateSummary.make({
    contractSubject,
    gateResults,
    inputAttestations: [inputAttestation],
    policy,
    resourceUri: URLStr.make("https://beep.dev/resource/output/v1"),
    timeVerified: ISOStr.make("2026-08-24T00:00:00.000Z"),
    verificationResult: passed ? "PASSED" : "FAILED",
    verifiedLevels: passed ? ["BEEP_SKILL_CONTRACT_BLOCKING_GATES"] : ["FAILED"],
    verifier,
  });
  return GateSummaryReceipt.make({
    predicate: summary,
    predicateType: GateSummaryPredicateType,
    subject: [summarySubject],
  });
};

const evaluationInput = (
  contract: SkillContract,
  summary: GateSummaryReceipt,
  evidenceLadder: SemanticallyApplied = ladder,
  outputSubjects: A.NonEmptyReadonlyArray<EvidenceSubject> = [outputSubject]
) =>
  EvaluateSkillCompletionInput.make({
    contract,
    gateSummary: summary,
    ladder: evidenceLadder,
    outputSubjects,
  });

describe("@beep/skill-contract SkillCompletion", () => {
  it.effect("creates opaque completion only for a complete allowed registry and projects one way", () =>
    Effect.gen(function* () {
      const contract = contractFor([blockingGate]);
      const summary = gateSummaryReceipt([gateResult(blockingGate, { applicable: true, outcome: "allowed" })]);
      const evaluation = yield* evaluateSkillCompletion(evaluationInput(contract, summary));
      const receipt = CompletionEvaluation.match(evaluation, {
        allowed: ({ completion }) => O.some(toSkillCompletionReceipt(completion)),
        denied: () => O.none<SkillCompletionReceipt>(),
      });

      expect(evaluation.verdict).toBe("allowed");
      expect(O.isSome(receipt)).toBe(true);
      if (O.isNone(receipt)) {
        return;
      }

      const encoded = yield* S.encodeUnknownEffect(SkillCompletionReceipt)(receipt.value);
      const decodedReceipt = yield* S.decodeEffect(SkillCompletionReceipt)(encoded);
      const opaqueDecodeFailure = yield* S.decodeUnknownEffect(SkillCompletion)(encoded).pipe(Effect.flip);
      const receiptIsNotProof: SkillCompletionReceipt extends SkillCompletion ? false : true = true;

      expect(S.toEquivalence(SkillCompletionReceipt)(decodedReceipt, receipt.value)).toBe(true);
      expect(S.is(SkillCompletion)(decodedReceipt)).toBe(false);
      expect(receiptIsNotProof).toBe(true);
      expect(opaqueDecodeFailure.message).toContain("SkillCompletion");
      expect(S.is(LiveVerified)({ terminal: "LiveVerified", completion: decodedReceipt })).toBe(false);
      expect(
        CompletionEvaluation.match(evaluation, {
          allowed: ({ completion }) => LiveVerified.make({ completion }).terminal,
          denied: () => "denied",
        })
      ).toBe("LiveVerified");
    })
  );

  it.effect("denies missing and denied applicable blocking gates as verdict values", () =>
    Effect.gen(function* () {
      const contract = contractFor([blockingGate]);
      const missing = yield* evaluateSkillCompletion(evaluationInput(contract, gateSummaryReceipt([])));
      const denied = yield* evaluateSkillCompletion(
        evaluationInput(
          contract,
          gateSummaryReceipt([gateResult(blockingGate, { applicable: true, outcome: "denied" })])
        )
      );

      expect(missing.verdict).toBe("denied");
      expect(denied.verdict).toBe("denied");
      expect(
        CompletionEvaluation.match(missing, {
          allowed: () => false,
          denied: ({ gateSummary }) => gateSummary.predicate.gateResults.length === 0,
        })
      ).toBe(true);
    })
  );

  it.effect("fails closed on an unverified conditional blocker and allows a denied advisory gate", () =>
    Effect.gen(function* () {
      const conditionalSummary = gateSummaryReceipt([
        gateResult(conditionalGate, { applicable: false, outcome: "denied" }),
      ]);
      const advisorySummary = gateSummaryReceipt([
        gateResult(conditionalAdvisoryGate, { applicable: false, outcome: "denied" }),
      ]);
      const conditionalFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([conditionalGate]), conditionalSummary)
      ).pipe(Effect.flip);
      const advisoryResult = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([conditionalAdvisoryGate]), advisorySummary)
      );

      expect(conditionalFailure.reason).toBe("conditional-gate-applicability-unverified");
      expect(advisoryResult.verdict).toBe("allowed");
    })
  );

  it("compares completion invariant errors by their declared fields", () => {
    const left = CompletionInvariantError.make({
      message: "Gate summary predicate type does not match the contract binding.",
      reason: "gate-summary-predicate-type-mismatch",
    });
    const same = CompletionInvariantError.make({
      message: left.message,
      reason: left.reason,
    });
    const different = CompletionInvariantError.make({
      message: "Output subjects do not match.",
      reason: "output-subjects-mismatch",
    });
    const equivalence = S.toEquivalence(CompletionInvariantError);

    expect(equivalence(left, same)).toBe(true);
    expect(equivalence(left, different)).toBe(false);
  });

  it.effect("rejects evidence bound to another contract or another output", () =>
    Effect.gen(function* () {
      const summary = gateSummaryReceipt([gateResult(blockingGate, { applicable: true, outcome: "allowed" })]);
      const contractFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate], { evidenceSubject: unrelatedSubject }), summary)
      ).pipe(Effect.flip);
      const outputFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate]), summary, ladder, [unrelatedSubject])
      ).pipe(Effect.flip);

      expect(contractFailure.reason).toBe("contract-evidence-mismatch");
      expect(outputFailure.reason).toBe("output-subjects-mismatch");
    })
  );

  it.effect("fails malformed gate-summary and ladder predicate bindings", () =>
    Effect.gen(function* () {
      const summary = gateSummaryReceipt([gateResult(blockingGate, { applicable: true, outcome: "allowed" })]);
      const wrongSummaryType = EvidencePredicateType.make("https://beep.dev/evidence/wrong-summary/v1");
      const summaryTypeFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate], { gateSummaryType: wrongSummaryType }), summary)
      ).pipe(Effect.flip);
      const wrongAppliedType = EvidencePredicateType.make("https://beep.dev/evidence/wrong-applied/v1");
      const mismatchedLadderTypes = EvidenceLadderReceiptTypes.make({
        ...ladderTypes,
        semanticallyApplied: wrongAppliedType,
      });
      const ladderFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate], { receiptLadderTypes: mismatchedLadderTypes }), summary)
      ).pipe(Effect.flip);

      expect(summaryTypeFailure.reason).toBe("gate-summary-predicate-type-mismatch");
      expect(ladderFailure.reason).toBe("ladder-predicate-type-mismatch");
    })
  );

  it.effect("fails duplicate, unknown, mismatched-severity, and false always-applicable summary bindings", () =>
    Effect.gen(function* () {
      const allowed = gateResult(blockingGate, { applicable: true, outcome: "allowed" });
      const extra = GateResultSummary.make({
        ...allowed,
        gateId: QaGateId.make("extra-gate"),
      });
      const wrongSeverity = GateResultSummary.make({ ...allowed, severity: "advisory" });
      const falseAlways = GateResultSummary.make({ ...allowed, applicable: false });
      const duplicateFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate]), gateSummaryReceipt([allowed, allowed]))
      ).pipe(Effect.flip);
      const extraFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate]), gateSummaryReceipt([allowed, extra]))
      ).pipe(Effect.flip);
      const severityFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate]), gateSummaryReceipt([wrongSeverity]))
      ).pipe(Effect.flip);
      const applicabilityFailure = yield* evaluateSkillCompletion(
        evaluationInput(contractFor([blockingGate]), gateSummaryReceipt([falseAlways]))
      ).pipe(Effect.flip);

      expect(duplicateFailure.reason).toBe("gate-summary-registry-mismatch");
      expect(extraFailure.reason).toBe("gate-summary-registry-mismatch");
      expect(severityFailure.reason).toBe("gate-summary-registry-mismatch");
      expect(applicabilityFailure.reason).toBe("gate-summary-registry-mismatch");
    })
  );

  it("round-trips schema-derived arbitrary completion invariant reasons", () =>
    fc.assert(
      fc.property(S.toArbitrary(CompletionInvariantReason)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(CompletionInvariantReason)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(CompletionInvariantReason)(encoded));

        expect(S.toEquivalence(CompletionInvariantReason)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));
});
