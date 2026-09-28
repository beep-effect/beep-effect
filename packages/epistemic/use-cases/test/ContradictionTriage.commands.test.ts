import { ContradictionReviewDecision } from "@beep/epistemic-use-cases/public";
import { SubmitContradictionCandidate, SubmitContradictionCandidateArbitrary } from "@beep/epistemic-use-cases/server";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

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
  it.prop(
    "round-trips schema-derived candidate submissions",
    [SubmitContradictionCandidateArbitrary],
    ([submission]) => {
      const equivalent = S.toEquivalence(SubmitContradictionCandidate);
      const encoded = Result.getOrThrow(encodeSubmitContradictionCandidateResult(submission));
      const decoded = Result.getOrThrow(decodeSubmission(encoded));

      assertTrue(equivalent(decoded, submission));
    },
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "rejects empty or reversed candidate validity intervals",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(SubmitContradictionCandidateArbitrary, { count: 1, seed: 520 });
      const submission = pipe(samples, A.head, O.getOrThrow);
      const encoded = Result.getOrThrow(encodeSubmitContradictionCandidateResult(submission));

      pipe(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: 1_000 }), Result.isFailure, assertTrue);
      pipe(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: 999 }), Result.isFailure, assertTrue);
      pipe(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: 1_001 }), Result.isSuccess, assertTrue);
      pipe(decodeSubmission({ ...encoded, validFrom: 1_000, validTo: null }), Result.isSuccess, assertTrue);
    })
  );

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
    pipe(decodeDecision({ decision: "reject", reason: " \n\t " }), Result.isFailure, assertTrue);
    pipe(decodeDecision(supersedeDecisionInput(" \n\t ")), Result.isFailure, assertTrue);
  });

  it("rejects over-limit review reasons for both decisions", () => {
    const overLimitReason = Str.repeat(2_001)("x");

    pipe(decodeDecision({ decision: "reject", reason: overLimitReason }), Result.isFailure, assertTrue);
    pipe(decodeDecision(supersedeDecisionInput(overLimitReason)), Result.isFailure, assertTrue);
  });
});
