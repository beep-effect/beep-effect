import { ContradictionReviewDecision } from "@beep/epistemic-use-cases/public";
import { describe, expect, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeDecision = S.decodeUnknownResult(ContradictionReviewDecision);
const supersedeDecisionInput = (reason: string) => ({
  decision: "supersedeProposal",
  proposalDigest: Str.repeat(64)("a"),
  proposalId: Str.repeat(64)("b"),
  reason,
});

describe("Contradiction review commands", () => {
  it("trims review reasons for both decisions", () => {
    const rejected = Result.getOrThrow(
      decodeDecision({
        decision: "reject",
        reason: "  The passages address different issues.  ",
      })
    );
    const superseded = Result.getOrThrow(decodeDecision(supersedeDecisionInput("  The signed amendment controls.  ")));

    expect(rejected.reason).toBe("The passages address different issues.");
    expect(superseded.reason).toBe("The signed amendment controls.");
  });

  it("rejects blank review reasons for both decisions", () => {
    expect(Result.isFailure(decodeDecision({ decision: "reject", reason: " \n\t " }))).toBe(true);
    expect(Result.isFailure(decodeDecision(supersedeDecisionInput(" \n\t ")))).toBe(true);
  });

  it("rejects over-limit review reasons for both decisions", () => {
    const overLimitReason = Str.repeat(2_001)("x");

    expect(Result.isFailure(decodeDecision({ decision: "reject", reason: overLimitReason }))).toBe(true);
    expect(Result.isFailure(decodeDecision(supersedeDecisionInput(overLimitReason)))).toBe(true);
  });
});
