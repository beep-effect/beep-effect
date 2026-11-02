/**
 * Review-item projection edge cases for the claim self-check tool.
 *
 * Every claim text here is synthetic and written for the test.
 */

import { ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import {
  AntecedentFinding,
  ClaimDecompositionError,
  ClaimElementPath,
  claimNumberOfPath,
} from "@beep/law-practice-domain/values/ClaimElement";
import {
  normalizePatentClaims,
  PatentApplicationDocument,
  PatentApplicationSection,
} from "@beep/law-practice-domain/values/PatentDocument";
import {
  ClaimFindingCandidate,
  ClaimSelfCheck,
  ClaimSelfCheckCandidates,
  ClaimSelfCheckInput,
  ClaimSelfCheckLive,
  UsptoClaims,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { ClaimSelfCheckReviewRequest, claimSelfCheckReview } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimSelfCheckReviewResult } from "@beep/law-practice-use-cases/server";

const claimsHeading = "CLAIMS";
const claimsContent = A.join(
  [
    "1. A lamp comprising:",
    "a base; and",
    "a bulb held in the base.",
    "2. The lamp of claim 1, wherein the shade",
    "is green.",
  ],
  "\n"
);
const sourceText = `${claimsHeading}\n${claimsContent}`;

const input = Effect.gen(function* () {
  const claims = yield* normalizePatentClaims([
    ["1", "A lamp comprising:\na base; and\na bulb held in the base."],
    ["2", "The lamp of claim 1, wherein the shade\nis green."],
  ]);
  return ClaimSelfCheckInput.make({
    digest: ContentDigest.make(`sha256:${Str.repeat(64)("0")}`),
    docket: "90002US01",
    document: PatentApplicationDocument.make({
      claims,
      sections: [
        PatentApplicationSection.make({
          content: claimsContent,
          heading: claimsHeading,
          role: "claims",
          sourceEnd: Str.length(sourceText),
          sourceStart: Str.length(claimsHeading) + 1,
        }),
      ],
      sourceText,
    }),
    entitySeed: 11,
    identityDigest: ContentDigest.make(`sha256:${Str.repeat(64)("a")}`),
    operationId: OperationId.make(`operation:${Str.repeat(64)("b")}`),
    sourceFile: "90002US01-claims.md",
  });
}).pipe(Effect.orDie);

const decompositionError = (message: string) =>
  ClaimDecompositionError.make({ claimNumber: 1, message, reason: "unsupported-claim-text" });

// Every non-missing finding kind, derived from one real missing-antecedent candidate.
const variantsOf = (mapped: ClaimFindingCandidate): ReadonlyArray<AntecedentFinding> => {
  const { finding } = mapped;
  const rule = finding.rule;
  const referring = finding.referring;
  const chain = AntecedentFinding.guards["pattern-not-covered"](finding)
    ? A.make(claimNumberOfPath(referring.path))
    : finding.chain;
  const introducing = { ...referring, path: ClaimElementPath.make("1.a") };
  return [
    AntecedentFinding.cases["ambiguous-antecedent"].make({
      rule,
      referring,
      chain,
      candidates: [introducing, { ...referring, path: ClaimElementPath.make("1.b") }],
    }),
    AntecedentFinding.cases["antecedent-outside-chain"].make({ rule, referring, chain, introducing }),
    AntecedentFinding.cases["number-mismatch"].make({ rule, referring, chain, introducing }),
    AntecedentFinding.cases["pattern-not-covered"].make({ rule, referring }),
  ];
};

// Replays the review over candidates derived from the first real candidate.
const reviewWith = Effect.fnUntraced(function* (
  candidates: (mapped: ClaimFindingCandidate) => ReadonlyArray<ClaimFindingCandidate>,
  undecomposed: ReadonlyArray<ClaimDecompositionError>
) {
  const original = yield* input;
  const checker = yield* ClaimSelfCheck;
  const first = yield* checker.candidates(original).pipe(
    Effect.flatMap((checked) => Effect.fromOption(A.head(checked.candidates))),
    Effect.orDie
  );
  return yield* claimSelfCheckReview(ClaimSelfCheckReviewRequest.make({ input: original })).pipe(
    Effect.provideService(ClaimSelfCheck, {
      ...checker,
      candidates: () => Effect.succeed(ClaimSelfCheckCandidates.make({ candidates: candidates(first), undecomposed })),
    })
  );
});

const withFinding = (mapped: ClaimFindingCandidate) => (finding: AntecedentFinding) =>
  ClaimFindingCandidate.make({ ...mapped, finding });

const textOf = (result: ClaimSelfCheckReviewResult, index: number): string =>
  O.getOrThrow(O.map(A.get(result.items, index), (item) => item.text));

const noPublishedClaims = Layer.succeed(
  UsptoClaims,
  UsptoClaims.of({
    claims: Effect.fn("UsptoClaims.claims")(() =>
      Effect.fail(UsptoClaimsError.make({ message: "No recorded claim set.", reason: "not-found" }))
    ),
  })
);

const testLayer = ClaimSelfCheckLive.pipe(Layer.provide(noPublishedClaims));

describe("ClaimSelfCheck review projection", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("explains every finding kind and omits the chain for uncovered patterns", () =>
      Effect.gen(function* () {
        const result = yield* reviewWith((first) => A.map(variantsOf(first), withFinding(first)), []);
        strictEqual(result.items.length, 4);
        assertTrue(Str.includes("Several earlier phrases")(textOf(result, 0)));
        assertTrue(Str.includes("outside this claim's dependency chain")(textOf(result, 1)));
        assertTrue(Str.includes("differ in grammatical number")(textOf(result, 2)));
        assertTrue(Str.includes("needs manual review")(textOf(result, 3)));
        assertFalse(Str.includes("Claims checked")(textOf(result, 3)));
      })
    );

    it.effect("refuses an oversized list of unchecked claims before projecting items", () =>
      Effect.gen(function* () {
        const unchecked = A.replicate(decompositionError(Str.repeat(10_000)("x")), 120);
        const error = yield* Effect.flip(reviewWith(A.empty, unchecked));
        strictEqual(error.reason, "review-response-too-large");
        assertTrue(Str.includes("120 could not be checked")(error.message));
      })
    );

    it.effect("fails when a finding names a claim outside the supplied document", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          reviewWith(
            (mapped) => [
              ClaimFindingCandidate.make({
                ...mapped,
                finding: AntecedentFinding.cases["pattern-not-covered"].make({
                  rule: mapped.finding.rule,
                  referring: { ...mapped.finding.referring, path: ClaimElementPath.make("9.a") },
                }),
              }),
            ],
            []
          )
        );
        strictEqual(error.reason, "candidate-mapping-failed");
        strictEqual(error.claimNumber, 9);
      })
    );

    it.effect("reports a review result that cannot be encoded as a mapping failure", () =>
      Effect.gen(function* () {
        const invalid = ClaimDecompositionError.make(
          { claimNumber: 1, message: "", reason: "unsupported-claim-text" },
          { disableChecks: true }
        );
        const error = yield* Effect.flip(reviewWith(A.empty, [invalid]));
        strictEqual(error.reason, "candidate-mapping-failed");
        strictEqual(error.message, "The review result could not be encoded.");
      })
    );
  });
});
