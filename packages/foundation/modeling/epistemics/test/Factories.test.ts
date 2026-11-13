import {
  makeClaimEvidenceBasis,
  makeClaimEvidenceReview,
  makeClaimEvidenceReviewStatus,
  makeReviewStatusFor,
} from "@beep/epistemics/ClaimEvidenceReview";
import { makeClaimProjectionView, makeClaimStateCounts } from "@beep/epistemics/ClaimProjection";
import {
  makeBeliefVersionRef,
  makeContradictionArbitraries,
  makeContradictionAssessment,
  makeContradictionBehavior,
  makeContradictionBeliefPairs,
  makeContradictionCandidate,
  makeContradictionDispositionDecision,
  makeContradictionMatchBasis,
  makeContradictionProposals,
  makeContradictionVocabulary,
} from "@beep/epistemics/Contradiction";
import {
  canonicalDetectionJson,
  canonicalDetectionJsonResult,
  makeContradictionDetectionSnapshot,
  makeContradictionDetectionVocabulary,
  makeDetectedContradiction,
  makeDetectionBelief,
  makeDetectionProposalId,
} from "@beep/epistemics/ContradictionDetection";
import { encodeEdgeEndpointKey, makeEdgeEndpoint } from "@beep/epistemics/EdgeEndpoint";
import { EvidenceSpan } from "@beep/epistemics/EvidenceSpan";
import {
  makeEvidenceVerification,
  makeEvidenceVerificationManifestationKey,
} from "@beep/epistemics/EvidenceVerification";
import { makeLogicalEdgeIdentity, makeLogicalEdgeKey } from "@beep/epistemics/LogicalEdgeIdentity";
import { $EpistemicsId } from "@beep/identity/packages";
import { JsoncCanonicalizeError } from "@beep/jsonc/JsoncFingerprint";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SchemaIdentity } from "@beep/epistemics/Factory";

// A second binding, as a party slice would write it: local branded string ids
// and identities under its own composer. None of these come from the
// epistemic slice or the shared kernel.
const PartyClaimId = S.String.pipe(S.brand("PartyClaimId"));
const PartyEvidenceId = S.String.pipe(S.brand("PartyEvidenceId"));
const PartyEdgeVersionId = S.String.pipe(S.brand("PartyEdgeVersionId"));
const PartyPositiveInt = S.Int.check(S.isGreaterThan(0));
const partyIdentity = (module: string): SchemaIdentity => $EpistemicsId.create(`test/party/${module}`);
const otherIdentity = (module: string): SchemaIdentity => $EpistemicsId.create(`test/other/${module}`);

const identifierOf = (schema: S.Top): unknown => schema.ast.annotations?.identifier;
const decode =
  <Schema extends S.Top & { readonly DecodingServices: never }>(schema: Schema) =>
  (input: unknown): Schema["Type"] =>
    Result.getOrThrow(S.decodeUnknownResult(schema)(input));

const sourceDigest = SourceTextDigest.make("sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca");
const source = SourceTextIdentity.make({
  scopeRef: "project:example",
  sourceRef: "document:example",
  locator: PosixPath.make("documents/example.txt"),
  sourceDigest,
  textDigest: sourceDigest,
  extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
  normalizationVersion: "1",
});

const endpoints = makeEdgeEndpoint({
  $I: partyIdentity("EdgeEndpoint"),
  ids: { candidateClaim: PartyClaimId, evidence: PartyEvidenceId },
});

const logicalIdentity = makeLogicalEdgeIdentity({
  $I: partyIdentity("LogicalEdgeIdentity"),
  EdgeEndpoint: endpoints.EdgeEndpoint,
});
class PartyLogicalEdgeIdentity extends S.Opaque<PartyLogicalEdgeIdentity, { readonly brand: unique symbol }>()(
  logicalIdentity.LogicalEdgeIdentitySchema
) {}
const { logicalEdgeKey } = makeLogicalEdgeKey({
  LogicalEdgeIdentity: PartyLogicalEdgeIdentity,
  LogicalEdgeKey: logicalIdentity.LogicalEdgeKey,
});

