import { Sha256Hex } from "@beep/schema/Sha256";
import {
  Accepted,
  advanceToDelivered,
  advanceToPersisted,
  advanceToSemanticallyApplied,
  Delivered,
  EvidenceDigest,
  EvidenceLadderReceiptTypes,
  EvidenceLadderState,
  EvidencePredicateType,
  EvidenceReceiptReference,
  EvidenceSubject,
  evidenceLadderFor,
  Persisted,
  SemanticallyApplied,
  transportCompleted,
} from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const digest = EvidenceDigest.make({
  sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
});
const receiptSubject = EvidenceSubject.make({ digest, name: "operation/1" });
const acceptedType = EvidencePredicateType.make("https://beep.dev/evidence/accepted/v1");
const persistedType = EvidencePredicateType.make("https://beep.dev/evidence/persisted/v1");
const deliveredType = EvidencePredicateType.make("https://beep.dev/evidence/delivered/v1");
const appliedType = EvidencePredicateType.make("https://beep.dev/evidence/semantically-applied/v1");
const receiptTypes = EvidenceLadderReceiptTypes.make({
  accepted: acceptedType,
  delivered: deliveredType,
  persisted: persistedType,
  semanticallyApplied: appliedType,
});
const reference = (predicateType: EvidencePredicateType) =>
  EvidenceReceiptReference.make({ predicateType, receipt: receiptSubject });

describe("@beep/skill-contract EvidenceLadder", () => {
  it("maps transport completion to Accepted and exposes only immediate monotonic transitions", () => {
    const accepted = transportCompleted(reference(acceptedType));
    const persisted = advanceToPersisted(accepted, reference(persistedType));
    const delivered = advanceToDelivered(reference(deliveredType))(persisted);
    const applied = advanceToSemanticallyApplied(delivered, reference(appliedType));

    expect(accepted.rung).toBe("Accepted");
    expect(persisted.accepted).toBe(accepted.accepted);
    expect(delivered.persisted).toBe(persisted.persisted);
    expect(applied.delivered).toBe(delivered.delivered);
    expect(applied.rung).toBe("SemanticallyApplied");
  });

  it("enforces every rung's cumulative predicate-type demands", () => {
    const Ladder = evidenceLadderFor(receiptTypes);
    const accepted = Accepted.make({ accepted: reference(acceptedType) });
    const persisted = Persisted.make({ accepted: reference(acceptedType), persisted: reference(persistedType) });
    const delivered = Delivered.make({
      accepted: reference(acceptedType),
      delivered: reference(deliveredType),
      persisted: reference(persistedType),
    });
    const applied = SemanticallyApplied.make({
      accepted: reference(acceptedType),
      delivered: reference(deliveredType),
      persisted: reference(persistedType),
      semanticallyApplied: reference(appliedType),
    });
    const mismatched = SemanticallyApplied.make({
      accepted: reference(acceptedType),
      delivered: reference(deliveredType),
      persisted: reference(persistedType),
      semanticallyApplied: reference(deliveredType),
    });

    expect(S.is(Ladder)(accepted)).toBe(true);
    expect(S.is(Ladder)(persisted)).toBe(true);
    expect(S.is(Ladder)(delivered)).toBe(true);
    expect(S.is(Ladder)(applied)).toBe(true);
    expect(S.is(Ladder)(mismatched)).toBe(false);
  });

  it("gives each contract-bound ladder schema a distinct identity", () => {
    const otherTypes = EvidenceLadderReceiptTypes.make({ ...receiptTypes, accepted: persistedType });
    const Ladder = evidenceLadderFor(receiptTypes);
    const OtherLadder = evidenceLadderFor(otherTypes);

    expect(S.resolveAnnotations(Ladder)?.identifier).not.toBe(S.resolveAnnotations(OtherLadder)?.identifier);
  });

  it("round-trips schema-derived arbitrary structural ladder states", () =>
    fc.assert(
      fc.property(S.toArbitrary(EvidenceLadderState)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(EvidenceLadderState)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(EvidenceLadderState)(encoded));

        expect(S.toEquivalence(EvidenceLadderState)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));
});
