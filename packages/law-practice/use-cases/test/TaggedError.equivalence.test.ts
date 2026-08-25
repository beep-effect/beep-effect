import { CandorRecordReadError } from "@beep/law-practice-use-cases/CandorPolicy";
import { CandorRecordRepositoryUnavailable } from "@beep/law-practice-use-cases/CandorRecord";
import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw";
import { LegalPositionRecordRepositoryUnavailable } from "@beep/law-practice-use-cases/LegalPositionRecord";
import { LegalPositionRelatorAdmissionError } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("law-practice use-case tagged-error declared equivalence", () => {
  it("compares CandorRecordReadError by declared fields", () => {
    const same = S.toEquivalence(CandorRecordReadError);
    const first = CandorRecordReadError.fromReason("snapshot-unavailable", "Candor record read failed.");
    const second = CandorRecordReadError.fromReason("snapshot-unavailable", "Candor record read failed.");
    const different = CandorRecordReadError.fromReason("snapshot-unavailable", "Candor record read timed out.");

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores CandorRecordRepositoryUnavailable cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(CandorRecordRepositoryUnavailable);
    const first = CandorRecordRepositoryUnavailable.during("readSnapshot", "repository unavailable", {
      diagnostic: "first",
    });
    const second = CandorRecordRepositoryUnavailable.during("readSnapshot", "repository unavailable", {
      diagnostic: "second",
    });
    const different = CandorRecordRepositoryUnavailable.during("readSnapshot", "repository timed out", {
      diagnostic: "first",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares IrToLawExtractionError by declared fields", () => {
    const same = S.toEquivalence(IrToLawExtractionError);
    const first = IrToLawExtractionError.fromReason("required-extraction-missing", {
      label: "distinction",
      message: "Required extraction is missing.",
    });
    const second = IrToLawExtractionError.fromReason("required-extraction-missing", {
      label: "distinction",
      message: "Required extraction is missing.",
    });
    const different = IrToLawExtractionError.fromReason("required-extraction-missing", {
      label: "distinction",
      message: "Required extraction is unavailable.",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores LegalPositionRecordRepositoryUnavailable cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(LegalPositionRecordRepositoryUnavailable);
    const first = LegalPositionRecordRepositoryUnavailable.during("listRelators", "repository unavailable", {
      diagnostic: "first",
    });
    const second = LegalPositionRecordRepositoryUnavailable.during("listRelators", "repository unavailable", {
      diagnostic: "second",
    });
    const different = LegalPositionRecordRepositoryUnavailable.during("listRelators", "repository timed out", {
      diagnostic: "first",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares LegalPositionRelatorAdmissionError by declared fields", () => {
    const same = S.toEquivalence(LegalPositionRelatorAdmissionError);
    const first = LegalPositionRelatorAdmissionError.make({ message: "Relator admission failed." });
    const second = LegalPositionRelatorAdmissionError.make({ message: "Relator admission failed." });
    const different = LegalPositionRelatorAdmissionError.make({ message: "Relator admission was rejected." });

    expectDeclaredEquivalence(same, first, second, different);
  });
});