describe("second binding of the edge factories", () => {
  it("binds endpoints to local ids under its own identifiers", () => {
    const other = makeEdgeEndpoint({
      $I: otherIdentity("EdgeEndpoint"),
      ids: { candidateClaim: PartyClaimId, evidence: PartyEvidenceId },
    });
    const endpoint = decode(endpoints.EdgeEndpoint)({ kind: "evidence", evidenceId: "e-1" });

    expect(encodeEdgeEndpointKey(endpoint)).toBe("evidence:e-1");
    expect(identifierOf(endpoints.EdgeEndpoint)).toBe("@beep/epistemics/test/party/EdgeEndpoint/EdgeEndpoint");
    expect(identifierOf(other.EdgeEndpoint)).not.toBe(identifierOf(endpoints.EdgeEndpoint));
  });

  it("digests logical edge identities independent of symmetric endpoint order", () => {
    const left = { kind: "claim", claimId: "c-1" };
    const right = { kind: "claim", claimId: "c-2" };
    const identityFor = (source: unknown, target: unknown) =>
      PartyLogicalEdgeIdentity.make(
        decode(PartyLogicalEdgeIdentity)({
          evidenceScope: null,
          matterScope: null,
          orgScope: "party",
          qualifiers: {},
          relation: "contradicts",
          source,
          target,
        })
      );

    expect(Str.length(logicalEdgeKey(identityFor(left, right)))).toBe(64);
    expect(logicalEdgeKey(identityFor(left, right))).toBe(logicalEdgeKey(identityFor(right, left)));
  });
});

describe("second binding of the evidence factories", () => {
  it("keys an evidence-verification manifestation over a local evidence id", () => {
    const schemas = makeEvidenceVerification({
      $I: partyIdentity("EvidenceVerification"),
      ids: { evidence: PartyEvidenceId },
    });
    class Manifestation extends S.Opaque<Manifestation, { readonly brand: unique symbol }>()(
      schemas.EvidenceVerificationManifestationSchema
    ) {}
    const digest = makeEvidenceVerificationManifestationKey({
      EvidenceVerificationManifestation: Manifestation,
      EvidenceVerificationManifestationKey: schemas.EvidenceVerificationManifestationKey,
    });
    const manifestation = Manifestation.make({
      evidenceId: PartyEvidenceId.make("e-1"),
      verifiedAnchor: TextAnchorVerificationReceipt.make({
        anchor: TextAnchor.make({ endChar: S.Natural.make(4), quote: "fact", startChar: S.Natural.make(0) }),
        source,
      }),
    });
    const key = Result.getOrThrow(digest.evidenceVerificationManifestationKey(manifestation));

    expect(S.is(schemas.EvidenceVerificationManifestationKey)(key)).toBe(true);
    expect(Result.getOrThrow(digest.isEvidenceVerificationManifestationKey(manifestation, key))).toBe(true);
  });

  it("folds claim projections over local claim references", () => {
    const $I = partyIdentity("ClaimProjection");
    const { ClaimStateCountsSchema } = makeClaimStateCounts({ $I });
    const { ClaimProjectionViewSchema } = makeClaimProjectionView({
      $I,
      ClaimStateCounts: ClaimStateCountsSchema,
      claimRef: PartyClaimId,
    });
    const view = decode(ClaimProjectionViewSchema)({
      total: 1,
      counts: { admitted: 1, candidate: 0, consistency_checked: 0, shape_valid: 0 },
      admittedKeys: ["c-1"],
    });

    expect(view.admittedKeys).toStrictEqual(["c-1"]);
    expect(identifierOf(ClaimProjectionViewSchema)).toBe(
      "@beep/epistemics/test/party/ClaimProjection/ClaimProjectionView"
    );
  });

  it("decides review applicability over a local reviewer and claim reference", () => {
    const $I = partyIdentity("ClaimEvidenceReview");
    const basisSchemas = makeClaimEvidenceBasis({ $I, claimRef: PartyClaimId });
    class Basis extends S.Opaque<Basis, { readonly brand: unique symbol }>()(basisSchemas.ClaimEvidenceBasisSchema) {}
    const reviewSchemas = makeClaimEvidenceReview({ $I, ClaimEvidenceBasis: Basis, reviewer: S.NonEmptyString });
    class Review extends S.Opaque<Review, { readonly brand: unique symbol }>()(
      reviewSchemas.ClaimEvidenceReviewSchema
    ) {}
    const status = makeClaimEvidenceReviewStatus({ $I, ClaimEvidenceBasis: Basis, ClaimEvidenceReview: Review });
    const { reviewStatusFor } = makeReviewStatusFor({
      ClaimEvidenceBasis: Basis,
      ClaimEvidenceReview: Review,
      ClaimEvidenceReviewStatus: status.ClaimEvidenceReviewStatus,
    });
    const basis = Basis.make({
      claimRef: PartyClaimId.make("c-1"),
      assertion: "The source states fact.",
      subject: "Example source",
      evidence: EvidenceSpan.make({
        startChar: S.Natural.make(0),
        endChar: S.Natural.make(4),
        quote: "fact",
        confidence: UnitInterval.make(0.82),
      }),
      source,
    });
    const review = Review.make({ basis, reviewedBy: "reviewer-1", reviewedAt: DateTime.makeUnsafe(0) });
    const verified = status.ClaimEvidenceVerification.cases.Verified.make({});
    const unverified = status.ClaimEvidenceVerification.cases.Unverified.make({ reason: "stale-source" });

    expect(reviewStatusFor(basis, verified, O.none())._tag).toBe("Pending");
    expect(reviewStatusFor(basis, verified, O.some(review))._tag).toBe("Current");
    expect(reviewStatusFor(basis, unverified, O.some(review))._tag).toBe("Stale");
  });
});

