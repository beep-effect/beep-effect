import { ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { PatentClaimCandidateInput, patentClaimCandidateFrom } from "@beep/law-practice-use-cases/PatentClaimCandidate";
import { PosInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const claimText = "A sensor (optical) comprising a detector.";
const evidenceQuote = "A sensor (optical)\ncomprising a detector.";
const sourceText = [
  "DETAILED DESCRIPTION OF THE INVENTION",
  `The phrase ${claimText} appears before the claim itself.`,
  "CLAIMS (CONTINUED)",
  `1. ${evidenceQuote}`,
].join("\n");
const digest = ContentDigest.make("sha256:0000000000000000000000000000000000000000000000000000000000000000");
const operationId = OperationId.make("operation:0000000000000000000000000000000000000000000000000000000000000000");
const claim = PatentClaim.cases.independent.make({
  body: "a detector.",
  claimNumber: PosInt.make(1),
  claimText,
  preamble: "A sensor (optical)",
  transition: "comprising",
});
const dependentClaimText = "The sensor of claim 1, wherein the detector emits a signal.";
const dependentClaim = PatentClaim.cases.dependent.make({
  body: "the detector emits a signal.",
  claimNumber: PosInt.make(2),
  claimReferences: [PosInt.make(1)],
  claimText: dependentClaimText,
  preamble: "The sensor of claim 1,",
  transition: "wherein",
});
const dependentSourceText = `${sourceText}\n2. ${dependentClaimText}`;

const input = (
  identityHex: string,
  claimsHeading = "CLAIMS (CONTINUED)",
  candidateClaim: PatentClaim = claim,
  candidateSourceText = sourceText
) =>
  PatentClaimCandidateInput.make({
    claim: candidateClaim,
    claimsHeading,
    digest,
    docket: "20001US05",
    entitySeed: PosInt.make(1),
    identityDigest: ContentDigest.make(`sha256:${identityHex}`),
    operationId,
    sourceFile: "20001US05-patent.md",
    sourceText: candidateSourceText,
  });

describe("PatentClaimCandidate", () => {
  it.effect(
    "anchors raw evidence after the claims heading and scopes public IDs to the full identity digest",
    Effect.fnUntraced(function* () {
      const first = yield* patentClaimCandidateFrom(input(Str.repeat(64)("1")));
      const second = yield* patentClaimCandidateFrom(input(Str.repeat(64)("2")));
      const dependent = yield* patentClaimCandidateFrom(
        input(Str.repeat(64)("4"), "CLAIMS (CONTINUED)", dependentClaim, dependentSourceText)
      );
      const claimsHeadingStart = O.getOrThrow(Str.indexOf("CLAIMS (CONTINUED)")(sourceText));

      expect(first.evidence.span.quote).toBe(evidenceQuote);
      expect(Str.slice(first.evidence.span.startChar, first.evidence.span.endChar)(sourceText)).toBe(evidenceQuote);
      expect(first.evidence.span.startChar).toBeGreaterThan(claimsHeadingStart);
      expect(first.candidate.publicId).toContain(`p${Str.repeat(64)("1")}c1`);
      expect(first.evidence.publicId).toContain(`p${Str.repeat(64)("1")}c1`);
      expect(second.candidate.publicId).not.toBe(first.candidate.publicId);
      expect(second.evidence.publicId).not.toBe(first.evidence.publicId);
      expect(dependent.candidate.snapshot.claimReferences).toStrictEqual([1]);
    })
  );

  it.effect(
    "fails with a typed error when the numbered claim is absent from the named claims section",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(patentClaimCandidateFrom(input(Str.repeat(64)("3"), "MISSING CLAIMS HEADING")));

      expect(error._tag).toBe("PatentClaimCandidateError");
      expect(error.message).toContain("does not align to the normalized patent source text");
    })
  );
});
