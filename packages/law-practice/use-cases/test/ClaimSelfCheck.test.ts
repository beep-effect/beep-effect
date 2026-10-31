import { ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain/values/CitingApplicationIdentity";
import { AntecedentFinding, claimNumberOfPath } from "@beep/law-practice-domain/values/ClaimElement";
import {
  normalizePatentClaims,
  PatentApplicationDocument,
  PatentApplicationSection,
  PatentClaim,
} from "@beep/law-practice-domain/values/PatentDocument";
import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import {
  ClaimSelfCheck,
  ClaimSelfCheckInput,
  ClaimSelfCheckLive,
  UsptoClaimSet,
  UsptoClaimSource,
  UsptoClaims,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { RecordVerdictInput, ReviewQueue, ReviewQueueLive } from "@beep/law-practice-use-cases/ReviewQueue";
import { ClaimSelfCheckReviewRequest, claimSelfCheckReview } from "@beep/law-practice-use-cases/server";
import { VerdictLogMemory } from "@beep/law-practice-use-cases/test";
import { VerdictProjector, VerdictProjectorLive } from "@beep/law-practice-use-cases/VerdictProjector";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Synthetic claims written for this test; the source text wraps lines the way a filed document does.
const claimsHeading = "CLAIMS";
const claimsContent = A.join(
  [
    "1. A camera comprising:",
    "a housing; and",
    "a sensor mounted in the housing.",
    "2. The camera of claim 1, wherein the lens",
    "is tinted.",
    "3. The camera of claim 2, wherein the",
    "shutter is closed and the housing is sealed.",
  ],
  "\n"
);
const sourceText = `${claimsHeading}\n${claimsContent}`;
const sourceStart = Str.length(claimsHeading) + 1;

const knownApplication = UsptoNormalizedApplicationNumber.make("18900001");

const undecomposable = PatentClaim.cases.dependent.make({
  body: "the aperture is open.",
  claimNumber: 3,
  claimReferences: [1],
  claimText: "The camera of claim 1, wherein the shutter is closed.",
  preamble: "The camera of claim 1,",
  transition: "wherein",
});

const numberedClaims: ReadonlyArray<readonly [string, string]> = [
  ["1", "A camera comprising:\na housing; and\na sensor mounted in the housing."],
  ["2", "The camera of claim 1, wherein the lens\nis tinted."],
  ["3", "The camera of claim 2, wherein the\nshutter is closed and the housing is sealed."],
];
const normalizedClaims = normalizePatentClaims(numberedClaims).pipe(Effect.orDie);
const normalizedSiblingClaims = normalizePatentClaims(A.take(numberedClaims, 2));

const document = Effect.map(normalizedClaims, (claims) =>
  PatentApplicationDocument.make({
    claims,
    sections: [
      PatentApplicationSection.make({
        content: claimsContent,
        heading: claimsHeading,
        role: "claims",
        sourceEnd: Str.length(sourceText),
        sourceStart,
      }),
    ],
    sourceText,
  })
);

const inputFor = (claimsDocument: PatentApplicationDocument) =>
  ClaimSelfCheckInput.make({
    digest: ContentDigest.make(`sha256:${Str.repeat(64)("0")}`),
    docket: "90001US01",
    document: claimsDocument,
    entitySeed: 7,
    identityDigest: ContentDigest.make(`sha256:${Str.repeat(64)("a")}`),
    operationId: OperationId.make(`operation:${Str.repeat(64)("b")}`),
    sourceFile: "90001US01-claims.md",
  });
const input = Effect.map(document, inputFor);

// Claim 1 names a body its text does not contain, so it cannot decompose; nothing depends on it.
// Claim 2 is independent and has no referring term, so it raises no finding.
const uncoveredContent = A.join(["1. A tripod comprising: a leg.", "2. A mount comprising: a plate."], "\n");
const uncoveredSourceText = `${claimsHeading}\n${uncoveredContent}`;
const uncoveredDocument = PatentApplicationDocument.make({
  claims: [
    PatentClaim.cases.independent.make({
      body: "a lens.",
      claimNumber: 1,
      claimText: "A tripod comprising: a leg.",
      preamble: "A tripod",
      transition: "comprising",
    }),
    PatentClaim.cases.independent.make({
      body: "a plate.",
      claimNumber: 2,
      claimText: "A mount comprising: a plate.",
      preamble: "A mount",
      transition: "comprising",
    }),
  ],
  sections: [
    PatentApplicationSection.make({
      content: uncoveredContent,
      heading: claimsHeading,
      role: "claims",
      sourceEnd: Str.length(uncoveredSourceText),
      sourceStart,
    }),
  ],
  sourceText: uncoveredSourceText,
});

const inMemoryUsptoClaims = Layer.succeed(
  UsptoClaims,
  UsptoClaims.of({
    claims: Effect.fn("UsptoClaims.claims")(
      (source: UsptoClaimSource): Effect.Effect<UsptoClaimSet, UsptoClaimsError> =>
        UsptoClaimSource.guards.application(source) && source.applicationNumber === knownApplication
          ? Effect.map(normalizedClaims, (claims) =>
              UsptoClaimSet.make({ claims, documentIdentifier: "SYNTHETIC-CLM-1", source })
            )
          : Effect.fail(UsptoClaimsError.make({ message: "No recorded claim set.", reason: "not-found" }))
    ),
  })
);

describe("ClaimSelfCheck", () => {
  it.layer(ClaimSelfCheckLive.pipe(Layer.provide(inMemoryUsptoClaims)), { timeout: "10 seconds" })(
    "over an in-memory claims port",
    (it) => {
      it.effect("checks a claim set where every claim decomposes", () =>
        Effect.gen(function* () {
          const report = yield* (yield* ClaimSelfCheck).check(yield* normalizedClaims);
          assert.deepStrictEqual(
            A.map(report.trees, ({ claimNumber }) => claimNumber),
            [1, 2, 3]
          );
          assert.strictEqual(report.undecomposed.length, 0);
          assert.deepStrictEqual(
            A.map(report.findings, ({ kind, referring }) => [kind, referring.anchor.quote]),
            [
              ["missing-antecedent", "the lens"],
              ["missing-antecedent", "the shutter"],
            ]
          );
        })
      );

      it.effect("reports an undecomposable claim and keeps its siblings' findings", () =>
        Effect.gen(function* () {
          const service = yield* ClaimSelfCheck;
          const siblingClaims = yield* normalizedSiblingClaims;
          const report = yield* service.check(A.append(siblingClaims, undecomposable));
          const siblings = yield* service.check(siblingClaims);
          assert.deepStrictEqual(
            A.map(report.trees, ({ claimNumber }) => claimNumber),
            [1, 2]
          );
          assert.deepStrictEqual(
            A.map(report.undecomposed, ({ claimNumber, reason }) => [claimNumber, reason]),
            [[3, "unsupported-claim-text"]]
          );
          assert.strictEqual(report.findings.length, 1);
          assert.isTrue(Equal.equals(report.findings, siblings.findings));
        })
      );

      it.effect("fails with decomposition-failed when no claim decomposes", () =>
        Effect.gen(function* () {
          const unreadable = PatentClaim.cases.independent.make({
            body: "a lens.",
            claimNumber: 1,
            claimText: "A camera comprising: a housing.",
            preamble: "A camera",
            transition: "comprising",
          });
          const error = yield* Effect.flip((yield* ClaimSelfCheck).check([unreadable]));
          assert.strictEqual(error.reason, "decomposition-failed");
          assert.isTrue(P.isTagged(error.cause, "ClaimDecompositionError"));
        })
      );

      it.effect("checks a published claim set through the claims port", () =>
        Effect.gen(function* () {
          const service = yield* ClaimSelfCheck;
          const published = yield* service.checkPublished(
            UsptoClaimSource.cases.application.make({ applicationNumber: knownApplication })
          );
          assert.strictEqual(published.claimSet.documentIdentifier, "SYNTHETIC-CLM-1");
          assert.isTrue(Equal.equals(published.report, yield* service.check(yield* normalizedClaims)));
          const missing = yield* Effect.flip(
            service.checkPublished(
              UsptoClaimSource.cases.application.make({
                applicationNumber: UsptoNormalizedApplicationNumber.make("18900002"),
              })
            )
          );
          assert.strictEqual(missing.reason, "public-claims-unavailable");
          assert.isTrue(P.isTagged(missing.cause, "UsptoClaimsError"));
        })
      );

      it.effect("maps each finding to one candidate and referring-term evidence, deterministically", () =>
        Effect.gen(function* () {
          const service = yield* ClaimSelfCheck;
          const result = yield* service.candidates(yield* input);
          const report = yield* service.check(yield* normalizedClaims);
          const mapped = result.candidates;
          assert.deepStrictEqual(result, yield* service.candidates(yield* input));
          assert.strictEqual(result.undecomposed.length, 0);
          assert.isTrue(
            Equal.equals(
              A.map(mapped, ({ finding }) => finding),
              report.findings
            )
          );
          assert.deepStrictEqual(
            A.map(mapped, ({ evidence }) => evidence.span.quote),
            ["the lens", "the\nshutter"]
          );
          for (const { candidate, evidence, finding } of mapped) {
            const { endChar, quote, startChar } = evidence.span;
            assert.strictEqual(Str.slice(startChar, endChar)(sourceText), quote);
            assert.strictEqual(candidate.lifecycle, "candidate");
            assert.strictEqual(candidate.snapshot.activityKind, "claim-self-check");
            assert.strictEqual(candidate.snapshot.rule, finding.rule);
            assert.strictEqual(candidate.snapshot.referringQuote, finding.referring.anchor.quote);
            assert.deepStrictEqual(
              candidate.snapshot.chain,
              AntecedentFinding.guards["pattern-not-covered"](finding) ? null : finding.chain
            );
          }
          assert.strictEqual(A.dedupe(A.map(mapped, ({ candidate }) => candidate.publicId)).length, mapped.length);
          assert.strictEqual(A.dedupe(A.map(mapped, ({ evidence }) => evidence.publicId)).length, mapped.length);
        })
      );

      it.effect("returns an undecomposable claim with no dependents instead of reading as clean", () =>
        Effect.gen(function* () {
          const result = yield* (yield* ClaimSelfCheck).candidates(inputFor(uncoveredDocument));
          assert.strictEqual(result.candidates.length, 0);
          assert.deepStrictEqual(
            A.map(result.undecomposed, ({ claimNumber, reason }) => [claimNumber, reason]),
            [[1, "unsupported-claim-text"]]
          );
        })
      );
    }
  );
});

const reviewItemJson = S.fromJsonString(ReviewItem);

describe("ClaimSelfCheck read-only review items", () => {
  const testLayer = Layer.mergeAll(
    ClaimSelfCheckLive.pipe(Layer.provide(inMemoryUsptoClaims)),
    ReviewQueueLive.pipe(Layer.provide(VerdictLogMemory)),
    VerdictProjectorLive
  );
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("quotes each actual claim, preserves evidence and round-trips the review envelope", () =>
      Effect.gen(function* () {
        const original = yield* input;
        const result = yield* claimSelfCheckReview(
          ClaimSelfCheckReviewRequest.make({ input: original, boxFileId: O.some("1234567890") })
        );
        assert.strictEqual(result.items.length, 2);
        assert.strictEqual(result.undecomposed.length, 0);
        const firstItem = yield* Effect.fromOption(A.head(result.items));
        assert.isTrue(Str.includes("Claims checked: 2 → 1.")(firstItem.text));
        for (const [item, mapped] of A.zip(result.items, result.candidates)) {
          assert.strictEqual(item.claimId, mapped.candidate.id);
          assert.strictEqual(item.itemId, `claim-finding:${mapped.candidate.publicId}`);
          assert.strictEqual(mapped.candidate.lifecycle, "candidate");
          const claim = yield* Effect.fromOption(
            A.findFirst(
              original.document.claims,
              (value) => value.claimNumber === claimNumberOfPath(mapped.finding.referring.path)
            )
          );
          assert.isTrue(Str.includes(claim.claimText)(item.text));
          assert.isTrue(Str.includes(mapped.finding.referring.anchor.quote)(item.text));
          const source = yield* Effect.fromOption(A.head(item.sourceRefs));
          assert.strictEqual(source.boxFileId, "1234567890");
          assert.strictEqual(source.quote.exact, claim.claimText);
          const encoded = yield* S.encodeEffect(reviewItemJson)(item);
          const decoded = yield* S.decodeEffect(reviewItemJson)(encoded);
          assert.deepStrictEqual(decoded, item);
        }
        const other = yield* claimSelfCheckReview(
          ClaimSelfCheckReviewRequest.make({
            input: ClaimSelfCheckInput.make({
              ...original,
              identityDigest: ContentDigest.make(`sha256:${Str.repeat(64)("c")}`),
            }),
          })
        );
        assert.deepStrictEqual(
          A.map(result.candidates, (value) => value.candidate.id),
          A.map(other.candidates, (value) => value.candidate.id)
        );
        assert.isFalse(A.some(A.zip(result.items, other.items), ([first, second]) => first.itemId === second.itemId));
        assert.isTrue(A.every(other.items, (item) => A.isReadonlyArrayEmpty(item.sourceRefs)));
      })
    );
    it.effect("retains unchecked claims when there are no review findings", () =>
      Effect.gen(function* () {
        const result = yield* claimSelfCheckReview(
          ClaimSelfCheckReviewRequest.make({ input: inputFor(uncoveredDocument) })
        );
        assert.deepStrictEqual(result.items, []);
        assert.deepStrictEqual(result.candidates, []);
        assert.deepStrictEqual(
          A.map(result.undecomposed, (error) => error.claimNumber),
          [1]
        );
      })
    );
    it.effect("projects actual generated review items from right to active and wrong to rejected", () =>
      Effect.gen(function* () {
        const result = yield* claimSelfCheckReview(ClaimSelfCheckReviewRequest.make({ input: yield* input }));
        const item = yield* Effect.fromOption(A.head(result.items));
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const principal = yield* S.decodeEffect(Principal)({ kind: "User", userId: 1 });
        const right = yield* queue.recordVerdict(
          RecordVerdictInput.make({ itemId: item.itemId, batchId: "synthetic-claim-check", verdict: "right" })
        );
        assertSome(
          O.map(projector.projectItem({ item, resolvedBy: principal, rows: [right] }), (value) => value.status),
          "active"
        );
        const wrong = yield* queue.recordVerdict(
          RecordVerdictInput.make({
            itemId: item.itemId,
            batchId: "synthetic-claim-check",
            verdict: "wrong",
            note: O.some("The introduction is supplied by the parent claim."),
          })
        );
        const rejected = projector.projectItem({ item, resolvedBy: principal, rows: [right, wrong] });
        assertSome(
          O.map(rejected, (value) => value.status),
          "rejected"
        );
        assertSome(
          O.map(rejected, (value) => value.claimId),
          item.claimId
        );
        assertSome(
          O.map(rejected, (value) => value.reason),
          "The introduction is supplied by the parent claim."
        );
      })
    );
  });
});