const $C = partyIdentity("Contradiction");
const vocabulary = makeContradictionVocabulary({ $I: $C });
const beliefRef = makeBeliefVersionRef({
  $I: $C,
  ids: { edgeVersion: PartyEdgeVersionId },
  positiveInt: PartyPositiveInt,
  LogicalEdgeKey: logicalIdentity.LogicalEdgeKey,
});
class BeliefVersionRef extends S.Opaque<BeliefVersionRef, { readonly brand: unique symbol }>()(
  beliefRef.BeliefVersionRefSchema
) {}
const matchBasis = makeContradictionMatchBasis({ $I: $C, vocabulary, ids: { evidence: PartyEvidenceId } });
class MatchBasis extends S.Opaque<MatchBasis, { readonly brand: unique symbol }>()(
  matchBasis.ContradictionMatchBasisSchema
) {}
const beliefPairs = makeContradictionBeliefPairs({ $I: $C, BeliefVersionRef });
class BeliefPair extends S.Opaque<BeliefPair, { readonly brand: unique symbol }>()(
  beliefPairs.ContradictionBeliefPairSchema
) {}
class CanonicalPair extends S.Opaque<CanonicalPair, { readonly brand: unique symbol }>()(
  beliefPairs.CanonicalContradictionBeliefPairSchema
) {}
const proposals = makeContradictionProposals({ $I: $C, vocabulary, BeliefVersionRef });
class Proposal extends S.Opaque<Proposal, { readonly brand: unique symbol }>()(
  proposals.ContradictionResolutionProposalSchema
) {}
class ProposalContent extends S.Opaque<ProposalContent, { readonly brand: unique symbol }>()(
  proposals.ContradictionProposalContentSchema
) {}
const assessment = makeContradictionAssessment({ $I: $C, vocabulary, ContradictionResolutionProposal: Proposal });
class Assessment extends S.Opaque<Assessment, { readonly brand: unique symbol }>()(
  assessment.ContradictionAssessmentSchema
) {}
const candidate = makeContradictionCandidate({
  $I: $C,
  ContradictionAssessment: Assessment,
  ContradictionMatchBasis: MatchBasis,
  CanonicalContradictionBeliefPair: CanonicalPair,
});
class Canonicalized extends S.Opaque<Canonicalized, { readonly brand: unique symbol }>()(
  candidate.CanonicalizedContradictionSchema
) {}
class CandidateContent extends S.Opaque<CandidateContent, { readonly brand: unique symbol }>()(
  candidate.ContradictionCandidateContentSchema
) {}
const behavior = makeContradictionBehavior({
  vocabulary,
  evidenceIdOrder: Order.String,
  BeliefVersionRef,
  ContradictionMatchBasisStruct: matchBasis.ContradictionMatchBasisStructSchema,
  ContradictionMatchBasis: MatchBasis,
  CanonicalContradictionBeliefPair: CanonicalPair,
  CanonicalizedContradiction: Canonicalized,
  encodeProposalContent: proposals.encodeProposalContent,
  encodeCandidateContent: candidate.encodeCandidateContent,
});
const arbitraries = makeContradictionArbitraries({
  makeEvidenceId: (value: number) => PartyEvidenceId.make(`e-${value}`),
  BeliefVersionRef,
  ContradictionBeliefPairStruct: beliefPairs.ContradictionBeliefPairStructSchema,
  beliefsAreDistinct: beliefPairs.beliefsAreDistinct,
  ContradictionBeliefPair: BeliefPair,
  CanonicalContradictionBeliefPair: CanonicalPair,
  ContradictionMatchBasisStruct: matchBasis.ContradictionMatchBasisStructSchema,
  ContradictionMatchBasis: MatchBasis,
  ContradictionResolutionProposalStructArbitrary: proposals.ContradictionResolutionProposalStructArbitrary,
  ContradictionResolutionProposal: Proposal,
  proposalsShareId: assessment.proposalsShareId,
  ContradictionAssessment: Assessment,
  ContradictionCandidateInterval: candidate.ContradictionCandidateIntervalSchema,
  ContradictionCandidateContent: CandidateContent,
});

