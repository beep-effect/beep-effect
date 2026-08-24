import { Sha256Hex } from "@beep/schema/Sha256";
import {
  EvidenceDigest,
  EvidenceLadderReceiptTypes,
  EvidencePredicateType,
  EvidenceSubject,
  FailurePredicateType,
  GateRegistry,
  GateSummaryPredicateType,
  NoRecoveryPolicy,
  ReceiptTypeBindings,
  SchemaReference,
  SchemaReferenceId,
  SkillContract,
  SkillContractId,
} from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const rungType = (name: string) => EvidencePredicateType.make(`https://beep.dev/evidence/${name}/v1`);
const evidenceSubject = EvidenceSubject.make({
  digest: EvidenceDigest.make({
    sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  }),
  name: "contracts/qa-inventory-judge/1.0.0.json",
});
const contract = SkillContract.make({
  evidenceSubject,
  gates: GateRegistry.make({ declarations: [] }),
  id: SkillContractId.make("qa-inventory-judge"),
  input: SchemaReference.make({ schemaId: SchemaReferenceId.make("qa.inventory/v1") }),
  output: SchemaReference.make({ schemaId: SchemaReferenceId.make("qa.inventory/verdict/v1") }),
  promise: "Validate one QA inventory against recorded round evidence.",
  receiptTypes: ReceiptTypeBindings.make({
    failure: FailurePredicateType,
    gateSummary: GateSummaryPredicateType,
    ladder: EvidenceLadderReceiptTypes.make({
      accepted: rungType("accepted"),
      delivered: rungType("delivered"),
      persisted: rungType("persisted"),
      semanticallyApplied: rungType("semantically-applied"),
    }),
    recoveryAttempt: rungType("recovery-attempt"),
  }),
  recovery: NoRecoveryPolicy.make({}),
  version: "1.0.0",
});

describe("@beep/skill-contract SkillContract", () => {
  it.effect("round-trips the aggregate while persisting only schema references", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeUnknownEffect(SkillContract)(contract);
      const decoded = yield* S.decodeEffect(SkillContract)(encoded);

      expect(S.toEquivalence(SkillContract)(decoded, contract)).toBe(true);
      expect(encoded.evidenceSubject).toEqual({
        digest: { sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
        name: "contracts/qa-inventory-judge/1.0.0.json",
      });
      expect(encoded.input).toEqual({ schemaId: "qa.inventory/v1" });
      expect(encoded.output).toEqual({ schemaId: "qa.inventory/verdict/v1" });
      expect(encoded.recovery).toEqual({ mode: "none" });
    })
  );

  it("round-trips schema-derived arbitrary schema references", () =>
    fc.assert(
      fc.property(S.toArbitrary(SchemaReference)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(SchemaReference)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(SchemaReference)(encoded));

        expect(S.toEquivalence(SchemaReference)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));
});
