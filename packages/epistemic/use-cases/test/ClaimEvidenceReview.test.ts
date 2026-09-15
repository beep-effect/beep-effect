import { ClaimEvidenceBasis, ClaimEvidenceReview } from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import {
  ApproveClaimEvidence,
  approveClaimEvidence,
  ExplainClaimEvidence,
  explainClaimEvidence,
} from "@beep/epistemic-use-cases/ClaimEvidenceReview";
import { SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeBasis = S.decodeUnknownSync(ClaimEvidenceBasis);
const decodeUser = S.decodeUnknownSync(UserPrincipal);
const isReview = S.is(ClaimEvidenceReview);
const makeBasis = () =>
  decodeBasis({
    claimRef: "claim:fact",
    assertion: "The source states fact.",
    subject: "Example source",
    evidence: { startChar: 0, endChar: 4, quote: "fact", confidence: 0.82 },
    source: {
      scopeRef: "project:example",
      sourceRef: "document:example",
      locator: "documents/example.txt",
      sourceDigest: "sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca",
      textDigest: "sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca",
      extractor: { name: "utf8", version: "1" },
      normalizationVersion: "1",
    },
  });
const reviewer = decodeUser({ kind: "User", userId: 1 });

layer(BunCrypto.layer)("claim evidence explanation and approval", (it) => {
  it.effect(
    "verifies before creating a detached timestamped approval",
    Effect.fnUntraced(function* () {
      const basis = makeBasis();
      const pending = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({ basis, currentSource: basis.source, sourceText: "fact", review: O.none() })
      );
      expect(pending.verification._tag).toBe("Verified");
      expect(pending.review._tag).toBe("Pending");
      const review = yield* approveClaimEvidence(
        ApproveClaimEvidence.make({ basis, currentSource: basis.source, sourceText: "fact", reviewedBy: reviewer })
      );
      expect(review.basis).toEqual(basis);
      expect(review.basis).not.toBe(basis);
      expect(review.basis.source).not.toBe(basis.source);
      expect(DateTime.toEpochMillis(review.reviewedAt)).toBe(0);
      const current = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({ basis, currentSource: basis.source, sourceText: "fact", review: O.some(review) })
      );
      expect(current.review._tag).toBe("Current");
    })
  );

  it.effect(
    "exposes text drift and refuses approval",
    Effect.fnUntraced(function* () {
      const basis = makeBasis();
      const command = ApproveClaimEvidence.make({
        basis,
        currentSource: basis.source,
        sourceText: "fact",
        reviewedBy: reviewer,
      });
      const review = yield* approveClaimEvidence(command);
      const explanation = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({ basis, currentSource: basis.source, sourceText: "fake", review: O.some(review) })
      );
      expect(explanation.verification).toEqual({ _tag: "Unverified", reason: "stale-source" });
      expect(explanation.review).toMatchObject({ _tag: "Stale", reason: "source-unverified" });
      const failure = yield* approveClaimEvidence(ApproveClaimEvidence.make({ ...command, sourceText: "fake" })).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "VerifiedTextAnchorError", reason: "stale-source" });
    })
  );

  it.effect(
    "invalidates extractor drift with unchanged text and digests",
    Effect.fnUntraced(function* () {
      const basis = makeBasis();
      const review = yield* approveClaimEvidence(
        ApproveClaimEvidence.make({ basis, currentSource: basis.source, sourceText: "fact", reviewedBy: reviewer })
      );
      const currentSource = SourceTextIdentity.make({
        ...basis.source,
        extractor: SourceTextExtractor.make({ name: "utf8", version: "2" }),
      });
      const stale = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({ basis, currentSource, sourceText: "fact", review: O.some(review) })
      );
      expect(stale.verification).toEqual({ _tag: "Unverified", reason: "stale-source" });
      const reextracted = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({
          basis: ClaimEvidenceBasis.make({ ...basis, source: currentSource }),
          currentSource,
          sourceText: "fact",
          review: O.some(review),
        })
      );
      expect(reextracted.verification._tag).toBe("Verified");
      expect(reextracted.review).toMatchObject({ _tag: "Stale", reason: "basis-changed" });
    })
  );

  it.effect(
    "refuses cross-scope sources and quote mismatches",
    Effect.fnUntraced(function* () {
      const basis = makeBasis();
      const crossScope = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({
          basis,
          currentSource: SourceTextIdentity.make({ ...basis.source, scopeRef: "project:other" }),
          sourceText: "fact",
          review: O.none(),
        })
      );
      expect(crossScope.verification).toEqual({ _tag: "Unverified", reason: "cross-scope" });
      const wrongQuote = decodeBasis({
        ...basis,
        evidence: { ...basis.evidence, quote: "fake" },
      });
      const mismatch = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({
          basis: wrongQuote,
          currentSource: basis.source,
          sourceText: "fact",
          review: O.none(),
        })
      );
      expect(mismatch.verification).toEqual({ _tag: "Unverified", reason: "quote-mismatch" });
    })
  );

  it.effect(
    "keeps changed interpretation separate from verified quoting",
    Effect.fnUntraced(function* () {
      const basis = makeBasis();
      const review = yield* approveClaimEvidence(
        ApproveClaimEvidence.make({ basis, currentSource: basis.source, sourceText: "fact", reviewedBy: reviewer })
      );
      const explanation = yield* explainClaimEvidence(
        ExplainClaimEvidence.make({
          basis: ClaimEvidenceBasis.make({ ...basis, assertion: "Every claim is proven." }),
          currentSource: basis.source,
          sourceText: "fact",
          review: O.some(review),
        })
      );
      expect(explanation.verification._tag).toBe("Verified");
      expect(explanation.review).toMatchObject({ _tag: "Stale", reason: "basis-changed" });
    })
  );

  it.effect(
    "snapshots assertion and reviewer before digest computation",
    Effect.fnUntraced(function* () {
      const crypto = yield* Crypto.Crypto;
      const basis = makeBasis();
      const human = decodeUser({ kind: "User", userId: 1 });
      const mutatingCrypto = Crypto.make({
        randomBytes: crypto.randomBytes,
        digest: Effect.fn("EvidenceReviewTest.mutatingDigest")((algorithm, data) =>
          Effect.sync(() => {
            Reflect.set(basis, "assertion", "Changed while hashing");
            Reflect.set(basis.source.extractor, "version", "99");
            Reflect.set(human, "userId", 2);
          }).pipe(Effect.andThen(crypto.digest(algorithm, data)))
        ),
      });
      const review = yield* approveClaimEvidence(
        ApproveClaimEvidence.make({ basis, currentSource: basis.source, sourceText: "fact", reviewedBy: human })
      ).pipe(Effect.provideService(Crypto.Crypto, mutatingCrypto));
      expect(basis.assertion).toBe("Changed while hashing");
      expect(review.basis.assertion).toBe("The source states fact.");
      expect(review.basis.source.extractor.version).toBe("1");
      expect(review.reviewedBy.userId).toBe(1);
      expect(isReview(review)).toBe(true);
    })
  );
});