const ref = (edgeVersionId: string, key: string) =>
  BeliefVersionRef.make({
    edgeVersionId: PartyEdgeVersionId.make(edgeVersionId),
    logicalKey: logicalIdentity.LogicalEdgeKey.make(Str.repeat(64)(key)),
    version: 1,
  });

const evidenceIds = (values: A.NonEmptyReadonlyArray<string>) => A.map(values, (id) => PartyEvidenceId.make(id));

// A digest helper's failure as its message: the canonical JSON owner's refusal
// arrives in the helper's own `SchemaError` channel, naming its code and pointer.
const failureMessage = <A>(result: Result.Result<A, S.SchemaError>): Result.Result<A, string> =>
  Result.mapError(result, (error) => error.message);

// `true` in the failure channel when that message names the given refusal.
const SEED_COUNT = 64;

const refusedAt = <A>(result: Result.Result<A, S.SchemaError>, refusal: string): Result.Result<A, boolean> =>
  Result.mapError(failureMessage(result), Str.includes(refusal));

const basisFor = (left: A.NonEmptyReadonlyArray<string>, right: A.NonEmptyReadonlyArray<string>) =>
  MatchBasis.make({
    detector: "party-detector",
    detectorVersion: "1.0.0",
    evidenceDigest: behavior.contradictionEvidenceDigest(evidenceIds(left), evidenceIds(right)),
    kind: "independent-evidence",
    leftEvidenceIds: evidenceIds(left),
    rightEvidenceIds: evidenceIds(right),
  });

