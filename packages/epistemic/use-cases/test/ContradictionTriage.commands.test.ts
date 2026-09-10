import { ContradictionReviewDecision } from "@beep/epistemic-use-cases/public";
import { SubmitContradictionCandidate, SubmitContradictionCandidateArbitrary } from "@beep/epistemic-use-cases/server";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const encodeSubmitContradictionCandidateResult = S.encodeResult(SubmitContradictionCandidate);

const decodeDecision = S.decodeUnknownResult(ContradictionReviewDecision);
const decodeSubmission = S.decodeUnknownResult(SubmitContradictionCandidate);
const supersedeDecisionInput = (reason: string) => ({
  decision: "supersedeProposal",
  proposalDigest: Str.repeat(64)("a"),
  proposalId: Str.repeat(64)("b"),
  reason,
});

describe("Contradiction review commands", () => {
  it("round-trips schema-derived candidate submissions", () => {
    const equivalent = S.toEquivalence(SubmitContradictionCandidate);

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([SubmitContradictionCandidateArbitrary]),
          ([submission]) => {
            const encoded = Result.getOrThrow(encodeSubmitContradictionCandidateResult(submission));
            const decoded = Result.getOrThrow(decodeSubmission(encoded));

            return equivalent(decoded, submission);
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
  });

  it("rejects empty or reversed candidate validity intervals", () => {
    const [submission] = Effect.runSync(
      Arbitrary.sampleEffect(SubmitContradictionCandidateArbitrary, { count: 1, seed: 520 })
    );
    const encoded = Result.getOrThrow(encodeSubmitContradictionCandidateResult(submission));

    expect(Result.isFailure(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: 1_000 }))).toBe(true);
    expect(Result.isFailure(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: 999 }))).toBe(true);
    expect(Result.isSuccess(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: 1_001 }))).toBe(true);
    expect(Result.isSuccess(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: null }))).toBe(true);
  });

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