describe("second binding of the contradiction factories", () => {
  it("rejects a pair that references the same edge version", () => {
    const same = ref("v-1", "a");
    expect(S.is(BeliefPair)({ left: same, right: same })).toBe(false);
    expect(S.is(BeliefPair)({ left: same, right: ref("v-2", "b") })).toBe(true);
  });

  it("canonicalizes submission order and keeps evidence bound to its side", () => {
    const first = ref("v-1", "a");
    const second = ref("v-2", "b");
    const basis = basisFor(["e-1"], ["e-2"]);
    const forward = behavior.canonicalizeContradiction({ left: first, right: second }, basis);
    const reversed = behavior.canonicalizeContradiction({ left: second, right: first }, basis);

    expect(forward.pair.left.edgeVersionId).toBe("v-1");
    expect(reversed.pair.left.edgeVersionId).toBe("v-1");
    expect(reversed.matchBasis.leftEvidenceIds).toStrictEqual(["e-2"]);
    expect(behavior.contradictionCandidateKey({ left: first, right: second }, basis)).toBe(
      behavior.contradictionCandidateKey({ left: second, right: first }, basisFor(["e-2"], ["e-1"]))
    );
  });

  it("digests evidence sets independent of the order ids were supplied in", () => {
    expect(behavior.contradictionEvidenceDigest(evidenceIds(["e-2", "e-1"]), evidenceIds(["e-3"]))).toBe(
      behavior.contradictionEvidenceDigest(evidenceIds(["e-1", "e-2"]), evidenceIds(["e-3"]))
    );
  });

  it("rejects a disposition decision that names a malformed proposal id", () => {
    const { ContradictionDispositionDecision } = makeContradictionDispositionDecision({
      $I: $C,
      vocabulary,
      ids: { edgeVersion: PartyEdgeVersionId },
    });
    expect(S.is(ContradictionDispositionDecision)({ status: "rejected", reason: "Duplicate." })).toBe(true);
    expect(
      S.is(ContradictionDispositionDecision)({
        status: "superseded",
        formerEdgeVersionId: "v-1",
        proposalDigest: "not-a-digest",
        proposalId: "not-an-id",
        reason: "Approved.",
        replacementEdgeVersionId: "v-2",
      })
    ).toBe(false);
  });

  it.effect("generates candidate content its bound class accepts and seals it", () =>
    Effect.gen(function* () {
      const samples = yield* Arbitrary.sampleEffect(arbitraries.ContradictionCandidateContentArbitrary, { count: 10 });
      A.forEach(samples, (content) => {
        expect(S.is(CandidateContent)(content)).toBe(true);
        // This binding's ids are free `S.String`, so a sample can hold an
        // unpaired surrogate, which the seal refuses typed (pinned below).
        Result.match(failureMessage(behavior.contradictionCandidateDigest(content)), {
          onSuccess: (digest) => expect(digest).toMatch(/^[0-9a-f]{64}$/),
          onFailure: (message) => expect(message).toMatch(/LoneSurrogate at "\//),
        });
      });
      const matchBases = yield* Arbitrary.sampleEffect(arbitraries.ContradictionMatchBasisArbitrary, { count: 10 });
      A.forEach(matchBases, (basis) => expect(S.is(MatchBasis)(basis)).toBe(true));
    })
  );

  // The contradiction arbitraries construct their facts; they do not filter
  // generated JSON. Deriving the fact from its checked schema discarded about
  // a quarter of the samples and exhausted this sampler on some seeds,
  // 433213354620349 among them (ep94).
  it.effect("samples candidate content on fixed seeds without exhausting the generator", () =>
    Effect.gen(function* () {
      const seeds = A.prepend(
        A.makeBy(SEED_COUNT, (index) => index + 1),
        433213354620349
      );
      for (const seed of seeds) {
        const samples = yield* Arbitrary.sampleEffect(arbitraries.ContradictionCandidateContentArbitrary, {
          count: 10,
          seed,
        });
        expect(A.every(samples, S.is(CandidateContent))).toBe(true);
      }
      const facts = yield* Arbitrary.sampleEffect(vocabulary.ContradictionProposalFactArbitrary, {
        count: 200,
        seed: 1,
      });
      expect(A.every(facts, S.is(vocabulary.ContradictionProposalFact))).toBe(true);
    })
  );

  it.effect("seals proposal content and hashes detection proposals over local ids", () =>
    Effect.gen(function* () {
      const [proposal] = yield* Arbitrary.sampleEffect(arbitraries.ContradictionResolutionProposalArbitrary, {
        count: 1,
      });
      expect(proposal).toBeDefined();
      const content = ProposalContent.make({
        fact: { value: 1 },
        losingBelief: ref("v-1", "a"),
        proposalId: vocabulary.ContradictionProposalId.make(Str.repeat(64)("c")),
        rationale: "The signed amendment controls.",
        validFrom: DateTime.makeUnsafe(0),
        validTo: O.none(),
      });
      pipe(behavior.contradictionProposalDigest(content), Result.isSuccess, assertTrue);

      const { detectionProposalId } = makeDetectionProposalId({
        contradiction: vocabulary,
        BeliefVersionRef,
        ContradictionProposalContent: ProposalContent,
      });
      const fact = { subject: "s", predicate: "p", value: "A", polarity: "asserted" };
      expect(Result.getOrThrow(detectionProposalId(ref("v-1", "a"), fact))).toBe(
        Result.getOrThrow(detectionProposalId(ref("v-1", "a"), fact))
      );
    })
  );

  it("fails typed, in the SchemaError channel, instead of sealing an unpaired surrogate", () => {
    const content = ProposalContent.make({
      fact: { value: 1 },
      losingBelief: ref("v-\ud800", "a"),
      proposalId: vocabulary.ContradictionProposalId.make(Str.repeat(64)("c")),
      rationale: "The signed amendment controls.",
      validFrom: DateTime.makeUnsafe(0),
      validTo: O.none(),
    });
    const { detectionProposalId } = makeDetectionProposalId({
      contradiction: vocabulary,
      BeliefVersionRef,
      ContradictionProposalContent: ProposalContent,
    });

    assertFailure(
      refusedAt(behavior.contradictionProposalDigest(content), 'LoneSurrogate at "/losingBelief/edgeVersionId"'),
      true
    );
    assertFailure(
      refusedAt(
        detectionProposalId(ref("v-1", "a"), { subject: "s", value: "\udc00" }),
        'LoneSurrogate at "/fact/value"'
      ),
      true
    );
  });

  // The synchronous export keeps its string return (the seal call sites and
  // the two domain aliases use it), so its refusal is the owner's typed error,
  // thrown; the Result twin reports the same refusal as a SchemaError.
  it("canonicalDetectionJson throws the owner's refusal and its Result twin returns it", () => {
    expect(canonicalDetectionJson({ b: 1, a: [true, null] })).toBe('{"a":[true,null],"b":1}');
    assertSuccess(canonicalDetectionJsonResult({ b: 1, a: [true, null] }), '{"a":[true,null],"b":1}');

    const refusal = Result.try(() => canonicalDetectionJson({ a: "\ud800" }));
    assertFailure(
      Result.mapError(refusal, (thrown) => (S.is(JsoncCanonicalizeError)(thrown) ? thrown.code : "not the owner's")),
      "LoneSurrogate"
    );
    assertFailure(refusedAt(canonicalDetectionJsonResult({ a: "\ud800" }), 'LoneSurrogate at "/a"'), true);
  });

  it("validates detection beliefs, snapshots and detected contradictions", () => {
    const $D = partyIdentity("ContradictionDetection");
    const detectionVocabulary = makeContradictionDetectionVocabulary({ $I: $D });
    const belief = makeDetectionBelief({
      $I: $D,
      vocabulary: detectionVocabulary,
      BeliefVersionRef,
      ContradictionMatchBasis: MatchBasis,
      ContradictionProposalContent: ProposalContent,
    });
    class DetectionBelief extends S.Opaque<DetectionBelief, { readonly brand: unique symbol }>()(
      belief.DetectionBeliefSchema
    ) {}
    const snapshot = makeContradictionDetectionSnapshot({
      $I: $D,
      vocabulary: detectionVocabulary,
      DetectionBelief,
    });
    const detected = makeDetectedContradiction({
      $I: $D,
      contradiction: vocabulary,
      ContradictionCandidateContent: CandidateContent,
    });
    const encodedBelief = {
      ref: { edgeVersionId: "v-1", logicalKey: Str.repeat(64)("a"), version: 1 },
      subject: "s",
      predicate: "p",
      value: "A",
      polarity: "asserted",
      evidenceIds: ["e-1"],
      validFrom: 0,
      validTo: null,
    };

    expect(S.is(DetectionBelief)(decode(DetectionBelief)(encodedBelief))).toBe(true);
    pipe(
      S.decodeUnknownResult(DetectionBelief)({ ...encodedBelief, validFrom: 10, validTo: 5 }),
      Result.isFailure,
      assertTrue
    );
    pipe(
      S.decodeUnknownResult(snapshot.ContradictionDetectionSnapshotSchema)({
        beliefs: [encodedBelief, encodedBelief],
        singleValuedPredicates: [],
      }),
      Result.isFailure,
      assertTrue
    );
    expect(R.keys(detected.DetectedContradictionSchema.fields)).toContain("candidateDigest");
  });
});

describe("second binding schema laws", () => {
  it.effect.prop(
    "round-trips schema-derived endpoints and keys them by kind",
    [Arbitrary.schema(endpoints.EdgeEndpoint)],
    ([endpoint]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(endpoints.EdgeEndpoint)(endpoint);
        const decoded = yield* S.decodeEffect(endpoints.EdgeEndpoint)(encoded);
        expect(S.toEquivalence(endpoints.EdgeEndpoint)(decoded, endpoint)).toBe(true);
        assertTrue(Str.startsWith(`${endpoint.kind}:`)(encodeEdgeEndpointKey(endpoint)));
      })
  );
});
